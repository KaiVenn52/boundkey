import crypto from 'node:crypto';

export const REQUEST_VERSION = 2;
export const DEEP_LINK_SCHEME = 'boundkey';
export const VOUCHER_MAGIC = Buffer.from([0x56, 0x01]);
export const VOUCHER_LENGTH = 50;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

function assertString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`);
  return value.trim();
}

function assertPositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be > 0`);
  return value;
}

function assertFutureIso(value, name) {
  assertString(value, name);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`${name} must be an ISO date`);
  return value;
}

export function base58Encode(bytes) {
  const input = Buffer.from(bytes);
  if (input.length === 0) return '';
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros += 1;
  let value = 0n;
  for (const byte of input) value = (value << 8n) | BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }
  return '1'.repeat(zeros) + encoded;
}

export function base58Decode(value) {
  assertString(value, 'base58');
  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;
  let number = 0n;
  for (const char of value) {
    const digit = BASE58_INDEX.get(char);
    if (digit === undefined) throw new Error(`Invalid base58 character: ${char}`);
    number = number * 58n + BigInt(digit);
  }
  const out = [];
  while (number > 0n) {
    out.push(Number(number & 0xffn));
    number >>= 8n;
  }
  out.reverse();
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(out)]);
}

export function isSolanaAddress(value) {
  try {
    return base58Decode(value).length === 32;
  } catch {
    return false;
  }
}

export function generateDelegatedSigner() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.from(jwk.x, 'base64url');
  if (raw.length !== 32) throw new Error('Unexpected Ed25519 public-key length');
  return Object.freeze({
    address: base58Encode(raw),
    publicKey,
    privateKey,
  });
}

export function randomSolanaAddress() {
  return base58Encode(crypto.randomBytes(32));
}

export function publicKeyFromSolanaAddress(address) {
  const raw = base58Decode(address);
  if (raw.length !== 32) throw new Error('Solana Ed25519 address must decode to 32 bytes');
  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function unsignedPermissionRequest(request) {
  const { proof: _proof, ...unsigned } = request;
  return unsigned;
}

export function createPermissionRequest(input) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? new Date(Date.parse(createdAt) + 10 * 60_000).toISOString();
  const maxSpend = Number(assertPositiveNumber(Number(input.maxSpend), 'maxSpend').toFixed(6));
  const decimals = Number.isInteger(input.decimals) ? input.decimals : 6;
  if (decimals < 0 || decimals > 18) throw new Error('decimals must be between 0 and 18');
  const maxSpendAtomic = input.maxSpendAtomic ?? BigInt(Math.round(maxSpend * 10 ** decimals)).toString();

  const request = {
    version: REQUEST_VERSION,
    id: input.id ?? crypto.randomUUID(),
    nonce: input.nonce ?? crypto.randomBytes(16).toString('base64url'),
    protocol: {
      rail: input.rail ?? 'mpp',
      intent: input.intent ?? 'session',
      voucherSigner: input.voucherSigner ?? 'client',
    },
    agent: {
      name: assertString(input.agentName, 'agentName'),
      publicKey: assertString(input.agentPublicKey, 'agentPublicKey'),
    },
    merchant: {
      name: assertString(input.merchantName, 'merchantName'),
      payee: assertString(input.payee, 'payee'),
      ...(input.resource ? { resource: assertString(input.resource, 'resource') } : {}),
    },
    asset: {
      symbol: input.asset ?? 'USDC',
      decimals,
      maxSpend,
      maxSpendAtomic,
    },
    purpose: assertString(input.purpose ?? 'Paid API access', 'purpose'),
    network: input.network ?? 'solana-mainnet',
    createdAt,
    expiresAt,
    ...(input.challenge ? { challenge: input.challenge } : {}),
    ...(input.bridgeUrl ? { bridge: { baseUrl: assertString(input.bridgeUrl, 'bridgeUrl') } } : {}),
  };
  validatePermissionRequest(request, { checkFreshness: false });
  return Object.freeze(request);
}

export function signPermissionRequest(request, delegatedSigner) {
  validatePermissionRequest(request, { checkFreshness: false });
  if (delegatedSigner.address !== request.agent.publicKey) throw new Error('Signer does not match agent public key');
  const payload = Buffer.from(`BOUNDKEY_PERMISSION_V2\n${canonicalJson(unsignedPermissionRequest(request))}`, 'utf8');
  const signature = crypto.sign(null, payload, delegatedSigner.privateKey);
  return Object.freeze({
    ...request,
    proof: {
      algorithm: 'ed25519',
      signer: delegatedSigner.address,
      signature: signature.toString('base64url'),
    },
  });
}

export function verifyPermissionRequestProof(request) {
  validatePermissionRequest(request, { checkFreshness: false });
  if (!request.proof || request.proof.algorithm !== 'ed25519') return false;
  if (request.proof.signer !== request.agent.publicKey) return false;
  try {
    const payload = Buffer.from(`BOUNDKEY_PERMISSION_V2\n${canonicalJson(unsignedPermissionRequest(request))}`, 'utf8');
    return crypto.verify(
      null,
      payload,
      publicKeyFromSolanaAddress(request.proof.signer),
      Buffer.from(request.proof.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

export function encodePermissionRequest(request) {
  validatePermissionRequest(request, { checkFreshness: false });
  return Buffer.from(JSON.stringify(request), 'utf8').toString('base64url');
}

export function decodePermissionRequest(encoded) {
  const request = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  validatePermissionRequest(request, { checkFreshness: false });
  return request;
}

export function toDeepLink(request) {
  return `${DEEP_LINK_SCHEME}://authorize?request=${encodeURIComponent(encodePermissionRequest(request))}`;
}

export function fromDeepLink(link) {
  const url = new URL(link);
  if (url.protocol !== `${DEEP_LINK_SCHEME}:`) throw new Error('Unsupported protocol');
  if (url.hostname !== 'authorize') throw new Error('Unsupported action');
  const encoded = url.searchParams.get('request');
  if (!encoded) throw new Error('Missing permission request');
  return decodePermissionRequest(encoded);
}

export function validatePermissionRequest(request, options = {}) {
  if (!request || request.version !== REQUEST_VERSION) throw new Error('Unsupported request version');
  assertString(request.id, 'id');
  assertString(request.nonce, 'nonce');
  if (request.protocol?.rail !== 'mpp' || request.protocol?.intent !== 'session') throw new Error('Only MPP session requests are supported');
  if (request.protocol?.voucherSigner !== 'client') throw new Error('BoundKey requires client-signed session vouchers');
  assertString(request.agent?.name, 'agent.name');
  if (!isSolanaAddress(request.agent?.publicKey)) throw new Error('agent.publicKey must be a Solana Ed25519 address');
  assertString(request.merchant?.name, 'merchant.name');
  if (!isSolanaAddress(request.merchant?.payee)) throw new Error('merchant.payee must be a Solana address');
  assertPositiveNumber(Number(request.asset?.maxSpend), 'asset.maxSpend');
  if (!/^\d+$/.test(String(request.asset?.maxSpendAtomic))) throw new Error('asset.maxSpendAtomic must be an unsigned integer string');
  assertString(request.asset?.symbol, 'asset.symbol');
  assertString(request.purpose, 'purpose');
  assertFutureIso(request.createdAt, 'createdAt');
  assertFutureIso(request.expiresAt, 'expiresAt');
  if (Date.parse(request.expiresAt) <= Date.parse(request.createdAt)) throw new Error('expiresAt must be after createdAt');
  if (options.checkFreshness !== false && Date.now() >= Date.parse(request.expiresAt)) throw new Error('Permission request expired');
  return true;
}

export function encodeVoucher({ channelId, cumulativeAmount, expiresAt = 0n }) {
  const channelBytes = base58Decode(channelId);
  if (channelBytes.length !== 32) throw new Error('channelId must be a 32-byte Solana address');
  const amount = BigInt(cumulativeAmount);
  const expiry = BigInt(expiresAt);
  if (amount < 0n || amount > 0xffffffffffffffffn) throw new Error('cumulativeAmount must fit u64');
  if (expiry < -0x8000000000000000n || expiry > 0x7fffffffffffffffn) throw new Error('expiresAt must fit i64');
  const bytes = Buffer.alloc(VOUCHER_LENGTH);
  VOUCHER_MAGIC.copy(bytes, 0);
  channelBytes.copy(bytes, 2);
  bytes.writeBigUInt64LE(amount, 34);
  bytes.writeBigInt64LE(expiry, 42);
  return bytes;
}

export function decodeVoucher(bytes) {
  const input = Buffer.from(bytes);
  if (input.length !== VOUCHER_LENGTH) throw new Error(`Voucher must be ${VOUCHER_LENGTH} bytes`);
  if (!input.subarray(0, 2).equals(VOUCHER_MAGIC)) throw new Error('Invalid voucher magic/version');
  return Object.freeze({
    channelId: base58Encode(input.subarray(2, 34)),
    cumulativeAmount: input.readBigUInt64LE(34),
    expiresAt: input.readBigInt64LE(42),
  });
}

export function signVoucher(voucher, delegatedSigner) {
  const message = encodeVoucher(voucher);
  const signature = crypto.sign(null, message, delegatedSigner.privateKey);
  return Object.freeze({
    voucher: decodeVoucher(message),
    signer: delegatedSigner.address,
    signature: signature.toString('base64url'),
    wire: message.toString('base64url'),
  });
}

export function verifySignedVoucher(signedVoucher) {
  try {
    const message = Buffer.from(signedVoucher.wire, 'base64url');
    decodeVoucher(message);
    return crypto.verify(
      null,
      message,
      publicKeyFromSolanaAddress(signedVoucher.signer),
      Buffer.from(signedVoucher.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

/**
 * Deterministic local model of the two hard channel invariants BoundKey relies on:
 * payee binding and deposit cap. It is used for offline demo/tests only; the real
 * enforcement comes from the Solana Payment Channels program.
 */
export class DemoChannel {
  constructor({ deposit, payee, authorizedSigner }) {
    this.deposit = assertPositiveNumber(Number(deposit), 'deposit');
    this.payee = assertString(payee, 'payee');
    this.authorizedSigner = assertString(authorizedSigner, 'authorizedSigner');
    this.spent = 0;
    this.calls = 0;
    this.events = [];
  }

  authorize({ amount, payee, signer, memo = 'metered API call' }) {
    const value = assertPositiveNumber(Number(amount), 'amount');
    if (payee !== this.payee) return this.#block('wrong-payee', value, memo);
    if (signer !== this.authorizedSigner) return this.#block('wrong-signer', value, memo);
    if (this.spent + value > this.deposit + Number.EPSILON) return this.#block('cap-exceeded', value, memo);
    this.spent = Number((this.spent + value).toFixed(6));
    this.calls += 1;
    const event = { ok: true, amount: value, spent: this.spent, remaining: this.remaining(), memo };
    this.events.push(event);
    return event;
  }

  #block(reason, amount, memo) {
    const event = { ok: false, reason, amount, spent: this.spent, remaining: this.remaining(), memo };
    this.events.push(event);
    return event;
  }

  remaining() {
    return Number((this.deposit - this.spent).toFixed(6));
  }

  summary() {
    return {
      deposit: this.deposit,
      spent: this.spent,
      returned: this.remaining(),
      calls: this.calls,
      blocked: this.events.filter((event) => !event.ok).length,
    };
  }
}

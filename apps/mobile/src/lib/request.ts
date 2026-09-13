import { getBase58Encoder } from '@solana/kit';
import { normalizeNetwork, USDC } from '@solana/mpp';
import { ed25519 } from '@noble/curves/ed25519';

export const PAYMENT_CHANNELS_PROGRAM = 'CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX';

export type PermissionRequest = {
  version: 2;
  id: string;
  nonce: string;
  protocol: { rail: 'mpp'; intent: 'session'; voucherSigner: 'client' };
  agent: { name: string; publicKey: string };
  merchant: { name: string; payee: string; resource?: string };
  asset: { symbol: string; decimals: number; maxSpend: number; maxSpendAtomic: string };
  purpose: string;
  network: string;
  createdAt: string;
  expiresAt: string;
  challenge?: Record<string, any>;
  bridge?: { baseUrl: string };
  proof?: { algorithm: 'ed25519'; signer: string; signature: string };
};

export function parseRequestFromUrl(url: string): PermissionRequest {
  const parsed = new URL(url);
  if (parsed.protocol !== 'boundkey:' || parsed.hostname !== 'authorize') throw new Error('Not a BoundKey authorization link');
  const raw = parsed.searchParams.get('request');
  if (!raw) throw new Error('Missing request payload');
  const request = JSON.parse(decodeBase64Url(decodeURIComponent(raw))) as PermissionRequest;
  validateRequest(request);
  return request;
}

export function validateRequest(request: PermissionRequest) {
  if (request.version !== 2) throw new Error('Unsupported BoundKey request version');
  if (request.protocol?.rail !== 'mpp' || request.protocol?.intent !== 'session' || request.protocol?.voucherSigner !== 'client') {
    throw new Error('BoundKey only authorizes client-signed MPP sessions');
  }
  if (!request.id || !request.nonce || !request.agent?.publicKey || !request.merchant?.payee) throw new Error('Incomplete permission request');
  assertSolanaAddress(request.agent.publicKey, 'agent public key');
  assertSolanaAddress(request.merchant.payee, 'merchant payee');
  if (!request.asset || request.asset.maxSpend <= 0 || !/^\d+$/.test(request.asset.maxSpendAtomic)) throw new Error('Invalid spend cap');
  if (!Number.isInteger(request.asset.decimals) || request.asset.decimals !== 6 || request.asset.symbol !== 'USDC') {
    throw new Error('BoundKey currently supports USDC with 6 decimals only');
  }
  const atomic = BigInt(request.asset.maxSpendAtomic);
  if (atomic <= 0n) throw new Error('Invalid spend cap');
  const displayedAtomic = Math.round(request.asset.maxSpend * 10 ** request.asset.decimals);
  if (!Number.isSafeInteger(displayedAtomic) || BigInt(displayedAtomic) !== atomic) throw new Error('Displayed spend cap does not match atomic cap');
  const expires = Date.parse(request.expiresAt);
  const created = Date.parse(request.createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= Date.now() || expires <= created) {
    throw new Error('Authorization request expired or has invalid timestamps');
  }

  if (isLiveMppRequest(request)) validateLiveChallenge(request);
  if (request.challenge || request.bridge) {
    if (!request.challenge || !request.bridge?.baseUrl) throw new Error('Live MPP request requires both challenge and bridge callback');
    if (!request.proof || !verifyPermissionRequestProof(request)) throw new Error('Agent proof-of-possession is missing or invalid');
  }
  return true;
}

export function isLiveMppRequest(request: PermissionRequest) {
  return Boolean(request.challenge && request.bridge?.baseUrl);
}

export function permissionProofPayload(request: PermissionRequest) {
  const { proof: _proof, ...unsigned } = request;
  return new TextEncoder().encode(`BOUNDKEY_PERMISSION_V2\n${canonicalJson(unsigned)}`);
}

export function verifyPermissionRequestProof(request: PermissionRequest) {
  if (!request.proof || request.proof.algorithm !== 'ed25519' || request.proof.signer !== request.agent.publicKey) return false;
  try {
    const signature = decodeBase64UrlBytes(request.proof.signature);
    const publicKey = getBase58Encoder().encode(request.proof.signer);
    return signature.length === 64 && publicKey.length === 32 && ed25519.verify(
      new Uint8Array(signature),
      new Uint8Array(permissionProofPayload(request)),
      new Uint8Array(publicKey),
    );
  } catch {
    return false;
  }
}

function validateLiveChallenge(request: PermissionRequest) {
  const challenge = request.challenge!;
  const outerNetwork = normalizeBoundKeyNetwork(request.network);
  const challengeNetwork = normalizeBoundKeyNetwork(String(challenge.network ?? ''));
  if (!['mainnet', 'devnet'].includes(outerNetwork) || outerNetwork !== challengeNetwork) throw new Error('Displayed network does not match MPP challenge');
  if (challenge.recipient !== request.merchant.payee) throw new Error('Displayed payee does not match MPP challenge');
  if (!/^\d+$/.test(String(challenge.cap ?? '')) || BigInt(request.asset.maxSpendAtomic) > BigInt(challenge.cap)) {
    throw new Error('Displayed spend cap exceeds MPP challenge cap');
  }
  if ((challenge.decimals ?? 6) !== request.asset.decimals) throw new Error('Displayed decimals do not match MPP challenge');
  const expectedMint = USDC[outerNetwork];
  if (!expectedMint || (challenge.currency !== 'USDC' && challenge.currency !== expectedMint)) throw new Error('MPP challenge currency is not canonical USDC');
  if (!Array.isArray(challenge.modes) || !challenge.modes.includes('pull')) throw new Error('MPP challenge does not allow pull mode');
  if (challenge.pullVoucherStrategy !== 'clientVoucher') throw new Error('MPP challenge does not use client vouchers');
  if (challenge.programId && challenge.programId !== PAYMENT_CHANNELS_PROGRAM) throw new Error('MPP challenge uses an unexpected payment-channel program');
  if (Array.isArray(challenge.splits) && challenge.splits.length > 0) throw new Error('MPP split recipients are not supported');
}

function normalizeBoundKeyNetwork(value: string) {
  const unprefixed = value.toLowerCase().replace(/^solana[:-]/, '');
  return normalizeNetwork(unprefixed);
}

function assertSolanaAddress(value: string, label: string) {
  try {
    if (getBase58Encoder().encode(value).length !== 32) throw new Error();
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function decodeBase64UrlBytes(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob !== 'function') throw new Error('Base64 decoder unavailable');
  return Uint8Array.from(globalThis.atob(padded), char => char.charCodeAt(0));
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob !== 'function') throw new Error('Base64 decoder unavailable');
  return decodeURIComponent(
    Array.from(globalThis.atob(padded))
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  );
}

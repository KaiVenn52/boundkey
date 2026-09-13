import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUEST_VERSION,
  VOUCHER_LENGTH,
  base58Decode,
  base58Encode,
  createPermissionRequest,
  decodePermissionRequest,
  decodeVoucher,
  encodePermissionRequest,
  encodeVoucher,
  fromDeepLink,
  generateDelegatedSigner,
  randomSolanaAddress,
  signPermissionRequest,
  signVoucher,
  toDeepLink,
  verifyPermissionRequestProof,
  verifySignedVoucher,
  DemoChannel,
} from '../src/index.js';

function fixture() {
  const signer = generateDelegatedSigner();
  const request = createPermissionRequest({
    id: 'req-demo',
    nonce: 'test-nonce',
    agentName: 'Codex',
    agentPublicKey: signer.address,
    merchantName: 'Demo Research API',
    payee: randomSolanaAddress(),
    maxSpend: 0.5,
    purpose: 'Research market data',
    createdAt: '2026-09-12T00:00:00.000Z',
    expiresAt: '2026-09-12T00:10:00.000Z',
  });
  return { signer, request };
}

test('base58 round-trips a 32-byte Solana public key', () => {
  const raw = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  assert.deepEqual(base58Decode(base58Encode(raw)), raw);
});

test('permission requests survive QR/deeplink encoding', () => {
  const { request } = fixture();
  assert.equal(request.version, REQUEST_VERSION);
  assert.deepEqual(decodePermissionRequest(encodePermissionRequest(request)), request);
  assert.deepEqual(fromDeepLink(toDeepLink(request)), request);
});

test('delegated key proves possession of the authorization request', () => {
  const { request, signer } = fixture();
  const signed = signPermissionRequest(request, signer);
  assert.equal(verifyPermissionRequestProof(signed), true);

  const tampered = structuredClone(signed);
  tampered.asset.maxSpend = 5;
  assert.equal(verifyPermissionRequestProof(tampered), false);
});

test('MPP Solana voucher wire format is exactly 50 bytes and round-trips', () => {
  const channelId = randomSolanaAddress();
  const encoded = encodeVoucher({ channelId, cumulativeAmount: 123456n, expiresAt: 2_000_000_000n });
  assert.equal(encoded.length, VOUCHER_LENGTH);
  assert.deepEqual(decodeVoucher(encoded), {
    channelId,
    cumulativeAmount: 123456n,
    expiresAt: 2_000_000_000n,
  });
});

test('delegated session key signs MPP-compatible voucher bytes', () => {
  const signer = generateDelegatedSigner();
  const signed = signVoucher({
    channelId: randomSolanaAddress(),
    cumulativeAmount: 42000n,
    expiresAt: 2_000_000_000n,
  }, signer);
  assert.equal(verifySignedVoucher(signed), true);

  const tampered = { ...signed, wire: Buffer.alloc(VOUCHER_LENGTH, 0).toString('base64url') };
  assert.equal(verifySignedVoucher(tampered), false);
});

test('demo channel cannot spend past the hard cap', () => {
  const channel = new DemoChannel({ deposit: 0.5, payee: 'merchant', authorizedSigner: 'agent' });
  assert.equal(channel.authorize({ amount: 0.2, payee: 'merchant', signer: 'agent' }).ok, true);
  assert.equal(channel.authorize({ amount: 0.3, payee: 'merchant', signer: 'agent' }).ok, true);
  const rejected = channel.authorize({ amount: 0.001, payee: 'merchant', signer: 'agent' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'cap-exceeded');
  assert.equal(channel.summary().spent, 0.5);
});

test('demo channel is bound to merchant and delegated signer', () => {
  const channel = new DemoChannel({ deposit: 1, payee: 'merchant', authorizedSigner: 'agent' });
  assert.equal(channel.authorize({ amount: 0.1, payee: 'evil', signer: 'agent' }).reason, 'wrong-payee');
  assert.equal(channel.authorize({ amount: 0.1, payee: 'merchant', signer: 'attacker' }).reason, 'wrong-signer');
  assert.equal(channel.summary().spent, 0);
});

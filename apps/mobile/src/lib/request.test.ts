import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { createSignableMessage, generateKeyPairSigner } from '@solana/kit';
import { USDC } from '@solana/mpp';
import {
  PAYMENT_CHANNELS_PROGRAM,
  permissionProofPayload,
  validateRequest,
  verifyPermissionRequestProof,
  type PermissionRequest,
} from './request';

async function validRequest(): Promise<PermissionRequest> {
  const agent = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const operator = await generateKeyPairSigner();
  const request: PermissionRequest = {
    version: 2,
    id: 'request-security-test',
    nonce: 'nonce-security-test',
    protocol: { rail: 'mpp', intent: 'session', voucherSigner: 'client' },
    agent: { name: 'Test Agent', publicKey: agent.address },
    merchant: { name: 'Test Merchant', payee: merchant.address, resource: 'https://example.test/metered' },
    asset: { symbol: 'USDC', decimals: 6, maxSpend: 0.5, maxSpendAtomic: '500000' },
    purpose: 'Security regression test',
    network: 'solana-devnet',
    createdAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    challenge: {
      cap: '500000', currency: USDC.devnet, decimals: 6, modes: ['pull'], network: 'devnet',
      operator: operator.address, programId: PAYMENT_CHANNELS_PROGRAM,
      pullVoucherStrategy: 'clientVoucher', recipient: merchant.address, splits: [],
    },
    bridge: { baseUrl: 'https://bridge.example.test' },
  };
  const [dictionary] = await agent.signMessages([createSignableMessage(permissionProofPayload(request))]);
  request.proof = {
    algorithm: 'ed25519', signer: agent.address,
    signature: Buffer.from(dictionary[agent.address]!).toString('base64url'),
  };
  return request;
}

function clone(request: PermissionRequest): PermissionRequest {
  return JSON.parse(JSON.stringify(request));
}

test('accepts a proof-bound, internally consistent live MPP request', async () => {
  const request = await validRequest();
  assert.equal(verifyPermissionRequestProof(request), true);
  assert.equal(validateRequest(request), true);
});

const mutations: Array<[string, (request: PermissionRequest) => void]> = [
  ['displayed payee differs from challenge', request => { request.merchant.payee = request.agent.publicKey; }],
  ['displayed network differs from challenge', request => { request.network = 'solana-mainnet'; }],
  ['currency is not USDC', request => { request.challenge!.currency = 'SOL'; }],
  ['decimals differ from challenge', request => { request.challenge!.decimals = 9; }],
  ['displayed cap exceeds challenge', request => { request.challenge!.cap = '499999'; }],
  ['challenge adds a split recipient', request => { request.challenge!.splits = [{ recipient: request.agent.publicKey, bps: 100 }]; }],
  ['challenge changes the program', request => { request.challenge!.programId = request.agent.publicKey; }],
  ['challenge removes pull mode', request => { request.challenge!.modes = ['push']; }],
  ['challenge changes voucher custody', request => { request.challenge!.pullVoucherStrategy = 'serverVoucher'; }],
  ['displayed amount differs from atomic amount', request => { request.asset.maxSpend = 0.4; }],
];

for (const [name, mutate] of mutations) {
  test(`rejects ${name}`, async () => {
    const request = clone(await validRequest());
    mutate(request);
    assert.throws(() => validateRequest(request));
  });
}

test('rejects missing and forged agent proof-of-possession', async () => {
  const missing = await validRequest();
  delete missing.proof;
  assert.throws(() => validateRequest(missing), /proof-of-possession/);

  const forged = await validRequest();
  forged.proof!.signature = Buffer.alloc(64, 7).toString('base64url');
  assert.equal(verifyPermissionRequestProof(forged), false);
  assert.throws(() => validateRequest(forged), /proof-of-possession/);
});

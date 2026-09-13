import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createSignableMessage, generateKeyPairSigner } from '@solana/kit';
import { USDC } from '@solana/mpp';
import { canonicalJson } from '../../../packages/protocol/src/index.js';

const port = 18000 + Math.floor(Math.random() * 10000);
const baseUrl = `http://127.0.0.1:${port}`;
let bridge;

async function waitForBridge() {
  // OneDrive-hosted Windows workspaces can take tens of seconds to load the
  // Solana dependency graph; CI/Linux starts much faster.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Bridge did not start');
}

test.before(async () => {
  bridge = spawn(process.execPath, ['apps/agent-bridge/src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForBridge();
});

test.after(() => bridge?.kill());

test('external agent must prove possession before mobile authorization', async () => {
  const agent = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const operator = await generateKeyPairSigner();
  const challenge = {
    cap: '500000', currency: USDC.devnet, decimals: 6, modes: ['pull'], network: 'devnet',
    operator: operator.address, pullVoucherStrategy: 'clientVoucher', recipient: merchant.address, splits: [],
  };
  const createResponse = await fetch(`${baseUrl}/requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      agentPublicKey: agent.address, payee: merchant.address, maxSpend: 0.5,
      maxSpendAtomic: '500000', decimals: 6, network: 'solana-devnet', challenge, bridgeUrl: baseUrl,
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.deepLink, undefined);

  const blockedApproval = await fetch(`${baseUrl}/requests/${created.request.id}/approve`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(blockedApproval.status, 409);

  const forged = await fetch(`${baseUrl}/requests/${created.request.id}/proof`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ algorithm: 'ed25519', signer: agent.address, signature: Buffer.alloc(64, 1).toString('base64url') }),
  });
  assert.equal(forged.status, 400);

  const { proof: _proof, ...unsigned } = created.request;
  const [dictionary] = await agent.signMessages([
    createSignableMessage(`BOUNDKEY_PERMISSION_V2\n${canonicalJson(unsigned)}`),
  ]);
  const proofResponse = await fetch(`${baseUrl}/requests/${created.request.id}/proof`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'ed25519', signer: agent.address,
      signature: Buffer.from(dictionary[agent.address]).toString('base64url'),
    }),
  });
  assert.equal(proofResponse.status, 200);
  const proven = await proofResponse.json();
  assert.equal(proven.proofValid, true);
  assert.match(proven.deepLink, /^boundkey:\/\/authorize\?/);

  const malformedOpen = await fetch(`${baseUrl}/requests/${created.request.id}/approve`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ open: { channelId: 'fake' } }),
  });
  assert.equal(malformedOpen.status, 400);
});

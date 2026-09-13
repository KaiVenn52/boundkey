import http from 'node:http';
import { derivePaymentChannelOpen } from '@solana/mpp/client';
import {
  createPermissionRequest,
  generateDelegatedSigner,
  randomSolanaAddress,
  signPermissionRequest,
  signVoucher,
  toDeepLink,
  verifyPermissionRequestProof,
} from '../../../packages/protocol/src/index.js';

const state = new Map();
const PORT = Number(process.env.PORT ?? 8787);
const PAYMENT_CHANNELS_PROGRAM = 'CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX';
const CHANNEL_GRACE_PERIOD_SECONDS = 900;

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
}

async function parseBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      return res.end();
    }

    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, product: 'BoundKey', protocol: 'mpp-session', version: 2 });
    }

    if (req.method === 'POST' && req.url === '/requests') {
      const input = await parseBody(req);
      const ownedSessionSigner = input.agentPublicKey ? null : generateDelegatedSigner();
      const agentPublicKey = input.agentPublicKey ?? ownedSessionSigner.address;
      const requestBase = createPermissionRequest({
        agentName: input.agentName ?? 'Codex',
        agentPublicKey,
        merchantName: input.merchantName ?? 'Metered Research API',
        payee: input.payee ?? randomSolanaAddress(),
        resource: input.resource ?? 'https://demo.boundkey.app/research',
        maxSpend: input.maxSpend ?? 0.5,
        maxSpendAtomic: input.maxSpendAtomic,
        decimals: input.decimals,
        purpose: input.purpose ?? 'Paid API access',
        network: input.network ?? 'solana-mainnet',
        challenge: input.challenge,
        bridgeUrl: input.bridgeUrl,
      });
      const request = ownedSessionSigner ? signPermissionRequest(requestBase, ownedSessionSigner) : requestBase;

      state.set(request.id, {
        request,
        sessionSigner: ownedSessionSigner,
        status: ownedSessionSigner ? 'pending' : 'awaiting-proof',
        createdAt: Date.now(),
        channelId: null,
        cumulativeAtomic: 0n,
        open: null,
      });
      return json(res, 201, {
        request,
        ...(ownedSessionSigner ? { deepLink: toDeepLink(request) } : {}),
        proofValid: request.proof ? verifyPermissionRequestProof(request) : null,
      });
    }

    const proofMatch = req.url?.match(/^\/requests\/([^/]+)\/proof$/);
    if (req.method === 'POST' && proofMatch) {
      const item = state.get(proofMatch[1]);
      if (!item) return json(res, 404, { error: 'not-found' });
      if (item.sessionSigner || item.status !== 'awaiting-proof') return json(res, 409, { error: 'proof-not-expected' });
      const proof = await parseBody(req);
      const request = Object.freeze({ ...item.request, proof });
      if (!verifyPermissionRequestProof(request)) return json(res, 400, { error: 'invalid-agent-proof' });
      item.request = request;
      item.status = 'pending';
      return json(res, 200, { request, deepLink: toDeepLink(request), proofValid: true });
    }

    const getMatch = req.url?.match(/^\/requests\/([^/]+)$/);
    if (req.method === 'GET' && getMatch) {
      const item = state.get(getMatch[1]);
      if (!item) return json(res, 404, { error: 'not-found' });
      return json(res, 200, {
        request: item.request,
        status: item.status,
        channelId: item.channelId,
        cumulativeAtomic: item.cumulativeAtomic,
        open: item.open,
      });
    }

    const approveMatch = req.url?.match(/^\/requests\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      const item = state.get(approveMatch[1]);
      if (!item) return json(res, 404, { error: 'not-found' });
      const input = await parseBody(req);
      if (item.status !== 'pending') return json(res, 409, { error: 'request-not-pending' });
      if (!item.sessionSigner) {
        if (!verifyPermissionRequestProof(item.request)) return json(res, 409, { error: 'agent-proof-invalid' });
        const open = input.open;
        if (!open?.channelId || !open?.transaction || typeof open.transaction !== 'string') {
          return json(res, 400, { error: 'incomplete-payment-channel-open' });
        }
        if (open.gracePeriod !== CHANNEL_GRACE_PERIOD_SECONDS) return json(res, 400, { error: 'unexpected-grace-period' });
        const expected = await derivePaymentChannelOpen({
          authorizedSigner: item.request.agent.publicKey,
          deposit: item.request.asset.maxSpendAtomic,
          gracePeriod: CHANNEL_GRACE_PERIOD_SECONDS,
          openSlot: open.openSlot,
          payer: open.payer,
          programAddress: PAYMENT_CHANNELS_PROGRAM,
          recipients: [],
          request: item.request.challenge,
          salt: open.salt,
        });
        for (const key of ['channelId', 'deposit', 'gracePeriod', 'mint', 'openSlot', 'payee', 'payer', 'salt']) {
          if (open[key] !== expected[key]) return json(res, 400, { error: `payment-channel-${key}-mismatch` });
        }
      }
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
      item.channelId = input.channelId ?? input.open?.channelId ?? randomSolanaAddress();
      item.transaction = input.transaction ?? input.open?.transaction ?? null;
      item.open = input.open ?? (input.transaction ? { channelId: item.channelId, transaction: input.transaction } : null);
      return json(res, 200, {
        requestId: item.request.id,
        status: item.status,
        channelId: item.channelId,
        approvedAt: item.approvedAt,
        open: item.open,
      });
    }

    const voucherMatch = req.url?.match(/^\/requests\/([^/]+)\/voucher$/);
    if (req.method === 'POST' && voucherMatch) {
      const item = state.get(voucherMatch[1]);
      if (!item) return json(res, 404, { error: 'not-found' });
      if (item.status !== 'approved' || !item.channelId) return json(res, 409, { error: 'not-approved' });
      if (!item.sessionSigner) return json(res, 409, { error: 'external-session-signer', message: 'Vouchers are signed in the agent process for live MPP sessions.' });
      const input = await parseBody(req);
      const deltaAtomic = BigInt(input.deltaAtomic ?? 0);
      if (deltaAtomic <= 0n) return json(res, 400, { error: 'deltaAtomic-must-be-positive' });
      const cap = BigInt(item.request.asset.maxSpendAtomic);
      if (item.cumulativeAtomic + deltaAtomic > cap) return json(res, 409, { error: 'cap-exceeded', cap: cap.toString() });
      item.cumulativeAtomic += deltaAtomic;
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const signedVoucher = signVoucher({
        channelId: item.channelId,
        cumulativeAmount: item.cumulativeAtomic,
        expiresAt,
      }, item.sessionSigner);
      return json(res, 201, signedVoucher);
    }

    return json(res, 404, { error: 'unknown-route' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`BoundKey bridge listening at http://127.0.0.1:${PORT}`);
  console.log('POST /requests → authorize on phone → POST /requests/:id/approve → issue MPP vouchers.');
});

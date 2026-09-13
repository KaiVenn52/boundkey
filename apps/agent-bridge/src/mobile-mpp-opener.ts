import { Buffer } from 'node:buffer';
import { createSignableMessage, generateKeyPairSigner } from '@solana/kit';
import {
  ActiveSession,
  DEFAULT_SESSION_EXPIRES_AT,
  PENDING_SERVER_SIGNATURE,
  type PaymentChannelOpenTransaction,
  type SessionOpener,
} from '@solana/mpp/client';
import { canonicalJson } from '../../../packages/protocol/src/index.js';

export type BoundKeyMobileOpenerOptions = {
  bridgeBaseUrl: string;
  agentName?: string;
  maxSpendAtomic?: string;
  approvalTimeoutMs?: number;
  pollIntervalMs?: number;
  onAuthorizationRequest?: (request: { deepLink: string; requestId: string }) => void;
};

type BridgeRequest = {
  request: { id: string; [key: string]: unknown };
  deepLink?: string;
};

type BridgeState = {
  status: 'pending' | 'approved';
  open?: PaymentChannelOpenTransaction | null;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resourceUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

async function waitForMobileApproval(baseUrl: string, requestId: string, timeoutMs: number, pollIntervalMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/requests/${encodeURIComponent(requestId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`BoundKey bridge polling failed (${response.status})`);
    const state = await response.json() as BridgeState;
    if (state.status === 'approved') {
      if (!state.open?.channelId || !state.open?.transaction) throw new Error('Mobile approval is missing payment-channel open data');
      return state.open;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error('Timed out waiting for mobile authorization');
}

/**
 * A real MPP SessionOpener whose payer signature is delegated to a Solana Mobile wallet.
 *
 * Desktop/cloud agent:
 *   1. receives the MPP session challenge,
 *   2. creates the ephemeral client-voucher signer,
 *   3. sends the challenge + session public key to the BoundKey mobile app,
 *   4. waits while the phone builds/signs the official payment-channel open via MWA,
 *   5. resumes the canonical SessionFetch flow with the session key still local to the agent.
 */
export function createBoundKeyMobileOpener(options: BoundKeyMobileOpenerOptions): SessionOpener {
  const baseUrl = options.bridgeBaseUrl.replace(/\/$/, '');
  const timeoutMs = options.approvalTimeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 700;

  return async ({ challenge, input }) => {
    const sessionSigner = await generateKeyPairSigner();
    const details = challenge.request;
    if (!details.modes?.includes('pull')) {
      throw new Error('BoundKey requires an MPP session challenge that supports pull mode');
    }
    if (details.pullVoucherStrategy !== 'clientVoucher') {
      throw new Error('BoundKey requires pullVoucherStrategy="clientVoucher"');
    }

    const decimals = details.decimals ?? 6;
    const challengeCap = BigInt(details.cap);
    const maxSpendAtomic = options.maxSpendAtomic ?? details.cap;
    const requestedCap = BigInt(maxSpendAtomic);
    if (requestedCap <= 0n) throw new Error('Configured cap must be positive');
    if (requestedCap > challengeCap) {
      throw new Error(`Configured cap ${requestedCap} exceeds challenge cap ${challengeCap}`);
    }
    const maxSpend = Number(requestedCap) / 10 ** decimals;

    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentName: options.agentName ?? 'AI Agent',
        agentPublicKey: sessionSigner.address,
        merchantName: details.description ?? 'MPP metered service',
        payee: details.recipient,
        resource: resourceUrl(input),
        maxSpend,
        maxSpendAtomic,
        decimals,
        purpose: details.description ?? 'Metered agent task',
        network: details.network,
        challenge: details,
        bridgeUrl: baseUrl,
      }),
    });
    if (!createResponse.ok) throw new Error(`BoundKey bridge rejected request (${createResponse.status})`);
    const created = await createResponse.json() as BridgeRequest;
    const { proof: _proof, ...unsigned } = created.request;
    const payload = `BOUNDKEY_PERMISSION_V2\n${canonicalJson(unsigned)}`;
    const [signatureDictionary] = await sessionSigner.signMessages([createSignableMessage(payload)]);
    const signature = signatureDictionary[sessionSigner.address];
    if (!signature) throw new Error('Session signer did not return proof-of-possession');
    const proofResponse = await fetch(`${baseUrl}/requests/${encodeURIComponent(created.request.id)}/proof`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        algorithm: 'ed25519',
        signer: sessionSigner.address,
        signature: Buffer.from(signature).toString('base64url'),
      }),
    });
    if (!proofResponse.ok) throw new Error(`BoundKey bridge rejected agent proof (${proofResponse.status})`);
    const proven = await proofResponse.json() as BridgeRequest;
    if (!proven.deepLink) throw new Error('BoundKey bridge omitted the proven authorization link');
    options.onAuthorizationRequest?.({ deepLink: proven.deepLink, requestId: proven.request.id });

    const open = await waitForMobileApproval(baseUrl, proven.request.id, timeoutMs, pollIntervalMs);
    const session = new ActiveSession({
      channelId: open.channelId,
      signer: sessionSigner,
      expiresAt: DEFAULT_SESSION_EXPIRES_AT,
    });

    return {
      payload: session.openPaymentChannelAction({
        deposit: open.deposit,
        gracePeriod: open.gracePeriod,
        mint: open.mint,
        mode: 'pull',
        openSlot: open.openSlot,
        payee: open.payee,
        payer: open.payer,
        salt: open.salt,
        signature: PENDING_SERVER_SIGNATURE,
        transaction: open.transaction,
      }),
      session,
      source: 'boundkey-mobile',
    };
  };
}

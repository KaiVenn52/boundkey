import type { TransactionSigner } from '@solana/kit';
import { buildOpenPaymentChannelTransaction, type PaymentChannelOpenTransaction, type SessionRequest } from '@solana/mpp/client';
import { PAYMENT_CHANNELS_PROGRAM, validateRequest, type PermissionRequest } from './request';

export const CHANNEL_GRACE_PERIOD_SECONDS = 900;

/**
 * Builds the actual MPP Solana payment-channel open transaction using the
 * official @solana/mpp client. The MWA-backed payer signer lives on the phone;
 * request.agent.publicKey is the delegated session signer living on the agent machine.
 *
 * The result is partially signed by the mobile payer. In MPP session flow the
 * operator/merchant adds its required signature and broadcasts it.
 */
export async function buildMobileAuthorizedOpen(
  request: PermissionRequest,
  payerSigner: TransactionSigner,
): Promise<PaymentChannelOpenTransaction> {
  validateRequest(request);
  if (!request.challenge) throw new Error('Live MPP challenge missing. Demo requests do not broadcast transactions.');
  const challenge = request.challenge as unknown as SessionRequest;
  return buildOpenPaymentChannelTransaction({
    authorizedSigner: request.agent.publicKey,
    deposit: request.asset.maxSpendAtomic,
    gracePeriod: CHANNEL_GRACE_PERIOD_SECONDS,
    programAddress: PAYMENT_CHANNELS_PROGRAM,
    recipients: [],
    request: challenge,
    signer: payerSigner,
  });
}

export async function returnApprovalToBridge(request: PermissionRequest, open: PaymentChannelOpenTransaction) {
  validateRequest(request);
  if (!request.bridge?.baseUrl) throw new Error('Bridge callback missing');
  if (open.payee !== request.merchant.payee || open.deposit !== request.asset.maxSpendAtomic || open.gracePeriod !== CHANNEL_GRACE_PERIOD_SECONDS) {
    throw new Error('Payment-channel open does not match the approved request');
  }
  const response = await fetch(`${request.bridge.baseUrl.replace(/\/$/, '')}/requests/${encodeURIComponent(request.id)}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channelId: open.channelId, transaction: open.transaction, open }),
  });
  if (!response.ok) throw new Error(`Bridge rejected approval (${response.status})`);
  return response.json();
}

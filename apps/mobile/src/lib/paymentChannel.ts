import type { Address, Transaction, TransactionPartialSigner } from '@solana/kit';
import { buildOpenPaymentChannelTransaction, type PaymentChannelOpenTransaction, type SessionRequest } from '@solana/mpp/client';
import { PAYMENT_CHANNELS_PROGRAM, validateRequest, type PermissionRequest } from './request';

export const CHANNEL_GRACE_PERIOD_SECONDS = 900;

export function createMobilePartialSigner(
  payer: Address,
  signTransactions: (transactions: Transaction[]) => Promise<Transaction[]>,
): TransactionPartialSigner {
  return {
    address: payer,
    async signTransactions(transactions) {
      const signed = await signTransactions([...transactions]);
      if (signed.length !== transactions.length) throw new Error('Wallet returned an incomplete transaction batch');
      return signed.map((transaction, index) => {
        const expected = transactions[index].messageBytes;
        if (transaction.messageBytes.length !== expected.length || transaction.messageBytes.some((byte, i) => byte !== expected[i])) {
          throw new Error('Wallet changed the approved transaction message');
        }
        const signature = transaction.signatures[payer];
        if (!signature || signature.length !== 64) throw new Error('Wallet did not sign the channel open');
        return { [payer]: signature };
      });
    },
  };
}

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
  payerSigner: TransactionPartialSigner,
): Promise<PaymentChannelOpenTransaction> {
  validateRequest(request);
  if (!request.challenge) throw new Error('Live MPP challenge missing. Demo requests do not broadcast transactions.');
  const challenge = request.challenge as unknown as SessionRequest;
  // Human review can outlive the challenge's blockhash. Refresh only the
  // transaction lifetime; retain all approved permission and PDA fields.
  const { recentBlockhash: _reviewBlockhash, ...freshChallenge } = challenge;
  return buildOpenPaymentChannelTransaction({
    authorizedSigner: request.agent.publicKey,
    deposit: request.asset.maxSpendAtomic,
    gracePeriod: CHANNEL_GRACE_PERIOD_SECONDS,
    programAddress: PAYMENT_CHANNELS_PROGRAM,
    recipients: [],
    request: freshChallenge,
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

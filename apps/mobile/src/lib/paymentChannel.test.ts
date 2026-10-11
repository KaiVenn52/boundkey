import test from 'node:test';
import assert from 'node:assert/strict';
import { address, type SignatureBytes, type Transaction } from '@solana/kit';
import { createMobilePartialSigner } from './paymentChannel';

const payer = address('FRKZCBdSoNvS4ogZ4P81rTP8Dg5owWbfY6kTFrFyCwoy');
const transaction = { messageBytes: new Uint8Array([1, 2, 3]), signatures: { [payer]: null } } as unknown as Transaction;
const signature = new Uint8Array(64).fill(5) as SignatureBytes;

test('mobile partial signer calls MWA and retains only the payer signature', async () => {
  let invoked = false;
  const signer = createMobilePartialSigner(payer, async transactions => {
    invoked = true;
    return transactions.map(tx => ({ ...tx, signatures: { [payer]: signature } }));
  });
  const results = await signer.signTransactions([transaction as never]);
  assert.equal(invoked, true);
  assert.deepEqual(results, [{ [payer]: signature }]);
});

test('mobile partial signer rejects a wallet response without a payer signature', async () => {
  const signer = createMobilePartialSigner(payer, async transactions => transactions);
  await assert.rejects(signer.signTransactions([transaction as never]), /did not sign/);
});

test('mobile partial signer rejects a wallet changing the reviewed message', async () => {
  const signer = createMobilePartialSigner(payer, async transactions => transactions.map(tx => ({
    ...tx, messageBytes: new Uint8Array([1, 2, 4]) as never, signatures: { [payer]: signature },
  })));
  await assert.rejects(signer.signTransactions([transaction as never]), /changed the approved/);
});

import {
  createPermissionRequest,
  DemoChannel,
  generateDelegatedSigner,
  randomSolanaAddress,
  signPermissionRequest,
  signVoucher,
  toDeepLink,
  verifyPermissionRequestProof,
  verifySignedVoucher,
} from '../../../packages/protocol/src/index.js';

const sessionSigner = generateDelegatedSigner();
const merchant = randomSolanaAddress();
const channelId = randomSolanaAddress();
const request = signPermissionRequest(createPermissionRequest({
  agentName: 'Codex',
  agentPublicKey: sessionSigner.address,
  merchantName: 'Metered Research API',
  payee: merchant,
  maxSpend: 0.5,
  purpose: 'Fetch paid market data for a research task',
  resource: 'https://demo.boundkey.app/research',
}), sessionSigner);

console.log('\nBoundKey — judge demo\n');
console.log('Thesis: the phone keeps the payer wallet. The agent gets only a delegated session key.');
console.log(`Session signer: ${sessionSigner.address}`);
console.log(`Permission proof: ${verifyPermissionRequestProof(request) ? 'VALID' : 'INVALID'}`);
console.log(`Max capability: ${request.asset.maxSpend} ${request.asset.symbol}`);
console.log(`Payee: ${request.merchant.payee}`);
console.log('\nMobile authorization deep link:');
console.log(toDeepLink(request));

const channel = new DemoChannel({
  deposit: request.asset.maxSpend,
  payee: merchant,
  authorizedSigner: sessionSigner.address,
});

console.log('\nAfter the payer opens the channel, the agent emits cumulative MPP vouchers:');
let cumulativeAtomic = 0n;
const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
for (const amount of [0.012, 0.008, 0.015, 0.021, 0.013]) {
  const result = channel.authorize({ amount, payee: merchant, signer: sessionSigner.address });
  if (!result.ok) throw new Error(`Unexpected block: ${result.reason}`);
  cumulativeAtomic += BigInt(Math.round(amount * 1_000_000));
  const signed = signVoucher({ channelId, cumulativeAmount: cumulativeAtomic, expiresAt }, sessionSigner);
  console.log(`  $${amount.toFixed(3)} → cumulative ${cumulativeAtomic} atomic | 50-byte voucher | signature ${verifySignedVoucher(signed) ? '✓' : '✕'}`);
}

console.log('\nAttack 1 — prompt injection requests $5.00:');
const attack = channel.authorize({ amount: 5, payee: merchant, signer: sessionSigner.address, memo: 'malicious payment request' });
console.log(`  ${attack.ok ? 'ALLOWED' : 'BLOCKED'} (${attack.reason})`);

console.log('\nAttack 2 — compromised agent tries another merchant:');
const redirect = channel.authorize({ amount: 0.01, payee: randomSolanaAddress(), signer: sessionSigner.address });
console.log(`  ${redirect.ok ? 'ALLOWED' : 'BLOCKED'} (${redirect.reason})`);

console.log('\nFinal capability summary');
console.table(channel.summary());
console.log('The agent key can sign session vouchers; it never receives the payer wallet key.\n');

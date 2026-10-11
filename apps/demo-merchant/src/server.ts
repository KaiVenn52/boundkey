import express from 'express';
import { randomBytes } from 'node:crypto';
import { base58 } from '@scure/base';
import { createKeyPairSignerFromBytes, generateKeyPairSigner } from '@solana/kit';
import { createPayKit, session, usd } from '@solana/pay-kit';

const privateKey = process.env.SOLANA_PRIVATE_KEY;
const recipient = process.env.SOLANA_RECIPIENT ?? process.argv[2];
const network = process.env.SOLANA_NETWORK === 'mainnet' ? 'mainnet' : 'devnet';
const rpcUrl = process.env.SOLANA_RPC_URL ?? (network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com');
const port = Number(process.env.PORT ?? 4021);
const challengeBindingSecret = process.env.PAY_KIT_MPP_SECRET ?? randomBytes(32).toString('hex');

if (!recipient) {
  throw new Error('Pass the recipient address as the first argument or set SOLANA_RECIPIENT');
}

// A throwaway in-memory operator is safer for the devnet demo than exporting a
// mobile-wallet private key. Production deployments must provide a persistent,
// server-managed SOLANA_PRIVATE_KEY.
const signer = privateKey
  ? await createKeyPairSignerFromBytes(base58.decode(privateKey))
  : await generateKeyPairSigner();
const pay = await createPayKit({
  mpp: { challengeBindingSecret },
  network,
  operator: { recipient, signer },
  pricing: {
    // The phone authorizes at most $0.05; this demo charges $0.001 per streamed chunk.
    research: session(usd('0.05'), { unitPrice: usd('0.001') }),
  },
  rpcUrl,
});

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'BoundKey MPP Demo Merchant' }));
app.get('/research', pay.express('research'), async (_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const chunks = [
    'market snapshot loaded',
    'historical candles loaded',
    'news context loaded',
    'risk summary generated',
    'research complete',
  ];
  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 450));
  }
  res.end();
});

const routes = pay.sessionRoutes('research');
app.post('/research', routes.voucher);
app.post('/__402/session/deliveries', routes.deliveries);
app.post('/__402/session/commit', routes.commit);
app.get('/sessions/receipt/:channelId', routes.receipt);

app.listen(port, () => {
  console.log(`BoundKey MPP demo merchant: http://127.0.0.1:${port}/research`);
  console.log(`MPP operator: ${signer.address}${privateKey ? '' : ' (ephemeral devnet signer)'}`);
  if (!process.env.PAY_KIT_MPP_SECRET) console.log('MPP challenge binding: ephemeral devnet secret');
});

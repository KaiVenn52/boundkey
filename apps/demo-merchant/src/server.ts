import express from 'express';
import { base58 } from '@scure/base';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { createPayKit, session, usd } from '@solana/pay-kit';

const privateKey = process.env.SOLANA_PRIVATE_KEY;
const recipient = process.env.SOLANA_RECIPIENT;
const network = process.env.SOLANA_NETWORK === 'mainnet' ? 'mainnet' : 'devnet';
const rpcUrl = process.env.SOLANA_RPC_URL ?? (network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com');
const port = Number(process.env.PORT ?? 4021);

if (!privateKey || !recipient) {
  throw new Error('Set SOLANA_PRIVATE_KEY (base58 keypair bytes) and SOLANA_RECIPIENT');
}

const signer = await createKeyPairSignerFromBytes(base58.decode(privateKey));
const pay = await createPayKit({
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
});

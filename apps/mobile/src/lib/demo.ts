import type { PermissionRequest } from './request';

export function makeDemoRequest(): PermissionRequest {
  const now = new Date();
  return {
    version: 2,
    id: 'demo-codex-research',
    nonce: 'demo-local-only',
    protocol: { rail: 'mpp', intent: 'session', voucherSigner: 'client' },
    agent: { name: 'Codex', publicKey: '8xWg1sQtr1F2KJqLpirtT31REphBXobM7yCm2D4Mgchs' },
    merchant: {
      name: 'Metered Research API',
      payee: 'B1HuAXmzdLuTvMUeguWY8yBE1ezTMcpBT88wAh4Q6sX5',
      resource: 'https://demo.boundkey.app/research',
    },
    asset: { symbol: 'USDC', decimals: 6, maxSpend: 0.5, maxSpendAtomic: '500000' },
    purpose: 'Fetch paid market data for a research task',
    network: 'solana-mainnet',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
  };
}

export const demoUsage = [
  { label: 'Market snapshot', amount: 0.012 },
  { label: 'Historical candles', amount: 0.008 },
  { label: 'Company profile', amount: 0.015 },
  { label: 'News sentiment', amount: 0.021 },
  { label: 'Final refresh', amount: 0.013 },
];

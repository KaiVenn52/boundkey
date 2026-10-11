import { createSessionFetch } from '@solana/mpp/client';
import { execFileSync } from 'node:child_process';
import { createBoundKeyMobileOpener } from './mobile-mpp-opener.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run mpp:session -- https://your-mpp-session-endpoint [http://local-bridge] [https://public-bridge]');
  process.exit(1);
}

const bridgeBaseUrl = process.argv[3] ?? process.env.BOUNDKEY_BRIDGE_URL ?? 'http://127.0.0.1:8787';
const publicBridgeBaseUrl = process.argv[4] ?? process.env.BOUNDKEY_PUBLIC_BRIDGE_URL ?? bridgeBaseUrl;
const client = createSessionFetch({
  opener: createBoundKeyMobileOpener({
    bridgeBaseUrl,
    publicBridgeBaseUrl,
    agentName: process.env.BOUNDKEY_AGENT_NAME ?? 'Codex',
    onAuthorizationRequest: ({ deepLink }) => {
      console.log('\nAuthorization required. Open/scan this on the BoundKey Android app:\n');
      console.log(deepLink);
      // Optional USB handoff uses the same proof-bound URL as the QR scanner.
      if (process.env.BOUNDKEY_ADB_PATH) {
        execFileSync(process.env.BOUNDKEY_ADB_PATH, [
          'shell', 'am', 'start', '-a', 'android.intent.action.VIEW',
          '-d', deepLink, 'com.kaivenn.boundkey',
        ], { stdio: 'inherit' });
      }
      console.log('\nWaiting for mobile wallet approval…\n');
    },
  }),
  onEvent(event) {
    if (event.type === 'challenge') console.log('MPP session challenge received');
    if (event.type === 'open') console.log(`Channel opened: ${event.open.session.channelId}`);
    if (event.type === 'watermark') console.log(`Usage watermark: ${event.cumulativeAmount}`);
    if (event.type === 'commit') console.log('Voucher committed');
  },
});

const response = await client.fetch(target);
if (!response.ok) throw new Error(`MPP request failed (${response.status})`);

if (!response.body) {
  console.log(await response.text());
} else {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value, { stream: true }));
  }
}
await client.flush();

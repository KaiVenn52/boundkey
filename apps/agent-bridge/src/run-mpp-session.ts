import { createSessionFetch } from '@solana/mpp/client';
import { createBoundKeyMobileOpener } from './mobile-mpp-opener.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run mpp:session -- https://your-mpp-session-endpoint');
  process.exit(1);
}

const bridgeBaseUrl = process.env.BOUNDKEY_BRIDGE_URL ?? 'http://127.0.0.1:8787';
const client = createSessionFetch({
  opener: createBoundKeyMobileOpener({
    bridgeBaseUrl,
    agentName: process.env.BOUNDKEY_AGENT_NAME ?? 'Codex',
    onAuthorizationRequest: ({ deepLink }) => {
      console.log('\nAuthorization required. Open/scan this on the BoundKey Android app:\n');
      console.log(deepLink);
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

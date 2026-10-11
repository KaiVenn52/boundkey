# Live MPP demo runbook

The final competition video should contain one **real** Payment Channel open + metered MPP session. Use the offline mode only as stage insurance.

## Prerequisites

- Android phone or Seeker with an MWA-compatible Solana wallet.
- Node 22+.
- Two disposable devnet accounts for payer and demo-merchant operator; keep mainnet disabled until devnet evidence passes.
- USDC in the payer wallet and SOL for transaction/rent fees as required by the chosen MPP flow.
- A public HTTPS tunnel/domain for both the bridge and demo merchant so the phone can reach them.

Use tiny amounts. The included merchant caps the session at $0.05.

## 1. Install

```bash
npm install
```

## 2. Start the BoundKey bridge

```bash
npm run bridge
```

Expose port `8787` over HTTPS and set, for example:

```bash
export BOUNDKEY_BRIDGE_URL=https://bridge.example.com
```

## 3. Start the MPP demo merchant

Set the recipient address. On devnet, if `SOLANA_PRIVATE_KEY` is omitted, the
demo merchant creates a throwaway operator signer in memory and never asks you
to export the mobile-wallet private key. It also creates an in-memory MPP
challenge-binding secret when `PAY_KIT_MPP_SECRET` is omitted:

```bash
export SOLANA_NETWORK='devnet'
export SOLANA_RPC_URL='https://api.devnet.solana.com'
npm --workspace @boundkey/demo-merchant start -- MERCHANT_SOLANA_ADDRESS
```

Production deployments must set a persistent, server-managed
`SOLANA_PRIVATE_KEY` and `PAY_KIT_MPP_SECRET`; never reuse or export the payer
wallet key.

Expose port `4021` over HTTPS.

## 4. Build/install Android

```bash
cd apps/mobile
npm run prebuild
npm run android
```

The competition APK must be built and tested separately from this source check.

## 5. Run the agent-side MPP session

```bash
cd apps/agent-bridge
npm run mpp:session -- \
  https://merchant.example.com/research \
  https://bridge.example.com
```

If the desktop cannot resolve the public tunnel hostname, keep desktop polling
local and pass the phone-facing tunnel as a third URL:

```bash
npm run mpp:session -- \
  http://127.0.0.1:4021/research \
  http://127.0.0.1:8787 \
  https://bridge.example.com
```

Expected behavior:

1. CLI receives an MPP `session` 402 and prints the BoundKey authorization link.
2. Scan the QR/deep link on Android.
3. The phone shows the service, payee, client session key and hard cap.
4. MWA prompts the payer wallet to sign the Payment Channel open.
5. Phone returns the partially signed open to the bridge.
6. The MPP client resumes and streams paid chunks.
7. Capture the channel id, transaction signature/receipt and final metering output.

## Evidence to save for submission

- Screen recording of the wallet approval.
- Explorer link / transaction signature for channel open or settlement.
- Channel id.
- MPP receipt endpoint response.
- CLI output showing the session signer is different from the payer address.
- One blocked offline attack demonstration immediately after the live flow.

## If the network fails during judging

Use `npm run demo` + the Android SAFE DEMO MODE. Say explicitly: “This is the deterministic invariant demo; here is the recorded live transaction evidence.” Never pretend the fallback is on-chain.

# BoundKey

> **Give the agent a key. Not your wallet.**

BoundKey is a Solana Mobile authorization layer for autonomous agents. Your payer wallet remains on the phone. A desktop or cloud agent gets a disposable Ed25519 session key that can authorize **only the MPP Payment Channel the user approved**.

The product is built around a simple separation:

```text
PHONE / SEEKER                         AGENT MACHINE
Your wallet                            Ephemeral session key
      │                                      │
      │ signs channel open                   │ signs 50-byte MPP vouchers
      ▼                                      ▼
┌────────────────────────────────────────────────────┐
│            Solana Payment Channel                  │
│ payer = phone wallet                               │
│ payee = one service                                │
│ deposit = hard maximum                             │
│ authorized_signer = agent session key              │
└────────────────────────────────────────────────────┘
```

A compromised agent still does **not** possess the user's payer key. Once a live channel is opened, Solana's Payment Channels program checks the channel id, authorized signer, voucher freshness, monotonic cumulative amount, and `cumulative_amount <= deposit`.

## Why this exists

The naive options are bad in opposite ways:

- Give an agent your wallet key → too much authority.
- Approve every tiny API payment → autonomy disappears.
- Prefund a fresh hot wallet for every task → wallet lifecycle, recovery and balance management become the product.

BoundKey turns the phone into the **root of financial authority** and the agent key into a narrow, disposable capability.

## The 15-second demo

1. Codex hits an MPP metered endpoint and receives a `402` session challenge.
2. BoundKey creates a fresh client-voucher session signer and shows a QR.
3. The Android app scans it and shows **agent / service / hard cap / payee / session key**.
4. The user's existing Solana wallet signs the official Payment Channel `open` through Mobile Wallet Adapter.
5. Codex continues the task with its session key and signs cumulative MPP vouchers.
6. A $5 prompt-injection attempt cannot become a valid settlement above a $0.50 deposit.

## What is real in this repository

| Layer | Status |
| --- | --- |
| Ed25519 delegated session keys | ✅ implemented + tested |
| BoundKey QR/deep-link request protocol | ✅ implemented + tested |
| Exact 50-byte Solana Payment Channel voucher encoding | ✅ implemented + tested |
| Voucher signing / verification | ✅ implemented + tested |
| Desktop authorization bridge | ✅ HTTP smoke-tested |
| Agent proof + challenge/display binding | ✅ implemented + adversarially tested |
| Mobile QR scan + approval UX | ✅ source complete |
| Mobile Wallet Adapter payer signing path | ✅ wired to Wallet UI |
| Official `@solana/mpp` channel-open builder | ✅ wired in mobile adapter |
| Official MPP `SessionOpener` handoff back to desktop | ✅ implemented |
| Deterministic offline judge demo / attack demo | ✅ implemented |
| Real chain transaction evidence | ⏳ run `docs/LIVE_DEMO.md` with funded wallets before final submission |
| Android debug APK | ⏳ GitHub Actions build configured; artifact must pass CI and device install |

We intentionally distinguish **code-complete integration** from **a transaction we can prove happened**. Do not claim a live payment until the final demo run produces the signature/receipt.

## Architecture

```text
MPP service
   │ 402 + session challenge
   ▼
Desktop Agent / BoundKey Bridge
   │ generates ephemeral client voucher signer
   │ emits boundkey:// authorization QR
   ▼
Android / Seeker
   │ user reviews cap + payee + agent key
   │ Mobile Wallet Adapter signs open transaction
   ▼
MPP operator broadcasts Payment Channel open
   │
   ├──────────── payer key stays on phone
   │
   ▼
Agent streams work
   │ session key signs cumulative vouchers
   ▼
MPP commits / on-chain settlement
```

The key implementation detail is in `apps/agent-bridge/src/mobile-mpp-opener.ts`: it replaces the default same-process MPP opener with a cross-device opener. The payer signer lives in MWA; the session signer remains in the agent process.

## Repository

```text
apps/
  mobile/          Expo Android/Seeker approval app
  agent-bridge/    desktop bridge + real MPP SessionOpener
  demo-merchant/   self-hosted MPP metered service for final end-to-end demo
packages/
  protocol/        BoundKey request + Ed25519 + canonical voucher helpers/tests
demo-web/          zero-dependency judge rehearsal demo
docs/              architecture, security, live demo, test plan
submission/        pitch, submission copy, demo script, Q&A, readiness
```

## Fast local verification

Run the complete protocol, mobile security and bridge security test suite:

```bash
npm test
npm run demo
bash scripts/verify.sh
```

The tests cover:

- Solana-compatible Ed25519/Base58 session keys.
- QR/deep-link round-trip.
- Proof-of-possession for the request.
- Exact 50-byte voucher wire layout.
- Voucher signature validation and tamper failure.
- Hard-cap model.
- Payee and signer binding model.
- Displayed request ↔ MPP challenge binding and proof-gated bridge approval.

## Android app

```bash
npm install
cd apps/mobile
npm run prebuild
npm run android
```

The app uses Expo + Solana Kit + `@wallet-ui/react-native-kit` and calls the official `@solana/mpp/client` `buildOpenPaymentChannelTransaction()` for live MPP challenges.

A request without a real MPP challenge automatically stays in **SAFE DEMO MODE** and never sends a transaction. This gives the demo a deterministic fallback without pretending a simulated payment is on-chain.

## Real MPP flow

Start the authorization bridge:

```bash
npm run bridge
```

Run an MPP session-aware agent client against a metered endpoint:

```bash
cd apps/agent-bridge
npm run mpp:session -- https://YOUR_MPP_SERVICE/research
```

The CLI prints a `boundkey://authorize?...` request and waits for the phone. The Android app signs the open transaction with MWA, returns it to the bridge, and the canonical `createSessionFetch()` flow resumes with the delegated session signer.

For a self-hosted service, see `apps/demo-merchant` and `docs/LIVE_DEMO.md`.

## What BoundKey is **not**

**Not an AI risk model.** It does not ask another LLM whether a payment looks suspicious. The core boundary is key separation + channel constraints.

**Not another agent wallet.** The agent does not receive an asset-holding wallet that must be funded and managed.

**Not standard x402 `upto`.** x402 `upto` also uses Solana Payment Channels, but its current SVM flow uses a receiver authorizer for settlement. BoundKey's delegated-agent-key story targets **MPP `session` with `voucherSigner=client`**, where the client session signer is explicitly supported.

## Security claim

The precise claim is:

> **BoundKey removes the payer wallet key from the agent runtime and scopes the agent's financial authority to the Payment Channel the user approved.**

It does not claim the agent is trustworthy, the merchant is honest, or the phone cannot be compromised. See `docs/SECURITY.md`.

## Why this is a Solana Mobile product

Mobile is not a dashboard bolted onto an agent backend. It is the trusted approval surface:

- QR/camera pairs an untrusted desktop/cloud agent with the phone.
- Mobile Wallet Adapter keeps wallet signing inside the user's existing wallet.
- The phone shows the financial capability in human terms before the payer signs.
- Activity/history makes the phone a financial remote for autonomous software.

## Competition proof

For CLOCK IN, the product is designed around the judging surface:

- **Stickiness / PMF:** every agent that needs paid tools creates an approval/monitoring loop on the phone.
- **UX:** scan → review → authorize; no seed phrase, no new funded agent wallet.
- **Innovation:** payer/session-signer separation across devices using the new MPP session + Payment Channels stack.
- **Presentation:** the demo shows normal paid work and then a visible $5 / wrong-payee attack failure.

See `submission/WIN_STRATEGY.md` for the exact judge-facing plan.

## Official protocol references

- Solana Payment Channels: https://github.com/solana-foundation/payment-channels
- Solana Pay Kit / MPP: https://github.com/solana-foundation/pay-kit
- Solana Mobile Wallet Adapter templates: https://github.com/solana-foundation/templates

## License

MIT. Hackathon prototype; not audited for production custody of real funds.

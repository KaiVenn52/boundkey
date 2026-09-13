# Project name

**BoundKey**

# One-liner

**Give the agent a key. Not your wallet.** BoundKey turns a Solana Mobile wallet approval into a payee-bound, capped MPP session capability for a desktop or cloud AI agent.

# Description

AI agents increasingly need to buy metered data, inference and APIs, but today's choices are awkward: put a wallet key in the agent runtime, prefund throwaway wallets, or interrupt every micro-payment with a human approval.

BoundKey separates the financial roles across devices. The user's existing payer wallet stays on Android/Seeker and signs only through Mobile Wallet Adapter. The agent creates a disposable Ed25519 session key. When an MPP service returns a session challenge, the user scans the BoundKey QR and reviews the agent, payee and hard USDC ceiling. The phone builds the official Solana Payment Channel open transaction with the user's wallet as payer and the agent key as the client voucher signer.

After that single approval, the agent can continue metered work by signing cumulative MPP vouchers while never receiving the user's payer private key. The Payment Channel program enforces the channel's signer and deposit constraints.

The demo shows normal paid work, then a prompt-injection attempt that asks for $5 and a destination-change attempt. Both exceed the capability the user approved.

# Solana Mobile integration

- Android/Expo application.
- Mobile Wallet Adapter for payer authorization.
- QR/camera as the cross-device agent-to-phone handoff.
- Solana Payment Channels for bounded session escrow.
- Solana MPP `session` / client-voucher flow for metered agent work.

# Why mobile

The phone is the trusted human approval surface, not a companion dashboard. It keeps wallet signing outside the agent runtime while letting the agent remain autonomous after a single scoped approval.

# Repository evidence

- `apps/mobile`: mobile approval UX and real MPP open builder.
- `apps/agent-bridge`: bridge plus cross-device MPP `SessionOpener`.
- `packages/protocol`: Ed25519 request proof + canonical 50-byte voucher implementation/tests.
- `apps/demo-merchant`: self-hosted MPP metered service for live proof.

# BoundKey architecture

## Design goal

Remove the payer wallet key from the agent runtime without turning every metered API call back into a human approval.

BoundKey deliberately uses the **MPP Solana session client-voucher mode**. The MPP SDK already supports a payer signer plus a separate `sessionSigner`; BoundKey moves those two signers onto different devices.

## Trust domains

### 1. Mobile trust domain

Contains the payer wallet authorization exposed through Mobile Wallet Adapter. It reviews the request and signs the Payment Channel `open` transaction. BoundKey does not read/export the wallet private key.

### 2. Agent trust domain

Contains a disposable Ed25519 session key. It is generated per session and signs canonical cumulative vouchers. Compromise of this key is serious, but it is intentionally narrower than compromise of the payer wallet.

### 3. Solana enforcement domain

The channel PDA binds payer, payee, mint, authorized signer, salt and open slot. The program checks signed voucher bytes and enforces the deposit ceiling.

## Live sequence

```text
Agent             Bridge              Phone/MWA              MPP Service             Solana
  | GET resource    |                     |                       |                     |
  |-------------------------------------------------------------->|                     |
  |<-------------------------- 402 session challenge -------------|                     |
  | generate session key       |                     |             |                     |
  | POST auth request -------->|                     |             |                     |
  |<--- boundkey deep link ----|                     |             |                     |
  |              QR / deeplink --------------------->|             |                     |
  |                                  user reviews    |             |                     |
  |                                  wallet signs open ------------------------------->|
  |                              signed open -> bridge|             |                     |
  |<---------- approval/open --|                     |             |                     |
  | retry with MPP open credential -------------------------------->| --- broadcast --->|
  |<========================= streamed metered work =================|                     |
  | sign cumulative voucher ---------------------------------------->| --- settle ------->|
```

## Offline judge mode

`packages/protocol` and `npm run demo` reproduce the invariants deterministically without claiming to be a chain execution. This exists so a stage demo remains usable if RPC, wallet or network access fails.

## Why MPP session, not x402 upto

Both protocols can use Solana Payment Channels, but the current x402 SVM `upto` scheme commits a receiver authorizer as `authorized_signer`. BoundKey specifically needs a client-controlled delegated signer. MPP `session` exposes `voucherSigner=client` and its official client creates a distinct session signer for exactly that role.

## Key source files

- `apps/mobile/src/lib/paymentChannel.ts` — MWA payer signs official MPP open transaction.
- `apps/agent-bridge/src/mobile-mpp-opener.ts` — cross-device replacement for the default MPP session opener.
- `packages/protocol/src/index.js` — request encoding, Base58 Ed25519 helpers, exact voucher bytes.
- `apps/demo-merchant/src/server.ts` — metered MPP service for final evidence run.

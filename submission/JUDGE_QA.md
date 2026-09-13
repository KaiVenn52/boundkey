# Judge Q&A

## “Why not just give the agent a wallet with $1?”

That is a valid workaround for one toy agent. It creates a new asset account that must be funded, swept, recovered and tracked. BoundKey delegates session authority directly from the user's existing wallet without placing a general-purpose payer key in the agent runtime. The primitive is a capability, not another wallet balance.

## “Is a spending session actually new?”

No, and we do not claim it is. Managed agent-payment platforms already use sessions. Our product move is **self-custodial cross-device signer separation on Solana Mobile**: payer key on phone, client voucher key on the agent machine, joined by a Payment Channel.

## “Does x402 already do this?”

Not in the same signer model. Current Solana x402 `upto` uses Payment Channels but commits a receiver authorizer for settlement. BoundKey's delegated-agent-key path uses MPP `session` with `voucherSigner=client`, where the client session signer is an explicit protocol role.

## “What if the session key is stolen?”

The attacker can abuse the still-active authorized session up to its remaining channel authority. That is the residual risk. They do not automatically get the payer wallet key or a generic transfer wallet.

## “What stops the agent from signing $5?”

A signature alone does not override the channel deposit. The Payment Channels program rejects a voucher whose cumulative amount exceeds the channel deposit.

## “What if it pays someone else?”

The channel is opened for a specific payee. The session key signs channel-bound voucher bytes; it is not given an arbitrary SPL transfer key.

## “Why does this need a phone?”

Because the whole security boundary is that the payer wallet is outside the agent machine. Solana Mobile gives us camera/QR pairing plus Mobile Wallet Adapter, so the user's existing wallet can be the trusted approval surface without exporting a key.

## “What is actually implemented?”

The request/deep-link protocol, real Ed25519 session keys, exact Payment Channel voucher bytes/signatures, bridge, QR mobile UX, MWA payer signing adapter, official MPP channel-open builder and a cross-device MPP SessionOpener are in the repo. The final submission must additionally include recorded live transaction/receipt evidence and the built APK.

## “Is this production ready?”

No. It is a hackathon prototype. Mobile-side proof verification and challenge/display binding are implemented, but authenticated device pairing, returned-transaction instruction decoding, production RPC/relay hardening and an audit are still required before real custody use.

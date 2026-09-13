# BoundKey security model

BoundKey is a hackathon prototype, not an audited wallet product. The project is designed around **bounded delegation**, not the claim that an AI agent can never misbehave.

## Security objective

If the desktop/cloud agent is compromised after a user authorizes a session, the attacker should not automatically gain the user's general-purpose payer wallet key.

## On-chain properties we rely on

For a correctly opened Solana Payment Channel:

- the channel has a fixed `payer` and `payee`;
- the channel commits to an `authorized_signer`;
- vouchers are Ed25519-signed over a canonical 50-byte payload;
- voucher `channel_id` must match the channel PDA;
- cumulative amount must strictly advance and cannot exceed `deposit`;
- an optional voucher expiry is checked for freshness;
- the channel PDA is incarnation-specific through `open_slot`.

These properties come from the Payment Channels program, not from the BoundKey UI.

## What BoundKey adds

BoundKey creates a cross-device split:

- **payer signer:** existing wallet on Android/Seeker via MWA;
- **session signer:** disposable key on the agent machine;
- **human-readable approval:** the phone displays agent, payee and cap before signing.

The agent session key is therefore not a replacement copy of the payer key.

## Threats

### Prompt injection makes the agent overspend

Impact is limited by the channel deposit for that channel. A valid voucher above the deposit is rejected by the program.

### Agent tries to redirect payment

The open channel is derived with a specific payee. A voucher does not grant the agent a generic transfer primitive.

### Agent session key is stolen

The attacker can attempt to sign valid vouchers for that active channel up to its remaining authorized ceiling. This is the core residual risk. They do not thereby obtain the payer wallet key.

### Merchant overmeters usage

BoundKey does not prove the merchant's metering is honest. The hard cap limits maximum financial exposure but does not solve service-quality disputes.

### Malicious authorization request

The phone is the human review surface. Before opening MWA, the Android client verifies the agent's Ed25519 proof-of-possession and fail-closes unless the rendered payee, network, USDC mint, decimals and cap agree with the embedded MPP challenge. Pull mode, client-voucher custody, the canonical Payment Channels program and a single recipient are also enforced. These checks are covered by adversarial tests.

### Bridge tampering

The bridge is transport/orchestration, not a custody service. External agent requests remain unusable until the agent proves possession of the advertised session key. Approval metadata is re-derived from the signed request and rejected when the channel id, payer, payee, mint, deposit, slot, salt or fixed grace period differs. A compromised bridge can still delay or suppress a request. Production should additionally authenticate device pairing and decode/verify the returned transaction instructions before broadcast.

### Phone compromise

Out of scope. If the user's wallet/OS approval surface is compromised, BoundKey cannot restore trust.

## Explicit non-claims

- We do not claim an agent can never steal money.
- We do not claim a session expires merely because a UI timer elapsed.
- We do not claim x402 `upto` uses the same client session signer model.
- We do not call the offline `DemoChannel` an on-chain execution.
- We do not claim a live devnet or mainnet transaction until transaction/receipt evidence exists.

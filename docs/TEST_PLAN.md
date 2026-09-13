# Test plan

## Automated now

Run `npm test`.

- Base58 Solana public-key round-trip.
- BoundKey deep-link request round-trip.
- Ed25519 possession proof and tamper rejection.
- Exact MPP voucher length/magic/fields.
- Voucher signature validation and tamper rejection.
- Deposit-cap invariant in deterministic model.
- Payee/signer-binding invariant in deterministic model.
- Mobile fail-closed challenge/display binding across payee, network, currency, decimals, cap, splits, program and voucher mode.
- Mobile verification of valid, missing and forged agent proof-of-possession.
- Bridge proof gate and rejection of malformed channel-open approvals.

## Bridge smoke

Run `bash scripts/verify.sh`.

- `/health` responds.
- authorization request is created.
- request has real Ed25519 Solana address.
- request proof verifies when bridge owns the demo session key.
- polling returns pending state.

## Android device matrix before submission (not yet evidenced)

Test at minimum:

- Seeker if available;
- one non-Seeker Android device with an MWA wallet;
- portrait screen around 360dp width;
- cold deep-link launch;
- warm deep-link launch;
- QR camera denied then allowed;
- wallet disconnected → connect → approve;
- user rejects wallet signature;
- expired request;
- malformed QR;
- bridge unreachable.

## Live-chain proof

Must pass once before filming:

- challenge network matches mobile wallet network;
- displayed payee == challenge recipient;
- displayed hard cap == open deposit;
- open channel `authorized_signer` == desktop session public key;
- payer address != session signer address;
- at least one metered delivery creates a cumulative voucher;
- voucher signer == channel authorized signer;
- cumulative amount never exceeds deposit;
- receipt or settlement transaction captured.

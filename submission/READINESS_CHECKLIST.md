# Competition readiness checklist

## Product / protocol — complete in source

- [x] Unique working brand: BoundKey.
- [x] Product thesis narrowed to cross-device financial delegation.
- [x] MPP `session` / `voucherSigner=client` chosen as the correct protocol path.
- [x] Real Solana-compatible Ed25519 delegated signer generation.
- [x] BoundKey authorization request + deep link.
- [x] Agent proof-of-possession verified by bridge and Android client.
- [x] Displayed request bound to the embedded MPP challenge with adversarial tests.
- [x] Canonical 50-byte MPP voucher encoding/signing tests.
- [x] Desktop bridge and HTTP smoke flow.
- [x] Cross-device custom MPP `SessionOpener`.
- [x] Android QR scan / request review / activity UX.
- [x] Mobile Wallet Adapter payer signing path.
- [x] Official `@solana/mpp` Payment Channel open builder wired.
- [x] Self-hosted MPP demo merchant source.
- [x] Offline deterministic attack fallback.
- [x] Security model / architecture / test plan.
- [x] Submission copy / judge Q&A / 90-second demo script.

## Physical evidence still required before clicking Submit

- [x] Clean dependency install and committed lockfile.
- [x] Android typecheck, Expo Doctor 19/19 and clean prebuild pass locally.
- [ ] Signed/installable APK produced.
- [ ] App tested on real Android/Seeker + MWA wallet.
- [ ] Bridge/merchant exposed via stable HTTPS endpoints.
- [ ] One live MPP session completed with tiny funds.
- [ ] Channel/open or settlement transaction captured in explorer.
- [ ] Receipt/channel id saved in `submission/EVIDENCE.md`.
- [ ] 90-second video recorded and captioned.
- [x] Pitch deck exported.
- [ ] Public GitHub repository created.
- [ ] Final repository link, APK, demo video and deck submitted.
- [ ] Winning app published to Solana dApp Store if required for prize claim.

## Never claim before evidence exists

- “Audited / production safe.”
- “The agent can never steal money.”
- “x402 upto uses our exact signer model.”
- “Live mainnet payment completed” without a transaction/receipt.

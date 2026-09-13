# 3-minute pitch

## 0:00–0:25 — Problem

“AI agents are starting to pay for APIs. But I would never paste my real wallet key into Codex. And if I approve every three-cent API call, it is not autonomous anymore.”

## 0:25–0:50 — Product

“BoundKey gives the agent a key — not your wallet. My wallet remains on my phone. Codex gets a disposable session key with a hard payment-channel ceiling and one payee.”

## 0:50–1:45 — Demo

Codex requests metered research → QR → Android review → MWA wallet approval → stream continues → show session key and payer are different → show paid vouchers.

Then trigger the $5 / wrong-payee attack demo.

“The model can hallucinate. The session key can even be stolen. It still is not my payer wallet.”

## 1:45–2:25 — Technical differentiation

“MPP already supports separate payer and client voucher signers. BoundKey makes that separation physical: payer authority on Solana Mobile, session authority on the agent machine. The official Payment Channel is the cryptographic boundary between them.”

Do not call this generic x402 `upto`; our core flow is MPP `session`, `voucherSigner=client`.

## 2:25–3:00 — Why it matters

“Today this is a research agent buying metered data. Tomorrow it is coding agents, travel agents and automation. Each agent should receive exactly the financial authority required for the task — not a wallet full of money.”

Close:

**“BoundKey. Give the agent a key. Not your wallet.”**

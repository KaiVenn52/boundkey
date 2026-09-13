# 90-second demo script

## 0–8s

Desktop: Codex tries to fetch a paid research stream and receives an MPP session challenge.

Voice: “I want my agent to buy data, but I do not want my wallet private key anywhere near the agent.”

## 8–22s

Desktop prints BoundKey QR. Phone scans it.

Phone shows:

- Codex
- Metered Research API
- max $0.50 USDC
- bound payee
- disposable session key

Voice: “BoundKey asks my phone for one narrow financial permission.”

## 22–35s

Tap authorize. Show real MWA wallet prompt and confirmation.

Voice: “My wallet stays on the phone. It signs the channel open. Codex only owns the session key.”

## 35–55s

Desktop stream resumes. Show metered chunks/voucher watermark increasing. Cut to phone active card/activity.

Voice: “Now the agent can work without interrupting me on every micro-payment.”

## 55–72s

Trigger deterministic attack view: prompt injection requests $5 and/or different payee. Show BLOCKED.

Voice: “Even if the agent is manipulated, its authority is the capability I approved — not my wallet.”

## 72–90s

Show architecture for three seconds: Phone Wallet → Payment Channel ← Agent Session Key. Then product lockup.

Close: **“BoundKey. Give the agent a key. Not your wallet.”**

## Recording rule

If the live chain/RPC fails while filming, use the previously recorded live transaction evidence plus SAFE DEMO MODE, and label the fallback correctly. Never present a simulator as a live settlement.

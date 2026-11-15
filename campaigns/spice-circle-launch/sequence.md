# Spice Circle Launch — Email Sequence

Type: **product launch**, 4 emails over 15 days. Copy lives in `emails/` and `personalized/`.
Rules: `brand/voice.md`, `.claude/rules/emails.md`, `studio.config.json`.

## Overview
| # | Subject | Purpose | Send | CTA | Condition |
|---|---|---|---|---|---|
| 01 | Get the pan warm, something new 🌶️ | Announce the club and the founding price | Wed 2 Dec | Join The Spice Circle → | All 3 groups |
| 02 | What's in December's box | Make it concrete: 3 blends, 3 recipes | Sat 5 Dec (+3d) | See the December box → | Not yet joined |
| 03 | My Tuesday rule for dinner | Emotional "why": founder story | Wed 9 Dec (+4d) | Start your Spice Circle → | Not yet joined |
| 04 | Founding price ends tomorrow | Calm reminder of the real 18 Dec deadline | Thu 17 Dec (+8d) | Join at $17/month → | Not yet joined |

**Arc:** invitation → what's inside → why it matters → calm, real deadline.

## Subject line alternatives (A/B)
| # | Option B | Option C |
|---|---|---|
| 01 | Three new spice blends, every month | Meet The Spice Circle 🍳 |
| 02 | Three blends we picked for December | A peek inside the jar lids |
| 03 | Why I started Clove & Copper | Thirty minutes, one new flavour |
| 04 | $17/month closes Friday | Founding price: last day tomorrow |

## Flow
```
[Lead in curious / home-cooks / gifters, consent = yes]
        |
   Email 01 (2 Dec) ── joined? ──Yes──> [EXIT: converted]
        | No
   Email 02 (5 Dec) ── joined? ──Yes──> [EXIT]
        | No
   Email 03 (9 Dec) ── joined? ──Yes──> [EXIT]
        | No
   Email 04 (17 Dec) ─────────────────> [EXIT: sequence complete; offer closes 18 Dec]
```

## Logic notes
- **Exit:** joined The Spice Circle (any plan). No further launch emails.
- **Suppress:** unsubscribed, `consent` not `yes`, or contacted support in the last 48 h.
- **No re-entry.** One-time launch.
- **Per group:** copy is personalized per group; timing is the same for all.
- **Lab:** practice sends go only to `delivered@resend.dev`, never to lead addresses.

## A/B tests (with the maths written down first)
1. **Email 01 subject:** A (emoji) vs B (no emoji), 50/50 on 20% of the list, winner by **click rate** (opens are
   unreliable because of Apple Mail Privacy Protection). Our list is small, so a test needs roughly
   **about 6,700 recipients per arm** to detect 4% → 5% click rate at α = 0.05, power 0.8. Below that, call it
   "directional" and don't pretend it's significant.
2. **Email 04 CTA:** "Join at $17/month →" vs "Lock in $17/month →". Same sample-size caveat.
3. **Send time:** 12pm vs 5pm (lunch-break browsing vs pre-dinner planning), judged on clicks across 02–03.

## Benchmarks
| Metric | Target |
|---|---|
| Open rate | 35%+ (directional only) |
| Click rate | 4%+ |
| Sign-ups | 150 by 18 Dec |
| Unsubscribes | < 0.5% per email |

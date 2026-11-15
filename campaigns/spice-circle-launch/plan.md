# Campaign Plan — The Spice Circle Launch

Voice: `brand/voice.md`. Machine-checkable rules: `studio.config.json`.
Drafted with the Anthropic marketing plugin (`/marketing:campaign-plan`), then edited by hand.

> **Practice lab.** Clove & Copper, The Spice Circle, every lead, every price and every date below are made up.
> Every send goes to the local Resend emulator (`localhost:4000`), never to a real person.

---

## 1. Campaign overview
- **Name:** *Get the Pan Warm*, the Spice Circle launch
- **Summary:** Invite the Clove & Copper list to join The Spice Circle, a monthly box of three small-batch spice
  blends, with a founding-member price for the first 17 days.
- **Product (made up):** The Spice Circle. $22/month: three small-batch blends (about 40 g each), a recipe card per
  blend, skip or cancel any time.
- **Founding offer:** $17/month for life for anyone who joins by **Friday 18 December 2026**. The deadline is real
  within the lab and every email states it the same way. No fake urgency.
- **Primary objective (SMART):** 150 Spice Circle sign-ups from the three lead groups between 2 and 18 December 2026.
- **Secondary objectives:**
  - Average click rate of 4% or more across the four emails
  - Unsubscribe rate under 0.5% per email

## 2. Target audience
**Core profile:** home cooks aged 25–50 stuck cooking the same five dinners. Cooking is a small daily pleasure,
and they'd like it to feel new again without extra shopping.

| Group slug | Who | Pain / motivation | Buying stage |
|---|---|---|---|
| `curious` | Newsletter sign-ups who have never bought | Want to cook something new but don't know where to start | Awareness → consideration |
| `home-cooks` | Bought single blends from us 2+ times | Keep reordering the same jar; want variety without research | Consideration → decision |
| `gifters` | Bought a gift set before | Need an easy, thoughtful present for the cook in their life | Decision (gift subscription) |

**Where they spend time:** inbox (lunchtime and early evening), Instagram and YouTube recipe content, food blogs.

## 3. Key messages
**Core message:** *Three new flavours every month, each with a recipe that works on a Tuesday night.*

| Supporting message | Proof point |
|---|---|
| New flavours, picked for you | Three small-batch blends plus a recipe card for each |
| Weeknight-friendly, not fancy | Every recipe card is a 30-minute dinner |
| No waste, no commitment | Skip a month or cancel from your account any time |
| Founding members pay less, for good | $17/month for life if you join by 18 December (normally $22) |

**Angle per group:**
- `curious`: "Never cooked with sumac? Perfect. Each blend comes with a recipe that tells you exactly what to do."
- `home-cooks`: "Keep your {{favorite_blend|usual blend}} on the shelf, and let us bring two new jars to sit next to it." (`{{favorite_blend}}` is often `unknown`, so it always carries a fallback after the `|`.)
- `gifters`: "A present that turns up every month, already wrapped."

## 4. Channel strategy
| Channel | Why | Format | Effort | Budget |
|---|---|---|---|---|
| **Email (primary)** | Owned, warm list; cheapest per conversion | 4-email launch sequence, personalized per group (12 versions) | Low–Medium | $0 (emulator) |
| Landing page | Every CTA needs somewhere to land | Box contents, price, FAQ, join button | Medium | out of scope for the lab |
| Instagram (organic) | Visual unboxing, recipe reels | 3 posts + stories during launch | Medium | nice-to-have, not built |

No paid spend in this lab. If budget appears later, start with retargeting site visitors who didn't open.

## 5. Content calendar
| Date (2026) | Piece | Channel | Notes | Status |
|---|---|---|---|---|
| Wk of 23 Nov | Voice, leads, email drafts | — | Studio build | ✅ |
| Wk of 23 Nov | Lint + LLM review + personalization (12 files) | — | `npm test` green | ✅ |
| Fri 27 Nov | Send-guard tests pass, emulator round-trip | — | **Must pass before any send** | ✅ |
| **Wed 2 Dec** | Email 01, *Get the pan warm* (announcement + founding offer) | Email | All 3 groups | ⏳ |
| Sat 5 Dec | Email 02, *What's in December's box* (the 3 blends) | Email | Not yet joined | ⏳ |
| Wed 9 Dec | Email 03, *Rafi's Tuesday rule* (founder story) | Email | Not yet joined | ⏳ |
| Thu 17 Dec | Email 04, *Founding price ends tomorrow* (real deadline, calm) | Email | Not yet joined | ⏳ |
| Fri 18 Dec | Founding offer closes | — | — | — |
| Wk of 21 Dec | Results write-up | — | `notes/` | ⏳ |

**Dependencies:** landing page live before Email 01; send-guard tests green before any practice send; Email 04
only to people who haven't joined.

## 6. Content pieces needed
| Asset | Description | Priority |
|---|---|---|
| `emails/01-get-the-pan-warm.md` | Announce the club and the founding price | Must |
| `emails/02-whats-in-the-box.md` | December's 3 blends and the recipe cards | Must |
| `emails/03-rafis-tuesday-rule.md` | Founder story: why a new flavour every week | Must |
| `emails/04-founding-price-ends.md` | Calm reminder of the 18 Dec deadline | Must |
| `personalized/<group>/NN-*.md` | 3 groups × 4 emails = 12 versions | Must |
| Landing page copy | Box, price, FAQ, join | Nice-to-have |

## 7. Success metrics
| KPI | Target | How tracked |
|---|---|---|
| **Sign-ups (primary)** | 150 by 18 Dec | UTM `utm_campaign=spice-circle-launch` |
| Open rate | ≥ 35% (treat as directional; Apple Mail Privacy Protection inflates opens) | ESP report |
| Click rate | ≥ 4% | CTA UTMs (`utm_content=email01-curious`, …) |
| Unsubscribe rate | < 0.5% per email | ESP report |
| Gift subscriptions | ≥ 25 (from `gifters`) | Order type = gift |

**In the lab:** "delivered" status on the emulator stands in for real metrics.

## 8. Budget
Media $0 (owned email only). Production: studio time. If budget appears, hold 10–15% for a retargeting test.

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Email reaches a real person by mistake | Send-guard hook (allowlist of MCP tools, recipient allowlist, blocks real ESP hosts from Bash/WebFetch) + `permissions.deny` in settings + emulator-only base URL |
| Copy drifts into health claims (spices attract them) | Deterministic linter in CI on every push + LLM review against `brand/voice.md` |
| One message doesn't fit every group | `personalize` skill writes a version per group |
| Too many emails → unsubscribes | 4 emails, 3–8 days apart; 02–04 only to non-joiners |
| Compliance gaps | Footer carries unsubscribe + postal address (CAN-SPAM); consent column enforced |

## 10. Next steps
1. Owner reviews the 4 base emails and the 12 personalized versions.
2. Decide the Email 01 subject test (see `sequence.md`).
3. Run a practice launch: `npm run send:launch` with the emulator running.

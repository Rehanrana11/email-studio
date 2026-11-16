# Provenance

This repository is my solution to the **FDE-102 Email Studio** lab. It did not start from an empty folder.

It started as a copy of [hafiznaveedchuhan-ctrl/my-email-studio](https://github.com/hafiznaveedchuhan-ctrl/my-email-studio) (commit `a18df62`, 9 Nov 2026), another solution to the same lab. I re-branded it from *Kettlebird Tea* to *Clove & Copper* and then added the parts listed under **Added here**.

- **47 files** began as his files (re-branded, edited or rewritten).
- **43 files** have no counterpart in his repository and were added here.

## Licence status

His repository has no licence file (checked 16 Nov 2026), so no licence to reuse it is granted. The files under **Started from his repository** are therefore **not** covered by this repository's MIT licence, and nothing here claims them as mine. The MIT licence in `LICENSE` covers only the files under **Added here**.

Permission from the author: **not yet obtained** (status as of 16 Nov 2026). This line will be updated with the date and the answer.

## How the scores were measured

`python3 scripts/provenance.py <clone of his repo at the commit above>` reproduces every number below. Score = `difflib.SequenceMatcher(...).ratio()` between his file and mine (0 = nothing in common, 1 = identical), after the renames listed in the script. A low score means heavy rewriting, not that the file was new: every file in the first table started as his.

## Started from his repository

| Similarity | File here | His file |
|---:|---|---|
| 0.86 | `studio-kit/hooks/hooks.json` | `studio-kit/hooks/hooks.json` |
| 0.82 | `campaigns/spice-circle-launch/emails/04-founding-price-ends.md` | `campaigns/steep-club-launch/emails/04-founding-price-ends.md` |
| 0.82 | `leads/CLAUDE.md` | `leads/CLAUDE.md` |
| 0.81 | `.mcp.json` | `.mcp.json` |
| 0.81 | `studio-kit/review/schema.json` | `review/schema.json` |
| 0.79 | `campaigns/spice-circle-launch/personalized/curious/04-founding-price-ends.md` | `campaigns/steep-club-launch/personalized/curious/04-founding-price-ends.md` |
| 0.78 | `.gitignore` | `.gitignore` |
| 0.78 | `campaigns/spice-circle-launch/personalized/gifters/04-founding-price-ends.md` | `campaigns/steep-club-launch/personalized/gifters/04-founding-price-ends.md` |
| 0.77 | `campaigns/spice-circle-launch/personalized/home-cooks/04-founding-price-ends.md` | `campaigns/steep-club-launch/personalized/regulars/04-founding-price-ends.md` |
| 0.76 | `campaigns/spice-circle-launch/sequence.md` | `campaigns/steep-club-launch/sequence.md` |
| 0.72 | `review/samples/bad-email.md` | `review/samples/bad-email.md` |
| 0.70 | `campaigns/spice-circle-launch/plan.md` | `campaigns/steep-club-launch/plan.md` |
| 0.69 | `brand/voice.md` | `brand/voice.md` |
| 0.68 | `campaigns/spice-circle-launch/emails/01-get-the-pan-warm.md` | `campaigns/steep-club-launch/emails/01-the-kettles-on.md` |
| 0.67 | `.claude/rules/emails.md` | `.claude/rules/emails.md` |
| 0.67 | `.claude/settings.json` | `.claude/settings.json` |
| 0.67 | `campaigns/spice-circle-launch/personalized/curious/03-rafis-tuesday-rule.md` | `campaigns/steep-club-launch/personalized/curious/03-minas-ritual.md` |
| 0.66 | `campaigns/spice-circle-launch/personalized/gifters/01-get-the-pan-warm.md` | `campaigns/steep-club-launch/personalized/gifters/01-the-kettles-on.md` |
| 0.66 | `campaigns/spice-circle-launch/personalized/home-cooks/01-get-the-pan-warm.md` | `campaigns/steep-club-launch/personalized/regulars/01-the-kettles-on.md` |
| 0.65 | `CLAUDE.md` | `CLAUDE.md` |
| 0.65 | `campaigns/spice-circle-launch/emails/03-rafis-tuesday-rule.md` | `campaigns/steep-club-launch/emails/03-minas-ritual.md` |
| 0.64 | `.claude-plugin/marketplace.json` | `.claude-plugin/marketplace.json` |
| 0.64 | `.claude/skills/personalize/SKILL.md` | `.claude/skills/personalize/SKILL.md` |
| 0.64 | `campaigns/spice-circle-launch/personalized/curious/01-get-the-pan-warm.md` | `campaigns/steep-club-launch/personalized/curious/01-the-kettles-on.md` |
| 0.64 | `studio-kit/.claude-plugin/plugin.json` | `studio-kit/.claude-plugin/plugin.json` |
| 0.62 | `campaigns/spice-circle-launch/personalized/gifters/03-rafis-tuesday-rule.md` | `campaigns/steep-club-launch/personalized/gifters/03-minas-ritual.md` |
| 0.60 | `campaigns/spice-circle-launch/emails/02-whats-in-the-box.md` | `campaigns/steep-club-launch/emails/02-whats-in-the-box.md` |
| 0.60 | `campaigns/spice-circle-launch/personalized/home-cooks/03-rafis-tuesday-rule.md` | `campaigns/steep-club-launch/personalized/regulars/03-minas-ritual.md` |
| 0.59 | `campaigns/spice-circle-launch/personalized/curious/02-whats-in-the-box.md` | `campaigns/steep-club-launch/personalized/curious/02-whats-in-the-box.md` |
| 0.58 | `campaigns/spice-circle-launch/personalized/gifters/02-whats-in-the-box.md` | `campaigns/steep-club-launch/personalized/gifters/02-whats-in-the-box.md` |
| 0.57 | `campaigns/spice-circle-launch/personalized/home-cooks/02-whats-in-the-box.md` | `campaigns/steep-club-launch/personalized/regulars/02-whats-in-the-box.md` |
| 0.57 | `studio-kit/skills/personalize/SKILL.md` | `studio-kit/skills/personalize/SKILL.md` |
| 0.47 | `studio-kit/README.md` | `studio-kit/README.md` |
| 0.43 | `.github/workflows/email-review.yml` | `.github/workflows/email-review.yml` |
| 0.42 | `studio-kit/agents/email-reviewer.md` | `studio-kit/agents/email-reviewer.md` |
| 0.38 | `scripts/gen-reviews.mjs` | `scripts/gen-reviews.mjs` |
| 0.33 | `notes/handoff.md` | `notes/handoff.md` |
| 0.33 | `scripts/send-launch.mjs` | `scripts/send-launch.mjs` |
| 0.32 | `leads/leads.csv` | `leads/leads.csv` |
| 0.31 | `README.md` | `README.md` |
| 0.29 | `notes/compact-experiment.md` | `notes/compact-experiment.md` |
| 0.26 | `notes/reviews-scratchpad.md` | `notes/reviews-scratchpad.md` |
| 0.16 | `studio-kit/hooks/send-guard.mjs` | `.claude/hooks/send-guard.mjs` |
| 0.16 | `studio-kit/scripts/review.mjs` | `studio-kit/scripts/review.mjs` |
| 0.14 | `notes/reviews.jsonl` | `notes/reviews.jsonl` |
| 0.11 | `docs/index.html` | `docs/index.html` |
| 0.09 | `notes/skills-i-chose.md` | `notes/skills-i-chose.md` |

## Added here

No counterpart in his repository. Built with Claude Code as part of this lab.

| File | What it is |
|---|---|
| `.claude/settings.local.example.json` | Template for the personal MY_EMAIL setting |
| `.github/workflows/ci.yml` | CI: tests on Ubuntu and Windows, plugin validation, practice send |
| `LAB_MAP.md` | Lab step → proof → deviation |
| `LICENSE` | MIT, scoped to the files in this table |
| `PROVENANCE.md` | This file |
| `evidence/practice-launch-2026-11-16.json` | Practice launch result (lab step 11) |
| `examples/client-two/.claude/rules/emails.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/.mcp.json` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/CLAUDE.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/README.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/brand/voice.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/campaigns/spring-bake/emails/01-hello.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/leads/CLAUDE.md` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/leads/leads.csv` | Client two, Rise & Crumb (lab step 14) |
| `examples/client-two/studio.config.json` | Client two, Rise & Crumb (lab step 14) |
| `package.json` | npm scripts |
| `review/golden/README.md` | How the golden set is built and used |
| `review/golden/cases/g01-implied-gut-health.md` | Golden-set case for judge calibration |
| `review/golden/cases/g02-implied-inflammation.md` | Golden-set case for judge calibration |
| `review/golden/cases/g03-soft-scarcity.md` | Golden-set case for judge calibration |
| `review/golden/cases/g04-guilt-pressure.md` | Golden-set case for judge calibration |
| `review/golden/cases/g05-second-cta.md` | Golden-set case for judge calibration |
| `review/golden/cases/g06-wrong-offer.md` | Golden-set case for judge calibration |
| `review/golden/cases/g07-clean-skip.md` | Golden-set case for judge calibration |
| `review/golden/cases/g08-clean-recipe.md` | Golden-set case for judge calibration |
| `review/golden/cases/g09-clean-sizzle.md` | Golden-set case for judge calibration |
| `review/golden/cases/g10-clean-gift.md` | Golden-set case for judge calibration |
| `review/golden/cases/g11-clean-origin.md` | Golden-set case for judge calibration |
| `review/golden/cases/g12-borderline-cosy.md` | Golden-set case for judge calibration |
| `review/golden/labels.jsonl` | Golden-set labels (seed, not yet human-relabelled) |
| `review/waivers.json` | Scoped, expiring review waivers |
| `scripts/analyze-reviews.mjs` | Builds the reviews scratchpad from the review data |
| `scripts/calibrate-judge.mjs` | Judge calibration: confusion matrix, precision/recall, kappa, Wilson CIs |
| `scripts/provenance.py` | Reproduces this file's scores |
| `studio-kit/LICENSE` | MIT, scoped to the studio-kit files in this table |
| `studio-kit/scripts/lint-emails.mjs` | Deterministic email linter driven by studio.config.json |
| `studio.config.json` | Machine-checkable brand rules |
| `tests/leads.test.mjs` | Test suite |
| `tests/lint.test.mjs` | Test suite |
| `tests/portability.test.mjs` | Client-two portability tests (lab step 14) |
| `tests/project.test.mjs` | Test suite |
| `tests/review.test.mjs` | Test suite |
| `tests/send-guard.test.mjs` | Test suite |

# Handoff: Spice Circle launch

For whoever picks this up in a fresh session (including future me).

## Where things stand
- Built: brand voice + `studio.config.json`, 24 fake leads, plan, sequence, 4 base emails, 12 personalized emails,
  send-guard hook, linter, LLM-judge review script, golden set + calibration harness, studio-kit plugin, CI.
- `npm test` → 139 passing as of 16 Nov 2026 (42 send-guard cases, linter on all 16 emails, 31 mutation tests, leads, review gate and re-review, client-two portability, wiring).
- `npm run lint` → 16/16 emails pass. The bad sample fails with 30 blocking findings.
- Practice launch: `npm run send:launch` delivered email 01 for all 3 groups to `delivered@resend.dev` on the
  emulator, 3/3 verified, 0 to non-test addresses.
- **Not yet done:** the LLM judge has not been calibrated against human labels (seed labels only).

## Open decisions
1. **Email 01 subject.** A: "Get the pan warm, something new 🌶️" (brand phrase, emoji). B: "Three new spice
   blends, every month" (plain benefit). Both pass the linter. Plan: A as default, B as the test, judged on
   clicks, called "directional" unless each arm reaches ~6,700 recipients (see `sequence.md`).
   If we split, use `utm_content=email01-<group>-a` / `-b` and add `a`/`b` handling to the linter first.
2. **Judge model.** Run `npm run calibrate -- --model sonnet` and `--model opus` once the golden set has
   50+ human labels; pick on recall for "fail" first, cost second.

## Next actions
1. Re-label the 12 seed golden cases myself; grow to 50+ from real error analysis.
2. Run `npm run calibrate -- --repeats 3` and record the numbers in `review/golden/README.md` with the date and model.
3. Run the `/compact` experiment (`notes/compact-experiment.md`) and record real results.

## Session commands
```
claude -n spice-launch                         # named session
claude --resume spice-launch                   # pick it back up
claude --fork-session --resume spice-launch    # branch off to try something risky
claude -n judge-calibration "Read notes/handoff.md, then do next action 1."
```

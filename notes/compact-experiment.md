# Experiment: what survives `/compact`?

**Question:** after a long session is compacted, which facts survive exactly: ones held only in the chat, or
ones written to files?

**Status:** protocol written, **not yet run**. Fill in the results yourself after you run it. Don't paste
someone else's results here.

## Protocol
1. Start a named session: `claude -n compact-test`.
2. Put three "canary" facts **only in the chat**, e.g. "The A/B winner threshold is 4.7% CTR", "Lead L013 asked
   for no Friday emails", "Waiver id voice-corporate-02 was approved by me on 2026-11-20".
3. Put three different canary facts **in a file**: append them to `notes/handoff.md` and commit.
4. Do enough real work to make the session long (e.g. run `npm test`, review two emails, edit one).
5. Run `/compact`.
6. Ask Claude, word for word: "List every canary fact you know, exactly as written."
7. Score each fact: exact / paraphrased / lost.

## Results
| Fact | Stored in | After /compact | Notes |
|---|---|---|---|
| 1 | chat | | |
| 2 | chat | | |
| 3 | chat | | |
| 4 | file | | |
| 5 | file | | |
| 6 | file | | |

## Expected (hypothesis, to confirm or reject)
Files on disk survive verbatim because compaction doesn't touch them. Chat-only facts survive as a summary, so
exact numbers, ids and dates are at risk. If that holds, the rule is: anything you'd be upset to lose goes in a
committed file, not in the conversation.

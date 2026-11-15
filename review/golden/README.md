# Golden set: calibrating the LLM judge

The LLM reviewer (`studio-kit/scripts/review.mjs`) is a model, so you have to measure it before trusting it in CI.
This folder holds hand-labelled emails and a harness that measures how often the judge agrees with a human.

## What's here
- `cases/*.md`: emails, each changed in one way the **linter cannot see** (implied health claims, soft scarcity,
  guilt pressure, a second CTA in prose, invented offer facts), plus clean controls.
- `labels.jsonl`: one line per case: `{"case", "label": "pass"|"fail", "why", "labeled_by"}`.

## ⚠️ The 12 seed labels are a starting point, not ground truth
They were drafted with Claude (`labeled_by: "seed-draft"`). Calibrating a judge against labels written by
another model doesn't tell you much. Before you quote any number from this harness:
1. Re-label every seed case yourself, without looking at the judge's output first. Set `labeled_by` to your name.
2. Grow the set to **at least 50 cases**, roughly half fail and half pass. Pull the fail cases from real mistakes
   (the error analysis comes first: read 20–30 drafts, write down what actually goes wrong, then build cases for those).
3. Keep a held-out split (e.g. 20%) that you never look at while tuning the prompt.

## Run it
```bash
# needs the Claude CLI logged in (or ANTHROPIC_API_KEY set)
npm run calibrate                     # runs the judge on every case
npm run calibrate -- --repeats 3      # 3 runs per case, to measure run-to-run flakiness
npm run calibrate -- --model sonnet   # compare judge models
```

Output: a confusion matrix, accuracy, precision and recall for "fail", Cohen's kappa, and 95% Wilson confidence
intervals, plus the cases where the judge and the label disagree. Results are written to `review/out/` (gitignored).

## How to read it
- **Recall on "fail"** matters most: a missed health claim ships. Precision matters second: false alarms make
  people ignore the gate.
- With 12 cases a 95% CI on accuracy is roughly ±25 points, so the seed set can't prove anything. That's why you need 50+.
- If a disagreement turns out to be a bad label, fix the label and write down why in `why`.

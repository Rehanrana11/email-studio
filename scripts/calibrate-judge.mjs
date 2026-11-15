#!/usr/bin/env node
// calibrate-judge: measure LLM-judge agreement with human labels on review/golden/.
//
//   node scripts/calibrate-judge.mjs [--repeats N] [--model M] [--cache-dir review/out/raw]
//
// For each case it runs `claude -p` through review.mjs's prompt and schema (judge only, no linter, because
// the golden cases target what the linter can't see), then compares the judge verdict with the label.
// With --cache-dir it reuses saved raw outputs, so re-scoring after a label fix costs nothing.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { buildPrompt, extractReview } from "../studio-kit/scripts/review.mjs";

export function wilson(successes, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function score(pairs) {
  // pairs: [{label: "pass"|"fail", predicted: "pass"|"fail"}], positive class = "fail"
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const { label, predicted } of pairs) {
    if (label === "fail" && predicted === "fail") tp++;
    else if (label === "pass" && predicted === "fail") fp++;
    else if (label === "pass" && predicted === "pass") tn++;
    else fn++;
  }
  const n = tp + fp + tn + fn;
  const accuracy = n ? (tp + tn) / n : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const pe = n ? ((tp + fp) * (tp + fn) + (tn + fn) * (tn + fp)) / (n * n) : 0;
  const kappa = pe === 1 ? 1 : (accuracy - pe) / (1 - pe);
  return {
    n, tp, fp, tn, fn, accuracy, precision, recall, kappa,
    accuracyCI: wilson(tp + tn, n),
    precisionCI: wilson(tp, tp + fp),
    recallCI: wilson(tp, tp + fn),
  };
}

function runJudge(prompt, model) {
  const schema = readFileSync(resolve("studio-kit/review/schema.json"), "utf8");
  const args = ["-p", "--output-format", "json", "--json-schema", schema, "--tools", "", "--strict-mcp-config", "--no-session-persistence"];
  if (model) args.push("--model", model);
  return execFileSync("claude", args, { input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 180_000 });
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, d) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : d;
  };
  const repeats = Number(opt("--repeats", "1"));
  const model = opt("--model", process.env.REVIEW_MODEL);
  const cacheDir = opt("--cache-dir", "review/out/raw");
  mkdirSync(cacheDir, { recursive: true });

  const voice = readFileSync("brand/voice.md", "utf8");
  const labels = readFileSync("review/golden/labels.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const caseFiles = new Set(readdirSync("review/golden/cases"));
  const missing = labels.filter((l) => !caseFiles.has(l.case));
  if (missing.length) throw new Error(`labels reference missing cases: ${missing.map((m) => m.case).join(", ")}`);

  const pairs = [];
  const disagreements = [];
  const flaky = [];
  let errors = 0;
  for (const { case: c, label } of labels) {
    const emailText = readFileSync(join("review/golden/cases", c), "utf8");
    const prompt = buildPrompt({ voice, emailText, file: `review/golden/cases/${c}`, lintFindings: [] });
    const verdicts = [];
    for (let r = 0; r < repeats; r++) {
      const cache = join(cacheDir, `${c}.${model || "default"}.${r}.json`);
      try {
        const raw = existsSync(cache) ? readFileSync(cache, "utf8") : runJudge(prompt, model);
        writeFileSync(cache, raw);
        const review = extractReview(raw);
        const predicted = review.findings.some((f) => f.severity === "high") ? "fail" : "pass";
        verdicts.push(predicted);
        pairs.push({ case: c, label, predicted });
        if (predicted !== label) disagreements.push({ case: c, label, predicted, run: r, findings: review.findings.map((f) => `${f.severity}:${f.id}`) });
      } catch (e) {
        errors++;
        console.error(`  ERROR ${c} run ${r}: ${e.message.split("\n")[0]}`);
      }
    }
    if (new Set(verdicts).size > 1) flaky.push({ case: c, verdicts });
    process.stdout.write(".");
  }
  console.log("\n");

  const s = score(pairs);
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const ci = ([a, b]) => `[${pct(a)}, ${pct(b)}]`;
  const seed = labels.filter((l) => l.labeled_by === "seed-draft").length;
  console.log(`Judge calibration: ${labels.length} cases x ${repeats} run(s) = ${s.n} judgements, ${errors} error(s)`);
  if (seed) console.log(`WARNING: ${seed} label(s) are still seed drafts, not human labels. Treat these numbers as a smoke test.`);
  console.log(`\n              predicted fail   predicted pass`);
  console.log(`label fail    ${String(s.tp).padStart(14)}   ${String(s.fn).padStart(14)}`);
  console.log(`label pass    ${String(s.fp).padStart(14)}   ${String(s.tn).padStart(14)}\n`);
  console.log(`accuracy   ${pct(s.accuracy)}  95% CI ${ci(s.accuracyCI)}`);
  console.log(`precision  ${pct(s.precision)}  95% CI ${ci(s.precisionCI)}   (of judge FAILs, how many were real)`);
  console.log(`recall     ${pct(s.recall)}  95% CI ${ci(s.recallCI)}   (of real FAILs, how many the judge caught)`);
  console.log(`kappa      ${s.kappa.toFixed(2)}   (agreement beyond chance; > 0.6 is substantial)`);
  if (flaky.length) console.log(`\nflaky across repeats: ${flaky.map((f) => `${f.case} ${f.verdicts.join("/")}`).join(", ")}`);
  if (disagreements.length) {
    console.log("\ndisagreements:");
    for (const d of disagreements) console.log(`  ${d.case} (run ${d.run}): label ${d.label}, judge ${d.predicted}  ${d.findings.join(" ")}`);
  }
  mkdirSync("review/out", { recursive: true });
  writeFileSync("review/out/calibration.json", JSON.stringify({ model: model || "default", repeats, ...s, flaky, disagreements, errors }, null, 2));
  console.log("\nwrote review/out/calibration.json");
  process.exit(errors ? 2 : 0);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("calibrate-judge.mjs")) main();

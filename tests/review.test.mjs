import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { extractReview, applyWaivers, decide, sha256, buildPrompt } from "../studio-kit/scripts/review.mjs";
import { score, wilson } from "../scripts/calibrate-judge.mjs";

const finding = (over = {}) => ({ id: "voice-corporate", severity: "medium", category: "voice", rule: "r", location: "body", before: "Dear valued customer", after: "Hi", ...over });

test("extractReview reads structured_output from the CLI envelope", () => {
  const raw = JSON.stringify({ type: "result", is_error: false, result: "done", structured_output: { overall: "pass", findings: [] } });
  assert.deepEqual(extractReview(raw), { overall: "pass", findings: [] });
});

test("extractReview falls back to a JSON string in result", () => {
  const raw = JSON.stringify({ result: JSON.stringify({ overall: "fail", findings: [finding({ severity: "high" })] }) });
  assert.equal(extractReview(raw).overall, "fail");
});

test("extractReview throws on CLI errors and on schema mismatch (an error is never a pass)", () => {
  assert.throws(() => extractReview(JSON.stringify({ is_error: true, result: "rate limited" })));
  assert.throws(() => extractReview(JSON.stringify({ structured_output: { overall: "maybe", findings: [] } })));
  assert.throws(() => extractReview(JSON.stringify({ structured_output: { overall: "pass", findings: [{ id: "x" }] } })));
  assert.throws(() => extractReview("not json"));
});

test("waiver applies only to the same file, id and unchanged text", () => {
  const f = finding();
  const w = { file: "a.md", id: f.id, before_sha256: sha256(f.before), reason: "approved by owner" };
  assert.equal(applyWaivers([f], [w], { file: "a.md" }).kept.length, 0);
  assert.equal(applyWaivers([f], [w], { file: "b.md" }).kept.length, 1, "other file");
  assert.equal(applyWaivers([finding({ before: "Dear valued customers" })], [w], { file: "a.md" }).kept.length, 1, "text changed");
});

test("expired waivers stop applying", () => {
  const f = finding();
  const w = { file: "a.md", id: f.id, before_sha256: sha256(f.before), expires: "2026-01-01" };
  assert.equal(applyWaivers([f], [w], { file: "a.md", today: "2026-11-15" }).kept.length, 1);
});

test("health-claim, fake-urgency and misleading-subject findings can never be waived", () => {
  for (const category of ["health-claim", "fake-urgency", "misleading-subject"]) {
    const f = finding({ id: `${category}-x`, category, severity: "high" });
    const w = { file: "a.md", id: f.id, before_sha256: sha256(f.before) };
    assert.equal(applyWaivers([f], [w], { file: "a.md" }).kept.length, 1, category);
  }
});

test("decide: fails on blocking lint or high judge finding, passes on low-only", () => {
  assert.equal(decide([], [finding({ severity: "low" })]).pass, true);
  assert.equal(decide([{ severity: "medium" }], []).pass, false);
  assert.equal(decide([], [finding({ severity: "high" })]).pass, false);
});

test("prompt includes voice, email and linter results", () => {
  const p = buildPrompt({ voice: "VOICE", emailText: "EMAIL", file: "x.md", lintFindings: [{ severity: "high", id: "cta-count", message: "m" }] });
  assert.match(p, /VOICE/);
  assert.match(p, /EMAIL/);
  assert.match(p, /cta-count/);
});

test("review CLI with a saved model output: high finding exits 1, clean exits 0, garbage exits 2", () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  const email = "campaigns/spice-circle-launch/emails/01-get-the-pan-warm.md";
  const run = (obj) => {
    const p = join(dir, `${Math.random()}.json`);
    writeFileSync(p, typeof obj === "string" ? obj : JSON.stringify(obj));
    return spawnSync(process.execPath, ["studio-kit/scripts/review.mjs", email, "--raw", p], { encoding: "utf8" }).status;
  };
  assert.equal(run({ structured_output: { overall: "pass", findings: [] } }), 0);
  assert.equal(run({ structured_output: { overall: "fail", findings: [finding({ severity: "high", category: "health-claim", id: "health-claim-gut" })] } }), 1);
  assert.equal(run("garbage"), 2);
});

test("wilson interval matches known values", () => {
  const [lo, hi] = wilson(8, 10);
  assert.ok(Math.abs(lo - 0.4902) < 0.001 && Math.abs(hi - 0.9433) < 0.001, `${lo} ${hi}`);
});

test("score computes confusion matrix, precision, recall and kappa", () => {
  const pairs = [
    ...Array(8).fill({ label: "fail", predicted: "fail" }),
    ...Array(2).fill({ label: "fail", predicted: "pass" }),
    ...Array(9).fill({ label: "pass", predicted: "pass" }),
    ...Array(1).fill({ label: "pass", predicted: "fail" }),
  ];
  const s = score(pairs);
  assert.deepEqual([s.tp, s.fn, s.tn, s.fp], [8, 2, 9, 1]);
  assert.equal(s.accuracy, 17 / 20);
  assert.equal(s.recall, 0.8);
  assert.ok(Math.abs(s.precision - 8 / 9) < 1e-9);
  assert.ok(Math.abs(s.kappa - 0.7) < 1e-9, String(s.kappa));
});

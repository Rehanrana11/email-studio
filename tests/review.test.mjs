import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { extractReview, applyWaivers, decide, sha256, buildPrompt, compareWithPrevious } from "../studio-kit/scripts/review.mjs";
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

// --- Re-review (lab step 13, build 2): no repeats, and never an easier verdict -------------------------------

const BASE_EMAIL = "campaigns/spice-circle-launch/emails/01-get-the-pan-warm.md";
const LINE = "Same five dinners on repeat?";

test("prompt shows the last review's findings only on a re-review", () => {
  const args = { voice: "V", emailText: "E", file: "x.md", lintFindings: [] };
  assert.doesNotMatch(buildPrompt(args), /FINDINGS FROM THE LAST REVIEW/);
  const p = buildPrompt({ ...args, previousFindings: [finding({ id: "voice-hype" })] });
  assert.match(p, /FINDINGS FROM THE LAST REVIEW/);
  assert.match(p, /voice-hype/);
  assert.match(p, /Don't repeat ones that have been fixed/);
});

test("compareWithPrevious: new, still-open by id or by text, fixed only when the text is gone", () => {
  const email = `Hi. ${LINE} Dear valued customer.`;
  const prev = [
    finding({ id: "voice-corporate", before: "Dear valued customer" }),
    finding({ id: "clarity-old", before: "text that was removed" }),
    finding({ id: "voice-repeat", before: LINE }),
  ];
  const current = [
    finding({ id: "voice-corporate", before: "Dear valued customer" }), // same id
    finding({ id: "voice-renamed", before: LINE }), // same text, new id
    finding({ id: "health-claim-new", severity: "high", category: "health-claim", before: "Hi." }),
  ];
  const { judged, fixed } = compareWithPrevious(current, prev, email);
  const status = Object.fromEntries(judged.map((f) => [f.id, f.status]));
  assert.deepEqual(status, { "voice-corporate": "still-open", "voice-renamed": "still-open", "health-claim-new": "new" });
  assert.deepEqual(fixed.map((f) => f.id), ["clarity-old"]);
  assert.equal(judged.length, 3, "nothing reported twice");
});

test("compareWithPrevious carries forward a dropped finding whose text is still in the email", () => {
  const prev = [finding({ id: "fake-urgency-x", severity: "high", category: "fake-urgency", before: LINE })];
  const { judged, fixed } = compareWithPrevious([], prev, `Hi. ${LINE}`);
  assert.equal(fixed.length, 0);
  assert.equal(judged[0].carried_forward, true);
  assert.equal(decide([], judged).pass, false, "a judge that stops repeating itself cannot pass the email");
});

function reviewCli(target, raw, outDir) {
  const p = join(mkdtempSync(join(tmpdir(), "raw-")), "raw.json");
  writeFileSync(p, JSON.stringify(raw));
  return spawnSync(process.execPath, ["studio-kit/scripts/review.mjs", target, "--raw", p, "--out-dir", outDir], { encoding: "utf8" });
}

test("re-review CLI: a FAIL stays a FAIL until the offending text is fixed, then reports it as fixed", (t) => {
  mkdirSync(join("review", "out"), { recursive: true });
  const dir = mkdtempSync(join("review", "out", "rr-")); // review/out is gitignored
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const email = join(dir, "01-get-the-pan-warm.md");
  copyFileSync(BASE_EMAIL, email);
  const outDir = join(dir, "results");
  const high = { structured_output: { overall: "fail", findings: [finding({ id: "voice-repeat", severity: "high", before: LINE })] } };
  const clean = { structured_output: { overall: "pass", findings: [] } };

  assert.equal(reviewCli(dir, high, outDir).status, 1, "first review finds the problem");
  assert.equal(reviewCli(dir, clean, outDir).status, 1, "judge drops it, text unchanged: still FAIL");
  writeFileSync(email, readFileSync(email, "utf8").replace(LINE, "Cooking the same few dinners?"));
  const r = reviewCli(dir, clean, outDir);
  assert.equal(r.status, 0, "text fixed: PASS");
  assert.match(r.stdout, /\[FIXED\] voice-repeat/);
});

test("review CLI on a folder reviews every email and saves one result per file; an empty folder is an error", (t) => {
  mkdirSync(join("review", "out"), { recursive: true });
  const dir = mkdtempSync(join("review", "out", "folder-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const n of ["01-get-the-pan-warm.md", "02-whats-in-the-box.md"]) copyFileSync(join("campaigns/spice-circle-launch/emails", n), join(dir, n));
  const outDir = join(dir, "results");
  const r = reviewCli(dir, { structured_output: { overall: "pass", findings: [] } }, outDir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /2 file\(s\): 2 pass/);
  assert.ok(existsSync(outDir));
  const empty = mkdtempSync(join("review", "out", "empty-"));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  assert.equal(reviewCli(empty, { structured_output: { overall: "pass", findings: [] } }, outDir).status, 2);
});

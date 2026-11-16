#!/usr/bin/env node
// review: LLM-as-judge brand review for one email file, gated together with the deterministic linter.
//
//   node studio-kit/scripts/review.mjs <email.md | folder> [--voice brand/voice.md] [--config studio.config.json]
//        [--waivers review/waivers.json] [--model sonnet] [--json] [--dry-run] [--raw <saved-claude-output.json>]
//        [--out-dir review/out]
//
// A folder reviews every .md file under it (sorted). Exit code is the worst of the files.
//
// Re-review (--out-dir): each file's result is saved to <out-dir>/<path with / as __>.json. The next run on the
// same file reads it back, shows it to the judge ("report only new or still-unfixed problems"), and classifies
// every finding by its stable id: new, still-open or fixed. A finding counts as fixed only when its offending
// text is gone from the email. If the judge drops a finding whose text is still there, it is carried forward,
// so asking the judge not to repeat itself can never turn a FAIL into a PASS.
//
// Pipeline:
//   1. Run the deterministic linter (lint-emails.mjs). Objective rules live there, not in the prompt.
//   2. Ask `claude -p` for judgement findings (voice, clarity, tone, anything the linter can't see),
//      validated against review/schema.json via --json-schema.
//   3. Apply waivers. A waiver suppresses ONE finding id in ONE file, only while the offending text is
//      unchanged (sha256 of `before`), only until it expires, and never for health-claim / fake-urgency /
//      misleading-subject findings. (A global "resolved ids" list would let a real regression pass CI.)
//   4. Verdict: FAIL (exit 1) on any blocking lint finding or any remaining HIGH judge finding.
//
// Exit codes: 0 pass, 1 fail, 2 tool/usage error (the CLI failed, output didn't parse, etc.).
// An error is never reported as a pass.
//
// --dry-run prints the prompt and exits 0 without calling the model.
// --raw parses a saved `claude -p --output-format json` result instead of calling the model (used by tests).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lintEmail, loadConfig } from "./lint-emails.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(HERE, "..");
const UNWAIVABLE = new Set(["health-claim", "fake-urgency", "misleading-subject"]);

export const sha256 = (s) => createHash("sha256").update(String(s).trim()).digest("hex");

export function previousSection(previousFindings = []) {
  if (!previousFindings.length) return "";
  const list = previousFindings.map((f) => `- [${f.severity}] ${f.id}: "${f.before}"`).join("\n");
  return `
=== FINDINGS FROM THE LAST REVIEW ===
These are findings from the last review. Report only problems that are new or still not fixed, and reuse the
same id for a problem that is still there. Don't repeat ones that have been fixed.
${list}
`;
}

// Classify this run's findings against the last run's, by stable id (or identical offending text).
// A previous finding the judge did not report again counts as fixed only if its text is gone from the email;
// otherwise it is carried forward as still-open, so the verdict cannot get easier because of the re-review.
export function compareWithPrevious(current, previous, emailText) {
  const matched = new Set();
  const judged = current.map((f) => {
    const i = previous.findIndex((q, j) => !matched.has(j) && (q.id === f.id || sha256(q.before) === sha256(f.before)));
    if (i >= 0) matched.add(i);
    return { ...f, status: i >= 0 ? "still-open" : "new" };
  });
  const fixed = [];
  previous.forEach((p, j) => {
    if (matched.has(j)) return;
    const { status, carried_forward, ...rest } = p;
    if (p.before && emailText.includes(p.before)) judged.push({ ...rest, status: "still-open", carried_forward: true });
    else fixed.push(rest);
  });
  return { judged, fixed };
}

export function outPathFor(outDir, rel) {
  return resolve(outDir, `${rel.replace(/[\\/:]/g, "__")}.json`);
}

export function buildPrompt({ voice, emailText, file, lintFindings, previousFindings = [] }) {
  const lintSummary = lintFindings.length
    ? lintFindings.map((f) => `- [${f.severity}] ${f.id}: ${f.message}`).join("\n")
    : "- none";
  return `You are a strict but fair brand-voice reviewer for a small email marketing studio.
Review the EMAIL against the BRAND VOICE guide and report every problem you find.

Severity:
- high: health claim (explicit or implied, e.g. "good for your gut", "fights inflammation"), fake urgency or fake
  scarcity, a misleading subject, an offer fact that contradicts the guide, or more than one call to action.
- medium: off-voice wording (hype, corporate, pushy), a banned word, a confusing sentence, a weak or vague subject.
- low: minor style polish.

Rules for your answer:
- "before" must be copied verbatim from the email so it can be located. Never invent text that isn't there.
- Give each finding a stable kebab-case id, category first (health-claim-..., fake-urgency-..., voice-..., clarity-...).
- A deterministic linter already ran; its results are below. Do not repeat them. Focus on judgement calls the
  linter cannot make, and on implied claims or pressure that avoid the exact banned words.
- If the email is genuinely fine, return an empty findings list. Do not invent problems to look thorough.
- overall = "fail" if any finding is high, else "pass".

=== LINTER RESULTS ===
${lintSummary}

=== BRAND VOICE ===
${voice}
${previousSection(previousFindings)}
=== EMAIL (${file}) ===
${emailText}`;
}

export function extractReview(raw) {
  // `claude -p --output-format json --json-schema ...` returns an envelope whose `structured_output`
  // holds the schema-validated object. Fall back to `result` (a JSON string) for older CLI versions.
  const envelope = JSON.parse(raw);
  if (envelope.is_error) throw new Error(`claude reported an error: ${envelope.result || envelope.subtype}`);
  let review = envelope.structured_output ?? envelope.result ?? envelope;
  if (typeof review === "string") review = JSON.parse(review);
  if (!review || !Array.isArray(review.findings) || !["pass", "fail"].includes(review.overall)) {
    throw new Error("model output does not match review/schema.json");
  }
  for (const f of review.findings) {
    for (const k of ["id", "severity", "category", "before"]) {
      if (typeof f[k] !== "string") throw new Error(`finding is missing "${k}"`);
    }
  }
  return review;
}

export function applyWaivers(findings, waivers, { file, today = new Date().toISOString().slice(0, 10) }) {
  const kept = [];
  const waived = [];
  for (const f of findings) {
    const w = waivers.find(
      (w) =>
        w.file === file &&
        w.id === f.id &&
        w.before_sha256 === sha256(f.before) &&
        (!w.expires || w.expires >= today) &&
        !UNWAIVABLE.has(f.category)
    );
    (w ? waived : kept).push(w ? { ...f, waiver_reason: w.reason } : f);
  }
  return { kept, waived };
}

export function decide(lintFindings, judgeFindings) {
  const lintBlocking = lintFindings.filter((f) => f.severity !== "low");
  const judgeHigh = judgeFindings.filter((f) => f.severity === "high");
  return { pass: lintBlocking.length === 0 && judgeHigh.length === 0, lintBlocking, judgeHigh };
}

function runClaude(prompt, { model }) {
  const schema = readFileSync(resolve(PLUGIN_ROOT, "review", "schema.json"), "utf8");
  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", schema,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
  if (model) args.push("--model", model);
  // The prompt goes on stdin, not argv: Windows caps a command line at ~32k characters.
  return execFileSync("claude", args, {
    input: prompt,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180_000,
    // No shell: arguments (the schema JSON, the empty --tools value) must reach claude unmangled.
    // On Windows this needs the native claude.exe on PATH (the default installer provides it).
  });
}

function listMarkdown(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listMarkdown(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function reviewOne(file, ctx) {
  const { args, opt, config, projectRoot, voice, waivers } = ctx;
  const rel = relative(projectRoot, resolve(file)).split(sep).join("/");
  const emailText = readFileSync(resolve(file), "utf8");
  const lintFindings = lintEmail(emailText, { config, path: rel });

  const outDir = opt("--out-dir");
  const outPath = outDir ? outPathFor(outDir, rel) : null;
  let previous = [];
  if (outPath && existsSync(outPath)) {
    try {
      const last = JSON.parse(readFileSync(outPath, "utf8"));
      if (last.file === rel && Array.isArray(last.judge)) previous = last.judge;
      else console.error(`review: ignoring ${outPath}: it is for another file`);
    } catch {
      console.error(`review: ignoring unreadable ${outPath}`);
    }
  }

  const prompt = buildPrompt({ voice, emailText, file: rel, lintFindings, previousFindings: previous });
  if (args.includes("--dry-run")) {
    console.log(prompt);
    return 0;
  }

  let review;
  try {
    const raw = opt("--raw") ? readFileSync(opt("--raw"), "utf8") : runClaude(prompt, { model: opt("--model") || process.env.REVIEW_MODEL });
    review = extractReview(raw);
  } catch (e) {
    console.error(`review: could not get a valid review of ${rel} (${e.message.split("\n")[0]}). Treating as an error, not a pass.`);
    return 2;
  }

  const { kept, waived } = applyWaivers(review.findings, waivers, { file: rel });
  const { judged, fixed } = compareWithPrevious(kept, previous, emailText);
  const verdict = decide(lintFindings, judged);
  const result = {
    file: rel,
    email_sha256: sha256(emailText),
    reviewed_at: new Date().toISOString(),
    pass: verdict.pass,
    lint: lintFindings,
    judge: judged,
    fixed,
    waived,
  };
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nReview of ${rel}`);
    console.log(`  Linter: ${lintFindings.length} finding(s), ${verdict.lintBlocking.length} blocking`);
    for (const f of lintFindings) console.log(`    [${f.severity.toUpperCase()}] ${f.id}: ${f.message}`);
    const n = (st) => judged.filter((f) => f.status === st).length;
    const counts = previous.length ? ` (${n("new")} new, ${n("still-open")} still open, ${fixed.length} fixed)` : "";
    console.log(`  Judge:  ${judged.length} finding(s), ${verdict.judgeHigh.length} high${waived.length ? `, ${waived.length} waived` : ""}${counts}`);
    for (const f of judged) {
      const tag = previous.length ? ` (${f.status}${f.carried_forward ? ", text unchanged" : ""})` : "";
      console.log(`    [${f.severity.toUpperCase()}] ${f.id}${tag}: ${f.rule ?? ""}`);
      console.log(`       at:     ${f.location ?? ""}`);
      console.log(`       before: ${f.before}`);
      console.log(`       after:  ${f.after ?? ""}`);
    }
    for (const f of fixed) console.log(`    [FIXED] ${f.id}`);
    console.log(verdict.pass ? "\nPASS" : "\nFAIL");
  }
  return verdict.pass ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);
  const valueFlags = new Set(["--voice", "--config", "--waivers", "--model", "--raw", "--out-dir"]);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const target = args.find((a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1]));
  if (!target || !existsSync(target)) {
    console.error("usage: review.mjs <email.md | folder> [--voice <md>] [--config <json>] [--waivers <json>] [--model <m>] [--json] [--dry-run] [--raw <file>] [--out-dir <dir>]");
    process.exit(2);
  }

  const configPath = resolve(opt("--config") || "studio.config.json");
  const config = loadConfig(configPath);
  const projectRoot = dirname(configPath);
  const voicePath = resolve(opt("--voice") || "brand/voice.md");
  const voice = existsSync(voicePath) ? readFileSync(voicePath, "utf8") : "(no brand voice guide found; use general email best practice)";
  const waiversPath = opt("--waivers") || "review/waivers.json";
  const waivers = existsSync(waiversPath) ? JSON.parse(readFileSync(waiversPath, "utf8")).waivers || [] : [];

  const files = statSync(target).isDirectory() ? listMarkdown(target) : [target];
  if (!files.length) {
    console.error(`review: no .md files under ${target}. Nothing reviewed is not a pass.`);
    process.exit(2);
  }
  const ctx = { args, opt, config, projectRoot, voice, waivers };
  const codes = files.map((f) => reviewOne(f, ctx));
  const worst = codes.includes(2) ? 2 : codes.includes(1) ? 1 : 0;
  if (files.length > 1) {
    const c = (k) => codes.filter((x) => x === k).length;
    console.log(`\n${files.length} file(s): ${c(0)} pass, ${c(1)} fail, ${c(2)} error`);
  }
  process.exit(worst);
}

function isEntryPoint() {
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const argv1 = process.argv[1] ? realpathSync(process.argv[1]) : "";
    return process.platform === "win32" ? self.toLowerCase() === argv1.toLowerCase() : self === argv1;
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();

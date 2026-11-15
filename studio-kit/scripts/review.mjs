#!/usr/bin/env node
// review: LLM-as-judge brand review for one email file, gated together with the deterministic linter.
//
//   node studio-kit/scripts/review.mjs <email.md> [--voice brand/voice.md] [--config studio.config.json]
//        [--waivers review/waivers.json] [--model sonnet] [--json] [--dry-run] [--raw <saved-claude-output.json>]
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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lintEmail, loadConfig } from "./lint-emails.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(HERE, "..");
const UNWAIVABLE = new Set(["health-claim", "fake-urgency", "misleading-subject"]);

export const sha256 = (s) => createHash("sha256").update(String(s).trim()).digest("hex");

export function buildPrompt({ voice, emailText, file, lintFindings }) {
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

function main() {
  const args = process.argv.slice(2);
  const valueFlags = new Set(["--voice", "--config", "--waivers", "--model", "--raw"]);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const file = args.find((a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1]));
  if (!file) {
    console.error("usage: review.mjs <email.md> [--voice <md>] [--config <json>] [--waivers <json>] [--model <m>] [--json] [--dry-run] [--raw <file>]");
    process.exit(2);
  }

  const configPath = resolve(opt("--config") || "studio.config.json");
  const config = loadConfig(configPath);
  const projectRoot = dirname(configPath);
  const rel = relative(projectRoot, resolve(file)).split(sep).join("/");
  const voicePath = resolve(opt("--voice") || "brand/voice.md");
  const voice = existsSync(voicePath) ? readFileSync(voicePath, "utf8") : "(no brand voice guide found; use general email best practice)";
  const emailText = readFileSync(resolve(file), "utf8");
  const waiversPath = opt("--waivers") || "review/waivers.json";
  const waivers = existsSync(waiversPath) ? JSON.parse(readFileSync(waiversPath, "utf8")).waivers || [] : [];

  const lintFindings = lintEmail(emailText, { config, path: rel });
  const prompt = buildPrompt({ voice, emailText, file: rel, lintFindings });

  if (args.includes("--dry-run")) {
    console.log(prompt);
    process.exit(0);
  }

  let review;
  try {
    const raw = opt("--raw") ? readFileSync(opt("--raw"), "utf8") : runClaude(prompt, { model: opt("--model") || process.env.REVIEW_MODEL });
    review = extractReview(raw);
  } catch (e) {
    console.error(`review: could not get a valid review (${e.message.split("\n")[0]}). Treating as an error, not a pass.`);
    process.exit(2);
  }

  const { kept, waived } = applyWaivers(review.findings, waivers, { file: rel });
  const verdict = decide(lintFindings, kept);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ file: rel, pass: verdict.pass, lint: lintFindings, judge: kept, waived }, null, 2));
  } else {
    console.log(`\nReview of ${rel}`);
    console.log(`  Linter: ${lintFindings.length} finding(s), ${verdict.lintBlocking.length} blocking`);
    for (const f of lintFindings) console.log(`    [${f.severity.toUpperCase()}] ${f.id}: ${f.message}`);
    console.log(`  Judge:  ${kept.length} finding(s), ${verdict.judgeHigh.length} high${waived.length ? `, ${waived.length} waived` : ""}`);
    for (const f of kept) {
      console.log(`    [${f.severity.toUpperCase()}] ${f.id}: ${f.rule}`);
      console.log(`       at:     ${f.location}`);
      console.log(`       before: ${f.before}`);
      console.log(`       after:  ${f.after}`);
    }
    console.log(verdict.pass ? "\nPASS" : "\nFAIL");
  }
  process.exit(verdict.pass ? 0 : 1);
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

#!/usr/bin/env node
// lint-emails: deterministic, brand-agnostic checks for marketing email files.
//
//   node studio-kit/scripts/lint-emails.mjs [files...] [--config studio.config.json] [--json]
//
// With no files, lints every .md under <campaignDir>/emails and <campaignDir>/personalized.
// Brand facts (banned phrases, offer, sign-off, footer, link domain, audiences) come from the
// project's studio.config.json, so the same linter works for any client studio.
//
// Exit codes: 0 = no high/medium findings, 1 = at least one high or medium finding, 2 = usage/config error.
// Every rule here is objective. Judgement calls (tone, clarity, "would a friend say this?")
// belong to the LLM reviewer (review.mjs), not here.

import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const graphemes = (s) => [...segmenter.segment(String(s))].map((x) => x.segment);
const EMOJI = /\p{Extended_Pictographic}/u;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseEmail(text) {
  const normalized = String(text).replace(/\r\n/g, "\n");
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: normalized };
  const frontmatter = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$/);
    if (!kv) continue;
    let value = kv[2];
    const quoted = value.match(/^"(.*)"$/) || value.match(/^'(.*)'$/);
    if (quoted) value = quoted[1];
    frontmatter[kv[1]] = value;
  }
  return { frontmatter, body: m[2] };
}

function splitBody(body, config) {
  // Main message = everything before the sign-off. Footer = everything after the last '---' rule.
  const lines = body.split("\n");
  const signIdx = lines.findIndex((l) => l.trim() === config.signOff);
  const ruleIdx = lines.map((l) => l.trim()).lastIndexOf("---");
  const main = (signIdx >= 0 ? lines.slice(0, signIdx) : ruleIdx >= 0 ? lines.slice(0, ruleIdx) : lines).join("\n");
  const footer = ruleIdx >= 0 ? lines.slice(ruleIdx + 1).join("\n") : "";
  return { main, footer, hasSignOff: signIdx >= 0 };
}

function loadLeadPii(projectRoot) {
  const file = join(projectRoot, "leads", "leads.csv");
  if (!existsSync(file)) return [];
  const [header, ...rows] = readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
  const cols = header.split(",");
  const pick = ["email", "last_name", "city"].map((c) => cols.indexOf(c)).filter((i) => i >= 0);
  const values = new Set();
  for (const row of rows) {
    const cells = row.split(",");
    for (const i of pick) if (cells[i] && cells[i].length >= 3) values.add(cells[i]);
  }
  return [...values];
}

export function lintEmail(text, { config, path = "", leadPii = [] }) {
  const findings = [];
  const add = (severity, id, message) => findings.push({ severity, id, message, path });
  const { frontmatter: fm, body } = parseEmail(text);
  if (!fm) {
    add("high", "frontmatter-missing", "file has no YAML frontmatter block");
    return findings;
  }

  // --- frontmatter presence and file naming ---
  for (const key of ["id", "name", "send_date", "audience", "subject", "preview", "cta_text", "cta_url"]) {
    if (!fm[key]) add("high", `fm-missing-${key.replace(/_/g, "-")}`, `frontmatter is missing "${key}"`);
  }
  const file = basename(path, ".md");
  const fileMatch = file.match(/^(\d{2})-(.+)$/);
  if (fm.id && !/^\d{2}$/.test(fm.id)) add("medium", "fm-id-format", `id "${fm.id}" must be two digits`);
  if (fileMatch && fm.id && fm.id !== fileMatch[1]) add("medium", "fm-id-mismatch", `id "${fm.id}" does not match file prefix "${fileMatch[1]}"`);
  if (fileMatch && fm.name && fm.name !== fileMatch[2]) add("medium", "fm-name-mismatch", `name "${fm.name}" does not match file name "${fileMatch[2]}"`);

  // --- dates ---
  if (fm.send_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.send_date) || Number.isNaN(Date.parse(fm.send_date)))
      add("medium", "fm-send-date-format", `send_date "${fm.send_date}" is not an ISO date`);
    else if (config.offer?.deadlineIso && fm.send_date > config.offer.deadlineIso)
      add("high", "send-date-after-deadline", `send_date ${fm.send_date} is after the offer deadline ${config.offer.deadlineIso}`);
  }

  // --- audience ---
  const parts = path.split(/[\\/]/);
  const pIdx = parts.lastIndexOf("personalized");
  const folderGroup = pIdx >= 0 ? parts[pIdx + 1] : null;
  if (fm.audience && !config.audiences.includes(fm.audience)) add("high", "audience-unknown", `audience "${fm.audience}" is not one of ${config.audiences.join(", ")}`);
  if (folderGroup && fm.audience && fm.audience !== folderGroup) add("high", "audience-folder-mismatch", `audience "${fm.audience}" but file lives in personalized/${folderGroup}/`);
  if (!folderGroup && fm.audience && fm.audience !== "all") add("medium", "audience-base-not-all", `base email should have audience "all", found "${fm.audience}"`);

  // --- subject ---
  const subject = fm.subject || "";
  const subjG = graphemes(subject);
  if (subjG.length > config.subject.maxChars) add("medium", "subject-too-long", `subject is ${subjG.length} characters (max ${config.subject.maxChars})`);
  const emojiCount = subjG.filter((g) => EMOJI.test(g)).length;
  if (emojiCount > config.subject.maxEmoji) add("medium", "subject-too-many-emoji", `subject has ${emojiCount} emoji (max ${config.subject.maxEmoji})`);
  const capsWord = subject.match(/\b[A-Z]{3,}\b/);
  if (capsWord) add("high", "subject-all-caps", `subject contains an ALL CAPS word "${capsWord[0]}"`);
  const prefix = config.misleadingSubjectPrefixes.find((p) => subject.toLowerCase().trim().startsWith(p));
  if (prefix) add("high", "subject-misleading-prefix", `subject starts with misleading "${prefix}"`);

  // --- preview ---
  const preview = fm.preview || "";
  const pLen = graphemes(preview).length;
  if (pLen < config.preview.minChars || pLen > config.preview.maxChars)
    add("medium", "preview-length", `preview is ${pLen} characters (want ${config.preview.minChars}-${config.preview.maxChars})`);
  if (subject && preview.toLowerCase().includes(subject.toLowerCase())) add("low", "preview-repeats-subject", "preview repeats the subject");

  // --- CTA url and tracking ---
  if (fm.cta_url) {
    let url;
    try {
      url = new URL(fm.cta_url);
    } catch {
      add("high", "cta-url-invalid", `cta_url "${fm.cta_url}" is not a valid URL`);
    }
    if (url) {
      if (url.protocol !== "https:") add("medium", "cta-url-not-https", "cta_url must use https");
      if (url.hostname !== config.linkDomain) add("high", "cta-url-wrong-domain", `cta_url host "${url.hostname}" is not ${config.linkDomain}`);
      const q = url.searchParams;
      if (q.get("utm_source") !== "email") add("medium", "utm-source", "utm_source must be 'email'");
      if (q.get("utm_medium") !== "email") add("medium", "utm-medium", "utm_medium must be 'email'");
      if (q.get("utm_campaign") !== config.campaign) add("medium", "utm-campaign", `utm_campaign must be '${config.campaign}'`);
      const want = fm.id && fm.audience ? `email${fm.id}-${fm.audience}` : null;
      if (want && q.get("utm_content") !== want) add("high", "utm-content", `utm_content is '${q.get("utm_content")}', want '${want}'`);
    }
  }

  // --- body structure ---
  const { main, footer, hasSignOff } = splitBody(body, config);
  const ctaLines = body.split("\n").filter((l) => /^\s*\[[^\]]+\]\s*$/.test(l));
  if (ctaLines.length !== 1) add("high", "cta-count", `found ${ctaLines.length} CTA lines; need exactly 1`);
  else if (fm.cta_text && ctaLines[0].trim() !== `[${fm.cta_text}]`) add("medium", "cta-text-mismatch", `CTA line "${ctaLines[0].trim()}" does not match cta_text "${fm.cta_text}"`);
  const links = main.match(/\]\(|https?:\/\/|www\./gi) || [];
  if (links.length > 0) add("high", "extra-link-in-body", `body has ${links.length} link(s); the CTA is the only link`);
  if (!hasSignOff) add("medium", "sign-off-missing", `sign-off "${config.signOff}" not found`);
  for (const line of config.footer) {
    if (!footer.split("\n").some((l) => l.trim() === line)) add("high", "footer-missing", `footer line missing: "${line.slice(0, 60)}..."`);
  }
  const words = main.replace(/[#*_>\-[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
  if (words > config.body.maxWords) add("medium", "body-too-long", `main message is ${words} words (max ${config.body.maxWords})`);

  // --- whole-email text checks ---
  const all = `${subject}\n${preview}\n${body}`.replace(/[\u2018\u2019]/g, "'");
  const bangs = (all.match(/!/g) || []).length;
  if (bangs > config.body.maxExclamations) add("medium", "too-many-exclamations", `${bangs} "!" found (max ${config.body.maxExclamations})`);
  const severityFor = { "health-claim": "high", "fake-urgency": "high", hype: "medium" };
  for (const [category, phrases] of Object.entries(config.bannedPhrases)) {
    for (const phrase of phrases) {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRe(phrase)}(?=$|[^\\p{L}])`, "iu");
      if (re.test(all)) add(severityFor[category] || "medium", `${category}-${phrase.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, `banned ${category} phrase "${phrase}"`);
    }
  }

  // --- tokens ---
  for (const m of all.matchAll(/\{\{\s*([^}|]+?)\s*(?:\|([^}]*))?\}\}/g)) {
    const [, name, fallback] = m;
    if (!config.tokens.includes(name)) add("high", "token-unknown", `unknown token {{${name}}}`);
    if ((config.tokensRequiringFallback || []).includes(name) && !(fallback && fallback.trim()))
      add("high", "token-needs-fallback", `{{${name}}} must have a fallback, e.g. {{${name}|something sensible}}`);
  }

  // --- offer facts ---
  const allowedPrices = [config.offer.regularPrice, config.offer.foundingPrice].map((p) => p.replace("/month", ""));
  for (const m of all.matchAll(/\$\d+(?:\.\d{2})?/g)) {
    if (!allowedPrices.includes(m[0])) add("high", "offer-price-mismatch", `price ${m[0]} is not in the offer (${allowedPrices.join(", ")})`);
  }
  const deadlineDay = config.offer.deadline.match(/(\d{1,2})/)?.[1];
  const deadlineMonth = config.offer.deadline.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/)?.[1];
  if (deadlineDay && deadlineMonth) {
    for (const m of body.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${deadlineMonth}\\b`, "g"))) {
      if (m[1] !== deadlineDay) add("high", "offer-date-mismatch", `date "${m[0]}" does not match the deadline "${config.offer.deadline}"`);
    }
    const weekday = config.offer.deadline.split(" ")[0];
    for (const m of body.matchAll(new RegExp(`\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+${deadlineDay}\\s+${deadlineMonth}\\b`, "g"))) {
      if (m[1] !== weekday) add("high", "offer-weekday-mismatch", `"${m[0]}" has the wrong weekday; deadline is ${config.offer.deadline}`);
    }
  }

  // --- lead PII in copy ---
  for (const value of leadPii) {
    const re = new RegExp(`(^|[^\\p{L}])${escapeRe(value)}(?=$|[^\\p{L}])`, "iu");
    if (re.test(all)) add("high", "lead-pii-in-copy", `copy contains lead data "${value}"`);
  }

  return findings;
}

export function loadConfig(configPath) {
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  for (const key of ["campaign", "campaignDir", "linkDomain", "audiences", "tokens", "subject", "preview", "body", "signOff", "footer", "offer", "bannedPhrases", "misleadingSubjectPrefixes"]) {
    if (cfg[key] === undefined) throw new Error(`${configPath} is missing "${key}"`);
  }
  return cfg;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

export function defaultFiles(projectRoot, config) {
  const base = join(projectRoot, config.campaignDir);
  return [...walk(join(base, "emails")), ...walk(join(base, "personalized"))].sort();
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const configPath = resolve(opt("--config") || "studio.config.json");
  if (!existsSync(configPath)) {
    console.error(`lint-emails: config not found at ${configPath}`);
    process.exit(2);
  }
  let config;
  try {
    config = loadConfig(configPath);
  } catch (e) {
    console.error(`lint-emails: ${e.message}`);
    process.exit(2);
  }
  const projectRoot = dirname(configPath);
  const skip = new Set([opt("--config")].filter(Boolean));
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--config") && !skip.has(a));
  const files = positional.length ? positional.map((f) => resolve(f)) : defaultFiles(projectRoot, config);
  if (files.length === 0) {
    console.error("lint-emails: no email files found");
    process.exit(2);
  }
  const leadPii = loadLeadPii(projectRoot);
  const results = files.map((f) => {
    const rel = relative(projectRoot, f).split(sep).join("/");
    return { file: rel, findings: lintEmail(readFileSync(f, "utf8"), { config, path: rel, leadPii }) };
  });

  if (args.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const { file, findings } of results) {
      if (findings.length === 0) {
        console.log(`PASS  ${file}`);
        continue;
      }
      const worst = findings.some((f) => f.severity !== "low") ? "FAIL" : "WARN";
      console.log(`${worst}  ${file}`);
      for (const f of findings) console.log(`      [${f.severity.toUpperCase()}] ${f.id}: ${f.message}`);
    }
  }
  const blocking = results.flatMap((r) => r.findings).filter((f) => f.severity !== "low");
  const failedFiles = results.filter((r) => r.findings.some((f) => f.severity !== "low")).length;
  if (!args.includes("--json")) console.log(`\n${results.length} file(s), ${failedFiles} failing, ${blocking.length} blocking finding(s).`);
  process.exit(blocking.length ? 1 : 0);
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

#!/usr/bin/env node
// Practice launch: send email 01 for each lead group to a Resend TEST inbox on the LOCAL emulator.
//
//   npx emulate@0.13.1 start --service resend     # in another terminal
//   node scripts/send-launch.mjs [--email 01] [--dry-run]
//
// Safety, in layers:
//   - The base URL must be localhost / 127.0.0.1. Anything else and the script refuses to run.
//   - Every recipient goes through the same checkRecipients() the send-guard hook uses.
//   - Tokens are rendered with a sample lead per group (first name + favourite blend only), so you can see
//     exactly what a real lead would get, while the email itself still goes to the test inbox.
//   - After sending, it reads the emulator's inbox and fails unless every id landed and nothing went to a
//     non-test address.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkRecipients } from "../studio-kit/hooks/send-guard.mjs";
import { parseEmail } from "../studio-kit/scripts/lint-emails.mjs";

const config = JSON.parse(readFileSync("studio.config.json", "utf8"));
const BASE = process.env.RESEND_BASE_URL || "http://localhost:4000";
const KEY = "re_practice_local_only";
const TEST_TO = "delivered@resend.dev";
const FROM = "Rafi at Clove & Copper <rafi@cloveandcopper.example.com>";
const GROUPS = config.audiences.filter((a) => a !== "all");

const args = process.argv.slice(2);
const emailId = args.includes("--email") ? args[args.indexOf("--email") + 1] : "01";
const dryRun = args.includes("--dry-run");

export function assertLocal(base) {
  const host = new URL(base).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`refusing to send: RESEND_BASE_URL host is "${host}", only localhost is allowed`);
  }
}

export function loadLeads(path = "leads/leads.csv") {
  const [header, ...rows] = readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
  const cols = header.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v])));
}

export function renderTokens(text, values) {
  return text.replace(/\{\{\s*([^}|]+?)\s*(?:\|([^}]*))?\}\}/g, (_, name, fallback) => {
    const v = values[name];
    if (v && v !== "unknown") return v;
    if (fallback !== undefined) return fallback;
    throw new Error(`token {{${name}}} has no value and no fallback`);
  });
}

function emailFile(group) {
  const dir = join(config.campaignDir, "personalized", group);
  const file = readdirSync(dir).find((f) => f.startsWith(`${emailId}-`));
  if (!file) throw new Error(`no email ${emailId} for group ${group}`);
  return join(dir, file);
}

async function main() {
  assertLocal(BASE);
  const leads = loadLeads().filter((l) => l.consent === "yes");
  console.log(`${dryRun ? "[dry run] " : ""}Sending email ${emailId} to ${TEST_TO} via ${BASE}\n`);

  const sent = [];
  for (const group of GROUPS) {
    const sample = leads.find((l) => l.group === group);
    if (!sample) throw new Error(`no consenting lead in group ${group}`);
    const { frontmatter: fm, body } = parseEmail(readFileSync(emailFile(group), "utf8"));
    const values = {
      first_name: sample.first_name,
      favorite_blend: sample.favorite_blend,
      unsubscribe_url: `https://${config.linkDomain}/unsubscribe?lead=${sample.id}`,
    };
    const payload = {
      from: FROM,
      to: [TEST_TO],
      subject: `[${group}] ${fm.subject}`,
      text: renderTokens(body.trim(), values).replace(`[${fm.cta_text}]`, `${fm.cta_text} ${fm.cta_url}`),
      tags: [{ name: "campaign", value: config.campaign }, { name: "group", value: group }],
    };
    const guard = checkRecipients("send-launch", payload, process.env);
    if (guard.decision !== "allow") throw new Error(`send-guard refused: ${guard.reason}`);
    if (dryRun) {
      console.log(`--- ${group} (sample lead ${sample.id}) ---\n${payload.subject}\n\n${payload.text}\n`);
      continue;
    }
    const res = await fetch(`${BASE}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`send failed for ${group}: ${res.status} ${JSON.stringify(json)}`);
    console.log(`  ${group.padEnd(11)} -> id ${json.id}  "${payload.subject}"`);
    sent.push(json.id);
  }
  if (dryRun) return;

  const inbox = await (await fetch(`${BASE}/emails`, { headers: { Authorization: `Bearer ${KEY}` } })).json();
  const byId = new Map((inbox.data || []).map((e) => [e.id, e]));
  const landed = sent.filter((id) => byId.has(id));
  const stray = [...byId.values()].flatMap((e) => e.to || []).filter((to) => !to.toLowerCase().endsWith("@resend.dev"));
  console.log(`\nVerified ${landed.length}/${sent.length} on the emulator; ${stray.length} message(s) to non-test addresses.`);
  if (landed.length !== sent.length || stray.length) process.exit(1);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/send-launch.mjs")) {
  main().catch((e) => {
    console.error(`send-launch: ${e.message}`);
    if (/fetch failed|ECONNREFUSED/.test(String(e.cause?.code || e.message))) {
      console.error("Is the emulator running?  npx emulate@0.13.1 start --service resend");
    }
    process.exit(1);
  });
}

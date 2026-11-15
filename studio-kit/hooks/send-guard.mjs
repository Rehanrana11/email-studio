#!/usr/bin/env node
// send-guard: a PreToolUse hook that makes it structurally hard to email a real person.
//
// Claude Code pipes the pending tool call to stdin as JSON ({ tool_name, tool_input, ... }).
// Exit 0 = allow. Exit 2 = block (the reason on stderr goes back to Claude). Exit 1 does NOT block.
//
// What it checks, in order:
//   1. Unparseable or malformed events are blocked (fail closed).
//   2. Shell tools (Bash, PowerShell): block commands that reach a real email provider
//      (API hosts, SMTP hosts/ports, sendmail/swaks/mailx, smtplib, nodemailer).
//   3. Web tools (WebFetch and *fetch* MCP tools): block URLs on a real email provider host.
//   4. Email-provider MCP servers (resend, sendgrid, mailgun, ...): DEFAULT DENY.
//      Only read-only actions (get-/list-/search-) and single sends (send-email) are allowed,
//      and sends still go through the recipient check. Broadcasts, batch sends, contacts,
//      segments, API keys, domains, forwards and replies are all blocked.
//   5. Any other tool whose name looks like a send: broadcast-style names are blocked;
//      everything else goes through the recipient check.
//
// Recipient check: every address in to / cc / bcc / recipient(s) must be on an allowed domain
// (default: resend.dev) or equal MY_EMAIL. No recipients, or more than MAX_RECIPIENTS, is blocked.
//
// Config (env, set in the gitignored .claude/settings.local.json):
//   MY_EMAIL                     one real address you own that may receive practice mail
//   SEND_GUARD_ALLOWED_DOMAINS   comma-separated, default "resend.dev"
//   SEND_GUARD_MAX_RECIPIENTS    default 3

import process from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ESP_HOSTS = [
  /(^|\.)api\.resend\.com$/i,
  /(^|\.)smtp\.resend\.com$/i,
  /(^|\.)api\.sendgrid\.com$/i,
  /(^|\.)smtp\.sendgrid\.net$/i,
  /(^|\.)api(\.eu)?\.mailgun\.net$/i,
  /(^|\.)smtp\.mailgun\.org$/i,
  /(^|\.)api\.postmarkapp\.com$/i,
  /(^|\.)smtp(-broadcasts)?\.postmarkapp\.com$/i,
  /(^|\.)api\.(brevo|sendinblue)\.com$/i,
  /(^|\.)smtp-relay\.(brevo|sendinblue)\.com$/i,
  /(^|\.)mandrillapp\.com$/i,
  /(^|\.)api\.mailchimp\.com$/i,
  /(^|\.)api\.mailjet\.com$/i,
  /(^|\.)in-v3\.mailjet\.com$/i,
  /(^|\.)api(\.eu)?\.sparkpost\.com$/i,
  /(^|\.)api\.elasticemail\.com$/i,
  /(^|\.)api\.loops\.so$/i,
  /(^|\.)email(-smtp)?\.[a-z0-9-]+\.amazonaws\.com$/i,
  /(^|\.)smtp\.gmail\.com$/i,
  /(^|\.)gmail\.googleapis\.com$/i,
  /(^|\.)smtp\.office365\.com$/i,
  /(^|\.)smtp-mail\.outlook\.com$/i,
];

const SHELL_TOOLS = /^(bash|powershell|shell|terminal)$|device_bash$|run_command$/i;
const WEB_TOOLS = /^webfetch$|^mcp__.+__.*fetch/i;
const SEND_NAME = /send|mail|email|deliver|broadcast/i;
const BROADCAST_NAME = /broadcast|bulk|batch|mass|audience|segment|campaign|subscribers|everyone|newsletter/i;
const ESP_SERVER = /resend|sendgrid|mailgun|postmark|brevo|sendinblue|mailchimp|mandrill|mailjet|sparkpost|smtp|\bses\b|email|mail/i;
const READ_ONLY_ACTION = /^(get|list|search|retrieve)[-_]/i;
const SEND_ACTIONS = new Set(["send-email", "send_email", "sendemail"]);
const SHELL_MAIL_PATTERNS = [
  /\bsendmail\b/i,
  /\bswaks\b/i,
  /\bmailx?\s+-s\b/i,
  /\bsmtplib\b/i,
  /\bnodemailer\b/i,
  /\bsmtps?:\/\//i,
  /:(25|465|587|2525)\b(?!\d)/,
];
const RECIPIENT_KEY = /^(to|cc|bcc|recipient|recipients|to_address|to_addresses)$/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_HOST_RE = /\b(?:https?|smtps?):\/\/([^\s/:'"`]+)/gi;
const BARE_HOST_RE = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;

const allow = (reason = "ok") => ({ decision: "allow", reason });
const block = (reason) => ({ decision: "block", reason });

export function isEspHost(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  return ESP_HOSTS.some((re) => re.test(h));
}

function hostsIn(text) {
  const hosts = new Set();
  for (const m of String(text).matchAll(URL_HOST_RE)) hosts.add(m[1].toLowerCase());
  for (const m of String(text).matchAll(BARE_HOST_RE)) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

export function collectRecipients(input) {
  const out = [];
  const walk = (v, underRecipientKey) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (underRecipientKey) (v.match(EMAIL_RE) || []).forEach((e) => out.push(e.toLowerCase()));
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, underRecipientKey));
    } else if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) walk(val, underRecipientKey || RECIPIENT_KEY.test(k));
    }
  };
  walk(input, false);
  return [...new Set(out)];
}

function readConfig(env) {
  return {
    myEmail: String(env.MY_EMAIL || "").trim().toLowerCase(),
    domains: String(env.SEND_GUARD_ALLOWED_DOMAINS || "resend.dev")
      .split(",")
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
    max: Number.parseInt(env.SEND_GUARD_MAX_RECIPIENTS || "3", 10) || 3,
  };
}

export function checkRecipients(toolName, input, env) {
  const cfg = readConfig(env);
  const recipients = collectRecipients(input);
  if (recipients.length === 0) return block(`send tool "${toolName}" has no recognisable to/cc/bcc recipient`);
  if (recipients.length > cfg.max)
    return block(`send tool "${toolName}" has ${recipients.length} recipients; the limit is ${cfg.max}`);
  for (const addr of recipients) {
    const domain = addr.split("@").pop();
    const ok = cfg.domains.includes(domain) || (cfg.myEmail && addr === cfg.myEmail);
    if (!ok)
      return block(
        `recipient "${addr}" is not allowed. Only *@${cfg.domains.join(", *@")} and the owner's MY_EMAIL may receive practice mail.`
      );
  }
  return allow(`recipients allowed: ${recipients.join(", ")}`);
}

export function evaluate(event, env = process.env) {
  if (!event || typeof event !== "object") return block("malformed hook event");
  const toolName = String(event.tool_name ?? event.toolName ?? "");
  const input = event.tool_input ?? event.toolInput ?? {};
  if (!toolName) return block("hook event has no tool_name");

  // 2. Shell tools
  if (SHELL_TOOLS.test(toolName)) {
    const cmd = String(input.command ?? input.cmd ?? JSON.stringify(input));
    const espHost = hostsIn(cmd).find(isEspHost);
    if (espHost) return block(`shell command reaches real email provider host "${espHost}"; use the local emulator`);
    const pattern = SHELL_MAIL_PATTERNS.find((re) => re.test(cmd));
    if (pattern) return block(`shell command looks like a direct mail send (${pattern}); use the local emulator`);
    return allow("shell command does not reach an email provider");
  }

  // 3. Web tools
  if (WEB_TOOLS.test(toolName)) {
    const espHost = hostsIn(JSON.stringify(input)).find(isEspHost);
    if (espHost) return block(`web request to real email provider host "${espHost}"`);
    return allow("web request does not reach an email provider");
  }

  // 4. Email-provider MCP servers: default deny
  const mcp = toolName.match(/^mcp__(.+?)__(.+)$/);
  if (mcp && ESP_SERVER.test(mcp[1])) {
    const action = mcp[2].toLowerCase();
    if (READ_ONLY_ACTION.test(action) && !/send/.test(action)) return allow(`read-only action "${action}"`);
    if (SEND_ACTIONS.has(action)) return checkRecipients(toolName, input, env);
    return block(`"${action}" on email server "${mcp[1]}" is not on the allowlist (only get/list/search and send-email)`);
  }

  // 5. Any other send-looking tool
  if (SEND_NAME.test(toolName)) {
    if (BROADCAST_NAME.test(toolName)) return block(`broadcast-style tool "${toolName}" is never allowed in this studio`);
    return checkRecipients(toolName, input, env);
  }

  return allow("not a send-style tool");
}

async function readStdin() {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  const raw = await readStdin();
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.stderr.write("[send-guard] BLOCKED: could not parse the hook event (fail closed)\n");
    process.exit(2);
  }
  const result = evaluate(event);
  if (result.decision === "block") {
    process.stderr.write(`[send-guard] BLOCKED: ${result.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
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

if (isEntryPoint()) await main();

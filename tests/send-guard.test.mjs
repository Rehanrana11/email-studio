import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { evaluate, collectRecipients, isEspHost } from "../studio-kit/hooks/send-guard.mjs";

const ENV = { MY_EMAIL: "owner@my-own-domain.com" };
const ev = (tool_name, tool_input = {}) => ({ hook_event_name: "PreToolUse", tool_name, tool_input });
const SEND = "mcp__resend-practice__send-email";

// [name, event, expected decision]
const CASES = [
  // --- allowed ---
  ["test inbox via MCP send-email", ev(SEND, { from: "rafi@cloveandcopper.example.com", to: ["delivered@resend.dev"], subject: "x", text: "y" }), "allow"],
  ["owner's MY_EMAIL", ev(SEND, { to: "owner@my-own-domain.com" }), "allow"],
  ["MY_EMAIL is case-insensitive", ev(SEND, { to: "Owner@My-Own-Domain.com" }), "allow"],
  ["display-name format", ev(SEND, { to: ["Test <bounced@resend.dev>"] }), "allow"],
  ["cc and bcc on test domain", ev(SEND, { to: ["delivered@resend.dev"], cc: ["a@resend.dev"], bcc: ["b@resend.dev"] }), "allow"],
  ["from address is not treated as a recipient", ev(SEND, { from: "someone@gmail.com", to: ["delivered@resend.dev"] }), "allow"],
  ["read-only MCP list", ev("mcp__resend-practice__list-emails"), "allow"],
  ["read-only MCP get", ev("mcp__resend-practice__get-email", { id: "abc" }), "allow"],
  ["local emulator via curl", ev("Bash", { command: "curl -s -XPOST localhost:4000/emails -d '{\"to\":[\"delivered@resend.dev\"]}'" }), "allow"],
  ["ordinary shell command", ev("Bash", { command: "npm test" }), "allow"],
  ["file tools are not sends", ev("Write", { file_path: "campaigns/x/emails/01.md", content: "to: ava@example.com" }), "allow"],
  ["WebFetch to docs site", ev("WebFetch", { url: "https://resend.com/docs/api-reference/emails/send-email" }), "allow"],

  // --- blocked: recipients ---
  ["real lead address", ev(SEND, { to: ["noor.halvorsen@example.com"] }), "block"],
  ["one bad address among good ones", ev(SEND, { to: ["delivered@resend.dev", "someone@gmail.com"] }), "block"],
  ["bad address hidden in bcc", ev(SEND, { to: ["delivered@resend.dev"], bcc: ["boss@company.com"] }), "block"],
  ["look-alike domain", ev(SEND, { to: ["x@resend.dev.evil.com"] }), "block"],
  ["subdomain is not the allowed domain", ev(SEND, { to: ["x@mail.resend.dev"] }), "block"],
  ["no recipient at all", ev(SEND, { subject: "hi", text: "body" }), "block"],
  ["too many recipients", ev(SEND, { to: ["a@resend.dev", "b@resend.dev", "c@resend.dev", "d@resend.dev"] }), "block"],
  ["MY_EMAIL unset does not allow empty match", ev(SEND, { to: [""] }), "block"],

  // --- blocked: MCP default-deny ---
  ["broadcast", ev("mcp__resend-practice__send-broadcast", { segmentId: "s1" }), "block"],
  ["batch send even to test inbox", ev("mcp__resend-practice__send-batch-emails", { emails: [{ to: ["delivered@resend.dev"] }] }), "block"],
  ["create broadcast", ev("mcp__resend-practice__create-broadcast"), "block"],
  ["create contact", ev("mcp__resend-practice__create-contact", { email: "x@resend.dev" }), "block"],
  ["create API key", ev("mcp__resend-practice__create-api-key"), "block"],
  ["forward inbox email", ev("mcp__resend-practice__forward-inbox-thread-email", { to: ["delivered@resend.dev"] }), "block"],
  ["send-new-inbox-email", ev("mcp__resend-practice__send-new-inbox-email", { to: ["delivered@resend.dev"] }), "block"],
  ["another ESP's MCP server", ev("mcp__sendgrid__mail_send", { to: "delivered@resend.dev" }), "block"],

  // --- blocked: non-MCP send-style tools ---
  ["generic broadcast tool", ev("send_broadcast", { to: ["delivered@resend.dev"] }), "block"],
  ["generic newsletter tool", ev("send_newsletter", { to: ["delivered@resend.dev"] }), "block"],
  ["generic send to real person", ev("send_email", { to: ["ava@example.com"] }), "block"],

  // --- blocked: shell and web routes to a real provider ---
  ["curl to real Resend API", ev("Bash", { command: "curl -X POST https://api.resend.com/emails -H 'Authorization: Bearer re_x'" }), "block"],
  ["base URL override to real API", ev("Bash", { command: "RESEND_BASE_URL=https://api.resend.com node scripts/send-launch.mjs" }), "block"],
  ["SendGrid API", ev("Bash", { command: "curl https://api.sendgrid.com/v3/mail/send" }), "block"],
  ["Mailgun EU API", ev("Bash", { command: "curl --user api:key https://api.eu.mailgun.net/v3/x/messages" }), "block"],
  ["AWS SES", ev("Bash", { command: "aws sesv2 send-email --endpoint-url https://email.us-east-1.amazonaws.com" }), "block"],
  ["SMTP port", ev("Bash", { command: "openssl s_client -connect smtp.example.org:587 -starttls smtp" }), "block"],
  ["python smtplib", ev("Bash", { command: "python -c 'import smtplib; smtplib.SMTP(\"x\")'" }), "block"],
  ["sendmail binary", ev("Bash", { command: "echo hi | sendmail someone@gmail.com" }), "block"],
  ["PowerShell to real API", ev("PowerShell", { command: "Invoke-RestMethod -Uri https://api.resend.com/emails -Method Post" }), "block"],
  ["WebFetch to real API", ev("WebFetch", { url: "https://api.resend.com/emails" }), "block"],

  // --- blocked: malformed ---
  ["missing tool_name", { tool_input: {} }, "block"],
];

for (const [name, event, expected] of CASES) {
  test(`send-guard: ${name} -> ${expected}`, () => {
    const result = evaluate(event, ENV);
    assert.equal(result.decision, expected, result.reason);
  });
}

test("send-guard: without MY_EMAIL, the owner address is blocked", () => {
  assert.equal(evaluate(ev(SEND, { to: "owner@my-own-domain.com" }), {}).decision, "block");
});

test("send-guard: allowed domains are configurable", () => {
  const env = { SEND_GUARD_ALLOWED_DOMAINS: "resend.dev, sandbox.test" };
  assert.equal(evaluate(ev(SEND, { to: "a@sandbox.test" }), env).decision, "allow");
});

test("collectRecipients only reads recipient keys", () => {
  assert.deepEqual(
    collectRecipients({ from: "a@x.com", replyTo: "b@x.com", text: "c@x.com", to: ["D@Resend.dev"], nested: { cc: "e@resend.dev" } }).sort(),
    ["d@resend.dev", "e@resend.dev"]
  );
});

test("isEspHost matches providers and not look-alikes", () => {
  assert.ok(isEspHost("api.resend.com"));
  assert.ok(isEspHost("email-smtp.eu-west-1.amazonaws.com"));
  assert.ok(!isEspHost("resend.com"));
  assert.ok(!isEspHost("api.resend.com.example.org"));
  assert.ok(!isEspHost("localhost"));
});

// The CLI contract Claude Code relies on: exit 2 blocks, exit 0 allows, stderr carries the reason.
const runCli = (input) =>
  spawnSync(process.execPath, ["studio-kit/hooks/send-guard.mjs"], { input, encoding: "utf8", env: { ...process.env, MY_EMAIL: "" } });

test("CLI: blocked send exits 2 with a reason on stderr", () => {
  const r = runCli(JSON.stringify(ev(SEND, { to: ["ava@example.com"] })));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /BLOCKED/);
});

test("CLI: allowed send exits 0", () => {
  const r = runCli(JSON.stringify(ev(SEND, { to: ["delivered@resend.dev"] })));
  assert.equal(r.status, 0, r.stderr);
});

test("CLI: unparseable input fails closed (exit 2)", () => {
  assert.equal(runCli("not json").status, 2);
  assert.equal(runCli("").status, 2);
});

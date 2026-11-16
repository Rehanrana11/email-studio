// Lab step 14: studio-kit must carry tools, not a brand. A second made-up client (examples/client-two,
// Rise & Crumb) runs on the same kit with only its own config, voice, leads and rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluate } from "../studio-kit/hooks/send-guard.mjs";

const C2 = "examples/client-two";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const c2 = json(`${C2}/studio.config.json`);
const lint = (...args) => spawnSync(process.execPath, ["studio-kit/scripts/lint-emails.mjs", ...args], { encoding: "utf8" });
const leads = readFileSync(`${C2}/leads/leads.csv`, "utf8").trim().split("\n").slice(1).map((r) => r.split(","));

function files(dir) {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
}

test("client two's email passes the kit linter under client two's own config", () => {
  const r = lint("--config", `${C2}/studio.config.json`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS {2}campaigns\/spring-bake\/emails\/01-hello\.md/);
});

test("the rules come from config, not code: each client's email fails the other client's config", () => {
  const a = lint("--config", `${C2}/studio.config.json`, "campaigns/spice-circle-launch/emails/01-get-the-pan-warm.md");
  assert.equal(a.status, 1);
  assert.match(a.stdout, /cta-url-wrong-domain/);
  const b = lint("--config", "studio.config.json", `${C2}/campaigns/spring-bake/emails/01-hello.md`);
  assert.equal(b.status, 1);
  assert.match(b.stdout, /footer-missing/);
});

test("studio-kit code names neither client", () => {
  const brandWords = /clove|copper|spice circle|rafi\b|favorite_blend|rise & crumb|riseandcrumb|kettlebird|steep club/i;
  const code = ["scripts", "hooks", "skills", "agents", "review"].flatMap((d) => files(join("studio-kit", d)));
  assert.ok(code.length >= 6, "kit files found");
  for (const f of code) assert.doesNotMatch(readFileSync(f, "utf8"), brandWords, f);
});

test("client two's leads: 6 made-up people in its 2 groups, all @example.com, all with consent", () => {
  assert.equal(leads.length, 6);
  const groups = c2.audiences.filter((a) => a !== "all");
  for (const g of groups) assert.equal(leads.filter((l) => l[4] === g).length, 3, g);
  for (const l of leads) {
    assert.match(l[3], /^[a-z.]+@example\.com$/, l[0]);
    assert.ok(l[9], `consent ${l[0]}`);
  }
  const rules = readFileSync(`${C2}/leads/CLAUDE.md`, "utf8");
  assert.match(rules, /## Groups/);
  for (const g of groups) assert.ok(rules.includes(`\`${g}\``), g);
});

test("client two's voice guide states its sign-off and footer, and CLAUDE.md imports it", () => {
  const voice = readFileSync(`${C2}/brand/voice.md`, "utf8");
  assert.ok(voice.includes(c2.signOff));
  for (const line of c2.footer) assert.ok(voice.includes(line), line);
  assert.match(readFileSync(`${C2}/CLAUDE.md`, "utf8"), /^@brand\/voice\.md$/m);
});

test("the kit's send guard blocks client two's first lead and allows the test inbox", () => {
  const send = (to) => evaluate({ hook_event_name: "PreToolUse", tool_name: "mcp__resend-practice__send-email", tool_input: { to: [to] } }, {});
  assert.equal(send(leads[0][3]).decision, "block");
  assert.equal(send("delivered@resend.dev").decision, "allow");
});

test("client two's practice MCP server cannot reach a real provider", () => {
  const env = json(`${C2}/.mcp.json`).mcpServers["resend-practice"].env;
  assert.match(env.RESEND_BASE_URL, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  assert.ok(!JSON.stringify(env).includes("${"), "no env interpolation");
});

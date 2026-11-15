import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { renderTokens, assertLocal } from "../scripts/send-launch.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const config = json("studio.config.json");

test("every base email has a personalized copy in every group", () => {
  const base = readdirSync(`${config.campaignDir}/emails`).sort();
  for (const g of config.audiences.filter((a) => a !== "all")) {
    assert.deepEqual(readdirSync(`${config.campaignDir}/personalized/${g}`).sort(), base, g);
  }
});

test("brand voice doc and config agree on the sign-off, footer and offer", () => {
  const voice = readFileSync("brand/voice.md", "utf8");
  const plan = readFileSync(`${config.campaignDir}/plan.md`, "utf8");
  assert.ok(voice.includes(config.signOff), "sign-off");
  for (const line of config.footer) assert.ok(voice.includes(line), `footer: ${line}`);
  for (const fact of [config.offer.regularPrice, config.offer.foundingPrice]) assert.ok(plan.includes(fact), fact);
});

test("renderTokens uses values, falls back for unknown, and refuses silent blanks", () => {
  assert.equal(renderTokens("Hi {{first_name}}", { first_name: "Noor" }), "Hi Noor");
  assert.equal(renderTokens("your {{favorite_blend|usual blend}}", { favorite_blend: "unknown" }), "your usual blend");
  assert.equal(renderTokens("your {{favorite_blend|usual blend}}", { favorite_blend: "harissa" }), "your harissa");
  assert.throws(() => renderTokens("Hi {{first_name}}", {}));
});

test("practice sender refuses any non-local base URL", () => {
  assert.doesNotThrow(() => assertLocal("http://localhost:4000"));
  assert.doesNotThrow(() => assertLocal("http://127.0.0.1:4000"));
  assert.throws(() => assertLocal("https://api.resend.com"));
  assert.throws(() => assertLocal("http://localhost.evil.com:4000"));
});

test(".mcp.json never reads a real key from the environment and points at localhost", () => {
  const mcp = json(".mcp.json").mcpServers["resend-practice"];
  assert.equal(mcp.env.RESEND_API_KEY, "re_practice_local_only");
  assert.ok(!JSON.stringify(mcp.env).includes("${"), "no env interpolation");
  assert.match(mcp.env.RESEND_BASE_URL, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  assert.match(mcp.args.join(" "), /resend-mcp@\d+\.\d+\.\d+/, "MCP server version is pinned");
});

test("hook wiring: project settings and plugin both run the same guard on Bash, WebFetch and MCP", () => {
  const settings = json(".claude/settings.json").hooks.PreToolUse[0];
  const plugin = json("studio-kit/hooks/hooks.json").hooks.PreToolUse[0];
  for (const h of [settings, plugin]) {
    const re = new RegExp(`^(?:${h.matcher})$`);
    for (const tool of ["Bash", "PowerShell", "WebFetch", "mcp__resend-practice__send-email", "send_email"]) assert.ok(re.test(tool), `${tool} vs ${h.matcher}`);
    assert.match(h.hooks[0].command, /send-guard\.mjs/);
  }
  assert.equal(settings.matcher, plugin.matcher, "matchers drift");
});

test("plugin and marketplace manifests are consistent", () => {
  const plugin = json("studio-kit/.claude-plugin/plugin.json");
  const market = json(".claude-plugin/marketplace.json");
  const entry = market.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, "plugin listed in marketplace");
  assert.ok(existsSync(entry.source.replace(/^\.\//, "")), "marketplace source path exists");
  for (const p of ["agents/email-reviewer.md", "skills/personalize/SKILL.md", "hooks/send-guard.mjs", "scripts/lint-emails.mjs", "scripts/review.mjs", "review/schema.json"]) {
    assert.ok(existsSync(`studio-kit/${p}`), p);
  }
});

test("no secrets or personal settings are tracked", () => {
  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /\.claude\/settings\.local\.json/);
  assert.match(ignore, /^\.env$/m);
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
  } catch {
    return; // not a git checkout yet
  }
  assert.ok(!tracked.includes(".claude/settings.local.json"));
  for (const f of tracked.filter((f) => f && existsSync(f) && !f.startsWith("tests/"))) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /re_[A-Za-z0-9]{20,}/, `possible Resend key in ${f}`);
  }
});

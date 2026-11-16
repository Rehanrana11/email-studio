import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { lintEmail, loadConfig, defaultFiles } from "../studio-kit/scripts/lint-emails.mjs";

const config = loadConfig("studio.config.json");
const files = defaultFiles(".", config).map((f) => f.replace(/\\/g, "/"));
const CLEAN_PATH = "campaigns/spice-circle-launch/emails/01-get-the-pan-warm.md";
const clean = readFileSync(CLEAN_PATH, "utf8");
const ids = (text, path = CLEAN_PATH) => lintEmail(text, { config, path }).map((f) => f.id);

test("there are 4 base emails and 12 personalized emails", () => {
  assert.equal(files.filter((f) => f.includes("/emails/")).length, 4);
  assert.equal(files.filter((f) => f.includes("/personalized/")).length, 12);
});

for (const file of files) {
  test(`lint passes: ${file}`, () => {
    const findings = lintEmail(readFileSync(file, "utf8"), { config, path: file });
    assert.deepEqual(findings, [], findings.map((f) => `${f.id}: ${f.message}`).join("\n"));
  });
}

test("every clean email still lints clean with Windows (CRLF) line endings", () => {
  for (const file of files) {
    const crlf = readFileSync(file, "utf8").replace(/\r?\n/g, "\r\n");
    const findings = lintEmail(crlf, { config, path: file });
    assert.deepEqual(findings, [], `${file}: ${findings.map((f) => f.id).join(", ")}`);
  }
});

// Mutation tests: each takes a clean email, breaks exactly one rule, and asserts the linter notices.
// A checker that can't fail is worthless; these prove every rule can fail.
const MUTATIONS = [
  ["health claim (exact word)", (t) => t.replace("Get the pan warm and have a look.", "It's a real immunity helper."), "health-claim-immunity"],
  ["health claim (curly apostrophe variant of urgency)", (t) => t.replace("Get the pan warm and have a look.", "Don’t miss out."), "fake-urgency-don-t-miss-out"],
  ["anti-inflammatory", (t) => t.replace("Get the pan warm", "Our anti-inflammatory blends"), "health-claim-anti-inflammatory"],
  ["hype word", (t) => t.replace("So we made something new", "So we made something revolutionary"), "hype-revolutionary"],
  ["second CTA", (t) => t.replace("[Join The Spice Circle →]", "[Join The Spice Circle →]\n\n[Gift it →]"), "cta-count"],
  ["no CTA", (t) => t.replace("[Join The Spice Circle →]", ""), "cta-count"],
  ["CTA text drift", (t) => t.replace("[Join The Spice Circle →]", "[Join now →]"), "cta-text-mismatch"],
  ["extra link in body", (t) => t.replace("Get the pan warm and have a look.", "See https://cloveandcopper.example.com/faq"), "extra-link-in-body"],
  ["two exclamation marks", (t) => t.replace("have a look.", "have a look! Really!"), "too-many-exclamations"],
  ["subject too long", (t) => t.replace('subject: "Get the pan warm, something new 🌶️"', 'subject: "Get the pan warm, something genuinely new and tasty"'), "subject-too-long"],
  ["subject with two emoji", (t) => t.replace("something new 🌶️", "new 🌶️🍳"), "subject-too-many-emoji"],
  ["ALL CAPS in subject", (t) => t.replace("something new", "something NEW"), "subject-all-caps"],
  ["Re: subject", (t) => t.replace('subject: "Get', 'subject: "Re: Get'), "subject-misleading-prefix"],
  ["preview too short", (t) => t.replace(/preview: ".*"/, 'preview: "Hello"'), "preview-length"],
  ["wrong link domain", (t) => t.replace("https://cloveandcopper.example.com", "https://cloveandcopper.com"), "cta-url-wrong-domain"],
  ["wrong utm_content", (t) => t.replace("utm_content=email01-all", "utm_content=email02-all"), "utm-content"],
  ["missing utm_medium", (t) => t.replace("&utm_medium=email", ""), "utm-medium"],
  ["wrong price", (t) => t.replace("$17/month for life", "$15/month for life"), "offer-price-mismatch"],
  ["wrong deadline date", (t) => t.replace("Friday 18 December", "Friday 19 December"), "offer-date-mismatch"],
  ["wrong deadline weekday", (t) => t.replace("Friday 18 December", "Saturday 18 December"), "offer-weekday-mismatch"],
  ["send after the deadline", (t) => t.replace("send_date: 2026-12-02", "send_date: 2026-12-20"), "send-date-after-deadline"],
  ["unknown token", (t) => t.replace("Hi {{first_name}}", "Hi {{firstname}}"), "token-unknown"],
  ["favorite_blend without fallback", (t) => t.replace("Get the pan warm and have a look.", "Your {{favorite_blend}} misses you."), "token-needs-fallback"],
  ["missing unsubscribe footer", (t) => t.replace(/You're getting this.*\r?\n/, ""), "footer-missing"],
  ["missing postal address", (t) => t.replace(/Clove & Copper Spice Co\. \(a made-up.*\n?/, ""), "footer-missing"],
  ["missing sign-off", (t) => t.replace("Warmly, Rafi & the Clove & Copper kitchen 🌶️", "Cheers"), "sign-off-missing"],
  ["lead surname in copy", (t) => t.replace("Hi {{first_name}},", "Hi {{first_name}} Halvorsen,"), "lead-pii-in-copy"],
  ["missing frontmatter key", (t) => t.replace(/cta_text: .*\r?\n/, ""), "fm-missing-cta-text"],
  ["name does not match file", (t) => t.replace("name: get-the-pan-warm", "name: something-else"), "fm-name-mismatch"],
  ["base email with group audience", (t) => t.replace("audience: all", "audience: gifters"), "audience-base-not-all"],
  ["body too long", (t) => t.replace("Get the pan warm and have a look.", "word ".repeat(120)), "body-too-long"],
];

const withPii = (text, path = CLEAN_PATH) => lintEmail(text, { config, path, leadPii: ["Halvorsen", "noor.halvorsen@example.com"] }).map((f) => f.id);

for (const [name, mutate, expectedId] of MUTATIONS) {
  test(`lint catches: ${name} -> ${expectedId}`, () => {
    const mutated = mutate(clean);
    assert.notEqual(mutated, clean, "mutation did not change the email; fix the test");
    assert.ok(withPii(mutated).includes(expectedId), `expected ${expectedId}, got: ${withPii(mutated).join(", ") || "nothing"}`);
  });
}

test("personalized file with the wrong audience is caught", () => {
  const path = "campaigns/spice-circle-launch/personalized/gifters/01-get-the-pan-warm.md";
  const text = readFileSync(path, "utf8").replace("audience: gifters", "audience: curious");
  assert.ok(ids(text, path).includes("audience-folder-mismatch"));
});

test("words like 'cured', 'healthy' and 'boosted' are not false positives for cure/heal/boost", () => {
  const t = clean.replace("Get the pan warm and have a look.", "Great with cured lemons and a healthy pinch of salt.");
  assert.deepEqual(ids(t), []);
});

test("bad sample fails with many high findings (CLI exit 1)", () => {
  const r = spawnSync(process.execPath, ["studio-kit/scripts/lint-emails.mjs", "review/samples/bad-email.md"], { encoding: "utf8" });
  assert.equal(r.status, 1);
  for (const id of ["subject-all-caps", "subject-misleading-prefix", "cta-count", "health-claim-detox", "fake-urgency-act-now", "footer-missing", "offer-price-mismatch", "token-needs-fallback"]) {
    assert.match(r.stdout, new RegExp(id), `missing ${id}`);
  }
});

test("CLI: all campaign emails pass (exit 0)", () => {
  const r = spawnSync(process.execPath, ["studio-kit/scripts/lint-emails.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
});

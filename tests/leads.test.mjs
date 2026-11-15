import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLeads } from "../scripts/send-launch.mjs";

const leads = loadLeads();
const GROUPS = ["curious", "home-cooks", "gifters"];

test("24 leads, 8 per group, only known groups", () => {
  assert.equal(leads.length, 24);
  for (const g of GROUPS) assert.equal(leads.filter((l) => l.group === g).length, 8, g);
  assert.deepEqual([...new Set(leads.map((l) => l.group))].sort(), [...GROUPS].sort());
});

test("every email is on the reserved example.com domain", () => {
  for (const l of leads) assert.match(l.email, /^[a-z0-9.]+@example\.com$/, l.id);
});

test("ids and emails are unique and ids are L001..L024", () => {
  assert.equal(new Set(leads.map((l) => l.id)).size, 24);
  assert.equal(new Set(leads.map((l) => l.email)).size, 24);
  leads.forEach((l, i) => assert.equal(l.id, `L${String(i + 1).padStart(3, "0")}`));
});

test("consent is yes on every row", () => {
  for (const l of leads) assert.equal(l.consent, "yes", l.id);
});

test("order counts match the group definitions", () => {
  for (const l of leads) {
    const orders = Number(l.orders);
    if (l.group === "curious") assert.equal(orders, 0, l.id);
    if (l.group === "home-cooks") assert.ok(orders >= 2, l.id);
    if (l.group === "gifters") assert.ok(orders >= 1, l.id);
  }
});

test("favorite_blend is a value or 'unknown', never empty", () => {
  for (const l of leads) assert.ok(l.favorite_blend && l.favorite_blend.trim(), l.id);
});

test("signup dates are ISO dates", () => {
  for (const l of leads) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(l.signup_date) && !Number.isNaN(Date.parse(l.signup_date)), l.id);
});

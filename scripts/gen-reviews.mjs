#!/usr/bin/env node
// Generate 120 FAKE Spice Circle customer reviews for practising analysis. Never use these as real testimonials.
//
//   node scripts/gen-reviews.mjs [--seed 42] [--n 120]
//
// Uses a seeded PRNG so the file is reproducible, but the data is not artificially balanced:
// groups, blends and star ratings vary the way real data does, and complaints are weighted toward
// operations (shipping, billing), which is what you'd expect from a subscription box.

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, d) => (args.includes(name) ? args[args.indexOf(name) + 1] : d);
const SEED = Number(opt("--seed", "42"));
const N = Number(opt("--n", "120"));

// mulberry32: small, fast, seeded PRNG
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};

const firsts = ["Noor", "Tariq", "Elena", "Kwame", "Ines", "Haruto", "Maya", "Bilal", "Sofia", "Daniel", "Aisha", "Marco", "Leila", "Owen", "Zainab", "Chen", "Grace", "Yusuf", "Hana", "Luca", "Amara", "Felix", "Rania", "Theo"];
const blends = ["Smoky Harissa Rub", "Winter Garam Masala", "Lemon Za'atar", "Berbere", "Chinese Five-Spice", "Baharat"];
// Group mix is uneven on purpose: home-cooks review most.
const groupWeights = [["curious", 25], ["home-cooks", 45], ["gifters", 30]];
// Star weights differ a little by group (gift buyers rate packaging and delivery harder).
const starWeights = {
  curious: [[5, 40], [4, 32], [3, 16], [2, 7], [1, 5]],
  "home-cooks": [[5, 50], [4, 30], [3, 11], [2, 5], [1, 4]],
  gifters: [[5, 38], [4, 28], [3, 14], [2, 10], [1, 10]],
};
const templates = {
  5: [
    ["recipe-card", "The {blend} recipe card turned a boring Tuesday into the best dinner of the week."],
    ["variety", "Three new jars, zero effort. The {blend} lives next to the stove now."],
    ["gift", "Gave this to my brother and he keeps sending me photos of what he cooks with the {blend}."],
    ["packaging", "Arrived on time, beautifully packed, and the {blend} smelled amazing the second I opened it."],
  ],
  4: [
    ["quantity", "Loved the {blend}. I'd happily pay a bit more for bigger jars."],
    ["recipe-card", "Clear recipe cards. The {blend} was great; the other two were fine."],
    ["shipping", "Good box, but it turned up two days late. The {blend} made up for it."],
  ],
  3: [
    ["flavour", "Okay this month. The {blend} was milder than I expected."],
    ["quantity", "Decent, but 40 g goes quickly if you cook every night."],
    ["recipe-card", "The {blend} recipe needed more salt than the card said."],
  ],
  2: [
    ["shipping", "Box arrived crushed and the {blend} jar had leaked."],
    ["billing", "Got charged before my skip took effect. Support fixed it, eventually."],
    ["quantity", "Not enough spice for the price. Felt thin for a monthly box."],
  ],
  1: [
    ["shipping", "Box never arrived and nobody answered my email for a week."],
    ["billing", "Charged twice and cancelling was a maze."],
    ["wrong-item", "Got the same blends two months in a row. The {blend} again."],
  ],
};

const rows = [];
for (let i = 0; i < N; i++) {
  const group = weighted(groupWeights);
  const stars = weighted(starWeights[group]);
  const blend = pick(blends);
  const [theme, tmpl] = pick(templates[stars]);
  const day = 1 + Math.floor(rand() * 30);
  rows.push({
    id: `R${String(i + 1).padStart(3, "0")}`,
    name: `${pick(firsts)} ${String.fromCharCode(65 + Math.floor(rand() * 26))}.`,
    group,
    stars,
    blend,
    theme,
    text: tmpl.replace("{blend}", blend),
    date: `2026-11-${String(day).padStart(2, "0")}`,
    fake: true,
  });
}

writeFileSync("notes/reviews.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`Wrote ${rows.length} fake reviews to notes/reviews.jsonl (seed ${SEED}). Run: npm run analyze:reviews`);

---
name: personalize
description: Write per-group personalized versions of the Spice Circle launch emails. Use when the owner wants the 4 base emails tailored for the curious, home-cooks and gifters lead groups, producing files under campaigns/spice-circle-launch/personalized/.
argument-hint: "[group: all | curious | home-cooks | gifters]"
context: fork
allowed-tools: Read, Write, Glob, Bash(mkdir:*), Bash(npm run lint:*)
---

# Personalize Spice Circle emails

You run as a fork: you do NOT have the conversation history. Everything you need is below.

## What you produce
- For each group, one personalized copy of **every** base email, same file name:
  `campaigns/spice-circle-launch/personalized/<group>/<NN-name>.md`
- Argument `curious`, `home-cooks` or `gifters` → only that group (4 files).
  Empty or `all` → all three groups (12 files).

## Steps
1. `Glob campaigns/spice-circle-launch/emails/*.md` and `Read` all 4 base emails. They are the source of truth.
2. `Read leads/CLAUDE.md` to confirm the group slugs. **Do not read or copy any lead's name, email, city or surname.**
   Personalization is by group plus the allowed tokens only.
3. For each group and email: `mkdir -p` the folder and `Write` the file.
4. Run `npm run lint`. If any personalized file fails, fix it and run the linter again until it passes.

## How to personalize (keep ~95% of the base copy)
Change only:
- `audience:` → the group slug.
- `cta_url:` → `utm_content=emailNN-all` becomes `utm_content=emailNN-<group>`.
- Add **one** group-tailored sentence right after the `Hi {{first_name}},` line. Vary it per email; don't paste the
  same sentence four times.

**Group angles (from `plan.md`):**
- `curious`: never bought. Reassure a first-timer: the recipe card does the deciding, no skill needed.
- `home-cooks`: bought 2+ times. Acknowledge their taste. If you use `{{favorite_blend}}`, you **must** give it a
  fallback: `{{favorite_blend|usual blend}}`, because the value is often `unknown`.
- `gifters`: bought a gift set. Frame it as an easy present that arrives every month.

## Rules you must keep
- Subject unchanged (≤ 45 chars, max one emoji, sentence case, no `Re:`/`Fwd:`).
- Exactly **one** CTA line. At most **one** `!` in the whole email.
- No health claims, no fake urgency. Offer facts stay exactly as in the base email.
- Sign-off and both footer lines unchanged.
- Links only on `cloveandcopper.example.com`.

## When done
Report: number of files written, their paths, and the `npm run lint` result.

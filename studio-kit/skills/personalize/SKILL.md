---
name: personalize
description: Write per-group personalized versions of a set of base marketing emails. Use when a studio needs its base emails tailored for each lead group, producing one file per group per email under the campaign's personalized/ folder.
argument-hint: "[group or 'all']"
context: fork
allowed-tools: Read, Write, Glob, Bash(mkdir:*), Bash(node *lint-emails.mjs*)
---

# Personalize emails per lead group

You run as a fork: you do NOT have the conversation history. Everything you need is below.

## Inputs you look up
1. `Read studio.config.json`: `campaignDir`, `audiences` (the group slugs plus `all`), allowed `tokens`.
2. `Glob <campaignDir>/emails/*.md` and `Read` every base email. They are the source of truth for structure.
3. If the campaign has a `plan.md`, read its per-group angles. Don't read the leads file: personalization is by
   group plus tokens, never by an individual lead's name, email, city or surname.

## What you produce
- For each group (every audience except `all`), one copy of **every** base email with the same file name:
  `<campaignDir>/personalized/<group>/<NN-name>.md`
- Argument names one group → only that group. Empty or `all` → every group.

## How to personalize (keep ~95% of the base copy)
Change only:
- `audience:` → the group slug.
- the tracking id in `cta_url` (e.g. `utm_content=emailNN-all` → `emailNN-<group>`).
- Add **one** group-tailored sentence right after the greeting, matching the group's motivation
  (a first-timer needs reassurance; a loyal buyer wants their taste acknowledged; a gift-giver wants an easy present).
  Vary it per email.
- Any token whose value can be missing (e.g. a favourite product that may be `unknown`) **must** carry a fallback:
  `{{token|fallback text}}`.

## Rules you must keep
- Subject, offer facts, sign-off and footer stay exactly as in the base email.
- Exactly **one** CTA line. At most **one** "!". No health claims. No fake urgency.

## Verify before you finish
Run `node studio-kit/scripts/lint-emails.mjs` (or `${CLAUDE_PLUGIN_ROOT}/scripts/lint-emails.mjs`). Fix every
failing file and run it again until it passes. Report the number of files written, their paths and the linter result.

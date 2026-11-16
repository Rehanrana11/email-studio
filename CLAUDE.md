# Clove & Copper — Email Studio

Email marketing studio for **Clove & Copper Spice Co.** (a made-up spice shop).
Current launch: **The Spice Circle**, a monthly spice-blend subscription box.

This is a practice lab. No real customer, no real inbox, and no real email exists here.

## Folder map
- `brand/voice.md`: brand voice (human-readable). `studio.config.json`: the same rules, machine-checkable.
- `leads/`: 24 fake leads (see `leads/CLAUDE.md` for its own rules)
- `campaigns/spice-circle-launch/`: plan, sequence, 4 base emails, 12 personalized versions
- `studio-kit/`: the reusable plugin (send-guard hook, linter, LLM reviewer, skill, subagent)
- `examples/client-two/`: a second made-up client (Rise & Crumb) that runs on the same kit
- `scripts/`: project scripts (practice send, fake reviews, review analysis)
- `tests/`: `node --test` suite; `npm test` must pass before any commit
- `notes/`: decisions, handoffs, experiments

## Golden rules
1. **Practice only.** Send only through the local Resend emulator at `http://localhost:4000`.
   Never call the real Resend API (`api.resend.com`) or any real email provider.
2. **Allowed recipients:** `*@resend.dev` test addresses and the owner's `MY_EMAIL`. Max 3 per send.
   The send-guard hook blocks everything else. Never try to get around it; if it blocks you, stop and tell the owner.
3. **No broadcasts, batch sends, contact imports or API-key changes.** The hook and `permissions.deny` block them.
4. **No secrets in git.** `MY_EMAIL` lives only in `.claude/settings.local.json` (gitignored).
   `.mcp.json` uses a dummy key on purpose, so a real `RESEND_API_KEY` in your shell can never leak in.
5. **Fake data only.** Every lead email ends in `@example.com`. Never add real people.
6. **Check with tools, not by eye.** `npm test` (guard, linter, leads) and `npm run lint` (emails) are the source of truth.
7. **One step at a time.** Finish a step, report what changed and how to verify it, then stop.
8. **Conventional commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one logical change per commit.
9. **Ask before deleting.** Never delete a file, folder, branch or sent-email record without the owner's go-ahead.

## Brand voice
@brand/voice.md

## Writing emails
- Rules: `.claude/rules/emails.md` (loads automatically for email files).
- File names: `campaigns/spice-circle-launch/emails/NN-short-name.md`;
  personalized: `campaigns/spice-circle-launch/personalized/<group>/NN-short-name.md`.
- After any copy change: `npm run lint`. For a judgement review: `npm run review -- <file>` (needs the Claude CLI).

## Tools
- Anthropic marketing plugin (project scope): `/marketing:campaign-plan`, `/marketing:email-sequence`,
  `/marketing:brand-review`.
- Prefer Glob/Grep/the linter to check files over guessing.

## Things that do NOT exist: never use them
- A `commands` list in `.claude/config.json`
- A `CLAUDE_HEADLESS` env var
- A `--batch` CLI flag

## When something needs the owner
Some actions only the owner can do (`/plugin`, `/mcp`, `/compact`, starting a new session, CLI flags,
setting `MY_EMAIL`). Give the exact command to run and wait.

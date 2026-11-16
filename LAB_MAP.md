# Lab map: FDE-102 Email Studio, step by step

Each lab step, where its proof lives, and where this repo does it differently. A difference is kept only when it
is stronger for a real client than the lab's version; the reason is given. Nothing here was weakened to match the
lab's wording. Status as of 16 Nov 2026; `npm test` → 139 passing.

**Status key.** **Done**: built, with proof in the repo. **Done, differently**: built in a stronger form, reason given.
**Owner runs**: needs a live Claude Code session by the owner (the lab's point is doing it), so it is not claimed here.

| # | Lab step | Status | Proof | Different from the lab, and why |
|---|---|---|---|---|
| 1 | Look before you build | **Owner runs** | `notes/skills-i-chose.md` (vetting rules, the plugin in use) | The four `npx skills find` searches have not been run with results recorded. Run them on your laptop (see below); this shell's network returned "No skills found" even for `resend`, so its output is not evidence. |
| 2 | Set up your studio | Done | `.claude/settings.json` (`enabledPlugins`, project scope), `CLAUDE.md`, `.gitignore`; `git check-ignore -v .claude/settings.local.json` | `CLAUDE.md` also holds the safety rules the later steps rely on. |
| 3 | Brand voice | Done | `brand/voice.md`, imported by `@brand/voice.md` in `CLAUDE.md`; `studio.config.json` | **Machine-checkable twin.** The voice is also in `studio.config.json`, so the linter checks it, and a test fails if the two disagree. |
| 4 | Plan the campaign | Done | `campaigns/spice-circle-launch/plan.md` (dated calendar, goal, metrics, risks) | |
| 5 | Practice leads | Done, differently | `leads/leads.csv` (24 people, 8 per group, all `@example.com`), `leads/CLAUDE.md`; `tests/leads.test.mjs` | **Columns:** an `id` (so leads are referred to by id, never by name), `favorite_blend` (personalization) and `signup_date` for the lab's `joined_on`. |
| 6 | Email rule and sequence | Done, differently | `.claude/rules/emails.md` (`paths:`), 4 emails in `campaigns/spice-circle-launch/emails/`; `npm run lint` → 16/16 pass | **Format:** subject, preview and link are YAML front matter, not `Subject:` lines and an inline link. The linter can then check 30+ rules exactly (length, one CTA, UTM tags, offer facts, footer); 31 mutation tests each break one rule in a clean email and assert it is caught. The rule also covers the personalized copies. |
| 7 | Fresh-eyes review | **Owner runs** | `review/samples/bad-email.md` (the linter fails it); `npm run review` | Run `/marketing:brand-review` in a fresh session and commit the fixes; nothing in the repo shows that run yet. |
| 8 | Your own skill: personalize | Done, differently | `.claude/skills/personalize/SKILL.md` (`argument-hint`, `context: fork`, `allowed-tools`), 12 files in `personalized/<group>/` | **Output folder:** `personalized/<group>/` instead of `groups/<group>/emails/`. **Linting:** the skill runs `npm run lint` on what it writes before it reports back. **Diff, 12/12 files:** each copy adds one group-specific line after the greeting, and changes `audience` and the UTM tag; nothing else differs from the base email. |
| 9 | Connect Resend (practice) | Done, differently | `.mcp.json` (pinned `resend-mcp@2.28.1`, localhost); `tests/project.test.mjs` | **Hardcoded dummy key:** no `${RESEND_API_KEY:-re_practice}`. With the lab's form, a real key already in your shell silently turns the "practice" server real. A test fails if anyone adds `${` back. Going live should be a separate, deliberate config, not an environment variable. |
| 10 | The safety guard | Done, differently | `studio-kit/hooks/send-guard.mjs`, wired in `.claude/settings.json`; `tests/send-guard.test.mjs` (42 allow/block cases) | **Default-deny on Bash, PowerShell, WebFetch and every MCP tool, not just `mcp__resend__.*`.** A `curl` to the real API, SMTP, another provider's MCP server, or a lead hidden in `bcc` is blocked too. Lives in the plugin so every client gets it. |
| 11 | Practice launch | Done | `evidence/practice-launch-2026-11-16.json`: 3/3 delivered on the emulator, all to `delivered@resend.dev`, 0 to anyone else | Sent by `scripts/send-launch.mjs`, which refuses any non-localhost base URL, instead of by hand. |
| 12 | Resume and fork | **Owner runs** | none yet | Needs `claude -n`, `--resume` and `--fork-session` in your own terminal. Commands below. |
| 13 | Automatic review | Done, differently | `studio-kit/scripts/review.mjs` (`claude -p --json-schema`, folder or file, `--out-dir` re-review); `tests/review.test.mjs` | **Richer schema:** stable `id`, `rule`, `location`, `before`/`after` instead of `file, line, problem, fix`. The stable id is what makes the re-review exact. **Re-review:** a finding is "fixed" only when its text is gone, so asking the model not to repeat itself cannot turn a FAIL into a PASS (tested). **Bad email:** lives in `review/samples/`, not `campaigns/test-bad/`, so the real campaign folder stays lint-clean. |
| 14 | Package your studio kit | Done | `studio-kit/` (plugin, hooks with `${CLAUDE_PLUGIN_ROOT}`, skill, `email-reviewer` agent, linter, review), `.claude-plugin/marketplace.json`, `examples/client-two/`; `tests/portability.test.mjs` | **Client two inside the repo** (`examples/client-two/`) so a reviewer can see it, with a README for running it as its own repo. Tests prove the kit names neither client and the guard blocks client two's first lead. **The reviewer agent keeps `Bash`** so it can run the linter first. Run `claude plugin validate studio-kit` yourself (CI also runs it). |
| 15 | Stretch: what customers love | Partly done | `notes/reviews.jsonl` (120 made-up reviews), `notes/reviews-scratchpad.md`, `notes/compact-experiment.md` (protocol) | The scratchpad is built by a script, not a subagent, and the `/compact` experiment has **not been run**. Owner runs it (below). |

## What only the owner can do (about 2 hours)

Run these in **Claude Code on your laptop**, in this folder. Commit each result with a `docs:` message.

1. **Step 1 (10 min).** `npx skills find email marketing`, `npx skills find email sequence`, `npx skills find campaign plan`,
   `npx skills find resend`. Add a dated table to `notes/skills-i-chose.md`: publisher, installs, GitHub stars, verdict.
   Name two results you would avoid, and why.
2. **Step 7 (20 min).** New session: `/marketing:brand-review campaigns/spice-circle-launch/emails/`. Fix what it finds in
   one message, then `npm run check`.
3. **Step 12 (25 min).** `claude -n launch-angles`, then `claude --resume launch-angles`, then
   `claude --resume launch-angles --fork-session -n angle-a` and `... -n angle-b`. Save `notes/angle-a.md`,
   `notes/angle-b.md` and a 10-line `notes/handoff-angles.md`.
4. **Step 15 (30 min).** Follow `notes/compact-experiment.md` and fill in the results yourself.
5. **Step 14 live check (15 min).** Follow `examples/client-two/README.md`: personalize, then try one blocked send.
6. **Each step's check prompt.** Run the lab's "Check" prompt in a fresh session and answer its two questions out loud.

# studio-kit

A brand-agnostic Claude Code plugin for running a safe email marketing studio. Drop it into any client's studio
and you get the same guardrails, checks and helpers. Everything brand-specific lives in the client's
`studio.config.json` and `brand/voice.md`, not in the plugin.

## What's inside
| Piece | What it does |
|---|---|
| **send-guard hook** (`hooks/`) | PreToolUse hook on Bash, PowerShell, WebFetch, MCP and send-style tools. Email-provider MCP servers are **default-deny** (only get/list/search and single `send-email`). Recipients must be `*@resend.dev` or the owner's `MY_EMAIL` (max 3). Shell and web calls to real provider hosts or SMTP are blocked. Malformed input fails closed. Block = exit 2. |
| **lint-emails** (`scripts/lint-emails.mjs`) | Deterministic checks driven by `studio.config.json`: frontmatter, subject/preview length, emoji, ALL CAPS, misleading prefixes, one CTA, no extra links, banned phrases, token fallbacks, offer prices and deadline, UTM tags, unsubscribe + postal address footer, lead data in copy. |
| **review** (`scripts/review.mjs`) | LLM-as-judge via `claude -p --json-schema`, run after the linter, for judgement calls (implied claims, soft pressure, voice). Fails on any blocking lint finding or high judge finding. Errors exit 2 and never count as a pass. Waivers are per file + id + text hash, expire, and can't cover health/urgency/subject findings. |
| **email-reviewer subagent** (`agents/`) | Interactive version of the review: runs the linter, then reports judgement findings with before/after fixes. Read-only. |
| **personalize skill** (`skills/personalize/`) | Runs as a fork; writes one tailored copy of each base email per lead group, then lints its own output. |

## Requirements
- Node 22+.
- The Claude CLI on PATH for `review.mjs` (on Windows, the native `claude.exe`).
- A `studio.config.json` in the client project (copy the one from the Clove & Copper studio and edit it).
- `MY_EMAIL` in the client's `.claude/settings.local.json` (gitignored) if you want to receive practice mail yourself.

## Install from the marketplace
This repo is also a plugin marketplace (`.claude-plugin/marketplace.json`). Replace `Rehanrana11/email-studio` with
wherever you published it:

```
/plugin marketplace add Rehanrana11/email-studio
/plugin install studio-kit@clove-copper-studio
```

## Or load it without installing
```
cd ~/the-client-studio
claude --plugin-dir ~/path/to/studio-kit
```

## Validate
```
claude plugin validate ./studio-kit
```

## Limits (read these)
- A hook is a guardrail, not a sandbox. A determined shell command (an obfuscated hostname, a script file the
  hook never sees) can get past pattern checks. The real protection is that **no real provider key exists in the
  studio**: `.mcp.json` hard-codes a dummy key and a localhost base URL. Keep it that way.
- The judge is a model. Measure it against human labels (`review/golden/` in the reference studio) before you
  trust it as a CI gate.

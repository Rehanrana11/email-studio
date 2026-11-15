# Skills and plugins: what I use and how I vet them

## In use
| Plugin | Publisher | Source | License | Checked | Why |
|---|---|---|---|---|---|
| `marketing` (`campaign-plan`, `email-sequence`, `brand-review`) | Anthropic (org) | `anthropics/knowledge-work-plugins` | Apache-2.0 | 2026-11-15: repo present, last commit 2026-11-13, `marketing/skills/` has all three skills | Covers planning, sequence drafting and a fresh-eyes brand review. Installed at **project scope** via `.claude/settings.json` (`enabledPlugins`). |

Everything else in this studio (send-guard, linter, judge, personalize skill, reviewer subagent) is written here
in `studio-kit/`, so I know exactly what runs.

## How I vet a third-party skill before installing it
1. **Publisher first.** Organisation or known maintainer beats an anonymous account.
2. **Signals that agree with each other.** High install counts with almost no GitHub stars is a red flag
   (installs can be inflated). Check stars, open issues and last commit together.
3. **Read SKILL.md and every script before installing.** Look for network calls, shell commands, broad
   `allowed-tools`, hooks, and anything that reads env vars or credentials.
4. **License.** No license means no right to reuse. Apache-2.0 / MIT are fine; keep the notice.
5. **Scope.** Install at project scope, not user scope, so a skill can't affect unrelated projects.
6. **Least privilege.** Prefer instruction-only skills over ones that ship executables.

## To do (my own research log)
Run these and record what you find in a table like the one above (publisher, stars, last commit, license, verdict):
```
npx skills find "email marketing"
npx skills find copywriting
npx skills find newsletter
```
Record the date you checked. Stars and activity change, so a verdict without a date is stale.

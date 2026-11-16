---
paths:
  - "campaigns/**/emails/**/*.md"
  - "campaigns/**/personalized/**/*.md"
---

# Email file rules (Rise & Crumb)

Checked by the studio-kit linter: `node <studio-kit>/scripts/lint-emails.mjs --config studio.config.json`.

- YAML front matter with `id`, `name`, `send_date`, `audience`, `subject` (45 characters or fewer, at most one emoji),
  `preview` (40 to 90 characters), `cta_text` and `cta_url`.
- `cta_url` points at `https://riseandcrumb.example/spring` with `utm_source=email`, `utm_medium=email`,
  `utm_campaign=spring-bake` and `utm_content=email<id>-<audience>`.
- Greet the reader with `{{first_name}}`.
- Exactly one call to action, on its own line as `[cta_text]`. No other links.
- End with the sign-off from `brand/voice.md`, then `---`, then the two footer lines as plain text.
- No health claims and no fake urgency (see `brand/voice.md`).

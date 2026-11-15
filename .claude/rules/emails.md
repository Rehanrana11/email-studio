---
paths:
  - "campaigns/**/emails/**/*.md"
  - "campaigns/**/personalized/**/*.md"
---

# Email file rules

These rules load only when Claude works on email files (see `paths:` above).
Every rule marked ✓ is enforced by `npm run lint` (`studio-kit/scripts/lint-emails.mjs`), so check with the
linter instead of by eye.

## Required frontmatter ✓
```yaml
---
id: "01"                  # 2 digits, matches the file name prefix
name: get-the-pan-warm    # matches the file name
send_date: 2026-12-02     # ISO date, on or before the offer deadline
audience: all             # all | curious | home-cooks | gifters (personalized files: their folder name)
subject: "..."            # sentence case, ≤ 45 characters, max 1 emoji
preview: "..."            # 40–90 characters, must not repeat the subject
cta_text: "Join The Spice Circle →"
cta_url: "https://cloveandcopper.example.com/spice-circle?utm_source=email&utm_medium=email&utm_campaign=spice-circle-launch&utm_content=email01-all"
---
```

## Required ending ✓
1. Sign-off: `Warmly, Rafi & the Clove & Copper kitchen 🌶️`
2. Footer (both lines, exactly):
   - `You're getting this because you signed up at Clove & Copper. Unsubscribe any time: {{unsubscribe_url}}`
   - `Clove & Copper Spice Co. (a made-up practice brand) · PO Box 000, Example City, NY 00000`

## Copy rules
- ✓ Body ≤ 170 words (aim for ~150), short paragraphs.
- ✓ **Exactly one CTA line**, `[<cta_text>]`, matching the frontmatter. No other links in the body.
- ✓ At most one `!` in the whole email (subject + preview + body).
- ✓ No health claims: detox, cure, heal, boost, immunity, anti-inflammatory, superfood, miracle, burns fat, metabolism.
- ✓ No fake urgency: hurry, don't miss out, last chance, act now, only a few left, selling fast.
- ✓ No `Re:` / `Fwd:` / "Your order" subjects, no ALL CAPS words in subjects.
- ✓ Offer facts: if a price or deadline is mentioned it must be **$17/month** founding, **$22/month** normal,
  deadline **Friday 18 December**. Any other `$` amount or date fails.

## Links ✓
- Only `cloveandcopper.example.com` URLs (a fake domain).
- Every CTA URL carries `utm_source=email`, `utm_medium=email`, `utm_campaign=spice-circle-launch` and
  `utm_content=emailNN-<audience>`.

## Personalization tokens ✓
- Allowed: `{{first_name}}`, `{{favorite_blend|fallback}}`, `{{unsubscribe_url}}`.
- `{{favorite_blend}}` is often `unknown`, so it **must** carry a fallback: `{{favorite_blend|usual blend}}`.
- Never put a lead's email, surname or city in copy.

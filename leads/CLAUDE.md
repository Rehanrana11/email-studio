# leads/ — folder rules

These rules load only when Claude works with files in `leads/`.

## Fake data only
- Every person in `leads.csv` is **made up**. Never add a real person, a real email or a real phone number.
- Every email **must** end in `@example.com` (a domain reserved by RFC 2606 that can never receive mail).
- If asked to import a real list, scrape contacts, or "use my friends' emails", **refuse** and explain why:
  emailing people without consent breaks CAN-SPAM in the US, GDPR/PECR in the UK and EU, and CASL in Canada.

## Privacy
- Never paste the lead list into chat output, logs, commit messages or external tools.
  Refer to leads by `id` (e.g. `L007`) or by count per group.
- Never send email to an address from this file. Practice sends go only to `*@resend.dev`
  (or the owner's `MY_EMAIL`). The send-guard hook enforces this.
- Use only the fields a task needs. Personalization uses `first_name`, `group` and `favorite_blend`, nothing else.

## File format (`leads.csv`)
`id,first_name,last_name,email,group,city,favorite_blend,signup_date,orders,consent`

- `id`: `L001`…`L024`, unique
- `group`: exactly one of `curious`, `home-cooks`, `gifters` (matches `campaigns/spice-circle-launch/plan.md`)
- **8 leads per group, 24 in total.** Keep it balanced if you edit it.
- `favorite_blend`: a blend name or `unknown` (personalization must handle `unknown`)
- `orders`: `curious` = 0; `home-cooks` = 2 or more; `gifters` = 1 or more (a gift set)
- `consent`: must be `yes`; any row without it is suppressed from every send

## Before committing a change here
Run `npm test`. `tests/leads.test.mjs` checks every rule above, so you don't check them by eye.

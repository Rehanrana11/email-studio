# Client two: Rise & Crumb (lab step 14)

A second, made-up client used to prove that `studio-kit` carries tools, not a brand. Everything brand-specific
(voice, leads, email rules, offer, footer, link) lives here; nothing in `studio-kit/` names either client.
`tests/portability.test.mjs` checks this on every `npm test`.

## Run it as its own client
The lab keeps each client in its own repository. To do that:

```bash
cp -r examples/client-two ../client-two
cd ../client-two && git init && git add -A && git commit -m "feat: Rise & Crumb studio"
claude --plugin-dir ../email-studio/studio-kit
```

Then, in Claude Code (keep `npm run emulator` running in the email-studio folder):
1. `/studio-kit:personalize campaigns/spring-bake`: one version per group in `leads/leads.csv`.
2. Ask it to send `campaigns/spring-bake/emails/01-hello.md` to the first lead. The kit's guard must block it.
3. Lint: `node ../email-studio/studio-kit/scripts/lint-emails.mjs --config studio.config.json`.

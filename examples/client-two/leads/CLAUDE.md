# leads/ — folder rules

These rules load only when Claude works with files in `leads/`.

- Every person in `leads.csv` is **made up**. Never add a real person or a real email address.
- Every email address must end in `@example.com` (reserved by RFC 2606; it can never receive mail). Never change them.
- Every row needs a `consent` value.
- Never send email to an address from this file. Practice sends go only to `*@resend.dev` or the owner's `MY_EMAIL`;
  the studio-kit send guard enforces this.

## Groups
- `weekend-bakers`: bake at home on weekends; want recipes, techniques and the spring baking class.
- `coffee-lovers`: come in for coffee; want what pairs with their cup and the new spring pastries.

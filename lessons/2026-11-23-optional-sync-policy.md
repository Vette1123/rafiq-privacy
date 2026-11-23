# Policy for optional Cloud sync and a delete-account page

**What.** The policy now says Rafiq needs no account, and describes the optional supporter
Cloud sync (email, name, app-data copy on Cloudflare D1, RevenueCat status, Google/Apple
sign-in, retention until deletion). New `delete-account.html`, both languages, linked from
the policy.

**Mistakes.** The old text said "no accounts, no server" in about twenty places (meta,
glance tiles, sections 2, 10, 13, 14, 16). Fixing only section 2 would have left the page
contradicting itself, so every hit was grepped. A new page also has to be added to
`PAGES` in `build-pages.mjs`, or `--check` never covers its partials.

**What worked.** Section numbers and anchors kept as they were, so deep links still land.
Claims about encryption are limited to what is true: encrypted in transit, not end-to-end.

**Rules.** When a product claim changes, grep the claim, not the section. Add a new page to
`build-pages.mjs` in the same commit.

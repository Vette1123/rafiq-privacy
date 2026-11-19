# Pageviews go to PostHog, not Vercel

## What
`partials/head.html` sent visits to Vercel Web Analytics through `/_vercel/insights/script.js`. The site left Vercel for Cloudflare, so the script 404'd on every page: a console error (PageSpeed Best Practices 96) and no visits recorded. The head now sends one cookieless `$pageview` beacon to `https://www.mohamedgado.com/ingest/e`, the portfolio's PostHog EU ingest. The policy, footer and README say PostHog.

## Mistakes
Nothing watched the analytics script after the host moved; the 404 sat in every page's console until PageSpeed flagged it. The old test pinned the script's URL, so it passed while the URL was dead.

## What worked
The beacon test runs the head script in `vm` and asserts the request body, the host gate, the opt-out and the canonical URL.

## Rules
- Moving a host means grepping the repo for that host's paths (`_vercel`) and the policy text naming it.
- The beacon goes to the absolute www URL; `/ingest/e` on the app subdomain answers 301 and a beacon never follows it.

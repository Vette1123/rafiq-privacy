# Breadcrumb trail on the Rafiq policy page

## What
The policy page gets a visible Rafiq > Privacy policy trail in both languages and a matching BreadcrumbList. The parent is `/projects/rafiq/go`, as on Masareef. Pinned by a test in `scripts/partials.test.mjs`.

## Mistakes
- The first SEO subagent called the Rafiq canonical broken. It had read a stale checkout 33 commits behind (`Personal/Next/rafiq-privacy`). The live repo was fine. The gap that actually existed was the missing BreadcrumbList, and only a scan of all 100 sitemap URLs found it.
- My one-off edit script wrote `\\s` in a quoted heredoc. The tool collapsed it to `\s`, and inside a template literal that is a plain `s`, so the regex matched nothing. `String.raw` fixed it.

## What worked
- Copying the page that already does it: masareef-privacy's policy page has the same trail, the same JSON-LD block and the same `.crumbs` CSS (already in the shared theme).
- The test reads the real page and pins the JSON-LD names to the first visible trail, so the two cannot drift apart.

## Rules
- A trail's JSON-LD names match the page's default language: the first trail on the page.
- Scan every sitemap URL for structured data before calling a site done; a sample misses the odd page out.

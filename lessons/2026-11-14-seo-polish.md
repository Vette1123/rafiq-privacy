# SEO polish: sibling links, one SEO check

## What

Footer "More apps" now links `masareef.mohamedgado.com/?s=rafiq-site` and `nafis.mohamedgado.com/?s=rafiq-site`
(both 200) with accurate captions in both languages, instead of the portfolio `/go` pages. 55 pages
carried the old links. Added `scripts/seo-check.mjs` (titles, descriptions, canonical, hreflang
reciprocity, OG/Twitter, JSON-LD parse + type per page kind, alt and dimensions on images, favicon,
internal links, old email, sibling-link rule) with a test, and `build-pages.mjs` now also refreshes the
generated `features/` and `reciters/` footers. 404 and the Threads callback gained `dir="ltr"`.

## Mistakes

- The `/go` links were in 55 generated pages, not just the partials; editing the partial alone would
  have left them stale. The page builder only listed two pages, so it had to learn the generated ones.
- A first heredoc write of the check script silently failed in the shell; used the file tool instead.
- A sed on the Arabic caption ate the closing `</a>`; the check would not catch it, a visual diff did.

## What worked

- The audit was already mostly clean (titles, descriptions, OG, JSON-LD, hreflang), so the check pins
  that state rather than fixing it.
- sitemap.xml stays empty on purpose: canonicals are on mohamedgado.com, and a sitemap may only list
  URLs of its own host. That sitemap lives in the portfolio repo.

## Rules

- A footer change means `node scripts/build-pages.mjs` as well as `build-go.mjs`; commit the regenerated pages.
- Sibling apps are linked by their own short domain root with `?s=rafiq-site`, never `/go`, never github.io.
- Run `node --test scripts/` before pushing.

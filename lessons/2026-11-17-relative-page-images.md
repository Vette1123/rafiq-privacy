# Reciter and feature pages load images from the host that served them

## What

The 42 reciter pages and 7 feature pages are served on www (proxied, canonical) and on the
github.io copy that crawlers read. Their `src`/`srcset` pointed at absolute
`https://www.mohamedgado.com/projects/rafiq/go-img/` URLs, so every crawl of a github.io copy
was a billed Vercel CDN request (Rafiq's go-img was about 1K requests per 12 hours on 17 Nov;
portfolio-v1 as a whole was near the Hobby 1M cap).

`localImages(html, file)` in `scripts/partials.mjs` rewrites them to `../go-img/`. Both writers
call it: `scripts/build-pages.mjs` here and `pnpm site:pages` in the rafiq app. Same fix as
masareef-privacy's `2026-11-17-relative-page-images.md`.

## Mistakes

- None new: the Masareef recipe applied as-is. Rafiq has no `en/` subdirectory, so depth is
  always one level.
- `node --test scripts/*.test.mjs` run from another cwd fails seo-check and footer tests
  (they read repo-relative paths); run it with the repo as cwd.

## What worked

- Test first (red on the missing export), then one function wired into both writers.
- `build-pages.mjs --check` agreeing with `pnpm site:pages` proves both writers apply it.

## Rules

- HTML served from two hosts gets relative asset URLs; absolute only for meta, JSON-LD, links.
- Index pages stay absolute: www serves them without the trailing slash.

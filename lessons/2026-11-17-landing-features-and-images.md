# Landing page: newer features, and every image on www

## What

- The "more inside" list now names du'a search and sharing a verse as an image or a video with
  its recitation. That list also feeds the JSON-LD `featureList`, which before carried only the
  five headline features.
- The touch icon, the schema image and `og:image` now load from
  `www.mohamedgado.com/projects/rafiq/go-img/` instead of github.io. The touch icon is a 180px
  PNG (13 KB, down from the 270 KB 512px `icon.png`) and the schema icon a 66 KB palette PNG.
- The nav test now accepts the gold/ink mix that this morning's a11y fix shipped.

## Mistakes

- I put الأذان into the /ar title, and `seo-check` refused it at 62 characters (the limit is 60).
  The title stays as it was; الأذان is still in the description.
- The partials test had been red since the a11y commit 4af3aaa, which changed the CSS without
  running `node --test scripts/*.test.mjs`. Run the tests after any `partials/` edit, even a
  colour change.

## Rules

- Image URLs in markup point at www `go-img/`, never github.io.
- A feature shipped in the app gets a line in `more` in both languages in the same week.

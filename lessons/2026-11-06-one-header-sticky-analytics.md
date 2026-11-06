# Rafiq site: one header, one remembered language, sticky header, visits counted

## What

Ported masareef-privacy's `6a8bd12` and `a86dfd7`. `partials/header.html` is the only header (EN and AR
brand and tabs, theme button, English · العربية pill) and sits directly in `<body>` on go, go-ar, the
policy and the 404. `SITE` in `scripts/partials.mjs` lists what every page must carry. `lang-pick.js`
(head) and `lang.js` (pill) share one key, `rafiq-privacy-lang`; go and go-ar are swapped through
`<html data-alt>`, and the old `go-lang` is still read. `header.js` hides the header going down and
brings it back going up. `head.html` loads Vercel Web Analytics on `mohamedgado.com` only, with `?s=`
passed on as `utm_source`. The policy (sections 1 and 10, third-party table, page footer, EN and AR),
the README and the footers no longer claim "no analytics". Rafiq keeps its navy and gold tokens.

## Mistakes

- Rafiq's `theme.css` was Masareef's pre-`6a8bd12` file, so most of the CSS port was a patch, not a copy.
  A blind file copy would have wiped the gold tokens and the 44px tap-target rules; each rule was applied
  by hand against an exact string, and the script throws on a missing anchor.
- The existing tap-target test read `.switch button` from `doc.css`; that rule moved to `theme.css`, so the
  test failed until it pointed at the new home.
- Shell heredocs with apostrophes inside broke the tool's quoting twice; scripts and tests were written as
  files instead.

## What worked

Real-browser check with CDP device metrics at 390 wide: `scrollWidth` 390 on go, go-ar and the policy in EN
and AR, dark and light, the same header on every page, no band at the top, and the 7-step scroll test on
`/index.html` and `/go`. The new tests were run against the old pages: 8 red, all green with the port.

## Rules

- The header is a direct child of `<body>`; a sticky header inside a header-only `.wrap` does nothing.
- Never write "no analytics" on a page that loads any: policy, footer and README change in the same commit
  as `head.html`.
- A language key is written in one place (`lang.js`) and read in one place (`lang-pick.js`); a test fails if
  a page carries its own copy.

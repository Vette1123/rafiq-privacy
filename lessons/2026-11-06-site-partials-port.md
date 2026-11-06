# Rafiq site: Masareef's partials, nav and footer ported

## What

Every page (go, go-ar, privacy, 404) now shares `partials/` (theme.css, head.html with the pre-paint
theme script, switch.js, doc.css, topnav and footer in EN and AR) filled in by `scripts/partials.mjs`.
`build-go.mjs` and the new `build-pages.mjs` both have `--check`. Rafiq keeps its own navy and gold
tokens and serif display type; only the structure came from Masareef. The privacy page gained a top
bar, nav, theme toggle and the rich footer; its legal text is untouched (visible text diffed before
and after: only nav and footer words were added).

## Mistakes

- Screenshots at `--window-size=390` lied: headless Chrome has a minimum window width, so the page laid
  out wider than 390 and looked clipped. Real 360/390 checks need the page in an iframe of that width.
- A 3200px-tall window made the desktop hero (`min-height: 100svh`) 3200px tall; the page looked
  broken and was not. Shoot desktop at a real height and scroll.
- `--blink-settings=preferredColorScheme` did nothing here; the pre-paint script reads `localStorage`,
  so the iframe wrapper sets `go-theme` first, which is also how light and dark were really tested.
- First overflow report was noise: the iframe's own scrollbar makes `100vw` full-bleed bands 8px wider.
- Masareef's footer has six columns; Rafiq has three real groups. Copying the grid as is would have left
  empty columns, so the footer grid is 3 wide.

## What worked

Copying `partials.mjs` and its test as they are, then swapping tokens (`--teal` to `--gold`) with sed
and editing display weights by hand. Marking the current page from the canonical, never by hand.

## Rules

- Glow layers fade before their box edge (mask); no fog behind text heroes (the privacy head has none).
- RTL check marks use physical `border-left`, not `border-inline-*`.
- Tap targets 44px; at 360px the top bar is brand + theme + language on one row, nav on the next.
- Page CSS edited with Edit or sed on the file, never inside a JS template string.

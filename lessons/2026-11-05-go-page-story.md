# The install page tells the app's story

## What

/go and /go-ar got the Masareef install page's layout: a hero where an adhan alert arrives
and turns into the next-prayer card, four facts, "how it works" for prayer times, a row per
feature with its phone shot, a "more inside" list, a no-ads band, FAQ, closing badges. Navy
and gold, light and dark with a switch, a scroll cue, and the hero fits the first screen on
desktop. Canonical moved to www.mohamedgado.com/projects/rafiq/ (go, go-ar and the policy),
listed in the portfolio's sitemap; this repo's sitemap is empty. The shots come from
`pnpm site:go-art` in the app repo.

## Mistakes

The phone rule `.demo img` also caught the icon inside the alert card and pushed it out of
line. Scope phone rules to `.demo picture img`.

## What worked

Porting the Masareef template and build script as they are, then swapping tokens, copy and
the demo. The `?to=` deep link and the `?s=`/`?m=` attribution survive from the old page:
"Open in Rafiq" goes first in the hero's badge row and is tried once on a phone.

## Rules

No FAQPage JSON-LD, no aggregateRating. No filter, mask, clip or backdrop-filter on or over
the phone shots (Chrome paints a pale box). Each radial gradient ends inside its own box.
Check 320 to 2560 wide for sideways scroll and 861x560 up for the first-screen fit.

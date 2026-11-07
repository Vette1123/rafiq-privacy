# 2026-11-07 · Social links in the footer, profiles in sameAs

## What

Every page's footer gained a "Follow, join or message us" row: Instagram, Facebook Page, the
Facebook community group, Messenger, Telegram, TikTok, X and LinkedIn, the channels the app links
(lib/store/links.ts, community.ts). JSON-LD lists the brand profiles on the `MobileApplication`
node and the owner's on `Person` (`sameAs`); the head partial carries `twitter:creator`.
`scripts/social.mjs` is the one list, tested against both footers and every indexable page.
Ported from masareef-privacy (same day, commit 565ea5a).

## Mistakes

- Took masareef's one-row rule as is. Eight tiles squeezed into a 320px phone come out at 30px:
  legal, but small under a thumb. A phone now gets two even rows of four at the full 44px.

## What worked

- The Facebook group and Messenger are places to talk, not profiles of the app, so they are in
  the footer but not in `sameAs`.

## Rules

- Before a row of N tiles ships, check N × size + gaps against the narrowest column. If they don't
  fit, use even rows at full size, never one lone tile or shrunken tiles.

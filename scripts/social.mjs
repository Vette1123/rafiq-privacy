// Every place a reader can follow, join or message Rafiq: the same channels the app links
// (rafiq lib/store/links.ts and community.ts, 2026-10-17). The footer icons and every page's
// JSON-LD `sameAs` are checked against this list (scripts/partials.test.mjs), so a new channel
// goes here first. Profile URLs, not the app's chat deep links: a web visitor wants the page,
// and search engines only tie an entity to a profile.
//
// `who`: 'app' is a Rafiq brand profile (MobileApplication sameAs), 'owner' is Mohamed Gado's
// own (Person sameAs), 'chat' is a place to talk that is not a profile (no sameAs).
export const SOCIAL = [
  { key: 'instagram', who: 'app', url: 'https://www.instagram.com/rafiq.global/' },
  { key: 'facebook', who: 'app', url: 'https://www.facebook.com/rafiq.global' },
  { key: 'group', who: 'chat', url: 'https://www.facebook.com/groups/rafiqapp' },
  { key: 'messenger', who: 'chat', url: 'https://m.me/rafiq.global' },
  { key: 'telegram', who: 'app', url: 'https://t.me/rafiqcompanion' },
  { key: 'tiktok', who: 'owner', url: 'https://www.tiktok.com/@vetteop' },
  { key: 'x', who: 'owner', url: 'https://x.com/Sadge1996' },
  { key: 'linkedin', who: 'owner', url: 'https://www.linkedin.com/in/mgado' },
  // Mohamed Gado's portfolio: the site these pages live on. Not a profile, so no sameAs.
  { key: 'portfolio', who: 'site', url: 'https://www.mohamedgado.com/' },
];

const STORES = ['https://apps.apple.com/app/id6806678979', 'https://play.google.com/store/apps/details?id=com.mohamedgado.rafiq'];
export const APP_SAME_AS = [...STORES, ...SOCIAL.filter((s) => s.who === 'app').map((s) => s.url)];
export const PERSON_SAME_AS = SOCIAL.filter((s) => s.who === 'owner').map((s) => s.url);

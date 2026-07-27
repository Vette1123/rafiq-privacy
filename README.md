# rafiq-privacy

The published privacy policy for **Rafiq (رفيق)**, the Islamic companion app
(`com.mohamedgado.rafiq`).

**Live policy:** https://vette1123.github.io/rafiq-privacy/

The URL is referenced from the Google Play listing and Data safety form, and from inside
the app (`Settings, Privacy policy`), so it must always resolve.

## What Rafiq is

Prayer times and adhan reminders, qibla, the Qur'an with recitation and word-by-word
timings, adhkar and tasbih, duas and the names of Allah, the Hijri calendar, audio
collections, a prayer tracker, home-screen widgets, quick actions, and share cards.

No accounts, no ads, no backend of ours. Everything personal (settings, bookmarks,
progress, counters, prayer tracker, audio history, coordinates) stays on the device.
Content comes from public Islamic and map APIs that the device calls directly.

## What lives in this repo

| File | Purpose |
|---|---|
| `index.html` | The policy. Arabic and English, both in the DOM, one visible at a time |
| `404.html` | Meta-refresh to the policy, so no old or mistyped link dead-ends |
| `robots.txt` | Allow all, points at the sitemap |
| `sitemap.xml` | The one real page |

There is no account-deletion page, and Play does not require one: the app has no accounts
and we hold no copy of anyone's data. Deletion is covered by section 14 of the policy
(uninstall, or clear app storage).

## Why a separate repo

A privacy policy has to be reachable permanently and fixable in seconds without shipping
an app build, so it lives here, served free by GitHub Pages, with the git history as its
change log.

## How the page works

- **Self-contained.** No web fonts, no CDN, no scripts from other hosts, no cookies, no
  analytics. A privacy page should not be the thing that tracks you.
- **Bilingual, both in the DOM.** Arabic and English ship in the same document, so
  crawlers and reader modes see the full policy in both languages. The toggle only flips
  visibility plus `lang` and `dir`, and stores the choice in `localStorage`
  (`rafiq-privacy-lang`).
- **Language resolution order:** an `#en-*` or `#ar-*` section anchor wins, then the
  stored choice, then the browser language, then English.
- **Light and dark** via `prefers-color-scheme`, using the app's deep-green and gold
  tokens.
- **Print styles** so "save as PDF" produces a plain document with URLs spelled out.
- **JSON-LD** `PrivacyPolicy` block for search engines.

## What the policy covers

Sections 1 to 19: scope, the no-accounts and no-server posture, on-device data, location
and prayer times, qibla and sensors, Qur'an text and fonts and translations, recitation
and audio collections, notifications and exact alarms and widgets, share cards and QR,
analytics and crash reporting, updates and rating, the Android permission table,
security, retention and deletion, rights, children, third parties, changes, contact.

### Outbound hosts disclosed (keep this in sync with the app)

| Host | Why |
|---|---|
| `api.aladhan.com` | Prayer times and the monthly prayer / Hijri calendar |
| `api.bigdatacloud.net` | Reverse geocoding coordinates into a city name |
| `geocoding-api.open-meteo.com` | City search by typed name |
| `api.alquran.cloud` | Qur'an translations |
| `api.quran.com` | Word-by-word recitation timings |
| `verses.quran.foundation` | Mushaf page fonts, downloaded per page and cached |
| `cdn.islamic.network`, `everyayah.com` | Per-ayah recitation audio |
| `archive.org` | Audio collections and cover artwork |
| `eu.i.posthog.com` | Usage analytics and error tracking, EU region |
| `u.expo.dev` and EAS | Over-the-air updates, Insights, Observe |
| `play.google.com` | Store listing, in-app updates, rating dialog |

Prayer times are also computed on device with the `adhan` library, which is what keeps the
app and its widgets correct offline.

### Permissions disclosed

The table in section 12 matches the merged release manifest: coarse and fine location,
notifications, exact alarms (`USE_EXACT_ALARM`, plus `SCHEDULE_EXACT_ALARM` up to API 31),
foreground service and media playback, modify audio settings, internet plus network and
Wi-Fi state, vibrate, wake lock, receive boot completed, legacy read/write storage (max SDK
32), and the launcher badge permissions. `SYSTEM_ALERT_WINDOW` is also declared and is
documented as unused. The policy states what is absent too: microphone, camera, contacts,
SMS, call logs, photo library, installed-app list, activity recognition, and background
location. `RECORD_AUDIO` and `ACTIVITY_RECOGNITION` are blocked in `app.json`.

## Maintaining it

There is no build step. Edit the HTML, commit, push. GitHub Pages serves `main`.

When the app changes, the policy changes in the same session as the feature, not later:

1. A new outbound host, SDK or third party goes into the section 17 table plus the table
   above.
2. A new permission goes into section 12, in both languages.
3. A new on-device store goes into section 3.
4. Bump the `Last updated` date and the covered app version in both language blocks, the
   `dateModified` in the JSON-LD, and `lastmod` in `sitemap.xml`.

## Google Play

- Privacy policy URL: `https://vette1123.github.io/rafiq-privacy/`
- Data deletion URL: not applicable, no accounts

Data Safety should declare: approximate and precise location collected for app
functionality and not stored on a server, app activity and diagnostics collected for
analytics and crash reporting tied to a random per-install id, and no data shared with
third parties for advertising. All traffic is over TLS.

## Contact

boogado@yahoo.com

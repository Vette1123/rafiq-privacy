# Rafiq — Privacy Policy

This repository hosts the privacy policy for **Rafiq (رفيق)**, a private Islamic
companion app for prayer times, qibla direction, the Qur'an, and adhkar.

📄 **Live policy:** https://vette1123.github.io/rafiq-privacy/

It is a single static page (`index.html`) served via **GitHub Pages**, and is the URL
referenced in the app's Google Play Store listing and Data safety form.

## The short version

Rafiq has **no user accounts, no advertising, no analytics, and no tracking**. There are no
Rafiq servers storing your data — every setting, bookmark, and reading position lives **only
on your device**.

The app talks to a few third-party APIs strictly to do its job:

| Service | Purpose | Data sent |
| --- | --- | --- |
| [Aladhan](https://aladhan.com) | Calculate prayer times | Coordinates (if you grant location) |
| [BigDataCloud](https://www.bigdatacloud.com) | Turn coordinates into a city name | Coordinates (if you grant location) |
| [AlQuran Cloud / Islamic Network](https://alquran.cloud) | Qur'an text & recitation audio | No personal data |

Coordinates are used only to fulfil the request — never stored by Rafiq, never linked to your
identity, never used for advertising. Prayer-time notifications are scheduled and delivered
entirely on-device; there are no remote push notifications.

See [`index.html`](./index.html) for the full policy.

## About the app

Rafiq is built with Expo + React Native + TypeScript — offline-first, quiet, and private by
design.

## Contact

Questions about this policy: **boogado@yahoo.com**

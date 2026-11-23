# The deploy check stops spending the Worker's daily quota

## What

On 22 Nov, rafiq-cdn served 14,138 requests, including 314 CPU kills. On 23 Nov it served 4,248, and 99% of those came from our own scripts (UA `node`), not from phones. `cdn/verify.mjs` read all 490 audio files through the Worker on every push and on the weekly run, once whole and once by range: about 1,000 metered requests per run, with whole reads of the 57 MB surahs going over the 10 ms CPU budget.

Now:

- Static files (fonts, config, the `/_parts/` parts) are all still checked byte for byte. They cost no Worker requests.
- `stage.mjs` writes `/_parts/hashes.json`, a static file with the SHA-256 of every audio file. CI saves the live copy before deploying (`prev-hashes.json`).
- verify then reads through the Worker only the audio files whose hash changed, plus 5 sampled files. The sample rotates by date.
- Split files are read whole from their static parts, never through the Worker.

A run with nothing changed went from about 1,000 Worker requests to 9.

## Mistakes

- I assumed the CPU kills and the request count came from phones. A user-agent tally showed that 3,928 of 4,251 events were `node` and only 8 were `okhttp`. Next time, tally by user agent before tuning the Worker.
- The check was written to prove every byte on every deploy. Assets are stored by content hash, so an unchanged file is the same asset as last time and proving it again proves nothing.
- The docstring promised "the largest file" in the sample, but the code never added it. I caught that before the commit.

## What worked

- `workerChecks()` is a pure exported function, so `cdn/verify.test.mjs` pins it. With the old "return every path" behaviour put back, it goes red (2 fail), and the same happens with the changed-files rule removed.
- Reading the workersInvocationsAdaptive GraphQL per script per day showed the 100k/day counter directly.

## Rules

- A check of our own CDN reads static assets wherever it can. Anything under `run_worker_first` is metered, so only what changed goes through it.
- Before deciding the CDN is under load, split its traffic by user agent.

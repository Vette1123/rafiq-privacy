#!/usr/bin/env node
// Prove the CDN serves what cdn/stage.mjs staged, while spending as little as possible
// of the Worker's 100,000 requests a day.
//
// Static files (fonts/, config.json, the /_parts/ manifests and parts) cost nothing to
// read, so every one of them is checked byte for byte. Audio answers through the
// metered Worker, so it is checked where it can have changed:
//
//   - the live /_parts/hashes.json must equal the hashes of the files on disk, which
//     proves the new version is the one answering, with these bytes recorded;
//   - every audio file whose bytes differ from the copy that was live BEFORE the deploy
//     (`--since <file>`), or that is new, is read through the Worker;
//   - a small sample, rotated by date, is read through the Worker on every run, so the
//     Worker's own code (ranges, parts, headers) is exercised even when nothing changed.
//
// A file read through the Worker is checked by a range from its middle (a player's
// seek, which must answer 206 with exactly those bytes). A small file is also read
// whole; a split one is read whole from its static parts instead, because a whole read
// through the Worker costs ~0.3 ms of CPU a MB (the 57 MB al-Baqarah is ~17 ms, over the
// free plan's 10 ms). Unchanged files were proven when they were deployed: assets are
// stored by content hash, so the same bytes are the same asset.
//
// Until 2026-11-23 this read every audio file whole AND by range on every deploy,
// ~1,000 Worker requests a run and the 314 CPU kills of 22 Nov.
//
//   node cdn/verify.mjs --since prev-hashes.json  # CI: changed files + the sample
//   node cdn/verify.mjs                          # the sample only
//   node cdn/verify.mjs --all                    # every audio file (~1,000 requests)
//   node cdn/verify.mjs --base <url> --tries 6 --recitations <dir>

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { AUDIO, HASHES, PART, partPath } from './parts.mjs';
import { sources } from './stage.mjs';

/** Audio files read through the Worker on every run, whatever changed. */
export const SAMPLE = 6;

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const isAudio = (path) => AUDIO.includes(path.split('/')[0]);

/**
 * Which audio files go through the Worker this run: the changed or new ones, plus a
 * date-rotated sample.
 * `live` null means no previous copy is known.
 */
export function workerChecks(hashes, live, { all = false, day = new Date().toISOString().slice(0, 10) } = {}) {
  const paths = Object.keys(hashes).sort();
  if (all) return paths;
  const picked = new Set(live ? paths.filter((p) => live[p] !== hashes[p]) : []);
  const seed = Number.parseInt(sha(day).slice(0, 8), 16);
  for (let i = 0; i < SAMPLE - 1 && i < paths.length; i++) picked.add(paths[(seed + i * 7919) % paths.length]);
  return [...picked];
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
  const BASE = flag('base', 'https://rafiq-cdn.boogado.workers.dev').replace(/\/$/, '');
  const TRIES = Number(flag('tries', '3'));
  const since = flag('since', null);
  const CONCURRENCY = 8;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // no-cache: ask the edge for the deployed version, not a copy from before it.
  const get = (path, headers = {}) =>
    fetch(`${BASE}/${path.replace(/^\//, '')}`, { headers: { 'cache-control': 'no-cache', ...headers } });
  let workerRequests = 0;

  const files = sources(args);
  const bodies = new Map(files.map((f) => [f.path, f.file]));
  const body = (path) => readFileSync(bodies.get(path));
  const hashes = Object.fromEntries(files.filter((f) => isAudio(f.path)).map((f) => [`/${f.path}`, sha(body(f.path))]));

  /** Whole bytes of a static file. */
  async function staticBytes(path) {
    const res = await get(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** null when it checks out, else why not. */
  async function checkStatic(path) {
    return sha(await staticBytes(path)) === sha(body(path)) ? null : 'bytes differ';
  }

  async function checkAudio(path) {
    const bytes = body(path);
    if (bytes.length > PART) {
      const parts = [];
      for (let i = 0; i * PART < bytes.length; i++) parts.push(await staticBytes(partPath(`/${path}`, i)));
      if (sha(Buffer.concat(parts)) !== sha(bytes)) return 'parts differ';
    } else {
      workerRequests += 1;
      const res = await get(path);
      if (!res.ok) return `HTTP ${res.status}`;
      if (sha(Buffer.from(await res.arrayBuffer())) !== sha(bytes)) return 'bytes differ';
    }
    const from = Math.floor(bytes.length / 3);
    const to = Math.min(from + 99_999, bytes.length - 1);
    workerRequests += 1;
    const part = await get(path, { range: `bytes=${from}-${to}` });
    const slice = Buffer.from(await part.arrayBuffer());
    if (part.status === 206 && sha(slice) === sha(bytes.subarray(from, to + 1))) return null;
    return `range ${from}-${to}: HTTP ${part.status}, ${slice.length} bytes`;
  }

  async function withTries(path, fn) {
    let last = '';
    for (let i = 0; i < TRIES; i++) {
      if (i) await sleep(2000 * i);
      try {
        last = await fn(path);
        if (last === null) return null;
      } catch (e) {
        last = String(e.cause?.code ?? e.message);
      }
    }
    return `${path}: ${last}`;
  }

  async function pool(paths, fn) {
    const failures = [];
    const queue = [...paths];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let p; (p = queue.shift()); ) {
          const bad = await withTries(p, fn);
          if (bad) failures.push(bad);
        }
      })
    );
    return failures;
  }

  // 1. The new version is the one answering: its hash manifest is ours.
  const liveNow = await withTries(HASHES, async () => {
    const res = await get(HASHES);
    if (!res.ok) return `HTTP ${res.status}`;
    const got = await res.json();
    const off = Object.keys(hashes).filter((p) => got[p] !== hashes[p]);
    return off.length ? `${off.length} hashes differ (${off.slice(0, 3).join(', ')})` : null;
  });

  // 2. Every static file, free.
  const staticPaths = files.map((f) => f.path).filter((p) => !isAudio(p));
  const staticFailures = await pool(staticPaths, checkStatic);

  // 3. Audio through the Worker: what changed, plus the sample.
  const before = since && existsSync(since) ? JSON.parse(readFileSync(since, 'utf8') || 'null') : null;
  const prev = before && Object.keys(before).length ? before : null;
  if (since && !prev) console.log(`${since}: no previous copy, so every audio file is new`);
  const toCheck = workerChecks(hashes, since ? (prev ?? {}) : null, { all: args.includes('--all') });
  const audioFailures = await pool(
    toCheck.map((p) => p.slice(1)),
    checkAudio
  );

  const failures = [...(liveNow ? [liveNow] : []), ...staticFailures, ...audioFailures];
  console.log(
    `${BASE}: ${staticPaths.length} static files and ${toCheck.length}/${Object.keys(hashes).length} audio files ` +
      `checked, ${workerRequests} Worker requests`
  );
  if (failures.length) {
    console.error(`${failures.length} failed:\n  ${failures.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }
}

if (import.meta.main ?? process.argv[1]?.endsWith('verify.mjs')) await main();

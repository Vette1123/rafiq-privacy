#!/usr/bin/env node
// Prove the CDN serves every file cdn/stage.mjs stages, byte for byte.
//
// Downloads each file (audio/, fonts/, recitations/) from the Worker and compares its
// SHA-256 with the file on disk; for audio it also asks for a byte range from the
// middle, as a player does when it seeks, and wants a 206 with exactly those bytes.
// A deploy that left a file behind, a stale edge copy, a host answering 200 with an
// HTML page, or a Worker that loses Range all fail here, with the count and the
// first paths in the message.
//
//   node cdn/verify.mjs                      # https://rafiq-cdn.boogado.workers.dev
//   node cdn/verify.mjs --base <url>         # another host serving the same tree
//   node cdn/verify.mjs --tries 6            # retries per file, for a fresh deploy
//   node cdn/verify.mjs --recitations <dir>  # where rafiq-recitations is checked out
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { AUDIO } from './parts.mjs';
import { sources } from './stage.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = flag('base', 'https://rafiq-cdn.boogado.workers.dev').replace(/\/$/, '');
const TRIES = Number(flag('tries', '3'));
const CONCURRENCY = 16;

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// no-cache: ask the edge for the deployed version, not a copy from before it.
const get = (path, headers = {}) =>
  fetch(`${BASE}/${path}`, { headers: { 'cache-control': 'no-cache', ...headers } });

/** null when the file checks out, else why it does not. */
async function once(path, body) {
  const res = await get(path);
  if (!res.ok) return `HTTP ${res.status}`;
  if (sha(Buffer.from(await res.arrayBuffer())) !== sha(body)) return 'bytes differ';
  if (!AUDIO.includes(path.split('/')[0])) return null;
  const from = Math.floor(body.length / 3);
  const to = Math.min(from + 99_999, body.length - 1);
  const part = await get(path, { range: `bytes=${from}-${to}` });
  const slice = Buffer.from(await part.arrayBuffer());
  if (part.status === 206 && sha(slice) === sha(body.subarray(from, to + 1))) return null;
  return `range ${from}-${to}: HTTP ${part.status}, ${slice.length} bytes`;
}

async function check({ path, file }) {
  const body = readFileSync(file);
  let last = '';
  for (let i = 0; i < TRIES; i++) {
    if (i) await sleep(2000 * i);
    try {
      last = await once(path, body);
      if (last === null) return null;
    } catch (e) {
      last = String(e.cause?.code ?? e.message);
    }
  }
  return `${path}: ${last}`;
}

const files = sources(args);
const failures = [];
let done = 0;
const queue = [...files];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let f; (f = queue.shift()); ) {
      const bad = await check(f);
      if (bad) failures.push(bad);
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${files.length}`);
    }
  })
);

console.log(`${BASE}: ${files.length - failures.length}/${files.length} files identical to the source`);
if (failures.length) {
  console.error(`${failures.length} differ:\n  ${failures.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}

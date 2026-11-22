#!/usr/bin/env node
// Prove the CDN serves every file the repo holds, byte for byte.
//
// Downloads each file under audio/ and fonts/ from the Worker and compares its
// SHA-256 with the file in the checkout. A deploy that left one clip behind, a stale
// edge copy, or a host answering 200 with an HTML page all fail here, with the count
// and the first few paths in the message.
//
//   node cdn/verify.mjs                      # https://rafiq-cdn.boogado.workers.dev
//   node cdn/verify.mjs --base <url>         # another host serving the same tree
//   node cdn/verify.mjs --tries 6            # retries per file, for a fresh deploy
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { SERVED, walk } from './stage.mjs';

const ROOT = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = flag('base', 'https://rafiq-cdn.boogado.workers.dev').replace(/\/$/, '');
const TRIES = Number(flag('tries', '3'));
const CONCURRENCY = 16;

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(path) {
  const want = sha(readFileSync(join(ROOT, path)));
  let last = '';
  for (let i = 0; i < TRIES; i++) {
    if (i) await sleep(2000 * i);
    try {
      // no-cache: ask the edge for the deployed version, not a copy from before it.
      const res = await fetch(`${BASE}/${path}`, { headers: { 'cache-control': 'no-cache' } });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        continue;
      }
      const got = sha(Buffer.from(await res.arrayBuffer()));
      if (got === want) return null;
      last = 'bytes differ';
    } catch (e) {
      last = String(e.cause?.code ?? e.message);
    }
  }
  return `${path}: ${last}`;
}

const files = SERVED.flatMap((top) => [...walk(join(ROOT, top))]).map((f) =>
  relative(ROOT, f).split(sep).join('/')
);
const failures = [];
let done = 0;
const queue = [...files];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let p; (p = queue.shift()); ) {
      const bad = await check(p);
      if (bad) failures.push(bad);
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${files.length}`);
    }
  })
);

console.log(`${BASE}: ${files.length - failures.length}/${files.length} files identical to the repo`);
if (failures.length) {
  console.error(`${failures.length} differ:\n  ${failures.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}

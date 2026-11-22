#!/usr/bin/env node
// Stage everything the app downloads into .cdn-dist for the Worker to serve:
//   audio/, fonts/          from this repo
//   recitations/            the .mp3 files of Vette1123/rafiq-recitations
//                           (--recitations <checkout>, default ../rafiq-recitations)
// The site pages are not here: mohamedgado.com serves them. Fails before a deploy
// Cloudflare would refuse.
//
// An audio file over PART bytes is cut into parts under /_parts/ and its size goes in
// MANIFEST, which the Worker reads to stitch it back (cdn/worker.mjs).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { AUDIO, MANIFEST, PART, partPath } from './parts.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, '.cdn-dist');
const MAX_FILES = 20_000; // free plan, per Worker version
const MAX_BYTES = 25 * 1024 * 1024; // per asset, every plan

export function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue; // .git, .nojekyll
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Every served file: its path on the CDN (`audio/…`, no leading slash) and on disk. */
export function sources(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--recitations');
  const rec = at >= 0 ? argv[at + 1] : join(ROOT, '..', 'rafiq-recitations');
  const trees = [
    ['audio', join(ROOT, 'audio'), () => true],
    ['fonts', join(ROOT, 'fonts'), () => true],
    ['recitations', rec, (f) => f.endsWith('.mp3')],
  ];
  return trees.flatMap(([top, dir, keep]) =>
    [...walk(dir)]
      .filter(keep)
      .map((file) => ({ path: `${top}/${relative(dir, file).split(sep).join('/')}`, file }))
  );
}

function put(rel, buf) {
  const dest = join(OUT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

if (import.meta.main ?? process.argv[1]?.endsWith('stage.mjs')) {
  rmSync(OUT, { recursive: true, force: true });
  const list = sources();
  if (!list.some((s) => s.path.startsWith('recitations/'))) {
    throw new Error('no recitations found: pass --recitations <rafiq-recitations checkout>');
  }
  const sizes = {};
  let assets = 0;
  let bytes = 0;
  for (const { path, file } of list) {
    const size = statSync(file).size;
    bytes += size;
    const isAudio = AUDIO.includes(path.split('/')[0]);
    if (isAudio && size > PART) {
      const buf = readFileSync(file);
      for (let i = 0; i * PART < size; i++) {
        put(partPath(`/${path}`, i).slice(1), buf.subarray(i * PART, (i + 1) * PART));
        assets += 1;
      }
      sizes[`/${path}`] = size;
      continue;
    }
    if (size > MAX_BYTES) throw new Error(`${path} is ${size} bytes, over 25 MiB`);
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    copyFileSync(file, join(OUT, path));
    assets += 1;
  }
  if (assets + 2 > MAX_FILES) throw new Error(`${assets} assets, over the ${MAX_FILES} a version allows`);
  // Fonts only: audio answers from the Worker, which sets its own headers.
  writeFileSync(
    join(OUT, '_headers'),
    '/*\n  Cache-Control: public, max-age=86400\n  Access-Control-Allow-Origin: *\n'
  );
  put(MANIFEST.slice(1), JSON.stringify(sizes));
  console.log(
    `staged ${list.length} files (${(bytes / 1048576).toFixed(1)} MB) as ${assets} assets; ` +
      `${Object.keys(sizes).length} split into ${PART / 1048576} MiB parts`
  );
}

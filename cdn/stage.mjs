#!/usr/bin/env node
// Copy what the app downloads (audio/, fonts/) into .cdn-dist for the Worker to serve.
// Only those two folders: the site pages stay on GitHub Pages, where mohamedgado.com
// proxies them. Fails before a deploy that Cloudflare would refuse.
import { cpSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, '.cdn-dist');
export const SERVED = ['audio', 'fonts'];
const MAX_FILES = 20_000; // free plan, per Worker version
const MAX_BYTES = 25 * 1024 * 1024; // per file, every plan

export function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (import.meta.main ?? process.argv[1]?.endsWith('stage.mjs')) {
  rmSync(OUT, { recursive: true, force: true });
  let files = 0;
  let bytes = 0;
  for (const top of SERVED) {
    for (const file of walk(join(ROOT, top))) {
      const size = statSync(file).size;
      if (size > MAX_BYTES) throw new Error(`${relative(ROOT, file)} is ${size} bytes, over 25 MiB`);
      files += 1;
      bytes += size;
    }
    cpSync(join(ROOT, top), join(OUT, top), { recursive: true });
  }
  if (files + 1 > MAX_FILES) throw new Error(`${files} files, over the ${MAX_FILES} a version allows`);
  // The app keeps every file it downloads on disk, so this only governs the edge and
  // any other client. A day, not a year: a clip re-mastered in place under its old
  // name must reach the next phone within a day, not never.
  writeFileSync(
    join(OUT, '_headers'),
    '/*\n  Cache-Control: public, max-age=86400\n  Access-Control-Allow-Origin: *\n'
  );
  console.log(`staged ${files} files, ${(bytes / 1048576).toFixed(1)} MB from ${SERVED.join(', ')}`);
}

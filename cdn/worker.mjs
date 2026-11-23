// Range for audio. Workers static assets answer every request with the whole file,
// and a player needs a byte range: iOS's AVPlayer will not stream without one, and an
// āyah two hours into a surah would mean downloading everything before it. So the
// requests under /audio/ and /recitations/ (wrangler.jsonc, run_worker_first) come
// here; everything else, the fonts included, never runs any code.
//
// Every audio file's size is in the manifest stage writes (MANIFEST). A file over PART
// bytes is stored as parts (cdn/stage.mjs); a smaller one is one asset. Either
// way the response is built from the parts a range covers, so a seek reads at most
// one part it does not send.
import { MANIFEST, PART, partPath } from './parts.mjs';

const HEADERS = {
  'accept-ranges': 'bytes',
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'content-range, content-length, accept-ranges',
  'content-type': 'audio/mpeg',
};

/**
 * A recitation is a fixed recording (new surahs arrive, none is ever re-cut), so it
 * caches for a year. Adhkār clips have been re-mastered in place under their old
 * names, so they keep a day, and the next phone gets the new master.
 */
export function cacheControl(path) {
  return path.startsWith('/recitations/') ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';
}

/** `bytes=a-b`, `bytes=a-`, `bytes=-n` → [start, end] inclusive; null = whole file; 'bad' = 416. */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null; // absent, multi-range, or junk: send it all
  if (m[1] === '') {
    const n = Math.min(Number(m[2]), size);
    return n === 0 ? 'bad' : [size - n, size - 1];
  }
  const start = Number(m[1]);
  if (start >= size) return 'bad';
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  return end < start ? 'bad' : [start, end];
}

/** Skipped bytes land in one reused buffer this size, so memory per request is flat. */
const SCRATCH = 256 * 1024;

/**
 * One BYOB read into `view`, filled completely. On Workers `readAtLeast` fills it in a
 * single native call; elsewhere (Node, the tests) plain `read` loops. BYOB moves the
 * buffer, so the caller keeps `value.buffer` for the next read.
 */
async function fill(reader, view) {
  // Read before the first fill: a BYOB read detaches `view` (its length becomes 0).
  const { byteOffset, byteLength } = view;
  let buf = view.buffer;
  let got = 0;
  while (got < byteLength) {
    const into = new Uint8Array(buf, byteOffset + got, byteLength - got);
    const { value, done } = reader.readAtLeast
      ? await reader.readAtLeast(into.byteLength, into)
      : await reader.read(into);
    if (done || !value) throw new Error(`part ended ${byteLength - got} bytes short`);
    buf = value.buffer;
    got += value.byteLength;
  }
  return new Uint8Array(buf, byteOffset, byteLength);
}

/** Reads and drops `n` bytes through one small buffer. */
async function skip(reader, n) {
  let scratch = new Uint8Array(Math.min(n, SCRATCH));
  while (n > 0) {
    const len = Math.min(n, scratch.buffer.byteLength);
    scratch = await fill(reader, new Uint8Array(scratch.buffer, 0, len));
    n -= len;
  }
}

/**
 * The response body. A FixedLengthStream on Workers: it sends content-length, which a
 * plain stream loses, so a body cut short is an error the player sees instead of a
 * file that looks whole. Node (the tests) has no FixedLengthStream.
 */
function bodyStream(length) {
  return typeof FixedLengthStream === 'function'
    ? new FixedLengthStream(length)
    : new TransformStream();
}

/** The split files' sizes, read once per isolate (a few KB; stage.mjs writes it). */
let sizes;
function sizesOf(env, origin) {
  sizes ??= env.ASSETS.fetch(new Request(new URL(MANIFEST, origin))).then((r) => {
    if (r.status !== 200) throw new Error(`${MANIFEST}: HTTP ${r.status}`);
    return r.json();
  });
  sizes.catch(() => (sizes = undefined)); // a failed read is retried, not kept
  return sizes;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    const asset = (p) => env.ASSETS.fetch(new Request(new URL(p, url.origin)));

    // Every audio file's size comes from the manifest: static assets send no
    // content-length, and a size read from that header was 0 (a 416 for iOS's bytes=0-1).
    const size = (await sizesOf(env, url.origin))[path];
    if (size == null) return asset(path); // not one of ours: the asset layer's 404
    // The pieces this file is stored as: [asset path, bytes], in order.
    const pieces =
      size > PART
        ? Array.from({ length: Math.ceil(size / PART) }, (_, i) => [
            partPath(path, i),
            Math.min(PART, size - i * PART),
          ])
        : [[path, size]];

    const range = parseRange(request.headers.get('range'), size);
    if (range === 'bad') {
      return new Response(null, {
        status: 416,
        headers: { ...HEADERS, 'cache-control': cacheControl(path), 'content-range': `bytes */${size}` },
      });
    }
    const [start, end] = range ?? [0, size - 1];
    const headers = { ...HEADERS, 'cache-control': cacheControl(path), 'content-length': String(end - start + 1) };
    if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
    const status = range ? 206 : 200;
    if (request.method === 'HEAD') return new Response(null, { status, headers });

    // No byte of audio is copied chunk by chunk in JS, and no request holds a whole
    // part in memory. The free plan allows 10 ms of CPU and 128 MB per isolate: a JS
    // TransformStream over a 57 MB surah killed 230 requests (2026-11-22), and a 100 KB
    // window deep in a part spent up to 58 ms (2026-11-23).
    // - A part the range covers whole is piped stream to stream, natively.
    // - An edge part skips its leading bytes through a 256 KB BYOB buffer (native
    //   fills), then pipes the rest natively when the range runs to the part's end
    //   (a player's open `bytes=N-`), or reads exactly the window when it does not.
    const { readable, writable } = bodyStream(end - start + 1);
    (async () => {
      let offset = 0;
      for (const [p, bytes] of pieces) {
        const lo = offset;
        offset += bytes;
        if (offset - 1 < start) continue;
        if (lo > end) break;
        const res = await asset(p);
        if (res.status !== 200) throw new Error(`${p}: HTTP ${res.status}`);
        const from = Math.max(start - lo, 0);
        const to = Math.min(end - lo, bytes - 1);
        const body = res.body;
        const whole = to === bytes - 1;
        const reader = from > 0 || !whole ? body.getReader({ mode: 'byob' }) : null;
        if (from > 0) await skip(reader, from);
        if (!whole) {
          const window = await fill(reader, new Uint8Array(to - from + 1));
          await reader.cancel();
          const w = writable.getWriter();
          await w.write(window);
          w.releaseLock();
          continue;
        }
        reader?.releaseLock();
        await body.pipeTo(writable, { preventClose: true });
      }
      await writable.close();
    })().catch((e) => writable.abort(e).catch(() => {}));
    return new Response(readable, { status, headers });
  },
};

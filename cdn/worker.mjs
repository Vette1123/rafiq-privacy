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

/** Passes bytes [from, to] of a stream through, then stops reading it. */
function slicer(from, to) {
  let at = 0;
  return new TransformStream({
    transform(chunk, out) {
      const lo = Math.max(from - at, 0);
      const hi = Math.min(to - at + 1, chunk.byteLength);
      if (lo < hi) out.enqueue(chunk.subarray(lo, hi));
      at += chunk.byteLength;
      if (at > to) out.terminate(); // cancels the rest of the part
    },
    flush() {
      if (at <= to) throw new Error(`part ended at ${at}, wanted ${to + 1}`);
    },
  });
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

    // A part the range covers whole is piped natively; only the two edge parts run
    // the slicer. The free plan allows 10 ms of CPU a request, and copying a 57 MB
    // surah chunk by chunk in JS spent it.
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
        const body = from === 0 && to === bytes - 1 ? res.body : res.body.pipeThrough(slicer(from, to));
        await body.pipeTo(writable, { preventClose: true });
      }
      await writable.close();
    })().catch((e) => writable.abort(e).catch(() => {}));
    return new Response(readable, { status, headers });
  },
};

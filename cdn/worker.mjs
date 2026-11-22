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
  // A day: a clip re-mastered in place under its old name reaches the next phone.
  'cache-control': 'public, max-age=86400',
  'content-type': 'audio/mpeg',
};

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

/** Bytes [from, to] of `body` into `writer`; the rest of `body` is cancelled. */
async function copySlice(body, writer, from, to) {
  const reader = body.getReader();
  let at = 0;
  try {
    while (at <= to) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`part ended at ${at}, wanted ${to + 1}`);
      const lo = Math.max(from - at, 0);
      const hi = Math.min(to - at + 1, value.byteLength);
      if (lo < hi) await writer.write(value.subarray(lo, hi));
      at += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
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
        headers: { ...HEADERS, 'content-range': `bytes */${size}` },
      });
    }
    const [start, end] = range ?? [0, size - 1];
    const headers = { ...HEADERS, 'content-length': String(end - start + 1) };
    if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
    const status = range ? 206 : 200;
    if (request.method === 'HEAD') return new Response(null, { status, headers });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    (async () => {
      let offset = 0;
      for (const [p, bytes] of pieces) {
        const lo = offset;
        offset += bytes;
        if (offset - 1 < start) continue;
        if (lo > end) break;
        const res = await asset(p);
        if (res.status !== 200) throw new Error(`${p}: HTTP ${res.status}`);
        await copySlice(res.body, writer, Math.max(start - lo, 0), Math.min(end - lo, bytes - 1));
      }
      await writer.close();
    })().catch((e) => writer.abort(e));
    return new Response(readable, { status, headers });
  },
};

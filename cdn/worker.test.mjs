// node --test cdn/worker.test.mjs
// The Worker must turn a file stored whole or in parts into exactly the bytes a player
// asks for. The fake ASSETS ignores Range and sends no content-length, as Cloudflare's
// static assets do: the first deploy read the missing length as 0 and answered iOS's
// opening `bytes=0-1` on every dhikr clip with a 416.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MANIFEST, PART, partPath } from './parts.mjs';
import worker, { parseRange } from './worker.mjs';

const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 251);
const BIG = bytes(PART * 2 + 12345, 1); // three parts, the last one short
const SMALL = bytes(240_000, 7);

const store = new Map([
  ['/audio/hisn/20.mp3', SMALL],
  [MANIFEST, new TextEncoder().encode(JSON.stringify({
        '/recitations/r/002.mp3': BIG.length,
        '/audio/hisn/20.mp3': SMALL.length,
      }))],
]);
for (let i = 0; i * PART < BIG.length; i++) {
  store.set(partPath('/recitations/r/002.mp3', i), BIG.subarray(i * PART, (i + 1) * PART));
}
const fetched = [];
const env = {
  ASSETS: {
    async fetch(req) {
      const path = new URL(req.url).pathname;
      fetched.push(path);
      const body = store.get(path);
      if (!body) return new Response('not found', { status: 404 });
      // Chunked like a network body, to exercise slicing across chunk edges.
      const stream = new ReadableStream({
        start(c) {
          for (let o = 0; o < body.length; o += 65_536) c.enqueue(body.slice(o, o + 65_536));
          c.close();
        },
      });
      return new Response(stream, {
        headers: { 'content-type': 'audio/mpeg' },
      });
    },
  },
};

const get = (path, range, method = 'GET') =>
  worker.fetch(
    new Request(`https://cdn.test${path}`, { method, headers: range ? { range } : {} }),
    env
  );
const body = async (res) => new Uint8Array(await res.arrayBuffer());

test('a split file comes back whole, byte for byte', async () => {
  const res = await get('/recitations/r/002.mp3');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-length'), String(BIG.length));
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(await body(res), BIG);
});

test('a range across a part boundary is a 206 with exactly those bytes', async () => {
  const from = PART - 1000;
  const to = PART + 5000;
  fetched.length = 0;
  const res = await get('/recitations/r/002.mp3', `bytes=${from}-${to}`);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), `bytes ${from}-${to}/${BIG.length}`);
  assert.deepEqual(await body(res), BIG.subarray(from, to + 1));
  // Only the two parts the range touches are read.
  assert.deepEqual(fetched.filter((p) => p.startsWith('/_parts/rec')), [
    partPath('/recitations/r/002.mp3', 0),
    partPath('/recitations/r/002.mp3', 1),
  ]);
});

test('a seek to the end reads only the last part', async () => {
  fetched.length = 0;
  const res = await get('/recitations/r/002.mp3', `bytes=${PART * 2 + 10}-`);
  assert.equal(res.status, 206);
  assert.deepEqual(await body(res), BIG.subarray(PART * 2 + 10));
  assert.deepEqual(fetched.filter((p) => p.startsWith('/_parts/rec')), [
    partPath('/recitations/r/002.mp3', 2),
  ]);
});

test('a small file answers a range too, which iOS needs to stream it', async () => {
  const res = await get('/audio/hisn/20.mp3', 'bytes=0-1');
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), `bytes 0-1/${SMALL.length}`);
  assert.deepEqual(await body(res), SMALL.subarray(0, 2));
  const whole = await get('/audio/hisn/20.mp3');
  assert.equal(whole.status, 200);
  assert.deepEqual(await body(whole), SMALL);
});

test('HEAD gives the size with no body', async () => {
  const res = await get('/recitations/r/002.mp3', undefined, 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-length'), String(BIG.length));
  assert.equal(res.body, null);
});

test('a missing file is a 404 and a range past the end a 416', async () => {
  assert.equal((await get('/audio/nope.mp3')).status, 404);
  const res = await get('/audio/hisn/20.mp3', `bytes=${SMALL.length}-`);
  assert.equal(res.status, 416);
  assert.equal(res.headers.get('content-range'), `bytes */${SMALL.length}`);
});

test('parseRange reads the forms players send', () => {
  assert.deepEqual(parseRange('bytes=0-1', 100), [0, 1]);
  assert.deepEqual(parseRange('bytes=10-', 100), [10, 99]);
  assert.deepEqual(parseRange('bytes=-10', 100), [90, 99]);
  assert.deepEqual(parseRange('bytes=90-500', 100), [90, 99]);
  assert.equal(parseRange(null, 100), null);
  assert.equal(parseRange('bytes=0-1,5-6', 100), null);
  assert.equal(parseRange('bytes=100-', 100), 'bad');
  assert.equal(parseRange('bytes=5-2', 100), 'bad');
});

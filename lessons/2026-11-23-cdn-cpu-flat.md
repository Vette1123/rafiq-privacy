# The CDN Worker never copies audio in JS

**What.** rafiq-cdn had 230 requests killed for CPU (`exceededResources`) on
2026-11-22, all in the 04:00 UTC hour, before the "pipe whole parts natively" fix
landed. A verify run on 2026-11-23 still showed 20-58 ms for 100 KB windows deep
inside a part. The edge part ran through a JS `TransformStream` that read every
byte before the window. Edge parts now skip their leading bytes with BYOB
`readAtLeast` into one reused 256 KB buffer. An open range (`bytes=N-`) then pipes
the rest natively, and a closed one reads only its window. Ranged CPU on the verify
burst dropped from 58 ms max to 4 ms, and the verify passed byte for byte.

**Mistakes.**
- The first fix swapped the slicer for `arrayBuffer()` on the edge part. CPU went
  down, but every seek then held a 2 MiB part in memory, and about 60 concurrent
  seeks in one isolate reach the 128 MB limit, which is the same kill under a
  different name. It shipped for 15 minutes.
- The regression test's spy wrapped `getReader()`, so it passed on the old code:
  `pipeThrough` and `arrayBuffer()` take their readers internally. The fake asset
  now flags all three, and the test went red on both earlier versions.
- `fill()` read `view.byteLength` after a BYOB read. That read detaches the view,
  so the length was 0 and windows came back empty. Capture offset and length
  first.

**What worked.** Workers Logs (`/workers/observability/telemetry/query`, `events`
view) give per-request CPU with the Range header, which pinpointed deep-in-part
windows. A local `wrangler dev` with a fake split file checked BYOB and
`readAtLeast` in real workerd before the deploy.

**Rules.** No audio byte passes through JS chunk by chunk, and no request holds a
whole part. Whole-file downloads of the longest surahs still cost about 17 ms in
native pipes (0.3 ms/MB). That ceiling is noted in `wrangler.jsonc`.

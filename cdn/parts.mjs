// How a large audio file is laid out at the edge. Shared by cdn/stage.mjs, which
// writes the parts, and cdn/worker.mjs, which reads them back as one file.

/**
 * Part size. Workers static assets answer a Range request with the whole file (200),
 * so the Worker reads a part from its start and drops the bytes before the range: a
 * seek costs at most one part read at the edge. 2 MiB keeps that small, and a full
 * read of the longest surah (57 MB) to 29 asset reads, under the 50 a request allows.
 */
export const PART = 2 * 1024 * 1024;

/** Where part `i` of the file served at `path` (leading slash) is stored. */
export const partPath = (path, i) => `/_parts${path}/${i}`;

/** Folders whose files are audio: streamed, seeked, so served through the Worker. */
export const AUDIO = ['audio', 'recitations'];

/** The split files' sizes, `{ "/recitations/…/002.mp3": 59874159 }`, as an asset. */
export const MANIFEST = '/_parts/sizes.json';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAMPLE, workerChecks } from './verify.mjs';

const hashes = Object.fromEntries(Array.from({ length: 490 }, (_, i) => [`/audio/hisn/${i}.mp3`, `h${i}`]));

test('a deploy that changed nothing reads only the sample through the Worker, not every file', () => {
  const picked = workerChecks(hashes, { ...hashes }, { day: '2026-11-23' });
  assert.ok(picked.length <= SAMPLE, `${picked.length} Worker checks for an unchanged deploy`);
  assert.ok(picked.length > 0);
});

test('a changed or new file is always read through the Worker', () => {
  const live = { ...hashes, '/audio/hisn/7.mp3': 'old' };
  delete live['/audio/hisn/8.mp3'];
  const picked = workerChecks(hashes, live, { day: '2026-11-23' });
  assert.ok(picked.includes('/audio/hisn/7.mp3'));
  assert.ok(picked.includes('/audio/hisn/8.mp3'));
});

test('the sample rotates by day, so a week covers different files', () => {
  const a = workerChecks(hashes, { ...hashes }, { day: '2026-11-23' });
  const b = workerChecks(hashes, { ...hashes }, { day: '2026-11-30' });
  assert.notDeepEqual(a, b);
});

test('no previous copy means everything is new; --all reads everything', () => {
  assert.equal(workerChecks(hashes, {}, { day: '2026-11-23' }).length, 490);
  assert.equal(workerChecks(hashes, null, { all: true }).length, 490);
});

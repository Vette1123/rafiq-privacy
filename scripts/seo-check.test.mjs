// node --test scripts/seo-check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('every indexable page passes the SEO and link check', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./seo-check.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('the footer sends sibling apps to their own domain root with the source tag, never /go', () => {
  for (const l of ['en', 'ar']) {
    const f = fs.readFileSync(new URL(`../partials/footer.${l}.html`, import.meta.url), 'utf8');
    assert.match(f, /href="https:\/\/masareef\.mohamedgado\.com\/\?s=rafiq-site"/);
    assert.match(f, /href="https:\/\/nafis\.mohamedgado\.com\/\?s=rafiq-site"/);
    assert.doesNotMatch(f, /projects\/(masareef|nafis)/);
  }
});

// node --test scripts/seo-check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

test('every indexable page passes the SEO and link check', () => {
  const r = spawnSync(process.execPath, ['scripts/seo-check.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('the footer sends sibling apps to their own domain root with the source tag, never /go', () => {
  for (const l of ['en', 'ar']) {
    const f = fs.readFileSync(`partials/footer.${l}.html`, 'utf8');
    assert.match(f, /href="https:\/\/masareef\.mohamedgado\.com\/\?s=rafiq-site"/);
    assert.match(f, /href="https:\/\/nafis\.mohamedgado\.com\/\?s=rafiq-site"/);
    assert.doesNotMatch(f, /projects\/(masareef|nafis)/);
  }
});

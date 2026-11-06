// node --test scripts/partials.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { markCurrent, applyPartials, css } from './partials.mjs';

const B = 'https://www.mohamedgado.com/projects/rafiq';
const page = (canon, extra = '') => `<link rel="canonical" href="${canon}" />${extra}<nav class="topnav"><a href="${B}/go">Download</a><a href="${B}/go-ar">AR</a><a href="${B}/privacy">Privacy</a></nav><footer class="sitefoot"><a href="${B}/privacy">Policy</a><a href="${B}">About</a></footer>`;

test('the top nav and footer mark exactly the page they sit on', () => {
  const p = markCurrent(page(`${B}/privacy`));
  assert.match(p, /<nav[^]*\/privacy" aria-current="page">Privacy/);
  assert.match(p, /<footer[^]*\/privacy" aria-current="page">Policy/);
  assert.doesNotMatch(p, /\/go" aria-current/);
  // The footer's project link would prefix-match every page: it must never be marked.
  assert.doesNotMatch(p, /rafiq" aria-current/);
});

test('the Arabic install page marks its own link, not the English one', () => {
  const p = markCurrent(page(`${B}/go-ar`));
  assert.match(p, /\/go-ar" aria-current="page">AR/);
  assert.doesNotMatch(p, /\/go" aria-current/);
});

test('a noindex page with a borrowed canonical marks nothing', () => {
  assert.doesNotMatch(markCurrent(page(`${B}/privacy`, '<meta name="robots" content="noindex" />')), /aria-current/);
});

test('a page that lost its theme marker fails loudly; markers are filled and idempotent', () => {
  assert.throws(() => applyPartials('<p>x</p>', { require: ['theme.css'] }), /theme\.css/);
  const once = applyPartials('<!--partial:theme.css--><!--/partial:theme.css-->', { require: ['theme.css'] });
  assert.match(once, /<style>[\s\S]*--gold/);
  assert.equal(applyPartials(once, { require: ['theme.css'] }), once);
});

test('css() minifies comments and whitespace', () => {
  assert.equal(css('a { color: red; } /* x */'), 'a{color: red}');
});

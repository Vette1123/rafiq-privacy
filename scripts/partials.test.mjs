// node --test scripts/partials.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { markCurrent, applyPartials, css, SITE } from './partials.mjs';

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

test('footer: at phone width the last column spans the row, so no column sits alone beside empty space', () => {
  const t = fs.readFileSync(new URL('../partials/theme.css', import.meta.url), 'utf8');
  const phone = t.match(/@media \(max-width: 560px\) \{ \.sitefoot \{[^}]*\}[^@]*\}/)?.[0] ?? '';
  assert.match(phone, /\.sitefoot > nav:last-of-type \{ grid-column: 1 \/ -1; \}/);
});

// 6 Nov: a panel's first heading kept `.sec h3 { margin-top: 32px }` on top of the panel's
// own padding, so the bank "how it works" cards opened on a band of empty space. And a
// <button> shows the arrow by default: every clickable thing gets the pointer from one rule.
test('theme: a panel opens on its content, and every action shows the pointer', async () => {
  const { readFileSync } = await import('node:fs');
  const theme = readFileSync(new URL('../partials/theme.css', import.meta.url), 'utf8');
  assert.match(theme, /\.panel > :first-child\s*\{[^}]*margin-top:\s*0/);
  const rule = theme.match(/([^{}]+)\{\s*cursor:\s*pointer;?\s*\}/)?.[1] ?? '';
  for (const sel of ['a[href]', 'button', 'summary', '[role="button"]', 'label[for]', 'select']) {
    assert.ok(rule.includes(sel), `pointer rule is missing ${sel}`);
  }
});

// 6 Nov: the current page's nav pill was a near-invisible shade of the bar. It now wears the
// brand colour, a ring and a dot, so "where am I" reads at a glance in both themes.
test('theme: the current nav item is clearly marked', async () => {
  const { readFileSync } = await import('node:fs');
  const theme = readFileSync(new URL('../partials/theme.css', import.meta.url), 'utf8');
  const on = theme.match(/\.topnav a\[aria-current\]\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(on, /color:\s*var\(--gold\)/);
  assert.match(on, /inset 0 0 0 1px/);
  assert.match(theme, /\.topnav a\[aria-current\]::before\s*\{[^}]*border-radius:\s*50%/);
});

// 6 Nov audit: top-bar, footer and contents links were 36-40px tall (under the 44px tap
// minimum), and on a wide screen the policy filled only the left half of the page.
test('theme: every tap target reaches 44px, and the policy contents ride beside the text on wide screens', async () => {
  const { readFileSync } = await import('node:fs');
  const theme = readFileSync(new URL('../partials/theme.css', import.meta.url), 'utf8');
  const doc = readFileSync(new URL('../partials/doc.css', import.meta.url), 'utf8');
  assert.match(theme, /\.brand\s*\{[^}]*min-height:\s*44px/);
  // the nav pills keep their 36px look; an invisible layer grows the hit area to 44px
  assert.match(theme, /\.topnav a::after\s*\{[^}]*inset:\s*-4px 0/);
  assert.match(theme, /\.topnav a\s*\{[^}]*position:\s*relative/);
  assert.match(theme, /\.sitefoot li a\s*\{[^}]*padding-block:\s*11px/);
  assert.match(theme, /\.foot a\s*\{[^}]*padding-block:\s*11px/);
  assert.match(theme, /\.crumbs a\s*\{[^}]*padding-block:\s*15px/);
  assert.match(theme, /\.switch button\s*\{[^}]*min-height:\s*44px/);
  assert.match(doc, /\.toc a\s*\{[^}]*padding-block:\s*10px/);
  const wide = doc.match(/@media \(min-width: 1100px\) \{([^]*?)\n\}/)?.[1] ?? '';
  assert.match(wide, /\.prose > \.toc\s*\{[^}]*position:\s*sticky/);
  assert.match(wide, /grid-template-columns:\s*minmax\(0, 72ch\)/);
});

// ---- 6 Nov: one header, one remembered language, sticky header, visits counted (ported from masareef-privacy)

const PAGES = ['go.html', 'go-ar.html', 'index.html', '404.html'];
const readPage = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const readPartial = (f) => fs.readFileSync(new URL('../partials/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Every page drew its own header (a lone "العربية" link, its own stored language). One now,
// inlined from partials/header.html, with the same switches on every page.
test('site: every page carries the one shared header and nothing else', () => {
  for (const f of PAGES) {
    const html = readPage(f);
    for (const p of SITE) assert.ok(html.includes(`<!--partial:${p}-->`), `${f}: no ${p}`);
    assert.equal(html.split('<header').length, 2, `${f}: a header besides the shared one`);
    const own = html.replace(/<!--partial:lang(-pick)?\.js-->[\s\S]*?<!--\/partial:lang(-pick)?\.js-->/g, '');
    assert.ok(!/go-lang'\s*,/.test(own), `${f}: writes its own language key`);
    assert.doesNotMatch(own, /rafiq-privacy-lang/, `${f}: keeps its own copy of the language key`);
  }
  assert.ok(!fs.existsSync(new URL('../partials/topnav.en.html', import.meta.url)), 'the old per-language topnav partials are gone');
});

function runPick({ served, alt, stored = {}, nav = 'en-US', hash = '' }) {
  const root = { lang: served, dir: '', style: {}, classList: { add() {} }, getAttribute: (k) => (k === 'data-alt' ? alt ?? null : null) };
  let replaced = null;
  const ctx = {
    document: { documentElement: root },
    location: { hash, search: '?s=ig', replace: (u) => (replaced = u) },
    navigator: { language: nav, userAgent: 'Mozilla/5.0' },
    localStorage: { getItem: (k) => stored[k] ?? null },
  };
  vm.runInNewContext(readPartial('lang-pick.js'), ctx);
  return { lang: root.lang, replaced };
}

test('lang-pick: a language chosen on any page carries to the install page and back', () => {
  const K = 'rafiq-privacy-lang';
  assert.deepEqual(runPick({ served: 'en', alt: 'go-ar', stored: { [K]: 'ar' } }), { lang: 'en', replaced: 'go-ar?s=ig' });
  assert.deepEqual(runPick({ served: 'ar', alt: 'go', stored: { [K]: 'en' } }), { lang: 'ar', replaced: 'go?s=ig' });
  assert.equal(runPick({ served: 'en', alt: 'go-ar', stored: { 'go-lang': 'ar' } }).replaced, 'go-ar?s=ig', 'the old install-page key still counts');
  assert.equal(runPick({ served: 'en', stored: { 'go-lang': 'ar' } }).lang, 'ar', 'and reaches the policy');
  assert.equal(runPick({ served: 'en', alt: 'go-ar', nav: 'ar-EG' }).replaced, 'go-ar?s=ig', 'an Arabic browser goes to go-ar');
  assert.deepEqual(runPick({ served: 'ar', alt: 'go', nav: 'en-US' }), { lang: 'ar', replaced: null }, 'the Arabic link stays Arabic');
  assert.deepEqual(runPick({ served: 'en', stored: { [K]: 'ar' } }), { lang: 'ar', replaced: null }, 'the policy flips in place');
  assert.equal(runPick({ served: 'en', stored: { [K]: 'ar' }, hash: '#en-4' }).lang, 'en', 'a section link wins');
  for (const [f, alt] of [['go.html', 'go-ar'], ['go-ar.html', 'go']]) assert.match(readPage(f), new RegExp(`<html [^>]*data-alt="${alt}"`), `${f} names its other URL`);
});

// On a phone the header wraps to two rows, and the hero glow and grid (which start 120-140px
// above the hero) began inside it as a hard band; the tabs backdrop blur sat on top of it.
test('theme: hero layers fade in from their top edge, and nothing in the header is frosted', () => {
  const theme = readPartial('theme.css');
  assert.doesNotMatch(theme, /backdrop-filter/);
  assert.match(theme, /--rise:\s*linear-gradient\(transparent,/);
  assert.match(theme, /\.head::after, \.hero::after\s*\{[^}]*mask-image:[^;]*var\(--rise\)/);
  assert.match(theme, /\.head::before\s*\{[^}]*mask-image:\s*linear-gradient\(transparent,/);
  assert.match(fs.readFileSync(new URL('../go.template.html', import.meta.url), 'utf8'), /\.hero::before\s*\{[^}]*mask-image:\s*var\(--rise\)/);
  assert.match(theme, /\[dir="rtl"\] \.crumbs li \+ li::before \{ transform: rotate\(-45deg\)/, 'the RTL chevron points left');
});

// position: sticky only holds inside a parent as tall as the page, so the header sits directly in
// <body>; inside a header-only .wrap it would scroll away like before.
test('header: every page puts it straight in <body>, sticky, with the Contents clear of it', () => {
  for (const f of PAGES) {
    assert.match(readPage(f), /<body[^>]*>\s*(<a class="skip"[^>]*>[^<]*<\/a>\s*)?<!--partial:header\.html-->/, `${f}: header is not a direct child of <body>`);
  }
  const theme = readPartial('theme.css');
  assert.match(theme, /\.top \{ position: sticky; top: 0;/);
  assert.match(theme, /\.top-hidden \.top \{ transform: translateY\(-100%\); \}/);
  assert.match(theme, /\.top::before \{[^}]*background: var\(--bg\);/, 'the bar is solid: see-through let text ghost under it');
  assert.match(readPartial('doc.css'), /\.prose > \.toc \{[^}]*position: sticky; top: calc\(24px \+ var\(--top-on\)\)/);
});

test('header.js: hides going down, returns going up, ignores jitter and keeps focus visible', () => {
  const classes = new Set();
  const handlers = {};
  let focusInside = false;
  let now = 0;
  const top = { offsetHeight: 80, contains: () => focusInside, addEventListener: (t, f) => (handlers['top:' + t] = f) };
  const ctx = {
    scrollY: 0,
    document: {
      documentElement: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c), remove: (c) => classes.delete(c) }, style: { setProperty() {} } },
      querySelector: () => top,
      addEventListener: (t, f) => (handlers['doc:' + t] = f),
      activeElement: null,
    },
    addEventListener: (t, f) => (handlers[t] = f),
    requestAnimationFrame: (f) => f(),
    performance: { now: () => now },
    window: {},
  };
  vm.runInNewContext(readPartial('header.js'), ctx);
  const to = (y) => { ctx.scrollY = y; handlers.scroll(); return { stuck: classes.has('top-stuck'), hidden: classes.has('top-hidden') }; };
  assert.deepEqual(to(0), { stuck: false, hidden: false });
  assert.deepEqual(to(60), { stuck: true, hidden: false }, 'still within the header: never hidden');
  assert.deepEqual(to(600), { stuck: true, hidden: true }, 'going down');
  assert.deepEqual(to(596), { stuck: true, hidden: true }, '4px back is jitter');
  assert.deepEqual(to(560), { stuck: true, hidden: false }, 'going up');
  focusInside = true;
  assert.equal(to(900).hidden, false, 'focus inside keeps it shown');
  focusInside = false;
  handlers['doc:click']({ target: { closest: () => ({}) } });
  assert.equal(to(400).hidden, true, 'an in-page jump up keeps it away');
  now = 2000;
  assert.equal(to(300).hidden, false, 'then scrolling up brings it back');
  assert.deepEqual(to(0), { stuck: false, hidden: false });
});

// Visits were invisible: mohamedgado.com proxies these pages from github.io, so they never got the
// portfolio's <Analytics/>. The head loads Vercel Web Analytics on that host only.
function runHead(hostname, canonical) {
  const js = readPartial('head.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const added = [];
  const win = {};
  const ctx = {
    window: win, location: { hostname },
    localStorage: { getItem: () => null },
    document: { documentElement: { setAttribute() {} }, querySelectorAll: () => [], querySelector: (q) => (canonical && q === 'link[rel="canonical"]' ? { href: canonical } : null), createElement: () => ({}), head: { appendChild: (n) => added.push(n) } },
    Object,
  };
  vm.runInNewContext(js, ctx);
  return { added, win };
}

test('head: Vercel Web Analytics loads on mohamedgado.com only, and ?s= becomes utm_source', () => {
  for (const host of ['vette1123.github.io', 'localhost', 'mohamedgado.com.evil.example']) {
    const { added, win } = runHead(host);
    assert.equal(added.length, 0, `${host} loads nothing`);
    assert.equal(win.va, undefined);
  }
  for (const host of ['www.mohamedgado.com', 'mohamedgado.com']) {
    assert.deepEqual(runHead(host).added.map((n) => n.src), ['/_vercel/insights/script.js'], `${host}: same-origin script`);
  }
  const [kind, beforeSend] = runHead('www.mohamedgado.com').win.vaq[0];
  assert.equal(kind, 'beforeSend');
  const url = (u) => beforeSend({ type: 'pageview', url: u }).url;
  assert.equal(url('https://www.mohamedgado.com/projects/rafiq/go?s=IG'), 'https://www.mohamedgado.com/projects/rafiq/go?s=IG&utm_source=ig');
  assert.equal(url('https://www.mohamedgado.com/projects/rafiq/privacy#en-10'), 'https://www.mohamedgado.com/projects/rafiq/privacy#en-10', 'no tag, untouched');
  assert.equal(url('https://www.mohamedgado.com/projects/rafiq/go?s=x&utm_source=y'), 'https://www.mohamedgado.com/projects/rafiq/go?s=x&utm_source=y', 'an explicit utm wins');
  // rafiq.mohamedgado.com serves its install page in place since 7 Nov: its pageviews count under
  // the canonical www page (not as `/`, mixed with the portfolio home), and ?s= still tags them.
  const go = 'https://www.mohamedgado.com/projects/rafiq/go';
  const sub = runHead('rafiq.mohamedgado.com', go);
  assert.deepEqual(sub.added.map((n) => n.src), ['/_vercel/insights/script.js']);
  const subUrl = (u) => sub.win.vaq[0][1]({ type: 'pageview', url: u }).url;
  assert.equal(subUrl('https://rafiq.mohamedgado.com/?s=IG'), go + '?s=IG&utm_source=ig');
  assert.equal(subUrl('https://rafiq.mohamedgado.com/'), go);
  assert.equal(subUrl('https://rafiq.mohamedgado.com/go#x'), go + '#x');
  const ar = runHead('rafiq.mohamedgado.com', go + '-ar');
  assert.equal(ar.win.vaq[0][1]({ type: 'pageview', url: 'https://rafiq.mohamedgado.com/ar?s=tt' }).url, go + '-ar?s=tt&utm_source=tt');
  assert.equal(url('https://www.mohamedgado.com/projects/rafiq/go-ar'), 'https://www.mohamedgado.com/projects/rafiq/go-ar', 'www untouched');
  // The policy says so, in both languages, and no page still claims to run none.
  const policy = readPage('index.html');
  assert.doesNotMatch(policy, /runs no analytics|ولا تشغّل أي قياس/, 'the policy still says no analytics');
  assert.match(policy, /Vercel Web\s+Analytics,\s+without cookies/);
  assert.match(policy, /تُعدّ الزيارة عبر Vercel Web Analytics بلا كوكيز/);
  assert.match(policy, /<h3>This website<\/h3>/);
  assert.match(policy, /<h3>هذا الموقع<\/h3>/);
  assert.equal(policy.split('vercel.com/legal/privacy-policy').length, 3, 'Vercel is in both third-party tables');
});

test('build-pages --check passes on a current checkout, whatever its line endings', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./build-pages.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

// 7 Nov: the site linked the stores and nothing else, while the app offered eight ways to follow,
// join or message us. Both footers carry every channel, each with a name a screen reader says,
// and every indexable page tells search engines which profiles are ours (sameAs).
test('both footers link every social channel, each named', async () => {
  const { SOCIAL } = await import('./social.mjs');
  for (const l of ['en', 'ar']) {
    const foot = fs.readFileSync(new URL(`../partials/footer.${l}.html`, import.meta.url), 'utf8');
    const row = foot.match(/<ul class="sf-social"[\s\S]*?<\/ul>/)?.[0] ?? '';
    const hrefs = [...row.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, SOCIAL.map((s) => s.url), `footer.${l} social row`);
    for (const a of row.match(/<a [^>]*>/g)) assert.match(a, /aria-label="[^"]{3,}"/, `footer.${l}: ${a}`);
  }
});

test('every indexable page lists our profiles in sameAs', async () => {
  const { APP_SAME_AS, PERSON_SAME_AS } = await import('./social.mjs');
  for (const f of ['index.html', 'go.html', 'go-ar.html']) {
    const html = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const nodes = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .flatMap((j) => j['@graph'] ?? [j])
      .flatMap((n) => [n, n.about, n.publisher, n.author].filter((x) => x && typeof x === 'object'));
    const app = nodes.find((n) => n['@type'] === 'MobileApplication' && n.sameAs);
    const person = nodes.find((n) => n['@type'] === 'Person' && n.name);
    for (const u of APP_SAME_AS) assert.ok(app?.sameAs.includes(u), `${f}: app sameAs is missing ${u}`);
    for (const u of PERSON_SAME_AS) assert.ok(person?.sameAs?.includes(u), `${f}: person sameAs is missing ${u}`);
  }
});

// Every footer icon is the network's real mark from scripts/icons.mjs, so no page can drift back
// to a hand-drawn outline: one source, inlined at build time into every page.
test('footer social icons are the marks in icons.mjs', async () => {
  const { readFileSync } = await import('node:fs');
  const { SOCIAL } = await import('./social.mjs');
  const { icon, ICONS } = await import('./icons.mjs');
  for (const l of ['en', 'ar']) {
    const foot = readFileSync(new URL(`../partials/footer.${l}.html`, import.meta.url), 'utf8');
    const links = [...foot.match(/<ul class="sf-social"[\s\S]*?<\/ul>/)[0].matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    for (const [, href, inner] of links) {
      const s = SOCIAL.find((x) => x.url === href);
      assert.equal(inner, icon(s.key), `footer.${l}: ${s.key} icon`);
      if (ICONS[s.key].brand) assert.ok(foot.includes(`<a href="${href}" rel="noopener" style="--b:${ICONS[s.key].brand}"`), `footer.${l}: ${s.key} brand colour`);
    }
  }
});

test('the policy page carries a BreadcrumbList that matches its first visible trail', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const lists = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).filter((n) => n['@type'] === 'BreadcrumbList');
  assert.equal(lists.length, 1);
  const items = lists[0].itemListElement;
  assert.deepEqual(items.map((i) => i.item), [`${B}/go`, `${B}/privacy`]);
  const trails = html.match(/<nav class="crumbs"[\s\S]*?<\/nav>/g) ?? [];
  assert.equal(trails.length, 2, 'one trail per language');
  const visible = [...trails[0].matchAll(/<li[^>]*>(?:<a [^>]*>)?([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(visible, items.map((i) => i.name));
});

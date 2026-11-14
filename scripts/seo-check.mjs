// node scripts/seo-check.mjs  -- exits 1 listing every SEO/link problem. Reads the built HTML only.
// Canonicals point at www.mohamedgado.com/projects/rafiq/*, which maps to this repo's files:
//   /privacy -> index.html, /go -> go.html, /go-ar -> go-ar.html, /features/x -> features/x.html ...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) =>
  fs.readdirSync(path.join(repo, d), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(d, e.name);
    if (e.isDirectory()) return walk(rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
const files = [
  ...fs.readdirSync(repo).filter((f) => f.endsWith('.html') && !f.includes('template')),
  ...['features', 'reciters', 'threads-callback'].flatMap(walk),
];
const problems = [];
const bad = (f, m) => problems.push(`${f}: ${m}`);
const titles = new Map();
const descs = new Map();
const attr = (tag, a) => tag.match(new RegExp(`${a}="([^"]*)"`))?.[1];
const metaOf = (h, key, val) => h.match(new RegExp(`<meta[^>]*${key}="${val}"[^>]*>`))?.[0];
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const canonOf = {};
const hreflangs = [];

for (const f of files) {
  const h = fs.readFileSync(path.join(repo, f), 'utf8');
  const noindex = /noindex/.test(metaOf(h, 'name', 'robots') ?? '');
  const title = dec(h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const desc = dec(attr(metaOf(h, 'name', 'description') ?? '', 'content') ?? '');
  const canon = attr(h.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '', 'href');
  if (/boogado@yahoo/.test(h)) bad(f, 'old contact email boogado@yahoo.com');
  if (/mohamedgado\.com\/projects\/(masareef|nafis)\/go/.test(h)) bad(f, 'sibling-app link uses /go (use the app domain root + ?s=rafiq-site)');
  if (/(masareef|nafis)\.mohamedgado\.com\/(?!\?s=rafiq-site)/.test(h)) bad(f, 'sibling-app link without ?s=rafiq-site');
  if (/github\.io\/(masareef|nafis)/.test(h)) bad(f, 'sibling-app link on github.io');
  if (!/<html[^>]*lang="(ar|en)"/.test(h) || !/<html[^>]*dir="(rtl|ltr)"/.test(h)) bad(f, 'html lang/dir missing');
  if (!title) bad(f, 'no <title>');
  if (noindex) {
    if (f !== '404.html' && f !== 'threads-callback/index.html') bad(f, 'unexpected noindex');
    continue;
  }
  if (title.length > 60) bad(f, `title ${title.length} chars (>60): ${title}`);
  canonOf[f] = canon;
  if (!desc) bad(f, 'no meta description');
  else if (desc.length < 70 || desc.length > 170) bad(f, `description ${desc.length} chars: ${desc}`);
  if (!canon) bad(f, 'no canonical');
  titles.set(title, [...(titles.get(title) ?? []), f]);
  descs.set(desc, [...(descs.get(desc) ?? []), f]);
  for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) if (!metaOf(h, 'property', k)) bad(f, `missing ${k}`);
  for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) if (!metaOf(h, 'name', k)) bad(f, `missing ${k}`);
  const img = attr(metaOf(h, 'property', 'og:image') ?? '', 'content');
  if (img && !/^https:\/\//.test(img)) bad(f, 'og:image not absolute');
  else if (img) {
    const local = img.replace(/^https:\/\/[^/]+(\/rafiq-privacy|\/projects\/rafiq)?\//, '');
    if (!fs.existsSync(path.join(repo, local))) bad(f, `og:image file missing: ${local}`);
  }
  if (!/rel="icon"/.test(h)) bad(f, 'no favicon link');
  if (!/rel="apple-touch-icon"/.test(h)) bad(f, 'no apple-touch-icon link');
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!ld.length) bad(f, 'no JSON-LD');
  const types = [];
  for (const raw of ld) {
    try {
      const j = JSON.parse(raw);
      for (const n of j['@graph'] ?? [j]) types.push(n['@type']);
    } catch (e) {
      bad(f, 'JSON-LD invalid: ' + e.message);
    }
  }
  const flat = types.flat();
  if (/^(go|go-ar)\.html$/.test(f) && !flat.some((t) => /Application/.test(t))) bad(f, 'install page lacks SoftwareApplication JSON-LD');
  if (/^(features|reciters)\//.test(f) && !f.endsWith('index.html') && !flat.includes('BreadcrumbList')) bad(f, 'deep page lacks BreadcrumbList');
  if (flat.includes('FAQPage') && !/<details|class="faq/i.test(h)) bad(f, 'FAQPage JSON-LD without a visible FAQ');
  for (const m of h.matchAll(/<link rel="alternate"[^>]*hreflang="([^"]+)"[^>]*>/g)) {
    const href = attr(m[0], 'href');
    if (href) hreflangs.push({ f, lang: m[1], href });
  }
  for (const m of h.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) bad(f, `img without alt: ${m[0].slice(0, 80)}`);
    if (!/\bwidth="/.test(m[0]) || !/\bheight="/.test(m[0])) bad(f, `img without width/height: ${m[0].slice(0, 80)}`);
  }
  for (const m of h.matchAll(/href="(https:\/\/www\.mohamedgado\.com\/projects\/rafiq\/([^"#?]*))[^"]*"/g)) {
    const p = m[2].replace(/\/$/, '');
    if (p === '') continue; // the project page lives in the portfolio repo
    if (['go-img', 'audio', 'fonts'].some((d) => p.startsWith(d + '/'))) {
      if (!fs.existsSync(path.join(repo, p))) bad(f, `broken asset link ${p}`);
      continue;
    }
    const cands = p === 'privacy' ? ['index.html'] : [p + '.html', p + '/index.html'];
    if (!cands.some((c) => fs.existsSync(path.join(repo, c)))) bad(f, `broken internal link ${m[1]}`);
  }
}
for (const [t, list] of titles) if (list.length > 1) bad(list.join(', '), `duplicate title: ${t}`);
for (const [d, list] of descs) if (list.length > 1) bad(list.join(', '), `duplicate description: ${d.slice(0, 60)}`);
const byCanon = Object.fromEntries(Object.entries(canonOf).map(([f, c]) => [c, f]));
for (const { f, lang, href } of hreflangs) {
  if (lang === 'x-default') continue;
  const peer = byCanon[href];
  if (!peer) bad(f, `hreflang ${lang} -> ${href} is not an indexable page of this repo`);
  else if (peer !== f && !hreflangs.some((x) => x.f === peer && x.href === canonOf[f])) bad(f, `hreflang ${lang} -> ${peer} is not reciprocal`);
}
const robotsTxt = fs.readFileSync(path.join(repo, 'robots.txt'), 'utf8');
if (!/^Sitemap: https:\/\/\S+\/sitemap\.xml/m.test(robotsTxt)) bad('robots.txt', 'no Sitemap line');
console.log(`${files.length} pages checked`);
if (problems.length) {
  console.error(problems.join('\n') + `\n\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log('seo-check: ok');

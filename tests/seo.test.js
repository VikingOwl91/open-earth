import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const ORIGIN = 'https://open-earth.info/';

function metaContent(attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`);
  const m = head.match(re);
  return m ? m[1] : null;
}

function linkHref(rel) {
  const m = head.match(new RegExp(`<link\\s+rel="${rel}"[^>]*?href="([^"]*)"`));
  return m ? m[1] : null;
}

function localPath(url) {
  const rel = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
  return path.join(root, rel.replace(/^\.?\//, ''));
}

test('head: title and description have a sensible length', () => {
  const title = head.match(/<title>([^<]*)<\/title>/)[1].replace(/&amp;/g, '&');
  assert.ok(title.length >= 30 && title.length <= 65, `title length ${title.length}`);
  const desc = metaContent('name', 'description');
  assert.ok(desc.length >= 120 && desc.length <= 170, `description length ${desc.length}`);
  assert.doesNotMatch(head, /\u2014/);
});

test('head: canonical points at the clean root URL', () => {
  assert.equal(linkHref('canonical'), ORIGIN);
  assert.doesNotMatch(head, /noindex/i);
});

test('head: Open Graph and Twitter card tags are complete', () => {
  assert.equal(metaContent('property', 'og:type'), 'website');
  assert.equal(metaContent('property', 'og:url'), ORIGIN);
  assert.equal(metaContent('property', 'og:site_name'), 'Open Earth');
  assert.ok(metaContent('property', 'og:title'));
  assert.ok(metaContent('property', 'og:description'));
  assert.ok(metaContent('property', 'og:locale'));
  assert.ok(metaContent('property', 'og:image:alt'));
  assert.equal(metaContent('name', 'twitter:card'), 'summary_large_image');
  assert.equal(metaContent('name', 'twitter:image'), metaContent('property', 'og:image'));
  assert.ok(metaContent('name', 'twitter:title'));
});

test('head: og:image exists on disk as a 1200x630 PNG under 300 KB', () => {
  const url = metaContent('property', 'og:image');
  assert.ok(url.startsWith(ORIGIN), 'og:image must be absolute');
  const file = localPath(url);
  const buf = fs.readFileSync(file);
  assert.ok(buf.length < 300 * 1024, `og image is ${buf.length} bytes`);
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  assert.equal(buf.readUInt32BE(16), Number(metaContent('property', 'og:image:width')));
  assert.equal(buf.readUInt32BE(20), Number(metaContent('property', 'og:image:height')));
});

test('head: icon links resolve to files on disk', () => {
  const hrefs = [...head.matchAll(/<link\s+rel="(?:icon|apple-touch-icon)"[^>]*?href="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((h) => !h.startsWith('data:'));
  assert.ok(hrefs.length >= 2);
  for (const href of hrefs) assert.ok(fs.existsSync(localPath(href)), href);
});

test('manifest parses and references existing icons', () => {
  const href = linkHref('manifest');
  assert.ok(href);
  const file = localPath(href);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(path.dirname(file), icon.src)), icon.src);
  }
});

test('JSON-LD parses and describes the WebSite and WebApplication', () => {
  const blocks = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org');
  const types = data['@graph'].map((n) => n['@type']);
  assert.deepEqual(types, ['WebSite', 'WebApplication']);
  const app = data['@graph'][1];
  assert.equal(app.url, ORIGIN);
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.offers.price, '0');
  assert.ok(app.featureList.length > 0);
  assert.ok(fs.existsSync(localPath(app.image)));
});

test('body: exactly one h1 and a noscript description', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<noscript>[\s\S]*Open Earth is a free, open-source map[\s\S]*<\/noscript>/);
});

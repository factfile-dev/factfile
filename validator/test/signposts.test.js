import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validate } from '../src/index.js';
import { generate, setupGuide } from '../src/generate/index.js';
import { detectPlatform, FOOTER_HTML, HEAD_HTML, LINK_HEADER, signpostStatus, writeSetupGuide } from '../src/signposts.js';

const today = new Date('2026-10-20T12:00:00Z');

test('signpostStatus finds a visible footer link, a describedby tag and a Link header', () => {
  const html = `<html><head>${HEAD_HTML}</head><body><footer>${FOOTER_HTML}</footer></body></html>`;
  assert.deepEqual(signpostStatus(html, { link: LINK_HEADER }), { visible: true, head: true, header: true, oldHead: false });
});

test('a hidden link does not count as visible, and rel="factfile" is reported as old', () => {
  const html = `<html><head><link rel="factfile" type="text/markdown" href="/factfile.md"></head><body>
    <a href="/factfile.md" style="display: none">Facts</a><div hidden><a href="/factfile.md">Facts</a></div><a href="/factfile.md"></a></body></html>`;
  const s = signpostStatus(html, {});
  assert.equal(s.visible, false);
  assert.equal(s.head, false);
  assert.equal(s.oldHead, true);
  assert.equal(s.header, false);
});

test('a link to the human page counts as visible; the well-known path and absolute URLs count too', () => {
  assert.equal(signpostStatus('<a href="https://shop.example/factfile">Facts for AI</a>').visible, true);
  assert.equal(signpostStatus('<a href="/.well-known/factfile.md">Facts</a>').visible, true);
  assert.equal(signpostStatus('<a href="/facts">Facts</a>').visible, false);
});

test('detectPlatform recognises common website builders', () => {
  assert.equal(detectPlatform('<meta name="generator" content="WordPress 6.6">'), 'wordpress');
  assert.equal(detectPlatform('<link href="/wp-content/themes/x/style.css">'), 'wordpress');
  assert.equal(detectPlatform('<script src="https://cdn.shopify.com/s/x.js"></script>'), 'shopify');
  assert.equal(detectPlatform('<img src="https://static.wixstatic.com/media/a.png">'), 'wix');
  assert.equal(detectPlatform('<script id="__NEXT_DATA__"></script>'), 'nextjs');
  assert.equal(detectPlatform('<html><body>Hello</body></html>'), null);
});

test('the WordPress guide gives WordPress steps and server code', () => {
  const g = writeSetupGuide({ name: 'Acme', origin: 'https://acme.example', platform: 'wordpress', status: { visible: true, head: false, header: false }, today });
  assert.match(g, /built with \*\*WordPress\*\*/);
  assert.match(g, /WPCode/);
  assert.match(g, /\.htaccess/);
  assert.ok(g.includes(FOOTER_HTML) && g.includes(HEAD_HTML) && g.includes(LINK_HEADER));
  assert.match(g, /\| 2\. Visible link on your site \| ✅ already done \|/);
  assert.match(g, /\| 3\. Link tag in the page head \| ⬜ to do \|/);
  assert.match(g, /npx factfile validate acme\.example/);
});

test('the Shopify guide is honest that the file cannot go at the root yet', () => {
  const g = writeSetupGuide({ name: 'Shop', origin: 'https://shop.example', platform: 'shopify', status: {}, today });
  assert.match(g, /does not let shops place files at the root/);
  assert.match(g, /<a href="\/factfile">Facts for AI \(factfile\.md\)<\/a>/, 'links to the human page instead');
  assert.match(g, /Skip this until the file itself can be online/);
  assert.doesNotMatch(g, /\.htaccess|nginx/i);
  assert.match(g, /not possible on this platform/);
});

const SITE = 'https://hollybankgrooming.example';
const localFile = await readFile(new URL('../../examples/local/factfile.md', import.meta.url), 'utf8');

function liveSite({ home }) {
  const pages = {
    [`${SITE}/prices`]: '<p>£22 £40 10 kg £50 25 kg £65</p>',
    [`${SITE}/book`]: '<p>Book</p>',
    [`${SITE}/factfile`]: '<p>Hollybank Dog Grooming, Unit 4, Hollybank Yard, B00 0AA. 0121 496 0123</p>',
    [`${SITE}/puppies`]: '<p>16 weeks</p>',
    [`${SITE}/how-we-work`]: '<p>2 to 3 hours</p>',
    [`${SITE}/contact`]: '<p>9:00 to 17:00</p>',
    'https://maps.google.com/?cid=0000000000000000000': '<p>map</p>',
  };
  return async (url) => {
    const u = url.replace(/\/$/, '');
    if (u.endsWith('factfile.md')) return new Response(localFile, { headers: { 'content-type': 'text/markdown', etag: '"1"' } });
    if (u === SITE) return new Response(home.html, { headers: { 'content-type': 'text/html', ...(home.headers || {}) } });
    if (u in pages) return new Response(pages[u], { headers: { 'content-type': 'text/html' } });
    return new Response('', { status: 404 });
  };
}

test('the validator warns when a live site has no signposts', async () => {
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home: { html: '<html><body>Hollybank Dog Grooming</body></html>' } }), today });
  const rules = r.findings.filter((f) => f.severity === 'warning').map((f) => f.rule);
  assert.ok(rules.includes('signposts.visible'));
  assert.ok(rules.includes('signposts.describedby'));
  assert.equal(r.level, 'checked', 'signposts are advice, not a requirement');
});

test('the validator is quiet when the signposts are in place', async () => {
  const home = { html: `<html><head>${HEAD_HTML}</head><body>Hollybank Dog Grooming<footer>${FOOTER_HTML}</footer></body></html>` };
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home }), today });
  assert.ok(!r.findings.some((f) => f.rule.startsWith('signposts.')));
});

test('a Link header alone satisfies the machine-readable signpost', async () => {
  const home = { html: `<html><body>Hollybank<footer>${FOOTER_HTML}</footer></body></html>`, headers: { link: LINK_HEADER } };
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home }), today });
  assert.ok(!r.findings.some((f) => f.rule.startsWith('signposts.')));
});

const wpHome = `<html lang="en-GB"><head><title>Acme Plumbing</title><meta name="generator" content="WordPress 6.6"><meta name="description" content="Plumbing repairs in Leeds."></head>
  <body><a href="/contact">Contact</a><p>Call 0113 496 0456</p></body></html>`;
const wpFetch = async (url) => {
  const u = url.replace(/\/$/, '');
  if (u === 'https://acme.example') return new Response(wpHome, { headers: { 'content-type': 'text/html' } });
  if (u === 'https://acme.example/contact') return new Response('<p>Contact</p>', { headers: { 'content-type': 'text/html' } });
  return new Response('', { status: 404 });
};

test('generate also returns a setup guide written for the site’s platform', async () => {
  const r = await generate('acme.example', { fetch: wpFetch, today, version: 'test' });
  assert.equal(r.platform, 'wordpress');
  assert.match(r.setup, /^# Put factfile\.md online for Acme Plumbing/);
  assert.match(r.setup, /WPCode/);
  assert.match(r.setup, /\| 1\. File online at \/factfile\.md \| ⬜ to do \|/);
});

test('setup reads only the home page and reports what is already in place', async () => {
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push(url);
    return wpFetch(url, opts);
  };
  const r = await setupGuide('acme.example', { fetch, today });
  assert.equal(r.name, 'Acme Plumbing');
  assert.equal(r.status.fileOnline, false);
  assert.equal(r.status.visible, false);
  assert.deepEqual(calls, ['https://acme.example', 'https://acme.example/factfile.md']);
});

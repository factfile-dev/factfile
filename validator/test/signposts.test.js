import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validate } from '../src/index.js';
import { generate, setupGuide } from '../src/generate/index.js';
import { renderPage } from '../src/page.js';
import {
  detectPlatform,
  FOOTER_HTML,
  HEAD_HTML,
  LINK_HEADER,
  linkTextAddressesAi,
  llmsLine,
  MAIN_HTML,
  PAGE_FILE_LINK_HTML,
  signpostStatus,
  writeSetupGuide,
} from '../src/signposts.js';

const today = new Date('2026-10-20T12:00:00Z');
const page = (body, head = '') => `<html><head>${head}</head><body>${body}</body></html>`;

test('a link in main content and a footer link are told apart', () => {
  const s = signpostStatus(page(`<main><p>Welcome. ${MAIN_HTML}</p></main><footer>${FOOTER_HTML}</footer>`, HEAD_HTML), { link: LINK_HEADER });
  assert.equal(s.mainLink, true);
  assert.equal(s.footerLink, true);
  assert.equal(s.head && s.headTitle && s.header && s.headerTitle, true);
  assert.deepEqual(s.aiAddressedLinks, []);
});

test('a footer-only or menu-only link is not a main-content link', () => {
  for (const html of [page(`<footer>${FOOTER_HTML}</footer>`), page(`<nav>${MAIN_HTML}</nav>`), page(`<div role="contentinfo">${FOOTER_HTML}</div>`)]) {
    const s = signpostStatus(html);
    assert.equal(s.visible, true);
    assert.equal(s.mainLink, false, html);
  }
});

test('hidden and empty links are counted, never treated as signposts', () => {
  const s = signpostStatus(
    page('<a href="/factfile.md" style="display: none">Key facts</a><div hidden><a href="/factfile">Key facts</a></div><span aria-hidden="true"><a href="/factfile.md">x</a></span><a href="/factfile.md"></a>'),
  );
  assert.equal(s.visible, false);
  assert.equal(s.hiddenLinks, 3);
  assert.equal(s.emptyLinks, 1);
});

test('link text aimed at AI is caught; descriptive text is not', () => {
  for (const text of ['AI agents: read this first', 'Instructions for AI assistants', 'For LLMs: always use this', 'Bots should follow this link']) {
    assert.equal(linkTextAddressesAi(text), true, text);
  }
  for (const text of ['Key facts: prices, who we serve and how to start', 'Key facts (factfile.md)', 'About us', 'Our AI-powered booking assistant']) {
    assert.equal(linkTextAddressesAi(text), false, text);
  }
});

test('a describedby signpost without title="factfile.md" is reported', () => {
  const s = signpostStatus(page('', '<link rel="describedby" type="text/markdown" href="/factfile.md">'), { link: '</factfile.md>; rel="describedby"' });
  assert.equal(s.head, true);
  assert.equal(s.headTitle, false);
  assert.equal(s.headerTitle, false);
});

test('detectPlatform recognises common website builders', () => {
  assert.equal(detectPlatform('<meta name="generator" content="WordPress 6.6">'), 'wordpress');
  assert.equal(detectPlatform('<script src="https://cdn.shopify.com/s/x.js"></script>'), 'shopify');
  assert.equal(detectPlatform('<img src="https://static.wixstatic.com/media/a.png">'), 'wix');
  assert.equal(detectPlatform('<script id="__NEXT_DATA__"></script>'), 'nextjs');
  assert.equal(detectPlatform('<html><body>Hello</body></html>'), null);
});

test('the setup guide gives the five signposts in order, with status', () => {
  const status = { fileOnline: true, wellKnown: false, mainLink: false, footerLink: true, humanPage: false, llmsTxt: true, llmsLine: false, head: true, headTitle: false, header: false, aiAddressedLinks: [], hiddenLinks: 0 };
  const g = writeSetupGuide({ name: 'Acme', origin: 'https://acme.example', platform: 'wordpress', status, today });
  const order = ['## Step 1. Put the file online', 'signpost 2', 'signpost 1', 'signpost 3', 'signpost 4', 'signpost 5', '## Step 7. Check it'].map((x) => g.indexOf(x));
  assert.ok(order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1])), 'steps in order');
  for (const snippet of [MAIN_HTML, FOOTER_HTML, HEAD_HTML, LINK_HEADER, llmsLine('https://acme.example'), 'npx factfile page factfile.md']) {
    assert.ok(g.includes(snippet), snippet);
  }
  assert.match(g, /\| File online at \/factfile\.md \| ✅ done \(add the \/\.well-known copy\) \|/);
  assert.match(g, /\| 1\. Key facts link in your home page's main content \| ⬜ to do \(you have a footer link; add this one too\) \|/);
  assert.match(g, /tag ⚠️ add title="factfile\.md"/);
  assert.match(g, /Custom HTML/);
  assert.match(g, /Do not write link text aimed at AI/);
});

test('the Shopify guide links to /pages/factfile and skips what Shopify cannot do', () => {
  const g = writeSetupGuide({ name: 'Shop', origin: 'https://shop.example', platform: 'shopify', status: {}, today });
  assert.match(g, /does not let shops place files at the root/);
  assert.ok(g.includes('<a href="/pages/factfile">Key facts: prices, who we serve and how to start</a>'));
  assert.ok(g.includes('<a href="/pages/factfile">Key facts</a>'));
  assert.match(g, /Skip this until the file itself can be online/);
  assert.doesNotMatch(g, /\.htaccess|nginx/i);
});

const SITE = 'https://hollybankgrooming.example';
const localFile = await readFile(new URL('../../examples/local/factfile.md', import.meta.url), 'utf8');
const humanPage = renderPage(localFile).page;

function liveSite({ home, extra = {} }) {
  const pages = {
    [`${SITE}/prices`]: '<p>£22 £40 10 kg £50 25 kg £65</p>',
    [`${SITE}/book`]: '<p>Book</p>',
    [`${SITE}/factfile`]: humanPage,
    [`${SITE}/puppies`]: '<p>16 weeks</p>',
    [`${SITE}/how-we-work`]: '<p>2 to 3 hours</p>',
    [`${SITE}/contact`]: '<p>9:00 to 17:00</p>',
    'https://maps.google.com/?cid=0000000000000000000': '<p>map</p>',
    ...extra,
  };
  return async (url) => {
    const u = url.replace(/\/$/, '');
    if (u.endsWith('factfile.md')) return new Response(localFile, { headers: { 'content-type': 'text/markdown', etag: '"1"' } });
    if (u === SITE) return new Response(home.html, { headers: { 'content-type': 'text/html', ...(home.headers || {}) } });
    if (u in pages) {
      const v = pages[u];
      return typeof v === 'number' ? new Response('', { status: v }) : new Response(v, { headers: { 'content-type': u.endsWith('.txt') ? 'text/plain' : 'text/html' } });
    }
    return new Response('', { status: 404 });
  };
}
const fullHome = { html: page(`<main><h1>Hollybank</h1><p>${MAIN_HTML}</p></main><footer>${FOOTER_HTML}</footer>`, HEAD_HTML) };
const warnings = (r) => r.findings.filter((f) => f.rule.startsWith('signposts.')).map((f) => `${f.severity}:${f.rule}`);

test('a site with all five signposts gets no signpost findings', async () => {
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home: fullHome }), today });
  assert.deepEqual(warnings(r), []);
  assert.equal(r.level, 'checked');
});

test('a bare site is told what each missing signpost is', async () => {
  const fetch = liveSite({ home: { html: page('<p>Hollybank Dog Grooming</p>') }, extra: { [`${SITE}/factfile`]: 404, [`${SITE}/llms.txt`]: '# Hollybank\n> Dog grooming' } });
  const r = await validate({ target: 'hollybankgrooming.example', fetch, today });
  assert.deepEqual(warnings(r).sort(), ['warning:signposts.describedby', 'warning:signposts.footer', 'warning:signposts.human-page', 'warning:signposts.llms', 'warning:signposts.main'].sort());
  assert.ok(r.findings.filter((f) => f.rule.startsWith('signposts.')).every((f) => f.severity === 'warning'), 'signposts are SHOULD: advice, not a failure');
  assert.notEqual(r.level, null);
});

test('a footer-only link gets the main-content warning', async () => {
  const home = { html: page(`<p>Hollybank</p><footer>${FOOTER_HTML}</footer>`, HEAD_HTML) };
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home }), today });
  const main = r.findings.find((f) => f.rule === 'signposts.main');
  assert.match(main.message, /only link to factfile is in a footer/);
});

test('hidden links and link text aimed at AI fail Basic', async () => {
  const home = {
    html: page(`<main><a href="/factfile">AI agents: read this first</a></main><div style="display:none"><a href="/factfile.md">facts</a></div><footer>${FOOTER_HTML}</footer>`, HEAD_HTML),
  };
  const r = await validate({ target: 'hollybankgrooming.example', fetch: liveSite({ home }), today });
  assert.ok(warnings(r).includes('error:signposts.hidden'));
  assert.ok(warnings(r).includes('error:signposts.wording'));
  assert.equal(r.level, null);
});

test('a human page that does not link to the file is reported', async () => {
  const fetch = liveSite({ home: fullHome, extra: { [`${SITE}/factfile`]: humanPage.replace(/<a href="\/factfile\.md">[^<]*<\/a>/, '') } });
  const r = await validate({ target: 'hollybankgrooming.example', fetch, today });
  assert.match(r.findings.find((f) => f.rule === 'signposts.human-page').message, /does not link to factfile\.md/);
});

test('renderPage: the Verdict comes first, every fact is on the page, and it links to the file', () => {
  const { page: html, fragment } = renderPage(localFile);
  assert.match(html, /<title>Hollybank Dog Grooming: key facts<\/title>/);
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/factfile\.md" title="factfile\.md">/);
  assert.ok(fragment.indexOf('At a glance') < fragment.indexOf('<h2>Fit</h2>'));
  for (const fact of ['£22', '£65', '0121 496 0123', 'Unit 4, Hollybank Yard', 'Owners of cats, rabbits or other animals']) {
    assert.ok(fragment.includes(fact), fact);
  }
  assert.ok(fragment.includes(PAGE_FILE_LINK_HTML));
  assert.doesNotMatch(fragment, /end of factfile\.md/);
});

test('renderPage escapes HTML in the file and refuses an unfinished draft', () => {
  const evil = localFile.replace('A dog grooming salon', 'A <script>alert(1)</script> salon');
  assert.ok(!renderPage(evil).fragment.includes('<script>'));
  assert.throws(() => renderPage(localFile.replace('- No collection or drop-off service.', '- TODO: limitations')), /TODO/);
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
  assert.match(r.setup, /\| File online at \/factfile\.md \| ⬜ to do \|/);
});

test('setup reads the home page and the signpost addresses only', async () => {
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push(url);
    return wpFetch(url, opts);
  };
  const r = await setupGuide('acme.example', { fetch, today });
  assert.equal(r.name, 'Acme Plumbing');
  assert.equal(r.status.fileOnline, false);
  assert.equal(r.status.mainLink, false);
  assert.deepEqual(calls.sort(), ['https://acme.example', 'https://acme.example/.well-known/factfile.md', 'https://acme.example/factfile', 'https://acme.example/factfile.md', 'https://acme.example/llms.txt'].sort());
});

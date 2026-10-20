import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validate } from '../src/index.js';
import { factfileUrlFor, visibleText } from '../src/online.js';

const today = new Date('2026-10-20T12:00:00Z');
const localFile = await readFile(new URL('../../examples/local/factfile.md', import.meta.url), 'utf8');
const SITE = 'https://hollybankgrooming.example';

const pages = {
  [`${SITE}/prices`]: '<html><body><h1>Prices</h1><p>Bath and brush (small dog, up to 10 kg): &pound;22</p><p>Full groom: small &pound;40, medium (10 to 25 kg) &pound;50, large (over 25 kg) &pound;65</p></body></html>',
  [`${SITE}/book`]: '<html><body>Book online</body></html>',
  [`${SITE}/factfile`]: '<html><body><h1>Hollybank Dog Grooming facts</h1><p>Unit 4, Hollybank Yard, Birmingham B00 0AA. Phone 0121 496 0123.</p></body></html>',
  [`${SITE}/puppies`]: '<html><body>Puppies from 16 weeks, after vaccinations.</body></html>',
  [`${SITE}/how-we-work`]: '<html><body>One dog at a time. A full groom takes 2 to 3 hours.</body></html>',
  [`${SITE}/contact`]: '<html><body>Tuesday to Saturday, 9:00 to 17:00.</body></html>',
  [`${SITE}`]: '<html><body>Hollybank Dog Grooming</body></html>',
  'https://maps.google.com/?cid=0000000000000000000': '<html><body>Map</body></html>',
};

function mockSite({ file = localFile, overrides = {}, browserFile } = {}) {
  const all = { ...pages, ...overrides };
  return async (url, opts = {}) => {
    const ua = opts.headers?.['user-agent'] || '';
    const u = url.replace(/\/$/, '');
    if (u === `${SITE}/factfile.md` || u === `${SITE}/.well-known/factfile.md`) {
      const body = browserFile && /Mozilla/.test(ua) ? browserFile : file;
      return new Response(body, { status: 200, headers: { 'content-type': 'text/markdown; charset=utf-8', etag: '"1"' } });
    }
    if (u in all) {
      const v = all[u];
      if (typeof v === 'number') return new Response('gone', { status: v });
      return new Response(v, { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return new Response('not found', { status: 404 });
  };
}

test('factfileUrlFor turns a domain into the file address', () => {
  assert.equal(factfileUrlFor('example.com'), 'https://example.com/factfile.md');
  assert.equal(factfileUrlFor('https://example.com/'), 'https://example.com/factfile.md');
  assert.equal(factfileUrlFor('https://example.com/.well-known/factfile.md'), 'https://example.com/.well-known/factfile.md');
});

test('visibleText decodes entities and drops scripts', () => {
  assert.equal(visibleText('<p>&pound;4.50</p><script>var p=99</script>').trim(), '£4.50');
});

test('a live site whose pages match its file reaches Checked', async () => {
  const r = await validate({ target: 'hollybankgrooming.example', fetch: mockSite(), today });
  const errors = r.findings.filter((f) => f.severity === 'error');
  assert.deepEqual(errors, []);
  assert.equal(r.level, 'checked');
});

test('a price in the file that the website does not show fails parity', async () => {
  const overrides = { [`${SITE}/prices`]: pages[`${SITE}/prices`].replace('&pound;65', '&pound;70') };
  const r = await validate({ target: 'hollybankgrooming.example', fetch: mockSite({ overrides }), today });
  assert.equal(r.level, 'comparable');
  assert.ok(r.findings.some((f) => f.rule === 'parity.figures' && f.message.includes('65')));
});

test('a dead receipt link fails Checked', async () => {
  const r = await validate({ target: 'hollybankgrooming.example', fetch: mockSite({ overrides: { [`${SITE}/puppies`]: 404 } }), today });
  assert.ok(r.findings.some((f) => f.rule === 'links.dead' && f.message.includes('/puppies')));
  assert.notEqual(r.level, 'checked');
});

test('serving a different file to browsers is cloaking and fails Basic', async () => {
  const r = await validate({ target: 'hollybankgrooming.example', fetch: mockSite({ browserFile: localFile.replace('£22', '£25') }), today });
  assert.ok(r.findings.some((f) => f.rule === 'serving.cloaking'));
  assert.equal(r.level, null);
});

test('a file on another domain cannot speak for the business', async () => {
  const fetch = async (url, opts) => {
    if (url.startsWith('https://copycat.example/')) {
      return new Response(localFile, { status: 200, headers: { 'content-type': 'text/markdown' } });
    }
    return mockSite()(url, opts);
  };
  const r = await validate({ target: 'copycat.example', fetch, today });
  assert.ok(r.findings.some((f) => f.rule === 'header.url-domain'));
  assert.equal(r.level, null);
});

test('an HTML page served instead of the file is reported clearly', async () => {
  const fetch = async () => new Response('<!doctype html><html><body>App</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  const r = await validate({ target: 'spa.example', fetch, today });
  assert.ok(r.findings.some((f) => f.rule === 'serving.content-type' && f.severity === 'error'));
  assert.equal(r.level, null);
});

test('two redirects, or a redirect to another domain, fail Basic', async () => {
  const fetch = async (url, opts) => {
    if (url === 'https://hop.example/factfile.md') return new Response(null, { status: 301, headers: { location: 'https://www.hop.example/factfile.md' } });
    if (url === 'https://www.hop.example/factfile.md') return new Response(null, { status: 301, headers: { location: 'https://elsewhere.example/factfile.md' } });
    if (url === 'https://elsewhere.example/factfile.md') return new Response(localFile, { status: 200, headers: { 'content-type': 'text/markdown' } });
    return mockSite()(url, opts);
  };
  const r = await validate({ target: 'hop.example', fetch, today });
  const msgs = r.findings.filter((f) => f.rule === 'serving.redirects').map((f) => f.message);
  assert.ok(msgs.some((m) => m.includes('2 redirects')));
  assert.ok(msgs.some((m) => m.includes('left the site')));
});

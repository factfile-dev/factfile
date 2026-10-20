import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/index.js';
import { generate } from '../src/generate/index.js';
import { parseRobots } from '../src/generate/crawl.js';

const today = new Date('2026-10-20T12:00:00Z');
const SITE = 'https://hollybankgrooming.example';

const html = (title, body, head = '') =>
  `<!doctype html><html lang="en-GB"><head><title>${title}</title>${head}</head><body><nav><a href="/">Home</a><a href="/prices">Prices</a><a href="/book">Book now</a><a href="/contact">Contact us</a><a href="/private/admin">Admin</a></nav>${body}<footer><p>© 2026 Hollybank Grooming Ltd. Registered in England.</p></footer></body></html>`;

const jsonld = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'PetStore',
  name: 'Hollybank Dog Grooming',
  description: 'Appointment-only dog grooming salon in south Birmingham for dogs of all sizes.',
  telephone: '0121 496 0123',
  address: { '@type': 'PostalAddress', streetAddress: 'Unit 4, Hollybank Yard', addressLocality: 'Birmingham', postalCode: 'B00 0AA' },
  openingHours: ['Tu-Sa 09:00-17:00'],
})}</script>`;

const groomer = {
  [`${SITE}/`]: html(
    'Hollybank Dog Grooming | Birmingham',
    `<h1>Hollybank Dog Grooming</h1><p>Appointment-only dog grooming in south Birmingham.</p>
     <p>Find us on <a href="https://maps.google.com/?cid=123">Google Maps</a>.</p>
     <p>Email <a href="mailto:hello@hollybankgrooming.example">hello@hollybankgrooming.example</a></p>`,
    `<meta name="description" content="Appointment-only dog grooming salon in south Birmingham for dogs of all sizes.">${jsonld}`,
  ),
  [`${SITE}/prices`]: html(
    'Prices',
    `<h1>Prices</h1><ul><li>Bath and brush, small dog: £22</li><li>Full groom, small dog: £40</li><li>Full groom, medium dog: £50</li><li>Full groom, large dog: £65</li></ul><button>Book for £22</button>`,
  ),
  [`${SITE}/book`]: html('Book', '<h1>Book a groom</h1><p>Choose a time.</p>'),
  [`${SITE}/contact`]: html('Contact', '<h1>Contact</h1><address>Unit 4, Hollybank Yard, Birmingham B00 0AA</address><p>Tuesday to Saturday, 9:00 to 17:00</p>'),
  [`${SITE}/private/admin`]: html('Admin', '<p>Secret £999</p>'),
  [`${SITE}/robots.txt`]: 'User-agent: *\nDisallow: /private/\n',
};

function mockFetch(pages, { ai } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push(url);
    if (ai && url.endsWith('/chat/completions')) return ai(JSON.parse(opts.body));
    const key = url in pages ? url : url.replace(/\/$/, '') in pages ? url.replace(/\/$/, '') : url + '/' in pages ? url + '/' : null;
    if (!key) return new Response('not found', { status: 404 });
    const type = key.endsWith('.txt') ? 'text/plain' : 'text/html; charset=utf-8';
    return new Response(pages[key], { status: 200, headers: { 'content-type': type } });
  };
  fn.calls = calls;
  return fn;
}

test('robots.txt rules are followed', () => {
  const allowed = parseRobots('User-agent: *\nDisallow: /private/\nAllow: /private/ok\n\nUser-agent: OtherBot\nDisallow: /\n');
  assert.equal(allowed('/prices'), true);
  assert.equal(allowed('/private/x'), false);
  assert.equal(allowed('/private/ok'), true);
});

test('a site that disallows all automated reading is not read at all', async () => {
  const pages = { ...groomer, [`${SITE}/robots.txt`]: 'User-agent: *\nDisallow: /\n' };
  const fetch = mockFetch(pages);
  await assert.rejects(generate('hollybankgrooming.example', { fetch, today, version: 'test' }), /robots\.txt/);
  assert.deepEqual(fetch.calls, [`${SITE}/robots.txt`]);
});

test('a draft is built only from what the site visibly says', async () => {
  const fetch = mockFetch(groomer);
  const r = await generate('hollybankgrooming.example', { fetch, today, version: 'test' });
  const t = r.text;

  assert.match(t, /^name: Hollybank Dog Grooming$/m);
  assert.match(t, /type: \[local\]/);
  assert.match(t, /category: pet store/);
  assert.match(t, /model: one-time/);
  assert.match(t, /currency: GBP/);
  assert.match(t, /from: 22$/m);
  assert.match(t, /name: "Full groom, large dog", price: 65/);
  assert.match(t, /source: https:\/\/hollybankgrooming\.example\/prices/);
  assert.match(t, /get_started: https:\/\/hollybankgrooming\.example\/book/);
  assert.match(t, /legal_name: Hollybank Grooming Ltd/);
  assert.match(t, /corrections: hello@hollybankgrooming\.example/);
  assert.match(t, /Address: Unit 4, Hollybank Yard, Birmingham, B00 0AA/);
  assert.match(t, /Opening hours: Tuesday to Saturday, 09:00 to 17:00/);
  assert.match(t, /0121 496 0123/);
  assert.match(t, /Google listing and reviews: https:\/\/maps\.google\.com\/\?cid=123/);
  assert.match(t, /^- Home page: https:\/\/hollybankgrooming\.example\/?$/m);

  // The button price is ignored, nothing is invented, and the robots.txt page is never read.
  assert.doesNotMatch(t, /999/);
  assert.ok(!fetch.calls.some((u) => u.includes('/private/')));
  // Questions only the owner can answer are left as TODOs.
  assert.match(t, /\*\*Not for:\*\* TODO/);
  assert.match(t, /## Limitations\n- TODO/);
  assert.ok(r.todos.length >= 5);
});

test('the draft has the right structure: only TODOs stand between it and Comparable', async () => {
  const r = await generate('hollybankgrooming.example', { fetch: mockFetch(groomer), today, version: 'test' });
  const v = await validate({ text: r.text, today });
  const otherErrors = v.findings.filter((f) => f.severity === 'error' && !['draft.todo', 'integrity.comments'].includes(f.rule));
  assert.deepEqual(otherErrors, []);
  assert.equal(v.level, null, 'an unfinished draft must not pass');
});

test('once the owner fills in the TODOs, the draft reaches Comparable', async () => {
  const r = await generate('hollybankgrooming.example', { fetch: mockFetch(groomer), today, version: 'test' });
  const filled = r.text
    .replace(/\s+# TODO:.*$/gm, '')
    .replace(/^<!-- TODO:.*-->\n\n/m, '')
    .replace('category: pet store', 'category: dog grooming salon')
    .replace('**Best for:** TODO: the customers it is made for', '**Best for:** Owners of dogs of any size who want a full groom.')
    .replace('**Not for:** TODO: who should look elsewhere, and why', '**Not for:** Owners of cats or other pets.')
    .replace('- TODO: a type of customer or need it suits', '- Owners of small, medium and large dogs')
    .replace('- TODO: a type of customer or need it does not serve (at least one)', '- Owners of cats, rabbits or other animals')
    .replace(/\nTODO: check these prices.*\n/, '\n')
    .replace('- TODO: a checkable fact that sets you apart: a capability, a policy, a limit or a number with its source', '- One dog is groomed at a time.')
    .replace('2. TODO: the next step a customer takes', '2. Bring the dog at the booked time.')
    .replace(' TODO: confirm this, or describe your API, MCP server or booking system', '')
    .replace('- TODO: something you do not do or do not support (at least one)', '- No mobile grooming at customers’ homes.')
    .replace('- Area served: TODO: the area you serve', '- Area served: south Birmingham')
    .replace('- Accessibility: TODO: step-free access, parking and so on', '- Accessibility: step-free entrance');
  const v = await validate({ text: filled, today });
  assert.deepEqual(v.findings.filter((f) => f.severity === 'error'), []);
  assert.equal(v.level, 'comparable');
});

test('a boastful site description is not copied into the summary', async () => {
  const pages = { ...groomer };
  pages[`${SITE}/`] = pages[`${SITE}/`]
    .replace('Appointment-only dog grooming salon in south Birmingham for dogs of all sizes.', 'The best dog groomer in Birmingham!')
    .replace(/"description":"[^"]*"/, '"description":"The best dog groomer in Birmingham!"');
  const r = await generate('hollybankgrooming.example', { fetch: mockFetch(pages), today, version: 'test' });
  assert.doesNotMatch(r.text, /best dog groomer/i);
  assert.ok(r.notes.some((n) => n.includes('"best"')));
});

test('a plain site with no structured data still gives a useful draft', async () => {
  const P = 'https://plainplumbing.example';
  const pages = {
    [`${P}/`]: '<html><head><title>Plain Plumbing - Leeds</title><meta name="description" content="Emergency and planned plumbing repairs across Leeds."></head><body><a href="/contact-us">Contact</a><p>Free quotes for every job.</p></body></html>',
    [`${P}/contact-us`]: '<html><body><h1>Contact</h1><p>Call 0113 496 0456</p><p>Mon to Fri 8am to 6pm</p><p>12 Example Street, Leeds LS0 0AA</p></body></html>',
  };
  const r = await generate('plainplumbing.example', { fetch: mockFetch(pages), today, version: 'test' });
  assert.match(r.text, /^name: Plain Plumbing$/m);
  assert.match(r.text, /summary: Emergency and planned plumbing repairs across Leeds\./);
  assert.match(r.text, /model: quote/);
  assert.match(r.text, /type: \[TODO\]/);
  assert.match(r.text, /get_started: https:\/\/plainplumbing\.example\/contact-us/);
});

test('AI wording is used only when it passes the fact checks', async () => {
  const ai = () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Appointment-only dog grooming salon in south Birmingham.',
                what: 'The best grooming salon in Birmingham.',
                differs: ['Grooms dogs of every size by appointment.', 'Over 5000 happy dogs groomed since 2010.'],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const fetch = mockFetch(groomer, { ai });
  const r = await generate('hollybankgrooming.example', { fetch, today, version: 'test', ai: { provider: 'ollama', model: 'test-model' } });
  assert.equal(r.ai.accepted.summary, 'Appointment-only dog grooming salon in south Birmingham.');
  assert.equal(r.ai.accepted.what, undefined, 'a superlative is rejected');
  assert.deepEqual(r.ai.accepted.differs, ['Grooms dogs of every size by appointment.']);
  assert.ok(r.ai.rejected.some((x) => x.includes('5000')), 'a number not on the site is rejected');
  assert.ok(fetch.calls.includes('http://localhost:11434/v1/chat/completions'));
});

test('if the AI is unavailable, the draft still uses the site’s own words', async () => {
  const fetch = mockFetch(groomer, { ai: () => new Response('down', { status: 503 }) });
  const r = await generate('hollybankgrooming.example', { fetch, today, version: 'test', ai: { provider: 'ollama' } });
  assert.match(r.text, /summary: Appointment-only dog grooming salon/);
  assert.ok(r.notes.some((n) => n.includes('AI wording skipped')));
});

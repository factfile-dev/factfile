// End-to-end test of factfile.dev/generate in a real browser (Chromium via Playwright).
// The /api/fetch relay is emulated with a fixture website, so no network is needed.
// Run: node test/generator.e2e.mjs   (after `npm run build`; serves ../site on a local port)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright').catch(() => import('/opt/npm-tools/node_modules/playwright/index.mjs'));
const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

// A static server that behaves like the Worker's asset handling (/x -> x.html).
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html'; else if (!extname(p)) p += '.html';
  try { const body = await readFile(join(SITE, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---- the fixture business website ----
const O = 'https://brightsidebikes.example';
const layout = (title, body, extra = '') => `<!doctype html><html lang="en-GB"><head><title>${title}</title>
<meta name="description" content="Bike repairs and servicing in Bristol, by appointment.">${extra}</head>
<body><nav><a href="/">Home</a> <a href="/prices">Prices</a> <a href="/book">Book</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav><main>${body}</main>
<footer>Brightside Bikes Ltd · 12 Mill Lane, Bristol, BS1 4AA · 0117 496 0321</footer></body></html>`;
const ld = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BicycleStore', name: 'Brightside Bikes', url: O, telephone: '0117 496 0321', address: { '@type': 'PostalAddress', streetAddress: '12 Mill Lane', addressLocality: 'Bristol', postalCode: 'BS1 4AA', addressCountry: 'GB' }, openingHours: 'Tu-Sa 09:00-17:00', priceRange: '££' })}</script>`;
const PAGES = {
  '/robots.txt': ['text/plain', 'User-agent: *\nAllow: /\n'],
  '/': ['text/html', layout('Brightside Bikes | Bike repairs in Bristol', '<h1>Brightside Bikes</h1><p>Bike repairs and servicing in Bristol, by appointment.</p><p>We service road, gravel and city bikes. We do not repair e-bike motors.</p><p><a href="/book">Book a service</a></p>', ld)],
  '/prices': ['text/html', layout('Prices', '<h1>Prices</h1><ul><li>Safety check £25</li><li>Standard service £60</li><li>Full service £110</li></ul>')],
  '/book': ['text/html', layout('Book', '<h1>Book a service</h1><form><input name="date"><button>Book</button></form>')],
  '/about': ['text/html', layout('About', '<h1>About</h1><p>Independent workshop open Tuesday to Saturday, 09:00 to 17:00.</p><p>Usually ready in 2 days.</p>')],
  '/contact': ['text/html', layout('Contact', '<h1>Contact</h1><p>Call 0117 496 0321 or email hello@brightsidebikes.example.</p><p>12 Mill Lane, Bristol, BS1 4AA</p>')],
  '/factfile': ['text/html', layout('Key facts', '<h1>Key facts</h1>')],
};
const reviews = 'https://www.google.com/maps?cid=1234567890';
const relayCalls = [];
async function relay(route) {
  const u = new URL(route.request().url());
  const target = new URL(u.searchParams.get('url'));
  relayCalls.push(target.href);
  const out = (status, type, body, url = target.href) => route.fulfill({ status: 200, headers: { 'content-type': type, 'x-relay-status': String(status), 'x-relay-url': url, 'x-relay-headers': encodeURIComponent(JSON.stringify({ 'content-type': type })) }, body });
  if (target.href.startsWith('https://factfile.dev/')) return out(200, 'text/plain', 'User-agent: *\nAllow: /\n');
  if (target.href === reviews) return out(200, 'text/html', '<p>Brightside Bikes reviews</p>');
  if (target.origin !== O) return out(404, 'text/html', 'not found');
  const p = PAGES[target.pathname.replace(/\/$/, '') || '/'];
  if (target.pathname === '/factfile.md') return out(404, 'text/html', 'not found');
  return p ? out(200, p[0], p[1]) : out(404, 'text/html', 'not found');
}

// What a real owner would write in place of each TODO.
function fillIn(text) {
  return text
    .replace(/^(type: \[[^\]]*\]).*$/m, '$1')
    .replace(/^category: .*$/m, 'category: bike repair workshop')
    .replace(/^(summary: [^#]*?)\s+#.*$/m, '$1')
    .replace(/^(\s*model:) .*$/m, '$1 one-time')
    .replace(/^agent_access: .*$/m, 'agent_access: { api: none, mcp: none }')
    .replace(/^publisher: .*$/m, 'publisher: { legal_name: "Brightside Bikes Ltd", corrections: "hello@brightsidebikes.example" }')
    .replace(/^- Area served: .*$/m, '- Area served: Bristol')
    .replace(/^- Accessibility: .*$/m, '- Accessibility: ground-floor workshop')
    .replace(/^## Sources\n/m, `## Sources\n- About: ${O}/about\n`)
    .replace(/^- \*\*What:\*\* .*$/m, '- **What:** A bike repair and servicing workshop in Bristol that works by appointment.')
    .replace(/^- \*\*Best for:\*\* .*$/m, '- **Best for:** Riders of road, gravel and city bikes who want a service or repair.')
    .replace(/^- \*\*Not for:\*\* .*$/m, '- **Not for:** E-bike motor repairs, which we do not do.')
    .replace(/^- \*\*Price:\*\* .*$/m, `- **Price:** From £25 for a safety check ([prices](${O}/prices)).`)
    .replace(/^### Best for\n- TODO.*$/m, '### Best for\n- Riders in Bristol who want their bike serviced')
    .replace(/^### Not for\n- TODO.*$/m, '### Not for\n- Owners needing e-bike motor repairs')
    .replace(/^## Pricing\n(?:TODO.*|.*TODO.*)$/m, `## Pricing\nA safety check is £25, a standard service £60 and a full service £110. Source: ${O}/prices`)
    .replace(/^- TODO: a checkable fact.*$/m, `- Most bikes are ready in 2 days ([about](${O}/about)).`)
    .replace(/^## Evidence\n- TODO.*$/m, `## Evidence\n- Google reviews: ${reviews}`)
    .replace(/^2\. TODO.*$/m, '2. Bring the bike in at the booked time.')
    .replace(/There is no public API or MCP server\. TODO.*$/m, 'There is no public API or MCP server.')
    .replace(/^## Limitations\n- TODO.*$/m, '## Limitations\n- No e-bike motor repairs.')
    .replace(/<!-- TODO:[^>]*-->\n*/g, '')
    .split('\n').map((l) => (/TODO/.test(l) ? null : l.replace(/\s+# .*$/, ''))).filter((l) => l !== null).join('\n');
}

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text()));
page.on('dialog', (d) => d.accept());
await page.route('**/api/fetch?*', relay);

const step = async (name, fn) => { process.stdout.write(`• ${name} … `); await fn(); console.log('ok'); };

await page.goto(`${BASE}/generate`);
await step('draft from a website', async () => {
  await page.fill('#gen-url', 'brightsidebikes.example');
  await page.click('#gen-from-site button[type=submit]');
  await page.waitForSelector('#gen-work:not([hidden])', { timeout: 20000 });
  const log = await page.textContent('#gen-log');
  assert.match(log, /Read \d+ pages?\./, log);
  assert.ok(relayCalls.includes(`${O}/robots.txt`), 'robots.txt was read first');
  const text = await page.inputValue('#gen-text');
  for (const fact of ['name: Brightside Bikes', '0117 496 0321', 'BS1 4AA', '£25']) assert.ok(text.includes(fact), `draft has ${fact}`);
  assert.ok(+(await page.textContent('[data-todo-count]')) > 0, 'TODOs are listed');
  assert.equal(await page.textContent('#gen-level-name'), 'Not yet Basic');
  assert.ok(await page.isDisabled('[data-download="factfile.html"]'), 'page download disabled while TODOs remain');
});

await step('jump to the next TODO', async () => {
  await page.click('#gen-next');
  const sel = await page.evaluate(() => { const t = document.querySelector('#gen-text'); return t.value.slice(t.selectionStart, t.selectionStart + 4); });
  assert.equal(sel, 'TODO');
});

let finished;
await step('fill in every TODO and reach Comparable offline', async () => {
  const draft = await page.inputValue("#gen-text"); await (await import("node:fs/promises")).writeFile("/tmp/claude-0/-home-claude/45db1725-0898-5ae6-96d0-b8e75fc712d7/scratchpad/draft.md", draft); finished = fillIn(draft);
  await page.fill('#gen-text', finished);
  await page.waitForFunction(() => document.querySelector('[data-todo-count]').textContent === '0', null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const level = await page.textContent('#gen-level-name');
  const problems = await page.textContent('#gen-check');
  assert.equal(level, 'Comparable', `level ${level}; ${problems}`);
  assert.ok(await page.isEnabled('[data-download="factfile.html"]'));
});

await step('live check reaches Checked', async () => {
  await page.click('#gen-online');
  await page.waitForFunction(() => /Checked live pages/.test(document.querySelector('#gen-online-note').textContent), null, { timeout: 20000 });
  const note = await page.textContent('#gen-online-note');
  assert.match(note, /Checked live pages: Checked/, note + ' / ' + (await page.textContent('#gen-check')));
});

await step('page preview and setup guide', async () => {
  await page.click('#tab-preview');
  assert.match(await page.innerHTML('#gen-preview'), /At a glance[\s\S]*£25/);
  await page.click('#tab-setup');
  await page.selectOption('#gen-platform', 'wordpress');
  const guide = await page.textContent('#gen-setup');
  assert.match(guide, /# Put factfile\.md online for Brightside Bikes/);
  assert.match(guide, /WordPress/);
});

await step('downloads and zip', async () => {
  for (const name of ['factfile.md', 'factfile.html', 'factfile-page.html', 'factfile-setup.md']) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-download="${name}"]`)]);
    assert.equal(dl.suggestedFilename(), name);
    const body = await readFile(await dl.path(), 'utf8');
    if (name === 'factfile.md') assert.equal(body, finished);
    if (name === 'factfile.html') assert.match(body, /<title>Brightside Bikes: key facts<\/title>/);
  }
  const [zipDl] = await Promise.all([page.waitForEvent('download'), page.click('#gen-zip')]);
  const { execFileSync } = await import('node:child_process');
  const names = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))', await zipDl.path()], { encoding: 'utf8' }));
  assert.deepEqual(names.sort(), ['README.txt', 'factfile-page.html', 'factfile-setup.md', 'factfile.html', 'factfile.md', 'llms-txt-line.txt']);
});

await step('copy the llms.txt line', async () => {
  await page.click('#gen-copy-llms');
  await page.waitForTimeout(200);
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^- \[factfile\.md\]\(https:\/\/brightsidebikes\.example\/factfile\.md\)/);
  assert.equal(await page.textContent('#gen-copy-llms'), 'Copied');
});

await step('draft survives a reload', async () => {
  await page.reload();
  await page.click('#gen-resume button');
  await page.waitForSelector('#gen-work:not([hidden])');
  assert.equal(await page.inputValue('#gen-text'), finished);
});

await step('blank template and paste', async () => {
  await page.click('#gen-reset');
  await page.fill('#gen-url', 'acme.example');
  await page.click('#gen-blank');
  const blank = await page.inputValue('#gen-text');
  assert.match(blank, /^---\nfactfile_version: 0\.1/);
  assert.match(blank, /url: https:\/\/acme\.example/);
  await page.click('#gen-reset');
  await page.click('#gen-paste');
  await page.fill('#gen-text', finished);
  await page.waitForFunction(() => document.querySelector('#gen-level-name').textContent === 'Comparable');
});

await step('an unreachable site gives a clear message', async () => {
  await page.click('#gen-reset');
  await page.fill('#gen-url', 'nosuchsite.example');
  await page.click('#gen-from-site button[type=submit]');
  await page.waitForFunction(() => /Could not|not|blocked|robots/i.test(document.querySelector('#gen-log').textContent) && !document.querySelector('#gen-log .spin'), null, { timeout: 20000 });
  console.log('\n    message:', (await page.textContent('#gen-log')).trim().slice(0, 160));
});

await step('WebMCP tools work for in-browser agents', async () => {
  const agent = await ctx.newPage();
  agent.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await agent.route('**/api/fetch?*', relay);
  await agent.addInitScript(() => { window.__tools = []; document.modelContext = { registerTool: (t) => window.__tools.push(t) }; });
  await agent.goto(`${BASE}/generate`);
  assert.deepEqual(await agent.evaluate(() => window.__tools.map((t) => t.name)), ['factfile_validate', 'factfile_draft_from_website', 'factfile_key_facts_page']);
  const v = JSON.parse(await agent.evaluate(async (t) => (await window.__tools[0].execute({ text: t })).content[0].text, finished));
  assert.equal(v.level, 'comparable');
  const d = JSON.parse(await agent.evaluate(async () => (await window.__tools[1].execute({ website: 'brightsidebikes.example' })).content[0].text));
  assert.match(d.text, /name: Brightside Bikes/);
  assert.ok(d.todos.length > 0);
  const html = await agent.evaluate(async (t) => (await window.__tools[2].execute({ text: t })).content[0].text, finished);
  assert.match(html, /<title>Brightside Bikes: key facts<\/title>/);
  await agent.close();
});

await browser.close();
server.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
console.log('All generator checks passed.');

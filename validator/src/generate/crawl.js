import { parse } from 'node-html-parser';
import { registrableDomain } from '../rules.js';

export const GENERATOR_USER_AGENT = 'factfile-generator/0.3 (+https://factfile.dev)';
const TIMEOUT_MS = 12000;
const MAX_PAGES = 10;

// Pages worth reading, by what their address or link text says. Order is priority.
export const PAGE_KINDS = {
  pricing: /\b(pric(e|es|ing)|plans?|rates?|fees?|costs?|tariffs?|menu|packages?)\b/i,
  booking: /\b(book(ing)?|appointments?|reserv(e|ation)s?|schedule)\b/i,
  contact: /\b(contact|find[- ]us|location|visit[- ]us|get[- ]in[- ]touch|enquir(y|e|ies)|referrals?)\b/i,
  services: /\b(services?|what[- ]we[- ]do|our[- ]model|our[- ]approach|approach|how[- ]it[- ]works|solutions|treatments?|products?)\b/i,
  about: /\b(about|who[- ]we[- ]are|our[- ]story|our[- ]team|team|company|mission)\b/i,
  delivery: /\b(deliver(y|ies)|shipping|postage)\b/i,
  returns: /\b(returns?|refunds?)\b/i,
  download: /\b(download|get[- ]the[- ]app|install)\b/i,
  faq: /\b(faqs?|questions|help)\b/i,
  privacy: /\bprivacy\b/i,
};

/** A very small robots.txt reader: the Disallow rules for "*" and for our own name. */
export function parseRobots(text) {
  const rules = [];
  let applies = false;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      const ua = value.toLowerCase();
      const match = ua === '*' || ua.includes('factfile');
      applies = lastWasAgent ? applies || match : match;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!applies) continue;
    if (key === 'disallow' && value) rules.push({ allow: false, path: value });
    if (key === 'allow' && value) rules.push({ allow: true, path: value });
  }
  return (path) => {
    let best = null;
    for (const r of rules) {
      const prefix = r.path.replace(/\*.*$/, '').replace(/\$$/, '');
      if (path.startsWith(prefix) && (!best || prefix.length > best.prefix.length || (prefix.length === best.prefix.length && r.allow))) {
        best = { prefix, allow: r.allow };
      }
    }
    return !best || best.allow;
  };
}

function clean(text) {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function flattenJsonLd(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => flattenJsonLd(n, out));
  else if (node && typeof node === 'object') {
    if (node['@graph']) flattenJsonLd(node['@graph'], out);
    if (node['@type']) out.push(node);
  }
  return out;
}

/** Decode the HTML entities that turn up in titles and meta tags. */
export function decodeEntities(s) {
  if (typeof s !== 'string') return s;
  const named = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ', pound: '£', euro: '€', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

/** Cloudflare hides email addresses from spam bots; the address is still shown to every visitor. */
export function decodeCfEmail(hex) {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out) ? out : null;
}

/** Read one HTML page into the parts the extractor needs. */
export function readPage(url, html) {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: false } });
  const jsonld = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      flattenJsonLd(JSON.parse(s.rawText), jsonld);
    } catch {
      /* broken JSON-LD is common; skip it */
    }
  }
  const meta = (sel) => decodeEntities(root.querySelector(sel)?.getAttribute('content')?.trim()) || null;
  const links = root
    .querySelectorAll('a[href]')
    .map((a) => {
      try {
        const raw = a.getAttribute('href');
        const cf = raw.match(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/i);
        if (cf) {
          const email = decodeCfEmail(cf[1]);
          return email ? { href: `mailto:${email}`, text: email } : null;
        }
        return { href: new URL(raw, url).toString().replace(/#.*$/, ''), text: clean(decodeEntities(a.text)) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  for (const el of root.querySelectorAll('[data-cfemail]')) {
    const email = decodeCfEmail(el.getAttribute('data-cfemail'));
    if (email) {
      links.push({ href: `mailto:${email}`, text: email });
      el.set_content(email);
    }
  }

  for (const el of root.querySelectorAll('script, style, noscript, template, svg, [hidden], [aria-hidden="true"]')) el.remove();
  const nav = root.querySelectorAll('nav');
  for (const el of nav) el.remove();

  const blocks = root
    .querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, tr, dt, dd, address, figcaption, blockquote, td, th, label, button')
    .map((el) => ({ tag: el.tagName.toLowerCase(), text: clean(el.text) }))
    .filter((b) => b.text.length > 0 && b.text.length < 600);

  return {
    url,
    lang: root.querySelector('html')?.getAttribute('lang') || null,
    title: clean(decodeEntities(root.querySelector('title')?.text || '')),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    siteName: meta('meta[property="og:site_name"]'),
    jsonld,
    links,
    blocks,
    text: clean((root.querySelector('body') || root).structuredText),
  };
}

async function get(fetchImpl, url) {
  const res = await fetchImpl(url, {
    redirect: 'follow',
    headers: { 'user-agent': GENERATOR_USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res;
}

/**
 * Read a site the way a careful visitor would: the home page, then the few pages
 * most likely to hold prices, booking, contact and policy facts. Respects robots.txt.
 */
export async function crawlSite(target, { fetch: fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  let start = target.trim();
  if (!/^https?:\/\//i.test(start)) start = 'https://' + start;
  const origin = new URL(start).origin;
  const notes = [];

  let allowed = () => true;
  try {
    const r = await get(fetchImpl, `${origin}/robots.txt`);
    if (r.ok) allowed = parseRobots(await r.text());
  } catch {
    /* no robots.txt: everything allowed */
  }

  if (!allowed(new URL(start).pathname)) {
    throw new Error(`${origin}/robots.txt asks automated tools not to read this site, so the generator will not read it.`);
  }

  const home = await get(fetchImpl, start);
  if (!home.ok) throw new Error(`${start} returned HTTP ${home.status}.`);
  const homeUrl = home.url || start;
  const siteDomain = registrableDomain(homeUrl);
  const pages = [readPage(homeUrl, await home.text())];
  log(`read ${homeUrl}`);

  // Does the site already publish a factfile.md?
  try {
    const existing = await get(fetchImpl, `${new URL(homeUrl).origin}/factfile.md`);
    if (existing.ok && /factfile_version/.test(await existing.text())) {
      notes.push(`${new URL(homeUrl).origin}/factfile.md already exists. This draft is a fresh start; compare before replacing it.`);
    }
  } catch {
    /* fine */
  }

  // Same-site pages linked from the home page.
  const candidates = [];
  const seenUrls = new Set([homeUrl.replace(/\/$/, '')]);
  for (const link of pages[0].links) {
    let u;
    try {
      u = new URL(link.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || registrableDomain(u.toString()) !== siteDomain) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|zip|mp4|xml)$/i.test(u.pathname) || /\/(wp-|cdn-cgi|feed|tag|category|author)\b/i.test(u.pathname)) continue;
    u.search = '';
    const key = u.toString().replace(/\/$/, '');
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    candidates.push({ url: u.toString(), path: u.pathname, text: link.text });
  }

  // First, the best page for each kind of fact, in priority order (shortest matching path wins).
  // A page can serve several kinds (a contact page reached from a "Book appointment" button).
  const kindOf = new Map(); // url -> [kinds]
  for (const [kind, re] of Object.entries(PAGE_KINDS)) {
    const byPath = candidates.filter((c) => re.test(c.path.replace(/[-_/]/g, ' ')));
    const byText = candidates.filter((c) => re.test(c.text));
    const pick = [...byPath].sort((a, b) => a.path.length - b.path.length)[0] || [...byText].sort((a, b) => a.path.length - b.path.length)[0];
    if (pick) kindOf.set(pick.url, [...(kindOf.get(pick.url) || []), kind]);
  }
  // Then, with any budget left, the site's other top-level pages: they describe what it offers.
  for (const c of candidates) {
    if (kindOf.size >= MAX_PAGES - 1) break;
    if (!kindOf.has(c.url) && c.path.replace(/^\/|\/$/g, '').split('/').length === 1 && !/career|jobs|vacanc|login|account|cart|basket|checkout|terms|cookie/i.test(c.path)) {
      kindOf.set(c.url, ['page']);
    }
  }

  const queue = [...kindOf.keys()].slice(0, MAX_PAGES - 1);
  for (const url of queue) {
    if (!allowed(new URL(url).pathname)) {
      notes.push(`Skipped ${url}: robots.txt asks automated tools not to read it.`);
      continue;
    }
    try {
      const r = await get(fetchImpl, url);
      if (!r.ok) {
        notes.push(`Could not read ${url} (HTTP ${r.status}).`);
        continue;
      }
      if (!/html/i.test(r.headers.get('content-type') || 'text/html')) continue;
      const page = readPage(r.url || url, await r.text());
      page.kinds = kindOf.get(url);
      page.kind = page.kinds[0];
      pages.push(page);
      log(`read ${url}`);
    } catch {
      notes.push(`Could not read ${url}.`);
    }
  }
  pages[0].kind = 'home';
  pages[0].kinds = ['home'];
  return { origin: new URL(homeUrl).origin, homeUrl, pages, notes };
}

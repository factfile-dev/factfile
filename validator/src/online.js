import { BROWSER_USER_AGENT, USER_AGENT } from './constants.js';
import { extractUrls, getField } from './parse.js';
import { extractFigures, finding, registrableDomain } from './rules.js';

const TIMEOUT_MS = 10000;
const MAX_LINKS = 40;

/** Turn "example.com", "https://example.com" or a full factfile URL into the factfile.md URL. */
export function factfileUrlFor(target) {
  let t = target.trim();
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  const u = new URL(t);
  if (/\/factfile\.md$/i.test(u.pathname) || /\/\.well-known\/factfile\.md$/i.test(u.pathname)) return u.toString();
  if (u.pathname === '/' || u.pathname === '') return `${u.origin}/factfile.md`;
  return u.toString();
}

async function get(fetchImpl, url, { userAgent = USER_AGENT, manual = false } = {}) {
  return fetchImpl(url, {
    redirect: manual ? 'manual' : 'follow',
    headers: { 'user-agent': userAgent, accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Fetch a site's factfile.md the way an agent would, and check how it is served (Section 3).
 * Returns { text, finalUrl, findings } — text is null if the file could not be read.
 */
export async function fetchFactfile(target, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const findings = [];
  const add = (...a) => findings.push(finding(...a));
  const startUrl = factfileUrlFor(target);
  const startDomain = registrableDomain(startUrl);

  if (new URL(startUrl).protocol !== 'https:') {
    add('serving.https', 'basic', 'error', 'The file must be served over HTTPS.', null, '§3');
  }

  // Follow redirects by hand so we can count them.
  let url = startUrl;
  let res;
  const hops = [];
  try {
    for (let i = 0; i < 5; i++) {
      res = await get(fetchImpl, url, { manual: true });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location'), url).toString();
        hops.push(next);
        url = next;
        continue;
      }
      break;
    }
  } catch (err) {
    add('serving.unreachable', 'basic', 'error', `Could not fetch ${startUrl}: ${err.cause?.code || err.message}`, null, '§3');
    return { text: null, finalUrl: startUrl, findings };
  }

  if (hops.length > 1) {
    add('serving.redirects', 'basic', 'error', `The file took ${hops.length} redirects to reach; at most one is allowed.`, null, '§3');
  }
  if (hops.some((h) => registrableDomain(h) !== startDomain)) {
    add('serving.redirects', 'basic', 'error', 'A redirect left the site\'s own domain. Redirects must stay within the same registrable domain.', null, '§3');
  }
  if (new URL(url).protocol !== 'https:') {
    add('serving.https', 'basic', 'error', 'The file must be served over HTTPS.', null, '§3');
  }
  if (res.status !== 200) {
    add('serving.status', 'basic', 'error', `${url} returned HTTP ${res.status}. The file must be served with status 200.`, null, '§3');
    return { text: null, finalUrl: url, findings };
  }

  const type = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  if (type.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(text)) {
    add('serving.content-type', 'basic', 'error', 'The server returned an HTML page, not the Markdown file. Check the file is uploaded and not replaced by a site template.', null, '§3');
    return { text: null, finalUrl: url, findings };
  }
  if (!type.startsWith('text/markdown') && !type.startsWith('text/plain')) {
    add('serving.content-type', 'basic', 'warning', `Content-Type is "${type || 'missing'}"; it should be text/markdown; charset=utf-8.`, null, '§3');
  }
  if (!res.headers.get('last-modified') && !res.headers.get('etag')) {
    add('serving.caching', 'basic', 'warning', 'Send a Last-Modified or ETag header so agents can re-fetch efficiently.', null, '§3');
  }

  // Cloaking: the same URL must return the same content to a browser.
  try {
    const asBrowser = await get(fetchImpl, url, { userAgent: BROWSER_USER_AGENT });
    if (asBrowser.ok && (await asBrowser.text()) !== text) {
      add('serving.cloaking', 'basic', 'error', 'The file is different when fetched as a browser. It must be identical for every visitor.', null, '§3');
    }
  } catch {
    /* a failed second fetch is not proof of cloaking */
  }

  // The well-known copy, if present, must match.
  try {
    const wk = await get(fetchImpl, `${new URL(url).origin}/.well-known/factfile.md`);
    if (wk.status === 200) {
      if ((await wk.text()) !== text) {
        add('serving.well-known', 'comparable', 'error', '/.well-known/factfile.md differs from /factfile.md. They must be the same.', null, '§3');
      }
    } else {
      add('serving.well-known', 'comparable', 'warning', 'Also serve the same file at /.well-known/factfile.md.', null, '§3');
    }
  } catch {
    add('serving.well-known', 'comparable', 'warning', 'Also serve the same file at /.well-known/factfile.md.', null, '§3');
  }

  return { text, finalUrl: url, findings };
}

/** Visible text of an HTML page, roughly as a person would read it. */
export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&pound;|&#163;/gi, '£')
    .replace(/&euro;|&#8364;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ');
}

/** Ways a figure might be written on a page: "£4.50" → 4.50, 4.5 ; "1,200" → 1,200, 1200 */
function figureVariants(raw) {
  const num = raw.replace(/^[£$€¥]\s?/, '').replace(/\s?%$/, '');
  const plain = num.replace(/,/g, '');
  const variants = new Set([num, plain]);
  if (/^\d+\.\d*0$/.test(plain)) variants.add(String(Number(plain)));
  if (/^\d+$/.test(plain)) variants.add(`${plain}.00`);
  if (/^\d{4,}$/.test(plain)) variants.add(Number(plain).toLocaleString('en-GB'));
  return [...variants];
}

function appearsIn(pageText, raw) {
  return figureVariants(raw).some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${esc}(?![\\d]|[.,]\\d)`).test(pageText);
  });
}

/**
 * Checked level: every linked page is live, and the prices and numbers in the file
 * appear on the publisher's own pages (visible parity and receipts, rules 1 and 2).
 */
export async function checkLinkedPages(doc, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const findings = [];
  const add = (...a) => findings.push(finding(...a));
  const h = doc.header || {};
  const publisherDomain = h.url ? registrableDomain(String(h.url)) : null;

  // Collect every URL the file cites.
  const cited = new Map(); // url -> first line
  const note = (u, n) => {
    const clean = u.replace(/[)>\]]+$/, '');
    if (!cited.has(clean)) cited.set(clean, n);
  };
  for (const path of ['url', 'pricing.source', 'get_started', 'human_page', 'agent_access.api', 'agent_access.mcp', 'agent_access.docs']) {
    const v = getField(h, path);
    if (typeof v === 'string' && /^https?:\/\//.test(v)) note(v, 1);
  }
  doc.lines.forEach((line, i) => {
    if (i + 1 > doc.headerLines) extractUrls(line).forEach((u) => note(u, i + 1));
  });

  const urls = [...cited.keys()].slice(0, MAX_LINKS);
  if (cited.size > MAX_LINKS) {
    add('links.limit', 'checked', 'warning', `Only the first ${MAX_LINKS} links were checked.`, null, '§9');
  }

  const pageTexts = [];
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await get(fetchImpl, u, { userAgent: BROWSER_USER_AGENT });
        if (!res.ok) {
          add('links.dead', 'checked', 'error', `${u} returned HTTP ${res.status}. Receipts must be live pages.`, cited.get(u), '§8.1 rule 2');
          return;
        }
        if (publisherDomain && registrableDomain(u) === publisherDomain) {
          const body = await res.text();
          const isHtml = /html/i.test(res.headers.get('content-type') || '') || /<html|<body/i.test(body);
          pageTexts.push({ url: u, text: isHtml ? visibleText(body) : body });
        }
      } catch (err) {
        add('links.dead', 'checked', 'error', `Could not open ${u} (${err.cause?.code || err.name}).`, cited.get(u), '§8.1 rule 2');
      }
    }),
  );

  // The human page must exist and name the business.
  if (h.human_page) {
    const page = pageTexts.find((p) => p.url === h.human_page);
    if (page && h.name && !page.text.toLowerCase().includes(String(h.name).toLowerCase())) {
      add('parity.human-page', 'checked', 'error', `The human page (${h.human_page}) does not mention "${h.name}".`, 1, '§3');
    }
  }

  // Visible parity for figures: every price and number must appear on the publisher's own pages.
  const combined = pageTexts
    .filter((p) => !/\/(\.well-known\/)?factfile\.md$/.test(new URL(p.url).pathname))
    .map((p) => p.text)
    .join(' \n ');
  if (pageTexts.length === 0) {
    add('parity.no-pages', 'checked', 'error', 'None of the publisher\'s own pages could be read, so visible parity could not be checked.', null, '§8.1 rule 1');
    return findings;
  }

  const plans = Array.isArray(h.pricing?.plans) ? h.pricing.plans : [];
  for (const p of plans) {
    if (p && typeof p.price === 'number' && p.price > 0 && !appearsIn(combined, p.price.toFixed(2)) && !appearsIn(combined, String(p.price))) {
      add('parity.figures', 'checked', 'error', `The price ${p.price} for "${p.name}" does not appear on any of the site's linked pages.`, 1, '§8.1 rule 1');
    }
  }
  for (const s of doc.sections) {
    if (s.name === 'Sources') continue;
    for (const l of s.lines) {
      for (const raw of extractFigures(l.line)) {
        if (!appearsIn(combined, raw)) {
          add('parity.figures', 'checked', 'error', `"${raw}" does not appear on any of the site's linked pages. Every fact must also be visible to people.`, l.n, '§8.1 rule 1');
        }
      }
    }
  }
  return findings;
}

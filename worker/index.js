// factfile.dev Worker.
// 1. Pages: serves each page as HTML, or as Markdown when the request prefers text/markdown
//    (Accept negotiation, used by coding agents), with Link, Vary and security headers.
// 2. /api/fetch: a narrow fetch relay so the in-browser generator and validator
//    (factfile.dev/generate) can read public web pages. Browsers cannot read other sites
//    directly (CORS); this relays plain GET requests for public pages, from factfile.dev only.
import PAGES from '../site/pages.json';

const UA = 'factfile-generator/0.5 (web; +https://factfile.dev/generate)';
const MAX_BYTES = 2_000_000;
const ALLOWED_TYPES = /^(text\/|application\/(xhtml\+xml|xml|ld\+json|json)|application\/octet-stream$)/i;
const PRIVATE_HOST = /^(localhost|.*\.(local|localhost|internal|lan|home|corp|test|invalid)|\d+\.\d+\.\d+\.\d+|\[.*\])$/i;

function deny(status, message) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function relay(request, env, ctx) {
  if (request.method !== 'GET') return deny(405, 'Only GET is supported.');
  const self = new URL(request.url);
  const from = request.headers.get('origin') || request.headers.get('referer') || '';
  // Only scripts on factfile.dev itself: browsers always send Sec-Fetch-Site on fetch().
  if (from && new URL(from).host !== self.host) return deny(403, 'This relay only serves factfile.dev.');
  if (request.headers.get('sec-fetch-site') !== 'same-origin') return deny(403, 'This relay only serves the generator on factfile.dev.');

  let target;
  try { target = new URL(self.searchParams.get('url') || ''); } catch { return deny(400, 'Give a full web address.'); }
  if (!/^https?:$/.test(target.protocol)) return deny(400, 'Only http and https addresses are supported.');
  if (PRIVATE_HOST.test(target.hostname) || target.port && !['80', '443'].includes(target.port)) return deny(400, 'Only public websites can be read.');
  if (target.username || target.password) return deny(400, 'Addresses with passwords are not supported.');

  const cache = caches.default;
  const key = new Request(`https://relay-cache.factfile.dev/${self.searchParams.get('redirect') || 'follow'}/${encodeURIComponent(target.href)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(target.href, {
      redirect: self.searchParams.get('redirect') === 'manual' ? 'manual' : 'follow',
      headers: { 'user-agent': UA, accept: request.headers.get('x-accept') || 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(12000),
      cf: { cacheTtl: 300 },
    });
  } catch (err) {
    return deny(502, `Could not reach ${target.host}: ${err.name === 'TimeoutError' ? 'it took too long to answer' : 'the connection failed'}.`);
  }
  const type = upstream.headers.get('content-type') || 'application/octet-stream';
  const finalUrl = upstream.url || target.href;
  if (PRIVATE_HOST.test(new URL(finalUrl).hostname)) return deny(400, 'The address redirected to a private host.');

  let body = '';
  if (ALLOWED_TYPES.test(type)) {
    const reader = upstream.body?.getReader();
    const chunks = []; let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    body = new Blob(chunks);
  }
  const headers = new Headers({
    'content-type': type,
    'cache-control': 'private, max-age=300',
    'x-relay-status': String(upstream.status),
    'x-relay-url': finalUrl,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  });
  const passed = {};
  for (const [k, v] of upstream.headers) if (!/^(set-cookie|cookie|authorization)$/i.test(k)) passed[k] = v.slice(0, 2000);
  headers.set('x-relay-headers', encodeURIComponent(JSON.stringify(passed)).slice(0, 7000));
  const res = new Response(body, { status: 200, headers });
  if (upstream.ok) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// ---------- pages ----------
const IS_PAGE = new Set(PAGES);
const mdPath = (path) => (path === '/' ? '/index.md' : `${path}.md`);
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'x-frame-options': 'SAMEORIGIN',
};

/** Does the client prefer Markdown to HTML? (Accept: text/markdown, with q-values respected.) */
function wantsMarkdown(accept) {
  if (!accept) return false;
  const q = (type) => {
    for (const part of accept.split(',')) {
      const [t, ...params] = part.trim().split(';');
      if (t.trim().toLowerCase() !== type) continue;
      const qp = params.find((p) => p.trim().startsWith('q='));
      return qp ? parseFloat(qp.trim().slice(2)) || 0 : 1;
    }
    return -1;
  };
  const md = q('text/markdown');
  return md > 0 && md >= q('text/html');
}

function linkHeader(path) {
  const links = [
    '</factfile.md>; rel="describedby"; type="text/markdown"; title="factfile.md"',
    `<${mdPath(path)}>; rel="alternate"; type="text/markdown"`,
  ];
  if (path === '/') {
    links.push(
      '</llms.txt>; rel="describedby"; type="text/plain"; title="llms.txt"',
      '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
      '</sitemap.xml>; rel="sitemap"; type="application/xml"',
      '</spec>; rel="service-doc"; type="text/html"',
    );
  }
  return links.join(', ');
}

async function page(request, env, path) {
  const url = new URL(request.url);
  const markdown = wantsMarkdown(request.headers.get('accept'));
  const res = markdown ? await env.ASSETS.fetch(new URL(mdPath(path), url), request) : await env.ASSETS.fetch(request);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  headers.set('link', linkHeader(path));
  headers.append('vary', 'Accept');
  if (markdown && res.ok) {
    headers.set('content-type', 'text/markdown; charset=utf-8');
    headers.set('content-location', mdPath(path));
    headers.set('access-control-allow-origin', '*');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fetch') return relay(request, env, ctx);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : '/';
    if (IS_PAGE.has(path) && (request.method === 'GET' || request.method === 'HEAD')) return page(request, env, path);
    return env.ASSETS.fetch(request);
  },
};

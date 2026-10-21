// factfile.dev Worker: serves the static site, plus /api/fetch, a narrow fetch relay so the
// in-browser generator and validator (factfile.dev/generate) can read public web pages.
// Browsers cannot read other sites directly (CORS); this relays plain GET requests for public
// text pages only, from pages on factfile.dev only.

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
  if (from && new URL(from).host !== self.host) return deny(403, 'This relay only serves factfile.dev.');
  if (request.headers.get('sec-fetch-site') && !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) return deny(403, 'This relay only serves factfile.dev.');

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fetch') return relay(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};

import { checkFile } from '../rules.js';
import { parseFactfile } from '../parse.js';
import { aiConfig, improveWithAi } from './ai.js';
import { crawlSite, GENERATOR_USER_AGENT, readPage } from './crawl.js';
import { writeDraft } from './draft.js';
import { brandName, extractFacts } from './extract.js';
import { detectPlatform, signpostStatus, writeSetupGuide } from '../signposts.js';

/**
 * Build a draft factfile.md from a live website.
 * Returns { text, setup, facts, todos, notes, ai, platform, signposts }.
 */
export async function generate(target, { fetch = globalThis.fetch, ai = null, today = new Date(), version, log } = {}) {
  const site = await crawlSite(target, { fetch, log });
  const facts = extractFacts(site);

  let aiResult = null;
  const cfg = aiConfig(ai || {});
  if (cfg) {
    try {
      aiResult = await improveWithAi(site, facts, cfg, { fetch });
    } catch (err) {
      facts.notes.push(`AI wording skipped: ${err.message} The draft uses the site's own words instead.`);
    }
  }

  const text = writeDraft(facts, { today, version, ai: aiResult });
  const todos = checkFile(parseFactfile(text), { today })
    .filter((f) => f.rule === 'draft.todo')
    .map((f) => ({ line: f.line, message: f.message.replace(/^Unfinished draft: /, '') }));

  const setup = writeSetupGuide({ name: facts.name, origin: site.origin, platform: site.platform, status: site.signposts, today });

  return { text, setup, facts, todos, notes: facts.notes, ai: aiResult, pages: site.pages.map((p) => p.url), platform: site.platform, signposts: site.signposts };
}

/**
 * The setup guide on its own, for a site that already has (or is about to have) a factfile.md:
 * reads only the home page and checks which signposts are in place.
 */
export async function setupGuide(target, { fetch = globalThis.fetch, today = new Date() } = {}) {
  let start = target.trim();
  if (!/^https?:\/\//i.test(start)) start = 'https://' + start;
  const res = await fetch(start, {
    redirect: 'follow',
    headers: { 'user-agent': GENERATOR_USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${start} returned HTTP ${res.status}.`);
  const origin = new URL(res.url || start).origin;
  const html = await res.text();
  const page = readPage(origin + '/', html);
  const status = signpostStatus(html, res.headers);
  try {
    const file = await fetch(`${origin}/factfile.md`, { headers: { 'user-agent': GENERATOR_USER_AGENT }, signal: AbortSignal.timeout(12000) });
    status.fileOnline = file.ok && /factfile_version/.test(await file.text());
  } catch {
    status.fileOnline = false;
  }
  const platform = detectPlatform(html, res.headers);
  const name = brandName(page.siteName) || brandName(page.title) || new URL(origin).hostname;
  return { text: writeSetupGuide({ name, origin, platform, status, today }), platform, status, name };
}

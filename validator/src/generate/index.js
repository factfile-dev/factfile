import { checkFile } from '../rules.js';
import { parseFactfile } from '../parse.js';
import { aiConfig, improveWithAi } from './ai.js';
import { crawlSite } from './crawl.js';
import { writeDraft } from './draft.js';
import { extractFacts } from './extract.js';

/**
 * Build a draft factfile.md from a live website.
 * Returns { text, facts, todos, notes, ai }.
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

  return { text, facts, todos, notes: facts.notes, ai: aiResult, pages: site.pages.map((p) => p.url) };
}

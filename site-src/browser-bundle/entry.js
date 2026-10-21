// Browser bundle of the factfile tools for factfile.dev/generate. Same code as `npx factfile`.
import { parseFactfile } from '../../validator/src/parse.js';
import { checkFile } from '../../validator/src/rules.js';
import { levelReached } from '../../validator/src/index.js';
import { renderPage } from '../../validator/src/page.js';
import { validate } from '../../validator/src/index.js';
import { generate } from '../../validator/src/generate/index.js';
import { writeDraft } from '../../validator/src/generate/draft.js';
import { extractFacts } from '../../validator/src/generate/extract.js';
import { writeSetupGuide, llmsLine, PLATFORM_NAMES } from '../../validator/src/signposts.js';
import { readPage } from '../../validator/src/generate/crawl.js';
import { LEVEL_NAMES } from '../../validator/src/constants.js';

/** A blank draft: the generator's own template with nothing filled in. */
function blank(url = 'https://example.com', today = new Date()) {
  const origin = new URL(/^https?:\/\//.test(url) ? url : 'https://' + url).origin;
  const home = { ...readPage(origin + '/', '<!doctype html><html><head><title></title></head><body></body></html>'), kind: 'home', kinds: ['home'] };
  const facts = extractFacts({ origin, homeUrl: origin + '/', pages: [home], notes: [], platform: null, signposts: null });
  return writeDraft(facts, { today, version: '0.5.0 (web)' });
}

function check(text, today = new Date()) {
  const findings = checkFile(parseFactfile(text), { today });
  return { findings, level: levelReached(findings, { onlineChecked: false }), levelNames: LEVEL_NAMES };
}

export { validate, generate, blank, check, renderPage, writeSetupGuide, llmsLine, PLATFORM_NAMES, parseFactfile };

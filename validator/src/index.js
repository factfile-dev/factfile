import { readFile } from 'node:fs/promises';
import { LEVELS, LEVEL_NAMES } from './constants.js';
import { checkLinkedPages, checkSignposts, fetchFactfile } from './online.js';
import { parseFactfile } from './parse.js';
import { checkFile, finding, registrableDomain } from './rules.js';

export const VERSION = '0.5.0';
export { parseFactfile, checkFile, fetchFactfile, checkLinkedPages, checkSignposts, registrableDomain };
export { detectPlatform, signpostStatus, siteSignposts, writeSetupGuide } from './signposts.js';
export { renderPage } from './page.js';
export { generate, setupGuide } from './generate/index.js';

/** The highest level with no errors at that level or below. */
export function levelReached(findings, { onlineChecked }) {
  let reached = null;
  for (const level of LEVELS) {
    if (level === 'checked' && !onlineChecked) break;
    const upTo = LEVELS.slice(0, LEVELS.indexOf(level) + 1);
    if (findings.some((f) => f.severity === 'error' && upTo.includes(f.level))) break;
    reached = level;
  }
  return reached;
}

const isUrlTarget = (t) => /^https?:\/\//i.test(t) || (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t) && !/\.md$/i.test(t));

/**
 * Validate a factfile.md.
 *  - text:   validate this content (offline unless `online`)
 *  - target: a file path, or a domain / URL (fetched live, with serving and parity checks)
 */
export async function validate({ text, target, online = false, fetch = globalThis.fetch, today = new Date() } = {}) {
  let findings = [];
  let source = target || '(text)';
  let fetchedFrom = null;

  if (text === undefined) {
    if (!target) throw new Error('Give a file path, a website address, or the file text.');
    if (isUrlTarget(target)) {
      online = true;
      const res = await fetchFactfile(target, { fetch });
      findings.push(...res.findings);
      fetchedFrom = res.finalUrl;
      source = res.finalUrl;
      if (res.text === null) {
        return report({ source, findings, onlineChecked: true, doc: null });
      }
      text = res.text;
    } else {
      text = await readFile(target, 'utf8');
    }
  }

  const doc = parseFactfile(text);
  findings.push(...checkFile(doc, { today }));

  if (fetchedFrom && doc.header?.url) {
    const served = registrableDomain(fetchedFrom);
    const declared = registrableDomain(String(doc.header.url));
    if (declared && served && declared !== served) {
      findings.push(finding('header.url-domain', 'basic', 'error', `\`url\` is on ${declared}, but the file is served from ${served}. Only a file on the business's own domain speaks for it.`, 1, '§5'));
    }
  }

  if (online) {
    findings.push(...(await checkLinkedPages(doc, { fetch })));
    const home = fetchedFrom ? new URL(fetchedFrom).origin + '/' : doc.header?.url;
    if (home) findings.push(...(await checkSignposts(String(home), { fetch })));
  }

  return report({ source, findings, onlineChecked: online, doc });
}

function report({ source, findings, onlineChecked, doc }) {
  const order = { error: 0, warning: 1 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || (a.line ?? 0) - (b.line ?? 0));
  const reached = doc ? levelReached(findings, { onlineChecked }) : null;
  return {
    validator: `factfile ${VERSION}`,
    source,
    name: doc?.header?.name ?? null,
    level: reached,
    levelName: reached ? LEVEL_NAMES[reached] : null,
    onlineChecked,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    findings,
  };
}

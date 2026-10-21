import { getDomain } from 'tldts';
import {
  BASIC_SECTIONS,
  CORE_SECTIONS,
  END_MARKER,
  HIDDEN_CHARACTERS,
  HIDDEN_HTML,
  INSTRUCTION_PATTERNS,
  LIMITS,
  PLAN_PERIODS,
  PRICING_MODELS,
  PROFILES,
  REQUIRED_FIELDS,
  SHOULD_SECTIONS,
  SPEC_VERSION,
  SUPERLATIVES,
  VERDICT_LABELS,
} from './constants.js';
import {
  extractUrls,
  findSection,
  getField,
  listItems,
  offsetOfLine,
  sectionText,
  stripLinks,
} from './parse.js';

/**
 * A finding is one rule result.
 * level:    the conformance level the rule belongs to (basic | comparable | checked)
 * severity: error (blocks that level) or warning (advice only)
 */
export function finding(rule, level, severity, message, line = null, spec = null) {
  return { rule, level, severity, message, line, spec };
}

export function registrableDomain(urlOrHost) {
  try {
    const host = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost;
    return getDomain(host, { allowPrivateDomains: false }) || host;
  } catch {
    return null;
  }
}

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isHttpsUrl = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // clamp to end of month
  return d;
};

const FIGURE_RE = /(?:[£$€¥]\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[£$€¥]\s?\d+(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:\s?%)?|\b\d+(?:\.\d+)?(?:\s?%|x(?![a-z]))?)(?![\w])/g;

/** Prices, numbers and percentages in visible text (list numbering and URLs removed). */
export function extractFigures(line) {
  const visible = stripLinks(line).replace(/^\s*\d+[.)]\s+/, '');
  return (visible.match(FIGURE_RE) || []).map((raw) => raw.trim());
}

const SUPERLATIVE_RE = new RegExp(
  `(^|[^\\p{L}\\p{N}-])(${SUPERLATIVES.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^\\p{L}\\p{N}-])|#1\\b`,
  'iu',
);

/** The superlative or ranking word in a piece of text, or null. "Best for" labels are allowed. */
export function findSuperlative(text) {
  const cleaned = stripLinks(text)
    .replace(/\*\*Best for:\*\*/g, '')
    .replace(/\bBest for\b/g, '')
    .replace(/\bleading\s+(to|up|into|on)\b/gi, ''); // the verb, not the ranking
  const m = cleaned.match(SUPERLATIVE_RE);
  return m ? (m[2] || m[0]).trim() : null;
}

/** True if the text reads as an instruction to the reader (an AI) rather than a description. */
export function isInstruction(text) {
  const visible = stripLinks(text);
  return INSTRUCTION_PATTERNS.some((re) => re.test(visible));
}

const STATISTIC_RE =/\d\s?%|\b\d+(\.\d+)?\s?(x|times)\b(?!\s*a\b)/i;
const RATING_RE = /★|☆|\b\d(\.\d)?\s?(\/\s?5|\/\s?10|out of (5|10)|stars?)\b/i;

function normaliseClaim(str) {
  return stripLinks(str)
    .replace(/^\s*([-*+]|\d+[.)])\s+/, '')
    .replace(/\*\*[^*]+:\*\*/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}£$€%]+/gu, ' ')
    .trim();
}

/** Run every check that needs only the file itself. */
export function checkFile(doc, { today = new Date() } = {}) {
  const out = [];
  const add = (...args) => out.push(finding(...args));
  const h = doc.header;

  // ---------- Header (Section 5) ----------
  if (!h) {
    add('header.missing', 'basic', 'error', 'The file must start with a YAML header between --- lines.', 1, '§4');
  } else if (doc.headerError) {
    add('header.yaml', 'basic', 'error', `The header is not valid YAML: ${doc.headerError}`, 1, '§4');
  }
  const hdr = h || {};

  for (const field of REQUIRED_FIELDS) {
    const v = getField(hdr, field);
    if (v === undefined || v === null || v === '') {
      add('header.required', 'basic', 'error', `Required field \`${field}\` is missing.`, 1, '§5');
    }
  }

  if (hdr.factfile_version !== undefined && String(hdr.factfile_version) !== SPEC_VERSION) {
    add('header.version', 'basic', 'warning', `\`factfile_version\` is ${hdr.factfile_version}; this validator checks version ${SPEC_VERSION}.`, 1, '§5');
  }
  if (hdr.url !== undefined && !isHttpsUrl(hdr.url)) {
    add('header.url', 'basic', 'error', '`url` must be a full https:// address.', 1, '§5');
  }

  const types = Array.isArray(hdr.type) ? hdr.type : hdr.type ? [hdr.type] : [];
  if (hdr.type !== undefined && !Array.isArray(hdr.type)) {
    add('header.type', 'basic', 'warning', '`type` should be a list, e.g. `[software]`.', 1, '§5');
  }
  for (const t of types) {
    if (!PROFILES[t]) {
      add('header.type', 'basic', 'error', `Unknown profile \`${t}\` in \`type\`. Use: ${Object.keys(PROFILES).join(', ')}.`, 1, '§7');
    }
  }

  if (typeof hdr.summary === 'string' && hdr.summary.length >= LIMITS.summary) {
    add('header.summary', 'basic', 'error', `\`summary\` must be under ${LIMITS.summary} characters (it is ${hdr.summary.length}).`, 1, '§5');
  }

  const pricing = hdr.pricing && typeof hdr.pricing === 'object' ? hdr.pricing : {};
  if (pricing.model !== undefined && !PRICING_MODELS.includes(pricing.model)) {
    add('header.pricing.model', 'basic', 'error', `\`pricing.model\` must be one of: ${PRICING_MODELS.join(', ')}.`, 1, '§5');
  }

  const fresh = hdr.freshness && typeof hdr.freshness === 'object' ? hdr.freshness : {};
  for (const k of ['last_verified', 'review_by']) {
    if (fresh[k] !== undefined && !isDate(String(fresh[k]))) {
      add('header.freshness', 'basic', 'error', `\`freshness.${k}\` must be a date written YYYY-MM-DD.`, 1, '§5');
    }
  }
  if (isDate(String(fresh.last_verified)) && isDate(String(fresh.review_by))) {
    const last = new Date(fresh.last_verified + 'T00:00:00Z');
    const review = new Date(fresh.review_by + 'T00:00:00Z');
    if (review < last) {
      add('freshness.order', 'basic', 'error', '`review_by` is earlier than `last_verified`.', 1, '§8.2');
    } else if (review > addMonths(fresh.last_verified, LIMITS.reviewMonths)) {
      add('freshness.window', 'basic', 'error', `\`review_by\` must be no more than ${LIMITS.reviewMonths} months after \`last_verified\`.`, 1, '§8.2');
    }
    const todayStr = today.toISOString().slice(0, 10);
    if (fresh.review_by < todayStr) {
      add('freshness.expired', 'checked', 'error', `\`review_by\` (${fresh.review_by}) has passed. Re-check every fact and update both dates.`, 1, '§8.2');
    }
    if (fresh.last_verified > todayStr) {
      add('freshness.future', 'basic', 'error', '`last_verified` is in the future.', 1, '§5');
    }
  }

  if (hdr.language !== undefined && !/^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(hdr.language))) {
    add('header.language', 'comparable', 'warning', '`language` should be a BCP 47 tag such as `en-GB`.', 1, '§5');
  }
  if (hdr.regions !== undefined) {
    const regions = Array.isArray(hdr.regions) ? hdr.regions : [hdr.regions];
    for (const r of regions) {
      if (r !== 'global' && !/^[A-Z]{2}$/.test(String(r))) {
        add('header.regions', 'comparable', 'warning', `Region \`${r}\` should be a two-letter ISO 3166 code (e.g. GB) or \`global\`.`, 1, '§5');
      }
    }
  }
  for (const key of Object.keys(hdr)) {
    const known = ['factfile_version', 'name', 'url', 'type', 'summary', 'pricing', 'freshness', 'category', 'get_started', 'human_page', 'publisher', 'agent_access', 'regions', 'language', 'products'];
    if (!known.includes(key) && !key.startsWith('x_')) {
      add('header.unknown', 'basic', 'warning', `Unknown field \`${key}\`. Your own fields must start with \`x_\`.`, 1, '§5');
    }
  }

  // Comparable header fields
  if (!hdr.category) add('header.category', 'comparable', 'error', '`category` is missing.', 1, '§9');
  for (const k of ['get_started', 'human_page']) {
    if (!hdr[k]) add(`header.${k}`, 'comparable', 'error', `\`${k}\` is missing.`, 1, '§9');
    else if (!isHttpsUrl(hdr[k])) add(`header.${k}`, 'comparable', 'error', `\`${k}\` must be a full https:// address.`, 1, '§5');
  }
  const pub = hdr.publisher && typeof hdr.publisher === 'object' ? hdr.publisher : null;
  if (!pub || !pub.legal_name) add('header.publisher', 'comparable', 'error', '`publisher.legal_name` is missing.', 1, '§9');
  if (!pub || !pub.corrections) add('header.publisher', 'comparable', 'error', '`publisher.corrections` is missing.', 1, '§9');

  const plans = Array.isArray(pricing.plans) ? pricing.plans : [];
  if (pricing.plans !== undefined && !Array.isArray(pricing.plans)) {
    add('header.pricing.plans', 'comparable', 'error', '`pricing.plans` must be a list.', 1, '§5');
  }
  plans.forEach((p, i) => {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string' || typeof p.price !== 'number') {
      add('header.pricing.plans', 'comparable', 'error', `Plan ${i + 1} needs a \`name\` and a numeric \`price\`.`, 1, '§5');
    } else if (p.period !== undefined && !PLAN_PERIODS.includes(p.period)) {
      add('header.pricing.plans', 'comparable', 'error', `Plan "${p.name}": \`period\` must be one of ${PLAN_PERIODS.join(', ')}.`, 1, '§5');
    }
  });
  if (pricing.from !== undefined && typeof pricing.from !== 'number') {
    add('header.pricing.from', 'comparable', 'error', '`pricing.from` must be a number.', 1, '§5');
  }
  const planPrices = plans.map((p) => p && p.price).filter((n) => typeof n === 'number');
  if (typeof pricing.from === 'number' && planPrices.length && Math.min(...planPrices) !== pricing.from) {
    add('header.pricing.from', 'comparable', 'warning', `\`pricing.from\` (${pricing.from}) does not match the lowest plan price (${Math.min(...planPrices)}).`, 1, '§5');
  }

  const bodyText = doc.lines.slice(doc.headerLines).join('\n');
  const pricesGiven = plans.length > 0 || (typeof pricing.from === 'number' && pricing.from > 0) || /[£$€¥]\s?\d/.test(bodyText);
  if (pricesGiven) {
    if (!pricing.currency) add('header.pricing.currency', 'comparable', 'error', 'Prices are given, so `pricing.currency` is required.', 1, '§5');
    else if (!/^[A-Z]{3}$/.test(String(pricing.currency))) add('header.pricing.currency', 'comparable', 'error', '`pricing.currency` must be a three-letter ISO 4217 code such as GBP.', 1, '§5');
    if (!pricing.source) add('header.pricing.source', 'comparable', 'error', 'Prices are given, so `pricing.source` (the live price page) is required.', 1, '§5');
    else if (!isHttpsUrl(pricing.source)) add('header.pricing.source', 'comparable', 'error', '`pricing.source` must be a full https:// address.', 1, '§5');
  }

  // ---------- Structure (Sections 4 and 6) ----------
  if (!doc.title) {
    add('structure.title', 'basic', 'error', 'A level-1 title with the business name (`# Name`) must come before the sections.', doc.headerLines + 1, '§6');
  } else if (hdr.name && doc.title !== String(hdr.name)) {
    add('structure.title', 'basic', 'warning', `The title "${doc.title}" differs from \`name\` "${hdr.name}".`, doc.titleLine, '§6');
  }

  const expected = [...CORE_SECTIONS, ...types.filter((t) => PROFILES[t]).map((t) => PROFILES[t]), 'Sources'];
  const allowed = new Set(expected);
  const seen = new Map();
  let lastIndex = -1;
  for (const s of doc.sections) {
    if (seen.has(s.name)) {
      add('structure.duplicate', 'basic', 'error', `Section "${s.name}" appears twice.`, s.line, '§6');
      continue;
    }
    seen.set(s.name, s);
    const idx = expected.indexOf(s.name);
    if (!allowed.has(s.name)) {
      const profileFor = Object.entries(PROFILES).find(([, v]) => v === s.name);
      const msg = profileFor
        ? `Section "${s.name}" belongs to the \`${profileFor[0]}\` profile, which is not declared in \`type\`.`
        : `Unknown section "${s.name}". Headings must use the exact names in the specification.`;
      add('structure.unknown', 'basic', 'warning', msg, s.line, '§6');
      continue;
    }
    if (idx < lastIndex) {
      add('structure.order', 'basic', 'error', `Section "${s.name}" is out of order. The order is: ${expected.join(', ')}.`, s.line, '§6');
    }
    lastIndex = Math.max(lastIndex, idx);
  }
  for (const name of BASIC_SECTIONS) {
    if (!seen.has(name)) add('structure.missing', 'basic', 'error', `Required section "## ${name}" is missing.`, null, '§6');
  }
  for (const t of types) {
    if (PROFILES[t] && !seen.has(PROFILES[t])) {
      add('structure.profile', 'comparable', 'error', `\`type\` includes \`${t}\`, so the section "## ${PROFILES[t]}" is required.`, null, '§7');
    }
  }
  for (const name of SHOULD_SECTIONS) {
    if (!seen.has(name)) add('structure.should', 'comparable', 'warning', `Section "## ${name}" is recommended.`, null, '§6');
  }

  // End marker and size
  const lastLine = [...doc.lines].reverse().find((l) => l.trim() !== '');
  if ((lastLine || '').trim() !== END_MARKER) {
    add('structure.end-marker', 'basic', 'error', `The last line must be exactly \`${END_MARKER}\`.`, doc.lines.length, '§4');
  }
  if (doc.text.length > LIMITS.fileMust) {
    add('size.max', 'basic', 'error', `The file is ${doc.text.length.toLocaleString('en-GB')} characters; it must be under ${LIMITS.fileMust.toLocaleString('en-GB')}.`, null, '§4');
  } else if (doc.text.length > LIMITS.fileShould) {
    add('size.should', 'basic', 'warning', `The file is ${doc.text.length.toLocaleString('en-GB')} characters; aim for under ${LIMITS.fileShould.toLocaleString('en-GB')}.`, null, '§4');
  }

  // ---------- Verdict (6.1) ----------
  const verdict = findSection(doc, 'Verdict');
  if (verdict) {
    const verdictIdx = doc.sections.indexOf(verdict);
    const next = doc.sections[verdictIdx + 1];
    const endOffset = next ? offsetOfLine(doc, next.line) : doc.text.length;
    if (endOffset > LIMITS.verdictEnd) {
      add('verdict.position', 'basic', 'error', `The Verdict must end within the first ${LIMITS.verdictEnd.toLocaleString('en-GB')} characters of the file (it ends at ${endOffset.toLocaleString('en-GB')}). Shorten the header or the Verdict.`, verdict.line, '§4');
    }
    const vText = sectionText(verdict).trim();
    if (vText.length > LIMITS.verdictLength) {
      add('verdict.length', 'basic', 'warning', `The Verdict is ${vText.length} characters; aim for under ${LIMITS.verdictLength}.`, verdict.line, '§4');
    }
    const items = listItems(verdict.lines);
    const labels = items.map((l) => (l.line.match(/^\s*[-*+]\s+\*\*([^*:]+):\*\*\s*\S/) || [])[1]);
    const ok = labels.length === VERDICT_LABELS.length && labels.every((lab, i) => lab === VERDICT_LABELS[i]);
    if (!ok) {
      add('verdict.lines', 'basic', 'error', `The Verdict must be exactly five lines labelled ${VERDICT_LABELS.map((l) => `**${l}:**`).join(', ')}, in that order.`, verdict.line, '§6.1');
    }
    for (const label of ['Price', 'Next step']) {
      const item = items.find((l) => l.line.includes(`**${label}:**`));
      if (item && extractUrls(item.line).length === 0) {
        add('verdict.link', 'comparable', 'error', `The Verdict's **${label}:** line needs a link.`, item.n, '§6.1');
      }
    }
  }

  // ---------- Fit (6.2) ----------
  const fit = findSection(doc, 'Fit');
  if (fit) {
    const subs = [];
    for (const l of fit.lines) {
      const m = l.line.match(/^### (.+?)\s*$/);
      if (m) subs.push({ name: m[1], line: l.n, items: [] });
      else if (subs.length && /^\s*([-*+]|\d+[.)])\s+\S/.test(l.line)) subs[subs.length - 1].items.push(l);
    }
    const notFor = subs.find((s) => s.name === 'Not for');
    const bestFor = subs.find((s) => s.name === 'Best for');
    if (!notFor || notFor.items.length === 0) {
      add('fit.not-for', 'basic', 'error', 'Fit must contain "### Not for" with at least one item.', fit.line, '§6.2');
    }
    if (!bestFor || bestFor.items.length === 0) {
      add('fit.best-for', 'comparable', 'error', 'Fit should contain "### Best for" with at least one item.', fit.line, '§6.2');
    }
  }

  // ---------- Pricing, Limitations, Sources ----------
  const pricingSec = findSection(doc, 'Pricing');
  if (pricingSec && sectionText(pricingSec).trim() === '') {
    add('pricing.empty', 'basic', 'error', 'The Pricing section is empty.', pricingSec.line, '§6');
  }
  const limits = findSection(doc, 'Limitations');
  if (limits && listItems(limits.lines).length === 0) {
    add('limitations.empty', 'basic', 'error', 'Limitations must list at least one item.', limits.line, '§6.5');
  }
  const sources = findSection(doc, 'Sources');
  const sourceUrls = sources ? extractUrls(sectionText(sources)) : [];
  if (sources && sourceUrls.length === 0) {
    add('sources.empty', 'basic', 'error', 'Sources must list at least one page.', sources.line, '§6');
  }

  // Every publisher page cited in the body should be in Sources
  const publisherDomain = hdr.url ? registrableDomain(String(hdr.url)) : null;
  if (sources && publisherDomain) {
    const listed = new Set(sourceUrls.map((u) => u.replace(/\/$/, '')));
    const missing = new Map();
    for (const s of doc.sections) {
      if (s.name === 'Sources') continue;
      for (const l of s.lines) {
        for (const u of extractUrls(l.line)) {
          if (registrableDomain(u) === publisherDomain && !listed.has(u.replace(/\/$/, '')) && !missing.has(u)) missing.set(u, l.n);
        }
      }
    }
    for (const [u, n] of missing) {
      add('sources.complete', 'comparable', 'warning', `${u} is cited but not listed in Sources.`, n, '§6');
    }
  }

  // ---------- Evidence (6.4) ----------
  const evidence = findSection(doc, 'Evidence');
  const evidenceUrls = evidence ? extractUrls(sectionText(evidence)) : [];
  if (evidence) {
    for (const l of evidence.lines) {
      for (const u of extractUrls(l.line)) {
        if (publisherDomain && registrableDomain(u) === publisherDomain) {
          add('evidence.independent', 'comparable', 'error', `Evidence must link to independent sources, not the publisher's own site (${u}).`, l.n, '§6.4');
        }
      }
      if (RATING_RE.test(stripLinks(l.line))) {
        add('evidence.quotes', 'comparable', 'error', 'Evidence must not quote ratings or reviews; link to them instead.', l.n, '§6.4');
      }
      if (l.line.trim() && !/^\s*([-*+]|\d+[.)])\s+/.test(l.line)) {
        add('evidence.links-only', 'comparable', 'warning', 'Evidence should be a list of labelled links only.', l.n, '§6.4');
      }
    }
  }
  const independent = evidenceUrls.filter((u) => !publisherDomain || registrableDomain(u) !== publisherDomain);
  if (independent.length === 0) {
    add('evidence.required', 'checked', 'error', 'The Checked level needs at least one independent link in "## Evidence".', evidence ? evidence.line : null, '§9');
  }

  // ---------- Integrity rules (8.1) ----------
  const bodyLines = doc.lines
    .map((line, i) => ({ n: i + 1, line }))
    .filter((l) => l.n > doc.headerLines);

  // Rule 5: HTML comments, hidden text, text addressed to AI
  const comments = [...doc.text.matchAll(/<!--[\s\S]*?-->/g)];
  for (const c of comments) {
    if (c[0].trim() === END_MARKER) continue;
    const n = doc.text.slice(0, c.index).split('\n').length;
    add('integrity.comments', 'basic', 'error', 'HTML comments are not allowed (only the end marker).', n, '§8.1 rule 5');
  }
  doc.lines.forEach((line, i) => {
    if (HIDDEN_CHARACTERS.test(line)) add('integrity.hidden', 'basic', 'error', 'Line contains invisible characters.', i + 1, '§8.1 rule 5');
    if (HIDDEN_HTML.test(line)) add('integrity.hidden', 'basic', 'error', 'Line contains hidden HTML.', i + 1, '§8.1 rule 5');
  });
  const scanForInstructions = [
    ...bodyLines.map((l) => ({ n: l.n, text: stripLinks(l.line) })),
    ...['summary', 'category'].filter((k) => typeof hdr[k] === 'string').map((k) => ({ n: 1, text: hdr[k] })),
  ];
  for (const { n, text } of scanForInstructions) {
    if (isInstruction(text)) {
      add('integrity.addressed-to-ai', 'basic', 'error', 'This line reads as an instruction to the reader. The file must describe the business, never tell an agent what to do.', n, '§8.1 rule 5');
    }
  }

  // Rule 6: superlatives (Best for labels excepted)
  const scanForSuperlatives = [
    ...bodyLines.map((l) => ({ n: l.n, text: l.line })),
    ...['summary', 'category'].filter((k) => typeof hdr[k] === 'string').map((k) => ({ n: 1, text: hdr[k] })),
  ];
  for (const { n, text } of scanForSuperlatives) {
    const word = findSuperlative(text);
    if (word) {
      add('integrity.superlatives', 'basic', 'error', `"${word}" is a superlative or ranking. These are not allowed anywhere in the file.`, n, '§8.1 rule 6');
    }
  }

  // Drafts: placeholders left by the generator (or by hand) must be filled in before publishing.
  doc.lines.forEach((line, i) => {
    if (/\bTODO\b/.test(line)) {
      add('draft.todo', 'basic', 'error', `Unfinished draft: ${line.replace(/^.*?\bTODO\b:?\s*/, '').replace(/["#]+\s*$/, '').trim() || 'fill in this line'}.`, i + 1, '§4');
    }
  });

  // Rule 4: state each fact once (outside the Verdict)
  const claims = new Map();
  for (const s of doc.sections) {
    if (s.name === 'Verdict' || s.name === 'Sources') continue;
    for (const l of s.lines) {
      if (/^\s*#{3,}\s/.test(l.line) || !l.line.trim() || /^\s*source:/i.test(l.line)) continue;
      const parts = /^\s*([-*+]|\d+[.)])\s+/.test(l.line) ? [l.line] : l.line.split(/(?<=[.!?])\s+/);
      for (const part of parts) {
        const norm = normaliseClaim(part);
        if (norm.split(' ').length < 4) continue;
        if (claims.has(norm)) {
          const first = claims.get(norm);
          add('integrity.repeated', 'basic', 'error', `This repeats a claim already made on line ${first.n} ("${first.section}"). State each fact once.`, l.n, '§8.1 rule 4');
        } else {
          claims.set(norm, { n: l.n, section: s.name });
        }
      }
    }
  }

  // Rule 7: the publisher's own claims never sit in Evidence (prose there is a sign of it)
  // (covered by evidence.links-only and evidence.quotes above)

  // Rules 2 and 3: receipts and provenance (offline part; the live check confirms the pages say it)
  for (const s of doc.sections) {
    if (s.name === 'Sources') continue;
    const sectionHasLink = extractUrls(sectionText(s)).length > 0 || (s.name === 'Pricing' && pricing.source);
    for (const l of s.lines) {
      const figures = extractFigures(l.line);
      if (figures.length === 0) continue;
      const lineHasLink = extractUrls(l.line).length > 0;
      if (STATISTIC_RE.test(stripLinks(l.line)) && !lineHasLink) {
        add('integrity.provenance', 'checked', 'error', 'A statistic needs its source on the same line: what it measures and a link to where it comes from.', l.n, '§8.1 rule 3');
      } else if (!lineHasLink && !sectionHasLink && sourceUrls.length === 0) {
        add('integrity.receipts', 'checked', 'error', `"${figures[0]}" has no receipt: link to a live page that states it.`, l.n, '§8.1 rule 2');
      }
    }
  }

  // Privacy (10.2) – personal email addresses are hard to detect reliably; flag obvious national ID patterns only.
  bodyLines.forEach((l) => {
    if (/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/.test(l.line)) {
      add('privacy', 'basic', 'warning', 'This looks like a National Insurance number. The file must not contain personal data.', l.n, '§10.2');
    }
  });

  return out;
}

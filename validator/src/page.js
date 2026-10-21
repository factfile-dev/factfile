import { END_MARKER } from './constants.js';
import { getField, parseFactfile } from './parse.js';
import { checkFile } from './rules.js';
import { PAGE_FILE_LINK_HTML } from './signposts.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The few inline Markdown forms a factfile.md uses: links, bare URLs, bold, italic, code. */
function inline(md) {
  const codes = [];
  let s = esc(md).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, u) => `${pre}<a href="${u}">${u}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

/** Markdown lines of one section → HTML: paragraphs, bullet and numbered lists, ### subheadings. */
function block(lines) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/<!--[\s\S]*?-->/g, '').trimEnd();
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const sub = line.match(/^###\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if (sub) {
      flushPara();
      closeList();
      out.push(`<h3>${inline(sub[1])}</h3>`);
    } else if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return out.join('\n');
}

const LABELS = { Verdict: 'At a glance' };

/**
 * The human page (signpost 2): the same facts as the file, as a plain web page.
 * Returns { fragment, page, problems }. A file that still has TODOs is refused,
 * because the page must show the finished, checked facts.
 */
export function renderPage(text, { fileUrl = '/factfile.md' } = {}) {
  const doc = parseFactfile(text);
  const h = doc.header || {};
  const problems = checkFile(doc)
    .filter((f) => f.severity === 'error' && f.level === 'basic')
    .map((f) => `${f.line ? `line ${f.line}: ` : ''}${f.message}`);
  if (problems.some((p) => /Unfinished draft/.test(p))) {
    const n = problems.filter((p) => /Unfinished draft/.test(p)).length;
    throw new Error(`factfile.md still has ${n} TODO line(s). Finish the file first, so the page shows the checked facts.`);
  }

  const name = String(h.name || doc.title || 'Key facts');
  const verified = getField(h, 'freshness.last_verified');
  const review = getField(h, 'freshness.review_by');
  const parts = [];
  parts.push(`<h1>${esc(name)}: key facts</h1>`);
  if (h.summary) parts.push(`<p class="factfile-summary">${inline(String(h.summary))}</p>`);
  for (const s of doc.sections) {
    if (s.name === 'Sources') continue;
    parts.push(`<h2>${esc(LABELS[s.name] || s.name)}</h2>`);
    parts.push(block(s.lines.map((l) => l.line)));
  }
  const sources = doc.sections.find((s) => s.name === 'Sources');
  if (sources) {
    parts.push('<h2>Sources</h2>');
    parts.push(block(sources.lines.map((l) => l.line).filter((l) => l.trim() !== END_MARKER)));
  }
  const meta = [verified && `Last checked ${esc(String(verified))}`, review && `next review by ${esc(String(review))}`].filter(Boolean).join('; ');
  parts.push(`<p class="factfile-meta">${meta ? meta + '. ' : ''}${PAGE_FILE_LINK_HTML.replace('/factfile.md', esc(fileUrl))}</p>`);

  const fragment = `<article class="factfile" lang="${esc(h.language || 'en')}">\n${parts.join('\n')}\n</article>\n`;
  const page = `<!doctype html>
<html lang="${esc(h.language || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}: key facts</title>
${h.summary ? `<meta name="description" content="${esc(h.summary)}">\n` : ''}<link rel="alternate" type="text/markdown" href="${esc(fileUrl)}" title="factfile.md">
<style>
  body { font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 42rem; margin: 2.5rem auto; padding: 0 1rem; color: #1a1a1a; background: #fff; }
  h1 { font-size: 1.8rem; line-height: 1.25; } h2 { font-size: 1.25rem; margin-top: 2rem; } h3 { font-size: 1.05rem; }
  a { color: #0b57d0; } code { font-size: .9em; } .factfile-summary { font-size: 1.1rem; } .factfile-meta { margin-top: 2.5rem; color: #555; font-size: .9rem; }
  @media (prefers-color-scheme: dark) { body { color: #e8e8e8; background: #121212; } a { color: #8ab4f8; } .factfile-meta { color: #aaa; } }
</style>
</head>
<body>
<main>
${fragment}</main>
</body>
</html>
`;
  return { fragment, page, problems };
}

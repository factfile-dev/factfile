import { parse as parseYaml } from 'yaml';

const HEADER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Split a factfile.md into its header, title and level-2 sections, keeping line numbers.
 */
export function parseFactfile(rawText) {
  // Windows (CRLF) and old Mac (CR) line endings are read the same as Unix (LF).
  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const doc = {
    text,
    lines: text.split(/\r?\n/),
    lineOffsets: [],
    header: null,
    headerError: null,
    headerLines: 0,
    title: null,
    titleLine: null,
    sections: [],
  };

  let offset = 0;
  for (const line of doc.lines) {
    doc.lineOffsets.push(offset);
    offset += line.length + 1;
  }

  const m = text.match(HEADER_RE);
  if (m) {
    doc.headerLines = m[0].replace(/\r?\n$/, '').split(/\r?\n/).length;
    try {
      const parsed = parseYaml(m[1], { version: '1.2', schema: 'core' });
      doc.header = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
        doc.headerError = 'The header must be a set of key: value fields.';
      }
    } catch (err) {
      doc.headerError = err.message.split('\n')[0];
      doc.header = {};
    }
  }

  let inFence = false;
  let current = null;
  doc.lines.forEach((line, i) => {
    const n = i + 1;
    if (n <= doc.headerLines) return;
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h1 = line.match(/^# (.+?)\s*#*\s*$/);
      if (h1 && !doc.title && doc.sections.length === 0) {
        doc.title = h1[1].trim();
        doc.titleLine = n;
        return;
      }
      const h2 = line.match(/^## (.+?)\s*#*\s*$/);
      if (h2) {
        current = { name: h2[1].trim(), line: n, lines: [] };
        doc.sections.push(current);
        return;
      }
    }
    if (current) current.lines.push({ n, line });
  });

  return doc;
}

export function getField(obj, path) {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

export function findSection(doc, name) {
  return doc.sections.find((s) => s.name === name);
}

export function sectionText(section) {
  return section ? section.lines.map((l) => l.line).join('\n') : '';
}

/** Lines of a section that are list items (bullets or numbered). */
export function listItems(lines) {
  return lines.filter((l) => /^\s*([-*+]|\d+[.)])\s+\S/.test(l.line));
}

/** Character offset where a line starts. */
export function offsetOfLine(doc, n) {
  return doc.lineOffsets[n - 1] ?? doc.text.length;
}

const URL_RE = /https?:\/\/[^\s<>()\]"'`]+/g;

/** All URLs in a string, with trailing punctuation removed. */
export function extractUrls(str) {
  return (str.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, ''));
}

/** Remove link targets and URLs so prose checks only see visible words. */
export function stripLinks(str) {
  return str
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(URL_RE, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

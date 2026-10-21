// Builds the factfile.dev website into ../site. Run: npm run build (from site-src).
// Pages are plain HTML fragments in pages/, wrapped in one layout. The /spec page is
// rendered from ../SPEC.md and the /factfile page from factfile.md, so neither can drift.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { renderPage } from '../validator/src/page.js';
import { validate } from '../validator/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'site');
const ORIGIN = 'https://factfile.dev';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV = [
  ['/what-is-factfile', 'What it is'],
  ['/spec', 'Specification'],
  ['/tools', 'Tools'],
  ['/about', 'About'],
];

function layout({ path, title, description, body, head = '' }) {
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('\n        ');
  const canonical = ORIGIN + (path === '/' ? '/' : path);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
${head}</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="wordmark" href="/">factfile<span>.md</span></a>
    <nav aria-label="Main">
        ${nav}
        <a href="https://github.com/factfile-dev/factfile">GitHub</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body.trim()}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p><a href="/factfile.md">Key facts (factfile.md)</a> · <a href="/spec">Specification</a> · <a href="https://github.com/factfile-dev/factfile">GitHub</a> · <a href="mailto:hello@factfile.dev">hello@factfile.dev</a></p>
    <p>factfile.md, created by <a href="/about">Alan Kiayi</a>. Specification licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; tools licensed MIT.</p>
  </div>
</footer>
</body>
</html>
`;
}

/** A page fragment starts with <!-- {"title": …, "description": …} --> */
async function readFragment(file) {
  const text = await readFile(file, 'utf8');
  const m = text.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`${file}: missing the page header comment`);
  return { meta: JSON.parse(m[1]), body: text.slice(m[0].length) };
}

/** Headings get ids so sections of the specification can be linked. */
function slug(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, '.well-known'), { recursive: true });
  const pages = []; // [path, file]

  // 1. Fragment pages.
  for (const name of (await readdir(join(HERE, 'pages'))).filter((f) => f.endsWith('.html')).sort()) {
    const { meta, body } = await readFragment(join(HERE, 'pages', name));
    const base = name.replace(/\.html$/, '');
    const path = base === 'index' ? '/' : `/${base}`;
    await writeFile(join(OUT, name), layout({ path, ...meta, body }));
    if (base !== '404') pages.push(path);
  }

  // 2. The specification, from SPEC.md, plus a Markdown copy at /spec.md.
  const spec = await readFile(join(HERE, '..', 'SPEC.md'), 'utf8');
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`;
  };
  const specHtml = marked.parse(spec, { renderer, gfm: true });
  await writeFile(
    join(OUT, 'spec.html'),
    layout({
      path: '/spec',
      title: 'factfile.md specification v0.1 (draft)',
      description: 'The factfile.md specification: file format, sections, profiles, integrity rules, conformance levels and the agent reading protocol.',
      body: `<p class="note">Draft for public comment. Also available as <a href="/spec.md">Markdown</a> and on <a href="https://github.com/factfile-dev/factfile/blob/main/SPEC.md">GitHub</a>, where you can open an issue.</p>\n<article class="prose spec">\n${specHtml}</article>`,
      head: '<link rel="alternate" type="text/markdown" href="/spec.md" title="SPEC.md">\n',
    }),
  );
  await writeFile(join(OUT, 'spec.md'), spec);
  pages.push('/spec');

  // 3. This site's own factfile.md, its /.well-known copy and its human page (signpost 2).
  const factfile = await readFile(join(HERE, 'factfile.md'), 'utf8');
  const local = await validate({ text: factfile, name: 'factfile.md' });
  if (!local.level) throw new Error(`site factfile.md fails Basic:\n${local.findings.map((f) => f.message).join('\n')}`);
  await writeFile(join(OUT, 'factfile.md'), factfile);
  await writeFile(join(OUT, '.well-known', 'factfile.md'), factfile);
  const { fragment } = renderPage(factfile);
  await writeFile(
    join(OUT, 'factfile.html'),
    layout({
      path: '/factfile',
      title: 'factfile.md: key facts',
      description: 'Key facts about factfile.md: what it is, who it is for, what it costs and how to start.',
      body: fragment.replace('<article class="factfile"', '<article class="factfile prose"'),
      head: '<link rel="alternate" type="text/markdown" href="/factfile.md" title="factfile.md">\n',
    }),
  );
  pages.push('/factfile');

  // 4. Static files.
  await cp(join(HERE, 'static'), OUT, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .map((p) => `  <url><loc>${ORIGIN}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  console.log(`Built ${pages.length} pages into ${OUT}`);
}

await build();

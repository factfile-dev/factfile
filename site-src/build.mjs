// Builds the factfile.dev website into ../site. Run: npm run build (from site-src).
// Pages are plain HTML fragments in pages/, wrapped in one layout. The /spec page is
// rendered from ../SPEC.md and the /factfile page from factfile.md, so neither can drift.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { renderPage } from '../validator/src/page.js';
import { validate } from '../validator/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'site');
const ORIGIN = 'https://factfile.dev';
// Alan's LinkedIn profile URL. Links to it appear only once this is set.
const LINKEDIN = 'https://www.linkedin.com/in/alankiayi/';
const X_ALAN = 'https://x.com/alankiayi';
const X_PROJECT = 'https://x.com/factfiledev';
// Your Buy Me a Coffee (or Ko-fi / GitHub Sponsors) page. Until set, the support button says the link is coming soon.
const DONATE = 'https://buymeacoffee.com/alankiayi';
const GITHUB = 'https://github.com/factfile-dev/factfile';
const NPM = 'https://www.npmjs.com/package/factfile';
const PUBLISHED = '2026-10-20';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV = [
  ['/generate', 'Generate'],
  ['/what-is-factfile', 'What it is'],
  ['/spec', 'Specification'],
  ['/tools', 'Tools'],
  ['/about', 'About'],
];

const ICON = {
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="currentColor"/><path d="M10 8h12M10 14h12M10 20h7" stroke="var(--paper)" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="22" r="3" fill="#f2c14e"/></svg>',
  github: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
  sun: '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1 2h6.4l4.4 5.8zm-1.1 18h1.7L6.3 3.9H4.5z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 010 5H17M8 2.5v3M12 2.5v3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function layout({ path, title, description, body, head = '', bare = false, scripts = [], jsonld = null, ogType = 'website', modified = null }) {
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ');
  const canonical = ORIGIN + (path === '/' ? '/' : path);
  const main = bare ? body.trim() : `<div class="wrap page">\n${body.trim()}\n</div>`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<head>
<meta charset="utf-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EH92SZ5JD9"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-EH92SZ5JD9');
</script>
<meta name="viewport" ...
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">
<link rel="alternate" type="text/markdown" href="${mdPath(path)}" title="This page in Markdown">
<link rel="alternate" type="application/rss+xml" href="/changelog.xml" title="factfile.md changes">
<meta name="author" content="Alan Kiayi">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="preload" href="/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1418" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="factfile.md">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="en_GB">${modified ? `\n<meta property="article:modified_time" content="${modified}">` : ''}
<meta property="og:image" content="${ORIGIN}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="factfile.md: checkable business facts for AI agents">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@factfiledev">
<meta name="twitter:creator" content="@alankiayi">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<script src="/site.js" defer></script>
${scripts.map((src) => `<script src="${src}" defer></script>`).join('\n')}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>\n` : ''}${head}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<aside aria-label="Announcement"><a class="announce" href="/spec">factfile.md v0.1 is open for public comment. <b>Read the draft</b></a></aside>
<header class="site-header">
  <div class="wrap">
    <a class="wordmark" href="/" aria-label="factfile.md home">${ICON.mark}<span>factfile<span class="ext">.md</span></span></a>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${nav}
      <a class="m-only" href="https://github.com/factfile-dev/factfile">GitHub</a>
      <a class="m-only" href="/support">Buy me a coffee</a>
      <a class="m-only btn btn-dark" href="/generate">Generate your file</a>
    </nav>
    <div class="head-end">
      <a class="coffee-link" href="${DONATE}" target="_blank" rel="noopener" data-coffee="header">${ICON.coffee}<span>Buy me a coffee</span></a>
      <a class="flag-link" href="/about#iran" aria-label="I stand with the people of Iran" title="I stand with the people of Iran"><img src="/img/iran-lion-and-sun-emoji.svg" alt="" width="22" height="22"></a>
      <a class="gh" href="https://github.com/factfile-dev/factfile">${ICON.github}GitHub</a>
      <button class="icon-btn theme-btn" type="button" aria-label="Switch theme">${ICON.sun}${ICON.moon}</button>
      <a class="btn btn-dark btn-s" href="/generate">Generate your file</a>
      <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${ICON.menu}</button>
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
${main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="foot">
      <div class="brand">
        <a class="wordmark" href="/">${ICON.mark}<span>factfile<span class="ext">.md</span></span></a>
        <p>The facts AI needs, in one file you control.</p>
        <a class="btn btn-dark btn-s" href="/generate">Generate your file</a>
        <ul class="socials">
          <li><a href="${X_PROJECT}" aria-label="factfile.md on X">${ICON.x}</a></li>
          <li><a href="${X_ALAN}" rel="me" aria-label="Alan Kiayi on X">${ICON.x}<span>Alan</span></a></li>
          <li><a href="${LINKEDIN}" rel="me" aria-label="Alan Kiayi on LinkedIn">${ICON.linkedin}</a></li>
        </ul>
      </div>
      <nav aria-label="Standard"><h2>Standard</h2><ul>
        <li><a href="/what-is-factfile">What it is</a></li>
        <li><a href="/spec">Specification</a></li>
        <li><a href="/spec.md">Specification (Markdown)</a></li>
        <li><a href="/factfile.md">Key facts (factfile.md)</a></li>
      </ul></nav>
      <nav aria-label="Tools"><h2>Tools</h2><ul>
        <li><a href="/generate">Generator (in your browser)</a></li>
        <li><a href="/tools">Command-line tools</a></li>
        <li><a href="https://www.npmjs.com/package/factfile">npm package</a></li>
        <li><a href="https://github.com/factfile-dev/factfile/tree/main/examples">Examples</a></li>
      </ul></nav>
      <nav aria-label="Project"><h2>Project</h2><ul>
        <li><a href="/about">About</a></li>
        <li><a href="https://github.com/factfile-dev/factfile">GitHub</a></li>
        <li><a href="https://github.com/factfile-dev/factfile/issues">Comment on the draft</a></li>
        <li><a href="mailto:hello@factfile.dev">hello@factfile.dev</a></li>
        <li><a href="/support">Buy me a coffee</a></li>
      </ul></nav>
    </div>
    <div class="legal"><span>factfile.md, created by <a href="/about">Alan Kiayi</a>.</span>
      <a class="solidarity" href="/about#iran"><img src="/img/iran-lion-and-sun-emoji.svg" alt="" width="20" height="20">I stand with the people of Iran</a><span>Specification <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Tools MIT.</span></div>
  </div>
</footer>
${path === '/support' ? '' : `<div class="kofi" data-kofi hidden>
  <div class="kofi-panel" id="kofi-panel" role="dialog" aria-labelledby="kofi-title" hidden>
    <button class="kofi-close" type="button" aria-label="Close and hide for a week">&times;</button>
    <div class="kofi-cup" aria-hidden="true">${ICON.coffee}</div>
    <p class="kofi-title" id="kofi-title">factfile.md is free</p>
    <p class="kofi-text">No ads, no tracking, no paid tier. If it saved you time, a coffee keeps the specification and tools moving.</p>
    <a class="btn btn-coffee" href="${DONATE}" target="_blank" rel="noopener" data-coffee="widget">${ICON.coffee}Buy me a coffee</a>
    <a class="kofi-more" href="/support">What it pays for</a>
  </div>
  <button class="kofi-btn" type="button" aria-expanded="false" aria-controls="kofi-panel">${ICON.coffee}<span>Buy me a coffee</span></button>
</div>
<div class="toast" role="status" aria-live="polite" hidden><span class="toast-msg"></span><a class="toast-cta" href="${DONATE}" target="_blank" rel="noopener" data-coffee="toast">${ICON.coffee}Buy me a coffee</a><button class="toast-x" type="button" aria-label="Dismiss">&times;</button></div>`}
</body>
</html>
`;
}


/** Every page has a Markdown twin: / -> /index.md, /about -> /about.md. */
function mdPath(path) { return path === '/' ? '/index.md' : `${path}.md`; }

/** Last commit date of the files a page is built from (ISO date), for dateModified and the sitemap. */
function gitDate(...files) {
  let best = '';
  for (const f of files) {
    try { const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', f], { cwd: HERE, encoding: 'utf8' }).trim(); if (d > best) best = d; } catch {}
  }
  return best || new Date().toISOString().slice(0, 10);
}

const PERSON = {
  '@type': 'Person', '@id': `${ORIGIN}/about#alan`, name: 'Alan Kiayi', url: `${ORIGIN}/about`,
  jobTitle: 'Product builder', homeLocation: { '@type': 'Country', name: 'United Kingdom' },
  sameAs: [LINKEDIN, X_ALAN, 'https://github.com/factfile-dev'].filter(Boolean),
};
const WEBSITE = {
  '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: 'factfile.md', inLanguage: 'en-GB',
  description: 'The home of factfile.md, an open standard for one Markdown file of checkable business facts for AI agents.',
  publisher: { '@id': `${ORIGIN}/about#alan` }, sameAs: [GITHUB, X_PROJECT, NPM],
};
const STANDARD = {
  '@type': 'CreativeWork', '@id': `${ORIGIN}/spec#standard`, name: 'factfile.md',
  alternateName: ['factfile', 'factfile.md specification'],
  description: 'An open standard for one Markdown file at the root of a website that gives AI agents a business’s key facts, each linked to the page that shows it.',
  url: `${ORIGIN}/spec`, version: '0.1', creativeWorkStatus: 'Draft', datePublished: PUBLISHED,
  license: 'https://creativecommons.org/licenses/by/4.0/', author: { '@id': `${ORIGIN}/about#alan` }, inLanguage: 'en-GB',
  encodingFormat: 'text/markdown', isBasedOn: 'https://commonmark.org/',
};
const TOOLS = {
  '@type': 'SoftwareApplication', '@id': `${ORIGIN}/tools#software`, name: 'factfile', alternateName: 'factfile tools',
  description: 'Free tools that draft a factfile.md from a website, check it against the specification, make the Key facts page and write the setup guide.',
  applicationCategory: 'DeveloperApplication', operatingSystem: 'Web browser, macOS, Windows, Linux (Node.js 18 or later)',
  url: `${ORIGIN}/generate`, downloadUrl: NPM, codeRepository: GITHUB, license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  author: { '@id': `${ORIGIN}/about#alan` }, softwareVersion: '0.5.0',
};

/** schema.org graph for a page: the site, its author, the page, its breadcrumb, and what the page is about. */
function jsonldFor({ path, title, description, modified, extra = [], kind = 'WebPage', about = null }) {
  const url = ORIGIN + (path === '/' ? '/' : path);
  const crumbs = path === '/' ? null : {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'factfile.md', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: title.replace(/ [·|:].*$/, ''), item: url },
    ],
  };
  const page = {
    '@type': kind, '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en-GB',
    isPartOf: { '@id': `${ORIGIN}/#website` }, author: { '@id': `${ORIGIN}/about#alan` },
    datePublished: PUBLISHED, dateModified: modified,
    primaryImageOfPage: { '@type': 'ImageObject', url: `${ORIGIN}/og.png`, width: 1200, height: 630 },
    ...(crumbs ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    ...(about ? { about: { '@id': about } } : {}),
    potentialAction: { '@type': 'ReadAction', target: [url, ORIGIN + mdPath(path)] },
  };
  return { '@context': 'https://schema.org', '@graph': [WEBSITE, PERSON, page, ...(crumbs ? [crumbs] : []), ...extra] };
}

/** FAQ questions and answers from <details> blocks, for FAQPage data and the Markdown twin. */
function faqFrom(html) {
  return [...html.matchAll(/<details><summary>([\s\S]*?)(?:<span[^>]*><\/span>)?<\/summary><div class="ans">([\s\S]*?)<\/div><\/details>/g)]
    .map(([, q, a]) => ({ q: q.replace(/<[^>]+>/g, '').trim(), a: a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }));
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
turndown.use(gfm);
turndown.remove(['script', 'style', 'svg', 'button', 'form', 'noscript', 'input', 'select', 'textarea']);
turndown.addRule('hidden', { filter: (n) => n.getAttribute && (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden') || /\b(prop|kofi|toast|marquee-track|sr-only|skip|copy|cup)\b/.test(n.getAttribute('class') || '')), replacement: () => '' });
turndown.addRule('summary', { filter: 'summary', replacement: (c) => `\n\n### ${c.trim()}\n\n` });
turndown.addRule('absolute', { filter: (n) => n.nodeName === 'A' && /^\//.test(n.getAttribute('href') || ''), replacement: (c, n) => (c.trim() ? `[${c.trim()}](${ORIGIN}${n.getAttribute('href')})` : '') });

/** The Markdown twin of a built page: its <main>, without decoration, with a small header. */
function markdownFor({ path, title, description, modified, html, md_note }) {
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [, html])[1];
  const body = turndown.turndown(main).replace(/\n{3,}/g, '\n\n').trim();
  const url = ORIGIN + (path === '/' ? '/' : path);
  const note = md_note ? `\n\n${md_note}` : '';
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nurl: ${url}\nlast_modified: ${modified}\nsite_facts: ${ORIGIN}/factfile.md\n---\n\n${body}${note}\n`;
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

const PAGE_SCHEMA = {
  '/': { about: STANDARD['@id'], extra: [STANDARD, TOOLS] },
  '/what-is-factfile': { about: STANDARD['@id'], extra: [STANDARD, { '@type': 'DefinedTerm', '@id': `${ORIGIN}/what-is-factfile#term`, name: 'factfile.md', description: STANDARD.description, url: `${ORIGIN}/what-is-factfile` }] },
  '/spec': { kind: 'TechArticle', about: STANDARD['@id'], extra: [STANDARD], ogType: 'article' },
  '/tools': { about: TOOLS['@id'], extra: [TOOLS] },
  '/generate': { about: TOOLS['@id'], extra: [TOOLS] },
  '/about': { kind: 'ProfilePage', about: PERSON['@id'] },
  '/factfile': { about: STANDARD['@id'], extra: [STANDARD] },
  '/support': {},
};

async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, '.well-known'), { recursive: true });
  const built = []; // { path, title, description, modified, html, md? }

  const write = async (file, page) => {
    const conf = PAGE_SCHEMA[page.path] || {};
    const extra = [...(conf.extra || []), ...(page.extraLd || [])];
    const jsonld = page.path === '/404' ? null : jsonldFor({ ...page, kind: conf.kind || 'WebPage', about: conf.about, extra });
    const html = layout({ ...page, jsonld, ogType: conf.ogType || 'website' });
    await writeFile(join(OUT, file), page.path === '/404' ? html.replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">', '<meta name="robots" content="noindex">') : html);
    if (page.path !== '/404') built.push({ ...page, html });
  };

  // 1. Fragment pages.
  for (const name of (await readdir(join(HERE, 'pages'))).filter((f) => f.endsWith('.html')).sort()) {
    const { meta, body: raw } = await readFragment(join(HERE, 'pages', name));
    const donateBtn = DONATE
      ? `<a class="btn btn-coffee btn-l" href="${DONATE}" target="_blank" rel="noopener" data-coffee="${name.replace(/\.html$/, '')}">${ICON.coffee}Buy me a coffee</a>`
      : `<span class="btn btn-l btn-soon" aria-disabled="true">${ICON.coffee}Donation link coming soon</span>`;
    const body = raw.replace(/<!--linkedin:([\s\S]*?)-->/g, (_, html) => LINKEDIN ? html : '')
      .replaceAll('{{LINKEDIN}}', LINKEDIN).replaceAll('{{X_ALAN}}', X_ALAN).replaceAll('{{X_PROJECT}}', X_PROJECT)
      .replaceAll('{{DONATE_BTN}}', donateBtn).replaceAll('{{ICON_X}}', ICON.x).replaceAll('{{ICON_LINKEDIN}}', ICON.linkedin);
    const base = name.replace(/\.html$/, '');
    const path = base === 'index' ? '/' : `/${base}`;
    const faq = faqFrom(body);
    const extraLd = faq.length ? [{ '@type': 'FAQPage', '@id': `${ORIGIN}${path === '/' ? '/' : path}#faq`, mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [];
    await write(name, { path, ...meta, body, extraLd, modified: gitDate(`pages/${name}`, 'build.mjs') });
  }

  // 2. The specification, from SPEC.md, plus a Markdown copy at /spec.md.
  const spec = await readFile(join(HERE, '..', 'SPEC.md'), 'utf8');
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    const id = slug(inner);
    return depth > 1 && depth < 4 ? `<h${depth} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n` : `<h${depth} id="${id}">${inner}</h${depth}>\n`;
  };
  const specHtml = marked.parse(spec, { renderer, gfm: true })
    .replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  const toc = [...specHtml.matchAll(/<h2 id="([^"]+)">(.*?)<a class="anchor"/g)]
    .map(([, id, text]) => `<li><a href="#${id}">${text.replace(/<[^>]+>/g, '')}</a></li>`).join('\n');
  await write('spec.html', {
    path: '/spec',
    title: 'factfile.md specification v0.1 (draft)',
    description: 'The factfile.md specification: file format, sections, profiles, integrity rules, conformance levels and the agent reading protocol.',
    modified: gitDate('../SPEC.md'),
    md: spec,
    body: `<div class="doc">
<aside class="toc" aria-label="Contents">
<p class="toc-title">Contents</p>
<ol>
${toc}
</ol>
<div class="toc-alt"><a href="/spec.md">Read as Markdown</a><a href="https://github.com/factfile-dev/factfile/issues">Comment on GitHub</a></div>
</aside>
<div>
<p class="callout">Draft for public comment. Also available as <a href="/spec.md">Markdown</a> and on <a href="https://github.com/factfile-dev/factfile/blob/main/SPEC.md">GitHub</a>, where you can open an issue.</p>
<details class="toc-mobile"><summary>Contents</summary><ol>
${toc}
</ol></details>
<article class="prose spec">
${specHtml}</article>
<aside class="coffee-band slim" aria-label="Support factfile.md" style="margin-top:3rem">
  <div class="cup small" aria-hidden="true"><svg viewBox="0 0 160 160"><g class="steam" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M60 46c-8-10 8-16 0-28"/><path d="M80 46c-8-10 8-16 0-28"/><path d="M100 46c-8-10 8-16 0-28"/></g><path d="M34 60h92v34a34 34 0 01-34 34H68a34 34 0 01-34-34z" fill="#fff" stroke="#111215" stroke-width="5" stroke-linejoin="round"/><path d="M126 70h8a14 14 0 010 28h-8" fill="none" stroke="#111215" stroke-width="5"/><path d="M42 72h76v20a26 26 0 01-26 26H68a26 26 0 01-26-26z" fill="#c98a4b"/><path d="M50 78c18 6 42 6 60 0" fill="none" stroke="#e6b17a" stroke-width="4" stroke-linecap="round"/></svg></div>
  <div><h2>Made it to the end?</h2><p class="sub">This specification is written and maintained independently. If it was useful, a coffee helps keep it going.</p></div>
  <div class="hero-actions"><a class="btn btn-coffee btn-l" href="${DONATE}" target="_blank" rel="noopener" data-coffee="spec">${ICON.coffee}Buy me a coffee</a></div>
</aside>
</div>
</div>`,
  });

  // 3. This site's own factfile.md, its /.well-known copy and its human page (signpost 2).
  const factfile = await readFile(join(HERE, 'factfile.md'), 'utf8');
  const local = await validate({ text: factfile, name: 'factfile.md' });
  if (!local.level) throw new Error(`site factfile.md fails Basic:\n${local.findings.map((f) => f.message).join('\n')}`);
  await writeFile(join(OUT, '.well-known', 'factfile.md'), factfile);
  const { fragment } = renderPage(factfile);
  await write('factfile.html', {
    path: '/factfile',
    title: 'factfile.md: key facts',
    description: 'Key facts about factfile.md: what it is, who it is for, what it costs and how to start.',
    modified: gitDate('factfile.md'),
    md: factfile,
    body: '<div class="page-head" style="margin-bottom:1.5rem"><span class="pill butter">This site’s own factfile</span></div>' + fragment.replace('<article class="factfile"', '<article class="factfile prose"').replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>'),
  });

  // 4. Markdown twins of every page (served at /x.md, and for Accept: text/markdown by the Worker).
  for (const page of built) await writeFile(join(OUT, mdPath(page.path).slice(1)), page.md ?? markdownFor(page));

  // 5. Static files, then the generated discovery files.
  await cp(join(HERE, 'static'), OUT, { recursive: true });
  await writeDiscovery(built, { factfile, spec });
  console.log(`Built ${built.length} pages (and their Markdown twins) into ${OUT}`);
  return built;
}

/** sitemap.xml, llms.txt, llms-full.txt, the agent skill index, the changelog feed and the per-page Link headers. */
async function writeDiscovery(built, { factfile, spec }) {
  const abs = (p) => ORIGIN + (p === '/' ? '/' : p);
  const order = ['/', '/what-is-factfile', '/generate', '/spec', '/tools', '/factfile', '/about', '/support'];
  const pages = [...built].sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));

  await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${p.modified}</lastmod></url>`).join('\n')}\n</urlset>\n`);

  const line = (p) => `- [${p.title}](${ORIGIN}${mdPath(p.path)}): ${p.description}`;
  const llms = `# factfile.md

> factfile.md is an open standard for one Markdown file at the root of a website that gives AI agents a business's key facts (what it offers, who it is for and not for, what it costs and how to start), each linked to the page that shows it.

The specification is version 0.1, a draft for public comment, created by Alan Kiayi and published under CC BY 4.0. Free MIT-licensed tools draft a file from a website, check it, make the human-readable Key facts page and write a setup guide; they run in the browser at ${ORIGIN}/generate or with \`npx factfile\`. Every page on this site is also available as Markdown (add \`.md\` to the address, or send \`Accept: text/markdown\`).

## Key facts

- [factfile.md](${ORIGIN}/factfile.md): key facts about this project: what it offers, who it is for, prices and how to start

## Pages

${pages.filter((p) => p.path !== '/factfile').map(line).join('\n')}

## Optional

- [Full text for language models](${ORIGIN}/llms-full.txt): the specification, the explainer, the questions and this site's factfile.md in one file
- [Source code](${GITHUB}): specification, examples and tools on GitHub
- [Examples](${GITHUB}/tree/main/examples): complete files for a software product, a local business and an online shop
- [npm package](${NPM}): the command-line tools
- [Agent skill](${ORIGIN}/.well-known/agent-skills/factfile/SKILL.md): how an agent reads, writes and checks factfile.md files
`;
  await writeFile(join(OUT, 'llms.txt'), llms);

  const md = (path) => built.find((p) => p.path === path);
  const full = [`# factfile.md: full text for language models\n\nSource: ${ORIGIN}/llms-full.txt. Built ${new Date().toISOString().slice(0, 10)}. Each part below is also available on its own.\n`,
    `\n---\n\n# What is factfile.md?\n\n(${ORIGIN}/what-is-factfile)\n\n${markdownBody(md('/what-is-factfile'))}`,
    `\n---\n\n# Questions and answers\n\n(${ORIGIN}/#faq)\n\n${faqFrom(md('/').html).map(({ q, a }) => `## ${q}\n\n${a}`).join('\n\n')}`,
    `\n---\n\n# This site's own factfile.md\n\n(${ORIGIN}/factfile.md)\n\n\`\`\`markdown\n${factfile.trim()}\n\`\`\``,
    `\n---\n\n${spec.trim()}\n`].join('\n');
  await writeFile(join(OUT, 'llms-full.txt'), full);

  // Agent skill (agentskills.io discovery 0.2.0).
  const skill = await readFile(join(HERE, 'skill', 'SKILL.md'));
  await mkdir(join(OUT, '.well-known', 'agent-skills', 'factfile'), { recursive: true });
  await writeFile(join(OUT, '.well-known', 'agent-skills', 'factfile', 'SKILL.md'), skill);
  const fm = skill.toString('utf8').match(/^---\n([\s\S]*?)\n---/)[1];
  await writeFile(join(OUT, '.well-known', 'agent-skills', 'index.json'), JSON.stringify({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [{ name: 'factfile', type: 'skill-md', description: fm.match(/^description: (.*)$/m)[1].replace(/^"|"$/g, ''), url: `${ORIGIN}/.well-known/agent-skills/factfile/SKILL.md`, digest: 'sha256:' + createHash('sha256').update(skill).digest('hex') }],
  }, null, 2) + '\n');

  // Changelog feed, from CHANGELOG.md.
  const log = await readFile(join(HERE, '..', 'CHANGELOG.md'), 'utf8');
  const items = [...log.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/gm)].slice(0, 20).map(([, head, body]) => {
    const date = (head.match(/\((\d{1,2} \w+ \d{4})\)/) || [])[1];
    const pub = date ? new Date(date + ' 12:00 UTC') : new Date();
    return `  <item><title>${esc(head)}</title><link>${GITHUB}/blob/main/CHANGELOG.md</link><guid isPermaLink="false">factfile-${slug(head)}</guid><pubDate>${pub.toUTCString()}</pubDate><description>${esc(marked.parse(body.trim()))}</description></item>`;
  });
  await writeFile(join(OUT, 'changelog.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n  <title>factfile.md changes</title><link>${ORIGIN}/</link><description>Changes to the factfile.md specification and tools.</description><language>en-gb</language>\n  <atom:link href="${ORIGIN}/changelog.xml" rel="self" type="application/rss+xml"/>\n${items.join('\n')}\n</channel></rss>\n`);

  // Markdown twins point search engines to their HTML page as the canonical version.
  const canon = pages.filter((p) => p.path !== '/factfile')
    .map((p) => `${mdPath(p.path)}\n  Link: <${abs(p.path)}>; rel="canonical"`).join('\n\n');
  await writeFile(join(OUT, '_headers'), (await readFile(join(OUT, '_headers'), 'utf8')).trimEnd() + `\n\n# Generated by build.mjs\n${canon}\n`);

  // The page list the Worker uses for Markdown negotiation and Link headers.
  await writeFile(join(OUT, 'pages.json'), JSON.stringify(pages.map((p) => p.path)) + '\n');
}

function markdownBody(page) { return (page.md ?? markdownFor(page)).replace(/^---\n[\s\S]*?\n---\n\n/, ''); }

const built = await build();
export { built };

// The Worker must run first on every page, or those pages lose Markdown negotiation and their headers.
{
  const conf = await readFile(join(HERE, '..', 'wrangler.jsonc'), 'utf8');
  const listed = JSON.parse(conf.match(/"run_worker_first":\s*(\[[^\]]*\])/)[1]);
  const missing = built.map((p) => p.path).filter((p) => !listed.includes(p));
  if (missing.length) throw new Error(`Add these pages to run_worker_first in wrangler.jsonc: ${missing.join(', ')}`);
}

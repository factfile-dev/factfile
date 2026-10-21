import { parse } from 'node-html-parser';
import { isInstruction } from './rules.js';

/*
 * The five discovery signposts (specification, Section 3), in order of importance:
 *   1. a "Key facts" link in the home page's main content, to the human page
 *   2. the human page /factfile, which shows the facts and links to the file
 *   3. a footer link on every page, to the file
 *   4. a line in llms.txt
 *   5. machine signposts: a describedby <link> tag, a Link header, and /.well-known/factfile.md
 * The wording describes what is behind the link. It never addresses AI (that reads as an
 * instruction, and agents are trained to distrust those), and no link is ever hidden.
 */
export const MAIN_TEXT = 'Key facts: prices, who we serve and how to start';
export const MAIN_HTML = `<a href="/factfile">${MAIN_TEXT}</a>`;
export const FOOTER_TEXT = 'Key facts (factfile.md)';
export const FOOTER_HTML = `<a href="/factfile.md">${FOOTER_TEXT}</a>`;
export const PAGE_FILE_LINK_HTML = '<a href="/factfile.md">Download these facts as factfile.md</a>';
export const HEAD_HTML = '<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">';
export const LINK_HEADER = '</factfile.md>; rel="describedby"; type="text/markdown"; title="factfile.md"';
export const llmsLine = (origin) =>
  `- [factfile.md](${origin}/factfile.md): key facts about this business: what it offers, who it is for, prices and how to start`;

const TO_FILE = /(^|\/)(\.well-known\/)?factfile\.md(\?.*)?$/i;
const TO_PAGE = /(^|\/)factfile\/?(\?.*)?$/i;
const pointsHere = (href) => TO_FILE.test(href) || TO_PAGE.test(href);

// Link text that talks to AI instead of describing the destination.
const ADDRESSES_AI = /\b(ai|agents?|assistants?|llms?|bots?|chatbots?|models?|gpt|crawlers?)\b[^.]*\b(read|follow|use|must|should|always|start|first|only)\b|\binstructions?\b|\bread (this|me) first\b/i;
export const linkTextAddressesAi = (text) => ADDRESSES_AI.test(text) || isInstruction(text);

const headerValue = (headers, name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]) || '';

/** Which website builder or platform a page was made with, from tell-tale signs in its HTML. */
export function detectPlatform(html, headers = {}) {
  const h = (name) => headerValue(headers, name);
  const generator = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
  if (/wordpress/i.test(generator) || /\/wp-content\/|\/wp-includes\//.test(html)) return 'wordpress';
  if (/cdn\.shopify\.com|Shopify\.theme/.test(html)) return 'shopify';
  if (/static\.wixstatic\.com|wix-bolt|_wixCssImports/.test(html) || h('x-wix-request-id')) return 'wix';
  if (/static1\.squarespace\.com|Squarespace/i.test(html)) return 'squarespace';
  if (/webflow/i.test(generator) || /assets\.website-files\.com|webflow\.js/.test(html)) return 'webflow';
  if (/ghost/i.test(generator)) return 'ghost';
  if (/framerusercontent\.com|framer/i.test(generator)) return 'framer';
  if (/godaddy|websites\.godaddy|img1\.wsimg\.com/i.test(html + generator)) return 'godaddy';
  if (/__NEXT_DATA__|\/_next\/static\//.test(html)) return 'nextjs';
  if (/netlify/i.test(h('server'))) return 'netlify';
  if (/vercel/i.test(h('server')) || h('x-vercel-id')) return 'vercel';
  return null;
}

function ancestors(el) {
  const out = [];
  for (let p = el.parentNode; p && p.tagName; p = p.parentNode) out.push(p);
  return out;
}
const isHidden = (el) =>
  [el, ...ancestors(el)].some(
    (e) =>
      e.hasAttribute?.('hidden') ||
      e.getAttribute?.('aria-hidden') === 'true' ||
      /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(px)?\s*(;|$)/i.test(e.getAttribute?.('style') || ''),
  );
const CHROME = /^(footer|nav|header|aside)$/i;
const CHROME_ROLE = /^(contentinfo|navigation|banner|complementary)$/i;
const inChrome = (el) => ancestors(el).some((a) => CHROME.test(a.tagName) || CHROME_ROLE.test(a.getAttribute?.('role') || ''));

/** The signposts a single page carries: links in its body, a describedby tag, a Link header. */
export function signpostStatus(html, headers = {}) {
  const root = parse(html, { comment: false });

  const headerParts = headerValue(headers, 'link')
    .split(/,(?=\s*<)/)
    .filter((part) => TO_FILE.test((part.match(/<([^>]+)>/) || [])[1] || '') && /rel\s*=\s*"?[^";]*\bdescribedby\b/i.test(part));
  const header = headerParts.length > 0;
  const headerTitle = headerParts.some((p) => /title\s*=\s*"?factfile\.md"?/i.test(p));

  const tags = root.querySelectorAll('link[href]').filter((l) => TO_FILE.test(l.getAttribute('href') || ''));
  const described = tags.filter((l) => /\bdescribedby\b/i.test(l.getAttribute('rel') || ''));
  const head = described.length > 0;
  const headTitle = described.some((l) => (l.getAttribute('title') || '').trim().toLowerCase() === 'factfile.md');
  const oldHead = !head && tags.some((l) => /\bfactfile\b/i.test(l.getAttribute('rel') || ''));

  for (const el of root.querySelectorAll('script, style, noscript, template')) el.remove();
  const anchors = root.querySelectorAll('a[href]').filter((a) => pointsHere(a.getAttribute('href') || ''));
  const shown = anchors.filter((a) => !isHidden(a));
  const named = shown.filter((a) => (a.text || a.getAttribute('aria-label') || '').trim().length > 0);
  const text = (a) => (a.text || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();

  return {
    visible: named.length > 0,
    mainLink: named.some((a) => !inChrome(a)),
    footerLink: named.some((a) => inChrome(a)),
    hiddenLinks: anchors.length - shown.length,
    emptyLinks: shown.length - named.length,
    aiAddressedLinks: named.map(text).filter(linkTextAddressesAi),
    linkTexts: named.map(text),
    head,
    headTitle,
    header,
    headerTitle,
    oldHead,
  };
}

/**
 * Everything a site does to point to its factfile.md: the home page's signposts, plus the
 * file, its well-known copy, the human page and llms.txt. Reads at most five addresses.
 */
export async function siteSignposts(origin, { fetch: fetchImpl = globalThis.fetch, homeHtml, homeHeaders, userAgent = 'factfile/0.5 (+https://factfile.dev)' } = {}) {
  const get = (path, accept = 'text/html,application/xhtml+xml') =>
    fetchImpl(`${origin}${path}`, { redirect: 'follow', headers: { 'user-agent': userAgent, accept }, signal: AbortSignal.timeout(12000) });
  const text = async (path, accept) => {
    try {
      const r = await get(path, accept);
      return r.ok ? { body: await r.text(), headers: r.headers, type: r.headers.get('content-type') || '' } : null;
    } catch {
      return null;
    }
  };

  if (homeHtml === undefined) {
    const home = await text('/');
    homeHtml = home?.body ?? '';
    homeHeaders = home?.headers ?? {};
  }
  const status = signpostStatus(homeHtml, homeHeaders);

  const isFile = (r) => !!r && /factfile_version/.test(r.body) && !/^\s*<(!doctype|html)/i.test(r.body);
  const [file, wellKnown, page, llms] = await Promise.all([
    text('/factfile.md', 'text/markdown, text/plain;q=0.9'),
    text('/.well-known/factfile.md', 'text/markdown, text/plain;q=0.9'),
    text('/factfile'),
    text('/llms.txt', 'text/plain, text/markdown;q=0.9'),
  ]);
  status.fileOnline = isFile(file);
  status.wellKnown = isFile(wellKnown);
  status.humanPage = !!page && /html/i.test(page.type || 'text/html') && !isFile(page);
  status.humanPageLinksFile = status.humanPage && parse(page.body).querySelectorAll('a[href]').some((a) => TO_FILE.test(a.getAttribute('href') || ''));
  status.llmsTxt = !!llms && !/^\s*<(!doctype|html)/i.test(llms.body);
  status.llmsLine = status.llmsTxt && /factfile\.md/i.test(llms.body);
  return status;
}

export const PLATFORM_NAMES = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  wix: 'Wix',
  squarespace: 'Squarespace',
  webflow: 'Webflow',
  ghost: 'Ghost',
  framer: 'Framer',
  godaddy: 'GoDaddy Website Builder',
  nextjs: 'Next.js',
  netlify: 'Netlify',
  vercel: 'Vercel',
};

// Where each step is done on each platform. Hosted builders cannot serve files at the root.
const HOW = {
  wordpress: {
    upload: "Upload `factfile.md` with your host's File Manager or SFTP into the same folder as `wp-config.php` (often `public_html`). Make a folder called `.well-known` there and upload a copy into it too.",
    page: 'Pages → Add New. Title it "Key facts", set the address (permalink) to `factfile`, add a **Custom HTML** block and paste in the contents of `factfile-page.html`.',
    main: 'Edit your home page and add the link as a line of text near the top of the page content, for example under your opening paragraph.',
    footer: 'Appearance → Menus (or Appearance → Editor → Footer in block themes): add a Custom Link with the address and text below.',
    llms: 'If an SEO plugin (such as Yoast) creates your `llms.txt`, add the line in its settings; otherwise edit the file in the same folder as `factfile.md`.',
    head: "Use a header-code plugin such as WPCode (Code Snippets → Header & Footer → Header), or your theme's custom head code setting.",
    header: 'Add the Apache lines below to the `.htaccess` file in the same folder. If your host uses Nginx, send them the Nginx lines.',
  },
  shopify: {
    upload: 'Shopify does not let shops place files at the root of the domain, and a redirect to a Shopify file address is on a different domain, which the specification does not allow. A factfile.md app is planned. Until then, signposts 1, 2 and 3 still help agents and search engines find your facts.',
    page: 'Online Store → Pages → Add page. Title it "Key facts", click **Show HTML** (`<>`) in the editor, paste in the contents of `factfile-page.html`, and set the address to `factfile` under "Search engine listing". Shopify will publish it at `/pages/factfile`: use that address in the links below.',
    main: 'Online Store → Themes → Customize → your home page: add a **Rich text** section near the top with the link.',
    footer: 'Online Store → Navigation → Footer menu → Add menu item, linking to your Key facts page.',
    llms: 'Not possible on Shopify yet. Skip this step.',
    head: 'Online Store → Themes → Edit code → `theme.liquid`: paste the line just before `</head>`.',
    header: 'Not available on Shopify. Skip this step.',
  },
  wix: {
    upload: 'Wix does not let sites place files at the root of the domain. A factfile.md integration is planned. Until then, signposts 1, 2 and 3 still help agents and search engines find your facts.',
    page: 'Add a new page called "Key facts" with the address `factfile`, add an **Embed HTML** element or text blocks, and copy the facts from `factfile-page.html` into it.',
    main: 'Add a text line with the link near the top of your home page.',
    footer: 'Edit the footer and add a text link to your Key facts page.',
    llms: 'Not possible on Wix yet. Skip this step.',
    head: 'Settings → Custom code → Add Custom Code → place it in the Head, on all pages.',
    header: 'Not available on Wix. Skip this step.',
  },
  squarespace: {
    upload: 'Squarespace does not let sites place files at the root of the domain. A factfile.md integration is planned. Until then, signposts 1, 2 and 3 still help agents and search engines find your facts.',
    page: 'Pages → + → Blank page called "Key facts" with the URL slug `factfile`; add a **Code** block and paste in the contents of `factfile-page.html`.',
    main: 'Add a text block with the link near the top of your home page.',
    footer: 'Edit the footer and add a link to your Key facts page.',
    llms: 'Not possible on Squarespace yet. Skip this step.',
    head: 'Settings → Developer tools (or Advanced) → Code injection → Header.',
    header: 'Not available on Squarespace. Skip this step.',
  },
  webflow: {
    upload: 'Webflow cannot serve files at the root of the domain on its own. If you put Cloudflare in front of the site, a Worker can serve the file; otherwise do signposts 1, 2 and 3.',
    page: 'Add a static page with the slug `factfile` and paste the contents of `factfile-page.html` into an **Embed** element.',
    main: 'Add a text link near the top of your home page.',
    footer: 'Add the link to your footer symbol.',
    llms: 'Only possible if Cloudflare serves the file; otherwise skip.',
    head: 'Site settings → Custom code → Head code.',
    header: 'Use Cloudflare (below) if your domain runs through it; otherwise skip.',
  },
  nextjs: {
    upload: 'Put `factfile.md` in the `public/` folder, and a copy in `public/.well-known/`. Deploy.',
    page: 'Create a `/factfile` route that renders the contents of `factfile-page.html` (or put `factfile-page.html` in `public/factfile/index.html`).',
    main: 'Add the link near the top of your home page component.',
    footer: 'Add the link to your footer component.',
    llms: 'Edit `public/llms.txt`.',
    head: "Add the tag to your root layout's `<head>` (or `metadata` / `<Head>`).",
    header: 'Add the header in `next.config.js` `headers()`, or use the Vercel or Netlify lines below for your host.',
  },
};
const DEFAULT_HOW = {
  upload: 'Upload `factfile.md` to the top folder of your website (where `index.html` or `robots.txt` lives), and a copy into a `.well-known` folder there.',
  page: 'Publish `factfile-page.html` as a page at the address `/factfile` (for example as `factfile/index.html`), or paste its contents into a new page in your site editor.',
  main: 'Add the link near the top of your home page content, for example under your opening paragraph.',
  footer: 'Add the link to the footer of your site template so it shows on every page.',
  llms: 'Add the line to `llms.txt` in your top folder.',
  head: 'Paste the tag inside `<head>` in your site template.',
  header: 'Use the lines below for your web server or host.',
};

const HOSTED = ['shopify', 'wix', 'squarespace'];
const tick = (ok) => (ok ? '✅ done' : '⬜ to do');

/** A copy-paste guide for putting factfile.md online and adding the five signposts. */
export function writeSetupGuide({ name, origin, platform = null, status = null, today = new Date() }) {
  const how = HOW[platform] || DEFAULT_HOW;
  const domain = new URL(origin).host;
  const hosted = HOSTED.includes(platform);
  const pageAddr = platform === 'shopify' ? '/pages/factfile' : '/factfile';
  const s = status || {};
  const on = PLATFORM_NAMES[platform] || 'your site';
  const L = [];
  const code = (lang, ...lines) => L.push('```' + lang, ...lines, '```', '');

  L.push(`# Put factfile.md online for ${name || domain}`, '');
  L.push(`Made by \`factfile\` on ${today.toISOString().slice(0, 10)}${platform ? `. Your site looks like it is built with **${on}**, so the steps are for ${on}` : ''}.`, '');
  L.push(
    'AI agents do not look for `factfile.md` by themselves yet. These steps put it online and add five signposts that lead agents and search engines to it, starting with the ones most readers see. Do them **after** every TODO in `factfile.md` is filled in and `npx factfile validate factfile.md` passes.',
    '',
  );
  L.push('**Two rules for every link:** make it visible (never hidden), and describe what is behind it. Do not write link text aimed at AI, such as "AI agents: read this first". Agents are trained to distrust instructions on web pages, so it can lower their trust in your whole site.', '');

  if (status) {
    L.push('| Signpost | Status |', '| --- | --- |');
    L.push(`| File online at /factfile.md | ${hosted ? 'not possible on this platform yet' : tick(s.fileOnline)}${s.fileOnline && !s.wellKnown ? ' (add the /.well-known copy)' : ''} |`);
    L.push(`| 1. Key facts link in your home page's main content | ${tick(s.mainLink)}${!s.mainLink && s.footerLink ? ' (you have a footer link; add this one too)' : ''} |`);
    L.push(`| 2. Human page at ${pageAddr} | ${tick(s.humanPage)}${s.humanPage && !s.humanPageLinksFile && !hosted ? ' (add the link to the file)' : ''} |`);
    L.push(`| 3. Footer link | ${tick(s.footerLink)} |`);
    L.push(`| 4. Line in llms.txt | ${hosted ? 'not possible on this platform yet' : s.llmsTxt ? tick(s.llmsLine) : 'no llms.txt (optional)'} |`);
    L.push(`| 5. Link tag and Link header | ${hosted ? 'wait until the file can be online' : `tag ${s.head ? (s.headTitle ? '✅' : '⚠️ add title="factfile.md"') : '⬜'} · header ${s.header ? (s.headerTitle ? '✅' : '⚠️ add title="factfile.md"') : '⬜'}`} |`);
    if (s.aiAddressedLinks?.length) L.push(`| ⚠️ Link text aimed at AI | Reword: "${s.aiAddressedLinks[0]}" |`);
    if (s.hiddenLinks) L.push('| ⚠️ Hidden link to factfile | Remove it or make it visible |');
    L.push('');
  }

  L.push('## Step 1. Put the file online', '');
  L.push(how.upload, '');
  if (!hosted) L.push(`Then open **https://${domain}/factfile.md**: it should show the text of the file, not a web page.`, '');

  L.push(`## Step 2. Publish the human page (signpost 2)`, '');
  L.push('Make the facts a normal web page that people and search engines can read. Run this to turn your finished `factfile.md` into the page:', '');
  code('', 'npx factfile page factfile.md');
  L.push(`It writes \`factfile-page.html\` (and a full page you can upload, \`factfile.html\`). The page shows your Verdict first and ends with a link to the file${hosted ? ' (remove that last link until the file can be online)' : ''}.`, '');
  L.push(`On ${on}: ${how.page}`, '');

  L.push("## Step 3. Add a Key facts link to your home page (signpost 1, the most important)", '');
  L.push("Many AI tools keep only the main content of a page and drop menus and footers. A link near the top of your home page's content survives. Use your own words if you like, as long as they say what is behind the link:", '');
  code('html', `<a href="${pageAddr}">${MAIN_TEXT}</a>`);
  L.push(`On ${on}: ${how.main}`, '');

  L.push('## Step 4. Add a footer link (signpost 3)', '');
  L.push('Browser agents read every link on the page, footer included. Add this so it appears on every page:', '');
  code('html', hosted ? `<a href="${pageAddr}">Key facts</a>` : FOOTER_HTML);
  L.push(`On ${on}: ${how.footer}`, '');

  L.push('## Step 5. Add a line to llms.txt (signpost 4)', '');
  L.push('Coding agents such as Claude Code and Cursor read `llms.txt`. If your site has one, add this line to it:', '');
  code('markdown', llmsLine(`https://${domain}`));
  L.push(`On ${on}: ${how.llms}`, '');

  L.push('## Step 6. Add the machine signposts (signpost 5)', '');
  if (hosted) {
    L.push(`Skip this until the file itself can be online (step 1): a tag pointing to a missing file sends tools nowhere. When it is online, paste this inside \`<head>\` (${how.head}):`, '');
    code('html', HEAD_HTML);
  } else {
    L.push('Tools built for factfile.md, and agent-readiness checkers, look for these. Keep `title="factfile.md"`: it tells them apart from the `describedby` link that llms.txt uses.', '');
    L.push('**In the `<head>` of every page:**', '');
    code('html', HEAD_HTML);
    L.push(`On ${on}: ${how.head}`, '');
    L.push(`**As a Link header**, where your host allows it. ${how.header} The lines also serve the file as Markdown.`, '');
    L.push('Apache (`.htaccess`):');
    code('apache', 'AddType "text/markdown; charset=utf-8" .md', '<IfModule mod_headers.c>', `  Header add Link "${LINK_HEADER.replace(/"/g, '\\"')}"`, '</IfModule>');
    L.push('Nginx (inside your `server { }` block):');
    code('nginx', `add_header Link '${LINK_HEADER}' always;`, 'location ~ factfile\\.md$ { default_type "text/markdown; charset=utf-8"; }');
    L.push('Netlify (a file called `_headers` in your publish folder):');
    code('', '/*', `  Link: ${LINK_HEADER}`, '/factfile.md', '  Content-Type: text/markdown; charset=utf-8');
    L.push('Vercel (`vercel.json`):');
    code(
      'json',
      JSON.stringify(
        {
          headers: [
            { source: '/(.*)', headers: [{ key: 'Link', value: LINK_HEADER }] },
            { source: '/factfile.md', headers: [{ key: 'Content-Type', value: 'text/markdown; charset=utf-8' }] },
          ],
        },
        null,
        2,
      ),
    );
    L.push('Cloudflare, if your domain runs through it: Rules → Transform Rules → Modify Response Header → add `Link` with the value:');
    code('', LINK_HEADER);
  }
  L.push(`Also add **https://${domain}${pageAddr}** to your \`sitemap.xml\`, if you edit it by hand (most site builders do this for you).`, '');

  L.push('## Step 7. Check it', '');
  code('', `npx factfile validate ${domain}`);
  L.push('The validator fetches the live file, checks every rule, and reports any signpost that is missing or worded in a way agents may distrust.', '');
  return L.join('\n');
}

import { parse } from 'node-html-parser';

export const LINK_TEXT = 'Facts for AI (factfile.md)';
export const FOOTER_HTML = `<a href="/factfile.md">${LINK_TEXT}</a>`;
export const HEAD_HTML = '<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">';
export const LINK_HEADER = '</factfile.md>; rel="describedby"; type="text/markdown"; title="factfile.md"';

const POINTS_TO_FILE = /(^|\/)(\.well-known\/)?factfile\.md(\?.*)?$/i;

/** Which website builder or platform a page was made with, from tell-tale signs in its HTML. */
export function detectPlatform(html, headers = {}) {
  const h = (name) => (typeof headers.get === 'function' ? headers.get(name) : headers[name]) || '';
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

/** Which of the three signposts a home page already has. */
export function signpostStatus(html, headers = {}) {
  const get = (name) => (typeof headers.get === 'function' ? headers.get(name) : headers[name]) || '';
  const root = parse(html, { comment: false });

  const header = get('link')
    .split(/,(?=\s*<)/)
    .some((part) => {
      const url = (part.match(/<([^>]+)>/) || [])[1] || '';
      return POINTS_TO_FILE.test(url) && /rel\s*=\s*"?[^";]*\bdescribedby\b/i.test(part);
    });

  const linkTags = root.querySelectorAll('link[href]').filter((l) => POINTS_TO_FILE.test(l.getAttribute('href') || ''));
  const head = linkTags.some((l) => /\bdescribedby\b/i.test(l.getAttribute('rel') || ''));
  const oldHead = !head && linkTags.some((l) => /\bfactfile\b/i.test(l.getAttribute('rel') || ''));

  for (const el of root.querySelectorAll('script, style, noscript, template, [hidden], [aria-hidden="true"]')) el.remove();
  const visible = root
    .querySelectorAll('a[href]')
    .some((a) => {
      const href = a.getAttribute('href') || '';
      const style = (a.getAttribute('style') || '').replace(/\s/g, '');
      return (POINTS_TO_FILE.test(href) || /(^|\/)factfile\/?$/i.test(href)) && a.text.trim().length > 0 && !/display:none|visibility:hidden/i.test(style);
    });

  return { visible, head, header, oldHead };
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

// Where each step is done on each platform. Hosted builders often cannot serve files at the root.
const HOW = {
  wordpress: {
    upload: 'Upload `factfile.md` with your host\'s File Manager or SFTP into the same folder as `wp-config.php` (often `public_html`). Make a folder called `.well-known` there and upload a copy into it too.',
    footer: 'Appearance → Menus (or Appearance → Editor → Footer in block themes): add a Custom Link to `/factfile.md` with the text above.',
    head: 'Use a header-code plugin such as WPCode (Code Snippets → Header & Footer → Header), or your theme\'s "custom head code" setting.',
    header: 'Add the Apache lines below to the `.htaccess` file in the same folder. If your host uses Nginx, send them the Nginx lines.',
  },
  shopify: {
    upload: 'Shopify does not let shops place files at the root of the domain, and a redirect to a Shopify file address is on a different domain, which the specification does not allow. A factfile.md app is planned. Until then, do steps 2, 3 and 5: they still help agents and search engines find your facts.',
    footer: 'Online Store → Navigation → Footer menu → Add menu item, linking to your `/factfile` page.',
    head: 'Online Store → Themes → Edit code → `theme.liquid`: paste the line just before `</head>`.',
    header: 'Not available on Shopify. Skip this step.',
  },
  wix: {
    upload: 'Wix does not let sites place files at the root of the domain. A factfile.md integration is planned. Until then, do steps 2, 3 and 5.',
    footer: 'Edit the footer and add a text link to your `/factfile` page.',
    head: 'Settings → Custom code → Add Custom Code → place it in the Head, on all pages.',
    header: 'Not available on Wix. Skip this step.',
  },
  squarespace: {
    upload: 'Squarespace does not let sites place files at the root of the domain. A factfile.md integration is planned. Until then, do steps 2, 3 and 5.',
    footer: 'Edit the footer and add a link to your `/factfile` page.',
    head: 'Settings → Developer tools (or Advanced) → Code injection → Header.',
    header: 'Not available on Squarespace. Skip this step.',
  },
  webflow: {
    upload: 'Webflow cannot serve files at the root of the domain on its own. If you put Cloudflare in front of the site, a Worker can serve the file; otherwise do steps 2, 3 and 5.',
    footer: 'Add a link in your footer symbol to `/factfile.md` (or your `/factfile` page).',
    head: 'Site settings → Custom code → Head code.',
    header: 'Use Cloudflare (see below) if your domain runs through it; otherwise skip.',
  },
  nextjs: {
    upload: 'Put `factfile.md` in the `public/` folder, and a copy in `public/.well-known/`. Deploy.',
    footer: 'Add the link to your footer component.',
    head: 'Add the tag to your root layout\'s `<head>` (or `metadata` / `<Head>`).',
    header: 'Add the header in `next.config.js` `headers()`, or use the Vercel or Netlify lines below for your host.',
  },
};
const DEFAULT_HOW = {
  upload: 'Upload `factfile.md` to the top folder of your website (where `index.html` or `robots.txt` lives), and a copy into a `.well-known` folder there.',
  footer: 'Add the link to the footer of your site template so it shows on every page.',
  head: 'Paste the tag inside `<head>` in your site template.',
  header: 'Use the lines below for your web server or host.',
};

const tick = (ok) => (ok ? '✅ already done' : '⬜ to do');

/** A copy-paste guide for putting factfile.md online and making it findable. */
export function writeSetupGuide({ name, origin, platform = null, status = null, today = new Date() }) {
  const how = HOW[platform] || DEFAULT_HOW;
  const domain = new URL(origin).host;
  const hosted = ['shopify', 'wix', 'squarespace'].includes(platform);
  const s = status || {};
  const L = [];
  L.push(`# Put factfile.md online for ${name || domain}`);
  L.push('');
  L.push(`Made by \`factfile\` on ${today.toISOString().slice(0, 10)}${platform ? `. Your site looks like it is built with **${PLATFORM_NAMES[platform]}**, so the steps below are for ${PLATFORM_NAMES[platform]}` : ''}.`);
  L.push('');
  L.push('AI agents do not look for `factfile.md` by themselves yet. These steps put it online and point to it from your site, so agents and search engines can find it. Do them **after** you have filled in every TODO in `factfile.md` and it passes `npx factfile validate factfile.md`.');
  L.push('');
  if (status) {
    L.push('| Step | Status |');
    L.push('| --- | --- |');
    L.push(`| 1. File online at /factfile.md | ${s.fileOnline ? '✅ already online' : '⬜ to do'} |`);
    L.push(`| 2. Visible link on your site | ${tick(s.visible)} |`);
    L.push(`| 3. Link tag in the page head | ${tick(s.head)}${s.oldHead ? ' (uses the old `rel="factfile"`; change it to `describedby`)' : ''} |`);
    L.push(`| 4. Link header from your server | ${hosted ? 'not possible on this platform' : tick(s.header)} |`);
    L.push('');
  }

  L.push('## 1. Put the file online');
  L.push('');
  L.push(how.upload);
  L.push('');
  L.push(`Then check that **https://${domain}/factfile.md** shows the text of the file, not a web page.`);
  L.push('');

  L.push('## 2. Add a visible link (most important)');
  L.push('');
  L.push('Agents read the text and links on your pages. A link they can see is the signpost they are most likely to follow. Add this to your footer, so it is on every page:');
  L.push('');
  L.push('```html');
  L.push(hosted ? `<a href="/factfile">${LINK_TEXT}</a>` : FOOTER_HTML);
  L.push('```');
  L.push('');
  L.push(`On ${PLATFORM_NAMES[platform] || 'your site'}: ${how.footer}`);
  L.push('');

  L.push('## 3. Add a link tag to the page head');
  L.push('');
  if (hosted) {
    L.push(`Skip this until the file itself can be online (step 1). A tag pointing to a missing file would send agents nowhere. When it is online, paste this inside \`<head>\` (${how.head}):`);
  } else {
    L.push('This tells tools that read your page code where the file is. Paste it inside `<head>` on every page:');
  }
  L.push('');
  L.push('```html');
  L.push(HEAD_HTML);
  L.push('```');
  L.push('');
  if (!hosted) {
    L.push(`On ${PLATFORM_NAMES[platform] || 'your site'}: ${how.head}`);
    L.push('');
  }

  L.push('## 4. Send a Link header (if your host allows it)');
  L.push('');
  L.push(`${how.header} The header also makes sure the file is served as Markdown.`);
  L.push('');
  if (!hosted) {
    L.push('**Apache** (`.htaccess`):');
    L.push('```apache');
    L.push('AddType "text/markdown; charset=utf-8" .md');
    L.push('<IfModule mod_headers.c>');
    L.push(`  Header add Link "${LINK_HEADER.replace(/"/g, '\\"')}"`);
    L.push('</IfModule>');
    L.push('```');
    L.push('');
    L.push('**Nginx** (inside your `server { }` block):');
    L.push('```nginx');
    L.push(`add_header Link '${LINK_HEADER}' always;`);
    L.push('location ~ factfile\\.md$ { default_type "text/markdown; charset=utf-8"; }');
    L.push('```');
    L.push('');
    L.push('**Netlify** (a file called `_headers` in your publish folder):');
    L.push('```');
    L.push('/*');
    L.push(`  Link: ${LINK_HEADER}`);
    L.push('/factfile.md');
    L.push('  Content-Type: text/markdown; charset=utf-8');
    L.push('```');
    L.push('');
    L.push('**Vercel** (`vercel.json`):');
    L.push('```json');
    L.push(
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
    L.push('```');
    L.push('');
    L.push('**Cloudflare** (if your domain runs through it): Rules → Transform Rules → Modify Response Header → Add `Link` with the value:');
    L.push('```');
    L.push(LINK_HEADER);
    L.push('```');
    L.push('');
  }

  L.push('## 5. Add the human page and the other signposts');
  L.push('');
  L.push(`- **A normal web page at \`/factfile\`** showing the same facts in plain words. Search engines index it, so AI search tools can find your facts even if they never open the file. The specification requires every fact to be visible to people anyway.`);
  L.push(`- **\`llms.txt\`**, if you have one: add the line \`- [factfile.md](https://${domain}/factfile.md): business facts for agents\``);
  L.push(`- **\`sitemap.xml\`**: include \`https://${domain}/factfile\`.`);
  L.push('');

  L.push('## 6. Check it');
  L.push('');
  L.push('```');
  L.push(`npx factfile validate ${domain}`);
  L.push('```');
  L.push('');
  L.push('The validator fetches the live file, checks every rule, and warns about any signpost that is missing.');
  L.push('');
  return L.join('\n');
}

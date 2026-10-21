# factfile.dev website source

The website is built into `../site` and served by the Cloudflare Worker in `../worker` (config: `../wrangler.jsonc`). Nothing is built on Cloudflare: build here, commit `../site`, push.

```sh
cd site-src
npm install
npm run build        # builds ../site
npm test             # end-to-end test of /generate in a real browser
```

Rebuild the in-browser tools bundle whenever `validator/src` changes:
`cd browser-bundle && npm i --no-save esbuild@0.24.0 && node build.mjs`

## What the build makes

- Every page as HTML, plus a Markdown twin (`/about` → `/about.md`). The Worker serves the twin to clients that prefer `text/markdown`.
- JSON-LD on every page (WebSite, Person, the page, breadcrumb, and the standard, tools or FAQ it describes), with `dateModified` and sitemap dates from git.
- `/spec` from `../SPEC.md`; `/factfile` and `/factfile.md` from `factfile.md` (the build refuses a file that fails Basic).
- `llms.txt`, `llms-full.txt`, `sitemap.xml`, `changelog.xml` (from `../CHANGELOG.md`), the agent skill index at `/.well-known/agent-skills/index.json` (from `skill/SKILL.md`, with its digest), and canonical `Link` headers for the Markdown twins.
- `pages.json`, the page list the Worker uses. Every page must also be in `run_worker_first` in `wrangler.jsonc`; the build checks this.

## Sources

- `pages/*.html`: page bodies, each starting with a `<!-- {"title": …, "description": …} -->` header (`md_note` adds text to the Markdown twin)
- `static/`: CSS, scripts, fonts, images, `_headers`, `robots.txt` (AI crawler rules and Content-Signal), `.well-known/security.txt`, the IndexNow key file
- `skill/SKILL.md`: the factfile agent skill
- `test/generator.e2e.mjs`: drafts, edits, checks and downloads with a fixture website, and calls the WebMCP tools

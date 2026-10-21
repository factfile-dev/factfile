# factfile.dev website source

The website is built into `../site`, which Cloudflare Pages serves as-is (no build step on Cloudflare).

```sh
cd site-src
npm install
npm run build
```

- `pages/*.html`: page bodies, each starting with a `<!-- {"title": …, "description": …} -->` header
- `factfile.md`: the site's own factfile.md; the build refuses to run if it fails Basic
- `static/`: CSS, `_headers` (the `Link` header and Markdown content types), `llms.txt`, `robots.txt`
- `/spec` is rendered from `../SPEC.md` and `/factfile` from `factfile.md`, so they cannot drift

Rebuild and commit `../site` after changing the spec or any page.

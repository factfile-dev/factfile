# Changelog

## Unreleased

- Spec: five discovery signposts in order of importance: a "Key facts" link in the home page's main content, the human page (Verdict first, linking to the file), a footer link, an `llms.txt` line, and machine signposts (`describedby` tag and header, `/.well-known/` copy). Signpost links MUST be visible and MUST NOT address AI; `describedby` MUST carry `title="factfile.md"`. Based on how agent fetch tools read pages: most keep only main content and drop footers and `<head>`.
- factfile 0.5.0: new `factfile page` command makes the human page (`factfile.html` block and `factfile-page.html` full page); the setup guide covers all five signposts with status for each; the validator fails hidden signpost links and link text aimed at AI, and warns for each missing signpost; link wording is now "Key facts" instead of "Facts for AI"
- Spec: discovery signposts. A visible link on the home page (SHOULD), and the registered `describedby` link relation for the `<head>` link and a new HTTP `Link` header (replacing the invented `rel="factfile"`). The agent reading protocol starts with "Look for it".
- factfile 0.4.0: `generate` also writes `factfile-setup.md`, platform-aware copy-paste code for the signposts (WordPress, Shopify, Wix, Squarespace, Webflow, Next.js, Apache, Nginx, Netlify, Vercel, Cloudflare) with the site's current status; new `factfile setup <site>` command; the validator warns when a live site has no visible or `describedby` signpost; figures followed by a comma ("Unit 4,") or written as "2.5x" are read correctly
- factfile 0.3.0, from the first real-world test: the brand name instead of the whole page title; the Verdict keeps the site's full sentence and a shortened summary is cut at a natural break and flagged; services, about and other main pages are read (up to 10); spam-protected emails are decoded; phone numbers kept as the page shows them; a "Book appointment" button that leads to a contact page is not treated as online booking; regulators (Ofsted, CQC, Charity Commission, FCA, SRA, GDC, Companies House) are recognised, and a regulator mentioned but not linked becomes a TODO; sites with no structured data default to the `service` profile with their address, phone and hours filled in
- factfile 0.2.0: new `generate` command drafts a factfile.md from a website (visible text and schema.org data, robots.txt respected, TODOs for what only the owner knows), with optional AI wording from Ollama or any OpenAI-compatible API, checked against the site before use
- Validator: unfinished drafts (`TODO`) fail Basic; Windows line endings supported
- Validator 0.1.0 (`validator/`): checks Basic, Comparable and Checked, including live serving, cloaking and visible-parity checks
- Store example lists its product feed in Sources

## v0.1-draft (20 October 2026)

First public draft of the factfile.md specification.

- File format: YAML header, five-line Verdict, fixed sections, Sources and end marker
- 8 required header fields and 7 profiles (software, store, local, service, product, content, organisation)
- 8 integrity rules, including visible parity and receipts
- Three conformance levels: Basic, Comparable, Checked
- Agent reading protocol and security considerations
- Three example files: software, local business, online shop

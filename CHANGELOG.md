# Changelog

## Unreleased

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

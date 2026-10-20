# Changelog

## Unreleased

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

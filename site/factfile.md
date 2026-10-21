---
factfile_version: 0.1
name: factfile.md
url: https://factfile.dev
type: [software]
category: open standard and free tools for publishing business facts to AI agents
summary: An open standard for one Markdown file of checkable business facts at a website's root, with free tools to write and check it.
regions: [global]
language: en-GB
pricing:
  model: free
  currency: GBP
  from: 0
  source: https://factfile.dev/tools
get_started: https://factfile.dev/tools
human_page: https://factfile.dev/factfile
publisher: { legal_name: "Alan Kiayi", corrections: "hello@factfile.dev" }
agent_access: { api: none, mcp: none, docs: https://factfile.dev/spec }
freshness: { last_verified: 2026-10-21, review_by: 2027-04-21, generated_by: manual }
---

# factfile.md

## Verdict
- **What:** An open standard for one Markdown file at a website's root that gives AI agents a business's key facts, each linked to its source page.
- **Best for:** Small businesses, makers and agencies who want AI assistants to describe their offer, prices and fit correctly.
- **Not for:** Businesses looking to persuade AI assistants: the file allows no superlatives or text aimed at AI.
- **Price:** Free: the specification is open under CC BY 4.0 and the tools are open source ([tools](https://factfile.dev/tools)).
- **Next step:** Draft a file from your website with `npx factfile generate example.com` ([tools](https://factfile.dev/tools)).

## Fit
### Best for
- Businesses whose prices, limits or eligibility are easy for AI assistants to get wrong
- Website owners who can upload a file or add a page in their site builder
- Agent builders who want one predictable place to read business facts
### Not for
- Businesses that do not want to say publicly who they are not for
- Shops wanting to list a whole product catalogue (the file links to a product feed instead)

## Pricing
The specification and the tools cost nothing. The specification is published under CC BY 4.0 and the factfile tools under the MIT licence. Source: https://factfile.dev/tools

## How it differs
- Every price and number links to a live page that states it, and the validator checks that people can see the same facts on the website ([specification](https://factfile.dev/spec)).
- A fixed five-line Verdict and fixed section headings, so files from different businesses can be compared line by line.
- A "Not for" list and a Limitations section are required in every file.
- The rules forbid superlatives, hidden text and instructions addressed to AI.

## Evidence
- npm package page, with download figures counted by npm: https://www.npmjs.com/package/factfile

## How to start
1. Draft a file from your website with `npx factfile generate example.com`.
2. Complete the lines the draft marks for you, then check the file with `npx factfile validate factfile.md`.
3. Upload it to your website's root and add the signposts listed in `factfile-setup.md`.

## How agents can use it
There is no API or MCP server yet. Agents can fetch `/factfile.md` from any site that publishes one and follow the reading protocol in the specification ([specification](https://factfile.dev/spec)).

## Limitations
- Version 0.1 is a draft for public comment, so fields and headings may change before version 1.0.
- AI assistants do not yet look for factfile.md on their own, so sites need to link to it.
- The tools run from a terminal and need Node.js 18 or later.

## Software details
- Platforms: macOS, Windows and Linux, with Node.js 18 or later
- Install: none needed; the tools run with `npx factfile`
- Source code: https://github.com/factfile-dev/factfile
- Language: English
- Data: the tools run on your own computer, and `generate` reads only public pages and respects robots.txt

## Sources
- Tools and licences: https://factfile.dev/tools
- Specification: https://factfile.dev/spec
- Source code: https://github.com/factfile-dev/factfile
- npm package: https://www.npmjs.com/package/factfile
<!-- end of factfile.md -->

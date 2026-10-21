# factfile.md

**The facts AI needs, in one file you control.**

factfile.md is an open standard: a single Markdown file at the root of a website that gives AI agents a complete, checkable description of what a business offers, who it is for, what it costs and how to start.

```
https://example.com/factfile.md
```

AI assistants now research, compare and recommend businesses for people. They often get the basics wrong, especially prices, because the facts are scattered across pages built for humans. factfile.md puts those facts in one predictable place, in the same structure on every site, with rules that make a dishonest file easy to detect.

## How it fits with other files

| File | Tells agents |
| --- | --- |
| `robots.txt` | where they may go |
| `llms.txt` | where the useful content is |
| MCP / A2A cards | what tools they can call |
| **`factfile.md`** | **what the business is, who it is for and not for, what it costs, how to start, and what it does not do** |

## What a file looks like

```markdown
---
factfile_version: 0.1
name: Tidy Budget
url: https://tidybudget.example
type: [software]
summary: Offline-first budgeting app for iOS and Android that never asks for a bank login.
pricing: { model: freemium, currency: GBP, from: 0, source: https://tidybudget.example/pricing }
freshness: { last_verified: 2026-10-20, review_by: 2027-04-20 }
---

# Tidy Budget

## Verdict
- **What:** A budgeting app that works offline and never asks for your bank login.
- **Best for:** Individuals and couples who budget by hand and want privacy.
- **Not for:** People who want automatic bank-transaction import, or businesses.
- **Price:** Free for 2 budgets; Plus is £3.99 a month ([pricing](https://tidybudget.example/pricing)).
- **Next step:** Download it from the App Store or Google Play ([download](https://tidybudget.example/download)).

...

<!-- end of factfile.md -->
```

Full examples: [software](examples/software/factfile.md) · [local business](examples/local/factfile.md) · [online shop](examples/store/factfile.md)

## The rules that keep it honest

1. **Visible parity:** every fact must also appear on a page people can see.
2. **Receipts:** every price and number links to the live page that states it.
3. **State each fact once:** no repetition to add weight.
4. **No text addressed to AI:** the file describes; it never instructs.
5. **No superlatives:** no "best", "leading" or "#1".

Agents are told to treat the file as the publisher's claims, to check the receipts, and to respect what the business says it is **not** for.

## Write and check a file

```sh
npx factfile generate example.com   # draft a factfile.md from your website, plus a setup guide
npx factfile page factfile.md       # turn it into a web page for people (your /factfile page)
npx factfile validate example.com   # check a live file
```

AI agents do not look for `/factfile.md` by themselves yet, so the specification asks sites to point to it with five signposts: a "Key facts" link in the home page's main content, a human page at `/factfile` that shows the facts first, a footer link, a line in `llms.txt`, and machine signposts (a `describedby` link tag, a `Link` header and a `/.well-known/` copy). The setup guide gives copy-paste code for each, for your site's platform.

The [factfile tool](validator/) drafts a file using only what your website visibly says, leaving clear TODOs for what only you can answer. It then reports the level a file reaches (Basic, Comparable or Checked) and every problem, line by line.

## Read the specification

**[SPEC.md](SPEC.md)**: factfile.md v0.1, draft for public comment.

## Status

v0.1 is a draft. Fields may change before v1.0. Comments and objections are welcome as [issues](https://github.com/factfile-dev/factfile/issues).

## Licence

The specification is published under [CC BY 4.0](LICENSE). The factfile tool is [MIT-licensed](validator/LICENSE). The name factfile.md is not licensed under CC BY; adapted or forked versions must use a different name.

Created by **Alan Kiayi** · [factfile.dev](https://factfile.dev) · hello@factfile.dev

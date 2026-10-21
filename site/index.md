---
title: "factfile.md: checkable business facts for AI agents"
description: "factfile.md is an open standard for one Markdown file at a website's root that gives AI agents a business's key facts, each linked to the page that shows it."
url: https://factfile.dev/
last_modified: 2026-10-21
site_facts: https://factfile.dev/factfile.md
---

[Open standard, free tools](https://factfile.dev/spec)

# Facts AI can check

factfile.md is one short Markdown file at the root of your website. It tells AI agents what you offer, who it is for and not for, what it costs and how to start, with each fact linked to the page that shows it.

[Generate your file](https://factfile.dev/generate) [Read the specification](https://factfile.dev/spec)

[Key facts: prices, who we serve and how to start](https://factfile.dev/factfile)

-   A receipt for every price
-   Says who it is not for
-   No superlatives allowed

Works alongside the files and platforms you already use

> A file must say who the business is not for, may not use superlatives, and may not speak to the AI reading it, because a standard that can be gamed would not be worth reading.

**Alan Kiayi**, creator of factfile.md

Who is it for?

## One file shape for every kind of business

Each kind of business has a profile with a few extra fields. A small business can write a Basic file by hand in ten minutes.

### Local businesses

Salons, trades, clinics and cafés. Area served, booking and opening details in one place.

### Online shops

Delivery, returns and who you ship to. The file links to your product feed instead of listing it.

### Software

Plans, platforms and limits stated plainly, so assistants stop guessing what each tier includes.

### Services

Consultants and agencies. Who you work with, how engagements start and what you will not take on.

### Publishers and organisations

What you publish or do, who it serves, and how to get involved or get in touch.

### Agent builders

One predictable place to read business facts, with a reading protocol and receipts to verify.

## AI assistants guess when the facts are scattered

Hidden

### Prices load from scripts

The assistant reads the page before the price appears, so it fills the gap with a guess.

Buried

### Limits sit in small print

Eligibility, delivery areas and exclusions live in terms pages that nobody quotes back.

Missing

### Nobody says who it is not for

Almost no website states it, so assistants recommend businesses to the wrong people.

## Rules that make a dishonest file easy to spot

Agents are told to treat the file as the publisher’s claims, check the receipts, and respect what the business says it is not for.

**Receipts.** Every price and number links to a live page that states it.

**Visible parity.** Every fact must also appear on the website for people.

**Who it is not for.** Every file says who should look elsewhere.

**No persuasion.** No superlatives, hidden text or instructions aimed at AI.

**Dated.** Each file says when it was last checked and when it will be again.

**Same shape everywhere.** A fixed Verdict and sections, so files compare line by line.

[Read the rules in full](https://factfile.dev/spec)

## From your website to a checked file in minutes

### Draft it from what your website already says

**It never invents a fact.** The generator reads your public pages, respects robots.txt, and marks what only you can answer as TODO.

### Every claim carries its receipt

**Agents check before they repeat.** Each price and number in the file links to the live page that states it, and that page must show the same fact to people.

### Check it before agents do

**Three levels, every problem in plain words.** Basic, Comparable or Checked, with each issue reported line by line so you know exactly what to fix.

### Signpost it so agents find it

**Agents do not look for the file on their own yet.** Five signposts point them to it, with copy-paste code for your site’s platform.

## It fills the gap the other files leave

factfile.md replaces none of them. A site can have all of these, and llms.txt can link to factfile.md. [Full comparison](https://factfile.dev/what-is-factfile)

| File | Tells agents |
| --- | --- |
| `robots.txt` | where they may go |
| `llms.txt` | where the useful content is |
| MCP / A2A cards | what tools they can call |
| `factfile.md` | **what the business is, who it is for and not for, what it costs, how to start, and what it does not do** |

### Data, never instructions

The file describes the business. It never tells an agent what to do, and agents are told to ignore any text that tries.

### Dated and reviewable

Every file states when it was last verified and when it will be reviewed, so agents can tell a fresh file from a stale one.

Free under CC BY 4.0 and MIT

## Publish facts AI can check

Draft a file from your website right here in your browser, fill in what it flags, and download everything you need.

[Generate your file](https://factfile.dev/generate)

## Free for everyone, kept going by coffee

No ads, no tracking, no paid tier. If factfile.md helps you, you can buy me a coffee.

[Buy me a coffee](https://buymeacoffee.com/alankiayi)[How it helps](https://factfile.dev/support)

## Questions

### Does factfile.md cost anything?

No. The specification is open under CC BY 4.0 and the tools are open source under the MIT licence.

### Do AI assistants read factfile.md yet?

Not on their own. That is why the specification asks sites to point to the file with five signposts, including a “Key facts” link on the home page and standard link tags.

### How is it different from llms.txt?

llms.txt is an index of a site’s pages. factfile.md holds the facts themselves in a fixed shape. A site can have both, and llms.txt can link to factfile.md.

### Why must I say who my business is not for?

Because it is the fact websites most often leave out, and the one that stops assistants sending you the wrong customers. Every file needs a Not for line and a Limitations section.

### Can I write the file by hand?

Yes. A small business can write a Basic file in about ten minutes. The generator is there if you would rather start from what your website already says.

### What do I need to make a file?

Nothing, if you use the [generator on this site](https://factfile.dev/generate): it runs in your browser. The command-line tools need Node.js 18 or later and run with `npx`. There is no platform plugin yet.

### How is factfile.md funded?

It is an independent project with no ads or paid tier. If it helps you, you can [buy me a coffee](https://factfile.dev/support).

### Where does factfile.md go on my website?

At the root, so it opens at `yourdomain.com/factfile.md`, with a copy at `/.well-known/factfile.md`. A “Key facts” page at `/factfile` shows the same facts to people. The [generator](https://factfile.dev/generate) gives step-by-step instructions for WordPress, Shopify, Wix, Squarespace, Webflow and Next.js.

### Will factfile.md make AI assistants recommend my business?

No file can promise that, and factfile.md is not built to persuade. It makes sure that when an assistant describes your business, it has your real prices, who you serve and who you do not, with links it can check.

### Is factfile.md an official web standard?

Not yet. It is an independent open specification by Alan Kiayi, published as a draft for public comment. It builds on existing standards: Markdown, the `/.well-known/` location and the registered `describedby` link relation.

### Is the specification stable?

Version 0.1 is a draft for public comment, so fields and headings may change before version 1.0. Comments are welcome as GitHub issues.

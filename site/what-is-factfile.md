---
title: "What is factfile.md? The business facts file for AI agents"
description: "factfile.md is a Markdown file at a website's root that gives AI agents a business's key facts, each linked to its source. How it compares with llms.txt."
url: https://factfile.dev/what-is-factfile
last_modified: 2026-10-21
site_facts: https://factfile.dev/factfile.md
---

Explainer

# What is factfile.md?

factfile.md is a Markdown file at the root of a website that gives AI agents a business’s key facts (what it offers, who it is for and not for, what it costs and how to start), each linked to the page that shows it.

## The problem it solves

When someone asks an AI assistant “which one should I choose?”, the assistant has to work out a business from pages written for people. Prices load from scripts, limits sit in terms and conditions, and almost no website says who it is *not* for. The assistant fills the gaps, and its answer can be confidently wrong.

factfile.md gives the assistant the facts in one predictable place, in the same shape for every business, with a link to check each one.

## How it works

1.  The business publishes `/factfile.md`: a short header of fields, a five-line Verdict, then fixed sections such as Fit, Pricing and Limitations.
2.  Every price and number links to a live page that states it. Every fact must also be visible to people on the website.
3.  The business points to the file from its own pages, so agents find it: a “Key facts” link, a human-readable page at `/factfile`, a footer link and standard link tags.
4.  An agent reads the file, treats it as the business’s own claims, checks the links, and respects what the business says it is not for.

## How it relates to other files

| File or format | What it does | How factfile.md differs |
| --- | --- | --- |
| [llms.txt](https://llmstxt.org/) | A Markdown index of a site’s pages for language models. | factfile.md holds the facts themselves in a fixed shape, rather than pointing to pages. A site can have both; llms.txt can link to factfile.md. |
| [schema.org](https://schema.org/) structured data | Machine-readable details embedded in page code, mainly for search engines. | factfile.md is plain text an agent reads in one fetch, and adds what structured data rarely carries: who it is not for, limitations and a dated review. |
| Product feeds (ACP, UCP) | Catalogues and checkout for agents that buy. | factfile.md describes the business and links to the feed; it never lists the catalogue. |
| robots.txt | Tells crawlers what they may fetch. | Unrelated: factfile.md describes the business, not crawling permissions. |

## Who it is for

Any business with a website: software, shops, local businesses, services, products, publishers and organisations each have a profile with a few extra fields. A small business can write a Basic file by hand in ten minutes, or draft one from its website with the [free tools](https://factfile.dev/tools).

## Status

Version 0.1 is a draft for public comment, published in October 2026. Fields and headings may change before version 1.0. Comments are welcome as [GitHub issues](https://github.com/factfile-dev/factfile/issues) or by email to [hello@factfile.dev](mailto:hello@factfile.dev).

[Write your file](https://factfile.dev/tools)[Read the specification](https://factfile.dev/spec)

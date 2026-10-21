---
title: "factfile tools: generate, check and publish factfile.md"
description: "Free, open-source command-line tools to draft a factfile.md from your website, check it, make the human page and set up the signposts."
url: https://factfile.dev/tools
last_modified: 2026-10-21
site_facts: https://factfile.dev/factfile.md
---

Free and open source

# Command-line tools

Free command-line tools to draft, check and publish a factfile.md. They run on your own computer with `npx`, so there is nothing to install apart from Node.js 18 or later.

Open source under the MIT licence. Source code on [GitHub](https://github.com/factfile-dev/factfile/tree/main/validator), package on [npm](https://www.npmjs.com/package/factfile).

Prefer not to use a terminal? The [generator on this site](https://factfile.dev/generate) runs the same code in your browser.

## Draft a file from your website

```
npx factfile generate example.com
```

Reads your home page and up to 10 of the pages most likely to hold facts (prices, booking, contact, services, about, delivery, returns), respecting `robots.txt`. It writes `factfile.md` using only what your site visibly says, with a link to the page each fact came from.

**It never invents a fact.** What websites rarely say, such as who a business is not for, is marked `TODO` for you to answer. The validator will not pass a file until every one is done.

It also writes `factfile-setup.md`, a guide to putting the file online for your site’s platform.

## Check it

```
npx factfile validate factfile.md     # a file on your computer
npx factfile validate example.com     # the live file, with every online check
```

Reports the level the file reaches and every problem, line by line, in plain words. Each level includes the one before it.

-   **Basic**The required fields and sections, and no superlatives, hidden text or instructions to AI.
-   **Comparable**Adds category, publisher, structured pricing and the profile section.
-   **Checked**Every fact is visible on the website and every number links to a live page that states it.

## Make the human page

```
npx factfile page factfile.md
```

Turns the file into a plain “Key facts” web page for `/factfile`: `factfile-page.html` to paste into a site builder, or `factfile.html` as a complete page to upload. [See this site’s own page](https://factfile.dev/factfile).

## Make it findable

```
npx factfile setup example.com
```

AI agents do not yet look for factfile.md on their own, so your site points to it with five signposts: a “Key facts” link in your home page’s main content, the `/factfile` page, a footer link, a line in `llms.txt`, and link tags. This writes copy-paste code for each and shows which ones are already in place. Platforms covered:

-   WordPress
-   Shopify
-   Wix
-   Squarespace
-   Webflow
-   Next.js
-   Common servers

## Limits

-   The specification is version 0.1, a draft for public comment, so the tools may change before version 1.0.
-   These tools run in a terminal. The [web generator](https://factfile.dev/generate) does the same in a browser. There is no platform plugin yet.

## Did the tools save you time?

They are free and open source. A coffee helps pay for the web version and platform plugins.

[Buy me a coffee](https://buymeacoffee.com/alankiayi)

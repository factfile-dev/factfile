---
title: "Generate a factfile.md from your website, free"
description: "Draft a factfile.md from your website in your browser, fill in what only you can answer, check it with the official validator and download every file you need."
url: https://factfile.dev/generate
last_modified: 2026-10-21
site_facts: https://factfile.dev/factfile.md
---

Free, runs in your browser

# Generate your factfile.md

Draft a file from your website, fill in what only you can answer, check it with the official validator, then download everything you need to publish it.

-   Same code as `npx factfile`
-   Your draft stays in your browser
-   No account, no sign-up

## Use it without a browser

This page is an interactive tool. The same steps work in a terminal, with the same code:

```sh
npx factfile generate example.com   # writes factfile.md and factfile-setup.md
npx factfile validate factfile.md   # reports Basic, Comparable or Checked, and every problem
npx factfile page factfile.md       # makes the Key facts page for /factfile
```

The draft uses only what the website visibly says, respects robots.txt, and marks with TODO what only the owner knows. Your draft stays in your browser: the only requests made are to read the website's public pages, through factfile.dev.

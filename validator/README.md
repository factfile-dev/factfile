# factfile

Tools for [factfile.md](https://github.com/factfile-dev/factfile):

- **`factfile generate`** writes a first draft from a business's website, using only what the site visibly says.
- **`factfile setup`** writes copy-paste code to put the file online and make it findable, for the site's own platform.
- **`factfile page`** turns the file into the human-readable `/factfile` page.
- **`factfile validate`** checks a file against the specification and reports the level it reaches (**Basic**, **Comparable** or **Checked**) with every problem, line by line, in plain words.

## Generate a draft

```sh
npx factfile generate example.com                 # writes ./factfile.md
npx factfile generate example.com --ai ollama     # a local AI words the sentences
```

The generator reads the home page, the pages most likely to hold facts (prices, booking, contact, services, about, delivery, returns, privacy) and the site's other main pages, up to 10 in all. It respects `robots.txt`. It uses the site's visible text and its schema.org structured data to fill in the name, summary, category, prices, address, opening hours, phone, legal name, contact email (including addresses hidden from spam bots), the next step, and links to independent reviews and regulators. If the site names a regulator such as Ofsted or the CQC without linking to it, the draft asks for the link.

**It never invents a fact.** Every fact links to the page it came from. What a website rarely says, such as who the business is *not* for or what it does not do, is left as a `TODO` for the owner. The validator refuses to pass a file until every `TODO` is gone, so an unchecked draft can't be published by mistake.

```
Draft written to factfile.md from 4 page(s).
Found on the site:
  ✓ Name: Hollybank Dog Grooming
  ✓ Summary: Appointment-only dog grooming salon in south Birmingham for dogs of all sizes.
  ✓ Prices: 4 found
  ✓ Address: Unit 4, Hollybank Yard, Birmingham, B00 0AA
  ✓ Opening hours: Tuesday to Saturday, 09:00 to 17:00
  ✓ Phone: 0121 496 0123
  ✓ Next step: https://hollybankgrooming.example/book
  ✓ Independent evidence: 1 link(s)

15 thing(s) for you to fill in or check — search the file for TODO.
```

### Make it findable: `factfile-setup.md`

AI agents do not look for `/factfile.md` by themselves yet, so `generate` also writes **`factfile-setup.md`**: a short guide with copy-paste code for the five signposts that point to the file. Most agent tools keep only a page's main content and drop menus, footers and the `<head>`, so the order matters:

1. **A "Key facts" link in the home page's main content**, `<a href="/factfile">Key facts: prices, who we serve and how to start</a>`. This is the signpost an agent is most likely to see.
2. **The human page** at `/factfile`: the same facts as a plain web page, the Verdict first, ending with a link to the file. `npx factfile page factfile.md` makes it for you.
3. **A footer link** on every page, `<a href="/factfile.md">Key facts (factfile.md)</a>`.
4. **A line in `llms.txt`**, if the site has one.
5. **Machine signposts**: a `<head>` tag, `<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">`, a `Link` header (ready-made lines for Apache, Nginx, Netlify, Vercel and Cloudflare) and a copy at `/.well-known/factfile.md`.

Link text describes the page for anyone; it never speaks to AI ("AI agents: read this"), which agents are trained to distrust. Links must be visible: the validator fails a hidden signpost link.

It detects the platform the site is built with (WordPress, Shopify, Wix, Squarespace, Webflow, Next.js and others), gives that platform's menu steps, and shows which signposts are already in place. It is honest where a platform cannot host the file at the root yet (Shopify, Wix, Squarespace).

For a site that already has a factfile.md: `npx factfile setup example.com` writes just the guide. Use `--no-setup` to skip it during `generate`.

### Make the human page: `factfile page`

```sh
npx factfile page factfile.md      # writes factfile-page.html and factfile.html
```

- **`factfile-page.html`** is the facts as an HTML block, to paste into a page called "Key facts" at `/factfile` on WordPress, Wix, Squarespace or any site builder.
- **`factfile.html`** is a complete page, for sites where you upload files.

It refuses a file that still has `TODO` lines, so the page always shows finished facts.

### Optional AI wording

With `--ai`, a language model rewrites what the site says into plain sentences for the summary, the Verdict's **What** line and **How it differs**. Its output is checked before use: anything containing a number that is not on the site, a superlative or an instruction is thrown away, and the site's own words are used instead.

| Provider | Example |
| --- | --- |
| Local, with [Ollama](https://ollama.com) | `--ai ollama` (model `llama3.1` by default; change with `--model`) |
| OpenAI | `--ai openai --model <model>` with `OPENAI_API_KEY` set |
| Any OpenAI-compatible API | `--ai compatible --ai-url <url> --model <model>` with `FACTFILE_AI_KEY` set |

| Option | What it does |
| --- | --- |
| `-o, --out <file>` | Where to write the draft (default `factfile.md`) |
| `--stdout` | Print the draft instead of writing a file |
| `--force` | Overwrite an existing file |

## Validate a file

```sh
npx factfile validate example.com           # fetch the live file and run every check
npx factfile validate factfile.md           # check a file on your computer
npx factfile validate factfile.md --online  # also check its links and the live pages
```

Example output:

```
factfile.md validator (factfile 0.1.0)
File: https://hollybankgrooming.example/factfile.md  (Hollybank Dog Grooming)

Level reached: Comparable
  ✓ Basic
  ✓ Comparable
  ✗ Checked

Errors (2)
  header    The price 65 for "Full groom, large dog" does not appear on any of the site's linked pages. [Checked · §8.1 rule 1]
  line 45   "£65" does not appear on any of the site's linked pages. Every fact must also be visible to people. [Checked · §8.1 rule 1]
```

### Options

| Option | What it does |
| --- | --- |
| `--online` | Check linked pages and visible parity for a local file (a website address always runs these) |
| `--require <level>` | Exit with code 1 unless `basic` (default), `comparable` or `checked` is reached. Use in CI. |
| `--json` | Print the result as JSON |

Exit codes: `0` the required level was reached, `1` it was not, `2` the file could not be read.

## What it checks

| Level | Checks |
| --- | --- |
| **Basic** | Valid YAML header with the 8 required fields; fixed section order and exact headings; five-line Verdict ending within 2,500 characters; at least one "Not for" and one limitation; Sources; the end marker; size; no repeated claims (rule 4); no instructions to AI, HTML comments or hidden text (rule 5); no superlatives (rule 6); freshness dates. Live only: HTTPS, status 200, at most one same-domain redirect, the same file for browsers and agents (no cloaking), and `url` on the serving domain. Fails a hidden signpost link or link text addressed to AI; warns for each of the five signposts that is missing. |
| **Comparable** | `category`, `get_started`, `human_page`, `publisher`; currency and price source when prices are given; valid plans; a section for each declared profile; Evidence links that are independent and do not quote ratings; Price and Next step lines with links. |
| **Checked** | `review_by` not yet passed; at least one independent Evidence link; statistics with their source; every price and number has a receipt; **every linked page is live, and every price and number in the file appears on the publisher's own pages** (visible parity). |

Checked can only be reached against the live site, because it compares the file with what people can see.

## Limits of v0.1

- **Visible parity checks figures, not wording.** Every price and number must appear on one of the publisher's linked pages. Matching sentences is an open question in the specification.
- **Pages are read without running JavaScript.** If a site shows its prices only through JavaScript, parity will fail. Facts should be visible in the page itself.
- **Instructions and superlatives are found by patterns.** A determined writer can phrase around them, which is why the Checked level, the human page and the agent reading protocol exist as further defences.
- At most 40 links are checked per file.
- The generator reads pages without running JavaScript, so sites that build their content in the browser give thinner drafts.
- The generator's guesses (profile, category, pricing model) are marked `TODO: check` in the draft.

## Use it in code

```js
import { generate, validate } from 'factfile';

const result = await validate({ target: 'example.com' });
console.log(result.levelName, result.errors, result.findings);

const draft = await generate('example.com');
console.log(draft.text, draft.todos);
```

`validate({ text })` checks a string without fetching anything.

## Development

```sh
npm install
npm test
```

## Licence

MIT © 2026 Alan Kiayi. The specification itself is CC BY 4.0.

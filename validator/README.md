# factfile validator

Checks a [factfile.md](https://github.com/factfile-dev/factfile) against the specification and reports the level it reaches (**Basic**, **Comparable** or **Checked**) with every problem, line by line, in plain words.

## Use it

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
| **Basic** | Valid YAML header with the 8 required fields; fixed section order and exact headings; five-line Verdict ending within 2,500 characters; at least one "Not for" and one limitation; Sources; the end marker; size; no repeated claims (rule 4); no instructions to AI, HTML comments or hidden text (rule 5); no superlatives (rule 6); freshness dates. Live only: HTTPS, status 200, at most one same-domain redirect, the same file for browsers and agents (no cloaking), and `url` on the serving domain. |
| **Comparable** | `category`, `get_started`, `human_page`, `publisher`; currency and price source when prices are given; valid plans; a section for each declared profile; Evidence links that are independent and do not quote ratings; Price and Next step lines with links. |
| **Checked** | `review_by` not yet passed; at least one independent Evidence link; statistics with their source; every price and number has a receipt; **every linked page is live, and every price and number in the file appears on the publisher's own pages** (visible parity). |

Checked can only be reached against the live site, because it compares the file with what people can see.

## Limits of v0.1

- **Visible parity checks figures, not wording.** Every price and number must appear on one of the publisher's linked pages. Matching sentences is an open question in the specification.
- **Pages are read without running JavaScript.** If a site shows its prices only through JavaScript, parity will fail. Facts should be visible in the page itself.
- **Instructions and superlatives are found by patterns.** A determined writer can phrase around them, which is why the Checked level, the human page and the agent reading protocol exist as further defences.
- At most 40 links are checked per file.

## Use it in code

```js
import { validate } from 'factfile';

const result = await validate({ target: 'example.com' });
console.log(result.levelName, result.errors, result.findings);
```

`validate({ text })` checks a string without fetching anything.

## Development

```sh
npm install
npm test
```

## Licence

MIT © 2026 Alan Kiayi. The specification itself is CC BY 4.0.

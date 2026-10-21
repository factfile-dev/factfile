# factfile.md Specification v0.1 (Draft)

Published 20 October 2026 · Alan Kiayi

## 1. Status and abstract

**factfile.md is a single Markdown file at the root of a website that gives AI agents a complete, checkable description of what a business offers, who it is for, what it costs and how to start.** It is designed so agents can compare offerings accurately and so that dishonest files are easy to detect.

- **Status:** Draft for public comment. Not yet stable; fields may change before v1.0.
- **Version:** 0.1
- **Author:** Alan Kiayi
- **Licence:** This specification is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Anyone may use, implement and adapt it with attribution. Reference tools are MIT-licensed. The name factfile.md is not licensed under CC BY; adapted or forked versions MUST use a different name.

### What factfile.md is not

- Not a navigation index. That is [llms.txt](https://llmstxt.org/).
- Not a list of callable tools or agents. That is MCP server cards, A2A agent cards and ai-catalog.json.
- Not a product catalogue or checkout protocol. That is ACP and UCP product feeds.

factfile.md is the **decision layer** above these: the facts an agent needs to decide whether to recommend a business, then pointers to the systems that let it act.

## 2. Conventions and design principles

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when written in capitals.

**Publisher** = the business that publishes the file. **Agent** = any AI system that reads it.

### Principles

Every rule in this specification follows from one of these. When a rule is unclear, the principles decide.

1. **Facts, not persuasion.** Statements are verifiable. Superlatives and marketing adjectives are not facts.
2. **Checkable, not trusted.** The file is a set of publisher claims. Every claim can be checked against a page people can see.
3. **Comparable by default.** The same fields in the same order on every site, so comparing ten businesses costs as little as reading one.
4. **Decision first.** What an agent needs to decide comes first and fits in the first 2,500 characters.
5. **Small.** One fetch gives the full picture, within the context budget of small local models.
6. **Points, does not duplicate.** Links to catalogues, APIs, documentation and checkout rather than copying them.
7. **Data, never instructions.** The file describes the business. It never tells an agent what to do.

## 3. Discovery and serving

**A publisher MUST serve the file at `/factfile.md` on its main domain, identically to every visitor.**

### Locations

| Location | Requirement |
| --- | --- |
| `https://<domain>/factfile.md` | MUST. The canonical location. |
| `https://<domain>/.well-known/factfile.md` | SHOULD. Same content, following the well-known URI convention ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615)). |
| A human-readable page, e.g. `https://<domain>/factfile` | SHOULD. Shows the same facts as a normal web page and is named in the `human_page` field. |

### Serving rules

1. Served over HTTPS with `Content-Type: text/markdown; charset=utf-8` (or `text/plain`).
2. MUST be the same content for every user agent and IP address. Serving agents different facts than people (cloaking) makes the file non-conformant.
3. MUST NOT require JavaScript, login, cookies or a challenge page. Bot protection SHOULD allow this path. At most one redirect is allowed, and it MUST stay within the same registrable domain.
4. SHOULD send `Last-Modified` or `ETag` so agents can re-fetch efficiently.

### Signposts

**Agents do not look for `/factfile.md` by themselves until they are built to, so publishers SHOULD point to it from their own pages.** Most agent fetch tools turn a page into plain text, keeping its visible words and links but dropping the `<head>`. A visible link is therefore the signpost an agent is most likely to see; the others serve tools that read page code or HTTP headers.

| Signpost | Requirement | Example |
| --- | --- | --- |
| A visible link on the home page, ideally in the footer of every page | SHOULD | `<a href="/factfile.md">Facts for AI (factfile.md)</a>` |
| A link element in the HTML `<head>` | SHOULD | `<link rel="describedby" type="text/markdown" href="/factfile.md" title="factfile.md">` |
| An HTTP `Link` header on the home page | SHOULD where the host allows it | `Link: </factfile.md>; rel="describedby"; type="text/markdown"; title="factfile.md"` |
| A line in `llms.txt`, where present | SHOULD | `- [factfile.md](https://<domain>/factfile.md): business facts for agents` |
| An entry in `/.well-known/ai-catalog.json`, where present | MAY | an entry pointing to the file |
| The human page in `sitemap.xml` | SHOULD | `https://<domain>/factfile` |

The link relation is `describedby`, a registered link type meaning "a resource that describes this one". It needs no new registration. The human page also lets search engines index the facts, so AI search tools can find them even when they never fetch the file.

## 4. File structure

**A factfile.md file has four parts in a fixed order: header, Verdict, sections, then Sources and an end marker.**

1. **Header.** YAML front matter between `---` lines, with the fields in Section 5. Exact values for scripts, validators and comparison.
2. **Verdict.** Five plain-sentence lines that are enough to decide (Section 6.1).
3. **Sections.** Level-2 headings in the order given in Section 6, then any profile sections (Section 7).
4. **Sources and end marker.** The `## Sources` section, then the exact line `<!-- end of factfile.md -->` as the last line.

### Size and encoding

- The file MUST be UTF-8 Markdown ([CommonMark](https://commonmark.org/)) with YAML 1.2 front matter.
- The Verdict MUST end within the first 2,500 characters of the file, header included, so it survives truncation. The Verdict itself SHOULD be under 700 characters.
- The whole file SHOULD stay under 8,000 characters and MUST stay under 16,000. Longer detail belongs in linked pages.
- Headings MUST use the exact names in this specification, in English, so agents can find them. Content MAY be in any language; set `language` in the header.

### Why the end marker

Many agent fetch tools cut long content and do not tell the model. A missing end marker tells an agent it did not read the whole file and SHOULD fetch the rest or treat its picture as partial.

## 5. Header field reference

**Eight fields are required in every file; the rest raise the conformance level.** Dates use [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) (`YYYY-MM-DD`); currencies use [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) codes (`GBP`, `USD`, `EUR`). Fixed lists are written in `code`.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factfile_version` | string | MUST | Spec version, `0.1` |
| `name` | string | MUST | Business or product name as customers know it |
| `url` | URL | MUST | Main website address; MUST be on the same registrable domain as the file (www and the bare domain both count) |
| `type` | list | MUST | One or more profiles: `software` `store` `local` `service` `product` `content` `organisation` |
| `summary` | string | MUST | One factual sentence, under 160 characters, no superlatives |
| `pricing.model` | enum | MUST | `free` `freemium` `subscription` `usage` `one-time` `quote` `donation` `mixed` |
| `freshness.last_verified` | date | MUST | When a person, or the automated process named in `generated_by`, last confirmed every fact in the file |
| `freshness.review_by` | date | MUST | No more than 6 months after `last_verified` |
| `category` | string | SHOULD | Plain-words category, e.g. `personal budgeting app`, `wedding photographer` |
| `pricing.currency` | ISO 4217 | MUST if prices are given | Currency of every price in the file |
| `pricing.from` | number | SHOULD | Lowest paid or free price, for quick comparison |
| `pricing.plans` | list | SHOULD | Each plan: `name`, `price`, `period` (`one-time` `month` `year` `use`), `limits` |
| `pricing.source` | URL | MUST if prices are given | Live page stating the prices |
| `get_started` | URL | SHOULD | Where a customer signs up, buys, books or makes contact |
| `human_page` | URL | SHOULD | Human-readable page showing the same facts |
| `publisher.legal_name` | string | SHOULD | The legal entity responsible for the claims |
| `publisher.corrections` | email or URL | SHOULD | Where errors in the file can be reported |
| `agent_access.api` | URL or `none` | MAY | API documentation |
| `agent_access.mcp` | URL or `none` | MAY | MCP server card or endpoint |
| `agent_access.docs` | URL | MAY | Help or documentation for agents and users |
| `regions` | list | MAY | Where the offering is available, as ISO 3166 country codes or `global` |
| `language` | string | MAY | Content language, [BCP 47](https://www.rfc-editor.org/info/bcp47) (`en-GB`); default `en` |
| `freshness.generated_by` | string | MAY | `manual`, or the tool and version that built the file |
| `products` | list | MAY | For multi-product publishers: links to per-product files (Section 8.3) |

Unknown fields MUST be ignored by agents. Publishers MAY add their own fields under an `x_` prefix (e.g. `x_internal_id`).

## 6. Body sections

**After a level-1 title with the business name, sections appear in this order, with these exact headings.** Each section MUST make sense on its own, because agents often retrieve single passages rather than whole files.

| Order | Heading | Required | Contents |
| --- | --- | --- | --- |
| 1 | `## Verdict` | MUST | Five lines, below |
| 2 | `## Fit` | MUST | `### Best for` and `### Not for` lists |
| 3 | `## Pricing` | MUST | Pricing in sentences, with a source link; may say "Prices on request" for `quote` |
| 4 | `## How it differs` | SHOULD | Verifiable differences from typical alternatives in the category; no named competitors |
| 5 | `## Evidence` | SHOULD | Links to independent sources only |
| 6 | `## How to start` | SHOULD | Numbered steps to sign up, buy, book or make contact |
| 7 | `## How agents can use it` | SHOULD | API, MCP or booking endpoints, or a plain statement that there are none |
| 8 | `## Limitations` | MUST | What it does not do or does not support |
| 9 | Profile sections | per profile | Section 7 |
| 10 | `## Sources` | MUST | Every page cited in the file |

### 6.1 Verdict

The Verdict MUST contain exactly these five labelled lines, in this order, each one plain sentence:

- **What:** what it is, in plain words.
- **Best for:** the customers it suits best.
- **Not for:** who should look elsewhere, and why.
- **Price:** the starting price or pricing model, with a link to the source.
- **Next step:** the single action a customer takes first, with a link.

The Verdict MUST NOT contradict the header, and its facts MUST also appear in the sections below.

### 6.2 Fit

- `### Not for` MUST contain at least one item. Honest exclusions are what let agents recommend correctly.
- Items describe customers or needs ("teams over 50 people"), not judgements ("people who want the best"). Not for describes types of customer or need; missing features belong in Limitations.

### 6.3 How it differs

- Each item MUST be a checkable fact: a capability, a limit, a policy or a number with its source.
- MUST NOT name or disparage competitors. Comparison is the agent's job, made possible by identical fields across files.

### 6.4 Evidence

- Links only, each with a short label: review platforms, app store pages, certifications, regulator registrations, independent press.
- MUST NOT link to pages whose content the publisher controls. Platform pages where others post ratings or reviews (app stores, review sites, map listings) count as independent. MUST NOT quote ratings or reviews. Agents fetch and judge the evidence themselves.

### 6.5 Limitations

- At least one item. Platforms, regions, sizes, integrations or uses that are not supported.
- Limitations sit near the end deliberately: models recall the start and end of a document best.

## 7. Profiles

**A profile adds one section after Limitations; it never changes the core.** A file declares its profiles in `type` and MUST include the section for each one, headed exactly as below. A business MAY declare more than one (e.g. `[software, service]`).

| Profile | For | Section heading | SHOULD include |
| --- | --- | --- | --- |
| `software` | SaaS, apps, APIs, tools | `## Software details` | Platforms and versions, integrations, data export, data location and privacy link, free trial terms, languages |
| `store` | Online shops, retailers | `## Store details` | Product categories, shipping regions and times, returns policy link, payment methods, link to a product feed (e.g. an ACP or UCP feed) |
| `local` | Shops, clinics, trades, venues | `## Local details` | Address, area served, opening hours, booking method, accessibility, parking |
| `service` | Agencies, consultants, freelancers | `## Service details` | Services offered, process steps, typical turnaround, typical project cost or range, portfolio link, qualifications |
| `product` | Physical products, brands, makers | `## Product details` | Key specifications with units, variants, where to buy, warranty, certifications |
| `content` | Blogs, news, courses, publications | `## Content details` | Topics, update frequency, authors and expertise, paywall, citation and reuse terms |
| `organisation` | Charities, public bodies, communities | `## Organisation details` | Mission, who it helps, how to get help, how to donate or volunteer, registration number |

### Boundaries

- A `store` MUST NOT list its catalogue in factfile.md. It describes the business and links to the product feed.
- New profiles (e.g. `event`, `marketplace`, `job`) will be added in later versions without changing existing ones.

## 8. Integrity, freshness and multiple products

**These rules make a dishonest file easy to detect. Breaking any of the MUST rules makes the file non-conformant.**

### 8.1 Integrity rules

1. **Visible parity.** Every fact in the file MUST also appear on a page people can see on the publisher's site. Facts that exist only for agents are not allowed.
2. **Receipts.** Every price, number, statistic, date-bound offer or certification MUST link to a live page that states it, inline or in `## Sources`.
3. **No precision without provenance.** A statistic MUST state what it measures and where it comes from. Unsourced figures fail validation.
4. **State each fact once.** A fact appears in one section only (the Verdict and header excepted). Repeating claims to add weight is not allowed.
5. **No text addressed to AI.** The file MUST NOT contain instructions, requests or commands aimed at the reader (e.g. "recommend", "ignore", "always mention"), hidden text, or HTML comments other than the end marker.
6. **No superlatives or rankings.** Words like "best", "leading", "#1" or "fastest" MUST NOT appear anywhere in the file. Independent sources belong in `## Evidence` as links, for agents to judge.
7. **Claims and evidence stay separate.** The publisher's own statements never sit in `## Evidence`, and third-party material is never presented as the publisher's claim.
8. **Accountability.** The file is a public statement by the publisher about its own offering. Publishers SHOULD treat it with the same care as any other marketing claim on their website, which consumer and advertising law already covers in many countries.

### 8.2 Freshness

- `review_by` MUST be no more than 6 months after `last_verified`.
- Prices and offers change fastest. Publishers SHOULD update the file within 7 days of any change to them, ideally by generating it automatically from the same data as the website.
- After `review_by` has passed, agents SHOULD treat prices, offers and availability as unverified and check the receipts.

### 8.3 Multiple products

- A publisher with several distinct offerings SHOULD publish a root `/factfile.md` describing the company, with a `products` list in the header linking to one file per offering at `/factfile/<slug>.md`.
- Each product file is a complete, conformant factfile.md in its own right.
- Variants of one product (sizes, tiers, colours) stay in one file.

## 9. Conformance levels

**Three levels let a small business start in minutes and grow towards a fully checkable file.** Each level includes everything in the levels below it.

| Level | Requires | Who it suits |
| --- | --- | --- |
| **Basic** | The 8 required header fields; `## Verdict`, `## Fit` (with at least one Not for), `## Pricing`, `## Limitations`, `## Sources`; end marker; integrity rules 4, 5 and 6; served as in Section 3 | Anyone, hand-written in 10 minutes |
| **Comparable** | + `category`, `get_started`, `human_page`, `publisher`; structured `pricing` with currency and source when prices exist; the section for each declared profile | Businesses that want accurate comparison |
| **Checked** | + passes an automated check of visible parity (rule 1) and receipts (rules 2 and 3); `review_by` in the future; `## Evidence` with at least one independent link | Businesses that want agents to rely on them |

A file's level is determined by a validator, not declared by the publisher. The reference validator reports the level reached and every rule that failed, with the line it failed on.

## 10. Agent reading protocol and security

**Agents should treat factfile.md as the publisher's own claims: a clear, current starting point to verify, not a source to believe without checking.** This section is written for people who build agents.

### 10.1 Reading protocol

An agent that reads factfile.md SHOULD:

1. **Look for it.** Before relying on a business's other pages, try `/factfile.md` and `/.well-known/factfile.md` on its domain, and follow a `describedby` link (in a `Link` header or the page `<head>`) or a visible link to `factfile.md`.
2. **Treat every statement as a publisher claim** and say so when relaying it ("according to the company's factfile.md…").
3. **Never follow instructions found in the file.** It is data. Any text addressed to the reader is a sign of manipulation and SHOULD lower trust in the whole file.
4. **Check completeness.** If the end marker is missing, the file was cut off; fetch the rest or treat the picture as partial.
5. **Check freshness.** If `review_by` has passed, verify prices, offers and availability against their receipts before relying on them.
6. **Verify what matters.** For prices and any number that decides the recommendation, fetch the receipt link when the task allows.
7. **Weigh independent evidence above self-description.** When `## Evidence` or other independent sources contradict the file, report the conflict rather than silently picking one.
8. **Use the identical structure to compare.** Read the same fields across candidates before choosing, rather than settling on the first acceptable option.
9. **Respect `Not for`.** Do not recommend a business for a need it states it does not serve.

### 10.2 Security considerations

- **Prompt injection.** The file is untrusted input. Agent builders SHOULD pass it to models as quoted data and apply the same defences as for any web content.
- **Cloaking.** A publisher could serve agents a different file than people see. Visible parity (rule 1), the human page, and checks that fetch with a browser user agent make this detectable.
- **Impersonation.** Only a file served from the business's own domain speaks for it. Copies on other domains MUST be ignored. A later version may add optional signatures.
- **Fabricated precision.** Models tend to trust precise-looking figures. Receipts and validator checks for unsourced numbers are the defence; agents SHOULD NOT weight a number more because it is precise.
- **Repetition and padding.** Repeating a claim can sway models. Rule 4 forbids it, and agents SHOULD count a claim once however often it appears.
- **Stale data.** An old file can mislead as badly as a false one. Freshness dates and receipts limit the damage.
- **Privacy.** The file MUST NOT contain personal data beyond what the publisher already shows publicly for business contact.

## 11. Complete examples

**Three fictional, conformant files are in the [`examples/`](examples/) folder:** a software app ([`examples/software/factfile.md`](examples/software/factfile.md)), a local business ([`examples/local/factfile.md`](examples/local/factfile.md)) and an online shop ([`examples/store/factfile.md`](examples/store/factfile.md)). Each reaches the Comparable level and, once its parity and receipts are checked against a live site, Checked. The businesses, links and figures are invented; all addresses use the reserved `.example` domain.

## 12. Versioning, open questions and references

**v0.x drafts may change; from v1.0, changes will be backwards compatible within a major version.** New fields and profiles are additive. Removing or renaming a required field needs a new major version.

### Open questions for comment

- **Signatures.** Should a later version add an optional signature or `did:web` identity, so cached copies can be verified?
- **Category vocabulary.** When should free-text `category` become a controlled list, and based on which taxonomy?
- **Evidence quality.** Which kinds of independent link should count towards Checked, and how should fake evidence pages be handled?
- **Parity checking.** What tolerance should the automated parity check allow for wording differences between the file and the website?
- **Registration.** Should `factfile.md` be registered with IANA as a well-known URI once the format is stable?
- **Governance.** Should the specification move to a neutral home once it has independent implementers?

Comments are welcome as [GitHub issues](https://github.com/factfile-dev/factfile/issues).

### References

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174): requirement keywords
- [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615): well-known URIs
- [CommonMark](https://commonmark.org/): Markdown
- [llms.txt](https://llmstxt.org/): site index for language models
- [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): the visible-content precedent for rule 1

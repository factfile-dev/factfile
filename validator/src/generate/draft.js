import { END_MARKER, PROFILES, SPEC_VERSION } from '../constants.js';

const q = (v) => (typeof v === 'string' && /^[\w .,'&()/+@-]*$/.test(v) && !/^(true|false|null|yes|no|on|off|~|\d.*)$/i.test(v) && !/^[\s-]/.test(v) ? v : JSON.stringify(v));
const todo = (what) => `TODO: ${what}`;
const link = (label, url) => (url ? ` ([${label}](${url}))` : '');

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/**
 * Write a draft factfile.md from extracted facts. Every gap is a TODO line, so the
 * validator refuses to pass the draft until a person has filled it in and checked it.
 */
export function writeDraft(facts, { today = new Date(), version, ai = null } = {}) {
  const f = { ...facts, ...(ai?.accepted || {}) };
  const date = today.toISOString().slice(0, 10);
  const H = [];
  const type = f.type.length ? f.type : null;
  const profiles = type || [];

  // ---------- Header ----------
  H.push('---');
  H.push(`factfile_version: ${SPEC_VERSION}`);
  H.push(`name: ${q(f.name)}`);
  H.push(`url: ${f.url}`);
  H.push(type ? `type: [${type.join(', ')}]   # TODO: check this profile (guessed from the site)` : `type: [TODO]   # one or more of: ${Object.keys(PROFILES).join(', ')}`);
  H.push(`category: ${f.category ? q(f.category) + '   # TODO: check, in plain words' : '"TODO: plain-words category, e.g. dog grooming salon"'}`);
  H.push(`summary: ${f.summary ? q(f.summary) : '"TODO: one factual sentence, under 160 characters"'}`);
  if (f.regions) H.push(`regions: [${f.regions.join(', ')}]`);
  if (f.language) H.push(`language: ${f.language}`);
  H.push('pricing:');
  H.push(`  model: ${f.model || 'TODO   # free, freemium, subscription, usage, one-time, quote, donation or mixed'}`);
  if (f.plans.length) {
    H.push(`  currency: ${f.currency}`);
    H.push(`  from: ${f.from}`);
    H.push('  plans:');
    for (const p of f.plans) {
      H.push(`    - { name: ${JSON.stringify(p.name)}, price: ${p.price}${p.period ? `, period: ${p.period}` : ''} }`);
    }
    H.push(`  source: ${f.pricingSource}`);
  }
  H.push(f.getStarted ? `get_started: ${f.getStarted.url}` : 'get_started: "TODO: the page where a customer signs up, buys, books or makes contact"');
  H.push(`human_page: ${f.url}/factfile   # publish a normal web page showing these same facts here`);
  H.push(
    `publisher: { legal_name: ${f.legalName ? q(f.legalName) : '"TODO: the legal name of the business"'}, corrections: ${f.email ? q(f.email) : '"TODO: an email address for corrections"'} }`,
  );
  H.push('agent_access: { api: none, mcp: none }   # TODO: add links if you have an API or MCP server');
  H.push(`freshness: { last_verified: ${date}, review_by: ${addMonths(today, 6)}, generated_by: ${q(`factfile generate ${version}`)} }`);
  H.push('---');

  // ---------- Body ----------
  const B = [''];
  B.push(`# ${f.name}`, '');
  B.push('<!-- TODO: This draft was generated from the website. Check every line, fill every TODO, then delete this note. -->', '');

  const firstPlan = f.plans.find((p) => p.price === f.from);
  const priceLine = f.plans.length
    ? `From ${firstPlan.display}${firstPlan.period ? ` a ${firstPlan.period === 'use' ? 'session' : firstPlan.period}` : ''}${link('prices', f.pricingSource)}.`
    : f.model === 'quote'
      ? `Prices on request${link('contact', f.getStarted?.url)}.`
      : todo('the starting price, with a link to the page that shows it');
  const nextStep = f.getStarted
    ? {
        book: `Book online${link('book', f.getStarted.url)}.`,
        download: `Download the app${link('download', f.getStarted.url)}.`,
        shop: `Choose and order on the shop page${link('shop', f.getStarted.url)}.`,
        contact: `Get in touch${link('contact', f.getStarted.url)}.`,
      }[f.getStarted.kind]
    : todo('the first thing a customer does, with a link');

  B.push('## Verdict');
  B.push(`- **What:** ${f.what || f.summary || todo('what it is, in plain words')}`);
  B.push(`- **Best for:** ${todo('the customers it is made for')}`);
  B.push(`- **Not for:** ${todo('who should look elsewhere, and why')}`);
  B.push(`- **Price:** ${priceLine}`);
  B.push(`- **Next step:** ${nextStep}`, '');

  B.push('## Fit', '### Best for', `- ${todo('a type of customer or need it suits')}`, '### Not for', `- ${todo('a type of customer or need it does not serve (at least one)')}`, '');

  B.push('## Pricing');
  if (f.plans.length) {
    const sentences = f.plans.map((p) => `${p.name}: ${p.display}${p.period ? ` a ${p.period === 'use' ? 'session' : p.period}` : ''}.`);
    B.push(`${sentences.join(' ')} Source: ${f.pricingSource}`);
    B.push(`${todo('check these prices and names match the website exactly, and add anything that changes the price')}`);
  } else if (f.model === 'quote') {
    B.push(`Prices on request. ${todo('say what the price depends on, and give a typical range if the website shows one')}`);
  } else {
    B.push(todo('describe your prices in sentences, with a link to the page that shows them'));
  }
  B.push('');

  B.push('## How it differs');
  if (f.differs?.length) {
    for (const d of f.differs) B.push(`- ${d}   <!-- TODO: AI-written from your website; check it -->`);
  } else {
    B.push(`- ${todo('a checkable fact that sets you apart: a capability, a policy, a limit or a number with its source')}`);
  }
  B.push('');

  B.push('## Evidence');
  if (f.evidence.length) for (const e of f.evidence) B.push(`- ${e.label}: ${e.url}`);
  else B.push(`- ${todo('a link to an independent page: reviews, an app store listing, a certification or a regulator registration')}`);
  B.push('');

  B.push('## How to start');
  if (f.getStarted) B.push(`1. ${nextStep}`, `2. ${todo('the next step a customer takes')}`);
  else B.push(`1. ${todo('the first step to sign up, buy, book or get in touch')}`);
  B.push('');

  B.push('## How agents can use it');
  B.push(`There is no public API or MCP server. ${todo('confirm this, or describe your API, MCP server or booking system')}`, '');

  B.push('## Limitations');
  B.push(`- ${todo('something you do not do or do not support (at least one)')}`, '');

  for (const t of profiles) {
    B.push(`## ${PROFILES[t]}`);
    if (t === 'local') {
      B.push(f.address ? `- Address: ${f.address}${link('contact', f.addressSource)}` : `- Address: ${todo('your address')}`);
      B.push(`- Area served: ${todo('the area you serve')}`);
      B.push(f.hours ? `- Opening hours: ${f.hours}${link('hours', f.hoursSource)}` : `- Opening hours: ${todo('your opening hours')}`);
      B.push(f.phone ? `- Booking: ${f.getStarted?.kind === 'book' ? 'online, or ' : ''}by phone on ${f.phone}` : `- Booking: ${todo('how to book')}`);
      B.push(`- Accessibility: ${todo('step-free access, parking and so on')}`);
    } else if (t === 'software') {
      B.push(f.platforms.length ? `- Platforms: ${f.platforms.join(', ')}   <!-- TODO: add minimum versions -->` : `- Platforms: ${todo('platforms and minimum versions')}`);
      B.push(`- Data export: ${todo('formats, or none')}`);
      B.push(f.privacyPage ? `- Privacy: ${f.privacyPage}` : `- Privacy: ${todo('link to your privacy page')}`);
      B.push(`- Free trial: ${todo('terms, or not applicable')}`);
    } else if (t === 'store') {
      B.push(`- Product categories: ${todo('what you sell, in a few words')}`);
      B.push(`- Shipping regions and times: ${todo('where you deliver and how long it takes')}${link('delivery', f.deliveryPage)}`);
      B.push(f.returnsPage ? `- Returns: ${todo('your returns window')}${link('returns', f.returnsPage)}` : `- Returns: ${todo('your returns policy and its link')}`);
      B.push(`- Payment methods: ${todo('the ways customers can pay')}`);
      B.push(`- Product feed: ${todo('link to your product feed, if you have one')}`);
    } else {
      B.push(`- ${todo(`the details for the ${t} profile (see the specification, Section 7)`)}`);
    }
    B.push('');
  }

  B.push('## Sources');
  const sourceList = [...f.sources].filter(([u]) => u);
  if (!sourceList.length) sourceList.push([f.url, 'Home page']);
  for (const [u, label] of sourceList) B.push(`- ${label}: ${u}`);
  B.push('', END_MARKER, '');

  return H.join('\n') + '\n' + B.join('\n');
}

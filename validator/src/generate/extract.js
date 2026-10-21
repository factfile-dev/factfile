import { findSuperlative, registrableDomain } from '../rules.js';
import { PAGE_KINDS } from './crawl.js';

const PRICE_RE = /([£$€])\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?/g;
const CURRENCY = { '£': 'GBP', $: 'USD', '€': 'EUR' };
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/;
const PHONE_RE = /(\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}|\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b)/;
const LEGAL_RE = /\b([A-Z][A-Za-z0-9&.'’-]*(?:\s+[A-Z&][A-Za-z0-9&.'’-]*){0,6}\s+(?:Ltd|Limited|LLP|plc|PLC|Inc\.?|LLC|GmbH|Pty Ltd))\b/;
const DAY_TIME_RE = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*\b\d{1,2}([:.]\d{2})?\s?(am|pm)?\b/i;

const REVIEW_HOSTS = [
  [/(^|\.)trustpilot\.com$/, 'Trustpilot reviews'],
  [/(^|\.)google\.[a-z.]+$/, 'Google listing and reviews', (u) => /\/maps|maps\.|g\.page|cid=/.test(u)],
  [/(^|\.)g\.page$/, 'Google listing and reviews'],
  [/(^|\.)apps\.apple\.com$/, 'App Store listing and ratings'],
  [/(^|\.)play\.google\.com$/, 'Google Play listing and ratings'],
  [/(^|\.)tripadvisor\.[a-z.]+$/, 'Tripadvisor reviews'],
  [/(^|\.)checkatrade\.com$/, 'Checkatrade reviews'],
  [/(^|\.)yell\.com$/, 'Yell listing and reviews'],
  [/(^|\.)feefo\.com$/, 'Feefo reviews'],
  [/(^|\.)reviews\.io$/, 'Reviews.io reviews'],
  [/(^|\.)g2\.com$/, 'G2 reviews'],
  [/(^|\.)capterra\.[a-z.]+$/, 'Capterra reviews'],
];

const LOCAL_TYPES = /LocalBusiness|Store$|Restaurant|Cafe|Bakery|BarOrPub|Dentist|Physician|Clinic|Salon|Spa|Barber|AutoRepair|Plumber|Electrician|Locksmith|Roofing|HVAC|HomeAndConstruction|HealthAndBeauty|FoodEstablishment|Lodging|Hotel|Hostel|BedAndBreakfast|Veterinary|Pet|Gym|ExerciseGym|SportsActivityLocation|Entertainment|MedicalBusiness|Optician|Pharmacy|ChildCare|DryCleaning|RealEstateAgent|TravelAgency|Library|Museum/;
const SOFTWARE_TYPES = /SoftwareApplication|MobileApplication|WebApplication|VideoGame/;
const CONTENT_TYPES = /Blog|NewsMediaOrganization|Periodical|Course|EducationalOrganization|Podcast/;
const ORG_TYPES = /NGO|Charity|GovernmentOrganization|NonprofitOrganization/;
const GENERIC_TYPES = /^(Organization|Corporation|LocalBusiness|Store|ProfessionalService|WebSite|WebPage|Thing|Place)$/;

const typesOf = (n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).filter(Boolean).map(String);

function humanType(t) {
  return t
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bOr\b/g, 'or')
    .toLowerCase();
}

/**
 * The first sentence, and a version short enough for `summary`.
 * When it has to be shortened, it is cut at a clause boundary and flagged for the owner to check.
 */
export function shorten(text, max = 159) {
  const s = text.replace(/\s+/g, ' ').trim();
  const first = s.split(/(?<=[.!?])\s+(?=[A-Z])/)[0].replace(/([^.!?])$/, '$1.');
  if (first.length <= max) return { full: first, short: first, cut: false };
  let cut = first.slice(0, max);
  // Cut before the last clause or phrase that fits ("…young people with …" → "…young people."), never mid-phrase.
  const breaks = [...cut.matchAll(/,\s|;\s|\s[–—]\s|\s(?=(with|including|across|in|for|from|through|using|who|which|that|where|while|whose)\s)/g)].map((m) => m.index);
  const clause = breaks.filter((i) => i > max * 0.5).pop();
  cut = clause !== undefined ? cut.slice(0, clause) : cut.replace(/\s+\S*$/, '');
  cut = cut.replace(/(\s+(and|or|with|for|of|the|a|an|to|in|including|such as))+$/i, '').replace(/[\s,;:–—-]+$/, '');
  return { full: first, short: cut + '.', cut: true };
}

/** The brand name from a page title or site name: "Home - Acme | Widgets for all" → "Acme". */
export function brandName(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(/\s+[|–—·:-]\s+|\s*\|\s*/)
    .map((x) => x.trim())
    .filter((x) => x && !/^(home|home ?page|welcome|official (web)?site)$/i.test(x));
  return parts[0] || null;
}

// Regulators and registers: independent evidence that agents weigh highly.
const REGULATORS = [
  { name: 'Ofsted', mention: /\bOfsted\b/, host: /(^|\.)ofsted\.gov\.uk$/, label: 'Ofsted inspection reports' },
  { name: 'CQC', mention: /\bCQC\b|Care Quality Commission/, host: /(^|\.)cqc\.org\.uk$/, label: 'CQC inspection reports' },
  { name: 'the Charity Commission', mention: /registered charity|Charity Commission|charity (no|number)/i, host: /charitycommission\.gov\.uk$|(^|\.)oscr\.org\.uk$/, label: 'Charity register entry' },
  { name: 'the FCA', mention: /\bFCA\b|Financial Conduct Authority/, host: /(^|\.)fca\.org\.uk$/, label: 'FCA register entry' },
  { name: 'the SRA', mention: /\bSRA\b|Solicitors Regulation Authority/, host: /(^|\.)sra\.org\.uk$/, label: 'SRA register entry' },
  { name: 'the GDC', mention: /\bGDC\b|General Dental Council/, host: /(^|\.)gdc-uk\.org$/, label: 'GDC register entry' },
  { name: 'Companies House', mention: /Companies House|company (no|number|registration)/i, host: /company-information\.service\.gov\.uk$/, label: 'Companies House record' },
];

function formatPrice(symbol, whole, pence) {
  return `${symbol}${whole}${pence ? '.' + pence : ''}`;
}

function periodOf(text) {
  if (/\b(per|a|\/)\s?(month|mo)\b|\bmonthly\b|\bpcm\b|\bpm\b/i.test(text)) return 'month';
  if (/\b(per|a|\/)\s?(year|yr|annum)\b|\bannually\b|\byearly\b/i.test(text)) return 'year';
  if (/\b(per|a|each|\/)\s?(session|visit|class|appointment|hour|night|use)\b/i.test(text)) return 'use';
  return null;
}

function jsonLdHours(node) {
  const days = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' };
  const out = [];
  const oh = node.openingHours;
  for (const s of Array.isArray(oh) ? oh : oh ? [oh] : []) {
    const m = String(s).match(/^([A-Z][a-z])(?:-([A-Z][a-z]))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (m) out.push(`${days[m[1]] || m[1]}${m[2] ? ' to ' + (days[m[2]] || m[2]) : ''}, ${m[3]} to ${m[4]}`);
    else out.push(String(s));
  }
  const spec = node.openingHoursSpecification;
  for (const sp of Array.isArray(spec) ? spec : spec ? [spec] : []) {
    const d = (Array.isArray(sp.dayOfWeek) ? sp.dayOfWeek : [sp.dayOfWeek]).filter(Boolean).map((x) => String(x).split('/').pop());
    if (d.length && sp.opens && sp.closes) {
      const range = d.length > 2 ? `${d[0]} to ${d[d.length - 1]}` : d.join(' and ');
      out.push(`${range}, ${String(sp.opens).slice(0, 5)} to ${String(sp.closes).slice(0, 5)}`);
    }
  }
  return out.length ? out.join('; ') : null;
}

/**
 * Turn crawled pages into facts. Every fact carries the page it came from, so the
 * draft can link each one to its receipt. Nothing is invented: a fact that is not
 * visibly on the site is left for the owner to supply.
 */
export function extractFacts(site) {
  const { pages, homeUrl } = site;
  const home = pages[0];
  const domain = registrableDomain(homeUrl);
  const byKind = (k) => pages.find((p) => (p.kinds || [p.kind]).includes(k));
  const nodes = pages.flatMap((p) => p.jsonld.map((n) => ({ node: n, page: p })));
  const facts = { sources: new Map(), notes: [...site.notes] };
  const cite = (page, label) => {
    if (page && !facts.sources.has(page.url)) facts.sources.set(page.url, page.kind === 'home' ? 'Home page' : label || page.title || page.url);
    return page?.url;
  };

  // Main entity: the organisation, business or app the site is about.
  const main =
    nodes.find(({ node }) => typesOf(node).some((t) => LOCAL_TYPES.test(t) || SOFTWARE_TYPES.test(t) || ORG_TYPES.test(t))) ||
    nodes.find(({ node }) => typesOf(node).some((t) => /Organization|Corporation/.test(t)));
  const mainTypes = main ? typesOf(main.node) : [];

  // Name: the brand, not the whole browser-tab title.
  facts.name = brandName(main?.node.name) || brandName(home.siteName) || brandName(home.title) || new URL(homeUrl).hostname;
  facts.url = homeUrl.replace(/\/$/, '');
  facts.language = home.lang || null;

  // Summary and the Verdict's "What": the site's own description, kept only if it is factual.
  const desc = (main?.node.description && String(main.node.description)) || home.description;
  if (desc) {
    const s = shorten(desc);
    const sup = findSuperlative(s.full);
    if (sup) facts.notes.push(`The site describes itself with "${sup}". Rewrite the summary as a plain fact.`);
    else {
      facts.summary = s.short;
      facts.summaryCut = s.cut;
      if (s.full.length <= 300) facts.what = s.full;
    }
  }

  // Profile (type) and category
  const allLinks = pages.flatMap((p) => p.links);
  const hasCart = allLinks.some((l) => /\/(cart|basket|checkout|shop|store|products?)(\/|$)/i.test(new URL(l.href).pathname));
  const appLinks = allLinks.filter((l) => /apps\.apple\.com|play\.google\.com/.test(l.href));
  const types = [];
  if (mainTypes.some((t) => SOFTWARE_TYPES.test(t)) || appLinks.length) types.push('software');
  if (mainTypes.some((t) => /OnlineStore/.test(t)) || (hasCart && nodes.some(({ node }) => typesOf(node).includes('Product')))) types.push('store');
  if (mainTypes.some((t) => LOCAL_TYPES.test(t) && !/OnlineStore/.test(t)) && (main.node.address || main.node.geo)) types.push('local');
  if (mainTypes.some((t) => ORG_TYPES.test(t))) types.push('organisation');
  if (mainTypes.some((t) => CONTENT_TYPES.test(t))) types.push('content');
  facts.type = [...new Set(types)];
  const specific = mainTypes.find((t) => !GENERIC_TYPES.test(t));
  if (specific) facts.category = humanType(specific);

  // Prices: from the pricing page if there is one, otherwise from any page.
  const pricingPage = byKind('pricing');
  const pricePages = pricingPage ? [pricingPage] : pages;
  const plans = [];
  const seen = new Set();
  let currencySymbol = null;
  for (const page of pricePages) {
    let heading = null;
    for (const b of page.blocks) {
      if (/^h[1-6]$/.test(b.tag)) heading = b.text;
      if (b.tag === 'button' || b.tag === 'label' || b.text.length > 160) continue;
      const matches = [...b.text.matchAll(PRICE_RE)];
      if (matches.length !== 1) continue;
      const [raw, symbol, whole, pence] = matches[0];
      // Keep the site's own words; only trim filler and punctuation around the price.
      let label = b.text
        .replace(raw, ' ')
        .replace(/\b(per|a|\/)\s?(month|mo|year|yr|session|visit|class|appointment|hour|night)\b|\bmonthly\b|\bannually\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\s:|–—\-·,(]+$/, '')
        .replace(/^[\s:|–—\-·,)]+/, '')
        .replace(/\s+(from|only|just|now|is|are|costs?|starting at|starts at)$/i, '')
        .replace(/^(from|only|just|now)\s+/i, '')
        .trim();
      if (!label || label.length < 2) label = heading || '';
      if (!label || label.length > 70) continue;
      const price = Number(`${whole.replace(/,/g, '')}${pence ? '.' + pence : ''}`);
      const key = `${label.toLowerCase()}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      currencySymbol ||= symbol;
      plans.push({ name: label, price, display: formatPrice(symbol, whole, pence), period: periodOf(b.text), page });
      if (plans.length >= 8) break;
    }
    if (plans.length) {
      cite(page, 'Prices');
      facts.pricingSource = page.url;
      break;
    }
  }
  // Structured offers, when the page text gave none.
  if (!plans.length) {
    for (const { node, page } of nodes) {
      const offers = node.offers ? (Array.isArray(node.offers) ? node.offers : [node.offers]) : [];
      for (const o of offers) {
        if (o.price !== undefined && !Number.isNaN(Number(o.price))) {
          const cur = o.priceCurrency || null;
          const symbol = Object.entries(CURRENCY).find(([, c]) => c === cur)?.[0] || '';
          if (symbol && page.text.includes(`${symbol}${o.price}`)) {
            plans.push({ name: String(node.name || o.name || 'Price'), price: Number(o.price), display: `${symbol}${o.price}`, period: null, page });
            currencySymbol ||= symbol;
            facts.pricingSource ||= cite(page, 'Prices');
          }
        }
      }
    }
  }
  facts.plans = plans;
  facts.currency = currencySymbol ? CURRENCY[currencySymbol] : null;
  const allText = pages.map((p) => p.text).join(' ');
  if (plans.length) {
    facts.from = Math.min(...plans.map((p) => p.price));
    facts.model = plans.some((p) => p.period === 'month' || p.period === 'year')
      ? plans.some((p) => p.price === 0)
        ? 'freemium'
        : 'subscription'
      : 'one-time';
  } else if (/\b(get a quotes?|request a quotes?|free quotes?|quotations?|prices? on request)\b/i.test(allText)) {
    facts.model = 'quote';
  }

  // Contact, location, hours
  const contactPage = byKind('contact') || home;
  const addressNode = main?.node.address;
  if (addressNode && typeof addressNode === 'object') {
    const parts = [addressNode.streetAddress, addressNode.addressLocality, addressNode.postalCode].filter(Boolean).map(String);
    if (parts.length) {
      facts.address = parts.join(', ');
      facts.addressSource = cite(main.page, 'Contact');
    }
  }
  const lookIn = [contactPage, home, ...pages].filter((p, i, a) => p && a.indexOf(p) === i);
  if (!facts.address) {
    for (const p of lookIn) {
      const b = p.blocks.find((x) => UK_POSTCODE.test(x.text) && x.text.length < 160);
      if (b) {
        facts.address = b.text;
        facts.addressSource = cite(p, 'Contact');
        break;
      }
    }
  }
  if (main?.node.telephone) {
    facts.phone = String(main.node.telephone);
    facts.phoneSource = cite(main.page, 'Contact');
  } else {
    for (const p of lookIn) {
      const tel = p.links.find((l) => l.href.startsWith('tel:'));
      const block = p.blocks.find((x) => PHONE_RE.test(x.text) && x.text.length < 120);
      // Use the number as the page shows it ("0121 289 7311"), not the link's raw digits.
      const telText = tel && PHONE_RE.test(tel.text) ? tel.text.match(PHONE_RE)[0] : null;
      const phone = telText || (block ? block.text.match(PHONE_RE)[0] : tel ? decodeURIComponent(tel.href.slice(4)) : null);
      if (phone && p.text.replace(/\s/g, '').includes(phone.replace(/\s/g, ''))) {
        facts.phone = phone.trim();
        facts.phoneSource = cite(p, 'Contact');
        break;
      }
    }
  }
  const hours = main ? jsonLdHours(main.node) : null;
  if (hours) {
    facts.hours = hours;
    facts.hoursSource = cite(main.page, 'Opening hours');
  } else {
    for (const p of lookIn) {
      const b = p.blocks.find((x) => DAY_TIME_RE.test(x.text) && x.text.length < 140);
      if (b) {
        facts.hours = b.text;
        facts.hoursSource = cite(p, 'Opening hours');
        break;
      }
    }
  }
  const mail = pages.flatMap((p) => p.links).find((l) => l.href.startsWith('mailto:'));
  if (mail) facts.email = decodeURIComponent(mail.href.slice(7).split('?')[0]);

  for (const p of pages) {
    const b = p.blocks.find((x) => LEGAL_RE.test(x.text));
    if (b) {
      facts.legalName = b.text.match(LEGAL_RE)[1].replace(/^(©|Copyright)\s*\d{0,4}\s*/i, '').trim();
      break;
    }
  }

  // Next step. A "Book appointment" button that leads to the contact page is a contact step, not online booking.
  const booking = byKind('booking');
  const download = byKind('download');
  const bookingIsContact = booking && !PAGE_KINDS.booking.test(new URL(booking.url).pathname.replace(/[-_/]/g, ' ')) && PAGE_KINDS.contact.test(new URL(booking.url).pathname.replace(/[-_/]/g, ' '));
  if (booking && !bookingIsContact) facts.getStarted = { url: cite(booking, 'Booking'), kind: 'book' };
  else if (appLinks.length) facts.getStarted = { url: appLinks[0].href, kind: 'download' };
  else if (download) facts.getStarted = { url: cite(download, 'Download'), kind: 'download' };
  else if (types.includes('store') && hasCart) {
    const shop = allLinks.find((l) => /\/(shop|store|products?)(\/|$)/i.test(new URL(l.href).pathname) && registrableDomain(l.href) === domain);
    if (shop) facts.getStarted = { url: shop.href, kind: 'shop' };
  } else if (byKind('contact')) facts.getStarted = { url: cite(byKind('contact'), 'Contact'), kind: 'contact' };

  // Independent evidence the site links to
  const evidence = new Map();
  for (const l of allLinks) {
    let host;
    try {
      host = new URL(l.href).hostname;
    } catch {
      continue;
    }
    for (const [re, label, test] of REVIEW_HOSTS) {
      if (re.test(host) && (!test || test(l.href)) && !evidence.has(label)) evidence.set(label, l.href);
    }
    for (const r of REGULATORS) {
      if (r.host.test(host) && !evidence.has(r.label)) evidence.set(r.label, l.href);
    }
  }
  facts.evidence = [...evidence].map(([label, url]) => ({ label, url }));

  // A regulator named on the site but not linked is the strongest evidence missing from the draft.
  facts.regulatorsMentioned = [];
  for (const r of REGULATORS) {
    if (r.mention.test(allText) && !evidence.has(r.label)) {
      facts.regulatorsMentioned.push(r);
      facts.notes.push(`The site mentions ${r.name} but does not link to it. Add a link to your ${r.label.replace(/ entry| record/, '')} in Evidence: agents weigh regulator pages above anything a business says about itself.`);
    }
  }

  // Profile, when the structured data gave none: a business you contact or ask for a quote offers a service.
  if (!facts.type.length) {
    facts.type = ['service'];
    facts.typeFallback = true;
  }
  facts.platforms = [
    ...(appLinks.some((l) => /apps\.apple\.com/.test(l.href)) ? ['iOS'] : []),
    ...(appLinks.some((l) => /play\.google\.com/.test(l.href)) ? ['Android'] : []),
  ];

  // Policy pages for shops
  for (const [kind, label] of [
    ['delivery', 'Delivery'],
    ['returns', 'Returns'],
    ['privacy', 'Privacy'],
  ]) {
    const p = byKind(kind);
    if (p) facts[`${kind}Page`] = cite(p, label);
  }

  // Regions: only when the site makes it plain
  if (facts.currency === 'GBP' && facts.address && UK_POSTCODE.test(facts.address)) facts.regions = ['GB'];

  // Pages read, for the Sources list
  facts.pagesRead = pages.map((p) => p.url);
  return facts;
}

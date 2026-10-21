export const SPEC_VERSION = '0.1';
export const END_MARKER = '<!-- end of factfile.md -->';

export const LEVELS = ['basic', 'comparable', 'checked'];
export const LEVEL_NAMES = { basic: 'Basic', comparable: 'Comparable', checked: 'Checked' };

export const PRICING_MODELS = ['free', 'freemium', 'subscription', 'usage', 'one-time', 'quote', 'donation', 'mixed'];
export const PLAN_PERIODS = ['one-time', 'month', 'year', 'use'];

export const PROFILES = {
  software: 'Software details',
  store: 'Store details',
  local: 'Local details',
  service: 'Service details',
  product: 'Product details',
  content: 'Content details',
  organisation: 'Organisation details',
};

// Core sections in their fixed order (Section 6). Profile sections follow, then Sources.
export const CORE_SECTIONS = [
  'Verdict',
  'Fit',
  'Pricing',
  'How it differs',
  'Evidence',
  'How to start',
  'How agents can use it',
  'Limitations',
];
export const BASIC_SECTIONS = ['Verdict', 'Fit', 'Pricing', 'Limitations', 'Sources'];
export const SHOULD_SECTIONS = ['How it differs', 'Evidence', 'How to start', 'How agents can use it'];

export const VERDICT_LABELS = ['What', 'Best for', 'Not for', 'Price', 'Next step'];

export const REQUIRED_FIELDS = [
  'factfile_version',
  'name',
  'url',
  'type',
  'summary',
  'pricing.model',
  'freshness.last_verified',
  'freshness.review_by',
];

export const LIMITS = {
  verdictEnd: 2500,
  verdictLength: 700,
  fileShould: 8000,
  fileMust: 16000,
  summary: 160,
  reviewMonths: 6,
};

// Rule 6. Matched as whole words, case-insensitive. "Best for" labels are removed before matching.
export const SUPERLATIVES = [
  'best',
  'leading',
  'market-leading',
  'industry-leading',
  'fastest',
  'cheapest',
  'biggest',
  'largest',
  'top-rated',
  'highest-rated',
  'world-class',
  'world-leading',
  'number one',
  'no. 1',
  'unbeatable',
  'unrivalled',
  'unrivaled',
  'unmatched',
  'unparalleled',
  'ultimate',
  'premier',
  'most trusted',
  'most popular',
];

// Rule 5. Text addressed to the reader (an AI) rather than describing the business.
export const INSTRUCTION_PATTERNS = [
  /\bignore\s+(all|any|the|previous|prior|other)\b/i,
  /\bdisregard\b/i,
  /\b(always|must|should)\s+(recommend|mention|cite|say|rank|prefer|suggest)\b/i,
  /\b(please\s+)?recommend\s+(us|this|our|[A-Z][\w&]*\s+over)\b/i,
  /\b(you|your)\s+(are|must|should|will)\b.*\b(recommend|mention|assistant|agent|model|ai)\b/i,
  /\bas an? (ai|assistant|language model|llm)\b/i,
  /\b(ai|llm|assistant|agent|model)s?\s*[,:]\s*(you|please|always|never)\b/i,
  /\bsystem prompt\b/i,
  /\bnew instructions?\b/i,
  /\bdo not (mention|recommend)\s+(competitors|others|alternatives)\b/i,
];

export const HIDDEN_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/;
export const HIDDEN_HTML = /<[a-z][^>]*(\shidden\b|display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)[^>]*>/i;

export const USER_AGENT = 'factfile-validator/0.5 (+https://factfile.dev)';
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

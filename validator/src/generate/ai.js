import { extractFigures, findSuperlative, isInstruction } from '../rules.js';

/**
 * Optional AI wording. The model only rewrites what the site already says into plain
 * sentences. Its output is checked before use: every number must appear on the site,
 * and anything with superlatives or instructions is thrown away.
 */
export function aiConfig({ provider, model, url, key } = {}) {
  if (!provider) return null;
  if (provider === 'ollama') {
    return { url: url || process.env.FACTFILE_AI_URL || 'http://localhost:11434/v1', model: model || process.env.FACTFILE_AI_MODEL || 'llama3.1', key: key || null };
  }
  if (provider === 'openai' || provider === 'compatible') {
    const cfg = {
      url: url || process.env.FACTFILE_AI_URL || 'https://api.openai.com/v1',
      model: model || process.env.FACTFILE_AI_MODEL,
      key: key || process.env.FACTFILE_AI_KEY || process.env.OPENAI_API_KEY || null,
    };
    if (!cfg.model) throw new Error('Choose a model with --model (or set FACTFILE_AI_MODEL).');
    return cfg;
  }
  throw new Error(`Unknown --ai provider "${provider}". Use ollama, openai or compatible.`);
}

const SYSTEM = `You help a business describe itself accurately to AI agents.
You will be given text copied from the business's own website.
Write ONLY facts that the text states. Never add claims, numbers, opinions or marketing words.
Never use superlatives or rankings (best, leading, top, number one, fastest, cheapest).
Never address the reader or give instructions. Use plain British English.
Reply with JSON only, in this shape:
{"summary": "one factual sentence under 150 characters",
 "what": "what it is, in plain words, one sentence",
 "differs": ["up to 3 checkable facts from the text that set it apart: a capability, policy or limit"]}
Use an empty string or empty list when the text does not say.`;

function sourceTextFor(site) {
  return site.pages
    .map((p) => `### ${p.url}\n${p.blocks.map((b) => b.text).join('\n')}`)
    .join('\n\n')
    .slice(0, 12000);
}

function checkSentence(s, sourceText) {
  if (typeof s !== 'string' || !s.trim()) return 'empty';
  if (findSuperlative(s)) return `uses "${findSuperlative(s)}"`;
  if (isInstruction(s)) return 'reads as an instruction';
  for (const fig of extractFigures(s)) {
    const n = fig.replace(/^[£$€]\s?/, '').replace(/,/g, '');
    if (!sourceText.replace(/,/g, '').includes(n)) return `contains "${fig}", which is not on the site`;
  }
  return null;
}

export async function improveWithAi(site, facts, cfg, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const sourceText = sourceTextFor(site);
  const res = await fetchImpl(`${cfg.url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cfg.key ? { authorization: `Bearer ${cfg.key}` } : {}) },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Business: ${facts.name}\n\nWebsite text:\n${sourceText}` },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`The AI service returned HTTP ${res.status}.`);
  const body = await res.json();
  const content = body.choices?.[0]?.message?.content || '';
  let out;
  try {
    out = JSON.parse(content.replace(/^```(json)?|```$/g, '').trim());
  } catch {
    throw new Error('The AI reply was not valid JSON.');
  }

  const accepted = {};
  const rejected = [];
  for (const key of ['summary', 'what']) {
    const s = typeof out[key] === 'string' ? out[key].trim() : '';
    if (!s) continue;
    const problem = checkSentence(s, sourceText) || (key === 'summary' && s.length >= 160 ? 'is 160 characters or longer' : null);
    if (problem) rejected.push(`${key}: ${problem}`);
    else accepted[key] = s;
  }
  const differs = [];
  for (const d of Array.isArray(out.differs) ? out.differs.slice(0, 3) : []) {
    const problem = checkSentence(d, sourceText);
    if (problem) rejected.push(`difference "${String(d).slice(0, 60)}": ${problem}`);
    else differs.push(d.trim().replace(/([^.])$/, '$1.'));
  }
  if (differs.length) accepted.differs = differs;
  return { accepted, rejected, model: cfg.model };
}

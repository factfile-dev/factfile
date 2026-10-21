#!/usr/bin/env node
import { access, writeFile } from 'node:fs/promises';
import { LEVELS } from '../src/constants.js';
import { formatReport } from '../src/format.js';
import { generate } from '../src/generate/index.js';
import { validate, VERSION } from '../src/index.js';

const HELP = `factfile ${VERSION}: write and check factfile.md files

Usage
  factfile validate <file-or-website> [options]
  factfile generate <website> [options]

Validate
  factfile validate factfile.md              check a local file (Basic and Comparable)
  factfile validate factfile.md --online     also check its links and the live pages
  factfile validate example.com              fetch the live file and run every check

  --online          Check linked pages and visible parity (needed for Checked)
  --require <lvl>   Exit with an error unless this level is reached:
                    basic (default), comparable or checked. Useful in CI.
  --json            Print the result as JSON

Generate
  factfile generate example.com              write a draft to ./factfile.md
  factfile generate example.com --ai ollama  let a local AI word the sentences

  -o, --out <file>  Where to write the draft (default: factfile.md)
  --stdout          Print the draft instead of writing a file
  --force           Overwrite an existing file
  --ai <provider>   ollama (local), openai, or compatible (any OpenAI-style API)
  --model <name>    AI model to use (default for ollama: llama3.1)
  --ai-url <url>    AI service address (or set FACTFILE_AI_URL)
                    API keys are read from FACTFILE_AI_KEY or OPENAI_API_KEY.

  -h, --help        Show this help
  -v, --version     Show the version
`;

function parseArgs(args) {
  const opts = { positional: [], online: false, json: false, require: 'basic', out: 'factfile.md', stdout: false, force: false, ai: null, model: null, aiUrl: null };
  const takes = { '--require': 'require', '-o': 'out', '--out': 'out', '--ai': 'ai', '--model': 'model', '--ai-url': 'aiUrl' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [flag, inline] = a.includes('=') && a.startsWith('--') ? a.split(/=(.*)/s) : [a, undefined];
    if (flag in takes) {
      const v = inline ?? args[++i];
      if (v === undefined) throw new Error(`${flag} needs a value.`);
      opts[takes[flag]] = v;
    } else if (a === '--online') opts.online = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--stdout') opts.stdout = true;
    else if (a === '--force') opts.force = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}. Run factfile --help.`);
    else opts.positional.push(a);
  }
  return opts;
}

async function runValidate(opts) {
  if (!LEVELS.includes(opts.require)) throw new Error(`--require must be one of: ${LEVELS.join(', ')}.`);
  const target = opts.positional[0];
  if (!target) throw new Error('Give a file or website to check, e.g. factfile validate example.com');
  const result = await validate({ target, online: opts.online });
  process.stdout.write((opts.json ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');
  const reachedIdx = result.level ? LEVELS.indexOf(result.level) : -1;
  return reachedIdx >= LEVELS.indexOf(opts.require) ? 0 : 1;
}

async function runGenerate(opts) {
  const target = opts.positional[0];
  if (!target) throw new Error('Give a website to read, e.g. factfile generate example.com');
  if (!opts.stdout && !opts.force) {
    const exists = await access(opts.out).then(() => true, () => false);
    if (exists) throw new Error(`${opts.out} already exists. Use --force to overwrite it, or -o to choose another file.`);
  }
  const say = (s) => process.stderr.write(s + '\n');
  say(`Reading ${target} …`);
  const r = await generate(target, {
    ai: opts.ai ? { provider: opts.ai, model: opts.model, url: opts.aiUrl } : null,
    version: VERSION,
    log: (m) => say(`  ${m}`),
  });

  if (opts.stdout) process.stdout.write(r.text);
  else await writeFile(opts.out, r.text, 'utf8');

  const f = r.facts;
  const found = [
    ['Name', f.name],
    ['Summary', f.summary || r.ai?.accepted?.summary],
    ['Prices', f.plans.length ? `${f.plans.length} found` : null],
    ['Address', f.address],
    ['Opening hours', f.hours],
    ['Phone', f.phone],
    ['Next step', f.getStarted?.url],
    ['Independent evidence', f.evidence.length ? `${f.evidence.length} link(s)` : null],
  ];
  say('');
  say(`Draft ${opts.stdout ? 'printed' : `written to ${opts.out}`} from ${r.pages.length} page(s).`);
  say('Found on the site:');
  for (const [k, v] of found) say(`  ${v ? '✓' : '–'} ${k}${v ? `: ${v}` : ''}`);
  if (r.ai) {
    say(`AI wording (${r.ai.model}): ${Object.keys(r.ai.accepted).length ? `used for ${Object.keys(r.ai.accepted).join(', ')}` : 'nothing usable'}.`);
    for (const x of r.ai.rejected) say(`  rejected ${x}`);
  }
  for (const n of r.notes) say(`Note: ${n}`);
  say('');
  say(`${r.todos.length} thing(s) for you to fill in or check — search the file for TODO.`);
  say('Only you can answer some of them, like who the business is NOT for. Nothing was invented.');
  if (opts.stdout) say(`To save it as a file, run the same command without --stdout (it writes ${opts.out}).`);
  say(`When done: factfile validate ${opts.out}`);
  return 0;
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.includes('-v') || args.includes('--version')) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  const opts = parseArgs(args);
  const command = ['validate', 'generate'].includes(opts.positional[0]) ? opts.positional.shift() : 'validate';
  return command === 'generate' ? runGenerate(opts) : runValidate(opts);
}

main(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`factfile: ${err.code === 'ENOENT' ? `file not found: ${err.path}` : err.message}\n`);
    process.exit(2);
  },
);

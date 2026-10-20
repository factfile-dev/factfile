#!/usr/bin/env node
import { LEVELS } from '../src/constants.js';
import { formatReport } from '../src/format.js';
import { validate, VERSION } from '../src/index.js';

const HELP = `factfile ${VERSION}: check a factfile.md against the specification

Usage
  factfile validate <file-or-website> [options]

Examples
  factfile validate factfile.md              check a local file (Basic and Comparable)
  factfile validate factfile.md --online     also check its links and the live pages
  factfile validate example.com              fetch the live file and run every check

Options
  --online          Check linked pages and visible parity (needed for Checked)
  --require <lvl>   Exit with an error unless this level is reached:
                    basic (default), comparable or checked. Useful in CI.
  --json            Print the result as JSON
  -h, --help        Show this help
  -v, --version     Show the version
`;

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

  const positional = [];
  let online = false;
  let json = false;
  let require = 'basic';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--online') online = true;
    else if (a === '--json') json = true;
    else if (a === '--require') require = args[++i];
    else if (a.startsWith('--require=')) require = a.split('=')[1];
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}. Run factfile --help.`);
    else positional.push(a);
  }
  if (!LEVELS.includes(require)) throw new Error(`--require must be one of: ${LEVELS.join(', ')}.`);

  if (positional[0] === 'validate') positional.shift();
  const target = positional[0];
  if (!target) throw new Error('Give a file or website to check, e.g. factfile validate example.com');

  const result = await validate({ target, online });
  process.stdout.write((json ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');

  const reachedIdx = result.level ? LEVELS.indexOf(result.level) : -1;
  return reachedIdx >= LEVELS.indexOf(require) ? 0 : 1;
}

main(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`factfile: ${err.code === 'ENOENT' ? `file not found: ${err.path}` : err.message}\n`);
    process.exit(2);
  },
);

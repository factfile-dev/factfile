import { LEVELS, LEVEL_NAMES } from './constants.js';

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColour ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c(31, s);
const yellow = (s) => c(33, s);
const green = (s) => c(32, s);
const bold = (s) => c(1, s);
const dim = (s) => c(2, s);

/** Plain-language report for people. */
export function formatReport(r) {
  const out = [];
  out.push(bold(`factfile.md validator`) + dim(` (${r.validator})`));
  out.push(`File: ${r.source}${r.name ? `  (${r.name})` : ''}`);
  out.push('');

  const ladder = LEVELS.map((lvl) => {
    const idx = LEVELS.indexOf(lvl);
    const reachedIdx = r.level ? LEVELS.indexOf(r.level) : -1;
    if (lvl === 'checked' && !r.onlineChecked) return `${dim('–')} ${LEVEL_NAMES[lvl]} ${dim('(not tested: run against the live site)')}`;
    return idx <= reachedIdx ? `${green('✓')} ${LEVEL_NAMES[lvl]}` : `${red('✗')} ${LEVEL_NAMES[lvl]}`;
  });
  out.push(bold('Level reached: ') + (r.level ? green(bold(r.levelName)) : red(bold('none'))));
  out.push(...ladder.map((l) => '  ' + l));
  out.push('');

  const show = (sev, label, colour) => {
    const list = r.findings.filter((f) => f.severity === sev);
    if (!list.length) return;
    out.push(colour(bold(`${label} (${list.length})`)));
    for (const f of list) {
      // Line 1 is the opening --- of the header, so header findings read better as "header".
      const where = f.line === 1 ? 'header' : f.line ? `line ${f.line}` : 'file';
      out.push(`  ${dim(where.padEnd(9))} ${f.message} ${dim(`[${LEVEL_NAMES[f.level]}${f.spec ? ' · ' + f.spec : ''}]`)}`);
    }
    out.push('');
  };
  show('error', 'Errors', red);
  show('warning', 'Warnings', yellow);

  if (!r.errors && !r.warnings) out.push(green('No problems found.'), '');
  if (r.errors) {
    const next = r.level ? LEVELS[LEVELS.indexOf(r.level) + 1] : 'basic';
    if (next) out.push(dim(`Fix the errors marked [${LEVEL_NAMES[next]}] to reach the next level.`));
  }
  out.push(dim('Specification: https://github.com/factfile-dev/factfile/blob/main/SPEC.md'));
  return out.join('\n');
}

import { build } from 'esbuild';
await build({
  entryPoints: ['entry.js'], bundle: true, format: 'iife', globalName: 'Factfile', minify: true, target: 'es2020',
  outfile: '../static/factfile-tools.js', legalComments: 'none',
  alias: { 'node:fs/promises': './stub-fs.js' },
  define: { 'process.env': '{}', 'process.stdout': '{}' },
  nodePaths: ['../../validator/node_modules'],
  banner: { js: '/* factfile tools (MIT) for the browser: same code as `npx factfile`. https://github.com/factfile-dev/factfile */' },
});

import { build } from 'esbuild';

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  outfile: 'dist-server/server.js',
  logLevel: 'info',
});

console.log('Server bundle written to dist-server/server.js');
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['scripts/vps-signal-worker.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'dist/scanner.mjs',
  // Wrangler is a development-only SQLite/D1 bridge; the scanner must never
  // ship OAuth tokens or depend on a workstation's Wrangler login.
  external:['wrangler'],banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
console.log('Portable scanner built: dist/scanner.mjs');

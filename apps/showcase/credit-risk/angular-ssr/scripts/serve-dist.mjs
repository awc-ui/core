#!/usr/bin/env node
/**
 * Run the built server on a chosen port.
 *
 *   node scripts/serve-dist.mjs [port]     # default 4613, same as `pnpm start`
 *
 * This used to be a static file server, because this build used to be static:
 * `dist/browser/` held 95 prerendered `index.html` files and something had to
 * put them at the real mount path so they could be checked as deployed. There
 * is nothing static left to serve. `dist/server/server.mjs` IS the build — it
 * mounts itself at `/showcase/credit-risk/angular-ssr/`, serves the browser
 * bundle and `awc-runtime/` from `dist/browser/`, and renders each of the six
 * screens per request.
 *
 * So all that is left to do is take a port on the command line, which
 * `scripts/verify-browser.mjs` needs and the `PORT` environment variable
 * already covers. Importing the server rather than spawning it keeps its
 * startup line on this process's stdout, which is what verify-browser waits
 * for.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(appRoot, 'dist/server/server.mjs');

if (!existsSync(entry)) {
  console.error(
    `[serve] ${entry} does not exist — build first:\n` +
      '        pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr build',
  );
  process.exit(1);
}

if (process.argv[2]) process.env.PORT = process.argv[2];

await import(entry);

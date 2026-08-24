#!/usr/bin/env node
/**
 * Serve `dist/` at the real mount path — `/showcase/credit-risk/svelte/` — so
 * the build can be checked exactly as it will be deployed. `vite preview`
 * serves at the configured base too, but this needs no Vite process: `pnpm
 * verify` starts it itself, which is what makes `pnpm showcase:verify` at the
 * repo root a single command rather than a sequence with a server to remember.
 *
 * IT IS A FILE SERVER AND NOTHING ELSE, which is the point of this pair: the
 * SvelteKit twin next door needs a running Node process to answer a request and
 * ships a `server.mjs` to be it. Nothing here renders, and nothing here has to.
 *
 *   node scripts/serve-dist.mjs [port]
 *
 * DELIBERATELY WITHOUT A HISTORY FALLBACK. It would be one line, and it would
 * make this the only server in the pipeline that has one: the parity and a11y
 * verifiers at the repo root are dumb file servers, and so is the docs host in
 * the configuration that matters. A fallback here would quietly cover for a
 * missing `scripts/fan-out-routes.mjs` run and let a build that 404s on every
 * deep link pass its own verification. An unknown path 404s, exactly as it
 * would in production.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath: BASE_PATH } = createRoutes('svelte');

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'dist');
const port = Number(process.argv[2] || 4330);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === BASE_PATH) path = `${BASE_PATH}/`;
  if (!path.startsWith(`${BASE_PATH}/`)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('outside mount path');
    return;
  }
  path = path.slice(BASE_PATH.length);

  // normalize() collapses any `..` before the join, so a traversal attempt
  // resolves inside `dist/` rather than above it.
  let file = join(root, normalize(path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1>');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`[serve] http://localhost:${port}${BASE_PATH}/`);
});

#!/usr/bin/env node
/**
 * Serve `.output/public/` at the real mount path —
 * `/showcase/credit-risk/vue/` — so the generated build can be checked exactly
 * as it will be deployed. `nuxi preview` runs a server at `/` and every asset
 * URL in the output carries the base path, so it 404s on all of them.
 *
 *   node scripts/serve-dist.mjs [port]
 *
 * The mount is read from the kit rather than written down again here, which is
 * the whole reason `createRoutes()` exists: one fact, one place.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath: BASE_PATH } = createRoutes('vue');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, '.output/public');
const port = Number(process.argv[2] || 4324);

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
  // resolves inside `.output/public/` rather than above it.
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

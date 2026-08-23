#!/usr/bin/env node
/**
 * Serve `dist/browser/` at the real mount path —
 * `/showcase/credit-risk/angular/` — so the prerendered build can be checked
 * exactly as it will be deployed. `ng serve` rebuilds from source and never
 * prerenders, so it cannot answer the question this needs answering: whether
 * the files the builder actually emitted are correct.
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

const { basePath: BASE_PATH } = createRoutes('angular');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'dist/browser');
const port = Number(process.argv[2] || 4325);

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
  // resolves inside `dist/browser/` rather than above it.
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

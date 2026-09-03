#!/usr/bin/env node
/**
 * Serve `dist/` at the real mount path — `/showcase/banking/html/` — so the
 * build can be checked exactly as it will be deployed. Every URL in the output
 * is absolute and carries that prefix, so serving the directory at `/` would
 * 404 on every stylesheet, every link and the runtime.
 *
 *   node scripts/serve.mjs [port]
 *
 * The default port is 4332 — the credit-risk HTML build's 4322 plus the +10
 * this vertical adds throughout, so both can serve at once.
 *
 * The mount is read from the kit rather than written down again here, which is
 * the whole reason `createRoutes()` exists: one fact, one place.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_PATH } from '../src/lib/i18n.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'dist');
const port = Number(process.argv[2] || 4332);

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

#!/usr/bin/env node
/**
 * Serve `out/` at the real mount path — `/showcase/credit-risk/react/` — so the
 * exported build can be checked exactly as it will be deployed. `next start`
 * cannot do this: it refuses to run against `output: 'export'`.
 *
 *   node scripts/serve-out.mjs [port]
 *
 * The mount is read from the kit rather than written down again here, which is
 * the whole reason `createRoutes()` exists: one fact, one place. It used to be
 * a literal, and it was wrong — `/showcase/credit-risk/next`, left over from
 * when this build was called `next` — so every request fell outside the mount
 * and this script served nothing but "outside mount path".
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'out');
const MOUNT = createRoutes('react').basePath;
const port = Number(process.argv[2] || 4321);

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
  if (path === MOUNT) path = MOUNT + '/';
  if (!path.startsWith(MOUNT + '/')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('outside mount path');
    return;
  }
  path = path.slice(MOUNT.length);

  // normalize() collapses any `..` before the join, so a traversal attempt
  // resolves inside `out/` rather than above it.
  let file = join(root, normalize(path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && existsSync(file + '.html')) file += '.html';

  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1>');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`[serve-out] http://localhost:${port}${MOUNT}/`);
});

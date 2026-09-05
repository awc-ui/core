#!/usr/bin/env node
/**
 * Serve `dist/browser/` at the real mount path — `/showcase/community/angular/`
 * — so the build can be checked exactly as it will be deployed.
 *
 *   node scripts/serve-dist.mjs [port]
 *
 * `ng serve` cannot answer the question this needs answering. It rebuilds from
 * source, serves one document from memory and never runs the fan-out, so it is
 * the one configuration in which a deep link works whether or not the files
 * exist. This serves the bytes the builder actually emitted.
 *
 * DELIBERATELY WITHOUT A HISTORY FALLBACK. It would be one line, and it would
 * make this the only server in the pipeline that has one: the parity and a11y
 * verifiers at the repo root are dumb file servers, and so is the docs host in
 * the configuration that matters. A fallback here would quietly cover for a
 * missing `scripts/fan-out-routes.mjs` run and let a build that 404s on every
 * deep link pass its own verification. An unknown path 404s, exactly as it would
 * in production.
 *
 * DIRECTORIES RESOLVE TO THEIR `index.html`, which is not a fallback but the
 * behaviour every static host has, and this build needs it: Angular drops the
 * trailing slash from the address bar on its first navigation (`Location`
 * normalises `…/holdings/` to `/holdings`), so a reader who reloads asks for
 * `…/angular/holdings`, and the file is at `…/angular/holdings/index.html`.
 *
 * The mount is read from the kit rather than written down again here, which is
 * the whole reason `createRoutes()` exists: one fact, one place.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes } from '@awc-ui/showcase-kit/community';

const { basePath: BASE_PATH } = createRoutes('angular');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(appRoot, 'dist/browser');
const port = Number(process.argv[2] || 4471);

if (!existsSync(join(root, 'index.html'))) {
  console.error(
    `[serve] ${join(root, 'index.html')} does not exist — build first:\n` +
      '        pnpm --filter @awc-ui/showcase-community-angular build',
  );
  process.exit(1);
}

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

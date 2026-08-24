#!/usr/bin/env node
/**
 * Serve the WHOLE showcase locally, the way production serves it: every build
 * under one origin.
 *
 * WHY THIS EXISTS, and it is not convenience. Each build runs on its own port in
 * development, and the dock's framework switcher rewrites the framework SEGMENT
 * of the path while leaving the origin alone — which is exactly right in
 * production, where all ten builds share a host, and a trap in development,
 * where they do not. Switching from the SvelteKit build on :4612 to Angular
 * (SSR) asks :4612 for `/showcase/credit-risk/angular-ssr/`, and SvelteKit
 * correctly answers "Not found". Nothing is broken; the origin is simply wrong,
 * and the page gives no hint of that.
 *
 * So: one origin, ten builds, the switcher works, and what you are looking at
 * matches what gets deployed.
 *
 * IT ALSO CHECKS THE DEPLOY CONFIG. The routing below mirrors
 * `apps/docs/netlify.toml` rule for rule, including the part that is easy to get
 * wrong: the server-rendered prefixes must be matched BEFORE the static
 * catch-all, because first match wins and `/showcase/:app/:framework/*` would
 * otherwise rewrite every SSR route to an index.html that deliberately does not
 * exist. Running this exercises that ordering on a real request.
 *
 * Usage:
 *   pnpm showcase:build      # stage the six static builds, compile the four servers
 *   pnpm showcase:preview    # then this
 *
 * The four server-rendered builds are started here and stopped on exit. The six
 * static builds are read from `apps/docs/public`, so anything not staged 404s
 * with a message saying so rather than silently serving nothing.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SSR_APPS, basePathFor } from './lib/ssr-apps.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'apps/docs/public');
const PORT = Number(process.argv[2] || 4500);
const VERTICAL = 'credit-risk';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ the SSR servers */

const children = [];

function startServers() {
  for (const app of SSR_APPS) {
    const cwd = join(root, app.dir);
    if (!existsSync(cwd)) {
      console.error(`  ${app.id}: ${app.dir} does not exist — skipping`);
      continue;
    }
    const child = spawn('pnpm', app.start, {
      cwd,
      stdio: 'ignore',
      shell: false,
      detached: true,
      env: { ...process.env, PORT: String(app.port) },
    });
    children.push(child);
  }
}

function stopServers() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

async function waitFor(app, timeoutMs = 90_000) {
  const url = `http://localhost:${app.port}${basePathFor(app.id)}/`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

/* ------------------------------------------------------------------- routing */

/** Same order as netlify.toml: server-rendered prefixes first, then static. */
const PROXIED = SSR_APPS.map((app) => ({
  id: app.id,
  prefix: `${basePathFor(app.id)}/`,
  port: app.port,
}));

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  for (const rule of PROXIED) {
    if (pathname === rule.prefix.slice(0, -1)) {
      res.writeHead(302, { location: rule.prefix });
      return res.end();
    }
    if (!pathname.startsWith(rule.prefix)) continue;

    const upstream = httpRequest(
      {
        host: 'localhost',
        port: rule.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `localhost:${rule.port}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, 'x-awc-preview': rule.id });
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<h1>502 — the ${rule.id} build is not answering</h1>` +
          `<p>This path renders per request, so it is proxied to a live server rather than ` +
          `served from disk. In production that server is its own Netlify site; here it is ` +
          `<code>localhost:${rule.port}</code>.</p><pre>${err.message}</pre>` +
          `<p>Build it first: <code>pnpm --filter @awc-ui/showcase-credit-risk-${rule.id} build</code></p>`,
      );
    });
    return req.pipe(upstream);
  }

  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(PUBLIC, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  else if (!existsSync(file) && existsSync(`${file}/index.html`)) file = `${file}/index.html`;

  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(
      `<h1>404</h1><p><code>${pathname}</code> is not in the staged tree.</p>` +
        `<p>The static builds are served from <code>apps/docs/public</code>. If you have not ` +
        `staged them yet: <code>pnpm showcase:build</code></p>`,
    );
  }

  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

/* ---------------------------------------------------------------------- main */

process.on('SIGINT', () => {
  stopServers();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopServers();
  process.exit(0);
});
process.on('exit', stopServers);

console.log(`\n  starting ${SSR_APPS.length} server-rendered builds…`);
startServers();

const ready = [];
for (const app of SSR_APPS) {
  const up = await waitFor(app);
  ready.push({ app, up });
  console.log(`  ${up ? '  ok' : 'FAIL'}  ${app.id.padEnd(12)} :${app.port}`);
  if (!up) {
    console.log(
      `        did not answer — has it been built? ` +
        `pnpm --filter @awc-ui/showcase-credit-risk-${app.id} build`,
    );
  }
}

if (!existsSync(join(PUBLIC, 'showcase', VERTICAL))) {
  console.log(`\n  NOTE: no staged static builds — run \`pnpm showcase:build\` for the other six.`);
}

server.listen(PORT, () => {
  console.log(`\n  showcase           http://localhost:${PORT}/showcase/${VERTICAL}/react/`);
  console.log(`  every build is reachable from the dock at the bottom of the page.\n`);
  console.log(`  static (from apps/docs/public):  html astro react vue angular svelte`);
  console.log(`  proxied to live servers:         ${ready.filter((r) => r.up).map((r) => r.app.id).join(' ')}`);
  console.log(`\n  ctrl-c stops the servers as well as this one.\n`);
});

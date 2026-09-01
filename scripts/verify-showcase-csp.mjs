#!/usr/bin/env node
/**
 * Prove a vertical's builds run under an enterprise Content-Security-Policy.
 *
 * WHY A CHECK AND NOT A REVIEW. "No inline scripts or styles" is not a thing you
 * can establish by reading the source: the shipped HTML is assembled by five
 * different toolchains, the component runtime injects at bootstrap, and a
 * framework can turn a template expression into `setAttribute('style', …)`
 * without anyone writing the word "style" anywhere. The only honest answer is to
 * serve the built output under the policy and count what the browser refuses.
 *
 * THE POLICY has no `'unsafe-inline'` and no `'unsafe-eval'`, which is the point
 * — those two are what an enterprise deployment will not grant. It is otherwise
 * deliberately ordinary, so passing here means passing a real deployment rather
 * than a policy written to be passed.
 *
 * WHAT COUNTS AS A FAILURE. Any violation, and separately any build that stops
 * WORKING — a page can be perfectly CSP-clean by virtue of never having booted.
 * The first run of this found exactly that: three builds reported few violations
 * and zero hydrated components, because the blocked script was the one that
 * loads the component runtime. So each build is also asserted to have upgraded
 * its components, which is the assertion that cannot be satisfied by failing
 * quietly.
 *
 * WHAT IS NOT A VIOLATION, and is worth recording because it shapes every fix
 * here: CSSOM is exempt. `el.style.setProperty(…)` and `new CSSStyleSheet()` +
 * `adoptedStyleSheets` both apply normally under `style-src 'self'`, while
 * `setAttribute('style', …)`, an inline `<style>` element and a `style="…"`
 * attribute in markup are all refused. Measured, not assumed. So the component
 * library's shadow CSS (constructable stylesheets) and any measured geometry
 * written through `.style` need no changes; only authored inline content does.
 *
 * Usage:
 *   pnpm showcase:build --vertical wealth   # stage the builds
 *   node scripts/verify-showcase-csp.mjs wealth
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { VERTICALS, basePathFor, staticBuilds } from './lib/showcase-verticals.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'apps/docs/public');
const PORT = 4356;

/**
 * The screens each vertical is checked on.
 *
 * Not just the entry: a violation can hide behind a route that renders a
 * component nothing else uses. Keyed by vertical so a new one adds an entry
 * rather than editing a list, and a vertical with none is a hard error below.
 */
const SCREENS = {
  wealth: ['/', '/holdings/', '/households/hh-01/', '/proposals/', '/trade/', '/planning/'],
  'credit-risk': ['/', '/watchlist/', '/counterparties/cp-01/'],
};

const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // Attributes are called out separately: `style-src` alone would let a
  // `style="…"` attribute through on some engines, and that is the single
  // easiest violation to reintroduce by accident.
  "style-src-attr 'none'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const wanted = process.argv.slice(2);
const verticals = wanted.length ? VERTICALS.filter((v) => wanted.includes(v.id)) : VERTICALS;

const unknown = wanted.filter((id) => !VERTICALS.some((v) => v.id === id));
if (unknown.length) {
  console.error(`[csp] no such vertical: ${unknown.join(', ')}`);
  process.exit(1);
}
const missing = verticals.filter((v) => !SCREENS[v.id]?.length);
if (missing.length) {
  console.error(
    `[csp] no screen list for: ${missing.map((v) => v.id).join(', ')}\n` +
      '      add one to SCREENS in this file — a vertical with no screens would ' +
      'report PASS having loaded nothing.',
  );
  process.exit(1);
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = join(PUBLIC, normalize(path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  // The policy rides on the DOCUMENT, exactly as a deployment would send it —
  // not injected after load, which would miss everything that ran during parse.
  if (extname(file) === '.html') res.setHeader('content-security-policy', POLICY);
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const results = [];
const ok = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

for (const vertical of verticals) {
  console.log(`\n======== ${vertical.id} ========`);
  for (const { framework } of staticBuilds(vertical.id)) {
    const base = `http://localhost:${PORT}${basePathFor(vertical.id, framework)}`;
    const seen = new Map();
    let booted = 0;
    let screens = 0;

    for (const screen of SCREENS[vertical.id]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__cspViolations.push({
            directive: e.violatedDirective,
            blocked: e.blockedURI,
            sample: (e.sample || '').slice(0, 70),
            source: (e.sourceFile || '').split('/').pop(),
            line: e.lineNumber,
          });
        });
      });
      await page.goto(`${base}${screen}`, { waitUntil: 'networkidle0', timeout: 90000 });
      // The runtime is lazy; give the chunks time to land and upgrade.
      await new Promise((r) => setTimeout(r, 3000));

      for (const v of await page.evaluate(() => window.__cspViolations ?? [])) {
        const where = v.blocked && v.blocked !== 'inline' ? v.blocked : `${v.source || '(inline)'}:${v.line}`;
        const key = `${v.directive} @ ${where} ${v.sample}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      // A page that never booted cannot violate anything, so liveness is asserted
      // alongside — see the note at the top.
      const upgraded = await page.evaluate(
        () => document.querySelectorAll('md-card.hydrated, md-table.hydrated, md-list.hydrated').length,
      );
      if (upgraded > 0) booted += 1;
      screens += 1;
      await page.close();
    }

    console.log(`\n[${vertical.id} ${framework}]`);
    ok('no CSP violations on any screen', seen.size === 0, seen.size ? `${seen.size} distinct` : '');
    for (const [key, n] of [...seen].slice(0, 8)) console.log(`       ${n}x ${key}`);
    ok('every screen still hydrates under the policy', booted === screens, `${booted}/${screens}`);
  }
}

await browser.close();
server.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);

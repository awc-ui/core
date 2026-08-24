#!/usr/bin/env node
/**
 * The SPA fallback, materialised.
 *
 * A single-page application resolves its own routes, but only once it is
 * RUNNING. A cold request for `/showcase/credit-risk/angular/facilities/fac-001/`
 * reaches the host first, and a plain static host answers it with a 404 — the
 * app never gets the chance to route. Every deep link, every bookmark, every
 * ⌘-click on a drill anchor and every link the dock's framework switcher builds
 * lands on exactly that path.
 *
 * The usual fix is a host rewrite (`/showcase/credit-risk/angular/* →
 * /showcase/credit-risk/angular/index.html 200`). That rule is still worth
 * having, but it cannot be the ONLY answer here, for two reasons:
 *
 *   1. `scripts/verify-showcase-parity.mjs` and `scripts/verify-showcase-a11y.mjs`
 *      each stand up a dumb `createServer` + `createReadStream` file server over
 *      `apps/docs/public`: directory → `index.html`, 404 otherwise. No history
 *      fallback, no rewrite hook. Five of this build's six parity routes would
 *      404, which is not one failure but thirty.
 *   2. A rewrite is host configuration, and this vertical is served from
 *      whatever is hosting the docs site. Shipping the routes as files means the
 *      build works on any static host, correctly, with no configuration at all.
 *
 * So the routes are enumerated and the shell is copied into each one. Every copy
 * is byte-identical, which is what keeps this a single-page application rather
 * than a prerender: the documents carry no screen content and differ in nothing
 * but their path. Angular reads the path back through `Location.normalize()`,
 * which strips the base href and then the trailing slash, so the shell served at
 * `…/watchlist/index.html` boots into the `watchlist` route with no per-file
 * knowledge of where it was served from.
 *
 * WHERE THE LIST COMES FROM. The three fixture selectors — `getSectors`,
 * `getCounterparties`, `getFacilities`. Add a row to the kit's fixture and its
 * page appears here with no edit; that is the same contract `generateStaticParams`
 * gives the React build, and it is the contract the `prerender-routes.txt` file
 * this build's ancestor wrote had too.
 *
 * The route SHAPES come from the kit's `route` table, so they cannot drift from
 * the patterns `src/app/app.routes.ts` matches on.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCounterparties, getFacilities, getSectors } from '@awc-ui/showcase-kit/data';
import { route } from '@awc-ui/showcase-kit/credit-risk';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/* Angular's `application` builder always writes the browser bundle into
   `<outputPath>/browser`, whether or not there is a server half. That directory
   — the one with `index.html` at its root — is what `scripts/build-showcase.mjs`
   stages into `apps/docs/public/showcase/credit-risk/angular/`. */
const dist = join(appRoot, 'dist/browser');
const source = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error(
    `[fan-out] ${source} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-credit-risk-angular build',
  );
  process.exit(1);
}

/*
 * REFUSE TO FAN OUT A PRERENDERED SHELL, and this guard is the reason the check
 * is worth its five lines. `angular.json` sets `"prerender": false`; turn it
 * back on and the builder writes a shell whose `<awc-root>` already contains the
 * OVERVIEW screen. Copying that into all 95 routes would leave every screen in
 * the build showing the portfolio overview — the pages would load, look
 * plausible, and be wrong, and the app would then silently correct itself the
 * moment Angular booted, which is exactly the kind of failure a browser check
 * struggles to see.
 */
const shell = readFileSync(source, 'utf8');
if (!/<awc-root[^>]*>\s*<\/awc-root>/.test(shell)) {
  console.error(
    '[fan-out] the built shell is not empty — <awc-root> already has content.\n' +
      '          This build is a single-page application: check that\n' +
      '          angular.json still has "prerender": false and no "server" entry.',
  );
  process.exit(1);
}

/** Every route this app serves. `/` is already `dist/browser/index.html`. */
const routes = [
  route.watchlist(),
  route.stress(),
  ...getSectors().map((sector) => route.sector(sector.id)),
  ...getCounterparties().map((cp) => route.counterparty(cp.id)),
  ...getFacilities().map((facility) => route.facility(facility.id)),
];

for (const path of routes) {
  // Every kit route ends in `/`, so the path IS the directory and the file is
  // always `index.html` inside it — which is exactly what a static host looks
  // for, and what saves it from having to issue a missing-slash redirect.
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, 'index.html'));
}

console.log(
  `[fan-out] ${routes.length + 1} routes — one index.html each, from dist/browser/index.html`,
);

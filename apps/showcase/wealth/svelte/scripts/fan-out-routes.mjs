#!/usr/bin/env node
/**
 * The SPA fallback, materialised.
 *
 * A single-page application resolves its own routes, but only once it is
 * RUNNING. A cold request for `/showcase/wealth/svelte/households/hh-01/`
 * reaches the host first, and a plain static host answers it with a 404 — the
 * app never gets the chance to route. Every deep link, every bookmark, every
 * ⌘-click on a drill anchor and every link the dock's framework switcher builds
 * lands on exactly that path.
 *
 * The usual fix is a host rewrite (`/showcase/wealth/svelte/* →
 * /showcase/wealth/svelte/index.html 200`). That rule is still worth having —
 * it is what makes a typo'd URL land in the app's own not-found screen — but
 * it cannot be the ONLY answer here, for two reasons:
 *
 *   1. `scripts/verify-showcase-parity.mjs` and `scripts/verify-showcase-a11y.mjs`
 *      each stand up a dumb `createServer` + `createReadStream` file server over
 *      `apps/docs/public`: directory → `index.html`, 404 otherwise. No history
 *      fallback, no rewrite hook. Most of this build's parity routes 404ing is
 *      not one failure, it is every comparison this build takes part in.
 *   2. A rewrite is host configuration, and this vertical is served from
 *      whatever is hosting the docs site. Shipping the routes as files means the
 *      build works on any static host, correctly, with no configuration at all.
 *
 * So the routes are enumerated and `index.html` is copied into each one. Every
 * copy is byte-identical — the router reads `location.pathname`, so one document
 * serves them all.
 *
 * WHY N IDENTICAL FILES IS STILL AN SPA AND NOT A PRERENDER. Nothing about the
 * page is computed per route: no screen is rendered into any of them, and the
 * document served at `/households/hh-01/` is byte for byte the one served at
 * `/`. With JavaScript disabled every one of them is an empty `<div id="root">`.
 * What the fan-out replaces is the host's rewrite rule, not a render.
 *
 * WHERE THE LIST COMES FROM. The kit's own fixture selector: `getHouseholds`
 * enumerates the one parameterised route the same way the screens read it. Add
 * a household to the kit's fixture and its page appears with no edit here —
 * that property is the reason the enumeration was written against a selector
 * rather than a literal list, and it is worth keeping.
 *
 * The route SHAPES come from the kit's `route` table, so they cannot drift from
 * the patterns `src/App.svelte` matches on.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHouseholds, route } from '@awc-ui/showcase-kit/wealth';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');
const source = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error(
    `[fan-out] ${source} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-wealth-svelte build',
  );
  process.exit(1);
}

/** Every route this app serves. `/` is already `dist/index.html`. */
const routes = [
  route.holdings(),
  route.proposals(),
  route.trade(),
  route.planning(),
  ...getHouseholds().map((household) => route.household(household.id)),
];

for (const path of routes) {
  // Every kit route ends in `/`, so the path IS the directory and the file is
  // always `index.html` inside it — which is exactly what a static host looks
  // for, and what saves it from having to issue a missing-slash redirect.
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, 'index.html'));
}

console.log(`[fan-out] ${routes.length + 1} routes — one index.html each, from dist/index.html`);

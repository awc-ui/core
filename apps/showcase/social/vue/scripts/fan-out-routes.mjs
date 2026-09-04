#!/usr/bin/env node
/**
 * The SPA fallback, materialised.
 *
 * A single-page application resolves its own routes, but only once it is
 * RUNNING. A cold request for `/showcase/social/vue/households/hh-01/` reaches
 * the host first, and a plain static host answers it with a 404 — the app
 * never gets the chance to route. Every deep link, every bookmark, every
 * ⌘-click on a drill anchor and every link the dock's framework switcher builds
 * lands on exactly that path.
 *
 * The usual fix is a host rewrite (`/showcase/social/vue/* →
 * /showcase/social/vue/index.html 200`). That rule is still worth having — it
 * is what makes a typo'd URL land in the app's own not-found screen — but it
 * cannot be the ONLY answer here, for two reasons:
 *
 *   1. `scripts/verify-showcase-parity.mjs` and `scripts/verify-showcase-a11y.mjs`
 *      each stand up a dumb `createServer` + `createReadStream` file server over
 *      `apps/docs/public`: directory → `index.html`, 404 otherwise. No history
 *      fallback, no rewrite hook. Those checks compare this build screen by
 *      screen against its siblings, so most of its routes 404ing is not one
 *      failure, it is dozens.
 *   2. A rewrite is host configuration, and this vertical is served from
 *      whatever is hosting the docs site. Shipping the routes as files means the
 *      build works on any static host, correctly, with no configuration at all.
 *
 * So the routes are enumerated and `index.html` is copied into each one. Every
 * copy is byte-identical — the router reads `location.pathname`, so one
 * document serves them all.
 *
 * WHERE THE LIST COMES FROM. The kit's own fixture selector: `getHouseholds`
 * enumerates the one parameterised route, and the four static sections come
 * from the shared route table. Add a household to the kit's fixture and its
 * page appears with no edit here — the same property the credit-risk fan-outs
 * keep by enumerating from selectors rather than a literal list.
 *
 * WHAT THIS IS NOT. Every copy is the same shell, with no screen rendered into
 * any of them; the document at `/households/hh-01/` is byte-identical to the
 * one at `/`. That is what keeps this an SPA rather than a prerender — the
 * files answer the HOST's routing question, and the browser still answers the
 * app's.
 *
 * The route SHAPES come from the kit's `route` table, so they cannot drift from
 * the patterns `src/App.vue` matches on.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPeople, getPosts, route } from '@awc-ui/showcase-kit/social';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');
const source = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error(
    `[fan-out] ${source} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-social-vue build',
  );
  process.exit(1);
}

/** Every route this app serves. `/` is already `dist/index.html`. */
const routes = [
  route.explore(),
  route.create(),
  route.activity(),
  route.profile(),
  ...getPosts().map((post) => route.post(post.id)),
  ...getPeople().map((person) => route.person(person.handle)),
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

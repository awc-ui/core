#!/usr/bin/env node
/**
 * The SPA fallback, materialised — the wealth build of the same script the
 * credit-risk react app carries, and for the same two reasons its header lays
 * out at length: the repo's verifiers serve `dist/` with a dumb file server
 * (no history fallback), and shipping the routes as files makes the build work
 * on any static host with no rewrite configuration at all. Every copy is
 * byte-identical; the router reads `location.pathname`.
 *
 * The route list comes from the kit's route table and fixture selectors, so a
 * household added to the fixture gets its page with no edit here, and the
 * shapes cannot drift from what `src/App.tsx` matches on.
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
      '          pnpm --filter @awc-ui/showcase-wealth-react build',
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
  // always `index.html` inside it — exactly what a static host looks for.
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, 'index.html'));
}

console.log(`[fan-out] ${routes.length + 1} routes — one index.html each, from dist/index.html`);

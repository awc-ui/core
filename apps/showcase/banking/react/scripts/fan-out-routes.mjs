#!/usr/bin/env node
/**
 * The SPA fallback, materialised — the banking build of the same script the
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
import { getAccounts, getInstruments, route } from '@awc-ui/showcase-kit/banking';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');
const source = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error(
    `[fan-out] ${source} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-banking-react build',
  );
  process.exit(1);
}

/** Every route this app serves. `/` is already `dist/index.html`. */
const routes = [
  route.transactions(),
  route.exchange(),
  route.invest(),
  route.analytics(),
  route.cards(),
  ...getAccounts().map((account) => route.account(account.id)),
  ...getInstruments().map((instrument) => route.instrument(instrument.id)),
];

for (const path of routes) {
  // Every kit route ends in `/`, so the path IS the directory and the file is
  // always `index.html` inside it — exactly what a static host looks for.
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, 'index.html'));
}

console.log(`[fan-out] ${routes.length + 1} routes — one index.html each, from dist/index.html`);

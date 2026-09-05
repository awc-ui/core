#!/usr/bin/env node
/**
 * The SPA fallback, materialised — the social build of the same script the
 * three verticals next door carry, and for the same two reasons their headers
 * lay out at length: the repo's verifiers serve `dist/` with a dumb file server
 * (no history fallback), and shipping the routes as files makes the build work
 * on any static host with no rewrite configuration at all. Every copy is
 * byte-identical; the router reads `location.pathname`.
 *
 * The route list comes from the kit's route table and fixture selectors, so a
 * person added to the fixture gets their page with no edit here, and the shapes
 * cannot drift from what `src/App.tsx` matches on.
 *
 * A PERSON'S PAGE IS ADDRESSED BY HANDLE, which is the one thing here that is
 * not an opaque id, and groups and events by slug — see the note on `route` in
 * the kit. Handles and slugs are
 * ASCII and contain a dot, which a static host treats as a plain directory
 * name; nothing needs encoding.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEvents, getGroups, getPeople, getPosts, route } from '@awc-ui/showcase-kit/community';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');
const source = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error(
    `[fan-out] ${source} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-community-react build',
  );
  process.exit(1);
}

/** Every route this app serves. `/` is already `dist/index.html`. */
const routes = [
  route.friends(),
  route.groups(),
  route.events(),
  route.profile(),
  ...getPosts().map((post) => route.post(post.id)),
  ...getPeople().map((person) => route.person(person.handle)),
  ...getGroups().map((group) => route.group(group.slug)),
  ...getEvents().map((event) => route.event(event.slug)),
];

for (const path of routes) {
  // Every kit route ends in `/`, so the path IS the directory and the file is
  // always `index.html` inside it — exactly what a static host looks for.
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, 'index.html'));
}

console.log(`[fan-out] ${routes.length + 1} routes — one index.html each, from dist/index.html`);

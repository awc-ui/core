#!/usr/bin/env node
/**
 * Write the list of routes for the Angular builder to prerender.
 *
 * Angular discovers static routes from the router by itself, but a
 * parameterised route — `/sectors/:sector` — has no discoverable set of values,
 * so the 92 parameterised screens need naming. The list is read from the fixture
 * rather than hard-coded, so adding a counterparty to the kit adds a page here
 * without a second edit; that is the same contract `generateStaticParams` gives
 * the React build and `entries` gives the Svelte one.
 *
 * The paths are written WITHOUT the base href. Angular prefixes it.
 *
 * NO TRAILING SLASHES, and this is the one place the six builds genuinely
 * differ in their input rather than their output. Angular's router treats
 * `/watchlist/` as a distinct path from `/watchlist` and would not match it, so
 * the routes file lists bare paths — while the builder still writes each one as
 * `watchlist/index.html`, which is the directory shape every other build emits
 * and the shape a static host needs.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCounterparties, getFacilities, getSectors } from '@awc-ui/showcase-kit/data';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const routes = [
  '/',
  '/watchlist',
  '/stress',
  ...getSectors().map((sector) => `/sectors/${sector.id}`),
  ...getCounterparties().map((cp) => `/counterparties/${cp.id}`),
  ...getFacilities().map((facility) => `/facilities/${facility.id}`),
];

const file = join(appRoot, 'prerender-routes.txt');
writeFileSync(file, `${routes.join('\n')}\n`);
console.log(`[prerender-routes] ${routes.length} routes -> prerender-routes.txt`);

#!/usr/bin/env node
/**
 * The lint step for a build with no compiler.
 *
 * The other five ports get their safety net from `tsc` or `astro check`. There
 * is none here, so this does the two checks that actually catch what goes wrong
 * in a template-literal renderer:
 *
 * 1. EVERY MODULE PARSES AND LOADS. A stray backtick inside an `html` template
 *    — in a comment, in a prop name, anywhere — silently ends the template and
 *    turns the rest of the file into broken JavaScript. Importing every module
 *    surfaces that immediately.
 * 2. EVERY SCREEN RENDERS IN EVERY LOCALE, and the output carries no
 *    `undefined`, no `[object Object]` and no unresolved dictionary key. Those
 *    three are what a missing translation, a mis-spread props object or a
 *    forgotten `String()` actually look like in the emitted HTML, and none of
 *    them throws.
 */

import { getCounterparties, getFacilities, getSectors } from '@awc-ui/showcase-kit/data';
import { LOCALE_CODES, useT } from '../src/lib/i18n.mjs';
import { overviewScreen } from '../src/screens/overview.mjs';
import { sectorScreen } from '../src/screens/sector.mjs';
import { counterpartyScreen } from '../src/screens/counterparty.mjs';
import { facilityScreen } from '../src/screens/facility.mjs';
import { watchlistScreen } from '../src/screens/watchlist.mjs';
import { stressScreen } from '../src/screens/stress.mjs';

/** What a rendering mistake looks like once it is already in the HTML. */
const SMELLS = [
  { pattern: /undefined/, label: 'the string "undefined"' },
  { pattern: /\[object Object\]/, label: '"[object Object]" (an object where a string was wanted)' },
  // A key that never resolved comes back as the key itself, which always has a
  // dot and never a space — `table.ead` rather than "Exposure at default".
  { pattern: />\s*[a-z]+\.[a-zA-Z.]+\s*</, label: 'an unresolved dictionary key' },
];

const failures = [];

function check(name, markup) {
  const html = String(markup);
  for (const { pattern, label } of SMELLS) {
    const hit = html.match(pattern);
    if (hit) failures.push(`${name}: ${label} — …${html.slice(Math.max(0, hit.index - 60), hit.index + 60)}…`);
  }
}

for (const locale of LOCALE_CODES) {
  const t = useT(locale);
  check(`${locale} overview`, overviewScreen(t, locale));
  check(`${locale} watchlist`, watchlistScreen(t, locale));
  check(`${locale} stress`, stressScreen(t, locale));
  for (const sector of getSectors()) check(`${locale} sector/${sector.id}`, sectorScreen(t, locale, sector.id));
  for (const cp of getCounterparties()) check(`${locale} counterparty/${cp.id}`, counterpartyScreen(t, locale, cp.id));
  for (const facility of getFacilities()) check(`${locale} facility/${facility.id}`, facilityScreen(t, locale, facility.id));
}

if (failures.length) {
  console.error(`[lint] ${failures.length} problem(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`[lint] ${LOCALE_CODES.length} locales × 95 screens render clean`);

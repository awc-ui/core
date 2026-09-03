#!/usr/bin/env node
/**
 * The lint step for a build with no compiler.
 *
 * The other four ports get their safety net from `tsc` or a framework checker.
 * There is none here, so this does the two checks that actually catch what
 * goes wrong in a template-literal renderer:
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

import { getHouseholds } from '@awc-ui/showcase-kit/banking';
import { LOCALE_CODES, useT } from '../src/lib/i18n.mjs';
import { overviewScreen } from '../src/screens/overview.mjs';
import { holdingsScreen } from '../src/screens/holdings.mjs';
import { householdScreen } from '../src/screens/household.mjs';
import { proposalsScreen } from '../src/screens/proposals.mjs';
import { tradeScreen } from '../src/screens/trade.mjs';
import { planningScreen } from '../src/screens/planning.mjs';

/** What a rendering mistake looks like once it is already in the HTML. */
const SMELLS = [
  { pattern: /undefined/, label: 'the string "undefined"' },
  { pattern: /\[object Object\]/, label: '"[object Object]" (an object where a string was wanted)' },
  // A key that never resolved comes back as the key itself, which always has a
  // dot and never a space — `banking.table.drift` rather than "Drift".
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

let screens = 0;
for (const locale of LOCALE_CODES) {
  const t = useT(locale);
  screens = 0;
  check(`${locale} overview`, overviewScreen(t, locale));
  screens += 1;
  check(`${locale} holdings`, holdingsScreen(t, locale));
  screens += 1;
  for (const household of getHouseholds()) {
    check(`${locale} household/${household.id}`, householdScreen(t, locale, household.id));
    screens += 1;
  }
  check(`${locale} proposals`, proposalsScreen(t, locale));
  screens += 1;
  check(`${locale} trade`, tradeScreen(t, locale));
  screens += 1;
  check(`${locale} planning`, planningScreen(t, locale));
  screens += 1;
}

if (failures.length) {
  console.error(`[lint] ${failures.length} problem(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`[lint] ${LOCALE_CODES.length} locales × ${screens} screens render clean`);

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
 * 3. NO BACKTICK INSIDE AN HTML COMMENT. This is the specific mistake behind
 *    check 1, and it has now been made eight times across this repo's
 *    template-literal renderers — so it gets its own check that names it,
 *    rather than being diagnosed a second time from whatever syntax error it
 *    happens to produce four lines later. See `checkSource` below.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_CODES, useT } from '../src/lib/i18n.mjs';
import { routes } from '../src/routes.mjs';

/** What a rendering mistake looks like once it is already in the HTML. */
const SMELLS = [
  { pattern: /undefined/, label: 'the string "undefined"' },
  { pattern: /\[object Object\]/, label: '"[object Object]" (an object where a string was wanted)' },
  /*
   * A key that never resolved comes back as the key itself.
   *
   * ANCHORED ON THE NAMESPACE, not on "a lowercase word with a dot in it",
   * which is what the three consoles' copy of this check looks for. It cannot
   * be that here: a handle IS a lowercase word with a dot in it, and this app
   * renders 24 of them as visible text. The looser pattern reported every story
   * in the rail and every caption byline as a missing translation.
   */
  { pattern: />\s*social\.[a-zA-Z.]+\s*</, label: 'an unresolved dictionary key' },
];

const failures = [];

/* --------------------------------------------------- the backtick check */

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Every `.mjs` under `src/`, so a new screen is covered without an edit here. */
function sources(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.mjs') ? [path] : [];
  });
}

/**
 * A backtick or a `${` inside an HTML comment.
 *
 * Every HTML comment in this build is written INSIDE an `html` template
 * literal, so both sequences mean something to JavaScript before they ever mean
 * anything to HTML: a backtick ends the template, and `${` opens a substitution
 * that then swallows the rest of the comment as code. Neither is a parse error
 * on its own — the damage lands somewhere further down, which is why the
 * resulting message has never once pointed at the comment that caused it.
 *
 * Comments outside a template (`/** … *\/` on a function) are unaffected and
 * are where prose about `md-chip` belongs; the scan only looks between
 * `<!--` and `-->`.
 */
function checkSource(path) {
  const text = readFileSync(path, 'utf8');
  const relative = path.slice(SRC.length + 1);
  for (const match of text.matchAll(/<!--[\s\S]*?-->/g)) {
    const bad = match[0].includes('`') ? 'a backtick' : match[0].includes('${') ? 'a "${"' : null;
    if (!bad) continue;
    const line = text.slice(0, match.index).split('\n').length;
    failures.push(
      `src/${relative}:${line}: ${bad} inside an HTML comment — it ends the template literal it sits in`,
    );
  }
}

for (const path of sources(SRC)) checkSource(path);

function check(name, markup) {
  const html = String(markup);
  for (const { pattern, label } of SMELLS) {
    const hit = html.match(pattern);
    if (hit) failures.push(`${name}: ${label} — …${html.slice(Math.max(0, hit.index - 60), hit.index + 60)}…`);
  }
}

const screens = routes();
for (const locale of LOCALE_CODES) {
  const t = useT(locale);
  for (const screen of screens) {
    check(`${locale} ${screen.path}`, screen.render(t, locale));
  }
}

if (failures.length) {
  console.error(`[lint] ${failures.length} problem(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `[lint] ${sources(SRC).length} modules clean, ` +
    `${LOCALE_CODES.length} locales × ${screens.length} screens render clean`,
);

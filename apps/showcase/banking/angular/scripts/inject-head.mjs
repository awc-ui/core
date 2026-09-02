#!/usr/bin/env node
/**
 * Put the kit's two head facts into the shell the builder emitted, and drop the
 * commentary before it is copied 13 times.
 *
 * WHY THIS IS A BUILD STEP AND NOT MARKUP. `src/index.html` is a static file and
 * Angular's `application` builder has no `transformIndexHtml` hook — it appends
 * its own `<link>` and `<script>` tags to the document and changes nothing else.
 * So anything in `<head>` that the kit OWNS has to be written in afterwards, or
 * it has to be pasted into the template and forked from the kit on the first
 * edit. The React build next door reaches the same place from the other side:
 * its `awc-showcase-head` Vite plugin substitutes the same two values into the
 * same two places. This is that plugin, spelled as a script.
 *
 * WHAT GOES IN
 *
 *   1. THE PREBOOT IIFE, at the marker, which sits above every stylesheet in
 *      the head. ~800 bytes that read the showcase state from the URL or
 *      localStorage and stamp lang / dir / data-theme / data-density onto
 *      <html> synchronously. Without it a reader on the dark theme gets a white
 *      page — and one reading Arabic gets an LTR one — until `main.js` has
 *      downloaded, parsed and booted. On a single-page application that is the
 *      longest wait in the document, which is exactly why this cannot be left
 *      to the APP_INITIALIZER that covers `ng serve`.
 *
 *   2. THE REPORTING DATE, as a meta. The same evidence the other builds carry,
 *      read from the fixture rather than typed out again.
 *
 * WHAT COMES OUT: every HTML comment. `src/index.html` carries kilobytes of
 * rationale — the ordering of the head, why the runtime is a plain module
 * script, why the body is empty — and all of it is for whoever edits that file,
 * none of it for the browser. Angular does not minify HTML, so without this
 * every visitor downloads the rationale, on every one of the 13 documents
 * `scripts/fan-out-routes.mjs` writes.
 *
 * Runs after `ng build` and before the fan-out, so the 13 copies are made from
 * the finished shell rather than 13 copies each needing the same edit.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/banking';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shell = join(appRoot, 'dist/browser/index.html');

if (!existsSync(shell)) {
  console.error(
    `[inject-head] ${shell} does not exist — build first:\n` +
      '              pnpm --filter @awc-ui/showcase-banking-angular build',
  );
  process.exit(1);
}

/*
 * The script body is inlined into HTML, so a `</script>` anywhere inside it
 * would close the tag early and spill the rest of the IIFE into the document as
 * text. It does not contain one today; this is here so that if the kit's preboot
 * ever grows a string literal that does, the build stops rather than shipping a
 * broken head to every page.
 */
if (/<\/script/i.test(PREBOOT_SCRIPT)) {
  console.error('[inject-head] PREBOOT_SCRIPT contains a closing script tag — cannot inline it');
  process.exit(1);
}

const MARKER = '<!-- __AWC_HEAD__ -->';
const head =
  `<script data-awc-preboot>${PREBOOT_SCRIPT}</script>` +
  `<meta name="awc-reporting-date" content="${REPORTING_DATE}">`;

const before = readFileSync(shell, 'utf8');

if (!before.includes(MARKER)) {
  // Two ways to get here. Running this twice by hand is harmless and says so.
  // The marker having gone missing from a fresh build is not: the page would
  // ship with no preboot and the only symptom would be a themed reader seeing
  // the wrong colours for a second, which nothing else in the pipeline checks.
  if (before.includes('data-awc-preboot')) {
    console.log('[inject-head] already injected — nothing to do');
    process.exit(0);
  }
  console.error(
    `[inject-head] ${MARKER} is not in the built shell.\n` +
      '              src/index.html must carry it, above the stylesheet, or the\n' +
      '              preboot script never reaches the page.',
  );
  process.exit(1);
}

const after = before
  .replace(MARKER, head)
  // NON-greedy, so two adjacent comments do not collapse into one match that
  // swallows the markup between them. There is no comment inside a <script>
  // here to protect — the preboot above is minified JavaScript with no `<!--`
  // in it, which the guard further up also depends on.
  .replace(/<!--[\s\S]*?-->/g, '')
  // The comments sat on their own lines; removing them leaves the blank lines.
  .replace(/\n\s*\n+/g, '\n');

writeFileSync(shell, after);

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;
console.log(
  `[inject-head] preboot ${PREBOOT_SCRIPT.length}B + reporting date ${REPORTING_DATE} — ` +
    `index.html ${kb(Buffer.byteLength(before))} -> ${kb(statSync(shell).size)}`,
);

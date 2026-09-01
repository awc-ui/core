#!/usr/bin/env node
/**
 * Every build of a vertical must be ONE application.
 *
 * That is the whole premise of the showcase: the same screens, the same
 * numbers, the same components, so a screenshot of the React build and a
 * screenshot of the Svelte build differ only where the framework differs. It is
 * also the claim most likely to rot, because every port is written in its own
 * idiom and a divergence looks like a design decision right up until someone
 * puts the two side by side.
 *
 * So this puts them side by side. Each vertical nominates a REFERENCE build —
 * `VERTICALS[].reference` in `scripts/lib/showcase-verticals.mjs`, which is
 * `react` for credit-risk because React was written first — and every other
 * static build in that vertical is compared against it on every screen, for:
 *
 *   - the visible text of the screen, normalised for whitespace;
 *   - an ordered fingerprint of the `md-*` elements: tag plus the attributes
 *     that decide what each one shows or does, in document order;
 *   - the census of `md-*` elements, by tag;
 *   - the number of live table rows, and whether a pagination control exists;
 *   - the LAYOUT: the height of the document, and the vertical gap between each
 *     pair of adjacent rendered blocks.
 *
 * RUNS PER VERTICAL. It used to have `credit-risk` and `react` spelled into it,
 * which is why a second vertical could not be added without editing this file.
 * Both now come from the registry, and every vertical it lists is measured. Name
 * one on the command line to measure only that one:
 *
 *   node scripts/verify-showcase-parity.mjs               # every vertical
 *   node scripts/verify-showcase-parity.mjs credit-risk   # just this one
 *
 * WHAT THIS CAUGHT. The `html` and `astro` builds used to render the whole
 * twenty-four-row book instead of a page of ten, and all three stress scenarios
 * instead of the selected one — defensible in isolation, wrong for a showcase
 * whose point is comparability. The census is what makes that visible: a screen
 * can look right and still carry three times the tables.
 *
 * WHY ORDER AND SHADOW TEXT ARE HERE TOO. A census answers "are the same
 * elements present", which is not the question "is this the same page". Two
 * things walked straight past a passing census: the Astro build put the
 * "showing N of N" chip inside the filter panel instead of beside the screen
 * heading — same chip, same total, different place — and its sector chart was
 * missing `clickable` and its drill targets, so the bars did not navigate. The
 * ordered fingerprint catches the first, because position changes the sequence,
 * and the second, because `clickable` is part of that element's entry. It also
 * covers every label these components render inside a shadow root, where
 * `innerText` cannot reach — because each of those arrives through a prop that
 * is on the host.
 *
 * WHY GEOMETRY IS HERE TOO. The census missed a bug a reader spotted instantly:
 * those two builds wrapped their screens in a `<div data-stress>` so a client
 * script had something to scope to, and the wrapper became the single flex item
 * in the screen's column. Its children had no gap rule, so the cards ran
 * together with no space between them. Same elements, same text, wrong page.
 * Comparing the document height and the gaps between blocks catches that class
 * of thing, which is otherwise only ever caught by eye.
 *
 * ONLY RENDERED BLOCKS COUNT, and the walk sees through framework plumbing.
 * `<template>` and `<script>` children occupy no space and are skipped. A
 * `display: contents` host — which is how the Angular build stops its wrapper
 * components from becoming boxes — is not itself a block, so the walk descends
 * into it and takes the children instead. Without that, Angular reports four
 * blocks where React reports six and fails a check it actually passes.
 *
 * COUNTS LIVE ELEMENTS ONLY. `html` and `astro` park their off-screen rows and
 * panels in `<template>`, whose contents the parser keeps out of the document
 * tree — so they are correctly invisible to `querySelectorAll`, exactly as they
 * are to a screen reader. A build that *hid* those rows instead would fail
 * here, which is the point.
 *
 * Serves the staged builds itself, so it needs nothing running:
 *   pnpm showcase:build          # -> apps/docs/public/showcase/
 *   pnpm verify:showcase-parity
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { VERTICALS, basePathFor, stagedPathFor, staticBuilds } from './lib/showcase-verticals.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'apps/docs/public');
const PORT = 4352;

/**
 * The screens each vertical is compared on — one of each kind, including the
 * three that page, filter or switch.
 *
 * WHY THIS LIVES HERE AND NOT IN THE REGISTRY. `showcase-verticals.mjs`
 * describes the BUILD MATRIX — which frameworks a vertical ships, where each
 * one is staged, which one is the reference. These are routes into a
 * vertical's CONTENT, and `/counterparties/cp-01/` means nothing outside
 * credit-risk. Keyed by vertical id so the next vertical adds an entry rather
 * than editing a list, and a vertical with NO entry is a hard error below
 * rather than a run that quietly measures nothing.
 */
const SCREENS = {
  'credit-risk': [
    '/',
    '/watchlist/',
    '/stress/',
    '/sectors/energy/',
    '/counterparties/cp-01/',
    '/facilities/fac-001/',
  ],
  /* One route per screen. `/households/hh-01/` stands in for the eight drill
     pages the fixture generates — they render through the same screen. */
  wealth: [
    '/',
    '/holdings/',
    '/households/hh-01/',
    '/proposals/',
    '/trade/',
    '/planning/',
  ],
};

/**
 * Only measure the vertical named on the command line, if one is.
 *
 * No argument means every vertical in the registry, which is what CI wants: the
 * failure this whole file exists to prevent is a check that still passes while
 * silently covering only the first vertical.
 */
const wanted = process.argv.slice(2);
const verticals = wanted.length ? VERTICALS.filter((v) => wanted.includes(v.id)) : VERTICALS;

const unknown = wanted.filter((id) => !VERTICALS.some((v) => v.id === id));
if (unknown.length) {
  console.error(
    `[parity] no such vertical: ${unknown.join(', ')}\n` +
      `         known: ${VERTICALS.map((v) => v.id).join(', ')}`,
  );
  process.exit(1);
}

/*
 * NOTHING IS SKIPPED QUIETLY. A vertical with no screen list, or one that has
 * not been staged, stops the run instead of being passed over — a verification
 * that measures nothing while reporting PASS is worse than one that errors, and
 * with more verticals coming this is exactly how it would rot.
 *
 * The staged check covers EVERY static build, not just the reference: a partial
 * `pnpm showcase:build react vue` used to get as far as the browser and then
 * report the missing builds as parity differences, which described the symptom
 * and not the cause.
 */
const missingScreens = verticals.filter((v) => !SCREENS[v.id]?.length);
if (missingScreens.length) {
  console.error(
    `[parity] no screen list for: ${missingScreens.map((v) => v.id).join(', ')}\n` +
      "         add one to SCREENS in this file — a vertical with no screens would " +
      'report PASS having compared nothing.',
  );
  process.exit(1);
}

/*
 * The reference has to be a build this script can actually reach. A vertical
 * naming a server-rendered build as its reference — or misspelling one — would
 * otherwise leave every screen comparing the other builds against a 404, which
 * the guard further down turns into a failure but describes badly.
 */
const badReference = verticals.filter(
  (v) => !staticBuilds(v.id).some((b) => b.framework === v.reference),
);
if (badReference.length) {
  console.error(
    '[parity] reference is not a static build of its own vertical: ' +
      `${badReference.map((v) => `${v.id} -> ${v.reference}`).join(', ')}\n` +
      "         fix `reference` in scripts/lib/showcase-verticals.mjs — it must name one of\n" +
      "         that vertical's staged builds, because a server-rendered one has nothing to serve.",
  );
  process.exit(1);
}

const unstaged = verticals.flatMap((v) =>
  staticBuilds(v.id)
    .filter((b) => !existsSync(join(PUBLIC, stagedPathFor(v.id, b.framework), 'index.html')))
    .map((b) => `${v.id}/${b.framework}`),
);
if (unstaged.length) {
  console.error(
    `[parity] not staged under apps/docs/public/showcase: ${unstaged.join(', ')}\n` +
      '         build it first:\n' +
      '         pnpm showcase:build',
  );
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// The staged tree already sits at the paths the builds were compiled against,
// so serving `apps/docs/public` at `/` puts each one where its own absolute
// URLs expect it.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = join(PUBLIC, normalize(decodeURIComponent(url.pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(PORT, done));

const browser = await puppeteer.launch({ headless: 'shell' });

/** Load one screen and describe what is actually in the document. */
async function describe(vertical, framework, route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setCacheEnabled(false);
  try {
    await page.goto(`http://localhost:${PORT}${basePathFor(vertical, framework)}${route}`, {
      waitUntil: 'networkidle0',
      timeout: 90000,
    });
    // The charts draw after the runtime lands; nothing here depends on the
    // pixels, but the elements must have finished arriving.
    await new Promise((r) => setTimeout(r, 2500));
    return await page.evaluate(() => {
      /*
       * Every element in document order, descending into shadow roots — except
       * the dock's.
       *
       * `<awc-showcase-dock>` is the showcase's CHROME, not the application
       * being compared, and it used to be invisible here for a reason that no
       * longer holds: built from plain `<select>` and `<button>`, it
       * contributed no `md-*` element to either the census or the fingerprint.
       * Rebuilt out of the library, its shadow root now contributes twenty-odd
       * — and one of them is a permanent, deliberate difference, because the
       * framework picker reads `value="react"` in the React build and
       * `value="vue"` in the Vue one. That is the control doing its job;
       * comparing it would be demanding that every build claim to be React.
       *
       * The whole subtree goes rather than that one attribute: everything in
       * there comes from ONE shared element in `@awc-ui/showcase-kit`,
       * identical across a vertical's builds by construction, so there is no
       * per-build divergence here for this script to catch. That the dock
       * rendered, and offered every build as a selectable row, is checked where
       * it can be checked properly — in each app's own
       * `scripts/verify-browser.mjs`.
       */
      const walkAll = (root, out = []) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'AWC-SHOWCASE-DOCK') continue;
          out.push(el);
          if (el.shadowRoot) walkAll(el.shadowRoot, out);
        }
        return out;
      };
      const all = walkAll(document);

      const census = {};
      for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (tag.startsWith('md-')) census[tag] = (census[tag] || 0) + 1;
      }

      /*
       * What each md-* element shows or does, in document order.
       *
       * Deliberately a short, hand-picked list. Generated ids, ARIA wiring and
       * per-framework bookkeeping differ by design and would drown the signal —
       * and so would the PLUMBING each build uses to wire a behaviour up. The
       * html and astro builds carry their chart drill targets in a `data-drill`
       * attribute; the four hydrating builds attach a framework listener and
       * have no such attribute. Both navigate. Comparing that would be
       * demanding one implementation, which is the opposite of the point.
       *
       * `clickable` IS compared, because it is the component's own contract for
       * whether the bars are a control — but by PRESENCE, not value: React sets
       * the property and gets `clickable="true"` reflected back, while a markup
       * build writes a bare `clickable`. Same meaning, different spelling.
       */
      const VALUED = [
        'label', 'value', 'color', 'state', 'variant', 'appearance', 'icon',
        'column-template', 'sort-by', 'sort-order',
        'row-count', 'row-offset', 'count', 'page', 'rows-per-page',
      ];
      const PRESENCE = ['clickable', 'numeric', 'head', 'striped', 'frozen-header'];

      const fingerprint = all
        .filter((el) => el.tagName.toLowerCase().startsWith('md-'))
        .map((el) => {
          const tag = el.tagName.toLowerCase();
          /*
           * READ THE PROPERTY, NOT THE ATTRIBUTE — which is what the note below
           * always claimed this did.
           *
           * A prop declared without `reflect` produces no attribute, so whether
           * one exists says only how the framework chose to deliver the value.
           * Measured on the wealth household screen, all four builds carried
           * `label = "Proposals"` while React and Angular ALSO wrote the
           * attribute, Svelte wrote none, and Vue wrote it for two of four
           * lists and not the other two — Vue picks per binding with `key in
           * el`. Comparing attributes reported three of those as divergences
           * when every build had the identical value, which is exactly the
           * "demanding one implementation" this file warns against elsewhere.
           *
           * The attribute is still the fallback: it is all there is before a
           * component upgrades, and it is where a non-primitive prop (a select's
           * array value) is legible. An empty resolved value is omitted rather
           * than recorded as `x=`, so a default-empty prop does not enter the
           * fingerprint for every element that declares one.
           */
          const bits = [];
          for (const n of VALUED) {
            const camel = n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            const pv = camel in el ? el[camel] : undefined;
            const v =
              typeof pv === 'string' || typeof pv === 'number' || typeof pv === 'boolean'
                ? String(pv)
                : el.hasAttribute(n)
                  ? el.getAttribute(n)
                  : null;
            if (v != null && v !== '') bits.push(`${n}=${v}`);
          }
          bits.push(...PRESENCE.filter((n) => el.hasAttribute(n)));
          return bits.length ? `${tag}[${bits.join(',')}]` : tag;
        });

      /*
       * Visible text — LIGHT DOM only, and that is a deliberate retreat.
       *
       * Reading through shadow roots was tried and is too noisy to be useful
       * here: Astro server-renders its shadow content into declarative shadow
       * DOM while the SPA builds have theirs built by the runtime, so the two
       * legitimately differ in whitespace and in what a half-upgraded component
       * leaves behind. Every label those shadow roots display arrives through a
       * prop, and the fingerprint above compares those props — so the coverage
       * is kept without the false positives.
       */
      const text = (document.querySelector('.shell')?.innerText ?? document.body.innerText)
        .replace(/\s+/g, ' ')
        .trim();

      /*
       * Blocks that actually occupy space, in document order.
       *
       * `display: contents` hosts are transparent to layout, so they are
       * replaced by their children rather than skipped — otherwise a build that
       * wraps each panel in such a host looks like it has fewer blocks than it
       * renders.
       */
      const boxes = (nodes) => {
        const out = [];
        const walk = (list) => {
          for (const el of list) {
            const display = getComputedStyle(el).display;
            if (display === 'none') continue;
            if (display === 'contents') {
              walk(el.children);
              continue;
            }
            const r = el.getBoundingClientRect();
            if (r.height > 0 && r.width > 0) {
              out.push({ top: Math.round(r.top), height: Math.round(r.height) });
            }
          }
        };
        walk([...nodes]);
        return out;
      };

      const gapsBetween = (list) =>
        list.slice(1).map((box, i) => box.top - (list[i].top + list[i].height));

      const shell = document.querySelector('.shell');
      return {
        census,
        text,
        fingerprint,
        rows: document.querySelectorAll('md-table-body md-table-row').length,
        pagination: document.querySelectorAll('md-table-pagination').length,
        docHeight: Math.round(document.body.scrollHeight),
        // The screen's own column, and every panel card wherever it sits.
        blockGaps: gapsBetween(boxes(shell?.children ?? [])),
        cardGaps: gapsBetween(boxes(document.querySelectorAll('md-card.panel'))),
      };
    });
  } catch (error) {
    return { error: String(error).slice(0, 120) };
  } finally {
    await page.close();
  }
}

const failures = [];
const summaries = [];

for (const vertical of verticals) {
  /*
   * The builds measured, and the one they are measured against.
   *
   * These are the builds in the STATIC tree. A vertical's server-rendered
   * builds — credit-risk's next, nuxt, angular-ssr and sveltekit — cannot be
   * here: this script serves `apps/docs/public`, and a build that renders per
   * request stages nothing there. Each of them shares its screens with the SPA
   * beside it in the registry's build list, so what goes unmeasured is the
   * server render, not the screens. `staticBuilds()` is what draws that line,
   * and it draws it from the same `server: true` flag `build-showcase.mjs`
   * uses to decide what to stage — so the two can never disagree.
   */
  const reference = vertical.reference;
  const builds = staticBuilds(vertical.id)
    .map((b) => b.framework)
    .filter((framework) => framework !== reference);
  const routes = SCREENS[vertical.id];

  if (verticals.length > 1) console.log(`\n======== ${vertical.id} ========`);

  for (const route of routes) {
    console.log(`\n${route}`);
    const expected = await describe(vertical.id, reference, route);
    if (expected.error) {
      console.log(`  ${reference.padEnd(8)} ERROR ${expected.error}`);
      failures.push(`${vertical.id} ${reference} ${route}: ${expected.error}`);
      continue;
    }

    /*
     * A reference render with no `md-*` element in it is not a screen, it is a
     * 404 body — and the file server answers one with the same short text for
     * every build, so reference and build would agree and the screen would
     * report `identical` having compared two error pages. That is the exact
     * silent pass this script is meant to be immune to, and the way a vertical
     * would hit it is a SCREENS entry that does not match its routes.
     */
    if (expected.fingerprint.length === 0) {
      console.log(`  ${reference.padEnd(8)} ERROR no md-* elements — is this route real?`);
      failures.push(
        `${vertical.id} ${reference} ${route}: rendered no md-* elements — ` +
          `either the screen is broken or SCREENS['${vertical.id}'] names a route this vertical does not have`,
      );
      continue;
    }

    console.log(
      `  ${reference.padEnd(8)} rows=${String(expected.rows).padStart(3)} ` +
        `pagination=${expected.pagination} text=${String(expected.text.length).padStart(5)} ` +
        `height=${expected.docHeight} gaps=[${expected.blockGaps}]  (reference)`,
    );

    for (const framework of builds) {
      const actual = await describe(vertical.id, framework, route);
      if (actual.error) {
        console.log(`  ${framework.padEnd(8)} ERROR ${actual.error}`);
        failures.push(`${vertical.id} ${framework} ${route}: ${actual.error}`);
        continue;
      }

      const problems = [];
      if (actual.text !== expected.text) problems.push('visible text differs');
      if (String(actual.fingerprint) !== String(expected.fingerprint)) {
        // Report the FIRST divergence rather than the whole sequence: the rest is
        // almost always a knock-on of it, and 200 lines of diff helps nobody.
        const at = actual.fingerprint.findIndex((entry, i) => entry !== expected.fingerprint[i]);
        problems.push(
          `element order/attributes differ at #${at}: ` +
            `${expected.fingerprint[at] ?? '(none)'} -> ${actual.fingerprint[at] ?? '(none)'}`,
        );
      }
      if (actual.docHeight !== expected.docHeight) {
        problems.push(`document height ${expected.docHeight} -> ${actual.docHeight}`);
      }
      if (String(actual.blockGaps) !== String(expected.blockGaps)) {
        problems.push(`gaps between blocks [${expected.blockGaps}] -> [${actual.blockGaps}]`);
      }
      if (String(actual.cardGaps) !== String(expected.cardGaps)) {
        problems.push(`gaps between cards [${expected.cardGaps}] -> [${actual.cardGaps}]`);
      }
      if (actual.rows !== expected.rows) problems.push(`rows ${expected.rows} -> ${actual.rows}`);
      if (actual.pagination !== expected.pagination) {
        problems.push(`pagination ${expected.pagination} -> ${actual.pagination}`);
      }
      for (const tag of [...new Set([...Object.keys(expected.census), ...Object.keys(actual.census)])].sort()) {
        const a = expected.census[tag] ?? 0;
        const b = actual.census[tag] ?? 0;
        if (a !== b) problems.push(`${tag} ${a} -> ${b}`);
      }

      console.log(
        `  ${framework.padEnd(8)} rows=${String(actual.rows).padStart(3)} ` +
          `pagination=${actual.pagination} text=${String(actual.text.length).padStart(5)} ` +
          `height=${actual.docHeight} gaps=[${actual.blockGaps}]` +
          (problems.length ? `  DIFFERS` : '  identical'),
      );
      for (const problem of problems) {
        console.log(`           ${problem}`);
        failures.push(`${vertical.id} ${framework} ${route}: ${problem}`);
      }
    }
  }

  summaries.push(
    (verticals.length > 1 ? `${vertical.id}: ` : '') +
      `${builds.length} builds × ${routes.length} screens against ${reference}`,
  );
}

await browser.close();
server.close();

console.log(
  `\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ` +
    summaries.join('; ') +
    (failures.length ? `, ${failures.length} difference(s)` : ', all identical'),
);
process.exit(failures.length ? 1 : 0);

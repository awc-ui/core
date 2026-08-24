#!/usr/bin/env node
/**
 * The six builds must be ONE application.
 *
 * That is the whole premise of the showcase: the same screens, the same
 * numbers, the same components, so a screenshot of the React build and a
 * screenshot of the Svelte build differ only where the framework differs. It is
 * also the claim most likely to rot, because every port is written in its own
 * idiom and a divergence looks like a design decision right up until someone
 * puts the two side by side.
 *
 * So this puts them side by side. React is the reference — it was first — and
 * every other build is compared against it on every screen, for:
 *
 *   - the visible text of the screen, normalised for whitespace;
 *   - an ordered fingerprint of the `md-*` elements: tag plus the attributes
 *     that decide what each one shows or does, in document order;
 *   - the census of `md-*` elements, by tag;
 *   - the number of live table rows, and whether a pagination control exists;
 *   - the LAYOUT: the height of the document, and the vertical gap between each
 *     pair of adjacent rendered blocks.
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'apps/docs/public');
const PORT = 4352;

/**
 * The reference, and the builds measured against it.
 *
 * These are the builds in the static tree. The four server-rendered ones —
 * next, nuxt, angular-ssr, sveltekit — cannot be here: this script serves
 * `apps/docs/public`, and a build that renders per request stages nothing
 * there. Each of them shares its screens with the SPA beside it in this list,
 * so what goes unmeasured is the server render, not the screens.
 */
const REFERENCE = 'react';
const BUILDS = ['vue', 'angular', 'svelte', 'html', 'astro'];

/** One screen of each kind, including the three that page, filter or switch. */
const ROUTES = [
  '/',
  '/watchlist/',
  '/stress/',
  '/sectors/energy/',
  '/counterparties/cp-01/',
  '/facilities/fac-001/',
];

if (!existsSync(join(PUBLIC, `showcase/credit-risk/${REFERENCE}/index.html`))) {
  console.error(
    '[parity] apps/docs/public/showcase is not staged — build it first:\n' +
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
async function describe(framework, route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setCacheEnabled(false);
  try {
    await page.goto(`http://localhost:${PORT}/showcase/credit-risk/${framework}${route}`, {
      waitUntil: 'networkidle0',
      timeout: 90000,
    });
    // The charts draw after the runtime lands; nothing here depends on the
    // pixels, but the elements must have finished arriving.
    await new Promise((r) => setTimeout(r, 2500));
    return await page.evaluate(() => {
      /* Every element in document order, descending into shadow roots. */
      const walkAll = (root, out = []) => {
        for (const el of root.querySelectorAll('*')) {
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
          const bits = [
            ...VALUED.filter((n) => el.hasAttribute(n)).map((n) => `${n}=${el.getAttribute(n)}`),
            ...PRESENCE.filter((n) => el.hasAttribute(n)),
          ];
          return bits.length ? `${tag}[${bits.join(',')}]` : tag;
        });

      /*
       * Visible text — LIGHT DOM only, and that is a deliberate retreat.
       *
       * Reading through shadow roots was tried and is too noisy to be useful
       * here: Astro server-renders its shadow content into declarative shadow
       * DOM while the other five have theirs built by the runtime, so the two
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

for (const route of ROUTES) {
  console.log(`\n${route}`);
  const reference = await describe(REFERENCE, route);
  if (reference.error) {
    console.log(`  ${REFERENCE.padEnd(8)} ERROR ${reference.error}`);
    failures.push(`${REFERENCE} ${route}: ${reference.error}`);
    continue;
  }
  console.log(
    `  ${REFERENCE.padEnd(8)} rows=${String(reference.rows).padStart(3)} ` +
      `pagination=${reference.pagination} text=${String(reference.text.length).padStart(5)} ` +
      `height=${reference.docHeight} gaps=[${reference.blockGaps}]  (reference)`,
  );

  for (const framework of BUILDS) {
    const actual = await describe(framework, route);
    if (actual.error) {
      console.log(`  ${framework.padEnd(8)} ERROR ${actual.error}`);
      failures.push(`${framework} ${route}: ${actual.error}`);
      continue;
    }

    const problems = [];
    if (actual.text !== reference.text) problems.push('visible text differs');
    if (String(actual.fingerprint) !== String(reference.fingerprint)) {
      // Report the FIRST divergence rather than the whole sequence: the rest is
      // almost always a knock-on of it, and 200 lines of diff helps nobody.
      const at = actual.fingerprint.findIndex((entry, i) => entry !== reference.fingerprint[i]);
      problems.push(
        `element order/attributes differ at #${at}: ` +
          `${reference.fingerprint[at] ?? '(none)'} -> ${actual.fingerprint[at] ?? '(none)'}`,
      );
    }
    if (actual.docHeight !== reference.docHeight) {
      problems.push(`document height ${reference.docHeight} -> ${actual.docHeight}`);
    }
    if (String(actual.blockGaps) !== String(reference.blockGaps)) {
      problems.push(`gaps between blocks [${reference.blockGaps}] -> [${actual.blockGaps}]`);
    }
    if (String(actual.cardGaps) !== String(reference.cardGaps)) {
      problems.push(`gaps between cards [${reference.cardGaps}] -> [${actual.cardGaps}]`);
    }
    if (actual.rows !== reference.rows) problems.push(`rows ${reference.rows} -> ${actual.rows}`);
    if (actual.pagination !== reference.pagination) {
      problems.push(`pagination ${reference.pagination} -> ${actual.pagination}`);
    }
    for (const tag of [...new Set([...Object.keys(reference.census), ...Object.keys(actual.census)])].sort()) {
      const a = reference.census[tag] ?? 0;
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
      failures.push(`${framework} ${route}: ${problem}`);
    }
  }
}

await browser.close();
server.close();

console.log(
  `\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ` +
    `${BUILDS.length} builds × ${ROUTES.length} screens against ${REFERENCE}` +
    (failures.length ? `, ${failures.length} difference(s)` : ', all identical'),
);
process.exit(failures.length ? 1 : 0);

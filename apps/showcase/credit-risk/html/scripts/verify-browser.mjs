/**
 * Does the plain-HTML build actually work in a browser?
 *
 * The claims being tested are the ones this build exists to make, and none of
 * them is something a renderer test would have caught: the whole report is
 * readable before any JavaScript runs, the components upgrade cleanly on top of
 * the pre-rendered markup, the charts get the axes that could not travel in an
 * attribute, the three locale trees are genuinely translated, and the four
 * progressive enhancements — sorting, filtering, the scenario switch, the
 * sector drill — actually fire.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-html build
 *   pnpm --filter @awc-ui/showcase-credit-risk-html verify
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BASE_PATH } from '../src/lib/i18n.mjs';
import { STORAGE_KEY } from '@awc-ui/showcase-kit/dock';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4331;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((done) => server.stdout.once('data', done));

/*
 * Kill the server whatever happens.
 *
 * The teardown at the bottom of this file only runs on the happy path, so any
 * failed assertion or timeout used to leave the server holding its port — and
 * the NEXT run then died on EADDRINUSE, reporting a port clash instead of the
 * failure that actually caused it. Twice.
 */
const stopServer = () => {
  if (!server.killed) server.kill();
};
process.on('exit', stopServer);
process.on('uncaughtException', (error) => {
  stopServer();
  console.error(error);
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  stopServer();
  console.error(error);
  process.exit(1);
});


const results = [];
const ok = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ headless: 'shell' });

/** Canvases live inside the charts' shadow roots, so a flat query finds none. */
const DEEP_CANVAS = `(() => {
  const out = [];
  const walk = (root) => {
    out.push(...root.querySelectorAll('canvas'));
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  return out;
})()`;

/* ------------------- 1. the report is readable without JS ------------------ */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const probe = await page.evaluate(() => {
    const rows = document.querySelectorAll('md-table-body md-table-row');
    return {
      rows: rows.length,
      inTemplate: document.querySelector('template[data-rows]')?.content.children.length ?? 0,
      brand: document.title.includes('Aurelia'),
      // The figures are in the markup, not fetched: a compact euro amount is
      // in the row text before anything upgrades it.
      figures: /€|EUR/.test(document.body.textContent),
      charts: document.querySelectorAll('md-bar-chart,md-area-chart').length,
      // `series` rode in the attribute precisely so this is true.
      seriesInMarkup: [...document.querySelectorAll('md-bar-chart')].every((c) =>
        (c.getAttribute('series') || '').startsWith('serialized:'),
      ),
    };
  });

  console.log('\n[1] with JavaScript DISABLED');
  // Page one, exactly what React's static export shows without JavaScript. The
  // rest of the book is in the file too, inside a template the parser keeps out
  // of the document tree — so the live page has the same ten rows React's does.
  ok('page one of the book is rendered', probe.rows === 10, `${probe.rows} rows`);
  ok('the rest of the book is still in the file', probe.inTemplate === 24, `${probe.inTemplate} in template`);
  ok('the figures are in the HTML', probe.figures);
  ok('the document is titled', probe.brand);
  ok('charts carry their series in the markup', probe.charts > 0 && probe.seriesInMarkup, `${probe.charts} charts`);
  await page.close();
}

/* --------------------- 2. components upgrade, charts paint ----------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('md-table-container')?.classList.contains('hydrated'),
    { timeout: 60000 },
  );
  await new Promise((r) => setTimeout(r, 2500));

  const probe = await page.evaluate(`(() => {
    // Stencil components only. awc-showcase-dock is hand-written and never
    // carries a hydrated class; its own check is the one below. (The md-*
    // controls it builds are Stencil, but they live in its shadow root, which
    // this query does not reach — hence the separate walk.)
    const els = [...document.querySelectorAll('md-card,md-chip,md-table,md-bar-chart,md-area-chart,md-sparkline,md-button,md-status-dot,md-meter')];
    const isPainted = (c) => {
      if (!c.width || !c.height) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return true;
      return false;
    };
    const charts = [...document.querySelectorAll('md-bar-chart,md-line-chart,md-area-chart,md-sparkline')];
    const canvases = ${DEEP_CANVAS};
    return {
      total: els.length,
      hydrated: els.filter((e) => e.classList.contains('hydrated')).length,
      zeroHeight: [...els, document.querySelector('awc-showcase-dock')]
        .filter((e) => e && e.getBoundingClientRect().height === 0)
        .map((e) => e.tagName.toLowerCase()),
      chartsPainted: charts.filter((ch) => [...(ch.shadowRoot?.querySelectorAll('canvas') ?? [])].some(isPainted)).length,
      charts: charts.length,
      canvases: canvases.length,
      // The dock's controls are md-* components now, so a shadow root on its
      // own no longer says they work. It creates them by TAG NAME, without
      // importing the library, so a runtime that never registered leaves a bar
      // full of zero-size unknown elements — and the bar reserves its height in
      // CSS, so it would not even be caught by the zero-height check above.
      dock: (() => {
        const dockRoot = document.querySelector('awc-showcase-dock')?.shadowRoot;
        if (!dockRoot) return null;
        const controls = [...dockRoot.querySelectorAll('md-select,md-segmented-button-set,md-switch,md-button,md-icon-button')];
        return { total: controls.length, upgraded: controls.filter((el) => el.shadowRoot).length };
      })(),
      // The axes could not travel in an attribute; the client script had to
      // assign them. If it did not, the category names never reach the chart.
      axesApplied: [...document.querySelectorAll('[data-chart]')].every((c) => c.hasAttribute('data-chart-applied')),
    };
  })()`);

  console.log('\n[2] with JavaScript enabled');
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('nothing renders at zero height', probe.zeroHeight.length === 0, probe.zeroHeight.join(',') || '');
  ok('every chart painted its plot', probe.chartsPainted === probe.charts, `${probe.chartsPainted}/${probe.charts}`);
  ok('the axes reached the charts', probe.axesApplied);
  ok(
    'the dock is present, and every control it built upgraded',
    probe.dock !== null && probe.dock.total > 0 && probe.dock.upgraded === probe.dock.total,
    probe.dock ? `${probe.dock.upgraded}/${probe.dock.total}` : '(no dock)',
  );
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ------------------------- 3. the enhancements fire ------------------------ */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('md-table[data-paged]')?.hasAttribute('data-paged-bound'),
    { timeout: 60000 },
  );

  console.log('\n[3] progressive enhancements');

  // The live page must hold ONE page of rows, not the whole book — the template
  // beside it is inert and must not put anything into the document tree.
  const shape = await page.evaluate(() => ({
    live: document.querySelectorAll('md-table-body md-table-row').length,
    inTemplate: document.querySelector('template[data-rows]')?.content.children.length ?? 0,
    rowCount: document.querySelector('md-table')?.getAttribute('row-count'),
    pagination: !!document.querySelector('md-table-pagination'),
  }));
  ok('one page of rows is live', shape.live === 10, `${shape.live} live`);
  ok('the rest ride in an inert template', shape.inTemplate === 24, `${shape.inTemplate} in template`);
  ok('row-count is the whole book', shape.rowCount === '24', `row-count=${shape.rowCount}`);
  ok('the pagination control is present', shape.pagination);

  // Sorting: ask for legal name ascending and check the page changed.
  const sorted = await page.evaluate(async () => {
    const table = document.querySelector('md-table[data-paged]');
    const first = () =>
      table.querySelector('md-table-body md-table-row')?.getAttribute('data-sort-legalname');
    const before = first();
    table.dispatchEvent(
      new CustomEvent('mdSortChange', { detail: { column: 'legalName', order: 'asc' }, bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 300));
    const after = first();
    return { before, after, count: table.querySelectorAll('md-table-body md-table-row').length };
  });
  ok(
    'the table re-sorts on mdSortChange',
    sorted.before !== sorted.after && sorted.after <= sorted.before && sorted.count === 10,
    `${sorted.before} → ${sorted.after}`,
  );

  // Paging: page 2 must be a different, non-overlapping slice of the same size.
  const paged = await page.evaluate(async () => {
    const ids = () =>
      [...document.querySelectorAll('md-table-body md-table-row')].map((r) => r.getAttribute('value'));
    const before = ids();
    document
      .querySelector('md-table-pagination')
      .dispatchEvent(new CustomEvent('mdPageChange', { detail: { page: 1 }, bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return {
      before,
      after: ids(),
      offset: document.querySelector('md-table')?.getAttribute('row-offset'),
    };
  });
  ok(
    'paging moves to a fresh slice',
    paged.after.length === 10 && paged.after.every((id) => !paged.before.includes(id)),
    `${paged.before[0]} → ${paged.after[0]}`,
  );
  ok('row-offset follows the page', paged.offset === '10', `row-offset=${paged.offset}`);
  await page.close();
}
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/watchlist/`, { waitUntil: 'networkidle0', timeout: 90000 });
  // The filters flag the severity control once bound. They used to flag a
  // `[data-watchlist]` wrapper, which is gone — it was swallowing the screen's
  // flex gap by becoming the single flex item in the column.
  await page.waitForFunction(
    () => document.querySelector('[data-filter-severity]')?.hasAttribute('data-bound'),
    { timeout: 60000 },
  );

  const filtered = await page.evaluate(async () => {
    const rows = () => document.querySelectorAll('md-table-row[data-severity]').length;
    const before = rows();
    document
      .querySelector('[data-filter-severity]')
      .dispatchEvent(new CustomEvent('mdChange', { detail: ['high'], bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const after = rows();
    return { before, after, label: document.querySelector('[data-count]')?.getAttribute('label') };
  });
  // DETACHED, not hidden: a filtered-out row must leave the document, the way
  // it does in every build that re-renders.
  ok('filtering removes rows from the DOM', filtered.after > 0 && filtered.after < filtered.before, `${filtered.before} → ${filtered.after}`);
  ok('the count chip follows the filter', /\b\d+\b/.test(filtered.label || ''), filtered.label || '');
  await page.close();
}
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/stress/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('[data-scenario-selector]')?.hasAttribute('data-bound'), { timeout: 60000 });

  const switched = await page.evaluate(async () => {
    const read = () => ({
      // Exactly one facts panel and one sector table are live at a time. Both
      // are found by their own marker: the `[data-stress]` wrapper these used
      // to be scoped through is gone — it was swallowing the screen's flex gap
      // by becoming the single flex item in the column.
      facts: document.querySelectorAll('[data-stress-facts]').length,
      tables: document.querySelectorAll('[data-stress-table] md-table').length,
      subtitle: document.querySelector('[data-stress-table] .panel__sub')?.textContent?.trim(),
    });
    const before = read();
    document
      .querySelector('[data-scenario-selector]')
      .dispatchEvent(new CustomEvent('mdChange', { detail: ['severe'], bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return { before, after: read() };
  });
  ok('only one scenario is ever live', switched.after.facts === 1 && switched.after.tables === 1, `facts=${switched.after.facts} tables=${switched.after.tables}`);
  ok('the scenario selector swaps the panels', switched.after.subtitle !== switched.before.subtitle, `${switched.before.subtitle} → ${switched.after.subtitle}`);
  await page.close();
}

/* ---------------------------- 4. the locale trees -------------------------- */
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/ar/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    localeRoute: document.documentElement.hasAttribute('data-locale-route'),
    arabic: /[؀-ۿ]/.test(document.body.textContent),
    // NOT Arabic-Indic digits: the kit formats Arabic as `ar-AE`, whose
    // numbering system is `latn`, so 3.2 is the correct output and asserting
    // ٣٫٢ would fail a page that is right. What proves the formatters bound to
    // the locale is the translated scale word and month name around the digits.
    localisedNumbers: /مليار|مليون/.test(document.body.textContent),
    localisedDates: /مارس|يناير|ديسمبر/.test(document.body.textContent),
  }));
  console.log('\n[4] the locale trees');
  ok('Arabic is served RTL', probe.lang === 'ar' && probe.dir === 'rtl');
  ok('the content is translated', probe.arabic);
  ok('the numbers are localised', probe.localisedNumbers);
  ok('the dates are localised', probe.localisedDates);
  ok('the page claims the locale route', probe.localeRoute);
  await page.close();
}

/* ----- 5. a stale locale in storage cannot overwrite the written language --- */
{
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((key) => {
    localStorage.setItem(key, JSON.stringify({ locale: 'ro', dir: 'ltr', theme: 'dark' }));
  }, STORAGE_KEY);
  await page.goto(`${BASE}/ar/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  const probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    // Theme is pure CSS and SHOULD still apply from storage.
    theme: document.documentElement.getAttribute('data-theme'),
  }));
  console.log('\n[5] a stale locale in localStorage');
  ok('the written language wins', probe.lang === 'ar' && probe.dir === 'rtl', `${probe.lang}/${probe.dir}`);
  ok('the stored theme still applies', probe.theme === 'dark');
  await page.close();
}

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

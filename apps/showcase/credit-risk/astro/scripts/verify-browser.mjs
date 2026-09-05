/**
 * Does the Astro build actually work in a browser?
 *
 * The claims being tested are the ones this build EXISTS to make, and they are
 * all claims a passing type-check would have said nothing about: content is
 * readable before any JavaScript runs, the components upgrade cleanly on top of
 * the server-rendered shadow roots, the three locale trees are genuinely
 * translated, a stale locale in localStorage cannot overwrite the language the
 * page is written in, and the dock's language switch navigates rather than
 * firing an event nothing is listening for.
 *
 * Every one of those was asserted in a unit test first and passed. Two of them
 * were still broken in a real browser, because the bug was in the interaction
 * between two pieces that were individually correct. Hence this file.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-astro build
 *   pnpm --filter @awc-ui/showcase-credit-risk-astro verify
 *
 * It used to require the docs preview on port 4350, which meant the check could
 * only be run as part of a two-command sequence and was quietly skipped as
 * often as not. Serving `dist/` directly checks the same bytes.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';
import { STORAGE_KEY } from '@awc-ui/showcase-kit/dock';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4346;
const BASE = `http://localhost:${PORT}${createRoutes('astro').basePath}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(PORT)], {
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


const browser = await puppeteer.launch({ headless: 'shell' });
const results = [];
const ok = (label, pass, detail = '') => {
  results.push({ label, pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

/*
 * DRIVING THE DOCK, which is no longer built from native controls.
 *
 * The bar is made of `@awc-ui/core` components now, so its language picker is
 * an `md-select`, not an `HTMLSelectElement`: assigning `.value` and firing a
 * native `change` does nothing at all. The dock hangs its state write off
 * `mdChange`, which md-select emits only from its own `selectValue()` — so the
 * picker has to be driven by opening the menu and clicking a row, which is also
 * what a reader does.
 */

/**
 * Choose `value` in a dock picker: open the menu, click the row.
 *
 * Four short steps rather than one `page.evaluate(async …)` that does the whole
 * dance in the page. The waiting has to happen on THIS side of the protocol: an
 * evaluate whose promise stays pending for seconds is liable to come back
 * "Promise was collected" instead of a result, which is a flake that looks
 * exactly like a broken dock. Every evaluate below returns synchronously.
 */
const pickInDock = async (page, id, value) => {
  // Collapsed on a first visit. The panel keeps its controls in the DOM while
  // hidden, so this asks the disclosure — an md-icon-button now, not the
  // `querySelector('button')` that used to find it — rather than inferring from
  // a missing element, and it drives a control a reader could have clicked.
  const present = await page.evaluate(() => {
    const root = document.querySelector('awc-showcase-dock')?.shadowRoot;
    if (!root) return false;
    if (root.getElementById('awc-dock-panel')?.hidden) {
      root.querySelector('md-icon-button.toggle')?.click();
    }
    return true;
  });
  if (!present) return false;
  await new Promise((r) => setTimeout(r, 250));

  const opened = await page.evaluate((pickerId) => {
    const select = document.querySelector('awc-showcase-dock')?.shadowRoot?.getElementById(pickerId);
    if (!select?.shadowRoot) return false;
    void select.show();
    return true;
  }, id);
  if (!opened) return false;

  // A closed md-menu stays in the DOM but `inert`, and Stencil clears that on
  // its own schedule — so wait for the menu to actually be open rather than for
  // a fixed number of milliseconds.
  await page
    .waitForFunction(
      (pickerId) =>
        document
          .querySelector('awc-showcase-dock')
          ?.shadowRoot?.getElementById(pickerId)
          ?.shadowRoot?.querySelector('md-menu')?.inert === false,
      { timeout: 5000 },
      id,
    )
    .catch(() => {});

  return page.evaluate(
    (pickerId, wanted) => {
      const select = document.querySelector('awc-showcase-dock')?.shadowRoot?.getElementById(pickerId);
      const row = [...(select?.shadowRoot?.querySelectorAll('md-menu-item') ?? [])].find((item) =>
        item.id.endsWith('-opt-' + wanted),
      );
      if (!row) return false;
      row.click();
      return true;
    },
    id,
    value,
  );
};

/* ---------------- 1. content without JavaScript ---------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const probe = await page.evaluate(() => {
    const deepCanvases = () => {
      const out = [];
      const walk = (root) => {
        out.push(...root.querySelectorAll('canvas'));
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(document);
      return out;
    };
    const table = document.querySelector('md-table-container');
    const text = document.body.innerText;
    return {
      // Shadow roots attached by the PARSER, not by any script.
      shadowRoots: [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).length,
      tableHasRows: !!table?.querySelectorAll('md-table-row').length,
      rowCount: table?.querySelectorAll('md-table-body md-table-row').length ?? 0,
      hasBrand: text.includes('Aurelia'),
      hasKpi: /Expected loss/i.test(text),
      // A chart's canvas is present but unpainted — the honest limit.
      // It lives INSIDE the chart's shadow root, so a flat querySelectorAll
      // finds nothing and would report a false failure. (It did, first time.)
      canvases: deepCanvases().length,
      chartHeading: !!document.querySelector('md-bar-chart'),
    };
  });

  console.log('\n[1] with JavaScript DISABLED');
  ok('shadow roots came from the parser', probe.shadowRoots > 100, `${probe.shadowRoots} roots`);
  ok('the counterparty table has its rows', probe.tableHasRows, `${probe.rowCount} rows`);
  ok('headline content is readable', probe.hasBrand && probe.hasKpi);
  ok('charts are present but unpainted (documented limit)', probe.chartHeading && probe.canvases > 0, `${probe.canvases} canvases`);
  await page.close();
}

/* ---------------- 2. components upgrade with JS ---------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('md-table-container')?.classList.contains('hydrated'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const probe = await page.evaluate(() => {
    const deepCanvases = () => {
      const out = [];
      const walk = (root) => {
        out.push(...root.querySelectorAll('canvas'));
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(document);
      return out;
    };
    const els = [...document.querySelectorAll('md-card,md-chip,md-table,md-bar-chart,md-area-chart,md-sparkline,md-button,md-status-dot')];
    const painted = deepCanvases().map((c) => {
      const ctx = c.getContext('2d');
      if (!c.width || !c.height) return false;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return true;
      return false;
    });
    // Per CHART, not per canvas: the invariant that matters is that every
    // chart element ends up with a painted plot. Counting canvases instead
    // conflates that with the duplicate-canvas bug below.
    const charts = [...document.querySelectorAll('md-bar-chart,md-line-chart,md-area-chart,md-sparkline')];
    const isPainted = (c) => {
      if (!c.width || !c.height) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return true;
      return false;
    };
    const perChart = charts.map((ch) => {
      const cs = [...(ch.shadowRoot?.querySelectorAll('canvas') ?? [])];
      return { total: cs.length, painted: cs.filter(isPainted).length };
    });

    return {
      total: els.length,
      hydrated: els.filter((e) => e.classList.contains('hydrated')).length,
      zeroHeight: els.filter((e) => e.getBoundingClientRect().height === 0).length,
      canvases: painted.length,
      paintedCanvases: painted.filter(Boolean).length,
      chartCount: charts.length,
      chartsWithAPaintedPlot: perChart.filter((c) => c.painted >= 1).length,
      chartsWithSurplusCanvases: perChart.filter((c) => c.total > 1).length,
      // The dock's controls are md-* components now, so "did it build them?"
      // can no longer be answered by looking for a `<select>`. Counting them
      // against the ones that upgraded is the stronger question anyway: the
      // dock creates its controls by TAG NAME, without importing the library,
      // so an unregistered runtime leaves a bar full of zero-size unknown
      // elements that a bare presence check would happily accept.
      dock: (() => {
        const root = document.querySelector('awc-showcase-dock')?.shadowRoot;
        if (!root) return null;
        const controls = [...root.querySelectorAll('md-select,md-segmented-button-set,md-switch,md-button,md-icon-button')];
        return { total: controls.length, upgraded: controls.filter((el) => el.shadowRoot).length };
      })(),
    };
  });

  console.log('\n[2] with JavaScript ENABLED');
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('none collapsed to zero height', probe.zeroHeight === 0, `${probe.zeroHeight} collapsed`);
  ok(
    'every chart painted its plot once the runtime landed',
    probe.chartCount > 0 && probe.chartsWithAPaintedPlot === probe.chartCount,
    `${probe.chartsWithAPaintedPlot}/${probe.chartCount} charts`,
  );
  /*
   * KNOWN CORE BUG, reported — not worked around here.
   *
   * Hydrating over declarative shadow DOM leaves the server-rendered canvas in
   * place and appends a second one, so every chart carries a blank 300x150
   * canvas under its real plot. Client-only builds render exactly one, so it is
   * specific to the DSD path.
   *
   * It is currently invisible: the stale node is transparent and comes first in
   * tree order, so the real canvas paints over it. That is luck, not design —
   * anything that reorders those children turns it into a chart hidden behind a
   * blank layer. This check therefore REPORTS the duplicate rather than
   * asserting it away, so the day it is fixed the message changes and the day it
   * gets worse we hear about it.
   */
  ok(
    'no surplus canvases (expected to fail until the DSD hydration bug is fixed)',
    probe.chartsWithSurplusCanvases === 0,
    `${probe.chartsWithSurplusCanvases}/${probe.chartCount} charts carry a stale server-rendered canvas`,
  );
  ok(
    'the dock built its controls, and every one of them upgraded',
    probe.dock !== null && probe.dock.total > 0 && probe.dock.upgraded === probe.dock.total,
    probe.dock ? `${probe.dock.upgraded}/${probe.dock.total}` : '(no dock)',
  );
  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ---------------- 3. the locale trees ---------------- */
{
  for (const [path, lang, dir, needle] of [
    ['/', 'en', 'ltr', 'Expected loss'],
    ['/ro/', 'ro', 'ltr', 'Pierdere'],
    ['/ar/', 'ar', 'rtl', null],
  ]) {
    const page = await browser.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const probe = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      localeRoute: document.documentElement.hasAttribute('data-locale-route'),
      text: document.body.innerText.slice(0, 4000),
      alternates: [...document.querySelectorAll('link[rel=alternate]')].map((l) => l.hreflang),
    }));
    console.log(`\n[3] ${path}`);
    ok('lang and dir are server-rendered', probe.lang === lang && probe.dir === dir, `${probe.lang}/${probe.dir}`);
    ok('marked as locale-routed for the preboot script', probe.localeRoute);
    if (needle) ok('content is in that language', probe.text.includes(needle));
    ok('hreflang alternates present', probe.alternates.length >= 3, probe.alternates.join(','));
    await page.close();
  }
}

/* ---------------- 4. preboot must not fight the route ---------------- */
{
  const page = await browser.newPage();
  // Arrive at the English page carrying a stale Romanian preference.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ locale: 'ro', theme: 'dark', density: -2 })), STORAGE_KEY);
  await page.goto(`${BASE}/watchlist/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    theme: document.documentElement.getAttribute('data-theme'),
    density: document.documentElement.getAttribute('data-density'),
  }));
  console.log('\n[4] stale locale in localStorage, on an English URL');
  ok('lang stays with the ROUTE, not the stored preference', probe.lang === 'en', probe.lang);
  ok('theme and density still applied', probe.theme === 'dark' && probe.density === '-2', `${probe.theme}/${probe.density}`);
  await page.close();
}

/* ---------------- 5. the dock's language switch navigates ---------------- */
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/watchlist/`, { waitUntil: 'networkidle0', timeout: 90000 });
  // Waiting for the picker to be UPGRADED, not merely present: an
  // `<md-select>` the runtime has not reached yet is in the DOM from the
  // moment the dock renders, and has no menu to open.
  await page.waitForFunction(() => document.querySelector('awc-showcase-dock')?.shadowRoot?.querySelector('#awc-dock-locale')?.shadowRoot, { timeout: 30000 });

  const drove = await pickInDock(page, 'awc-dock-locale', 'ro');
  await page.waitForFunction(() => location.pathname.includes('/ro/'), { timeout: 15000 }).catch(() => {});
  const after = page.url();

  console.log('\n[5] dock language switch');
  ok('the dock offers a reachable Romanian row', drove);
  ok('navigates into the locale tree', after.includes('/astro/ro/watchlist'), after.replace('http://localhost:4350', ''));
  const lang = await page.evaluate(() => document.documentElement.lang);
  ok('and lands on a page in that language', lang === 'ro', lang);
  await page.close();
}

/* ---------------- 6. drill paths keep the locale ---------------- */
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/ro/`, { waitUntil: 'networkidle0', timeout: 90000 });
  const firstDrill = await page.evaluate(() => {
    const a = document.querySelector('md-table-body a.drill');
    return a ? a.getAttribute('href') : null;
  });
  console.log('\n[6] drilling in Romanian');
  ok('a drill link carries the locale segment', !!firstDrill?.includes('/astro/ro/'), firstDrill ?? 'no link found');
  await page.close();
}

await browser.close();
server.kill();

const KNOWN = ['no surplus canvases'];
const failed = results.filter((r) => !r.pass);
const known = failed.filter((r) => KNOWN.some((k) => r.label.startsWith(k)));
const real = failed.filter((r) => !known.includes(r));

console.log(
  `\n${real.length === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed.length}/${results.length}` +
    (known.length ? `  (+${known.length} known core bug, reported upstream)` : ''),
);
for (const r of real) console.log(`  FAILED: ${r.label}  ${r.detail}`);
process.exit(real.length ? 1 : 0);

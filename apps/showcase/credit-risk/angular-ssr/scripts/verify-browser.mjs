/**
 * Does the Angular build actually work in a browser?
 *
 * None of these claims survives a type-check alone: the document the server
 * sends arrives with its components already painted — declarative shadow roots
 * and real rows and real numbers, with JavaScript off — the components then
 * upgrade and the charts paint, the dock's language switch re-renders every
 * string IN PLACE with no navigation, the tables sort and page through the
 * selector that owns the data, and client routing keeps the page rather than
 * reloading the document.
 *
 * The complementary check is `scripts/verify-ssr.mjs` at the repo root, which
 * asks the other question — whether the markup arrived without a browser, and
 * whether it was built for THIS request. This file needs a browser and cannot
 * answer either; that one runs no JavaScript and cannot answer these.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr build
 *   pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr verify
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath: BASE_PATH } = createRoutes('angular-ssr');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4343;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
// Resolve on the server's startup line, but not ONLY on that: if it exits
// instead — an unbuilt `dist/`, a port already taken — waiting for stdout that
// will never arrive hangs the run with no explanation.
await new Promise((done, fail) => {
  server.stdout.once('data', done);
  server.once('exit', (code) => fail(new Error(`server exited with code ${code} before starting`)));
});

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
const settled = () => new Promise((r) => setTimeout(r, 2500));

/* ---------------- 1. the server's own HTML, with no JavaScript -------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  /*
   * `shadowRoot` is the point of this section, and it is readable with page
   * scripting off because declarative shadow DOM is a PARSER feature: Chrome
   * turns `<template shadowrootmode="open">` into a real shadow root while it
   * reads the bytes, with no script involved. So a component whose shadow root
   * has children here was painted by `src/server.ts`, not by the runtime —
   * which cannot have run.
   *
   * Charts are excluded on purpose and not as an oversight: a chart's plot is a
   * `<canvas>`, and a canvas cannot be painted without a canvas context. What
   * arrives for a chart is its frame — heading, legend, accessible name — and
   * that is correct behaviour, not a gap to assert around.
   */
  const probe = await page.evaluate(() => {
    const els = [...document.querySelectorAll('md-card,md-chip,md-table,md-button,md-meter')];
    return {
      total: els.length,
      shadowed: els.filter((e) => e.shadowRoot && e.shadowRoot.childNodes.length > 0).length,
      rows: document.querySelectorAll('md-table-body md-table-row').length,
      figures: /€|EUR/.test(document.body.textContent),
      named: document.body.textContent.includes('Aurelia'),
      preboot: !!document.querySelector('[data-awc-preboot]'),
      mode: document.querySelector('meta[name="awc-render-mode"]')?.content,
    };
  });

  console.log('\n[1] the document the server sent, with JavaScript disabled');
  ok('the counterparty page is in the HTML', probe.rows === 10, `${probe.rows} rows (page 1 of 24)`);
  ok('the figures are in the HTML', probe.figures);
  ok('the headline content is there', probe.named);
  ok(
    'every component arrived with its shadow root',
    probe.total > 0 && probe.shadowed === probe.total,
    `${probe.shadowed}/${probe.total}`,
  );
  ok('the preboot script is in the head the server sent', probe.preboot);
  ok('the render mode says ssr', probe.mode === 'ssr', String(probe.mode));
  await page.close();
}

/* ------------------- 2. components upgrade, charts paint ------------------- */
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
  await settled();

  const probe = await page.evaluate(`(() => {
    const els = [...document.querySelectorAll('md-card,md-chip,md-table,md-bar-chart,md-area-chart,md-sparkline,md-button,md-status-dot,md-meter')];
    const isPainted = (c) => {
      if (!c.width || !c.height) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) return true;
      return false;
    };
    const charts = [...document.querySelectorAll('md-bar-chart,md-line-chart,md-area-chart,md-sparkline')];
    return {
      total: els.length,
      hydrated: els.filter((e) => e.classList.contains('hydrated')).length,
      zeroHeight: [...els, document.querySelector('awc-showcase-dock')]
        .filter((e) => e && e.getBoundingClientRect().height === 0)
        .map((e) => e.tagName.toLowerCase()),
      charts: charts.length,
      painted: charts.filter((ch) => [...(ch.shadowRoot?.querySelectorAll('canvas') ?? [])].some(isPainted)).length,
      dock: !!document.querySelector('awc-showcase-dock')?.shadowRoot,
    };
  })()`);

  console.log('\n[2] with JavaScript enabled');
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('nothing renders at zero height', probe.zeroHeight.length === 0, probe.zeroHeight.join(','));
  ok('every chart painted its plot', probe.painted === probe.charts, `${probe.painted}/${probe.charts}`);
  ok('the dock is present', probe.dock);
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* -------------- 3. the language changes in place, without a load ----------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled();

  const before = await page.evaluate(() => document.body.innerText.slice(0, 400));

  // Mark the document. If switching language reloaded it the mark is gone —
  // which is exactly the difference between this build and the two
  // server-rendered ones, so it is worth asserting rather than assuming.
  await page.evaluate(() => {
    window.__stillHere = true;
  });

  // Drive the dock's own locale picker, the same control a human uses. It sits
  // inside the dock's shadow root, behind the collapse toggle on a first visit.
  const drove = await page.evaluate(() => {
    const dock = document.querySelector('awc-showcase-dock');
    const root = dock?.shadowRoot;
    if (!root) return false;
    let select = root.querySelector('#awc-dock-locale');
    if (!select) {
      root.querySelector('button')?.click();
      select = root.querySelector('#awc-dock-locale');
    }
    if (!select) return false;
    select.value = 'ro';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  await settled();

  const after = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 400),
    lang: document.documentElement.lang,
    sameDocument: window.__stillHere === true,
  }));

  console.log('\n[3] switching language from the dock');
  ok('the dock exposes a locale picker', drove);
  ok('the document was not reloaded', after.sameDocument);
  ok('<html lang> follows', after.lang === 'ro', after.lang);
  ok('every string re-rendered in place', after.text !== before);
  await page.close();
}

/* ------------------ 4. sorting, paging and client routing ------------------ */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled();

  /*
   * Row identity is read as a PROPERTY, with the attribute only as a fallback.
   *
   * This build binds `value` as an ATTRIBUTE — that is the rule the whole
   * server render depends on, and `components/element.md` explains why — so the
   * attribute is the honest thing to read here. The property fallback is kept
   * anyway so this check reads the same as its twins in the other builds and
   * cannot silently start passing on `undefined`.
   */
  const READ_IDS = `[...document.querySelectorAll('md-table-body md-table-row')].map((row) => row.value ?? row.getAttribute('value'))`;

  const sorted = await page.evaluate(`(async () => {
    const before = ${READ_IDS};
    document.querySelector('md-table').dispatchEvent(
      new CustomEvent('mdSortChange', { detail: { column: 'legalName', order: 'asc' }, bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: ${READ_IDS} };
  })()`);

  const paged = await page.evaluate(`(async () => {
    const before = ${READ_IDS};
    document.querySelector('md-table-pagination').dispatchEvent(
      new CustomEvent('mdPageChange', { detail: { page: 1 }, bubbles: true }),
    );
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: ${READ_IDS} };
  })()`);

  console.log('\n[4] the table');
  ok(
    'sorting re-reads the selector',
    sorted.after.length === 10 && sorted.after.join() !== sorted.before.join() && sorted.after.every(Boolean),
    `${sorted.before[0]} → ${sorted.after[0]}`,
  );
  ok(
    'paging moves the slice',
    paged.after.length === 10 &&
      paged.after.every(Boolean) &&
      paged.after.every((id) => !paged.before.includes(id)),
    `${paged.before[0]} → ${paged.after[0]}`,
  );

  const routed = await page.evaluate(async () => {
    window.__stillHere = true;
    document.querySelector('a.drill').click();
    await new Promise((r) => setTimeout(r, 900));
    return { path: location.pathname, sameDocument: window.__stillHere === true };
  });
  ok(
    'a drill link routes in place',
    routed.sameDocument && routed.path !== `${BASE_PATH}/`,
    routed.path,
  );
  await page.close();
}

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

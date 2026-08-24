/**
 * Does the SvelteKit build actually work in a browser?
 *
 * `scripts/verify-ssr.mjs` at the repo root asks the two questions that decide
 * whether this build deserves to be called server-rendered: is the markup there
 * without a browser, and was it made for this request. This file asks
 * everything else, and none of it survives a type-check alone: the response
 * carries shadow roots and real numbers with JavaScript disabled, every
 * component then upgrades and every chart paints, the dock's language switch
 * re-renders every string IN PLACE with no navigation, the tables sort and page
 * through the selector that owns the data, and client routing keeps the page
 * rather than reloading the document.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-sveltekit build
 *   pnpm --filter @awc-ui/showcase-credit-risk-sveltekit verify
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath: BASE_PATH } = createRoutes('sveltekit');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4341;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

// The real server, on a port of its own so a concurrent `verify:ssr` (4612) is
// not disturbed.
const server = spawn(process.execPath, [join(appRoot, 'server.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, PORT: String(PORT) },
});
await new Promise((done, fail) => {
  server.stdout.once('data', done);
  // Without this, a server that refuses to start — no build, port taken — hangs
  // the run on a stdout line that will never arrive.
  server.once('exit', (code) => fail(new Error(`server exited with code ${code} before listening`)));
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

/* ------------- 0. the response itself, fetched without a browser ----------- */
{
  const first = await fetch(`${BASE}/`).then((r) => r.text());
  // A second apart, so a per-request timestamp is unambiguously different
  // rather than differing only in sub-millisecond noise.
  await new Promise((r) => setTimeout(r, 1100));
  const second = await fetch(`${BASE}/`).then((r) => r.text());

  const templates = (first.match(/shadowrootmode/g) ?? []).length;
  const stamp = (html) => html.match(/<meta[^>]+name="awc-rendered-at"[^>]+content="([^"]+)"/i)?.[1];
  const mode = first.match(/<meta[^>]+name="awc-render-mode"[^>]+content="([^"]+)"/i)?.[1];

  console.log('\n[0] the response, fetched with no browser and no JavaScript');
  ok('the shadow roots are already in the HTML', templates > 0, `${templates} templates`);
  ok('it says how it was rendered', mode === 'ssr', String(mode));
  ok(
    'two requests are two renders',
    Boolean(stamp(first)) && stamp(first) !== stamp(second),
    `${stamp(first)} then ${stamp(second)}`,
  );
}

const browser = await puppeteer.launch({ headless: 'shell' });
const settled = () => new Promise((r) => setTimeout(r, 2500));

/* --------------- 1. the server render carries real content ----------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const probe = await page.evaluate(() => {
    const els = [...document.querySelectorAll('md-card,md-table,md-chip,md-button')];
    return {
      rows: document.querySelectorAll('md-table-body md-table-row').length,
      figures: /€|EUR/.test(document.body.textContent),
      named: document.body.textContent.includes('Aurelia'),
      total: els.length,
      // The browser attaches a declarative shadow root while PARSING, so this
      // is true with scripting disabled. It is the difference between markup
      // that merely mentions the components and markup that contains them.
      shadowed: els.filter((el) => !!el.shadowRoot).length,
    };
  });
  console.log('\n[1] the server-rendered HTML, with JavaScript disabled');
  ok('the counterparty page is in the HTML', probe.rows === 10, `${probe.rows} rows (page 1 of 24)`);
  ok('the figures are in the HTML', probe.figures);
  ok('the headline content is there', probe.named);
  ok(
    'every component already has its shadow root',
    probe.total > 0 && probe.shadowed === probe.total,
    `${probe.shadowed}/${probe.total}`,
  );
  await page.close();
}

/* ------- 2. the runtime takes the components over, the charts paint -------- */
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
   * Svelte sets data on an upgraded custom element through its property when
   * one exists — so a row that arrived from the server carries
   * `value="cp-01"` in the markup, while a row created on the client after a
   * sort or a page change carries only the property. Both reach the component
   * identically. An attribute-only assertion cannot tell them apart: it reports
   * a perfectly working table as `cp-21 → null`, which looks like a pass and
   * proves nothing.
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

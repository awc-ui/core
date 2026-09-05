/**
 * Does the plain-HTML build actually work in a browser?
 *
 * The claims being tested are the ones this build exists to make, and none of
 * them is something a renderer test would have caught: the whole app is
 * readable before any JavaScript runs, the components upgrade cleanly on top of
 * the pre-rendered markup, the shell chrome is complete on every page, the
 * three locale trees are genuinely translated, and a stale locale in storage
 * loses to the language the page is written in.
 *
 * AND THEN THE FOUR INTERACTIVE SCREENS, which is the half the other checks
 * cannot reach. `verify-showcase-parity.mjs` compares this build against React
 * on the DEFAULT state of every screen, so a client module that was written and
 * never imported would pass it — that exact failure shipped once in the wealth
 * build and was found by hand. Sections 5 to 8 press the controls and read what
 * changed.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-banking-html build
 *   pnpm --filter @awc-ui/showcase-banking-html verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BASE_PATH } from '../src/lib/i18n.mjs';
import { STORAGE_KEY } from '@awc-ui/showcase-kit/dock';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4343;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((done) => server.stdout.once('data', done));

/*
 * Kill the server whatever happens.
 *
 * The teardown at the bottom of this file only runs on the happy path, so any
 * failed assertion or timeout would otherwise leave the server holding its
 * port — and the NEXT run then dies on EADDRINUSE, reporting a port clash
 * instead of the failure that actually caused it.
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

/* --------------------------------------------------------------- utilities */

/**
 * Let the runtime finish what a press started.
 *
 * Every enhancement here is synchronous, but the components it touches are
 * lazy: a chip's `mdSelect` is dispatched from inside its own render, and the
 * swapped-in detail has to upgrade before its shadow parts can be read.
 */
const settled = (page) => page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

/** Press a component the way a reader does, then wait for the consequence. */
async function click(page, selector) {
  await page.evaluate((s) => document.querySelector(s)?.click(), selector);
  await settled(page);
}

/**
 * Raise the event a component would raise.
 *
 * `md-number-field` and `md-switch` report through custom events whose detail
 * this build reads; driving them by keystroke would be testing the components,
 * which have their own suite. What is under test here is the ENHANCEMENT's
 * response to the shape the component actually emits — which is exactly the
 * thing that has been got wrong before, by assuming one component's detail
 * shape from another's.
 */
async function emit(page, selector, type, detail) {
  await page.evaluate(
    (s, t, d) => {
      document.querySelector(s)?.dispatchEvent(new CustomEvent(t, { detail: d, bubbles: true }));
    },
    selector,
    type,
    detail,
  );
  await settled(page);
}

const browser = await puppeteer.launch({ headless: 'shell' });

/* ------------------- 1. the console is readable without JS ----------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const probe = await page.evaluate(() => ({
    brand: document.title.includes('Vela'),
    appBar: !!document.querySelector('md-app-bar.shell__appbar'),
    railTabs: document.querySelectorAll('md-navigation-rail-tab').length,
    barTabs: document.querySelectorAll('md-navigation-bar md-navigation-tab').length,
    heading: (document.querySelector('.screen-head h1')?.textContent ?? '').trim().length > 0,
    // Every destination href is absolute and carries the mount prefix; a bare
    // path would resolve against the wrong base three directories down.
    hrefsPrefixed: [...document.querySelectorAll('md-navigation-rail-tab')].every((tab) =>
      (tab.getAttribute('href') || '').startsWith('/showcase/banking/html/'),
    ),
    dock: !!document.querySelector('awc-showcase-dock[locale-route="en"]'),
    dockLabelled: !!document.querySelector('awc-showcase-dock[label]'),
  }));

  console.log('\n[1] with JavaScript DISABLED');
  ok('the document is titled', probe.brand);
  ok('the app bar is in the markup', probe.appBar);
  ok('the rail carries the five destinations', probe.railTabs === 5, `${probe.railTabs} tabs`);
  ok('the compact bar carries the same five', probe.barTabs === 5, `${probe.barTabs} tabs`);
  ok('the screen heading is rendered', probe.heading);
  ok('every rail href carries the mount prefix', probe.hrefsPrefixed);
  ok('the dock is in the markup, locale-routed and labelled', probe.dock && probe.dockLabelled);
  await page.close();
}

/* --------------------- 2. components upgrade cleanly ----------------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('md-navigation-rail')?.classList.contains('hydrated'),
    { timeout: 60000 },
  );
  await new Promise((r) => setTimeout(r, 2000));

  const probe = await page.evaluate(() => {
    // Stencil components only. awc-showcase-dock is hand-written and never
    // carries a hydrated class; its own check is the one below.
    const els = [
      ...document.querySelectorAll(
        'md-app-bar,md-navigation-rail,md-navigation-rail-tab,md-navigation-bar,md-fab,md-chip,md-avatar,md-tooltip,md-breadcrumbs',
      ),
    ];
    return {
      total: els.length,
      hydrated: els.filter((e) => e.classList.contains('hydrated')).length,
      zeroHeight: [
        document.querySelector('md-app-bar'),
        document.querySelector('md-navigation-rail'),
        document.querySelector('awc-showcase-dock'),
      ]
        .filter((e) => e && e.getBoundingClientRect().height === 0)
        .map((e) => e.tagName.toLowerCase()),
      // The dock's controls are md-* components created by TAG NAME, without
      // importing the library — a runtime that never registered leaves a bar
      // full of zero-size unknown elements behind a height the CSS reserves.
      dock: (() => {
        const dockRoot = document.querySelector('awc-showcase-dock')?.shadowRoot;
        if (!dockRoot) return null;
        const controls = [
          ...dockRoot.querySelectorAll('md-select,md-segmented-button-set,md-switch,md-button,md-icon-button'),
        ];
        return { total: controls.length, upgraded: controls.filter((el) => el.shadowRoot).length };
      })(),
      railVariant: document.querySelector('md-navigation-rail')?.getAttribute('variant'),
    };
  });

  console.log('\n[2] with JavaScript enabled');
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('nothing renders at zero height', probe.zeroHeight.length === 0, probe.zeroHeight.join(',') || '');
  ok(
    'the dock is present, and every control it built upgraded',
    probe.dock !== null && probe.dock.total > 0 && probe.dock.upgraded === probe.dock.total,
    probe.dock ? `${probe.dock.upgraded}/${probe.dock.total}` : '(no dock)',
  );
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // The rail toggle is the one shell behaviour the client script adds.
  const toggled = await page.evaluate(async () => {
    document
      .querySelector('.shell__appbar')
      ?.dispatchEvent(new CustomEvent('mdLeadingClick', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    return document.querySelector('md-navigation-rail')?.getAttribute('variant');
  });
  ok(
    'the app bar toggle expands the rail',
    probe.railVariant === 'standard' && toggled === 'expanded',
    `${probe.railVariant} → ${toggled}`,
  );
  await page.close();
}

/* ---------------------------- 3. the locale trees -------------------------- */
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/ar/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    localeRoute: document.documentElement.hasAttribute('data-locale-route'),
    arabic: /[؀-ۿ]/.test(document.body.textContent),
    // In-locale drilling: every rail href stays inside the /ar/ tree.
    hrefsInLocale: [...document.querySelectorAll('md-navigation-rail-tab')].every((tab) =>
      (tab.getAttribute('href') || '').startsWith('/showcase/banking/html/ar/'),
    ),
    alternates: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
  }));
  console.log('\n[3] the locale trees');
  ok('Arabic is served RTL', probe.lang === 'ar' && probe.dir === 'rtl');
  ok('the content is translated', probe.arabic);
  ok('navigation stays inside the locale', probe.hrefsInLocale);
  ok('the page claims the locale route', probe.localeRoute);
  ok('hreflang alternates are present', probe.alternates === 4, `${probe.alternates} links`);
  await page.close();
}
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/ro/transactions/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    heading: (document.querySelector('.screen-head h1')?.textContent ?? '').trim(),
  }));
  ok('the Romanian tree serves deep routes', probe.lang === 'ro' && probe.heading.length > 0, probe.heading);
  await page.close();
}

/* ----- 4. a stale locale in storage cannot overwrite the written language --- */
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
  console.log('\n[4] a stale locale in localStorage');
  ok('the written language wins', probe.lang === 'ar' && probe.dir === 'rtl', `${probe.lang}/${probe.dir}`);
  ok('the stored theme still applies', probe.theme === 'dark');
  await page.close();
}

/* -------------------------- 5. the statement's filters --------------------- */
/*
 * The month is a CHOICE and the other three are FILTERS, and the difference is
 * structural in this build: the month swaps a whole template of day-groups in,
 * while a facet asks the kit which rows survive and the client moves those.
 *
 * The day net is the assertion that matters. A client that filtered rows by
 * itself would leave every heading stating the unfiltered day's total, and
 * nothing else on the page would look wrong.
 */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/transactions/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled(page);

  const read = () =>
    page.evaluate(() => ({
      rows: document.querySelectorAll('[data-groups] md-list-item').length,
      days: document.querySelectorAll('[data-groups] [data-day]').length,
      count: document.querySelector('[data-count]')?.textContent?.trim(),
      aside: document.querySelector('[data-result-count]')?.getAttribute('label'),
      reset: !!document.querySelector('.facet-foot md-button'),
      net: document.querySelector('[data-day-net]')?.textContent?.trim(),
    }));

  const before = await read();
  console.log('\n[5] the statement');
  ok('it arrives as a month of day-groups', before.rows > 0 && before.days > 0,
    `${before.rows} rows in ${before.days} days`);
  ok('with no reset control, there being nothing to reset', !before.reset);

  await click(page, '[data-facet="category"] md-chip');
  const filtered = await read();
  ok('a category chip narrows it', filtered.rows > 0 && filtered.rows < before.rows,
    `${before.rows} -> ${filtered.rows}`);
  ok('the panel count follows', filtered.count !== before.count,
    `${before.count} -> ${filtered.count}`);
  ok('the heading chip follows', filtered.aside !== before.aside,
    `${before.aside} -> ${filtered.aside}`);
  ok('the reset appears', filtered.reset);
  ok("the day's net is re-derived, not left stale", filtered.net !== before.net,
    `${before.net} -> ${filtered.net}`);

  await click(page, '.facet-foot md-button');
  const reset = await read();
  ok('the reset restores every row', reset.rows === before.rows, `${reset.rows} rows`);
  ok('and the net with them', reset.net === before.net, reset.net ?? '');
  ok('and takes itself away again', !reset.reset);

  await click(page, '[data-month="all"]');
  const all = await read();
  ok('the "all" period swaps in every month', all.rows > before.rows, `${all.rows} rows`);
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ---------------------------- 6. the exchange ticket ----------------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/exchange/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled(page);

  const before = await page.evaluate(() => ({
    net: document.querySelector('[data-quote-net]')?.textContent?.trim(),
    rate: document.querySelector('[data-quote-rate]')?.textContent?.trim(),
    pair: document.querySelector('[data-history-panel] .panel__sub')?.textContent?.trim(),
  }));
  console.log('\n[6] the exchange ticket');
  ok('it arrives priced, not empty', /\d/.test(before.net ?? ''), before.net ?? '');

  await emit(page, '[data-amount]', 'mdChange', { value: 1000 });
  const repriced = await page.evaluate(() =>
    document.querySelector('[data-quote-net]')?.textContent?.trim());
  ok('a new amount re-prices it', repriced !== before.net, `${before.net} -> ${repriced}`);

  await click(page, '[data-swap]');
  const swapped = await page.evaluate(() => ({
    from: document.querySelector('[data-from]')?.value,
    to: document.querySelector('[data-to]')?.value,
    rate: document.querySelector('[data-quote-rate]')?.textContent?.trim(),
    pair: document.querySelector('[data-history-panel] .panel__sub')?.textContent?.trim(),
    send: [...document.querySelectorAll('[data-from] md-select-option')].map((o) => o.getAttribute('value')),
    receive: [...document.querySelectorAll('[data-to] md-select-option')].map((o) => o.getAttribute('value')),
  }));
  ok('the swap turns the pair around', swapped.from === 'GBP' && swapped.to === 'EUR',
    `${swapped.from} -> ${swapped.to}`);
  ok('the rate line follows it', swapped.rate !== before.rate, swapped.rate ?? '');
  ok('and neither list offers the other side',
    !swapped.send.includes('EUR') && !swapped.receive.includes('GBP'),
    `send=[${swapped.send}] receive=[${swapped.receive}]`);

  await emit(page, '[data-amount]', 'mdInput', { value: null });
  const empty = await page.evaluate(() => ({
    breakdown: !!document.querySelector('[data-quote]'),
    off: document.querySelector('[data-confirm]')?.hasAttribute('soft-disabled'),
    /* THE PROPERTY, not the attribute: `md-tooltip.text` is declared without
       `reflect`, so setting it writes no attribute and the build omits the
       empty one it ships with. The attribute stays as the fallback for a
       tooltip that has not upgraded. */
    reason: (() => {
      const el = document.querySelector('[data-confirm-tooltip]');
      return el?.text ?? el?.getAttribute('text') ?? '';
    })(),
  }));
  ok('an empty amount takes the breakdown away', !empty.breakdown);
  ok('and gates Confirm with a stated reason', empty.off && empty.reason.length > 0, empty.reason);
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ----------------------------- 7. the trade ticket ------------------------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/invest/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled(page);

  const before = await page.evaluate(() =>
    document.querySelector('[data-estimate-total]')?.textContent?.trim());
  console.log('\n[7] the trade ticket');
  ok('the estimate arrives priced', /\d/.test(before ?? ''), before ?? '');

  await emit(page, '[data-quantity]', 'mdChange', { value: 5 });
  const after = await page.evaluate(() =>
    document.querySelector('[data-estimate-total]')?.textContent?.trim());
  ok('a new quantity re-estimates', after !== before, `${before} -> ${after}`);

  await emit(page, '[data-quantity]', 'mdInput', { value: null });
  const cleared = await page.evaluate(() => ({
    block: !!document.querySelector('[data-estimate]'),
    off: document.querySelector('[data-buy]')?.hasAttribute('soft-disabled'),
    reason: (() => {
      const el = document.querySelector('[data-trade-tooltip]');
      return el?.text ?? el?.getAttribute('text') ?? '';
    })(),
  }));
  ok('a cleared quantity takes the estimate away', !cleared.block);
  ok('and gates both buttons with a reason', cleared.off && cleared.reason.length > 0, cleared.reason);

  await emit(page, '[data-quantity]', 'mdChange', { value: 2 });
  await click(page, '[data-buy]');
  const placed = await page.evaluate(() => ({
    note: !!document.querySelector('[data-buy]')?.closest('.row')?.querySelector('.muted'),
    off: document.querySelector('[data-buy]')?.hasAttribute('soft-disabled'),
  }));
  ok('placing it says so and disarms the button', placed.note && placed.off);
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ------------------------------- 8. the cards ------------------------------ */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/cards/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await settled(page);

  const before = await page.evaluate(() => ({
    title: document.querySelector('[data-detail-panel] .panel__title')?.textContent?.trim(),
    number: document.querySelector('.card-tile__number')?.textContent?.trim(),
    recent: document.querySelectorAll('[data-recent] md-list-item').length,
  }));
  console.log('\n[8] the cards');
  ok('the first card is live in the document', (before.title ?? '').length > 0, before.title ?? '');

  await page.evaluate(() => document.querySelectorAll('md-list-item[data-card]')[1]?.click());
  await settled(page);
  const swapped = await page.evaluate(() => ({
    title: document.querySelector('[data-detail-panel] .panel__title')?.textContent?.trim(),
    number: document.querySelector('.card-tile__number')?.textContent?.trim(),
    selected: [...document.querySelectorAll('md-list-item[data-card]')].findIndex((r) => r.selected),
    recentSub: document.querySelector('[data-recent-panel] .panel__sub')?.textContent?.trim(),
    limit: !!document.querySelector('[data-limit]')?.firstElementChild,
  }));
  ok('picking another swaps its detail in', swapped.title !== before.title,
    `${before.title} -> ${swapped.title}`);
  ok('and the tile with it', swapped.number !== before.number, swapped.number ?? '');
  ok('and moves the single selection', swapped.selected === 1, `row ${swapped.selected}`);
  ok('and retitles the recent panel', swapped.recentSub === swapped.title, swapped.recentSub ?? '');
  ok('and the limit block came too', swapped.limit);

  await emit(page, 'md-switch[data-control="freeze"]', 'mdChange', { selected: true });
  const frozen = await page.evaluate(() => ({
    tile: document.querySelector('.card-tile')?.getAttribute('data-state'),
    chip: document.querySelector('[data-card-status] md-chip')?.getAttribute('label') ?? '',
    hint: !!document.querySelector('[data-detail] [data-state-hint="frozen"]'),
    rowChip:
      document.querySelectorAll('md-list-item[data-card]')[1]?.querySelector('md-chip')?.getAttribute('label') ?? '',
    controlsOff: [...document.querySelectorAll('md-switch[data-control]')]
      .filter((s) => s.dataset.control !== 'freeze')
      .every((s) => s.disabled),
    snack: document.querySelector('[data-snackbar]')?.message ?? '',
  }));
  ok('freezing restyles the tile', frozen.tile === 'frozen', frozen.tile ?? '');
  ok('and renames the status chip', frozen.chip.length > 0, frozen.chip);
  ok('and reveals the hint', frozen.hint);
  ok('and follows through to the list row', frozen.rowChip === frozen.chip, frozen.rowChip);
  ok('and moots the three spending controls', frozen.controlsOff);
  ok('and raises a snackbar', frozen.snack.length > 0, frozen.snack);

  await emit(page, 'md-switch[data-control="freeze"]', 'mdChange', { selected: false });
  const thawed = await page.evaluate(() => ({
    tile: document.querySelector('.card-tile')?.getAttribute('data-state'),
    hint: !!document.querySelector('[data-detail] [data-state-hint="frozen"]'),
  }));
  ok('and thawing puts it all back', thawed.tile === 'active' && !thawed.hint, thawed.tile ?? '');
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ------------- 9. the four screens that hold no state hold none ------------ */
{
  console.log('\n[9] the static screens');
  const errors = [];
  for (const path of ['/', '/analytics/', '/accounts/acc-eur/', '/invest/ins-01/']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    page.on('pageerror', (e) => errors.push(`${path}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${path}: ${m.text()}`));
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 90000 });
    await settled(page);
    await page.close();
  }
  ok('home, analytics and both drills load clean', errors.length === 0, errors.slice(0, 2).join(' | '));
}

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

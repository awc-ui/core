#!/usr/bin/env node
/**
 * Does this build actually behave like a single-page application?
 *
 * The claims being tested are the ones this build EXISTS to make, and every one
 * of them is invisible to a type-check and to `vite build` finishing cleanly:
 * the routes resolve in the browser rather than at the server, a cold deep link
 * still lands on the right screen, the components upgrade from a runtime the
 * bundler never touched, and the locale switches in place rather than
 * navigating.
 *
 * `scripts/verify-showcase-parity.mjs` at the repo root already proves this
 * build renders the same DOM as its siblings. It cannot prove any of the above:
 * it measures one screen at a time, from a cold load, which is exactly the case
 * where an SPA and a static export are indistinguishable. That is the gap this
 * file fills.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-react build
 *   pnpm --filter @awc-ui/showcase-credit-risk-react verify
 *
 * The server it starts is `scripts/serve-dist.mjs`, which has NO history
 * fallback — so "the deep link works" here means the files are really on disk,
 * not that a dev server papered over it.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes, FRAMEWORKS } from '@awc-ui/showcase-kit/credit-risk';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4347;
const { basePath, route } = createRoutes('react');
const BASE = `http://localhost:${PORT}${basePath}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((done) => server.stdout.once('data', done));

// Kill the server whatever happens. The teardown at the bottom only runs on the
// happy path, so a failed assertion would otherwise leave the port held and the
// NEXT run would die on EADDRINUSE, reporting a port clash instead of the
// failure that caused it.
const stopServer = () => {
  if (!server.killed) server.kill();
};
process.on('exit', stopServer);
for (const signal of ['uncaughtException', 'unhandledRejection']) {
  process.on(signal, (error) => {
    stopServer();
    console.error(error);
    process.exit(1);
  });
}

const browser = await puppeteer.launch({ headless: 'shell' });
const results = [];
const ok = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

/** Load a URL and give the lazy component runtime time to upgrade the elements. */
const load = async (url, wait = 2500) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, wait));
  return page;
};

/*
 * READING AND DRIVING THE DOCK, which is no longer built from native controls.
 *
 * The bar is made of `@awc-ui/core` components now, so its framework and
 * language pickers are `md-select`s, not `HTMLSelectElement`s. Two things that
 * used to be one-liners here are not:
 *
 *   - There is no `.options`. The `<md-select-option>` elements the dock writes
 *     are data carriers with `display: none`; the rows a reader can actually
 *     reach are `md-menu-item`s that md-select renders in its OWN shadow root,
 *     one per option, with the id `<trigger>-opt-<value>` and the visible text
 *     in `part="headline"`. Reading those is what keeps "every build is
 *     selectable" an assertion about something selectable — the same reason the
 *     old check read the rendered `<option>`s rather than the `frameworks`
 *     attribute.
 *   - Assigning `.value` and firing a native `change` does nothing at all. The
 *     dock hangs its state write off `mdChange`, which md-select emits only from
 *     its own `selectValue()` — so the picker has to be driven by opening the
 *     menu and clicking a row, which is also what a reader does.
 */

/** The rendered rows of a dock picker, and the value it currently holds. */
const readDockPicker = (page, id) =>
  page.evaluate((pickerId) => {
    const select = document.querySelector('awc-showcase-dock')?.shadowRoot?.getElementById(pickerId);
    if (!select?.shadowRoot) return null;
    return {
      value: select.value,
      options: [...select.shadowRoot.querySelectorAll('[role="listbox"] md-menu-item')].map(
        (row) => ({
          value: row.id.slice(row.id.indexOf('-opt-') + '-opt-'.length),
          label: row.shadowRoot?.querySelector('[part="headline"]')?.textContent?.trim() ?? '',
          selected: row.getAttribute('aria-selected') === 'true',
        }),
      ),
    };
  }, id);

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

/**
 * A marker on `window` that only a full document load can clear.
 *
 * This is the whole test for "routing happened in the browser". Counting
 * navigation performance entries says the same thing, and both are checked —
 * but the marker is the one that cannot be argued with: if the variable is
 * still there, the JavaScript context was never torn down.
 */
const STAMP = () => {
  window.__awcSpaStamp = 'alive';
};
const readStamp = (page) =>
  page.evaluate(() => ({
    stamp: window.__awcSpaStamp ?? '(gone — the document reloaded)',
    navigations: performance.getEntriesByType('navigation').length,
  }));

/* ------------------------------------------- cold deep links resolve on disk */
/*
 * The fan-out is the SPA fallback for this build, and it is the thing most
 * likely to be silently skipped: `vite build` on its own emits ONE index.html
 * and the app still works perfectly from `/`. Every other route 404s.
 */
{
  console.log('\n[deep links] every route is a real file');
  const routes = [route.overview(), route.watchlist(), route.stress(), route.sector('energy'), route.counterparty('cp-01'), route.facility('fac-057')];
  for (const path of routes) {
    const page = await load(`${BASE}${path}`, 1200);
    const probe = await page.evaluate(() => ({
      status: document.querySelector('.shell') ? 'rendered' : 'no shell',
      heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
    }));
    ok(`${path} renders on a cold load`, probe.status === 'rendered', probe.heading);
    await page.close();
  }

  // And a path that is NOT a route still reaches the app rather than the host's
  // 404 — but only where the host rewrites. On this deliberately dumb server it
  // must 404, which is what proves the server is not quietly helping.
  const page = await browser.newPage();
  const response = await page.goto(`${BASE}/no-such-screen/`, { waitUntil: 'domcontentloaded' });
  ok('an unknown path 404s on a server with no rewrite', response.status() === 404, `HTTP ${response.status()}`);
  await page.close();
}

/* ------------------------------------------------ the components are upgraded */
/*
 * The runtime is loaded from `public/awc-runtime/` by a classic inline script
 * that the bundler never sees. If that URL is wrong, every `md-*` element is an
 * unknown tag: still in the DOM, still in the parity fingerprint, rendering at
 * zero height with no shadow root. Checking for shadow roots is what tells the
 * two apart.
 */
{
  console.log('\n[runtime] md-* elements upgraded from public/awc-runtime');
  const page = await load(`${BASE}/`);
  const probe = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('md-card, md-chip, md-button, md-bar-chart')];
    return {
      total: elements.length,
      upgraded: elements.filter((el) => el.shadowRoot).length,
      runtimeSrc: [...document.querySelectorAll('script[type="module"]')]
        .map((s) => s.src)
        .find((src) => src.includes('awc-runtime')) ?? '(none)',
    };
  });
  ok('every sampled md-* element has a shadow root', probe.total > 0 && probe.upgraded === probe.total, `${probe.upgraded}/${probe.total}`);
  ok('the runtime came from the mounted public directory', probe.runtimeSrc.includes(`${basePath}/awc-runtime/md3/md3.esm.js`), probe.runtimeSrc);
  await page.close();
}

/* ---------------------------------------------------- routing in the browser */
{
  console.log('\n[routing] the document is never reloaded');
  const page = await load(`${BASE}/`);
  await page.evaluate(STAMP);

  // The section nav is `md-button[href]` — a real anchor inside a shadow root.
  // Clicking it is the case that used to be a full page load, and the reason
  // `SectionNav` vetoes `mdClick`.
  await page.evaluate((href) => {
    const nav = document.querySelector('.shell__nav');
    const button = [...nav.querySelectorAll('md-button')].find((b) => b.getAttribute('href') === href);
    button.shadowRoot.querySelector('a, button').click();
  }, `${basePath}${route.watchlist()}`);
  await new Promise((r) => setTimeout(r, 1500));

  let probe = await readStamp(page);
  let where = await page.evaluate(() => ({
    path: location.pathname,
    heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
    active: [...document.querySelectorAll('.shell__nav md-button')].filter((b) => b.getAttribute('variant') === 'tonal').map((b) => b.textContent.trim()),
  }));
  ok('the section nav routes without a reload', probe.stamp === 'alive', probe.stamp);
  ok('exactly one document load so far', probe.navigations === 1, `${probe.navigations}`);
  ok('the URL moved to the watchlist', where.path === `${basePath}${route.watchlist()}`, where.path);
  ok('the watchlist screen is on screen', where.heading.length > 0 && where.heading !== 'Portfolio overview', where.heading);
  ok('the nav marks the section it is on', where.active.length === 1, where.active.join(', ') || '(none marked)');

  // A drill anchor — the `<a class="drill">` this build's own Link renders.
  await page.evaluate(() => document.querySelector('a.drill').click());
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({ path: location.pathname, crumbs: document.querySelectorAll('md-breadcrumb-item').length }));
  ok('a drill anchor routes without a reload', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('it drilled into a counterparty', /\/counterparties\/cp-\d+\/$/.test(where.path), where.path);
  ok('and the trail appeared', where.crumbs > 1, `${where.crumbs} crumb(s)`);

  // Back, twice, all the way to the overview.
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1000));
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({ path: location.pathname, heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)' }));
  ok('the back button restores the previous screens', where.path === `${basePath}/`, `${where.path} — ${where.heading}`);
  ok('and it did not reload either', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  await page.close();
}

/* ------------------------------------------------------------ locale in place */
/*
 * The locale is client state in this build, not a path segment — the same split
 * the docs record for react/vue/angular/svelte against html/astro. Two things
 * have to hold: the URL's `lang` wins on a cold load, and changing it through
 * the dock re-renders rather than navigating.
 */
{
  console.log('\n[locale] switched in place, never routed');
  const page = await load(`${BASE}/?lang=ro`);
  let probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    brand: document.querySelector('.shell__brand')?.textContent ?? '',
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('a cold load honours ?lang=ro', probe.lang === 'ro', `lang=${probe.lang} dir=${probe.dir}`);
  ok('and the screen is actually in Romanian', /Expunere|Prezentare|Contrapart/i.test(probe.text), probe.text.slice(0, 48).replace(/\s+/g, ' '));

  await page.evaluate(STAMP);
  // Arabic, through the dock's own picker, which is what a reader clicks.
  // `#awc-dock-locale` by id, not "the first md-select in the shadow root" —
  // the framework switcher is the first one, and picking it navigates to
  // another build instead of changing the language.
  const drove = await pickInDock(page, 'awc-dock-locale', 'ar');
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  const after = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    path: location.pathname,
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('the dock offers a reachable Arabic row', drove);
  ok('the dock switches locale without a reload', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('<html> follows to ar / rtl', after.lang === 'ar' && after.dir === 'rtl', `lang=${after.lang} dir=${after.dir}`);
  ok('the path is untouched — no /ar/ segment', after.path === `${basePath}/`, after.path);
  ok('and the strings re-rendered in Arabic', /[؀-ۿ]/.test(after.text), after.text.slice(0, 40).replace(/\s+/g, ' '));
  await page.close();
}

/* --------------------------------------------- the state query survives a hop */
/*
 * The departure from the build this was ported from: `router.push()` there
 * dropped the query, so a link copied after two clicks reverted to English on
 * someone else's machine. Here the params ride along.
 */
{
  console.log('\n[state] the dock query survives an in-app navigation');
  const page = await load(`${BASE}/?lang=ro&theme=dark`);
  await page.evaluate(() => document.querySelector('a.drill').click());
  await new Promise((r) => setTimeout(r, 1200));
  const probe = await page.evaluate(() => ({ url: location.pathname + location.search, lang: document.documentElement.lang }));
  const params = new URLSearchParams(probe.url.split('?')[1] ?? '');
  ok('lang and theme are still in the URL after a drill', params.get('lang') === 'ro' && params.get('theme') === 'dark', probe.url);
  ok('and the new screen is still Romanian', probe.lang === 'ro', `lang=${probe.lang}`);
  await page.close();
}

/* ------------------------------------------------------------------- the dock */
{
  console.log(`\n[dock] one bar, ${FRAMEWORKS.length} frameworks, this one marked`);
  const page = await load(`${BASE}/`);
  const probe = await page.evaluate(() => {
    const docks = document.querySelectorAll('awc-showcase-dock');
    const dock = docks[0];
    return {
      count: docks.length,
      framework: dock?.getAttribute('framework'),
      frameworks: dock?.getAttribute('frameworks'),
      position: dock?.getAttribute('position'),
      dockHeight: getComputedStyle(document.documentElement).getPropertyValue('--awc-dock-height').trim(),
    };
  });
  const picker = await readDockPicker(page, 'awc-dock-framework');
  ok('the dock is rendered exactly once', probe.count === 1, `${probe.count}`);
  ok('it identifies this build as react', probe.framework === 'react', probe.framework ?? '(none)');
  // Derived from the kit, not spelled out here. The list grows every time a
  // build is added, and a hardcoded copy would then fail in every app at once
  // while telling us nothing except that the list changed.
  ok(
    `it offers all ${FRAMEWORKS.length} builds`,
    probe.frameworks === FRAMEWORKS.join(','),
    probe.frameworks ?? '(none)',
  );
  // The attribute is only plumbing; what a reader can actually reach is the
  // list of rows md-select rendered from it. A dock that receives the list and
  // fails to render it passes the check above and is still broken — and so does
  // one whose picker never upgraded, which is the new way to be broken.
  const values = picker?.options.map((o) => o.value).join(',') ?? '(no picker)';
  ok('every build is selectable', values === FRAMEWORKS.join(','), values);
  ok(
    'this build is the one selected',
    picker?.value === 'react' && picker.options.find((o) => o.selected)?.value === 'react',
    `value=${picker?.value ?? '(none)'} marked=${picker?.options.find((o) => o.selected)?.value ?? '(nothing)'}`,
  );
  // A framework id with no entry in the dock's label map falls back to its own
  // id with the first letter capitalised, so `angular-ssr` would appear in the
  // menu as "Angular-ssr". No real display name contains a hyphen. A blank one
  // counts too: the row's text is rendered by md-select from the option's
  // label, so "no text at all" is now a way for the name to go missing.
  const unnamed =
    picker?.options
      .filter((o) => !o.label || o.label.includes('-'))
      .map((o) => o.label || `(blank: ${o.value})`) ?? [];
  ok('every option has a display name, not a raw id', unnamed.length === 0, unnamed.join(', ') || 'all named');
  ok('it is pinned to the bottom and publishes its height', probe.position === 'bottom' && probe.dockHeight !== '', `position=${probe.position} --awc-dock-height=${probe.dockHeight || '(unset)'}`);
  await page.close();
}

await browser.close();
stopServer();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length} assertions${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);

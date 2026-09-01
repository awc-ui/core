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
 * THE SHELL CHECK IS THE ONE THAT COULD NOT BE FAKED. `[shell]` below reads the
 * shipped bytes with no JavaScript involved and asserts the document is EMPTY —
 * no `.shell`, no screen heading, no declarative shadow root. The failure it
 * catches is silent: a build that quietly started prerendering would pass every
 * other assertion in this file, render identically in a browser, and still be
 * mislabelled `awc-render-mode=spa`.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-wealth-vue build
 *   pnpm --filter @awc-ui/showcase-wealth-vue verify
 *
 * The server it starts is `scripts/serve-dist.mjs`, which has NO history
 * fallback — so "the deep link works" here means the files are really on disk,
 * not that a dev server papered over it.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes, FRAMEWORKS } from '@awc-ui/showcase-kit/wealth';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The credit-risk vue verifier owns 4345; ten above it, matching the dev-port
// convention (credit-risk vue 4328 → wealth vue 4338).
const PORT = 4355;
const { basePath, route } = createRoutes('vue');
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
 * READING AND DRIVING THE DOCK — see the credit-risk vue twin for the long
 * form: the pickers are `md-select`s, the reachable rows are `md-menu-item`s in
 * md-select's own shadow root (id `<trigger>-opt-<value>`), and state writes
 * hang off `mdChange`, which only a real row click produces.
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
 * dance in the page — an evaluate whose promise stays pending for seconds is
 * liable to come back "Promise was collected", which is a flake that looks
 * exactly like a broken dock. Every evaluate below returns synchronously.
 */
const pickInDock = async (page, id, value) => {
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
 * This is the whole test for "routing happened in the browser": if the variable
 * is still there, the JavaScript context was never torn down.
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
  const routes = [
    route.overview(),
    route.holdings(),
    route.proposals(),
    route.trade(),
    route.planning(),
    route.household('hh-01'),
  ];
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

/* --------------------------------------------- the document really is a shell */
{
  console.log('\n[shell] the shipped HTML is empty — no JavaScript involved');
  for (const path of [route.overview(), route.household('hh-01')]) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    const has = (needle) => html.includes(needle);
    ok(
      `${path} ships no rendered screen`,
      !has('class="shell"') && !has('<h1') && !/shadowrootmode/i.test(html),
      `${html.length} bytes`,
    );
    ok(
      `${path} ships the mount point and the runtime loader`,
      has('id="root"') && has(`${basePath}/awc-runtime/md3/md3.esm.js`),
      has('id="root"') ? 'both present' : '#root missing',
    );
    ok(
      `${path} declares itself a single-page application`,
      /name="awc-render-mode"\s+content="spa"/.test(html),
      /name="awc-render-mode"[^>]*/.exec(html)?.[0] ?? '(no render-mode meta)',
    );
  }

  // And every route really is the SAME shell. If a build ever prerendered per
  // route, the two documents would differ — which is the property that makes
  // the fan-out copies an SPA fallback rather than prerendered pages.
  const [a, b] = await Promise.all([
    fetch(`${BASE}${route.overview()}`).then((r) => r.text()),
    fetch(`${BASE}${route.household('hh-01')}`).then((r) => r.text()),
  ]);
  ok('every route is byte-identical to the overview', a === b, a === b ? 'identical' : `${a.length} vs ${b.length} bytes`);
}

/* ------------------------------------------------ the components are upgraded */
{
  console.log('\n[runtime] md-* elements upgraded from public/awc-runtime');
  const runtimeRequests = [];
  const page = await browser.newPage();
  page.on('request', (r) => {
    if (r.url().includes('awc-runtime')) runtimeRequests.push(r.url());
  });
  await page.setViewport({ width: 1500, height: 950 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  const probe = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll('md-app-bar, md-chip, md-navigation-rail, md-navigation-rail-tab, md-fab'),
    ];
    return {
      total: elements.length,
      upgraded: elements.filter((el) => el.shadowRoot).length,
      // The runtime is `import()`ed by src/main.ts after mount, so there is no
      // <script> tag carrying its URL — the preload link in <head> and the
      // actual network request are what prove where it came from.
      preload: document.querySelector('link[rel="modulepreload"]')?.getAttribute('href') ?? '(none)',
    };
  });
  ok('every sampled md-* element has a shadow root', probe.total > 0 && probe.upgraded === probe.total, `${probe.upgraded}/${probe.total}`);
  ok(
    'the runtime was fetched from the mounted public directory',
    runtimeRequests.some((url) => url.endsWith(`${basePath}/awc-runtime/md3/md3.esm.js`)),
    runtimeRequests[0] ?? '(never requested)',
  );
  ok('and it is preloaded from <head>', probe.preload === `${basePath}/awc-runtime/md3/md3.esm.js`, probe.preload);
  await page.close();
}

/* ------------------------------------------- the parity fingerprint is stable */
/*
 * THE REGRESSION GUARD for why the runtime is executed from `src/main.ts`
 * instead of a `<script>` in the head — the credit-risk vue twin records the
 * measurement (10 cold loads, two fingerprints, five each, when both raced
 * from <head>). A future edit that moves the runtime back passes everything
 * else and fails here.
 */
{
  console.log('\n[fingerprint] identical across cold loads, attributes intact');
  const FINGERPRINT = () => {
    const VALUED = [
      'label', 'value', 'color', 'state', 'variant', 'appearance', 'icon',
      'column-template', 'sort-by', 'sort-order',
      'row-count', 'row-offset', 'count', 'page', 'rows-per-page',
    ];
    const PRESENCE = ['clickable', 'numeric', 'head', 'striped', 'frozen-header'];
    return [...document.querySelectorAll('*')]
      .filter((el) => el.tagName.toLowerCase().startsWith('md-'))
      .map((el) => {
        const tag = el.tagName.toLowerCase();
        const bits = [
          ...VALUED.filter((n) => el.hasAttribute(n)).map((n) => `${n}=${el.getAttribute(n)}`),
          ...PRESENCE.filter((n) => el.hasAttribute(n)),
        ];
        return bits.length ? `${tag}[${bits.join(',')}]` : tag;
      });
  };

  const takes = [];
  for (let i = 0; i < 2; i++) {
    const page = await load(`${BASE}/`);
    takes.push(await page.evaluate(FINGERPRINT));
    await page.close();
  }
  const [first, second] = takes;
  ok('two cold loads fingerprint the same', JSON.stringify(first) === JSON.stringify(second), `${first.length} elements`);
  // The rail tabs are the cheapest witness: five of them, each with an `icon`
  // and a `label` this build binds dynamically.
  const withIcon = first.filter((entry) => entry.includes('icon=')).length;
  ok('md-* elements carry their bound attributes', withIcon > 0, `${withIcon} of ${first.length} carry icon=`);
}

/* ------------------------------------------------------ Vue has no complaints */
/*
 * The Vue-specific failure mode, and it is a quiet one: `isCustomElement`
 * lives in the SFC compiler options (`vite.config.ts`), not in the app, so
 * getting it wrong does not break the build — it makes Vue warn once per tag
 * per render while everything still looks fine.
 */
{
  console.log('\n[vue] no warnings, no unresolved components');
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  const messages = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') messages.push(message.text());
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));

  // The font sheets are the one expected source of noise on a cold, offline-ish
  // run, and they say nothing about this build.
  const relevant = messages.filter((m) => !/fonts\.(googleapis|gstatic)\.com/.test(m));
  const unresolved = relevant.filter((m) => /Failed to resolve component|is not a valid custom element/i.test(m));
  const hydration = relevant.filter((m) => /[Hh]ydration/.test(m));

  ok('no "failed to resolve component" warnings', unresolved.length === 0, unresolved[0]?.slice(0, 90) ?? 'none');
  ok('no hydration warnings — there is nothing to hydrate', hydration.length === 0, hydration[0]?.slice(0, 90) ?? 'none');
  ok('a clean console overall', relevant.length === 0, relevant.length ? `${relevant.length}: ${relevant[0].slice(0, 80)}` : 'silent');
  await page.close();
}

/* ---------------------------------------------------- routing in the browser */
{
  console.log('\n[routing] the document is never reloaded');
  const page = await load(`${BASE}/`);
  await page.evaluate(STAMP);

  /*
   * The rail tabs are `md-navigation-rail-tab[href]` — real anchors inside a
   * shadow root. Clicking one is the case that used to be a full page load,
   * and the reason `Rail.vue` vetoes the native click via `composedPath()`.
   *
   * The tab is found by its `value` attribute (static in the template, never
   * re-patched, so no property-vs-attribute race), and clicked through its
   * shadow anchor once that exists — which on a loaded machine can land after
   * the 2500 ms `load()` waits, hence `waitForFunction`.
   */
  await page.waitForFunction(
    () => {
      const tab = document.querySelector('md-navigation-rail-tab[value="holdings"]');
      return Boolean(tab?.shadowRoot?.querySelector('a, button'));
    },
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    const tab = document.querySelector('md-navigation-rail-tab[value="holdings"]');
    tab.shadowRoot.querySelector('a, button').click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  let probe = await readStamp(page);
  /*
   * `active-index` IS READ PROPERTY-OR-ATTRIBUTE, for the reason the twin
   * documents at length: Vue writes a custom-element binding as an attribute
   * before Stencil upgrades the element and as a property after, so which side
   * holds the value after an in-app navigation is not knowable. The heading and
   * the URL are plain DOM and are asserted exactly.
   */
  let where = await page.evaluate(() => {
    const rail = document.querySelector('md-navigation-rail');
    return {
      path: location.pathname,
      heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
      activeIndex: Number(rail?.activeIndex ?? rail?.getAttribute('active-index')),
    };
  });
  ok('a rail tab routes without a reload', probe.stamp === 'alive', probe.stamp);
  ok('exactly one document load so far', probe.navigations === 1, `${probe.navigations}`);
  ok('the URL moved to holdings', where.path === `${basePath}${route.holdings()}`, where.path);
  ok('the holdings screen is on screen', where.heading.length > 0 && where.path.endsWith(route.holdings()), where.heading);
  ok('the rail indicator follows the URL', where.activeIndex === 1, `active-index=${where.activeIndex}`);

  // The breadcrumb trail — `md-breadcrumb-item[href]` with one intercepted
  // `mdSelect` on the strip. A household deep link renders a two-crumb trail,
  // and the first crumb routes back to the overview.
  await page.goto(`${BASE}${route.household('hh-01')}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(STAMP);
  await page.waitForFunction(
    () => Boolean(document.querySelector('md-breadcrumb-item')?.shadowRoot?.querySelector('a')),
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    document.querySelector('md-breadcrumb-item').shadowRoot.querySelector('a').click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({
    path: location.pathname,
    heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
  }));
  ok('a breadcrumb routes without a reload', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('it went back up to the overview', where.path === `${basePath}/`, where.path);

  // Back restores the household screen without a reload.
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({ path: location.pathname, crumbs: document.querySelectorAll('md-breadcrumb-item').length }));
  ok('the back button restores the previous screen', /\/households\/hh-01\/$/.test(where.path), where.path);
  ok('and it did not reload either', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('and the trail is back', where.crumbs > 1, `${where.crumbs} crumb(s)`);
  await page.close();
}

/* ------------------------------------------------------------ locale in place */
{
  console.log('\n[locale] switched in place, never routed');
  const page = await load(`${BASE}/?lang=ro`);
  let probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('a cold load honours ?lang=ro', probe.lang === 'ro', `lang=${probe.lang} dir=${probe.dir}`);
  ok('and the screen is actually in Romanian', /Prezentare|portofoliu|Propuneri/i.test(probe.text), probe.text.slice(0, 48).replace(/\s+/g, ' '));

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
{
  console.log('\n[state] the dock query survives an in-app navigation');
  const page = await load(`${BASE}/?lang=ro&theme=dark`);
  await page.waitForFunction(
    () => Boolean(document.querySelector('md-navigation-rail-tab[value="trade"]')?.shadowRoot?.querySelector('a, button')),
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    document.querySelector('md-navigation-rail-tab[value="trade"]').shadowRoot.querySelector('a, button').click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const probe = await page.evaluate(() => ({ url: location.pathname + location.search, lang: document.documentElement.lang }));
  const params = new URLSearchParams(probe.url.split('?')[1] ?? '');
  ok('lang and theme are still in the URL after a navigation', params.get('lang') === 'ro' && params.get('theme') === 'dark', probe.url);
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
      // Property-or-attribute: these are declared Stencil props, and which side
      // holds the value depends on whether the element upgraded before or after
      // Vue's second render.
      count: docks.length,
      framework: dock?.framework ?? dock?.getAttribute('framework'),
      frameworks: dock?.frameworks ?? dock?.getAttribute('frameworks'),
      position: dock?.position ?? dock?.getAttribute('position'),
      label: dock?.label ?? dock?.getAttribute('label'),
      dockHeight: getComputedStyle(document.documentElement).getPropertyValue('--awc-dock-height').trim(),
    };
  });
  const picker = await readDockPicker(page, 'awc-dock-framework');
  ok('the dock is rendered exactly once', probe.count === 1, `${probe.count}`);
  ok('it identifies this build as vue', probe.framework === 'vue', probe.framework ?? '(none)');
  // Derived from the kit, not spelled out here. The list grows every time a
  // build is added, and a hardcoded copy would then fail in every app at once
  // while telling us nothing except that the list changed.
  ok(
    `it offers all ${FRAMEWORKS.length} builds`,
    probe.frameworks === FRAMEWORKS.join(','),
    probe.frameworks ?? '(none)',
  );
  const values = picker?.options.map((o) => o.value).join(',') ?? '(no picker)';
  ok('every build is selectable', values === FRAMEWORKS.join(','), values);
  ok(
    'this build is the one selected',
    picker?.value === 'vue' && picker.options.find((o) => o.selected)?.value === 'vue',
    `value=${picker?.value ?? '(none)'} marked=${picker?.options.find((o) => o.selected)?.value ?? '(nothing)'}`,
  );
  const unnamed =
    picker?.options
      .filter((o) => !o.label || o.label.includes('-'))
      .map((o) => o.label || `(blank: ${o.value})`) ?? [];
  ok('every option has a display name, not a raw id', unnamed.length === 0, unnamed.join(', ') || 'all named');
  // The wealth-specific line: the dock's own heading falls back to the FIRST
  // vertical's title, so an unlabelled dock here announces "Credit Risk
  // Console" under a wealth console. DockBar.vue passes `label`; this catches
  // the day someone removes it.
  ok('the dock is labelled for this vertical', Boolean(probe.label) && !/credit/i.test(probe.label ?? ''), probe.label ?? '(no label)');
  ok('it is pinned to the bottom and publishes its height', probe.position === 'bottom' && probe.dockHeight !== '', `position=${probe.position} --awc-dock-height=${probe.dockHeight || '(unset)'}`);
  await page.close();
}

await browser.close();
stopServer();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length} assertions${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);

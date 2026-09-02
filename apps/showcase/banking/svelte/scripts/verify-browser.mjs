#!/usr/bin/env node
/**
 * Does this build actually behave like a single-page application?
 *
 * The claims being tested are the ones this build EXISTS to make, and every one
 * of them is invisible to a type-check and to `vite build` finishing cleanly:
 * nothing is rendered until the browser renders it, the routes resolve in the
 * browser rather than at a server, a cold deep link still lands on the right
 * screen, the components upgrade from a runtime the bundler never touched, and
 * the locale switches in place rather than navigating.
 *
 * `scripts/verify-showcase-parity.mjs` at the repo root already proves this
 * build renders the same DOM as its siblings. It cannot prove any of the above:
 * it measures one screen at a time, from a cold load with JavaScript on, which
 * is exactly the case where an SPA and a static export are indistinguishable.
 * That is the gap this file fills.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-banking-svelte build
 *   pnpm --filter @awc-ui/showcase-banking-svelte verify
 *
 * The server it starts is `scripts/serve-dist.mjs`, which has NO history
 * fallback — so "the deep link works" here means the files are really on disk,
 * not that a dev server papered over it.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes, DESTINATIONS, FRAMEWORKS } from '@awc-ui/showcase-kit/banking';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4349;
const { basePath, route } = createRoutes('svelte');
const BASE = `http://localhost:${PORT}${basePath}`;

const server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

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

// Wait for the listen line, but not forever: if the server exits instead of
// listening (a missing `dist/`, a port already held), `once('data')` never
// settles and the run hangs with no output at all.
await new Promise((done, fail) => {
  server.stdout.once('data', done);
  server.once('exit', (code) => fail(new Error(`serve-dist.mjs exited with code ${code} before listening`)));
});

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
 * READING AND DRIVING THE DOCK, which is built from `@awc-ui/core` components:
 * its framework and language pickers are `md-select`s, not native selects. The
 * rows a reader can actually reach are `md-menu-item`s that md-select renders
 * in its OWN shadow root, one per option, with the id `<trigger>-opt-<value>`
 * and the visible text in `part="headline"`; and the picker has to be driven by
 * opening the menu and clicking a row, which is also what a reader does.
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
 * liable to come back "Promise was collected" instead of a result. Every
 * evaluate below returns synchronously.
 */
const pickInDock = async (page, id, value) => {
  // Collapsed on a first visit. The panel keeps its controls in the DOM while
  // hidden, so this asks the disclosure — an md-icon-button — rather than
  // inferring from a missing element, and it drives a control a reader could
  // have clicked.
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

/* ------------------------------------- the response carries no rendered page */
/*
 * The response is a shell: an empty mount point, the same bytes at every route.
 * Checked against the RAW response text rather than the rendered DOM, because
 * by the time a browser has a DOM the question has already been answered by
 * whichever side ran first.
 */
{
  console.log('\n[shell] the document that leaves the host is empty');
  const home = await (await fetch(`${BASE}/`)).text();
  const deep = await (await fetch(`${BASE}${route.household('hh-01')}`)).text();

  ok('no shell markup in the response', !home.includes('class="shell"'), `${home.length} bytes`);
  ok('no md-* element in the response', !/<md-[a-z-]+/.test(home), 'none');
  ok('no declarative shadow DOM in the response', !home.includes('shadowrootmode'), 'none');
  ok('the mount point is empty', /<div id="root"[^>]*>\s*<\/div>/.test(home), 'div#root has no children');
  ok('it declares itself a single-page application', /name="awc-render-mode"\s+content="spa"/.test(home), 'awc-render-mode=spa');
  ok('and carries no render timestamp — there is no render to stamp', !home.includes('awc-rendered-at'), 'absent');
  // The fan-out copies ONE file. If a route's document differed, something
  // per-route had been baked in and this would be a prerender wearing an SPA's
  // label.
  ok('a deep route serves byte-identical HTML', home === deep, `${deep.length} bytes, identical`);

  // Fetched twice, a second apart: a static file cannot answer differently.
  await new Promise((r) => setTimeout(r, 1100));
  const again = await (await fetch(`${BASE}/`)).text();
  ok('two requests a second apart are identical', home === again, 'no per-request content');

  // And with scripting off, nothing appears. This is the same assertion from
  // the browser's side — the one a reader can reproduce by hand.
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}${route.holdings()}`, { waitUntil: 'domcontentloaded' });
  const dark = await page.evaluate(() => ({
    text: document.body.innerText.trim(),
    children: document.getElementById('root')?.childElementCount ?? -1,
  }));
  ok('with JavaScript disabled the page is blank', dark.children === 0 && dark.text === '', `#root has ${dark.children} children`);
  await page.close();
}

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

/* --------------------------------------------- an unknown id is the app's 404 */
/*
 * `HouseholdScreen` guards its own id — a component taking a plain string from
 * a URL must not trust its caller — and renders the empty state for an id the
 * fixture does not know.
 *
 * THE SHELL HAS TO BE SERVED FOR THE APP TO GET THE CHANCE. `/households/banana/`
 * is not one of the routes the fan-out writes, so on `serve-dist.mjs` — which
 * has no history fallback, deliberately, and the assertion directly above
 * proves it — the request 404s and no JavaScript ever runs. So the host
 * rewrite is supplied here, for this one page, by fulfilling the navigation
 * request with the built shell. That is exactly the rule the docs host carries
 * (`/showcase/banking/svelte/* → …/index.html 200`) and the only condition
 * under which a typo'd URL is the app's problem at all. Every other request —
 * the entry chunk, the stylesheet, the component runtime — continues to the
 * real server, so what is being exercised is the real build.
 */
{
  console.log('\n[404] a route that exists with an id that does not');
  const shell = await (await fetch(`${BASE}/`)).text();

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const isRewrite =
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      new URL(request.url()).pathname === `${basePath}/households/banana/`;
    if (isRewrite) request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: shell });
    else request.continue();
  });

  await page.goto(`${BASE}/households/banana/`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));

  const probe = await page.evaluate(() => ({
    shell: Boolean(document.querySelector('.shell')),
    rail: document.querySelectorAll('.shell__rail md-navigation-rail-tab').length,
    heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
    // The overview owns `/`; if the lookup guard were missing this would
    // either throw or fall through to a screen that is not the empty state.
    isOverview: document.querySelector('.screen-head h1')?.textContent === 'Book overview',
  }));
  ok('it renders the empty state rather than throwing', probe.shell && !probe.isOverview, probe.heading);
  ok(
    'and keeps the rail, so the reader can leave',
    probe.rail === DESTINATIONS.length,
    `${probe.rail} destination tab(s)`,
  );
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
    const elements = [...document.querySelectorAll('md-card, md-chip, md-app-bar, md-navigation-rail')];
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

  // The rail's destinations are `md-navigation-rail-tab[href]` — real anchors
  // inside a shadow root. Clicking one is the case that used to be a full page
  // load, and the reason `Rail.svelte` vetoes the native click.
  //
  // The tab is found by PROPERTY first, attribute second: once the runtime has
  // defined the element, Svelte writes `href` to the element rather than to
  // the markup, and the attribute is gone.
  await page.evaluate((href) => {
    const rail = document.querySelector('.shell__rail');
    const tab = [...rail.querySelectorAll('md-navigation-rail-tab')].find(
      (t) => (t.href ?? t.getAttribute('href')) === href,
    );
    if (!tab) throw new Error(`no rail tab for ${href}`);
    (tab.shadowRoot.querySelector('a, button') ?? tab).click();
  }, `${basePath}${route.holdings()}`);
  await new Promise((r) => setTimeout(r, 1500));

  let probe = await readStamp(page);
  /*
   * The active destination is read from the rail's `active-index`, which is
   * CONTROLLED from the pathname — a property once the element has upgraded,
   * an attribute before, so both are read.
   */
  let where = await page.evaluate(() => {
    const rail = document.querySelector('.shell__rail');
    return {
      path: location.pathname,
      heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)',
      activeIndex: Number(rail?.activeIndex ?? rail?.getAttribute('active-index') ?? -1),
    };
  });
  ok('the rail routes without a reload', probe.stamp === 'alive', probe.stamp);
  ok('exactly one document load so far', probe.navigations === 1, `${probe.navigations}`);
  ok('the URL moved to holdings', where.path === `${basePath}${route.holdings()}`, where.path);
  ok('the holdings screen is on screen', where.heading.length > 0 && where.heading !== 'Book overview', where.heading);
  ok(
    'the rail marks the destination it is on',
    where.activeIndex === DESTINATIONS.findIndex((d) => d.value === 'holdings'),
    `active-index=${where.activeIndex}`,
  );

  // Back to the overview, then a drill anchor — the `<a class="drill">` this
  // build's own Drill renders in the overview's book table.
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => document.querySelector('a.drill').click());
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({ path: location.pathname, crumbs: document.querySelectorAll('md-breadcrumb-item').length }));
  ok('a drill anchor routes without a reload', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('it drilled into a household', /\/households\/hh-\d+\/$/.test(where.path), where.path);
  ok('and the trail appeared', where.crumbs > 1, `${where.crumbs} crumb(s)`);

  // Back, all the way to the overview.
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  where = await page.evaluate(() => ({ path: location.pathname, heading: document.querySelector('.screen-head h1')?.textContent ?? '(none)' }));
  ok('the back button restores the previous screen', where.path === `${basePath}/`, `${where.path} — ${where.heading}`);
  ok('and it did not reload either', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  await page.close();
}

/* ------------------------------------------------------------ locale in place */
/*
 * The locale is client state in this build, not a path segment. Two things
 * have to hold: the URL's `lang` wins on a cold load, and changing it through
 * the dock re-renders rather than navigating.
 */
{
  console.log('\n[locale] switched in place, never routed');
  const page = await load(`${BASE}/?lang=ro`);
  let probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('a cold load honours ?lang=ro', probe.lang === 'ro', `lang=${probe.lang} dir=${probe.dir}`);
  ok('and the screen is actually in Romanian', /Prezentare|Dețineri|Propuneri|Tranzacționare/i.test(probe.text), probe.text.slice(0, 48).replace(/\s+/g, ' '));

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
 * The dock keeps theme, locale, dir, density and accent in the URL so the state
 * can travel — including to whoever a link is sent to. `navigate()` carries the
 * query across an in-app hop for exactly that reason.
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
      label: dock?.label ?? dock?.getAttribute('label'),
      dockHeight: getComputedStyle(document.documentElement).getPropertyValue('--awc-dock-height').trim(),
    };
  });
  const picker = await readDockPicker(page, 'awc-dock-framework');
  ok('the dock is rendered exactly once', probe.count === 1, `${probe.count}`);
  ok('it identifies this build as svelte', probe.framework === 'svelte', probe.framework ?? '(none)');
  // Derived from the kit, not spelled out here. The list grows every time a
  // build is added, and a hardcoded copy would then fail in every app at once
  // while telling us nothing except that the list changed.
  ok(
    `it offers all ${FRAMEWORKS.length} builds`,
    probe.frameworks === FRAMEWORKS.join(','),
    probe.frameworks ?? '(none)',
  );
  // The attribute is only plumbing; what a reader can actually reach is the
  // list of rows md-select rendered from it.
  const values = picker?.options.map((o) => o.value).join(',') ?? '(no picker)';
  ok('every build is selectable', values === FRAMEWORKS.join(','), values);
  ok(
    'this build is the one selected',
    picker?.value === 'svelte' && picker.options.find((o) => o.selected)?.value === 'svelte',
    `value=${picker?.value ?? '(none)'} marked=${picker?.options.find((o) => o.selected)?.value ?? '(nothing)'}`,
  );
  // A framework id with no entry in the dock's label map falls back to its own
  // id with the first letter capitalised. No real display name contains a
  // hyphen, and a blank one counts too.
  const unnamed =
    picker?.options
      .filter((o) => !o.label || o.label.includes('-'))
      .map((o) => o.label || `(blank: ${o.value})`) ?? [];
  ok('every option has a display name, not a raw id', unnamed.length === 0, unnamed.join(', ') || 'all named');
  // The dock's own heading is THIS vertical's, not the fallback that belongs
  // to credit-risk — the `label` prop is required for exactly this reason.
  ok('it is labelled as the Vela app', Boolean(probe.label) && !/credit/i.test(String(probe.label)), String(probe.label ?? '(none)'));
  ok('it is pinned to the bottom and publishes its height', probe.position === 'bottom' && probe.dockHeight !== '', `position=${probe.position} --awc-dock-height=${probe.dockHeight || '(unset)'}`);
  await page.close();
}

await browser.close();
stopServer();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length} assertions${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);

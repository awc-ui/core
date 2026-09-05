#!/usr/bin/env node
/**
 * Does this build actually behave like a single-page application?
 *
 * The claims being tested are the ones this build EXISTS to make, and not one of
 * them survives a type-check or `ng build` finishing cleanly:
 *
 *   - the document that leaves the host is an EMPTY SHELL. Nothing renders this
 *     page ahead of the browser, and the 13 documents on disk are byte-identical
 *     copies of one another.
 *   - a cold deep link still lands on the right screen, because the fan-out put
 *     a real file at every route.
 *   - the components upgrade from a runtime the bundler never touched.
 *   - the router runs in the browser: the rail, the drill anchors and the
 *     back button all move the screen without reloading the document.
 *   - the locale switches in place rather than navigating.
 *
 * `scripts/verify-showcase-parity.mjs` at the repo root already proves this
 * build renders the same DOM as its siblings. It cannot prove any of the above:
 * it measures one screen at a time, from a cold load, which is exactly the case
 * where an SPA and a prerender are indistinguishable. That is the gap this file
 * fills.
 *
 * THE SCREENS ARE PORTED, so every section here runs against real content:
 * [5]'s drill presses a picture in the feed, and [7] switches the profile's
 * tabs. Both were written while the screens were scaffolds and were the two
 * that could not hold until they landed.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-community-angular build
 *   pnpm --filter @awc-ui/showcase-community-angular verify
 *
 * The server it starts is `scripts/serve-dist.mjs`, which has NO history
 * fallback — so "the deep link works" here means the files are really on disk,
 * not that a dev server papered over it.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes, FRAMEWORKS } from '@awc-ui/showcase-kit/community';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4374;
const { framework: FRAMEWORK, basePath, route } = createRoutes('angular');
const BASE = `http://localhost:${PORT}${basePath}`;

/** A kit path as Angular's router spells it back into the address bar. */
const appPath = (path) => (path === '/' ? '/' : path.replace(/\/$/, ''));

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

const results = [];
const ok = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ headless: 'shell' });

/** Load a URL and give the lazy component runtime time to upgrade the elements. */
const load = async (url, wait = 2500) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, wait));
  return page;
};

/*
 * READING AND DRIVING THE DOCK. The bar is made of `@awc-ui/core` components,
 * so its framework and language pickers are `md-select`s: the reachable rows
 * are `md-menu-item`s rendered in md-select's OWN shadow root, one per option,
 * with the id `<trigger>-opt-<value>` — and the picker has to be driven by
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
 * dance in the page: an evaluate whose promise stays pending for seconds is
 * liable to come back "Promise was collected" instead of a result. Every
 * evaluate below returns synchronously.
 */
const pickInDock = async (page, id, value) => {
  // Collapsed on a first visit. The panel keeps its controls in the DOM while
  // hidden, so this asks the disclosure — an md-icon-button — rather than
  // inferring from a missing element.
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

/* ------------------------------ 1. the shell, with JavaScript disabled ------ */
{
  console.log('\n[1] the document the host sent, with JavaScript disabled');
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const probe = await page.evaluate(() => {
    const root = document.querySelector('awc-root');
    return {
      hasRoot: !!root,
      rootChildren: root ? root.childNodes.length : -1,
      elements: document.querySelectorAll('md-card,md-chip,md-table,md-button,md-meter,md-app-bar,md-navigation-rail').length,
      rows: document.querySelectorAll('md-table-row').length,
      shell: !!document.querySelector('.shell'),
      text: document.body.textContent.replace(/\s+/g, ' ').trim(),
      mode: document.querySelector('meta[name="awc-render-mode"]')?.content,
      preboot: !!document.querySelector('[data-awc-preboot]'),
      runtime:
        document.querySelector('[data-awc-runtime]')?.src ??
        '(no [data-awc-runtime] script in the head)',
    };
  });

  ok('the mount point is in the document', probe.hasRoot);
  ok('and it is empty — nothing rendered this page', probe.rootChildren === 0, `${probe.rootChildren} child node(s)`);
  ok('no component markup arrived', probe.elements === 0 && probe.rows === 0, `${probe.elements} md-* element(s), ${probe.rows} row(s)`);
  ok('no screen arrived either', !probe.shell && probe.text === '', probe.text.slice(0, 40) || '(empty body)');
  ok('the render mode says spa', probe.mode === 'spa', String(probe.mode));
  ok('the preboot script is inline in the head', probe.preboot);
  ok('the runtime is requested from the mounted public directory', probe.runtime.endsWith(`${basePath}/awc-runtime/md3/md3.esm.js`), probe.runtime);
  await page.close();
}

/* ------------------------------- 2. the 13 documents are the same document -- */
{
  console.log('\n[2] every route is the same shell, byte for byte');
  const paths = [route.feed(), route.friends(), route.groups(), route.post('pst-04'), route.profile()];
  const bodies = [];
  for (const path of paths) {
    const response = await fetch(`${BASE}${path}`);
    bodies.push({ path, status: response.status, body: await response.text() });
  }
  const [first, ...rest] = bodies;
  ok('every route is a real file on disk', bodies.every((b) => b.status === 200), bodies.filter((b) => b.status !== 200).map((b) => `${b.path} ${b.status}`).join(', ') || `${bodies.length}/${bodies.length}`);
  const differing = rest.filter((b) => b.body !== first.body).map((b) => b.path);
  ok('and identical to the feed shell', differing.length === 0, differing.join(', ') || `${rest.length} compared`);
  ok('the shell carries no screen content', !first.body.includes('shell__appbar'), `${(Buffer.byteLength(first.body) / 1024).toFixed(2)} kB`);

  // A path that is NOT a route reaches the app only where the host rewrites. On
  // this deliberately dumb server it must 404, which is what proves the server
  // is not quietly helping.
  const missing = await fetch(`${BASE}/no-such-screen/`);
  ok('an unknown path 404s on a server with no rewrite', missing.status === 404, `HTTP ${missing.status}`);
}

/* ----------------------------------------- 3. cold deep links reach the screen */
{
  console.log('\n[3] a cold deep link boots straight into its screen');
  const paths = [
    route.feed(),
    route.friends(),
    route.groups(),
    route.events(),
    route.profile(),
    route.post('pst-04'),
    route.person('camille.farrow'),
    route.group('nordic-film-club'),
    route.event('harbour-night-screening'),
  ];
  for (const path of paths) {
    const page = await load(`${BASE}${path}`, 1500);
    const probe = await page.evaluate(() => ({
      rendered: !!document.querySelector('.shell'),
      heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '(none)',
      path: location.pathname,
    }));
    ok(`${path} renders on a cold load`, probe.rendered && probe.heading !== '(none)', probe.heading);
    // Angular normalises the trailing slash away on its first navigation, so the
    // address bar settles on the un-slashed spelling. The file stays where the
    // fan-out put it; `scripts/serve-dist.mjs` resolves the directory, exactly
    // as a static host does.
    ok(`  …and the URL settles on ${appPath(path)}`, probe.path === `${basePath}${appPath(path)}`, probe.path);
    await page.close();
  }
}

/* ------------------------------------------ 4. the components are upgraded */
{
  console.log('\n[4] the components upgrade and the charts paint');
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 90000 });
  // The app bar is chrome, so it exists on every screen — stubs included.
  await page.waitForFunction(
    () => document.querySelector('md-app-bar')?.classList.contains('hydrated'),
    { timeout: 60000 },
  );
  await new Promise((r) => setTimeout(r, 2500));

  const probe = await page.evaluate(`(() => {
    const els = [...document.querySelectorAll('md-card,md-chip,md-table,md-bar-chart,md-line-chart,md-area-chart,md-pie-chart,md-sparkline,md-button,md-status-dot,md-meter,md-app-bar,md-navigation-rail,md-fab')];
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
      shadowed: els.filter((e) => e.shadowRoot).length,
      zeroHeight: [...els, document.querySelector('awc-showcase-dock')]
        .filter((e) => e && e.getBoundingClientRect().height === 0)
        .map((e) => e.tagName.toLowerCase()),
      charts: charts.length,
      painted: charts.filter((ch) => [...(ch.shadowRoot?.querySelectorAll('canvas') ?? [])].some(isPainted)).length,
    };
  })()`);

  ok('every sampled md-* element has a shadow root', probe.total > 0 && probe.shadowed === probe.total, `${probe.shadowed}/${probe.total}`);
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('nothing renders at zero height', probe.zeroHeight.length === 0, probe.zeroHeight.join(',') || 'none');
  ok('every chart painted its plot', probe.painted === probe.charts, `${probe.painted}/${probe.charts}`);
  ok('no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

/* ------------------------------------------------ 5. routing in the browser */
const STAMP = () => {
  window.__awcSpaStamp = 'alive';
};
const readStamp = (page) =>
  page.evaluate(() => ({
    stamp: window.__awcSpaStamp ?? '(gone — the document reloaded)',
    navigations: performance.getEntriesByType('navigation').length,
  }));

{
  console.log('\n[5] the document is never reloaded');
  const page = await load(`${BASE}/`);
  await page.evaluate(STAMP);

  // The rail tab carries a real `href` inside its shadow root — the case that
  // would otherwise be a full page load, and the reason RailComponent vetoes
  // the native click.
  await page.evaluate(() => {
    const tab = document.querySelector('md-navigation-rail-tab[value="friends"]');
    (tab.shadowRoot?.querySelector('a, button') ?? tab).click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  let probe = await readStamp(page);
  let where = await page.evaluate(() => ({
    path: location.pathname,
    heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '(none)',
    activeIndex: document.querySelector('md-navigation-rail')?.getAttribute('active-index'),
  }));
  ok('the rail routes without a reload', probe.stamp === 'alive', probe.stamp);
  ok('exactly one document load so far', probe.navigations === 1, `${probe.navigations}`);
  ok('the URL moved to friends', where.path === `${basePath}${appPath(route.friends())}`, where.path);
  ok('the friends screen is on screen', where.heading !== '(none)', where.heading);
  ok('the rail marks the destination it is on', where.activeIndex === '1', `active-index=${where.activeIndex}`);

  /* Back to the feed through the rail (a third history entry), then a drill
     anchor. This vertical has no `<a class="drill">` — its drills are pictures,
     and the anchor around one is `.post-media__link`. */
  await page.evaluate(() => {
    const tab = document.querySelector('md-navigation-rail-tab[value="feed"]');
    (tab.shadowRoot?.querySelector('a, button') ?? tab).click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const drilled = await page.evaluate(() => {
    const drill = document.querySelector('a.when');
    if (!drill) return false;
    drill.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  let drillWhere = await page.evaluate(() => ({ path: location.pathname, crumbs: document.querySelectorAll('md-breadcrumb-item').length }));
  ok('a drill anchor routes without a reload', drilled && probe.stamp === 'alive' && probe.navigations === 1, drilled ? `${probe.stamp}, ${probe.navigations} navigation(s)` : '(no picture link on the feed)');
  ok('it drilled into a post', /\/p\/pst-[^/]+$/.test(drillWhere.path), drillWhere.path);
  ok('and the trail appeared', drillWhere.crumbs > 1, `${drillWhere.crumbs} crumb(s)`);

  // Back, to the feed entry the rail click wrote.
  await page.goBack();
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  const back = await page.evaluate(() => ({ path: location.pathname, heading: document.querySelector('.screen-head h1')?.textContent?.trim() ?? '(none)' }));
  ok('the back button restores the previous screen', back.path === `${basePath}/`, `${back.path} — ${back.heading}`);
  ok('and it did not reload either', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  await page.close();
}

/* ------------------------------------------------------------ 6. the locale */
{
  console.log('\n[6] the locale is switched in place, never routed');
  const page = await load(`${BASE}/?lang=ro`);
  let probe = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('a cold load honours ?lang=ro', probe.lang === 'ro', `lang=${probe.lang} dir=${probe.dir}`);
  ok('and the screen is actually in Romanian', /Prieteni|Grupuri|Evenimente/i.test(probe.text), probe.text.slice(0, 48).replace(/\s+/g, ' '));

  await page.evaluate(STAMP);
  // Arabic, through the dock's own picker, which is what a reader clicks.
  const drove = await pickInDock(page, 'awc-dock-locale', 'ar');
  await new Promise((r) => setTimeout(r, 1500));
  probe = await readStamp(page);
  const after = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    path: location.pathname,
    text: document.querySelector('.shell')?.innerText ?? '',
  }));
  ok('the dock exposes a locale picker', drove);
  ok('it switches locale without a reload', probe.stamp === 'alive' && probe.navigations === 1, `${probe.stamp}, ${probe.navigations} navigation(s)`);
  ok('<html> follows to ar / rtl', after.lang === 'ar' && after.dir === 'rtl', `lang=${after.lang} dir=${after.dir}`);
  ok('the path is untouched — no /ar/ segment', after.path === `${basePath}/`, after.path);
  ok('and the strings re-rendered in Arabic', /[؀-ۿ]/.test(after.text), after.text.slice(0, 40).replace(/\s+/g, ' '));
  await page.close();
}

/* ------------------------------------------ 7. the six reactions */
/*
 * THIS SLOT HELD A PROFILE-TABS SUITE, ported from Lyra, and there are no tabs
 * anywhere in this vertical to point it at — Corvus's profile is a timeline
 * with an about panel beside it.
 *
 * What replaces it is the interaction this app is actually built around, and
 * the one a boolean-like port would get wrong: six reactions with a SWITCH.
 * Moving from one to another has to leave the total alone, because a reader who
 * changes their mind has not reacted twice. `reactionSummary()` in the kit does
 * that arithmetic so five builds cannot each get it slightly different, and
 * this presses it.
 */
{
  console.log('\n[7] reactions switch without double-counting');
  const page = await load(`${BASE}/`);

  const before = await page.evaluate(() => {
    const card = document.querySelector('.post-card');
    return {
      options: card.querySelectorAll('.react__option').length,
      total: card.querySelector('.reactions__count')?.textContent?.trim(),
    };
  });
  ok('six reactions are offered', before.options === 6, `${before.options} options`);

  const pick = async (kind) => {
    await page.evaluate((k) => {
      document.querySelector(`.post-card .react__option[data-reaction="${k}"]`).click();
    }, kind);
    await new Promise((r) => setTimeout(r, 400));
    return page.evaluate(() => {
      const card = document.querySelector('.post-card');
      return {
        total: card.querySelector('.reactions__count')?.textContent?.trim(),
        on: [...card.querySelectorAll('.react__option[data-on]')].map((b) =>
          b.getAttribute('data-reaction'),
        ),
      };
    });
  };

  const loved = await pick('love');
  ok('picking one marks it and moves the total', loved.on.join() === 'love' && loved.total !== before.total,
    `${before.total} -> ${loved.total}`);

  const laughed = await pick('haha');
  ok('switching moves the mark', laughed.on.join() === 'haha');
  /* THE ONE THAT MATTERS. */
  ok('and does NOT change the total', laughed.total === loved.total,
    `${loved.total} -> ${laughed.total}`);

  const cleared = await pick('haha');
  ok('un-reacting restores the original total', cleared.total === before.total && cleared.on.length === 0,
    `${before.total} -> ${cleared.total}`);
  await page.close();
}

/* -------------------------------------------------------------- 8. the dock */
{
  console.log(`\n[8] one bar, ${FRAMEWORKS.length} frameworks, this one marked`);
  const page = await load(`${BASE}/`);
  const probe = await page.evaluate(() => {
    const docks = document.querySelectorAll('awc-showcase-dock');
    const dock = docks[0];
    return {
      count: docks.length,
      framework: dock?.getAttribute('framework'),
      frameworks: dock?.getAttribute('frameworks'),
      position: dock?.getAttribute('position'),
      label: dock?.getAttribute('label'),
      dockHeight: getComputedStyle(document.documentElement).getPropertyValue('--awc-dock-height').trim(),
    };
  });
  const picker = await readDockPicker(page, 'awc-dock-framework');
  ok('the dock is rendered exactly once', probe.count === 1, `${probe.count}`);
  ok(`it identifies this build as ${FRAMEWORK}`, probe.framework === FRAMEWORK, probe.framework ?? '(none)');
  ok(`it offers all ${FRAMEWORKS.length} builds`, probe.frameworks === FRAMEWORKS.join(','), probe.frameworks ?? '(none)');
  const values = picker?.options.map((o) => o.value).join(',') ?? '(no picker)';
  ok('every build is selectable', values === FRAMEWORKS.join(','), values);
  ok(
    'this build is the one selected',
    picker?.value === FRAMEWORK && picker.options.find((o) => o.selected)?.value === FRAMEWORK,
    `value=${picker?.value ?? '(none)'} marked=${picker?.options.find((o) => o.selected)?.value ?? '(nothing)'}`,
  );
  const unnamed =
    picker?.options
      .filter((o) => !o.label || o.label.includes('-'))
      .map((o) => o.label || `(blank: ${o.value})`) ?? [];
  ok('every option has a display name, not a raw id', unnamed.length === 0, unnamed.join(', ') || 'all named');
  // `label` names the dock for THIS vertical; without it the dock announces the
  // credit-risk console's title, which is the shared component's fallback.
  ok('the dock is labelled for the Lyra app', !!probe.label, probe.label ?? '(none)');
  ok('it is pinned to the bottom and publishes its height', probe.position === 'bottom' && probe.dockHeight !== '', `position=${probe.position} --awc-dock-height=${probe.dockHeight || '(unset)'}`);
  await page.close();
}

await browser.close();
stopServer();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length} assertions${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);

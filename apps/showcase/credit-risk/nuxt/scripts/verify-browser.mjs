/**
 * Does the Nuxt build actually work in a browser?
 *
 * None of these claims survives a type-check, and none of them is what
 * `scripts/verify-ssr.mjs` at the repo root asks. That harness proves the
 * server renders, and renders per request, with `fetch` and no browser at all.
 * This one proves the result is a working application: the server-rendered HTML
 * arrives with real rows, real numbers and real shadow roots rather than a
 * loading state, the components adopt those shadow roots and the charts paint,
 * the dock's language switch re-renders every string IN PLACE with no
 * navigation, the tables sort and page through the selector that owns the data,
 * and client routing keeps the page rather than reloading the document. The two
 * halves are complementary: an app can pass one and fail the other.
 *
 * Starts the REAL server — `server.mjs`, the same one `pnpm start` runs, on a
 * port of its own so it does not collide with one you already have up. So it
 * needs nothing running:
 *   pnpm --filter @awc-ui/showcase-credit-risk-nuxt build
 *   pnpm --filter @awc-ui/showcase-credit-risk-nuxt verify
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath: BASE_PATH } = createRoutes('nuxt');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4342;
const BASE = `http://localhost:${PORT}${BASE_PATH}`;

const server = spawn(process.execPath, [join(appRoot, 'server.mjs')], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, PORT: String(PORT), NITRO_PORT: String(PORT) },
});

/*
 * Wait for the port to ANSWER, not for the process to say something.
 *
 * The static file server this replaced printed one line and was immediately
 * ready, so waiting on the first byte of stdout was the same thing. A Nitro
 * server logs while it is still coming up, and puppeteer arriving a few
 * milliseconds early gets ECONNREFUSED and reports it as a broken page. So the
 * readiness check is a request, the same one `scripts/verify-ssr.mjs` uses.
 */
const ready = await (async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
})();
if (!ready) {
  server.kill();
  console.error(`[verify] server did not answer on ${BASE}/ — is the build there?`);
  process.exit(1);
}

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

/*
 * A census of what each component holds INSIDE its shadow root, keyed
 * `tag:count`. It is a source STRING rather than a function because it is
 * injected into two different page contexts — the JavaScript-disabled load in
 * block [1] and the live one in block [2] — and compared across them.
 *
 * `<style>` is excluded deliberately. The server writes each component's CSS
 * inline inside the declarative shadow root; once the runtime is up it adopts a
 * constructable stylesheet instead and drops that element. It is the one node
 * that legitimately disappears between the two measurements, and counting it
 * would make every component look like it changed.
 */
const SHADOW_CENSUS = `(() => {
  const out = {};
  for (const el of document.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (!tag.startsWith('md-') || !el.shadowRoot) continue;
    const key = tag + ':' + el.shadowRoot.querySelectorAll('*:not(style)').length;
    out[key] = (out[key] || 0) + 1;
  }
  return out;
})()`;

/**
 * The charts are the one place the two censuses legitimately disagree: a canvas
 * cannot be painted without a canvas context, so what the server sends is the
 * frame and the runtime adds the plot when it draws. That is the documented
 * limit of this build, not a regression, so these tags are excluded from the
 * comparison rather than the comparison being weakened for everything.
 */
const CANVAS_BACKED = /^md-(bar|line|area)-chart$|^md-sparkline$/;

/** Block [1]'s census, compared against block [2]'s. */
let servedShadowCensus = {};

/* ---------------- 1. the server's HTML carries real content ---------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /*
   * The shadow-root count is the check this build could not make before.
   * Declarative shadow DOM is a PARSER feature: `<template shadowrootmode>` is
   * turned into a real shadow root while the document is being read, with
   * JavaScript disabled and Stencil's runtime never loaded. So a non-zero count
   * here can only mean the markup arrived with the components already rendered
   * — which is exactly what `server/plugins/awc-ssr-dsd.ts` claims to do.
   */
  /*
   * `shadowCensus` is taken HERE, where the only thing that can possibly have
   * built these shadow roots is the HTML parser reading the server's
   * `<template shadowrootmode>` — the runtime never loaded. Block [2] takes the
   * same census with the runtime up and requires it to be unchanged.
   */
  const probe = await page.evaluate(`(() => ({
    rows: document.querySelectorAll('md-table-body md-table-row').length,
    figures: /€|EUR/.test(document.body.textContent),
    named: document.body.textContent.includes('Aurelia'),
    shadowRoots: [...document.querySelectorAll('md-card,md-chip,md-table,md-meter,md-button')].filter(
      (el) => el.shadowRoot,
    ).length,
    shadowCensus: ${SHADOW_CENSUS},
  }))()`);
  servedShadowCensus = probe.shadowCensus;
  console.log('\n[1] the HTML the server sent, with JavaScript disabled');
  ok('the counterparty page is in the HTML', probe.rows === 10, `${probe.rows} rows (page 1 of 24)`);
  ok('the figures are in the HTML', probe.figures);
  ok('the headline content is there', probe.named);
  ok(
    'the components arrived with their shadow roots',
    probe.shadowRoots > 0,
    `${probe.shadowRoots} declarative shadow roots`,
  );
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
      shadowCensus: ${SHADOW_CENSUS},
    };
  })()`);

  /*
   * DID THE RUNTIME ADOPT THE SERVER'S SHADOW ROOTS, OR RENDER INTO THEM AGAIN?
   *
   * This is the assertion this file was missing, and the omission shipped a
   * real bug. `server/plugins/awc-ssr-dsd.ts` used to set
   * `clientHydrateAnnotations: false`, which strips the `s-id` attribute the
   * runtime uses to recognise a shadow root it rendered. Not recognising it,
   * the runtime rendered a SECOND copy of every component into the shadow root
   * the parser had already filled — it appends, it does not replace. Every
   * button then had two anchors and every chip two labels, so the nav read
   * "Overview" twice and drew 154px wide where the other builds draw 118px,
   * with two tab stops per button and two announcements for a screen reader.
   *
   * Every other check in this file passed while that was true: the components
   * upgraded, nothing was zero-height, the charts painted, the tables sorted.
   * None of them counts what is inside a shadow root, and that is exactly the
   * blind spot — the page looked right at a glance and was wrong everywhere.
   *
   * Comparing block [1]'s census against this one is what closes it: block [1]
   * measured the server's markup with JavaScript disabled, so any component
   * that gained nodes once the runtime arrived was rendered twice.
   */
  const tags = new Set([...Object.keys(servedShadowCensus), ...Object.keys(probe.shadowCensus)]);
  const drift = [...tags]
    .filter((key) => !CANVAS_BACKED.test(key.split(':')[0]))
    .filter((key) => (servedShadowCensus[key] ?? 0) !== (probe.shadowCensus[key] ?? 0))
    .map((key) => `${key} ${servedShadowCensus[key] ?? 0}->${probe.shadowCensus[key] ?? 0}`);

  console.log('\n[2] with JavaScript enabled');
  ok('every component upgraded', probe.hydrated === probe.total, `${probe.hydrated}/${probe.total}`);
  ok('nothing renders at zero height', probe.zeroHeight.length === 0, probe.zeroHeight.join(','));
  ok('every chart painted its plot', probe.painted === probe.charts, `${probe.painted}/${probe.charts}`);
  ok(
    'the dock is present, and every control it built upgraded',
    probe.dock !== null && probe.dock.total > 0 && probe.dock.upgraded === probe.dock.total,
    probe.dock ? `${probe.dock.upgraded}/${probe.dock.total}` : '(no dock)',
  );
  ok(
    'the runtime adopted the server\'s shadow roots rather than rendering into them twice',
    drift.length === 0,
    drift.slice(0, 4).join(', ') || `${Object.keys(servedShadowCensus).length} component shapes unchanged`,
  );
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

  // Drive the dock's own locale picker, the same control a human uses: open the
  // menu, click the row. It sits inside the dock's shadow root, behind the
  // collapse toggle on a first visit — `pickInDock` handles both.
  const drove = await pickInDock(page, 'awc-dock-locale', 'ro');
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
   * Vue sets data on an upgraded custom element through its property when one
   * exists — so a row that came from the server carries `value="cp-01"` in the
   * markup, while a row created on the client after a sort or a page change
   * may carry only the property. Both reach the component identically. An
   * attribute-only assertion cannot tell them apart: it reports a perfectly
   * working table as `cp-21 → null`, which looks like a pass and proves
   * nothing.
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

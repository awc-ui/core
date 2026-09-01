/**
 * Does the plain-HTML build actually work in a browser?
 *
 * The claims being tested are the ones this build exists to make, and none of
 * them is something a renderer test would have caught: the whole console is
 * readable before any JavaScript runs, the components upgrade cleanly on top of
 * the pre-rendered markup, the shell chrome is complete on every page, the
 * three locale trees are genuinely translated, and a stale locale in storage
 * loses to the language the page is written in.
 *
 * SCOPE, for now: this suite covers the SCAFFOLD — frame, dock, locale trees.
 * The screens phase extends it with the per-screen checks the credit-risk twin
 * carries (chart axes applied, tables paging, filters detaching rows, and so
 * on) once there is screen content to point them at.
 *
 * Starts its own server, so it needs nothing running:
 *   pnpm --filter @awc-ui/showcase-wealth-html build
 *   pnpm --filter @awc-ui/showcase-wealth-html verify
 */
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BASE_PATH } from '../src/lib/i18n.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4341;
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

const browser = await puppeteer.launch({ headless: 'shell' });

/* ------------------- 1. the console is readable without JS ----------------- */
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const probe = await page.evaluate(() => ({
    brand: document.title.includes('Kestrel'),
    appBar: !!document.querySelector('md-app-bar.shell__appbar'),
    railTabs: document.querySelectorAll('md-navigation-rail-tab').length,
    barTabs: document.querySelectorAll('md-navigation-bar md-navigation-tab').length,
    heading: (document.querySelector('.screen-head h1')?.textContent ?? '').trim().length > 0,
    // Every destination href is absolute and carries the mount prefix; a bare
    // path would resolve against the wrong base three directories down.
    hrefsPrefixed: [...document.querySelectorAll('md-navigation-rail-tab')].every((tab) =>
      (tab.getAttribute('href') || '').startsWith('/showcase/wealth/html/'),
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
      (tab.getAttribute('href') || '').startsWith('/showcase/wealth/html/ar/'),
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
  await page.goto(`${BASE}/ro/holdings/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('awc:showcase:v1', JSON.stringify({ locale: 'ro', dir: 'ltr', theme: 'dark' }));
  });
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

await browser.close();
server.kill();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

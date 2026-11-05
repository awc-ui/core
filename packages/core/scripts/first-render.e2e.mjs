/**
 * Real-browser first-paint regression checks against the built lazy library.
 * Run after a Core build: pnpm --filter @awc-ui/core test:first-render
 * PUPPETEER_EXECUTABLE_PATH can select an already installed Chromium.
 * This suite does not collect or overwrite code-coverage evidence.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer';

const core = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(core, 'dist');
const tags = (await readdir(path.join(core, 'src/components')))
  .filter(tag => tag.startsWith('md-')).sort();
let browser, server, origin;
let releaseChunks = () => {};
let chunksReady = Promise.resolve();
let releaseChildChunks = () => {};
let childChunksReady = Promise.resolve();
let delayedChildEntry = '/md-icon-button.entry.js';
const errors = [];

before(async () => {
  // Fail with a useful error before launching a browser if the build is missing.
  await readFile(path.join(dist, 'md3/md3.css'));
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        // First-paint CSS needs no inline permission. The live Stencil shadow
        // styles in the second test use the same policy as the browser harness.
        res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'${url.searchParams.has('runtime') ? " 'unsafe-inline'" : ''};`);
        res.end(`<!doctype html><html><head><link rel="stylesheet" href="/md3/md3.css">
          <link rel="stylesheet" href="/fixture.css"></head><body>
          <md-app-bar id="bar"><span slot="headline">Workspace</span><md-icon-button slot="trailing" icon="home"></md-icon-button></md-app-bar>
          <p id="after-bar">Content below the app bar</p>
          <md-button id="action"><span id="forced-visible">Continue</span></md-button>
          <md-card id="nested"><md-button>Nested action</md-button></md-card>
          <md-button id="author-hidden" class="author-hidden">Intentionally hidden</md-button>
          <md-app-bar id="hidden-bar" hidden>Hidden bar</md-app-bar>
          <div id="ordinary">Ordinary content</div>
          ${url.searchParams.has('dialog') ? `<md-dialog id="dialog" open headline="Dialog">
            <span id="dialog-content" style="visibility:visible">Authored visible content</span>
            <span id="dialog-hidden" style="visibility:hidden">Authored hidden content</span>
          </md-dialog>` : ''}
          ${url.searchParams.has('layout') ? `
          <md-app-bar data-layout-fixture id="small" headline="Small"></md-app-bar>
          <md-app-bar data-layout-fixture id="medium" variant="medium" headline="Medium"></md-app-bar>
          <md-app-bar data-layout-fixture id="large" variant="large" headline="Large" subtitle="Subtitle"></md-app-bar>
          <md-app-bar data-layout-fixture id="dense-bar" density="-2" headline="Dense"></md-app-bar>
          <md-breadcrumbs data-layout-fixture id="trail"><md-breadcrumb-item>Library</md-breadcrumb-item><md-breadcrumb-item current>Button</md-breadcrumb-item></md-breadcrumbs>
          <md-breadcrumbs data-layout-fixture id="dense-trail" density="-2"><md-breadcrumb-item>Library</md-breadcrumb-item><md-breadcrumb-item current>Button</md-breadcrumb-item></md-breadcrumbs>
          <md-breadcrumbs data-layout-fixture id="padded-trail" class="padded-trail"><md-breadcrumb-item current>Button</md-breadcrumb-item></md-breadcrumbs>
          <md-breadcrumbs data-layout-fixture id="empty-trail"></md-breadcrumbs>
          <md-tabs data-layout-fixture id="tabs"><md-tab label="One"></md-tab><md-tab label="Two"></md-tab></md-tabs>
          <md-tabs data-layout-fixture id="stacked-tabs"><md-tab icon="home" label="Home"></md-tab><md-tab label="Other"></md-tab></md-tabs>
          <md-tabs data-layout-fixture id="secondary-tabs" variant="secondary"><md-tab icon="home" label="Home"></md-tab></md-tabs>
          <md-tabs data-layout-fixture id="dense-tabs"><md-tab density="-2" label="One"></md-tab><md-tab density="-2" label="Two"></md-tab></md-tabs>
          <md-tabs data-layout-fixture id="empty-tabs"></md-tabs>` : ''}
          </body></html>`);
        return;
      }
      if (url.pathname === '/fixture.css') {
        res.setHeader('Content-Type', 'text/css');
        res.end(`body{margin:0;font-family:Arial,sans-serif}
          #bar{--md-app-bar-row-height:75px;border-bottom:1px solid black}
          #forced-visible{visibility:visible!important}
          .padded-trail{--md-breadcrumb-item-padding:3px 10px}
          .author-hidden{visibility:hidden}
          [hidden]{display:none!important}`);
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(dist, relative);
      if (!file.startsWith(`${dist}${path.sep}`)) throw new Error('Invalid path');
      if (relative.endsWith('.entry.js')) await chunksReady;
      if (relative.endsWith(delayedChildEntry)) await childChunksReady;
      const body = await readFile(file);
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}) });
});

test('navigation reservations survive registration and match rendered default, dense and padded layouts', async () => {
  chunksReady = new Promise(resolve => { releaseChunks = resolve; });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?runtime&layout`);
    const heights = () => page.$$eval('[data-layout-fixture]', nodes =>
      Object.fromEntries(nodes.map(el => [el.id, el.getBoundingClientRect().height])));
    const before = await heights();
    await page.addScriptTag({ type: 'module', url: `${origin}/md3/md3.esm.js` });
    await page.waitForFunction(() => !!customElements.get('md-breadcrumbs') && !!customElements.get('md-tabs'));
    assert.deepEqual(await heights(), before, 'empty shadow roots keep the reserved geometry');
    releaseChunks();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-layout-fixture]')]
      .every(el => el.classList.contains('hydrated')));
    const ready = await heights();
    const mismatches = Object.entries(before).filter(([id, height]) => Math.abs(ready[id] - height) >= 0.1)
      .map(([id, height]) => `${id}: reserved ${height}px, rendered ${ready[id]}px`);
    assert.deepEqual(mismatches, []);
  } finally { releaseChunks(); await page.close(); }
});
after(async () => {
  releaseChunks();
  releaseChildChunks();
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
});

test('a rendered parent waiting for a slow child does not reserve its row twice', async () => {
  chunksReady = Promise.resolve();
  childChunksReady = new Promise(resolve => { releaseChildChunks = resolve; });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?runtime`);
    const height = () => page.$eval('#bar', el => el.getBoundingClientRect().height);
    const initial = await height();
    await page.addScriptTag({ type: 'module', url: `${origin}/md3/md3.esm.js` });
    await page.waitForFunction(() => document.querySelector('#bar').classList.contains('md-app-bar'));
    assert.equal(await page.$eval('#bar', el => el.classList.contains('hydrated')), false);
    assert.equal(await height(), initial, 'real row replaces its placeholder before aggregate readiness');
    releaseChildChunks();
    await page.waitForFunction(() => document.querySelector('#bar').classList.contains('hydrated'));
    assert.equal(await height(), initial);
  } finally { releaseChildChunks(); await page.close(); }
});

test('display:contents hosts conceal explicitly visible slotted content until their children are ready', async () => {
  chunksReady = Promise.resolve();
  delayedChildEntry = '/md-button.entry.js';
  childChunksReady = new Promise(resolve => { releaseChildChunks = resolve; });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?runtime&dialog`);
    await page.addScriptTag({ type: 'module', url: `${origin}/md3/md3.esm.js` });
    await page.waitForFunction(() => document.querySelector('#dialog').classList.contains('md-dialog'));
    const pending = await page.$eval('#dialog', host => ({
      display: getComputedStyle(host).display,
      ready: host.classList.contains('hydrated'),
      contentVisibility: getComputedStyle(host.querySelector('#dialog-content')).visibility,
    }));
    assert.deepEqual(pending, { display: 'contents', ready: false, contentVisibility: 'hidden' });
    releaseChildChunks();
    await page.waitForFunction(() => document.querySelector('#dialog').classList.contains('hydrated'));
    assert.equal(await page.$eval('#dialog-content', el => getComputedStyle(el).visibility), 'visible');
    assert.equal(await page.$eval('#dialog-hidden', el => getComputedStyle(el).visibility), 'hidden');
  } finally {
    releaseChildChunks();
    delayedChildEntry = '/md-icon-button.entry.js';
    await page.close();
  }
});

test('the shipped stylesheet gates every component before registration without hiding ordinary content', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const result = await page.evaluate(tags => {
      const states = tags.map(tag => {
        const host = document.createElement(tag);
        host.textContent = 'Raw component text';
        document.body.append(host);
        const before = getComputedStyle(host);
        const pending = { visibility: before.visibility, opacity: before.opacity };
        host.classList.add('hydrated');
        const ready = { visibility: getComputedStyle(host).visibility, opacity: getComputedStyle(host).opacity };
        host.remove();
        return { tag, pending, ready };
      });
      return { states, ordinary: getComputedStyle(document.querySelector('#ordinary')).visibility };
    }, tags);
    assert.equal(result.ordinary, 'visible');
    for (const { tag, pending, ready } of result.states) {
      assert.equal(pending.visibility, 'hidden', tag);
      assert.equal(pending.opacity, '0', `${tag}: authored descendants cannot paint through the gate`);
      assert.deepEqual(ready, { visibility: 'visible', opacity: '1' }, `${tag}: no blanket readiness reset`);
    }
  } finally { await page.close(); }
});

test('registered lazy hosts stay concealed and retain the app-bar row until their chunks render', async () => {
  chunksReady = new Promise(resolve => { releaseChunks = resolve; });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/?runtime`);
    const measure = () => page.evaluate(() => {
      const bar = document.querySelector('#bar');
      const action = document.querySelector('#action');
      return {
        markerTop: document.querySelector('#after-bar').getBoundingClientRect().top,
        defined: !!customElements.get('md-app-bar'),
        ready: bar.classList.contains('hydrated'),
        hiddenBar: document.querySelector('#hidden-bar').getBoundingClientRect().height,
        actionOpacity: getComputedStyle(action).opacity,
        childVisibility: getComputedStyle(document.querySelector('#forced-visible')).visibility,
        ordinaryVisibility: getComputedStyle(document.querySelector('#ordinary')).visibility,
      };
    });
    const before = await measure();
    assert.equal(before.childVisibility, 'visible', 'fixture really overrides inherited visibility before upgrade');
    await page.addScriptTag({ type: 'module', url: `${origin}/md3/md3.esm.js` });
    await page.waitForFunction(() => !!customElements.get('md-app-bar'));
    const defined = await measure();
    assert.equal(defined.defined, true);
    assert.equal(defined.ready, false);
    assert.equal(defined.actionOpacity, '0');
    assert.equal(defined.hiddenBar, 0);
    assert.equal(defined.ordinaryVisibility, 'visible');
    assert.equal(defined.markerTop, before.markerTop, 'registration must not collapse the app-bar row');
    releaseChunks();
    await page.waitForFunction(() => ['bar', 'action', 'nested', 'author-hidden']
      .every(id => document.getElementById(id).classList.contains('hydrated')));
    const ready = await measure();
    assert.equal(ready.markerTop, before.markerTop, 'rendered app-bar must fit its reserved row');
    assert.equal(ready.actionOpacity, '1');
    assert.equal(ready.hiddenBar, 0);
    assert.equal(await page.$eval('#author-hidden', el => getComputedStyle(el).visibility), 'hidden');
    assert.deepEqual(errors, []);
  } finally { releaseChunks(); await page.close(); }
});

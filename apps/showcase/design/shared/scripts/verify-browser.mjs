#!/usr/bin/env node
/**
 * Exercise the built Pictor app using real browser input.
 * Usage: node apps/showcase/design/shared/scripts/verify-browser.mjs <framework>
 * Build @awc-ui/showcase-design-<framework> first. Every port runs these checks.
 * A private server, browser context, profile and cache prevent existing sessions
 * or a running dev server from making these checks pass accidentally.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { CANVAS_COLS, CANVAS_ROWS, createRoutes, getFiles } from '@awc-ui/showcase-kit/design';

const framework = process.argv[2];
const frameworks = ['html', 'react', 'vue', 'svelte', 'angular'];
if (!frameworks.includes(framework) || process.argv.length !== 3) {
  throw new Error(`Usage: node shared/scripts/verify-browser.mjs <${frameworks.join('|')}>`);
}
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..', framework);
const builtEntry = join(appRoot, framework === 'angular' ? 'dist/browser/index.html' : 'dist/index.html');
const { basePath } = createRoutes(framework);
const cacheKey = 'awc:pictor:documents:v1';
const layerSelector = '.artboard .layer[data-layer]';
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const timeout = 30000;
const artifacts = process.env.PICTOR_VERIFY_ARTIFACTS && resolve(process.env.PICTOR_VERIFY_ARTIFACTS);
const scratch = await mkdtemp(join(tmpdir(), `pictor-${framework}-browser-`));
let server;
let browser;
let page;
let serverOutput = '';
let checks = 0;
const browserErrors = [];

async function until(predicate, label, duration = timeout) {
  const end = Date.now() + duration;
  do {
    const result = await predicate();
    if (result) return result;
    await delay(100);
  } while (Date.now() < end);
  throw new Error(`Timed out: ${label}`);
}

async function check(label, action) {
  await action();
  checks += 1;
  console.log(`  ok  ${label}`);
}

async function freePort() {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise((done, reject) => reservation.close(error => error ? reject(error) : done()));
  return port;
}

async function ready(selector = '[data-editor]') {
  await page.waitForSelector(selector, { visible: true });
  await page.waitForFunction(() => !document.querySelector('.screen-body[data-placeholder]'));
}

async function pressShortcut(key, shift = false) {
  await page.keyboard.down(modifier);
  if (shift) await page.keyboard.down('Shift');
  try { await page.keyboard.press(key); }
  finally {
    if (shift) await page.keyboard.up('Shift');
    await page.keyboard.up(modifier);
  }
}

async function click(selector) {
  await page.waitForSelector(selector, { visible: true });
  // Hydration is checked on the actual control, not an unrelated component.
  await page.waitForFunction(s => {
    const element = document.querySelector(s);
    return element && (!element.tagName.startsWith('MD-') || element.classList.contains('hydrated'));
  }, {}, selector);
  await page.click(selector);
}

async function clickLabel(selector, label) {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    if (await handle.evaluate((element, text) => element.textContent.trim() === text, label)) {
      await handle.click();
      return;
    }
  }
  throw new Error(`Missing visible action: ${label} (${selector})`);
}

async function command(label) {
  await pressShortcut('k');
  const input = '.pictor-command-dialog input[role="combobox"]';
  await page.waitForSelector(input, { visible: true });
  await page.waitForFunction(selector => document.querySelector(selector)?.value === '', {}, input);
  await page.click(input);
  await page.type(input, label);
  await page.waitForFunction(text => [...document.querySelectorAll('.pictor-command-item strong')].some(item => item.textContent === text), {}, label);
  const matches = await page.$$('.pictor-command-item');
  for (const match of matches) {
    if (await match.evaluate((element, text) => element.querySelector('strong')?.textContent === text, label)) {
      await match.click();
      await page.waitForSelector(input, { hidden: true });
      return;
    }
  }
  throw new Error(`Command not found: ${label}`);
}

const layers = () => page.$$eval(layerSelector, elements => elements.map(element => ({
  id: element.dataset.layer,
  kind: element.dataset.kind,
  x: Number(element.dataset.x), y: Number(element.dataset.y),
  w: Number(element.dataset.w), h: Number(element.dataset.h),
  selected: element.hasAttribute('data-selected'),
})));

async function savedDocument() {
  await page.waitForFunction(key => {
    const raw = localStorage.getItem(key);
    if (!raw || document.querySelector('.pictor-save-state')?.getAttribute('data-state') !== 'saved') return false;
    const stored = JSON.parse(raw);
    return stored.version === 1 && stored.documents[stored.activeFileId];
  }, {}, cacheKey);
  return page.evaluate(key => {
    const stored = JSON.parse(localStorage.getItem(key));
    return stored.documents[stored.activeFileId];
  }, cacheKey);
}

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode) return;
  const exited = once(server, 'exit').catch(() => {});
  server.kill('SIGTERM');
  await Promise.race([exited, delay(2000)]);
  if (server.exitCode === null && !server.signalCode) { server.kill('SIGKILL'); await exited; }
}

try {
  const builtHtml = await readFile(builtEntry).catch(() => {
    throw new Error(`Built app missing. Run pnpm --filter @awc-ui/showcase-design-${framework} build first.`);
  });
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const base = `${origin}${basePath}`;
  server = spawn(process.execPath, [join(appRoot, 'scripts/serve-dist.mjs'), String(port)], { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverError;
  server.on('error', error => { serverError = error; });
  server.stdout.on('data', chunk => { serverOutput += chunk; });
  server.stderr.on('data', chunk => { serverOutput += chunk; });
  await until(() => {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Built server exited (${server.exitCode}): ${serverOutput}`);
    return serverOutput.includes(`[serve] http://localhost:${port}${basePath}/`);
  }, 'built server startup');

  await check('dedicated server serves the exact build and real deep links', async () => {
    const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(timeout) });
    assert.equal(response.status, 200);
    const hash = input => createHash('sha256').update(input).digest('hex');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(builtHtml));
    for (const path of ['/editor/', '/assets/', `/f/${getFiles()[1].id}/`]) {
      assert.equal((await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeout) })).status, 200, `Missing built route: ${path}`);
    }
    assert.equal((await fetch(`${base}/f/pictor-verification-missing/`, { signal: AbortSignal.timeout(timeout) })).status, 404, 'Unknown route must not use an HTML fallback');
  });

  const downloads = join(scratch, 'downloads');
  await Promise.all([mkdir(downloads), mkdir(join(scratch, 'cache'))]);
  browser = await puppeteer.launch({
    headless: true,
    userDataDir: join(scratch, 'profile'),
    env: { ...process.env, XDG_CACHE_HOME: join(scratch, 'cache') },
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--disk-cache-dir=${join(scratch, 'cache')}`],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
  });
  const context = await browser.createBrowserContext();
  page = await context.newPage();
  page.setDefaultTimeout(timeout);
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
  await page.setCacheEnabled(false);
  await page.setBypassServiceWorker(true);
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon')) browserErrors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

  await check('fresh workspace offers three editable templates', async () => {
    assert.equal((await page.goto(`${base}/`, { waitUntil: 'networkidle0' })).status(), 200);
    await ready('[data-template="pulse"]');
    assert.equal(await page.$$eval('[data-template]', nodes => nodes.length), 3);
    assert.match(await page.title(), /Pictor/);
  });

  await check('template confirmation replaces the canvas with editable Pulse layers', async () => {
    await click('[data-template="pulse"]');
    await page.waitForSelector('md-dialog.studio-dialog[open] .studio-dialog__actions', { visible: true });
    await clickLabel('md-dialog.studio-dialog[open] .studio-dialog__actions md-button', 'Make it yours');
    await ready();
    // Angular's router normalizes optional trailing slashes; every other port
    // retains the exact React route contract.
    await page.waitForFunction(angular => (angular ? /\/editor\/?$/.test(location.pathname) : location.pathname.endsWith('/editor/')) && document.querySelectorAll('.artboard [data-layer^="template-pulse-"]').length >= 7, {}, framework === 'angular');
    const state = await layers();
    assert(state.every(layer => layer.id.startsWith('template-pulse-')));
    assert(state.some(layer => layer.kind === 'text'));
  });

  await check('real text double-click opens a closed inspector despite pointer capture', async () => {
    const before = await savedDocument();
    const text = before.layers.find(layer => layer.id === 'template-pulse-3');
    assert(text?.kind === 'text', 'Pulse must provide a visible text layer for the double-click check');
    await click('[data-editor] .editor__toolbar md-icon-button[data-tool="select"]');
    const inspectorOpen = await page.$eval('[data-editor]', editor => editor.getAttribute('data-right') === 'open');
    if (inspectorOpen) await click('[data-editor] md-icon-button[aria-label="Toggle inspector"]');
    await page.waitForFunction(() => document.querySelector('[data-editor]')?.getAttribute('data-right') === 'closed');
    await page.waitForSelector('[data-inspector]', { hidden: true });

    const target = await page.$(`.artboard .layer[data-layer="${text.id}"]`);
    assert(target, 'The editable text must exist on the real canvas');
    await target.scrollIntoView();
    const box = await target.boundingBox();
    assert(box && box.width > 0 && box.height > 0, 'Text must have a real hit target');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    // Two real press/release sequences exercise pointer capture and browser
    // dblclick retargeting. Dispatching a DOM dblclick would hide the defect.
    await page.mouse.move(x, y);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await delay(80);
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up({ clickCount: 2 });

    await page.waitForFunction(id => document.querySelector('[data-editor]')?.getAttribute('data-right') === 'open' && document.querySelector(`.artboard .layer[data-layer="${id}"]`)?.hasAttribute('data-selected'), {}, text.id);
    await page.waitForSelector('[data-inspector] [data-name-field]', { visible: true });
    await page.waitForFunction(value => document.querySelector('[data-inspector] [data-name-field]')?.value === value, {}, text.name);
    const after = await savedDocument();
    assert.deepEqual(after.selection, [text.id]);
    assert.deepEqual(after.layers, before.layers, 'Double-click must select text without modifying the document');
    assert.equal(after.history.index, before.history.index, 'Opening text inspection must not add an edit');
  });

  let drawn;
  let countBefore;
  await check('dragging Rectangle creates one selected layer, with one undo and redo', async () => {
    const before = await layers(); countBefore = before.length;
    const historyBefore = (await savedDocument()).history.index;
    await click('[data-editor] .editor__toolbar md-icon-button[data-tool="rect"]');
    await page.waitForFunction(() => document.querySelector('[data-artboard]')?.getAttribute('data-tool') === 'rect');
    const board = await page.$('[data-artboard]');
    await board.scrollIntoView();
    const box = await board.boundingBox();
    assert(box && box.width > 100 && box.height > 100, 'Canvas must have measurable bounds');
    const point = (x, y) => ({ x: box.x + box.width * x / CANVAS_COLS, y: box.y + box.height * y / CANVAS_ROWS });
    const start = point(35.2, 23.2), end = point(42.2, 28.2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(count => document.querySelectorAll('.artboard .layer[data-layer]').length === count + 1, {}, countBefore);
    drawn = (await layers()).find(layer => !before.some(previous => previous.id === layer.id));
    assert(drawn?.selected && drawn.kind === 'rect' && drawn.w > 1 && drawn.h > 1, 'Gesture must create a selected rectangle with area');
    assert.equal((await savedDocument()).history.index, historyBefore + 1, 'One gesture must record one history entry');
    await click('[data-undo]');
    await page.waitForFunction(id => !document.querySelector(`.artboard [data-layer="${id}"]`), {}, drawn.id);
    assert.equal((await layers()).length, countBefore);
    await click('[data-redo]');
    await page.waitForFunction(id => !!document.querySelector(`.artboard [data-layer="${id}"]`), {}, drawn.id);
    const restored = (await layers()).find(layer => layer.id === drawn.id);
    assert.deepEqual({ ...restored, selected: false }, { ...drawn, selected: false });
  });

  await check('typing an inspector position changes actual canvas geometry', async () => {
    await click(`.tree__row[data-layer="${drawn.id}"]`);
    await page.waitForSelector('md-number-field[data-geometry="x"].hydrated', { visible: true });
    await page.waitForFunction(() => document.querySelector('[data-geometry="x"]')?.shadowRoot?.querySelector('md-text-field')?.shadowRoot?.querySelector('input'));
    const inputHandle = await page.evaluateHandle(() => document.querySelector('[data-geometry="x"]').shadowRoot.querySelector('md-text-field').shadowRoot.querySelector('input'));
    const input = inputHandle.asElement();
    assert(input, 'Number field must expose its real editable input');
    await input.click({ clickCount: 3 });
    await input.press('Backspace');
    await input.type('120');
    await input.press('Tab');
    await page.waitForFunction(id => document.querySelector(`.artboard [data-layer="${id}"]`)?.getAttribute('data-x') === '6', {}, drawn.id);
    assert.equal((await layers()).find(layer => layer.id === drawn.id).x, 6, '120px must resolve to six 20px grid cells');
    await inputHandle.dispose();
  });

  let saved;
  await check('save shortcut and reload retain edits and usable undo history', async () => {
    await pressShortcut('s');
    saved = await savedDocument();
    assert.equal(saved.layers.find(layer => layer.id === drawn.id).rect.x, 6);
    assert(saved.history.index >= 3);
    assert.equal((await page.reload({ waitUntil: 'networkidle0' })).status(), 200);
    await ready();
    await page.waitForFunction(id => document.querySelector(`.artboard [data-layer="${id}"]`)?.getAttribute('data-x') === '6', {}, drawn.id);
    assert.equal((await savedDocument()).history.index, saved.history.index);
    await click('[data-undo]');
    await page.waitForFunction(({ id, x }) => document.querySelector(`.artboard [data-layer="${id}"]`)?.getAttribute('data-x') === String(x), {}, drawn);
    await click('[data-redo]');
    await page.waitForFunction(id => document.querySelector(`.artboard [data-layer="${id}"]`)?.getAttribute('data-x') === '6', {}, drawn.id);
  });

  await check('command search navigates projects, assets and individual persisted files', async () => {
    await command('Browse projects'); await ready('[data-template="orbit"]');
    assert.equal(new URL(page.url()).pathname, `${basePath}/`);
    await command('Explore assets'); await ready('.screen-body');
    assert.equal(framework === 'angular' ? new URL(page.url()).pathname.replace(/\/$/, '') : new URL(page.url()).pathname, `${basePath}/assets${framework === 'angular' ? '' : '/'}`);
    const other = getFiles().find(file => file.id !== saved.fileId);
    assert(other, 'Fixture needs a second file');
    await command(other.name); await ready();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('awc:pictor:documents:v1'))?.activeFileId === id, {}, other.id);
    assert(!(await layers()).some(layer => layer.id === drawn.id));
    await command(getFiles().find(file => file.id === saved.fileId).name); await ready();
    await page.waitForFunction(id => !!document.querySelector(`.artboard [data-layer="${id}"]`), {}, drawn.id);
    assert.equal((await layers()).find(layer => layer.id === drawn.id).x, 6);
    assert.equal((await savedDocument()).history.index, saved.history.index);
  });

  await check('export dialog downloads a nonempty SVG containing the edited layer', async () => {
    await command('Export your design');
    await page.waitForSelector('[data-export-dialog]', { visible: true });
    await page.waitForFunction(() => document.querySelector('[data-export-format]')?.value === 'svg');
    await click('[data-download]');
    const filename = await until(async () => (await readdir(downloads)).find(name => name.endsWith('.svg')), 'SVG download');
    const svg = await readFile(join(downloads, filename), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox="0 0 960 640"/);
    assert(svg.includes(`data-layer="${drawn.id}"`), 'Export must include the edited document, not a preview fixture');
    assert(svg.length > 500);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-export-dialog]', { hidden: true });
  });

  await check('Present opens the current design and closes without modifying it', async () => {
    const before = await layers();
    await click('[data-present]');
    await page.waitForSelector('[data-presentation]', { visible: true });
    assert(await page.$(`[data-presentation] [data-layer="${drawn.id}"]`), 'Presentation must use current document');
    await click('[data-close-present]');
    await page.waitForSelector('[data-presentation]', { hidden: true });
    assert.deepEqual(await layers(), before);
  });

  await check('browser reports no runtime or failed-resource errors', async () => {
    assert.deepEqual([...new Set(browserErrors)], []);
  });
  console.log(`\nPASS — ${framework}: ${checks} browser checks`);
} catch (error) {
  console.error(`\nFAIL — ${framework} after ${checks} checks:`, error);
  if (browserErrors.length) console.error('Browser errors:', [...new Set(browserErrors)]);
  if (serverOutput.trim()) console.error('Server:', serverOutput.trim());
  if (artifacts && page && !page.isClosed()) {
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: join(artifacts, `pictor-${framework}-browser-failure.png`), fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await stopServer();
  await rm(scratch, { recursive: true, force: true });
}

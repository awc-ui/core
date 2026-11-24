// Build @awc-ui/core before running this test against the Vite dev app.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const viewports = [{ width: 1440, height: 1050 }, { width: 390, height: 844 }];
const headings = ['Buttons', 'Icon Buttons', 'FABs', 'Text Fields', 'Select', 'Checkboxes & Radio'];
const fontWeights = ['400', '500'];
const testBuiltOutput = process.env.AWC_FIRST_PAINT_BUILD === '1';
const viteProgram = `
  import { createServer, preview } from 'vite';
  const listen = { host: '127.0.0.1', port: 0, strictPort: true };
  const vite = process.env.AWC_FIRST_PAINT_SERVER === 'preview'
    ? await preview({ logLevel: 'warn', preview: listen })
    : await createServer({
    cacheDir: process.env.AWC_FIRST_PAINT_CACHE,
    logLevel: 'warn',
    server: { ...listen, hmr: false },
  });
  if ('listen' in vite) await vite.listen();
  process.send(vite.httpServer.address().port);
  process.once('message', async () => {
    await vite.close();
    process.disconnect();
  });
`;

let browser;
const servers = [];
let scratch;
let origin;

function latch() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function deadline(promise, label, timeout = 15_000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function startVite(mode) {
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', viteProgram], {
    cwd: appRoot,
    env: {
      ...process.env,
      AWC_FIRST_PAINT_CACHE: join(scratch, 'vite'),
      AWC_FIRST_PAINT_SERVER: mode,
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  servers.push(vite);
  let devOutput = '';
  vite.stderr.setEncoding('utf8');
  vite.stderr.on('data', (chunk) => { devOutput += chunk; });
  const port = await deadline(Promise.race([
    once(vite, 'message').then(([port]) => port),
    once(vite, 'exit').then(([code, signal]) => {
      throw new Error(`Vite exited before listening (${code ?? signal})\n${devOutput}`);
    }),
  ]), 'the isolated Vite server', 20_000);
  assert.ok(Number.isInteger(port) && port > 0, 'Vite must listen on a real ephemeral port');
  return `http://127.0.0.1:${port}`;
}

before(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'awc-html-first-paint-'));
  origin = await startVite('dev');
  browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
  });
});

after(async () => {
  try {
    await browser?.close();
  } finally {
    for (const vite of servers) {
      if (!vite.pid || vite.exitCode !== null || vite.signalCode !== null) continue;
      const exited = once(vite, 'exit');
      if (vite.connected) vite.send('close');
      else vite.kill();
      try {
        await deadline(exited, 'Vite shutdown', 5_000);
      } catch {
        vite.kill('SIGKILL');
        await exited;
      }
    }
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
});

function installFrameProbe(count) {
  const probe = window.firstPaintProbe = { bodyTransitions: [], frames: [], stopped: false };
  document.addEventListener('transitionrun', (event) => {
    if (event.target === document.body) probe.bodyTransitions.push(event.propertyName);
  }, true);
  function record() {
    if (probe.stopped) return;
    const elements = [...document.querySelectorAll('.app > section > h2')].slice(0, count);
    if (elements.length === count && performance.getEntriesByName('first-contentful-paint', 'paint').length) {
      probe.frames.push(elements.map((heading) => heading.getBoundingClientRect().top));
    }
    requestAnimationFrame(record);
  }
  requestAnimationFrame(record);
}

async function snapshot(page) {
  // A render-blocking stylesheet may still be arriving after the page parses.
  // Inspect an actual painted frame while the relevant JS request is held.
  await page.waitForFunction(() => document.querySelector('#theme-toggle') &&
    performance.getEntriesByName('first-contentful-paint', 'paint').length > 0);
  return page.evaluate(async (count) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const components = [...document.querySelectorAll('*')].filter((host) => host.localName.startsWith('md-'));
    const pending = components.filter((host) => !host.classList.contains('hydrated'));
    const visibleUnhydrated = pending.filter((host) => {
      const { width, height, left, right, top, bottom } = host.getBoundingClientRect();
      return getComputedStyle(host).visibility === 'visible' && width > 0 && height > 0 &&
        left < innerWidth && right > 0 && top < innerHeight && bottom > 0;
    }).map((host) => host.id || host.localName);
    return {
      visibleUnhydrated,
      hydrated: components.length - pending.length,
      buttonVisibility: getComputedStyle(document.querySelector('#theme-toggle')).visibility,
      background: getComputedStyle(document.body).backgroundColor,
      headings: [...document.querySelectorAll('.app > section > h2')].slice(0, count).map((heading) => ({
        label: heading.textContent.trim(),
        top: heading.getBoundingClientRect().top,
      })),
    };
  }, headings.length);
}

function waitForHydratedControls(page, entirePage = false) {
  return page.waitForFunction(({ count, entirePage }) => {
    const headings = [...document.querySelectorAll('.app > section > h2')].slice(0, count);
    if (headings.length !== count || !document.querySelector('#theme-toggle.hydrated')) return false;
    const scopes = entirePage ? [document] : headings.map((heading) => heading.parentElement);
    function hydrated(scope) {
      return [...scope.querySelectorAll('*')].every((node) => {
        if (node.localName.startsWith('md-') && !node.classList.contains('hydrated')) return false;
        return !node.shadowRoot || hydrated(node.shadowRoot);
      });
    }
    return scopes.every(hydrated);
  }, {}, { count: headings.length, entirePage });
}

function observeFailures(page, siteOrigin) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).origin === siteOrigin && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function verifyCheckbox(page) {
  await page.click('#hello-cb');
  await page.waitForFunction(() => document.querySelector('#hello-cb').getAttribute('aria-checked') === 'true' &&
    document.querySelector('#cb-label').textContent.trim() === 'Checkbox (checked)');
}

for (const { viewport, delayedRoboto } of [
  ...viewports.map((viewport) => ({ viewport, delayedRoboto: false })),
  { viewport: viewports[1], delayedRoboto: true },
]) {
  const fontCase = delayedRoboto ? ' with delayed Roboto' : '';
  test(`the HTML playground paints and hydrates without moving its first six sections at ${viewport.width}px${fontCase}`,
    { timeout: 45_000 }, async (t) => {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const appRequest = latch();
      const releaseApp = latch();
      const lazyRequest = latch();
      const releaseLazy = latch();
      const fontRequest = latch();
      const releaseFont = latch();
      const failures = observeFailures(page, origin);
      const fontPath = (weight) => `/awc-first-paint/roboto-${weight}.woff2`;
      const fontFiles = new Map(delayedRoboto ? await Promise.all(fontWeights.map(async (weight) => [
        fontPath(weight),
        await readFile(new URL(`../../booking/public/fonts/roboto-latin-${weight}-normal.woff2`, import.meta.url)),
      ])) : []);
      t.after(async () => {
        releaseApp.resolve();
        releaseLazy.resolve();
        releaseFont.resolve();
        await context.close();
      });
      await page.setViewport(viewport);
      await page.setCacheEnabled(false);
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.evaluateOnNewDocument(installFrameProbe, headings.length);
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const target = new URL(request.url());
        try {
          // Exercise the real font swap with local bytes and a request latch.
          // The two fallback cases block the remote font entirely.
          if (delayedRoboto && target.hostname === 'fonts.googleapis.com') {
            const body = fontWeights.map((weight) => `@font-face {
              font-family: Roboto;
              font-weight: ${weight};
              font-display: swap;
              src: url('https://fonts.gstatic.com${fontPath(weight)}') format('woff2');
            }`).join('\n');
            await request.respond({ status: 200, contentType: 'text/css', body });
            return;
          }
          if (target.hostname === 'fonts.gstatic.com' && fontFiles.has(target.pathname)) {
            fontRequest.resolve();
            await releaseFont.promise;
            await request.respond({
              status: 200,
              contentType: 'font/woff2',
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: fontFiles.get(target.pathname),
            });
            return;
          }
          if (['http:', 'https:'].includes(target.protocol) && target.origin !== origin) {
            await request.abort();
            return;
          }
          if (target.pathname === '/src/main.ts') {
            appRequest.resolve();
            await releaseApp.promise;
          }
          if (target.pathname.endsWith('.entry.js')) {
            lazyRequest.resolve();
            await releaseLazy.promise;
          }
          await request.continue();
        } catch (error) {
          if (!page.isClosed()) failures.push(error.message);
        }
      });

      const loaded = page.goto(origin, { waitUntil: 'load', timeout: 35_000 });
      // Navigation runs concurrently with the two deliberately blocked requests.
      void loaded.catch(() => {});
      await deadline(appRequest.promise, 'the app module request');
      if (delayedRoboto) await deadline(fontRequest.promise, 'the Roboto request');
      const beforeApp = await snapshot(page);
      if (delayedRoboto) assert.equal(await page.evaluate(() => document.fonts.check('400 16px Roboto')), false);
      releaseApp.resolve();
      await deadline(lazyRequest.promise, 'a lazy component entry request');
      await page.waitForFunction(() => Boolean(customElements.get('md-button')));
      const duringLazy = await snapshot(page);
      releaseLazy.resolve();
      await waitForHydratedControls(page);
      if (delayedRoboto) {
        releaseFont.resolve();
        const weights = await page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.fonts].filter((font) => font.family === 'Roboto' && font.status === 'loaded')
            .map(({ weight }) => weight).sort();
        });
        assert.deepEqual(weights, fontWeights, 'the heading layout is measured through the actual font swap');
      }
      await loaded;
      const settled = await snapshot(page);
      const { frames, bodyTransitions } = await page.evaluate(() => {
        window.firstPaintProbe.stopped = true;
        return window.firstPaintProbe;
      });

      assert.ok(settled.hydrated > 0, 'the component chunks must subsequently hydrate');
      assert.equal(settled.buttonVisibility, 'visible');
      assert.deepEqual(settled.headings.map(({ label }) => label), headings);
      assert.deepEqual(bodyTransitions, [], 'the body must not animate on boot');
      for (const [label, early] of [['before app JS', beforeApp], ['during lazy loading', duringLazy]]) {
        assert.equal(early.hydrated, 0, label);
        assert.equal(early.buttonVisibility, 'hidden', label);
        assert.deepEqual(early.visibleUnhydrated, [], label);
        assert.equal(early.background, settled.background, label);
        assert.deepEqual(early.headings.map(({ label }) => label), headings, label);
      }
      assert.ok(frames.length > 3, 'sampling must span the bootstrap and hydration frames');
      for (const [index, label] of headings.entries()) {
        const positions = [
          ...frames.map((frame) => frame[index]),
          ...[beforeApp, duringLazy, settled].map((stage) => stage.headings[index].top),
        ];
        const drift = Math.max(...positions) - Math.min(...positions);
        assert.ok(drift <= 1, `${label} moved ${drift}px during startup (y positions: ${[...new Set(positions)].join(', ')})`);
      }

      await verifyCheckbox(page);
      assert.deepEqual(failures, []);
    });
}

if (testBuiltOutput) {
  test('the built HTML playground serves its lazy runtime and responds to input', { timeout: 45_000 }, async (t) => {
    const builtOrigin = await startVite('preview');
    const context = await browser.createBrowserContext();
    t.after(() => context.close());
    const page = await context.newPage();
    const failures = observeFailures(page, builtOrigin);
    t.after(() => assert.deepEqual(failures, [], 'built runtime requests and scripts must succeed'));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const target = new URL(request.url());
      return ['http:', 'https:'].includes(target.protocol) && target.origin !== builtOrigin
        ? request.abort()
        : request.continue();
    });
    await page.goto(builtOrigin, { waitUntil: 'load' });
    await waitForHydratedControls(page, true);
    assert.equal(await page.$eval('#theme-toggle', (host) => getComputedStyle(host).visibility), 'visible');
    await verifyCheckbox(page);
  });
}

/**
 * Verify already-built CSR playgrounds, including a relative-base deployment.
 *
 * Build core/wrappers and the five playgrounds first, then build the extra case:
 *   pnpm --filter @awc-ui/test-html exec vite build --base ./ --outDir dist/relative-base
 *   pnpm verify:framework-startup
 *
 * Override output directories with name=directory arguments, for example
 * html=apps/test-html/dist. All six cases always run; no dev server is used.
 * External fonts are blocked so this checks local startup, not font delivery.
 */
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repository = fileURLToPath(new URL('../', import.meta.url));
const outputs = {
  html: 'apps/test-html/dist',
  react: 'apps/test-react/dist',
  vue: 'apps/test-vue/dist',
  svelte: 'apps/test-svelte/dist',
  angular: 'apps/test-angular/dist/test-angular',
  'html-relative': 'apps/test-html/dist/relative-base',
};
const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
};

for (const argument of process.argv.slice(2)) {
  const separator = argument.indexOf('=');
  const name = argument.slice(0, separator);
  assert(separator > 0 && Object.hasOwn(outputs, name) && argument.slice(separator + 1),
    `Expected one of ${Object.keys(outputs).join(', ')} followed by =directory; received ${argument}`);
  outputs[name] = argument.slice(separator + 1);
}

// Fail before opening Chrome if a build is missing, rather than passing against
// a dev server or allowing an HTML fallback to conceal a missing entry chunk.
for (const [name, output] of Object.entries(outputs)) {
  const root = resolve(repository, output);
  assert(await stat(resolve(root, 'index.html')).then(file => file.isFile(), () => false),
    `${name}: missing ${root}/index.html; build this playground first`);
  outputs[name] = root;
}

function latch() {
  let release;
  const promise = new Promise(resolvePromise => { release = resolvePromise; });
  return { promise, release };
}

async function preview(root, mount, missingAssets) {
  const server = createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const relative = pathname.startsWith(mount) ? pathname.slice(mount.length) : null;
    const file = relative === null ? null : resolve(root, relative || 'index.html');
    try {
      if (!file?.startsWith(`${root}${sep}`) || !(await stat(file)).isFile()) throw new Error('Missing asset');
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch {
      missingAssets.add(pathname);
      response.writeHead(404).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise(done => server.close(done));
    },
  };
}

// This runs in the browser before application JavaScript. Traverse shadow roots
// too: waiting only for outer hosts misses nested buttons, ripples and menus.
function installStartupProbe() {
  const probe = window.awcStartupProbe = { visibleUnhydrated: [], samples: 0, stopped: false };
  probe.hosts = () => {
    const hosts = [];
    const visit = root => {
      for (const element of root.querySelectorAll('*')) {
        if (element.localName.startsWith('md-')) hosts.push(element);
        if (element.shadowRoot) visit(element.shadowRoot);
      }
    };
    visit(document);
    return hosts;
  };
  const record = () => {
    if (probe.stopped) return;
    if (performance.getEntriesByName('first-contentful-paint', 'paint').length) {
      probe.samples++;
      for (const host of probe.hosts()) {
        if (host.classList.contains('hydrated')) continue;
        const style = getComputedStyle(host);
        const box = host.getBoundingClientRect();
        if (style.visibility === 'visible' && style.opacity !== '0' && box.width > 0 && box.height > 0) {
          const label = host.id || host.localName;
          if (!probe.visibleUnhydrated.includes(label)) probe.visibleUnhydrated.push(label);
        }
      }
    }
    requestAnimationFrame(record);
  };
  requestAnimationFrame(record);
}

async function awaitHydration(page) {
  await page.waitForFunction(() => {
    const hosts = window.awcStartupProbe.hosts();
    return hosts.length > 0 && hosts.every(host => host.classList.contains('hydrated'));
  }, { timeout: 15_000, polling: 'raf' });
}

async function verify(browser, name, root) {
  const mount = name === 'html-relative' ? '/preview/nested/' : '/';
  const missingAssets = new Set();
  const runtimeErrors = new Set();
  const localFailures = new Set();
  const runtimeGate = latch();
  const server = await preview(root, mount, missingAssets);
  const context = await browser.createBrowserContext();
  let heldRuntime = false;
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.setViewport({ width: 1440, height: 1050 });
    await page.evaluateOnNewDocument(installStartupProbe);
    page.on('pageerror', error => runtimeErrors.add(error.message));
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.add(message.text());
    });
    page.on('requestfailed', request => {
      if (request.url().startsWith(server.origin)) localFailures.add(`${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.setRequestInterception(true);
    const routeRequest = async request => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== server.origin) {
        // Resolve remote font stylesheets empty: no network dependence or font
        // swap, and no intentional ERR_FAILED noise hiding a real app error.
        await request.respond({ status: 200, contentType: 'text/css', body: '' });
        return;
      }
      if (url.pathname === `${mount}awc-esm/loader.js`) {
        heldRuntime = true;
        await runtimeGate.promise;
      }
      if (!request.isInterceptResolutionHandled()) await request.continue();
    };
    page.on('request', request => {
      void routeRequest(request).catch(error => runtimeErrors.add(error.message));
    });

    await page.goto(`${server.origin}${mount}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    if (name !== 'angular') {
      await page.waitForFunction(() => document.querySelector('md-button') &&
        performance.getEntriesByName('first-contentful-paint', 'paint').length > 0);
      assert(heldRuntime, `${name}: the production app must request its copied lazy loader`);
      const delayed = await page.evaluate(async () => {
        const probe = window.awcStartupProbe;
        const firstSample = probe.samples;
        while (probe.samples < firstSample + 3) await new Promise(requestAnimationFrame);
        return {
          pending: probe.hosts().filter(host => !host.classList.contains('hydrated')).length,
          visible: probe.visibleUnhydrated,
        };
      });
      assert(delayed.pending > 0, `${name}: delayed-runtime case must include unhydrated controls`);
      assert.deepEqual(delayed.visible, [], `${name}: raw controls flashed before the runtime loaded`);
    }
    runtimeGate.release();
    await awaitHydration(page);
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 10_000 });
    await awaitHydration(page);
    for (const selector of ['md-button', 'md-checkbox', 'md-text-field']) {
      assert(await page.$eval(selector, host => host.shadowRoot && getComputedStyle(host).visibility === 'visible'),
        `${name}: ${selector} must render visibly`);
    }

    await page.click('md-button[variant="tonal"]');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' &&
      document.querySelector('md-button[variant="tonal"]').textContent.includes('Light Mode'));
    await page.click('md-checkbox');
    await page.waitForFunction(() => document.querySelector('md-checkbox').getAttribute('aria-checked') === 'true');
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 10_000 });
    await awaitHydration(page);
    const result = await page.evaluate(() => {
      const probe = window.awcStartupProbe;
      probe.stopped = true;
      return { hydrated: probe.hosts().length, samples: probe.samples, visibleUnhydrated: probe.visibleUnhydrated };
    });
    assert(result.samples > 0, `${name}: startup must be observed after first paint`);
    assert.deepEqual(result.visibleUnhydrated, [], `${name}: unhydrated controls flashed during startup`);
    assert.deepEqual([...missingAssets], [], `${name}: missing production assets`);
    assert.deepEqual([...localFailures], [], `${name}: failed local requests`);
    assert.deepEqual([...runtimeErrors], [], `${name}: browser runtime errors`);
    console.log(`PASS ${name}: ${result.hydrated} nested hosts hydrated; no raw-control flash; theme and checkbox respond; no asset/runtime errors`);
  } catch (error) {
    throw new Error(`${name}: ${error.message}\nMissing assets: ${JSON.stringify([...missingAssets])}\nRuntime errors: ${JSON.stringify([...runtimeErrors])}`, { cause: error });
  } finally {
    runtimeGate.release();
    await context.close();
    await server.close();
  }
}

const browser = await puppeteer.launch({
  headless: 'shell', args: ['--no-sandbox'],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
});
try {
  for (const [name, root] of Object.entries(outputs)) await verify(browser, name, root);
} finally {
  await browser.close();
}

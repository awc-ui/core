/**
 * Verify already-built CSR playgrounds, including a relative-base deployment.
 *
 * Build core/wrappers and the five playgrounds first, then build the extra case:
 *   pnpm --filter @awc-ui/test-html exec vite build --base ./ --outDir dist/relative-base
 *   pnpm verify:framework-startup
 *
 * Override output directories with name=directory arguments, for example
 * html=apps/test-html/dist. All six cases always run; no dev server is used.
 * Mobile runs hold local CSS and the icon font, then test the first action on
 * a separate navigation. Framework catalogs with deferred Roboto also run
 * with its stylesheet and real font bytes held across separate paints.
 */
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repository = fileURLToPath(new URL('../', import.meta.url));
const iconCoverage = JSON.parse(await readFile(resolve(repository, 'apps/shared/fonts/coverage.json'), 'utf8'));
// At these mobile widths, each catalog title is close to its wrapping boundary.
const robotoWidths = { html: 547, react: 426, vue: 384, svelte: 416 };
const robotoWeights = ['400', '500'];
const robotoFiles = new Map(await Promise.all(robotoWeights.map(async weight => [
  `/awc-test/roboto-${weight}.woff2`,
  await readFile(resolve(repository, `apps/booking/public/fonts/roboto-latin-${weight}-normal.woff2`)),
])));
const robotoCss = robotoWeights.map(weight => `@font-face {
  font-family: Roboto; font-weight: ${weight}; font-display: swap;
  src: url("https://fonts.gstatic.com/awc-test/roboto-${weight}.woff2") format("woff2");
}`).join('\n');
assert(iconCoverage.subsetBytes < 400_000, 'Playground icon subset exceeds its transfer budget');
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
  const probe = window.awcStartupProbe = { visibleUnhydrated: [], samples: 0, stopped: false,
    layoutStopped: false, cls: 0, shifts: [], headingFrames: [] };
  const recordShifts = entries => {
    if (probe.layoutStopped) return;
    for (const entry of entries) if (!entry.hadRecentInput) {
      probe.cls += entry.value;
      if (probe.shifts.length < 8) probe.shifts.push({ value: entry.value,
        sources: entry.sources.map(source => ({ tag: source.node?.localName,
          class: source.node?.className, previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) });
    }
  };
  const layoutObserver = new PerformanceObserver(list => recordShifts(list.getEntries()));
  layoutObserver.observe({ type: 'layout-shift', buffered: true });
  probe.finishLayout = () => {
    recordShifts(layoutObserver.takeRecords());
    layoutObserver.disconnect();
    probe.layoutStopped = true;
    return { cls: probe.cls, shifts: probe.shifts, frames: probe.headingFrames };
  };
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
      if (!probe.layoutStopped) {
        const headings = [...document.querySelectorAll('.app section > h2')].slice(0, 6);
        if (headings.length === 6) probe.headingFrames.push(headings.map(heading => heading.getBoundingClientRect().top));
      }
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

async function clickThemeToggle(page) {
  const selector = 'md-button[variant="tonal"]';
  await page.click(selector);
  await page.waitForFunction(selector => document.documentElement.dataset.theme === 'dark' &&
    document.querySelector(selector).textContent.includes('Light Mode'), {}, selector);
}

async function verifyAngularForm(page) {
  const form = '[data-reactive-form]';
  const model = `${form} [data-model]`;
  assert.deepEqual(await page.$eval(model, element => JSON.parse(element.textContent)), {
    name: '', country: '', terms: false, newsletter: false, score: 0,
  }, 'Angular reactive form must start with its configured values');

  await page.type(`${form} md-text-field >>> input`, 'From input');
  await page.waitForFunction(form => {
    const element = document.querySelector(form);
    return JSON.parse(element.querySelector('[data-model]').textContent).name === 'From input' &&
      element.querySelector('[data-status]').textContent.trim() === 'VALID';
  }, {}, form);

  await page.click(`${form} [data-patch]`);
  await page.waitForFunction(form => {
    const element = document.querySelector(form);
    const { name, country, terms, newsletter, score } = JSON.parse(element.querySelector('[data-model]').textContent);
    return name === 'From model' && country === 'pt' && terms === true && newsletter === true && score === 5 &&
      element.querySelector('md-text-field').shadowRoot.querySelector('input').value === name &&
      element.querySelector('md-select').value === country &&
      element.querySelector('md-checkbox').getAttribute('aria-checked') === 'true' &&
      element.querySelector('md-switch').getAttribute('aria-checked') === 'true' &&
      element.querySelector('md-rating').value === score;
  }, {}, form);

  await page.click(`${form} md-checkbox`);
  await page.click(`${form} md-switch`);
  await page.waitForFunction(form => {
    const element = document.querySelector(form);
    const { terms, newsletter } = JSON.parse(element.querySelector('[data-model]').textContent);
    return terms === false && newsletter === false &&
      element.querySelector('md-checkbox').getAttribute('aria-checked') === 'false' &&
      element.querySelector('md-switch').getAttribute('aria-checked') === 'false';
  }, {}, form);

  await page.$eval(form, element => element.reset());
  await page.waitForFunction(form => {
    const element = document.querySelector(form);
    const model = JSON.parse(element.querySelector('[data-model]').textContent);
    return Object.values(model).every(value => value === null) &&
      element.querySelector('[data-status]').textContent.trim() === 'INVALID' &&
      element.querySelector('md-text-field').shadowRoot.querySelector('input').value === '';
  }, {}, form);

  const clickButton = async text => {
    for (const button of await page.$$('md-button')) {
      if (await button.evaluate((element, text) => element.textContent.trim() === text, text)) {
        await button.click();
        return;
      }
    }
    assert.fail(`Angular demo button not found: ${text}`);
  };
  await clickButton('Open Dialog');
  await page.waitForFunction(() => document.querySelector('md-dialog').open === true);
  await clickButton('Cancel');
  await page.waitForFunction(() => document.querySelector('md-dialog').open === false &&
    [...document.querySelectorAll('md-button')].some(button => button.textContent.trim() === 'Open Dialog'));
  await page.click('#menu-anchor');
  await page.waitForFunction(() => document.querySelector('md-menu[anchor="menu-anchor"]').open === true);
  await page.click('#menu-anchor');
  await page.waitForFunction(() => document.querySelector('md-menu[anchor="menu-anchor"]').open === false);
  await clickButton('Open Bottom Sheet');
  await page.waitForFunction(() => document.querySelector('md-bottom-sheet').open === true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('md-bottom-sheet').open === false &&
    [...document.querySelectorAll('md-button')].some(button => button.textContent.trim() === 'Open Bottom Sheet'));
}

async function verify(browser, name, root, profile = 'desktop') {
  const slowAssets = profile === 'slow-assets';
  const earlyInput = profile === 'early-input';
  const delayedRoboto = profile === 'delayed-roboto';
  const mount = name === 'html-relative' ? '/preview/nested/' : '/';
  const missingAssets = new Set();
  const runtimeErrors = new Set();
  const localFailures = new Set();
  const assertNoFailures = () => {
    assert.deepEqual([...missingAssets], [], `${name}: missing production assets`);
    assert.deepEqual([...localFailures], [], `${name}: failed local requests`);
    assert.deepEqual([...runtimeErrors], [], `${name}: browser runtime errors`);
  };
  const runtimeGate = latch();
  const stylesheetRequested = latch();
  const stylesheetGate = latch();
  const fontGate = latch();
  const server = await preview(root, mount, missingAssets);
  const context = await browser.createBrowserContext();
  let heldRuntime = false;
  let heldFont = false;
  let heldRobotoCss = false;
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.setViewport(profile === 'desktop' ? { width: 1440, height: 1050 } :
      { width: delayedRoboto ? robotoWidths[name] : 390, height: 844 });
    if (!earlyInput) await page.evaluateOnNewDocument(installStartupProbe);
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
      if (delayedRoboto && url.hostname === 'fonts.googleapis.com') {
        heldRobotoCss = true;
        await stylesheetGate.promise;
        await request.respond({ status: 200, contentType: 'text/css', body: robotoCss });
        return;
      }
      if (delayedRoboto && url.hostname === 'fonts.gstatic.com' && robotoFiles.has(url.pathname)) {
        await fontGate.promise;
        await request.respond({ status: 200, contentType: 'font/woff2',
          headers: { 'Access-Control-Allow-Origin': '*' }, body: robotoFiles.get(url.pathname) });
        return;
      }
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== server.origin) {
        // Resolve remote font stylesheets empty: no network dependence or font
        // swap, and no intentional ERR_FAILED noise hiding a real app error.
        await request.respond({ status: 200, contentType: 'text/css', body: '' });
        return;
      }
      if (!earlyInput && url.pathname === `${mount}awc-esm/loader.js`) {
        heldRuntime = true;
        await runtimeGate.promise;
      }
      if (slowAssets && request.resourceType() === 'stylesheet') {
        stylesheetRequested.release();
        await stylesheetGate.promise;
      }
      if ((slowAssets || earlyInput) && request.resourceType() === 'font') {
        heldFont = true;
        await fontGate.promise;
      }
      if (!request.isInterceptResolutionHandled()) await request.continue();
    };
    page.on('request', request => {
      void routeRequest(request).catch(error => runtimeErrors.add(error.message));
    });

    const navigation = page.goto(`${server.origin}${mount}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    // Attach immediately while the deliberate stylesheet hold is inspected.
    void navigation.catch(() => {});
    if (slowAssets) {
      let timer;
      try {
        await Promise.race([stylesheetRequested.promise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('No render-blocking local stylesheet requested')), 10_000);
        })]);
      } finally { clearTimeout(timer); }
      // Render-blocking CSS can suspend rAF itself; a timer checks that no
      // content was painted during the hold without waiting for that paint.
      const paints = await page.evaluate(() => new Promise(resolve => setTimeout(() => {
        resolve(performance.getEntriesByName('first-contentful-paint', 'paint').length);
      }, 150)));
      assert.equal(paints, 0, `${name}: content painted before its stylesheet arrived`);
      stylesheetGate.release();
    }
    await navigation;
    if (earlyInput) {
      // Click the first visibly styled theme control without waiting for the
      // rest of the components or the held icon font to settle.
      await page.waitForFunction(() => {
        const toggle = document.querySelector('md-button[variant="tonal"].hydrated');
        const label = toggle?.shadowRoot?.querySelector('[part~="label"]');
        return performance.getEntriesByName('first-contentful-paint', 'paint').length > 0 &&
          toggle?.getAttribute('aria-disabled') === 'false' && toggle.textContent.includes('Dark Mode') &&
          label?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
          [...document.fonts].some(font => font.family.includes('Material Symbols Outlined') && font.status === 'loading');
      });
      assert(heldFont, `${name}: the first action must run while the local icon font is held`);
      await clickThemeToggle(page);
      fontGate.release();
      await page.waitForNetworkIdle({ idleTime: 250, timeout: 10_000 });
      assertNoFailures();
      console.log(`PASS ${name} mobile/early input: theme changed before the icon font was released`);
      return;
    }
    if (name !== 'angular') {
      await page.waitForFunction(() => document.querySelector('md-button') &&
        performance.getEntriesByName('first-contentful-paint', 'paint').length > 0);
      assert(heldRuntime, `${name}: the production app must request its copied lazy loader`);
      const delayed = await page.evaluate(async () => {
        const probe = window.awcStartupProbe;
        const firstSample = probe.samples;
        while (probe.samples < firstSample + 3) await new Promise(requestAnimationFrame);
        const heading = document.querySelector('.app h1');
        const headingStyle = heading && getComputedStyle(heading);
        return {
          pending: probe.hosts().filter(host => !host.classList.contains('hydrated')).length,
          visible: probe.visibleUnhydrated,
          styledHeading: heading?.textContent.includes('AWC UI') &&
            heading.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
            heading.getBoundingClientRect().height > 0 && headingStyle.fontSize === '32px' &&
            Boolean(headingStyle.getPropertyValue('--md-sys-color-on-background').trim()),
        };
      });
      assert(delayed.styledHeading, `${name}: the styled catalog heading must paint before the runtime arrives`);
      assert(delayed.pending > 0, `${name}: delayed-runtime case must include unhydrated controls`);
      assert.deepEqual(delayed.visible, [], `${name}: raw controls flashed before the runtime loaded`);
    }
    runtimeGate.release();
    await awaitHydration(page);
    if (delayedRoboto) {
      assert(heldRobotoCss, `${name}: the remote stylesheet must be requested before hydration`);
      assert(await page.$eval('[data-deferred-fonts]', link => link.media === 'print' && !link.sheet),
        `${name}: the styled catalog must paint and hydrate while Roboto's stylesheet is pending`);
      stylesheetGate.release();
      await page.waitForFunction(() => document.querySelector('[data-deferred-fonts]').media === 'all' &&
        [...document.fonts].some(font => font.family === 'Roboto' && font.status === 'loading'));
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      fontGate.release();
      const weights = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(font => font.family === 'Roboto' && font.status === 'loaded')
          .map(font => font.weight).sort();
      });
      assert.deepEqual(weights, robotoWeights, `${name}: the catalog uses the real Roboto files`);
    }
    if (slowAssets) {
      // Icons reserve their footprint even while their font request is pending.
      // Compare actual visible controls before and after the font arrives.
      const rectangles = () => [...document.querySelectorAll('md-button,md-checkbox,md-text-field')]
        .filter(host => { const r = host.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })
        .map(host => { const r = host.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
      const beforeFont = await page.evaluate(rectangles);
      assert(heldFont, `${name}: the slow-font pass must request the local icon font`);
      fontGate.release();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const afterFont = await page.evaluate(rectangles);
      const fontBytes = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter(entry => entry.name.startsWith(location.origin) && /\.(?:woff2?|ttf)(?:$|\?)/.test(entry.name))
        .map(entry => entry.encodedBodySize));
      assert.deepEqual(fontBytes, [iconCoverage.subsetBytes], `${name}: expected the compact local icon font, not the original full font`);
      assert.equal(afterFont.length, beforeFont.length, `${name}: font arrival changed visible control count`);
      beforeFont.forEach((box, index) => box.forEach((value, axis) => {
        assert(Math.abs(value - afterFont[index][axis]) <= 1, `${name}: font arrival shifted control ${index} by more than 1px`);
      }));
    }
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 10_000 });
    await awaitHydration(page);
    for (const selector of ['md-button', 'md-checkbox', 'md-text-field']) {
      assert(await page.$eval(selector, host => host.shadowRoot && getComputedStyle(host).visibility === 'visible'),
        `${name}: ${selector} must render visibly`);
    }

    const layout = await page.evaluate(() => window.awcStartupProbe.finishLayout());
    assert(layout.frames.length >= 2, `${name}: must observe the first six sections across actual painted frames`);
    const first = layout.frames[0];
    layout.frames.forEach(frame => frame.forEach((position, index) => {
      assert(Math.abs(position - first[index]) <= 1,
        `${name}: initial section ${index + 1} shifted ${position - first[index]}px (CLS ${layout.cls})`);
    }));
    assert(layout.cls <= 0.001, `${name}: initial layout shift ${layout.cls}: ${JSON.stringify(layout.shifts)}`);

    await clickThemeToggle(page);
    if (name === 'angular') {
      await verifyAngularForm(page);
    } else {
      await page.click('md-checkbox');
      await page.waitForFunction(() => document.querySelector('md-checkbox').getAttribute('aria-checked') === 'true');
    }
    await page.waitForNetworkIdle({ idleTime: 250, timeout: 10_000 });
    await awaitHydration(page);
    const result = await page.evaluate(() => {
      const probe = window.awcStartupProbe;
      probe.stopped = true;
      return { hydrated: probe.hosts().length, samples: probe.samples, visibleUnhydrated: probe.visibleUnhydrated };
    });
    assert(result.samples > 0, `${name}: startup must be observed after first paint`);
    assert.deepEqual(result.visibleUnhydrated, [], `${name}: unhydrated controls flashed during startup`);
    assertNoFailures();
    console.log(`PASS ${name} ${profile}: ${result.hydrated} nested hosts hydrated; stable layout (CLS ${layout.cls}); no raw-control flash; first input responds; no asset/runtime errors`);
  } catch (error) {
    throw new Error(`${name}: ${error.message}\nMissing assets: ${JSON.stringify([...missingAssets])}\nRuntime errors: ${JSON.stringify([...runtimeErrors])}`, { cause: error });
  } finally {
    runtimeGate.release();
    stylesheetGate.release();
    fontGate.release();
    await context.close();
    await server.close();
  }
}

const browser = await puppeteer.launch({
  headless: 'shell', args: ['--no-sandbox'],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
});
try {
  for (const [name, root] of Object.entries(outputs)) {
    await verify(browser, name, root);
    await verify(browser, name, root, 'slow-assets');
    await verify(browser, name, root, 'early-input');
    if (Object.hasOwn(robotoWidths, name)) await verify(browser, name, root, 'delayed-roboto');
  }
} finally {
  await browser.close();
}

// Build @awc-ui/core and @awc-ui/test-html before running this test.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { after, before, test } from 'node:test';
import puppeteer from 'puppeteer';
import { createPreviewServer } from './ssr-preview.mjs';

const host = '127.0.0.1';
const server = createPreviewServer();
let origin;
let browser;

before(async () => {
  server.listen(0, host);
  await once(server, 'listening');
  origin = `http://${host}:${server.address().port}`;
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
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

function rawStatus(path) {
  return new Promise((resolve, reject) => {
    get({ host, port: server.address().port, path }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).once('error', reject);
  });
}

async function waitFor(page, milestone, predicate) {
  try {
    await page.waitForFunction(predicate, { timeout: 5_000 });
  } catch (cause) {
    throw new Error(`Timed out waiting for ${milestone}.`, { cause });
  }
}

function inspectFieldLayout() {
  const selectors = [
    'md-date-picker[label="Meeting Date"]',
    'md-select[label="Color"]',
    'md-select[label="Size"]',
  ];
  return selectors.map((selector) => {
    const shadow = document.querySelector(selector).shadowRoot;
    const field = shadow.querySelector('[part="field"]');
    const container = field.shadowRoot.querySelector('[part="container"]');
    const label = field.shadowRoot.querySelector('[part="label"]');
    const input = field.shadowRoot.querySelector('[part="input"]');
    const bounds = container.getBoundingClientRect();
    const labelBounds = label.getBoundingClientRect();
    const inputBounds = input.getBoundingClientRect();
    const classes = selector.startsWith('md-date-picker')
      ? ['md-date-picker__textfield', 'md-text-field', 'md-text-field--outlined', 'md-text-field--floating']
      : ['md-select__field', 'md-text-field', selector.includes('Color') ? 'md-text-field--filled' : 'md-text-field--outlined'];
    const child = shadow.querySelector(selector.startsWith('md-date-picker') ? '[part="calendar-button"]' : '[part="menu"]');
    const childClasses = selector.startsWith('md-date-picker')
      ? ['md-date-picker__calendar-button', 'md-icon-button', 'md-icon-button--standard']
      : ['md-menu', 'md-menu--baseline'];
    return {
      label: label.textContent.trim(),
      value: input.value,
      labelInset: Math.round(labelBounds.left - bounds.left),
      inputInset: Math.round(inputBounds.left - bounds.left),
      labelBottom: Math.round(labelBounds.bottom - bounds.top),
      inputTop: Math.round(inputBounds.top - bounds.top),
      fill: getComputedStyle(container).backgroundColor,
      missingClasses: [
        ...classes.filter((name) => !field.classList.contains(name)),
        ...childClasses.filter((name) => !child.classList.contains(name)),
      ],
    };
  });
}

test('the HTTP preview serves fresh declarative shadow DOM and only known paths', async () => {
  const interactive = await fetch(origin);
  const html = await interactive.text();
  assert.equal(interactive.status, 200, html.slice(0, 200));
  assert.equal(interactive.headers.get('cache-control'), 'no-store');
  assert.equal(interactive.headers.get('content-encoding'), 'gzip');
  assert.match(html, /<template shadowrootmode="open">/);
  assert.match(html, /<script type="module"/);
  assert.match(html, /<a href="http:\/\/127\.0\.0\.1:5176\//);

  const serverOnly = await fetch(`${origin}/?client=off`, { headers: { 'Accept-Encoding': 'gzip;q=0' } });
  const snapshot = await serverOnly.text();
  assert.equal(serverOnly.status, 200, snapshot.slice(0, 200));
  assert.equal(serverOnly.headers.get('content-encoding'), null);
  assert.doesNotMatch(snapshot, /<script\b/);
  const timestamp = /<time datetime="([^"]+)"/;
  assert.notEqual(html.match(timestamp)?.[1], snapshot.match(timestamp)?.[1]);
  assert.equal(
    (snapshot.match(/<template shadowrootmode="open">/g) ?? []).length,
    (html.match(/<template shadowrootmode="open">/g) ?? []).length,
  );

  assert.equal(await rawStatus('/assets/missing.js'), 404);
  assert.equal(await rawStatus('/assets/../index.html'), 404);
  assert.equal(await rawStatus('/awc-esm/%2e%2e/index.html'), 404);
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});

test('the preview paints without JavaScript and adopts the same nodes for interaction', { timeout: 30_000 }, async (t) => {
  const staticPage = await browser.newPage();
  t.after(() => staticPage.close());
  await staticPage.setRequestInterception(true);
  staticPage.on('request', (request) => new URL(request.url()).origin === origin
    ? request.continue()
    : request.abort());
  await staticPage.setJavaScriptEnabled(false);
  assert.equal((await staticPage.goto(`${origin}/?client=off`, { timeout: 8_000 })).status(), 200);
  assert.deepEqual(await staticPage.evaluate(() => {
    const checkbox = document.querySelector('#hello-cb');
    const loading = document.querySelector('md-button[loading]');
    return {
      defined: Boolean(customElements.get('md-checkbox')),
      checked: checkbox.getAttribute('aria-checked'),
      annotated: checkbox.hasAttribute('s-id'),
      visible: Boolean(checkbox.shadowRoot?.querySelector('[part="container"]')) &&
        checkbox.getBoundingClientRect().width > 0 && getComputedStyle(checkbox).visibility === 'visible',
      spinner: Boolean(loading.shadowRoot?.querySelector('md-loading-indicator')?.shadowRoot),
    };
  }), { defined: false, checked: 'false', annotated: true, visible: true, spinner: true });
  const renderedLayout = await staticPage.evaluate(inspectFieldLayout);
  const [date, color, size] = renderedLayout;
  assert.deepEqual(renderedLayout.map(({ label }) => label), ['Meeting Date', 'Color', 'Size']);
  for (const field of renderedLayout) {
    assert.ok(field.labelInset >= 12 && field.inputInset >= 12, `${field.label} should have room inside its field`);
    assert.deepEqual(field.missingClasses, [], `${field.label} should have parent and child styling classes`);
  }
  assert.ok(date.value && date.labelBottom < date.inputTop, 'the populated date label should float above its value');
  assert.notEqual(color.fill, 'rgba(0, 0, 0, 0)', 'Color should have a painted filled surface');
  assert.equal(size.fill, 'rgba(0, 0, 0, 0)', 'Size should have a transparent outlined surface');
  t.diagnostic('Server-only page painted with JavaScript disabled.');

  const page = await browser.newPage();
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && url.pathname !== '/favicon.ico' && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  const appGate = Promise.withResolvers();
  const appRequest = Promise.withResolvers();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) return request.abort();
    if (url.pathname.startsWith('/assets/') && request.resourceType() === 'script') {
      appRequest.resolve();
      return appGate.promise.then(() => request.continue());
    }
    return request.continue();
  });

  const navigation = page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  try {
    await Promise.race([appRequest.promise, navigation.then((response) => {
      throw new Error(`Built application module was not requested (HTTP ${response?.status()}).`);
    })]);
    await waitFor(page, 'the annotated server checkbox before module execution', () => document.querySelector('#hello-cb')?.shadowRoot
      ?.querySelector('[part="container"][c-id]'));
    await page.evaluate(() => {
      const host = document.querySelector('#hello-cb');
      const shadow = host.shadowRoot;
      window.serverCheckbox = { host, shadow, child: shadow.querySelector('[part="container"][c-id]') };
    });
  } finally {
    appGate.resolve();
  }
  assert.equal((await navigation).status(), 200);
  t.diagnostic('Captured the original shadow nodes and released the application module.');

  await waitFor(page, 'the preview controls to adopt their server markup', () => ['#hello-cb', '#theme-toggle', '#menu-anchor', '#menu', 'md-date-picker']
    .every((selector) => {
      const host = document.querySelector(selector);
      return host?.shadowRoot && !host.hasAttribute('s-id') && host.classList.contains('hydrated');
    }));
  assert.ok(await page.evaluate(() => {
    const { host, shadow, child } = window.serverCheckbox;
    return host === document.querySelector('#hello-cb') &&
      host.shadowRoot === shadow && shadow.querySelector('[part="container"]') === child &&
      !child.hasAttribute('c-id');
  }), 'the original server checkbox nodes must survive registration');
  await waitFor(page, 'the nested text fields, select menus, and date picker button to adopt their server markup', () =>
    [...document.querySelectorAll('md-date-picker[label="Meeting Date"], md-select[label="Color"], md-select[label="Size"]')]
      .every((host) => {
        const nodes = host.shadowRoot?.querySelectorAll('[part="field"], [part="calendar-button"], [part="menu"]');
        return nodes?.length === 2 && [...nodes].every((node) => node.shadowRoot && !node.hasAttribute('s-id'));
      }));
  const adoptedLayout = await page.evaluate(inspectFieldLayout);

  await page.click('#hello-cb');
  await waitFor(page, 'the first checkbox click and mdChange', () => document.querySelector('#hello-cb').getAttribute('aria-checked') === 'true' &&
    document.querySelector('#cb-label').textContent.trim() === 'Checkbox (checked)');
  await page.click('#theme-toggle');
  await waitFor(page, 'the theme toggle', () => document.documentElement.dataset.theme === 'dark');
  await page.click('#menu-anchor');
  await waitFor(page, 'the menu to open and focus its first item', () => {
    const menu = document.querySelector('#menu');
    return menu.open && document.activeElement === menu.querySelector('md-menu-item');
  });
  await page.keyboard.press('Escape');
  await waitFor(page, 'the menu to close on Escape', () => !document.querySelector('#menu').open);
  await waitFor(page, 'the date picker calendar button to adopt its server markup', () => {
    const calendar = document.querySelector('md-date-picker').shadowRoot.querySelector('[part="calendar-button"]');
    return calendar?.shadowRoot && !calendar.hasAttribute('s-id');
  });
  await page.click('md-date-picker >>> [part="calendar-button"]');
  await waitFor(page, 'the first date picker click to open the calendar', () => document.querySelector('md-date-picker').shadowRoot
    .querySelector('[part="panel"]'));
  assert.deepEqual(errors, []);
  assert.deepEqual(adoptedLayout, renderedLayout, 'nested fields must retain their SSR layout and classes after adoption');
});

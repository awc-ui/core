// Build the Angular reference app before running this check.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

const assets = new URL('../dist/browser/', import.meta.url);
const index = await readFile(new URL('index.html', assets));
const selector = 'md-card, md-button, md-badge, md-checkbox';
let releaseScripts;
const scriptGate = new Promise(resolve => { releaseScripts = resolve; });

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/') return response.writeHead(200, { 'Content-Type': 'text/html' }).end(index);
  if (pathname === '/favicon.ico') return response.writeHead(204).end();
  const asset = /^\/([\w.-]+\.(js|css))$/.exec(pathname);
  if (!asset) return response.writeHead(404).end();
  try {
    const contents = await readFile(new URL(asset[1], assets));
    if (asset[2] === 'js') await scriptGate;
    const type = asset[2] === 'js' ? 'text/javascript' : 'text/css';
    response.writeHead(200, { 'Content-Type': type }).end(contents);
  } catch {
    response.writeHead(404).end();
  }
});

let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
  });

  const staticPage = await browser.newPage();
  await staticPage.setJavaScriptEnabled(false);
  await staticPage.goto(origin);
  assert.deepEqual(await staticPage.evaluate(selector => {
    const hosts = Array.from(document.querySelectorAll(selector));
    const checkbox = document.querySelector('md-checkbox');
    const glyph = checkbox?.shadowRoot?.querySelector('[part="icon"] > span');
    return {
      tags: hosts.map(host => host.localName),
      visibleDsd: hosts.every(host => host.shadowRoot && host.hasAttribute('s-id') &&
        getComputedStyle(host).visibility === 'visible' && host.getBoundingClientRect().width > 0),
      angular: document.querySelector('app-root')?.hasAttribute('ngh'),
      checked: checkbox?.getAttribute('aria-checked'),
      glyph: glyph && [glyph.textContent.trim(), getComputedStyle(glyph).animationName],
    };
  }, selector), {
    tags: ['md-card', 'md-button', 'md-button', 'md-badge', 'md-checkbox'],
    visibleDsd: true, angular: true, checked: 'true', glyph: ['check', 'none'],
  }, 'the prerender must display native DSD without JavaScript');
  await staticPage.close();

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 740 });
  await page.mouse.move(999, 739);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });

  // Keep the module responses pending until the browser has parsed the original DSD.
  const navigation = page.goto(origin);
  void navigation.catch(() => {});
  await page.waitForFunction(selector => {
    const hosts = Array.from(document.querySelectorAll(selector));
    return hosts.length === 5 && hosts.every(host => host.shadowRoot?.querySelector('[c-id]'));
  }, { timeout: 10_000 }, selector);
  await page.evaluate(selector => {
    const hosts = Array.from(document.querySelectorAll(selector));
    const checkbox = document.querySelector('md-checkbox');
    const shadows = hosts.map(host => host.shadowRoot);
    const probe = window.awcStartup = {
      selector, hosts, shadows, shadowNodes: shadows.map(shadow => shadow.querySelector('[c-id]')),
      root: document.querySelector('app-root'), main: document.querySelector('main'),
      samples: 0, wrongState: 0, initialMotion: [], changes: [], trustedInput: false, checkboxTransition: false,
    };
    function sample() {
      if (probe.trustedInput) return;
      probe.samples++;
      if (checkbox.getAttribute('aria-checked') !== 'true' || hosts.some(host =>
        !host.isConnected || getComputedStyle(host).visibility !== 'visible' || host.getBoundingClientRect().width === 0)) {
        probe.wrongState++;
      }
      requestAnimationFrame(sample);
    }
    sample();
    checkbox.addEventListener('click', event => { if (event.isTrusted) probe.trustedInput = true; }, true);
    checkbox.addEventListener('mdChange', event => probe.changes.push(event.detail));
    for (const shadow of shadows) {
      for (const type of ['transitionrun', 'animationstart']) {
        shadow.addEventListener(type, event => {
          if (!probe.trustedInput) probe.initialMotion.push(event.propertyName ?? event.animationName);
          else if (shadow.host === checkbox && event.propertyName === 'background-color' &&
            event.target.getAttribute('part') === 'container') probe.checkboxTransition = true;
        }, true);
      }
    }
  }, selector);

  releaseScripts();
  await navigation;
  try {
    await page.waitForFunction(() => !document.querySelector('app-root').hasAttribute('ngh') &&
      Array.from(document.querySelectorAll(window.awcStartup.selector)).every(host =>
        customElements.get(host.localName) && !host.hasAttribute('s-id') && host.hasAttribute('data-awc-motion-ready')),
    { timeout: 15_000 });
  } catch (error) {
    assert.deepEqual(errors, [], 'Angular bootstrap and custom-element registration must succeed');
    throw error;
  }

  assert.deepEqual(await page.evaluate(() => {
    const p = window.awcStartup;
    const hosts = Array.from(document.querySelectorAll(p.selector));
    return {
      hosts: hosts.length === p.hosts.length && hosts.every((host, i) => host === p.hosts[i]),
      shadows: hosts.every((host, i) => host.shadowRoot === p.shadows[i] &&
        host.shadowRoot.contains(p.shadowNodes[i]) && !p.shadowNodes[i].hasAttribute('c-id')),
      angular: document.querySelector('app-root') === p.root && document.querySelector('main') === p.main,
      sampled: p.samples > 1, wrongState: p.wrongState, motion: p.initialMotion, changes: p.changes,
    };
  }), {
    hosts: true, shadows: true, angular: true, sampled: true, wrongState: 0, motion: [], changes: [],
  }, 'Angular and Stencil must adopt the original DOM with a visible, quiet checked state');

  await page.click('md-checkbox');
  await page.waitForFunction(() => {
    const p = window.awcStartup;
    return p.trustedInput && p.checkboxTransition &&
      document.querySelector('md-checkbox').getAttribute('aria-checked') === 'false' &&
      p.changes.some(change => change.checked === false);
  }, { timeout: 5_000 });
  assert.deepEqual(errors, []);
  console.log('Angular SSR startup passed: native DSD, quiet adoption, and the first trusted checkbox transition.');
} finally {
  releaseScripts();
  try {
    await browser?.close();
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
}

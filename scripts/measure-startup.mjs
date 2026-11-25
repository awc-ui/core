#!/usr/bin/env node
// Comparable cold-load measurements, not wall-clock CI pass/fail thresholds.
// Example: node scripts/measure-startup.mjs --app=html --runs=3 --slow --output=/tmp/load.json
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
import puppeteer from 'puppeteer';

const repo = fileURLToPath(new URL('../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [name, ...value] = arg.replace(/^--/, '').split('=');
  return [name, value.length ? value.join('=') : true];
}));
const app = options.app || 'html';
const catalogs = {
  html: { heading: 'AWC UI — Vanilla HTML Playground', hosts: 180 },
  react: { heading: 'AWC UI React Integration', hosts: 180 },
  vue: { heading: 'AWC UI Vue Integration', hosts: 171 },
  svelte: { heading: 'AWC UI Svelte Integration', hosts: 171 },
  angular: { heading: 'AWC UI Angular Integration', hosts: 183 },
};
assert(Object.hasOwn(catalogs, app), 'Unknown playground');
const catalog = catalogs[app];
const directory = resolve(repo, options.directory || `apps/test-${app}/dist${app === 'angular' ? '/test-angular' : ''}`);
const runs = Number(options.runs || 3);
assert(Number.isInteger(runs) && runs > 0 && runs <= 20, 'runs must be 1–20');
const slow = options.slow === true;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const cache = new Map();
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (path === '/favicon.ico') return void response.writeHead(204).end();
  const file = resolve(directory, path === '/' ? 'index.html' : `.${path}`);
  if (!file.startsWith(`${directory}${sep}`)) return void response.writeHead(404).end();
  try {
    let entry = cache.get(file);
    if (!entry) {
      const body = await readFile(file);
      const compressed = /\.(?:html|css|m?js|json|svg)$/.test(file);
      entry = {
        body: compressed ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) : body,
        headers: { 'Content-Type': types[extname(file)] || 'application/octet-stream',
          ...(compressed ? { 'Content-Encoding': 'br' } : {}), 'Cache-Control': 'no-store' },
      };
      cache.set(file, entry);
    }
    response.writeHead(200, entry.headers).end(entry.body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH });
const results = [];
try {
  // Warm only the static server's compression cache, never the measured browser.
  const warm = await browser.newPage();
  await warm.setViewport({ width: 390, height: 844 });
  await warm.setRequestInterception(true);
  warm.on('request', request => request.url().startsWith(origin) ? request.continue() : request.abort());
  await warm.goto(origin, { waitUntil: 'networkidle0' });
  await warm.close();
  for (let run = 0; run < runs; run++) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const failures = [];
    try {
      await page.setViewport({ width: 390, height: 844 });
      await page.setCacheEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => request.url().startsWith(origin) ? request.continue() : request.abort());
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
      });
      const cdp = await page.createCDPSession();
      await cdp.send('Performance.enable');
      if (slow) {
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false, latency: 80, downloadThroughput: 500_000, uploadThroughput: 125_000,
        });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      await page.evaluateOnNewDocument(({ heading: expectedHeading, hosts: expectedHosts }) => {
        performance.setResourceTimingBufferSize(5000);
        const state = window.__loadMeasure = { cls: 0, totalLayoutShift: 0, lcp: 0, longTasks: 0, longTaskMs: 0, fontsReadyMs: 0 };
        if (PerformanceObserver.supportedEntryTypes.includes('element')) {
          // Tag the existing heading in both builds before it paints. A generic
          // FCP can otherwise reflect earlier incidental text elsewhere.
          const identifier = 'catalog-heading';
          const observer = new MutationObserver(() => {
            const heading = document.querySelector('h1');
            if (heading?.textContent.trim() === expectedHeading) {
              heading.setAttribute('elementtiming', identifier);
              observer.disconnect();
            }
          });
          observer.observe(document, { childList: true, subtree: true });
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) if (entry.identifier === identifier && entry.renderTime > 0) {
              state.catalogHeadingMs ??= entry.renderTime;
            }
          }).observe({ type: 'element', buffered: true });
        }
        let sessionStart = 0, lastShift = 0, sessionValue = 0;
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
            state.totalLayoutShift += entry.value;
            if (entry.startTime - lastShift < 1000 && entry.startTime - sessionStart < 5000) sessionValue += entry.value;
            else { sessionStart = entry.startTime; sessionValue = entry.value; }
            lastShift = entry.startTime;
            state.cls = Math.max(state.cls, sessionValue);
          }
        }).observe({ type: 'layout-shift', buffered: true });
        // Timestamp the actual font completion independently of control setup.
        // A later font loading cycle replaces the earlier completion checkpoint.
        document.fonts.addEventListener('loadingdone', () => { state.fontsReadyMs = performance.now(); });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) state.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) { state.longTasks++; state.longTaskMs += entry.duration; }
        }).observe({ type: 'longtask', buffered: true });
        state.hosts = () => {
          const hosts = [];
          const visit = root => {
            for (const el of root.querySelectorAll('*')) {
              if (el.localName.startsWith('md-')) hosts.push(el);
              if (el.shadowRoot) visit(el.shadowRoot);
            }
          };
          visit(document);
          return hosts;
        };
        const visible = element => {
          if (!element?.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
          const { width, height } = element.getBoundingClientRect();
          return width > 0 && height > 0;
        };
        state.catalogReady = () => {
          const hosts = state.hosts();
          if (hosts.length !== expectedHosts || !hosts.every(el => el.classList.contains('hydrated') && el.shadowRoot)) return false;
          const heading = document.querySelector('h1');
          const theme = document.querySelector('md-button[variant="tonal"]');
          const checkbox = document.querySelector('md-checkbox');
          const field = document.querySelector('md-text-field');
          return heading?.textContent.trim() === expectedHeading && visible(heading) &&
            getComputedStyle(heading).fontSize === '32px' &&
            theme?.textContent.includes('Dark Mode') && theme.getAttribute('aria-disabled') === 'false' &&
            visible(theme.shadowRoot.querySelector('[part~="label"]')) &&
            checkbox?.getAttribute('role') === 'checkbox' && visible(checkbox.shadowRoot.querySelector('[part~="container"]')) &&
            visible(field?.shadowRoot.querySelector('input:not([disabled])'));
        };
        const ready = () => {
          if (!state.themeReadyMs) {
            const theme = document.querySelector('md-button[variant="tonal"]');
            const label = theme?.shadowRoot?.querySelector('[part~="label"]');
            if (theme?.classList.contains('hydrated') && theme.getAttribute('aria-disabled') === 'false' &&
              theme.textContent.includes('Dark Mode') && visible(label)) state.themeReadyMs = performance.now();
          }
          if (state.catalogReady()) state.controlsReadyMs = performance.now();
          else requestAnimationFrame(ready);
        };
        requestAnimationFrame(ready);
      }, catalog);
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => window.__loadMeasure.controlsReadyMs > 0, { timeout: 60_000 });
      const allReadyMs = await page.evaluate(async () => { await document.fonts.ready; return performance.now(); });
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
      const result = await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const state = window.__loadMeasure;
        const resources = performance.getEntriesByType('resource').filter(entry => entry.name.startsWith(location.origin)).map(entry => ({
          path: new URL(entry.name).pathname, kind: /\.(?:woff2?|ttf)(?:$|\?)/.test(entry.name) ? 'font' :
            /\.css(?:$|\?)/.test(entry.name) ? 'css' : /\.m?js(?:$|\?)/.test(entry.name) ? 'js' : 'other',
          initiatorType: entry.initiatorType, fetchStartMs: entry.fetchStart, responseEndMs: entry.responseEnd,
          encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize,
        }));
        return { themeReadyMs: state.themeReadyMs, controlsReadyMs: state.controlsReadyMs, fontsReadyMs: state.fontsReadyMs,
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          catalogHeadingMs: state.catalogHeadingMs,
          lcpMs: state.lcp, cls: state.cls, totalLayoutShift: state.totalLayoutShift,
          longTasks: state.longTasks, longTaskMs: state.longTaskMs,
          hydratedHosts: state.hosts().filter(host => host.classList.contains('hydrated') && host.shadowRoot).length,
          catalogReady: state.catalogReady(), resources };
      });
      result.allReadyMs = allReadyMs;
      const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
      result.scriptMs = metrics.ScriptDuration * 1000;
      result.taskMs = metrics.TaskDuration * 1000;
      result.heapBytes = metrics.JSHeapUsedSize;
      assert.deepEqual(failures, [], 'Measured page must work');
      assert(result.fcpMs > 0, 'Measured page must paint content');
      assert(result.catalogReady && result.hydratedHosts === catalog.hosts, 'Measured catalog must stay fully hydrated and visible');
      delete result.catalogReady;
      results.push(result);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const measures = ['themeReadyMs', 'controlsReadyMs', 'fontsReadyMs', 'allReadyMs', 'fcpMs', 'lcpMs', 'cls', 'totalLayoutShift', 'longTasks', 'longTaskMs', 'scriptMs', 'taskMs', 'heapBytes'];
if (results.every(result => result.catalogHeadingMs > 0)) measures.push('catalogHeadingMs');
const summary = Object.fromEntries(measures.map(key => [key, median(results.map(result => result[key]))]));
for (const kind of ['js', 'css', 'font']) {
  summary[`${kind}Requests`] = median(results.map(result => result.resources.filter(resource => resource.kind === kind).length));
  summary[`${kind}EncodedBytes`] = median(results.map(result => result.resources.filter(resource => resource.kind === kind).reduce((sum, resource) => sum + resource.encodedBytes, 0)));
}
const report = { app, directory, runs, profile: slow ? '4 Mbps / 80 ms RTT / 4x CPU' : 'unthrottled',
  externalFonts: 'blocked consistently', compression: 'Brotli quality 5', summary, results };
if (options.output) await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ app, profile: report.profile, runs, summary }, null, 2));

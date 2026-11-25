import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const viewports = [{ width: 1440, height: 1050 }, { width: 390, height: 844 }];

// Runs before framework scripts. Probe layout at the host boundary: chart plot
// introductions are documented, but they must not move the dashboard around.
function installProbe() {
  const probe = window.awcStarterFirstPaint = { frames: [], stopped: false, ssr: [], released: false };
  const rect = element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const allHosts = root => {
    const found = [];
    for (const element of root.querySelectorAll('*')) {
      if (element.localName.startsWith('md-')) found.push(element);
      if (element.shadowRoot) found.push(...allHosts(element.shadowRoot));
    }
    return found;
  };
  probe.snapshot = () => {
    const hosts = allHosts(document);
    const visibleUnhydrated = hosts.filter(element => {
      const box = element.getBoundingClientRect();
      return !element.classList.contains('hydrated') && getComputedStyle(element).visibility === 'visible' &&
        box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
    }).map(element => element.id || element.localName);
    const landmarks = [...document.querySelectorAll('md-app-bar, main, md-card, md-table-container, md-switch, md-line-chart')]
      .map((element, index) => ({ key: `${element.localName}:${index}`, ...rect(element), visibility: getComputedStyle(element).visibility }));
    return { time: performance.now(), definedHosts: hosts.filter(host => !!customElements.get(host.localName)).length, visibleUnhydrated, landmarks, replaced: probe.ssr.filter(item => !item.host.isConnected || item.host.shadowRoot !== item.root || !item.node.isConnected).map(item => item.key) };
  };
  probe.captureServerNodes = () => {
    probe.ssr = allHosts(document).filter(host => host.classList.contains('hydrated') && host.shadowRoot)
      .map((host, index) => ({ host, root: host.shadowRoot, node: host.shadowRoot.querySelector(':not(style)') || host, key: `${host.localName}:${index}` }));
    return probe.ssr.length;
  };
  function tick() {
    if (probe.stopped) return;
    if (document.querySelector('md-table-container') && document.querySelectorAll('md-card').length >= 3 &&
      performance.getEntriesByName('first-contentful-paint', 'paint').length) {
      probe.frames.push(probe.snapshot());
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function summarizeFrames(frames) {
  const visibleUnhydrated = [...new Set(frames.flatMap(frame => frame.visibleUnhydrated))];
  const replaced = [...new Set(frames.flatMap(frame => frame.replaced))];
  const ranges = new Map();
  for (const frame of frames) {
    for (const item of frame.landmarks) {
      let range = ranges.get(item.key);
      if (!range) {
        range = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, [item[key], item[key]]]));
        ranges.set(item.key, range);
      }
      for (const key of ['x', 'y', 'width', 'height']) {
        range[key][0] = Math.min(range[key][0], item[key]);
        range[key][1] = Math.max(range[key][1], item[key]);
      }
    }
  }
  const geometryChanges = [...ranges].flatMap(([element, range]) =>
    Object.entries(range).filter(([, [min, max]]) => max - min > 2)
      .map(([property, [min, max]]) => ({ element, property, min, max, delta: max - min })));
  return { frames: frames.length, visibleUnhydrated, replaced, geometryChanges };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function inspectStarterFirstPaint(browser, url, { framework, artifactDir }) {
  await mkdir(artifactDir, { recursive: true });
  const failures = [];
  const reports = [];
  for (const viewport of viewports) {
    const label = `${framework}-${viewport.width}`;
    const noJs = await browser.newPage();
    try {
      await noJs.setViewport(viewport);
      await noJs.setJavaScriptEnabled(false);
      await noJs.goto(url, { waitUntil: 'networkidle0' });
      const state = await noJs.evaluate(() => {
        const cards = [...document.querySelectorAll('md-card')];
        return {
          revenue: document.body.textContent.includes('Revenue'),
          visibleCards: cards.filter(card => card.shadowRoot && card.classList.contains('hydrated') && getComputedStyle(card).visibility === 'visible' && card.getBoundingClientRect().height > 0).length,
          defined: !!customElements.get('md-card'),
          shadowRoots: [...document.querySelectorAll('*')].filter(host => host.shadowRoot).length,
        };
      });
      await noJs.screenshot({ path: join(artifactDir, `${label}-no-js.png`), fullPage: true });
      assert(state.revenue && state.visibleCards >= 2 && !state.defined && state.shadowRoots > 0, `${label}: meaningful styled SSR content must be visible with JavaScript disabled: ${JSON.stringify(state)}`);
      reports.push({ viewport, noJavaScript: state });
    } finally { await noJs.close(); }

    const page = await browser.newPage();
    const browserErrors = [];
    const heldScripts = new Set();
    let released = false;
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('requestfailed', request => {
      if (request.resourceType() === 'script') browserErrors.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    page.on('response', response => {
      if (response.request().resourceType() === 'script' && response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
    });
    try {
      await page.setViewport(viewport);
      await page.evaluateOnNewDocument(installProbe);
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (!released && request.resourceType() === 'script') heldScripts.add(request);
        else void request.continue().catch(() => {});
      });
      // Deferred/module scripts hold DOMContentLoaded. Start navigation now,
      // inspect native DSD at first paint, then await navigation after release.
      const navigation = page.goto(url, { waitUntil: 'domcontentloaded' });
      void navigation.catch(() => {});
      await page.waitForFunction(() => window.awcStarterFirstPaint?.frames.length >= 3, { timeout: 30_000 });
      assert(heldScripts.size > 0, `${label}: framework scripts were not held`);
      const serverNodes = await page.evaluate(() => window.awcStarterFirstPaint.captureServerNodes());
      assert(serverNodes > 0, `${label}: no server shadow nodes to test for adoption`);
      const blocked = await page.evaluate(() => window.awcStarterFirstPaint.snapshot());
      assert.equal(blocked.definedHosts, 0, `${label}: runtime must remain blocked until after the initial snapshot`);
      await page.screenshot({ path: join(artifactDir, `${label}-before-hydration.png`), fullPage: true });
      const heldScriptCount = heldScripts.size;
      released = true;
      await Promise.all([...heldScripts].map(request => request.continue()));
      heldScripts.clear();
      await navigation;
      await page.waitForFunction(() => {
        const visit = root => [...root.querySelectorAll('*')].every(element => {
          if (element.localName.startsWith('md-') && (!customElements.get(element.localName) || !element.shadowRoot || !element.classList.contains('hydrated'))) return false;
          return !element.shadowRoot || (element.shadowRoot.querySelectorAll('[c-id]').length === 0 && visit(element.shadowRoot));
        });
        const chart = document.querySelector('md-line-chart');
        return visit(document) && chart?.series?.[0]?.data?.length === 8 && !!chart.shadowRoot?.querySelector('canvas');
      }, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 });
      await nextPaint(page);
      const settled = await page.evaluate(() => {
        const probe = window.awcStarterFirstPaint;
        probe.stopped = true;
        return { frames: probe.frames, final: probe.snapshot() };
      });
      await page.screenshot({ path: join(artifactDir, `${label}-after-hydration.png`), fullPage: true });
      const summary = summarizeFrames(settled.frames);
      reports.at(-1).hydration = { serverNodes, heldScriptCount, browserErrors, blocked, final: settled.final, ...summary };
      await writeFile(join(artifactDir, `${label}-frames.json`), JSON.stringify(settled.frames, null, 2));
      if (summary.visibleUnhydrated.length) failures.push(`${label}: visible unhydrated hosts ${summary.visibleUnhydrated.join(', ')}`);
      if (summary.replaced.length) failures.push(`${label}: replaced SSR nodes ${summary.replaced.join(', ')}`);
      if (summary.geometryChanges.length) failures.push(`${label}: startup layout moved ${JSON.stringify(summary.geometryChanges)}`);
      if (browserErrors.length) failures.push(`${label}: ${browserErrors.join('; ')}`);
    } finally {
      released = true;
      for (const request of heldScripts) await request.abort().catch(() => {});
      await page.close();
      await writeFile(join(artifactDir, `${framework}-first-paint.json`), JSON.stringify({ framework, reports, failures }, null, 2));
    }
  }
  assert.deepEqual(failures, [], `${framework} first-paint regressions; see ${artifactDir}`);
  console.log(`[verify-starters] PASS ${framework}: no-JS SSR visibility, mobile/desktop hydration frames, stable layout and preserved server nodes`);
}

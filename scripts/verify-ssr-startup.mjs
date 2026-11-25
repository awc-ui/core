#!/usr/bin/env node
// Production first-paint checks. Build the five credit-risk SSR/SSG apps first.
// External fonts are blocked here; the HTML first-paint suite tests font swaps.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { SSR_APPS, SCREENS } from './lib/ssr-apps.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const puppeteer = createRequire(new URL('../apps/test-html/package.json', import.meta.url))('puppeteer');
const apps = [...SSR_APPS, {
  id: 'astro', dir: 'apps/showcase/credit-risk/astro', port: 4326,
  base: '/showcase/credit-risk/astro', start: ['serve'],
}];
const requested = process.argv.slice(2);
assert.ok(requested.every(id => apps.some(app => app.id === id)), 'Unknown SSR framework');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start(app) {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, 'localhost', resolve);
  });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn('pnpm', app.id === 'astro' ? ['serve', String(port)] : ['start'], {
    cwd: `${root}${app.dir}`, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOST: 'localhost', PORT: String(port), NITRO_PORT: String(port) },
  });
  let log = '';
  server.stdout.on('data', chunk => { log += chunk; });
  server.stderr.on('data', chunk => { log += chunk; });
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
  const origin = `http://localhost:${port}`;
  try {
    for (let attempt = 0; attempt < 180; attempt++) {
      assert.equal(server.exitCode, null, `Server exited: ${log}`);
      try {
        if ((await fetch(`${origin}${app.base}/`, { signal: AbortSignal.timeout(3000) })).ok) {
          assert.equal(server.exitCode, null, `Server exited: ${log}`);
          return { origin, stop };
        }
      } catch {}
      await sleep(250);
    }
    throw new Error(`Server did not start: ${log}`);
  } catch (error) { stop(); throw error; }
}

function inspect() {
  const hosts = [];
  const walk = root => {
    for (const el of root.querySelectorAll('*')) {
      if (el.localName.startsWith('md-')) hosts.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const visible = el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none';
  };
  return {
    shadows: hosts.filter(el => el.shadowRoot).length,
    visibleButtons: hosts.filter(el => el.localName === 'md-button' && el.shadowRoot && visible(el)).length,
    heading: document.querySelector('h1')?.textContent.trim(),
    unclaimed: hosts.filter(el => el.shadowRoot?.querySelector('[c-id]')).map(el => el.localName),
  };
}

function installProbe() {
  const visible = el => el?.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const selectors = ['h1', 'md-button', 'md-checkbox', 'md-switch', 'md-tab', 'md-navigation-tab'];
  const samples = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map((el, index) => {
    const rect = el.getBoundingClientRect();
    if (!visible(el) || rect.bottom <= 0 || rect.top >= innerHeight) return null;
    return { selector, index, element: el, shadow: el.shadowRoot, rect: [rect.x, rect.y, rect.width, rect.height] };
  })).filter(Boolean);
  const probe = window.__awcSSRStartup = { samples, frames: 0, failures: [], motion: [], stopped: false };
  const roots = new Set();
  const seenAnimations = new WeakSet();
  // These components intentionally animate loading/data/decorative state.
  const ambient = /^md-(?:(?:area|bar|line|pie|organization)-chart|sparkline|loading-indicator|progress-indicator|skeleton|status-dot|meter)$/;
  const recordMotion = (target, name) => {
    const owner = target?.localName?.startsWith('md-') ? target : target?.getRootNode().host;
    // These keyframes only signal browser autofill to the component; they
    // change a private custom property, with no visual interpolation.
    if (owner?.localName === 'md-text-field' && /^md-tf-autofill-(start|cancel)$/.test(name)) return;
    // Match Core's existing contract for explicit entrance effects.
    if (owner?.localName === 'md-breadcrumb-item' && /^md-breadcrumb-enter(?:-rtl)?$/.test(name)) return;
    if (owner?.localName === 'md-step' && name === 'md-step-enter') return;
    if (!probe.stopped && owner?.localName.startsWith('md-') && !ambient.test(owner.localName)) {
      probe.motion.push(`${owner.localName}: ${name}`);
    }
  };
  const observeRoots = root => {
    if (!roots.has(root)) {
      roots.add(root);
      for (const type of ['transitionrun', 'animationstart']) {
        root.addEventListener(type, event => recordMotion(event.target, event.propertyName || event.animationName), true);
      }
    }
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) observeRoots(element.shadowRoot);
  };
  observeRoots(document);
  const serverRoots = [...roots].filter(root => root.host?.hasAttribute('s-id'))
    .map(root => ({ host: root.host, root }));
  function frame() {
    if (probe.stopped) return;
    probe.frames++;
    observeRoots(document);
    for (const { host, root } of serverRoots) {
      if (!host.isConnected || host.shadowRoot !== root) {
        probe.failures.push(`${host.localName} server shadow root was replaced`);
      }
    }
    for (const root of roots) {
      for (const animation of root.getAnimations?.() ?? []) {
        if (seenAnimations.has(animation)) continue;
        seenAnimations.add(animation);
        recordMotion(animation.effect?.target, animation.transitionProperty || animation.animationName || 'Web Animation');
      }
    }
    for (const sample of samples) {
      const el = document.querySelectorAll(sample.selector)[sample.index];
      if (!visible(el) || (sample.selector.startsWith('md-') && !el.shadowRoot)) {
        const style = el && getComputedStyle(el);
        probe.failures.push(`${sample.selector}[${sample.index}] disappeared (${style?.visibility}, ${style?.opacity}, ${el?.shadowRoot ? 'shadow' : 'no shadow'})`);
        continue;
      }
      if (el !== sample.element || el.shadowRoot !== sample.shadow) {
        probe.failures.push(`${sample.selector}[${sample.index}] was replaced`);
      }
      const rect = el.getBoundingClientRect();
      const values = [rect.x, rect.y, rect.width, rect.height];
      if (values.some((value, index) => Math.abs(value - sample.rect[index]) > 1)) {
        probe.failures.push(`${sample.selector}[${sample.index}] moved: ${sample.rect} -> ${values}`);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function verify(browser, url, viewport, runtimeFirst = false) {
  const errors = [];
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const localOrigin = new URL(url).origin;
  let phase = 'no-js';
  const held = new Set();
  await page.setRequestInterception(true);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(localOrigin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', request => {
    const local = request.url().startsWith(localOrigin);
    if (!local && /^https?:/.test(request.url())) return void request.abort();
    if (phase !== 'no-js' && request.resourceType() === 'script' &&
        (phase === 'all-js' || (phase === 'runtime' && request.url().includes('/awc-runtime/')) ||
          (phase === 'framework' && !request.url().includes('/awc-runtime/')))) {
      held.add(request);
    } else void request.continue();
  });
  const release = () => {
    for (const request of held) {
      if (phase === 'runtime' && request.url().includes('/awc-runtime/')) continue;
      if (phase === 'framework' && !request.url().includes('/awc-runtime/')) continue;
      held.delete(request);
      void request.continue();
    }
  };
  try {
    await page.setJavaScriptEnabled(false);
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    const serverOnly = await page.evaluate(inspect);
    assert.ok(serverOnly.shadows > 20 && serverOnly.visibleButtons > 0 && serverOnly.heading,
      `No-JS content missing: ${JSON.stringify({ url: page.url(), status: response.status(), ...serverOnly,
        body: (await page.evaluate(() => document.body.innerText)).slice(0, 300), errors })}`);

    await page.setJavaScriptEnabled(true);
    phase = 'all-js';
    const committed = new Promise(resolve => {
      const listener = frame => {
        if (frame !== page.mainFrame()) return;
        page.off('framenavigated', listener);
        resolve();
      };
      page.on('framenavigated', listener);
    });
    const navigation = page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    void navigation.catch(() => {});
    await Promise.race([committed, navigation]);
    // Observe the actual first painted server content while client scripts wait.
    await page.waitForFunction(() => document.querySelector('h1') &&
      performance.getEntriesByName('first-contentful-paint', 'paint').length > 0);
    assert.equal((await page.evaluate(inspect)).heading, serverOnly.heading);
    await page.evaluate(installProbe);
    phase = runtimeFirst ? 'framework' : 'runtime'; release();
    if (runtimeFirst) {
      await page.waitForFunction(() => [...document.querySelectorAll('md-card')].length > 0 &&
        [...document.querySelectorAll('md-card')].every(host => host.hasAttribute('data-awc-motion-ready')));
    } else {
      await sleep(500); // Deliberately prolong framework hydration without Stencil.
    }
    phase = 'live'; release();
    await navigation;
    await page.waitForFunction(() => customElements.get('md-button'));
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('*')]
        .filter(el => el.localName.startsWith('md-'))
        .map(el => el.componentOnReady?.()));
      await new Promise(resolve => setTimeout(resolve, 250));
      window.__awcSSRStartup.stopped = true;
    });
    const result = await page.evaluate(() => ({
      frames: window.__awcSSRStartup.frames,
      failures: [...new Set(window.__awcSSRStartup.failures)],
      motion: [...new Set(window.__awcSSRStartup.motion)],
    }));
    const hydrated = await page.evaluate(inspect);
    assert.ok(result.frames >= 3, 'Must sample multiple painted frames');
    assert.deepEqual(result.failures, [], 'Server controls must remain visible and stationary through hydration');
    assert.deepEqual(result.motion, [], 'Interaction motion must not run during framework hydration');
    assert.deepEqual(hydrated.unclaimed, [], 'SSR shadow content must be adopted, not duplicated');
    assert.deepEqual(errors, [], 'No runtime errors or failed local assets');

    // A genuine user click on the first navigation control must still navigate.
    const destination = await page.evaluate(() => {
      const current = location.pathname.replace(/\/$/, '');
      const host = [...document.querySelectorAll('nav md-button')].find(el => {
        const href = el.getAttribute('href');
        return href && new URL(href, location.href).pathname.replace(/\/$/, '') !== current;
      });
      const link = host?.shadowRoot?.querySelector('a');
      if (!link) return null;
      window.__awcFirstClick = false;
      // A native anchor works even when custom-element handlers are broken.
      // First prove the component's cancelable custom event, then navigate.
      host.addEventListener('mdClick', event => {
        event.preventDefault();
        event.stopPropagation();
        window.__awcFirstClick = true;
      }, { once: true });
      const rect = link.getBoundingClientRect();
      return { href: link.href, heading: link.href.includes('watchlist') ? 'Watchlist' : 'Portfolio overview',
        x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    assert.ok(destination, 'Expected a navigation link to a different route');
    await page.mouse.click(destination.x, destination.y);
    await page.waitForFunction(() => window.__awcFirstClick === true);
    await page.mouse.click(destination.x, destination.y);
    await page.waitForFunction(href => location.pathname.replace(/\/$/, '') === new URL(href).pathname.replace(/\/$/, ''), {}, destination.href);
    await page.waitForFunction(heading => document.querySelector('h1')?.textContent.includes(heading), {}, destination.heading);
    assert.deepEqual(errors, [], 'First input must not introduce runtime errors');
    return { noJsShadows: serverOnly.shadows, sampledFrames: result.frames };
  } finally {
    phase = 'live'; release();
    await page.close();
  }
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH });
try {
  for (const app of apps.filter(app => !requested.length || requested.includes(app.id))) {
    const server = await start(app);
    try {
      if (app.id !== 'astro') {
        const stamp = async () => {
          const html = await fetch(`${server.origin}${app.base}/`, { signal: AbortSignal.timeout(15_000) }).then(response => response.text());
          assert.match(html, /shadowrootmode=["']open["']/, `${app.id} must serve DSD`);
          return html.match(/<meta\s+name=["']awc-rendered-at["']\s+content=["']([^"']+)["']/)?.[1];
        };
        const first = await stamp();
        await sleep(1100);
        const second = await stamp();
        assert.ok(first && second && first !== second, `${app.id} must render per request, not serve a cached shell`);
      }
      for (const viewport of [{ width: 1440, height: 1050 }, { width: 390, height: 844 }]) {
        // Every route, not only the landing page, must keep its server render.
        for (const screen of SCREENS) {
          const result = await verify(browser, `${server.origin}${app.base}/${screen}`, viewport);
          console.log(`PASS ${app.id} ${viewport.width}px /${screen} ${JSON.stringify(result)}`);
        }
        // These frameworks and Stencil can load in either order. The watchlist
        // includes cards with application classes, the sensitive claim case.
        // SvelteKit explicitly starts Stencil after its own hydration instead.
        if (['next', 'nuxt', 'angular-ssr'].includes(app.id)) {
          const result = await verify(browser, `${server.origin}${app.base}/watchlist/`, viewport, true);
          console.log(`PASS ${app.id} ${viewport.width}px /watchlist/ runtime-first ${JSON.stringify(result)}`);
        }
      }
    } finally { server.stop(); }
  }
} finally { await browser.close(); }

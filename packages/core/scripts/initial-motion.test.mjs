// Run after the Core package build with Node 22+ and Puppeteer's Chrome installed.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { after, test } from 'node:test';
import {
  ambientFixture, catalogFixture, externalSearchFixture, fixtureTags, interactionFixture, openPickerFixtures,
} from './initial-motion-fixtures.mjs';

const core = new URL('../', import.meta.url);
const catalogTags = fixtureTags(catalogFixture);
const interactionTags = fixtureTags(interactionFixture);
const readyAttribute = 'data-awc-motion-ready';
const entries = {
  'custom elements': '/dist/components',
  'CSR-only custom elements': '/dist/components-csr',
  'lazy loader': '/loader/index.mjs',
};
const mime = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};
const targets = [
  ['#button-default', null, ['backgroundColor', 'color', 'borderTopLeftRadius']],
  ['#button-filled', null, ['backgroundColor', 'color', 'borderTopLeftRadius']],
  ['#button-selected', null, ['backgroundColor', 'color', 'borderTopLeftRadius']],
  ['#check-on', '[part="icon"] .material-symbols-outlined', ['opacity', 'transform']],
  ['#check-mixed', '[part="icon"] .material-symbols-outlined', ['opacity', 'transform']],
  ['#list-selected', '[part="image-selection-circle"]', ['opacity', 'transform']],
  ['#toolbar-selected', '[part="selection-caption"]', ['opacity', 'transform']],
  ['#skeleton-none', null, ['opacity', 'transform']],
];

let browser;
let origin;
let server;
let browserReady;
let fixtureId = 0;
const documents = new Map();

async function startBrowser() {
  const { default: puppeteer } = await import('puppeteer');
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (documents.has(pathname)) {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(documents.get(pathname));
      return;
    }
    const type = mime[extname(pathname)];
    if (type && /^\/(?:dist|loader)\/(?:[\w-]+\/)*[\w.-]+$/.test(pathname)) {
      try {
        const asset = await readFile(new URL(`.${pathname}`, core));
        response.writeHead(200, { 'Content-Type': type }).end(asset);
        return;
      } catch (error) {
        response.writeHead(404).end(error.message);
        return;
      }
    }
    response.writeHead(pathname === '/favicon.ico' ? 204 : 404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
  });
}

after(async () => {
  await browser?.close();
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

function installProbe(frameTargets) {
  const events = [];
  const animations = [];
  const samples = [];
  const changes = [];
  const shadowRoots = new Set();
  const seen = new WeakSet();
  const phase = () => window.motionProbe.phase;
  function describe(target) {
    const owner = target.localName?.startsWith('md-') ? target : target.getRootNode().host;
    return {
      owner: owner?.localName,
      id: owner?.id || undefined,
      target: target.getAttribute('part') || target.getAttribute('class') || target.localName,
    };
  }
  function listen(root) {
    for (const type of ['animationstart', 'transitionrun']) {
      root.addEventListener(type, (event) => {
        if (event.target instanceof Element) {
          events.push({
            ...describe(event.target), phase: phase(), type,
            name: event.animationName ?? event.propertyName,
            pseudo: event.pseudoElement || undefined,
          });
        }
      }, true);
    }
  }
  function observe(root) {
    if (shadowRoots.has(root)) return;
    shadowRoots.add(root);
    listen(root);
  }
  function findDeclarativeRoots(root) {
    for (const element of root.querySelectorAll('*')) {
      if (!element.shadowRoot) continue;
      observe(element.shadowRoot);
      findDeclarativeRoots(element.shadowRoot);
    }
  }
  window.motionProbe = { events, animations, samples, changes, phase: 'initial', findDeclarativeRoots };
  listen(document);
  document.addEventListener('mdChange', (event) => changes.push(event.target.id));
  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (...args) {
    const root = attachShadow.apply(this, args);
    observe(root);
    return root;
  };
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const animation = animate.apply(this, args);
    const timing = animation.effect.getComputedTiming();
    if (timing.activeDuration > 0) {
      animations.push({ ...describe(this), phase: phase(), type: 'waapi', name: 'Element.animate' });
    }
    return animation;
  };
  // Parsing declarative shadow DOM bypasses Element.attachShadow. Observe
  // those roots before their first style/animation update and again before upgrade.
  const parser = new MutationObserver(() => findDeclarativeRoots(document));
  parser.observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    findDeclarativeRoots(document);
    parser.disconnect();
  });

  function sampleFrame() {
    for (const root of [document, ...shadowRoots]) {
      for (const animation of root.getAnimations?.() ?? []) {
        if (seen.has(animation)) continue;
        const target = animation.effect?.target;
        if (!(target instanceof Element)) continue;
        const name = animation.animationName ?? animation.transitionProperty;
        if (!name) continue;
        seen.add(animation);
        animations.push({
          ...describe(target), phase: phase(), type: 'frame',
          name, pseudo: animation.effect.pseudoElement || undefined,
        });
      }
    }
    if (phase() === 'initial') {
      for (const [selector, part, properties] of frameTargets) {
        const host = document.querySelector(selector);
        if (!host?.classList.contains('hydrated')) continue;
        const node = part ? host.shadowRoot?.querySelector(part) : host;
        if (!node) continue;
        const style = getComputedStyle(node);
        samples.push({ selector, values: properties.map((property) => style[property]) });
      }
    }
    requestAnimationFrame(sampleFrame);
  }
  requestAnimationFrame(sampleFrame);
}

// Hold callbacks after Stencil's first render, while still letting it render
// normally up to that point. Trusted input can then run before the motion
// scheduler ticks, even on a slow worker or when CDP takes several frames.
function installFrameGate(selectors) {
  const frame = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const queued = new Map();
  const gate = { held: false };
  const observer = new MutationObserver(() => {
    if (!selectors.every((selector) => document.querySelector(selector)?.classList.contains('hydrated'))) return;
    gate.held = true;
    observer.disconnect();
  });
  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.requestAnimationFrame = (callback) => {
    const id = frame((time) => {
      if (gate.held) queued.set(id, callback);
      else callback(time);
    });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    queued.delete(id);
    cancel(id);
  };
  gate.release = () => {
    gate.held = false;
    frame((time) => {
      for (const [id, callback] of queued) {
        queued.delete(id);
        callback(time);
      }
    });
  };
  window.motionFrameGate = gate;
}

async function waitForHeldFrames(context) {
  await context.waitForFunction(() => window.motionFrameGate?.held, { polling: 10, timeout: 5_000 });
}

async function fixturePage(t, html, { reduced = false, preUpgrade = false } = {}) {
  await (browserReady ??= startBrowser());
  const path = `/fixture/${++fixtureId}`;
  documents.set(path, `<!doctype html>
    <meta charset="utf-8">
    <link rel="stylesheet" href="/dist/md3/md3.css">
    ${preUpgrade ? '<link rel="stylesheet" href="/dist/md3/pre-upgrade.css">' : ''}
    <style>
      body { margin: 32px; font: 16px Arial, sans-serif; }
      section { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; min-height: 80px; }
      md-list { width: 260px; } md-table-toolbar { width: 360px; } md-slider { width: 220px; }
    </style>
    <main id="fixture">${html}</main>`);
  const page = await browser.newPage();
  t.after(async () => {
    await page.close();
    documents.delete(path);
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  t.after(() => assert.deepEqual(errors, [], 'fixture must load successfully'));

  await page.setViewport({ width: 1440, height: 1000 });
  await page.mouse.move(1439, 999);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument(installProbe, targets);
  await page.goto(origin + path, { waitUntil: 'load' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), reduced);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page;
}

async function boot(page, entry, tags) {
  await page.evaluate(async ({ entry, tags }) => {
    window.motionProbe.findDeclarativeRoots(document);
    if (entry.endsWith('.mjs')) {
      const { defineCustomElements } = await import(entry);
      await defineCustomElements(window);
    } else {
      await Promise.all(tags.map((tag) => import(`${entry}/${tag}.js`)));
    }
    await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
  }, { entry: entries[entry], tags });
}

async function waitForHosts(page, tags) {
  await page.waitForFunction((tags) => {
    const hosts = [...document.querySelectorAll(tags.join(','))];
    const found = new Set(hosts.map((host) => host.localName));
    return tags.every((tag) => found.has(tag)) && hosts.every((host) =>
      host.shadowRoot && host.classList.contains('hydrated') && !host.hasAttribute('s-id'));
  }, { polling: 10, timeout: 15_000 }, tags);
}

async function ssrHtml(fixture) {
  const { renderToString } = await import(new URL('hydrate/index.mjs', core));
  const result = await renderToString(fixture, {
    fullDocument: false, serializeShadowRoot: 'declarative-shadow-dom',
  });
  assert.deepEqual(result.diagnostics.filter(({ level }) => level === 'error'), []);
  return result.html;
}

function effects(page, phase) {
  return page.evaluate((phase) => {
    const { animations, events } = window.motionProbe;
    return [...events, ...animations].filter((event) => event.owner && event.phase === phase);
  }, phase);
}

async function waitForEffect(page, { id, name, target }) {
  await page.waitForFunction(({ id, name, target }) =>
    window.motionProbe.events.some((event) =>
      event.phase === 'interaction' && event.id === id && event.name === name &&
      (!target || event.target === target)),
  { timeout: 5_000 }, { id, name, target });
}

const allowedInitialAnimations = new Map([
  ['md-breadcrumb-item', /^(?:md-breadcrumb-enter|md-breadcrumb-enter-rtl)$/],
  ['md-step', /^md-step-enter$/],
  ['md-organization-chart', /^md-org-chart-grow(?:-h)?$/],
  ['md-loading-indicator', /^md-loading-(?:morph|pulse)$/],
  ['md-progress-indicator', /^md-(?:wave-travel|circular-(?:rotate|dash|dash-track)|linear-(?:primary|secondary)-(?:translate|scale))$/],
  ['md-skeleton', /^md-skeleton-(?:bloom|pulse|wave)$/],
  ['md-status-dot', /^md-status-dot-pulse$/],
  ['md-text-field', /^md-tf-autofill-(?:start|cancel)$/],
]);

function assertQuietInitial(records) {
  const unwanted = records.filter(({ owner, id, name }) =>
    id === 'skeleton-none' || !allowedInitialAnimations.get(owner)?.test(name));
  // Event capture and the frame sampler may observe the same effect.
  const summary = [...new Set(unwanted.map(({ owner, id, name, target, pseudo }) =>
    `${owner}${id ? `#${id}` : ''} ${name} on ${target}${pseudo ?? ''}`))].sort();
  assert.deepEqual(summary, [], 'unexpected motion in the initial interaction state');
}

async function observeInitialFrames(page) {
  // Stay subscribed while deferred geometry, slot and style work runs.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 450)));
  assertQuietInitial(await effects(page, 'initial'));
}

async function assertAuthoredState(page) {
  const state = await page.evaluate(() => {
    const query = (selector) => document.querySelector(selector);
    const selected = query('#button-selected');
    const list = query('#list-selected');
    const caption = query('#toolbar-selected').shadowRoot.querySelector('[part="selection-caption"]');
    return {
      selectedButton: selected.selected,
      checked: query('#check-on').getAttribute('aria-checked'),
      mixed: query('#check-mixed').getAttribute('aria-checked'),
      selectedListItem: list.selected,
      selectionCaption: caption?.textContent.trim(),
      skeletonAnimation: query('#skeleton-none').animation,
    };
  });
  assert.deepEqual(state, {
    selectedButton: true, checked: 'true', mixed: 'mixed', selectedListItem: true,
    selectionCaption: '3 selected', skeletonAnimation: 'none',
  });
}

async function assertStableFrames(page) {
  const samples = await page.evaluate(() => window.motionProbe.samples);
  for (const [selector] of targets) {
    const frames = samples.filter((sample) => sample.selector === selector);
    assert.ok(frames.length > 1, `missing painted frames for ${selector}`);
    assert.deepEqual(
      [...new Set(frames.map(({ values }) => JSON.stringify(values)))],
      [JSON.stringify(frames.at(-1).values)],
      `${selector} should be in its settled state on its first painted frame`,
    );
  }
  for (const selector of ['#check-on', '#check-mixed', '#list-selected', '#toolbar-selected', '#skeleton-none']) {
    assert.equal(samples.find(({ selector: sampled }) => sampled === selector).values[0], '1',
      `${selector} must be visible on the first painted frame`);
  }
}

test('catalog fixtures cover every Stencil element', async () => {
  const componentRoot = new URL('src/components/', core);
  const paths = await readdir(componentRoot, { recursive: true });
  const sources = await Promise.all(paths.filter((path) => path.endsWith('.tsx')).map((path) =>
    readFile(new URL(path, componentRoot), 'utf8')));
  const tags = sources.flatMap((source) => Array.from(
    source.matchAll(/@Component\(\{\s*tag:\s*['"](md-[a-z0-9-]+)['"]/g), ([, tag]) => tag));
  assert.ok(tags.length > 0, 'Stencil components must be discoverable');
  assert.deepEqual(catalogTags, tags.sort());
});

for (const entry of Object.keys(entries)) {
  test(`cold mount across the catalog: ${entry}`, async (t) => {
    const page = await fixturePage(t, catalogFixture, { preUpgrade: entry === 'lazy loader' });
    await boot(page, entry, catalogTags);
    await waitForHosts(page, catalogTags);
    await observeInitialFrames(page);
    await assertAuthoredState(page);
    await assertStableFrames(page);
    const records = await effects(page, 'initial');
    for (const [id, name] of [
      ['loading', 'md-loading-morph'],
      ['progress-indeterminate', 'md-circular-rotate'],
      ['skeleton-pulse', 'md-skeleton-bloom'],
      ['skeleton-pulse', 'md-skeleton-pulse'],
      ['skeleton-wave', 'md-skeleton-wave'],
      ['live', 'md-status-dot-pulse'],
    ]) {
      assert.ok(records.some((event) => event.id === id && event.name === name), `expected intentional motion: ${id} ${name}`);
    }
  });
}

test('reduced motion keeps the initial selected state and ambient content', async (t) => {
  const html = interactionFixture + ambientFixture;
  const page = await fixturePage(t, html, { reduced: true });
  const tags = fixtureTags(html);
  await boot(page, 'custom elements', tags);
  await waitForHosts(page, tags);
  await observeInitialFrames(page);
  await assertAuthoredState(page);
  const ambient = await effects(page, 'initial');
  assert.deepEqual(ambient.filter(({ id }) => ['skeleton-pulse', 'skeleton-wave', 'live'].includes(id)), []);
  await page.click('#check');
  await page.waitForFunction(() => document.querySelector('#check').getAttribute('aria-checked') === 'true');
});

test('elements inserted after registration have a quiet initial state', async (t) => {
  const page = await fixturePage(t, '<md-button>Already on page</md-button>');
  await boot(page, 'custom elements', interactionTags);
  await waitForHosts(page, ['md-button']);
  await page.evaluate(() => {
    window.motionProbe.events.length = 0;
    window.motionProbe.animations.length = 0;
  });
  await page.$eval('#fixture', (main, html) => main.insertAdjacentHTML('beforeend', html), interactionFixture);
  await waitForHosts(page, interactionTags);
  await observeInitialFrames(page);
  await assertAuthoredState(page);
  await assertStableFrames(page);
});

test('an early trusted click animates its target while a sibling stays quiet', async (t) => {
  const html = `<md-card>
    <md-checkbox id="early-check" aria-label="Apply changes"></md-checkbox>
    <md-checkbox id="early-sibling" aria-label="Also notify"></md-checkbox>
  </md-card>`;
  const page = await fixturePage(t, html);
  const selectors = ['md-card', '#early-check', '#early-sibling'];
  await page.evaluate(installFrameGate, selectors);
  await boot(page, 'custom elements', fixtureTags(html));
  await waitForHeldFrames(page);
  const before = await page.evaluate(({ selectors, ready }) => {
    const target = document.querySelector('#early-check');
    const { left, top, width, height } = target.getBoundingClientRect();
    window.motionProbe.phase = 'interaction';
    return {
      armed: selectors.map((selector) => document.querySelector(selector).hasAttribute(ready)),
      point: { x: left + width / 2, y: top + height / 2 },
    };
  }, { selectors, ready: readyAttribute });
  assert.deepEqual(before.armed, [false, false, false], 'all three initial baselines must still be pending');
  await page.mouse.click(before.point.x, before.point.y);
  await assertEarlyCheckboxFeedback(page);
});

test('an early native click can synchronously animate a separate checkbox', async (t) => {
  const html = `
    <button id="apply-external" type="button">Apply changes</button>
    <md-card>
      <md-checkbox id="early-check" aria-label="Apply changes"></md-checkbox>
      <md-checkbox id="early-sibling" aria-label="Also notify"></md-checkbox>
    </md-card>`;
  const page = await fixturePage(t, html);
  await page.evaluate(installFrameGate, ['md-card', '#early-check', '#early-sibling']);
  await boot(page, 'custom elements', fixtureTags(html));
  await waitForHeldFrames(page);
  const before = await page.evaluate((ready) => {
    const checkbox = document.querySelector('#early-check');
    document.querySelector('#apply-external').addEventListener('click', (event) => {
      window.motionProbe.trustedExternalClick = event.isTrusted;
      checkbox.checked = true;
    });
    window.motionProbe.phase = 'interaction';
    return [checkbox, document.querySelector('#early-sibling')].map((control) => control.hasAttribute(ready));
  }, readyAttribute);
  assert.deepEqual(before, [false, false], 'both checkboxes must still be pending');
  await page.click('#apply-external');
  assert.equal(await page.evaluate(() => window.motionProbe.trustedExternalClick), true);
  await assertEarlyCheckboxFeedback(page);
});

async function assertEarlyCheckboxFeedback(page) {
  const armed = await page.evaluate((ready) => {
    const target = document.querySelector('#early-check');
    const sibling = document.querySelector('#early-sibling');
    const targetArmed = target.hasAttribute(ready);
    const siblingArmed = sibling.hasAttribute(ready);
    // This update comes from CDP after the native event task, while the
    // original pending sibling still has no motion baseline.
    sibling.checked = true;
    const armedAfterUpdate = sibling.hasAttribute(ready);
    window.motionFrameGate.release();
    return { targetArmed, siblingArmed, armedAfterUpdate };
  }, readyAttribute);
  assert.deepEqual(armed, { targetArmed: true, siblingArmed: false, armedAfterUpdate: false },
    'real input must arm only its update before the next frame');
  await waitForEffect(page, { id: 'early-check', name: 'md-checkbox-glyph-in' });
  await page.waitForFunction(() =>
    document.querySelector('#early-sibling').getAttribute('aria-checked') === 'true');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const siblingMotion = (await effects(page, 'interaction')).filter((event) => event.id === 'early-sibling');
  assert.deepEqual(siblingMotion, [], 'mount-time reconciliation in the untouched sibling should snap');
}

async function movePendingFromIframe(page, tag, attributes, { content = '', defineInFrame = false } = {}) {
  if (!defineInFrame) await boot(page, 'custom elements', [tag]);
  const iframe = await page.$('iframe');
  const frame = await iframe.contentFrame();
  assert.ok(frame, 'an attached same-origin child document is required');
  await frame.evaluate(installFrameGate, ['#moving']);
  const realm = defineInFrame ? frame : page;
  await realm.evaluate(async ({ tag, attributes, content, defineInFrame, origin }) => {
    const childDocument = defineInFrame ? document : document.querySelector('iframe').contentDocument;
    if (defineInFrame) await import(`${origin}/dist/components/${tag}.js`);
    const element = document.createElement(tag);
    element.id = 'moving';
    element.innerHTML = content;
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    childDocument.body.append(childDocument.adoptNode(element));
  }, { tag, attributes, content, defineInFrame, origin });
  await waitForHeldFrames(frame);
  const moved = await page.evaluate(async ({ ready, defineInFrame }) => {
    const iframe = document.querySelector('iframe');
    const host = iframe.contentDocument.querySelector('#moving');
    const wasPending = !host.hasAttribute(ready);
    const shadow = host.shadowRoot;
    document.querySelector('#fixture').append(document.adoptNode(host));
    iframe.remove();
    if (defineInFrame) await host.show();
    return {
      wasPending,
      keptRoot: host.shadowRoot === shadow,
      openedAfterMove: defineInFrame ? host.open && host.hasAttribute(ready) : null,
    };
  }, { ready: readyAttribute, defineInFrame });
  assert.deepEqual(moved, { wasPending: true, keptRoot: true, openedAfterMove: defineInFrame ? true : null });
}

test('a pending host becomes motion-ready after adoption and destruction of its original document', async (t) => {
  const page = await fixturePage(t, '<iframe title="Original document"></iframe>');
  // Keep native click handlers in the surviving definition realm.
  await movePendingFromIframe(page, 'md-button', { toggle: '' }, { content: 'Move to another document' });
  await page.waitForFunction((ready) => document.querySelector('#moving')?.hasAttribute(ready),
    { timeout: 5_000 }, readyAttribute);
  await page.click('#moving');
  await page.waitForFunction(() => document.querySelector('#moving')?.selected === true, { timeout: 5_000 });
});

test('a pending adopted picker can show after its defining document is destroyed', { timeout: 15_000 }, async (t) => {
  const page = await fixturePage(t, '<iframe title="Original document"></iframe>');
  await movePendingFromIframe(page, 'md-color-picker', { variant: 'popover', value: '#426617' }, {
    content: '<button type="button" slot="trigger">Accent colour</button>',
    defineInFrame: true,
  });
});

test('a pending slot owner preserves consumer-authored transitions', async (t) => {
  const page = await fixturePage(t, `
    <style>
      #consumer { opacity: 1; transition: opacity 3s linear; }
      #consumer.fading { opacity: 0; }
    </style>
    <md-card><button id="consumer" type="button">Details</button></md-card>
  `);
  await page.evaluate(installFrameGate, ['md-card']);
  await boot(page, 'custom elements', ['md-card']);
  await waitForHeldFrames(page);
  const before = await page.$eval('#consumer', (consumer, ready) => {
    // Native slot distribution can cancel an already-running transition.
    // Commit the distributed style before changing the consumer's opacity.
    const style = getComputedStyle(consumer);
    const before = {
      slotted: Boolean(consumer.assignedSlot),
      ownerPending: !consumer.closest('md-card').hasAttribute(ready),
      property: style.transitionProperty,
      opacity: style.opacity,
    };
    consumer.classList.add('fading');
    return before;
  }, readyAttribute);
  assert.deepEqual(before, { slotted: true, ownerPending: true, property: 'opacity', opacity: '1' });
  await page.waitForFunction(() => document.querySelector('#consumer').getAnimations().some(
    (animation) => animation.transitionProperty === 'opacity' && animation.playState === 'running'),
  { polling: 10, timeout: 5_000 });
  await page.evaluate(() => window.motionFrameGate.release());
});

test('the external native search trigger opens with feedback on its first click', async (t) => {
  const page = await fixturePage(t, externalSearchFixture);
  await page.evaluate(installFrameGate, ['#external-search']);
  await boot(page, 'custom elements', ['md-search']);
  await waitForHeldFrames(page);
  const before = await page.evaluate((ready) => {
    window.motionProbe.phase = 'interaction';
    const trigger = document.querySelector('#overlay-anchor');
    return {
      wired: trigger.getAttribute('aria-haspopup'),
      expanded: trigger.getAttribute('aria-expanded'),
      ready: document.querySelector('#external-search').hasAttribute(ready),
    };
  }, readyAttribute);
  assert.deepEqual(before, { wired: 'dialog', expanded: 'false', ready: false });
  await page.click('#overlay-anchor');
  await page.evaluate(() => window.motionFrameGate.release());
  await page.waitForFunction(() => {
    const search = document.querySelector('#external-search');
    return search.open && search.shadowRoot?.activeElement?.tagName === 'INPUT' &&
      document.querySelector('#overlay-anchor').getAttribute('aria-expanded') === 'true';
  }, { timeout: 5_000 });
  await waitForEffect(page, { id: 'external-search', name: 'opacity', target: 'panel' });
});

for (const picker of openPickerFixtures) {
  test(`an authored open ${picker.label} mounts quietly and still animates later actions`, async (t) => {
    const page = await fixturePage(t, picker.html);
    const tags = fixtureTags(picker.html);
    await boot(page, 'custom elements', tags);
    await waitForHosts(page, tags);
    await assertOpenPicker(page, picker);
    await observeInitialFrames(page);
    await page.evaluate(() => { window.motionProbe.phase = 'interaction'; });
    await page.$eval('#picker', (host, method) => host[method](), picker.close);
    await page.waitForFunction((panel) => !document.querySelector('#picker').shadowRoot.querySelector(panel),
      { timeout: 5_000 }, picker.panel);
    await page.$eval('#picker', (host) => host.show());
    await assertOpenPicker(page, picker);
    await waitForEffect(page, { id: 'picker', name: picker.entrance });
    if (!picker.modeToggle) return;
    await page.evaluate(() => { window.motionProbe.events.length = 0; });
    await page.click(`#picker >>> ${picker.modeToggle}`);
    await page.waitForFunction((part) => document.querySelector('#picker').shadowRoot.querySelector(part),
      { timeout: 5_000 }, picker.nextMode);
    if (picker.modeAnimation) await waitForEffect(page, { id: 'picker', name: picker.modeAnimation });
  });

  test(`server-rendered open ${picker.label} starts quiet before and through adoption`, async (t) => {
    const page = await fixturePage(t, await ssrHtml(picker.html));
    const tags = fixtureTags(picker.html);
    assert.ok(await page.$eval('#picker', (host, panel) => host.hasAttribute('s-id') && Boolean(host.shadowRoot?.querySelector(panel)),
      picker.panel), 'the server must render the authored open panel');
    await boot(page, 'custom elements', tags);
    await waitForHosts(page, tags);
    await assertOpenPicker(page, picker);
    await observeInitialFrames(page);
  });
}

async function assertOpenPicker(page, { panel, initialMode }) {
  await page.waitForFunction(({ panel, initialMode }) => {
    const picker = document.querySelector('#picker');
    const shadow = picker.shadowRoot;
    const surface = shadow?.querySelector(panel);
    return picker.open && surface?.getBoundingClientRect().width > 0 &&
      getComputedStyle(surface).visibility === 'visible' && (!initialMode || Boolean(shadow.querySelector(initialMode)));
  }, { timeout: 5_000 }, { panel, initialMode });
}

test('a lazy step opens quietly at mount and clears later entry motion on finish or reattach', async (t) => {
  const html = `
    <md-stepper id="lazy-stepper" orientation="vertical" mode="non-linear" active="0" lazy style="--md-step-expand-duration: 650ms">
      <md-step id="lazy-one" label="Details"><p>Enter the details.</p></md-step>
      <md-step id="lazy-two" label="Review"><p>Review the details.</p></md-step>
    </md-stepper>`;
  const page = await fixturePage(t, html);
  const tags = fixtureTags(html);
  const content = '[part="content"]';
  await boot(page, 'custom elements', tags);
  await waitForHosts(page, tags);
  await page.waitForFunction((part) =>
    Boolean(document.querySelector('#lazy-one').shadowRoot.querySelector(part)) &&
    !document.querySelector('#lazy-two').shadowRoot.querySelector(part), { timeout: 5_000 }, content);
  await observeInitialFrames(page);
  await page.evaluate(() => { window.motionProbe.phase = 'interaction'; });

  await page.click('#lazy-two >>> [role="button"]');
  await waitForEffect(page, { id: 'lazy-two', name: 'md-step-content-enter' });
  await page.waitForFunction((part) => {
    const panel = document.querySelector('#lazy-two').shadowRoot.querySelector(part);
    return panel && getComputedStyle(panel).animationName === 'none';
  }, { timeout: 5_000 }, content);

  await page.click('#lazy-one >>> [role="button"]');
  await waitForEffect(page, { id: 'lazy-one', name: 'md-step-content-enter' });
  const interrupted = await page.$eval('#lazy-stepper', (stepper, part) => {
    const panel = stepper.querySelector('#lazy-one').shadowRoot.querySelector(part);
    const running = panel.getAnimations().some((animation) =>
      animation.animationName === 'md-step-content-enter' && animation.playState === 'running');
    window.motionProbe.phase = 'reattach';
    const parent = stepper.parentElement;
    stepper.remove();
    requestAnimationFrame(() => parent.append(stepper));
    return running;
  }, content);
  assert.equal(interrupted, true, 'the stepper should be detached during the real entry animation');
  await page.waitForFunction((part) => {
    const panel = document.querySelector('#lazy-one')?.shadowRoot.querySelector(part);
    return panel && getComputedStyle(panel).animationName === 'none';
  }, { timeout: 5_000 }, content);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const replayed = (await effects(page, 'reattach')).filter(({ name }) => name === 'md-step-content-enter');
  assert.deepEqual(replayed, [], 'reattaching the still-active step must not replay its entry');
});

test('programmatic changes animate after the initial state', async (t) => {
  const page = await fixturePage(t, interactionFixture);
  await boot(page, 'custom elements', interactionTags);
  await waitForHosts(page, interactionTags);
  await observeInitialFrames(page);
  await page.evaluate(() => {
    window.motionProbe.phase = 'interaction';
    document.querySelector('#check').checked = true;
    document.querySelector('#toolbar-selected').numSelected = 0;
  });
  await page.waitForFunction(() => {
    const toolbar = document.querySelector('#toolbar-selected');
    return !toolbar.shadowRoot.querySelector('[part="selection-caption"]');
  }, { timeout: 5_000 });
  await page.$eval('#toolbar-selected', (host) => { host.numSelected = 2; });
  const expected = [['check', 'md-checkbox-glyph-in'], ['toolbar-selected', 'md-table-toolbar-fade']];
  await page.waitForFunction((expected) => expected.every(([id, name]) =>
    window.motionProbe.events.some((event) => event.id === id && event.name === name && event.phase === 'interaction')),
  { timeout: 5_000 }, expected);
});

test('an authored chart introduction still paints', async (t) => {
  const page = await fixturePage(t, '');
  await boot(page, 'custom elements', ['md-sparkline']);
  const samples = await page.evaluate(async () => {
    const chart = document.createElement('md-sparkline');
    chart.style.width = '240px';
    chart.height = '80px';
    chart.data = [5, 9, 6, 11];
    document.querySelector('#fixture').append(chart);
    const samples = [];
    const stop = performance.now() + 1100;
    while (performance.now() < stop) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = chart.shadowRoot?.querySelector('canvas');
      if (canvas) samples.push(Number(getComputedStyle(canvas).opacity));
    }
    return samples;
  });
  assert.ok(samples.some((opacity) => opacity < 0.9), 'the intro should fade the canvas in');
  assert.equal(samples.at(-1), 1);
});

for (const entry of ['custom elements', 'lazy loader']) {
  test(`first input still animates: ${entry}`, async (t) => {
    const page = await fixturePage(t, interactionFixture);
    await boot(page, entry, interactionTags);
    await waitForHosts(page, interactionTags);
    // Exercise a real input as soon as the hydrated fixture is available.
    await page.evaluate(() => { window.motionProbe.phase = 'interaction'; });
    await page.click('#check');
    await page.waitForFunction(() =>
      document.querySelector('#check').getAttribute('aria-checked') === 'true' &&
      window.motionProbe.changes.includes('check') &&
      window.motionProbe.events.some((event) => event.id === 'check' && event.phase === 'interaction' &&
        event.name === 'md-checkbox-glyph-in'), { timeout: 5_000 });
    await page.click('#group-first', { delay: 40 });
    const records = await effects(page, 'interaction');
    assert.ok(records.some(({ id, type }) => id === 'group-first' && type === 'waapi'), 'first press should animate the button group');
  });

  test(`server shadow DOM is adopted quietly: ${entry}`, async (t) => {
    const page = await fixturePage(t, await ssrHtml(interactionFixture));
    assert.ok(await page.evaluate(() => {
      const host = document.querySelector('#check-on');
      const shadow = host.shadowRoot;
      const child = shadow?.querySelector('[part="container"][c-id]');
      window.serverCheckbox = { host, shadow, child };
      return host.hasAttribute('s-id') && Boolean(child);
    }), 'expected annotated declarative shadow DOM before browser registration');
    await boot(page, entry, interactionTags);
    await waitForHosts(page, interactionTags);
    await observeInitialFrames(page);
    await assertAuthoredState(page);
    const adopted = await page.evaluate(() => {
      const { host, shadow, child } = window.serverCheckbox;
      return host.shadowRoot === shadow &&
        shadow.querySelector('[part="container"]') === child &&
        shadow.querySelectorAll('[part="container"]').length === 1 &&
        !child.hasAttribute('c-id');
    });
    assert.ok(adopted, 'the original server node must be claimed and kept');
    await page.click('#check-on');
    await page.waitForFunction(() =>
      document.querySelector('#check-on').getAttribute('aria-checked') === 'false', { timeout: 5_000 });
  });
}

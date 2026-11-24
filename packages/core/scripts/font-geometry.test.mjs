// Run after building Core, with Puppeteer's Chrome installed.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { test } from 'node:test';
import puppeteer from 'puppeteer';

const core = new URL('../', import.meta.url);
const font = new URL('../../../apps/shared/fonts/material-symbols-outlined-subset.woff2', import.meta.url);
const pickerTags = ['md-select', 'md-autocomplete', 'md-multi-select'];
const tags = ['md-text-field', ...pickerTags];
const options = 'options=\'[{"value":"apple","label":"Apple"}]\'';
const wideIcon = '<svg slot="dropdown-icon" width="40" height="20" viewBox="0 0 40 20" aria-hidden="true"><rect width="40" height="20"/></svg>';
const html = `<!doctype html><meta charset="UTF-8">
<link rel="stylesheet" href="/dist/md3/md3.css">
<style>
  @font-face { font-family: 'Material Symbols Outlined'; src: url('/symbols.woff2') format('woff2'); font-weight: 100 700; font-display: block; }
  @font-face { font-family: 'Consumer Caret Icons'; src: url('/symbols.woff2') format('woff2'); font-weight: 100 700; font-display: block; }
  body { margin: 24px; font-family: system-ui; }
  main { display: grid; grid-template-columns: repeat(2, 320px); align-items: start; gap: 16px; }
  #select { --md-select-caret-size: 30px; }
  #multi::part(caret) { font-family: 'Consumer Caret Icons'; font-size: 32px; font-weight: 600; color: green; font-variation-settings: 'FILL' 1; }
  #font-proof { position: fixed; inset-inline-start: -10000px; font: 24px/1 'Material Symbols Outlined'; font-feature-settings: 'liga'; }
</style>
<main>
  <md-text-field id="field" label="Password" variant="outlined" type="password" value="demo" density="-3"
    password-toggle="internal" clearable="internal" error error-text="Check the value"></md-text-field>
  <md-select id="select" label="Select" ${options}></md-select>
  <md-autocomplete id="auto" label="Autocomplete" density="-2" ${options}></md-autocomplete>
  <md-multi-select id="multi" label="Multi-select" clearable ${options}></md-multi-select>
  ${pickerTags.map(tag => `<${tag} id="svg-${tag}" label="Custom icon" ${options}>${wideIcon}</${tag}>`).join('')}
</main>
<span id="font-proof" aria-hidden="true">arrow_drop_down</span>
<script type="module">
  document.getElementById('multi').value = ['apple'];
  await Promise.all(${JSON.stringify(tags)}.map(tag => import('/dist/components/' + tag + '.js')));
</script>`;

test('field icon fonts do not shift built-in glyphs, inputs, or custom dropdown icons', { timeout: 30_000 }, async t => {
  const fontGate = Promise.withResolvers();
  const fontBytes = await readFile(font);
  let requested = false;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/') return response.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    if (path === '/favicon.ico') return response.writeHead(204).end();
    if (path === '/symbols.woff2') {
      requested = true;
      await fontGate.promise;
      return response.writeHead(200, { 'Content-Type': 'font/woff2' }).end(fontBytes);
    }
    if (/^\/dist\/(?:[\w-]+\/)*[\w.-]+\.(?:css|js)$/.test(path)) {
      try {
        const asset = await readFile(new URL(`.${path}`, core));
        const type = path.endsWith('.css') ? 'text/css' : 'text/javascript';
        return response.writeHead(200, { 'Content-Type': type }).end(asset);
      } catch {}
    }
    response.writeHead(404).end();
  });
  let browser;
  t.after(async () => {
    fontGate.resolve();
    await browser?.close();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
  });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.setViewport({ width: 1000, height: 720 });
  await page.mouse.move(990, 710);
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelector('main').children].every(host =>
    host.hasAttribute('data-awc-motion-ready')) && document.fonts.status === 'loading' &&
    performance.getEntriesByName('first-contentful-paint').length, { timeout: 10_000 });
  assert.equal(requested, true, 'The real font response is still held');

  const initial = await page.evaluate(() => {
    const controls = [...document.querySelector('main').children];
    const byId = id => document.getElementById(id);
    const part = (host, name) => host.shadowRoot.querySelector(`[part~="${name}"]`);
    const rect = node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return [x, y, width, height];
    };
    const targets = {};
    for (const host of controls) {
      const field = part(host, 'field') ?? host;
      targets[`${host.id} host`] = host;
      targets[`${host.id} container`] = part(field, 'container');
      targets[`${host.id} input`] = part(field, 'input');

      const caret = part(host, 'caret');
      if (caret) {
        targets[`${host.id} caret`] = caret;
        targets[`${host.id} glyph`] = host.querySelector('svg') ?? caret.querySelector(`.${host.localName}__caret-glyph`);
      }
      for (const glyph of field.shadowRoot.querySelectorAll('.material-symbols-outlined')) {
        targets[`${host.id} ${glyph.textContent.trim()}`] = glyph;
      }
    }
    targets['multi clear glyph'] = part(byId('multi'), 'clear').querySelector('.material-symbols-outlined');
    const sample = () => Object.fromEntries(Object.entries(targets).map(([key, node]) => [key, rect(node)]));
    const proof = () => byId('font-proof').getBoundingClientRect().width;
    const frames = [];
    const state = window.fontGeometry = { frames, proof };
    const record = () => {
      frames.push(sample());
      state.frame = requestAnimationFrame(record);
    };
    record();
    const glyph = targets['multi glyph'];
    const style = getComputedStyle(glyph);
    return {
      boxes: frames[0],
      fallbackTextWidth: proof(),
      fallbackLoaded: [...document.fonts].map(face => face.status),
      consumerStyle: {
        family: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
        color: style.color, variation: style.fontVariationSettings,
      },
      denseIconSize: parseFloat(getComputedStyle(targets['field error']).fontSize),
      svgCarets: controls.filter(host => host.id.startsWith('svg-')).map(host => ({
        overflow: getComputedStyle(part(host, 'caret')).overflow,
        slot: host.querySelector('svg').assignedSlot?.name,
      })),
    };
  });

  fontGate.resolve();
  const final = await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { frames, frame, proof } = window.fontGeometry;
    cancelAnimationFrame(frame);
    return { frames, glyphTextWidth: proof(), loaded: [...document.fonts].map(face => face.status) };
  });
  assert(initial.fallbackLoaded.every(status => status !== 'loaded'));
  assert.deepEqual(final.loaded, ['loaded', 'loaded']);
  assert(initial.fallbackTextWidth > 2 * final.glyphTextWidth, 'The delayed font must replace a wide fallback with a ligature');
  assert.equal(Math.round(final.glyphTextWidth), 24);
  assert(initial.denseIconSize < 24 && initial.denseIconSize > 0);
  assert.deepEqual(initial.boxes['select glyph'].slice(2), [30, 30]);
  assert.deepEqual(initial.boxes['multi glyph'].slice(2), [32, 32]);
  assert.match(initial.consumerStyle.family, /Consumer Caret Icons/);
  assert.equal(initial.consumerStyle.size, '32px');
  assert.equal(initial.consumerStyle.weight, '600');
  assert.equal(initial.consumerStyle.color, 'rgb(0, 128, 0)');
  assert.match(initial.consumerStyle.variation, /FILL.*1/);
  assert.deepEqual(initial.svgCarets, pickerTags.map(() => ({ overflow: 'visible', slot: 'dropdown-icon' })));
  for (const tag of pickerTags) {
    assert.deepEqual(initial.boxes[`svg-${tag} glyph`].slice(2), [40, 20], `${tag} must preserve the slotted SVG box`);
  }
  assert(final.frames.length >= 3);
  let maxShift = 0;
  for (const frame of final.frames) {
    for (const [target, box] of Object.entries(frame)) {
      const initialBox = initial.boxes[target];
      assert(initialBox[2] > 0 && initialBox[3] > 0, `${target} must be laid out`);
      const shift = Math.max(...box.map((value, index) => Math.abs(value - initialBox[index])));
      assert(shift <= 0.25, `${target} moved when the font loaded: ${initialBox} → ${box}`);
      maxShift = Math.max(maxShift, shift);
    }
  }

  await page.click('#field >>> .md-text-field__password-toggle');
  await page.waitForFunction(() => document.querySelector('#field').shadowRoot.querySelector('input').type === 'text');
  for (const id of ['select', 'auto', 'multi']) {
    await page.click(`#${id} >>> [part="caret"]`);
    await page.waitForFunction(id => document.getElementById(id).open, { timeout: 5_000 }, id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => !document.getElementById(id).open, { timeout: 5_000 }, id);
  }
  assert.deepEqual(failures, []);
  t.diagnostic(JSON.stringify({
    frames: final.frames.length,
    boxes: Object.keys(initial.boxes).length,
    maxShift,
    glyphWidth: [initial.fallbackTextWidth, final.glyphTextWidth],
    passedClicks: ['password visibility', 'select', 'autocomplete', 'multi-select'],
  }));
});

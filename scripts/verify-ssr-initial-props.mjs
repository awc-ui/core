// Built-artifact regression: SSR presentation must yield to initial client props.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const coreRoot = resolve(root, 'packages/core');
const requireCore = createRequire(new URL('../packages/core/package.json', import.meta.url));
const { build } = requireCore('esbuild');
const { renderToString } = requireCore('./hydrate/index.js');
const puppeteer = createRequire(new URL('../apps/test-html/package.json', import.meta.url))('puppeteer');
const components = ['switch', 'checkbox', 'radio', 'button', 'icon-button', 'card', 'text-field', 'multi-select', 'skeleton'];
const direct = (await build({ stdin: {
  contents: components.map(name => `import '@awc-ui/core/components/md-${name}';`).join('\n'),
  resolveDir: resolve(root, 'apps/example-sveltekit'),
}, bundle:true, write:false, format:'iife', platform:'browser' })).outputFiles[0].text;

function fixture(selected) {
  const checked = selected ? 'true' : 'false';
  return `<md-switch id="sw" selected="${checked}" icons></md-switch>
    <md-checkbox id="cb" checked="${checked}">Check</md-checkbox>
    <md-radio id="radio" checked="${checked}">Radio</md-radio>
    <md-button id="button" toggle selected="${checked}">Button</md-button>
    <md-icon-button id="icon" toggle selected="${checked}" icon="star"></md-icon-button>
    <md-card id="card" variant="${selected ? 'elevated' : 'outlined'}" class="consumer md-card--consumer" style="font-family:&quot;A&amp;B&quot;; --text:&quot;&lt;quoted&gt;&quot;;">Card</md-card>
    <md-card id="same-variant" variant="elevated" class="old">Card</md-card>
    <md-text-field id="field" label="Name" value="server" disabled="false" focus-border-width="1" style="color:blue"></md-text-field>
    <md-skeleton id="skeleton" width="23px" animation="none" style="color:purple"></md-skeleton>
    <md-skeleton id="style-override" width="23px" animation="none"></md-skeleton>
    <md-skeleton id="consumer-style" animation="none" style="--_w:61px;color:red"></md-skeleton>
    <md-switch id="face" selected name="choice" disabled="false"></md-switch>
    <md-switch id="override" selected="${checked}" class="consumer md-switch--consumer" role="button" aria-checked="mixed"></md-switch>
    <md-switch id="client-override" selected="${checked}"></md-switch>
    <md-switch id="optional" required="${checked}" disabled="${checked}"></md-switch>
    <md-switch id="missing" selected="${checked}"></md-switch>
    <md-switch id="malformed" selected="${checked}"></md-switch>`;
}
const serverPages = new Map();
for (const selected of [true, false]) {
  const result = await renderToString(fixture(selected), { fullDocument:false, serializeShadowRoot:'declarative-shadow-dom' });
  assert.equal(result.diagnostics.some(item => item.level === 'error'), false);
  assert.match(result.html, /s-attrs=/, 'Build must include the SSR ownership patch');
  serverPages.set(selected, result.html);
}
const bytes = [...serverPages.values()].join('');
const withoutAnnotations = bytes.replace(/ s-attrs="[^"]*"/g, '');
console.log(`SSR ownership metadata: ${Buffer.byteLength(bytes) - Buffer.byteLength(withoutAnnotations)} raw bytes, ${gzipSync(bytes).length - gzipSync(withoutAnnotations).length} gzip bytes for ${[...bytes.matchAll(/ s-id=/g)].length} hosts`);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/direct.js') return response.writeHead(200, {'Content-Type':'text/javascript'}).end(direct);
  if (pathname.startsWith('/core/')) {
    const path = resolve(coreRoot, '.' + pathname.slice(5));
    if (!path.startsWith(coreRoot + '/')) return response.writeHead(403).end();
    try {
      const content = await readFile(path);
      return response.writeHead(200, {'Content-Type':['.js','.mjs'].includes(extname(path)) ? 'text/javascript' : 'application/octet-stream'}).end(content);
    }
    catch { return response.writeHead(404).end(); }
  }
  response.writeHead(200, {'Content-Type':'text/html'}).end('<!doctype html><html><head></head><body></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({headless:'shell',args:['--no-sandbox'], executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH});
try {
  for (const runtime of ['direct', 'lazy']) for (const serverSelected of [true, false]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.setContent(serverPages.get(serverSelected));
    await page.evaluate(selected => {
      window.originalHosts = Array.from(document.body.children);
      window.originalShadows = originalHosts.map(host => host.shadowRoot);
      window.changes = []; window.renderCounts = {};
      document.querySelector('#sw').addEventListener('mdInput', event => {
        changes.push({type:'input', selected:event.detail.selected});
        if (changes.length === 1) event.preventDefault();
      });
      document.querySelector('#sw').addEventListener('mdChange', event => changes.push({type:'change', selected:event.detail.selected}));
      for (const id of ['sw','button','icon','override','client-override']) document.getElementById(id).setAttribute('selected', String(selected));
      for (const id of ['cb','radio']) document.getElementById(id).setAttribute('checked', String(selected));
      document.querySelector('#card').setAttribute('variant', selected ? 'elevated' : 'outlined');
      document.querySelector('#card').className = 'new-theme';
      document.querySelector('#same-variant').className = 'new-theme';
      document.querySelector('#field').value = 'client';
      document.querySelector('#field').setAttribute('focus-border-width','3');
      document.querySelector('#skeleton').removeAttribute('width');
      document.querySelector('#style-override').removeAttribute('width');
      document.querySelector('#style-override').style.setProperty('--_w','47px');
      document.querySelector('#optional').setAttribute('disabled', String(selected));
      document.querySelector('#optional').setAttribute('required', String(selected));
      document.querySelector('#client-override').setAttribute('aria-checked', 'client-override');
      document.querySelector('#missing').removeAttribute('s-attrs');
      document.querySelector('#malformed').setAttribute('s-attrs', '{bad json');
      const define = customElements.define.bind(customElements);
      customElements.define = (tag, Cstr, options) => {
        const render = Cstr.prototype.render;
        if (render) Cstr.prototype.render = function(...args) {
          if (this.id) renderCounts[this.id] = (renderCounts[this.id] || 0) + 1;
          return render.apply(this, args);
        };
        return define(tag, Cstr, options);
      };
    }, !serverSelected);
    if (runtime === 'direct') await page.addScriptTag({url:'/direct.js'});
    else await page.addScriptTag({type:'module',content:"import {defineCustomElements} from '/core/loader/index.mjs'; defineCustomElements();"});
    await page.waitForFunction(() => originalHosts.every(host => host.hasAttribute('data-awc-motion-ready')));
    const state = await page.evaluate(() => ({
      hosts:originalHosts.map((host,index) => ({id:host.id, selected:host.selected, checked:host.checked, aria:host.getAttribute('aria-checked') || host.getAttribute('aria-pressed'), classes:host.className,
        same:host === document.body.children[index] && host.shadowRoot === originalShadows[index], metadata:host.hasAttribute('s-attrs')})),
      field:document.querySelector('#field').shadowRoot.querySelector('input').value,
      role:document.querySelector('#override').getAttribute('role'), changes, renders:renderCounts,
      optional:{disabled:document.querySelector('#optional').getAttribute('aria-disabled'), required:document.querySelector('#optional').getAttribute('aria-required')},
      style:{font:document.querySelector('#card').style.fontFamily,text:document.querySelector('#card').style.getPropertyValue('--text')},
      ownedStyles:{width:document.querySelector('#skeleton').style.getPropertyValue('--_w'), override:document.querySelector('#style-override').style.getPropertyValue('--_w'),
        consumer:document.querySelector('#consumer-style').style.getPropertyValue('--_w'),color:document.querySelector('#field').style.color,
        border:document.querySelector('#field').style.getPropertyValue('--md-text-field-focus-border-width'),inset:document.querySelector('#field').style.getPropertyValue('--md-text-field-focus-inset')},
    }));
    assert.ok(state.hosts.every(host => host.same && !host.metadata));
    for (const id of ['sw','cb','radio','button','icon']) {
      const host = state.hosts.find(host => host.id === id);
      assert.equal(host.selected ?? host.checked, !serverSelected, `${runtime} ${id} property`);
      assert.equal(host.aria, String(!serverSelected), `${runtime} ${id} ARIA`);
      const selectedClass = id === 'radio' ? 'md-radio--checked' : id === 'cb' ? 'md-checkbox--selected' : `${id === 'sw' ? 'md-switch' : id === 'button' ? 'md-button' : 'md-icon-button'}--selected`;
      assert.equal(host.classes.split(' ').includes(selectedClass), !serverSelected, `${runtime} ${id} classes`);
    }
    assert.equal(state.field, 'client', `${runtime} pre-upgrade own string property`);
    assert.deepEqual(state.style, {font:'"A&B"',text:'"<quoted>"'});
    assert.deepEqual(state.optional, {disabled:serverSelected ? null : 'true',required:serverSelected ? null : 'true'});
    assert.deepEqual(state.ownedStyles,{width:'',override:'47px',consumer:'61px',color:'blue',border:'',inset:''});
    assert.equal(state.role, 'button');
    assert.equal(state.hosts.find(host => host.id === 'override').aria, 'mixed');
    assert.equal(state.hosts.find(host => host.id === 'client-override').aria, 'client-override');
    assert.match(state.hosts.find(host => host.id === 'override').classes, /md-switch--consumer/);
    for (const id of ['card','same-variant']) {
      const classes=state.hosts.find(host => host.id === id).classes.split(' ');
      assert.ok(classes.includes('new-theme') && classes.includes('md-card') && classes.includes('sc-md-card'));
      assert.equal(classes.includes('old'),false);
    }
    assert.match(state.hosts.find(host => host.id === 'same-variant').classes,/md-card--elevated/);
    assert.ok(state.hosts.find(host => host.id === 'card').classes.includes(serverSelected ? 'md-card--outlined' : 'md-card--elevated'));
    for (const id of ['missing','malformed']) assert.equal(state.hosts.find(host => host.id === id).selected, serverSelected);
    assert.deepEqual(state.changes, []);
    if (runtime === 'direct') for (const id of ['sw','cb','radio','button','icon']) assert.equal(state.renders[id], 1, `${id} must reconcile in its first render`);
    await page.click('#sw');
    assert.equal(await page.$eval('#sw', host => host.selected), !serverSelected, 'First cancelable input must keep the controlled state');
    await page.click('#sw');
    await page.waitForFunction(selected => document.querySelector('#sw').selected === selected, {}, serverSelected);
    assert.deepEqual(await page.evaluate(() => changes.map(event => event.type)), ['input','input','change']);
    assert.deepEqual(await page.evaluate(() => {
      const face=document.querySelector('#face');
      const form=document.createElement('form'); document.body.append(form); form.append(face);
      return {disabled:face.disabled,nativeDisabled:face.matches(':disabled'),attribute:face.hasAttribute('disabled'),value:new FormData(form).get('choice'),inputDisabled:document.querySelector('#field').shadowRoot.querySelector('input').disabled};
    }),{disabled:false,nativeDisabled:false,attribute:false,value:'on',inputDisabled:false});
    await page.$eval('#face', face => { face.disabled = true; });
    await page.waitForFunction(() => document.querySelector('#face').matches(':disabled'));
    assert.equal(await page.$eval('#face', face => new FormData(face.closest('form')).get('choice')),null);
    await page.$eval('#face', face => { face.disabled = false; });
    await page.waitForFunction(() => !document.querySelector('#face').matches(':disabled'));
    assert.equal(await page.$eval('#face', face => new FormData(face.closest('form')).get('choice')),'on');
    assert.deepEqual(errors, []);
    console.log(`PASS ${runtime} SSR ${serverSelected} → client ${!serverSelected}: identity, properties, presentation, consumer overrides, fallback, first input`);
    await page.close();
  }
  for (const runtime of ['direct','lazy']) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => {
      const connected = document.createElement('md-multi-select');
      connected.id = 'connected'; connected.value = []; document.body.append(connected);
      window.detached = document.createElement('md-multi-select');
      detached.id = 'detached'; detached.value = ['before-upgrade'];
      window.detachedField = document.createElement('md-text-field');
      detachedField.id = 'detached-field'; detachedField.setAttribute('value','attribute'); detachedField.value = 'own-before';
    });
    if (runtime === 'direct') await page.addScriptTag({url:'/direct.js'});
    else await page.addScriptTag({type:'module',content:"import {defineCustomElements} from '/core/loader/index.mjs'; defineCustomElements();"});
    await page.waitForFunction(() => document.querySelector('#connected').hasAttribute('data-awc-motion-ready'));
    const upgrade = await page.evaluate(() => {
      customElements.upgrade(detached); customElements.upgrade(detachedField);
      const before = {values:[...detached.value],text:detachedField.value};
      detached.value = [];
      detachedField.value = 'own-after';
      // A new attribute write after native upgrade also remains meaningful.
      detachedField.setAttribute('value','attribute-after');
      document.body.append(detached,detachedField);
      return before;
    });
    assert.deepEqual(upgrade, {values:['before-upgrade'],text:'own-before'});
    await page.waitForFunction(() => detached.hasAttribute('data-awc-motion-ready') && detachedField.hasAttribute('data-awc-motion-ready'));
    assert.deepEqual(await page.evaluate(() => ({connected:[...document.querySelector('#connected').value],detached:[...detached.value],text:detachedField.value})),
      {connected:[],detached:[],text:'attribute-after'});
    console.log(`PASS ${runtime} CSR: connected and detached own props, later property/attribute writes, explicit empty array`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

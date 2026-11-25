import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MdAvatar, MdButton, MdCheckbox, MdMultiSelect, MdTextField } from '../dist/server.js';

const requireCore = createRequire(new URL('../../core/package.json', import.meta.url));
const requireBrowser = createRequire(new URL('../../../apps/test-html/package.json', import.meta.url));
const { build } = requireCore('esbuild');
const puppeteer = requireBrowser('puppeteer');
const text = 'A "quoted" & <complete> value';
const props = {
  field: { id: 'field', label: text, value: text, title: text, name: 'who', disabled: false },
  avatar: { id: 'avatar', name: 'Alice', colorFromName: false },
  button: { id: 'button', title: text, href: '#must-be-cancelled', ripple: false, shapeMorph: false, children: 'Press',
    style: { '--scale': 1.5, '--brandColor': 'red' } },
  checkbox: { id: 'checkbox', checked: true, disabled: false, name: 'agree', value: 'yes', supportingText: text, children: 'Check' },
  disabledField: { id: 'disabled-field', name: 'disabled-who', disabled: true, value: 'excluded' },
  disabledCheckbox: { id: 'disabled-checkbox', name: 'disabled-agree', checked: true, disabled: true, value: 'excluded' },
  multi: { id: 'multi', name: 'choices', options: [{ value: 'apple', label: 'Apple' }], value: ['apple'] },
};
const markup = (await Promise.all([
  MdTextField(props.field), MdAvatar(props.avatar), MdButton(props.button), MdCheckbox(props.checkbox),
  MdTextField(props.disabledField), MdCheckbox(props.disabledCheckbox), MdMultiSelect(props.multi),
])).map(renderToStaticMarkup).join('');

for (const [version, packagePath] of [
  ['18', '../../../apps/test-react/package.json'], ['19', '../package.json'],
]) {
  test(`React ${version}: SSR identity, initial props, first input and StrictMode remount`, { timeout: 30000 }, async t => {
    const requireReact = createRequire(new URL(packagePath, import.meta.url));
    const bundle = await build({
      stdin: { contents: `
        import React from 'react';
        import { hydrateRoot } from 'react-dom/client';
        import { MdAvatar, MdButton, MdCheckbox, MdMultiSelect, MdTextField } from './src/server.ts';
        const initial = ${JSON.stringify(props)};
        window.events = []; window.recoveries = []; window.refCalls = [];
        function App() {
          const [revision, setRevision] = React.useState(0);
          const [mount, setMount] = React.useState(0);
          const [checked, setChecked] = React.useState(true);
          React.useEffect(() => {
            window.updateWrapper = () => setRevision(value => value + 1);
            window.remountWrapper = () => setMount(value => value + 1);
            window.appReady = true;
          }, []);
          const buttonRef = React.useCallback(node => window.refCalls.push(node ? 'set-' + revision : 'clear-' + revision), [revision]);
          return React.createElement(React.Fragment, null,
            React.createElement(MdTextField, {...initial.field, key:'f'+mount, value: revision ? 'updated "value"' : initial.field.value}),
            React.createElement(MdAvatar, {...initial.avatar, key:'a'+mount}),
            React.createElement(MdButton, {...initial.button, key:'b'+mount, ref:buttonRef, onMdClick:event => {
              event.preventDefault();
              window.events.push({kind:'click', revision, cancelable:event.cancelable, prevented:event.defaultPrevented});
            }}),
            React.createElement(MdCheckbox, {...initial.checkbox, key:'c'+mount, checked,
              onMdChange:event => { window.events.push({kind:'change', checked:event.detail.checked}); setChecked(event.detail.checked); }
            }),
            React.createElement(MdTextField, initial.disabledField),
            React.createElement(MdCheckbox, initial.disabledCheckbox),
            React.createElement(MdMultiSelect, initial.multi),
          );
        }
        window.claimReact = () => hydrateRoot(document.querySelector('#root'), React.createElement(React.StrictMode,null,React.createElement(App)), {
          onRecoverableError:error => window.recoveries.push(error.message)
        });
      `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), sourcefile: 'ssr-hydration-harness.ts' },
      bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"development"' },
      alias: {
        'react': requireReact.resolve('react'),
        'react-dom/client': requireReact.resolve('react-dom/client'),
        'react-dom/server': requireReact.resolve('react-dom/server.browser'),
      },
      plugins: [{ name: 'server-only-hydrate', setup(builder) {
        builder.onResolve({ filter: /^@awc-ui\/core\/hydrate$/ }, () => ({ path:'core-hydrate', namespace:'server-only' }));
        builder.onLoad({ filter: /.*/, namespace:'server-only' }, () => ({ contents:'throw new Error("SSR hydration module reached the browser")' }));
      } }],
    });
    const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH });
    t.after(() => browser.close());
    for (const frameworkFirst of [false, true]) {
      await t.test(frameworkFirst ? 'React hydrates before Core registration' : 'Core upgrades before React hydrates', async () => {
        const page = await browser.newPage();
        try {
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.setContent(`<form id="form"><div id="root">${markup}</div></form>`);
          assert.deepEqual(await page.evaluate(() => ({
            hostDisabled: ['field', 'checkbox', 'disabled-field', 'disabled-checkbox'].map(id =>
              document.getElementById(id).hasAttribute('disabled')),
            inputDisabled: ['field', 'disabled-field'].map(id =>
              document.getElementById(id).shadowRoot.querySelector('input').disabled),
          })), { hostDisabled: [false, false, true, true], inputDisabled: [false, true] });
          await page.evaluate(frameworkFirst => {
            if (frameworkFirst) {
              const define = customElements.define.bind(customElements);
              const pending = new Map();
              customElements.define = (name, constructor, options) => pending.set(name, [constructor, options]);
              window.releaseDefinitions = () => {
                customElements.define = define;
                for (const [name, [constructor, options]] of pending) define(name, constructor, options);
              };
            }
            window.originalHosts = Array.from(document.querySelector('#root').children);
            window.originalShadows = window.originalHosts.map(host => host.shadowRoot);
            window.frames = [];
            const sample = () => {
              window.frames.push({
                identity: window.originalHosts.every((host, index) => host === document.querySelector('#root').children[index] && host.shadowRoot === window.originalShadows[index]),
                value: document.querySelector('#field').shadowRoot.querySelector('input').value,
                palette: document.querySelector('#avatar').className.includes('md-avatar--palette-'),
                scale: document.querySelector('#button').style.getPropertyValue('--scale'),
                color: document.querySelector('#button').style.getPropertyValue('--brandColor'),
                chips: document.querySelector('#multi').shadowRoot.querySelectorAll('md-chip').length,
              });
              window.sampler = requestAnimationFrame(sample);
            };
            sample();
          }, frameworkFirst);
          await page.addScriptTag({ content: bundle.outputFiles[0].text });
          const awaitCore = () => page.waitForFunction(() => window.originalHosts.every(host =>
            host.hasAttribute('data-awc-motion-ready')));
          if (!frameworkFirst) {
            await awaitCore();
            assert.deepEqual(await page.$eval('#multi', multi => ({
              selected: Array.from(multi.value),
              chips: multi.shadowRoot.querySelectorAll('md-chip').length,
            })), { selected: props.multi.value, chips: 1 });
          }
          await page.evaluate(() => { window.claimReact(); });
          await page.waitForFunction(() => window.appReady);
          if (frameworkFirst) {
            assert.equal(await page.evaluate(() => customElements.get('md-multi-select') === undefined), true);
            await page.evaluate(() => window.releaseDefinitions());
            await awaitCore();
          }
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const initial = await page.evaluate(() => {
            cancelAnimationFrame(window.sampler);
            return { frames:window.frames, recoveries:window.recoveries, title:document.querySelector('#field').title,
              value:document.querySelector('#field').value, color:document.querySelector('#avatar').colorFromName,
              checked:document.querySelector('#checkbox').checked, ripple:document.querySelector('#button').ripple,
              hostDisabled: ['field', 'checkbox', 'disabled-field', 'disabled-checkbox'].map(id =>
                document.getElementById(id).matches(':disabled')),
              inputDisabled: ['field', 'disabled-field'].map(id =>
                document.getElementById(id).shadowRoot.querySelector('input').disabled),
              formData: [...new FormData(document.getElementById('form'))] };
          });
          assert.deepEqual(initial.recoveries, []);
          assert.ok(initial.frames.length >= 2);
          assert.ok(initial.frames.every(frame => frame.identity && frame.value === text && !frame.palette && frame.scale === '1.5' && frame.color === 'red' && frame.chips === 1), JSON.stringify(initial.frames));
          assert.equal(initial.title, text);
          assert.equal(initial.value, text);
          assert.equal(initial.color, false);
          assert.equal(initial.checked, true);
          assert.equal(initial.ripple, false);
          assert.deepEqual(initial.hostDisabled, [false, false, true, true]);
          assert.deepEqual(initial.inputDisabled, [false, true]);
          assert.deepEqual(initial.formData, [['who', text], ['agree', 'yes'], ['choices', 'apple']]);
          await page.click('#button');
          assert.deepEqual(await page.evaluate(() => window.events), [{ kind:'click', revision:0, cancelable:true, prevented:true }]);
          assert.equal(await page.evaluate(() => location.hash), '');
          await page.click('#checkbox');
          await page.waitForFunction(() => document.querySelector('#checkbox').checked === false);
          assert.deepEqual(await page.evaluate(() => window.events[1]), { kind:'change', checked:false });
          await page.evaluate(() => window.updateWrapper());
          await page.waitForFunction(() => document.querySelector('#field').value === 'updated "value"');
          await page.click('#button');
          assert.equal(await page.evaluate(() => window.events.at(-1).revision), 1);
          await page.evaluate(() => window.remountWrapper());
          await page.waitForFunction(() => document.querySelector('#button') !== window.originalHosts[2]);
          await page.click('#button');
          assert.equal(await page.evaluate(() => window.events.at(-1).revision), 1);
          const result = await page.evaluate(() => ({ events:window.events, recoveries:window.recoveries, refs:window.refCalls }));
          assert.equal(result.events.filter(event => event.kind === 'click').length, 3);
          assert.ok(result.refs.includes('clear-0') && result.refs.includes('set-1'));
          assert.deepEqual(result.recoveries, []);
          assert.deepEqual(errors, []);
        } finally {
          await page.close();
        }
      });
    }
  });
}

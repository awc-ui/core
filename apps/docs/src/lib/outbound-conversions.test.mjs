import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOutboundIntent, setupOutboundConversions } from './outbound-conversions.mjs';

const labels = { npm: 'AW-123/test_npm', github: 'AW-123/test_github' };
const npm = 'https://www.npmjs.com/package/@awc-ui/core/v/1.0.1';
const github = 'https://github.com/awc-ui/core';

function fixture(options = {}) {
  const listeners = new Map();
  const calls = [];
  const navigations = [];
  const timers = new Map();
  let timerId = 0;
  const document = {
    baseURI: 'https://awc-ui.dev/',
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    removeEventListener(type, listener) { listeners.set(type, listeners.get(type).filter(item => item !== listener)); },
    querySelector() { return null; },
  };
  const window = {
    gtag: (...args) => calls.push(args),
    location: { assign: href => navigations.push(href) },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const setup = () => setupOutboundConversions({ document, window, sendTo: labels, enabled: true, ...options });
  function click(href = npm, eventOptions = {}, attributes = {}) {
    const anchor = {
      localName: 'a', href,
      hasAttribute: name => name === 'href' || Object.hasOwn(attributes, name),
      getAttribute: name => attributes[name] ?? null,
    };
    const event = {
      type: 'click', button: 0, isTrusted: true, defaultPrevented: false,
      composedPath: () => [{ localName: 'svg' }, anchor],
      preventDefault() { this.defaultPrevented = true; },
      ...eventOptions,
    };
    for (const handler of listeners.get(event.type) ?? []) handler(event);
    return event;
  }
  return { setup, click, calls, navigations, timers, window };
}

test('only the actual npm package and repository root destinations are goals', () => {
  for (const url of [npm, 'https://npmjs.com/package/@awc-ui/core/', 'https://www.npmjs.com/package/@awc-ui/core?activeTab=readme']) {
    assert.equal(getOutboundIntent(url), 'npm');
  }
  for (const name of ['react', 'angular', 'vue', 'svelte', 'tokens', 'theme', 'mcp']) {
    assert.equal(getOutboundIntent(`https://www.npmjs.com/package/@awc-ui/${name}`), 'npm');
  }
  assert.equal(getOutboundIntent(github + '/#readme'), 'github');
  for (const url of [
    '/getting-started/', 'https://github.com/awc-ui/core/issues', 'https://github.com/awc-ui/core/releases',
    'https://github.com/awc-ui/core/tree/main', 'https://github.com/another/core',
    'https://github.com.evil.test/awc-ui/core', 'https://evil.test/?url=' + github,
    'https://www.npmjs.com/package/@awc-ui/core-other', 'https://www.npmjs.com/package/other',
    'http://github.com/awc-ui/core', 'https://user@github.com/awc-ui/core',
    'https://github.com:8080/awc-ui/core', 'javascript:alert(1)', 'not a URL',
  ]) assert.equal(getOutboundIntent(url, 'https://awc-ui.dev/'), null, url);
});

test('ordinary click waits for the tag callback and navigates exactly once', () => {
  const f = fixture(); f.setup();
  assert.equal(f.click().defaultPrevented, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'event');
  assert.equal(f.calls[0][1], 'conversion');
  assert.equal(f.calls[0][2].send_to, labels.npm);
  assert.deepEqual(Object.keys(f.calls[0][2]).sort(), ['event_callback', 'event_timeout', 'send_to']);
  assert.deepEqual(f.navigations, []);
  const fallback = [...f.timers.values()][0];
  f.calls[0][2].event_callback(); fallback();
  assert.deepEqual(f.navigations, [npm]);
});

test('a tag blocked after queuing does not trap same-tab navigation', () => {
  const f = fixture(); f.setup(); f.click();
  [...f.timers.values()][0]();
  assert.deepEqual(f.navigations, [npm]);
});

test('modifier, middle and new-tab clicks retain native behavior', () => {
  for (const [event, attributes] of [
    [{ ctrlKey: true }, {}], [{ metaKey: true }, {}], [{ shiftKey: true }, {}],
    [{ altKey: true }, {}], [{ type: 'auxclick', button: 1 }, {}], [{}, { target: '_blank' }],
  ]) {
    const f = fixture(); f.setup();
    assert.equal(f.click(npm, event, attributes).defaultPrevented, false);
    assert.deepEqual(f.calls, [['event', 'conversion', { send_to: labels.npm }]]);
    assert.equal(f.timers.size, 0);
  }
});

test('repeated initialization and clicks record each intent once per document', () => {
  const f = fixture(); assert.equal(f.setup(), f.setup());
  f.click(npm, { metaKey: true }); f.click(npm, { type: 'auxclick', button: 1 });
  f.click(github, { metaKey: true }); f.click(github, { metaKey: true });
  assert.deepEqual(f.calls.map(call => call[2].send_to), [labels.npm, labels.github]);
});

test('untrusted, canceled, right-button, disabled and download clicks do not count', () => {
  const f = fixture(); f.setup();
  for (const event of [{ isTrusted: false }, { defaultPrevented: true }, { type: 'auxclick', button: 2 }, { button: 1 }]) f.click(npm, event);
  f.click(npm, {}, { download: '' }); f.click(npm, {}, { 'aria-disabled': 'true' });
  assert.deepEqual(f.calls, []);
});

test('development, missing labels and unavailable tracking do not alter navigation', () => {
  for (const options of [{ enabled: false }, { sendTo: {} }]) {
    const f = fixture(options); f.setup();
    assert.equal(f.click().defaultPrevented, false);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture(); f.window.gtag = undefined; f.setup();
  assert.equal(f.click().defaultPrevented, false);
});

test('tracking errors preserve navigation and cleanup removes both listeners', () => {
  const f = fixture(); f.window.gtag = () => { throw new Error('blocked'); };
  const cleanup = f.setup(); f.click();
  assert.deepEqual(f.navigations, [npm]);
  cleanup();
  assert.equal(f.click().defaultPrevented, false);
});

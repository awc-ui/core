import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativePreviewKey, nativePreviewKeyCommand, nativePreviewKeyboardPolicy, handleNativePreviewKeyDown } from './native-preview-keys.js';
import { validateLiveInput } from './native-live.mjs';

test('menu typeahead forwards real character keys and Escape, with modifiers intact', () => {
  const bounds = { logicalWidth: 424, logicalHeight: 544, tag: 'md-fab-menu' };
  for (const key of ['a', 'Z', 'ă', 'é', '0', '.', 'Escape', 'ArrowDown']) {
    const command = nativePreviewKeyCommand({ key, shiftKey: key === 'Z' }, { typeahead: true });
    assert.deepEqual(command, { command: 'key', key, modifiers: key === 'Z' ? ['shift'] : [] });
    assert.deepEqual(validateLiveInput(command, bounds), command);
  }
  assert.deepEqual(nativePreviewKeyCommand({ key: ' ', shiftKey: true }, { typeahead: true }), { command: 'key', key: 'Space', modifiers: ['shift'] });
});

test('ordinary text, IME composition and editing shortcuts keep their browser input path', () => {
  assert.equal(nativePreviewKeyCommand({ key: 'a' }), null);
  assert.equal(nativePreviewKeyCommand({ key: 'ă', isComposing: true }, { typeahead: true }), null);
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(nativePreviewKeyCommand({ key: 'a', [modifier]: true }, { typeahead: true }), null);
  assert.deepEqual(nativePreviewKeyCommand({ key: 'Tab', shiftKey: true }), { command: 'key', key: 'Tab', modifiers: ['shift'] });
});

test('key validation rejects arbitrary commands, malformed characters and control strings', () => {
  for (const key of [undefined, null, 3, '', 'ab', 'LaunchApplication', '\n', '\u0000', '\u007f', '\u0085', '\u200b', '\u2028', '\ud800', '😀']) {
    assert.equal(isNativePreviewKey(key), false);
    assert.throws(() => validateLiveInput({ command: 'key', key }, { tag: 'md-fab-menu' }), { code: 'INVALID_KEY' });
  }
});

test('menu and item support held pointer input with outside release cancellation', () => {
  for (const tag of ['md-fab-menu', 'md-fab-menu-item']) {
    const bounds = { logicalWidth: 424, logicalHeight: 544, tag };
    assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'down', x: 20, y: 30 }, bounds), { command: 'pointer', phase: 'down', x: 20, y: 30 });
    assert.equal(validateLiveInput({ command: 'pointer', phase: 'up', x: -1, y: 30 }, bounds).phase, 'cancel');
  }
});

function routeKey(key, policy, extra = {}) {
  const input = new EventTarget(), calls = [];
  input.addEventListener('keydown', event => handleNativePreviewKeyDown(event, {
    ...policy, send: command => calls.push(command), releaseFocus: () => calls.push('blur'),
  }));
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key, ...extra });
  input.dispatchEvent(event);
  return { calls, prevented: event.defaultPrevented };
}

test('Escape reaches verified native overlays without losing keyboard focus', () => {
  for (const tag of ['md-snackbar', 'md-tooltip', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet']) {
    assert.deepEqual(routeKey('Escape', nativePreviewKeyboardPolicy(tag, { retained: true })), {
      calls: [{ command: 'key', key: 'Escape', modifiers: [] }], prevented: true,
    }, tag);
  }
  assert.deepEqual(routeKey('Escape', nativePreviewKeyboardPolicy('md-fab-menu')), {
    calls: [{ command: 'key', key: 'Escape', modifiers: [] }], prevented: true,
  });
});

test('ordinary editors, unverified overlays and scenario previews still release keyboard on Escape', () => {
  for (const [tag, options] of [
    ['md-text-field', { retained: true }], ['md-button', { retained: true }],
    ['md-snackbar', {}], ['md-tooltip', {}], ['md-dialog', {}],
    ['md-snackbar', { retained: true, scenario: true }], ['md-fab-menu', { scenario: true }],
  ]) assert.deepEqual(routeKey('Escape', nativePreviewKeyboardPolicy(tag, options)), { calls: ['blur'], prevented: true });
});

test('composition Escape and browser text input are left intact by the textarea handler', () => {
  for (const tag of ['md-text-field', 'md-snackbar', 'md-fab-menu']) {
    const policy = nativePreviewKeyboardPolicy(tag, { retained: true });
    assert.deepEqual(routeKey('Escape', policy, { isComposing: true }), { calls: [], prevented: false });
    assert.deepEqual(routeKey('a', policy, { metaKey: true }), { calls: [], prevented: false });
  }
  assert.deepEqual(routeKey('a', nativePreviewKeyboardPolicy('md-text-field')), { calls: [], prevented: false });
  assert.deepEqual(routeKey('ArrowDown', nativePreviewKeyboardPolicy('md-snackbar', { retained: true })), {
    calls: [{ command: 'key', key: 'ArrowDown', modifiers: [] }], prevented: true,
  });
});

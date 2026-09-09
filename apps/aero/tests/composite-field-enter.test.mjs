import test from 'node:test';
import assert from 'node:assert/strict';
import { submitCompositeFieldOnEnter } from '../lib/composite-field-enter.mjs';
function setup(overrides = {}, hostOverrides = {}) {
  let submitted = 0;
  const event = {
    key: 'Enter',
    defaultPrevented: false,
    composedPath: () => [{ localName: 'input' }],
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides,
  };
  const host = {
    open: false,
    closest: () => ({
      requestSubmit() {
        submitted++;
      },
    }),
    ...hostOverrides,
  };
  return { event, host, count: () => submitted };
}
test('Enter in a closed composite input invokes native form validation and submission once', () => {
  const { event, host, count } = setup();
  assert.equal(submitCompositeFieldOnEnter(event, host), true);
  assert.equal(count(), 1);
  assert.equal(event.defaultPrevented, true);
  assert.equal(submitCompositeFieldOnEnter(event, host), false);
  assert.equal(count(), 1);
});
test('popup selection, composition, modifiers, repeated keys and control buttons retain their own keyboard behavior', () => {
  for (const props of [
    { defaultPrevented: true },
    { repeat: true },
    { isComposing: true },
    { keyCode: 229 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { key: 'ArrowDown' },
    { composedPath: () => [{ localName: 'button' }] },
  ]) {
    const { event, host, count } = setup(props);
    assert.equal(submitCompositeFieldOnEnter(event, host), false);
    assert.equal(count(), 0);
  }
  for (const props of [
    { open: true },
    { disabled: true },
    { softDisabled: true },
    { closest: () => null },
  ]) {
    const { event, host, count } = setup({}, props);
    assert.equal(submitCompositeFieldOnEnter(event, host), false);
    assert.equal(count(), 0);
  }
});

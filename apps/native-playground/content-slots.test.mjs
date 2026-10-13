import test from 'node:test';
import assert from 'node:assert/strict';
import { editableTextSlot, nativeTextSlot, nativeContentSlots } from './content-slots.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';

test('text editors cannot replace structural, icon or interactive children', () => {
  const component = tag => ({ tag, slots: [{ name: '' }, { name: 'actions' }, { name: 'leading-icon' }] });
  for (const tag of ['md-tabs', 'md-menu', 'md-table', 'md-list', 'md-navigation-rail', 'md-select', 'md-tooltip']) assert.equal(editableTextSlot(component(tag), ''), false, tag);
  for (const tag of ['md-card', 'md-button', 'md-tab-panel', 'md-accordion-item']) {
    assert.equal(editableTextSlot(component(tag), ''), true, tag);
    assert.equal(editableTextSlot(component(tag), 'actions'), false);
    assert.equal(editableTextSlot(component(tag), 'leading-icon'), false);
    assert.equal(editableTextSlot(component(tag), 'invented'), false);
  }
  assert.equal(nativeTextSlot({ ...component('md-card'), support: { ios: { status: 'adapter-implemented', slots: [''] } } }, '', 'ios'), true);
  assert.equal(nativeTextSlot(component('md-card'), '', 'android'), false);
});

test('native slot text round trips Unicode, empty strings and literal markup without becoming properties', () => {
  const slots = { '': '', headline: 'Salut 👋 <b>literal</b>', 'expanded-content': 'Details' };
  const request = nativeRenderRequest('md-card', { variant: 'filled' }, false, { slots });
  const normalized = validateRenderRequest(request, new Set(['md-card']));
  assert.deepEqual(normalized.slots, slots);
  assert.deepEqual(normalized.properties, { variant: 'filled' });
  assert.deepEqual(nativeContentSlots(undefined), {});
  assert.deepEqual(nativeContentSlots({ text: 'ă'.repeat(2048) }).slots.text, 'ă'.repeat(2048));
});

test('native slot validation has consistent UTF-8 limits in browser and server', () => {
  const invalid = [null, [], true, { x: false }, { x: 'ă'.repeat(2049) }, { ['x'.repeat(81)]: '' }, Object.fromEntries(Array.from({ length: 33 }, (_, i) => [i, ''])), Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, 'a'.repeat(4096)]))];
  for (const slots of invalid) {
    assert.throws(() => nativeContentSlots(slots), error => error.code === 'INVALID_SLOTS');
    assert.throws(() => validateRenderRequest({ tag: 'md-card', slots }, new Set(['md-card'])), error => error.code === 'INVALID_SLOTS' && error.status === 400);
  }
});

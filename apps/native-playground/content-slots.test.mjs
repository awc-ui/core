import test from 'node:test';
import assert from 'node:assert/strict';
import { editableTextSlot, nativeTextSlot, nativeContentSlots, normalizeSlotValue, buttonSlotElement, componentContentSlots, componentSlotElement } from './content-slots.js';
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

test('button compositions round trip through browser/server without mutating authored text or typed values', () => {
  const slots = { '': 'Save <draft>', 'leading-icon': { kind: 'symbol', value: 'add' }, 'trailing-icon': '', loader: { kind: 'progress' } };
  const request = nativeRenderRequest('md-button', { 'aria-expanded': false }, false, { slots });
  const normalized = validateRenderRequest(request, new Set(['md-button']));
  assert.deepEqual(normalized.slots, slots);
  assert.deepEqual(normalized.properties, { 'aria-expanded': false });
  slots['leading-icon'].value = 'delete';
  assert.equal(normalized.slots['leading-icon'].value, 'add', 'transport owns a normalized copy');
  assert.throws(() => nativeRenderRequest('md-card', {}, false, { slots }), { code: 'INVALID_SLOTS' });
  assert.throws(() => validateRenderRequest({ tag: 'md-card', slots }, new Set(['md-card'])), error => error.status === 400 && error.code === 'INVALID_SLOTS');
});

test('typed slots reject executable markup, unknown fields and misplaced composition without evaluating accessors', () => {
  for (const [name, value] of [
    ['', { kind: 'symbol', value: 'add' }], ['actions', { kind: 'symbol', value: 'add' }],
    ['leading-icon', { kind: 'progress' }], ['loader', { kind: 'progress', size: 24 }],
    ['leading-icon', { kind: 'symbol', value: '<svg>' }], ['trailing-icon', { kind: 'symbol', value: '' }],
    ['loader', { kind: 'symbol', value: 'add', html: '<b>' }], ['loader', { kind: 'unknown' }],
  ]) assert.throws(() => nativeContentSlots({ [name]: value }, 'md-button'), { code: 'INVALID_SLOTS' });
  const accessor = { get kind() { throw new Error('must not execute'); } };
  assert.throws(() => normalizeSlotValue('loader', accessor), { code: 'INVALID_SLOTS' });
  assert.deepEqual(normalizeSlotValue('loader', { kind: 'symbol', value: 'hourglass_empty' }), { kind: 'symbol', value: 'hourglass_empty' });
});

test('authored Web slot descriptors use real progress and public size hooks with source density scaling', () => {
  assert.deepEqual(buttonSlotElement('loader', { kind: 'progress' }), {
    tag: 'md-progress-indicator', attributes: { slot: 'loader', variant: 'circular', indeterminate: '', size: '24', label: 'Loading', style: '--md-progress-indicator-active-indicator-color:currentColor' },
  });
  assert.deepEqual(buttonSlotElement('leading-icon', '<script>text</script>'), { tag: 'span', attributes: { slot: 'leading-icon' }, text: '<script>text</script>' });
  const symbol = buttonSlotElement('trailing-icon', { kind: 'symbol', value: 'arrow_forward' }, { size: 'lg' });
  assert.equal(symbol.text, 'arrow_forward');
  assert.match(symbol.attributes.style, /--md-button-trailing-icon-size/);
  assert.match(symbol.attributes.style, /max\(16px,calc\(32px \+ var\(--md-sys-density-scale,0\) \* 4px\)\)/);
  assert.doesNotMatch(symbol.attributes.style, /--_/);
});


test('icon compositions round trip only in their declared slots and retain literal accessible names', () => {
  const slots = { '': { kind: 'symbol', value: 'favorite_border' }, selected: { kind: 'symbol', value: 'favorite' } };
  const request = nativeRenderRequest('md-icon-button', { 'aria-label': 'Save favorite' }, false, { slots });
  const actual = validateRenderRequest(request, new Set(['md-icon-button']));
  assert.deepEqual(actual.slots, slots);
  assert.equal(actual.properties['aria-label'], 'Save favorite');
  assert.deepEqual(componentContentSlots('md-icon-button'), ['', 'selected']);
  assert.deepEqual(componentContentSlots('md-card'), []);
  for (const invalid of [{ loader: { kind: 'progress' } }, { '': { kind: 'progress' } }, { 'leading-icon': { kind: 'symbol', value: 'add' } }]) {
    assert.throws(() => nativeContentSlots(invalid, 'md-icon-button'), { code: 'INVALID_SLOTS' });
  }
  assert.throws(() => nativeContentSlots(slots, 'md-button'), { code: 'INVALID_SLOTS' });
  assert.throws(() => nativeContentSlots(slots, 'md-card'), { code: 'INVALID_SLOTS' });
  assert.equal(editableTextSlot({ tag: 'md-icon-button', slots: [{ name: '' }, { name: 'selected' }] }, ''), false);
});

test('icon symbol descriptors match all five source size and density floors without overriding host colors', () => {
  for (const [size, base, floor, step] of [['xs',20,16,1],['sm',24,18,1],['md',24,18,1],['lg',32,24,2],['xl',40,28,3]]) {
    const descriptor = componentSlotElement('md-icon-button', 'selected', { kind: 'symbol', value: 'favorite' }, { size });
    assert.ok(descriptor.attributes.style.includes(`var(--md-icon-button-icon-size,max(${floor}px,calc(${base}px + var(--md-sys-density-scale,0) * ${step}px)))`));
    assert.doesNotMatch(descriptor.attributes.style, /(?:^|;)(?:color|transform):|--md-button-/);
    assert.equal(descriptor.attributes.slot, 'selected');
  }
});

test('FAB icon symbols follow actual label/size density rules and keep explicit blank slot content', () => {
  for (const [properties,base,floor] of [[{},24,18],[{size:'medium'},28,21],[{size:'large'},36,27],[{size:'large',label:'Create'},24,18]]) {
    const descriptor=componentSlotElement('md-fab','icon',{kind:'symbol',value:'edit'},properties);
    assert.match(descriptor.attributes.style,new RegExp(`max\\(${floor}px,calc\\(${base}px`));
    assert.match(descriptor.attributes.style,/--md-fab-icon-size/);
  }
  assert.deepEqual(componentSlotElement('md-fab','icon',''),{tag:'span',attributes:{slot:'icon'},text:''});
  assert.throws(()=>nativeContentSlots({icon:{kind:'progress'}},'md-fab'),{code:'INVALID_SLOTS'});
  assert.throws(()=>nativeContentSlots({selected:{kind:'symbol',value:'edit'}},'md-fab'),{code:'INVALID_SLOTS'});
  assert.throws(()=>nativeContentSlots({icon:{kind:'symbol',value:'edit'}},'md-button'),{code:'INVALID_SLOTS'});
});

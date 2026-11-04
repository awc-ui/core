import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePropertyUpdate, supportsRetainedUpdateTag, BADGE_UPDATE_PROPERTIES, LOADING_INDICATOR_UPDATE_PROPERTIES, METER_UPDATE_PROPERTIES, STATUS_DOT_UPDATE_PROPERTIES } from './native-property-updates.js';

// Gate-7 R2-D6: md-badge, md-loading-indicator, md-meter and md-status-dot use retained Laboratory updates, so
// editing a property no longer restarts the native session (which hid the meter glide, the status-dot colour
// transition and the continuous loading morph).
const sets = { 'md-badge': BADGE_UPDATE_PROPERTIES, 'md-loading-indicator': LOADING_INDICATOR_UPDATE_PROPERTIES, 'md-meter': METER_UPDATE_PROPERTIES, 'md-status-dot': STATUS_DOT_UPDATE_PROPERTIES };
const source = {
  'md-badge': ['variant', 'value', 'max', 'icon', 'shape', 'density'],
  'md-loading-indicator': ['variant', 'label', 'density'],
  'md-meter': ['value', 'min', 'max', 'label', 'showLabel', 'showValue', 'valueText', 'locale', 'formatOptions', 'color', 'variant', 'size', 'thickness', 'density'],
  'md-status-dot': ['state', 'size', 'inline', 'shape', 'live', 'label', 'density'],
};

test('the four communication leaves declare exactly their source properties as retained', () => {
  for (const [tag, names] of Object.entries(source)) {
    assert.equal(supportsRetainedUpdateTag(tag), true, tag);
    assert.deepEqual([...sets[tag]].sort(), [...names].sort(), tag);
  }
});

test('valid values pass through unchanged', () => {
  assert.deepEqual(nativePropertyUpdate('md-meter', { value: 20 }), { command: 'update', properties: { value: 20 } });
  assert.deepEqual(nativePropertyUpdate('md-meter', { formatOptions: { style: 'unit', unit: 'gigabyte' } }).properties, { formatOptions: { style: 'unit', unit: 'gigabyte' } });
  assert.deepEqual(nativePropertyUpdate('md-meter', { color: 'Brand', variant: 'circular', showValue: true }).properties, { color: 'Brand', variant: 'circular', showValue: true });
  assert.deepEqual(nativePropertyUpdate('md-status-dot', { state: 'busy', size: 'large', inline: true, shape: 'circle', live: true }).properties.state, 'busy');
  assert.deepEqual(nativePropertyUpdate('md-loading-indicator', { variant: 'contained', label: '', density: -4 }).properties, { variant: 'contained', label: '', density: -4 });
  assert.deepEqual(nativePropertyUpdate('md-badge', { variant: 'small', value: '99+', max: 99, icon: 'error', shape: 'circle' }).properties.max, 99);
});

test('Unset (undefined) restores the source default instead of failing or dropping the edit', () => {
  assert.deepEqual(nativePropertyUpdate('md-meter', { formatOptions: undefined }).properties, { formatOptions: null });
  assert.deepEqual(nativePropertyUpdate('md-meter', { color: undefined }).properties, { color: 'primary' });
  assert.deepEqual(nativePropertyUpdate('md-loading-indicator', { label: undefined }).properties, { label: 'Loading' });
  assert.deepEqual(nativePropertyUpdate('md-status-dot', { state: undefined }).properties, { state: 'neutral' });
  assert.deepEqual(nativePropertyUpdate('md-badge', { max: undefined }).properties, { max: 999 });
  assert.equal(JSON.stringify(nativePropertyUpdate('md-meter', { formatOptions: undefined }).properties), '{"formatOptions":null}', 'null survives JSON transport');
});

test('invalid values and undeclared properties are rejected', () => {
  const bad = [
    ['md-meter', { value: '7' }], ['md-meter', { variant: 'ring' }], ['md-meter', { formatOptions: 'percent' }], ['md-meter', { formatOptions: { style: 'bogus' } }],
    ['md-meter', { showLabel: 1 }], ['md-meter', { size: Infinity }], ['md-status-dot', { state: 'idle' }], ['md-status-dot', { size: 12 }],
    ['md-status-dot', { inline: 'yes' }], ['md-loading-indicator', { variant: 'boxed' }], ['md-loading-indicator', { label: 3 }],
    ['md-badge', { variant: 'medium' }], ['md-badge', { shape: 'square' }], ['md-badge', { max: '9' }], ['md-badge', { value: 9 }],
    ['md-badge', { density: -5 }], ['md-meter', { unknown: 1 }], ['md-status-dot', { label: 'x'.repeat(4097) }],
  ];
  for (const [tag, properties] of bad) assert.throws(() => nativePropertyUpdate(tag, properties), { code: 'INVALID_PROPERTY_UPDATE' }, `${tag} ${JSON.stringify(properties).slice(0, 60)}`);
});

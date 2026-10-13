import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupedStyleFields, parseStyleValue, styleField, createCSSOverrideApplier } from './component-styles.js';

test('every source CSS hook has one searchable editor, including repeated declarations', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url)));
  const components = manifest.modules.flatMap(module => module.declarations || []).filter(component => component.tagName);
  assert.equal(components.length, 81);
  let count = 0;
  for (const component of components) {
    const fields = groupedStyleFields(component.tagName, component.cssProperties).flatMap(group => group.fields);
    assert.deepEqual(new Set(fields.map(field => field.name)), new Set((component.cssProperties || []).map(field => field.name)), component.tagName);
    assert.equal(new Set(fields.map(field => field.index)).size, fields.length);
    assert.ok(fields.every(field => field.label && field.group && field.search.includes(field.name)));
    count += fields.length;
  }
  assert.ok(count > 900, 'full source style inventory');
});

test('CSS edits preserve expressions and validate against their real CSS value type', () => {
  const color = styleField('md-card', { name: '--md-card-container-color' });
  const checked = [];
  const supports = (property, value) => { checked.push([property, value]); return value !== '12px'; };
  assert.equal(parseStyleValue(color, ' var(--accent) ', supports), 'var(--accent)');
  assert.throws(() => parseStyleValue(color, '12px', supports), /valid color/);
  assert.equal(parseStyleValue(color, '', supports), '');
  assert.deepEqual(checked, [['color', 'var(--accent)'], ['color', '12px']]);
  assert.equal(styleField('md-loading-indicator', { name: '--md-loading-indicator-shape-size' }).property, 'width');
  for (const [tag, name, property] of [['md-card', '--md-card-max-height', 'max-height'], ['md-menu', '--md-menu-max-block-size', 'max-block-size']]) {
    const field = styleField(tag, { name });
    assert.equal(field.property, property);
    assert.equal(parseStyleValue(field, 'none', (cssProperty, value) => cssProperty === property && value === 'none'), 'none');
  }
  for (const value of ['red; --other: blue', 'a'.repeat(1025), '{}']) assert.throws(() => parseStyleValue(color, value), /one CSS value/);
});

test('clearing overrides restores fixture CSS and priorities, with Button appearance taking precedence', () => {
  const values = new Map([['--fixture', ['12px', 'important']]]);
  const target = { style: {
    getPropertyValue: name => values.get(name)?.[0] || '',
    getPropertyPriority: name => values.get(name)?.[1] || '',
    setProperty: (name, value, priority = '') => values.set(name, [value, priority]),
    removeProperty: name => values.delete(name),
  } };
  const apply = createCSSOverrideApplier();
  apply(target, { '--fixture': '24px', '--new': 'red', '--button': 'blue' });
  apply(target, { '--fixture': '', '--new': '', '--button': '' }, { '--button': 'green' });
  assert.deepEqual([...values], [['--fixture', ['12px', 'important']], ['--button', ['green', '']]]);
  apply(target, { '--fixture': '36px' });
  apply(target, { '--fixture': '' });
  assert.deepEqual(values.get('--fixture'), ['12px', 'important']);
});

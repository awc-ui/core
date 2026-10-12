import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { propertyEditor, parsePropertyInput } from './property-controls.js';

const editor = (type, value, extra = {}, component = {}) => propertyEditor(component, { name: 'value', type, ...extra }, value);

test('primitive and optional numbers preserve numeric, null and unset values', () => {
  assert.equal(editor('number').kind, 'number');
  assert.equal(parsePropertyInput(editor('number'), '2.5'), 2.5);
  assert.equal(parsePropertyInput(editor('number'), '-1e3'), -1000);
  assert.equal(parsePropertyInput(editor('number | undefined'), ''), undefined);
  assert.equal(parsePropertyInput(editor('number | null'), ''), null);
  assert.equal(parsePropertyInput(editor('number | null | undefined'), ''), undefined);
  assert.equal(parsePropertyInput(editor('number', undefined, { optional: true }), ''), undefined);
  assert.throws(() => parsePropertyInput(editor('number'), ''), /empty/);
  for (const input of ['Infinity', 'NaN', '1e999', '23px', '0xFF']) assert.throws(() => parsePropertyInput(editor('number'), input), /finite/);
});

test('literal union and alias choices preserve boolean, number, null and string distinctions', () => {
  const mixed = editor("false | 'false' | 2 | '2' | null");
  assert.equal(mixed.kind, 'literal');
  assert.deepEqual(mixed.choices, [false, 'false', 2, '2', null]);
  for (const value of mixed.choices) assert.deepEqual(parsePropertyInput(mixed, JSON.stringify(value)), value);
  assert.throws(() => parsePropertyInput(mixed, 'true'), /declared/);
  const component = { dataTypes: [{ name: 'Alias', kind: 'type', body: "| 'linear' /* source note */ | 'smooth'" }] };
  const alias = editor('Alias', undefined, {}, component);
  assert.equal(alias.kind, 'literal');
  assert.deepEqual(alias.choices, ['linear', 'smooth']);
  const nested = editor('Alias | undefined', undefined, {}, component);
  assert.equal(parsePropertyInput(nested, ''), undefined);
  const emptyChoice = editor("'' | 'auto' | undefined");
  assert.equal(parsePropertyInput(emptyChoice, ''), undefined);
  assert.equal(parsePropertyInput(emptyChoice, '""'), '');
  assert.deepEqual(editor("'http://example.test' | 'HTMLElement' | '=>'").choices, ['http://example.test', 'HTMLElement', '=>']);
});

test('boolean and string controls do not coerce string values into false or zero', () => {
  assert.equal(editor('boolean').kind, 'boolean');
  assert.equal(parsePropertyInput(editor('boolean'), 'on', false), false);
  assert.equal(parsePropertyInput(editor('boolean'), '', true), true);
  assert.equal(parsePropertyInput(editor('string'), 'false'), 'false');
  assert.equal(parsePropertyInput(editor('string | undefined'), ''), '');
  assert.equal(editor("'primary' | (string & {})").kind, 'text');
});

test('mixed primitives and structured values use JSON with explicit outer type checks', () => {
  const mixed = editor('string | number | undefined');
  assert.equal(mixed.kind, 'json');
  assert.equal(parsePropertyInput(mixed, '12'), 12);
  assert.equal(parsePropertyInput(mixed, '"12"'), '12');
  assert.equal(parsePropertyInput(mixed, ''), undefined);
  assert.throws(() => parsePropertyInput(mixed, 'false'), /does not match/);
  assert.throws(() => parsePropertyInput(mixed, '12px'), /valid JSON/);
  const array = editor('number[]');
  assert.deepEqual(parsePropertyInput(array, '[0, 2.5]'), [0, 2.5]);
  assert.throws(() => parsePropertyInput(array, '["2"]'), /does not match/);
  assert.throws(() => parsePropertyInput(array, '{}'), /does not match/);
  const object = editor('Options', undefined, {}, { dataTypes: [{ name: 'Options', kind: 'interface', body: 'label: string;' }] });
  assert.equal(object.kind, 'json');
  assert.deepEqual(parsePropertyInput(object, '{"label":"Name"}'), { label: 'Name' });
  assert.throws(() => parsePropertyInput(object, '[]'), /does not match/);
  assert.throws(() => parsePropertyInput(object, '{"value":1e999}'), /finite/);
});

test('callbacks, callback aliases and DOM references remain read-only without evaluation', () => {
  for (const type of ['(value: string) => string', 'HTMLElement', 'HTMLElement | undefined', 'Element[]', 'Function']) assert.equal(editor(type).kind, 'readonly', type);
  assert.equal(editor('Callback', undefined, {}, { dataTypes: [{ name: 'Callback', kind: 'type', body: '(value: number) => string' }] }).kind, 'readonly');
  assert.equal(editor('UnknownAlias', undefined, {}, { callableProps: [{ name: 'value', body: '(n: number) => string' }] }).kind, 'readonly');
  assert.equal(editor('unknown', () => {}).kind, 'readonly');
  assert.throws(() => parsePropertyInput(editor('HTMLElement'), '{}'), /application code/);
});

test('recursive and incomplete aliases are bounded and honest about missing type metadata', () => {
  const cyclic = editor('First', undefined, {}, { dataTypes: [{ name: 'First', kind: 'type', body: 'Second' }, { name: 'Second', kind: 'type', body: 'First' }] });
  assert.equal(cyclic.kind, 'readonly');
  assert.equal(editor('UnknownType', 'current').kind, 'text');
  assert.match(editor('UnknownType', 'current').note, /unavailable/);
  assert.equal(editor('UnknownType').kind, 'readonly');
});

test('every catalog property classifies safely and declared defaults round-trip without coercion', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  const kinds = new Set(['boolean', 'literal', 'number', 'text', 'json', 'readonly']);
  let count = 0;
  for (const component of catalog.components) {
    const usage = JSON.parse(readFileSync(new URL(`../docs/src/data/components/${component.tag.slice(3)}.json`, import.meta.url)));
    for (const property of component.properties) {
      const control = propertyEditor({ ...component, dataTypes: usage.dataTypes, callableProps: usage.callableProps }, property, property.defaultValue);
      assert.ok(kinds.has(control.kind), `${component.tag}.${property.name}`);
      if (property.defaultValue !== undefined && control.kind !== 'readonly') {
        const value = property.defaultValue;
        const raw = ['literal', 'json'].includes(control.kind) ? JSON.stringify(value) : control.kind === 'number' && value === null ? '' : String(value);
        let parsed;
        try { parsed = parsePropertyInput(control, raw, value); } catch (error) { throw new Error(`${component.tag}.${property.name}: ${error.message}`); }
        assert.deepEqual(parsed, value, `${component.tag}.${property.name}`);
      }
      count++;
    }
  }
  assert.ok(count >= 1200);
});

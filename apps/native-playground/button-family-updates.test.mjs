// Gate-7 R1-04: the button family supports retained Laboratory property updates; the generated contract stays equal to the
// source attribute types and the native support policy (regenerate with work/d4-lab/r104/gen.py if this fails).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nativePropertyUpdate, supportsRetainedUpdateTag, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { BUTTON_FAMILY_UPDATE_CONTRACT, BUTTON_FAMILY_UPDATE_PROPERTIES } from './button-family-updates.js';

const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
const catalog = json('../../packages/native-compiler/generated/catalog.json');
const components = Array.isArray(catalog.components ?? catalog) ? (catalog.components ?? catalog) : Object.values(catalog.components ?? catalog);
const cem = json('../../packages/core/custom-elements.json');
const attributes = tag => cem.modules.flatMap(m => m.declarations ?? []).find(d => d.tagName === tag)?.attributes ?? [];
const TAGS = ['md-button', 'md-button-group', 'md-fab', 'md-fab-menu', 'md-fab-menu-item', 'md-icon-button', 'md-segmented-button', 'md-segmented-button-set', 'md-split-button'];
const sample = spec => spec.type === 'boolean' ? true : spec.type === 'string' ? 'x' : spec.type === 'enum' ? spec.options.at(-1) : spec.options ? spec.options.at(-1) : 1;

test('every button-family tag accepts retained updates on iOS and Android', () => {
  for (const tag of TAGS) {
    assert.ok(supportsRetainedUpdateTag(tag), tag);
    const component = components.find(c => c.tag === tag);
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), `${tag} ${platform}`);
  }
});

test('the generated contract equals the native support policy and the source attribute types', () => {
  for (const tag of TAGS) {
    const component = components.find(c => c.tag === tag);
    assert.deepEqual([...BUTTON_FAMILY_UPDATE_PROPERTIES[tag]].sort(), [...component.support.ios.properties].sort(), tag);
    const types = Object.fromEntries(attributes(tag).map(a => [a.fieldName ?? a.name, a.type?.text ?? '']));
    for (const [name, spec] of Object.entries(BUTTON_FAMILY_UPDATE_CONTRACT[tag])) {
      const text = types[name]; assert.ok(text !== undefined, `${tag}.${name} is a source attribute`);
      if (spec.type === 'enum') for (const option of spec.options) assert.ok(text.includes(`'${option}'`), `${tag}.${name} ${option}`);
      else if (spec.type === 'boolean') assert.equal(text, 'boolean', `${tag}.${name}`);
    }
  }
});

test('valid values pass; wrong types, unknown keys and out-of-set values are rejected', () => {
  for (const tag of TAGS) {
    for (const [name, spec] of Object.entries(BUTTON_FAMILY_UPDATE_CONTRACT[tag])) {
      assert.deepEqual(nativePropertyUpdate(tag, { [name]: sample(spec) }), { command: 'update', properties: { [name]: sample(spec) } }, `${tag}.${name}`);
      const wrong = spec.type === 'boolean' ? 'yes' : spec.type === 'string' ? 1 : spec.type === 'enum' ? 'not-a-member' : spec.options ? 7 : 'x';
      assert.throws(() => nativePropertyUpdate(tag, { [name]: wrong }), { code: 'INVALID_PROPERTY_UPDATE' }, `${tag}.${name} rejects ${wrong}`);
      if (spec.nullable) assert.ok(nativePropertyUpdate(tag, { [name]: null }), `${tag}.${name} null`);
      else assert.throws(() => nativePropertyUpdate(tag, { [name]: null }), { code: 'INVALID_PROPERTY_UPDATE' }, `${tag}.${name} rejects null`);
    }
    assert.throws(() => nativePropertyUpdate(tag, { notAProperty: true }), { code: 'INVALID_PROPERTY_UPDATE' }, tag);
    const all = Object.fromEntries(Object.entries(BUTTON_FAMILY_UPDATE_CONTRACT[tag]).map(([k, s]) => [k, sample(s)]));
    assert.deepEqual(nativePropertyUpdate(tag, all).properties, all, `${tag}: every declared property in one patch`);
  }
});

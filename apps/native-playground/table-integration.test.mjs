import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TABLE_APPEARANCE_TAGS, TABLE_APPEARANCE_KEYS, TABLE_APPEARANCES, TABLE_UPDATE_PROPERTIES, TABLE_PROPERTY_TYPES, TABLE_METHODS, validTableUpdate,
  tableMethodArguments, tableMethodValue, nativeTableMethod } from './table-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodCommand, nativeMethodSupported, nativeMethodValue } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// The md-table family in the Laboratory: eight typed hook profiles (52 source custom properties), retained updates of the
// eleven tags with the source types, the methods with results, released policies and compiled-example sources.
const ir = async tag => JSON.parse(await readFile(new URL(`../../packages/native-compiler/generated/ir/${tag}.json`, import.meta.url), 'utf8'));
const TAGS = ['md-table', 'md-table-container', 'md-table-head', 'md-table-body', 'md-table-foot', 'md-table-row', 'md-table-cell', 'md-table-toolbar', 'md-table-sort-label',
  'md-table-pagination', 'md-table-expand-toggle'];
const sample = { color: '#12345680', length: '12px', opacity: '0.5', duration: '0.25s', corners: '12px 4px / 6px 2px', template: '2fr repeat(2, minmax(96px, 1fr))', angle: '0.25turn',
  display: 'none', shadow: '0px 1px 3px rgba(0, 0, 0, 0.3), inset 0 4px 8px 3px #00000026' };

test('typed hooks cover exactly the 52 source custom properties of the eight hooked tags, in the released policies', async () => {
  let total = 0;
  for (const tag of TAGS) {
    const r = ir(tag), d = await r, names = [...new Set((d.cssProperties ?? []).map(p => p.name))].sort();
    const profile = TABLE_APPEARANCES[tag];
    assert.deepEqual(profile ? profile.fields.map(f => f.cssProperty).sort() : [], names, `${tag} hooks`);
    total += names.length;
    for (const platform of ['ios', 'android']) {
      const policy = d.support?.[platform];
      assert.ok(policy, `${tag} ${platform} policy`);
      assert.deepEqual(policy.properties, d.properties.map(p => p.name), `${tag} ${platform} properties`);
      assert.deepEqual(policy.methods, d.methods.map(m => m.name), `${tag} ${platform} methods`);
      assert.deepEqual(policy.unsupportedProperties ?? [], [], `${tag} ${platform} unsupported properties`);
      assert.deepEqual(policy.unsupportedMethods ?? [], [], `${tag} ${platform} unsupported methods`);
      if (profile) assert.deepEqual(policy.appearance.fields, profile.fields.map(f => f.name), `${tag} ${platform} appearance fields`);
    }
  }
  assert.equal(total, 52);
  assert.deepEqual(Object.keys(TABLE_APPEARANCE_KEYS).sort(), [...TABLE_APPEARANCE_TAGS].sort());
});

test('every hook kind roundtrips input text, CSS and native literals; the registry, theme options and render options take them', () => {
  for (const tag of TABLE_APPEARANCE_TAGS) {
    const p = TABLE_APPEARANCES[tag], entry = componentAppearance(tag);
    assert.equal(entry.key, TABLE_APPEARANCE_KEYS[tag]);
    assert.equal(entry.groups.flatMap(([, names]) => names).sort().join(), p.fields.map(f => f.name).sort().join(), `${tag} groups cover every field once`);
    const values = Object.fromEntries(p.fields.map(f => [f.name, p.parseInput(f.name, sample[f.kind])]));
    const css = p.css(values);
    assert.equal(Object.keys(css).length, p.fields.length, `${tag} CSS`);
    for (const f of p.fields) {
      assert.deepEqual(p.parseInput(f.name, p.formatInput(f.name, values[f.name])), values[f.name], `${tag}.${f.name} roundtrip`);
      for (const platform of ['swift', 'kotlin']) assert.equal(typeof p.nativeValue(f.name, values[f.name], platform), 'string', `${tag}.${f.name} ${platform} literal`);
    }
    const options = componentAppearanceOptions({ selected: { tag }, [`${entry.key}Defaults`]: values, [entry.key]: {} });
    assert.deepEqual(nativeThemeOptions(options)[`${entry.key}Defaults`], p.normalize(values));
  }
  const t = TABLE_APPEARANCES['md-table'], cell = TABLE_APPEARANCES['md-table-cell'], toggle = TABLE_APPEARANCES['md-table-expand-toggle'];
  assert.equal(t.css({ columnsTemplate: ' 2fr 1fr ' })['--md-table-columns-template'], '2fr 1fr');
  assert.equal(t.nativeValue('rowHeightStandard', 64, 'kotlin'), '64.0');
  assert.equal(t.nativeValue('headBackground', '#FDE7F3', 'swift'), '"#FDE7F3"');
  assert.equal(toggle.parseInput('rotation', '0.25turn'), 90);
  assert.equal(toggle.css({ rotation: -45 })['--md-table-expand-toggle-rotation'], '-45deg');
  assert.equal(cell.css({ stickyTransition: 200, pinDisplay: 'inline-flex' })['--md-table-cell-sticky-transition'], '200ms');
  for (const [profile, value] of [[t, { columnsTemplate: 'a; b' }], [t, { rowHeightStandard: -1 }], [cell, { pinDisplay: 'block' }], [toggle, { rotation: Infinity }], [t, { bogus: 1 }]])
    assert.throws(() => profile.normalize(value), /appearance|must|plain object/i);
  assert.throws(() => nativeThemeOptions({ tableAppearance: { headBackground: 'pink' } }));
});

test('retained updates: every source property of the eleven tags with its source type', async () => {
  for (const tag of TAGS) {
    const d = await ir(tag);
    if (tag === 'md-table-head') { assert.equal(TABLE_UPDATE_PROPERTIES[tag], undefined); continue; }
    assert.deepEqual([...TABLE_UPDATE_PROPERTIES[tag]].sort(), d.properties.map(p => p.name).sort(), `${tag} updatable properties`);
    const component = { tag, support: { ios: d.support.ios, android: d.support.android } };
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), `${tag} ${platform} retained updates`);
  }
  assert.deepEqual(nativePropertyUpdate('md-table', { density: 'compact', selection: 'multiple', columns: 3 }), { command: 'update', properties: { density: 'compact', selection: 'multiple', columns: 3 } });
  assert.ok(validTableUpdate('md-table', 'density', -2) && validTableUpdate('md-table-cell', 'scope', '') && validTableUpdate('md-table-container', 'elevation', 5));
  for (const [tag, props] of [['md-table', { density: 'tiny' }], ['md-table', { sortOrder: 'up' }], ['md-table-cell', { colSpan: '2' }], ['md-table-container', { elevation: 6 }],
    ['md-table-row', { rowgroup: 'side' }], ['md-table-pagination', { page: '1' }], ['md-table-sort-label', { order: 'up' }], ['md-table-toolbar', { density: 1 }], ['md-table', { bogus: 1 }]])
    assert.throws(() => nativePropertyUpdate(tag, props), /Invalid|Only declared/, `${tag} ${JSON.stringify(props)}`);
  assert.throws(() => nativePropertyUpdate('md-table-head', { presentational: true }));
  assert.deepEqual(Object.keys(TABLE_PROPERTY_TYPES).length, 10);
});

test('methods with results: wire commands, argument validation and result values', async () => {
  for (const [tag, methods] of Object.entries(TABLE_METHODS)) {
    const d = await ir(tag);
    assert.deepEqual([...methods].sort(), d.methods.map(m => m.name).sort(), `${tag} methods`);
    for (const m of methods) for (const platform of ['ios', 'android']) assert.ok(nativeMethodSupported(tag, m, d.support[platform]), `${tag}.${m} ${platform}`);
  }
  assert.deepEqual(nativeMethodCommand('md-table', 'pinColumn', [0, 'start']), { command: 'method', method: 'pinColumn', arguments: [0, 'start'] });
  assert.deepEqual(nativeMethodCommand('md-table', 'setSort', ['name', 'desc']), { command: 'method', method: 'setSort', arguments: ['name', 'desc'] });
  assert.deepEqual(nativeMethodCommand('md-table-row', 'toggle', []), { command: 'method', method: 'toggle', arguments: [] });
  assert.deepEqual(nativeMethodCommand('md-table-pagination', 'setRowsPerPage', [25]), { command: 'method', method: 'setRowsPerPage', arguments: [25] });
  for (const [tag, m, args] of [['md-table', 'pinColumn', [-1, 'start']], ['md-table', 'pinColumn', [0, 'left']], ['md-table', 'setColumnVisibility', [1, 'no']], ['md-table', 'setSort', ['name']],
    ['md-table', 'getSelection', [1]], ['md-table-pagination', 'goToPage', ['2']], ['md-table-pagination', 'setRowsPerPage', [0]], ['md-table-row', 'toggle', [true]]])
    assert.throws(() => tableMethodArguments(tag, m, args), /requires/, `${tag}.${m}(${JSON.stringify(args)})`);
  assert.ok(!nativeTableMethod('md-table-cell', 'toggle') && !nativeTableMethod('md-table', 'toggle'));
  // Table results travel as { awcTableResult } (a bare null stays an invalid result for every other component).
  const selection = { count: 2, total: 3, values: ['a', 'b'], all: false, indeterminate: true }, wrap = awcTableResult => ({ awcTableResult });
  assert.deepEqual(nativeMethodValue(wrap(selection)), selection);
  assert.equal(nativeMethodValue(wrap(null)), null);
  assert.equal(nativeMethodValue(wrap('start')), 'start');
  assert.equal(nativeMethodValue(wrap(false)), false);
  assert.equal(nativeMethodValue(false), false);
  for (const bad of [null, selection, wrap({ ...selection, count: 1 }), wrap({ ...selection, extra: 1 }), wrap({ ...selection, values: [1, 2] }), wrap('middle'), { awcTableResult: null, extra: 1 }])
    assert.throws(() => nativeMethodValue(bad), /invalid method result/, JSON.stringify(bad));
  assert.equal(tableMethodValue({ count: 0 }), undefined);
});

test('copyable native examples for every table method, on both platforms', async () => {
  for (const [tag, methods] of Object.entries(TABLE_METHODS)) {
    const d = await ir(tag);
    for (const platform of ['swift', 'android']) {
      const support = { ios: d.support.ios, android: d.support.android };
      for (const m of methods) {
        const example = nativeApiExample({ tag, support }, 'method', m, platform);
        assert.equal(example.status, 'supported', `${tag}.${m} ${platform}`);
        assert.match(example.code, platform === 'swift' ? /import AWCUI[\s\S]*awcTable(Pagination)?Controller\(/ : /AWCTableControllerScope\(/, `${tag}.${m} ${platform} controller`);
        assert.match(example.code, new RegExp(m === 'toggle' ? 'toggleRow' : m), `${tag}.${m} ${platform} call`);
      }
    }
  }
});

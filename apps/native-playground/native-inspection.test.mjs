import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNativeInspection } from './native-inspection.mjs';

const node = { id: 'component', name: 'md-button', bounds: { x: 102.25, y: 24, width: 115.5, height: 56 } };
const inspection = (platform = 'macos') => ({ version: 1, unit: platform === 'android' ? 'dp' : 'pt',
  source: platform === 'android' ? 'Compose layout' : 'SwiftUI layout', nodes: [structuredClone(node)] });
const invalid = error => error.code === 'INVALID_LIVE_FRAME';

for (const platform of ['macos', 'android']) {
  test(`${platform} preserves fractional native geometry and strips unrelated host fields`, () => {
    const value = inspection(platform);
    value.privateHostField = 'not public';
    value.nodes[0].bounds.privateHostField = 1;
    value.nodes[0].privateHostField = 'not public';
    assert.deepEqual(validateNativeInspection(value, platform), inspection(platform));
    assert.notEqual(validateNativeInspection(value, platform).nodes[0].bounds, value.nodes[0].bounds);
  });

  test(`${platform} permits measured overflow, empty nodes and legacy hosts without inventing measurements`, () => {
    assert.equal(validateNativeInspection(undefined, platform), undefined);
    const value = inspection(platform);
    value.nodes = [];
    assert.deepEqual(validateNativeInspection(value, platform).nodes, []);
    value.nodes = [{ ...node, bounds: { x: -8, y: -4, width: 700, height: 300 } }];
    assert.deepEqual(validateNativeInspection(value, platform).nodes, value.nodes);
  });

  test(`${platform} forwards actual native metrics and part hierarchy without supplying missing styles`, () => {
    const value = inspection(platform);
    value.nodes[0].metrics = {
      padding: [0, 24, 0, 24], margin: [0, 0, 0, 0], border: [0, 0, 0, 0],
      gap: { row: 0, column: 8 },
      typography: { size: 16, lineHeight: 24, weight: 500, spacing: 0.15, family: 'Roboto',
        unit: platform === 'android' ? 'sp' : 'pt' },
      display: platform === 'android' ? 'Row' : 'HStack', direction: 'rtl',
    };
    value.nodes.push({ id: 'component.label', name: 'Label', parentId: 'component',
      bounds: { x: 126.25, y: 40, width: 67.5, height: 24 } });
    const expected = structuredClone(value);
    value.nodes[0].metrics.privateHostField = 'stripped';
    value.nodes[0].metrics.typography.privateHostField = 'stripped';
    assert.deepEqual(validateNativeInspection(value, platform), expected);
    assert.equal(Object.hasOwn(validateNativeInspection(value, platform).nodes[1], 'metrics'), false);
    value.nodes[1].metrics = { direction: 'rtl' };
    assert.deepEqual(validateNativeInspection(value, platform).nodes[1].metrics, { direction: 'rtl' });
  });

  test(`${platform} preserves measured offscreen geometry independently of bitmap dimensions`, () => {
    const value = inspection(platform);
    value.nodes[0].name = 'md-divider';
    value.nodes.push({ id: 'component.divider', name: 'md-divider ::part(divider)', parentId: 'component',
      bounds: { x: -32766.5, y: 20000.25, width: 65533, height: 0 },
      metrics: { margin: [20000.25, -32766.5, 0, -32766.5], padding: [0, 0, 0, 0] } });
    assert.deepEqual(validateNativeInspection(value, platform), value);
    for (const huge of [Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, Infinity]) {
      const invalidValue = structuredClone(value);
      invalidValue.nodes[1].bounds.x = huge;
      assert.throws(() => validateNativeInspection(invalidValue, platform), invalid);
      invalidValue.nodes[1].bounds.x = 0;
      invalidValue.nodes[1].metrics.margin[0] = huge;
      assert.throws(() => validateNativeInspection(invalidValue, platform), invalid);
    }
  });

  test(`${platform} rejects malformed styles and invalid part relationships`, () => {
    for (const metrics of [
      null, { padding: [0, 24] }, { padding: [0, -1, 0, 0] },
      { margin: [0, Infinity, 0, 0] }, { border: [0, 0, 0, NaN] },
      { gap: { row: 0 } }, { gap: { row: 0, column: -8 } },
      { typography: { size: 16 } }, { direction: 'auto' }, { display: 'x'.repeat(65) },
      { typography: { size: 16, lineHeight: 24, weight: 500, spacing: 0, family: 'Roboto',
        unit: platform === 'android' ? 'pt' : 'sp' } },
    ]) {
      const value = inspection(platform);
      value.nodes[0].metrics = metrics;
      assert.throws(() => validateNativeInspection(value, platform), invalid);
    }
    for (const parentId of ['missing', 'component', '']) {
      const value = inspection(platform);
      value.nodes[0].parentId = parentId;
      assert.throws(() => validateNativeInspection(value, platform), invalid);
    }
    const cycle = inspection(platform);
    cycle.nodes[0].parentId = 'component.label';
    cycle.nodes.push({ ...node, id: 'component.label', parentId: 'component' });
    assert.throws(() => validateNativeInspection(cycle, platform), invalid);
  });

  test(`${platform} rejects malformed measurements, mismatched units, and unbounded payloads`, () => {
    for (const mutate of [
      value => { value.version = 2; },
      value => { value.unit = platform === 'android' ? 'pt' : 'dp'; },
      value => { value.source = 'Browser CSS'; },
      value => { value.nodes = Array(129).fill(node); },
      value => { value.nodes.push(structuredClone(node)); },
      value => { value.nodes[0].name = 'x'.repeat(257); },
      value => { value.nodes[0].id = ''; },
      value => { value.nodes[0].bounds.x = Infinity; },
      value => { value.nodes[0].bounds.y = Number.MAX_SAFE_INTEGER + 1; },
      value => { value.nodes[0].bounds.width = -1; },
      value => { value.nodes[0].bounds.height = NaN; },
      value => { delete value.nodes[0].bounds.x; },
    ]) {
      const value = inspection(platform); mutate(value);
      assert.throws(() => validateNativeInspection(value, platform), invalid);
    }
    for (const value of [null, [], {}, 'metrics']) assert.throws(() => validateNativeInspection(value, platform), invalid);
  });
}

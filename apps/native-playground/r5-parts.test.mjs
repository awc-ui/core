import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHART_PARTS } from './chart-appearance.js';
import { ORGCHART_PARTS } from './orgchart-appearance.js';
import { TABLE_PARTS } from './table-appearance.js';
import { nativeApiExample } from './native-api-examples.js';

// gate-7 r5 (R5-06 / R5-07): every ::part() of the charts, the org chart and the table family is a declared native visual part
// with a Swift and a Compose example through its typed part appearance.
const ios = JSON.parse(readFileSync(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url))).components;
const android = JSON.parse(readFileSync(new URL('../../packages/native-android/support.json', import.meta.url))).components;
const all = { ...CHART_PARTS, 'md-organization-chart': ORGCHART_PARTS, ...TABLE_PARTS };
for (const [tag, parts] of Object.entries(all)) {
  test(`${tag}: visual parts declared on both platforms`, () => {
    assert.deepEqual(ios[tag].visualParts, [...parts]);
    assert.deepEqual(android[tag].visualParts, [...parts]);
  });
  test(`${tag}: a typed part example per part`, () => {
    for (const part of parts) for (const platform of ['swift', 'android']) {
      const component = { tag, support: { ios: ios[tag], android: android[tag] } };
      const result = nativeApiExample(component, 'cssPart', part, platform);
      assert.equal(result.status, 'native-equivalent', `${tag} ${part} ${platform}`);
      assert.match(result.code, platform === 'swift' ? /PartAppearance\(\./ : /PartAppearanceScope\(/, `${tag} ${part} ${platform}`);
    }
  });
}

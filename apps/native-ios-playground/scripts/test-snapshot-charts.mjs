import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SwiftUI snapshot renderer (AWCSnapshots --request): the typed chart hooks of a Laboratory request reach the dedicated
// chart views (defaults first, local values win). Usage: node test-snapshot-charts.mjs <AWCSnapshots> <png.mjs>
const [binary = fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCSnapshots', import.meta.url)), pngModule = fileURLToPath(new URL('../../../tools/ax/png.mjs', import.meta.url))] = process.argv.slice(2);
const { decodePNG } = await import(pngModule);
const dir = mkdtempSync(path.join(tmpdir(), 'awc-chart-snapshot-'));
let checks = 0, serial = 0;
function render(request) {
  const input = path.join(dir, `r${++serial}.json`), output = path.join(dir, `r${serial}.png`);
  writeFileSync(input, JSON.stringify({ dark: false, width: 640, ...request }));
  const r = spawnSync(binary, ['--request', input, '--output', output], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, `${request.tag}: ${r.stderr}`);
  return decodePNG(readFileSync(output));
}
function count(image, hex, tol = 12) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); let n = 0;
  for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3] > 200 && Math.abs(image.data[i] - r) <= tol && Math.abs(image.data[i + 1] - g) <= tol && Math.abs(image.data[i + 2] - b) <= tol) n++;
  return n;
}
const check = (value, message) => { checks++; assert.ok(value, message); };
const series = [{ label: 'Revenue', data: [12, 18, 15, 22, 28, 26] }], xAxis = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };
const cases = [
  ['md-line-chart', { label: 'Revenue', series, xAxis, noAnimation: true }, 'lineChartAppearance', { background: '#FFF3E0' }, '#FFF3E0', 20000],
  ['md-bar-chart', { label: 'Revenue', series, xAxis, noAnimation: true }, 'barChartAppearance', { background: '#F1F8E9' }, '#F1F8E9', 20000],
  ['md-pie-chart', { label: 'Traffic', data: [{ label: 'Search', value: 42 }, { label: 'Direct', value: 26 }], noAnimation: true }, 'pieChartAppearance', { background: '#E3F2FD' }, '#E3F2FD', 20000],
];
for (const [tag, properties, key, hooks, hex, min] of cases) {
  const plain = count(render({ tag, properties }), hex);
  const styled = count(render({ tag, properties, [key]: hooks }), hex);
  check(plain < min / 4 && styled >= min, `${tag}: ${key} ${JSON.stringify(hooks)} → ${hex} pixels ${plain} → ${styled}`);
  const local = count(render({ tag, properties, [`${key}Defaults`]: { ...hooks, [Object.keys(hooks)[0]]: '#00838F' }, [key]: hooks }), hex);
  check(local >= min, `${tag}: the local ${key} wins over its defaults (${local})`);
  const defaults = count(render({ tag, properties, [`${key}Defaults`]: hooks }), hex);
  check(defaults >= min, `${tag}: ${key}Defaults apply alone (${defaults})`);
}
console.log(`chart snapshot renderer: ${checks} checks passed`);

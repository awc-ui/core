import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SwiftUI snapshot renderer (AWCSnapshots --request): the typed md-slider / md-rating hooks of a Laboratory request reach
// the dedicated slider / rating views (defaults first, local values win). Usage: node test-snapshot-sr.mjs <AWCSnapshots> <png.mjs>
const [binary = fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCSnapshots', import.meta.url)), pngModule = fileURLToPath(new URL('../../../tools/ax/png.mjs', import.meta.url))] = process.argv.slice(2);
const { decodePNG } = await import(pngModule);
const dir = mkdtempSync(path.join(tmpdir(), 'awc-sr-snapshot-'));
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
const cases = [
  ['md-slider', { value: 30, sliderAriaLabel: 'Volume' }, 'sliderAppearance', { activeColor: '#C62828', trackHeight: 24 }, '#C62828', 1500],
  ['md-rating', { value: 3, ratingLabel: 'Rating' }, 'ratingAppearance', { activeColor: '#FFB300', itemSize: 40 }, '#FFB300', 800],
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
console.log(`sr snapshot renderer: ${checks} checks passed`);

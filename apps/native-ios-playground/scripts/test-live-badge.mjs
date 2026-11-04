import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const binary = process.env.AWC_NATIVE_LIVE_RENDERER ??
  fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview', import.meta.url));
const requests = [
  {properties: {variant: 'large', value: '12', shape: 'square'}},
  {properties: {variant: 'large', value: '12', shape: 'square'},
    badgeAppearanceDefaults: {containerColor: '#123456', largeHeight: 24, largePadding: [2, 8, 3, 9]},
    badgeAppearance: {containerColor: '#654321', offsetX: {points: 3, fraction: 0}, offsetY: {points: 5, fraction: 0}}},
  {properties: {variant: 'large', value: '', icon: 'star'}, slots: {icon: ''}},
  {properties: {variant: 'large', value: '', icon: 'star'}, slots: {icon: {kind: 'symbol', value: 'favorite'}},
    badgeAppearance: {iconSize: 20}},
  {properties: {variant: 'small', value: '', shape: 'square'}, badgeAppearance: {smallSize: 10}},
];
const frames = requests.map((request, index) => {
  const input = JSON.stringify({id: index + 1, command: 'configure', tag: 'md-badge', width: 640, dark: false, ...request}) + '\n';
  const result = spawnSync(binary, ['--stdio'], {input, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
});
let checks = 0;
const check = (value, message) => { checks++; assert.ok(value, message); };
const root = frame => frame.inspection.nodes.find(node => node.id === 'component');
const near = (actual, expected) => Math.abs(actual - expected) < 0.8;
for (const frame of frames) check(!frame.error && frame.logicalHeight === 112, 'Badge uses a real 48pt notification parent plus 32pt live padding.');
const original = root(frames[0]);
check(near(original.bounds.x + original.bounds.width / 2, 344) && near(original.bounds.y + original.bounds.height / 2, 32),
  'Default square anchor resolves against the actual parent top-right, not a second synthetic offset.');
const styled = root(frames[1]);
check(styled.metrics.padding.join(',') === '2,8,3,9' && near(styled.bounds.height, 24), 'Inherited height and four-sided padding reach the real Badge renderer.');
check(near(styled.bounds.x + styled.bounds.width, 347) && near(styled.bounds.y, 37), 'Point/fraction offsets decode and apply once.');
check(frames[1].png !== frames[0].png, 'Typed appearance changes the actual native capture.');
check(frames[2].inspection.nodes.some(node => node.id.includes('.slot.icon.')), 'Explicit empty icon text retains an authored native slot.');
const symbol = frames[3].inspection.nodes.find(node => node.id.includes('.slot.icon.'));
check(symbol && near(symbol.bounds.width, 20) && near(symbol.bounds.height, 20), 'Typed Material Symbol receives the resolved icon size.');
check(near(root(frames[4]).bounds.width, 10) && near(root(frames[4]).bounds.height, 10), 'Small-size appearance reaches the anchored badge.');
console.log(`Passed ${checks} live SwiftUI Badge context, appearance, slot and geometry checks.`);

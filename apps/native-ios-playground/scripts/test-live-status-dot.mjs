import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Actual AppKit/SwiftUI capture, not an inferred browser measurement.
const binary = process.env.AWC_NATIVE_LIVE_RENDERER ??
  fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview', import.meta.url));
const requests = [
  { properties: { state: 'online', label: 'Available' } },
  { properties: { state: 'online', label: 'Available', inline: true } },
  { properties: { state: 'online', label: 'Available' }, direction: 'rtl' },
  { properties: { state: 'invisible', live: true, label: 'Unavailable' },
    statusDotAppearanceDefaults: { size: 18, pulseDuration: 1.6, insetEnd: { fraction: 0.25 }, insetBlockEnd: { points: 3 } },
    statusDotAppearance: { color: '#12345680', outlineColor: '#ABCDEF00', pulseDuration: 0 } },
  { properties: { state: 'online' }, statusDotAppearance: { size: 0, outlineWidth: 0 } },
  { properties: { state: 'online', hidden: true } },
  { properties: { state: 'online', inline: true, hidden: true } },
];
const frames = requests.map((request, index) => {
  const result = spawnSync(binary, ['--stdio'], {
    input: JSON.stringify({ id: index + 1, command: 'configure', tag: 'md-status-dot', width: 640, dark: false, ...request }) + '\n',
    encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  const frame = JSON.parse(result.stdout.trim());
  assert.equal(frame.error, undefined, JSON.stringify(frame.error));
  return frame;
});
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const root = frame => frame.inspection?.nodes.find(node => node.id === 'component');
const near = (actual, expected) => Math.abs(actual - expected) < 0.05;
for (const frame of frames) check(frame.logicalHeight === 112, 'The actual 48pt parent and 32pt live padding determine capture height.');
check(near(root(frames[0])?.bounds.width, 12) && near(root(frames[0])?.bounds.height, 12), 'Default native dot measures12pt, excluding outline and parent.');
check(near(root(frames[0])?.bounds.x, 334) && near(root(frames[0])?.bounds.y, 70), 'Anchored rect dot resolves against the48pt parent.');
check(near(root(frames[1])?.bounds.x, 344) && near(root(frames[1])?.bounds.y, 50), 'Inline dot participates in centered HStack with12pt gap.');
check(near(root(frames[2])?.bounds.x, 294), 'RTL reflects the logical-end anchor once.');
check(near(root(frames[3])?.bounds.width, 18) && near(root(frames[3])?.bounds.x, 314) && near(root(frames[3])?.bounds.y, 59), 'Defaults and local overrides preserve actual size and parent-relative insets.');
check(frames[3].png !== frames[0].png, 'RGBA styling changes the real capture.');
check(root(frames[4])?.bounds.width === 0 && root(frames[4])?.bounds.height === 0, 'An intentional zero-size dot remains a truthful zero measurement.');
check(!frames[5].inspection && !frames[6].inspection, 'Hidden dot never reports its notification anchor as component geometry.');
console.log(`Passed ${checks} live SwiftUI Status Dot context, appearance, zero-size and hidden-measurement checks.`);

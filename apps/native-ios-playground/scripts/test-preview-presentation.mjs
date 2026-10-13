import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createNativeLiveRenderer } from '../../native-playground/native-live.mjs';

// Real offscreen AppKit/SwiftUI interaction. Requires macOS WindowServer access.
// Build AWCLivePreview first; AWC_NATIVE_LIVE_RENDERER can select an isolated build.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const executable = process.env.AWC_NATIVE_LIVE_RENDERER || fileURLToPath(new URL('../.build/debug/AWCLivePreview', import.meta.url));
const renderer = createNativeLiveRenderer({ repoRoot, executable });
const create = (tag, properties = {}, extra = {}) => renderer.create({ tag, properties, dark: false, width: 640, ...extra });
const click = (frame, x, y) => renderer.input(frame.sessionId, { command: 'click', x, y });
const close = async frame => { renderer.close(frame.sessionId); await delay(75); };
const names = frame => frame.events.map(event => event.name);
const detail = (frame, name) => frame.events.find(event => event.name === name)?.detail;

try {
  for (const tag of ['md-dialog', 'md-bottom-sheet', 'md-side-sheet']) {
    const closed = await create(tag, { open: false });
    const opened = await click(closed, 320, 50);
    assert.deepEqual(names(opened), ['mdOpen'], `${tag}: real launcher emits mdOpen once`);
    assert.ok(opened.logicalHeight >= 640, `${tag}: overlay participates in captured surface`);
    assert.notEqual(opened.imageUrl, closed.imageUrl);
    const dismissed = await click(opened, 30, 340);
    assert.deepEqual(names(dismissed), ['mdCancel', 'mdClose'], `${tag}: captured scrim dismisses actual native state`);
    assert.ok(dismissed.logicalHeight < opened.logicalHeight);
    await close(closed);
  }
  const persistent = await create('md-dialog', { open: true, scrimDismissible: false });
  const ignored = await click(persistent, 30, 340);
  assert.deepEqual(names(ignored), []);
  assert.equal(ignored.logicalHeight, persistent.logicalHeight);
  await close(persistent);

  const options = [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }];
  for (const tag of ['md-select', 'md-autocomplete', 'md-multi-select']) {
    const opened = await create(tag, { open: true, filterable: true, showSelectAll: false, options, value: tag === 'md-multi-select' ? [] : '' });
    const chosen = await click(opened, 160, 174);
    assert.deepEqual(detail(chosen, 'mdChange'), tag === 'md-multi-select' ? ['london'] : 'london', `${tag}: clicking captured native row updates value`);
    if (tag === 'md-multi-select') {
      const done = await click(chosen, 550, 70);
      assert.deepEqual(names(done), ['mdClose'], 'Done remains visible and actionable inside the captured view');
    } else assert.ok(names(chosen).includes('mdClose'));
    await close(opened);
  }

  const date = await create('md-date-picker', { open: true, value: '2026-10-13', min: '2026-10-10', max: '2026-10-20' });
  assert.deepEqual(names(await click(date, 248, 264)), [], 'Out-of-range day is disabled');
  const selected = await click(date, 320, 340);
  const selectedDate = detail(selected, 'mdSelected')?.value;
  assert.match(selectedDate || '', /^2026-10-1[0-9]$/);
  assert.notEqual(selectedDate, '2026-10-13');
  const committedDate = await click(selected, 540, 515);
  assert.equal(detail(committedDate, 'mdChange')?.value, selectedDate);
  assert.ok(names(committedDate).includes('mdClose'));
  await close(date);

  const time = await create('md-time-picker', { open: true, value: '10:30' });
  const editedTime = await click(time, 139, 334);
  assert.equal(detail(editedTime, 'mdInput')?.value, '11:30');
  const committedTime = await click(editedTime, 540, 426);
  assert.equal(detail(committedTime, 'mdChange')?.hours, 11);
  assert.equal(detail(committedTime, 'mdChange')?.minutes, 30);
  await close(time);

  const color = await create('md-color-picker', { value: '#6750A4' });
  const changedColor = await click(color, 450, 78);
  assert.deepEqual(names(changedColor), ['mdInput', 'mdChange']);
  assert.match(detail(changedColor, 'mdChange')?.value || '', /^#[0-9A-F]{6}$/);
  assert.notEqual(detail(changedColor, 'mdChange')?.value, '#6750A4');
  assert.notEqual(changedColor.imageUrl, color.imageUrl);
  await close(color);

  const legacy = await create('md-button', {}, { text: 'Final label' });
  const slotted = await create('md-button', {}, { text: 'Ignored legacy label', slots: { '': 'Final label' } });
  assert.equal(slotted.imageUrl, legacy.imageUrl, 'Explicit default text slot wins over legacy Button text');
  await close(legacy); await close(slotted);
  const originalTabs = await create('md-tabs');
  const safeTabs = await create('md-tabs', {}, { slots: { '': 'Cannot replace structural tab children', 'actions': 'Cannot replace actions' } });
  assert.equal(safeTabs.imageUrl, originalTabs.imageUrl, 'Structural slot overrides preserve native fixtures');
  await close(originalTabs); await close(safeTabs);

  // Bypass JS validation to exercise the native request decoder and byte bounds.
  for (const slots of [{ '': '😀'.repeat(1025) }, { ['😀'.repeat(41)]: '' }, Object.fromEntries(Array.from({ length: 33 }, (_, i) => [String(i), ''])), Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), 'x'.repeat(4096)]))]) {
    const input = JSON.stringify({ id: 1, command: 'configure', tag: 'md-button', slots }) + '\n' + JSON.stringify({ id: 2, command: 'close' }) + '\n';
    const result = spawnSync(executable, ['--stdio'], { input, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout.split('\n')[0]).error, /Preview slot/);
  }
  console.log('SwiftUI preview checks passed: 3 overlay families, scrim policy, 3 option controls, bounded calendar, time, RGB input, safe text slots and direct native request limits.');
} finally { renderer.dispose(); }

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
  // Dialogs and sheets present in the preview's configured viewport through AWCModalScope. The web recipe's tonal
  // launcher sits under a closed modal and calls show(); it is inert while the modal is open.
  for (const tag of ['md-dialog', 'md-bottom-sheet', 'md-side-sheet']) {
    const closed = await create(tag, { open: false, ...(tag === 'md-side-sheet' ? { variant: 'modal' } : {}) }, { height: 480 });
    assert.equal(closed.logicalHeight, 480, `${tag}: the configured viewport is the captured surface`);
    const opened = await click(closed, 40, 44);
    await delay(600);
    const shown = await renderer.frame(closed.sessionId);
    assert.deepEqual([...names(opened), ...names(shown)], ['mdOpen'], `${tag}: real launcher emits mdOpen once`);
    assert.equal(shown.logicalHeight, 480, `${tag}: the modal presents inside the configured viewport`);
    assert.notEqual(shown.imageUrl, closed.imageUrl);
    const dismissed = await click(shown, 12, 340);
    await delay(600);
    const after = await renderer.frame(closed.sessionId);
    assert.deepEqual([...names(dismissed), ...names(after)], ['mdCancel', 'mdClose'], `${tag}: captured scrim dismisses actual native state`);
    assert.equal(after.logicalHeight, 480);
    await close(closed);
  }
  const persistent = await create('md-dialog', { open: true, scrimDismissible: false });
  await delay(500);
  const settled = await renderer.frame(persistent.sessionId);
  const ignored = await click(settled, 12, 200);
  await delay(400);
  const still = await renderer.frame(persistent.sessionId);
  assert.deepEqual([...names(ignored), ...names(still)].filter(name => name !== 'mdOpen'), [], 'A protected scrim does not dismiss');
  assert.equal(ignored.logicalHeight, persistent.logicalHeight);
  await close(persistent);

  const options = [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }];
  for (const tag of ['md-select', 'md-autocomplete', 'md-multi-select']) {
    const opened = await create(tag, { open: true, filterable: true, showSelectAll: false, options, value: tag === 'md-multi-select' ? [] : '' });
    // The first option row: below the filter header for the selects (y 174); md-autocomplete has no header, its first row follows the field.
    const box = (opened.inspection?.nodes ?? []).find(n => n.id?.endsWith('.container') && n.bounds)?.bounds;
    if (tag === 'md-autocomplete') assert.ok(box, 'md-autocomplete: the field container is inspected');
    const chosen = await click(opened, 160, tag === 'md-autocomplete' ? box.y + box.height + 24 : 174);
    assert.deepEqual(detail(chosen, 'mdChange'), tag === 'md-multi-select' ? ['london'] : 'london', `${tag}: clicking captured native row updates value`);
    if (tag === 'md-multi-select') {
      const done = await click(chosen, 550, 70);
      assert.deepEqual(names(done), ['mdClose'], 'Done remains visible and actionable inside the captured view');
    } else if (tag === 'md-autocomplete') {
      await delay(600);
      const after = await renderer.frame(opened.sessionId);
      assert.ok([...names(chosen), ...names(after)].includes('mdClose'), 'md-autocomplete: picking a row closes the suggestions');
    } else assert.ok(names(chosen).includes('mdClose'));
    await close(opened);
  }

  // The date picker's dialog (header, calendar grid, actions) needs more than the 240 px default capture height; like the
  // time and colour pickers it is created in a 640 px viewport. Targets below come from the inspected parts.
  const dpPart = (f, id) => (f.inspection?.nodes ?? []).find(n => n.id?.endsWith(`.${id}`) && n.bounds)?.bounds;
  const date = await create('md-date-picker', { open: true, value: '2026-10-13', min: '2026-10-10', max: '2026-10-20' }, { height: 640 });
  assert.equal(date.logicalHeight, 640, 'md-date-picker: the configured viewport is the captured surface');
  await delay(700);
  const dpShown = await renderer.frame(date.sessionId);
  const dpCentre = id => { const b = dpPart(dpShown, id); assert.ok(b, `md-date-picker: ${id} is inspected`); return [b.x + b.width / 2, b.y + b.height / 2]; };
  assert.deepEqual(names(await click(dpShown, ...dpCentre('day-2026-10-09'))), [], 'Out-of-range day is disabled');
  const selected = await click(dpShown, ...dpCentre('day-2026-10-15'));
  const selectedDate = detail(selected, 'mdSelected')?.value;
  assert.match(selectedDate || '', /^2026-10-1[0-9]$/);
  assert.notEqual(selectedDate, '2026-10-13');
  await delay(300);
  const okButton = dpPart(await renderer.frame(date.sessionId), 'ok-button');
  assert.ok(okButton, 'md-date-picker: the OK button is inspected');
  assert.ok(okButton.y + okButton.height <= date.logicalHeight && okButton.x + okButton.width <= date.logicalWidth, 'md-date-picker: the OK button lies inside the captured frame');
  const committedDate = await click(selected, okButton.x + okButton.width / 2, okButton.y + okButton.height / 2);
  assert.equal(detail(committedDate, 'mdChange')?.value, selectedDate);
  // mdClose follows the dialog's exit motion (as md-autocomplete, KNOWN-CAUSES row 15): read it from a later frame too.
  await delay(600);
  const afterDate = await renderer.frame(date.sessionId);
  assert.ok([...names(committedDate), ...names(afterDate)].includes('mdClose'), 'md-date-picker: committing closes the dialog');
  await close(date);

  // md-time-picker / md-color-picker have dedicated renderers (fi, 2026-11): the time picker's dialog presents in the overlay
  // viewport (as md-dialog) and the colour picker's panel sits 24 px in; targets come from the inspected parts.
  const part = (f, id) => (f.inspection?.nodes ?? []).find(n => n.id?.endsWith(`.${id}`) && n.bounds)?.bounds;
  const centre = b => [b.x + b.width / 2, b.y + b.height / 2];
  const time = await create('md-time-picker', { open: true, value: '10:30', variant: 'dial' }, { height: 640 });
  await delay(700);
  const timeShown = await renderer.frame(time.sessionId);
  const eleven = part(timeShown, 'dial-number-11');
  assert.ok(eleven, 'md-time-picker: the dial number 11 is inspected');
  const editedTime = await click(timeShown, ...centre(eleven));
  assert.equal(detail(editedTime, 'mdInput')?.value, '11:30');
  await delay(300);
  const confirm = part(await renderer.frame(time.sessionId), 'confirm-button');
  assert.ok(confirm, 'md-time-picker: the confirm button is inspected');
  const committedTime = await click(editedTime, ...centre(confirm));
  assert.equal(detail(committedTime, 'mdChange')?.hours, 11);
  assert.equal(detail(committedTime, 'mdChange')?.minutes, 30);
  await close(time);

  const color = await create('md-color-picker', { value: '#6750A4' }, { height: 640 });
  const plate = part(color, 'plate');
  assert.ok(plate, 'md-color-picker: the plate is inspected');
  const changedColor = await click(color, plate.x + plate.width * 0.8, plate.y + plate.height * 0.2);
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

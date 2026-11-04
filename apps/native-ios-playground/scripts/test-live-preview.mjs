import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createNativeLiveRenderer } from '../../native-playground/native-live.mjs';

// Runs the real AppKit/SwiftUI host. Requires macOS and access to WindowServer.
// Build first: swift build --package-path apps/native-ios-playground --product AWCLivePreview
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const renderer = createNativeLiveRenderer({repoRoot});
const selected = frame => frame.events.find(event => event.name === 'mdSelect')?.detail.selected;
const buttonRequest = properties => ({tag:'md-button',properties:{size:'md',variant:'filled',shape:'round',shapeMorph:true,ripple:false,icon:'',toggle:true,selected:false,...properties},dark:false,width:640});
const pointer = (sessionId, phase, x=320, y=50) => renderer.input(sessionId,{command:'pointer',phase,x,y});
const noEvents = (frame, message) => assert.deepEqual(frame.events,[],message);
const measuredComponent = (frame, tag) => {
  assert.equal(frame.inspection?.version, 1, 'The real host must publish versioned layout measurements.');
  assert.equal(frame.inspection.unit, 'pt');
  assert.equal(frame.inspection.source, 'SwiftUI layout');
  const node = frame.inspection.nodes.find(value => value.id === 'component');
  assert.equal(node?.name, tag, 'A new session must not retain the previous component measurement.');
  const bounds = node.bounds;
  assert.ok(Object.values(bounds).every(Number.isFinite));
  assert.ok(bounds.width > 0 && bounds.height > 0);
  assert.ok(bounds.x >= 32 && bounds.y >= 32, 'Component bounds start inside the host padding.');
  assert.ok(bounds.x + bounds.width <= frame.logicalWidth - 32 + .01, 'Root measurement excludes the right host padding.');
  assert.ok(bounds.y + bounds.height <= frame.logicalHeight - 32 + .01, 'Root measurement excludes the bottom host padding.');
  return bounds;
};
const assertToggle = (frame, expected, source = 'pointer') => {
  assert.deepEqual(frame.events.map(event=>event.name),['mdClick','mdChange'],'One native button release must emit exactly mdClick followed by mdChange.');
  assert.equal(frame.events[0].detail.toggle,true);
  assert.ok(frame.events.every(event => event.activation?.source === source), 'Native activation provenance follows the actual input path.');
  assert.equal(frame.events[0].detail.selected,expected,'mdClick must describe the next selected state.');
  assert.equal(frame.events[1].detail.selected,expected,'mdChange must report the committed selected state.');
};
try {
  assert.equal((await renderer.status()).available,true,'Build AWCLivePreview on macOS before running this check.');
  const initial = await renderer.create({tag:'md-chip',properties:{variant:'filter',selectable:true,selected:false,removable:false},dark:false,width:640});
  measuredComponent(initial, 'md-chip');
  const first = await renderer.input(initial.sessionId,{command:'click',x:320,y:50});
  measuredComponent(first, 'md-chip');
  assert.equal(selected(first),true,'A native click must select the Chip.');
  assert.notEqual(first.imageUrl,initial.imageUrl,'Native selection must change the rendered frame.');
  const idle = await renderer.frame(initial.sessionId);
  assert.equal(idle.events.length,0,'Polling must not duplicate events or activate the component.');
  const second = await renderer.input(initial.sessionId,{command:'click',x:320,y:50});
  assert.equal(selected(second),false,'Native state must persist and toggle back on the second click.');
  renderer.close(initial.sessionId);

  const field = await renderer.create({tag:'md-text-field',properties:{label:'Name',value:'',placeholder:'Type here',clearable:false,multiline:false},dark:false,width:640});
  const fieldBounds = measuredComponent(field, 'md-text-field');
  assert.equal(fieldBounds.x, 32);
  assert.equal(fieldBounds.width, 576, 'The full-width native field excludes both 32pt preview insets.');
  await renderer.input(field.sessionId,{command:'click',x:fieldBounds.x + 118,y:fieldBounds.y + fieldBounds.height / 2});
  const typed = await renderer.input(field.sessionId,{command:'text',text:'Salut, SwiftUI! șț'});
  assert.ok(typed.events.some(event=>event.name==='mdInput'&&event.detail==='Salut, SwiftUI! șț'),'Unicode text must reach the actual SwiftUI binding.');
  const deleted = await renderer.input(field.sessionId,{command:'key',key:'Backspace',modifiers:[]});
  assert.ok(deleted.events.some(event=>event.name==='mdInput'&&event.detail==='Salut, SwiftUI! ș'),'Backspace must edit native text state.');
  const submitted = await renderer.input(field.sessionId,{command:'key',key:'Enter',modifiers:[]});
  assert.ok(submitted.events.some(event=>event.name==='mdChange'&&event.detail==='Salut, SwiftUI! ș'),'Enter must submit through the native callback.');
  renderer.close(field.sessionId);

  const button = await renderer.create(buttonRequest({}));
  const buttonBounds = measuredComponent(button, 'md-button');
  assert.equal(buttonBounds.height, 56, 'The medium native button is measured, not the 120pt padded capture.');
  assert.ok(Math.abs(buttonBounds.x + buttonBounds.width / 2 - button.logicalWidth / 2) < .01, 'Native component coordinates include its centered position.');
  const pressStarted = performance.now();
  const down = await pointer(button.sessionId,'down');
  noEvents(down,'Pointer down must hold the native button without activating it.');
  const animationFrames = [button.imageUrl,down.imageUrl];
  const sampleTimes = [performance.now()-pressStarted];
  for(let index=0;index<5;index++) {
    await delay(20);
    const frame = await renderer.frame(button.sessionId);
    noEvents(frame,'Frame polling must leave the real native press held and emit no events.');
    animationFrames.push(frame.imageUrl);
    sampleTimes.push(performance.now()-pressStarted);
  }
  await delay(150);
  const held = await renderer.frame(button.sessionId);
  noEvents(held,'Holding past the press animation must not activate the button.');
  assert.notEqual(held.imageUrl,button.imageUrl,'The native pressed appearance must differ from the resting button.');
  animationFrames.push(held.imageUrl);
  const distinctFrames = new Set(animationFrames).size;
  // Ripple is disabled so differences come from the native button style. Respect an
  // explicitly reduced-motion test environment and do not make a stalled desktop a
  // timing failure: require interpolation only when we sampled within its 200ms window.
  const sampledDuringAnimation = sampleTimes.filter(time=>time<150).length>=3;
  if(process.env.AWC_NATIVE_REDUCED_MOTION!=='1'&&sampledDuringAnimation) {
    assert.ok(distinctFrames>=3,'A held native press must render an intermediate animation frame. Set AWC_NATIVE_REDUCED_MOTION=1 when macOS Reduce Motion is enabled.');
  }
  assertToggle(await pointer(button.sessionId,'up'),true);
  noEvents(await renderer.frame(button.sessionId),'Polling after release must not duplicate native events.');

  await pointer(button.sessionId,'down');
  noEvents(await pointer(button.sessionId,'cancel'),'Explicit pointer cancellation must not activate the native button.');
  await pointer(button.sessionId,'down');
  noEvents(await pointer(button.sessionId,'up',button.logicalWidth-5,button.logicalHeight-5),'Release inside the preview but outside the button must cancel its gesture.');
  await pointer(button.sessionId,'down');
  noEvents(await pointer(button.sessionId,'up',button.logicalWidth+10,50),'Release outside the preview must be normalized to cancellation.');
  await pointer(button.sessionId,'down');
  assertToggle(await pointer(button.sessionId,'up'),false);
  renderer.close(button.sessionId);

  const plain = await renderer.create(buttonRequest({toggle:false}));
  noEvents(await pointer(plain.sessionId,'down'),'A non-toggle button also waits for release.');
  const plainRelease = await pointer(plain.sessionId,'up');
  assert.deepEqual(plainRelease.events.map(event=>event.name),['mdClick'],'A non-toggle button emits mdClick once and no mdChange.');
  assert.equal(plainRelease.events[0].detail.toggle,false);
  renderer.close(plain.sessionId);

  for(const blocked of ['disabled','softDisabled','loading']) {
    const frame = await renderer.create(buttonRequest({[blocked]:true}));
    noEvents(await pointer(frame.sessionId,'down'),`${blocked} must suppress native press activation.`);
    noEvents(await pointer(frame.sessionId,'up'),`${blocked} must suppress release activation and toggle changes.`);
    noEvents(await renderer.input(frame.sessionId,{command:'click',x:320,y:50}),`${blocked} must also suppress legacy click activation.`);
    renderer.close(frame.sessionId);
  }

  const keyboard = await renderer.create(buttonRequest({groupTabindex:0}));
  noEvents(await renderer.input(keyboard.sessionId,{command:'key',key:'Tab',modifiers:[]}), 'Tab focuses the native button without activating it.');
  assertToggle(await renderer.input(keyboard.sessionId,{command:'key',key:'Enter',modifiers:[]}),true,'keyboard');
  assertToggle(await renderer.input(keyboard.sessionId,{command:'key',key:'Space',modifiers:[]}),false,'keyboard');
  renderer.close(keyboard.sessionId);

  const inspected = await renderer.create({
    ...buttonRequest({ icon: 'add', trailingIcon: 'close', loading: true }), direction: 'rtl', text: 'Measure',
    buttonAppearance: { fontSize: 22, fontWeight: 700, lineHeight: 38, letterSpacing: 1.5,
      paddingInline: 31, paddingBlock: 10, outlineWidth: 4, gap: 13, iconSize: 30, trailingIconSize: 26, loadingSize: 18 },
  });
  measuredComponent(inspected, 'md-button');
  const parts = Object.fromEntries(inspected.inspection.nodes.map(node => [node.id, node]));
  assert.deepEqual(parts.component.metrics.padding, [14, 31, 14, 31]);
  assert.deepEqual(parts.component.metrics.border, [4, 4, 4, 4]);
  assert.deepEqual(parts.component.metrics.gap, { row: 0, column: 13 });
  assert.equal(parts.component.metrics.direction, 'rtl');
  assert.deepEqual(parts.component.metrics.typography, {
    size: 22, lineHeight: 38, weight: 700, spacing: 1.5, family: 'Roboto', unit: 'pt',
  });
  assert.equal(parts['component.content'].parentId, 'component');
  for (const part of ['label', 'leading-icon', 'trailing-icon', 'loader']) {
    assert.equal(parts[`component.${part}`].parentId, 'component.content');
  }
  assert.equal(parts['component.leading-icon'].bounds.width, 30);
  assert.equal(parts['component.trailing-icon'].bounds.width, 26);
  assert.equal(parts['component.loader'].bounds.width, 18);
  assert.ok(parts['component.leading-icon'].bounds.x > parts['component.label'].bounds.x, 'RTL metadata follows the rendered part order.');
  const nextInspected = await renderer.frame(inspected.sessionId);
  assert.deepEqual(nextInspected.inspection, inspected.inspection, 'A new capture keeps the same measured layout while the native loader animates.');
  renderer.close(inspected.sessionId);

  const typedSlots = await renderer.create({
    ...buttonRequest({ loading: true }), text: 'Slots',
    slots: { 'leading-icon': { kind: 'symbol', value: 'favorite' }, 'trailing-icon': { kind: 'symbol', value: 'close' }, loader: { kind: 'progress' } },
    buttonAppearance: { iconSize: 38, trailingIconSize: 18, loadingSize: 10 },
  });
  const typedParts = Object.fromEntries(typedSlots.inspection.nodes.map(node => [node.id, node]));
  assert.equal(typedParts['component.leading-icon'].bounds.width, 38);
  assert.equal(typedParts['component.trailing-icon'].bounds.width, 18);
  assert.equal(typedParts['component.loader'].bounds.width, 24, 'A supplied progress component keeps its 24pt native geometry.');
  renderer.close(typedSlots.sessionId);

  const fullWidth = await renderer.create(buttonRequest({ fullWidth: true }));
  const fullWidthBounds = measuredComponent(fullWidth, 'md-button');
  assert.equal(fullWidthBounds.x, 32, 'Full-width button begins after the same inset as the Web canvas.');
  assert.equal(fullWidthBounds.width, 576, 'A 640pt live preview provides 576pt content width after two 32pt insets.');
  renderer.close(fullWidth.sessionId);

  const constrained = await renderer.create({ ...buttonRequest({ fullWidth: true }),
    buttonAppearance: { width: 80, minWidth: 0, maxWidth: 90, height: 30, minHeight: 0 } });
  const constrainedBounds = measuredComponent(constrained, 'md-button');
  assert.equal(constrainedBounds.width, 80, 'Explicit source width wins over fullWidth.');
  assert.equal(constrainedBounds.height, 30, 'Explicit border-box height wins once minHeight is lowered.');
  assertToggle(await renderer.input(constrained.sessionId, { command: 'click', x: constrainedBounds.x + 40, y: constrainedBounds.y + 15 }), true);
  renderer.close(constrained.sessionId);

  console.log(`Live SwiftUI check passed: native Chip toggling, persistent state, Unicode typing, deletion, submit; button held press (${distinctFrames} distinct frames), release, cancellation, disabled/soft-disabled/loading guards, Tab/Enter/Space forwarding, exact event delivery, and real native part/typography measurements.`);
} finally {
  renderer.dispose();
}

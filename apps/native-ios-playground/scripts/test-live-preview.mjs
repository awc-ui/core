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
const pointer = (sessionId, phase, x=80, y=50) => renderer.input(sessionId,{command:'pointer',phase,x,y});
const noEvents = (frame, message) => assert.deepEqual(frame.events,[],message);
const assertToggle = (frame, expected) => {
  assert.deepEqual(frame.events.map(event=>event.name),['mdClick','mdChange'],'One native button release must emit exactly mdClick followed by mdChange.');
  assert.equal(frame.events[0].detail.toggle,true);
  assert.equal(frame.events[0].detail.selected,expected,'mdClick must describe the next selected state.');
  assert.equal(frame.events[1].detail.selected,expected,'mdChange must report the committed selected state.');
};
try {
  assert.equal((await renderer.status()).available,true,'Build AWCLivePreview on macOS before running this check.');
  const initial = await renderer.create({tag:'md-chip',properties:{variant:'filter',selectable:true,selected:false,removable:false},dark:false,width:640});
  const first = await renderer.input(initial.sessionId,{command:'click',x:100,y:40});
  assert.equal(selected(first),true,'A native click must select the Chip.');
  assert.notEqual(first.imageUrl,initial.imageUrl,'Native selection must change the rendered frame.');
  const idle = await renderer.frame(initial.sessionId);
  assert.equal(idle.events.length,0,'Polling must not duplicate events or activate the component.');
  const second = await renderer.input(initial.sessionId,{command:'click',x:100,y:40});
  assert.equal(selected(second),false,'Native state must persist and toggle back on the second click.');
  renderer.close(initial.sessionId);

  const field = await renderer.create({tag:'md-text-field',properties:{label:'Name',value:'',placeholder:'Type here',clearable:false,multiline:false},dark:false,width:640});
  await renderer.input(field.sessionId,{command:'click',x:150,y:60});
  const typed = await renderer.input(field.sessionId,{command:'text',text:'Salut, SwiftUI! șț'});
  assert.ok(typed.events.some(event=>event.name==='mdInput'&&event.detail==='Salut, SwiftUI! șț'),'Unicode text must reach the actual SwiftUI binding.');
  const deleted = await renderer.input(field.sessionId,{command:'key',key:'Backspace',modifiers:[]});
  assert.ok(deleted.events.some(event=>event.name==='mdInput'&&event.detail==='Salut, SwiftUI! ș'),'Backspace must edit native text state.');
  const submitted = await renderer.input(field.sessionId,{command:'key',key:'Enter',modifiers:[]});
  assert.ok(submitted.events.some(event=>event.name==='mdChange'&&event.detail==='Salut, SwiftUI! ș'),'Enter must submit through the native callback.');
  renderer.close(field.sessionId);

  const button = await renderer.create(buttonRequest({}));
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
    noEvents(await renderer.input(frame.sessionId,{command:'click',x:80,y:50}),`${blocked} must also suppress legacy click activation.`);
    renderer.close(frame.sessionId);
  }
  console.log(`Live SwiftUI check passed: native Chip toggling, persistent state, Unicode typing, deletion, submit; button held press (${distinctFrames} distinct frames), release, cancellation, disabled/soft-disabled/loading guards, and exact event delivery.`);
} finally {
  renderer.dispose();
}

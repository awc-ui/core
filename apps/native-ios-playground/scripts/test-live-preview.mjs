import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createNativeLiveRenderer } from '../../native-playground/native-live.mjs';

// Runs the real AppKit/SwiftUI host. Requires macOS and access to WindowServer.
// Build first: swift build --package-path apps/native-ios-playground --product AWCLivePreview
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const renderer = createNativeLiveRenderer({repoRoot});
const selected = frame => frame.events.find(event => event.name === 'mdSelect')?.detail.selected;
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
  console.log('Live SwiftUI check passed: native Chip toggling, persistent state, Unicode typing, deletion, submit, and event delivery.');
} finally {
  renderer.dispose();
}

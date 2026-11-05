import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createNativeLiveRenderer } from '../../native-playground/native-live.mjs';
const renderer = createNativeLiveRenderer({ repoRoot: fileURLToPath(new URL('../../../', import.meta.url)) });
const request = (properties = {}, extra = {}) => ({ tag:'md-icon-button', properties:{size:'sm',variant:'standard',icon:'favorite',selectedIcon:'check',toggle:true,selected:false,ripple:false,'aria-label':'Save to favorites',...properties}, dark:false, width:640, ...extra });
const part = (frame, name='component') => frame.inspection.nodes.find(node=>node.id===name);
const click = (frame, phase) => renderer.input(frame.sessionId,{command:'pointer',phase,x:part(frame).bounds.x+part(frame).bounds.width/2,y:part(frame).bounds.y+part(frame).bounds.height/2});
try {
  const start = await renderer.create(request({}, {iconButtonAppearanceDefaults:{containerColor:"#102030",iconColor:"#FFFFFF",stateLayerColor:"#FF0000",iconSize:30,cornerRadius:3,outlineColor:"#ABCDEF",width:80,height:60},iconButtonAppearance:{width:92,outlineWidth:4}}));
  assert.equal(part(start).bounds.width,92); assert.equal(part(start).bounds.height,60); assert.equal(part(start,'component.icon').bounds.width,30);
  assert.deepEqual(part(start).metrics.border,[0,0,0,0]);
  const held = await click(start,'down'); assert.deepEqual(held.events,[]);
  const released = await click(start,'up');
  assert.deepEqual(released.events.map(event=>event.name),['mdClick']);
  assert.deepEqual(released.events[0].detail,{selected:true}); assert.equal(released.events[0].activation.source,'pointer');
  assert.ok(part(released,'component.selected-icon')); assert.equal(part(released,'component.icon'),undefined);
  const keyboard = await renderer.input(start.sessionId,{command:'key',key:'Space',modifiers:[]});
  assert.deepEqual(keyboard.events.map(event=>event.name),['mdClick']); assert.deepEqual(keyboard.events[0].detail,{selected:false}); assert.equal(keyboard.events[0].activation.source,'keyboard');
  renderer.close(start.sessionId);
  const empty = await renderer.create(request({selected:true}, {slots:{'':{kind:'symbol',value:'add'},selected:''}}));
  assert.ok(part(empty,'component.selected-icon')); assert.equal(part(empty,'component.icon'),undefined);
  renderer.close(empty.sessionId);
  const blank = await renderer.create(request({selected:true,selectedIcon:'',icon:''}, {slots:{selected:''}}));
  assert.equal(empty.imageUrl,blank.imageUrl,'Explicit empty selected wrapper suppresses fallback, matching authored Web empty span.');
  renderer.close(blank.sessionId);
  const dense = await renderer.create(request({size:'xl',buttonWidth:'wide',density:-4,variant:'outlined'}, {iconButtonAppearance:{outlineWidth:4}}));
  assert.equal(part(dense).bounds.width,168); assert.equal(part(dense).bounds.height,120); assert.equal(part(dense,'component.icon').bounds.width,28);
  assert.deepEqual(part(dense).metrics.border,[4,4,4,4]);
  assert.equal(part(dense,'component.state-layer').bounds.width,160,'Inset state-layer excludes the source outlined border.');
  renderer.close(dense.sessionId);
  for (const guard of ['disabled','softDisabled']) {
    const frame = await renderer.create(request({[guard]:true}));
    assert.deepEqual((await click(frame,'down')).events,[]); assert.deepEqual((await click(frame,'up')).events,[]);
    renderer.close(frame.sessionId);
  }
  console.log('Live SwiftUI icon-button host passed: appearance merge, exact geometry/parts, pointer hold/release, Space, one-event selected payload, authored blank slots, density/outline and disabled guards.');
} finally { renderer.dispose(); }

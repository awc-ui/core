import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createNativeLiveRenderer} from '../../native-playground/native-live.mjs';
const renderer=createNativeLiveRenderer({repoRoot:fileURLToPath(new URL('../../../',import.meta.url))});
const request=(properties={},extra={})=>({tag:'md-fab',properties:{variant:'primary-container',size:'standard',icon:'add',label:'New project',ripple:false,...properties},dark:false,width:640,...extra});
const part=(frame,id='component')=>frame.inspection.nodes.find(node=>node.id===id);
const pointer=(frame,phase)=>{const b=part(frame).bounds;return renderer.input(frame.sessionId,{command:'pointer',phase,x:b.x+b.width/2,y:b.y+b.height/2});};
const method=(frame,value)=>renderer.input(frame.sessionId,{command:'method',method:'setMenuIcon',arguments:[value]});
try {
 const styled=await renderer.create(request({},{fabAppearanceDefaults:{containerColor:'#0000FF',iconColor:'#FF0000',iconSize:32,cornerRadius:0,labelColor:'#00FF00'},fabAppearance:{iconSize:40}}));
 assert.ok(Math.abs(part(styled).bounds.width-163.969)<0.8);assert.equal(part(styled).bounds.height,56);assert.equal(part(styled,'component.icon').bounds.width,40);assert.deepEqual(part(styled).metrics.padding,[0,20,0,16]);
 assert.deepEqual((await pointer(styled,'down')).events,[]);const release=await pointer(styled,'up');assert.deepEqual(release.events.map(e=>e.name),['mdClick']);assert.equal(release.events[0].detail,null);assert.equal(release.events[0].activation.source,'pointer');
 const keyboard=await renderer.input(styled.sessionId,{command:'key',key:'Space',modifiers:[]});assert.equal(keyboard.events[0].activation.source,'keyboard');renderer.close(styled.sessionId);
 const blank=await renderer.create(request({disabled:true},{slots:{icon:''}}));const overridden=await method(blank,'close');assert.notEqual(overridden.imageUrl,blank.imageUrl);assert.deepEqual(overridden.events,[]);assert.deepEqual(part(overridden).bounds,part(blank).bounds);
 const restored=await method(blank,null);assert.equal(restored.imageUrl,blank.imageUrl,'Clear restores explicit empty slot and authored icon remains untouched.');
 const whitespace=await method(blank,' ');assert.deepEqual(whitespace.events,[]);const empty=await method(blank,'');assert.equal(empty.imageUrl,blank.imageUrl,'Empty string clears temporary presentation.');
 assert.deepEqual((await pointer(blank,'down')).events,[]);assert.deepEqual((await pointer(blank,'up')).events,[]);renderer.close(blank.sessionId);
 const dense=await renderer.create(request({density:-4,size:'large',extended:false},{slots:{icon:{kind:'symbol',value:'favorite'}}}));assert.equal(part(dense).bounds.width,56);assert.equal(part(dense).bounds.height,40);assert.equal(part(dense,'component.icon').bounds.width,20);renderer.close(dense.sessionId);
 console.log('Live SwiftUI FAB passed: five hooks/merge, actual geometry/parts, held pointer/Space, null-detail activation metadata, typed/blank slots, disabled async setter, clear and dense collapsed geometry.');
} finally {renderer.dispose();}

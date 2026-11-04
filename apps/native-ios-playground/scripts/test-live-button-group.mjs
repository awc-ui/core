import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createNativeLiveRenderer} from '../../native-playground/native-live.mjs';
const renderer=createNativeLiveRenderer({repoRoot:fileURLToPath(new URL('../../../',import.meta.url))});
const request=(properties={},extra={})=>({tag:'md-button-group',properties:{size:'sm',variant:'standard',selectionMode:'single-select',...properties},dark:false,width:640,...extra});
const part=(frame,id='component')=>frame.inspection.nodes.find(node=>node.id===id);
const point=(frame,index)=>{const b=part(frame,`component.child.segment-${index}`).bounds;return{x:b.x+b.width/2,y:b.y+b.height/2};};
try {
 const initial=await renderer.create(request({fullWidth:true},{buttonGroupAppearanceDefaults:{gap:20,width:100,height:60},buttonGroupAppearance:{gap:4},buttonGroupSelection:[false,true,false]}));
 assert.deepEqual(initial.buttonGroupSelection,[false,true,false]); assert.equal(part(initial).bounds.width,576); assert.equal(part(initial).bounds.height,60); assert.deepEqual(part(initial).metrics.gap,{row:0,column:4});
 const held=await renderer.input(initial.sessionId,{command:'pointer',phase:'down',...point(initial,2)}); assert.deepEqual(held.events,[]);
 const release=await renderer.input(initial.sessionId,{command:'pointer',phase:'up',...point(initial,2)});
 assert.deepEqual(release.events.map(event=>event.name),['mdClick','mdChange','mdSelectionChange']); assert.deepEqual(release.buttonGroupSelection,[false,false,true]);
 assert.deepEqual(release.events.at(-1).detail,{values:['month'],added:['month'],removed:['week']}); assert.equal(release.events.at(-1).activation.source,'pointer');
 const left=await renderer.input(initial.sessionId,{command:'key',key:'ArrowLeft',modifiers:[]}); assert.deepEqual(left.events,[]); assert.deepEqual(left.buttonGroupSelection,[false,false,true]);
 const space=await renderer.input(initial.sessionId,{command:'key',key:'Space',modifiers:[]}); assert.deepEqual(space.buttonGroupSelection,[false,true,false]); assert.equal(space.events.at(-1).activation.source,'keyboard');
 renderer.close(initial.sessionId);
 const required=await renderer.create(request({required:true},{buttonGroupSelection:[true,false,false]}));
 await renderer.input(required.sessionId,{command:'pointer',phase:'down',...point(required,0)});
 const same=await renderer.input(required.sessionId,{command:'pointer',phase:'up',...point(required,0)}); assert.deepEqual(same.buttonGroupSelection,[true,false,false]); assert.deepEqual(same.events.at(-1).detail,{values:['day'],added:[],removed:[]});
 renderer.close(required.sessionId);
 const multiple=await renderer.create(request({selectionMode:'multi-select',density:-4,variant:'connected'},{buttonGroupSelection:[true,false,true],buttonGroupAppearance:{gap:0,minWidth:300,maxWidth:500,minHeight:32,maxHeight:48}}));
 assert.deepEqual(multiple.buttonGroupSelection,[true,false,true]); assert.equal(part(multiple).bounds.width,300); assert.equal(part(multiple).bounds.height,48);
 renderer.close(multiple.sessionId);
 console.log('Live SwiftUI button-group host passed: seven appearance hooks/merge, full-width padding32, exact ordered selection, held pointer, keyboard roving/activation, required restoration and multi-selection.');
} finally {renderer.dispose();}

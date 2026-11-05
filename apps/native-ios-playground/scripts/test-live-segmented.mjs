import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',data=>{stderr+=data;});
  child.stdout.on('data',data=>{
    buffer+=data;let newline;
    while((newline=buffer.indexOf('\n'))>=0){
      const reply=JSON.parse(buffer.slice(0,newline));buffer=buffer.slice(newline+1);
      const entry=pending.get(reply.id);if(entry){pending.delete(reply.id);clearTimeout(entry.timeout);entry.resolve(reply);}
    }
  });
  child.on('exit',(code,signal)=>{for(const entry of pending.values()){clearTimeout(entry.timeout);entry.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {
    call:message=>new Promise((resolve,reject)=>{
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);reject(new Error(`Host timeout ${stderr}`));},5000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const root=frame=>frame.inspection.nodes.find(node=>node.id==='component');
const context=(selection=[true,false,false],multiselect=false,density=0)=>({mode:'set',multiselect,density,selection});
const standalone=host();
try {
  const frame=await standalone.call({command:'configure',tag:'md-segmented-button',properties:{label:'Week',value:'v',selected:false,segmentMultiselect:true},width:640,dark:false,segmentedContext:{mode:'standalone',multiselect:false,density:0,selection:[]}});
  check(!frame.error && frame.inspection.unit==='pt' && root(frame).bounds.height===40,'Standalone uses the actual segment layout and point units.');
  const b=root(frame).bounds,point={x:b.x+b.width/2,y:b.y+b.height/2};
  await standalone.call({command:'pointer',phase:'down',...point});
  const activated=await standalone.call({command:'pointer',phase:'up',...point});
  check(activated.events.length===1 && activated.events[0].name==='mdSegmentClick' && activated.events[0].detail.selected===true && activated.events[0].detail.value==='v','Standalone proposes the source value/selected payload.');
  check(activated.events[0].activation.source==='pointer' && !activated.inspection.nodes.some(node=>node.id==='component.checkmark'),'Standalone pointer activation does not mutate controlled selection.');
  const keyboard=await standalone.call({command:'key',key:'Space'});
  check(keyboard.events[0]?.detail.selected===true && keyboard.events[0]?.activation.source==='keyboard','Keyboard proposes the same controlled state through a real native responder.');
} finally {standalone.close();}
const composed=host();
try {
  const frame=await composed.call({command:'configure',tag:'md-segmented-button',properties:{label:'Day',value:'duplicate'},width:640,dark:false,segmentedContext:context([true,false,true],true,-4),slots:{icon:''},segmentedButtonAppearanceDefaults:{outlineColor:'#123456'},segmentedButtonAppearance:{iconSize:28,selectedContainerColor:'#654321'}});
  check(!frame.error && frame.segmentedSelection.join(',')==='true,false,true','Composed preview reports actual ordered selected identities.');
  check(root(frame).bounds.height===28 && root(frame).metrics.padding.join(',')==='0,8,0,8','Parent density and selected-child style resolve in the actual tree.');
  const graphic=frame.inspection.nodes.find(node=>node.id==='component.checkmark');
  check(graphic?.bounds.width===28 && root(frame).metrics.typography.size===12,'Local icon size and inherited typography reach the selected child.');
  const b=root(frame).bounds,point={x:b.x+b.width/2,y:b.y+b.height/2};
  await composed.call({command:'pointer',phase:'down',...point});
  const clicked=await composed.call({command:'pointer',phase:'up',...point});
  check(clicked.segmentedSelection.join(',')==='false,false,true','Held pointer toggles the actual first child identity.');
  check(clicked.events.length===1 && clicked.events[0].name==='mdChange' && JSON.stringify(clicked.events[0].detail)==='["month"]','Set consumes internal event and exposes exact selected values.');
  const moved=await composed.call({command:'key',key:'ArrowRight'});
  check(moved.events.length===0 && moved.segmentedSelection.join(',')==='false,false,true','Multiselect arrow moves focus without selecting.');
  const chosen=await composed.call({command:'key',key:'Enter'});
  check(chosen.segmentedSelection.join(',')==='false,true,true' && JSON.stringify(chosen.events[0]?.detail)==='["week","month"]','Keyboard activation commits focused sibling in authored order.');
} finally {composed.close();}
const set=host();
try {
  const frame=await set.call({command:'configure',tag:'md-segmented-button-set',properties:{density:-2,multiselect:true},width:640,dark:false});
  check(!frame.error && root(frame).bounds.height===32 && frame.segmentedSelection.join(',')==='true,false,false','Root set preview uses authored density and default selection without a supplied context.');
} finally {set.close();}
console.log(`Passed ${checks} live SwiftUI segmented standalone/set, slots, styles, pointer, keyboard and ordered-selection checks.`);

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
const root=frame=>frame.inspection?.nodes.find(node=>node.id==='component');
const shape=frame=>frame.inspection?.nodes.find(node=>node.id==='component.shape');
let live=host();
try {
  let frame=await live.call({command:'configure',tag:'md-loading-indicator',properties:{label:'Busy'},width:640,dark:false});
  check(!frame.error && root(frame)?.bounds.width===48 && root(frame)?.bounds.height===48,'Default native Loading geometry matches source48-square.');
  check(root(frame).metrics.typography===undefined && shape(frame)?.bounds.width>0,'Indicator exposes real shape part without fabricated visible text metrics.');
  const initial=frame.png;await new Promise(resolve=>setTimeout(resolve,180));frame=await live.call({command:'frame'});
  check(frame.png!==initial,'Actual native morph animation changes captured pixels.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-loading-indicator',properties:{variant:'contained',density:-4},loadingIndicatorAppearanceDefaults:{size:64,color:'#12345680'},loadingIndicatorAppearance:{size:24,shapeSize:80,containerColor:'#FEDCBA80',containerShape:{topLeft:{x:{fraction:.25},y:{points:10}},bottomRight:{x:{points:20},y:{fraction:.5}}}},width:640,dark:true,direction:'rtl'});
  check(!frame.error && root(frame)?.bounds.width===24 && root(frame)?.metrics.direction==='rtl','Local hook wins inherited size and RTL metadata remains true.');
  check(shape(frame)?.bounds.height>0 && shape(frame)?.parentId==='component','Oversized native morph remains a real measured child within clipped container.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-loading-indicator',properties:{density:-4},width:640,dark:false});
  check(root(frame)?.bounds.width===32 && root(frame)?.bounds.height===32,'Local density drives the source32pt lower rung.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-loading-indicator',loadingIndicatorAppearance:{size:0},width:640,dark:false});
  check(!frame.error && root(frame)?.bounds.width===0 && root(frame)?.bounds.height===0,'Intentional zero-size root remains a true zero measurement.');
  check(shape(frame)?.bounds.width===0 && shape(frame)?.bounds.height===0,'Derived zero-size shape is not replaced with a parent fallback.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-loading-indicator',properties:{hidden:true},width:640,dark:false});
  check(!frame.error && frame.inspection===undefined,'Hidden indicator has no fabricated root from preview layout.');
} finally {live.close();}
console.log(`Passed ${checks} live SwiftUI LoadingIndicator geometry, style inheritance, animation, zero/hidden and part checks.`);

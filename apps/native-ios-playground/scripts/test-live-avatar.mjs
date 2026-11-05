import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI Avatar live host: dispatch, typed appearance (palette hooks included), retained
// updates, the image events and the fallback chain, with the source values.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
const images=JSON.parse(readFileSync(new URL('../../../packages/native-ios/Tests/Fixtures/avatar-web-lifecycle.json',import.meta.url),'utf8')).images;
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const events=(...frames)=>frames.flatMap(frame=>frame?.events??[]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const color=(value,hex)=>Array.isArray(value)&&rgb(hex).every((channel,i)=>near(value[i],channel,.006));
const length=points=>({points,fraction:0,em:0,rem:0,ch:0});
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',data=>{stderr+=data;});
  child.stdout.on('data',data=>{
    buffer+=data;let end;
    while((end=buffer.indexOf('\n'))>=0){
      const reply=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
      const item=pending.get(reply.id);if(item){pending.delete(reply.id);clearTimeout(item.timeout);item.resolve(reply);}
    }
  });
  child.on('exit',(code,signal)=>{for(const item of pending.values()){clearTimeout(item.timeout);item.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {
    call:message=>new Promise((resolve,reject)=>{
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const node=(frame,name)=>frame.inspection?.nodes.find(item=>item.name===name&&item.metrics);
let live;
const configure=async (fields={})=>{live?.close();live=host();return live.call({command:'configure',tag:'md-avatar',width:640,dark:false,...fields});};
const settle=async ms=>{await sleep(ms);return live.call({command:'frame'});};
const report={};
try{
  // Dispatch: the dedicated renderer; Ada Lovelace → AL in palette bucket 3, large 56.
  let frame=await configure({properties:{name:'Ada Lovelace',size:'large'}});
  check(!frame.error,`configure: ${frame.error}`);
  let a=node(frame,'md-avatar');
  check(a?.metrics?.mode==='initials'&&a.metrics.initials==='AL'&&a.metrics.palette===3,`Initials and palette (${JSON.stringify(a?.metrics)}).`);
  check(a.metrics.role==='img'&&a.metrics.label==='Ada Lovelace',`role img with the name as label (${a.metrics.role}/${a.metrics.label}).`);
  check(near(a.bounds.width,56)&&near(a.bounds.height,56)&&a.metrics.size===56,`Large preset 56 (${JSON.stringify(a.bounds)}).`);
  check(color(a.metrics.background,'#FFD8E4'),`tertiary-container for bucket 3 (${a.metrics.background}).`);
  report.default=a.bounds;
  // Typed appearance: the local palette hook wins over the subtree default; size and outline hooks.
  frame=await configure({properties:{name:'Ada Lovelace'},avatarAppearanceDefaults:{palette3Container:'#00FF00',palette3Label:'#FFFFFF'},avatarAppearance:{size:length(52),palette3Container:'#123456',outlineWidth:length(3),outlineColor:'#FF0000'}});
  a=node(frame,'md-avatar');
  check(a.metrics.size===52&&near(a.bounds.width,52),`size hook (${a.metrics.size}).`);
  check(color(a.metrics.background,'#123456')&&color(a.metrics.color,'#FFFFFF'),`Palette hooks: local container, inherited label (${a.metrics.background} / ${a.metrics.color}).`);
  check(a.metrics.outline===3,`outline width hook (${a.metrics.outline}).`);
  // containerColor colours only neutral avatars, as in the source.
  frame=await configure({properties:{name:'Ada Lovelace'},avatarAppearance:{containerColor:'#FFE082',labelColor:'#B71C1C'}});
  a=node(frame,'md-avatar');check(color(a.metrics.background,'#FFD8E4'),`The name palette wins over containerColor (${a.metrics.background}).`);
  frame=await configure({properties:{name:'Ada Lovelace',colorFromName:false},avatarAppearance:{containerColor:'#FFE082',labelColor:'#B71C1C'}});
  a=node(frame,'md-avatar');check(a.metrics.palette===0&&color(a.metrics.background,'#FFE082')&&color(a.metrics.color,'#B71C1C'),`Neutral avatar takes the container/label hooks (${a.metrics.background}).`);
  // Retained updates keep the instance and re-evaluate size, density, shape and the palette.
  frame=await configure({properties:{name:'Ada Lovelace',size:'large'}});
  let step=await live.call({command:'update',properties:{size:'small',density:-2}});
  check(step.ack===true&&!step.error,`Retained update: ${step.error}`);
  a=node(await settle(80),'md-avatar');check(a.metrics.size===21,`small at density -2: max(18, 24 - 3) (${a.metrics.size}).`);
  step=await live.call({command:'update',properties:{size:'4rem',shape:'square',colorFromName:false}});
  a=node(await settle(80),'md-avatar');
  check(a.metrics.size===64&&a.metrics.palette===0&&JSON.stringify(a.metrics.radii)==='[[0,0],[0,0],[0,0],[0,0]]',`4rem, square, neutral (${a.metrics.size} ${JSON.stringify(a.metrics.radii)}).`);
  check(color(a.metrics.background,'#E6E0E9'),`surface-container-highest (${a.metrics.background}).`);
  // Image events: mdLoad with { src }, then mdError and the fallback to the initials tile.
  const collect=async(name,limit=40)=>{const seen=[];for(let i=0;i<limit&&!seen.some(e=>e.name===name);i++)seen.push(...events(await settle(50)));return seen;};
  step=await live.call({command:'update',properties:{src:images.square}});
  let seen=[...events(step),...await collect('mdLoad')];
  check(seen.filter(e=>e.name==='mdLoad').length===1&&seen.find(e=>e.name==='mdLoad').detail?.src===images.square,`mdLoad once with the src (${JSON.stringify(seen.map(e=>e.name))}).`);
  a=node(await settle(50),'md-avatar');check(a.metrics.mode==='image'&&a.metrics.background[3]===0,`image mode, transparent container (${a.metrics.mode}).`);
  step=await live.call({command:'update',properties:{src:images.broken}});
  seen=[...events(step),...await collect('mdError')];
  check(seen.filter(e=>e.name==='mdError').length===1&&seen.find(e=>e.name==='mdError').detail?.src===images.broken,`mdError once with the src (${JSON.stringify(seen.map(e=>e.name))}).`);
  a=node(await settle(80),'md-avatar');check(a.metrics.mode==='initials'&&a.metrics.initials==='AL',`A failed image falls back to the initials (${a.metrics.mode}).`);
  step=await live.call({command:'update',properties:{src:images.broken}});
  seen=[...events(step),...events(await settle(200))];check(!seen.some(e=>e.name==='mdError'),'The same failed src is not requested again.');
  for(const bad of [{shape:'oval'},{density:-5},{colorFromName:'yes'},{crossorigin:'x'},{loading:'auto'},{size:null},{headline:'x'}]){
    const response=await live.call({command:'update',properties:bad});check(Boolean(response.error),`Invalid update ${JSON.stringify(bad)} is rejected.`);
  }
  // No image and no initials: the person icon (the slot's fallback content), hidden from assistive technology.
  frame=await configure({properties:{name:''}});
  a=node(frame,'md-avatar');
  check(a.metrics.mode==='slot'&&a.metrics.role==='presentation'&&Boolean(node(frame,'icon')),`Person icon fallback (${a.metrics.mode}/${a.metrics.role}).`);
  console.log(`Passed ${checks} actual SwiftUI Avatar host, appearance, retained update and image event checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

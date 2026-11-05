import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-stepper and md-step: typed hooks (defaults + local values), next() / prev() / goTo() /
// reset() through AWCStepperController with the source events, retained property updates with the source types (active
// through the watcher, orientation, readonly), and rejected updates / methods.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},10000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const node=(frame,name)=>frame.inspection?.nodes.find(item=>item.name===name&&item.metrics);
const metric=(frame,name,key)=>{const n=node(frame,name);const v=n?.metrics?.[key];return v&&typeof v==='object'&&'value' in v?v.value:v;};
const color=(value,hex)=>{const s=String(value ?? '').toUpperCase().replace(/\s/g,'');const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return s.startsWith(hex.toUpperCase())||s.startsWith(`RGB(${r},${g},${b}`)||s.startsWith(`RGBA(${r},${g},${b}`);};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async()=>{await wait(80);return frame();};
try{
  const names=(...rs)=>rs.flatMap(r=>(r.events??[]).map(e=>e.name));
  let f=await configure('md-stepper',{properties:{},stepperAppearanceDefaults:{activeColor:'#00838F',indicatorSize:40},stepperAppearance:{activeColor:'#C62828'}});
  check(!f.error,`configure stepper: ${f.error}`);
  f=await settle();
  check(metric(f,'md-stepper','steps')===3&&metric(f,'md-stepper','active')===0,`three steps, the first active (${metric(f,'md-stepper','steps')}, ${metric(f,'md-stepper','active')}).`);
  check(color(metric(f,'md-stepper','activeColor'),'#C62828'),`active colour: local wins (${metric(f,'md-stepper','activeColor')}).`);
  check(metric(f,'md-stepper','indicatorSize')===40,`indicator size from the defaults (${metric(f,'md-stepper','indicatorSize')}).`);
  check(metric(f,'md-stepper','panelMode')==='step',`steps with content: panel mode step (${metric(f,'md-stepper','panelMode')}).`);
  const h0=metric(f,'md-stepper','height');
  // ---- methods ----
  let m=await method('next');f=await settle();
  check(!m.error&&metric(f,'md-stepper','active')===1,`next() → step 2 (${m.error??metric(f,'md-stepper','active')}).`);
  check(JSON.stringify(names(m,f))===JSON.stringify(['mdBeforeChange','mdStepChange']),`next() events ${JSON.stringify(names(m,f))}.`);
  check(JSON.stringify(metric(f,'md-stepper','completed'))==='[true,false,false]',`auto-complete (${JSON.stringify(metric(f,'md-stepper','completed'))}).`);
  check(metric(f,'md-stepper','live')==='Step 2 of 3: Workspace, current',`polite announcement (${metric(f,'md-stepper','live')}).`);
  m=await method('goTo',[0]);f=await settle();check(!m.error&&metric(f,'md-stepper','active')===0,`goTo(0) (${m.error??metric(f,'md-stepper','active')}).`);
  m=await method('next');m=await method('next');f=await settle();check(metric(f,'md-stepper','active')===2,`next() twice (${metric(f,'md-stepper','active')}).`);
  m=await method('next');f=await settle();check(JSON.stringify(names(m,f))===JSON.stringify(['mdComplete'])&&metric(f,'md-stepper','active')===2,`next() on the last step → mdComplete (${JSON.stringify(names(m,f))}).`);
  m=await method('prev');f=await settle();check(metric(f,'md-stepper','active')===1,`prev() (${metric(f,'md-stepper','active')}).`);
  m=await method('reset');f=await settle();
  check(metric(f,'md-stepper','active')===0&&JSON.stringify(metric(f,'md-stepper','completed'))==='[false,false,false]',`reset() (${metric(f,'md-stepper','active')}, ${JSON.stringify(metric(f,'md-stepper','completed'))}).`);
  for(const [name,args] of [['goTo',[]],['goTo',['x']],['goTo',[-1]],['next',[1]],['focusRating',[]]]){m=await method(name,args);check(Boolean(m.error),`${name}(${JSON.stringify(args)}) is rejected.`);}
  // ---- retained updates ----
  let u=await update({active:2});f=await settle();
  check(!u.error&&metric(f,'md-stepper','active')===2,`active update (${u.error??metric(f,'md-stepper','active')}).`);
  check(names(u,f).includes('mdStepChange')&&!names(u,f).includes('mdBeforeChange'),`a host write to active runs the watcher: mdStepChange only (${JSON.stringify(names(u,f))}).`);
  u=await update({orientation:'vertical'});f=await settle();
  check(!u.error&&metric(f,'md-stepper','panelMode')==='shared'&&metric(f,'md-stepper','height')>h0,`orientation vertical (${metric(f,'md-stepper','panelMode')}, ${h0} → ${metric(f,'md-stepper','height')}).`);
  u=await update({readonly:true,label:'Checkout'});f=await settle();check(!u.error,`readonly / label update: ${u.error}`);
  for(const bad of [{orientation:'diagonal'},{active:-1},{active:'1'},{active:1.5},{density:2},{bogus:true},{nav:'yes'}]){u=await update(bad);check(Boolean(u.error),`stepper rejects ${JSON.stringify(bad)}.`);}
  // ---- a standalone md-step ----
  f=await configure('md-step',{properties:{},stepAppearance:{activeColor:'#C62828'}});check(!f.error,`configure step: ${f.error}`);
  f=await settle();check(color(metric(f,'md-step','activeColor'),'#C62828'),`standalone active step in the hook colour (${metric(f,'md-step','activeColor')}).`);
  u=await update({active:false});f=await settle();check(!u.error&&!color(metric(f,'md-step','activeColor'),'#C62828'),`active false: the pending colour (${metric(f,'md-step','activeColor')}).`);
  u=await update({completed:true,label:'Done'});f=await settle();check(!u.error,`step update: ${u.error}`);
  for(const bad of [{active:'yes'},{density:-5},{getLabel:'x'}]){u=await update(bad);check(Boolean(u.error),`step rejects ${JSON.stringify(bad)}.`);}
  m=await method('next');check(Boolean(m.error),'md-step has no methods.');
  console.log(`stepper live host: ${checks} checks passed`);
}finally{live?.close();}

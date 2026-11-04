import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every frame must pass the Laboratory server's own inspection schema (gate-7 R6-01/R6-02): the server rejects the whole
// frame (502 INVALID_LIVE_FRAME) and closes the session otherwise.
import {validateNativeInspection} from '../../native-playground/native-inspection.mjs';
let schemaFrames=0;
process.on('exit',code=>{if(code===0)console.log(`${schemaFrames} frames passed the Laboratory inspection schema.`);});

// Actual SwiftUI live host for n5's navigation components (md-toolbar): typed hooks (defaults + local values), retained
// property updates with the source types, setFocus() through AWCToolbarController, and the lifecycle (a new session binds
// a fresh controller; nothing is retained from the previous one).
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
      const item=pending.get(reply.id);if(item){pending.delete(reply.id);clearTimeout(item.timeout);
        if(reply.inspection){try{validateNativeInspection(reply.inspection,'macos');schemaFrames++;}catch(error){item.reject(new Error(`Frame rejected by the Laboratory inspection schema: ${error.message} ${JSON.stringify(reply.inspection.nodes?.map(n=>[n.name,n.metrics&&Object.fromEntries(Object.entries(n.metrics).filter(([k])=>['padding','margin','border','gap'].includes(k)))]))}`));continue;}}
        item.resolve(reply);}
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
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name&&item.metrics);
const val=v=>v&&typeof v==='object'&&'value' in v?v.value:v;
const metric=(frame,name,key)=>val(nodes(frame,name)[0]?.metrics?.[key]);
const color=(value,hex)=>{
  if(Array.isArray(value)){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return Math.abs(value[0]-r)<0.003&&Math.abs(value[1]-g)<0.003&&Math.abs(value[2]-b)<0.003;}
  const s=String(value ?? '').toUpperCase().replace(/\s/g,'');const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return s.startsWith(hex.toUpperCase())||s.startsWith(`RGB(${r},${g},${b}`)||s.startsWith(`RGBA(${r},${g},${b}`);
};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  // ---- md-toolbar: the Laboratory recipe (floating Formatting: undo, redo, divider, bold, italic) ----
  let f=await configure('md-toolbar',{properties:{variant:'floating',ariaLabelProp:'Formatting'},toolbarAppearanceDefaults:{padding:12,gap:6},toolbarAppearance:{containerColor:'#FFE0B2',padding:20}});
  check(!f.error,`configure: ${f.error}`);
  await wait(300);f=await frame();
  check(metric(f,'md-toolbar','role')==='toolbar'&&metric(f,'md-toolbar','orientation')==='horizontal'&&metric(f,'md-toolbar','label')==='Formatting',
    `a named horizontal toolbar (${metric(f,'md-toolbar','role')} ${metric(f,'md-toolbar','orientation')} ${metric(f,'md-toolbar','label')}).`);
  const members=metric(f,'md-toolbar','members')??[];
  check(members.length===4,`four roving members: the icon buttons, not the divider (${JSON.stringify(members)}).`);
  check(color(metric(f,'container','background'),'#FFE0B2'),`the pill takes the colour hook (${JSON.stringify(metric(f,'container','background'))}).`);
  check(metric(f,'container','paddingValue')===20,`the local padding wins over the default (${metric(f,'container','paddingValue')}).`);
  check(metric(f,'container','itemGap')===6,`the default gap applies where no local value is set (${metric(f,'container','itemGap')}).`);
  // One roving Tab stop: the group's active member (the first, before any focus) — the live frame inspects the toolbar root.
  check(metric(f,'md-toolbar','activeID')===members[0],`one Tab stop on the first member (${metric(f,'md-toolbar','activeID')} vs ${members[0]}).`);
  // ---- setFocus() ----
  let m=await method('setFocus');check(!m.error,`setFocus: ${m.error}`);
  m=await method('setFocus',[1]);check(Boolean(m.error),'setFocus rejects arguments.');
  m=await method('expand');check(Boolean(m.error),'an unknown method is rejected.');
  // ---- retained updates ----
  let u=await update({layout:'vertical'});check(!u.error,`layout update: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','orientation')==='vertical',`vertical floating toolbar (${metric(f,'md-toolbar','orientation')}).`);
  u=await update({variant:'docked',density:-2});check(!u.error,`variant + density: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','orientation')==='horizontal',`layout is ignored on a docked bar (${metric(f,'md-toolbar','orientation')}).`);
  check(metric(f,'md-toolbar','height')===56,`docked height at density -2 is 56 (${metric(f,'md-toolbar','height')}; scale ${metric(f,'md-toolbar','density')}, node density ${JSON.stringify(metric(f,'md-toolbar','localDensity'))}).`);
  u=await update({containerSemantics:'generic'});check(!u.error,`semantics: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','role')==='generic'&&(metric(f,'md-toolbar','members')??[]).length===0,`generic mode: no role, no roving group (${metric(f,'md-toolbar','role')}).`);
  check(metric(f,'md-toolbar','activeID')==='','generic mode: no roving stop, every control keeps its own Tab stop.');
  u=await update({containerSemantics:'toolbar',color:'vibrant',alignment:'center',ariaLabelledby:'title'});check(!u.error,`back to toolbar: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','role')==='toolbar'&&(metric(f,'md-toolbar','members')??[]).length===4,'the roving group re-syncs after generic → toolbar.');
  for(const bad of [{variant:'pill'},{layout:'diagonal'},{density:-5},{alignment:'around'},{bogus:1},{ariaLabelProp:3}]){
    u=await update(bad);check(Boolean(u.error),`rejected: ${JSON.stringify(bad)}.`);
  }
  // ---- lifecycle: a new session binds a fresh controller and starts from the recipe ----
  f=await configure('md-toolbar',{properties:{variant:'docked',ariaLabelProp:'Edit'}});check(!f.error,`reconfigure: ${f.error}`);
  await wait(300);f=await frame();
  check(metric(f,'md-toolbar','label')==='Edit'&&metric(f,'md-toolbar','orientation')==='horizontal'&&(metric(f,'md-toolbar','members')??[]).length===4,'a new session renders its own configuration.');
  m=await method('setFocus');check(!m.error,`setFocus after remount: ${m.error}`);
  console.log(`md-toolbar live host: ${checks} checks passed`);
}finally{live?.close();}

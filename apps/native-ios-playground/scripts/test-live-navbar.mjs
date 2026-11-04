import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every frame must pass the Laboratory server's own inspection schema (gate-7 R6-01/R6-02): the server rejects the whole
// frame (502 INVALID_LIVE_FRAME) and closes the session otherwise.
import {validateNativeInspection} from '../../native-playground/native-inspection.mjs';
let schemaFrames=0;
process.on('exit',code=>{if(code===0)console.log(`${schemaFrames} frames passed the Laboratory inspection schema.`);});

// Actual SwiftUI live host for md-navigation-bar / md-navigation-tab: the recipe bar, typed hooks, retained property updates
// (announced activeIndex, label behaviour, manual activation, destination state) and select / focusTab / focusEl.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const color=(value,hex)=>Array.isArray(value)&&rgb(hex).every((channel,i)=>Math.abs(value[i]-channel)<=.006);
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name&&item.metrics);
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const changes=r=>(r.events??[]).filter(e=>e.name==='mdChange');
try{
  let f=await configure('md-navigation-bar',{properties:{},navigationBarAppearance:{containerColor:'#E8F5E9',activeIndicatorColor:'#FFCC80',activeIconColor:'#E65100',containerHeight:72}});
  check(!f.error,`configure: ${f.error}`);
  await wait(800);f=await frame();
  let bar=nodes(f,'md-navigation-bar')[0],tabs=nodes(f,'md-navigation-tab');
  check(tabs.length===3,`three destinations (${tabs.length}).`);
  check(bar&&bar.metrics.activeIndex===0&&color(bar.metrics.container,'#E8F5E9')&&bar.metrics.height===72,`bar hooks (${JSON.stringify(bar?.metrics)}).`);
  check(tabs.map(t=>t.metrics.name).join('|')==='Home|Explore|Saved',`recipe destinations (${tabs.map(t=>t.metrics.name)}).`);
  const active=tabs.find(t=>t.metrics.active);
  check(active&&active.metrics.name==='Home'&&color(active.metrics.color,'#E65100')&&color(active.metrics.indicatorColor,'#FFCC80'),`the first destination is active with the hook colours (${JSON.stringify(active?.metrics)}).`);
  let m=await method('select',[2]);check(!m.error,`select: ${m.error}`);
  check(changes(m).length===1&&changes(m)[0].detail?.index===2&&changes(m)[0].detail?.previousIndex===0,`select(2) emits mdChange ${JSON.stringify(m.events)}.`);
  await wait(400);f=await frame();check(nodes(f,'md-navigation-bar')[0]?.metrics.activeIndex===2,'select(2) activates Saved.');
  m=await method('select',[2]);check(changes(m).length===0,'selecting the active destination again emits nothing.');
  m=await method('select',[9]);check(changes(m).length===0,'an index past the end clamps to the last destination (already active).');
  m=await method('focusTab',[1]);check(!m.error&&changes(m).length===0,'focusTab does not select.');
  m=await method('select');check(Boolean(m.error),'select requires an index.');
  let u=await live.call({command:'update',properties:{activeIndex:1}});check(!u.error,`update: ${u.error}`);
  check(changes(u).length===1&&changes(u)[0].detail?.index===1,`an activeIndex write announces mdChange ${JSON.stringify(u.events)}.`);
  u=await live.call({command:'update',properties:{labelBehavior:'selected',manualActivation:true}});check(!u.error,`update: ${u.error}`);
  await wait(400);f=await frame();
  const labels=nodes(f,'label');
  check(labels.filter(l=>l.metrics.opacity<0.01).length===2,`selected mode hides the inactive labels (${labels.map(l=>l.metrics.opacity)}).`);
  check(nodes(f,'md-navigation-bar')[0]?.metrics.manualActivation===true,'manual activation updates.');
  u=await live.call({command:'update',properties:{labelBehavior:'hidden'}});check(Boolean(u.error),'an unknown label behaviour is rejected.');
  u=await live.call({command:'update',properties:{bogus:1}});check(Boolean(u.error),'unknown properties are rejected.');
  f=await configure('md-navigation-tab',{properties:{},navigationTabAppearance:{activeIndicatorColor:'#FFCC80',badgeColor:'#1565C0'}});check(!f.error,`configure tab: ${f.error}`);
  await wait(800);f=await frame();
  let t=nodes(f,'md-navigation-tab')[0];check(t&&t.metrics.active===true&&t.metrics.name==='Home'&&color(t.metrics.indicatorColor,'#FFCC80'),`a standalone active destination (${JSON.stringify(t?.metrics)}).`);
  u=await live.call({command:'update',properties:{badgeValue:'1200',badgeMax:999,softDisabled:true}});check(!u.error,`tab update: ${u.error}`);
  await wait(400);f=await frame();t=nodes(f,'md-navigation-tab')[0];const b=nodes(f,'badge')[0];
  check(b&&b.metrics.text==='999+'&&color(b.metrics.color,'#1565C0'),`the capped badge (${JSON.stringify(b?.metrics)}).`);
  check(t?.metrics.softDisabled===true&&Math.abs(t.metrics.opacity-0.38)<0.001&&t.metrics.name==='999+ new Home',`soft-disabled and named with its badge (${JSON.stringify(t?.metrics)}).`);
  m=await method('focusEl');check(!m.error,`focusEl: ${m.error}`);
  m=await method('focusEl',[1]);check(Boolean(m.error),'focusEl rejects arguments.');
  u=await live.call({command:'update',properties:{badge:'yes'}});check(Boolean(u.error),'a string badge is rejected.');
  console.log(`md-navigation-bar live host: ${checks} checks passed`);
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-search: typed hooks, retained property updates and the controller methods the preview runs
// (show / close / toggle / focusInput through AWCSearchController), with the md* events they emit.
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const node=(frame,name)=>frame.inspection?.nodes.find(item=>item.name===name&&item.metrics);
const metric=(frame,name,key)=>{const n=node(frame,name);const v=n?.metrics?.[key];return v&&typeof v==='object'&&'value' in v?v.value:v;};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let f=await configure('md-search',{properties:{layout:'docked',placeholder:'Search projects',value:'pro',open:false},
    searchAppearance:{containerColor:'#FFF3E0',inputColor:'#0D47A1',containerHeight:64,expandEasing:[0.2,0,0,1]}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  check(String(metric(f,'bar','background')).toUpperCase().startsWith('#FFF3E0'),`container hook colour (${metric(f,'bar','background')}).`);
  check(String(metric(f,'input','color')).toUpperCase().startsWith('#0D47A1'),`input hook colour (${metric(f,'input','color')}).`);
  check(Math.abs((node(f,'bar')?.bounds?.height ?? 0)-64)<0.6,`container height hook (${node(f,'bar')?.bounds?.height}).`);
  check(metric(f,'md-search','open')===false&&metric(f,'md-search','value')==='pro',`closed with the value (${metric(f,'md-search','open')}, ${metric(f,'md-search','value')}).`);
  let m=await method('show');check(!m.error,`show: ${m.error}`);await wait(450);f=await frame();
  check(metric(f,'md-search','open')===true,'show() opens the view.');
  check(Number(metric(f,'panel','opacity'))>0.98,`the docked panel is revealed (${metric(f,'panel','opacity')}).`);
  // The host's sample row sits in the default slot: a query with no row in the results slot shows the empty state, and the
  // source announces nothing then.
  check(metric(f,'md-search','count')===0&&metric(f,'md-search','status')==='',`empty state, no announcement (${metric(f,'md-search','count')}, ${metric(f,'md-search','status')}).`);
  m=await method('toggle');await wait(700);f=await frame();check(metric(f,'md-search','open')===false,'toggle() closes an open view.');
  m=await method('toggle');await wait(450);f=await frame();check(metric(f,'md-search','open')===true,'toggle() opens a closed view.');
  m=await method('close');await wait(700);f=await frame();check(metric(f,'md-search','open')===false,'close() closes the view.');
  m=await method('focusInput');await wait(150);f=await frame();check(metric(f,'md-search','focused')===true&&metric(f,'md-search','open')===false,'focusInput() focuses without opening.');
  let u=await update({variant:'divided',density:-2,elevation:3,showClearButton:false,loading:true,open:true});check(!u.error,`typed updates: ${u.error}`);await wait(500);f=await frame();
  check(metric(f,'md-search','open')===true&&metric(f,'md-search','loading')===true,'open and loading updates apply.');
  check(metric(f,'md-search','status')==='Searching',`the loading announcement (${metric(f,'md-search','status')}).`);
  check(!node(f,'clear-button')||Number(metric(f,'clear-button','opacity'))===0,'showClearButton=false removes the clear button.');
  // Full-screen: the layout changes while closed, then show() opens the view (in the preview window: the host has no modal scope).
  u=await update({layout:'full-screen',trigger:'bar',loading:false,open:false});check(!u.error,`layout update: ${u.error}`);await wait(700);
  m=await method('show');check(!m.error,`show (full-screen): ${m.error}`);await wait(700);f=await frame();
  const names=[...new Set((f.inspection?.nodes??[]).map(n=>n.name))].join(',');
  check(Number(metric(f,'panel','opacity'))>0.98||metric(f,'md-search','panelVisible')===true,`the full-screen view opens (open ${metric(f,'md-search','open')}, panel ${metric(f,'panel','opacity')}; nodes ${names}).`);
  for(const bad of [{variant:'plain'},{bogus:1},{density:-5},{elevation:6},{open:'true'},{triggerElement:'x'},{debounce:-1}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  m=await method('show',[1]);check(Boolean(m.error),'show rejects arguments.');
  m=await method('startVoice');check(Boolean(m.error),'startVoice is not run by the preview.');
  m=await method('whenClosed');check(Boolean(m.error),'whenClosed is not run by the preview.');
  console.log(`md-search live host: ${checks} checks passed`);
}finally{live?.close();}

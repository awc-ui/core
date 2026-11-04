import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-slider and md-rating: typed hooks (defaults + local values), retained property updates
// with the source types (in place: value, min / max re-clamp, range, precision), focusRating() through
// AWCRatingController, and rejected updates / methods.
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
  // ---- md-slider: hooks (local wins over defaults) and in-place updates through the Stencil watchers ----
  let f=await configure('md-slider',{properties:{value:30,sliderAriaLabel:'Volume'},sliderAppearanceDefaults:{activeColor:'#00838F',trackHeight:40},sliderAppearance:{activeColor:'#C62828'}});
  check(!f.error,`configure slider: ${f.error}`);
  f=await frame();
  check(color(metric(f,'md-slider','activeColor'),'#C62828'),`slider active colour: local wins (${metric(f,'md-slider','activeColor')}).`);
  check(metric(f,'md-slider','trackHeight')===40,`slider track height from the defaults (${metric(f,'md-slider','trackHeight')}).`);
  let u=await update({value:70});f=await settle();check(!u.error&&metric(f,'md-slider','value')===70,`slider value update (${u.error??metric(f,'md-slider','value')}).`);
  u=await update({max:50});f=await settle();check(metric(f,'md-slider','value')===50,`max 50 re-clamps the value (${metric(f,'md-slider','value')}).`);
  u=await update({min:60,max:100});f=await settle();check(metric(f,'md-slider','value')===60,`min 60 re-clamps the value (${metric(f,'md-slider','value')}).`);
  check(!(f.events??[]).length&&!(u.events??[]).length,`host updates emit nothing (${JSON.stringify(f.events??u.events)}).`);
  u=await update({range:true,valueStart:20,valueEnd:60});f=await settle();check(metric(f,'md-slider','valueEnd')===60&&metric(f,'md-slider','thumbs')===2,'range update.');
  u=await update({disabled:true});f=await settle();check(metric(f,'md-slider','disabled')===true,'disabled update.');
  for(const bad of [{size:'xxl'},{value:'1'},{density:2},{getLabel:'x'}]){u=await update(bad);check(Boolean(u.error),`slider rejects ${JSON.stringify(bad)}.`);}
  let m=await method('focusRating');check(Boolean(m.error),'md-slider has no methods.');
  // ---- md-rating: hooks, focusRating, in-place updates (value clamp, max re-clamp) ----
  f=await configure('md-rating',{properties:{value:3,ratingLabel:'Rating'},ratingAppearanceDefaults:{itemSize:48,activeColor:'#00838F'},ratingAppearance:{activeColor:'#FFB300'}});check(!f.error,`configure rating: ${f.error}`);
  f=await frame();check(color(metric(f,'md-rating','activeColor'),'#FFB300'),`rating active colour: local wins (${metric(f,'md-rating','activeColor')}).`);
  check(metric(f,'md-rating','itemSize')===48,`rating item size from the defaults (${metric(f,'md-rating','itemSize')}).`);
  m=await method('focusRating');check(!m.error,`focusRating: ${m.error}`);f=await settle();check(metric(f,'md-rating','focused')===true,'focusRating() focuses the rating.');
  u=await update({value:2,precision:0.5});f=await settle();check(metric(f,'md-rating','value')===2,'rating value update.');
  u=await update({value:9});f=await settle();check(metric(f,'md-rating','value')===5,`value 9 clamps to max (${metric(f,'md-rating','value')}).`);
  u=await update({max:3});f=await settle();check(metric(f,'md-rating','value')===3&&metric(f,'md-rating','items')===3,`max 3 re-clamps (${metric(f,'md-rating','value')}, ${metric(f,'md-rating','items')} items).`);
  for(const bad of [{precision:0.25},{getLabel:'x'},{hover:'on'}]){u=await update(bad);check(Boolean(u.error),`rating rejects ${JSON.stringify(bad)}.`);}
  m=await method('focusRating',[1]);check(Boolean(m.error),'focusRating rejects arguments.');
  m=await method('setZoom',[0,1]);check(Boolean(m.error),'rating has no setZoom.');
  console.log(`sr live host: ${checks} checks passed`);
}finally{live?.close();}

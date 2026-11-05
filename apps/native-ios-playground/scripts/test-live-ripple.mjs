import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-ripple: the token-styled recipe surface, typed hooks (incl. the easing text), the
// retained `disabled` update and trigger()/whenSettled() through the AWCRippleController.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const color=(value,hex)=>Array.isArray(value)&&rgb(hex).every((channel,i)=>near(value[i],channel,.006));
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
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let f=await configure('md-ripple',{properties:{},rippleAppearance:{color:'#123456',opacity:0.35,extendInline:30,extendBlock:12,growDuration:600,growEasing:'linear'}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();let r=node(f,'md-ripple');
  check(r&&r.metrics.cornerRadius===16&&r.metrics.waves===0,`recipe surface (radius ${r?.metrics.cornerRadius}, waves ${r?.metrics.waves}).`);
  let m=await method('trigger');check(!m.error,`trigger: ${m.error}`);
  await wait(120);f=await frame();r=node(f,'md-ripple');
  check(r.metrics.waves===1&&near(r.metrics.waveOpacity,0.35,0.001),`trigger starts a wave at the hook opacity (${r.metrics.waves}, ${r.metrics.waveOpacity}).`);
  const w=r.metrics.waveDiameter/2,cx=r.metrics.waveX,cy=r.metrics.waveY;
  check(near(w,Math.hypot(cx+30,cy+12),0.05),`extents widen the radius (${w} vs ${Math.hypot(cx+30,cy+12)}).`);
  check(r.metrics.waveScale>0.1&&r.metrics.waveScale<0.5,`linear 600 ms growth after ~120 ms (${r.metrics.waveScale}).`);
  const t0=Date.now();m=await method('whenSettled');const elapsed=Date.now()-t0;
  check(!m.error&&elapsed<1500,`whenSettled resolves (${elapsed} ms): ${m.error}`);
  await wait(900);f=await frame();r=node(f,'md-ripple');check(r.metrics.waves===0,`the trigger wave ends (${r.metrics.waves}).`);
  let u=await live.call({command:'update',properties:{disabled:true}});check(!u.error,`update: ${u.error}`);
  await method('trigger');await wait(60);f=await frame();r=node(f,'md-ripple');check(r.metrics.waves===0,'no wave while disabled.');
  u=await live.call({command:'update',properties:{disabled:false}});await method('trigger');await wait(60);f=await frame();r=node(f,'md-ripple');
  check(r.metrics.waves===1,'trigger works again after re-enabling.');
  u=await live.call({command:'update',properties:{bogus:1}});check(Boolean(u.error),'unknown properties are rejected.');
  m=await method('trigger',[1]);check(Boolean(m.error),'trigger rejects arguments.');
  console.log(`md-ripple live host: ${checks} checks passed`);
}finally{live?.close();}

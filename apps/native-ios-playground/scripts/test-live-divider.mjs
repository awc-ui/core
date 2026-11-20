import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-divider (gate-7 r3-03): the four boolean properties update in place, unknown or
// mistyped properties are rejected, and the inspected line follows each update.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',data=>{stderr+=data;});
  child.stdout.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\n'))>=0){const reply=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
    const item=pending.get(reply.id);if(item){pending.delete(reply.id);clearTimeout(item.timeout);item.resolve(reply);}}});
  child.on('exit',(code,signal)=>{for(const item of pending.values()){clearTimeout(item.timeout);item.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {call:message=>new Promise((resolve,reject)=>{const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
    pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);}),close:()=>child.stdin.end()};
}
const line=f=>f.inspection?.nodes.find(n=>/::part\(divider\)/.test(n.name ?? '')&&n.bounds)?.bounds;
const live=host();
try{
  let f=await live.call({command:'configure',tag:'md-divider',width:640,dark:false,properties:{}});
  check(!f.error,`configure: ${f.error}`);
  let b=line(f);check(b&&b.width>b.height,`horizontal by default (${JSON.stringify(b)}).`);const full=b.width;
  let u=await live.call({command:'update',properties:{vertical:true}});check(!u.error,`vertical update: ${u.error}`);
  b=line(await live.call({command:'frame'}));check(b&&b.height>b.width,`vertical after the update (${JSON.stringify(b)}).`);
  u=await live.call({command:'update',properties:{vertical:false,inset:true}});check(!u.error,`inset update: ${u.error}`);
  b=line(await live.call({command:'frame'}));check(b&&Math.abs(b.width-(full-32))<0.6,`inset trims 16 + 16 (${JSON.stringify(b)} of ${full}).`);
  u=await live.call({command:'update',properties:{inset:false,insetStart:true}});check(!u.error,`insetStart update: ${u.error}`);
  b=line(await live.call({command:'frame'}));check(b&&Math.abs(b.width-(full-16))<0.6,`insetStart trims 16 (${JSON.stringify(b)}).`);
  u=await live.call({command:'update',properties:{insetStart:false,insetEnd:true}});check(!u.error,`insetEnd update: ${u.error}`);
  b=line(await live.call({command:'frame'}));check(b&&Math.abs(b.width-(full-16))<0.6,`insetEnd trims 16 (${JSON.stringify(b)}).`);
  u=await live.call({command:'update',properties:{insetEnd:false}});b=line(await live.call({command:'frame'}));check(!u.error&&b&&Math.abs(b.width-full)<0.6,`back to full width (${JSON.stringify(b)}).`);
  u=await live.call({command:'update',properties:{vertical:'yes'}});check(Boolean(u.error),'a non-boolean value is rejected.');
  u=await live.call({command:'update',properties:{bogus:true}});check(Boolean(u.error),'unknown properties are rejected.');
  console.log(`md-divider live host: ${checks} checks passed`);
}finally{live.close();}

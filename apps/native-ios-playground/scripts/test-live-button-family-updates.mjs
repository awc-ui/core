import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Gate-7 R1-04: retained Laboratory property updates for the button family on the SwiftUI live host. A retained update keeps the
// mounted root and renders the same as a fresh preview with the merged properties; equal, invalid and rejected patches leave it alone.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
const {decodePNG}=await import(process.env.AWC_PNG_MODULE ?? fileURLToPath(new URL('../../../tools/ax/png.mjs',import.meta.url)));
const {nativeRenderRequest}=await import(fileURLToPath(new URL('../../native-playground/contracts.js',import.meta.url)));
const {recipeFor}=await import(fileURLToPath(new URL('../../native-playground/recipes.js',import.meta.url)));
let checks=0;const check=(c,m)=>{checks++;assert.ok(c,m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',d=>{stderr+=d;});
  child.stdout.on('data',d=>{buffer+=d;let n;while((n=buffer.indexOf('\n'))>=0){const reply=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);const e=pending.get(reply.id);if(e){pending.delete(reply.id);clearTimeout(e.timeout);e.resolve(reply);}}});
  child.on('exit',(code,signal)=>{for(const e of pending.values()){clearTimeout(e.timeout);e.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {call:m=>new Promise((resolve,reject)=>{const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout ${stderr}`));},9000);pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...m,id})}\n`);}),close:()=>child.stdin.end()};
}
function differing(a,b){const x=decodePNG(Buffer.from(a,'base64')),y=decodePNG(Buffer.from(b,'base64'));if(x.width!==y.width||x.height!==y.height)return 1;let n=0;for(let i=0;i<x.data.length;i+=4)if(Math.max(Math.abs(x.data[i]-y.data[i]),Math.abs(x.data[i+1]-y.data[i+1]),Math.abs(x.data[i+2]-y.data[i+2]))>6)n++;return n/(x.width*x.height);}
const cases=[
  ['md-button',{variant:'outlined'},{disabled:false},{variant:'nope'}],
  ['md-button-group',{variant:'connected'},{required:false},{selectionMode:'single'}],
  ['md-fab',{variant:'tertiary'},{lowered:false},{size:'huge'}],
  ['md-fab-menu',{open:true},{quick:false},{placement:'left'}],
  ['md-fab-menu-item',{disabled:true},{softDisabled:false},{density:-7}],
  ['md-icon-button',{variant:'filled'},{disabled:false},{buttonWidth:'wider'}],
  ['md-segmented-button',{label:'Week'},{disabled:false},{selected:'yes'}],
  ['md-segmented-button-set',{density:-2},{density:0},{multiselect:1}],
  ['md-split-button',{variant:'outlined'},{disabled:false},{haspopup:'popup'}],
];
for(const [tag,change,same,bad] of cases){
  const base=recipeFor(tag)?.props??{},request=nativeRenderRequest(tag,base,false,{});
  let live=host();
  try{
    let frame=await live.call({command:'configure',...request});check(!frame.error,`${tag} configures: ${frame.error}`);
    await sleep(500);const before=(await live.call({command:'frame'})).png;
    let ack=await live.call({command:'update',properties:same});check(ack.ack===true,`${tag} equal-value update ${JSON.stringify(same)} is acknowledged (${ack.error??''})`);
    await sleep(300);check(differing((await live.call({command:'frame'})).png,before)<.002,`${tag} equal-value update leaves the preview unchanged`);
    const rejected=await live.call({command:'update',properties:bad});check(Boolean(rejected.error),`${tag} invalid patch ${JSON.stringify(bad)} is rejected`);
    ack=await live.call({command:'update',properties:change});check(ack.ack===true,`${tag} update ${JSON.stringify(change)} is acknowledged (${ack.error??''})`);
    await sleep(900);const retained=(await live.call({command:'frame'})).png;
    live.close();live=host();
    frame=await live.call({command:'configure',...nativeRenderRequest(tag,{...base,...same,...change},false,{})});await sleep(1400);
    const fresh=(await live.call({command:'frame'})).png;const d=differing(retained,fresh);
    check(d<.002,`${tag} retained update renders as a fresh preview with the merged properties (${(d*100).toFixed(3)} % pixels differ)`);
    // The change must show whenever a fresh preview shows it (an md-fab-menu-item preview keeps its menu closed).
    if(differing(fresh,before)>.001)check(differing(retained,before)>.001,`${tag} ${JSON.stringify(change)} changes the mounted preview`);
    else console.log(`${tag}: ${JSON.stringify(change)} is not visible in this preview (fresh preview equals the original)`);
  }finally{live.close();}
}
console.log(`Button-family retained updates (SwiftUI live host): ${checks} checks passed`);

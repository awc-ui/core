import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-number-field: typed hooks, retained property updates and the synchronous methods with
// results (stepUp/stepDown with the repeat count, getValidity / checkValidity / reportValidity / setCustomValidity, setFocus,
// select) through AWCNumberFieldController.
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
const part=(f,name)=>f.inspection?.nodes.find(item=>item.name===name);
try{
  let f=await configure('md-number-field',{properties:{label:'Guests',value:2,min:0,max:8,step:1,required:true,supportingText:'Up to 8'},
    numberFieldAppearance:{stepperColor:'#C62828',width:300},textFieldAppearance:{containerColor:'#FFF3E0'}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  check(Math.abs((part(f,'md-number-field')?.bounds.width ?? 0)-300)<=0.5,`width hook (${part(f,'md-number-field')?.bounds.width}).`);
  check(Boolean(part(f,'increment'))&&Boolean(part(f,'decrement')),'inline steppers are measured.');
  check(metric(f,'md-number-field','value')===2&&metric(f,'md-number-field','formattedValue')==='2',`initial value (${metric(f,'md-number-field','value')}).`);
  let m=await method('stepUp');check(!m.error,`stepUp: ${m.error}`);f=await frame();
  check(metric(f,'md-number-field','value')===3,`stepUp() adds one step (${metric(f,'md-number-field','value')}).`);
  m=await method('stepUp',[3]);f=await frame();check(metric(f,'md-number-field','value')===6,`stepUp(3) (${metric(f,'md-number-field','value')}).`);
  m=await method('stepUp',[10]);f=await frame();check(metric(f,'md-number-field','value')===8,`stepUp clamps to max (${metric(f,'md-number-field','value')}).`);
  check(metric(f,'increment','disabled')===true,'the increment stepper is disabled at max.');
  m=await method('stepDown',[2.5]);f=await frame();check(metric(f,'md-number-field','value')===5.5,`stepDown(2.5) (${metric(f,'md-number-field','value')}).`);
  m=await method('getValidity');check(!m.error&&m.result?.valid===true,`valid value: ${JSON.stringify(m.result ?? m.error)}`);
  let u=await update({value:null});check(!u.error,`update value null: ${u.error}`);
  m=await method('getValidity');check(m.result?.valid===false&&m.result.flags.valueMissing===true&&m.result.validationMessage==='Please enter a number.',`required empty: ${JSON.stringify(m.result)}`);
  await method('setCustomValidity',['Too many']);m=await method('getValidity');
  check(m.result.flags.customError===true&&m.result.validationMessage==='Too many',`custom error wins (${JSON.stringify(m.result)}).`);
  await method('setCustomValidity',['']);m=await method('reportValidity');check(m.result===false,'reportValidity reports the empty required field.');
  await wait(150);f=await frame();
  check(metric(f,'md-number-field','validationMessage')==='Please enter a number.'&&metric(f,'md-number-field','focused')===true,`reportValidity shows the message and focuses (${metric(f,'md-number-field','validationMessage')}, ${metric(f,'md-number-field','focused')}).`);
  await update({disabled:true});m=await method('checkValidity');check(m.result===true,'a disabled field is barred from validation.');
  u=await update({disabled:false,max:null,value:1234.5,locale:'de-DE',formatOptions:{minimumFractionDigits:2},steppers:'split',density:-2,variant:'outlined'});check(!u.error,`typed updates: ${u.error}`);
  await wait(60);f=await frame();
  check(metric(f,'md-number-field','formattedValue')==='1.234,50',`locale + formatOptions (${metric(f,'md-number-field','formattedValue')}).`);
  await method('select');await wait(80);f=await frame();check(metric(f,'md-number-field','focused')===true,'select() focuses the input.');
  for(const bad of [{steppers:'trailing'},{bogus:1},{density:-5},{value:'12'},{step:null},{formatOptions:{style:{nested:1}}}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  m=await method('stepUp',['3']);check(Boolean(m.error),'stepUp rejects a string count.');
  m=await method('stepDown',[1,2]);check(Boolean(m.error),'stepDown rejects two arguments.');
  m=await method('select',[1]);check(Boolean(m.error),'select rejects arguments.');
  console.log(`md-number-field live host: ${checks} checks passed`);
}finally{live?.close();}

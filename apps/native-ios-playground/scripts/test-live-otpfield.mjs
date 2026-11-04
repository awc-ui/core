import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-otp-field: typed hooks, retained property updates and the synchronous methods with results
// (setFocus, clear, getValidity / setCustomValidity / checkValidity / reportValidity) through AWCOTPFieldController.
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
  let f=await configure('md-otp-field',{properties:{label:'Verification code',required:true,incompleteLabel:'Enter all six digits.',value:'12'},
    otpFieldAppearance:{cellWidth:52,outlineColor:'#1565C0'}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  check(Math.abs((part(f,'cell-0')?.bounds.width ?? 0)-52)<=0.5,`cell width hook (${part(f,'cell-0')?.bounds.width}).`);
  check(String(metric(f,'cell-5','border')).toUpperCase().startsWith('#1565C0'),`outline hook (${metric(f,'cell-5','border')}).`);
  check(metric(f,'md-otp-field','value')==='12'&&metric(f,'cell-1','text')==='2',`initial value (${metric(f,'md-otp-field','value')}).`);
  let m=await method('getValidity');
  check(!m.error&&m.result?.valid===false&&m.result.flags.valueMissing===true&&m.result.validationMessage==='Enter all six digits.',`incomplete code: ${JSON.stringify(m.result ?? m.error)}`);
  check(Object.keys(m.result.flags).length===10,'ten ValidityState flags.');
  let u=await update({value:'12 34-56x'});check(!u.error,`update value: ${u.error}`);await wait(60);f=await frame();
  check(metric(f,'md-otp-field','value')==='123456',`programmatic writes run the pipeline (${metric(f,'md-otp-field','value')}).`);
  m=await method('checkValidity');check(m.result===true,'a complete code is valid.');
  await method('setCustomValidity',['Expired']);m=await method('getValidity');
  check(m.result.flags.customError===true&&m.result.validationMessage==='Expired',`custom error wins (${JSON.stringify(m.result)}).`);
  await method('setCustomValidity',['']);
  m=await method('clear');check(!m.error,`clear: ${m.error}`);await wait(60);f=await frame();
  check(metric(f,'md-otp-field','value')==='',`clear() empties the code (${metric(f,'md-otp-field','value')}).`);
  m=await method('reportValidity');check(m.result===false,'reportValidity reports the empty required code.');
  await wait(150);f=await frame();
  check(metric(f,'md-otp-field','validationMessage')==='Please enter the complete code.'&&metric(f,'md-otp-field','focusedIndex')===0,`reportValidity shows the message and focuses the first empty cell (${metric(f,'md-otp-field','validationMessage')}, ${metric(f,'md-otp-field','focusedIndex')}).`);
  await update({disabled:true});m=await method('checkValidity');check(m.result===true,'a disabled field is barred from validation.');
  u=await update({disabled:false,length:4,groupSize:2,validationType:'alphanumeric',transform:'uppercase',mask:true,density:-2,value:'ab1'});check(!u.error,`typed updates: ${u.error}`);
  await wait(60);f=await frame();
  check(metric(f,'md-otp-field','value')==='AB1'&&Boolean(part(f,'cell-3'))&&!part(f,'cell-4')&&Boolean(part(f,'separator-0')),`length, groups, transform (${metric(f,'md-otp-field','value')}).`);
  check(metric(f,'cell-0','secure')===true,'mask renders secure cells.');
  await method('setFocus');await wait(100);f=await frame();check(metric(f,'md-otp-field','focusedIndex')===3,`setFocus() focuses the first empty cell (${metric(f,'md-otp-field','focusedIndex')}).`);
  for(const bad of [{length:0},{validationType:'hex'},{bogus:1},{mask:'yes'},{value:12},{density:-5}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  m=await method('clear',[1]);check(Boolean(m.error),'clear rejects arguments.');
  m=await method('setCustomValidity');check(Boolean(m.error),'setCustomValidity requires a message.');
  console.log(`md-otp-field live host: ${checks} checks passed`);
}finally{live?.close();}

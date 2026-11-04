import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-text-field: typed hooks, retained property updates and the synchronous methods with
// results (getValidity / checkValidity / reportValidity / setCustomValidity, setFocus, select) through AWCTextFieldController.
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
  let f=await configure('md-text-field',{properties:{label:'Email',type:'email',required:true,value:'',supportingText:'Work email',maxLength:40},
    textFieldAppearance:{labelColor:'#6A1B9A',containerColor:'#FFF3E0',focusInset:-2}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  check(String(metric(f,'label','color')).toUpperCase().startsWith('#6A1B9A'),`label hook colour (${metric(f,'label','color')}).`);
  check(String(metric(f,'container','background')).toUpperCase().startsWith('#FFF3E0'),`container hook colour (${metric(f,'container','background')}).`);
  let m=await method('getValidity');
  check(!m.error&&m.result?.valid===false&&m.result.flags.valueMissing===true&&m.result.validationMessage==='Please fill out this field.',`required empty field: ${JSON.stringify(m.result ?? m.error)}`);
  check(Object.keys(m.result.flags).length===10,'ten ValidityState flags.');
  await method('setCustomValidity',['Taken']);m=await method('getValidity');
  check(m.result.flags.customError===true&&m.result.validationMessage==='Taken',`custom error wins (${JSON.stringify(m.result)}).`);
  await method('setCustomValidity',['']);
  let u=await update({value:'ab'});check(!u.error,`update value: ${u.error}`);
  m=await method('getValidity');check(m.result.flags.typeMismatch===true&&m.result.validationMessage.startsWith("Please include an '@'"),`email type mismatch (${m.result.validationMessage}).`);
  await update({value:'a@b.co'});m=await method('checkValidity');check(m.result===true,`valid email checks valid (${m.result}).`);
  await update({value:''});m=await method('reportValidity');check(m.result===false,'reportValidity reports the empty required field.');
  await wait(150);f=await frame();
  check(metric(f,'md-text-field','validationMessage')==='Please fill out this field.'&&metric(f,'md-text-field','focused')===true,`reportValidity shows the message and focuses (${metric(f,'md-text-field','validationMessage')}, ${metric(f,'md-text-field','focused')}).`);
  await update({disabled:true});m=await method('checkValidity');check(m.result===true,'a disabled field is barred from validation.');
  await update({disabled:false,value:'hello@example.com'});await method('select');await wait(80);f=await frame();
  check(metric(f,'md-text-field','focused')===true,'select() focuses the input.');
  u=await update({variant:'outlined',density:-2,clearable:'internal',passwordToggle:false,multiline:false,minLength:null,min:'1'});check(!u.error,`typed updates: ${u.error}`);
  f=await frame();check(Boolean(node(f,'clear')),'clearable adds the clear button.');
  for(const bad of [{multiline:true},{bogus:1},{density:-5},{clearable:'yes'},{maxLength:-1}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  m=await method('select',[1]);check(Boolean(m.error),'select rejects arguments.');
  m=await method('getInputElement');check(Boolean(m.error),'getInputElement is not run by the preview.');
  console.log(`md-text-field live host: ${checks} checks passed`);
}finally{live?.close();}

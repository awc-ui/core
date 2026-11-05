import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-time-picker and md-color-picker: the overlay viewport, typed hooks, retained updates of
// source properties and the methods through AWCTimePickerController / AWCColorPickerController.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},9000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
let live,events=[];
const record=reply=>{events.push(...(reply.events??[]).map(e=>e.name));return reply;};
const configure=async (tag,fields={})=>{live?.close();live=host();events=[];return record(await live.call({command:'configure',tag,width:400,height:640,dark:false,...fields}));};
const method=async (name,args=[])=>record(await live.call({command:'method',method:name,arguments:args}));
const update=async properties=>record(await live.call({command:'update',properties}));
const frame=async ()=>record(await live.call({command:'frame'}));
const named=(f,name)=>{const nodes=f.inspection?.nodes??[];return nodes.find(item=>item.name===name&&item.metrics)??nodes.find(item=>item.name===name||item.id===`component.${name}`||item.id?.endsWith(`.${name}`));};
const listing=f=>JSON.stringify((f.inspection?.nodes??[]).map(n=>`${n.id}/${n.name}`)).slice(0,1500);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  // md-time-picker: viewport, hooks, show() / hide() (Cancel), validity methods with results, retained updates.
  let f=await configure('md-time-picker',{properties:{label:'Meeting time',value:'14:30',required:true,variant:'dial'},timePickerAppearance:{dialSize:'240px',dialHandColor:'#123456'}});
  check(!f.error,`configure md-time-picker: ${f.error}`);
  f=await frame();check(named(f,'md-time-picker')?.metrics?.open===false,'closed after configure.');
  let m=await method('show');check(!m.error,`show: ${m.error}`);await wait(700);f=await frame();
  check(named(f,'md-time-picker')?.metrics?.open===true,'show() opens the dialog.');
  check(near(named(f,'dial')?.bounds?.width,240),`dial-size hook (${named(f,'dial')?.bounds?.width}): ${listing(f)}`);
  const dialog=named(f,'dialog')?.bounds;check(dialog&&near(dialog.x+dialog.width/2,200,2),`the dialog centres in the 400-wide viewport (${JSON.stringify(dialog)}).`);
  check(events.includes('mdOpen'),`show() emits mdOpen (${events}).`);
  m=await method('hide');check(!m.error,`hide: ${m.error}`);await wait(500);f=await frame();
  check(named(f,'md-time-picker')?.metrics?.open===false,'hide() closes the dialog.');
  check(events.includes('mdCancel')&&events.indexOf('mdCancel')<events.lastIndexOf('mdClose'),`hide() is Cancel: mdCancel then mdClose (${events}).`);
  m=await method('checkValidity');check(m.result===true,`a value satisfies required (${JSON.stringify(m.result)}).`);
  let u=await update({value:''});check(!u.error,`update value: ${u.error}`);await wait(60);
  m=await method('getValidity');check(m.result?.valid===false&&m.result?.flags?.valueMissing===true&&m.result?.validationMessage.length>0,`getValidity (${JSON.stringify(m.result)}).`);
  m=await method('checkValidity');check(m.result===false,'checkValidity is false when empty and required.');
  m=await method('reportValidity');check(m.result===false,'reportValidity is false when empty and required.');
  u=await update({disabled:true});await wait(60);m=await method('checkValidity');check(m.result===true,'a disabled picker is barred from validation.');
  u=await update({format:'24h',minuteStep:5,label:'Start',disabled:false});check(!u.error,`update source properties: ${u.error}`);
  for(const patch of [{format:'13h'},{minuteStep:'5'},{bogus:1}]){u=await update(patch);check(Boolean(u.error),`rejects ${JSON.stringify(patch)}.`);}
  m=await method('show',[1]);check(Boolean(m.error),'show rejects arguments.');
  m=await method('close');check(Boolean(m.error),'close() is not a time picker method.');

  // md-color-picker: hooks on the inline panel; show() / close() on a popover (the Laboratory example has no trigger, so the
  // popover is checked through its mdOpenChange events); retained updates.
  f=await configure('md-color-picker',{properties:{value:'#6750A4',presets:['#6750A4','#386A20'],showHex:true},colorPickerAppearance:{width:320,radius:12,surfaceColor:'#FFF3E0'}});
  check(!f.error,`configure md-color-picker: ${f.error}`);
  await wait(150);f=await frame();
  check(near(named(f,'panel')?.bounds?.width,320),`width hook (${named(f,'panel')?.bounds?.width}): ${listing(f)}`);
  check(named(f,'presets'),'inline panel with presets.');
  m=await method('show');await wait(80);check(!events.includes('mdOpenChange'),'show() does nothing on an inline picker (source).');
  u=await update({variant:'popover'});check(!u.error,`update variant: ${u.error}`);await wait(80);
  m=await method('show');check(!m.error,`show: ${m.error}`);await wait(400);await frame();
  check(events.filter(e=>e==='mdOpenChange').length===1,`show() opens the popover: one mdOpenChange (${events}).`);
  m=await method('close');await wait(150);await frame();
  check(events.filter(e=>e==='mdOpenChange').length===2,`close() closes it: a second mdOpenChange (${events}).`);
  u=await update({disabled:true});await method('show');await wait(80);await frame();
  check(events.filter(e=>e==='mdOpenChange').length===2,'show() does nothing while disabled (source).');
  for(const patch of [{variant:'dialog'},{presets:[1]},{open:'yes'}]){u=await update(patch);check(Boolean(u.error),`rejects ${JSON.stringify(patch)}.`);}
  m=await method('hide');check(Boolean(m.error),'hide() is not a colour picker method.');
  console.log(`pickers live host: ${checks} checks passed`);
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-date-picker: the overlay viewport, the hook map, retained updates of source properties and the
// methods through AWCDatePickerController (show, close, clear, focusInput, constraint validation with results).
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
  // Modal-input (the default variant): viewport, hooks, show() / close(), clear(), validity methods with results, updates.
  let f=await configure('md-date-picker',{properties:{label:'Start date',value:'2026-10-07',required:true},datePickerAppearance:{panelWidth:'340px',daySelectedBg:'#386A20'}});
  check(!f.error,`configure md-date-picker: ${f.error}`);
  f=await frame();check(named(f,'md-date-picker')?.metrics?.open===false,`closed after configure: ${listing(f)}`);
  let m=await method('show');check(!m.error,`show: ${m.error}`);await wait(700);f=await frame();
  check(named(f,'md-date-picker')?.metrics?.open===true,'show() opens the dialog.');
  const panel=named(f,'panel')?.bounds;
  check(panel&&near(panel.width,340),`panel-width hook (${JSON.stringify(panel)}): ${listing(f)}`);
  check(panel&&near(panel.x+panel.width/2,200,2),`the dialog centres in the 400-wide viewport (${JSON.stringify(panel)}).`);
  check((f.inspection?.nodes??[]).filter(n=>n.name==='day').length===42,'the calendar shows six weeks of days.');
  check(events.includes('mdOpen'),`show() emits mdOpen (${events}).`);
  m=await method('close');check(!m.error,`close: ${m.error}`);await wait(600);f=await frame();
  check(named(f,'md-date-picker')?.metrics?.open===false,'close() closes the dialog.');
  check(events.includes('mdClose')&&!events.includes('mdChange'),`close() commits nothing: mdClose without mdChange (${events}).`);
  m=await method('checkValidity');check(m.result===true,`a value satisfies required (${JSON.stringify(m.result)}).`);
  m=await method('getValidity');check(m.result?.valid===true&&Object.keys(m.result?.flags??{x:1}).length===0,`getValidity when valid (${JSON.stringify(m.result)}).`);
  m=await method('clear');check(!m.error,`clear: ${m.error}`);await wait(80);
  check(events.includes('mdChange'),`clear() emits mdChange (${events}).`);
  m=await method('getValidity');check(m.result?.valid===false&&m.result?.flags?.valueMissing===true&&m.result?.validationMessage==='Please choose a date.',`getValidity when empty and required (${JSON.stringify(m.result)}).`);
  check(events.includes('mdValidityChange'),`the validity change is reported (${events}).`);
  m=await method('checkValidity');check(m.result===false,'checkValidity is false when empty and required.');
  m=await method('reportValidity');check(m.result===false,'reportValidity is false when empty and required.');await wait(120);
  let u=await update({value:'2026-10-08'});check(!u.error,`update value: ${u.error}`);await wait(60);
  m=await method('checkValidity');check(m.result===true,'a new value is valid again.');
  m=await method('setCustomValidity',['Choose a weekday.']);check(!m.error,`setCustomValidity: ${m.error}`);await wait(40);
  m=await method('getValidity');check(m.result?.valid===false&&m.result?.flags?.customError===true&&m.result?.validationMessage==='Choose a weekday.',`a custom message makes the picker invalid (${JSON.stringify(m.result)}).`);
  m=await method('setCustomValidity',['']);await wait(40);m=await method('checkValidity');check(m.result===true,'an empty custom message clears it.');
  u=await update({value:'',disabled:true});await wait(60);m=await method('checkValidity');check(m.result===true,'a disabled picker is barred from validation.');
  u=await update({disabled:false,value:'2026-10-07',firstDayOfWeek:1,locale:'de-DE',label:'Start',clearable:true,density:-2});check(!u.error,`update source properties: ${u.error}`);
  for(const patch of [{variant:'inline'},{firstDayOfWeek:9},{open:'yes'},{isDateDisabled:'x'},{bogus:1}]){u=await update(patch);check(Boolean(u.error),`rejects ${JSON.stringify(patch)}.`);}
  m=await method('show',[1]);check(Boolean(m.error),'show rejects arguments.');
  m=await method('setCustomValidity',[]);check(Boolean(m.error),'setCustomValidity requires its message.');
  m=await method('hide');check(Boolean(m.error),'hide() is not a date picker method.');
  m=await method('focusInput');check(!m.error,`focusInput: ${m.error}`);

  // Docked: the panel opens under the field inside the viewport; a retained `open` update closes it.
  f=await configure('md-date-picker',{properties:{label:'Due',value:'2026-10-07',variant:'docked'},datePickerAppearance:{dockedPanelWidth:'330px'}});
  check(!f.error,`configure docked: ${f.error}`);
  m=await method('show');check(!m.error,`show (docked): ${m.error}`);await wait(700);f=await frame();
  const docked=named(f,'panel')?.bounds,field=named(f,'field')?.bounds;
  check(docked&&near(docked.width,330),`docked-panel-width hook (${JSON.stringify(docked)}): ${listing(f)}`);
  check(docked&&field&&docked.y>=field.y+field.height&&near(docked.x,24,1),`the docked panel sits under the field, 24 px in (${JSON.stringify(docked)} / ${JSON.stringify(field)}).`);
  check(named(f,'month-menu-button')&&named(f,'year-menu-button'),'the docked panel has the month and year list buttons.');
  u=await update({open:false});check(!u.error,`update open: ${u.error}`);await wait(600);f=await frame();
  check(named(f,'md-date-picker')?.metrics?.open===false,'open = false closes the docked panel.');
  console.log(`Native live date picker checks passed: ${checks}`);
}finally{live?.close();}

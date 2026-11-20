import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-select / md-multi-select (gate 3): typed hooks, retained property updates and the controller
// methods with results (getValidity / checkValidity / reportValidity / setCustomValidity, getLabels, show / close, setQuery,
// loadOptions, reset, focusTrigger) through AWCSelectController / AWCMultiSelectController.
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
const nodes=frame=>frame.inspection?.nodes ?? [];
const named=(frame,name)=>nodes(frame).filter(item=>item.name===name);
const metric=(frame,name,key)=>{const n=named(frame,name).find(item=>item.metrics);const v=n?.metrics?.[key];return v&&typeof v==='object'&&!Array.isArray(v)&&'value' in v?v.value:v;};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const options=[{label:'London',value:'london'},{label:'Paris',value:'paris'},{label:'Tokyo',value:'tokyo'}];
try{
  // md-select
  let f=await configure('md-select',{properties:{label:'City',required:true,value:'',options,filterable:true},selectAppearance:{caretSize:30,caretColor:'#B3261E'}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  const caret=named(f,'caret')[0];
  check(caret&&Math.abs(caret.bounds.width-30)<0.5&&Math.abs(caret.bounds.height-30)<0.5,`caret size hook (${JSON.stringify(caret?.bounds)}).`);
  let m=await method('getValidity');
  check(!m.error&&m.result?.valid===false&&m.result.flags.valueMissing===true&&m.result.validationMessage==='Please select an item in the list.',`required empty select: ${JSON.stringify(m.result ?? m.error)}`);
  await method('setCustomValidity',['Pick one']);m=await method('getValidity');
  check(m.result.flags.customError===true&&m.result.validationMessage==='Pick one',`custom error (${JSON.stringify(m.result)}).`);
  await method('setCustomValidity',['']);
  let u=await update({value:'paris'});check(!u.error,`update value: ${u.error}`);
  f=await frame();check(metric(f,'md-select','value')==='paris'&&metric(f,'md-select','displayText')==='Paris',`value update shows Paris (${metric(f,'md-select','displayText')}).`);
  m=await method('checkValidity');check(m.result===true,'a chosen value is valid.');
  m=await method('getLabels',[['london','tokyo','nowhere']]);
  check(!m.error&&JSON.stringify(m.result?.awcSelectLabels ?? m.result)===JSON.stringify({london:'London',tokyo:'Tokyo'}),`getLabels (${JSON.stringify(m.result ?? m.error)}).`);
  const closedHeight=f.logicalHeight;
  await method('show');await wait(500);f=await frame();
  check(metric(f,'md-select','open')===true,'show() opens the menu.');
  const openHeight=f.logicalHeight;
  check(openHeight>=closedHeight+3*40,`the open menu renders in flow below the field (${closedHeight} → ${openHeight}).`);
  await method('setQuery',['to']);await wait(250);f=await frame();
  check(f.logicalHeight<=openHeight-2*40,`setQuery filters the rows to Tokyo (${openHeight} → ${f.logicalHeight}).`);
  await method('close');await wait(500);f=await frame();check(metric(f,'md-select','open')===false,'close() closes the menu.');
  await method('loadOptions',[[{value:'oslo',label:'Oslo'},{value:'lisbon',label:'Lisbon',disabled:true}]]);
  m=await method('getLabels',[['oslo','london']]);check(JSON.stringify(m.result?.awcSelectLabels ?? m.result)===JSON.stringify({oslo:'Oslo'}),`loadOptions replaces the options (${JSON.stringify(m.result)}).`);
  await method('reset');await wait(80);f=await frame();check(metric(f,'md-select','value')==='',`reset clears the value (${metric(f,'md-select','value')}).`);
  m=await method('reportValidity');check(m.result===false,'reportValidity reports the empty required select.');
  await wait(150);f=await frame();
  check(metric(f,'md-select','validationMessage')==='Please select an item in the list.',`reportValidity shows the message (${metric(f,'md-select','validationMessage')}).`);
  await method('focusTrigger');await wait(100);f=await frame();check(metric(f,'md-select','focused')===true,'focusTrigger() focuses the field.');
  u=await update({variant:'filled',density:-2,clearable:true,placement:'top-start',maxHeight:'12rem',disabled:false,options:'[{"value":"a","label":"A"}]'});check(!u.error,`typed updates: ${u.error}`);
  for(const bad of [{virtualize:'never'},{density:-5},{options:[{value:1}]},{value:['a']},{bogus:1},{filterMode:'prefix'}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  for(const [name,args] of [['show',[1]],['getLabels',['x']],['setQuery',[]],['loadOptions',[[{value:2}]]]]){m=await method(name,args);check(Boolean(m.error),`${name} rejects ${JSON.stringify(args)}.`);}
  // md-multi-select
  f=await configure('md-multi-select',{properties:{label:'Cities',value:['london'],options,required:true},multiSelectAppearance:{chipHeight:'28px'}});
  check(!f.error,`configure multi: ${f.error}`);f=await frame();
  const chip=named(f,'chip')[0];check(chip&&Math.abs(chip.bounds.height-28)<0.5,`chip height hook (${JSON.stringify(chip?.bounds)}).`);
  m=await method('getLabels',[['london','paris']]);check(JSON.stringify(m.result?.awcSelectLabels ?? m.result)===JSON.stringify({london:'London',paris:'Paris'}),`multi getLabels (${JSON.stringify(m.result)}).`);
  u=await update({value:['london','paris'],displayMode:'count',maxSelected:2});check(!u.error,`multi updates: ${u.error}`);
  f=await frame();check(JSON.stringify(metric(f,'md-multi-select','value'))===JSON.stringify(['london','paris']),`multi value (${JSON.stringify(metric(f,'md-multi-select','value'))}).`);
  m=await method('checkValidity');check(m.result===true,'multi with values is valid.');
  await method('reset');await wait(80);m=await method('getValidity');check(m.result.valid===false&&m.result.flags.valueMissing===true,`multi reset → required empty (${JSON.stringify(m.result)}).`);
  await method('show');await wait(500);f=await frame();check(metric(f,'md-multi-select','open')===true,'multi show().');
  await method('close');await wait(500);
  for(const bad of [{value:'london'},{displayMode:'list'},{countFormatter:'x'},{maxHeight:'12rem'}]){u=await update(bad);check(Boolean(u.error),`multi rejects ${JSON.stringify(bad)}.`);}
  console.log(`md-select / md-multi-select live host: ${checks} checks passed`);
}finally{live?.close();}

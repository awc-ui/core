import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-autocomplete: typed hooks, retained property updates and the nine methods with results
// (focusInput, showMenu, closeMenu, loadOptions, getLabels, getValidity / checkValidity / reportValidity / setCustomValidity)
// through AWCAutocompleteController; the suggestions present in the preview's AWCMenuScope.
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
const fruit=[{value:'a',label:'Apple'},{value:'b',label:'Apricot'},{value:'c',label:'Avocado',disabled:true},{value:'d',label:'Banana'}];
try{
  // value '' overrides the Laboratory sample's value; the hooks: local width 300, the defaults' minimum width 320 wins over it.
  let f=await configure('md-autocomplete',{properties:{label:'Fruit',options:fruit,required:true,supportingText:'Pick one',value:''},
    autocompleteAppearance:{width:300,caretColor:'#C62828'},autocompleteAppearanceDefaults:{minWidth:320,width:260}});
  check(!f.error,`configure: ${f.error}`);
  f=await frame();
  check(Math.abs((part(f,'md-autocomplete')?.bounds.width ?? 0)-320)<=0.5,`width hook (local 300) never below the defaults' minimum width 320 (${part(f,'md-autocomplete')?.bounds.width}).`);
  check(Math.abs((part(f,'caret')?.bounds.width ?? 0)-24)<=0.5,`the caret keeps its 24 box (${part(f,'caret')?.bounds.width}).`);
  let u0=await update({value:'a'});await wait(60);f=await frame();
  check(metric(f,'md-autocomplete','inputValue')==='Apple',`a value shows its label (${metric(f,'md-autocomplete','inputValue')}).`);
  await update({value:''});await wait(60);f=await frame();
  check(metric(f,'md-autocomplete','open')===false&&metric(f,'md-autocomplete','value')==='',`initial state (${metric(f,'md-autocomplete','open')}, ${JSON.stringify(metric(f,'md-autocomplete','value'))}).`);
  let m=await method('showMenu');check(!m.error,`showMenu: ${m.error}`);await wait(260);f=await frame();
  check(metric(f,'md-autocomplete','open')===true,'showMenu() opens the suggestions.');
  check(metric(f,'md-autocomplete','status')==='4 suggestions available',`status (${metric(f,'md-autocomplete','status')}).`);
  check(metric(f,'md-autocomplete','focused')===false,'showMenu() does not move focus.');
  m=await method('closeMenu');check(!m.error,`closeMenu: ${m.error}`);await wait(260);f=await frame();
  check(metric(f,'md-autocomplete','open')===false,'closeMenu() closes the suggestions.');
  m=await method('loadOptions',[[{value:'kiwi'},{value:'lime',label:'Lime',supportingText:'Citrus'}]]);check(!m.error,`loadOptions: ${m.error}`);
  await method('showMenu');await wait(260);f=await frame();
  check(metric(f,'md-autocomplete','status')==='2 suggestions available',`loadOptions replaces the list (${metric(f,'md-autocomplete','status')}).`);
  await method('closeMenu');await wait(200);
  m=await method('getLabels',[['lime','kiwi','zz']]);
  check(m.result?.awcAutocompleteLabels?.lime==='Lime'&&m.result.awcAutocompleteLabels.kiwi==='kiwi'&&m.result.awcAutocompleteLabels.zz==='zz',`getLabels (${JSON.stringify(m.result)}).`);
  m=await method('getValidity');
  check(m.result?.valid===false&&m.result.flags.valueMissing===true&&m.result.validationMessage==='Please make a selection',`required without a value: ${JSON.stringify(m.result)}`);
  await method('setCustomValidity',['Out of season']);m=await method('getValidity');
  check(m.result.flags.customError===true&&m.result.validationMessage==='Out of season',`custom error wins (${JSON.stringify(m.result)}).`);
  await method('setCustomValidity',['']);m=await method('checkValidity');check(m.result===false,'checkValidity reports the empty required autocomplete.');
  m=await method('reportValidity');check(m.result===false,'reportValidity returns false.');
  await wait(150);f=await frame();
  check(metric(f,'md-autocomplete','validationMessage')==='Please make a selection'&&metric(f,'md-autocomplete','focused')===true,`reportValidity shows the message and focuses (${metric(f,'md-autocomplete','validationMessage')}, ${metric(f,'md-autocomplete','focused')}).`);
  let u=await update({value:'lime'});check(!u.error,`update value: ${u.error}`);await wait(80);f=await frame();
  check(metric(f,'md-autocomplete','inputValue')==='Lime',`a programmatic value shows its label (${metric(f,'md-autocomplete','inputValue')}).`);
  m=await method('checkValidity');check(m.result===true,'a value satisfies required.');
  u=await update({options:[...fruit,{value:'e',label:'Elderberry'}]});await wait(60);m=await method('getLabels',[['a']]);
  check(m.result?.awcAutocompleteLabels?.a==='Apple',`an options update replaces the loaded list (${JSON.stringify(m.result)}).`);
  u=await update({multiple:true,value:['a','d'],chipPosition:'inline',density:-2,variant:'outlined',limitResults:2,maxSelected:3,statusTemplate:'{count} fruit',placement:'top-start',maxHeight:null,clearOnBlur:true});
  check(!u.error,`typed updates: ${u.error}`);await wait(120);f=await frame();
  check(f.inspection.nodes.filter(n=>n.name==='chip').length===2,`two chips (${f.inspection.nodes.filter(n=>n.name==='chip').length}).`);
  check(JSON.stringify(metric(f,'md-autocomplete','value'))==='["a","d"]',`multiple value (${JSON.stringify(metric(f,'md-autocomplete','value'))}).`);
  await method('showMenu');await wait(260);f=await frame();
  check(metric(f,'md-autocomplete','status')==='2 fruit',`limitResults + statusTemplate (${metric(f,'md-autocomplete','status')}).`);
  await method('closeMenu');await wait(200);
  u=await update({loading:true});await wait(80);f=await frame();check(Boolean(part(f,'loading-spinner'))&&!part(f,'caret'),'the spinner replaces the caret while loading.');
  await method('focusInput');await wait(80);f=await frame();check(metric(f,'md-autocomplete','focused')===true,'focusInput() focuses the input.');
  for(const bad of [{chipPosition:'bottom'},{bogus:1},{density:-5},{value:3},{options:[{label:'No value'}]},{options:['kiwi']},{limitResults:-1},{filterer:'x'},{virtualize:'always'}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  m=await method('loadOptions',['kiwi']);check(Boolean(m.error),'loadOptions rejects a non-array.');
  m=await method('getLabels',[[1]]);check(Boolean(m.error),'getLabels rejects non-string values.');
  m=await method('showMenu',[1]);check(Boolean(m.error),'showMenu rejects arguments.');
  m=await method('setCustomValidity',[]);check(Boolean(m.error),'setCustomValidity requires a message.');
  console.log(`md-autocomplete live host: ${checks} checks passed`);
}finally{live?.close();}

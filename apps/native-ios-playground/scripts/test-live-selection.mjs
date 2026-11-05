import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-switch, md-checkbox, md-radio and md-chip: dispatch, typed appearance,
// retained updates, the selection method controller (validation and focus) and mdValidityChange.
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
const names=reply=>(reply.events??[]).map(e=>e.name);
const report={};
try{
  // ---- md-switch: hooks, retained update, setFocus ring, report/custom validity with mdValidityChange.
  let f=await configure('md-switch',{properties:{selected:true,required:true},switchAppearance:{trackWidth:60,selectedTrackColor:'#123456'}});
  check(!f.error,`switch configure: ${f.error}`);
  let s=node(f,'md-switch');
  check(s&&near(s.metrics.trackWidth,60),`track width hook (${s?.metrics.trackWidth}).`);
  check(color(s.metrics.trackColor,'#123456'),`selected track colour hook (${s.metrics.trackColor}).`);
  let r=await method('getValidity');
  check(r.result?.valid===true&&r.result.flags.valueMissing===false&&Object.keys(r.result.flags).length===10,`selected required switch is valid (${JSON.stringify(r.result)}).`);
  r=await live.call({command:'update',properties:{selected:false}});
  check(!r.error,`switch update: ${r.error}`);
  f=await frame();
  check(names(r).concat(names(f)).includes('mdValidityChange'),`required switch turned off emits mdValidityChange (${names(r)} ${names(f)}).`);
  r=await method('checkValidity');check(r.result===false,`checkValidity false (${r.result}).`);
  f=await frame();s=node(f,'md-switch');check(s.metrics.focusRing===false,'checkValidity does not focus or reveal.');
  r=await method('reportValidity');check(r.result===false,`reportValidity false (${r.result}).`);
  f=await frame();s=node(f,'md-switch');check(s.metrics.focusRing===true&&s.metrics.focused===true,`reportValidity focuses with the ring (${s.metrics.focusRing}).`);
  r=await method('getValidity');
  check(r.result.validationMessage==='Please turn this on if you want to proceed.'&&r.result.flags.valueMissing,`default valueMissingLabel (${r.result.validationMessage}).`);
  r=await method('setCustomValidity',['Server rejected this']);
  f=await frame();const custom=[...(r.events??[]),...(f.events??[])].find(e=>e.name==='mdValidityChange');
  check(custom?.detail?.validationMessage==='Server rejected this'&&custom.detail.flags.customError===true,`custom message wins as customError (${JSON.stringify(custom?.detail)}).`);
  r=await live.call({command:'update',properties:{density:-7}});check(!!r.error,'invalid density rejected.');
  r=await method('setCustomValidity',[1]);check(!!r.error,'setCustomValidity requires a string.');
  report.switch=s.bounds;

  // ---- md-checkbox: hooks, report shows the support line, update to valid hides it.
  f=await configure('md-checkbox',{properties:{required:true},checkboxAppearance:{outlineWidth:3,containerSize:20}});
  let c=node(f,'md-checkbox');check(c&&c.metrics.support==='',`no support line at rest (${c?.metrics.support}).`);
  check(near(c.metrics.containerSize,20)&&near(c.metrics.outlineWidth,3),`checkbox hooks (${c.metrics.containerSize}/${c.metrics.outlineWidth}).`);
  r=await method('reportValidity');check(r.result===false,'checkbox reportValidity false.');
  f=await frame();c=node(f,'md-checkbox');
  check(c.metrics.support==='Please check this box if you want to proceed.',`support line shows the message (${c.metrics.support}).`);
  check(color(c.metrics.supportColor,'#B3261E'),`error colour (${c.metrics.supportColor}).`);
  r=await live.call({command:'update',properties:{checked:true}});f=await frame();
  c=node(f,'md-checkbox');check(c.metrics.support==='',`valid again hides the message (${c.metrics.support}).`);
  check(names(r).concat(names(f)).includes('mdValidityChange'),'checking emits mdValidityChange.');
  r=await method('setFocus');check(!!r.error,'md-checkbox has no setFocus.');

  // ---- md-radio: hooks, report, select(), setBlur/setFocus.
  f=await configure('md-radio',{properties:{name:'plan',value:'pro',required:true},radioAppearance:{iconSize:24,selectedIconColor:'#1B5E20'}});
  let d=node(f,'md-radio');check(d&&near(d.metrics.iconSize,24),`radio icon size hook (${d?.metrics.iconSize}).`);
  r=await method('reportValidity');check(r.result===false,'radio reportValidity false.');
  f=await frame();d=node(f,'md-radio');
  check(d.metrics.support==='Please select one of these options.'&&d.metrics.focusRing===true,`radio message and ring (${d.metrics.support}/${d.metrics.focusRing}).`);
  r=await method('setBlur');f=await frame();d=node(f,'md-radio');check(d.metrics.focused===false,'setBlur removes focus.');
  check(names(r).concat(names(f)).includes('mdBlur'),'setBlur emits mdBlur.');
  r=await method('select');f=await frame();
  const change=[...(r.events??[]),...(f.events??[])].find(e=>e.name==='mdChange');
  check(change?.detail?.checked===true&&change.detail.value==='pro',`select() checks and emits mdChange (${JSON.stringify(change?.detail)}).`);
  await new Promise(resolve=>setTimeout(resolve,400));f=await frame();
  d=node(f,'md-radio');check(d.metrics.checked===true&&d.metrics.support==='',`checked radio is valid (${d.metrics.support}).`);
  check(color(d.metrics.outerColor,'#1B5E20'),`selected icon colour hook (${d.metrics.outerColor}).`);
  r=await method('setFocus');f=await frame();d=node(f,'md-radio');check(d.metrics.focusRing===true,'setFocus shows the ring.');
  r=await method('syncValidityFromGroup');check(!r.error,'syncValidityFromGroup accepted.');
  r=await method('getValidity');check(r.result.valid===true,'radio valid after select.');

  // ---- md-chip: hooks (px lengths, shadow), retained updates, no methods.
  f=await configure('md-chip',{properties:{label:'Design',variant:'filter',icon:'palette'},chipAppearance:{containerHeight:40,outlineColor:'#FF0000',outlineWidth:2}});
  let k=node(f,'md-chip');check(k&&near(k.bounds.height,40),`container height hook (${JSON.stringify(k?.bounds)}).`);
  check(color(k.metrics.outlineColor,'#FF0000')&&near(k.metrics.outlineWidth,2),`outline hooks (${k.metrics.outlineColor}/${k.metrics.outlineWidth}).`);
  r=await live.call({command:'update',properties:{selected:true,appearance:'filled'}});f=await frame();k=node(f,'md-chip');
  check(!r.error&&k.metrics.selected===true,`retained chip update (${r.error}).`);
  r=await live.call({command:'update',properties:{variant:'choice'}});check(!!r.error,'invalid variant rejected.');
  r=await method('reportValidity');check(!!r.error,'md-chip has no methods.');
  report.chip=k.bounds;
  console.log(`Selection live host: ${checks}/${checks} checks passed`,JSON.stringify(report));
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI List live host: dispatch, typed appearance, retained updates,
// controller methods and pointer selection with the source payloads.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const events=(...frames)=>frames.flatMap(frame=>frame?.events??[]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
const report={};
try{
  // Dispatch: the dedicated list renderer with the Laboratory fixture (a single-select listbox of three rows).
  let frame=await configure('md-list',{properties:{}});
  check(!frame.error,`configure: ${frame.error}`);
  let list=node(frame,'md-list');
  check(list?.metrics?.role==='listbox',`A single-select list is a listbox (${JSON.stringify(list?.metrics?.role)}).`);
  check(JSON.stringify(list.metrics.padding)==='[8,0,8,0]'&&list.metrics.gap?.row===0&&list.metrics.gap?.column===0,'Schema padding has four edges and gap is {row, column}.');
  check(JSON.stringify(list.metrics.paddingBlockInline)==='[8,0]',`Source list padding 8 (${JSON.stringify(list.metrics.paddingBlockInline)}).`);
  report.default=list.bounds;
  // Typed appearance: list hooks (local over the subtree default) and inherited row spacing hooks.
  // The live inspection measures the root only, so rows are measured through the list height:
  // fixture rows are two-line (headline 24 + supporting text 20, min-height 72).
  frame=await configure('md-list',{properties:{},listAppearanceDefaults:{paddingBlock:4},listAppearance:{paddingBlock:20,paddingInline:6,containerColor:'#12345680'},listItemAppearance:{topSpace:24,bottomSpace:24}});
  list=node(frame,'md-list');
  check(JSON.stringify(list.metrics.paddingBlockInline)==='[20,6]',`Local list padding wins over the subtree default (${JSON.stringify(list.metrics.paddingBlockInline)}).`);
  check(near(list.bounds.height-report.default.height,24+3*(24+44+24-72)),`Padding 20 (+24) and inherited rows 24 + 44 + 24 (+20 each): ${list.bounds.height} vs ${report.default.height}.`);
  // Retained updates keep the instance and re-evaluate the list style.
  frame=await configure('md-list',{properties:{}});
  frame=await live.call({command:'update',properties:{listStyle:'segmented',density:-2}});
  check(frame.ack===true&&!frame.error,`Retained update: ${frame.error}`);
  await sleep(80);frame=await live.call({command:'frame'});list=node(frame,'md-list');
  check(list.metrics.contentGap===2&&JSON.stringify(list.metrics.paddingBlockInline)==='[0,0]',`Segmented gap 2 and no block padding (${list.metrics.contentGap}, ${JSON.stringify(list.metrics.paddingBlockInline)}).`);
  frame=await live.call({command:'update',properties:{listStyle:'standard',density:0}});await sleep(60);
  // Methods through the controller: roving activation, silent selection, the selected indices as the result.
  let step=await live.call({command:'method',method:'activateNext',arguments:[]});
  check(!step.error&&events(step).find(event=>event.name==='mdActivate')?.detail?.index===1,`activateNext moves from the initially active first row to the second (${JSON.stringify(events(step))}).`);
  step=await live.call({command:'method',method:'selectItem',arguments:[1]});
  check(!step.error&&!events(step).some(event=>event.name==='mdSelect'),`selectItem is silent (${JSON.stringify(events(step))}).`);
  step=await live.call({command:'method',method:'getSelectedIndices',arguments:[]});
  check(JSON.stringify(step.result)==='[1]',`getSelectedIndices returns [1] (${JSON.stringify(step.result)}).`);
  report.selected=step.result;
  // Pointer selection of the third row emits mdSelect with the source payload.
  frame=await live.call({command:'frame'});list=node(frame,'md-list');
  const row=(list.bounds.height-16)/3,point={x:list.bounds.x+60,y:list.bounds.y+8+row*2.5};
  await live.call({command:'pointer',phase:'move',...point});
  const down=await live.call({command:'pointer',phase:'down',...point});
  const up=await live.call({command:'pointer',phase:'up',...point});
  await sleep(80);frame=await live.call({command:'frame'});
  const select=events(down,up,frame).find(event=>event.name==='mdSelect');
  check(select?.detail?.index===2&&select.detail.selected===true&&typeof select.detail.item==='string',`Pointer selection payload (${JSON.stringify(select?.detail)}).`);
  report.select=select?.detail;
  step=await live.call({command:'method',method:'getSelectedIndices',arguments:[]});
  check(JSON.stringify(step.result)==='[2]',`Single selection moves to the clicked row (${JSON.stringify(step.result)}).`);
  for(const bad of [{listStyle:'plain'},{density:-5},{reorderable:'yes'},{headline:'x'}]){
    const response=await live.call({command:'update',properties:bad});check(Boolean(response.error),`Invalid update ${JSON.stringify(bad)} is rejected.`);
  }
  const badMethod=await live.call({command:'method',method:'selectItem',arguments:['1']});check(Boolean(badMethod.error),'selectItem rejects a non-index argument.');
  // md-list-item: item methods and retained updates on a standalone row.
  frame=await configure('md-list-item',{properties:{expandable:true,type:'text'},listItemAppearance:{containerColor:'#C8E6C9'}});
  check(!frame.error,`configure item: ${frame.error}`);
  let item=node(frame,'md-list-item');
  check(item?.metrics?.expanded===false,`A collapsed expandable row (${item?.metrics?.expanded}).`);
  step=await live.call({command:'method',method:'expand',arguments:[]});await sleep(450);frame=await live.call({command:'frame'});item=node(frame,'md-list-item');
  check(item.metrics.expanded===true&&!events(step,frame).some(event=>event.name==='mdExpand'),`expand() opens without mdExpand (${item.metrics.expanded}).`);
  step=await live.call({command:'method',method:'toggle',arguments:[]});await sleep(300);frame=await live.call({command:'frame'});item=node(frame,'md-list-item');
  check(item.metrics.expanded===false,`toggle() collapses (${item.metrics.expanded}).`);
  step=await live.call({command:'update',properties:{headline:'Renamed row',disabled:true}});check(step.ack===true&&!step.error,`Item retained update: ${step.error}`);
  step=await live.call({command:'method',method:'expand',arguments:[]});await sleep(300);frame=await live.call({command:'frame'});item=node(frame,'md-list-item');
  check(item.metrics.expanded===false,'expand() is a no-op on a disabled row.');
  step=await live.call({command:'method',method:'setFocus',arguments:[{focusVisible:true}]});check(!step.error,`setFocus: ${step.error}`);
  console.log(`Passed ${checks} actual SwiftUI List host, appearance, retained update, method and pointer selection checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

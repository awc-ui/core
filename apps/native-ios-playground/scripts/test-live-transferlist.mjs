import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI Transfer list live host: dispatch to the dedicated renderer, typed appearance, retained updates with the
// source property types, a pointer check on a row, the moveSelectedRight()/moveSelectedLeft() methods (mdChange + mdMove) and
// invalid updates rejected.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const root=frame=>frame.inspection?.nodes.find(item=>item.id==='component'&&item.name==='md-transfer-list');
const part=(frame,id)=>frame.inspection?.nodes.find(item=>item.id==='component.'+id);
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
const items=[{value:'a',label:'Analytics',description:'Dashboards'},{value:'b',label:'Billing'},{value:'c',label:'Calendar'}];
let live;
const configure=async (fields={})=>{live?.close();live=host();const frame=await live.call({command:'configure',tag:'md-transfer-list',width:900,dark:false,...fields});await sleep(450);return live.call({command:'frame'});};
const settle=async ()=>{await sleep(450);return live.call({command:'frame'});};
const report={};
try{
  // Dispatch: the dedicated renderer (two 360pt columns with their rows, the movers) at density 0.
  let frame=await configure({properties:{items,value:['c']}});
  check(!frame.error,`configure: ${frame.error}`);
  const base=root(frame)?.bounds, column=part(frame,'column-source')?.bounds;
  check(base&&base.width>=800&&column&&Math.abs(column.height-360)<1,`Dedicated renderer: host ${JSON.stringify(base)}, source column ${JSON.stringify(column)}.`);
  check(part(frame,'item-s:a')&&part(frame,'item-t:c'),'Rows are on their sides (value = target).');
  report.default={host:base,column};
  // Typed appearance: the column cap hook (local wins over the subtree default).
  frame=await configure({properties:{items,value:['c']},transferListAppearanceDefaults:{columnMaxBlock:300},transferListAppearance:{columnMaxBlock:240,itemPadding:{top:4,right:8,bottom:4,left:8}}});
  check(!frame.error,`appearance configure: ${frame.error}`);
  const capped=part(frame,'column-source')?.bounds;
  check(capped&&Math.abs(capped.height-240)<1,`columnMaxBlock 240 caps the column (${JSON.stringify(capped)}).`);
  report.columnMaxBlock=capped;
  // Retained updates: value moves a row across; density −4 shrinks the rows; the count template.
  frame=await configure({properties:{items,value:['c']}});
  let response=await live.call({command:'update',properties:{value:['a','c'],countTemplate:'{checked} of {total}'}});
  check(response.ack===true&&!response.error,`Retained update: ${response.error}`);
  frame=await settle();
  check(part(frame,'item-t:a')&&!part(frame,'item-s:a'),'value update moves Analytics to the target.');
  const row0=part(frame,'item-t:a')?.bounds;
  response=await live.call({command:'update',properties:{density:-4}});frame=await settle();
  const row4=part(frame,'item-t:a')?.bounds;
  check(row0&&row4&&row4.height<row0.height-8,`density −4 is denser (${row0?.height} → ${row4?.height}).`);
  // Pointer: a click on a source row checks it; moveSelectedRight() moves it with the source payloads.
  frame=await configure({properties:{items,value:['c']}});
  const b=part(frame,'item-s:b').bounds,point={x:b.x+b.width/2,y:b.y+b.height/2};
  const click=[await live.call({command:'pointer',phase:'move',...point}),await live.call({command:'pointer',phase:'down',...point}),await live.call({command:'pointer',phase:'up',...point})];
  click.push(await settle());
  check(click.every(c=>!c.error),`pointer: ${click.map(c=>c.error).filter(Boolean).join(', ')}`);
  const moved=[await live.call({command:'method',method:'moveSelectedRight',arguments:[]})];moved.push(await settle());
  check(moved.every(c=>!c.error),`method: ${moved.map(c=>c.error).filter(Boolean).join(', ')}`);
  const change=events(...click,...moved).filter(e=>e.name==='mdChange'),move=events(...click,...moved).filter(e=>e.name==='mdMove');
  check(change.length===1&&JSON.stringify(change[0].detail)==='["c","b"]',`moveSelectedRight() emits mdChange ["c","b"] (${JSON.stringify(change)}).`);
  check(move.length===1&&move[0].detail?.direction==='right'&&JSON.stringify(move[0].detail.moved)==='["b"]'&&JSON.stringify(move[0].detail.target)==='["c","b"]',`mdMove payload (${JSON.stringify(move)}).`);
  check(part(moved.at(-1),'item-t:b'),'Billing is on the target side.');
  report.move=move[0]?.detail;
  // moveSelectedLeft() with nothing checked: no events.
  const none=[await live.call({command:'method',method:'moveSelectedLeft',arguments:[]})];none.push(await settle());
  check(events(...none).filter(e=>e.name.startsWith('md')).length===0,'moveSelectedLeft() with nothing checked emits nothing.');
  const bad=await live.call({command:'method',method:'moveSelectedRight',arguments:[1]});check(Boolean(bad.error),'Methods take no arguments.');
  for(const patch of [{items:3},{value:'b'},{value:[1]},{searchable:'false'},{density:-5},{sourceTitle:3},{open:true}]){
    response=await live.call({command:'update',properties:patch});check(Boolean(response.error),`Invalid update ${JSON.stringify(patch)} is rejected.`);
  }
  console.log(`Passed ${checks} actual SwiftUI Transfer list host, appearance, retained update, pointer and method checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

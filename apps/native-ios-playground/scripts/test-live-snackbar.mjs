import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<.05;
const node=(frame,part)=>frame.inspection?.nodes.find(item=>item.id===(part ? `component.${part}`:'component'));
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
let live;
const configure=async fields=>{
  live?.close();live=host();
  return live.call({command:'configure',tag:'md-snackbar',width:640,dark:false,...fields});
};
try{
  let frame=await configure({width:800,height:310,properties:{open:true,message:'Escape without focus',closeable:true,autoHide:false}});
  await sleep(300);
  frame=await live.call({command:'key',key:'Escape'});
  check(!(frame.events??[]).some(e=>e.name==='mdClose'),'Unfocused Escape preserves source ripple feedback.');
  await sleep(220);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail?.reason==='close'),'Window-level Escape dismisses without prior Tab or focused native control.');
  frame=await configure({width:800,height:310,properties:{open:false,message:'Your changes are saved',action:'Undo',closeable:true,autoHide:false}});
  check(!frame.error&&frame.logicalWidth===800&&frame.logicalHeight===310,'Requested canvas dimensions are the real native overlay viewport.');
  let serial=0;
  const method=async(name,args=[])=>{
    const callId=`snackbar-${++serial}`;
    const accepted=await live.call({command:'method',target:'component',callId,method:name,arguments:args});
    check(accepted.ack===true&&accepted.methodCall?.status==='accepted'&&accepted.png===undefined,`${name} receives correlated acceptance without a frame.`);
    let result;
    for(let i=0;i<30;i++){result=await live.call({command:'method-results',callIds:[callId],acknowledged:[]});if(result.methodResults?.[0]?.status!=='pending')break;await sleep(10);}
    check(result.methodResults?.[0]?.status==='fulfilled',`${name} confirms applied native method state.`);
    await live.call({command:'method-results',callIds:[],acknowledged:[callId]});
    return [...(accepted.events??[]),...(result.events??[])];
  };
  const opened=await method('show');await sleep(320);frame=await live.call({command:'frame'});
  check(opened.filter(e=>e.name==='mdOpen').length===1&&opened.find(e=>e.name==='mdOpen').detail===null,'Public show emits exactly one null mdOpen.');
  check(near(node(frame,'surface')?.bounds.x,256)&&near(node(frame,'surface')?.bounds.y,238)&&near(node(frame,'surface')?.bounds.width,288)&&near(node(frame,'surface')?.bounds.height,48),'Default surface uses source desktop position and dimensions in the actual310pt viewport.');
  for(const properties of [{},{open:1},{message:null},{density:1},{position:'left'},{politeness:'off'},{autoHideDuration:'10'},{unknown:true},{dismissLabel:'x'.repeat(4097)}]){
    check(Boolean((await live.call({command:'update',properties})).error),'Invalid retained Snackbar patch is rejected atomically.');
  }
  check(Boolean((await live.call({command:'update',properties:{open:false},height:99})).error),'Retained property patches cannot mutate viewport configuration.');
  const patch={open:true,message:'Retained message',action:'Restore',closeable:true,autoHide:false,autoHideDuration:300,position:'top-end',stacked:true,politeness:'assertive',dismissLabel:'Închide',density:-2};
  check((await live.call({command:'update',properties:patch})).ack===true,'All11 source properties update the retained root.');
  frame=await live.call({command:'frame'});
  check(near(node(frame,'surface')?.bounds.x,492)&&near(node(frame,'surface')?.bounds.y,20)&&near(node(frame,'surface')?.bounds.height,90),'Retained position, density and stacked properties change actual geometry.');
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Non-open retained edits do not remount or replay mdOpen.');
  const closed=await method('hide',['action']);
  check(closed.filter(e=>e.name==='mdClose').length===1&&closed.find(e=>e.name==='mdClose').detail?.reason==='action','Public hide preserves the exact selected close reason.');
  check((await live.call({command:'update',properties:{open:true,position:'bottom',stacked:false,density:0,autoHide:false,autoHideDuration:180}})).ack===true,'Retained open starts a fresh cycle.');
  await sleep(300);frame=await live.call({command:'frame'});
  const a=node(frame,'actions').bounds;
  frame=await live.call({command:'click',x:a.x+a.width/2,y:a.y+a.height/2});
  check((frame.events??[]).some(e=>e.name==='mdAction'&&e.detail===null),'Actual pointer click on fallback action emits null mdAction.');
  await sleep(260);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail?.reason==='auto'),'Fallback action restarts timer even with autoHide false; real focus handling does not cancel it.');
  await live.call({command:'update',properties:{autoHide:true,autoHideDuration:600,open:true}});await sleep(300);frame=await live.call({command:'frame'});
  const surf=node(frame,'surface').bounds;
  await live.call({command:'pointer',phase:'move',x:surf.x+20,y:surf.y+20});await sleep(700);frame=await live.call({command:'frame'});
  check(!(frame.events??[]).some(e=>e.name==='mdClose'),'Actual forwarded pointer entry pauses auto-hide.');
  await live.call({command:'pointer',phase:'leave',x:0,y:0});await sleep(700);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail?.reason==='auto'),'Pointer exit starts a full fresh duration.');
  await live.call({command:'update',properties:{autoHide:false,open:true,closeable:true}});await sleep(300);
  await live.call({command:'key',key:'Tab'});frame=await live.call({command:'key',key:'Escape'});
  check(!(frame.events??[]).some(e=>e.name==='mdClose'),'Native Escape waits for source ripple feedback.');
  await sleep(220);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail?.reason==='close'),'Actual focused native Escape closes with exact reason.');
  for(const fields of [{method:'hide',arguments:['invalid']},{method:'show',arguments:['close']},{method:'hide',arguments:[null]},{method:'whenClosed',arguments:[]}]){
    check(Boolean((await live.call({command:'method',target:'component',callId:`bad-${++serial}`,...fields})).error),'Invalid native method contracts are rejected.');
  }
  // Resizing changes only the retained viewport, including a pending deadline.
  await live.call({command:'update',properties:{open:true,autoHide:true,autoHideDuration:1400,position:'bottom',stacked:false,density:0}});
  await sleep(550);
  frame=await live.call({command:'resize',width:360,height:480});
  check(frame.ack===true&&typeof frame.png==='string'&&frame.logicalWidth===360&&frame.logicalHeight===480,'Retained resize ACK contains the committed replacement frame.');
  check(near(node(frame,'surface')?.bounds.x,16)&&near(node(frame,'surface')?.bounds.width,328)&&near(node(frame,'surface')?.bounds.y,416),'Retained resize recomputes compact position using the real new viewport.');
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Resize does not remount or replay opening.');
  for(const bad of [{width:0,height:480},{width:360,height:-1},{width:360},{width:360,height:480,properties:{open:false}}])check(Boolean((await live.call({command:'resize',...bad})).error),'Invalid resize rejects atomically.');
  await sleep(950);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail?.reason==='auto'),'Resize preserves the original timer deadline.');
  check(frame.logicalWidth===360&&frame.logicalHeight===480,'Rejected resize leaves committed geometry unchanged.');
  for(const height of [1,90,480,5000]){
    frame=await configure({width:800,height,properties:{autoHide:false}});
    check(frame.logicalHeight===Math.min(2000,height)&&frame.logicalWidth===800,'Actual requested canvas height survives intrinsic fitting and bounded allocation.');
  }
  frame=await configure({width:1200,height:5000,properties:{autoHide:false}});
  check(frame.logicalHeight===1666,'Large native surfaces respect the shared2M logical pixel budget.');
  for(const height of [0,-1]){frame=await configure({height});check(Boolean(frame.error),'Nonpositive height rejects before creating a host.');}
  frame=await configure({width:360,height:480,properties:{message:'A compact native notification',autoHide:false},snackbarAppearanceDefaults:{containerColor:'#22556699',minWidth:{points:400}},snackbarAppearance:{messageColor:'#DDCCAA88',actionColor:'#CC3377CC',closeColor:'#33EEAA80',maxWidth:{points:440},containerShape:{topLeft:{x:{points:20},y:{points:8}},topRight:{x:{points:4},y:{points:12}}}}});
  await sleep(350);frame=await live.call({command:'frame'});
  check(near(node(frame,'surface')?.bounds.width,328)&&near(node(frame,'surface')?.bounds.x,16),'Compact viewport fills available width and overrides desktop width hooks.');
}finally{live?.close();}
console.log(`Passed ${checks} actual SwiftUI Snackbar host, retained updates, methods, viewport, pointer, keyboard and timing checks.`);

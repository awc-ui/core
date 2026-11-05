import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseDialogAppearanceInput,parseBottomSheetAppearanceInput,parseSideSheetAppearanceInput} from '../../native-playground/modal-appearance.js';

// Actual SwiftUI modal live host: md-dialog, md-bottom-sheet and md-side-sheet present in the preview's own viewport
// through AWCModalScope, with typed appearance (Studio wire values), retained updates, correlated lifecycle methods,
// window-level Escape and pointer dismissal, and the source events.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=1)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const names=list=>list.map(e=>e.name);
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
const node=(frame,part)=>frame.inspection?.nodes.find(item=>item.id===`component.${part}`);
let live,events=[];
const call=async message=>{const reply=await live.call(message);events.push(...(reply.events??[]));return reply;};
const configure=async(tag,fields={})=>{live?.close();live=host();events=[];return call({command:'configure',tag,dark:false,...fields});};
const settle=async(ms=480)=>{await sleep(ms);return call({command:'frame'});};
// Exit motions differ (dialog 300 ms, sheets longer): poll until the surface has left, at most 1.6 s.
// Removal after the exit motion is an asynchronous boundary: under CPU load each captured frame can take far longer than
// the motion, so the wait is bounded generously (the motion timing itself is checked by the motion fixtures).
const gone=async(part)=>{let frame;for(let i=0;i<60;i++){frame=await settle(100);if(!node(frame,part))return true;}return false;};
let serial=0;
async function method(name){
  const callId=`modal-${++serial}`;
  const accepted=await call({command:'method',target:'component',callId,method:name,arguments:[]});
  return {callId,accepted};
}
async function result(callId,{wait=true}={}){
  let reply;
  for(let i=0;i<(wait?120:1);i++){reply=await call({command:'method-results',callIds:[callId],acknowledged:[]});if(reply.methodResults?.[0]?.status!=='pending')break;await sleep(10);}
  return reply.methodResults?.[0]?.status;
}
try{
  // ---- md-dialog: the basic dialog in the preview viewport (centred over a full-viewport scrim) ----
  let frame=await configure('md-dialog',{width:640,height:480,properties:{open:true,headline:'Discard draft?'}});
  check(!frame.error,`configure: ${frame.error}`);
  check(frame.logicalWidth===640&&frame.logicalHeight===480,`The modal viewport is the requested canvas (${frame.logicalWidth}×${frame.logicalHeight}).`);
  frame=await settle();
  let c=node(frame,'container'),s=node(frame,'scrim');
  check(c&&s,`Dialog container and scrim are inspected: ${JSON.stringify(frame.inspection?.nodes?.map(n=>n.id))}`);
  check(c.metrics?.role==='alertdialog'&&c.metrics?.label==='Discard draft?',`Basic dialog semantics (${JSON.stringify(c.metrics)}).`);
  check(near(c.bounds.width,560)&&near(c.bounds.x+c.bounds.width/2,320)&&near(c.bounds.y+c.bounds.height/2,240),`Dialog centred, 560 wide (${JSON.stringify(c.bounds)}).`);
  check(near(s.bounds.x,0)&&near(s.bounds.y,0)&&near(s.bounds.width,640)&&near(s.bounds.height,480),`Scrim covers the viewport (${JSON.stringify(s.bounds)}).`);
  check(near(c.metrics.radius,28,.01),`Source container corners 28 (${c.metrics.radius}).`);
  check(names(events).join()==='mdOpen'&&events[0].detail===null,`Initially open emits one null mdOpen (${JSON.stringify(events)}).`);
  // Window-level Escape: mdCancel then mdClose, the surface leaves after the exit motion.
  events=[];await call({command:'key',key:'Escape'});
  check(await gone('container'),'The closed dialog is removed after its exit motion.');
  check(names(events).join()==='mdCancel,mdClose',`Escape dismisses with mdCancel then mdClose (${names(events)}).`);
  // Correlated lifecycle methods through AWCDialogController.
  events=[];let {callId,accepted}=await method('show');
  check(accepted.ack===true&&accepted.methodCall?.status==='accepted'&&accepted.png===undefined,'show() is accepted without a frame.');
  check(await result(callId)==='fulfilled','show() fulfils once applied.');
  frame=await settle();
  check(names(events).join()==='mdOpen'&&node(frame,'container'),`show() opens the dialog (${names(events)}).`);
  events=[];const waiting=await method('whenClosed');
  check(await result(waiting.callId,{wait:false})==='pending','whenClosed() stays pending while the dialog is open.');
  const closing=await method('close');const closedAt=Date.now();
  check(await result(closing.callId)==='fulfilled','close() fulfils once applied.');
  check(await result(waiting.callId)==='fulfilled','whenClosed() fulfils after close.');
  check(Date.now()-closedAt>=150,`whenClosed() waits for the exit motion (${Date.now()-closedAt} ms).`);
  check(names(events).join()==='mdClose',`close() emits mdClose only (${names(events)}).`);
  // Retained updates keep the instance: open, then fullscreen fills the viewport as a dialog.
  events=[];let ack=await call({command:'update',properties:{open:true,fullscreen:true,headline:'Edit profile'}});
  check(ack.ack===true&&!ack.error,`Retained update: ${ack.error}`);
  frame=await settle();c=node(frame,'container');
  check(c?.metrics?.role==='dialog'&&near(c.bounds.width,640)&&near(c.bounds.height,480)&&near(c.bounds.x,0)&&near(c.bounds.y,0),`Fullscreen dialog fills the viewport (${JSON.stringify(c?.bounds)} ${c?.metrics?.role}).`);
  check(!node(frame,'scrim'),'A fullscreen dialog has no scrim.');
  check(names(events).join()==='mdOpen',`Retained open emits mdOpen once (${names(events)}).`);
  for(const properties of [{fullscreen:'yes'},{density:-5},{variant:'modal'},{headline:'x'.repeat(4097)},{}]){
    check(Boolean((await live.call({command:'update',properties})).error),`Invalid dialog patch ${JSON.stringify(properties).slice(0,40)} is rejected.`);
  }
  // Typed appearance with the Studio wire values: the local style wins over the subtree default.
  frame=await configure('md-dialog',{width:640,height:480,properties:{open:true,headline:'Styled'},dialogAppearanceDefaults:{containerShape:parseDialogAppearanceInput('containerShape','4px')},
    dialogAppearance:{containerShape:parseDialogAppearanceInput('containerShape','12px'),containerColor:'#12345680',zIndex:5,scrimZIndex:4}});
  check(!frame.error,`styled configure: ${frame.error}`);frame=await settle();
  check(near(node(frame,'container')?.metrics?.radius,12,.01),`Local container corners (12) win over the default (${node(frame,'container')?.metrics?.radius}).`);
  // Pointer: a press on an enabled scrim dismisses.
  events=[];
  for(const phase of ['down','up'])await call({command:'pointer',phase,x:12,y:12});
  frame=await settle();
  check(names(events).join()==='mdCancel,mdClose',`Scrim press dismisses (${names(events)}).`);

  // ---- md-bottom-sheet ----
  frame=await configure('md-bottom-sheet',{width:800,height:480,properties:{open:true,headline:'Share'}});
  check(!frame.error,`bottom configure: ${frame.error}`);frame=await settle(560);
  c=node(frame,'container');s=node(frame,'scrim');
  check(c?.metrics?.role==='dialog',`Bottom sheet semantics (${JSON.stringify(c?.metrics)}).`);
  check(near(c.bounds.width,640)&&near(c.bounds.x+c.bounds.width/2,400)&&near(c.bounds.y+c.bounds.height,480),`Standard sheet: 640 wide, centred, on the bottom edge (${JSON.stringify(c.bounds)}).`);
  check(s&&near(s.bounds.width,800)&&near(s.bounds.height,480),'The sheet scrim covers the viewport.');
  ack=await call({command:'update',properties:{variant:'detached'}});check(ack.ack===true,'Retained variant update.');
  frame=await settle(560);c=node(frame,'container');
  check(near(c.bounds.y+c.bounds.height,480-16),`Detached sheet keeps the source 16 margin from the bottom (${JSON.stringify(c.bounds)}).`);
  for(const properties of [{variant:'modal'},{headlineAlign:'left'},{side:'start'},{scrollShadow:1}]) check(Boolean((await live.call({command:'update',properties})).error),`Invalid bottom-sheet patch ${JSON.stringify(properties)} is rejected.`);
  events=[];({callId}=await method('close'));check(await result(callId)==='fulfilled','Bottom sheet close() fulfils.');
  const left=await gone('container');check(names(events).join()==='mdClose'&&left,`close() closes the sheet (${names(events)}, removed ${left}).`);
  const rejected=await live.call({command:'method',target:'component',callId:'no-when-closed',method:'whenClosed',arguments:[]});
  check(Boolean(rejected.error)||rejected.methodCall?.status==='rejected','The source bottom sheet has no whenClosed().');
  events=[];({callId}=await method('show'));check(await result(callId)==='fulfilled','Bottom sheet show() fulfils.');
  frame=await settle(560);check(names(events).join()==='mdOpen'&&node(frame,'container'),`show() opens the sheet (${names(events)}).`);
  frame=await configure('md-bottom-sheet',{width:800,height:480,properties:{open:true,headline:'Share'},bottomSheetAppearance:{maxWidth:parseBottomSheetAppearanceInput('maxWidth','calc(50% + 20px)'),containerShape:parseBottomSheetAppearanceInput('containerShape','12px')}});
  frame=await settle(560);c=node(frame,'container');
  check(near(c.bounds.width,420)&&near(c.bounds.x+c.bounds.width/2,400),`Typed max width calc(50% + 20px) resolves against the viewport (${JSON.stringify(c.bounds)}).`);
  check(near(c.metrics.radius,12,.01),`Typed sheet corners (${c.metrics.radius}).`);
  events=[];await call({command:'key',key:'Escape'});await settle(560);
  check(names(events).join()==='mdCancel,mdClose',`Escape dismisses the bottom sheet (${names(events)}).`);

  // ---- md-side-sheet ----
  frame=await configure('md-side-sheet',{width:800,height:480,properties:{open:true,variant:'modal',headline:'Filters',showBack:true}});
  check(!frame.error,`side configure: ${frame.error}`);frame=await settle(560);
  c=node(frame,'container');s=node(frame,'scrim');
  check(c?.metrics?.role==='dialog'&&s,`Modal side sheet semantics and scrim (${JSON.stringify(c?.metrics)}).`);
  check(near(c.bounds.x+c.bounds.width,800)&&near(c.bounds.y,0)&&near(c.bounds.height,480),`Modal sheet on the end edge, full height (${JSON.stringify(c.bounds)}).`);
  const back=node(frame,'back');check(back,'The back control is inspected.');
  events=[];for(const phase of ['down','up'])await call({command:'pointer',phase,x:back.bounds.x+back.bounds.width/2,y:back.bounds.y+back.bounds.height/2});
  await settle(120);check(names(events).includes('mdBack')&&events.find(e=>e.name==='mdBack').detail===null,`The back control emits a null mdBack (${names(events)}).`);
  ack=await call({command:'update',properties:{side:'start'}});frame=await settle(560);c=node(frame,'container');
  check(ack.ack===true&&near(c.bounds.x,0),`Retained side update moves the sheet to the start edge (${JSON.stringify(c.bounds)}).`);
  for(const properties of [{variant:'detached'},{side:'left'},{showBack:'true'},{headlineAlign:'center'}]) check(Boolean((await live.call({command:'update',properties})).error),`Invalid side-sheet patch ${JSON.stringify(properties)} is rejected.`);
  events=[];const sideWait=await method('whenClosed');check(await result(sideWait.callId,{wait:false})==='pending','Side sheet whenClosed() pends while open.');
  for(const phase of ['down','up'])await call({command:'pointer',phase,x:780,y:240});
  check(await result(sideWait.callId)==='fulfilled','Side sheet whenClosed() fulfils after a scrim dismissal.');
  check(names(events).join()==='mdCancel,mdClose',`Scrim press dismisses the side sheet (${names(events)}).`);
  frame=await configure('md-side-sheet',{width:800,height:480,properties:{open:true,variant:'modal',headline:'Filters'},sideSheetAppearance:{width:parseSideSheetAppearanceInput('width','320px')}});
  frame=await settle(560);c=node(frame,'container');
  check(near(c.bounds.width,320)&&near(c.bounds.x+c.bounds.width,800),`Typed side-sheet width (${JSON.stringify(c.bounds)}).`);

  // ---- a non-modal component keeps its fitted preview ----
  frame=await configure('md-card',{width:640,properties:{}});
  check(!frame.error&&frame.logicalHeight<480,`Non-modal previews keep their fitted height (${frame.logicalHeight}).`);
  console.log(`Passed ${checks} actual SwiftUI modal host checks.`);
}finally{live?.close();}

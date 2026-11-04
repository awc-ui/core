import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI Accordion live host: dispatch, typed appearance, retained updates,
// pointer input (header toggle, floating chassis drag) and item controller methods.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const node=(frame,part)=>frame.inspection?.nodes.find(item=>item.id===(part ? `component.${part}`:'component'));
const names=frame=>(frame.events??[]).map(event=>event.name);
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
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const report={};
try{
  // Dispatch: the dedicated renderer owns both recipe items and reports source state.
  let frame=await configure('md-accordion',{properties:{}});
  check(!frame.error,`configure: ${frame.error}`);
  let root=node(frame);
  check(root?.name==='md-accordion'&&JSON.stringify(root.metrics.expandedIndices)==='[0]'&&JSON.stringify(root.metrics.order)==='[0,1]','Recipe items are owned by the dedicated renderer; the first is expanded.');
  const defaultHeight=root.bounds.height;report.defaultHeight=defaultHeight;
  // Typed appearance: one source gap between the two filled items.
  frame=await configure('md-accordion',{properties:{},accordionAppearanceDefaults:{gap:4},accordionAppearance:{gap:20}});
  check(near(node(frame).bounds.height-defaultHeight,12),`Local gap 20 overrides the 4pt subtree default and the 8pt source gap (${node(frame).bounds.height-defaultHeight}).`);
  // Pointer: the second (collapsed) header toggles with the source payloads.
  frame=await configure('md-accordion',{properties:{}});root=node(frame).bounds;
  const second={x:root.x+root.width/2,y:root.y+root.height-24};
  await live.call({command:'pointer',phase:'down',...second});frame=await live.call({command:'pointer',phase:'up',...second});
  await sleep(50);const after=await live.call({command:'frame'});const events=[...(frame.events??[]),...(after.events??[])];
  const itemToggle=events.find(e=>e.name==='mdItemToggle'),groupToggle=events.find(e=>e.name==='mdToggle');
  check(itemToggle?.detail?.expanded===true&&itemToggle.detail.index===1,`Actual pointer release toggles the second item (${JSON.stringify(itemToggle?.detail)}).`);
  check(groupToggle?.detail?.index===1&&groupToggle.detail.expanded===true&&JSON.stringify(groupToggle.detail.expandedIndices)==='[0,1]',`mdToggle carries the coordinated state (${JSON.stringify(groupToggle?.detail)}).`);
  check(JSON.stringify(node(after).metrics.expandedIndices)==='[0,1]','The retained runtime reports both items open.');
  // Retained updates keep the instance: exclusive keeps one; floating leaves the flow at initial-x/y.
  frame=await live.call({command:'update',properties:{exclusive:true}});
  check(frame.ack===true&&!frame.error,'exclusive is a retained update.');
  await sleep(50);frame=await live.call({command:'frame'});
  check(node(frame).metrics.expandedIndices.length===1,`Enabling exclusive keeps one open item (${JSON.stringify(node(frame).metrics.expandedIndices)}).`);
  frame=await live.call({command:'update',properties:{variant:'outlined',floating:true,initialX:24,initialY:16}});
  await sleep(80);frame=await live.call({command:'frame'});root=node(frame);
  check(root.metrics.x===24&&root.metrics.y===16&&root.metrics.zIndex===-1,`Entering floating seeds initial-x/y without a raise (${JSON.stringify(root.metrics)}).`);
  check(near(root.bounds.x,32+24)&&near(root.bounds.y,32+16)&&near(root.bounds.width,360),`The floating panel is placed in the preview viewport (${JSON.stringify(root.bounds)}).`);
  report.floating=root.bounds;
  const grip={x:root.bounds.x+root.bounds.width/2,y:root.bounds.y+12};
  await live.call({command:'pointer',phase:'move',...grip});
  const start=await live.call({command:'pointer',phase:'down',...grip});
  const moved=await live.call({command:'pointer',phase:'move',x:grip.x+40,y:grip.y+20});
  const end=await live.call({command:'pointer',phase:'up',x:grip.x+40,y:grip.y+20});
  await sleep(50);frame=await live.call({command:'frame'});
  const drag=[...(start.events??[]),...(moved.events??[]),...(end.events??[]),...(frame.events??[])].filter(e=>/^mdDrag/.test(e.name));
  check(drag[0]?.name==='mdDragStart'&&near(drag[0].detail.clientX,grip.x-32,.01)&&near(drag[0].detail.clientY,grip.y-32,.01)&&drag[0].detail.x===24&&drag[0].detail.dx===0,`Chassis press starts a drag in viewport coordinates (${JSON.stringify(drag[0]?.detail)}).`);
  const last=drag.at(-1);
  check(last?.name==='mdDragEnd'&&near(last.detail.dx,40,.01)&&near(last.detail.dy,20,.01)&&near(last.detail.x,64,.01)&&near(last.detail.y,36,.01),`Release reports the terminal delta and panel position (${JSON.stringify(last?.detail)}).`);
  check(drag.some(e=>e.name==='mdDragMove'),'Pointer motion emits mdDragMove.');
  root=node(frame);check(root.metrics.x===64&&root.metrics.y===36&&root.metrics.zIndex>1000,`The panel stays at the dragged position and was brought to front (${JSON.stringify(root.metrics)}).`);
  for(const bad of [{variant:'plain'},{elevation:9},{floating:'yes'},{width:3}]){
    const response=await live.call({command:'update',properties:bad});check(Boolean(response.error),`Invalid update ${JSON.stringify(bad)} is rejected.`);
  }
  // Item page: standalone item, typed item appearance, controller methods.
  frame=await configure('md-accordion-item',{properties:{headline:'A shared design language',supportingText:'Built for every surface',expanded:true},accordionItemAppearance:{headerMinHeight:96,contentPadding:{top:30,right:24,bottom:30,left:24}}});
  check(!frame.error,`item configure: ${frame.error}`);
  const header=node(frame,'header');check(header&&near(header.bounds.height,96),`Header minimum height hook (${header?.bounds?.height}).`);
  const inner=node(frame,'content-inner');report.item={header:header?.bounds,inner:inner?.bounds};
  frame=await live.call({command:'method',method:'toggle',arguments:[]});await sleep(400);
  const toggled=[...(frame.events??[]),...((await live.call({command:'frame'})).events??[])].find(e=>e.name==='mdItemToggle');
  check(toggled?.detail?.expanded===false&&toggled.detail.index===-1,`toggle() collapses the standalone item with index -1 (${JSON.stringify(toggled?.detail)}).`);
  frame=await live.call({command:'method',method:'focusHeader',arguments:[]});check(!frame.error&&!names(frame).includes('mdItemToggle'),'focusHeader() focuses without toggling.');
  frame=await live.call({command:'update',properties:{disabled:true}});await live.call({command:'method',method:'toggle',arguments:[]});await sleep(100);
  check(!names(await live.call({command:'frame'})).includes('mdItemToggle'),'toggle() is blocked on a disabled item.');
  check(Boolean((await live.call({command:'method',method:'toggle',arguments:[1]})).error),'Methods reject arguments.');
  console.log(`Passed ${checks} actual SwiftUI Accordion host, appearance, retained update, pointer, drag and method checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI Card live host: dispatch, typed appearance, retained updates,
// pointer activation and the drag gesture with the source payloads.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tolerance=.6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const card=frame=>frame.inspection?.nodes.find(item=>item.id==='component'&&item.name==='md-card');
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
let live;
const configure=async (fields={})=>{live?.close();live=host();return live.call({command:'configure',tag:'md-card',width:640,dark:false,...fields});};
const report={};
try{
  // Dispatch: the dedicated renderer with the Laboratory recipe content and source defaults.
  let frame=await configure({properties:{}});
  check(!frame.error,`configure: ${frame.error}`);
  let root=card(frame);
  check(root?.metrics?.role===''&&root.metrics.tabindex===-2,`A default card is a plain container (${JSON.stringify(root?.metrics?.role)}).`);
  check(root.metrics.gap?.row===8&&root.metrics.gap?.column===0,'The inspection gap is the schema {row, column} record.');
  check(JSON.stringify(root.metrics.padding)==='[16,16,16,16]'&&root.metrics.contentGap===8,`Source padding 16 and gap 8 (${JSON.stringify(root.metrics.padding)} / ${root.metrics.contentGap}).`);
  check(root.metrics.shadow.length===16&&near(root.metrics.shadow[1],1,.01),`Elevated variant paints elevation 1 (${JSON.stringify(root.metrics.shadow)}).`);
  const [r,g,b]=root.metrics.background;check(near(r*255,247,1.5)&&near(g*255,242,1.5)&&near(b*255,250,1.5),`surface-container-low container (${root.metrics.background}).`);
  report.default=root.bounds;
  // Typed appearance: local values override subtree defaults; paint and layout follow.
  frame=await configure({properties:{},cardAppearanceDefaults:{gap:4,containerColor:'#00FF00'},cardAppearance:{padding:{top:20,right:24,bottom:28,left:32},gap:12,containerColor:'#12345680',outlineWidth:3,width:{points:300,fraction:0,em:0,rem:0,ch:0}}});
  root=card(frame);
  check(JSON.stringify(root.metrics.padding)==='[20,24,28,32]'&&root.metrics.contentGap===12,`Padding and gap hooks (${JSON.stringify(root.metrics.padding)} / ${root.metrics.contentGap}).`);
  check(near(root.metrics.background[3],128/255,.01)&&near(root.metrics.background[0],0x12/255,.01),`Local container color wins over the subtree default (${root.metrics.background}).`);
  check(near(root.bounds.width,300),`Width hook (${root.bounds.width}).`);
  // The recipe's authored md-button is interactive content: an interactive card stays a container (source selector).
  frame=await configure({properties:{interactive:true}});
  check(card(frame).metrics.role===''&&card(frame).metrics.tabindex===-2,`Authored controls keep an interactive card a container (${card(frame).metrics.role}).`);
  // Retained updates keep the instance and re-evaluate role, outline and density.
  frame=await configure({properties:{},slots:{'':'Open project'}});
  check(card(frame).metrics.role==='','Plain text content in a non-interactive card.');
  frame=await live.call({command:'update',properties:{interactive:true,variant:'outlined',density:-4}});
  check(frame.ack===true&&!frame.error,`Retained update: ${frame.error}`);
  await sleep(80);frame=await live.call({command:'frame'});root=card(frame);
  check(root.metrics.role==='button'&&root.metrics.tabindex===0,`interactive makes a button with a tab stop (${root.metrics.role}).`);
  check(root.metrics.outlineWidth===1&&JSON.stringify(root.metrics.padding)==='[8,8,8,8]'&&root.metrics.contentGap===4,`Outlined border and density −4 metrics (${root.metrics.outlineWidth}, ${JSON.stringify(root.metrics.padding)}, ${root.metrics.contentGap}).`);
  // Pointer activation emits a trusted mdClick at the client point.
  const box=root.bounds,center={x:box.x+box.width/2,y:box.y+box.height-10};
  await live.call({command:'pointer',phase:'move',...center});
  const down=await live.call({command:'pointer',phase:'down',...center});
  const up=await live.call({command:'pointer',phase:'up',...center});
  await sleep(60);frame=await live.call({command:'frame'});
  const click=events(down,up,frame).find(event=>event.name==='mdClick');
  check(click?.detail?.isTrusted===true&&click.detail.detail===1&&click.detail.button===0,`Pointer click payload (${JSON.stringify(click?.detail)}).`);
  report.click=click?.detail;
  // Drag: 5pt Manhattan threshold, start + move with the same detail, end without a click.
  frame=await live.call({command:'update',properties:{interactive:false,dragEnabled:true}});
  await sleep(60);await live.call({command:'frame'});
  const from={x:box.x+40,y:box.y+box.height-10};
  const steps=[await live.call({command:'pointer',phase:'down',...from}),await live.call({command:'pointer',phase:'move',x:from.x+3,y:from.y})];
  check(!events(...steps).some(event=>event.name==='mdDragStart'),'3 points of movement stay below the drag threshold.');
  steps.push(await live.call({command:'pointer',phase:'move',x:from.x+12,y:from.y+6}));
  steps.push(await live.call({command:'pointer',phase:'move',x:from.x+30,y:from.y+12}));
  steps.push(await live.call({command:'pointer',phase:'up',x:from.x+30,y:from.y+12}));
  await sleep(60);steps.push(await live.call({command:'frame'}));
  const drag=events(...steps).filter(event=>/^mdDrag|^mdClick/.test(event.name));
  report.drag=drag.map(event=>[event.name,event.detail]);
  check(drag[0]?.name==='mdDragStart'&&drag[1]?.name==='mdDragMove'&&JSON.stringify(drag[0].detail)===JSON.stringify(drag[1].detail),`Start is followed by a move with the same detail (${JSON.stringify(drag.slice(0,2))}).`);
  check(['clientX','clientY','offsetX','offsetY','startX','startY'].every(key=>Number.isFinite(drag[0]?.detail?.[key])),'Drag detail carries the six source fields.');
  check(drag.at(-1)?.name==='mdDragEnd'&&!drag.some(event=>event.name==='mdClick'),`The drag ends without a click (${drag.map(event=>event.name)}).`);
  const end=drag.at(-1).detail;check(near(end.clientX-end.startX,30,1)&&near(end.clientY-end.startY,12,1),`End reports the travelled distance (${JSON.stringify(end)}).`);
  frame=await live.call({command:'frame'});check(card(frame).metrics.dragging===false&&card(frame).metrics.zIndex===0,'Dragging ends and the raised stacking is released.');
  for(const bad of [{variant:'tonal'},{density:-5},{interactive:'yes'},{width:3}]){
    const response=await live.call({command:'update',properties:bad});check(Boolean(response.error),`Invalid update ${JSON.stringify(bad)} is rejected.`);
  }
  console.log(`Passed ${checks} actual SwiftUI Card host, appearance, retained update, pointer and drag checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI Organization chart live host: dispatch to the dedicated renderer, typed appearance, retained updates with
// the source property types, the WAI-ARIA tree keys (fold with mdNodeToggle) and pointer selection (mdSelectionChange).
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const chart=frame=>frame.inspection?.nodes.find(item=>item.id==='component'&&item.name==='md-organization-chart');
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
const nodes=[{id:'studio',name:'AWC Studio',title:'Design systems',children:[{id:'ios',name:'iOS',title:'SwiftUI'},{id:'android',name:'Android',title:'Compose'}]}];
let live;
const configure=async (fields={})=>{live?.close();live=host();const frame=await live.call({command:'configure',tag:'md-organization-chart',width:640,dark:false,...fields});await sleep(450);return live.call({command:'frame'});};
const settle=async ()=>{await sleep(450);return live.call({command:'frame'});};
const report={};
try{
  // Dispatch: the dedicated renderer (root card, two children, the trail-free connectors) at density 0.
  let frame=await configure({properties:{nodes,selectionMode:'single'}});
  check(!frame.error,`configure: ${frame.error}`);
  const base=chart(frame)?.bounds;
  check(base&&base.height>150&&base.width>=500,`Two levels render in the 640pt host (32pt padding) (${JSON.stringify(base)}).`);
  report.default=base;
  // Typed appearance: the level gap hook adds its difference to the host height (one gap between two levels).
  frame=await configure({properties:{nodes,selectionMode:'single'},orgChartAppearanceDefaults:{levelGap:30},orgChartAppearance:{levelGap:64,connectorColor:'#C62828'}});
  check(!frame.error,`appearance configure: ${frame.error}`);
  const gapped=chart(frame).bounds;
  check(gapped.height-base.height>20,`levelGap 64 (local wins over the subtree default) grows the chart (${base.height} → ${gapped.height}).`);
  report.levelGap=gapped;
  // Retained updates: density −4 shrinks the cards; a single node removes the second level.
  frame=await configure({properties:{nodes,selectionMode:'single'}});
  let response=await live.call({command:'update',properties:{density:-4}});
  check(response.ack===true&&!response.error,`Retained update: ${response.error}`);
  frame=await settle();const dense=chart(frame).bounds;
  check(dense.height<base.height-8,`density −4 is denser (${base.height} → ${dense.height}).`);
  response=await live.call({command:'update',properties:{density:0,nodes:JSON.stringify([{id:'solo',name:'Solo'}])}});
  check(response.ack===true&&!response.error,`nodes as a JSON string: ${response.error}`);
  frame=await settle();const solo=chart(frame).bounds;
  check(solo.height<base.height/2+40,`One root without children (${solo.height}).`);
  // Keyboard: Tab reaches the roving tree item; ArrowLeft folds the expanded root, ArrowRight unfolds it.
  frame=await configure({properties:{nodes,selectionMode:'single'}});
  await live.call({command:'key',key:'Tab'});await sleep(100);
  const fold=[await live.call({command:'key',key:'ArrowLeft'})];fold.push(await settle());
  const folded=events(...fold).filter(event=>event.name==='mdNodeToggle');
  check(folded.length===1&&folded[0].detail?.node?.id==='studio'&&folded[0].detail.expanded===false,`ArrowLeft folds the root (${JSON.stringify(folded)}).`);
  check(chart(fold.at(-1)).bounds.height<base.height-40,'The folded chart shows only the root.');
  const unfold=[await live.call({command:'key',key:'ArrowRight'})];unfold.push(await settle());
  const unfolded=events(...unfold).filter(event=>event.name==='mdNodeToggle');
  check(unfolded.length===1&&unfolded[0].detail.expanded===true,`ArrowRight unfolds it (${JSON.stringify(unfolded)}).`);
  // Pointer: a click on the root card selects it (single mode) with the source payload.
  const box=chart(unfold.at(-1)).bounds,point={x:box.x+box.width/2,y:box.y+8+20};
  const click=[await live.call({command:'pointer',phase:'move',...point}),await live.call({command:'pointer',phase:'down',...point}),await live.call({command:'pointer',phase:'up',...point})];
  click.push(await settle());
  const selection=events(...click).filter(event=>event.name==='mdSelectionChange');
  check(selection.length===1&&selection[0].detail?.node?.id==='studio'&&JSON.stringify(selection[0].detail.selectedIds)==='["studio"]',`Pointer selection payload (${JSON.stringify(selection)}).`);
  report.selection=selection[0]?.detail;
  for(const bad of [{orientation:'radial'},{density:-5},{selectionMode:'all'},{nodes:3},{selectedIds:'studio'},{collapsible:'false'},{open:true}]){
    response=await live.call({command:'update',properties:bad});check(Boolean(response.error),`Invalid update ${JSON.stringify(bad)} is rejected.`);
  }
  console.log(`Passed ${checks} actual SwiftUI Organization chart host, appearance, retained update, keyboard and pointer checks.`);
  console.log(JSON.stringify(report));
}finally{live?.close();}

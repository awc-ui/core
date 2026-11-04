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
  return live.call({command:'configure',tag:'md-tooltip',width:640,dark:false,...fields});
};
try{
  let frame=await configure({width:600,height:400,properties:{open:false,showDelay:180,hideDelay:180}});
  check(!frame.error&&frame.logicalWidth===600&&frame.logicalHeight===400,'Tooltip has a real caller-sized overlay viewport.');
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Initial closed Tooltip does not emit mdOpen.');
  let anchor=node(frame).bounds;
  const pointer=async (phase,x,y)=>live.call({command:'pointer',phase,x,y});
  frame=await pointer('move',anchor.x+anchor.width/2,anchor.y+anchor.height/2);
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Native hover observes show delay.');
  await sleep(250);frame=await live.call({command:'frame'});
  check((frame.events??[]).filter(e=>e.name==='mdOpen'&&e.detail===null).length===1,'Actual pointer hover opens with one null mdOpen.');
  const popup=node(frame,'popup').bounds;
  frame=await pointer('move',popup.x+popup.width/2,popup.y+popup.height/2);
  await sleep(260);frame=await live.call({command:'frame'});
  check(!(frame.events??[]).some(e=>e.name==='mdClose'),'Pointer entering popup cancels trigger leave timer.');
  await pointer('leave',0,0);await sleep(260);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail===null),'Leaving popup closes after source grace period.');
  let serial=0;
  const method=async name=>{
    const callId=`tooltip-${++serial}`,accepted=await live.call({command:'method',target:'component',callId,method:name,arguments:[]});
    check(accepted.ack===true&&accepted.methodCall?.status==='accepted',`${name} accepts a correlated call.`);
    let result;
    for(let i=0;i<30;i++){result=await live.call({command:'method-results',callIds:[callId],acknowledged:[]});if(result.methodResults?.[0]?.status!=='pending')break;await sleep(10);}
    check(result.methodResults?.[0]?.status==='fulfilled',`${name} confirms applied source state.`);
    await live.call({command:'method-results',callIds:[],acknowledged:[callId]});
    return [...(accepted.events??[]),...(result.events??[])];
  };
  check((await method('show')).some(e=>e.name==='mdOpen'&&e.detail===null),'Public show opens immediately.');
  frame=await live.call({command:'key',key:'Escape'});
  check((frame.events??[]).some(e=>e.name==='mdClose'&&e.detail===null),'Window Escape closes Tooltip without prior native focus.');
  const patch={text:'Retained tooltip text',subhead:'Retained heading',variant:'rich',position:'bottom-end',autoPosition:false,offset:12,crossOffset:-3,open:true,showDelay:120,hideDelay:120,disabled:false,density:-2};
  check((await live.call({command:'update',properties:patch})).ack===true,'All12 source properties update the retained Tooltip.');
  await sleep(130);frame=await live.call({command:'frame'});
  const a=node(frame).bounds,p=node(frame,'popup').bounds;
  check(near(p.y,a.y+a.height+12)&&near(p.x,a.x+a.width-Math.round(p.width)-3),'Retained source placement, offset and cross offset change actual geometry.');
  check(node(frame,'subhead')?.metrics?.typography?.size===13,'Retained density changes actual native text metrics.');
  frame=await live.call({command:'resize',width:360,height:480});
  check(frame.ack===true&&frame.logicalWidth===360&&frame.logicalHeight===480&&typeof frame.png==='string','Retained viewport resize returns committed replacement capture.');
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'||e.name==='mdClose'),'Resize preserves mounted Tooltip state without lifecycle replay.');
  const moved=node(frame).bounds;
  check(near(moved.x+moved.width/2,180)&&near(moved.y+moved.height/2,240),'Real anchor follows resized root viewport.');
  check((await method('hide')).some(e=>e.name==='mdClose'),'Public hide closes immediately.');
  for(const properties of [{},{open:1},{text:null},{offset:'8'},{showDelay:null},{density:1},{position:'center'},{variant:'other'},{unknown:true},{subhead:'x'.repeat(4097)}])check(Boolean((await live.call({command:'update',properties})).error),'Invalid Tooltip property patch is rejected atomically.');
  for(const args of [['close'],[null]])check(Boolean((await live.call({command:'method',target:'component',callId:`bad-${++serial}`,method:'hide',arguments:args})).error),'Tooltip hide accepts no reason arguments.');
  await live.call({command:'update',properties:{disabled:true,open:true}});await sleep(150);frame=await live.call({command:'frame'});
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Disabled authored opening does not display or emit mdOpen.');
  await live.call({command:'update',properties:{disabled:false,open:false}});
  frame=await live.call({command:'frame'});anchor=node(frame).bounds;await pointer('move',anchor.x+anchor.width/2,anchor.y+anchor.height/2);await pointer('leave',0,0);
  frame=await live.call({command:'key',key:'Tab'});await sleep(230);frame=await live.call({command:'frame'});
  check((frame.events??[]).some(e=>e.name==='mdOpen'),'Actual native keyboard focus opens after delay.');
  frame=await live.call({command:'key',key:'Escape'});
  check((frame.events??[]).some(e=>e.name==='mdClose'),'Focused Escape closes while preserving trigger focus.');
  await sleep(250);frame=await live.call({command:'frame'});
  check(!(frame.events??[]).some(e=>e.name==='mdOpen'),'Escape does not immediately reopen while focus remains on trigger.');
  frame=await configure({width:600,height:310,dark:true,properties:{open:true,variant:'rich',subhead:'Styled heading',text:'Styled body'},tooltipAppearanceDefaults:{plainContainerColor:'#22446688',plainTextColor:'#FFFFFFCC',richContainerColor:'#22556699',richSubheadColor:'#DDCCAA88',richTextColor:'#CC3377CC',richActionColor:'#33EEAA80'},tooltipAppearance:{plainShape:{topLeft:{x:{points:20},y:{points:8}}},plainMaxWidth:{points:100},richShape:{topLeft:{x:{points:20},y:{points:8}}},richMinWidth:{points:160},richMaxWidth:{points:160}}});
  await sleep(150);frame=await live.call({command:'frame'});
  check(near(node(frame,'popup')?.bounds.width,160),'All11 appearance hooks pass through actual preview scope; rich width is applied.');
  check((await method('hide')).some(e=>e.name==='mdClose'),'Initially-open Tooltip hides through its controller.');
  const reopened=await live.call({command:'update',properties:{open:true}});
  check((reopened.events??[]).some(e=>e.name==='mdOpen'),'Retained open:true reopens after method hide despite initially open config.');
  check((await live.call({command:'update',properties:{variant:'plain'}})).ack===true,'Styles remain attached when retained variant changes.');
  await sleep(120);frame=await live.call({command:'frame'});
  check(node(frame,'popup')?.bounds.width<=100.01,'Plain max width hook applies after retained variant change.');
}finally{live?.close();}
console.log(`Passed ${checks} actual SwiftUI Tooltip host, retained properties, viewport, methods, pointer and keyboard checks.`);

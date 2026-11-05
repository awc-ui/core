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
  return live.call({command:'configure',tag:'md-progress-indicator',width:640,dark:false,...fields});
};
try{
  let frame=await configure({});
  check(!frame.error&&near(node(frame)?.bounds.width,300)&&near(node(frame)?.bounds.height,10),'Default wavy Progress uses the authored300pt parent and actual10pt viewport.');
  check(near(node(frame)?.bounds.x,170),'The actual root is centered without measuring its preview wrapper.');
  frame=await configure({progressIndicatorAppearanceDefaults:{stopIndicatorSize:2,trackColor:'#00FF0080'},progressIndicatorAppearance:{activeIndicatorColor:'#FF0000',trackActiveIndicatorSpace:9},properties:{wave:false,value:25},direction:'rtl'});
  check(near(node(frame,'active-indicator')?.bounds.width,75)&&near(node(frame,'active-indicator')?.bounds.x-node(frame)?.bounds.x,225),'Configured RTL fill uses real logical-start geometry.');
  check(near(node(frame,'stop-indicator')?.bounds.width,2)&&near(node(frame,'track')?.bounds.width,216),'Sparse local and inherited style hooks resolve on actual parts.');
  const oldPNG=frame.png;
  let ack=await live.call({command:'update',properties:{value:50}});
  check(ack.ack===true&&ack.png===undefined&&!ack.error,'Retained property acknowledgement does not force a new frame.');
  await sleep(500);frame=await live.call({command:'frame'});
  check(near(node(frame,'active-indicator')?.bounds.width,150)&&frame.png!==oldPNG,'Retained value changes update native layout and actual captured paint.');
  for(const properties of [{}, {complete:null}, {density:1}, {unknown:true}, {label:'x'.repeat(4097)}]){
    const reply=await live.call({command:'update',properties});check(Boolean(reply.error),'Invalid patches are rejected without mutation.');
  }
  check(Boolean((await live.call({command:'update',properties:{value:1},width:900})).error),'Update cannot change the viewport or other configuration.');
  check((await live.call({command:'update',properties:{variant:'circular',value:-37,max:-100,indeterminate:false,thickness:0,wave:true,waveAmplitude:3,waveLength:25,waveSpeed:10,size:64,fourColor:true,label:'',complete:false,density:-4}})).ack===true,'All fourteen source properties accept one validated retained patch, preserving zero/negative/empty values.');
  frame=await live.call({command:'frame'});
  check(near(node(frame)?.bounds.width,64)&&near(node(frame)?.bounds.height,64),'Variant/size update retains the root and applies intrinsic circular geometry.');
  for(const variant of ['linear','circular'])for(const wave of [false,true]){
    frame=await configure({properties:{variant,wave,value:37,complete:true}});
    check(!frame.error&&node(frame)&&!(frame.events??[]).some(event=>event.name==='mdComplete'),'Initial complete=true stays source-inert.');
    const falseAck=await live.call({command:'update',properties:{complete:false}});
    const trueAck=await live.call({command:'update',properties:{complete:true}});
    check(falseAck.ack===true&&trueAck.ack===true&&!(trueAck.events??[]).some(event=>event.name==='mdComplete'),'Consecutive false/true updates are applied before deferred completion.');
    const events=[];const end=Date.now()+3500;
    do{
      await sleep(75);frame=await live.call({command:'frame'});events.push(...(frame.events??[]));
    }while(Date.now()<end&&!events.some(event=>event.name==='mdComplete'));
    const completed=events.filter(event=>event.name==='mdComplete');
    check(completed.length===1&&completed[0].detail===null&&completed[0].tag==='md-progress-indicator','Actual component lifecycle emits exactly one null-detail mdComplete.');
    check(Boolean(node(frame))===(variant==='circular'&&!wave),'Only flat circular retains its actual terminal track; hidden variants have no wrapper substitute.');
    await live.call({command:'update',properties:{complete:false}});await sleep(100);
    frame=await live.call({command:'frame'});
    check(!(frame.events??[]).some(event=>event.name==='mdComplete')&&Boolean(node(frame))===(variant==='circular'&&!wave),'Clearing complete neither resets terminal state nor duplicates its event.');
  }
  frame=await configure({properties:{indeterminate:true,complete:false}});
  await live.call({command:'update',properties:{complete:true}});await sleep(150);frame=await live.call({command:'frame'});
  check(node(frame)&&!(frame.events??[]).some(event=>event.name==='mdComplete'),'Indeterminate ignores complete changes.');
  frame=await configure({properties:{wave:true,value:37}});
  for(const properties of [{waveAmplitude:1e308},{thickness:1e308},{variant:'circular',thickness:1e308,waveAmplitude:1e308}]){
    const reply=await live.call({command:'update',properties});
    frame=await live.call({command:'frame'});
    check(reply.ack===true&&!frame.error&&frame.png&&frame.inspection?.nodes.every(item=>Object.values(item.bounds).every(Number.isFinite)),'Extreme finite retained updates remain capturable and report actual finite used geometry.');
  }
  frame=await configure({tag:'md-divider'}); // R2-D6: md-meter now has its own retained updates
  check(Boolean((await live.call({command:'update',properties:{value:10}})).error),'Other component roots cannot receive retained Progress patches.');
}finally{live?.close();}
console.log(`Passed ${checks} actual SwiftUI Progress host, retained update, style, validation, lifecycle and inspection checks.`);

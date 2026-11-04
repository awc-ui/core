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
  return live.call({command:'configure',tag:'md-skeleton',width:640,dark:false,...fields});
};
try{
  let frame=await configure({properties:{animation:'none'}});
  await sleep(550);frame=await live.call({command:'frame'});
  check(!frame.error&&near(node(frame)?.bounds.width,260)&&near(node(frame)?.bounds.height,64),'Default three text rows use the actual260pt parent and64pt component.');
  check(near(node(frame,'line.2')?.bounds.width,156),'The last text row tapers to60%.');
  check(near(node(frame)?.bounds.x,190),'Preview parent is centered and component inspector omits the160pt parent wrapper.');
  check(near(node(frame)?.metrics?.gap?.row,8)&&node(frame)?.metrics?.gap?.column===0,'Inspector exposes the actual vertical row gap and single-column layout.');
  let ack=await live.call({command:'update',properties:{variant:'text',animation:'none',lines:4,width:'200px',height:'18px',fullWidth:false,fullHeight:false,announce:false,ariaLabelProp:'Retained loading',density:-1}});
  check(ack.ack===true&&ack.png===undefined&&!ack.error,'All ten source properties update the retained native root with an acknowledgement only.');
  frame=await live.call({command:'frame'});
  check(near(node(frame)?.bounds.width,200)&&near(node(frame)?.bounds.height,93)&&near(node(frame,'line.3')?.bounds.width,120)&&near(node(frame)?.metrics?.gap?.row,7),'Retained line count, dimensions and density change real layout and inspector values.');
  for(const properties of [{},{variant:'bad'},{animation:'bad'},{lines:'4'},{width:40},{height:null},{announce:1},{fullWidth:'true'},{fullHeight:null},{density:1},{ariaLabelProp:'x'.repeat(4097)},{value:20}]){
    check(Boolean((await live.call({command:'update',properties})).error),'Invalid retained Skeleton patches are rejected before mutation.');
  }
  check(Boolean((await live.call({command:'update',properties:{lines:1},width:900})).error),'Retained updates cannot change configuration or the viewport.');
  frame=await live.call({command:'frame'});
  check(near(node(frame)?.bounds.width,200)&&near(node(frame)?.bounds.height,93),'Invalid patches leave the retained configuration intact.');
  for(const variant of ['circular','rounded','rectangular','text']){
    ack=await live.call({command:'update',properties:{variant,fullWidth:true,fullHeight:true}});
    frame=await live.call({command:'frame'});
    check(ack.ack===true&&near(node(frame)?.bounds.height,160)&&near(node(frame)?.bounds.width,variant==='circular'?160:260),'Retained variant/full-size changes keep the existing host for '+variant+'.');
  }
  for(const variant of ['text','rectangular','rounded','circular']){
    frame=await configure({properties:{variant,animation:'none',width:'80px',fullWidth:true,fullHeight:true},direction:'rtl'});
    await sleep(550);frame=await live.call({command:'frame'});
    check(!frame.error&&near(node(frame)?.bounds.height,160),'Full-height '+variant+' uses definite160pt parent.');
    check(near(node(frame)?.bounds.width,variant==='circular'?160:260),'Full-height/full-width source precedence '+variant+'.');
  }
  frame=await configure({properties:{animation:'none',lines:2,width:'calc(100% - 32px)',height:'1.5em',fullWidth:false,ariaLabelProp:'Loading content',announce:false,density:-2},skeletonAppearanceDefaults:{color:'#12345680',lineGap:{points:11}},skeletonAppearance:{highlight:'#FEDCBA80',radius:{topLeft:{x:{points:10},y:{points:20}}},roundedRadius:{topLeft:{x:{points:2},y:{points:2}}},width:{points:90},height:{points:10},size:{points:64},pulseDuration:1.3,waveDuration:1.7,bloomDuration:0}});
  check(!frame.error&&near(node(frame)?.bounds.width,228)&&near(node(frame)?.bounds.height,59),'Property affine/font lengths override hooks while sparse inherited line gap remains.');
  check(near(node(frame)?.metrics?.gap?.row,11),'Inspector exposes the resolved inherited line-gap appearance value.');
  const customPNG=frame.png;
  frame=await configure({properties:{animation:'none',lines:2,width:'calc(100% - 32px)',height:'1.5em',fullWidth:false,density:-2},skeletonAppearance:{bloomDuration:0}});
  check(frame.png!==customPNG,'RGBA appearance materially changes captured native paint.');
  for(const width of ['50%','10em','20ch','1e310%']){
    frame=await configure({properties:{animation:'none',variant:'rectangular',width,fullWidth:false},skeletonAppearance:{bloomDuration:0}});
    check(!frame.error&&frame.png&&frame.inspection?.nodes.every(item=>Object.values(item.bounds).every(Number.isFinite)),'Accepted length '+width+' resolves finite native layout.');
  }
  frame=await configure({properties:{variant:'circular',width:'0px',height:'0px',fullWidth:false},skeletonAppearance:{bloomDuration:0}});
  check(!frame.error&&frame.png,'Zero-sized Skeleton is a valid capture.');
  for(const appearance of [{bloomDuration:0},{highlight:'#FF0000',waveDuration:3,bloomDuration:0}]){
    frame=await configure({properties:{animation:'wave',lines:3},skeletonAppearance:appearance});
    await sleep(850);frame=await live.call({command:'frame'});const a=frame.png;let changed=false;
    for(let i=0;i<90;i++){await sleep([17,31,53][i%3]);frame=await live.call({command:'frame'});changed ||= frame.png!==a;}
    check(changed,'Actual live wave changes native frames with default and custom timings, sampled without phase aliasing.');
  }
}finally{live?.close();}
console.log(`Passed ${checks} actual SwiftUI Skeleton preview sizing, appearance, property, length and motion checks.`);

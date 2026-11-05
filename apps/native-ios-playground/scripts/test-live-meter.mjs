import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<.03;
const node=(frame,id='component')=>frame.inspection?.nodes.find(item=>item.id===id);
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',data=>{stderr+=data;});
  child.stdout.on('data',data=>{
    buffer+=data;let newline;
    while((newline=buffer.indexOf('\n'))>=0){
      const reply=JSON.parse(buffer.slice(0,newline));buffer=buffer.slice(newline+1);
      const entry=pending.get(reply.id);if(entry){pending.delete(reply.id);clearTimeout(entry.timeout);entry.resolve(reply);}
    }
  });
  child.on('exit',(code,signal)=>{for(const entry of pending.values()){clearTimeout(entry.timeout);entry.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {
    call:message=>new Promise((resolve,reject)=>{
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
let live;
const configure=async fields=>{
  live?.close();live=host();
  return live.call({command:'configure',tag:'md-meter',width:640,dark:false,...fields});
};
try{
  let frame=await configure({});
  check(!frame.error&&near(node(frame)?.bounds.width,300)&&near(node(frame)?.bounds.height,28),'Default Meter uses the authored300pt parent, not preview width.');
  check(near(node(frame,'component.track')?.bounds.width,300)&&near(node(frame,'component.indicator')?.bounds.width,216),'Default value72 paints exactly72% of the real300pt track.');
  check(['label','value','track','indicator'].every(part=>node(frame,`component.${part}`)?.parentId==='component'),'All four visible default parts are actual measured children.');
  check(near(node(frame)?.bounds.x,170),'Authored Meter context is centered in the640pt preview.');
  const originalPNG=frame.png;
  frame=await configure({meterAppearanceDefaults:{height:10,trackColor:'#00FF0080'},meterAppearance:{height:8,indicatorColor:'#FF0000'},properties:{value:25},direction:'rtl'});
  check(near(node(frame,'component.track')?.bounds.height,8)&&near(node(frame,'component.indicator')?.bounds.width,75),'Local styles override inherited defaults fieldwise.');
  check(node(frame)?.metrics.direction==='rtl'&&near(node(frame,'component.indicator').bounds.x-node(frame,'component.track').bounds.x,225),'Actual native fill starts at logical RTL inline start.');
  check(frame.png!==originalPNG,'Changed palette/appearance and value alter actual captured pixels.');
  frame=await configure({properties:{color:'Brand',showLabel:false,showValue:false},themeTokens:{'--md-sys-color-Brand':'#FF000080','--md-sys-color-Brand-container':'#00FF0080'}});
  const brandedPNG=frame.png;
  frame=await configure({properties:{color:'brand',showLabel:false,showValue:false},themeTokens:{'--md-sys-color-Brand':'#FF000080','--md-sys-color-Brand-container':'#00FF0080'}});
  check(brandedPNG!==frame.png,'Custom role names preserve case and RGBA through the live host.');
  frame=await configure({properties:{variant:'circular',showLabel:false,showValue:false}});
  check(near(node(frame)?.bounds.width,48)&&near(node(frame)?.bounds.height,48),'Circular root stays intrinsic inside the authored300pt parent.');
  check(near(node(frame,'component.track')?.bounds.width,44)&&near(node(frame,'component.track')?.bounds.x-node(frame)?.bounds.x,2),'Ring inspection measures true44pt path bounds within the48pt viewport.');
  frame=await configure({properties:{variant:'circular',showLabel:false,showValue:false},meterAppearance:{size:0}});
  check(node(frame)?.bounds.width===0&&node(frame)?.bounds.height===0,'Intentional zero-size circular root remains zero.');
  check(node(frame,'component.circular')?.bounds.width===0&&!node(frame,'component.track'),'A zero SVG viewport does not fabricate visible path geometry.');
  frame=await configure({properties:{showLabel:false,showValue:false},meterAppearance:{height:0}});
  check(near(node(frame)?.bounds.width,300)&&node(frame)?.bounds.height===0,'Intentional zero-height linear root is not replaced by preview padding.');
  frame=await configure({properties:{showLabel:false,showValue:true,value:30,min:0,max:80,locale:'en-US'}});
  const percentPNG=frame.png;
  frame=await configure({properties:{showLabel:false,showValue:true,value:30,min:0,max:80,locale:'en-US',formatOptions:{}}});
  check(frame.png!==percentPNG,'Omitted formatOptions produces percent; explicit{} formats the raw number.');
  const decimalPNG=frame.png;
  frame=await configure({properties:{showLabel:false,showValue:true,value:30,min:0,max:80,locale:'bad_locale',formatOptions:{style:'currency'}}});
  check(frame.png===decimalPNG,'Invalid locale/options reach the public raw-number fallback.');
  frame=await configure({properties:{hidden:true}});
  check(frame.inspection===undefined,'Hidden Meter has no stale node or parent-context substitute.');
  const usedLimit=16_777_214;
  frame=await configure({properties:{variant:'circular',showLabel:false,showValue:false},meterAppearance:{size:1e308}});
  check(!frame.error&&near(node(frame,'component.circular')?.bounds.width,usedLimit)&&frame.logicalHeight===2000,'Extreme finite size saturates used geometry without overflowing native layout or capture.');
  frame=await configure({properties:{variant:'circular',showLabel:false,showValue:true,thickness:1e308},meterAppearance:{size:1e308}});
  check(!frame.error&&near(node(frame,'component.value')?.metrics.typography.size,usedLimit*.26),'Extreme circular text derives finite typography from the actual used viewport.');
  frame=await configure({properties:{showLabel:false,showValue:false,thickness:1e308}});
  check(!frame.error&&near(node(frame,'component.track')?.bounds.height,usedLimit),'Extreme linear thickness remains capturable with finite measured geometry.');
}finally{live?.close();}
console.log(`Passed ${checks} live SwiftUI Meter context, styles, roles, RTL, formatting, actual parts and zero/hidden checks.`);

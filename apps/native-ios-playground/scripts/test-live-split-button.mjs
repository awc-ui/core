import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);reject(new Error(`Host timeout ${stderr}`));},5000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const part=(frame,name='component')=>frame.inspection?.nodes.find(node=>node.id===name);
const center=node=>({x:node.bounds.x+node.bounds.width/2,y:node.bounds.y+node.bounds.height/2});
let live=host();
try {
  let frame=await live.call({command:'configure',tag:'md-split-button',properties:{label:'Create project',icon:'add'},width:640,dark:false});
  check(!frame.error && frame.splitButtonChecked===false && part(frame).bounds.height===40,'Actual default root layout and checked state are captured.');
  check(part(frame,'component.trailing').bounds.width===48 && part(frame,'component.icon').bounds.width===18,'Independent trailing and leading glyph boxes match source.');
  const leading=center(part(frame,'component.leading')),trailing=center(part(frame,'component.trailing'));
  await live.call({command:'pointer',phase:'down',...leading});
  let activated=await live.call({command:'pointer',phase:'up',...leading});
  check(activated.events.length===1 && activated.events[0].name==='mdLeadingClick' && activated.events[0].detail===null && activated.events[0].activation.source==='pointer','Leading real pointer emits source null detail and native source.');
  check(activated.splitButtonChecked===false,'Leading activation never changes trailing state.');
  await live.call({command:'pointer',phase:'down',...trailing});
  activated=await live.call({command:'pointer',phase:'up',...trailing});
  check(activated.events.length===1 && activated.events[0].name==='mdTrailingClick' && activated.events[0].detail.checked===true && activated.splitButtonChecked===true,'Trailing pointer commits actual state before event and capture.');
  activated=await live.call({command:'key',key:'Space'});
  check(activated.events[0]?.detail.checked===false && activated.events[0]?.activation.source==='keyboard' && activated.splitButtonChecked===false,'Focused trailing Space emits one committed toggle.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-split-button',properties:{label:'Create',icon:'',fullWidth:true},slots:{'':'extra'},splitButtonAppearanceDefaults:{containerColor:'#123456',iconSize:30},splitButtonAppearance:{cornerRadius:6},width:640,dark:false});
  check(!frame.error && part(frame),`Full width configured: ${JSON.stringify({...frame,png:undefined})}`);
  check(part(frame).bounds.width===576 && part(frame).bounds.x===32,'Full width uses the actual padded Web-equivalent preview area.');
  check(part(frame,'component.label').bounds.width>0 && part(frame,'component.leading').bounds.width===526,'Additive text slot preserves prop label and independent fixed trailing width.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-split-button',properties:{label:'Compact',icon:'add',density:-4,disabled:true},splitButtonAppearance:{iconSize:30},width:640,dark:true,direction:'rtl'});
  check(part(frame).bounds.height===24 && part(frame,'component.icon').bounds.width===30 && part(frame,'component.trailing-icon').bounds.width===22,'Density preserves fixed trailing glyph and applies independent leading override.');
  check(part(frame,'component.trailing').bounds.x<part(frame,'component.leading').bounds.x,'RTL reverses native physical halves.');
  const point=center(part(frame,'component.trailing'));await live.call({command:'pointer',phase:'down',...point});
  const blocked=await live.call({command:'pointer',phase:'up',...point});
  check(blocked.events.length===0 && blocked.splitButtonChecked===false,'Hard disabled blocks real native pointer activation.');
  live.close();live=host();
  frame=await live.call({command:'configure',tag:'md-badge',properties:{variant:'small',density:-4},width:640,dark:false});
  check(part(frame).bounds.width===4 && part(frame).metrics.typography===undefined,'Small Badge reports actual size without nonexistent typography.');
} finally {live.close();}
console.log(`Passed ${checks} live SwiftUI SplitButton geometry, styles, slots, pointer, keyboard, state, RTL and Badge metadata checks.`);

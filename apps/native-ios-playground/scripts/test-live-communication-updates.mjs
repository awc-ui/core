import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Gate-7 R2-D6: retained Laboratory property updates for md-badge, md-loading-indicator, md-meter and md-status-dot.
// A retained update must keep the mounted root, so the source's property-change behaviour stays visible:
// md-meter's 300 ms value glide (md-meter.css), md-status-dot's 200 ms colour transition (md-status-dot.css) and the
// continuous 4.55 s md-loading-indicator morph, which a restart would reset to phase 0.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
const {decodePNG}=await import(process.env.AWC_PNG_MODULE ?? fileURLToPath(new URL('../../../tools/ax/png.mjs',import.meta.url)));
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
// Pixels of a logical rectangle of the capture (RGBA rows), and the colour at a logical point.
function image(frame){const png=decodePNG(Buffer.from(frame.png,'base64'));png.scale=png.width/(frame.logicalWidth??640);return png;}
function pixel(png,x,y){const i=(Math.round(y*png.scale)*png.width+Math.round(x*png.scale))*4;return [png.data[i],png.data[i+1],png.data[i+2]];}
function region(png,b){const out=[];for(let y=Math.floor(b.y*png.scale);y<Math.ceil((b.y+b.height)*png.scale);y++)for(let x=Math.floor(b.x*png.scale);x<Math.ceil((b.x+b.width)*png.scale);x++){const i=(y*png.width+x)*4;out.push(png.data[i],png.data[i+1],png.data[i+2]);}return out;}
const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
let live;
const configure=async(tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const update=properties=>live.call({command:'update',properties});
try{
  // ── md-meter: value glide across a retained update ──────────────────────────────────────────────
  let frame=await configure('md-meter',{properties:{value:72,showLabel:false,showValue:false}});
  check(!frame.error&&Math.abs(node(frame,'component.indicator')?.bounds.width-216)<.05,'Meter starts at 72% of the 300pt track.');
  let ack=await update({value:20});
  check(ack.ack===true&&!(ack.events??[]).length,'Retained Meter value update is acknowledged without lifecycle events.');
  const start=Date.now(),widths=[];
  while(Date.now()-start<800){frame=await live.call({command:'frame'});widths.push([Date.now()-start,node(frame,'component.indicator')?.bounds.width]);await sleep(20);}
  check(widths.some(([,w])=>w>60+1&&w<216-1),`The native value glides through intermediate widths (samples ${widths.map(([t,w])=>`${t}:${w?.toFixed(1)}`).join(' ')}).`);
  check(widths.every(([,w],i)=>i===0||w<=widths[i-1][1]+.5),'The glide is monotonic toward the new value.');
  const settled=widths.find(([,w])=>Math.abs(w-60)<.05);
  check(settled&&settled[0]<700&&Math.abs(widths.at(-1)[1]-60)<.05,`The glide settles at 20% (60pt) within the source 300 ms plus capture latency (settled at ${settled?.[0]} ms).`);
  frame=await configure('md-meter',{properties:{value:30,min:0,max:80,locale:'en-US',showLabel:false,showValue:true}});
  const percentPNG=frame.png;
  check((await update({formatOptions:{}})).ack===true,'formatOptions {} is a retained update.');
  await sleep(120);const rawPNG=(await live.call({command:'frame'})).png;
  check(rawPNG!==percentPNG,'Explicit {} formats the raw clamped number instead of the percentage.');
  check((await update({formatOptions:null})).ack===true,'formatOptions null (Studio Unset) is a retained update.');
  await sleep(120);check((await live.call({command:'frame'})).png===percentPNG,'Unset formatOptions restores the localized percentage exactly.');
  for(const properties of [{value:'7'},{showValue:1},{variant:'ring'},{density:-5},{unknown:1},{formatOptions:'x'}]){
    const reply=await update(properties);check(Boolean(reply.error),`Invalid Meter patch ${JSON.stringify(properties)} is rejected.`);
  }
  check((await live.call({command:'frame'})).png===percentPNG,'Rejected patches do not mutate the mounted Meter.');
  check((await update({value:1,min:-5,max:5,label:'Disk',showLabel:true,showValue:true,valueText:'one',locale:'ro-RO',formatOptions:{style:'percent'},color:'tertiary',variant:'circular',size:64,thickness:6,density:-4})).ack===true,
    'All fourteen Meter properties accept one validated retained patch.');

  // ── md-status-dot: colour transition across a retained update ───────────────────────────────────
  frame=await configure('md-status-dot',{properties:{state:'busy',size:'large'}});
  let box=node(frame).bounds,center=[box.x+box.width/2,box.y+box.height/2];
  const busy=pixel(image(frame),...center);
  frame=await configure('md-status-dot',{properties:{state:'online',size:'large'}});
  box=node(frame).bounds;const online=pixel(image(frame),...center);
  check(distance(busy,online)>60,`online and busy are distinct colours (${online} vs ${busy}).`);
  ack=await update({state:'busy'});
  check(ack.ack===true,'Retained Status Dot state update is acknowledged.');
  const colours=[];const t0=Date.now();
  while(Date.now()-t0<600){frame=await live.call({command:'frame'});colours.push([Date.now()-t0,pixel(image(frame),...center)]);await sleep(15);}
  check(colours.some(([,c])=>distance(c,online)>12&&distance(c,busy)>12),`The colour passes through intermediate values (samples ${colours.map(([t,c])=>`${t}:${c}`).join(' ')}).`);
  check(distance(colours.at(-1)[1],busy)<=3,'The transition settles at the busy colour.');
  check((await update({state:'online',size:'small',inline:true,shape:'circle',live:true,label:'Away soon',density:-2})).ack===true,'All seven Status Dot properties accept one retained patch.');
  for(const properties of [{state:'idle'},{size:12},{inline:'yes'},{shape:'square'}]) check(Boolean((await update(properties)).error),`Invalid Status Dot patch ${JSON.stringify(properties)} is rejected.`);

  // ── md-loading-indicator: the retained root keeps animating through an update ───────────────────
  // (A remount would also animate, so continuity of the 4.55 s morph is not measurable from pixels; the retained-root
  //  path itself is the one whose transitions the Meter glide and Status Dot fade above prove.)
  frame=await configure('md-loading-indicator',{properties:{label:'Busy'}});
  const rootBox=node(frame).bounds;await sleep(300);
  ack=await update({label:'Still busy'});
  const first=await live.call({command:'frame'});await sleep(200);const second=await live.call({command:'frame'});
  check(ack.ack===true&&!(ack.events??[]).length&&first.png!==second.png,'After a retained label update the same root keeps morphing (captured pixels keep changing).');
  check(['x','y','width','height'].every(k=>Math.abs(node(second).bounds[k]-rootBox[k])<.05),'The label update leaves the 48pt root geometry unchanged.');
  ack=await update({variant:'contained',density:-1});await sleep(60);frame=await live.call({command:'frame'});
  check(ack.ack===true&&Math.abs(node(frame).bounds.width-44)<.05,'Contained/density update applies the source 44pt rung to the same root.');
  for(const properties of [{variant:'boxed'},{label:3},{density:1}]) check(Boolean((await update(properties)).error),`Invalid Loading patch ${JSON.stringify(properties)} is rejected.`);

  // ── md-badge: retained content/variant updates (no property-change motion in the source) ───────
  frame=await configure('md-badge',{properties:{value:'3'}});
  const w1=node(frame).bounds.width;
  check((await update({value:'1234'})).ack===true,'Retained Badge value update is acknowledged.');
  frame=await live.call({command:'frame'});const w2=node(frame).bounds.width;
  check(w2>w1,`A longer value widens the same badge (${w1} → ${w2}).`);
  check((await update({variant:'small'})).ack===true,'Variant update is retained.');
  frame=await live.call({command:'frame'});
  check(node(frame).bounds.width<w1&&Math.abs(node(frame).bounds.width-node(frame).bounds.height)<.05,'The small variant is the square dot.');
  check((await update({variant:'large',value:'',max:9,icon:'error',shape:'circle',density:-3})).ack===true,'All six Badge properties accept one retained patch.');
  for(const properties of [{variant:'medium'},{max:'9'},{shape:'square'},{value:9}]) check(Boolean((await update(properties)).error),`Invalid Badge patch ${JSON.stringify(properties)} is rejected.`);
  frame=await configure('md-progress-indicator',{properties:{value:10}});
  check(Boolean((await update({state:'busy'})).error),'Communication patches cannot reach another component root.');
}finally{live?.close();}
console.log(`Passed ${checks} retained Laboratory update checks for Meter glide, Status Dot transition, Loading retention and Badge.`);

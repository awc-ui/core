import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-line/area/bar/pie-chart and md-sparkline: typed hooks (defaults + local values), retained
// property updates with the source types, and the methods with results through AWCChartController.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},10000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const node=(frame,name)=>frame.inspection?.nodes.find(item=>item.name===name&&item.metrics);
const metric=(frame,name,key)=>{const n=node(frame,name);const v=n?.metrics?.[key];return v&&typeof v==='object'&&'value' in v?v.value:v;};
const color=(value,hex)=>{const s=String(value ?? '').toUpperCase().replace(/\s/g,'');const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return s.startsWith(hex.toUpperCase())||s.startsWith(`RGB(${r},${g},${b}`)||s.startsWith(`RGBA(${r},${g},${b}`);};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const series=[{label:'Revenue',data:[12,18,15,22,28,26]},{label:'Cost',data:[8,11,10,14,16,18]}],xAxis={data:['Jan','Feb','Mar','Apr','May','Jun']};
try{
  // ---- md-line-chart: hooks, zoom methods, PNG export, retained updates ----
  let f=await configure('md-line-chart',{properties:{label:'Revenue',series,xAxis,zoom:'slider',noAnimation:true},lineChartAppearanceDefaults:{padding:20},lineChartAppearance:{background:'#FFF3E0',padding:28}});
  check(!f.error,`configure line: ${f.error}`);
  const seen=[...(f.events??[])];
  f=await frame();seen.push(...(f.events??[]));await wait(60);seen.push(...((await frame()).events??[]));
  // Lifecycle: one mdReady after the first render (chart.ts emits it once per connection), none for later renders.
  check(seen.filter(e=>e.name==='mdReady').length===1,`one mdReady after mount (${seen.map(e=>e.name)}).`);
  check(color(metric(f,'md-line-chart','background'),'#FFF3E0'),`line background hook (${metric(f,'md-line-chart','background')}).`);
  check(metric(f,'md-line-chart','padding')===28,`local padding wins over the default (${metric(f,'md-line-chart','padding')}).`);
  check(metric(f,'md-line-chart','zoomStart')===0&&metric(f,'md-line-chart','zoomEnd')===5,'full window before setZoom.');
  let m=await method('setZoom',[1,4]);check(!m.error,`setZoom: ${m.error}`);await wait(60);f=await frame();
  check(metric(f,'md-line-chart','zoomStart')===1&&metric(f,'md-line-chart','zoomEnd')===4,`setZoom(1, 4) windows the axis (${metric(f,'md-line-chart','zoomStart')}…${metric(f,'md-line-chart','zoomEnd')}).`);
  check((f.events??m.events??[]).some(e=>e.name==='mdZoom')||(m.events??[]).some(e=>e.name==='mdZoom'),'setZoom emits mdZoom.');
  await method('resetZoom');f=await frame();check(metric(f,'md-line-chart','zoomEnd')===5,'resetZoom restores the window.');
  m=await method('toDataURL');check(typeof m.result==='string'&&m.result.startsWith('data:image/png;base64,')&&m.result.length>200,`toDataURL returns a PNG data URL (${String(m.result).slice(0,40)}).`);
  m=await method('replay');check(!m.error,`replay: ${m.error}`);
  m=await method('refreshTheme');check(!m.error,'refreshTheme.');m=await method('resize');check(!m.error,'resize.');
  let u=await update({legend:'bottom',curve:'step',series:[{label:'Revenue',data:[1,2,3,4,5,6]}]});check(!u.error,`typed updates: ${u.error}`);
  await wait(60);f=await frame();check(metric(f,'md-line-chart','lines')===1,`series update re-renders (${metric(f,'md-line-chart','lines')} lines).`);
  check(![...(u.events??[]),...(f.events??[])].some(e=>e.name==='mdReady'),'a retained update does not emit mdReady again.');
  for(const bad of [{curve:'bezier'},{valueFormatter:'x'},{density:-5},{series:'x'},{bogus:1}]){u=await update(bad);check(Boolean(u.error),`rejects ${JSON.stringify(bad)}.`);}
  for(const [name,args] of [['setZoom',[1]],['getInstance',[]],['replay',[1]],['drill',[0]]]){m=await method(name,args);check(Boolean(m.error),`rejects ${name}(${args}).`);}
  // ---- md-bar-chart and md-pie-chart: drill ----
  f=await configure('md-bar-chart',{properties:{label:'Revenue',series,xAxis,noAnimation:true},barChartAppearance:{zoomHandleColor:'#E65100'}});check(!f.error,`configure bar: ${f.error}`);
  m=await method('drill',[0]);check(!m.error,`bar drill(0): ${m.error}`);m=await method('drill',[0,'left']);check(Boolean(m.error),'bar drill rejects a bad direction.');
  f=await configure('md-pie-chart',{properties:{label:'Traffic',data:[{label:'Search',value:42},{label:'Direct',value:26}],innerRadius:'60%',noAnimation:true},pieChartAppearance:{background:'#E3F2FD'}});
  f=await frame();check(color(metric(f,'md-pie-chart','background'),'#E3F2FD'),`pie background hook (${metric(f,'md-pie-chart','background')}).`);
  check(metric(f,'md-pie-chart','slices')===2,'pie slices.');
  m=await method('drill',[1,'up']);check(!m.error,`pie drill(1, up): ${m.error}`);m=await method('setZoom',[0,1]);check(Boolean(m.error),'pie has no setZoom.');
  u=await update({innerRadius:'40%',highlight:'series'});check(!u.error,`pie updates: ${u.error}`);
  // ---- md-sparkline: hooks, no replay ----
  f=await configure('md-sparkline',{properties:{data:[3,5,4,7,6,9,8]},sparklineAppearance:{blockSize:40}});check(!f.error,`configure sparkline: ${f.error}`);
  f=await frame();check(metric(f,'md-sparkline','height')===40,`sparkline block size hook (${metric(f,'md-sparkline','height')}).`);
  m=await method('replay');check(Boolean(m.error),'sparkline has no replay().');m=await method('resize');check(!m.error,'sparkline resize().');
  console.log(`chart live host: ${checks} checks passed`);
}finally{live?.close();}

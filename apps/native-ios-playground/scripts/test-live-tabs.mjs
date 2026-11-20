import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every frame must pass the Laboratory server's own inspection schema (gate-7 R6-01/R6-02): the server rejects the whole
// frame (502 INVALID_LIVE_FRAME) and closes the session otherwise.
import {validateNativeInspection} from '../../native-playground/native-inspection.mjs';
const {decodePNG}=await import(process.env.AWC_PNG_MODULE ?? fileURLToPath(new URL('../../../tools/ax/png.mjs',import.meta.url)));
// Dark (text) pixels of a frame: the panel's copy paints only while the panel is active.
const inkPixels=frame=>{const img=decodePNG(Buffer.from(frame.png,'base64'));let n=0;for(let i=0;i<img.data.length;i+=4)if(img.data[i]+img.data[i+1]+img.data[i+2]<300)n++;return n;};
let schemaFrames=0;
process.on('exit',code=>{if(code===0)console.log(`${schemaFrames} frames passed the Laboratory inspection schema.`);});

// Actual SwiftUI live host for md-tabs / md-tab / md-tab-panels / md-tab-panel: the recipe tabs, typed hooks, retained
// property updates (silent activeTabIndex, variant, divider, tab state, panel sizing) and selectTab(index) through the AWCTabsController.
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const color=(value,hex)=>Array.isArray(value)&&rgb(hex).every((channel,i)=>Math.abs(value[i]-channel)<=.006);
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',data=>{stderr+=data;});
  child.stdout.on('data',data=>{
    buffer+=data;let end;
    while((end=buffer.indexOf('\n'))>=0){
      const reply=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
      const item=pending.get(reply.id);if(item){pending.delete(reply.id);clearTimeout(item.timeout);
        if(reply.inspection){try{validateNativeInspection(reply.inspection,'macos');schemaFrames++;}catch(error){item.reject(new Error(`Frame rejected by the Laboratory inspection schema: ${error.message} ${JSON.stringify(reply.inspection.nodes?.map(n=>[n.name,n.metrics&&Object.fromEntries(Object.entries(n.metrics).filter(([k])=>['padding','margin','border','gap'].includes(k)))]))}`));continue;}}
        item.resolve(reply);}
    }
  });
  child.on('exit',(code,signal)=>{for(const item of pending.values()){clearTimeout(item.timeout);item.reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
  return {
    call:(message,ms=7000)=>new Promise((resolve,reject)=>{
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},ms);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name&&item.metrics);
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const changes=r=>(r.events??[]).filter(e=>e.name==='mdTabChange');
try{
  let f=await configure('md-tabs',{properties:{},tabsAppearance:{containerColor:'#E8DEF8',activeLabelColor:'#B3261E',activeIndicatorColor:'#D84315',activeIndicatorHeight:5}});
  check(!f.error,`configure: ${f.error}`);
  await wait(800);f=await frame();
  let list=nodes(f,'md-tabs')[0],tabs=nodes(f,'md-tab');
  check(tabs.length===3,`three tabs (${tabs.length}).`);
  check(list&&list.metrics.activeTabIndex===0&&color(list.metrics.host,'#E8DEF8'),`tablist hooks (${JSON.stringify(list?.metrics)}).`);
  check(tabs.map(t=>t.metrics.name).join('|')==='Overview|Activity|Settings',`recipe tabs (${tabs.map(t=>t.metrics.name)}).`);
  const active=tabs.find(t=>t.metrics.active);
  check(active&&active.metrics.name==='Overview'&&color(active.metrics.color,'#B3261E')&&color(active.metrics.indicatorColor,'#D84315'),`the first tab is active with the hook colours (${JSON.stringify(active?.metrics)}).`);
  const indicator=nodes(f,'indicator').find(n=>n.metrics.opacity>0.99);
  check(indicator&&Math.abs(indicator.bounds.height-5)<=0.01,`indicator height hook (${JSON.stringify(indicator?.bounds)}).`);
  let m=await method('selectTab',[2]);check(!m.error,`selectTab: ${m.error}`);
  check(changes(m).length===1&&changes(m)[0].detail?.index===2&&changes(m)[0].detail?.previousIndex===0,`selectTab(2) emits mdTabChange ${JSON.stringify(m.events)}.`);
  await wait(500);f=await frame();check(nodes(f,'md-tabs')[0]?.metrics.activeTabIndex===2,'selectTab(2) activates Settings.');
  m=await method('selectTab',[2]);check(changes(m).length===0,'selecting the active tab again emits nothing.');
  m=await method('selectTab',[7]);check(!m.error&&changes(m).length===0,'an index outside the tabs is ignored.');
  m=await method('selectTab',[-1]);check(!m.error&&changes(m).length===0,'a negative index is ignored.');
  m=await method('selectTab');check(Boolean(m.error),'selectTab requires an index.');
  m=await method('selectTab',['1']);check(Boolean(m.error),'selectTab rejects a string.');
  let u=await live.call({command:'update',properties:{activeTabIndex:1}});check(!u.error,`update: ${u.error}`);
  check(changes(u).length===0,'writing activeTabIndex is silent.');
  await wait(500);f=await frame();check(nodes(f,'md-tabs')[0]?.metrics.activeTabIndex===1,'activeTabIndex 1 selects Activity.');
  u=await live.call({command:'update',properties:{variant:'secondary',divider:'auto',ariaLabelProp:'Project views'}});check(!u.error,`update: ${u.error}`);
  await wait(300);f=await frame();list=nodes(f,'md-tabs')[0];
  check(list?.metrics.variant==='secondary'&&list?.metrics.divider==='auto'&&list?.metrics.label==='Project views',`variant, divider and label update (${JSON.stringify(list?.metrics)}).`);
  u=await live.call({command:'update',properties:{activeTabIndex:'x'}});check(Boolean(u.error),'a string activeTabIndex is rejected.');
  u=await live.call({command:'update',properties:{variant:'tertiary'}});check(Boolean(u.error),'an unknown variant is rejected.');
  u=await live.call({command:'update',properties:{bogus:1}});check(Boolean(u.error),'unknown properties are rejected.');
  f=await configure('md-tab',{properties:{},tabAppearance:{activeLabelColor:'#B3261E',containerColor:'#FFD8E4'}});check(!f.error,`configure tab: ${f.error}`);
  await wait(800);f=await frame();
  let t=nodes(f,'md-tab')[0];check(t&&t.metrics.active===true&&t.metrics.name==='Overview'&&color(t.metrics.color,'#B3261E')&&color(t.metrics.container,'#FFD8E4'),`a standalone active tab with the hooks (${JSON.stringify(t?.metrics)}).`);
  u=await live.call({command:'update',properties:{active:false,label:'Files'}});check(!u.error,`tab update: ${u.error}`);
  await wait(400);f=await frame();t=nodes(f,'md-tab')[0];check(t?.metrics.active===false&&t?.metrics.name==='Files'&&color(t.metrics.color,'#49454F'),`the tab deactivates and relabels (${JSON.stringify(t?.metrics)}).`);
  u=await live.call({command:'update',properties:{active:'yes'}});check(Boolean(u.error),'a string active is rejected.');
  f=await configure('md-tab-panels',{properties:{}});check(!f.error,`configure panels: ${f.error}`);
  await wait(600);f=await frame();
  let r=nodes(f,'md-tab-panels')[0];check(r&&r.metrics.count===3&&r.metrics.index===0&&r.metrics.sizing==='stable',`three panels, the first shown (${JSON.stringify(r?.metrics)}).`);
  check(nodes(f,'md-tab-panel').filter(p=>p.metrics.active).length===1,'one active panel.');
  u=await live.call({command:'update',properties:{sizing:'active'}});check(!u.error,`panels update: ${u.error}`);
  await wait(300);f=await frame();check(nodes(f,'md-tab-panels')[0]?.metrics.sizing==='active'&&nodes(f,'md-tab-panel').length===1,'sizing active keeps only the active panel.');
  u=await live.call({command:'update',properties:{sizing:'auto'}});check(Boolean(u.error),'an unknown sizing is rejected.');
  // Gate-7 R6-21: the page takes `active` from the request — the Studio default (absent / false) is an inactive, unpainted panel,
  // as on Android and the Web.
  f=await configure('md-tab-panel',{properties:{}});check(!f.error,`configure panel: ${f.error}`);
  await wait(600);f=await frame();check(nodes(f,'md-tab-panel')[0]?.metrics.active===false&&inkPixels(f)===0,`the Studio default panel is inactive and paints nothing (${inkPixels(f)} text pixels).`);
  f=await configure('md-tab-panel',{properties:{active:true}});check(!f.error,`configure active panel: ${f.error}`);
  await wait(600);f=await frame();check(nodes(f,'md-tab-panel')[0]?.metrics.active===true&&inkPixels(f)>50,`an active panel paints its copy (${inkPixels(f)} text pixels).`);
  // Gate-7 R6-23: inherited text in a panel paints the theme's on-surface colour (#1C1B1F), as on Android.
  {const img=decodePNG(Buffer.from(f.png,'base64'));let dark=[255,255,255];for(let i=0;i<img.data.length;i+=4)if(img.data[i]+img.data[i+1]+img.data[i+2]<dark[0]+dark[1]+dark[2])dark=[img.data[i],img.data[i+1],img.data[i+2]];
   check([0x1C,0x1B,0x1F].every((v,i)=>Math.abs(v-dark[i])<=12),`the panel's copy paints on-surface (${dark}).`);}
  u=await live.call({command:'update',properties:{active:false}});check(!u.error,`panel update: ${u.error}`);
  await wait(300);f=await frame();check(nodes(f,'md-tab-panel')[0]?.metrics.active===false&&inkPixels(f)===0,'the panel deactivates and its copy disappears.');
  u=await live.call({command:'update',properties:{label:'x'}});check(Boolean(u.error),'panels have no label property.');
  // aria-controls → AXLinkedUIElements (gate-7 R6-09): in the composed reference each tab controls its panel; the active tab's
  // linked element is the shown panel, named by the tab, read through the Accessibility API as VoiceOver reads it.
  f=await configure('md-tabs',{properties:{},scenario:'tabs-panels'});check(!f.error,`configure tabs-panels: ${f.error}`);
  await wait(800);
  const axTabs=async()=>{const s=await live.call({command:'accessibility'},30000);const out=[];
    const walk=n=>{if(!n||typeof n!=='object')return;if(n.subrole==='AXTabButton')out.push({name:n.description??n.title??'',active:n.value===1||n.value==='1'||n.value===true,linked:n.linked??[]});(n.children??[]).forEach(walk);};
    (s.windows??[]).forEach(walk);return {trusted:s.axTrusted,tabs:out};};
  // (The host reads its own process: no Accessibility trust is needed, as for tools/ax.)
  let ax=await axTabs();
  check(ax.tabs.length===3,`three tabs in the accessibility tree (${JSON.stringify(ax.tabs)}).`);
  // (Inactive panels are hidden from accessibility, as Chrome leaves a hidden aria-controls target out of the relation.)
  check(ax.tabs.find(t=>t.active)?.name==='Overview'&&JSON.stringify(ax.tabs.find(t=>t.active)?.linked)==='["Overview"]',`the active tab Overview links to its panel (${JSON.stringify(ax.tabs)}).`);
  m=await method('selectTab',[2]);check(!m.error,`tabs-panels selectTab: ${m.error}`);await wait(600);
  ax=await axTabs();check(ax.tabs.find(t=>t.active)?.name==='Settings'&&JSON.stringify(ax.tabs.find(t=>t.active)?.linked)==='["Settings"]',`after selectTab(2) the active tab links to the Settings panel (${JSON.stringify(ax.tabs)}).`);
  console.log(`md-tabs live host: ${checks} checks passed`);
}finally{live?.close();}

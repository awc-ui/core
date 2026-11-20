import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every frame must pass the Laboratory server's own inspection schema (gate-7 R6-01/R6-02): the server rejects the whole
// frame (502 INVALID_LIVE_FRAME) and closes the session otherwise.
import {validateNativeInspection} from '../../native-playground/native-inspection.mjs';
let schemaFrames=0;
process.on('exit',code=>{if(code===0)console.log(`${schemaFrames} frames passed the Laboratory inspection schema.`);});

// Actual SwiftUI live host for n5's navigation components (md-toolbar, md-navigation-rail, md-navigation-rail-tab, md-app-bar): typed
// hooks (defaults + local values), retained property updates with the source types, the methods through their
// controllers (setFocus(); expand / collapse / toggle / focusTab, clearSubmenuSelection), and the lifecycle (a new session
// binds a fresh controller; nothing is retained from the previous one).
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
      const item=pending.get(reply.id);if(item){pending.delete(reply.id);clearTimeout(item.timeout);
        if(reply.inspection){try{validateNativeInspection(reply.inspection,'macos');schemaFrames++;}catch(error){item.reject(new Error(`Frame rejected by the Laboratory inspection schema: ${error.message} ${JSON.stringify(reply.inspection.nodes?.map(n=>[n.name,n.metrics&&Object.fromEntries(Object.entries(n.metrics).filter(([k])=>['padding','margin','border','gap'].includes(k)))]))}`));continue;}}
        item.resolve(reply);}
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
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name&&item.metrics);
const val=v=>v&&typeof v==='object'&&'value' in v?v.value:v;
const metric=(frame,name,key)=>val(nodes(frame,name)[0]?.metrics?.[key]);
const color=(value,hex)=>{
  if(Array.isArray(value)){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return Math.abs(value[0]-r)<0.003&&Math.abs(value[1]-g)<0.003&&Math.abs(value[2]-b)<0.003;}
  const s=String(value ?? '').toUpperCase().replace(/\s/g,'');const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return s.startsWith(hex.toUpperCase())||s.startsWith(`RGB(${r},${g},${b}`)||s.startsWith(`RGBA(${r},${g},${b}`);
};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  // ---- md-toolbar: the Laboratory recipe (floating Formatting: undo, redo, divider, bold, italic) ----
  let f=await configure('md-toolbar',{properties:{variant:'floating',ariaLabelProp:'Formatting'},toolbarAppearanceDefaults:{padding:12,gap:6},toolbarAppearance:{containerColor:'#FFE0B2',padding:20}});
  check(!f.error,`configure: ${f.error}`);
  await wait(300);f=await frame();
  check(metric(f,'md-toolbar','role')==='toolbar'&&metric(f,'md-toolbar','orientation')==='horizontal'&&metric(f,'md-toolbar','label')==='Formatting',
    `a named horizontal toolbar (${metric(f,'md-toolbar','role')} ${metric(f,'md-toolbar','orientation')} ${metric(f,'md-toolbar','label')}).`);
  const members=metric(f,'md-toolbar','members')??[];
  check(members.length===4,`four roving members: the icon buttons, not the divider (${JSON.stringify(members)}).`);
  check(color(metric(f,'container','background'),'#FFE0B2'),`the pill takes the colour hook (${JSON.stringify(metric(f,'container','background'))}).`);
  check(metric(f,'container','paddingValue')===20,`the local padding wins over the default (${metric(f,'container','paddingValue')}).`);
  check(metric(f,'container','itemGap')===6,`the default gap applies where no local value is set (${metric(f,'container','itemGap')}).`);
  // One roving Tab stop: the group's active member (the first, before any focus) — the live frame inspects the toolbar root.
  check(metric(f,'md-toolbar','activeID')===members[0],`one Tab stop on the first member (${metric(f,'md-toolbar','activeID')} vs ${members[0]}).`);
  // ---- setFocus() ----
  let m=await method('setFocus');check(!m.error,`setFocus: ${m.error}`);
  m=await method('setFocus',[1]);check(Boolean(m.error),'setFocus rejects arguments.');
  m=await method('expand');check(Boolean(m.error),'an unknown method is rejected.');
  // ---- retained updates ----
  let u=await update({layout:'vertical'});check(!u.error,`layout update: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','orientation')==='vertical',`vertical floating toolbar (${metric(f,'md-toolbar','orientation')}).`);
  u=await update({variant:'docked',density:-2});check(!u.error,`variant + density: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','orientation')==='horizontal',`layout is ignored on a docked bar (${metric(f,'md-toolbar','orientation')}).`);
  check(metric(f,'md-toolbar','height')===56,`docked height at density -2 is 56 (${metric(f,'md-toolbar','height')}; scale ${metric(f,'md-toolbar','density')}, node density ${JSON.stringify(metric(f,'md-toolbar','localDensity'))}).`);
  u=await update({containerSemantics:'generic'});check(!u.error,`semantics: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','role')==='generic'&&(metric(f,'md-toolbar','members')??[]).length===0,`generic mode: no role, no roving group (${metric(f,'md-toolbar','role')}).`);
  check(metric(f,'md-toolbar','activeID')==='','generic mode: no roving stop, every control keeps its own Tab stop.');
  u=await update({containerSemantics:'toolbar',color:'vibrant',alignment:'center',ariaLabelledby:'title'});check(!u.error,`back to toolbar: ${u.error}`);await wait(150);f=await frame();
  check(metric(f,'md-toolbar','role')==='toolbar'&&(metric(f,'md-toolbar','members')??[]).length===4,'the roving group re-syncs after generic → toolbar.');
  for(const bad of [{variant:'pill'},{layout:'diagonal'},{density:-5},{alignment:'around'},{bogus:1},{ariaLabelProp:3}]){
    u=await update(bad);check(Boolean(u.error),`rejected: ${JSON.stringify(bad)}.`);
  }
  // ---- lifecycle: a new session binds a fresh controller and starts from the recipe ----
  f=await configure('md-toolbar',{properties:{variant:'docked',ariaLabelProp:'Edit'}});check(!f.error,`reconfigure: ${f.error}`);
  await wait(300);f=await frame();
  check(metric(f,'md-toolbar','label')==='Edit'&&metric(f,'md-toolbar','orientation')==='horizontal'&&(metric(f,'md-toolbar','members')??[]).length===4,'a new session renders its own configuration.');
  m=await method('setFocus');check(!m.error,`setFocus after remount: ${m.error}`);
  console.log(`md-toolbar live host: ${checks} checks passed`);
  // ---- md-navigation-rail: the Laboratory recipe (Home active, Saved, Settings) ----
  const before=checks;
  f=await configure('md-navigation-rail',{properties:{},navigationRailAppearanceDefaults:{containerColor:'#E0F2F1',containerWidth:96},navigationRailAppearance:{containerColor:'#FFF3E0'},
    navigationRailTabAppearance:{indicatorColor:'#FFCC80'}});
  check(!f.error,`rail configure: ${f.error}`);await wait(300);f=await frame();
  check(metric(f,'md-navigation-rail','count')===3&&metric(f,'md-navigation-rail','activeIndex')===0,`three destinations, Home active (${metric(f,'md-navigation-rail','count')} ${metric(f,'md-navigation-rail','activeIndex')}).`);
  check(color(metric(f,'md-navigation-rail','background'),'#FFF3E0'),`the local container colour wins over the default (${JSON.stringify(metric(f,'md-navigation-rail','background'))}).`);
  check(metric(f,'md-navigation-rail','width')===96,`the default collapsed width applies where no local value is set (${metric(f,'md-navigation-rail','width')}).`);
  check(color(metric(f,'indicator','color'),'#FFCC80'),`the destination hook passes down (${JSON.stringify(metric(f,'indicator','color'))}).`);
  for(const [name,variant,width] of [['expand','expanded',220],['collapse','standard',96],['toggle','expanded',220]]){
    m=await method(name);check(!m.error,`${name}: ${m.error}`);await wait(450);f=await frame();
    check(metric(f,'md-navigation-rail','variant')===variant&&metric(f,'md-navigation-rail','width')===width,`${name}() → ${variant} ${width} (${metric(f,'md-navigation-rail','variant')} ${metric(f,'md-navigation-rail','width')}).`);
  }
  m=await method('focusTab',[1]);check(!m.error,`focusTab: ${m.error}`);
  for(const [name,args] of [['focusTab',[]],['focusTab',[1.5]],['expand',[1]],['setFocus',[]]]){m=await method(name,args);check(Boolean(m.error),`rejected: ${name}(${JSON.stringify(args)}).`);}
  u=await update({orientation:'horizontal'});check(!u.error,`orientation: ${u.error}`);await wait(200);f=await frame();
  check(metric(f,'md-navigation-rail','horizontal')===true,`a horizontal bar (${metric(f,'md-navigation-rail','horizontal')}).`);
  u=await update({orientation:'vertical',variant:'standard',labelVisibility:'none',density:-2,activeIndex:2});check(!u.error,`rail updates: ${u.error}`);await wait(450);f=await frame();
  check(metric(f,'md-navigation-rail','density')===-2&&metric(f,'md-navigation-rail','activeIndex')===2&&metric(f,'md-navigation-rail','variant')==='standard',
    `density, selection and variant updates (${metric(f,'md-navigation-rail','density')} ${metric(f,'md-navigation-rail','activeIndex')} ${metric(f,'md-navigation-rail','variant')}).`);
  for(const bad of [{variant:'mini'},{alignment:'center'},{density:-5},{orientation:'diagonal'},{modal:'yes'},{bogus:1}]){u=await update(bad);check(Boolean(u.error),`rejected: ${JSON.stringify(bad)}.`);}
  // ---- md-navigation-rail-tab: a destination alone (Home, active) ----
  f=await configure('md-navigation-rail-tab',{properties:{label:'Home',icon:'home',active:true},navigationRailTabAppearance:{indicatorColor:'#B2DFDB'}});check(!f.error,`tab configure: ${f.error}`);
  await wait(300);f=await frame();
  check(nodes(f,'md-navigation-rail-tab').length===1&&metric(f,'md-navigation-rail-tab','active')===true,'a single active destination.');
  check(color(metric(f,'indicator','color'),'#B2DFDB'),`the destination hook (${JSON.stringify(metric(f,'indicator','color'))}).`);
  m=await method('clearSubmenuSelection');check(!m.error,`clearSubmenuSelection: ${m.error}`);
  m=await method('clearSubmenuSelection',[0]);check(Boolean(m.error),'clearSubmenuSelection rejects arguments.');
  u=await update({label:'Inbox',badgeValue:'3'});check(!u.error,`tab update: ${u.error}`);
  u=await update({active:1});check(Boolean(u.error),'rejected: active 1.');
  console.log(`md-navigation-rail live host: ${checks-before} checks passed`);
  // ---- md-app-bar: the Laboratory recipe (Your workspace, the menu leading icon, a trailing Search action) ----
  const beforeBar=checks;
  const box=(frame,name)=>(frame.inspection?.nodes??[]).find(item=>item.name===name&&item.bounds)?.bounds;
  f=await configure('md-app-bar',{properties:{headline:'Your workspace',leadingIcon:'menu',leadingIconLabel:'Open navigation'},
    appBarAppearanceDefaults:{containerColor:'#E0F2F1',rowHeight:72},appBarAppearance:{containerColor:'#FFF3E0',headlineColor:'#BF360C'}});
  check(!f.error,`app-bar configure: ${f.error}`);await wait(300);f=await frame();
  check(metric(f,'md-app-bar','variant')==='small'&&metric(f,'md-app-bar','role')==='banner',`a small bar (${metric(f,'md-app-bar','variant')} ${metric(f,'md-app-bar','role')}).`);
  check(color(metric(f,'md-app-bar','fill'),'#FFF3E0'),`the local container colour wins over the default (${metric(f,'md-app-bar','fill')}).`);
  check(Math.abs((box(f,'row')?.height??0)-72)<0.6,`the default row height applies where no local value is set (${box(f,'row')?.height}).`);
  check(Boolean(box(f,'title')),'the headline renders.');
  u=await update({variant:'medium',subtitle:'12 unread'});check(!u.error,`variant: ${u.error}`);await wait(250);f=await frame();
  check(metric(f,'md-app-bar','variant')==='medium'&&Boolean(box(f,'expanded')),`a medium bar with its expanded block (${metric(f,'md-app-bar','variant')}).`);
  u=await update({scrolled:true});check(!u.error,`scrolled: ${u.error}`);await wait(300);f=await frame();
  check(metric(f,'md-app-bar','scrolled')===true&&!color(metric(f,'md-app-bar','fill'),'#FFF3E0'),`scrolled takes the scrolled container colour (${metric(f,'md-app-bar','fill')}).`);
  u=await update({variant:'search',searchPlaceholder:'Search mail',searchDisabled:true,titleAlignment:'center',density:-2});check(!u.error,`search updates: ${u.error}`);await wait(250);f=await frame();
  check(metric(f,'md-app-bar','variant')==='search'&&Boolean(box(f,'search')),`a search bar (${metric(f,'md-app-bar','variant')}).`);
  check(metric(f,'search','opacity')===0.38,`a disabled search (${metric(f,'search','opacity')}).`);
  for(const bad of [{variant:'tiny'},{titleAlignment:'end'},{density:-5},{scrolled:'yes'},{bogus:1}]){u=await update(bad);check(Boolean(u.error),`rejected: ${JSON.stringify(bad)}.`);}
  f=await configure('md-app-bar',{properties:{headline:'Fresh'},appBarAppearance:{rowHeight:56}});check(!f.error,`app-bar reconfigure: ${f.error}`);await wait(300);f=await frame();
  check(metric(f,'md-app-bar','variant')==='small'&&Math.abs((box(f,'row')?.height??0)-56)<0.6,`a new session renders its own configuration (${metric(f,'md-app-bar','variant')} ${box(f,'row')?.height}).`);
  console.log(`md-app-bar live host: ${checks-beforeBar} checks passed`);
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every frame must pass the Laboratory server's own inspection schema (gate-7 R6-01/R6-02): the server rejects the whole
// frame (502 INVALID_LIVE_FRAME) and closes the session otherwise.
import {validateNativeInspection} from '../../native-playground/native-inspection.mjs';
const {decodePNG}=await import(process.env.AWC_PNG_MODULE ?? fileURLToPath(new URL('../../../tools/ax/png.mjs',import.meta.url)));
let schemaFrames=0;
process.on('exit',code=>{if(code===0)console.log(`${schemaFrames} frames passed the Laboratory inspection schema.`);});

// Actual SwiftUI live host for md-breadcrumbs / md-breadcrumb-item: the recipe trail, typed hooks, retained property
// updates (collapse window, separator, author current) and expand()/collapse() through the AWCBreadcrumbsController.
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
    call:message=>new Promise((resolve,reject)=>{
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name&&item.metrics);
// Gate-7 R6-21: the painted label ink — in each label box, the pixel farthest from the box's dominant (background) colour, at
// the frame's backing scale (glyph cores are fully covered) — against the expected colour composited over that background.
const labelInks=frame=>{const img=decodePNG(Buffer.from(frame.png,'base64')),k=img.width/640;return nodes(frame,'label').map(n=>{
  const b=n.bounds,x0=Math.max(0,Math.floor(b.x*k)),y0=Math.max(0,Math.floor((b.y+b.height*.15)*k)),x1=Math.min(img.width,Math.ceil((b.x+b.width)*k)),y1=Math.min(img.height,Math.ceil((b.y+b.height*.6)*k)),count=new Map();
  const px=(x,y)=>{const i=(y*img.width+x)*4;return [img.data[i],img.data[i+1],img.data[i+2]];};
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const key=px(x,y).join();count.set(key,(count.get(key)??0)+1);}
  const bg=[...count].sort((a,c)=>c[1]-a[1])[0][0].split(',').map(Number);let ink=bg,far=-1;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=px(x,y),d=Math.max(...p.map((v,i)=>Math.abs(v-bg[i])));if(d>far){far=d;ink=p;}}
  return {id:n.id,bg,ink};});};
const inkIs=(entry,hex,alpha=1,tol=12)=>{const w=rgb(hex).map((v,i)=>entry.bg[i]*(1-alpha)+v*255*alpha);return entry.ink.every((v,i)=>Math.abs(v-w[i])<=tol);};
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let f=await configure('md-breadcrumbs',{properties:{},breadcrumbsAppearance:{currentBackground:'#6A1B9A',linkColor:'#1565C0',gap:14,itemPadding:{top:4,right:20,bottom:4,left:20}}});
  check(!f.error,`configure: ${f.error}`);
  await wait(800);f=await frame();
  let surfaces=nodes(f,'surface');
  check(surfaces.length===3,`three crumbs (${surfaces.length}).`);
  const current=surfaces.find(s=>s.metrics.current===true),links=surfaces.filter(s=>s.metrics.kind==='link');
  check(current&&color(current.metrics.background,'#6A1B9A'),`the last crumb is the current page on the hook background (${JSON.stringify(current?.metrics.background)}).`);
  check(links.length===2&&links.every(s=>color(s.metrics.color,'#1565C0')),'links take the link colour hook.');
  check(links.every(s=>JSON.stringify(s.metrics.padding)==='[4,20,4,20]'),`padding hook (${JSON.stringify(links[0]?.metrics.padding)}).`);
  check(nodes(f,'md-breadcrumbs')[0]?.metrics.listGap===14,'gap hook.');
  let u=await live.call({command:'update',properties:{maxItems:2,itemsBeforeCollapse:1,itemsAfterCollapse:1,separator:'›'}});check(!u.error,`update: ${u.error}`);
  await wait(300);f=await frame();
  check(nodes(f,'surface').length===2&&nodes(f,'overflow-button').length===1,`maxItems 2 collapses the middle crumb behind the toggle (${nodes(f,'surface').length}).`);
  check(nodes(f,'separator').every(s=>s.metrics.text===undefined||s.metrics.text==='›'),'the separator updates.');
  let m=await method('expand');check(!m.error,`expand: ${m.error}`);
  check((m.events??[]).some(e=>e.name==='mdExpand'&&e.detail?.expanded===true&&e.detail?.itemCount===3),`expand emits mdExpand ${JSON.stringify(m.events)}.`);
  await wait(300);f=await frame();check(nodes(f,'surface').length===3&&nodes(f,'overflow-button').length===0,'expand() reveals every crumb.');
  m=await method('collapse');check((m.events??[]).some(e=>e.name==='mdExpand'&&e.detail?.expanded===false),'collapse emits mdExpand.');
  await wait(300);f=await frame();check(nodes(f,'overflow-button').length===1,'collapse() restores the window.');
  m=await method('collapse');check(!(m.events??[]).some(e=>e.name==='mdExpand'),'collapse() again emits nothing.');
  u=await live.call({command:'update',properties:{maxItems:-1}});check(Boolean(u.error),'a negative maxItems is rejected.');
  u=await live.call({command:'update',properties:{bogus:1}});check(Boolean(u.error),'unknown properties are rejected.');
  m=await method('expand',[1]);check(Boolean(m.error),'expand rejects arguments.');
  f=await configure('md-breadcrumb-item',{properties:{},breadcrumbItemAppearance:{linkColor:'#1565C0'}});check(!f.error,`configure item: ${f.error}`);
  await wait(800);f=await frame();
  let s=nodes(f,'surface')[0];check(s&&s.metrics.kind==='link'&&color(s.metrics.color,'#1565C0'),`a standalone crumb is a link (${s?.metrics.kind}).`);
  u=await live.call({command:'update',properties:{current:true}});check(!u.error,`item update: ${u.error}`);
  await wait(300);f=await frame();s=nodes(f,'surface')[0];check(s?.metrics.kind==='static'&&s.metrics.current===true,'current makes it the static current page.');
  u=await live.call({command:'update',properties:{collapsed:true}});check(Boolean(u.error),'collapsed is managed by the trail.');
  // Gate-7 R6-21: the standalone crumb paints what it reports — link ink, the link-colour hook, disabled (at configure and as an
  // update) — and the trail paints the link-colour hook on its links.
  const paintCase=async(label,{tag='md-breadcrumb-item',...fields},update)=>{let g=await configure(tag,{properties:{},...fields});check(!g.error,`configure ${label}: ${g.error}`);
    await wait(800);if(update){const v=await live.call({command:'update',properties:update});check(!v.error,`update ${label}: ${v.error}`);await wait(500);}
    g=await frame();const inks=labelInks(g);check(inks.length>0,`${label}: a label`);return inks;};
  let inks=await paintCase('plain link',{},null);check(inks.every(e=>inkIs(e,'#49454F')),`a standalone link label paints #49454F (${JSON.stringify(inks)}).`);
  inks=await paintCase('link colour',{breadcrumbItemAppearance:{linkColor:'#C62828'}},null);check(inks.every(e=>inkIs(e,'#C62828')),`the link-colour hook paints the standalone label (${JSON.stringify(inks)}).`);
  inks=await paintCase('disabled at configure',{properties:{disabled:true}},null);check(inks.every(e=>inkIs(e,'#1C1B1F',.61)),`a disabled standalone label paints on-surface at 61 % (${JSON.stringify(inks)}).`);
  inks=await paintCase('disabled update',{},{disabled:true});check(inks.every(e=>inkIs(e,'#1C1B1F',.61)),`disabled as an update repaints the label (${JSON.stringify(inks)}).`);
  inks=await paintCase('trail link colour',{tag:'md-breadcrumbs',breadcrumbsAppearance:{linkColor:'#C62828'}},null);
  check(inks.length===3&&inks.slice(0,2).every(e=>inkIs(e,'#C62828'))&&inkIs(inks[2],'#1D192B'),`the trail paints the hook on its links and the current page in on-secondary-container (${JSON.stringify(inks)}).`);
  // Gate-7 R6-10: `rel` (opener/referrer policy of a browsing context) has no native effect — a click on the same link gives the
  // same mdSelect detail and the same navigation for every rel value (exception record in md-breadcrumbs.md).
  const clickRel=async rel=>{
    let g=await configure('md-breadcrumb-item',{properties:{href:'https://example.com/docs',target:'_blank',...(rel===null?{}:{rel})}});check(!g.error,`configure rel ${rel}: ${g.error}`);
    await wait(600);g=await frame();const c=nodes(g,'surface')[0]?.bounds;check(Boolean(c),`rel ${rel}: a link surface.`);
    const r=await live.call({command:'click',x:c.x+c.width/2,y:c.y+c.height/2});check(!r.error,`click rel ${rel}: ${r.error}`);
    await wait(200);const after=await frame();
    const strip=list=>(list??[]).map(e=>({name:e.name,detail:e.detail,...(e.navigation?{navigation:e.navigation}:{})}));
    return JSON.stringify({events:strip([...(r.events??[]),...(after.events??[])]),navigation:r.navigation??after.navigation??null});
  };
  const base=await clickRel(null);check(base.includes('mdSelect'),`a link click emits mdSelect (${base}).`);
  for(const rel of ['opener','noopener noreferrer','nofollow external'])check(await clickRel(rel)===base,`rel "${rel}" has no native effect (same mdSelect and navigation).`);
  console.log(`md-breadcrumbs live host: ${checks} checks passed`);
}finally{live?.close();}

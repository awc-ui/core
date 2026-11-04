import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodePNG} from '../../../tools/ax/png.mjs';

// Actual SwiftUI live host for the md-table family: the typed hooks of the selected member (defaults + local values), retained
// property updates with the source types for all eleven tags, and the methods with results through AWCTableController /
// AWCTablePaginationController.
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
const nodes=(frame,name)=>(frame.inspection?.nodes??[]).filter(item=>item.name===name);
const node=(frame,name)=>nodes(frame,name).find(item=>item.metrics)??nodes(frame,name)[0];
const metric=(frame,name,key)=>{const v=node(frame,name)?.metrics?.[key];return v&&typeof v==='object'&&!Array.isArray(v)&&'value' in v?v.value:v;};
const events=(...frames)=>frames.flatMap(f=>f?.events??[]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/** Pixels within ±tol of #RRGGBB in the frame (logical rectangle optional). */
function count(frame,hex,rect,tol=6){
  const img=decodePNG(Buffer.from(frame.png,'base64')),scale=img.width/frame.logicalWidth||img.width/640;
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const x0=Math.max(0,Math.floor((rect?.x??0)*scale)),y0=Math.max(0,Math.floor((rect?.y??0)*scale));
  const x1=Math.min(img.width,Math.ceil(rect?(rect.x+rect.width)*scale:img.width)),y1=Math.min(img.height,Math.ceil(rect?(rect.y+rect.height)*scale:img.height));
  let n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*img.width+x)*4;if(Math.abs(img.data[i]-r)<=tol&&Math.abs(img.data[i+1]-g)<=tol&&Math.abs(img.data[i+2]-b)<=tol)n++;}
  return n/(scale*scale);
}
function pixel(frame,x,y){const img=decodePNG(Buffer.from(frame.png,'base64')),s=img.width/(frame.logicalWidth||640);const i=(Math.floor(y*s)*img.width+Math.floor(x*s))*4;return [img.data[i],img.data[i+1],img.data[i+2]];}
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();const f=await live.call({command:'configure',tag,width:640,dark:false,...fields});check(!f.error,`configure ${tag}: ${f.error}`);await wait(80);return live.call({command:'frame'});};
// A table method result travels as {awcTableResult: value} (the generic method-result contract rejects a bare null).
let envelopes=0;
const method=async(name,args=[])=>{const m=await live.call({command:'method',method:name,arguments:args});
  if(m&&m.result!==undefined){check(m.result!==null&&typeof m.result==='object'&&Object.keys(m.result).join()==='awcTableResult',`${name} result envelope (${JSON.stringify(m.result)}).`);envelopes++;return{...m,result:m.result.awcTableResult};}
  return m;};
const update=properties=>live.call({command:'update',properties});
const frame=()=>live.call({command:'frame'});
const rejects=async (promise,label)=>{const r=await promise;check(Boolean(r.error),`rejects ${label}.`);};
try{
  // ---- md-table: hooks (defaults first, local wins), the eight methods, retained updates ----
  let f=await configure('md-table',{tableAppearanceDefaults:{headBackground:'#C8E6C9',rowHeightStandard:64},tableAppearance:{headBackground:'#FDE7F3'}});
  check(count(f,'#FDE7F3')>3000,`local head background wins (${count(f,'#FDE7F3')} px).`);
  check(count(f,'#C8E6C9')===0,'the default head background is overridden.');
  const bodyHeights=(metric(f,'md-table','rows')??[]).map(r=>r[1]);
  check(bodyHeights.filter(h=>h>=63&&h<=66).length>=3,`row height hook from the defaults (${bodyHeights}).`);
  let m=await method('getSelection');
  check(m.result&&m.result.count===0&&m.result.total===3&&Array.isArray(m.result.values)&&m.result.all===false,`getSelection() before (${JSON.stringify(m.result)}).`);
  m=await method('selectAll');check(!m.error,`selectAll: ${m.error}`);
  check(events(m,await frame()).some(e=>e.name==='mdSelectionChange'),'selectAll emits mdSelectionChange.');
  m=await method('getSelection');check(m.result?.count===3&&m.result.all===true&&m.result.values.join()==='project-0,project-1,project-2',`getSelection() after selectAll (${JSON.stringify(m.result)}).`);
  m=await method('deselectAll');m=await method('getSelection');check(m.result?.count===0,'deselectAll clears.');
  m=await method('toggleSelectAll');m=await method('getSelection');check(m.result?.count===3,'toggleSelectAll selects all.');
  m=await method('setSort',['name','desc']);check(!m.error,`setSort: ${m.error}`);
  const sorted=events(m,await frame()).find(e=>e.name==='mdSortChange');check(sorted?.detail?.column==='name'&&sorted?.detail?.order==='desc',`setSort emits mdSortChange (${JSON.stringify(sorted?.detail)}).`);
  f=await frame();check(metric(f,'md-table','sortBy')==='name'&&metric(f,'md-table','sortOrder')==='desc','setSort sets the sort state.');
  m=await method('pinColumn',[0,'start']);check(m.result===null&&!m.error,`pinColumn without an explicit template returns null (${JSON.stringify(m.result)}).`);
  let u=await update({columnTemplate:'2fr 1fr 1fr',striped:true});check(!u.error,`table updates: ${u.error}`);await wait(60);
  m=await method('pinColumn',[0,'start']);check(m.result==='start',`pinColumn(0, start) returns start (${JSON.stringify(m.result)}).`);
  check(events(m,await frame()).some(e=>e.name==='mdPinChange'),'pinColumn emits mdPinChange.');
  m=await method('setColumnVisibility',[2,false]);check(m.result===false,`setColumnVisibility(2, false) returns false (${JSON.stringify(m.result)}).`);
  f=await frame();check(JSON.stringify(metric(f,'md-table','columnOrder'))==='[0,1]',`the hidden column leaves the display order (${JSON.stringify(metric(f,'md-table','columnOrder'))}).`);
  m=await method('setColumnVisibility',[2,true]);check(m.result===true,'setColumnVisibility(2, true) returns true.');
  m=await method('animateNextChange');check(!m.error,`animateNextChange: ${m.error}`);
  u=await update({density:'compact',selection:'single',loading:true,loadingMode:'skeleton'});check(!u.error,`density / selection / loading updates: ${u.error}`);
  for(const bad of [{density:'tiny'},{selection:'all'},{columns:'3'},{bogus:1},{sortOrder:'up'}])await rejects(update(bad),`md-table ${JSON.stringify(bad)}`);
  for(const [name,args] of [['setSort',['name']],['pinColumn',[-1,'start']],['pinColumn',[0,'left']],['setColumnVisibility',[0,'no']],['getSelection',[1]],['toggle',[]],['goToPage',[1]]])await rejects(method(name,args),`${name}(${JSON.stringify(args)})`);

  // ---- md-table-row: toggle(), hover hook, updates ----
  f=await configure('md-table-row',{tableRowAppearance:{hoverColor:'#FF0000'}});
  m=await method('toggle');check(!m.error,`toggle: ${m.error}`);
  let ev=events(m,await frame()).find(e=>e.name==='mdRowExpandedChange');check(ev?.detail?.expanded===true,`toggle() expands (${JSON.stringify(ev?.detail)}).`);
  m=await method('toggle');ev=events(m,await frame()).find(e=>e.name==='mdRowExpandedChange');check(ev?.detail?.expanded===false,'toggle() collapses.');
  f=await frame();const row=node(f,'md-table-row'),rb=row?.bounds;check(rb&&rb.height>40,`row bounds (${JSON.stringify(rb)}).`);
  const p=await live.call({command:'pointer',phase:'move',x:rb.x+rb.width-6,y:rb.y+rb.height/2});check(!p.error,`pointer: ${p.error}`);await wait(250);f=await frame();
  const [r,,b]=pixel(f,rb.x+rb.width-6,rb.y+rb.height/2);check(metric(f,'md-table-row','hovered')===true&&r-b>10,`hover layer in the row hook colour (rgb ${pixel(f,rb.x+rb.width-6,rb.y+rb.height/2)}).`);
  u=await update({expanded:true,highlight:true,clickable:true});check(!u.error,`row updates: ${u.error}`);await wait(80);f=await frame();check(metric(f,'md-table-row','expanded')===true,'expanded update.');
  for(const bad of [{rowgroup:'side'},{selected:'yes'},{value:7}])await rejects(update(bad),`md-table-row ${JSON.stringify(bad)}`);
  await rejects(method('toggle',[1]),'toggle(1)');await rejects(method('getSelection'),'row getSelection()');

  // ---- md-table-pagination: hooks, goToPage / setRowsPerPage, updates ----
  f=await configure('md-table-pagination',{tablePaginationAppearance:{background:'#E0F7FA'}});
  check(count(f,'#E0F7FA')>3000,`pagination background hook (${count(f,'#E0F7FA')} px).`);
  m=await method('goToPage',[3]);ev=events(m,await frame());f=await frame();
  check(ev.some(e=>e.name==='mdPageChange'&&e.detail?.page===3)&&metric(f,'md-table-pagination','page')===3,`goToPage(3) (${JSON.stringify(ev.map(e=>e.name))}, page ${metric(f,'md-table-pagination','page')}).`);
  check(metric(f,'md-table-pagination','display')==='31–40 of 87',`range text (${metric(f,'md-table-pagination','display')}).`);
  m=await method('setRowsPerPage',[25]);ev=events(m,await frame());f=await frame();
  check(ev.map(e=>e.name).join()==='mdRowsPerPageChange,mdPageChange'&&metric(f,'md-table-pagination','rowsPerPage')===25&&metric(f,'md-table-pagination','page')===0,`setRowsPerPage(25) (${ev.map(e=>e.name)}).`);
  u=await update({page:2});await wait(60);f=await frame();check(metric(f,'md-table-pagination','page')===2,'page update re-seeds the page.');
  u=await update({count:30,rowsPerPage:15,page:5});await wait(60);f=await frame();check(metric(f,'md-table-pagination','page')===1&&metric(f,'md-table-pagination','lastPage')===1,`count update clamps silently (page ${metric(f,'md-table-pagination','page')}).`);
  for(const bad of [{density:3},{compact:'yes'},{rowsPerPageOptions:[5,10]}])await rejects(update(bad),`md-table-pagination ${JSON.stringify(bad)}`);
  for(const [name,args] of [['goToPage',['2']],['setRowsPerPage',[0]],['setRowsPerPage',[1.5]],['selectAll',[]]])await rejects(method(name,args),`${name}(${JSON.stringify(args)})`);

  // ---- md-table-sort-label: hooks and updates ----
  f=await configure('md-table-sort-label',{tableSortLabelAppearance:{restOpacity:0.5,activeColor:'#00897B'}});
  check(metric(f,'md-table-sort-label','iconOpacity')===0.5,`rest opacity hook (${metric(f,'md-table-sort-label','iconOpacity')}).`);
  u=await update({active:true,order:'desc'});await wait(80);f=await frame();
  check(metric(f,'md-table-sort-label','active')===true&&metric(f,'md-table-sort-label','order')==='desc'&&count(f,'#00897B',undefined,24)>20,`active update in the active colour hook (${count(f,'#00897B',undefined,24)} px).`);
  for(const bad of [{order:'up'},{inactiveIcon:'never'},{column:1}])await rejects(update(bad),`md-table-sort-label ${JSON.stringify(bad)}`);
  await rejects(method('setSort',['name','asc']),'sort label setSort()');

  // ---- md-table-cell, md-table-toolbar, md-table-container, md-table-expand-toggle, head / body / foot ----
  f=await configure('md-table-cell',{tableCellAppearance:{background:'#FFF3E0',minHeight:80}});
  check(count(f,'#FFF3E0')>3000,`cell background hook (${count(f,'#FFF3E0')} px).`);check(metric(f,'md-table-cell','height')>=79,`cell min height hook (${metric(f,'md-table-cell','height')}).`);
  u=await update({align:'end',numeric:true,scope:'',sticky:'',density:-2});check(!u.error,`cell updates: ${u.error}`);
  for(const bad of [{align:'left'},{colSpan:'2'},{scope:'all'}])await rejects(update(bad),`md-table-cell ${JSON.stringify(bad)}`);
  f=await configure('md-table-toolbar',{tableToolbarAppearanceDefaults:{selectionBackground:'#B2EBF2'},tableToolbarAppearance:{background:'#EDE7F6',minHeight:96}});
  check(count(f,'#EDE7F6')>5000&&node(f,'md-table-toolbar').bounds.height>=95,`toolbar background / min height hooks (${count(f,'#EDE7F6')} px, ${node(f,'md-table-toolbar').bounds.height}).`);
  u=await update({numSelected:2});await wait(300);f=await frame();check(metric(f,'md-table-toolbar','selectionMode')===true&&count(f,'#B2EBF2')>5000,`selection band in the hook colour (${count(f,'#B2EBF2')} px).`);
  for(const bad of [{numSelected:'2'},{density:1}])await rejects(update(bad),`md-table-toolbar ${JSON.stringify(bad)}`);
  f=await configure('md-table-container',{properties:{variant:'outlined'},tableContainerAppearance:{outlineColor:'#D32F2F',outlineWidth:3}});
  check(count(f,'#D32F2F',undefined,24)>1500,`container outline hooks (${count(f,'#D32F2F',undefined,24)} px).`);
  u=await update({variant:'filled',shape:'small',vibrant:true,elevation:2});check(!u.error,`container updates: ${u.error}`);
  for(const bad of [{variant:'raised'},{elevation:6},{maxHeight:300}])await rejects(update(bad),`md-table-container ${JSON.stringify(bad)}`);
  f=await configure('md-table-expand-toggle',{tableExpandToggleAppearance:{rotation:180}});
  check(metric(f,'md-table-expand-toggle','rotation')===180,`rotation hook (${metric(f,'md-table-expand-toggle','rotation')}).`);
  u=await update({buttonLabel:'Show details',icon:'expand_more'});check(!u.error,`toggle updates: ${u.error}`);await rejects(update({expanded:true}),'md-table-expand-toggle expanded');
  for(const tag of ['md-table-body','md-table-foot']){f=await configure(tag);u=await update({presentational:true});check(!u.error,`${tag} presentational update: ${u.error}`);await rejects(update({presentational:1}),`${tag} presentational 1`);}
  f=await configure('md-table-head');await rejects(update({presentational:true}),'md-table-head (no properties)');
  console.log(`md-table family live host: ${checks} checks passed`);
}finally{live?.close();}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Actual SwiftUI live host for md-menu / md-menu-item / md-menu-item-group / md-sub-menu-item: the recipe trigger (toggle),
// the typed hooks, show / close / whenClosed through call IDs, reposition, retained updates and md-sub-menu-item collapse().
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
      const id=++serial,timeout=setTimeout(()=>{pending.delete(id);child.kill('SIGKILL');reject(new Error(`Host timeout: ${stderr}`));},7000);
      pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);
    }),
    close:()=>child.stdin.end(),
  };
}
const nodes=frame=>frame.inspection?.nodes??[];
const root=frame=>nodes(frame).find(n=>n.id==='component');
let live;
const configure=async (tag,fields={})=>{live?.close();live=host();return live.call({command:'configure',tag,width:640,dark:false,...fields});};
const method=(name,args=[])=>live.call({command:'method',method:name,arguments:args});
const lifecycle=(callId,name,args=[])=>live.call({command:'method',target:'component',callId,method:name,arguments:args});
const results=(...callIds)=>live.call({command:'method-results',callIds,acknowledged:[]});
const status=(r,id)=>r.methodResults?.find(x=>x.callId===id)?.status;
const frame=()=>live.call({command:'frame'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const named=(r,name)=>(r.events??[]).filter(e=>e.name===name).length;
// The recipe trigger: centred, 12 pt below the top of the preview content (32 pt padding), 40 pt tall.
const trigger=()=>live.call({command:'click',x:320,y:64});
try{
  let f=await configure('md-menu',{properties:{},menuAppearance:{minWidth:260,itemHeight:56}});
  check(!f.error,`configure: ${f.error}`);
  await wait(600);f=await frame();
  check(!root(f)||root(f).metrics?.open===false,`the menu starts closed (${JSON.stringify(root(f))}).`);
  let r=await trigger();await wait(500);f=await frame();
  check(named(r,'mdOpen')+named(f,'mdOpen')===1,`the trigger opens the menu with one mdOpen (${JSON.stringify([r.events,f.events])}).`);
  let m=root(f);
  check(m?.name==='md-menu'&&m.metrics?.open===true&&m.metrics?.role==='menu',`the open menu is inspected (${JSON.stringify(m)}).`);
  check(m&&m.bounds.width>=260-0.01&&m.bounds.y>64,`min-width hook and placement below the trigger (${JSON.stringify(m?.bounds)}).`);
  r=await trigger();await wait(500);f=await frame();
  check(named(r,'mdClose')+named(f,'mdClose')===1,`the trigger toggles it closed (${JSON.stringify([r.events,f.events])}).`);
  check(!root(f)||root(f).metrics?.open===false,'closed after the toggle.');
  r=await lifecycle('s1','show',[{autoFocus:false}]);check(r.methodCall?.status==='accepted',`show accepted (${JSON.stringify(r)}).`);
  await wait(400);r=await results('s1');check(status(r,'s1')==='fulfilled',`show() fulfilled (${JSON.stringify(r)}).`);
  f=await frame();check(root(f)?.metrics?.open===true,'show() opens the menu.');
  r=await lifecycle('w1','whenClosed');check(r.methodCall?.status==='accepted','whenClosed accepted.');
  await wait(100);r=await results('w1');check(status(r,'w1')==='pending','whenClosed() waits for a close.');
  r=await lifecycle('c1','close');await wait(500);r=await results('w1','c1');
  check(status(r,'w1')==='fulfilled'&&status(r,'c1')==='fulfilled',`whenClosed() settles after the exit (${JSON.stringify(r)}).`);
  f=await frame();check(!root(f)||root(f).metrics?.open===false,'close() closes the menu.');
  r=await method('reposition');check(!r.error,`reposition: ${r.error}`);
  r=await method('reposition',[1]);check(Boolean(r.error),'reposition takes no arguments.');
  r=await lifecycle('x1','show',[{autoFocus:'yes'}]);check(Boolean(r.error)||r.methodCall?.status==='rejected','show rejects a non-boolean autoFocus.');
  r=await lifecycle('x2','close',[1]);check(Boolean(r.error)||r.methodCall?.status==='rejected','close takes no arguments.');
  let u=await live.call({command:'update',properties:{placement:'top-start',listLabel:'Project actions'}});check(!u.error,`update: ${u.error}`);
  u=await live.call({command:'update',properties:{open:true}});check(!u.error,`open update: ${u.error}`);
  await wait(500);f=await frame();check(root(f)?.metrics?.open===true,'open: true opens the menu.');
  for(const bad of [{placement:'left'},{open:'yes'},{density:-5},{maxHeight:-1},{bogus:1}]){
    u=await live.call({command:'update',properties:bad});check(Boolean(u.error),`${JSON.stringify(bad)} is rejected.`);
  }
  f=await configure('md-menu-item',{properties:{type:'checkbox',selected:true}});check(!f.error,`configure item: ${f.error}`);
  await wait(600);await trigger();await wait(500);f=await frame();
  let row=root(f);
  check(row?.name==='md-menu-item'&&row.metrics?.role==='menuitemcheckbox'&&row.metrics?.ariaChecked==='true',`the recipe's first row is the checkbox item (${JSON.stringify(row)}).`);
  u=await live.call({command:'update',properties:{selected:false,headline:'Rename'}});check(!u.error,`item update: ${u.error}`);
  await wait(300);f=await frame();check(root(f)?.metrics?.ariaChecked==='false','selected: false unchecks the row.');
  u=await live.call({command:'update',properties:{type:'switch'}});check(Boolean(u.error),'an unknown type is rejected.');
  u=await live.call({command:'update',properties:{anchor:'x'}});check(Boolean(u.error),'rows have no anchor.');
  f=await configure('md-menu-item-group',{properties:{}});check(!f.error,`configure group: ${f.error}`);
  await wait(600);await trigger();await wait(500);f=await frame();
  check(root(f)?.name==='md-menu-item-group'&&root(f).metrics?.label==='Workspace'&&root(f).metrics?.role==='group',`the Workspace group (${JSON.stringify(root(f))}).`);
  u=await live.call({command:'update',properties:{label:'Project'}});check(!u.error,`group update: ${u.error}`);
  await wait(300);f=await frame();check(root(f)?.metrics?.label==='Project','the group label updates.');
  f=await configure('md-sub-menu-item',{properties:{}});check(!f.error,`configure submenu row: ${f.error}`);
  await wait(600);await trigger();await wait(500);
  await live.call({command:'key',key:'ArrowDown'});await live.call({command:'key',key:'ArrowDown'});await wait(150);
  await live.call({command:'key',key:'ArrowRight'});await wait(500);f=await frame();
  check(root(f)?.name==='md-sub-menu-item'&&root(f).metrics?.expanded===true,`ArrowRight opens the Export flyout (${JSON.stringify(root(f))}).`);
  r=await method('collapse');check(!r.error,`collapse: ${r.error}`);
  await wait(300);f=await frame();check(root(f)?.metrics?.expanded===false,`collapse() closes the flyout (${JSON.stringify(root(f)?.metrics)}).`);
  r=await method('collapse',[true]);check(Boolean(r.error),'collapse takes no arguments.');
  u=await live.call({command:'update',properties:{openDelay:0,badge:'2'}});check(!u.error,`submenu row update: ${u.error}`);
  u=await live.call({command:'update',properties:{openDelay:-1}});check(Boolean(u.error),'a negative delay is rejected.');
  console.log(`md-menu live host: ${checks} checks passed`);
}finally{live?.close();}

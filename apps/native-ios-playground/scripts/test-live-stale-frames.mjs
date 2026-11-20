// Laboratory host robustness (d2, gate-7 follow-up of R4-26): stale-frame test for the SwiftUI live host (AWCLivePreview --stdio).
// For each scenario and iteration: fresh host, configure, preparation commands, wait until frames are stable; then one
// retained update, method or input. The frame that answers it (or, for an acknowledged update, the next frame) and the
// frames polled after it until the preview is stable again are compared with the final stable frame:
//   discrete = a frame whose pixels have changed from the pre-action frame while its inspection is still the pre-action
//              inspection (new pixels paired with an old inspection — the R4-26 class of defect);
//   visible  = a frame whose pixels already equal the final pixels while a bounds edge of a node present in both differs
//              from the final inspection by at least one device pixel;
//   structural = pixels equal the final pixels while the node set differs (diagnostic: e.g. an invisible indicator that
//              is removed when its fade ends);
//   late     = the action's own frame (reply, or the frame after an acknowledged update) still shows the pre-action pixels
//              and inspection although the action changes both (diagnostic for the settle).
// Sub-pixel animation residues (a value 0.01 pt from its end while the pixels already match) are not defects.
// Fails on discrete stale frames and on late replies. env: AWC_NATIVE_LIVE_RENDERER (host binary; default: this package's
// debug build), N (iterations per scenario, default 3), LOAD (busy processes, default 0), ONLY (scenario names), OUT (JSON).
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url)), N=+(process.env.N||3), LOAD=+(process.env.LOAD||0);
const only=process.env.ONLY?.split(',').filter(Boolean);
function host(){
  const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});
  let serial=0,buffer='',stderr='';const pending=new Map();
  child.stderr.on('data',d=>{stderr+=d;if(stderr.length>20000)stderr=stderr.slice(-10000);});
  child.stdout.on('data',d=>{buffer+=d;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let r;try{r=JSON.parse(line);}catch{continue;}
    if(r.kind==='frame')continue;const it=pending.get(r.id);if(it){pending.delete(r.id);clearTimeout(it.t);it.resolve(r);}}});
  child.on('exit',(c,sig)=>{for(const it of pending.values()){clearTimeout(it.t);it.resolve({error:`host exited ${c}/${sig}: ${stderr.slice(-300)}`});}pending.clear();});
  return {call:m=>new Promise(resolve=>{const id=++serial;const t=setTimeout(()=>{pending.delete(id);resolve({error:'timeout'});},8000);pending.set(id,{resolve,t});child.stdin.write(JSON.stringify({...m,id})+'\n');}),
    close:()=>{try{child.stdin.end();}catch{}setTimeout(()=>child.kill('SIGKILL'),2000).unref();}};
}
// Inspection without volatile bookkeeping (none known to differ between identical pixels; listed keys are reported if seen).
const VOLATILE=/^(renderTime|renderedAt|timestamp)$/;
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!VOLATILE.test(k)).sort(([a],[b])=>a<b?-1:1).map(([k,x])=>[k,clean(x)])):typeof v==='number'?Math.round(v*1000)/1000:v;
const insp=f=>JSON.stringify(clean(f.inspection??null));
const diff=(a,b)=>{const out=[];const A=new Map((a.inspection?.nodes??[]).map(n=>[n.id,n])),B=new Map((b.inspection?.nodes??[]).map(n=>[n.id,n]));
  for(const id of new Set([...A.keys(),...B.keys()])){const x=A.get(id),y=B.get(id);if(!x||!y){out.push(`${id}:${x?'gone':'new'}`);continue;}
    if(JSON.stringify(clean(x.bounds))!==JSON.stringify(clean(y.bounds)))out.push(`${id}.bounds ${JSON.stringify(clean(x.bounds))}→${JSON.stringify(clean(y.bounds))}`);
    for(const k of new Set([...Object.keys(x.metrics??{}),...Object.keys(y.metrics??{})]))if(!VOLATILE.test(k)&&JSON.stringify(clean(x.metrics?.[k]))!==JSON.stringify(clean(y.metrics?.[k])))out.push(`${id}.${k} ${JSON.stringify(clean(x.metrics?.[k]))?.slice(0,40)}→${JSON.stringify(clean(y.metrics?.[k]))?.slice(0,40)}`);}
  if(!out.length&&insp(a)!==insp(b))out.push('root '+JSON.stringify(clean(a.inspection?.bounds))+'→'+JSON.stringify(clean(b.inspection?.bounds)));
  return out.slice(0,4);};
const scale=f=>f.width&&f.logicalWidth?f.width/f.logicalWidth:2;
const nodeSet=f=>(f.inspection?.nodes??[]).map(n=>n.id).sort().join('|');
const edgeDelta=(a,b)=>{const B=new Map((b.inspection?.nodes??[]).map(n=>[n.id,n.bounds]));let d=0;
  for(const n of a.inspection?.nodes??[]){const y=B.get(n.id),x=n.bounds;if(!x||!y)continue;
    for(const e of [Math.abs(x.x-y.x),Math.abs(x.y-y.y),Math.abs(x.x+x.width-y.x-y.width),Math.abs(x.y+x.height-y.y-y.height)])d=Math.max(d,e);}
  return d*scale(a);};
const center=(f,id='component')=>{const n=f.inspection?.nodes?.find(x=>x.id===id)??f.inspection?.nodes?.[0];const b=n?.bounds??f.inspection?.bounds;return b?{x:b.x+b.width/2,y:b.y+b.height/2}:{x:40,y:30};};
const m=(method,...args)=>({command:'method',method,arguments:args});
const S=[
  // retained updates (non-selection branches used the fixed 12 ms pump)
  {name:'text-field.update.error',kind:'update',cfg:{tag:'md-text-field',properties:{label:'Email',value:'ab',supportingText:'Work email'}},act:{command:'update',properties:{error:true,errorText:'Enter a valid address in the company domain'}}},
  {name:'text-field.update.value',kind:'update',cfg:{tag:'md-text-field',properties:{label:'Email',value:'',maxLength:40,supportingText:'Work email'}},act:{command:'update',properties:{value:'someone@example.com'}}},
  {name:'number-field.update.error',kind:'update',cfg:{tag:'md-number-field',properties:{label:'Guests',value:2,min:0,max:8,step:1,supportingText:'Up to 8'}},act:{command:'update',properties:{error:true,errorText:'Too many guests for this room'}}},
  {name:'badge.update.value',kind:'update',cfg:{tag:'md-badge',properties:{variant:'large',value:'3'}},act:{command:'update',properties:{value:'1234'}}},
  {name:'skeleton.update.lines',kind:'update',cfg:{tag:'md-skeleton',properties:{animation:'none',lines:2}},act:{command:'update',properties:{lines:4}}},
  {name:'tabs.update.active',kind:'update',cfg:{tag:'md-tabs',properties:{}},act:{command:'update',properties:{activeTabIndex:2}}},
  {name:'navbar.update.active',kind:'update',cfg:{tag:'md-navigation-bar',properties:{}},act:{command:'update',properties:{activeIndex:2}}},
  {name:'breadcrumbs.update.max',kind:'update',cfg:{tag:'md-breadcrumbs',properties:{}},act:{command:'update',properties:{maxItems:2}}},
  {name:'divider.update.inset',kind:'update',cfg:{tag:'md-divider',properties:{}},act:{command:'update',properties:{inset:true}}},
  {name:'accordion-item.update.collapse',kind:'update',cfg:{tag:'md-accordion-item',properties:{headline:'A shared design language',supportingText:'Built for every surface',expanded:true}},act:{command:'update',properties:{expanded:false}}},
  {name:'list-item.update.headline',kind:'update',cfg:{tag:'md-list-item',properties:{headline:'Inbox',supportingText:'3 new'}},act:{command:'update',properties:{supportingText:'A much longer supporting text that wraps onto a second line in the list item for sure, yes'}}},
  {name:'text-field.update.valid-again',kind:'update',cfg:{tag:'md-text-field',properties:{label:'Email',value:'',required:true}},prep:[m('reportValidity')],act:{command:'update',properties:{value:'someone@example.com'}}},
  {name:'number-field.update.valid-again',kind:'update',cfg:{tag:'md-number-field',properties:{label:'Guests',min:0,max:8,step:1,required:true}},prep:[m('reportValidity')],act:{command:'update',properties:{value:3}}},
  {name:'otp-field.update.value',kind:'update',cfg:{tag:'md-otp-field',properties:{label:'Code',required:true}},prep:[m('reportValidity')],act:{command:'update',properties:{value:'123456'}}},
  {name:'snackbar.update.message',kind:'update',cfg:{tag:'md-snackbar',properties:{open:true,message:'Saved',autoHide:false}},act:{command:'update',properties:{message:'The draft was saved to your workspace and shared with the review group'}}},
  {name:'tooltip.update.label',kind:'update',cfg:{tag:'md-tooltip',properties:{open:true}},act:{command:'update',properties:{text:'A considerably longer tooltip text than the default one'}}},
  {name:'button.update.disabled',kind:'update',cfg:{tag:'md-button',properties:{variant:'filled'}},act:{command:'update',properties:{disabled:true}}},
  {name:'avatar.update.size',kind:'update',cfg:{tag:'md-avatar',properties:{name:'Ada Lovelace'}},act:{command:'update',properties:{size:'large'}}},
  {name:'checkbox.update.checked (R4-26 control)',kind:'update',cfg:{tag:'md-checkbox',properties:{required:true}},prep:[m('reportValidity')],act:{command:'update',properties:{checked:true}}},
  // methods
  {name:'tabs.method.selectTab',kind:'method',cfg:{tag:'md-tabs',properties:{}},act:m('selectTab',2)},
  {name:'navbar.method.select',kind:'method',cfg:{tag:'md-navigation-bar',properties:{}},act:m('select',2)},
  {name:'list.method.selectItem',kind:'method',cfg:{tag:'md-list',properties:{}},act:m('selectItem',1)},
  {name:'accordion-item.method.toggle',kind:'method',cfg:{tag:'md-accordion-item',properties:{headline:'A shared design language',supportingText:'Built for every surface',expanded:true}},act:m('toggle')},
  {name:'number-field.method.stepUp',kind:'method',cfg:{tag:'md-number-field',properties:{label:'Guests',value:2,min:0,max:8,step:1}},act:m('stepUp')},
  {name:'text-field.method.reportValidity',kind:'method',cfg:{tag:'md-text-field',properties:{label:'Email',value:'',required:true}},act:m('reportValidity')},
  {name:'switch.method.reportValidity',kind:'method',cfg:{tag:'md-switch',properties:{required:true}},act:m('reportValidity')},
  // inputs
  {name:'switch.input.click',kind:'input',cfg:{tag:'md-switch',properties:{}},act:f=>({command:'click',...center(f)})},
  {name:'checkbox.input.click (required, reported)',kind:'input',cfg:{tag:'md-checkbox',properties:{required:true}},prep:[m('reportValidity')],act:f=>({command:'click',...center(f)})},
  {name:'text-field.input.text',kind:'input',cfg:{tag:'md-text-field',properties:{label:'Email',value:'',maxLength:40,supportingText:'Work email'}},prep:[m('setFocus')],act:{command:'text',text:'someone@example.com'}},
  {name:'number-field.input.ArrowUp',kind:'input',cfg:{tag:'md-number-field',properties:{label:'Guests',value:2,min:0,max:8,step:1}},prep:[m('setFocus')],act:{command:'key',key:'ArrowUp'}},
];
async function stable(live,first,limit=1500){
  let prev=first??await live.call({command:'frame'});const frames=[];const t0=performance.now();
  while(performance.now()-t0<limit){await sleep(40);const tf=performance.now();const f=await live.call({command:'frame'});FRAME_MS.push(performance.now()-tf);if(f.error)return {final:prev,frames,error:f.error};frames.push(f);
    if(f.png===prev.png&&insp(f)===insp(prev))return {final:f,frames};prev=f;}
  return {final:prev,frames,unstable:true};
}
const busy=[];for(let k=0;k<LOAD;k++)busy.push(spawn(process.execPath,['-e','for(;;){}'],{stdio:'ignore'}));
const results=[];let FRAME_MS=[];
try{
  for(const sc of S){
    if(only&&!only.includes(sc.name.split(' ')[0]))continue;
    FRAME_MS=[];
    const r={name:sc.name,kind:sc.kind,n:0,discrete:0,visible:0,structural:0,late:0,staleFirst:0,staleAny:0,animating:0,unstable:0,errors:[],samples:[],ackMs:[]};
    for(let i=0;i<N;i++){
      const live=host();
      try{
        let f=await live.call({command:'configure',width:640,dark:false,...sc.cfg});if(f.error){r.errors.push('configure: '+f.error);break;}
        for(const p of sc.prep??[]){const x=await live.call(p);if(x.error){r.errors.push('prep: '+x.error);break;}}
        const base=await stable(live);if(base.error){r.errors.push('base: '+base.error);break;}
        const act=typeof sc.act==='function'?sc.act(base.final):sc.act;
        const t0=performance.now();const reply=await live.call(act);r.ackMs.push(+(performance.now()-t0).toFixed(1));
        if(reply.error){r.errors.push('act: '+reply.error);break;}
        if(reply.inputIgnored)r.errors.push('ignored: '+reply.inputIgnored);
        const f1=reply.png?reply:await live.call({command:'frame'});
        const after=await stable(live,f1);const fin=after.final;r.n++;
        if(after.unstable)r.unstable++;
        const seq=[f1,...after.frames], b=base.final, inspChanged=insp(b)!==insp(fin);
        const discrete=f=>inspChanged&&f.png!==b.png&&insp(f)===insp(b);
        const visible=f=>f.png===fin.png&&edgeDelta(f,fin)>=1, structural=f=>f.png===fin.png&&nodeSet(f)!==nodeSet(fin);
        const note=(kind,f)=>{if(r.samples.length<4)r.samples.push({i,kind,first:f===f1,diff:diff(f,fin),d2:f.d2});};
        if(seq.some(discrete)){r.discrete++;note('discrete',seq.find(discrete));}
        if(seq.some(visible)){r.visible++;note('visible',seq.find(visible));}
        if(seq.some(structural))r.structural++;
        if(inspChanged&&b.png!==fin.png&&f1.png===b.png&&insp(f1)===insp(b))r.late++;
        if(f1.png===fin.png&&insp(f1)!==insp(fin))r.staleFirst++;
        if(seq.some(f=>f.png===fin.png&&insp(f)!==insp(fin)))r.staleAny++;
        if(f1.png!==fin.png&&insp(f1)!==insp(fin))r.animating++;
        if(i===0)r.changed=insp(base.final)!==insp(fin)||base.final.png!==fin.png;
        if(i===0&&f1.d2)r.d2first=f1.d2;
      }finally{live.close();}
    }
    {const a=FRAME_MS.slice().sort((x,y)=>x-y);r.frameMs=a.length?{median:+a[a.length>>1].toFixed(1),p90:+a[Math.floor(a.length*.9)].toFixed(1),max:+a.at(-1).toFixed(1)}:null;}
    r.ackMs=r.ackMs.length?{min:Math.min(...r.ackMs),median:r.ackMs.sort((a,b)=>a-b)[r.ackMs.length>>1],max:Math.max(...r.ackMs)}:null;
    results.push(r);
    console.log(`${r.name.padEnd(44)} n=${r.n} discrete=${r.discrete} visible=${r.visible} structural=${r.structural} late=${r.late} staleAny=${r.staleAny} animating=${r.animating} unstable=${r.unstable} changed=${r.changed} ack=${JSON.stringify(r.ackMs)} frame=${JSON.stringify(r.frameMs)}${r.errors.length?' ERR '+[...new Set(r.errors)].join(' | ').slice(0,200):''}`);
    for(const s of r.samples)console.log('    sample',JSON.stringify(s).slice(0,400));
  }
}finally{for(const b of busy)b.kill('SIGKILL');}
const tot=results.reduce((a,r)=>{for(const k of ['n','discrete','visible','structural','late','staleAny'])a[k]+=r[k];return a;},{n:0,discrete:0,visible:0,structural:0,late:0,staleAny:0});
console.log(`TOTAL ${process.env.LABEL??''} LOAD=${LOAD} N=${N}: iterations ${tot.n}; discrete stale ${tot.discrete}, visible stale ${tot.visible}, structural ${tot.structural}, late replies ${tot.late}; sub-pixel or other (pixels final, inspection not) ${tot.staleAny}`);
if(process.env.OUT)writeFileSync(process.env.OUT,JSON.stringify({label:process.env.LABEL,load:LOAD,n:N,total:tot,results},null,1));
const errors=results.filter(r=>r.errors.length&&!r.n);
if(tot.discrete||tot.late||errors.length){console.error(`FAIL: ${tot.discrete} discrete stale, ${tot.late} late replies, ${errors.length} scenarios did not run (${errors.map(r=>r.name).join(', ')})`);process.exitCode=1;}
else console.log(`Passed: ${results.length} update, method and input scenarios × ${N}; no frame paired new pixels with the pre-action inspection, every reply showed its action.`);

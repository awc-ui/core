import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const binary=process.env.AWC_NATIVE_LIVE_RENDERER ?? fileURLToPath(new URL('../.build/arm64-apple-macosx/debug/AWCLivePreview',import.meta.url));
let checks=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function host(){
 const child=spawn(binary,['--stdio'],{stdio:['pipe','pipe','pipe']});let serial=0,pending=new Map(),buffer='',stderr='';
 child.stderr.on('data',data=>{stderr+=data;});
 child.stdout.on('data',data=>{buffer+=data;let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);const reply=JSON.parse(line),entry=pending.get(reply.id);if(entry){pending.delete(reply.id);clearTimeout(entry.timeout);entry.resolve(reply);}}});
 child.on('exit',(code,signal)=>{for(const {reject,timeout} of pending.values()){clearTimeout(timeout);reject(new Error(`Host exited ${code}/${signal}: ${stderr}`));}pending.clear();});
 return {call:message=>new Promise((resolve,reject)=>{const id=++serial;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(`Host request timeout: ${JSON.stringify(message)} ${stderr}`));},5000);pending.set(id,{resolve,reject,timeout});child.stdin.write(`${JSON.stringify({...message,id})}\n`);}),close:()=>child.stdin.end()};
}
const client=host();
const method=(callId,name)=>client.call({command:'method',target:'component',callId,method:name,arguments:[]});
const query=(callIds,acknowledged=[])=>client.call({command:'method-results',callIds,acknowledged});
const result=(reply,id)=>reply.methodResults.find(value=>value.callId===id);
async function settled(id){
 for(let i=0;i<80;i++){const reply=await query([id]);if(result(reply,id).status!=='pending')return reply;await delay(10);}
 assert.fail(`Method ${id} did not settle`);
}
try {
 const initial=await client.call({command:'configure',tag:'md-fab-menu',properties:{anchor:'demo-fab-anchor',placement:'down',open:false},width:640,dark:false});
 check(!initial.error && initial.logicalHeight===544,'Real separate-anchor fixture measures 360×480 plus 32pt preview padding.');
 check(initial.inspection===undefined,'Closed menu has no fabricated measurement from its recipe viewport.');
 await client.call({command:'pointer',phase:'down',x:320,y:272});
 const pointerOpened=await client.call({command:'pointer',phase:'up',x:320,y:272});
 check(pointerOpened.events.some(event=>event.name==='mdOpen') && !pointerOpened.events.some(event=>event.name==='mdClick'),'Held pointer opening reaches the real anchor and consumes its own action.');
 await client.call({command:'key',key:'ArrowDown'});
 await client.call({command:'key',key:'u'});
 const chosen=await client.call({command:'key',key:'Enter'});
 check(chosen.events.some(event=>event.name==='mdClick' && event.nodeID==='demo-fab-item-2' && event.activation?.source==='keyboard'),'Printable typeahead reaches the actual Upload item and keyboard activation metadata.');
 await delay(220);
 const inputClosed=await client.call({command:'frame'});
 check([...chosen.events,...inputClosed.events].some(event=>event.name==='mdClose' && event.nodeID==='component'),'Item activation closes the actual menu and emits its root lifecycle event.');
 check(inputClosed.inspection===undefined,'Settled close removes menu measurement instead of revealing enclosing viewport bounds.');
 const show=await method('show','show');check(show.ack && show.methodCall.status==='accepted','Show returns immediate correlated acceptance.');
 check(result(await settled('show'),'show').status==='fulfilled','Show completes after actual native initialization/open commit.');
 const frame=await client.call({command:'frame'});check(frame.inspection.nodes.some(node=>node.id==='component' && node.bounds.height>140),'Open frame measures the actual menu stack.');
 { await delay(300); const settledFrame=await client.call({command:'frame'}); // after the 150 ms open motion (scaleY .8 → 1)
   const nodes=settledFrame.inspection.nodes,byId=id=>nodes.find(node=>node.id===id),root=byId('component'),items=[1,2,3].map(i=>byId('component.item-'+i));
   const inside=b=>b.x>=root.bounds.x-.01 && b.y>=root.bounds.y-.01 && b.x+b.width<=root.bounds.x+root.bounds.width+.01 && b.y+b.height<=root.bounds.y+root.bounds.height+.01;
   check(root.name==='md-fab-menu overlay' && root.bounds.width>=items[0].bounds.width+100 && items.every(item=>item && inside(item.bounds)),'Open menu root is the fixed inset-0 overlay over the scope viewport (source host), not the item stack.');
   check(items.every(item=>item && item.name==='md-fab-menu-item' && item.parentId==='component' && Math.abs(item.bounds.height-48)<.6),'All three items are measured as menu parts in authored order.');
   check(items.every(item=>Math.abs(item.bounds.x+item.bounds.width-(items[0].bounds.x+items[0].bounds.width))<.6) && items[0].bounds.x>100,'Items share the anchor-aligned inline end in canvas coordinates.');
   check([1,2,3].every(i=>['icon','label','state-layer'].every(part=>byId(`component.item-${i}.${part}`)?.parentId===`component.item-${i}`)),'Item icon, label and state-layer parts are measured under their item.'); }
 await method('wait','whenClosed');await delay(20);check(result(await query(['wait']),'wait').status==='pending','whenClosed remains pending without a capture stream.');
 const close=await method('close','close');check(close.methodCall.status==='accepted','Close remains accepted while whenClosed is pending.');
 check(result(await settled('close'),'close').status==='fulfilled','Close completion only waits for beginning the close.');
 check(result(await query(['wait']),'wait').status==='pending','Close method completion precedes180ms closing settlement.');
 check(result(await settled('wait'),'wait').status==='fulfilled','whenClosed settles through native rendering while streaming is paused.');
 const replay=await method('show','show');check(replay.methodCall.status==='accepted','Identical retained request is idempotent.');
 const mismatch=await method('show','close');check(mismatch.methodCall.error.code==='METHOD_CALL_ID_MISMATCH','Changed request with retained ID rejects only that call.');
 await query([],['show','wait','close']);
 check(result(await query(['show']),'show').error.code==='UNKNOWN_METHOD_CALL','Acknowledged records are released and unknown queries reject explicitly.');
 for(let i=0;i<32;i++)await method(`capacity-${i}`,'show');
 check((await method('overflow','show')).methodCall.error.code==='METHOD_CALLS_BUSY','Retained records have a bounded32-call capacity without eviction.');
 await delay(40);await query([],Array.from({length:32},(_,i)=>`capacity-${i}`));
 check((await method('after-ack','close')).methodCall.status==='accepted','Terminal acknowledgements release capacity.');
 check(result(await settled('after-ack'),'after-ack').status==='fulfilled','Session remains usable after busy/mismatch responses.');
 console.log(`Passed ${checks} live SwiftUI FAB Menu protocol, retention and paused-stream lifecycle checks.`);
} finally {client.close();}

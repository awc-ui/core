/** Native React UI contracts; browser geometry/style checks remain in verify-browser. */
const {createRequire}=require('module'),path=require('path'),assert=require('assert/strict');
const app=path.resolve(__dirname,'..'),repo=path.resolve(app,'../../../..');
const req=createRequire(app+'/package.json'),coreReq=createRequire(repo+'/packages/core/package.json');
const testChannels=[],OriginalMessageChannel=global.MessageChannel;
(async()=>{
 const {JSDOM}=coreReq('jsdom'),dom=new JSDOM('<div id="root"></div>',{url:'https://pictor-react.test/showcase/design/react/'});
 for(const key of ['window','document','navigator','HTMLElement','SVGElement','Element','Node','Event','CustomEvent','KeyboardEvent','MouseEvent','localStorage','customElements','location','history'])Object.defineProperty(global,key,{value:dom.window[key],configurable:true,writable:true});
 // React's act scheduler creates MessageChannels in this bundled browser graph.
 // Track the test-owned ports so successful cleanup also lets Node exit.
 const Channel=OriginalMessageChannel,channels=testChannels;global.MessageChannel=class extends Channel{constructor(){super();channels.push(this);}};
 global.innerWidth=1280;global.CSS={escape:s=>s.replaceAll('"','\\"')};global.matchMedia=window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};HTMLElement.prototype.scrollTo=function(){};
 global.requestAnimationFrame=window.requestAnimationFrame=cb=>setTimeout(cb,0);global.cancelAnimationFrame=window.cancelAnimationFrame=clearTimeout;global.IS_REACT_ACT_ENVIRONMENT=true;
 const measured=HTMLElement.prototype.getBoundingClientRect;
 HTMLElement.prototype.getBoundingClientRect=function(){
  if(this.matches('.pictor-command-results'))return{top:100,bottom:400,left:0,right:500,width:500,height:300};
  if(this.matches('.pictor-command-results [role="option"]')){const list=this.parentElement,index=[...list.children].indexOf(this),top=100+index*58-list.scrollTop;return{top,bottom:top+58,left:0,right:500,width:500,height:58};}
  return measured.call(this);
 };
 const built=await coreReq('esbuild').build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ShowcaseProvider} from './src/lib/showcase';import {DocumentProvider} from './src/lib/document';import {RouterProvider} from './src/lib/router';import {ShellProvider,AppFrame} from './src/components/Shell';import {SnackbarProvider} from './src/components/screens/Snackbar';import {App} from './src/App';export {act} from 'react';export {setShowcaseState} from '@awc-ui/showcase-kit/dock';export const root=createRoot(document.getElementById('root'));export function render(){root.render(<ShowcaseProvider><ShellProvider><DocumentProvider><SnackbarProvider><RouterProvider><AppFrame><App/></AppFrame></RouterProvider></SnackbarProvider></DocumentProvider></ShellProvider></ShowcaseProvider>);}`,resolveDir:app,loader:'tsx'},tsconfig:app+'/tsconfig.json',bundle:true,format:'cjs',write:false,jsx:'automatic',plugins:[{name:'native-dom-without-layout',setup(build){build.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'empty-css'}));build.onLoad({filter:/.*/,namespace:'empty-css'},()=>({contents:'',loader:'js'}));}}],logOverride:{'ignored-bare-import':'silent'}});
 const module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(req,module,module.exports);const{act,setShowcaseState,root,render}=module.exports;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));const flush=fn=>act(async()=>{fn?.();await wait(0);});
 await flush(render);await flush(()=>window.dispatchEvent(new CustomEvent('pictor:save')));await flush(()=>setShowcaseState({locale:'ar',dir:'rtl'}));
 assert.match(document.querySelector('md-snackbar').getAttribute('message'),/[\u0600-\u06ff]/,'An already-visible save toast changes language');
 assert.match(document.querySelector('h1').textContent,/[\u0600-\u06ff]/);assert.equal(document.documentElement.dir,'rtl');
 let group=document.querySelector('.pictor-filterbar md-button-group');assert(group);assert.equal(group.getAttribute('selection-mode'),'single-select');assert.equal(group.required,true);assert.equal(group.querySelectorAll('md-button').length,3);
 await flush(()=>group.dispatchEvent(new CustomEvent('mdSelectionChange',{bubbles:true,detail:{values:['favorites'],added:['favorites'],removed:['all']}})));
 assert.equal(document.querySelector('.pictor-filterbar [value="favorites"]').getAttribute('aria-pressed'),'true');assert.match(document.querySelector('.pictor-empty h3').textContent,/[\u0600-\u06ff]/);
 console.log('PASS React Arabic native headings and required grouped file filter');
 await flush(()=>window.dispatchEvent(new CustomEvent('pictor:commands')));await act(()=>wait(90));
 const input=()=>document.querySelector('.pictor-command-search input');assert.equal(document.activeElement,input());assert.equal(document.querySelector('md-dialog').getAttribute('locale'),'ar');
 const inputValue=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
 await flush(()=>{inputValue.call(input(),'مكونات');input().dispatchEvent(new Event('input',{bubbles:true}));});
 assert([...document.querySelectorAll('.pictor-command-item')].some(item=>item.textContent.includes('AWC')),'Arabic search ignores optional vowel marks');
 // English aliases supplement the translated UI, including command kinds.
 for(const [term,icon] of [['canvas','draw'],['projects','folder_open'],['assets','grid_view'],['save','save'],['export','download'],['present','play_arrow'],['components','widgets'],['design file','draft'],['project','folder'],['asset image','interests']]){await flush(()=>{inputValue.call(input(),term);input().dispatchEvent(new Event('input',{bubbles:true}));});const match=[...document.querySelectorAll('.pictor-command-item')].find(item=>item.querySelector('.pictor-command-icon')?.textContent===icon);assert(match,`English ${term} remains searchable in Arabic`);if(term==='export')assert.match(match.querySelector('strong').textContent,/[\u0600-\u06ff]/,'Export result stays localized');}
 console.log('PASS React English command aliases and file/project/asset kinds remain searchable in Arabic');
 await flush(()=>{inputValue.call(input(),'');input().dispatchEvent(new Event('input',{bubbles:true}));});
 for(let i=0;i<9;i++)await flush(()=>input().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
 let list=document.querySelector('.pictor-command-results'),selected=list.querySelector('[aria-selected="true"]');
 assert.equal([...list.children].indexOf(selected),9);assert(list.scrollTop>0);assert(selected.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom);assert.equal(document.activeElement,input());assert([...list.children].every(item=>item.tabIndex===-1));
 for(let i=0;i<9;i++)await flush(()=>input().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true})));
 list=document.querySelector('.pictor-command-results');assert.equal(list.querySelector('[aria-selected="true"]').id,'pictor-command-0');assert.equal(list.scrollTop,0);
 console.log('PASS React nine ArrowDown/ArrowUp scroll active command without moving input focus');
 await flush(()=>root.unmount());dom.window.close();for(const channel of channels){channel.port1.close();channel.port2.close();}global.MessageChannel=Channel;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const channel of testChannels){channel.port1.close();channel.port2.close();}global.MessageChannel=OriginalMessageChannel;});

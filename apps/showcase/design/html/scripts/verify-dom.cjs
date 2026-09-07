const {createRequire}=require('module'),path=require('path'),fs=require('fs'),assert=require('assert/strict');
const app=path.resolve(__dirname,'..'),repo=path.resolve(app,'../../../..');const req=createRequire(app+'/package.json'),coreReq=createRequire(repo+'/packages/core/package.json');
(async()=>{
 const {JSDOM}=coreReq('jsdom');const d=new JSDOM('<div id="root"></div>',{url:'https://pictor-html.test/showcase/design/html/editor/'});for(const key of ['window','document','navigator','HTMLElement','SVGElement','Element','Node','Event','CustomEvent','KeyboardEvent','MouseEvent','localStorage','customElements','location','history'])Object.defineProperty(global,key,{value:d.window[key],configurable:true,writable:true});
 global.innerWidth=1280;global.CSS={escape:s=>s.replaceAll('"','\\"')};global.matchMedia=window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};let frames=[];global.requestAnimationFrame=window.requestAnimationFrame=cb=>(frames.push(cb),frames.length);global.cancelAnimationFrame=()=>{};
 const captures=new WeakMap();HTMLElement.prototype.setPointerCapture=function(id){captures.set(this,id)};HTMLElement.prototype.hasPointerCapture=function(id){return captures.get(this)===id};HTMLElement.prototype.releasePointerCapture=function(){captures.delete(this)};
 class Field extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).append(document.createElement('input'))}set value(v){this.shadowRoot.querySelector('input').value=v??''}get value(){return this.shadowRoot.querySelector('input').value}connectedCallback(){this.shadowRoot.querySelector('input').value=this.getAttribute('value')??this.value}}
 customElements.define('md-text-field',Field);
 customElements.define('md-button',class extends HTMLElement {});
 const result=await coreReq('esbuild').build({stdin:{contents:`import '${app}/src/main.tsx';export {store,getDocument,getRouter,ui,requestRender} from '${app}/src/context.ts';export {createLayer} from '@awc-ui/pictor-model';export {setShowcaseState} from '@awc-ui/showcase-kit/dock';`,resolveDir:app},bundle:true,format:'cjs',write:false,jsxFactory:'dom',jsxFragment:'Fragment',loader:{'.css':'empty'},plugins:[{name:'native-dom-without-layout',setup(build){build.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'empty-css'}));build.onLoad({filter:/.*/,namespace:'empty-css'},()=>({contents:'',loader:'js'}));}}],logOverride:{'ignored-bare-import':'silent'}});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(req,module,module.exports);const {store,getDocument,getRouter,ui,requestRender,createLayer,setShowcaseState}=module.exports;
 let errors=[];window.addEventListener('error',event=>{errors.push(event.error);event.preventDefault()});const flush=async()=>{await Promise.resolve();await Promise.resolve();let callbacks=frames;frames=[];callbacks.forEach(cb=>cb());await Promise.resolve();await Promise.resolve();if(errors.length)throw errors.shift()};const wait=async ms=>new Promise(resolve=>setTimeout(resolve,ms));const md=async(target,name,detail)=>{assert(target,name);target.dispatchEvent(new CustomEvent(name,{bubbles:true,detail}));await flush()};const click=async target=>{assert(target,'click target');target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));await flush()};await flush();await flush();let issues=[];
 const layer=createLayer('rect',{x:2,y:2,w:4,h:4},{id:'review-rect',name:'Review rectangle',fill:'#203D35'});getDocument().replaceCanvas([layer]);getDocument().select([layer.id]);await flush();
 await md(document.querySelector('[data-name-field]'),'mdChange','Renamed native');assert.equal(getDocument().layers[0].name,'Renamed native');await md(document.querySelector('[data-geometry="w"]'),'mdChange',{value:200});assert.equal(getDocument().layers[0].rect.w,10);console.log('PASS text and number controlled events');
 let slider=document.querySelector('[data-inspector] md-slider');await md(slider,'mdInput',45);assert.equal(getDocument().layers[0].opacity,100);await md(slider,'mdChange',45);assert.equal(getDocument().layers[0].opacity,45);getDocument().undo();await flush();assert.equal(document.querySelector('[data-inspector] md-slider').value,100);console.log('PASS slider commit and undo reflected');
 await click(document.querySelector('[data-tool="image"]'));assert(document.querySelector('.studio-art-grid'));await md(document.querySelector('[aria-label="Asset type"]'),'mdTabChange',{index:2});assert(document.querySelector('.studio-color-grid'));await click(document.querySelector('[data-tool="image"]'));assert(document.querySelector('.studio-art-grid'));console.log('PASS repeated Image resets Artwork category');
 let trigger=document.querySelector('.pictor-command-trigger');trigger.focus();await click(trigger);await wait(90);await flush();let input=document.querySelector('.pictor-command-search input');assert.equal(document.activeElement,input);input.value='export';input.dispatchEvent(new Event('input',{bubbles:true}));await flush();assert.equal(document.activeElement,document.querySelector('.pictor-command-search input'));assert.equal(document.querySelectorAll('.pictor-command-item').length,1);console.log('PASS command live input retains focus');input=document.querySelector('.pictor-command-search input');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(90);await flush();if(!document.activeElement.matches('.pictor-command-trigger'))issues.push({name:'command-close-focus',actual:document.activeElement.localName,oldTriggerConnected:trigger.isConnected});
 window.dispatchEvent(new CustomEvent('pictor:save'));await flush();let snackbar=document.querySelector('md-snackbar');assert(snackbar);await md(snackbar,'mdClose',undefined);requestRender();await flush();if(document.querySelector('md-snackbar[open]'))issues.push({name:'dismissed-toast-reopens',state:ui.get('toast')});
 const button=createLayer('component',{x:2,y:2,w:15,h:5},{id:'review-live-button',name:'Click me',componentId:'awc:button',fill:'#BEE7AA'});const field=createLayer('component',{x:2,y:10,w:15,h:5},{id:'review-live-field',name:'Your idea',componentId:'awc:text-field',fill:'#BEE7AA'});getDocument().replaceCanvas([button,field]);await flush();window.dispatchEvent(new CustomEvent('pictor:present'));await flush();let live=document.querySelector('.studio-presentation .layer__live md-button'),liveField=document.querySelector('.studio-presentation md-text-field');await click(live);assert.equal(live.textContent,'You made it happen!');liveField.value='A typed idea';liveField.shadowRoot.querySelector('input').focus();getDocument().save();await flush();let next=document.querySelector('.studio-presentation .layer__live md-button'),nextField=document.querySelector('.studio-presentation md-text-field');if(next!==live||nextField.value!=='A typed idea')issues.push({name:'presentation-reset-on-save',oldConnected:live.isConnected,buttonText:next.textContent,fieldValue:nextField.value});
 const before=document.querySelector('.canvas-scroll');getDocument().setTool('rect');await flush();assert.equal(before,document.querySelector('.canvas-scroll'));console.log('PASS canvas viewport retained across store redraw');
 await click(document.querySelector('[data-close-present]'));
 const text=createLayer('text',{x:2,y:2,w:8,h:4},{id:'review-text',name:'Edit this text',fill:'#203D35'});getDocument().replaceCanvas([text]);getDocument().setTool('select');await flush();const board=document.querySelector('.artboard'),viewport=document.querySelector('.canvas-scroll');board.getBoundingClientRect=()=>({left:100,top:100,width:480,height:320});
 const pointer=async(target,type,x,y,extra={})=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,...extra});Object.defineProperty(event,'pointerId',{value:extra.pointerId??1});target.dispatchEvent(event);await flush()};
 const textNode=document.querySelector('.artboard [data-layer="review-text"]'),paint=textNode.firstChild;await pointer(textNode,'pointerdown',130,130);assert(textNode.isConnected);assert.equal(textNode,document.querySelector('.artboard [data-layer="review-text"]'));assert.equal(paint,textNode.firstChild);await pointer(viewport,'pointerup',130,130);assert.equal(paint,textNode.firstChild);console.log('PASS layer and paint identity survive selection and empty-preview updates');
 await click(document.querySelector('[aria-label="Toggle inspector"]'));assert.equal(document.querySelector('[data-editor]').getAttribute('data-right'),'closed');viewport.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:130,clientY:130}));await flush();assert.equal(document.querySelector('[data-editor]').getAttribute('data-right'),'open');console.log('PASS captured viewport double-click hit-tests text and opens inspector');
 await click(document.querySelector('[aria-label="Toggle inspector"]'));viewport.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:50,clientY:50}));await flush();assert.equal(document.querySelector('[data-editor]').getAttribute('data-right'),'closed');
 getDocument().toggleLocked('review-text');await flush();viewport.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:130,clientY:130}));await flush();assert.equal(document.querySelector('[data-editor]').getAttribute('data-right'),'closed');getDocument().toggleLocked('review-text');await flush();
 const cover=createLayer('rect',{x:2,y:2,w:8,h:4},{id:'text-cover',name:'Cover',fill:'#BEE7AA',order:9999});getDocument().commitLayers('create',layers=>[...layers,cover]);await flush();viewport.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:130,clientY:130}));await flush();assert.equal(document.querySelector('[data-editor]').getAttribute('data-right'),'closed');getDocument().select(['text-cover']);getDocument().remove();getDocument().select(['review-text']);await flush();console.log('PASS double-click ignores outside canvas, locked text and obscured text');

 getDocument().commitLayers('move',layers=>layers.map(layer=>({...layer,rect:{...layer.rect,x:10}})));await flush();assert.equal(textNode,document.querySelector('.artboard [data-layer="review-text"]'));await pointer(textNode,'pointerdown',205,130);await pointer(viewport,'pointermove',225,150);await pointer(viewport,'pointerup',225,150);assert.equal(getDocument().layers[0].rect.x,12);assert.equal(getDocument().layers[0].rect.y,4);assert.equal(paint,textNode.firstChild);console.log('PASS reused listeners read current geometry and movement preserves paint');
 getDocument().restyle({name:'Updated text'});await flush();assert.notEqual(paint,textNode.firstChild);assert.match(textNode.textContent,/Updated text/);console.log('PASS visual changes repaint children');
 const reset=async(layers=[],selected=[],tool='select')=>{getDocument().replaceCanvas(layers);getDocument().select(selected);getDocument().setTool(tool);await flush()};
 await reset([],[],'rect');await pointer(board,'pointerdown',125,135);await pointer(viewport,'pointermove',126,136);await pointer(viewport,'pointerup',126,136);assert.deepEqual(getDocument().layers[0].rect,{x:2,y:3,w:12,h:10});console.log('PASS default click drawing');
 await reset([],[],'rect');await pointer(board,'pointerdown',305,305);await pointer(viewport,'pointermove',205,355,{shiftKey:true});await pointer(viewport,'pointerup',205,355,{shiftKey:true});assert.deepEqual(getDocument().layers[0].rect,{x:15,y:20,w:6,h:6});console.log('PASS reverse Shift drawing');
 const group=createLayer('group',{x:2,y:2,w:10,h:10},{id:'group',name:'Group',fill:'#203D35'}),child=createLayer('rect',{x:3,y:3,w:2,h:2},{id:'child',name:'Child',parentId:'group',fill:'#203D35'});await reset([group,child],['group']);await pointer(document.querySelector('[data-corner="se"]'),'pointerdown',220,220);await pointer(viewport,'pointermove',320,320);await pointer(viewport,'pointerup',320,320);assert.deepEqual(getDocument().layers[0].rect,{x:2,y:2,w:20,h:20});assert.deepEqual(getDocument().layers[1].rect,{x:4,y:4,w:4,h:4});console.log('PASS group resize scales descendants');
 await reset([group,child],['group']);const childNode=document.querySelector('.artboard [data-layer="child"]');await pointer(childNode,'pointerdown',135,135);await pointer(viewport,'pointermove',165,155);await pointer(viewport,'pointerup',165,155);assert.deepEqual(getDocument().layers[1].rect,{x:6,y:5,w:2,h:2});assert.equal(childNode,document.querySelector('.artboard [data-layer="child"]'));console.log('PASS group member drag preserves layer identity');
 const first=createLayer('rect',{x:2,y:2,w:4,h:4},{id:'first',name:'First',fill:'#203D35'}),second=createLayer('rect',{x:10,y:10,w:4,h:4},{id:'second',name:'Second',fill:'#203D35'});await reset([first,second]);const firstNode=document.querySelector('.artboard [data-layer="first"]'),secondNode=document.querySelector('.artboard [data-layer="second"]');getDocument().reorderTo('first',null,1);await flush();assert.deepEqual([...board.querySelectorAll(':scope > [data-layer]')].map(node=>node.dataset.layer),['second','first']);assert.equal(firstNode,board.querySelector('[data-layer="first"]'));assert.equal(secondNode,board.querySelector('[data-layer="second"]'));getDocument().select(['first']);getDocument().remove();await flush();assert(!firstNode.isConnected);assert(secondNode.isConnected);console.log('PASS keyed reorder and removal');
 await reset([second],[],'hand');viewport.scrollLeft=370;viewport.scrollTop=250;await pointer(viewport,'pointerdown',50,50);await pointer(viewport,'pointermove',110,10);await pointer(viewport,'pointerup',110,10);assert.equal(viewport.scrollLeft,310);assert.equal(viewport.scrollTop,290);console.log('PASS workspace pan');
 {
 // Translation is part of native rendering: switching locale must update the
 // mounted editor while keeping the exact authored document and history.
 const authored=createLayer('text',{x:2,y:2,w:10,h:4},{id:'locale-authored',name:'Leave my authored text unchanged',fill:'#203D35'});
 getDocument().replaceCanvas([authored]);getDocument().setTool('select');await flush();
 const authoredLayers=getDocument().layers,authoredHistory=getDocument().history;
 window.dispatchEvent(new CustomEvent('pictor:save'));await flush();
 setShowcaseState({locale:'ar',dir:'rtl'});await flush();await flush();
 assert.equal(document.documentElement.dir,'rtl');
 assert.match(document.querySelector('md-snackbar').getAttribute('message'),/[\u0600-\u06ff]/,'An already-visible save toast changes language');
 assert.match(document.querySelector('.studio-tool-hint').textContent,/[\u0600-\u06ff]/);
 assert.match(document.querySelector('[data-tool="rect"]').getAttribute('aria-label'),/[\u0600-\u06ff]/);
 assert.equal(getDocument().layers,authoredLayers);assert.equal(getDocument().history,authoredHistory);
 assert.match(document.querySelector('.artboard').textContent,/Leave my authored text unchanged/);
 window.dispatchEvent(new CustomEvent('pictor:export'));await flush();
 assert.equal(document.querySelector('md-dialog.studio-dialog').getAttribute('locale'),'ar');
 assert.match(document.querySelector('[data-download]').textContent,/[\u0600-\u06ff]/);
 await md(document.querySelector('md-dialog.studio-dialog'),'mdClose');
 getRouter().push('/');await flush();assert.match(document.querySelector('h1').textContent,/[\u0600-\u06ff]/);
 const group=document.querySelector('.pictor-filterbar md-button-group');assert(group,'File filters use real md-button-group');
 assert.equal(group.getAttribute('selection-mode'),'single-select');assert(group.hasAttribute('required'));
 assert.equal(group.querySelectorAll('md-button').length,3);assert(!group.querySelector('md-segmented-button'));
 await md(group,'mdSelectionChange',{values:['favorites'],added:['favorites'],removed:['all']});
 assert.equal(document.querySelector('.pictor-filterbar md-button-group [value="favorites"]').getAttribute('aria-pressed'),'true');
 assert.match(document.querySelector('.pictor-empty h3').textContent,/[\u0600-\u06ff]/);
 console.log('PASS Arabic native editor, projects, dialog locale, authored text preservation and required grouped filters');

 window.dispatchEvent(new CustomEvent('pictor:commands'));await wait(90);await flush();
 let search=document.querySelector('.pictor-command-search input');search.value='مكونات';search.dispatchEvent(new Event('input',{bubbles:true}));await flush();
 assert([...document.querySelectorAll('.pictor-command-item')].some(item=>item.textContent.includes('AWC')),'Arabic command search ignores optional vowel marks');
 // English aliases supplement the translated UI, including command kinds.
 for(const [term,icon] of [['canvas','draw'],['projects','folder_open'],['assets','grid_view'],['save','save'],['export','download'],['present','play_arrow'],['components','widgets'],['design file','draft'],['project','folder'],['asset image','interests']]){search=document.querySelector('.pictor-command-search input');search.value=term;search.dispatchEvent(new Event('input',{bubbles:true}));await flush();const match=[...document.querySelectorAll('.pictor-command-item')].find(item=>item.querySelector('.pictor-command-icon')?.textContent===icon);assert(match,`English ${term} remains searchable in Arabic`);if(term==='export')assert.match(match.querySelector('strong').textContent,/[\u0600-\u06ff]/,'Export result stays localized');}
 console.log('PASS English command aliases and file/project/asset kinds remain searchable in Arabic');
 document.querySelector('.pictor-command-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(90);await flush();
 window.dispatchEvent(new CustomEvent('pictor:insert'));await flush();await wait(30);await flush();
 let assetSearch=document.querySelector('.studio-insert md-text-field');await md(assetSearch,'mdInput','زر');
 assert(document.querySelector('[data-insert-component="awc:button"]'),'Arabic search finds translated live-component name');
 await md(document.querySelector('.studio-insert md-text-field'),'mdInput','Action button');
 assert(document.querySelector('[data-insert-component="awc:button"]'),'Original English metadata stays searchable');
 await click(document.querySelector('[data-tool="image"]'));await md(document.querySelector('.studio-insert md-text-field'),'mdInput','Orbital');
 const orbital=document.querySelector('.studio-art-grid button');assert(orbital,'English artwork name remains searchable in Arabic');assert.match(orbital.textContent,/[\u0600-\u06ff]/);await click(orbital);assert.equal(getDocument().layers.at(-1).name,'Orbital sculpture','Insertion keeps the original metadata name');
 getDocument().select(['locale-authored']);await flush();
 const numeric=document.querySelector('[data-geometry="x"]');assert.equal(numeric.getAttribute('locale'),'ar-u-nu-arab');assert.match(numeric.getAttribute('value-missing-label'),/[\u0600-\u06ff]/);
 window.dispatchEvent(new CustomEvent('pictor:components'));await flush();
 await md(document.querySelector('[data-component-lens] md-text-field'),'mdInput','زر');
 assert([...document.querySelectorAll('.component-lens__list code')].some(code=>code.textContent==='md-button'),'Arabic component name finds unchanged API tag');
 await md(document.querySelector('[data-component-lens] md-dialog'),'mdClose');
 console.log('PASS Arabic normalized command/metadata/Lens searches, numeric locale and live save-toast translation');

 setShowcaseState({locale:'en',dir:'ltr'});await flush();
 // jsdom has no layout. Supply only measured list/row geometry; real key events,
 // native rendering and the shared scroll helper own navigation and scroll.
 const measured=HTMLElement.prototype.getBoundingClientRect;
 HTMLElement.prototype.getBoundingClientRect=function(){
   if(this.matches('.pictor-command-results'))return {top:100,bottom:400,left:0,right:500,width:500,height:300};
   if(this.matches('.pictor-command-results [role="option"]')){const list=this.parentElement,index=[...list.children].indexOf(this),top=100+index*58-list.scrollTop;return {top,bottom:top+58,left:0,right:500,width:500,height:58};}
   return measured.call(this);
 };
 window.dispatchEvent(new CustomEvent('pictor:commands'));await wait(90);await flush();
 const stableInput=document.querySelector('.pictor-command-search input'),stableList=document.querySelector('.pictor-command-results');
 for(let i=0;i<9;i++){stableInput.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await flush();assert.equal(document.querySelector('.pictor-command-search input'),stableInput,'Arrow navigation keeps its mounted input');assert.equal(document.querySelector('.pictor-command-results'),stableList,'Arrow navigation keeps the laid-out scroll container');}
 const list=document.querySelector('.pictor-command-results'),selected=list.querySelector('[aria-selected="true"]');
 assert.equal([...list.children].indexOf(selected),9);assert(list.scrollTop>0,'Repeated ArrowDown scrolls the selected command into view');
 assert(selected.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom);
 assert.equal(document.activeElement,document.querySelector('.pictor-command-search input'));
 assert([...list.querySelectorAll('[role="option"]')].every(item=>item.tabIndex===-1));
 for(let i=0;i<9;i++){document.querySelector('.pictor-command-search input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));await flush();}
 assert.equal(document.querySelector('.pictor-command-results [aria-selected="true"]').id,'pictor-command-0');
 HTMLElement.prototype.getBoundingClientRect=measured;
 console.log('PASS nine ArrowDown/ArrowUp commands keep the active result visible and input focused');

 }
 console.log('ISSUES',JSON.stringify(issues,null,2));assert.equal(issues.length,0,'Lifecycle regressions must remain fixed');store.dispose();d.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});

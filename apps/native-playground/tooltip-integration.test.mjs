import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { TOOLTIP_APPEARANCE_FIELDS, normalizeTooltipAppearance, tooltipAppearanceCSS, parseTooltipAppearanceInput, tooltipAppearanceNativeValue } from './tooltip-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { TOOLTIP_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { nativeViewportCommand, nativeCanvasReadout } from './native-viewport.js';
import { nativeMethodCommand } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-tooltip.json', import.meta.url), 'utf8'));
// Shared wiring uses a synthetic policy; this does not enable native declarations.
const policy = { properties: source.properties.map(p=>p.name), methods:['show','hide'], events:['mdOpen','mdClose'], slots:['','subhead','content','actions'], visualParts:source.cssParts.map(p=>p.name), appearance:{fields:TOOLTIP_APPEARANCE_FIELDS.map(f=>f.name)} };
const component = {...source,support:{ios:policy,android:policy}};
const props = {text:'One source. Every surface.',subhead:'Details',variant:'rich',position:'left-end',autoPosition:false,offset:-4,crossOffset:3.5,open:true,showDelay:0,hideDelay:150,disabled:false,density:-2};
const appearance = Object.fromEntries(TOOLTIP_APPEARANCE_FIELDS.map(f=>[f.name,parseTooltipAppearanceInput(f.name,f.kind==='color'?'#12345680':f.kind==='corners'?'12px 4px / 6px 2px':'calc(100% - 48px)')]));

test('Tooltip exactly covers eleven source hooks with affine lengths, physical corners and RGBA', async()=>{
 const css=await readFile(new URL('../../packages/core/src/components/md-tooltip/md-tooltip.css',import.meta.url),'utf8');
 assert.deepEqual([...new Set(css.match(/--md-tooltip-[a-z-]+/g))].sort(),TOOLTIP_APPEARANCE_FIELDS.map(f=>f.cssProperty).sort());
 assert.equal(Object.keys(tooltipAppearanceCSS(appearance)).length,11);
 assert.equal(tooltipAppearanceCSS(appearance)['--md-tooltip-rich-max-inline-size'],'calc(-48px + 100%)');
 for(const platform of ['swift','android']) {
  assert.match(tooltipAppearanceNativeValue('richMaxWidth',appearance.richMaxWidth,platform),/^AWCTooltipLength\(/);
  assert.match(tooltipAppearanceNativeValue('plainShape',appearance.plainShape,platform),/^AWCCornerShape\(/);
 }
 assert.equal(parseTooltipAppearanceInput('plainMaxWidth','0').points,0);
 let accessed=false;const accessor=Object.defineProperty({},'plainTextColor',{get(){accessed=true;return '#FFFFFF'}});
 for(const value of [null,[],{plainTextColor:'#FFF'},{plainMaxWidth:'300px'},{richMaxWidth:{fraction:Infinity}},accessor,{[Symbol('bad')]:1}]) assert.throws(()=>normalizeTooltipAppearance(value),{code:'INVALID_TOOLTIP_APPEARANCE'});
 assert.equal(accessed,false);
});

test('Tooltip panel transport retains all twelve authored values and all eleven styles',()=>{
 const request=nativeRenderRequest(component.tag,props,true,{...componentAppearanceOptions({selected:component,tooltipAppearance:appearance}),direction:'rtl'});Object.assign(request,{width:360,height:480});
 const valid=validateRenderRequest(request,new Set([component.tag]));
 assert.deepEqual(valid.properties,props);assert.deepEqual(valid.tooltipAppearance,appearance);assert.equal(valid.height,480);
 assert.throws(()=>validateRenderRequest({...request,tag:'md-button'},new Set(['md-button'])),{code:'INVALID_HEIGHT'});
 assert.throws(()=>validateRenderRequest({...request,tag:'md-button',height:undefined},new Set(['md-button'])),{code:'INVALID_TOOLTIP_APPEARANCE'});
 assert.deepEqual([...TOOLTIP_UPDATE_PROPERTIES].sort(),source.properties.map(p=>p.name).sort());
 assert.deepEqual(nativePropertyUpdate(component.tag,props),{command:'update',properties:props});
 for(const patch of [{position:'center'},{variant:'linear'},{showDelay:NaN},{offset:'8'},{disabled:'false'},{density:-5},{width:100}]) assert.throws(()=>nativePropertyUpdate(component.tag,patch),{code:'INVALID_PROPERTY_UPDATE'});
 for(const platform of ['ios','android']) {
  assert.equal(supportsRetainedPropertyUpdates(component,platform),true);
  assert.equal(supportsRetainedPropertyUpdates({...component,support:{[platform]:{...policy,properties:policy.properties.filter(p=>p!=='showDelay')}}},platform),false);
  assert.equal(supportsRetainedPropertyUpdates({...component,support:{[platform]:{...policy,unsupportedMethods:['hide']}}},platform),false);
 }
});

test('Tooltip retained updates preserve explicit open edges, and methods are correlated with no arguments',async()=>{
 const edits=[];const client={canUpdate:()=>true,update:async p=>edits.push(p)};
 for(const value of [false,true]) assert.equal(dispatchRetainedPropertyEdit({component,platform:'ios',client,name:'open',value}),true);
 await Promise.resolve();assert.deepEqual(edits,[{open:false},{open:true}]);
 for(const method of ['show','hide']) {
  const command=nativeMethodCommand(component.tag,method,[],{callId:'tooltip-1',target:'component'});
  assert.equal(command.method,method);assert.equal(command.callId,'tooltip-1');
  assert.throws(()=>nativeMethodCommand(component.tag,method,['close'],{callId:'tooltip-1',target:'component'}),{code:'INVALID_METHOD'});
 }
});

test('Tooltip retained viewport and pointer input are scoped, bounded, and report committed dimensions',()=>{
 const context={tag:component.tag,logicalWidth:360,logicalHeight:480};
 assert.deepEqual(nativeViewportCommand(component.tag,2999,5000),{command:'resize',width:1200,height:1666});
 assert.deepEqual(validateLiveInput({command:'resize',width:360,height:480},context),{command:'resize',width:360,height:480});
 assert.deepEqual(validateLiveInput({command:'pointer',phase:'move',x:180,y:240},context),{command:'pointer',phase:'move',x:180,y:240});
 for(const platform of ['ios','android']) assert.match(nativeCanvasReadout(component.tag,platform,{logicalWidth:1200,logicalHeight:1666},2999,5000).label,/Rendered 1200 × 1666/);
 for(const height of [NaN,0,-1,Infinity]) assert.throws(()=>nativeViewportCommand(component.tag,360,height),{code:'INVALID_VIEWPORT'});
});

test('all three Tooltip Styles panels expose eleven fields and invalid input preserves last valid appearance',t=>{
 const dom=new JSDOM('<div id="button-appearance-controls"></div>'),previous=globalThis.document;globalThis.document=dom.window.document;
 t.after(()=>{globalThis.document=previous;dom.window.close()});
 const state={selected:component,platform:'web',props:{...props}};const ui=createButtonAppearanceUI({getState:()=>state,onChange(){}});
 for(const platform of ['web','ios','android']) {
  state.platform=platform;ui.render();assert.equal(document.querySelectorAll('[data-appearance-field]').length,11);
  for(const field of TOOLTIP_APPEARANCE_FIELDS) {const input=document.querySelector(`#appearance-${field.name}`);input.dispatchEvent(new dom.window.CustomEvent('mdInput',{detail:field.kind==='color'?'#ABCDEF80':field.kind==='corners'?'50% / 4px':'0px'}));assert.equal(input.error,false)}
  const input=document.querySelector('#appearance-richMaxWidth');input.dispatchEvent(new dom.window.CustomEvent('mdInput',{detail:'min(100%, 300px)'}));assert.equal(input.error,true);assert.equal(state.tooltipAppearance.richMaxWidth.points,0);
 }
 const target=document.createElement('md-tooltip');ui.apply(target);assert.equal(target.style.getPropertyValue('--md-tooltip-rich-text-color'),'#ABCDEF80');assert.deepEqual(state.props,props);
});

test('Tooltip framework appearance snippets carry every hook and correct native affine type',()=>{
 for(const platform of ['html','react','angular','vue','svelte','swift','android']) {
  const code=usageSnippet(component,props,platform,{html:recipeFor(component.tag).html,tooltipAppearance:appearance});
  assert.doesNotMatch(code,/\[object Object\]/);
  for(const f of TOOLTIP_APPEARANCE_FIELDS) assert.match(code,new RegExp(['swift','android'].includes(platform)?f.name:f.cssProperty));
  if(['swift','android'].includes(platform)) assert.match(code,/AWCTooltipLength/);
 }
});

test('Tooltip copied native usage and every API section use real scope, controllers, typed slots and parts only after the gate',async()=>{
 const {nativeApiExample,nativeUsageExample}=await import('./native-api-examples.js');
 for(const platform of ['swift','android']) {
  const basic=nativeUsageExample(component,platform);assert.match(basic.code,/AWCTooltipScope/);assert.match(basic.code,/One source\. Every surface\./);assert.match(basic.code,/Hover or focus me/);assert.doesNotMatch(basic.code,/\\n/);
  const copied=usageSnippet(component,{text:'Panel text'},platform,{html:recipeFor(component.tag).html});assert.match(copied,/AWCTooltipScope/);assert.match(copied,/Panel text/);assert.match(copied,/Hover or focus me/);
  for(const [kind,names] of [['event',policy.events],['method',policy.methods],['slot',policy.slots],['cssPart',policy.visualParts]])for(const name of names) {
   const value=nativeApiExample(component,kind,name,platform);assert.ok(value.code,`${platform}/${kind}/${name}`);assert.match(value.code,/AWCTooltipScope/);assert.doesNotMatch(value.code,/\\n/);
   if(kind==='method')assert.match(value.code,/controller\.show\(/);
   if(kind==='cssPart')assert.match(value.code,/TooltipPartAppearance/);
   if(kind==='slot'&&['subhead','content'].includes(name))assert.match(value.code,platform==='swift'?/awcTooltipSlot\(\.(subhead|content), text:/:/AWCSlotText/);
  }
  const held={...component,support:{ios:{...policy,methods:[]},android:{...policy,methods:[]}}};
  assert.doesNotMatch(usageSnippet(held,{},platform,{html:recipeFor(component.tag).html}),/AWCTooltipScope/);
 }
});

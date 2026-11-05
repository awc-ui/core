import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FAB_APPEARANCE_FIELDS,normalizeFabAppearance,fabAppearanceCSS} from './fab-appearance.js';
import {componentAppearance,componentAppearanceOptions} from './component-appearance.js';
import {nativeRenderRequest} from './contracts.js';
import {validateRenderRequest} from './native-render.mjs';
import {usageSnippet} from './usage-snippets.js';

test('FAB five fields map exactly to source CSS with independent color/length validation',()=>{
 const css=readFileSync(new URL('../../packages/core/src/components/md-fab/md-fab.css',import.meta.url),'utf8');
 assert.deepEqual(FAB_APPEARANCE_FIELDS.map(field=>field.cssProperty).sort(),[...new Set(css.match(/--md-fab-[a-z-]+/g))].sort());
 assert.deepEqual(normalizeFabAppearance({containerColor:'#aabbcc',iconSize:0,cornerRadius:12.5}),{containerColor:'#AABBCC',iconSize:0,cornerRadius:12.5});
 for(const value of [null,[],{width:50},{iconSize:-1},{cornerRadius:Infinity},{labelColor:'#abc'},{iconColor:'red'}]) assert.throws(()=>normalizeFabAppearance(value),{code:'INVALID_FAB_APPEARANCE'});
 assert.deepEqual(fabAppearanceCSS({cornerRadius:0,labelColor:'#aabbcc'}),{'--md-fab-container-shape':'0px','--md-fab-label-color':'#AABBCC'});
 assert.equal(componentAppearance('md-fab').nativeType,'AWCFabAppearance');
});

test('FAB appearance transport and examples do not leak other component style profiles',()=>{
 const fields={containerColor:'#123456',iconColor:'#abcdef',iconSize:32,cornerRadius:20,labelColor:'#FFFFFF'};
 const options=componentAppearanceOptions({selected:{tag:'md-fab'},fabAppearance:fields,buttonAppearance:{width:99}});
 const request=nativeRenderRequest('md-fab',{label:'Create'},false,options);
 assert.deepEqual(validateRenderRequest(request,new Set(['md-fab'])).fabAppearance,normalizeFabAppearance(fields));
 assert.equal(Object.hasOwn(request,'buttonAppearance'),false);
 assert.throws(()=>validateRenderRequest({...request,tag:'md-button'},new Set(['md-button'])),{code:'INVALID_FAB_APPEARANCE'});
 for(const platform of ['html','swift','android']) {
  const code=usageSnippet({tag:'md-fab'}, {label:'Create'},platform,{html:'<md-fab></md-fab>',fabAppearance:fields});
  assert.ok(code.includes(platform==='html'?'--md-fab-container-shape':platform==='swift'?'awcFabAppearance':'AWCFabAppearanceScope'));
  assert.doesNotMatch(code,/awcButtonAppearance|AWCButtonAppearanceScope/);
 }
});

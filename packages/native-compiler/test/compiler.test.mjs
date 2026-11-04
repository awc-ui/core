import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {analyzeSource,extractTokens} from '../src/analyze.mjs';
import {compile,repositoryRoot,staleIRFiles} from '../src/compiler.mjs';
import {emitSwiftComponent,emitKotlinComponent,kotlinValue,swiftValue,swiftTokens,kotlinTokens} from '../src/emit.mjs';

const fixture=`import {Component,Prop,State,Event,EventEmitter} from '@stencil/core';
@Component({tag:'md-fixture',shadow:true}) export class Fixture {
 @Prop({reflect:true,attribute:'is-disabled'}) disabled:boolean=false;
 @Prop() variant:'filled'|'outlined'='filled';
 @Prop() scale:0|-1|-2=-1;
 @Prop() label:string='Hello';
 @Prop() options:Array<{label:string}>= [{label:'One'}];
 @Prop() dynamic:string=globalThis.sideEffect();
 @State() open:boolean=false;
 @Event({cancelable:false,bubbles:false}) mdChange:EventEmitter<{value:string}>;
 render(){return <button disabled={this.disabled}>{this.label}</button>}
}`;

test('AST extracts source API, negative defaults, enums and actual JSX without running source',()=>{
 const c=analyzeSource(fixture,'fixture.tsx');
 assert.equal(c.tag,'md-fixture');assert.equal(c.properties.length,6);
 assert.equal(c.properties[0].attribute,'is-disabled');assert.equal(c.properties[0].reflect,true);
 assert.deepEqual(c.properties[1].options,['filled','outlined']);assert.equal(c.properties[2].defaultValue,-1);
 assert.deepEqual(c.properties[4].defaultValue,[{label:'One'}]);
 assert.equal(Object.hasOwn(c.properties[5],'defaultValue'),false);
 assert.equal(c.events[0].cancelable,false);assert.equal(c.events[0].bubbles,false);
 assert.equal(c.render.tag,'button');assert.equal(c.render.children[0].source,'this.label');
 assert.ok(c.diagnostics.some(d=>d.code==='DYNAMIC_DEFAULT'));
});

test('native-incompatible browser semantics are explicit diagnostics',()=>{
 const c=analyzeSource(fixture.replace('render(){','mounted(){new MutationObserver(()=>{});document.querySelector("button");this.el.shadowRoot;} render(){'),'dom.tsx');
 for(const code of ['DOM_OBSERVER','DOM_GLOBAL','DOM_QUERY','SHADOW_DOM'])assert.ok(c.diagnostics.some(d=>d.code===code),code);
});

test('native enum/default lowering preserves prop contract and delegates to native renderers',()=>{
 const c=analyzeSource(fixture,'fixture.tsx');
 const swift=emitSwiftComponent(c),kotlin=emitKotlinComponent(c);
 assert.match(swift,/enum AWCFixtureVariant: String/);assert.match(swift,/case `outlined` = "outlined"/);
 assert.match(swift,/AWCNativeView\(tag: "md-fixture"/);
 assert.match(kotlin,/enum class AWCFixtureVariant/);assert.match(kotlin,/scale`: Double = -1.0/);
 assert.match(kotlin,/AWCComponent\(tag = "md-fixture"/);
 assert.match(swift,/dynamic`: String\? = nil/);assert.match(kotlin,/dynamic`: String\? = null/);
});

test('generated source escapes Kotlin interpolation and Swift special characters',()=>{
 assert.equal(kotlinValue('$input\\path\n"'), '"\\$input\\\\path\\n\\\""');
 assert.equal(swiftValue('\\(danger)'),'.string("\\\\(danger)")');
 assert.equal(swiftValue({name:'item',enabled:true}),'.object(["name": .string("item"), "enabled": .bool(true)])');
 assert.equal(kotlinValue([]),'emptyList<Nothing>()');
 assert.equal(kotlinValue({}),'emptyMap<String, Nothing>()');
});

test('a renamed/removed component is reported as stale without selecting unrelated files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'awc-native-stale-'));
 try{
  const dir=join(root,'packages/native-compiler/generated/ir');await mkdir(dir,{recursive:true});
  for(const name of ['md-old.json','md-button.json','notes.json'])await writeFile(join(dir,name),'{}');
  assert.deepEqual(await staleIRFiles(root,new Set(['md-button'])),['packages/native-compiler/generated/ir/md-old.json']);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('token extraction separates themes/density/media, retains raw complex values, and propagates changes',()=>{
 const css=':root {--md-sys-color-primary:#6750A4;--shape:4px;--elevation:0px 2px rgba(0,0,0,.2)} [data-theme="dark"] {--md-sys-color-primary:#D0BCFF} [data-density="-1"] {--shape:2px} @media (prefers-contrast:more) {:root {--shape:8px}}';
 const tokens=extractTokens(css);
 assert.equal(tokens.light['--shape'],'4px');assert.equal(tokens.dark['--shape'],'4px');
 assert.equal(tokens.dark['--md-sys-color-primary'],'#D0BCFF');assert.equal(tokens.scopes.length,4);
 const changed=extractTokens(css.replace('#6750A4','#FF0000'));
 assert.notEqual(swiftTokens(tokens),swiftTokens(changed));assert.notEqual(kotlinTokens(tokens),kotlinTokens(changed));
});

test('all actual Stencil elements receive IR, Swift and Kotlin output; generation is deterministic',async()=>{
 const one=await compile({write:false}),two=await compile({write:false});
 const manifest=JSON.parse(await readFile(join(repositoryRoot,'packages/core/custom-elements.json'),'utf8'));
 const sourceTags=manifest.modules.flatMap(m=>m.declarations??[]).filter(d=>d.customElement).map(d=>d.tagName).sort();
 assert.deepEqual(one.components.map(c=>c.tag),sourceTags);
 assert.equal(one.components.length,81);
 assert.deepEqual([...one.outputs],[...two.outputs]);
 for(const component of one.components){
  assert.ok(one.outputs.has(component.irPath));
  assert.ok(one.outputs.get(component.swiftPath).includes(`AWCNativeView(tag: "${component.tag}"`));
  assert.ok(one.outputs.get(component.kotlinPath).includes(`AWCComponent(tag = "${component.tag}"`));
  assert.equal(component.lowering.arbitraryTypeScriptTranslated,false);
 }
});

test('strict gate does not misrepresent generated wrappers as complete source parity',async()=>{
 const result=await compile({write:false,strict:true});
 assert.equal(result.ok,false);assert.ok(result.incomplete.length>0);
 assert.equal(result.catalog.summary.sourceParityVerified,false);
 const button=result.components.find(c=>c.tag==='md-button');
 assert.ok(button.diagnostics.some(d=>d.code==='HTML_FORM'));
 assert.ok(button.events.some(e=>e.name==='mdClick'&&e.cancelable));
});


test('native appearance metadata distinguishes visual equivalents from CSS selector support', async () => {
 const {catalog} = await compile({write:false});
 const button = catalog.components.find(component => component.tag === 'md-button');
 for (const platform of ['ios', 'android']) {
  const support = button.support[platform];
  assert.equal(support.appearance.fields.length, 28);
  for (const field of ['focusRingColor', 'width', 'minWidth', 'maxWidth', 'height', 'minHeight']) {
   assert.ok(support.appearance.fields.includes(field), `${platform} exposes ${field}`);
  }
  assert.ok(support.appearance.api.includes('AWCButtonAppearance'));
  assert.deepEqual(support.visualParts, ['anchor', 'state-layer', 'icon', 'label', 'trailing-icon', 'loading']);
  assert.ok(!support.cssParts?.length, 'Native visuals must not claim CSS selector evaluation');
 }
});

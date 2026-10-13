import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { themeExportSource, createThemeExportUI } from './studio-ui.js';
import { computeStudioTheme, exportStudioTheme } from './studio-theme.js';
import { computeTheme } from './theme-vendor/awc-theme.js';

test('CSS export preview contains the exact complete light and dark stylesheet', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-13T12:00:00Z') });
  const result = computeStudioTheme({ primaryHex: '#2468AC', contrastLevel: .5, mode: 'dark' });
  const source = themeExportSource(result);
  assert.equal(source.language, 'css');
  assert.equal(source.filename, 'theme.css');
  assert.equal(source.code, exportStudioTheme(result));
  assert.match(source.code, /\[data-theme="dark"\]/);
  assert(source.code.includes(result.tokens.light['--md-sys-color-primary']));
  assert(source.code.includes(result.tokens.dark['--md-sys-color-primary']));
  assert(!source.code.includes('computeTheme('));
});

test('JavaScript export actually regenerates the same theme with automatic and manual seeds', () => {
  for(const config of [
    { primaryHex: '#2468AC', mode:'dark' },
    { primaryHex: '#884422', secondaryHex:'#339977', tertiaryHex:'#3377AA', contrastLevel:.5, mode:'light' },
  ]) {
    const result = computeStudioTheme(config);
    const source = themeExportSource(result, 'javascript');
    let applied;
    const document = { documentElement:{ dataset:{} } };
    const executable = source.code.replace(/^import[^;]+;\n/, '');
    new vm.Script(executable).runInNewContext({ computeTheme, applyThemeStylesheet: theme => { applied=theme; }, document });
    assert.deepEqual(applied.roles, result.roles);
    assert.equal(document.documentElement.dataset.theme,config.mode);
    assert.equal(source.language,'javascript');
    assert.equal(source.filename,'theme.js');
    if (!config.secondaryHex) assert(!source.code.includes('secondaryHex'));
  }
  assert.throws(() => themeExportSource(computeStudioTheme(), 'other'));
});

function exportFixture(writeText) {
  class Element {
    constructor() { this.listeners=new Map();this.attributes={};this.textContent=''; }
    addEventListener(name,callback) { this.listeners.set(name,callback); }
    setAttribute(name,value) { this.attributes[name]=value; }
    async emit(name,event={}) { return this.listeners.get(name)?.({target:this,...event}); }
  }
  const names=['theme-export-tabs','theme-copy-export','theme-export-filename','theme-export-description','theme-export-panel','theme-code'];
  const elements=Object.fromEntries(names.map(name=>[name,new Element()]));
  const notices=[], copied=[];
  let theme=computeStudioTheme({primaryHex:'#2468AC',mode:'dark'});
  const ui=createThemeExportUI({root:{querySelector:selector=>elements[selector.slice(1)]},getTheme:()=>theme,notify:value=>notices.push(value),
    writeText:writeText|| (async value=>{copied.push(value);}),paintCode:(element,code,language)=>{element.textContent=code;element.language=language;}});
  ui.init();
  return {ui,elements,notices,copied,change(config) { theme=computeStudioTheme(config);ui.render(); }};
}

test('format tabs, highlighted source, accessible panel label and copy action stay in sync after edits', async () => {
  const fixture=exportFixture();
  const {elements:el,ui,copied,notices}=fixture;
  assert.equal(el['theme-code'].language,'css');
  assert.equal(el['theme-copy-export'].textContent,'Copy CSS');
  await el['theme-copy-export'].emit('mdClick');
  assert.equal(copied[0],el['theme-code'].textContent);
  await el['theme-export-tabs'].emit('mdTabChange',{detail:{index:1}});
  assert.equal(el['theme-copy-export'].textContent,'Copy JS');
  assert.equal(el['theme-code'].language,'javascript');
  assert.equal(el['theme-export-panel'].attributes['aria-labelledby'],'theme-javascript-tab');
  assert.equal(el['theme-export-filename'].textContent,'theme.js');
  fixture.change({primaryHex:'#AA4400',mode:'light',contrastLevel:1});
  assert.match(el['theme-code'].textContent, /#AA4400/);
  assert.equal(el['theme-code'].language,'javascript','Changing a seed preserves the selected export format');
  await el['theme-copy-export'].emit('mdClick');
  assert.equal(copied[1],el['theme-code'].textContent);
  assert.deepEqual(notices,['Theme CSS copied','Theme JavaScript copied']);
  await el['theme-export-tabs'].emit('mdTabChange',{target:{},detail:{index:0}});
  await el['theme-export-tabs'].emit('mdTabChange',{detail:{index:20}});
  assert.equal(el['theme-code'].language,'javascript');
  await el['theme-export-tabs'].emit('mdTabChange',{detail:{index:0}});
  assert.equal(el['theme-export-panel'].attributes['aria-labelledby'],'theme-css-tab');
  assert.equal(el['theme-code'].language,'css');
  await el['theme-copy-export'].emit('mdClick');
  assert.equal(copied[2],el['theme-code'].textContent);
  ui.render();
});

test('clipboard failure gives honest feedback and leaves the code available', async () => {
  const {elements,notices}=exportFixture(async()=>{throw new Error('permission denied');});
  const visible=elements['theme-code'].textContent;
  await elements['theme-copy-export'].emit('mdClick');
  assert.deepEqual(notices,['Clipboard unavailable']);
  assert.equal(elements['theme-code'].textContent,visible);
});

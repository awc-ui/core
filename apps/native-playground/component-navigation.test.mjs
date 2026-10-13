import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { docsSidebarExclusions, buildDocumentationNavigation, readDocumentationNavigation, navigationSources } from './component-navigation.mjs';
import { filterDocumentationNavigation, navigationMarkup, createComponentNavigation } from './component-navigation-ui.js';
import { handleComponentNavigationRequest, resolveAsset } from './server.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = {
  categories: ['Actions', 'Navigation'],
  components: [
    { tag: 'md-menu-item', slug: 'menu-item', title: 'Menu Item', category: 'Navigation' },
    { tag: 'md-menu', slug: 'menu', title: 'Menu', category: 'Navigation' },
    { tag: 'md-icon-button', slug: 'icon-button', title: 'Icon Button', category: 'Actions' },
    { tag: 'md-button', slug: 'button', title: 'Button', category: 'Actions' },
  ],
};

test('real Studio roster exactly follows Astro category/title order and excludes internal parts', async () => {
  const result = await readDocumentationNavigation(repository);
  assert.equal(result.total, 56);
  assert.deepEqual(result.groups.map(group => group.title), ['Actions', 'Charts', 'Communication', 'Containment', 'Data Display', 'Navigation', 'Selection', 'Text Inputs']);
  assert.deepEqual(result.groups[0].items.map(item => item.title), ['Button', 'Button Group', 'FAB', 'FAB Menu', 'Icon Button', 'Segmented Button', 'Split Button']);
  const all = result.groups.flatMap(group => group.items);
  assert.equal(new Set(all.map(item => item.tag)).size, 56);
  assert(!all.some(item => ['md-menu-item', 'md-table-cell', 'md-navigation-tab', 'md-tab-panel', 'md-select-option'].includes(item.tag)));
  assert(all.some(item => item.tag === 'md-date-picker' && item.title === 'Date Picker'));
  assert(all.some(item => item.tag === 'md-time-picker' && item.title === 'Time Picker'));
  for(const group of result.groups) assert.deepEqual(group.items.map(item => item.title), group.items.map(item => item.title).sort((a,b) => a.localeCompare(b)));
  const core = JSON.parse(await readFile(path.join(repository, 'packages/core/custom-elements.json'), 'utf8'));
  const contracts = new Set(core.modules.flatMap(module => module.declarations || []).map(item => item.tagName));
  assert(all.every(item => contracts.has(item.tag)), 'Every docs row has a real runtime component');
});

test('extracts literal Astro exclusions without executing config and applies source order', () => {
  const policy = docsSidebarExclusions("throw new Error('never execute'); const MERGED_INTO_PARENT = new Set(['menu-item']);");
  const result = buildDocumentationNavigation(fixture, policy);
  assert.deepEqual(result.groups.map(group => [group.title, ...group.items.map(item => item.tag)]), [['Actions', 'md-button', 'md-icon-button'], ['Navigation', 'md-menu']]);
  assert.throws(() => docsSidebarExclusions('const MERGED_INTO_PARENT = computePolicy();'));
  assert.throws(() => docsSidebarExclusions("const MERGED_INTO_PARENT = new Set([readSecret()]);"));
  assert.throws(() => buildDocumentationNavigation({ ...fixture, components: [...fixture.components, fixture.components[0]] }, new Set()));
  assert.throws(() => buildDocumentationNavigation({ categories: [], components: [{ tag:'md-button', slug: '../private', title:'Button', category:'Actions' }] }, new Set()));
});

test('search matches title, source tag and category and keeps docs order regardless of findings', () => {
  const navigation = buildDocumentationNavigation(fixture, new Set(['menu-item']));
  const components = fixture.components.map(item => ({ ...item, findings: item.tag === 'md-icon-button' ? 2 : 0 }));
  assert.deepEqual(filterDocumentationNavigation(navigation, components, 'BUTTON').flatMap(group => group.items.map(item => item.title)), ['Button', 'Icon Button']);
  assert.deepEqual(filterDocumentationNavigation(navigation, components, 'actions icon').flatMap(group => group.items.map(item => item.tag)), ['md-icon-button']);
  assert.equal(filterDocumentationNavigation(navigation, components, 'md-menu-item').length, 0);
  assert.equal(filterDocumentationNavigation(navigation, components, 'missing').length, 0);
  assert.deepEqual(filterDocumentationNavigation(navigation, components).flatMap(group => group.items.map(item => item.tag)), ['md-button', 'md-icon-button', 'md-menu']);
});

test('markup uses real permanent AWC navigation with headings and hash links and escapes source titles', () => {
  const result = buildDocumentationNavigation(fixture, new Set(['menu-item']));
  const html = navigationMarkup(result.groups, 'md-icon-button');
  assert.match(html, /<md-navigation-rail[^>]+variant="expanded"[^>]+active-index="1"/);
  assert.match(html, /<h3 data-section-header><span>Actions<\/span><md-chip[^>]+inert aria-hidden="true">2<\/md-chip>/);
  assert.match(html, /href="#md-icon-button"[^>]+ active>/);
  const buttonIcon = /data-tag="md-button"[^>]+ icon="([^"]+)"/.exec(html)?.[1];
  const iconButtonIcon = /data-tag="md-icon-button"[^>]+ icon="([^"]+)"/.exec(html)?.[1];
  assert(buttonIcon && iconButtonIcon);
  assert.notEqual(buttonIcon, iconButtonIcon, 'Components in the same category retain their own symbols');
  assert(!html.includes('<md-button'));
  assert.match(navigationMarkup([], 'md-button'), /role="status">No matching components/);
  assert(!navigationMarkup([{title:'<script>x</script>',items:[{tag:'md-button',title:'" onclick="bad()'}]}]).includes('<script>'));
  assert.match(navigationMarkup([{title:'Actions',items:[{tag:'md-button',title:'" onclick="bad()'}]}]), /label="&quot; onclick=&quot;bad\(\)"/);
});

test('every docs section has a noninteractive library count chip that follows search results', async () => {
  const navigation = await readDocumentationNavigation(repository);
  const components = navigation.groups.flatMap(group => group.items);
  const html = navigationMarkup(navigation.groups, 'md-button');
  const chips = [...html.matchAll(/<md-chip class="count-chip nav-group-count"[^>]+inert aria-hidden="true">(\d+)<\/md-chip>/g)];
  assert.equal(chips.length, 8);
  assert.deepEqual(chips.map(match => Number(match[1])), [7,5,8,8,3,8,12,5]);
  for(const group of navigation.groups) assert(html.includes(`, ${group.items.length} components</span></h3>`));
  const filtered = filterDocumentationNavigation(navigation, components, 'chart');
  const filteredHTML = navigationMarkup(filtered, 'md-bar-chart');
  const filteredCounts = [...filteredHTML.matchAll(/<md-chip class="count-chip nav-group-count"[^>]+>(\d+)<\/md-chip>/g)].map(match => Number(match[1]));
  assert.deepEqual(filteredCounts, [5,1]);
  assert.match(filteredHTML, /, 1 component<\/span><\/h3>/);
});

test('selection updates preserve mounted destinations, keyboard focus and scrolling', () => {
  const listeners = new Map(); let writes = 0;
  const rail = { id: 'studio-component-navigation', attributes: {}, setAttribute(name,value) { this.attributes[name] = value; } };
  const items = ['md-button','md-icon-button','md-menu'].map(tag => ({ dataset:{tag}, active:false, toggleAttribute(name,value) { this[name] = value; } }));
  const container = {
    setAttribute() {}, removeAttribute() {},
    addEventListener(name,listener) { listeners.set(name,listener); }, removeEventListener(name) { listeners.delete(name); },
    set innerHTML(value) { writes++; this.html = value; },
    querySelectorAll: () => items, querySelector: () => rail,
  };
  const selected = [];
  const navigation = createComponentNavigation({ container, onSelect: value => selected.push(value) });
  const groups = buildDocumentationNavigation(fixture, new Set(['menu-item'])).groups;
  navigation.render(groups, 'md-button');
  rail.scrollTop = 145; const focused = items[1];
  navigation.render(groups, 'md-icon-button');
  assert.equal(writes,1); assert.equal(rail.scrollTop,145); assert.equal(items[1],focused);
  assert.equal(rail.attributes['active-index'],'1'); assert.equal(items[1].active,true); assert.equal(items[0].active,false);
  const listener = listeners.get('mdTabChange');
  listener({target:rail,detail:{value:'md-menu'}});
  listener({target:rail,detail:{value:'md-menu-item'}});
  listener({target:{id:'preview-component'},detail:{value:'md-button'}});
  assert.deepEqual(selected,['md-menu']);
  navigation.dispose(); assert.equal(listeners.size,0);
});

test('navigation endpoint reads fixed docs files, rejects unsupported routes and prevents symlink escapes', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'awc-docs-navigation-'));
  const repo = path.join(root,'repo');
  try {
    for(const relative of navigationSources) await mkdir(path.dirname(path.join(repo,relative)),{recursive:true});
    await writeFile(path.join(repo,navigationSources[0]),"const MERGED_INTO_PARENT = new Set(['menu-item']);");
    await writeFile(path.join(repo,navigationSources[1]),JSON.stringify(fixture));
    const request = async (url,method='GET') => {
      const response = { writeHead(status,headers) { this.status=status;this.headers=headers; }, end() {} };
      response.handled=await handleComponentNavigationRequest({url,method},response,{repoRoot:repo,json:(res,status,value)=>Object.assign(res,{status,value})});
      return response;
    };
    const valid = await request('/api/component-navigation');
    assert.equal(valid.status,200);assert.equal(valid.value.total,3);
    assert.equal((await request('/api/component-navigation','POST')).status,405);
    assert.equal((await request('/api/component-navigation/../../private')).status,404);
    assert.equal((await request('/unrelated')).handled,false);
    await writeFile(path.join(root,'outside.json'),JSON.stringify(fixture));
    await rm(path.join(repo,navigationSources[1]));
    await symlink(path.join(root,'outside.json'),path.join(repo,navigationSources[1]));
    assert.equal((await request('/api/component-navigation')).status,503);
  } finally { await rm(root,{recursive:true,force:true}); }
  const ui=path.join(repository,'apps/native-playground/component-navigation-ui.js');
  assert.equal(await resolveAsset('/component-navigation-ui.js'),await realpath(ui));
  assert.equal(await resolveAsset('/component-icons.js'),await realpath(path.join(repository,'apps/native-playground/component-icons.js')));
  assert.equal(await resolveAsset('/component-navigation.mjs'),null);
});

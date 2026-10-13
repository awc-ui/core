import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { recipeFor } from './recipes.js';

const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
const components = manifest.modules.flatMap(module => module.declarations || []).filter(component => component.tagName);
const directory = new URL('../../node_modules/.pnpm/', import.meta.url);
const stencil = (await readdir(directory)).filter(name => name.startsWith('@stencil+core@')).sort().at(-1);
const loaded = await import(new URL(`${stencil}/node_modules/@stencil/core/mock-doc/index.cjs`, directory));
const dom = loaded.default ?? loaded;

test('all 81 recipes contain selected components, only public attributes, and declared child slots', () => {
  assert.equal(components.length, 81);
  const lookup = new Map(components.map(component => [component.tagName, component]));
  for (const component of components) {
    const recipe = recipeFor(component.tagName), document = dom.createDocument(recipe.html);
    assert.ok(document.querySelector(component.tagName), component.tagName);
    assert.notEqual(recipe.note, 'Source component reference');
    for (const element of document.querySelectorAll('*')) {
      const source = lookup.get(element.tagName.toLowerCase());
      if (!source) continue;
      const fields = (source.members || []).filter(member => member.kind === 'field');
      const attributes = new Set(fields.map(field => field.attribute || field.name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())));
      for (const { name } of [...element.attributes]) {
        if (/^(?:aria-|data-)/.test(name) || ['id', 'class', 'style', 'slot', 'role', 'tabindex'].includes(name)) continue;
        assert.ok(attributes.has(name), `${component.tagName}: ${element.tagName}.${name} is a public attribute`);
      }
      const slots = new Set((source.slots || []).map(slot => slot.name));
      for (const child of element.children) if (child.hasAttribute('slot')) assert.ok(slots.has(child.getAttribute('slot')), `${component.tagName}: ${source.tagName} slot ${child.getAttribute('slot')} exists`);
    }
  }
});

test('overlay preview actions open, toggle, close and re-open the actual target', () => {
  for (const tag of ['md-menu', 'md-menu-item', 'md-menu-item-group', 'md-sub-menu-item', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet', 'md-snackbar']) {
    const recipe = recipeFor(tag), document = dom.createDocument(recipe.html);
    recipe.setup(document.body);
    const triggers = document.querySelectorAll('[data-awc-action]');
    assert.ok(triggers.length, tag);
    for (const trigger of triggers) {
      const target = document.getElementById(trigger.getAttribute('data-awc-target'));
      assert.ok(target, `${tag}: action target exists`);
      const action = trigger.getAttribute('data-awc-action');
      target.open = action === 'close';
      trigger.dispatchEvent(new dom.MockMouseEvent('click'));
      assert.equal(target.open, action !== 'close', `${tag}: ${action}`);
      if (action === 'toggle') {
        trigger.dispatchEvent(new dom.MockMouseEvent('click'));
        assert.equal(target.open, false, `${tag}: second activation closes the menu`);
      }
    }
  }
});

test('FAB menus rely on built-in anchor handling without a competing toggle listener', async () => {
  for (const tag of ['md-fab-menu', 'md-fab-menu-item']) {
    const recipe = recipeFor(tag), document = dom.createDocument(recipe.html);
    assert.equal(recipe.setup, null);
    const menu = document.querySelector('md-fab-menu');
    assert.ok(document.getElementById(menu.getAttribute('anchor')));
    assert.equal(document.querySelectorAll('[data-awc-action]').length, 0);
  }
  const source = await readFile(new URL('../../packages/core/src/components/md-fab-menu/md-fab-menu.tsx', import.meta.url), 'utf8');
  assert.match(source, /anchorEl\.addEventListener\('click', this\.anchorClickHandler, true\)/);
});

test('form labels, search results and expandable row content are placed in visible supported locations', () => {
  for (const tag of ['md-checkbox', 'md-radio']) {
    const document = dom.createDocument(recipeFor(tag).html), input = document.querySelector(tag);
    assert.equal(input.textContent, '', `${tag} has no unused default-slot text`);
    assert.equal(input.parentElement.tagName, 'LABEL');
    assert.ok(input.parentElement.textContent.trim());
    assert.equal(recipeFor(tag).text, undefined);
  }
  const radios = dom.createDocument(recipeFor('md-radio').html).querySelectorAll('md-radio');
  assert.equal(radios.length, 2);
  assert.equal(radios[0].getAttribute('name'), radios[1].getAttribute('name'));
  const search = dom.createDocument(recipeFor('md-search').html).querySelector('md-search');
  assert.ok(search.querySelector('md-list[slot="results"]'));
  const table = dom.createDocument(recipeFor('md-table').html);
  assert.ok(table.querySelector('md-table-row[expandable] [slot="expanded"]').textContent.trim());
  assert.equal(table.querySelector('md-table-pagination').getAttribute('count'), String(table.querySelectorAll('md-table-body md-table-row').length));
});

test('content editors are offered only for declared text-bearing default slots', () => {
  const textTags = [];
  for (const component of components) {
    const recipe = recipeFor(component.tagName);
    if (recipe.text === undefined) continue;
    textTags.push(component.tagName);
    assert.ok(component.slots.some(slot => !slot.name), component.tagName);
    const element = dom.createDocument(recipe.html).querySelector(component.tagName);
    assert.equal(element.textContent, recipe.text, `${component.tagName} seeds its editor from the actual content`);
    assert.ok(recipe.textLabel && recipe.textDescription);
  }
  assert.deepEqual(textTags.sort(), ['md-accordion-item', 'md-breadcrumb-item', 'md-button', 'md-step', 'md-tab-panel', 'md-table-sort-label']);
});

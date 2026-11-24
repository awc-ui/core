import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { renderToString } from '../hydrate/index.mjs';

const { JSDOM } = createRequire(import.meta.url)('jsdom');

// Inspect the delivered HTML without registering custom elements or adopting
// DSD. A later client render must not be able to repair a failing assertion.
async function render(html) {
  const result = await renderToString(html, {
    serializeShadowRoot: 'declarative-shadow-dom',
    fullDocument: false,
  });
  assert.deepEqual(result.diagnostics.filter(d => d.level === 'error'), []);
  return new JSDOM(result.html).window.document;
}

function shadow(host) {
  assert(host, 'missing component host');
  const template = [...host.children].find(el => el.matches('template[shadowrootmode="open"]'));
  assert(template, `${host.localName} has no own server-rendered shadow root`);
  assert(host.classList.contains('hydrated'), `${host.localName} would be hidden by the core token stylesheet`);
  return template.content;
}

function deepAll(root, selector) {
  const matches = [...root.querySelectorAll(selector)];
  for (const template of root.querySelectorAll('template[shadowrootmode]')) {
    matches.push(...deepAll(template.content, selector));
  }
  return matches;
}

for (const active of [0, 1]) {
  test(`tabs serialize parent-selected indicator and ARIA before JavaScript (index ${active})`, async () => {
    const doc = await render(`<md-tabs active-tab-index="${active}"><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs>`);
    const tabs = [...doc.querySelectorAll('md-tab')];
    assert.equal(tabs.length, 2);
    tabs.forEach((tab, index) => {
      const selected = index === active;
      assert.equal(tab.classList.contains('md-tab--active'), selected);
      assert.equal(tab.getAttribute('aria-selected'), String(selected));
      assert.equal(tab.getAttribute('tabindex'), selected ? '0' : '-1');
      assert.equal(!!shadow(tab).querySelector('.md-tab__indicator--active'), selected);
    });
  });
}

for (const family of ['bar', 'rail']) {
  test(`navigation ${family} serializes the selected child before JavaScript`, async () => {
    const tag = family === 'bar' ? 'md-navigation-tab' : 'md-navigation-rail-tab';
    const doc = await render(`<md-navigation-${family} active-index="1"><${tag} label="A"></${tag}><${tag} label="B"></${tag}></md-navigation-${family}>`);
    const tabs = [...doc.querySelectorAll(tag)];
    assert.equal(tabs.length, 2);
    tabs.forEach((tab, index) => {
      const selected = index === 1;
      assert.equal(tab.classList.contains(`${tag}--active`), selected);
      assert.equal(tab.getAttribute('aria-selected'), String(selected));
      assert.equal(tab.getAttribute('tabindex'), selected ? '0' : '-1');
      const content = shadow(tab);
      if (family === 'bar') assert.equal(!!content.querySelector(`.${tag}__indicator--active`), selected);
      else assert(content.querySelector('[part="indicator"]'));
    });
  });
}

for (const sizing of ['stable', 'active']) {
  test(`tab panels serialize active content, focusability and ARIA links (${sizing})`, async () => {
    const doc = await render(`<md-tabs id="tabs" active-tab-index="1"><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs><md-tab-panels for="tabs" sizing="${sizing}"><md-tab-panel>A content</md-tab-panel><md-tab-panel>B content</md-tab-panel></md-tab-panels>`);
    const tabs = [...doc.querySelectorAll('md-tab')];
    const panels = [...doc.querySelectorAll('md-tab-panel')];
    assert.equal(panels.length, 2);
    assert(doc.querySelector('md-tab-panels').hasAttribute('data-active-resolved'));
    panels.forEach((panel, index) => {
      const selected = index === 1;
      assert.equal(panel.hasAttribute('active'), selected);
      assert.equal(panel.hasAttribute('inert'), !selected);
      assert.equal(panel.getAttribute('tabindex'), selected ? '0' : '-1');
      assert(panel.id);
      assert(tabs[index].id);
      assert.equal(tabs[index].getAttribute('aria-controls'), panel.id);
      assert.equal(panel.getAttribute('aria-labelledby'), tabs[index].id);
      assert(shadow(panel).querySelector('.md-tab-panel__body'));
    });
  });
}

test('every disabled tab leaves its server-rendered panel inactive and unfocusable', async () => {
  const doc = await render(`<md-tabs active-tab-index="1">
    <md-tab disabled label="A"></md-tab><md-tab disabled label="B"></md-tab><md-tab disabled label="C"></md-tab>
  </md-tabs><md-tab-panels sizing="active">
    <md-tab-panel>A content</md-tab-panel><md-tab-panel active>B content</md-tab-panel><md-tab-panel>C content</md-tab-panel>
  </md-tab-panels>`);
  const tabs = [...doc.querySelectorAll('md-tab')];
  const panels = [...doc.querySelectorAll('md-tab-panel')];
  assert.equal(tabs.length, 3);
  assert.equal(panels.length, 3);
  tabs.forEach((tab, i) => {
    assert.equal(tab.getAttribute('aria-selected'), 'false');
    assert.equal(tab.getAttribute('tabindex'), '-1');
    assert.equal(panels[i].hasAttribute('active'), false);
    assert.equal(panels[i].hasAttribute('inert'), true);
    assert.equal(panels[i].getAttribute('tabindex'), '-1');
  });
});

test('panel ID links use the managed default slot and ignore other descendants', async () => {
  const doc = await render(`<md-tabs id="tabs" active-tab-index="1">
    <md-tab id="named" slot="unused" label="Named"></md-tab>
    <div><md-tab id="nested" label="Nested"></md-tab></div>
    <md-tab id="tab-a" label="A"></md-tab><md-tab id="tab-b" label="B"></md-tab>
  </md-tabs><md-tab-panels for="tabs">
    <md-tab-panel id="panel-a">A content</md-tab-panel><md-tab-panel id="panel-b">B content</md-tab-panel>
  </md-tab-panels>`);
  assert.equal(doc.getElementById('named').hasAttribute('aria-controls'), false);
  assert.equal(doc.getElementById('nested').hasAttribute('aria-controls'), false);
  assert.equal(doc.getElementById('tab-a').getAttribute('aria-controls'), 'panel-a');
  assert.equal(doc.getElementById('tab-b').getAttribute('aria-controls'), 'panel-b');
  assert.equal(doc.getElementById('panel-a').getAttribute('aria-labelledby'), 'tab-a');
  assert.equal(doc.getElementById('panel-b').getAttribute('aria-labelledby'), 'tab-b');
  assert.equal(doc.getElementById('panel-b').hasAttribute('active'), true);
});

test('connected button groups serialize shared shape, size, toggle selection and joined edges', async () => {
  const doc = await render('<md-button-group variant="connected" size="lg" shape="square"><md-button selected>A</md-button><md-button>B</md-button></md-button-group>');
  const buttons = [...doc.querySelectorAll('md-button')];
  assert.equal(buttons.length, 2);
  buttons.forEach((button, index) => {
    for (const cls of ['md-button--lg', 'md-button--square', 'md-button--toggle']) assert(button.classList.contains(cls), cls);
    assert.equal(button.classList.contains('md-button--connected-left'), index > 0);
    assert.equal(button.classList.contains('md-button--connected-right'), index === 0);
    assert.equal(button.classList.contains('md-button--selected'), index === 0);
    assert.equal(button.getAttribute('aria-pressed'), String(index === 0));
    assert.equal(button.getAttribute('tabindex'), index === 0 ? '0' : '-1');
    shadow(button);
  });
});

for (const multiselect of [false, true]) {
  test(`segmented sets serialize density, endpoint shape and selection roles (multi=${multiselect})`, async () => {
    const doc = await render(`<md-segmented-button-set ${multiselect ? 'multiselect' : ''} density="-2"><md-segmented-button label="A" selected></md-segmented-button><md-segmented-button label="B"></md-segmented-button><md-segmented-button label="C"></md-segmented-button></md-segmented-button-set>`);
    const segments = [...doc.querySelectorAll('md-segmented-button')];
    assert.equal(segments.length, 3);
    segments.forEach((segment, index) => {
      assert(segment.classList.contains('md-segmented-button--density-2'));
      assert.equal(segment.classList.contains('md-segmented-button--first'), index === 0);
      assert.equal(segment.classList.contains('md-segmented-button--last'), index === 2);
      assert.equal(segment.getAttribute('role'), multiselect ? 'checkbox' : 'radio');
      assert.equal(segment.getAttribute('aria-checked'), String(index === 0));
      assert.equal(!!shadow(segment).querySelector('[part="checkmark"]'), index === 0);
    });
  });
}

test('accordion default expansion and parent heading/region contracts are already rendered', async () => {
  const doc = await render('<md-accordion default-expanded="1" heading-level="2" region="never"><md-accordion-item headline="A">A content</md-accordion-item><md-accordion-item headline="B">B content</md-accordion-item></md-accordion>');
  const items = [...doc.querySelectorAll('md-accordion-item')];
  assert.equal(items.length, 2);
  items.forEach((item, index) => {
    const selected = index === 1;
    assert.equal(item.hasAttribute('expanded'), selected);
    assert.equal(item.classList.contains('md-accordion-item--expanded'), selected);
    const content = shadow(item);
    assert(content.querySelector('h2'));
    assert.equal(content.querySelector('[part="header"]').getAttribute('aria-expanded'), String(selected));
    const panel = content.querySelector('[part="panel"]');
    assert.equal(panel.getAttribute('role'), 'group');
    assert.equal(panel.getAttribute('aria-hidden'), String(!selected));
    assert.equal(panel.hasAttribute('inert'), !selected);
  });
});

test('accordion keep-one-expanded skips disabled items and locks the initial open header', async () => {
  const doc = await render('<md-accordion keep-one-expanded><md-accordion-item disabled>A</md-accordion-item><md-accordion-item>B</md-accordion-item></md-accordion>');
  const [disabled, active] = doc.querySelectorAll('md-accordion-item');
  assert(!disabled.hasAttribute('expanded'));
  assert(active.hasAttribute('expanded'));
  const content = shadow(active);
  assert.equal(content.querySelector('[part="header"]').getAttribute('aria-disabled'), 'true');
  assert.equal(content.querySelector('[part="panel"]').getAttribute('aria-hidden'), 'false');
});

test('accordion exclusive initial state keeps the first requested expansion', async () => {
  const doc = await render('<md-accordion exclusive default-expanded="0,1"><md-accordion-item>A</md-accordion-item><md-accordion-item>B</md-accordion-item></md-accordion>');
  const items = [...doc.querySelectorAll('md-accordion-item')];
  assert.deepEqual(items.map(item => item.hasAttribute('expanded')), [true, false]);
  assert.deepEqual(items.map(item => shadow(item).querySelector('[part="header"]').getAttribute('aria-expanded')), ['true', 'false']);
});

test('selectable lists serialize selection semantics, roving focus, handles and a static image check', async () => {
  const doc = await render('<md-list selection-mode="single" reorderable><md-list-item headline="A" selected leading-image="a.png"></md-list-item><md-list-item headline="B"></md-list-item></md-list>');
  assert.equal(doc.querySelector('md-list').getAttribute('role'), 'listbox');
  const items = [...doc.querySelectorAll('md-list-item')];
  assert.equal(items.length, 2);
  items.forEach((item, index) => {
    assert.equal(item.getAttribute('role'), 'option');
    assert.equal(item.getAttribute('aria-selected'), String(index === 0));
    assert.equal(item.getAttribute('tabindex'), index === 0 ? '0' : '-1');
    assert(item.classList.contains('md-list-item--selection-mode'));
    assert(item.classList.contains('md-list-item--reorderable'));
    assert(shadow(item).querySelector('[part="drag-handle"]'));
  });
  const selected = shadow(items[0]);
  assert(selected.querySelector('[part="image-selection-check"]'));
  assert.equal(selected.querySelector('.md-list-item__image-selection-circle--entering'), null);
});

test('stepper serializes parent index, active panel, numbering and connector progress', async () => {
  const doc = await render('<md-stepper active="1" orientation="vertical"><md-step label="A">A content</md-step><md-step label="B">B content</md-step><md-step label="C">C content</md-step></md-stepper>');
  const steps = [...doc.querySelectorAll('md-step')];
  assert.equal(steps.length, 3);
  steps.forEach((step, index) => {
    assert.equal(step.getAttribute('data-index'), String(index));
    assert.equal(step.getAttribute('data-total'), '3');
    assert.equal(step.getAttribute('data-active'), '1');
    assert.equal(step.getAttribute('data-orientation'), 'vertical');
    assert.equal(step.classList.contains('md-step--active'), index === 1);
    assert.equal(step.getAttribute('aria-current'), index === 1 ? 'step' : null);
    const content = shadow(step);
    assert.equal(content.querySelector('[part="bubble"]').textContent, String(index + 1));
    assert.equal(content.querySelector('[part="inner"]').getAttribute('aria-expanded'), String(index === 1));
    assert.equal(!!content.querySelector('.md-step__content--open'), index === 1);
    const trailing = content.querySelector('.md-step__connector--trailing');
    if (trailing) assert.equal(trailing.classList.contains('md-step__connector--filled'), index < 1);
  });
});

test('open FAB menus serialize placement, visibility and stagger indices without requiring focus', async () => {
  const doc = await render('<md-fab-menu open placement="down"><md-fab-menu-item label="A"></md-fab-menu-item><md-fab-menu-item label="B"></md-fab-menu-item></md-fab-menu>');
  const menu = doc.querySelector('md-fab-menu');
  assert(menu.classList.contains('md-fab-menu--open'));
  assert(menu.classList.contains('md-fab-menu--down'));
  assert.equal(menu.getAttribute('aria-hidden'), 'false');
  const items = [...doc.querySelectorAll('md-fab-menu-item')];
  assert.equal(items.length, 2);
  items.forEach((item, index) => {
    assert.equal(item.style.getPropertyValue('--_fab-menu-item-index'), String(index));
    assert.equal(item.getAttribute('role'), 'menuitem');
    shadow(item);
  });
});

test('grouped menus serialize inherited appearance and selected/mixed checkbox marks', async () => {
  const doc = await render('<md-menu open variant="vibrant" layout="grouped"><md-menu-item-group label="Kinds"><md-menu-item type="checkbox" selected headline="A"></md-menu-item><md-menu-item type="checkbox" indeterminate headline="B"></md-menu-item></md-menu-item-group></md-menu>');
  const menu = doc.querySelector('md-menu');
  assert.equal(menu.getAttribute('aria-hidden'), 'false');
  assert(!menu.hasAttribute('inert'));
  const group = doc.querySelector('md-menu-item-group');
  assert.equal(group.getAttribute('data-variant'), 'vibrant');
  assert.equal(group.getAttribute('aria-label'), 'Kinds');
  const items = [...doc.querySelectorAll('md-menu-item')];
  assert.deepEqual(items.map(item => item.getAttribute('aria-checked')), ['true', 'mixed']);
  items.forEach((item, index) => {
    assert.equal(item.getAttribute('data-variant'), 'vibrant');
    assert.equal(item.getAttribute('role'), 'menuitemcheckbox');
    assert.equal(shadow(item).querySelector('.md-menu-item__check').textContent.trim(), index === 0 ? 'check' : 'remove');
  });
});

test('breadcrumbs serialize collapsed middle and current page without changing documented entrances', async () => {
  const doc = await render('<md-breadcrumbs max-items="3"><md-breadcrumb-item href="/a">A</md-breadcrumb-item><md-breadcrumb-item href="/b">B</md-breadcrumb-item><md-breadcrumb-item href="/c">C</md-breadcrumb-item><md-breadcrumb-item href="/d">D</md-breadcrumb-item></md-breadcrumbs>');
  const crumbs = [...doc.querySelectorAll('md-breadcrumb-item')];
  assert.equal(crumbs.length, 4);
  assert.deepEqual(crumbs.map(item => item.hasAttribute('collapsed')), [false, true, false, false]);
  assert.deepEqual(crumbs.map(item => item.hasAttribute('current')), [false, false, false, true]);
  assert.equal(crumbs[1].getAttribute('aria-hidden'), 'true');
  assert.equal(shadow(crumbs[3]).querySelector('[aria-current]').getAttribute('aria-current'), 'page');
  assert.equal(shadow(doc.querySelector('md-breadcrumbs')).querySelector('[part="overflow-button"]').getAttribute('aria-expanded'), 'false');
});

for (const source of ['value', 'option']) {
  test(`select serializes the initial ${source} selection into the visible field and menu`, async () => {
    const doc = await render(`<md-select ${source === 'value' ? 'value="b"' : ''} label="Choice"><md-select-option value="a">Alpha</md-select-option><md-select-option value="b" ${source === 'option' ? 'selected' : ''}>Beta</md-select-option></md-select>`);
    assert.equal(deepAll(doc, 'input')[0].getAttribute('value'), 'Beta');
    assert.deepEqual(deepAll(doc, 'md-menu-item').map(item => item.getAttribute('aria-selected')), ['false', 'true']);
  });
}

test('multi-select serializes preselected options into count, chips and menu state', async () => {
  const doc = await render('<md-multi-select label="Choice"><md-select-option value="a" selected>Alpha</md-select-option><md-select-option value="b" selected>Beta</md-select-option><md-select-option value="c">Gamma</md-select-option></md-multi-select>');
  assert.equal(deepAll(doc, 'input')[0].getAttribute('value'), '2 selected');
  assert.deepEqual(deepAll(doc, 'md-chip').map(chip => chip.getAttribute('aria-label')), ['Alpha', 'Beta']);
  assert.deepEqual(deepAll(doc, 'md-menu-item').map(item => item.getAttribute('aria-selected')), ['true', 'true', 'false']);
});

test('autocomplete serializes a value as its label before client option synchronization', async () => {
  const doc = await render(`<md-autocomplete value="b" options='[{"value":"a","label":"Alpha"},{"value":"b","label":"Beta"}]'></md-autocomplete>`);
  assert.equal(deepAll(doc, 'input')[0].getAttribute('value'), 'Beta');
  assert.deepEqual(deepAll(doc, 'md-menu-item').map(item => item.getAttribute('aria-selected')), ['false', 'true']);
});

import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const TREE = [{
  id: 'root', name: 'Avery', title: 'Director',
  children: [
    { id: 'engineering', name: 'Blair', title: 'Engineering', children: [{ id: 'developer', name: 'Casey' }] },
    { id: 'operations', name: 'Devon', title: 'Operations', selectable: false },
  ],
}];

async function mount(page: E2EPage, attrs = '') {
  await page.setContent(`<md-organization-chart label="Project team" ${attrs}></md-organization-chart>`);
  const chart = await page.find('md-organization-chart');
  await chart.setProperty('nodes', TREE);
  await page.waitForChanges();
  return chart;
}

function focusState(page: E2EPage) {
  return page.evaluate(() => {
    const root = document.querySelector('md-organization-chart')!.shadowRoot!;
    return {
      focused: root.activeElement?.getAttribute('data-id'),
      tabbable: Array.from(root.querySelectorAll('[role="treeitem"][tabindex="0"]'), (item) => item.getAttribute('data-id')),
    };
  });
}

describe('md-organization-chart browser behavior', () => {
  it('renders hierarchy semantics and replaces removed nodes and the roving tab stop on a data update', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    expect((await page.find('md-organization-chart >>> [role="tree"]')).getAttribute('aria-label')).toBe('Project team');
    const hierarchy = await page.evaluate(() => Array.from(
      document.querySelector('md-organization-chart')!.shadowRoot!.querySelectorAll('[role="treeitem"]'),
      (item) => ['data-id', 'aria-level', 'aria-posinset', 'aria-setsize'].map((attr) => item.getAttribute(attr)),
    ));
    expect(hierarchy).toEqual([
      ['root', '1', '1', '1'], ['engineering', '2', '1', '2'],
      ['developer', '3', '1', '1'], ['operations', '2', '2', '2'],
    ]);
    await chart.setProperty('nodes', [{ id: 'replacement', name: 'New team', children: [{ id: 'new-child', name: 'New member' }], expanded: false }]);
    await page.waitForChanges();
    expect(await page.find('md-organization-chart >>> [data-id="root"]')).toBeNull();
    expect(await page.find('md-organization-chart >>> [data-id="new-child"]')).toBeNull();
    const replacement = await page.find('md-organization-chart >>> [data-id="replacement"]');
    expect(replacement.getAttribute('aria-expanded')).toBe('false');
    expect((await focusState(page)).tabbable).toEqual(['replacement']);
    await replacement.press('ArrowRight');
    await page.waitForChanges();
    expect((await page.find('md-organization-chart >>> [data-id="new-child"]')).textContent).toContain('New member');
  });

  it.each(['ltr', 'rtl'] as const)('moves real focus through the tree and expands and collapses with direction-aware keys (%s)', async (direction) => {
    const page = await newE2EPage();
    const chart = await mount(page, `dir="${direction}"`);
    const toggle = await chart.spyOnEvent('mdNodeToggle');
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    await (await page.find('md-organization-chart >>> [data-id="root"]')).press(forward);
    await page.waitForChanges();
    expect(await focusState(page)).toEqual({ focused: 'engineering', tabbable: ['engineering'] });
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect((await focusState(page)).focused).toBe('developer');
    await page.keyboard.press(backward);
    await page.waitForChanges();
    expect((await focusState(page)).focused).toBe('engineering');
    await page.keyboard.press(backward);
    await page.waitForChanges();
    expect(await page.find('md-organization-chart >>> [data-id="developer"]')).toBeNull();
    expect(toggle.lastEvent.detail).toEqual({ node: TREE[0].children[0], expanded: false });
    await page.keyboard.press(forward);
    await page.waitForChanges();
    expect(toggle.lastEvent.detail).toEqual({ node: TREE[0].children[0], expanded: true });
    expect(await page.find('md-organization-chart >>> [data-id="developer"]')).not.toBeNull();
    await page.keyboard.press('End');
    await page.waitForChanges();
    expect((await focusState(page)).focused).toBe('operations');
    await page.keyboard.press('Home');
    await page.waitForChanges();
    expect(await focusState(page)).toEqual({ focused: 'root', tabbable: ['root'] });
  });

  it('selects and deselects by pointer, reports node data, and marks only the selected ancestry', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'selection-mode="single"');
    const selection = await chart.spyOnEvent('mdSelectionChange');
    const card = await page.find('md-organization-chart >>> [data-id="developer"] > [part~="node"]');
    await card.click();
    await page.waitForChanges();
    expect(await chart.getProperty('selectedIds')).toEqual(['developer']);
    expect(selection.lastEvent.detail).toEqual({ node: TREE[0].children[0].children![0], selectedIds: ['developer'] });
    expect(await page.evaluate(() => Array.from(document.querySelector('md-organization-chart')!.shadowRoot!
      .querySelectorAll('[part~="branch-on-path"]'), (item) => item.getAttribute('data-id')))).toEqual(['root', 'engineering', 'developer']);
    expect((await page.find('md-organization-chart >>> [data-id="developer"]')).getAttribute('aria-selected')).toBe('true');
    await card.click();
    await page.waitForChanges();
    expect(await chart.getProperty('selectedIds')).toEqual([]);
    expect(selection).toHaveReceivedEventTimes(2);
    expect(await page.findAll('md-organization-chart >>> [part~="branch-on-path"]')).toHaveLength(0);
  });

  it('supports multiple keyboard selections, honors non-selectable nodes, and accepts controlled selection', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'selection-mode="multiple"');
    const selection = await chart.spyOnEvent('mdSelectionChange');
    expect((await page.find('md-organization-chart >>> [role="tree"]')).getAttribute('aria-multiselectable')).toBe('true');
    await (await page.find('md-organization-chart >>> [data-id="root"]')).press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(await chart.getProperty('selectedIds')).toEqual(['root', 'engineering']);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await chart.getProperty('selectedIds')).toEqual(['root', 'engineering']);
    expect(selection).toHaveReceivedEventTimes(2);
    expect((await page.find('md-organization-chart >>> [data-id="operations"]')).getAttribute('aria-selected')).toBeNull();

    await chart.setProperty('selectedIds', ['developer']);
    await page.waitForChanges();
    expect((await page.find('md-organization-chart >>> [data-id="root"]')).getAttribute('aria-selected')).toBe('false');
    expect((await page.find('md-organization-chart >>> [data-id="developer"]')).getAttribute('aria-selected')).toBe('true');
    expect(selection).toHaveReceivedEventTimes(2);
  });
});

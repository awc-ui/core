import { newE2EPage } from '@stencil/core/testing';

describe('md-breadcrumbs browser navigation', () => {
  const trail = `
    <md-breadcrumbs label="Project location" max-items="4" expand-label="Show all locations">
      <md-breadcrumb-item id="home" href="#home">Home</md-breadcrumb-item>
      <md-breadcrumb-item id="team" href="#team">Team</md-breadcrumb-item>
      <md-breadcrumb-item id="project" href="#project">Project</md-breadcrumb-item>
      <md-breadcrumb-item id="folder" href="#folder">Folder</md-breadcrumb-item>
      <md-breadcrumb-item id="docs" href="#docs">Docs</md-breadcrumb-item>
      <md-breadcrumb-item id="page">Page</md-breadcrumb-item>
    </md-breadcrumbs>`;

  it.each(['ltr', 'rtl'])('places overflow between the visible ends and expands by keyboard (%s)', async direction => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="${direction}">${trail}</div>`);
    await page.waitForChanges();
    const expansion = await page.spyOnEvent('mdExpand');
    const collapsed = await page.evaluate(() => {
      const host = document.querySelector('md-breadcrumbs')!;
      const overflow = host.shadowRoot!.querySelector<HTMLButtonElement>('[part="overflow-button"]')!;
      const center = (el: Element) => { const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
      return {
        label: host.getAttribute('aria-label'),
        visible: Array.from(host.children).filter(el => getComputedStyle(el).display !== 'none').map(el => el.id),
        hidden: document.getElementById('team')!.getAttribute('aria-hidden'),
        positions: [center(document.getElementById('home')!), center(overflow), center(document.getElementById('docs')!)],
        expandLabel: overflow.getAttribute('aria-label'),
      };
    });
    expect(collapsed.label).toBe('Project location');
    expect(collapsed.visible).toEqual(['home', 'docs', 'page']);
    expect(collapsed.hidden).toBe('true');
    expect(collapsed.expandLabel).toBe('Show all locations');
    const [first, overflow, last] = collapsed.positions;
    expect(overflow).toBeGreaterThan(Math.min(first, last));
    expect(overflow).toBeLessThan(Math.max(first, last));

    await page.evaluate(() => document.querySelector('md-breadcrumbs')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!.focus());
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(expansion).toHaveReceivedEventTimes(1);
    expect(expansion.lastEvent.detail).toEqual({ expanded: true, itemCount: 6 });
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('md-breadcrumb-item')).every(el =>
      getComputedStyle(el).display !== 'none' && !el.hasAttribute('aria-hidden') && !el.style.order,
    ))).toBe(true);
    expect(await page.find('md-breadcrumbs >>> [part="overflow-button"]')).toBeNull();

    const host = await page.find('md-breadcrumbs');
    await host.callMethod('collapse');
    await page.waitForChanges();
    expect(expansion.lastEvent.detail).toEqual({ expanded: false, itemCount: 6 });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('team')!).display)).toBe('none');
    await host.callMethod('collapse');
    await page.waitForChanges();
    expect(expansion).toHaveReceivedEventTimes(2);
  });

  it('reconfigures the visible window and can disable collapsing after mount', async () => {
    const page = await newE2EPage();
    await page.setContent(trail);
    await page.waitForChanges();
    const host = await page.find('md-breadcrumbs');
    await host.setProperty('itemsBeforeCollapse', 2);
    await host.setProperty('itemsAfterCollapse', 1);
    await page.waitForChanges();
    const visible = () => page.evaluate(() => Array.from(document.querySelectorAll('md-breadcrumb-item'))
      .filter(el => getComputedStyle(el).display !== 'none').map(el => el.id));
    expect(await visible()).toEqual(['home', 'team', 'page']);
    await host.setProperty('maxItems', 0);
    await page.waitForChanges();
    expect(await visible()).toEqual(['home', 'team', 'project', 'folder', 'docs', 'page']);
    expect(await page.find('md-breadcrumbs >>> [part="overflow-button"]')).toBeNull();
  });

  it('updates current-page semantics and item positions after removing the last crumb', async () => {
    const page = await newE2EPage();
    await page.setContent(trail);
    await page.waitForChanges();
    await page.evaluate(() => document.getElementById('page')!.remove());
    await page.waitForChanges();
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('md-breadcrumb-item')).map(el => ({
      id: el.id, index: el.itemIndex, total: el.itemTotal, current: el.current,
    })))).toEqual([
      { id: 'home', index: 0, total: 5, current: false },
      { id: 'team', index: 1, total: 5, current: false },
      { id: 'project', index: 2, total: 5, current: false },
      { id: 'folder', index: 3, total: 5, current: false },
      { id: 'docs', index: 4, total: 5, current: true },
    ]);
    const current = await page.find('#docs >>> [aria-current="page"]');
    expect(current).not.toBeNull();
    expect(await page.find('#docs >>> a')).toBeNull();
  });
});

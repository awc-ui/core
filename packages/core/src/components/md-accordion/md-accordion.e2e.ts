import { newE2EPage } from '@stencil/core/testing';

describe('md-accordion e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion>
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    const el = await page.find('md-accordion');
    expect(el).not.toBeNull();
    expect(el).toHaveClass('md-accordion--filled');
  });

  it('default-expanded opens the requested item on first paint', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion default-expanded="1">
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    await page.waitForChanges();
    const items = await page.findAll('md-accordion-item');
    expect(await items[0].getProperty('expanded')).toBe(false);
    expect(await items[1].getProperty('expanded')).toBe(true);
  });

  it('exclusive mode collapses siblings when a different item opens', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion exclusive default-expanded="0">
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    await page.waitForChanges();
    const items = await page.findAll('md-accordion-item');
    await items[1].callMethod('toggle');
    await page.waitForChanges();
    expect(await items[0].getProperty('expanded')).toBe(false);
    expect(await items[1].getProperty('expanded')).toBe(true);
  });

  it('keep-one-expanded auto-opens the first item', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion keep-one-expanded>
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    await page.waitForChanges();
    const items = await page.findAll('md-accordion-item');
    expect(await items[0].getProperty('expanded')).toBe(true);
    expect(await items[0].getProperty('collapsible')).toBe(false);
  });

  it('emits mdToggle with the toggled index and expanded-set', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion>
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    const accordion = await page.find('md-accordion');
    const spy = await accordion.spyOnEvent('mdToggle');
    const items = await page.findAll('md-accordion-item');
    await items[0].callMethod('toggle');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
    expect(spy).toHaveReceivedEventDetail({
      index: 0,
      expanded: true,
      expandedIndices: [0],
    });
  });

  it('roving focus moves with ArrowDown', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion>
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    const items = await page.findAll('md-accordion-item');
    await items[0].callMethod('focusHeader');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    // The active element on the page should now live inside item 1.
    const activeOwnerHeadline = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      // The header button lives in the item's shadow root, so its
      // ownerDocument's body contains the host. Walk back up to the
      // host element to read its `headline` prop.
      let node: Node | null = active;
      while (node) {
        if (node instanceof Element && node.tagName === 'MD-ACCORDION-ITEM') {
          return (node as Element).getAttribute('headline');
        }
        const root = (node.getRootNode && node.getRootNode()) as ShadowRoot | Document;
        const host = (root as ShadowRoot).host as Element | undefined;
        node = host ?? null;
      }
      return null;
    });
    expect(activeOwnerHeadline).toBe('B');
  });

  it('Alt+ArrowDown reorders items when reorderable is set', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion reorderable>
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
        <md-accordion-item headline="C">C</md-accordion-item>
      </md-accordion>
    `);
    const accordion = await page.find('md-accordion');
    const spy = await accordion.spyOnEvent('mdReorder');

    const itemsBefore = await page.findAll('md-accordion-item');
    await itemsBefore[0].callMethod('focusHeader');
    await page.keyboard.down('Alt');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Alt');
    await page.waitForChanges();

    const itemsAfter = await page.findAll('md-accordion-item');
    const headlines = await Promise.all(itemsAfter.map((it) => it.getProperty('headline')));
    expect(headlines).toEqual(['B', 'A', 'C']);
    expect(spy).toHaveReceivedEvent();
    expect(spy).toHaveReceivedEventDetail({
      from: 0,
      to: 1,
      order: [1, 0, 2],
    });
  });

  it('floating mode applies position + chassis-handle marker on first item', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion floating initial-x="40" initial-y="60">
        <md-accordion-item headline="A">A</md-accordion-item>
        <md-accordion-item headline="B">B</md-accordion-item>
      </md-accordion>
    `);
    await page.waitForChanges();
    const accordion = await page.find('md-accordion');
    expect(accordion).toHaveClass('md-accordion--floating');

    // Read the inline transform via the host's CSSStyleDeclaration.
    // Puppeteer's `getAttribute('style')` can return an empty string
    // even when Stencil has set the style via JSX `style={...}` — the
    // CSSOM property is the canonical source of truth.
    const transform = await page.evaluate(() => {
      const el = document.querySelector('md-accordion') as HTMLElement | null;
      return el?.style.transform ?? '';
    });
    // CSSOM normalises a bare `0` to `0px` on serialisation.
    expect(transform).toMatch(/translate3d\(40px, 60px, 0(px)?\)/);

    const items = await page.findAll('md-accordion-item');
    expect(items[0].getAttribute('data-chassis-handle')).not.toBeNull();
    expect(items[1].getAttribute('data-chassis-handle')).toBeNull();
  });

  it('region role policy reflects onto child items', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-accordion region="never">
        <md-accordion-item headline="A">A</md-accordion-item>
      </md-accordion>
    `);
    await page.waitForChanges();
    const item = await page.find('md-accordion-item');
    expect(await item.getProperty('regionRole')).toBe('group');
  });
});

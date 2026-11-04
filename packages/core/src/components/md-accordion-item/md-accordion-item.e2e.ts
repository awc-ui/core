import { newE2EPage } from '@stencil/core/testing';

describe('md-accordion-item e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account">Body</md-accordion-item>');
    const el = await page.find('md-accordion-item');
    expect(el).not.toBeNull();
  });

  it('clicking the header toggles expanded', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account">Body</md-accordion-item>');
    const el = await page.find('md-accordion-item');
    const header = await page.find('md-accordion-item >>> [part="header"]');
    await header.click();
    await page.waitForChanges();
    expect(await el.getProperty('expanded')).toBe(true);
  });

  it('Enter on the focused header toggles expanded', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account">Body</md-accordion-item>');
    const el = await page.find('md-accordion-item');
    await el.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await el.getProperty('expanded')).toBe(true);
  });

  it('disabled items do not toggle on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account" disabled>Body</md-accordion-item>');
    const el = await page.find('md-accordion-item');
    const header = await page.find('md-accordion-item >>> [part="header"]');
    await header.click();
    await page.waitForChanges();
    expect(await el.getProperty('expanded')).toBe(false);
  });

  it('aria-expanded mirrors the expanded prop after a real click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account">Body</md-accordion-item>');
    const header = await page.find('md-accordion-item >>> [part="header"]');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    await header.click();
    await page.waitForChanges();
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits mdItemToggle on toggle', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Account">Body</md-accordion-item>');
    const el = await page.find('md-accordion-item');
    const spy = await el.spyOnEvent('mdItemToggle');
    await el.callMethod('toggle');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
    expect(spy).toHaveReceivedEventDetail({ expanded: true, index: -1 });
  });
});

describe('md-accordion-item standalone lifecycle', () => {
  it('updates named slots and restores their fallbacks when authored content is removed', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-accordion-item headline="Fallback headline" icon="folder">
      <span slot="headline">Authored headline</span><span slot="leading-icon">Leading</span><span slot="trailing-icon">Trailing</span>Body
    </md-accordion-item>`);
    const assigned = () => page.$eval('md-accordion-item', el =>
      ['headline', 'leading-icon', 'trailing-icon'].map(name =>
        (el.shadowRoot!.querySelector(`slot[name="${name}"]`) as HTMLSlotElement)
          .assignedElements().map(node => node.textContent).join('')));
    expect(await assigned()).toEqual(['Authored headline', 'Leading', 'Trailing']);
    await page.$eval('md-accordion-item', el => {
      for (const child of Array.from(el.querySelectorAll('[slot]'))) child.remove();
    });
    await page.waitForChanges();
    expect(await assigned()).toEqual(['', '', '']);
    expect((await page.find('md-accordion-item >>> slot[name="headline"]')).textContent).toBe('Fallback headline');
    expect((await page.find('md-accordion-item >>> slot[name="leading-icon"]')).textContent.trim()).toBe('folder');
    expect(await page.find('md-accordion-item >>> slot[name="trailing-icon"] svg')).not.toBeNull();
    const item = await page.find('md-accordion-item');
    item.setProperty('icon', ''); await page.waitForChanges();
    expect(await page.find('md-accordion-item >>> [part="leading-icon"]')).toBeNull();
  });

  it('keeps drag-handle taps and nested keyboard events from toggling the header', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion reorderable transition="none"><md-accordion-item headline="Tools">Body</md-accordion-item><md-accordion-item headline="Other">Other</md-accordion-item></md-accordion>');
    const item = await page.find('md-accordion-item');
    const toggled = await item.spyOnEvent('mdItemToggle');
    await (await page.find('md-accordion-item >>> [part="drag-handle"]')).click();
    // An authored descendant can be keyboard-interactive; its event must not
    // activate the enclosing disclosure button as well.
    await page.$eval('md-accordion-item', el => {
      el.shadowRoot!.querySelector('[part="drag-handle"]')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    });
    await page.waitForChanges();
    expect(toggled).toHaveReceivedEventTimes(0);
    expect(await item.getProperty('expanded')).toBe(false);
    await item.callMethod('focusHeader'); await page.keyboard.press('Enter'); await page.waitForChanges();
    expect(toggled).toHaveReceivedEventDetail({ expanded: true, index: 0 });
    expect(toggled).toHaveReceivedEventTimes(1);
  });

  it('public toggle and keyboard activation respect disabled and locked-open states', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-accordion-item headline="Details" transition="none" heading-level="2">Body</md-accordion-item>');
    const item = await page.find('md-accordion-item'); const toggled = await item.spyOnEvent('mdItemToggle');
    await item.callMethod('toggle'); await page.waitForChanges();
    expect(toggled).toHaveReceivedEventTimes(1);
    item.setProperty('collapsible', false); await page.waitForChanges(); await (await page.find('md-accordion-item >>> [part="header"]')).click(); await page.waitForChanges();
    expect(await item.getProperty('expanded')).toBe(true);
    item.setProperty('collapsible', true); await page.waitForChanges(); await (await page.find('md-accordion-item >>> [part="header"]')).click(); await page.waitForChanges();
    expect(await item.getProperty('expanded')).toBe(false);
    item.setProperty('disabled', true); await page.waitForChanges(); await item.callMethod('toggle'); await page.waitForChanges();
    expect(await item.getProperty('expanded')).toBe(false);
    expect((await page.find('md-accordion-item >>> [part="header"]')).getAttribute('aria-expanded')).toBe('false');
  });
});

import { newE2EPage } from '@stencil/core/testing';

describe('md-breadcrumb-item browser navigation', () => {
  it('allows a delegated mdSelect listener to cancel real Enter-key link navigation', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="router"><md-breadcrumb-item href="#destination" item-index="1" item-total="3">Project docs</md-breadcrumb-item></div>');
    await page.waitForChanges();
    const selection = await page.spyOnEvent('mdSelect');
    const before = await page.evaluate(() => {
      document.getElementById('router')!.addEventListener('mdSelect', event => event.preventDefault());
      document.querySelector('md-breadcrumb-item')!.shadowRoot!.querySelector<HTMLAnchorElement>('a')!.focus();
      return location.href;
    });
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(selection).toHaveReceivedEventTimes(1);
    expect(selection.lastEvent.detail).toEqual(expect.objectContaining({
      href: '#destination', label: 'Project docs', current: false, itemIndex: 1, itemTotal: 3,
    }));
    expect(await page.evaluate(() => location.href)).toBe(before);
    expect(await page.evaluate(() => document.querySelector('md-breadcrumb-item')!.shadowRoot!.activeElement?.tagName)).toBe('A');
  });

  it('keeps current and disabled crumbs out of keyboard navigation, then restores a re-enabled link', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <button id="before">Before</button>
      <md-breadcrumb-item id="current" href="#current" current>Current</md-breadcrumb-item>
      <md-breadcrumb-item id="disabled" href="#disabled" disabled>Disabled</md-breadcrumb-item>
      <md-breadcrumb-item id="link" href="#link">Link</md-breadcrumb-item>
      <button id="after">After</button>`);
    await page.waitForChanges();
    expect(await page.find('#current >>> [aria-current="page"]')).not.toBeNull();
    expect(await page.find('#current >>> a')).toBeNull();
    expect(await page.find('#disabled >>> a')).toBeNull();
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('link');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');

    const disabled = await page.find('#disabled');
    await disabled.setProperty('disabled', false);
    await page.waitForChanges();
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('disabled');
    expect(await page.evaluate(() => document.getElementById('disabled')!.shadowRoot!.activeElement?.tagName)).toBe('A');
  });

  it('blocks script URLs on an actual click while preserving safe destinations and opener protection', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-breadcrumb-item href="javascript:document.body.dataset.unsafe='executed'">Unsafe</md-breadcrumb-item>`);
    await page.waitForChanges();
    const link = await page.find('md-breadcrumb-item >>> a');
    expect(link.getAttribute('href')).toBeNull();
    await link.click();
    expect(await page.evaluate(() => document.body.dataset.unsafe)).toBeUndefined();
    const item = await page.find('md-breadcrumb-item');
    await item.setProperty('href', 'https://example.com/docs');
    await item.setProperty('target', '_blank');
    await page.waitForChanges();
    const safe = await page.find('md-breadcrumb-item >>> a');
    expect(safe.getAttribute('href')).toBe('https://example.com/docs');
    expect(safe.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
  });
});

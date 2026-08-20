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

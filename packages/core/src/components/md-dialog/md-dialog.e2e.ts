import { newE2EPage } from '@stencil/core/testing';

describe('md-dialog e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-dialog headline="Test">Content</md-dialog>');
    const el = await page.find('md-dialog');
    expect(el).not.toBeNull();
  });

  it('opens and emits mdOpen', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-dialog headline="Test">Content</md-dialog>');
    const el = await page.find('md-dialog');
    const spy = await el.spyOnEvent('mdOpen');
    await el.callMethod('show');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
    expect(el).toHaveClass('md-dialog--open');
  });

  it('closes and emits mdClose', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-dialog open headline="Test">Content</md-dialog>');
    const el = await page.find('md-dialog');
    const spy = await el.spyOnEvent('mdClose');
    await el.callMethod('close');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });
});

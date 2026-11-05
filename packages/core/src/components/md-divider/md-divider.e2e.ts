import { newE2EPage } from '@stencil/core/testing';

describe('md-divider e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-divider></md-divider>');
    const el = await page.find('md-divider');
    expect(el).toBeTruthy();
  });

  it('updates separator orientation and supports independent logical insets', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-divider inset-start></md-divider>');
    const divider = await page.find('md-divider');
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(divider).toHaveClass('md-divider--inset-start');
    divider.setProperty('vertical', true);
    divider.setProperty('insetEnd', true);
    await page.waitForChanges();
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider).toHaveClass('md-divider--inset-end');
    divider.setProperty('vertical', false);
    divider.setProperty('inset', true);
    await page.waitForChanges();
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(divider).toHaveClass('md-divider--inset');
    expect(await page.find('md-divider >>> [part="divider"]')).not.toBeNull();
  });
});

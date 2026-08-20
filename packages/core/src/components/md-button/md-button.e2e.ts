import { newE2EPage } from '@stencil/core/testing';

describe('md-button e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-button>Click</md-button>');
    const el = await page.find('md-button');
    expect(el).not.toBeNull();
    expect(el).toHaveClass('md-button--filled');
  });

  it('fires mdClick on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-button>Click</md-button>');
    const el = await page.find('md-button');
    const spy = await el.spyOnEvent('mdClick');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  it('is keyboard accessible with Enter', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-button>Click</md-button>');
    const el = await page.find('md-button');
    const spy = await el.spyOnEvent('mdClick');
    await el.press('Enter');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });
});

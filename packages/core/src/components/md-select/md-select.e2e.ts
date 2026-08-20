import { newE2EPage } from '@stencil/core/testing';

describe('md-select e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-select label="Color"></md-select>');
    const el = await page.find('md-select');
    expect(el).not.toBeNull();
  });
});

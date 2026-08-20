import { newE2EPage } from '@stencil/core/testing';

describe('md-select-option e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-select-option value="red">Red</md-select-option>');
    const el = await page.find('md-select-option');
    expect(el).not.toBeNull();
  });
});

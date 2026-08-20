import { newE2EPage } from '@stencil/core/testing';

describe('md-snackbar e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-snackbar message="Hello world"></md-snackbar>');
    const el = await page.find('md-snackbar');
    expect(el).not.toBeNull();
  });

  it('opens via show() and emits nothing wrong', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-snackbar message="Hello" auto-hide="false"></md-snackbar>');
    const el = await page.find('md-snackbar');
    await el.callMethod('show');
    await page.waitForChanges();
    expect(el).toHaveClass('md-snackbar--open');
  });
});

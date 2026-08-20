import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

/** Panel bloom-out — keep in sync with `PANEL_BLOOM_OUT_MS` in tsx (+ buffer). */
const PANEL_CLOSE_MS = 250;

async function waitForPanelClose(page: E2EPage) {
  await new Promise((r) => setTimeout(r, PANEL_CLOSE_MS));
}

/** Non-blocking shadow query — `page.find` waits up to 45s for elements to appear. */
async function hasPickerPart(page: E2EPage, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    return !!document.querySelector('md-date-picker')?.shadowRoot?.querySelector(sel);
  }, selector);
}

async function clickPickerPart(page: E2EPage, selector: string) {
  await page.evaluate((sel) => {
    const el = document
      .querySelector('md-date-picker')
      ?.shadowRoot?.querySelector(sel) as HTMLElement | null;
    if (!el) return;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    el.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
  }, selector);
}

describe('md-date-picker (e2e)', () => {
  it('renders the trigger field by default', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-date-picker label="Date"></md-date-picker>');
    const el = await page.find('md-date-picker');
    expect(el).toHaveClass('hydrated');
    const field = await page.find('md-date-picker >>> [part="field"]');
    expect(field).not.toBeNull();
  });

  it('opens the dialog when the calendar button is clicked', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-date-picker value="2025-06-15"></md-date-picker>');
    const button = await page.find('md-date-picker >>> [part="calendar-button"]');
    await button.click();
    await page.waitForChanges();
    const panel = await page.find('md-date-picker >>> [part="panel"]');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
  });

  it('stages a docked day selection and commits on OK', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
    );
    const change = await page.spyOnEvent('mdChange');
    const cell = await page.find('md-date-picker >>> [data-date="2025-06-20"]');
    await cell.click();
    await page.waitForChanges();
    const ok = await page.find('md-date-picker >>> [part="ok-button"]');
    await ok.click();
    await waitForPanelClose(page);
    expect(change).toHaveReceivedEvent();
    const el = await page.find('md-date-picker');
    expect(el.getAttribute('value')).toBe('2025-06-20');
  });

  it('navigates months with the docked prev chevron', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
    );
    const prev = await page.find('md-date-picker >>> [part="prev-month-button"]');
    await prev.click();
    await page.waitForChanges();
    const monthLabel = await page.find('md-date-picker >>> [part="month-menu-button"]');
    expect(await monthLabel.getProperty('textContent')).toContain('Jul');
  });

  it('exposes docked month menu trigger semantics', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
    );
    const monthBtn = await page.find('md-date-picker >>> [part="month-menu-button"]');
    expect(monthBtn.getAttribute('aria-haspopup')).toBe('menu');
    expect(monthBtn.getAttribute('aria-expanded')).toBe('false');
    expect(await hasPickerPart(page, '[part="grid"]')).toBe(true);
  });

  it('commits on OK in the modal variant', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="modal" value="2025-06-15" open></md-date-picker>',
    );
    await new Promise((r) => setTimeout(r, PANEL_CLOSE_MS));
    expect(await hasPickerPart(page, '[data-date="2025-06-20"]')).toBe(true);
    await clickPickerPart(page, '[data-date="2025-06-20"]');
    await clickPickerPart(page, '[part="ok-button"]');
    await waitForPanelClose(page);
    const el = await page.find('md-date-picker');
    expect(el.getAttribute('value')).toBe('2025-06-20');
  });

  it('closes on Escape and emits mdCancel', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-date-picker value="2025-06-15" open></md-date-picker>');
    const cancel = await page.spyOnEvent('mdCancel');
    await page.keyboard.press('Escape');
    await waitForPanelClose(page);
    expect(cancel).toHaveReceivedEvent();
    expect(await hasPickerPart(page, '[part="panel"]')).toBe(false);
  });

  it('docked panel omits aria-modal', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
    );
    const panel = await page.find('md-date-picker >>> [part="panel"]');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBeNull();
  });
});

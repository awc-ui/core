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
  it.each([
    ['modal', 'md-date-picker-scale', 'md-date-picker-fade-in'],
    ['docked', 'md-date-picker-selection-bloom-in', null],
  ])('renders an authored open %s panel fully visible and animates show()', async (variant, panelAnimation, scrimAnimation) => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`
      <md-date-picker variant="${variant}" open value="2025-06-15"
        style="--md-sys-motion-duration-medium2: 10s; --md-sys-motion-duration-short3: 10s; --md-date-picker-selection-bloom-duration: 10s">
      </md-date-picker>
    `);
    const style = () => page.evaluate(() => {
      const root = document.querySelector('md-date-picker')!.shadowRoot!;
      const panel = getComputedStyle(root.querySelector('[part="panel"]')!);
      const scrim = root.querySelector('[part="scrim"]');
      return {
        panelAnimation: panel.animationName,
        panelOpacity: panel.opacity,
        scrimAnimation: scrim ? getComputedStyle(scrim).animationName : null,
        scrimOpacity: scrim ? getComputedStyle(scrim).opacity : null,
      };
    });
    expect(await style()).toEqual({
      panelAnimation: 'none', panelOpacity: '1',
      scrimAnimation: scrimAnimation ? 'none' : null, scrimOpacity: scrimAnimation ? '1' : null,
    });

    await page.evaluate(() => document.querySelector('md-date-picker')!.close());
    await page.waitForChanges();
    await page.evaluate(() => document.querySelector('md-date-picker')!.show());
    await page.waitForChanges();
    expect(await style()).toMatchObject({ panelAnimation, scrimAnimation });
  });

  it('renders the trigger field by default', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-date-picker label="Date"></md-date-picker>');
    const el = await page.find('md-date-picker');
    expect(el).toHaveClass('hydrated');
    const field = await page.find('md-date-picker >>> [part="field"]');
    expect(field).not.toBeNull();
  });

  it('opens and animates the dialog on the first calendar click', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent('<md-date-picker value="2025-06-15" style="--md-sys-motion-duration-medium2: 10s"></md-date-picker>');
    const button = await page.find('md-date-picker >>> [part="calendar-button"]');
    await button.click();
    await page.waitForChanges();
    const panel = await page.find('md-date-picker >>> [part="panel"]');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const animation = await page.evaluate(() => {
      const dialog = document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[part="panel"]')!;
      return getComputedStyle(dialog).animationName;
    });
    expect(animation).toBe('md-date-picker-scale');
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

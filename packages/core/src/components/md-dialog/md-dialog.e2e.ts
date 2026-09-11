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

  it.each([true, false])('focuses a color picker before later controls and traps both edges (direct slot: %s)', async (direct) => {
    const page = await newE2EPage();
    const fields = '<md-color-picker id="color" variant="inline" value="#206F81"></md-color-picker><md-switch id="theme" label="Dark theme"></md-switch>';
    await page.setContent(`
      <md-dialog headline="Appearance">
        ${direct ? fields : `<div>${fields}</div>`}
        <button id="done" slot="actions">Done</button>
      </md-dialog>
      <button id="outside">Outside</button>
    `);
    const dialog = await page.find('md-dialog');
    await dialog.callMethod('show');
    await page.waitForFunction(() => {
      const picker = document.querySelector('#color')!;
      return document.activeElement === picker && picker.shadowRoot!.activeElement?.getAttribute('part') === 'plate';
    });
    // The plate, hue control and color inputs remain separate keyboard stops.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => {
      const picker = document.querySelector('#color')!;
      return document.activeElement === picker && picker.shadowRoot!.activeElement?.getAttribute('part') === 'hue';
    })).toBe(true);

    await page.evaluate(() => (document.querySelector('#done') as HTMLElement).focus());
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#color')!.shadowRoot!.activeElement?.getAttribute('part'))).toBe('plate');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('done');
  });

  it.each(['ltr', 'rtl'])('keeps the mobile dialog frame fixed while focus scrolls a long form (%s)', async (dir) => {
    const page = await newE2EPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setContent(`
      <style>md-dialog::part(container) { transition: none; }</style>
      <md-dialog dir="${dir}" headline="Configure your team's shared research workspace" divider>
        <div style="display:grid;gap:24px">
          <md-text-field id="first" label="Workspace name"></md-text-field>
          <div style="height:900px">Additional setup details</div>
          <md-text-field id="last" label="Additional notes"></md-text-field>
        </div>
        <button id="cancel" slot="actions">Cancel</button>
        <button id="save" slot="actions">Save settings</button>
      </md-dialog>
    `);
    const dialog = await page.find('md-dialog');
    await dialog.callMethod('show');
    await page.waitForFunction(() => document.activeElement?.id === 'first');
    const before = await page.evaluate(() => {
      const root = document.querySelector('md-dialog')!.shadowRoot!;
      return {
        headerTop: root.querySelector('[part="header"]')!.getBoundingClientRect().top,
        actionsBottom: root.querySelector('[part="actions"]')!.getBoundingClientRect().bottom,
      };
    });
    // Native keyboard movement, rather than a synthetic call to the trap, must
    // reveal the final input without scrolling the frame/header out of view.
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.id === 'last');
    const after = await page.evaluate(() => {
      const root = document.querySelector('md-dialog')!.shadowRoot!;
      const content = root.querySelector('[part="content"]') as HTMLElement;
      const frame = root.querySelector('[part="container"]') as HTMLElement;
      const field = document.querySelector('#last')!.shadowRoot!.querySelector('input')!;
      const rect = field.getBoundingClientRect();
      const bodyRect = content.getBoundingClientRect();
      return {
        frameScroll: frame.scrollTop,
        bodyScroll: content.scrollTop,
        headerTop: root.querySelector('[part="header"]')!.getBoundingClientRect().top,
        actionsBottom: root.querySelector('[part="actions"]')!.getBoundingClientRect().bottom,
        fieldVisible: rect.top >= bodyRect.top && rect.bottom <= bodyRect.bottom,
      };
    });
    expect(after.frameScroll).toBe(0);
    expect(after.bodyScroll).toBeGreaterThan(0);
    expect(after.headerTop).toBeCloseTo(before.headerTop, 0);
    expect(after.actionsBottom).toBeCloseTo(before.actionsBottom, 0);
    expect(after.headerTop).toBeGreaterThanOrEqual(0);
    expect(after.actionsBottom).toBeLessThanOrEqual(844);
    expect(after.fieldVisible).toBe(true);
  });

});

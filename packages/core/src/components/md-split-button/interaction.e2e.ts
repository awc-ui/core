import { newE2EPage } from '@stencil/core/testing';

/**
 * Interaction coverage for md-split-button — leading activation, the trailing
 * toggle (state + event + reflected attribute + aria-expanded), keyboard
 * (Enter / Space) on both segments, and disabled / soft-disabled gating. These
 * exercise the pointer/keyboard handlers that jsdom specs can't drive.
 */
describe('md-split-button interaction', () => {
  const leadingSel = '#sb >>> .md-split-button__leading';
  const trailingSel = '#sb >>> .md-split-button__trailing';

  it('leading click emits mdLeadingClick', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save"></md-split-button>`);
    const lead = await page.spyOnEvent('mdLeadingClick');
    const trail = await page.spyOnEvent('mdTrailingClick');

    await (await page.find(leadingSel)).click();
    await page.waitForChanges();

    expect(lead).toHaveReceivedEventTimes(1);
    expect(trail).toHaveReceivedEventTimes(0);
  }, 60000);

  it('trailing click toggles state, reflects the attribute, flips aria-expanded, and emits checked', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save"></md-split-button>`);
    const trail = await page.spyOnEvent('mdTrailingClick');
    const host = await page.find('#sb');
    const trailingBtn = await page.find(trailingSel);

    expect(host).not.toHaveAttribute('trailing-checked');
    expect(trailingBtn.getAttribute('aria-expanded')).toBe('false');

    await trailingBtn.click();
    await page.waitForChanges();

    expect(host).toHaveAttribute('trailing-checked');
    expect((await page.find(trailingSel)).getAttribute('aria-expanded')).toBe('true');
    expect(trail).toHaveReceivedEventDetail({ checked: true });

    await (await page.find(trailingSel)).click();
    await page.waitForChanges();

    expect(await page.find('#sb')).not.toHaveAttribute('trailing-checked');
    expect(trail).toHaveReceivedEventTimes(2);
  }, 60000);

  it('keyboard: Enter on the leading button activates it', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save"></md-split-button>`);
    const lead = await page.spyOnEvent('mdLeadingClick');

    await page.evaluate(() =>
      (document.getElementById('sb')!.shadowRoot!.querySelector('.md-split-button__leading') as HTMLElement).focus(),
    );
    await page.keyboard.press('Enter');
    await page.waitForChanges();

    expect(lead).toHaveReceivedEventTimes(1);
  }, 60000);

  it('keyboard: Space on the trailing button toggles it', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save"></md-split-button>`);
    const trail = await page.spyOnEvent('mdTrailingClick');

    await page.evaluate(() =>
      (document.getElementById('sb')!.shadowRoot!.querySelector('.md-split-button__trailing') as HTMLElement).focus(),
    );
    await page.keyboard.press(' ');
    await page.waitForChanges();

    expect(await page.find('#sb')).toHaveAttribute('trailing-checked');
    expect(trail).toHaveReceivedEventDetail({ checked: true });
  }, 60000);

  it('disabled blocks both click and keyboard activation', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save" disabled></md-split-button>`);
    const lead = await page.spyOnEvent('mdLeadingClick');
    const trail = await page.spyOnEvent('mdTrailingClick');

    // pointer-events:none on disabled — click the host coordinates instead.
    await page.evaluate(() => {
      const root = document.getElementById('sb')!.shadowRoot!;
      (root.querySelector('.md-split-button__leading') as HTMLElement).click();
      (root.querySelector('.md-split-button__trailing') as HTMLElement).click();
    });
    await page.waitForChanges();

    expect(lead).toHaveReceivedEventTimes(0);
    expect(trail).toHaveReceivedEventTimes(0);
    expect(await page.find('#sb')).not.toHaveAttribute('trailing-checked');
  }, 60000);

  it('soft-disabled stays focusable but does not activate', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-split-button id="sb" label="Save" soft-disabled></md-split-button>`);
    const lead = await page.spyOnEvent('mdLeadingClick');

    const leading = await page.find(leadingSel);
    expect(leading.getAttribute('tabindex')).toBe('0');

    await leading.click();
    await page.waitForChanges();

    expect(lead).toHaveReceivedEventTimes(0);
  }, 60000);

  it('aria-haspopup / aria-controls wire the trailing button to a menu', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-split-button id="sb" label="Save" controls="menu-1" menu-label="More actions"></md-split-button>`,
    );
    const trailing = await page.find(trailingSel);
    expect(trailing.getAttribute('aria-haspopup')).toBe('menu');
    expect(trailing.getAttribute('aria-controls')).toBe('menu-1');
    expect(trailing.getAttribute('aria-label')).toBe('More actions');
  }, 60000);
});

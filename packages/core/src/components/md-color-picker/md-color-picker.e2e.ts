import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

describe('md-color-picker (e2e)', () => {
  it('renders inline with the saturation plate', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-color-picker value="#6750A4"></md-color-picker>');
    const el = await page.find('md-color-picker');
    expect(el).toHaveClass('hydrated');
    const plate = await page.find('md-color-picker >>> [part="plate"]');
    expect(plate).not.toBeNull();
    expect(plate.getAttribute('role')).toBe('application');
  });

  it('opens the popover panel on trigger click', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-color-picker variant="popover" value="#6750A4"><md-button slot="trigger">Pick</md-button></md-color-picker>',
    );
    const trigger = await page.find('md-color-picker [slot="trigger"]');
    await trigger.click();
    await page.waitForChanges();
    const dialog = await page.find('md-color-picker >>> [part="popover"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    const panel = await page.find('md-color-picker >>> [part="panel"]');
    expect(panel).not.toBeNull();
  });

  it('emits mdChange when a preset is selected', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-color-picker presets="#FF0000,#00FF00" value="#6750A4"></md-color-picker>',
    );
    const change = await page.spyOnEvent('mdChange');
    const preset = await page.find('md-color-picker >>> [part="preset"]');
    await preset.click();
    await page.waitForChanges();
    expect(change).toHaveReceivedEvent();
    const el = await page.find('md-color-picker');
    expect(el.getAttribute('value')).toBe('#FF0000');
  });

  it('closes the popover on Escape', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-color-picker variant="popover" open value="#6750A4"></md-color-picker>',
    );
    let dialog = await page.find('md-color-picker >>> [part="popover"]');
    expect(dialog).not.toBeNull();
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    dialog = await page.find('md-color-picker >>> [part="popover"]');
    expect(dialog).toBeNull();
    const el = await page.find('md-color-picker');
    expect(el.getAttribute('open')).toBeNull();
  });

  it('emits mdOpenChange when toggling the popover', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-color-picker variant="popover" value="#6750A4"></md-color-picker>',
    );
    const openChange = await page.spyOnEvent('mdOpenChange');
    const trigger = await page.find('md-color-picker >>> [part="trigger"]');
    await trigger.click();
    await page.waitForChanges();
    expect(openChange).toHaveReceivedEventDetail({ open: true });
    await trigger.click();
    await page.waitForChanges();
    expect(openChange).toHaveReceivedEventDetail({ open: false });
  });

  it('adjusts hue via keyboard on the slider', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-color-picker value="#FF0000"></md-color-picker>');
    const hue = await page.find('md-color-picker >>> [part="hue"]');
    const before = await hue.getProperty('ariaValueNow');
    await hue.press('ArrowRight');
    await page.waitForChanges();
    const after = await hue.getProperty('ariaValueNow');
    expect(after).not.toBe(before);
  });
});

import { newE2EPage } from '@stencil/core/testing';

describe('md-fab e2e', () => {
  it('renders with M3 Expressive defaults', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add"></md-fab>');
    const el = await page.find('md-fab');
    expect(el).not.toBeNull();
    expect(el).toHaveClass('md-fab--primary-container');
    expect(el).toHaveClass('md-fab--standard');
  });

  it('fires mdClick on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add"></md-fab>');
    const el = await page.find('md-fab');
    const spy = await el.spyOnEvent('mdClick');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  it('fires mdClick on Enter key', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add"></md-fab>');
    const el = await page.find('md-fab');
    const spy = await el.spyOnEvent('mdClick');
    await el.press('Enter');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  it('fires mdClick on Space key', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add"></md-fab>');
    const el = await page.find('md-fab');
    const spy = await el.spyOnEvent('mdClick');
    await el.press(' ');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  it('does not fire mdClick when disabled', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add" disabled></md-fab>');
    const el = await page.find('md-fab');
    const spy = await el.spyOnEvent('mdClick');
    await el.click();
    await page.waitForChanges();
    expect(spy).not.toHaveReceivedEvent();
  });

  it('renders as extended FAB with label', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add" label="Create"></md-fab>');
    const el = await page.find('md-fab');
    expect(el).toHaveClass('md-fab--extended');
    const label = await page.find('md-fab >>> .md-fab__label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Create');
  });

  it('applies lowered attribute', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-fab icon="add" lowered></md-fab>');
    const el = await page.find('md-fab');
    expect(el).toHaveClass('md-fab--lowered');
  });

  it('applies all variant classes', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-fab variant="primary-container" icon="add" id="pc"></md-fab>
      <md-fab variant="secondary-container" icon="add" id="sc"></md-fab>
      <md-fab variant="tertiary-container" icon="add" id="tc"></md-fab>
      <md-fab variant="primary" icon="add" id="p"></md-fab>
      <md-fab variant="secondary" icon="add" id="s"></md-fab>
      <md-fab variant="tertiary" icon="add" id="t"></md-fab>
    `);
    expect(await page.find('#pc')).toHaveClass('md-fab--primary-container');
    expect(await page.find('#sc')).toHaveClass('md-fab--secondary-container');
    expect(await page.find('#tc')).toHaveClass('md-fab--tertiary-container');
    expect(await page.find('#p')).toHaveClass('md-fab--primary');
    expect(await page.find('#s')).toHaveClass('md-fab--secondary');
    expect(await page.find('#t')).toHaveClass('md-fab--tertiary');
  });

  it('applies all size classes', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-fab size="standard" icon="add" id="standard"></md-fab>
      <md-fab size="medium" icon="add" id="medium"></md-fab>
      <md-fab size="large" icon="add" id="large"></md-fab>
    `);
    expect(await page.find('#standard')).toHaveClass('md-fab--standard');
    expect(await page.find('#medium')).toHaveClass('md-fab--medium');
    expect(await page.find('#large')).toHaveClass('md-fab--large');
  });
});

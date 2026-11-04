import { newE2EPage } from '@stencil/core/testing';

describe('md-chip browser selection and removal', () => {
  it('toggles through pointer and keyboard, exposes selection, and respects disabled states', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-chip variant="filter" color="success">Available</md-chip>');
    const chip = await page.find('md-chip');
    const selected = await chip.spyOnEvent('mdSelect');
    const clicked = await chip.spyOnEvent('mdClick');
    await chip.click();
    await page.waitForChanges();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(await page.find('md-chip >>> [part="checkmark"]')).not.toBeNull();
    await chip.focus();
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(selected.events.map(event => event.detail.selected)).toEqual([true, false, true]);
    for (const state of ['softDisabled', 'disabled']) {
      chip.setProperty(state, true);
      await page.waitForChanges();
      await chip.click();
      await page.keyboard.press('Enter');
      await page.waitForChanges();
      expect(chip.getAttribute('aria-disabled')).toBe('true');
      expect(selected.events).toHaveLength(3);
      expect(clicked.events).toHaveLength(3);
      chip.setProperty(state, false);
      await page.waitForChanges();
    }
    chip.setProperty('selectable', false);
    chip.setProperty('color', 'invalid role');
    chip.setProperty('elevated', true);
    await page.waitForChanges();
    await chip.click();
    await page.waitForChanges();
    expect(chip.getAttribute('aria-pressed')).toBeNull();
    expect(selected.events).toHaveLength(3);
    expect(clicked.events).toHaveLength(4);
    expect(await page.find('md-chip >>> [part="outline"]')).toBeNull();
  });

  it('allows consumers to cancel removal and removes on each documented keyboard action', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-chip id="cancelled" variant="input" label="Kept"></md-chip><md-chip id="delete" variant="input">Delete me</md-chip><md-chip id="backspace" variant="input">Backspace me</md-chip><md-chip id="enter" removable selectable="false">Enter</md-chip><md-chip id="space" removable selectable="false">Space</md-chip>');
    await page.$eval('#cancelled', el => el.addEventListener('mdRemove', event => event.preventDefault()));
    const kept = await page.find('#cancelled');
    const remove = await kept.spyOnEvent('mdRemove');
    const select = await kept.spyOnEvent('mdSelect');
    await (await page.find('#cancelled >>> [part="remove"]')).click();
    await page.waitForChanges();
    expect(remove).toHaveReceivedEventTimes(1);
    expect(select).toHaveReceivedEventTimes(0);
    expect(await page.find('#cancelled')).not.toBeNull();
    expect((await page.find('#cancelled >>> [part="remove"]')).getAttribute('aria-label')).toBe('Remove Kept');
    for (const [id, key] of [['delete', 'Delete'], ['backspace', 'Backspace'], ['enter', 'Enter'], ['space', 'Space']] as const) {
      const control = await page.find(`#${id} >>> [part="${id === 'delete' || id === 'backspace' ? 'primary' : 'remove'}"]`);
      await control.focus();
      await page.keyboard.press(key);
      await page.waitForChanges();
      expect(await page.find(`#${id}`)).toBeNull();
    }
    kept.setProperty('disabled', true);
    await page.waitForChanges();
    expect((await page.find('#cancelled >>> [part="remove"]')).getAttribute('disabled')).not.toBeNull();
  });

  it('reacts to dynamically assigned icons and supports opting out of input removal', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-chip variant="input" removable="false" label="Tag"></md-chip>');
    expect(await page.find('md-chip >>> [part="remove"]')).toBeNull();
    await page.$eval('md-chip', el => {
      for (const slot of ['leading-icon', 'trailing-icon']) {
        const icon = document.createElement('span');
        icon.slot = slot; icon.textContent = '★'; el.append(icon);
      }
    });
    await page.waitForChanges();
    const chip = await page.find('md-chip');
    expect(chip).toHaveClass('md-chip--with-leading-icon');
    expect(chip).toHaveClass('md-chip--with-trailing-icon');
    await page.$eval('md-chip', el => el.replaceChildren());
    await page.waitForChanges();
    expect(chip).not.toHaveClass('md-chip--with-leading-icon');
    expect(chip).not.toHaveClass('md-chip--with-trailing-icon');
  });
});

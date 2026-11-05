import { newE2EPage } from '@stencil/core/testing';

describe('md-icon-button e2e', () => {
  it('toggles with Enter and Space, clears press feedback, and blocks disabled activation', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="favorite_border" selected-icon="favorite" toggle aria-label="Favorite"></md-icon-button>');
    const button = await page.find('md-icon-button');
    const clicks = await button.spyOnEvent('mdClick');
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(await page.$eval('md-icon-button', el => el.shadowRoot!.querySelector('[part="selected-icon"]')!.classList.contains('md-icon-button__icon--on'))).toBe(true);
    await page.waitForFunction(() => !document.querySelector('md-icon-button')!.classList.contains('md-icon-button--pressed'));
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(clicks.events.map(event => event.detail.selected)).toEqual([true, false]);
    for (const state of ['softDisabled', 'disabled']) {
      button.setProperty(state, true);
      await page.waitForChanges();
      await button.click();
      await page.keyboard.press('Enter');
      await page.waitForChanges();
      expect(clicks).toHaveReceivedEventTimes(2);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      button.setProperty(state, false);
      await page.waitForChanges();
    }
    await page.keyboard.press('Escape');
    expect(clicks).toHaveReceivedEventTimes(2);
  });

  it('updates slotted icon layers without mistaking a badge or whitespace for an icon', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="mail" toggle aria-label="Messages">  <md-badge value="3"></md-badge>  </md-icon-button>');
    const button = await page.find('md-icon-button');
    expect(button).toHaveClass('md-icon-button--has-badge');
    expect((await page.find('md-icon-button >>> .md-icon-button__icon-font')).textContent).toBe('mail');
    await page.$eval('md-icon-button', el => {
      const icon = document.createElement('span'); icon.textContent = 'Inbox'; el.append(icon);
      const selected = document.createElement('span'); selected.slot = 'selected'; selected.textContent = 'Selected inbox'; el.append(selected);
    });
    await page.waitForChanges();
    expect(await page.find('md-icon-button >>> .md-icon-button__icon-font')).toBeNull();
    await button.click();
    await page.waitForChanges();
    expect(await page.$eval('md-icon-button', el => el.shadowRoot!.querySelector('[part="selected-icon"]')!.classList.contains('md-icon-button__icon--on'))).toBe(true);
    await page.$eval('md-icon-button', el => el.replaceChildren(document.createTextNode('Text icon')));
    await page.waitForChanges();
    expect(button).not.toHaveClass('md-icon-button--has-badge');
    expect(await page.$eval('md-icon-button', el => el.shadowRoot!.querySelector('[part="selected-icon"]')!.classList.contains('md-icon-button__icon--on'))).toBe(false);
    expect(await page.$eval('md-icon-button', el => el.shadowRoot!.querySelector('[part="icon"]')!.classList.contains('md-icon-button__icon--on'))).toBe(true);
    expect(await page.find('md-icon-button >>> .md-icon-button__icon-font')).toBeNull();
    await page.$eval('md-icon-button', el => el.replaceChildren(document.createTextNode('  ')));
    await page.waitForChanges();
    expect((await page.find('md-icon-button >>> .md-icon-button__icon-font')).textContent).toBe('mail');
  });
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="favorite"></md-icon-button>');
    const el = await page.find('md-icon-button');
    expect(el).not.toBeNull();
  });

  it('fires mdClick', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-icon-button icon="favorite"></md-icon-button>');
    const el = await page.find('md-icon-button');
    const spy = await el.spyOnEvent('mdClick');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });
});

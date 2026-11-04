import { newE2EPage } from '@stencil/core/testing';

describe('md-avatar browser identity and image fallback', () => {
  it('updates initials, accessible names, neutral colour and custom sizing', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-avatar name="Ada Lovelace" size="72"></md-avatar>');
    const avatar = await page.find('md-avatar');
    expect(avatar.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect((await page.find('md-avatar >>> [part="initials"]')).textContent).toBe('AL');
    expect(await page.$eval('md-avatar', el => el.getBoundingClientRect().width)).toBe(72);
    avatar.setProperty('name', 'Cher');
    avatar.setProperty('size', '4rem');
    avatar.setProperty('colorFromName', false);
    await page.waitForChanges();
    expect((await page.find('md-avatar >>> [part="initials"]')).textContent).toBe('C');
    expect(await page.$eval('md-avatar', el => el.getBoundingClientRect().width)).toBe(64);
    expect(avatar.className).not.toMatch(/palette-/);
    avatar.setProperty('initials', 'abcd');
    avatar.setProperty('label', 'Account owner');
    await page.waitForChanges();
    expect((await page.find('md-avatar >>> [part="initials"]')).textContent).toBe('ABC');
    expect(avatar.getAttribute('aria-label')).toBe('Account owner');
    avatar.setProperty('initials', '');
    avatar.setProperty('name', '');
    avatar.setProperty('label', '');
    avatar.setProperty('size', '');
    await page.waitForChanges();
    expect(avatar.getAttribute('role')).toBe('presentation');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(await page.find('md-avatar >>> slot')).not.toBeNull();
  });

  it('emits real image errors, falls back, and recovers after changing src', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-avatar name="Ada Lovelace" loading="eager"></md-avatar>');
    const avatar = await page.find('md-avatar');
    const errors = await avatar.spyOnEvent('mdError');
    const loads = await avatar.spyOnEvent('mdLoad');
    avatar.setProperty('src', 'data:image/png;base64,invalid');
    await page.waitForChanges();
    await page.waitForFunction(() => !!document.querySelector('md-avatar')?.shadowRoot?.querySelector('[part="initials"]'));
    expect(errors).toHaveReceivedEventTimes(1);
    expect((await page.find('md-avatar >>> [part="initials"]')).textContent).toBe('AL');
    avatar.setProperty('src', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"%3E%3Crect width="2" height="2" fill="red"/%3E%3C/svg%3E');
    avatar.setProperty('alt', 'Portrait');
    avatar.setProperty('crossorigin', 'anonymous');
    await page.waitForChanges();
    await page.waitForFunction(() => (document.querySelector('md-avatar')?.shadowRoot?.querySelector('img') as HTMLImageElement)?.naturalWidth === 2);
    expect(loads).toHaveReceivedEventTimes(1);
    expect((await page.find('md-avatar >>> img')).getAttribute('crossorigin')).toBe('anonymous');
    expect((await page.find('md-avatar')).getAttribute('aria-label')).toBe('Portrait');
  });
});

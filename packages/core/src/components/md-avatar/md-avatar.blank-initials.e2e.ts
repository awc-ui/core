import { newE2EPage } from '@stencil/core/testing';

// `initials` is documented as an override that applies only when non-empty. A
// whitespace-only value (set as a property, as frameworks do) must not suppress
// the name-derived initials or the name/label palette seed.
describe('md-avatar blank initials', () => {
  it('falls back to name-derived initials and palette when initials is whitespace only', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-avatar id="a"></md-avatar><md-avatar id="b" name="Ada Lovelace"></md-avatar>');
    await page.$eval('#a', (el: any) => { el.initials = '   '; el.name = 'Ada Lovelace'; });
    await page.waitForChanges();
    const state = (id: string) => page.$eval(id, (el: any) => ({
      text: el.shadowRoot.querySelector('[part="initials"]')?.textContent ?? null,
      bucket: [...el.classList].find((c: string) => c.startsWith('md-avatar--palette-')) ?? null,
    }));
    const blank = await state('#a'), named = await state('#b');
    expect(blank.text).toBe('AL');
    expect(blank.bucket).not.toBeNull();
    expect(blank.bucket).toBe(named.bucket);
  });

  it('seeds the palette from the label when initials and name are blank', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-avatar id="a"></md-avatar><md-avatar id="b" label="Account owner"></md-avatar>');
    await page.$eval('#a', (el: any) => { el.initials = ' '; el.name = ' '; el.label = 'Account owner'; });
    await page.waitForChanges();
    const bucket = (id: string) => page.$eval(id, (el: any) => [...el.classList].find((c: string) => c.startsWith('md-avatar--palette-')) ?? null);
    const blank = await bucket('#a');
    expect(blank).not.toBeNull();
    expect(blank).toBe(await bucket('#b'));
  });
});

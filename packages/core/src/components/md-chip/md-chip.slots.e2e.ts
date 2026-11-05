import { newE2EPage } from '@stencil/core/testing';

const AVATAR = '<svg slot="leading-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#7E57C2"/></svg>';
const TRAIL = '<svg slot="trailing-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" fill="currentColor"/></svg>';

describe('md-chip slotted icons', () => {
  it('detects leading and trailing slot content present at first render', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-chip id="lead" variant="input" label="Avatar">${AVATAR}</md-chip>` +
      `<md-chip id="trail" variant="assist" label="Trailing">${TRAIL}</md-chip>` +
      `<md-chip id="filter" variant="filter" selected label="Avatar filter">${AVATAR}</md-chip>`);
    await page.waitForChanges();
    const state = await page.$$eval('md-chip', chips => chips.map((el: any) => ({
      id: el.id, leading: el.classList.contains('md-chip--with-leading-icon'), trailing: el.classList.contains('md-chip--with-trailing-icon'),
      padding: [getComputedStyle(el).paddingLeft, getComputedStyle(el).paddingRight], checkmark: !!el.shadowRoot.querySelector('[part="checkmark"]'),
    })));
    expect(state).toEqual([
      { id: 'lead', leading: true, trailing: true, padding: ['8px', '8px'], checkmark: false },
      { id: 'trail', leading: false, trailing: true, padding: ['16px', '8px'], checkmark: false },
      // A slotted leading icon replaces the checkmark, as an `icon` does.
      { id: 'filter', leading: true, trailing: false, padding: ['8px', '16px'], checkmark: false },
    ]);
  });

  it('tracks slot content added and removed after first render', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-chip variant="assist" label="Late"></md-chip>');
    await page.$eval('md-chip', (el: any, svg: string) => el.insertAdjacentHTML('beforeend', svg), AVATAR);
    await page.waitForChanges();
    expect(await page.$eval('md-chip', el => getComputedStyle(el).paddingLeft)).toBe('8px');
    await page.$eval('md-chip', el => el.querySelector('svg')!.remove());
    await page.waitForChanges();
    expect(await page.$eval('md-chip', el => getComputedStyle(el).paddingLeft)).toBe('16px');
  });
});

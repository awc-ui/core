import { newE2EPage } from '@stencil/core/testing';

/* Authoring defects found at gate 1: the built-in search field could not take a space,
   and the trailing-action cap overrode an author's own `hidden`. */
describe('md-app-bar authoring', () => {
  it('types multi-word queries into the built-in search field', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-app-bar variant="search" search-placeholder="Search"></md-app-bar>`);
    await page.waitForChanges();
    const input = await page.spyOnEvent('mdSearchInput');
    const activate = await page.spyOnEvent('mdSearchActivate');
    await (await page.find('md-app-bar >>> input')).click();
    await page.keyboard.type('new york');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await page.evaluate(() => (document.querySelector('md-app-bar') as HTMLMdAppBarElement).searchValue)).toBe('new york');
    expect(input.lastEvent.detail).toEqual({ value: 'new york' });
    // Activation is announced on focus (value ''), on the typed Space (value 'new', read
    // before the character lands) and on Enter (value 'new york'). Spied events arrive
    // asynchronously, so assert their payloads rather than an instantaneous count.
    await page.waitForFunction(() => true);
    const values = activate.events.map(e => e.detail.value);
    expect(values).toContain('');
    expect(values.filter(v => v === 'new')).toHaveLength(1);
    expect(values[values.length - 1]).toBe('new york');
  });

  it('leaves an author-hidden trailing action hidden', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-app-bar headline="Inbox"><button slot="trailing" id="t1">1</button><button slot="trailing" id="t2" hidden>2</button></md-app-bar>`);
    await page.waitForChanges();
    expect(await page.evaluate(() => [document.getElementById('t1')!.hidden, document.getElementById('t2')!.hidden])).toEqual([false, true]);
  });

  it('counts only shown actions toward the three-action cap, and re-applies it when the author toggles hidden', async () => {
    const page = await newE2EPage();
    const warnings: string[] = [];
    page.on('console', m => { if (['warn', 'warning'].includes(m.type())) warnings.push(m.text()); });
    await page.setContent(`<md-app-bar headline="Inbox">${[1, 2, 3, 4].map(i => `<button slot="trailing" id="t${i}" ${i === 2 ? 'hidden' : ''}>${i}</button>`).join('')}</md-app-bar>`);
    await page.waitForChanges();
    const hidden = () => page.evaluate(() => [1, 2, 3, 4].map(i => document.getElementById(`t${i}`)!.hidden));
    expect(await hidden()).toEqual([false, true, false, false]);
    expect(warnings.filter(w => w.includes('[md-app-bar]'))).toHaveLength(0);
    // The author reveals the 2nd action: now four are shown, so the cap hides the 4th.
    await page.evaluate(() => { document.getElementById('t2')!.hidden = false; });
    await page.waitForChanges();
    expect(await hidden()).toEqual([false, false, false, true]);
    expect(warnings.filter(w => w.includes('[md-app-bar]'))).toHaveLength(1);
    // The author hides it again: the capped action comes back.
    await page.evaluate(() => { document.getElementById('t2')!.hidden = true; });
    await page.waitForChanges();
    expect(await hidden()).toEqual([false, true, false, false]);
  });

  it('sizes trailing actions with the trailing touch-target hook, apart from the leading one', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-app-bar headline="Inbox" leading-icon="menu" leading-icon-label="Menu"
      style="--md-app-bar-trailing-icon-touch-size: 40px">
      <md-icon-button slot="trailing" icon="more_vert" aria-label="More"></md-icon-button>
    </md-app-bar>`);
    await page.waitForChanges();
    const widths = await page.evaluate(() => {
      const bar = document.querySelector('md-app-bar')!;
      const lead = bar.shadowRoot!.querySelector('.md-app-bar__leading-button')!;
      return [lead.getBoundingClientRect().width, bar.querySelector('md-icon-button')!.getBoundingClientRect().width];
    });
    expect(widths).toEqual([48, 40]);
  });

  it.each(['medium', 'large'])('applies the expanded block-end padding hook on %s bars', async (variant) => {
    const page = await newE2EPage();
    await page.setContent(`<md-app-bar variant="${variant}" headline="Inbox" style="--md-app-bar-expanded-padding-block-end: 4px"></md-app-bar>`);
    await page.waitForChanges();
    expect(await page.evaluate(() => getComputedStyle(
      document.querySelector('md-app-bar')!.shadowRoot!.querySelector('.md-app-bar__expanded')!).paddingBottom)).toBe('4px');
  });
});

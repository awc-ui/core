import { newE2EPage } from '@stencil/core/testing';

// Gate-1 contract checks (native-parity source review, 2026-10-25).
const items = JSON.stringify([
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]);

describe('md-transfer-list contract', () => {
  it('emits only its own events: inner field, checkbox and mover events stay inside', async () => {
    const page = await newE2EPage({ html: `<md-transfer-list items='${items}'></md-transfer-list><button id="away">Away</button>` });
    await page.evaluate(() => {
      const host = document.querySelector('md-transfer-list')!;
      (window as any).seen = [];
      for (const name of ['mdChange', 'mdMove', 'mdInput', 'mdSearch', 'mdClear', 'mdClick', 'mdPasswordToggle', 'mdSpeechResult'])
        host.addEventListener(name, (e: any) => (window as any).seen.push({ name, source: (e.composedPath()[0] as Element).tagName, array: Array.isArray(e.detail) }));
    });
    await page.evaluate(() => (document.querySelector('md-transfer-list')!.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.type('Al'); await page.waitForChanges();
    await page.keyboard.press('Escape'); await page.waitForChanges(); // clears the internal-clearable field
    await page.click('#away'); await page.waitForChanges();
    await (await page.find('md-transfer-list >>> .md-transfer-list__select-all')).click(); await page.waitForChanges();
    const movers = await page.findAll('md-transfer-list >>> md-icon-button');
    await movers[1].click(); await page.waitForChanges();
    const seen = await page.evaluate(() => (window as any).seen);
    expect(seen).toEqual([
      { name: 'mdChange', source: 'MD-TRANSFER-LIST', array: true },
      { name: 'mdMove', source: 'MD-TRANSFER-LIST', array: false },
    ]);
    expect(await page.evaluate(() => (document.querySelector('md-transfer-list') as any).value)).toEqual(['a', 'b', 'c']);
  });

  it('rotates the movers in the stacked layout in both directions', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 500, height: 900 });
    await page.setContent(`<md-transfer-list id="host-rtl" dir="rtl" items='${items}'></md-transfer-list>
      <div dir="rtl"><md-transfer-list id="ancestor-rtl" items='${items}'></md-transfer-list></div>
      <md-transfer-list id="ltr" items='${items}'></md-transfer-list>`);
    const transforms = () => page.evaluate(() => Array.from(document.querySelectorAll('md-transfer-list')).map(list =>
      Array.from(list.shadowRoot!.querySelectorAll('.md-transfer-list__controls md-icon-button')).map(button => getComputedStyle(button).transform)));
    const rotated = 'matrix(0, 1, -1, 0, 0, 0)';
    for (const list of await transforms()) expect(list).toEqual([rotated, rotated, rotated, rotated]);
    await page.setViewport({ width: 1100, height: 900 });
    const mirrored = 'matrix(-1, 0, 0, 1, 0, 0)';
    expect(await transforms()).toEqual([
      [mirrored, mirrored, mirrored, mirrored],
      [mirrored, mirrored, mirrored, mirrored],
      ['none', 'none', 'none', 'none'],
    ]);
  });

  it('localises the select-all accessible names through select-all-label', async () => {
    const page = await newE2EPage({ html: `<md-transfer-list items='${items}'></md-transfer-list><md-transfer-list items='${items}'></md-transfer-list>` });
    // Attributes set from script so the non-ASCII text does not depend on the page's charset.
    await page.evaluate(() => {
      const localised = document.querySelectorAll('md-transfer-list')[1];
      localised.setAttribute('source-title', 'Opțiuni');
      localised.setAttribute('target-title', 'Alese');
      localised.setAttribute('select-all-label', 'Selectează tot: {title}');
    });
    await page.waitForChanges();
    const names = await page.evaluate(() => Array.from(document.querySelectorAll('md-transfer-list')).map(list =>
      Array.from(list.shadowRoot!.querySelectorAll('.md-transfer-list__select-all')).map(box => box.getAttribute('aria-label'))));
    expect(names).toEqual([
      ['Select all Choices', 'Select all Chosen'],
      ['Selectează tot: Opțiuni', 'Selectează tot: Alese'],
    ]);
  });

  it('drops checks for items that leave their side or the item pool', async () => {
    const page = await newE2EPage({ html: `<md-transfer-list items='${items}'></md-transfer-list>` });
    const rows = () => page.evaluate(() => Array.from(document.querySelector('md-transfer-list')!.shadowRoot!.querySelectorAll('[part="item"]'))
      .map(row => `${row.textContent!.trim()}:${row.getAttribute('aria-selected')}`));
    const options = await page.findAll('md-transfer-list >>> [part="item"]');
    await options[0].click(); await options[1].click(); await page.waitForChanges();
    expect(await rows()).toEqual(['Alpha:true', 'Beta:true', 'Gamma:false']);
    // Alpha leaves the source side programmatically, then comes back unchecked.
    await page.$eval('md-transfer-list', (el: any) => { el.value = ['a']; }); await page.waitForChanges();
    await page.$eval('md-transfer-list', (el: any) => { el.value = []; }); await page.waitForChanges();
    expect(await rows()).toEqual(['Alpha:false', 'Beta:true', 'Gamma:false']);
    // Beta leaves the pool, then is re-added unchecked.
    const pool = JSON.parse(items);
    await page.$eval('md-transfer-list', (el: any, next) => { el.items = next; }, pool.filter((item: any) => item.value !== 'b')); await page.waitForChanges();
    await page.$eval('md-transfer-list', (el: any, next) => { el.items = next; }, pool); await page.waitForChanges();
    expect(await rows()).toEqual(['Alpha:false', 'Beta:false', 'Gamma:false']);
    const count = await page.$eval('md-transfer-list', (el: any) => el.shadowRoot.querySelector('[part="count"]').textContent);
    expect(count).toBe('0/3 selected');
  });
  it('keeps the selected tint on a checked row while it has keyboard focus', async () => {
    // The row tints are color-mix()es of system tokens; e2e pages load no theme, so set the three used.
    const tokens = '<style>:root{--md-sys-color-primary:#6750A4;--md-sys-color-on-surface:#1C1B1F;--md-sys-color-secondary:#625B71}</style>';
    const page = await newE2EPage({ html: `${tokens}<md-transfer-list items='${items}'></md-transfer-list>` });
    const options = await page.findAll('md-transfer-list >>> [part="item"]');
    await options[0].click(); await options[1].click(); await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 250));
    const background = (index: number) => page.evaluate((i: number) =>
      getComputedStyle(document.querySelector('md-transfer-list')!.shadowRoot!.querySelectorAll('[part="item"]')[i]).backgroundColor, index);
    // Reference: a checked row under the pointer (Beta, still hovered after its click).
    const checkedHover = await background(1);
    await page.mouse.move(0, 0);
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); // keyboard focus → Alpha
    await new Promise(resolve => setTimeout(resolve, 250));
    const focusedRow = await page.evaluate(() => {
      const row = document.querySelector('md-transfer-list')!.shadowRoot!.activeElement as HTMLElement;
      return { text: row.textContent!.trim(), selected: row.getAttribute('aria-selected'), visible: row.matches(':focus-visible') };
    });
    expect(focusedRow).toEqual({ text: 'Alpha', selected: 'true', visible: true });
    const checkedFocus = await background(0);
    await page.keyboard.press(' '); await page.waitForChanges(); // uncheck, focus stays
    await new Promise(resolve => setTimeout(resolve, 250));
    const uncheckedFocus = await background(0);
    // Checked + focused composes like checked + hover (primary 12%); before the fix
    // the focus rule's neutral on-surface layer replaced the selected tint.
    expect(checkedFocus).toBe(checkedHover);
    expect(uncheckedFocus).not.toBe(checkedFocus);
  });
});

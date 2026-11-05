import { newE2EPage } from '@stencil/core/testing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `hidden` on an `<md-select-option>` removes it from the picker list, exactly
 * like `<option hidden>` in a native `<select>`: it is not rendered, not
 * reachable, not selectable and not part of "Select all". A hidden option that
 * is the current value still names the trigger (the native placeholder pattern
 * `<option value="" hidden selected>Choose…</option>`). Toggling `hidden` at
 * runtime re-reads the option set.
 */
const OPTIONS =
  '<md-select-option value="a">Alpha</md-select-option>' +
  '<md-select-option value="b" hidden>Bravo</md-select-option>' +
  '<md-select-option value="c">Charlie</md-select-option>';

/** Visible option rows rendered by a picker (deep, through nested shadow roots). */
const rowsOf = (tag: string) => {
  const host = document.querySelector(tag) as HTMLElement;
  const out: string[] = [];
  const walk = (root: ParentNode) =>
    root.querySelectorAll('*').forEach((n) => {
      const el = n as HTMLElement & { headline?: string };
      if (el.localName === 'md-menu-item' && el.getAttribute('role') === 'option' && el.getClientRects().length) {
        out.push((el.headline || el.textContent || '').trim());
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  walk(host.shadowRoot!);
  return out;
};

describe('md-select-option hidden', () => {
  it('md-select does not list a hidden option', async () => {
    const page = await newE2EPage({ html: `<md-select label="L">${OPTIONS}</md-select>` });
    await page.$eval('md-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-select')).toEqual(['Alpha', 'Charlie']);
  });

  it('md-select names the trigger with a hidden selected placeholder option', async () => {
    const page = await newE2EPage({
      html: '<md-select label="L"><md-select-option value="" hidden selected>Choose one</md-select-option><md-select-option value="a">Alpha</md-select-option></md-select>',
    });
    await page.waitForChanges();
    const shown = await page.$eval('md-select', (el: any) => (el.shadowRoot.querySelector('md-text-field') as any).value);
    expect(shown).toBe('Choose one');
    await page.$eval('md-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-select')).toEqual(['Alpha']);
  });

  it('md-multi-select neither lists nor "selects all" a hidden option', async () => {
    const page = await newE2EPage({ html: `<md-multi-select label="L" show-select-all>${OPTIONS}</md-multi-select>` });
    await page.$eval('md-multi-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-multi-select')).toEqual(['Alpha', 'Charlie']);
    const selectAll = await page.evaluateHandle(() => {
      const sr = (document.querySelector('md-multi-select') as HTMLElement).shadowRoot!;
      const host = sr.querySelector('[part~="select-all-item"],[part~="select-all"]') as HTMLElement;
      return host.localName === 'md-menu-item' ? host : (host.querySelector('md-menu-item') as HTMLElement) || host;
    });
    await (selectAll as any).click();
    await sleep(300);
    expect(await page.$eval('md-multi-select', (el: any) => el.value)).toEqual(['a', 'c']);
  });

  it('md-autocomplete does not suggest a hidden option', async () => {
    const page = await newE2EPage({
      html: '<md-autocomplete label="L"><md-select-option value="a">Alpha</md-select-option><md-select-option value="b" hidden>Alto</md-select-option></md-autocomplete>',
    });
    await page.$eval('md-autocomplete', (el: any) => el.focusInput());
    await page.keyboard.type('al');
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-autocomplete')).toEqual(['Alpha']);
  });

  it('re-reads the option set when hidden is toggled at runtime', async () => {
    const page = await newE2EPage({
      html: '<md-select label="L"><md-select-option value="a">Alpha</md-select-option><md-select-option value="c">Charlie</md-select-option></md-select>',
    });
    await page.$eval('md-select-option[value="c"]', (el: HTMLElement) => (el.hidden = true));
    await sleep(200);
    await page.$eval('md-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-select')).toEqual(['Alpha']);
    await page.$eval('md-select', (el: any) => el.close());
    await sleep(400);
    await page.$eval('md-select-option[value="c"]', (el: HTMLElement) => (el.hidden = false));
    await sleep(200);
    await page.$eval('md-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-select')).toEqual(['Alpha', 'Charlie']);
  });
});

describe('md-select-option text content', () => {
  it('a change to the slotted label text updates the trigger and the row', async () => {
    const page = await newE2EPage({
      html: '<md-select label="L" value="a"><md-select-option value="a">Alpha</md-select-option><md-select-option value="c">Charlie</md-select-option></md-select>',
    });
    await page.$eval('md-select-option[value="a"]', (el: HTMLElement) => (el.textContent = 'Alpha renamed'));
    await sleep(300);
    const shown = await page.$eval('md-select', (el: any) => (el.shadowRoot.querySelector('md-text-field') as any).value);
    expect(shown).toBe('Alpha renamed');
    await page.$eval('md-select', (el: any) => el.show());
    await sleep(500);
    expect(await page.evaluate(rowsOf, 'md-select')).toEqual(['Alpha renamed', 'Charlie']);
  });
});

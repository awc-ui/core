import { newE2EPage } from '@stencil/core/testing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OPTS = '<md-select-option value="a">Apple</md-select-option><md-select-option value="b">Banana</md-select-option>';
const AC = `options='[{"value":"a","label":"Apple"}]'`;

/** Deep active element, e.g. "md-select>md-text-field>input". */
const deepActive = () => {
  let a: Element | null = document.activeElement;
  const out: string[] = [];
  while (a) {
    out.push(a.localName);
    a = (a as HTMLElement).shadowRoot?.activeElement ?? null;
  }
  return out.join('>');
};

/**
 * Clicking a picker's clear (✕) button focuses that button, and the button
 * unmounts once the value is empty. Focus has to go back to the trigger
 * input. Before, it fell to <body>: md-select never moved it, and
 * md-multi-select / md-autocomplete called `host.focus()` on the field, which
 * is a no-op with delegatesFocus while focus is already inside the host (the
 * button is slotted into the field).
 */
describe('picker clear button focus', () => {
  const cases: Array<[string, string, string, unknown]> = [
    ['md-select', `<md-select label="Fruit" clearable value="a">${OPTS}</md-select>`, '', ''],
    ['md-multi-select', `<md-multi-select label="Fruit" clearable>${OPTS}</md-multi-select>`, 'multi', []],
    ['md-autocomplete', `<md-autocomplete label="Fruit" value="a" ${AC}></md-autocomplete>`, '', ''],
    ['md-autocomplete', `<md-autocomplete label="Fruit" multiple ${AC}></md-autocomplete>`, 'multi', []],
  ];
  for (const [tag, html, mode, empty] of cases) {
    it(`${tag}${mode ? ' (array value)' : ''} returns focus to the trigger input`, async () => {
      const page = await newE2EPage({ html });
      if (mode) await page.$eval(tag, (el: any) => { el.value = ['a']; });
      await page.waitForChanges();
      await sleep(300);
      const box = await page.$eval(tag, (el: any) => {
        const r = el.shadowRoot.querySelector('[part~="clear"]').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await sleep(400);
      expect(await page.$eval(tag, (el: any) => el.value)).toEqual(empty);
      expect(await page.evaluate(deepActive)).toBe(`${tag}>md-text-field>input`);
    });
  }
});

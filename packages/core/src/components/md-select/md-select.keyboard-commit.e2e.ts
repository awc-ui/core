import { newE2EPage } from '@stencil/core/testing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OPTS =
  '<md-select-option value="a">Apple</md-select-option>' +
  '<md-select-option value="b">Banana</md-select-option>' +
  '<md-select-option value="c">Cherry</md-select-option>';

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
 * Committing an option from the keyboard closes the menu, exactly like a
 * click. Before, the Enter / Space keydown that picked the row bubbled on to
 * the md-select host after the pick had closed the menu, where the trigger's
 * "Enter / Space opens" rule reopened it: the value changed but the menu
 * stayed open, focus jumped to the first row and no mdClose fired.
 */
describe('md-select keyboard commit', () => {
  for (const [k, label] of [['Enter', 'Enter'], ['Space', 'Space']] as const) {
    it(`${label} on a row picks it and closes`, async () => {
      const page = await newE2EPage({ html: `<button id="before">before</button><md-select label="Fruit">${OPTS}</md-select>` });
      const events: string[] = [];
      await page.exposeFunction('rec', (s: string) => events.push(s));
      await page.$eval('md-select', (el: any) => {
        for (const n of ['mdOpen', 'mdClose', 'mdChange']) {
          el.addEventListener(n, (e: CustomEvent) => (window as any).rec(n + (e.detail != null ? `:${e.detail}` : '')));
        }
      });
      await page.focus('#before');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown'); // opens on Apple
      await sleep(500);
      await page.keyboard.press('ArrowDown'); // Banana
      await sleep(150);
      await page.keyboard.press(k);
      await sleep(600);
      const state = await page.$eval('md-select', (el: any) => ({ open: el.open, value: el.value }));
      expect(state).toEqual({ open: false, value: 'b' });
      expect(await page.evaluate(deepActive)).toBe('md-select>md-text-field>input');
      expect(events).toEqual(['mdOpen', 'mdChange:b', 'mdClose']);
    });
  }

  it('Enter on the trigger still opens', async () => {
    const page = await newE2EPage({ html: `<button id="before">before</button><md-select label="Fruit">${OPTS}</md-select>` });
    await page.focus('#before');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await sleep(500);
    expect(await page.$eval('md-select', (el: any) => el.open)).toBe(true);
  });
});

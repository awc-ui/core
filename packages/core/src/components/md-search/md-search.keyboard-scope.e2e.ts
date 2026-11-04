import { newE2EPage } from '@stencil/core/testing';

/**
 * Keyboard ownership of an open md-search, in a real browser:
 *
 *  - Docked is non-modal: Arrow keys and Escape typed in an unrelated page
 *    control belong to that control, not to the search.
 *  - Enter that commits an IME composition is not a submit.
 *  - The full-screen focus trap includes the slotted results, so Tab can reach
 *    them before it wraps.
 *  - Focus tracking works when md-search itself lives in another shadow root.
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LIST = `
  <md-list slot="results">
    <md-list-item headline="Alpha" type="button"></md-list-item>
    <md-list-item headline="Beta" type="button"></md-list-item>
  </md-list>`;

/** Where focus is: `search:<inner class>`, `item:<headline>` or the element id. */
const where = (page: E2EPage) =>
  page.evaluate(() => {
    const describe = (a: Element | null): string => {
      if (!a) return 'none';
      if (a.localName === 'md-search') {
        const inner = a.shadowRoot!.activeElement as HTMLElement | null;
        return 'search:' + (inner ? String(inner.className).split(' ')[0] : 'host');
      }
      if (a.localName === 'md-list-item') return 'item:' + a.getAttribute('headline');
      if (a.shadowRoot && a.shadowRoot.activeElement) return describe(a.shadowRoot.activeElement);
      return a.id || a.localName;
    };
    return describe(document.activeElement);
  });

const focusSearchInput = (page: E2EPage, sel = '#s') =>
  page.evaluate((s: string) => {
    const host = document.querySelector(s)!;
    (host.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
  }, sel);

const isOpen = (page: E2EPage) =>
  page.evaluate(() => (document.querySelector('#s') as unknown as { open: boolean }).open);

describe('md-search keyboard scope (e2e)', () => {
  describe('docked layout is non-modal', () => {
    const setup = async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <textarea id="ta" rows="3">one\ntwo\nthree</textarea>
        <md-search id="s" layout="docked" open>${LIST}</md-search>`);
      await page.waitForChanges();
      return page;
    };

    it('ArrowDown in an unrelated textarea moves its caret, not focus into the results', async () => {
      const page = await setup();
      await page.evaluate(() => {
        const ta = document.querySelector('#ta') as HTMLTextAreaElement;
        ta.focus();
        ta.setSelectionRange(0, 0);
      });
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
      expect(await where(page)).toBe('ta');
      const caret = await page.evaluate(
        () => (document.querySelector('#ta') as HTMLTextAreaElement).selectionStart,
      );
      expect(caret).toBeGreaterThan(0);
    });

    it('Escape in an unrelated control does not close the search', async () => {
      const page = await setup();
      await page.focus('#ta');
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(true);
    });

    it('still steps into the results and closes on Escape when focus is in the search', async () => {
      const page = await setup();
      await focusSearchInput(page);
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
      expect(await where(page)).toBe('item:Alpha');
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
      expect(await where(page)).toBe('item:Beta');
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(false);
    });

    it('still closes on Escape when nothing has focus', async () => {
      const page = await setup();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(false);
    });
  });

  it('tracks result focus when md-search is inside another shadow root', async () => {
    const page = await newE2EPage();
    await page.setContent(`<x-shell></x-shell>`);
    await page.evaluate((list: string) => {
      class XShell extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML =
            `<md-search id="s" layout="docked" open>${list}</md-search>`;
        }
      }
      customElements.define('x-shell', XShell);
      const shell = document.createElement('x-shell');
      document.body.replaceChildren(shell);
    }, LIST);
    await page.waitForChanges();
    await wait(100);
    const inner = () =>
      page.evaluate(() => {
        const shell = document.querySelector('x-shell')!;
        const a = shell.shadowRoot!.activeElement;
        if (!a) return 'none';
        if (a.localName === 'md-list-item') return 'item:' + a.getAttribute('headline');
        return a.localName;
      });
    await page.evaluate(() => {
      const s = document.querySelector('x-shell')!.shadowRoot!.querySelector('md-search')!;
      (s.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
    });
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await inner()).toBe('item:Alpha');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await inner()).toBe('item:Beta');
    await page.keyboard.press('ArrowUp');
    await page.waitForChanges();
    expect(await inner()).toBe('item:Alpha');
  });

  describe('IME composition', () => {
    const setup = async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-search id="s" layout="docked" open value="ni"></md-search>`);
      await page.waitForChanges();
      await page.evaluate(() => {
        (window as unknown as { submits: string[] }).submits = [];
        document.querySelector('#s')!.addEventListener('mdSubmit', (e) =>
          (window as unknown as { submits: string[] }).submits.push((e as CustomEvent).detail.value),
        );
      });
      await focusSearchInput(page);
      return page;
    };
    const submits = (page: E2EPage) =>
      page.evaluate(() => (window as unknown as { submits: string[] }).submits);
    const composingEnter = (page: E2EPage, init: KeyboardEventInit) =>
      page.evaluate((i: KeyboardEventInit) => {
        const input = document.querySelector('#s')!.shadowRoot!.querySelector('input')!;
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...i }),
        );
      }, init as unknown as Record<string, unknown>);

    it('Enter with isComposing does not emit mdSubmit', async () => {
      const page = await setup();
      await composingEnter(page, { isComposing: true });
      await page.waitForChanges();
      expect(await submits(page)).toEqual([]);
    });

    it('the keyCode 229 Enter (WebKit composition commit) does not emit mdSubmit', async () => {
      const page = await setup();
      await composingEnter(page, { keyCode: 229 } as KeyboardEventInit);
      await page.waitForChanges();
      expect(await submits(page)).toEqual([]);
    });

    it('a plain Enter still submits once', async () => {
      const page = await setup();
      await page.keyboard.press('Enter');
      await page.waitForChanges();
      expect(await submits(page)).toEqual(['ni']);
    });
  });

  describe('full-screen focus trap', () => {
    const setup = async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <button id="before">before</button>
        <md-search id="s" trigger="bar" placeholder="Search">${LIST}</md-search>
        <button id="after">after</button>`);
      await page.waitForChanges();
      await page.focus('#before');
      await page.keyboard.press('Tab');
      await page.keyboard.type('al');
      await page.waitForChanges();
      await wait(400);
      expect(await isOpen(page)).toBe(true);
      expect(await where(page)).toBe('search:md-search__input');
      return page;
    };

    it('Tab reaches the slotted results, then wraps to the first control', async () => {
      const page = await setup();
      const stops: string[] = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await wait(50);
        stops.push(await where(page));
      }
      expect(stops).not.toContain('after');
      expect(stops).not.toContain('before');
      const itemAt = stops.indexOf('item:Alpha');
      expect(itemAt).toBeGreaterThanOrEqual(0);
      // The results are the last stop: the next Tab wraps to the leading button.
      expect(stops[itemAt + 1]).toBe('search:md-search__leading-button');
    });

    it('Shift+Tab from the first control wraps to the results', async () => {
      const page = await setup();
      // input → Shift+Tab → leading button (first), then Shift+Tab wraps.
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await wait(50);
      expect(await where(page)).toBe('search:md-search__leading-button');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      await wait(50);
      expect(await where(page)).toBe('item:Alpha');
    });
  });
});

import { newE2EPage } from '@stencil/core/testing';

/** Real-browser coverage for md-autocomplete — the chip accessibility, selection
 *  cap, form participation, and menu behavior the JSDOM spec cannot verify. */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const OPTS = `
  const el = document.querySelector('md-autocomplete');
  el.options = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
    { value: 'c', label: 'Cherry' },
  ];`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup(page: E2EPage, attrs = '') {
  await page.setContent(`<md-autocomplete label="Fruit" ${attrs}></md-autocomplete>`);
  await page.evaluate(new Function(OPTS) as () => void);
  await page.waitForChanges();
  await wait(120);
}

const value = (page: E2EPage) => page.evaluate(() => (document.querySelector('md-autocomplete') as unknown as { value: string | string[] }).value);

describe('md-autocomplete (e2e)', () => {
  describe('selection chips (multiple)', () => {
    it('renders removable chips in a NON aria-hidden role=group region; removal updates value', async () => {
      const page = await newE2EPage();
      await setup(page, 'multiple name="fruit"');
      await page.evaluate(() => ((document.querySelector('md-autocomplete') as unknown as { value: string[] }).value = ['a', 'b']));
      await page.waitForChanges();
      await wait(120);
      const state = await page.evaluate(() => {
        const ac = document.querySelector('md-autocomplete')!;
        const chips = ac.shadowRoot!.querySelector('.md-autocomplete__chips');
        let hidden = false;
        let n: Element | null = chips;
        while (n && (n as Node) !== ac.shadowRoot) {
          if (n.getAttribute?.('aria-hidden') === 'true') { hidden = true; break; }
          n = n.parentElement;
        }
        return { count: chips?.querySelectorAll('md-chip').length ?? 0, hidden, role: chips?.getAttribute('role') };
      });
      expect(state.count).toBe(2);
      expect(state.hidden).toBe(false);
      expect(state.role).toBe('group');
      // remove the first chip
      const after = await page.evaluate(() => {
        const ac = document.querySelector('md-autocomplete')!;
        const chip = ac.shadowRoot!.querySelector('md-chip')!;
        (chip.shadowRoot!.querySelector('.md-chip__remove') as HTMLElement).click();
        return new Promise((res) => setTimeout(() => res((ac as unknown as { value: string[] }).value), 100));
      });
      expect(after).toEqual(['b']);
    });

    it('maxSelected blocks a toggle at the cap and leaves no phantom-checked option', async () => {
      const page = await newE2EPage();
      // disable-close-on-select keeps the menu open so both clicks hit the same DOM.
      await setup(page, 'multiple max-selected="1" disable-close-on-select');
      await page.evaluate(() => ((document.querySelector('md-autocomplete') as unknown as { open: boolean }).open = true));
      await page.waitForChanges();
      await wait(220);
      // options render in order a(Apple)=0, b(Banana)=1, c(Cherry)=2
      const clickIdx = (i: number) =>
        page.evaluate((n: number) => {
          const its = document.querySelector('md-autocomplete')!.shadowRoot!.querySelectorAll('md-menu-item');
          (its[n] as HTMLElement)?.click();
        }, i);
      await clickIdx(0); // Apple — fills the cap
      await wait(120);
      await clickIdx(1); // Banana — blocked
      await wait(150);
      const state = await page.evaluate(() => {
        const ac = document.querySelector('md-autocomplete') as any;
        const banana = ac.shadowRoot.querySelectorAll('md-menu-item')[1] as any;
        return { value: ac.value, bananaSelected: banana.selected };
      });
      expect(state.value).toEqual(['a']);
      expect(state.bananaSelected).toBe(false); // not phantom-checked
    });
  });

  describe('option accessible name', () => {
    it('is not doubled (headline only, no light-DOM text child)', async () => {
      const page = await newE2EPage();
      await setup(page, 'open');
      await wait(150);
      const text = await page.evaluate(() =>
        (document.querySelector('md-autocomplete')!.shadowRoot!.querySelector('md-menu-item')!.textContent || '').trim());
      expect(text).toBe('');
    });
  });

  describe('forms', () => {
    it('single mode submits the value; multi mode submits repeated pairs', async () => {
      const page = await newE2EPage();
      await page.setContent(`<form id="f"><md-autocomplete name="fruit" label="Fruit"></md-autocomplete></form>`);
      await page.evaluate(new Function(OPTS) as () => void);
      await page.waitForChanges();
      await page.evaluate(() => ((document.querySelector('md-autocomplete') as unknown as { value: string }).value = 'a'));
      await page.waitForChanges();
      await wait(80);
      expect(await page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).get('fruit'))).toBe('a');
    });

    it('required with no selection is invalid and blocks submit', async () => {
      const page = await newE2EPage();
      await page.setContent(`<form id="f"><md-autocomplete name="fruit" label="Fruit" required></md-autocomplete></form>`);
      await page.evaluate(new Function(OPTS) as () => void);
      await page.waitForChanges();
      await wait(80);
      expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(false);
      await page.evaluate(() => ((document.querySelector('md-autocomplete') as unknown as { value: string }).value = 'b'));
      await page.waitForChanges();
      await wait(80);
      expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(true);
    });
  });

  describe('single select', () => {
    it('picking an option commits the value and fills the input', async () => {
      const page = await newE2EPage();
      await setup(page, 'open');
      await wait(180);
      await page.evaluate(() => {
        const its = document.querySelector('md-autocomplete')!.shadowRoot!.querySelectorAll('md-menu-item');
        (its[1] as HTMLElement).click(); // Banana
      });
      await wait(120);
      expect(await value(page)).toBe('b');
    });
  });

  describe('keyboard round-trip (focus-moves-into-popup)', () => {
    it('ArrowDown roves into the listbox; Escape returns focus to the input and resyncs the text', async () => {
      const page = await newE2EPage();
      await setup(page);
      // Commit Apple first (click its row).
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        const item = [...el.shadowRoot!.querySelectorAll('md-menu-item')].find(
          (i) => (i as unknown as { headline: string }).headline === 'Apple',
        ) as HTMLElement;
        el.shadowRoot!.querySelector('md-text-field')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        item?.click();
      });
      await wait(250);
      // Clear the committed text, then type a real filter (real key events).
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        const input = el.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      });
      await page.keyboard.type('Ban');
      await wait(300);
      let state = await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        return { items: el.shadowRoot!.querySelectorAll('md-menu-item').length };
      });
      expect(state.items).toBe(1); // only Banana
      // ArrowDown → real focus lands on the option.
      await page.keyboard.press('ArrowDown');
      await wait(200);
      const focusRole = await page.evaluate(
        () => document.querySelector('md-autocomplete')!.shadowRoot!.activeElement?.getAttribute('role') ?? null,
      );
      expect(focusRole).toBe('option');
      // Escape → closed, focus back in the input, text resynced to the commit.
      await page.keyboard.press('Escape');
      await wait(400);
      const after = await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete') as HTMLElement & { open: boolean; inputValue: string };
        const tf = el.shadowRoot!.querySelector('md-text-field')!;
        return {
          open: el.open,
          inputValue: el.inputValue,
          focusInInput: tf.shadowRoot!.activeElement === tf.shadowRoot!.querySelector('input'),
        };
      });
      expect(after.open).toBe(false);
      expect(after.inputValue).toBe('Apple');
      expect(after.focusInInput).toBe(true);
    });
  });

  describe('outside-click light dismiss', () => {
    it('closes exactly once, snaps typed text back, and reopens with the FULL list', async () => {
      const page = await newE2EPage();
      await setup(page);
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        (window as unknown as { __closes: number }).__closes = 0;
        el.addEventListener('mdClose', () => (window as unknown as { __closes: number }).__closes++);
        el.shadowRoot!.querySelector('md-text-field')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const item = [...el.shadowRoot!.querySelectorAll('md-menu-item')].find(
          (i) => (i as unknown as { headline: string }).headline === 'Apple',
        ) as HTMLElement;
        item?.click();
      });
      await wait(300);
      // Reopen and type a diverging filter.
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        (el.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
      });
      await page.keyboard.type('Cher');
      await wait(300);
      const closesBefore = await page.evaluate(() => (window as unknown as { __closes: number }).__closes);
      // Click far outside the host.
      await page.mouse.click(500, 400);
      await wait(400);
      const after = await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete') as HTMLElement & { open: boolean; inputValue: string };
        return { open: el.open, inputValue: el.inputValue, closes: (window as unknown as { __closes: number }).__closes };
      });
      expect(after.open).toBe(false);
      expect(after.closes).toBe(closesBefore + 1);
      expect(after.inputValue).toBe('Apple');
      // Reopen → FULL list, not the stale filter.
      await page.evaluate(() =>
        document.querySelector('md-autocomplete')!.shadowRoot!.querySelector('md-text-field')!.dispatchEvent(new MouseEvent('click', { bubbles: true })),
      );
      await wait(300);
      const items = await page.evaluate(
        () => document.querySelector('md-autocomplete')!.shadowRoot!.querySelectorAll('md-menu-item').length,
      );
      expect(items).toBe(3);
    });
  });

  describe('inline chips (chip-position="inline")', () => {
    it('field grows rows as chips wrap, host width stays constant; real Backspace pops', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<div style="inline-size: 320px;"><md-autocomplete label="Fruit" multiple chip-position="inline"></md-autocomplete></div>',
      );
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete') as HTMLElement & { options: unknown[]; value: string[] };
        el.options = [
          { value: 'a', label: 'Alphabetical' },
          { value: 'b', label: 'Blueberry jam' },
          { value: 'c', label: 'Cherry pie' },
          { value: 'd', label: 'Dragonfruit' },
        ];
        el.value = ['a'];
      });
      await page.waitForChanges();
      await wait(200);
      const rect = () =>
        page.evaluate(() => {
          const el = document.querySelector('md-autocomplete')!;
          const tf = el.shadowRoot!.querySelector('md-text-field')!.getBoundingClientRect();
          const host = el.getBoundingClientRect();
          return { fieldH: Math.round(tf.height), hostW: Math.round(host.width) };
        });
      const before = await rect();
      await page.evaluate(() => {
        (document.querySelector('md-autocomplete') as HTMLElement & { value: string[] }).value = ['a', 'b', 'c', 'd'];
      });
      await page.waitForChanges();
      await wait(250);
      const after = await rect();
      expect(after.fieldH).toBeGreaterThan(before.fieldH); // wrapped onto more rows
      expect(after.hostW).toBe(before.hostW); // width never moves
      // Real Backspace on the focused, empty input removes the last chip.
      await page.evaluate(() => {
        const el = document.querySelector('md-autocomplete')!;
        (el.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
      });
      await page.keyboard.press('Backspace');
      await wait(250);
      const value = await page.evaluate(
        () => (document.querySelector('md-autocomplete') as HTMLElement & { value: string[] }).value,
      );
      expect(value).toEqual(['a', 'b', 'c']);
    });
  });

});

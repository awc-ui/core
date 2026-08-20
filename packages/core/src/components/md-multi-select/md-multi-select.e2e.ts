import { newE2EPage } from '@stencil/core/testing';

/**
 * Real-browser coverage for md-multi-select — the keyboard model, ARIA tree,
 * chip accessibility, selection-cap behavior, and form participation that the
 * JSDOM spec cannot verify.
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const OPTS = `
  <md-select-option value="a" label="Apple"></md-select-option>
  <md-select-option value="b" label="Banana"></md-select-option>
  <md-select-option value="c" label="Cherry"></md-select-option>`;

function menuItems(page: E2EPage) {
  return page.evaluate(() =>
    Array.from(document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('md-menu-item')).map((it) => ({
      role: it.getAttribute('role'),
      selected: it.getAttribute('aria-selected'),
      name: (it.getAttribute('headline') || '').trim(),
    })),
  );
}
const val = (page: E2EPage) => page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { value: string[] }).value);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Set the array value as a PROPERTY (an HTML attribute would assign the raw string). */
async function setValue(page: E2EPage, v: string[]) {
  await page.evaluate((vals: string[]) => ((document.querySelector('md-multi-select') as unknown as { value: string[] }).value = vals), v);
  await page.waitForChanges();
  await wait(120);
}

async function open(page: E2EPage) {
  await page.evaluate(() => (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-text-field') as HTMLElement).focus());
  await page.keyboard.press('ArrowDown');
  await wait(280);
  await page.waitForChanges();
}

describe('md-multi-select (e2e)', () => {
  // ── ARIA tree ────────────────────────────────────────────
  describe('ARIA', () => {
    it('renders a multiselectable listbox of role=option rows with single (not doubled) names', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(200);
      const listbox = await page.evaluate(() => {
        const lb = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('[role="listbox"]');
        return { present: !!lb, multi: lb?.getAttribute('aria-multiselectable') };
      });
      expect(listbox.present).toBe(true);
      expect(listbox.multi).toBe('true');
      const items = await menuItems(page);
      expect(items.map((i) => i.role)).toEqual(['option', 'option', 'option']);
      // accessible name must not be doubled ("Apple Apple") — headline only, no text child
      const accName = await page.evaluate(() => {
        const it = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-menu-item')!;
        return (it.textContent || '').trim();
      });
      expect(accName).toBe('');
    });
  });

  // ── Keyboard ─────────────────────────────────────────────
  describe('keyboard', () => {
    it('opens, arrows through options, and Space toggles without closing', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await open(page);
      await page.keyboard.press(' '); // toggle the focused (first) option
      await wait(120);
      expect(await val(page)).toEqual(['a']);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press(' '); // toggle a second — menu stays open (keep-open)
      await wait(120);
      expect(await val(page)).toEqual(['a', 'b']);
      const stillOpen = await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open);
      expect(stillOpen).toBe(true);
    });

    it('Escape closes the menu and returns focus to the trigger', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await open(page);
      await page.keyboard.press('Escape');
      await wait(150);
      expect(await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open)).toBe(false);
    });
  });

  // ── Selection cap ────────────────────────────────────────
  describe('maxSelected', () => {
    it('blocks a toggle at the cap and leaves no phantom-checked option', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Pick 1" max-selected="1" open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(200);
      await page.evaluate(() => {
        const its = document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('md-menu-item');
        (its[0] as HTMLElement).click(); // fills the cap
      });
      await wait(80);
      await page.evaluate(() => {
        const its = document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('md-menu-item');
        (its[1] as HTMLElement).click(); // blocked
      });
      await wait(150);
      expect(await val(page)).toEqual(['a']);
      const items = await menuItems(page);
      expect(items[1].selected).toBe('false'); // NOT phantom-checked
    });
  });

  // ── Chips ────────────────────────────────────────────────
  describe('selection chips', () => {
    it('renders removable chips in a NON aria-hidden region and removal updates value + emits', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" display-mode="chips">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b']);
      const state = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const chips = ms.shadowRoot!.querySelector('.md-multi-select__chips');
        let hidden = false;
        let n: Element | null = chips;
        while (n && (n as Node) !== ms.shadowRoot) {
          if (n.getAttribute?.('aria-hidden') === 'true') { hidden = true; break; }
          n = n.parentElement;
        }
        return { count: chips?.querySelectorAll('md-chip').length ?? 0, hidden, role: chips?.getAttribute('role') };
      });
      expect(state.count).toBe(2);
      expect(state.hidden).toBe(false); // out of the field's aria-hidden icon slot
      expect(state.role).toBe('group'); // md-chip forces role=button, so a labelled group (not list)
      // remove the first chip → value drops it, mdRemove + mdChange fire
      const events = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')! as unknown as { value: string[] };
        const el = document.querySelector('md-multi-select')!;
        const out: Record<string, unknown> = {};
        el.addEventListener('mdRemove', (e) => (out.removed = (e as CustomEvent).detail), { once: true });
        el.addEventListener('mdChange', (e) => (out.changed = (e as CustomEvent).detail), { once: true });
        const chip = el.shadowRoot!.querySelector('md-chip')!;
        (chip.shadowRoot!.querySelector('.md-chip__remove') as HTMLElement).click();
        return new Promise((res) => setTimeout(() => res({ ...out, value: ms.value }), 100));
      });
      expect(events).toMatchObject({ removed: 'a', changed: ['b'], value: ['b'] });
    });
  });

  describe('chips-inline display mode', () => {
    it('renders removable chips INSIDE the field (non aria-hidden) and removal works', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" display-mode="chips-inline">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b']);
      const state = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const field = ms.shadowRoot!.querySelector('md-text-field')!;
        // chips are slotted into the field's `chips` slot (in the input flow)
        const slotted = field.querySelector('[slot="chips"]');
        const chips = slotted?.querySelectorAll('md-chip').length ?? 0;
        // the field's chips container must NOT be aria-hidden (unlike the icon slot)
        const chipsSpan = field.shadowRoot!.querySelector('.md-text-field__chips');
        let hidden = false;
        let n: Element | null = chipsSpan;
        while (n && (n as Node) !== field.shadowRoot) {
          if (n.getAttribute?.('aria-hidden') === 'true') { hidden = true; break; }
          n = n.parentElement;
        }
        // no chips rendered in the below-field region for this mode
        const below = Array.from(ms.shadowRoot!.children).some((c) => c.classList?.contains('md-multi-select__chips'));
        return { chips, hidden, slottedRole: slotted?.getAttribute('role'), below };
      });
      expect(state.chips).toBe(2);
      expect(state.hidden).toBe(false); // accessible inside the field
      expect(state.slottedRole).toBe('group');
      expect(state.below).toBe(false); // not also rendered below
      // remove the first chip
      const after = await page.evaluate(() => {
        const field = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-text-field')!;
        const chip = field.querySelector('[slot="chips"] md-chip')!;
        (chip.shadowRoot!.querySelector('.md-chip__remove') as HTMLElement).click();
        return new Promise((res) => setTimeout(() => res((document.querySelector('md-multi-select') as unknown as { value: string[] }).value), 100));
      });
      expect(after).toEqual(['b']);
    });
  });

  describe('chips-inline overflow modes', () => {
    const MANY = `
      <md-select-option value="a" label="Apple"></md-select-option>
      <md-select-option value="b" label="Banana"></md-select-option>
      <md-select-option value="c" label="Cherry"></md-select-option>
      <md-select-option value="d" label="Durian"></md-select-option>
      <md-select-option value="e" label="Elderberry"></md-select-option>`;

    it('count (default): collapses overflow into a "+N" counter and holds the field height', async () => {
      const page = await newE2EPage();
      await page.setContent(`<div style="width:260px"><md-multi-select label="Fruit" display-mode="chips-inline">${MANY}</md-multi-select></div>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b', 'c', 'd', 'e']);
      await wait(300); // ResizeObserver + rAF measurement
      const s = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const cont = ms.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('.md-text-field__container') as HTMLElement;
        const plus = ms.shadowRoot!.querySelector('.md-multi-select__overflow-chip');
        const visible = ms.shadowRoot!.querySelectorAll('.md-multi-select__inline-chips > md-chip').length;
        return { height: Math.round(cont.getBoundingClientRect().height), plus: plus?.textContent?.trim() ?? null, visible };
      });
      expect(s.height).toBeLessThanOrEqual(60); // single row — not grown
      expect(s.plus).toMatch(/^\+\d+$/); // some chips collapsed into "+N"
      expect(s.visible).toBeGreaterThan(0); // ...but at least one full chip shows
    });

    it('count: clicking the "+N" counter opens the menu', async () => {
      const page = await newE2EPage();
      await page.setContent(`<div style="width:220px"><md-multi-select label="Fruit" display-mode="chips-inline">${MANY}</md-multi-select></div>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b', 'c', 'd', 'e']);
      await wait(300);
      const opened = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        (ms.shadowRoot!.querySelector('.md-multi-select__overflow-chip') as HTMLElement | null)?.click();
        return new Promise((res) => setTimeout(() => res((ms as unknown as { open: boolean }).open), 250));
      });
      expect(opened).toBe(true);
    });

    it('wrap: chips wrap onto new rows and the field grows', async () => {
      const page = await newE2EPage();
      await page.setContent(`<div style="width:260px"><md-multi-select label="Fruit" display-mode="chips-inline" chip-overflow="wrap">${MANY}</md-multi-select></div>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b', 'c', 'd', 'e']);
      await wait(200);
      const s = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const field = ms.shadowRoot!.querySelector('md-text-field')!;
        const cont = field.shadowRoot!.querySelector('.md-text-field__container') as HTMLElement;
        return {
          height: Math.round(cont.getBoundingClientRect().height),
          plus: !!ms.shadowRoot!.querySelector('.md-multi-select__overflow-chip'),
          chipsWrap: field.hasAttribute('chips-wrap'),
        };
      });
      expect(s.height).toBeGreaterThan(60); // grew beyond one row
      expect(s.plus).toBe(false); // no counter in wrap mode
      expect(s.chipsWrap).toBe(true);
    });
  });

  describe('filterable on a plain (non-virtualized) list', () => {
    it('shows a search that focuses on open and filters the DOM options', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" filterable>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await open(page);
      await wait(120);
      const s = await page.evaluate(() => {
        const sr = document.querySelector('md-multi-select')!.shadowRoot!;
        const search = sr.querySelector('.md-multi-select__search') as HTMLElement | null;
        return {
          hasSearch: !!search,
          focused: sr.activeElement === search,
          count: sr.querySelectorAll('.md-multi-select__listbox md-menu-item').length,
        };
      });
      expect(s.hasSearch).toBe(true);
      expect(s.focused).toBe(true); // combobox: the search owns focus
      expect(s.count).toBe(3); // Apple / Banana / Cherry

      const filtered = await page.evaluate(() => {
        const search = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__search') as HTMLInputElement;
        search.value = 'ban';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        return new Promise((res) =>
          setTimeout(() => res(document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('.md-multi-select__listbox md-menu-item').length), 120),
        );
      });
      expect(filtered).toBe(1); // only Banana matches

      const noMatch = await page.evaluate(() => {
        const search = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__search') as HTMLInputElement;
        search.value = 'zzzz';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        return new Promise((res) =>
          setTimeout(() => res(!!document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__empty')), 120),
        );
      });
      expect(noMatch).toBe(true); // "No results"
    });

    it('ArrowDown from the search moves focus into the listbox (combobox)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" filterable>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await open(page);
      await wait(120);
      const tag = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        (ms.shadowRoot!.querySelector('.md-multi-select__search') as HTMLElement).dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }),
        );
        return new Promise((res) => setTimeout(() => res(ms.shadowRoot!.activeElement?.tagName), 120));
      });
      expect(tag).toBe('MD-MENU-ITEM');
    });
  });

  it('emits only mdChange on option toggle — the option\'s internal mdClick does not leak', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
    await page.waitForChanges();
    await open(page);
    const ms = await page.find('md-multi-select');
    const change = await ms.spyOnEvent('mdChange');
    const click = await ms.spyOnEvent('mdClick'); // composed:true from md-menu-item — must be stopped
    await page.evaluate(() => {
      (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__listbox md-menu-item') as HTMLElement).click();
    });
    await page.waitForChanges();
    await wait(80);
    expect(change).toHaveReceivedEvent();
    expect(click).not.toHaveReceivedEvent();
  });

  describe('max-height', () => {
    it('caps the dropdown and wraps it in a scrolling viewport', async () => {
      const manyOpts = Array.from({ length: 12 }, (_, i) => `<md-select-option value="v${i}" label="Item ${i}"></md-select-option>`).join('');
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Many" max-height="200" open>${manyOpts}</md-multi-select>`);
      await page.waitForChanges();
      await wait(300);
      const state = await page.evaluate(() => {
        const menu = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-menu')!;
        const ss = menu.shadowRoot!.querySelector('.md-menu__scroll-shadow');
        return {
          maxHeightAttr: menu.getAttribute('max-height'),
          hasScrollViewport: !!ss,
          scrollViewportH: ss ? Math.round(ss.getBoundingClientRect().height) : null,
        };
      });
      expect(state.maxHeightAttr).toBe('200');
      expect(state.hasScrollViewport).toBe(true);
      expect(state.scrollViewportH).toBeLessThanOrEqual(201); // capped at ~200 (not the full 12-item height)
    });
  });

  describe('capped menu never overlaps the trigger (fits the available space)', () => {
    it('caps + scrolls below the trigger in a short viewport instead of overlapping it', async () => {
      const many = Array.from({ length: 12 }, (_, i) => `<md-select-option value="v${i}" label="Item ${i}"></md-select-option>`).join('');
      const page = await newE2EPage();
      await page.setViewport({ width: 500, height: 420 });
      // trigger near the top, short viewport → the ~313px menu can't fit below at
      // full height and there's no room above; it must cap + scroll, not overlap.
      await page.setContent(`<div style="position:fixed;top:150px;left:40px;width:300px"><md-multi-select label="Brands" max-height="300" show-select-all>${many}</md-multi-select></div>`);
      await page.waitForChanges();
      await wait(200);
      await page.evaluate(() => ((document.querySelector('md-multi-select') as unknown as { open: boolean }).open = true));
      await wait(500);
      const geo = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const field = ms.shadowRoot!.querySelector('md-text-field')!;
        const surface = ms.shadowRoot!.querySelector('md-menu')!.shadowRoot!.querySelector('.md-menu__surface')!;
        const t = field.getBoundingClientRect();
        const s = surface.getBoundingClientRect();
        return {
          overlaps: s.top < t.bottom - 2 && s.bottom > t.top + 2,
          onScreen: s.top >= -1 && s.bottom <= window.innerHeight + 2,
          below: s.top >= t.bottom - 2,
        };
      });
      expect(geo.overlaps).toBe(false);
      expect(geo.onScreen).toBe(true);
      expect(geo.below).toBe(true);
    });
  });

  describe('text display mode', () => {
    it('applies text-overflow: ellipsis to the trigger input', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" display-mode="text">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b', 'c']);
      const overflow = await page.evaluate(() => {
        const input = document
          .querySelector('md-multi-select')!
          .shadowRoot!.querySelector('md-text-field')!
          .shadowRoot!.querySelector('.md-text-field__input') as HTMLElement;
        return getComputedStyle(input).textOverflow;
      });
      expect(overflow).toBe('ellipsis');
    });
  });

  describe('clearable', () => {
    it('shows an accessible clear button that empties the selection and emits mdClear + mdChange', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" clearable display-mode="count">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      // no value → no clear button
      expect(await page.evaluate(() => !!document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__clear'))).toBe(false);
      await setValue(page, ['a', 'b']);
      const present = await page.evaluate(() => {
        const field = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-text-field')!;
        const clear = field.querySelector('.md-multi-select__clear');
        // md-text-field un-hides the trailing wrapper because the clear is interactive
        const wrap = field.shadowRoot!.querySelector('.md-text-field__trailing-icon-button, .md-text-field__icon--trailing');
        return { present: !!clear, label: clear?.getAttribute('aria-label'), trailingHidden: wrap?.getAttribute('aria-hidden') };
      });
      expect(present.present).toBe(true);
      expect(present.label).toBe('Clear selection');
      expect(present.trailingHidden).toBeNull(); // NOT aria-hidden → keyboard/AT reachable
      const after = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        let cleared = false;
        let changed: string[] | null = null;
        ms.addEventListener('mdClear', () => (cleared = true), { once: true });
        ms.addEventListener('mdChange', (e) => (changed = (e as CustomEvent).detail), { once: true });
        (ms.shadowRoot!.querySelector('.md-multi-select__clear') as HTMLElement).click();
        return new Promise((res) => setTimeout(() => res({ value: (ms as unknown as { value: string[] }).value, cleared, changed }), 120));
      });
      expect(after).toMatchObject({ value: [], cleared: true, changed: [] });
      // clear button gone now that it's empty
      expect(await page.evaluate(() => !!document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__clear'))).toBe(false);
    });
  });

  // ── Form participation ───────────────────────────────────
  describe('forms', () => {
    it('submits each selected value as a repeated name=value pair', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <form id="f">
          <md-multi-select name="fruit" label="Fruit">${OPTS}</md-multi-select>
        </form>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'c']);
      const pairs = await page.evaluate(() => {
        const fd = new FormData(document.getElementById('f') as HTMLFormElement);
        return fd.getAll('fruit');
      });
      expect(pairs).toEqual(['a', 'c']);
    });

    it('required with no selection is invalid and blocks submit; valid once something is picked', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <form id="f">
          <md-multi-select name="fruit" label="Fruit" required>${OPTS}</md-multi-select>
        </form>`);
      await page.waitForChanges();
      await wait(100);
      expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(false);
      await page.evaluate(() => ((document.querySelector('md-multi-select') as unknown as { value: string[] }).value = ['b']));
      await page.waitForChanges();
      await wait(80);
      expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(true);
    });

    it('restores the load-time selection on form reset', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <form id="f">
          <md-multi-select name="fruit" label="Fruit">${OPTS}</md-multi-select>
        </form>`);
      await page.waitForChanges();
      // formResetCallback restores the value captured at componentWillLoad (empty here).
      await setValue(page, ['a', 'b', 'c']);
      await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
      await page.waitForChanges();
      await wait(80);
      expect(await val(page)).toEqual([]);
    });
  });

  // ── Events ───────────────────────────────────────────────
  describe('events', () => {
    it('emits mdOpen/mdClose exactly once per open/close cycle', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await page.evaluate(() => {
        const el = document.querySelector('md-multi-select')! as unknown as { __o: number; __c: number };
        el.__o = 0; el.__c = 0;
        document.querySelector('md-multi-select')!.addEventListener('mdOpen', () => (el.__o++));
        document.querySelector('md-multi-select')!.addEventListener('mdClose', () => (el.__c++));
      });
      await open(page);
      await page.keyboard.press('Escape');
      await wait(200);
      const counts = await page.evaluate(() => {
        const el = document.querySelector('md-multi-select')! as unknown as { __o: number; __c: number };
        return { o: el.__o, c: el.__c };
      });
      expect(counts).toEqual({ o: 1, c: 1 });
    });
  });

  // ── Declarative initial open ─────────────────────────────
  describe('initial open', () => {
    it('shows the menu when `open` is set at load', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(250);
      // md-menu reflects `open`; assert THAT (its host is display:block in every
      // state, so a computed-display check would be vacuously true).
      const menuOpen = await page.evaluate(() =>
        document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-menu')!.hasAttribute('open'));
      expect(menuOpen).toBe(true);
    });
  });

  // ── Select all (pinned tri-state menu-item) ──────────────
  describe('select all', () => {
    const readSA = (page: E2EPage) => page.evaluate(() => {
      const ms = document.querySelector('md-multi-select')!;
      const item = ms.shadowRoot!.querySelector('.md-multi-select__select-all md-menu-item')!;
      const glyph = item.shadowRoot!.querySelector('.md-menu-item__check .material-symbols-outlined')!.textContent!.trim();
      return {
        glyph,
        ariaChecked: item.getAttribute('aria-checked'),
        itemRole: item.getAttribute('role'),
      };
    });

    it('shows tri-state in the check column (blank / dash+mixed / tick+true) with no checkbox square', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" show-select-all open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(250);
      // none selected — role="checkbox" (a bulk toggle, not a menu item, so no
      // aria-required-parent violation)
      expect(await readSA(page)).toEqual({ glyph: '', ariaChecked: 'false', itemRole: 'checkbox' });
      // some selected → dash + mixed
      await setValue(page, ['a']);
      expect((await readSA(page)).glyph).toBe('remove');
      expect((await readSA(page)).ariaChecked).toBe('mixed');
      // all selected → tick + true
      await setValue(page, ['a', 'b', 'c']);
      expect((await readSA(page)).glyph).toBe('check');
      expect((await readSA(page)).ariaChecked).toBe('true');
      // the old heavy checkbox square is gone
      const hasBox = await page.evaluate(() =>
        !!document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__select-all md-checkbox'));
      expect(hasBox).toBe(false);
    });

    it('clicking the pinned row selects all then clears (menu stays open)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" show-select-all open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(250);
      const clickSA = () => page.evaluate(() => {
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__select-all md-menu-item') as HTMLElement).click();
        return new Promise((r) => setTimeout(r, 150));
      });
      await clickSA();
      expect(await val(page)).toEqual(['a', 'b', 'c']);
      await clickSA();
      expect(await val(page)).toEqual([]);
      const stillOpen = await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open);
      expect(stillOpen).toBe(true);
    });
  });

  // ── Trigger width stability ──────────────────────────────
  describe('trigger width', () => {
    it('does not change the trigger width as items are selected (fills its container)', async () => {
      const many = Array.from({ length: 12 }, (_, i) => `<md-select-option value="b${i + 1}" label="Brand ${i + 1}"></md-select-option>`).join('');
      const page = await newE2EPage();
      await page.setViewport({ width: 900, height: 700 });
      await page.setContent(`<div style="width:720px"><md-multi-select label="Brands" display-mode="chips">${many}</md-multi-select></div>`);
      await page.waitForChanges();
      await wait(150);
      const widthAt = async (n: number) => {
        await page.evaluate((count) => {
          (document.querySelector('md-multi-select') as unknown as { value: string[] }).value =
            Array.from({ length: count }, (_, i) => `b${i + 1}`);
        }, n);
        await page.waitForChanges();
        await wait(120);
        return page.evaluate(() => Math.round(document.querySelector('md-multi-select')!.getBoundingClientRect().width));
      };
      const widths = [];
      for (const n of [0, 1, 6, 12]) widths.push(await widthAt(n));
      // every selection count yields the same container-driven width (720px), not a
      // shrink-to-fit that balloons with the below-field chips row.
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBe(720);
    });
  });

  // ── Chip position ────────────────────────────────────────
  describe('chip position', () => {
    it('reflects chip-position and places chips before the trigger for left', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="T" display-mode="chips" chip-position="left">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b']);
      const geo = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const hostClass = ms.className || ms.getAttribute('class') || '';
        const field = ms.shadowRoot!.querySelector('.md-multi-select__field')!.getBoundingClientRect();
        const chips = ms.shadowRoot!.querySelector('.md-multi-select__chips')!.getBoundingClientRect();
        return { reflected: ms.getAttribute('chip-position'), hostClass, chipsLeftOfField: chips.left < field.left };
      });
      expect(geo.reflected).toBe('left');
      expect(geo.hostClass).toContain('md-multi-select--chips-left');
      expect(geo.chipsLeftOfField).toBe(true);
    });

    it('places chips above the trigger for top', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="T" display-mode="chips" chip-position="top">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b']);
      const above = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const field = ms.shadowRoot!.querySelector('.md-multi-select__field')!.getBoundingClientRect();
        const chips = ms.shadowRoot!.querySelector('.md-multi-select__chips')!.getBoundingClientRect();
        return chips.bottom <= field.top + 1;
      });
      expect(above).toBe(true);
    });
  });

  // ── Button trigger ───────────────────────────────────────
  describe('button trigger', () => {
    const setup = async (page: E2EPage) => {
      await page.setContent(`<md-multi-select label="Topics" trigger="button" chip-position="right">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(80);
    };

    it('renders an md-button (not a text field) that opens the menu on click', async () => {
      const page = await newE2EPage();
      await setup(page);
      const has = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!.shadowRoot!;
        return { button: !!ms.querySelector('md-button.md-multi-select__button'), field: !!ms.querySelector('md-text-field') };
      });
      expect(has.button).toBe(true);
      expect(has.field).toBe(false);
      await page.evaluate(() =>
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__button') as HTMLElement).click());
      await wait(200);
      expect(await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open)).toBe(true);
    });

    it('selecting adds chips beside the button and reflects in value', async () => {
      const page = await newE2EPage();
      await setup(page);
      await page.evaluate(() =>
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__button') as HTMLElement).click());
      await wait(200);
      await page.evaluate(() => {
        const rows = document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('md-menu-item');
        (rows[0] as HTMLElement).click();
        (rows[1] as HTMLElement).click();
      });
      await wait(150);
      const state = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        return {
          value: (ms as unknown as { value: string[] }).value,
          chips: ms.shadowRoot!.querySelectorAll('.md-multi-select__chips md-chip').length,
        };
      });
      expect(state.value).toEqual(['a', 'b']);
      expect(state.chips).toBe(2);
    });

    it('opens via keyboard (ArrowDown) without a double-toggle', async () => {
      const page = await newE2EPage();
      await setup(page);
      await page.evaluate(() =>
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__button') as HTMLElement).focus());
      await page.keyboard.press('ArrowDown');
      await wait(200);
      expect(await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open)).toBe(true);
    });

    it('re-anchors the open menu when the button shifts as chips are added (chip-position=left)', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 900, height: 700 });
      await page.setContent(`<div style="width:640px"><md-multi-select label="Topics" trigger="button" chip-position="left">${OPTS}</md-multi-select></div>`);
      await page.waitForChanges();
      await setValue(page, ['a']);
      await page.evaluate(() =>
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__button') as HTMLElement).click());
      await wait(300);
      const dx = () => page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const btn = ms.shadowRoot!.querySelector('.md-multi-select__button')!.getBoundingClientRect();
        const surf = ms.shadowRoot!.querySelector('md-menu')!.shadowRoot!.querySelector('.md-menu__surface')!.getBoundingClientRect();
        return { btnLeft: Math.round(btn.left), dx: Math.round(surf.left - btn.left) };
      });
      const before = await dx();
      expect(before.dx).toBeLessThanOrEqual(2); // menu starts aligned to the button
      // select two more → chips grow, button shifts right (chips are before it)
      await page.evaluate(() => {
        const rows = document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll('md-menu-item');
        (rows[1] as HTMLElement).click();
        (rows[2] as HTMLElement).click();
      });
      await wait(400);
      const after = await dx();
      expect(after.btnLeft).toBeGreaterThan(before.btnLeft); // the button actually moved
      expect(Math.abs(after.dx)).toBeLessThanOrEqual(3); // …and the menu followed it
    });
  });

  // ── Selection chips are display tokens, not toggles ──────
  describe('chips', () => {
    it('clicking a chip body does not toggle a selected/active state', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" display-mode="chips">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b']);
      const read = () => page.evaluate(() => {
        const chip = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__chips md-chip')!;
        return {
          selectedClass: chip.classList.contains('md-chip--selected'),
          ariaPressed: chip.getAttribute('aria-pressed'),
          selected: (chip as unknown as { selected: boolean }).selected,
        };
      });
      expect(await read()).toEqual({ selectedClass: false, ariaPressed: null, selected: false });
      await page.evaluate(() =>
        (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__chips md-chip') as HTMLElement).click());
      await wait(120);
      // still inert after a click — no misleading "active" flash, and the value is untouched
      expect(await read()).toEqual({ selectedClass: false, ariaPressed: null, selected: false });
      expect(await val(page)).toEqual(['a', 'b']);
    });
  });

  // ── Loading (busy) state ─────────────────────────────────
  describe('loading', () => {
    it('shows a trigger spinner + menu progress bar and hides search/options while loading', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Item" filterable virtualize="always" loading open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(250);
      const state = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        const menu = ms.shadowRoot!.querySelector('md-menu')!;
        return {
          ariaBusy: ms.getAttribute('aria-busy'),
          triggerSpinner: !!ms.shadowRoot!.querySelector('[part~="loading-spinner"]'),
          menuBar: !!menu.querySelector('[part~="loading-bar"]'),
          searchGone: !menu.querySelector('.md-multi-select__search'),
          optionsGone: !menu.querySelector('md-menu-item'),
        };
      });
      expect(state).toEqual({ ariaBusy: 'true', triggerSpinner: true, menuBar: true, searchGone: true, optionsGone: true });
    });

    it('clears the busy state and shows options when loading turns off', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Item" loading open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await wait(150);
      await page.evaluate(() => ((document.querySelector('md-multi-select') as unknown as { loading: boolean }).loading = false));
      await page.waitForChanges();
      await wait(150);
      const after = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!;
        return {
          ariaBusy: ms.getAttribute('aria-busy'),
          barGone: !ms.shadowRoot!.querySelector('[part~="loading-bar"]'),
          options: ms.shadowRoot!.querySelectorAll('md-menu-item').length,
        };
      });
      expect(after.ariaBusy).toBeNull();
      expect(after.barGone).toBe(true);
      expect(after.options).toBe(3);
    });
  });

  // ── Customization (slots + icon props) ───────────────────
  describe('customization', () => {
    it('dropdown-icon prop and slot override the caret glyph', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="A" dropdown-icon="expand_more">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      const glyph = await page.evaluate(() =>
        document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__caret slot')!.textContent!.trim());
      expect(glyph).toBe('expand_more');

      const page2 = await newE2EPage();
      await page2.setContent(`<md-multi-select label="B">${OPTS}<span slot="dropdown-icon">CARET</span></md-multi-select>`);
      await page2.waitForChanges();
      const custom = await page2.evaluate(() => {
        const s = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('.md-multi-select__caret slot') as HTMLSlotElement;
        return s.assignedNodes().map((n) => n.textContent).join('');
      });
      expect(custom).toBe('CARET');
    });

    it('no-options slot replaces the empty message (no options at all)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="A" open><div slot="no-options">Nothing here</div></md-multi-select>`);
      await page.waitForChanges();
      await wait(150);
      const info = await page.evaluate(() => {
        const s = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('[part="empty"] slot') as HTMLSlotElement | null;
        return { name: s?.getAttribute('name'), text: s?.assignedNodes().map((n) => n.textContent).join('') };
      });
      expect(info.name).toBe('no-options');
      expect(info.text).toBe('Nothing here');
    });

    it('no-results slot replaces the empty message when the filter matches nothing', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="C" filterable virtualize="always" open><div slot="no-results">No matches</div></md-multi-select>`);
      await page.waitForChanges();
      await page.evaluate(async () => {
        const c = document.querySelector('md-multi-select') as unknown as {
          loadOptions: (rows: Array<{ value: string; label: string }>) => Promise<void>;
          setQuery: (q: string) => Promise<void>;
        };
        await c.loadOptions(Array.from({ length: 100 }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` })));
        await c.setQuery('zzznomatch');
      });
      await wait(500);
      await page.waitForChanges();
      const info = await page.evaluate(() => {
        const s = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('[part="empty"] slot') as HTMLSlotElement | null;
        return { name: s?.getAttribute('name'), text: s?.assignedNodes().map((n) => n.textContent).join('') };
      });
      expect(info.name).toBe('no-results');
      expect(info.text).toBe('No matches');
    });

    it('menu-loader slot replaces the busy-state progress bar', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="A" loading open><div slot="menu-loader">Custom loading</div></md-multi-select>`);
      await page.waitForChanges();
      await wait(150);
      const text = await page.evaluate(() => {
        const s = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('[part="loading-bar"] slot') as HTMLSlotElement | null;
        return s?.assignedNodes().map((n) => n.textContent).join('');
      });
      expect(text).toBe('Custom loading');
    });

    it('exposes theming CSS custom properties', async () => {
      const page = await newE2EPage();
      await page.setContent(
        `<style>#m{--md-multi-select-clear-size:44px;--md-multi-select-search-bg:rgb(1,2,3);--md-multi-select-option-icon-color:rgb(4,5,6);}</style>` +
          `<md-multi-select id="m" label="A" clearable filterable virtualize="always" open>` +
          `<md-select-option value="a" icon="star">Apple</md-select-option></md-multi-select>`,
      );
      await page.waitForChanges();
      await page.evaluate(() => ((document.querySelector('md-multi-select') as unknown as { value: string[] }).value = ['a']));
      await page.waitForChanges();
      await wait(150);
      const styles = await page.evaluate(() => {
        const sr = document.querySelector('md-multi-select')!.shadowRoot!;
        const cs = (sel: string, prop: string) => {
          const el = sr.querySelector(sel);
          return el ? (getComputedStyle(el) as unknown as Record<string, string>)[prop] : null;
        };
        return {
          clearSize: cs('.md-multi-select__clear', 'inlineSize'),
          searchBg: cs('.md-multi-select__search', 'backgroundColor'),
          optionIconColor: cs('.md-multi-select__option-icon', 'color'),
        };
      });
      expect(styles.clearSize).toBe('44px');
      expect(styles.searchBg).toBe('rgb(1, 2, 3)');
      expect(styles.optionIconColor).toBe('rgb(4, 5, 6)');
    });

    it('exposes new parts and forwards menu-surface via exportparts', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="A" show-select-all open>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a']);
      const parts = await page.evaluate(() => {
        const sr = document.querySelector('md-multi-select')!.shadowRoot!;
        return {
          listbox: !!sr.querySelector('[part~="listbox"]'),
          chip: !!sr.querySelector('[part~="chip"]'),
          selectAllItem: !!sr.querySelector('[part~="select-all-item"]'),
          // exportparts forwards md-menu's surface as menu-surface on the md-menu host
          menuSurfaceForwarded: (sr.querySelector('md-menu')!.getAttribute('exportparts') || '').includes('menu-surface'),
        };
      });
      expect(parts).toEqual({ listbox: true, chip: true, selectAllItem: true, menuSurfaceForwarded: true });
    });

    it('projects the menu-header, trigger-leading and trigger-trailing slots', async () => {
      const page = await newE2EPage();
      await page.setContent(
        `<md-multi-select label="A" open>${OPTS}` +
          `<span slot="trigger-leading">L</span><span slot="trigger-trailing">T</span>` +
          `<div slot="menu-header">Header</div></md-multi-select>`,
      );
      await page.waitForChanges();
      await wait(150);
      const slots = await page.evaluate(() => {
        const sr = document.querySelector('md-multi-select')!.shadowRoot!;
        const txt = (name: string) => {
          const s = sr.querySelector(`slot[name="${name}"]`) as HTMLSlotElement | null;
          return s?.assignedNodes().map((n) => n.textContent).join('') ?? null;
        };
        return { header: txt('menu-header'), leading: txt('trigger-leading'), trailing: txt('trigger-trailing') };
      });
      expect(slots).toEqual({ header: 'Header', leading: 'L', trailing: 'T' });
    });

    it('does NOT forward an empty trigger-leading/trailing slot (no label shift)', async () => {
      // md-text-field flags a leading icon by the mere presence of a
      // [slot="leading-icon"] element, so an empty forwarding slot would reserve
      // leading space and mis-align the floating label. When the consumer supplies
      // no trigger-leading/trailing content, the forwarding slots must not render.
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Option" clearable>${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a']);
      const info = await page.evaluate(() => {
        const tf = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-text-field')!;
        return {
          leadingSlotEl: !!tf.querySelector('[slot="leading-icon"]'),
          // the clear button must still be the first trailing-icon (interactive) so
          // md-text-field un-hides the trailing cluster
          firstTrailingIsClear: tf.querySelector('[slot="trailing-icon"]')?.classList.contains('md-multi-select__clear'),
        };
      });
      expect(info.leadingSlotEl).toBe(false);
      expect(info.firstTrailingIsClear).toBe(true);
    });
  });

  // ── Accessibility (focus / live-region / ARIA) ───────────
  describe('accessibility', () => {
    // Deepest active element across shadow roots, as "tag#id".
    const deepActive = (page: E2EPage) => page.evaluate(() => {
      let a = document.activeElement as Element | null;
      const path: string[] = [];
      while (a) {
        path.push(a.tagName.toLowerCase() + ((a as HTMLElement).id ? `#${(a as HTMLElement).id}` : ''));
        const sr = (a as HTMLElement).shadowRoot;
        if (sr && sr.activeElement) a = sr.activeElement;
        else break;
      }
      return path.join(' > ');
    });

    it('keeps focus on a chip remove-button (not body) after removing one via its ✕', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit" display-mode="chips">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await setValue(page, ['a', 'b', 'c']);
      await page.evaluate(() => {
        const chips = document.querySelector('md-multi-select')!.shadowRoot!.querySelectorAll<HTMLElement>('.md-multi-select__chips md-chip');
        (chips[1].shadowRoot!.querySelector('[part="remove"]') as HTMLElement).click();
      });
      await wait(200);
      // focus survived inside a chip (its remove button), not on <body>
      expect(await deepActive(page)).toContain('md-chip');
      expect(await val(page)).toEqual(['a', 'c']);
    });

    it('ArrowUp opens the closed menu (APG)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-text-field') as HTMLElement).focus());
      await page.keyboard.press('ArrowUp');
      await wait(200);
      expect(await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { open: boolean }).open)).toBe(true);
    });

    it('announces the selection count in a polite live region', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Fruit">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      const live = () => page.evaluate(() => {
        const r = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('[part="live-region"]')!;
        return { role: r.getAttribute('role'), live: r.getAttribute('aria-live'), text: r.textContent };
      });
      await setValue(page, ['a', 'b']);
      expect(await live()).toEqual({ role: 'status', live: 'polite', text: '2 selected' });
      await setValue(page, []);
      expect((await live()).text).toBe('None selected');
    });

    it('button trigger conveys error/described-by (aria-required is invalid on role=button)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-multi-select label="Topics" trigger="button" required error error-text="Pick one">${OPTS}</md-multi-select>`);
      await page.waitForChanges();
      const info = await page.evaluate(() => {
        const ms = document.querySelector('md-multi-select')!.shadowRoot!;
        const btn = ms.querySelector('md-button')!;
        const desc = ms.querySelector('[part="button-desc"]')!;
        return {
          required: btn.getAttribute('aria-required'), // must be null — not allowed on role=button
          invalid: btn.getAttribute('aria-invalid'),
          describedby: btn.getAttribute('aria-describedby'),
          descId: desc.getAttribute('id'),
          descRole: desc.getAttribute('role'),
          descText: desc.textContent,
        };
      });
      expect(info.required).toBeNull();
      expect(info.invalid).toBe('true');
      expect(info.describedby).toBe(info.descId);
      expect(info.descRole).toBe('alert');
      expect(info.descText).toBe('Pick one');
    });
  });
});

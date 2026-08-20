import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdList } from './md-list';
import { MdListItem } from '../md-list-item/md-list-item';

/**
 * Roving focus and typeahead.
 *
 * None of this was reachable before: the handler resolved the current row with
 * `i.matches(':focus-within')`, and mock-doc's selector engine throws
 * "unsupported pseudo" on it — so the very first keystroke threw and took all
 * keyboard navigation with it. It now walks the active element out through its
 * shadow hosts instead (see containsFocus in md-list.tsx).
 */
async function create(items = ['One', 'Two', 'Three'], listAttrs = '') {
  const page = await newSpecPage({
    components: [MdList, MdListItem],
    html: `<md-list ${listAttrs}>${items
      .map((h) => `<md-list-item headline="${h}" type="button"></md-list-item>`)
      .join('')}</md-list>`,
  });
  await page.waitForChanges();
  return page;
}

const rows = (page: SpecPage) =>
  Array.from(page.root!.querySelectorAll('md-list-item')) as HTMLElement[];

/**
 * Which row holds the roving tabstop. NOTE the first row is tabbable from
 * init — that is the roving-tabindex convention, so "did not move" is index 0,
 * not -1.
 */
const tabbableIndex = (page: SpecPage) =>
  rows(page).findIndex((r) => (r as HTMLElement & { tabbable?: boolean }).tabbable === true);

async function press(page: SpecPage, key: string, init: Partial<KeyboardEvent> = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
  page.root!.dispatchEvent(ev);
  await page.waitForChanges();
  return ev;
}

describe('md-list — keyboard', () => {
  describe('roving focus', () => {
    it('moves to the first row on ArrowDown', async () => {
      const page = await create();
      await press(page, 'ArrowDown');
      expect(tabbableIndex(page)).toBe(0);
    });

    it('does not throw on a keystroke', async () => {
      // The regression this guards: a selector the engine cannot parse threw
      // out of the keydown handler and disabled navigation entirely.
      const page = await create();
      await expect(press(page, 'ArrowDown')).resolves.toBeTruthy();
    });

    it('wraps from the last row to the first', async () => {
      const page = await create();
      await press(page, 'ArrowDown');
      await press(page, 'ArrowDown');
      await press(page, 'ArrowDown');
      await press(page, 'ArrowDown');
      expect(tabbableIndex(page)).toBe(0);
    });

    it('Home goes to the first row and End to the last', async () => {
      const page = await create();
      await press(page, 'End');
      expect(tabbableIndex(page)).toBe(2);
      await press(page, 'Home');
      expect(tabbableIndex(page)).toBe(0);
    });

    it('prevents the default so the page does not scroll', async () => {
      const page = await create();
      expect((await press(page, 'ArrowDown')).defaultPrevented).toBe(true);
      expect((await press(page, 'End')).defaultPrevented).toBe(true);
    });

    it('leaves Alt+Arrow to the reorder handler', async () => {
      // Alt+Arrow requests a reorder; advancing roving focus on the same
      // keystroke would move the cursor as well as the row.
      const page = await create();
      const before = tabbableIndex(page);
      const ev = await press(page, 'ArrowDown', { altKey: true });
      expect(ev.defaultPrevented).toBe(false);
      expect(tabbableIndex(page)).toBe(before);
    });

    it('does nothing with no focusable rows', async () => {
      const page = await newSpecPage({
        components: [MdList, MdListItem],
        html: '<md-list></md-list>',
      });
      await page.waitForChanges();
      await expect(press(page, 'ArrowDown')).resolves.toBeTruthy();
    });

    it('skips disabled rows', async () => {
      const page = await newSpecPage({
        components: [MdList, MdListItem],
        html: `<md-list>
          <md-list-item headline="One" type="button"></md-list-item>
          <md-list-item headline="Two" type="button" disabled></md-list-item>
          <md-list-item headline="Three" type="button"></md-list-item>
        </md-list>`,
      });
      await page.waitForChanges();
      await press(page, 'ArrowDown');
      await press(page, 'ArrowDown');
      // A disabled row is not a focus stop.
      const idx = tabbableIndex(page);
      expect(idx).not.toBe(1);
    });
  });

  describe('typeahead', () => {
    it('jumps to the row whose headline starts with the typed letter', async () => {
      const page = await create(['Apple', 'Banana', 'Cherry']);
      await press(page, 'c');
      expect(tabbableIndex(page)).toBe(2);
    });

    it('accumulates a multi-letter buffer', async () => {
      const page = await create(['Banana', 'Berlin', 'Bergen']);
      await press(page, 'b');
      await press(page, 'e');
      await press(page, 'r');
      await press(page, 'l');
      expect(tabbableIndex(page)).toBe(1);
    });

    it('is case-insensitive', async () => {
      const page = await create(['Apple', 'Banana']);
      await press(page, 'B');
      expect(tabbableIndex(page)).toBe(1);
    });

    it('does nothing when nothing matches', async () => {
      const page = await create(['Apple', 'Banana']);
      const before = tabbableIndex(page);
      await press(page, 'z');
      expect(tabbableIndex(page)).toBe(before);
    });

    it('forgets the buffer after the timeout', async () => {
      const page = await create(['Banana', 'Apple']);
      await press(page, 'b');
      expect(tabbableIndex(page)).toBe(0);
      // Real timers on purpose: fake ones gate the render queue that
      // waitForChanges awaits, and the two deadlock by construction.
      await new Promise((r) => setTimeout(r, 600));
      // A fresh buffer, so "a" matches Apple rather than extending to "ba".
      await press(page, 'a');
      expect(tabbableIndex(page)).toBe(1);
    });
  });
});

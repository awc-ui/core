import { newSpecPage } from '@stencil/core/testing';
import { MdMenu } from './md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import type { VirtualMenuProvider } from '../../utils/types';

/**
 * The virtualized navigation path: with a provider registered, arrows,
 * Home/End, typeahead and roving focus run against the DATA MODEL rather than
 * the DOM, so a windowed list of millions behaves like an ordinary menu.
 *
 * None of it was covered — every existing test drives the DOM path, and the
 * provider path is only entered once `setVirtualProvider` has been called.
 */
async function create(html = '<md-menu open></md-menu>') {
  return newSpecPage({ components: [MdMenu, MdMenuItem], html });
}

type Menu = HTMLElement & {
  open: boolean;
  setVirtualProvider(p: VirtualMenuProvider | null): Promise<void>;
};

/** A provider over a synthetic list, recording what the menu asked for. */
function makeProvider(
  labels: string[],
  opts: { disabled?: number[]; windowed?: boolean } = {},
) {
  const disabled = new Set(opts.disabled ?? []);
  const ensured: number[] = [];
  const items = new Map<number, HTMLElement>();
  const provider: VirtualMenuProvider = {
    count: () => labels.length,
    labelAt: (i) => labels[i] ?? '',
    isDisabledAt: (i) => disabled.has(i),
    ensureVisible: (i) => {
      ensured.push(i);
      return Promise.resolve();
    },
    domItemForIndex: (i) => {
      // `windowed: false` models a row scrolled out of the rendered window.
      if (opts.windowed === false) return null;
      if (!items.has(i)) {
        const el = document.createElement('md-menu-item') as HTMLElement;
        el.textContent = labels[i] ?? '';
        items.set(i, el);
      }
      return items.get(i)!;
    },
    findPrefix: (buffer, from) => {
      const n = labels.length;
      for (let k = 0; k < n; k++) {
        const i = (from + k) % n;
        if (labels[i].toLowerCase().startsWith(buffer.toLowerCase())) return i;
      }
      return -1;
    },
  };
  return { provider, ensured, items };
}

const key = (el: HTMLElement, k: string, init: Partial<KeyboardEvent> = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, ...init });
  el.dispatchEvent(ev);
  return ev;
};

const LABELS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

async function withProvider(labels = LABELS, opts: Parameters<typeof makeProvider>[1] = {}) {
  const page = await create();
  const menu = page.root as Menu;
  const p = makeProvider(labels, opts);
  await menu.setVirtualProvider(p.provider);
  await page.waitForChanges();
  return { page, menu, ...p };
}

describe('md-menu — virtual provider', () => {
  describe('registration', () => {
    it('drops the menu semantics from the surface', async () => {
      const { page } = await withProvider();
      const surface = page.root?.shadowRoot?.querySelector('[role]');
      // In listbox mode the surface is only a presentational container — the
      // real role="listbox" is rendered by the HOST (md-select) so its
      // aria-controls IDREF resolves in the same shadow root.
      expect(surface?.getAttribute('role')).toBe('presentation');
      expect(surface?.getAttribute('aria-orientation')).toBeNull();
    });

    it('reverts to menu semantics when the provider is cleared', async () => {
      const { page, menu } = await withProvider();
      await menu.setVirtualProvider(null);
      await page.waitForChanges();
      const surface = page.root?.shadowRoot?.querySelector('[role]');
      expect(surface?.getAttribute('role')).toBe('menu');
      expect(surface?.getAttribute('aria-orientation')).toBe('vertical');
    });
  });

  describe('arrow navigation', () => {
    it('moves to the first row on ArrowDown', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'ArrowDown');
      expect(ensured[ensured.length - 1]).toBe(0);
    });

    it('steps forward one row at a time', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'ArrowDown');
      key(menu, 'ArrowDown');
      key(menu, 'ArrowDown');
      expect(ensured).toEqual([0, 1, 2]);
    });

    it('steps backward on ArrowUp', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'ArrowDown');
      key(menu, 'ArrowDown');
      key(menu, 'ArrowUp');
      expect(ensured[ensured.length - 1]).toBe(0);
    });

    it('wraps past the end', async () => {
      const { menu, ensured } = await withProvider(['A', 'B']);
      key(menu, 'ArrowDown'); // 0
      key(menu, 'ArrowDown'); // 1
      key(menu, 'ArrowDown'); // wraps to 0
      expect(ensured[ensured.length - 1]).toBe(0);
    });

    it('wraps backward from the top', async () => {
      const { menu, ensured } = await withProvider(['A', 'B', 'C']);
      key(menu, 'ArrowDown'); // 0
      key(menu, 'ArrowUp'); // wraps to the last
      expect(ensured[ensured.length - 1]).toBe(2);
    });

    it('skips disabled rows', async () => {
      const { menu, ensured } = await withProvider(LABELS, { disabled: [1, 2] });
      key(menu, 'ArrowDown'); // 0
      key(menu, 'ArrowDown'); // skips 1 and 2
      expect(ensured[ensured.length - 1]).toBe(3);
    });

    it('goes nowhere when every row is disabled', async () => {
      const { menu, ensured } = await withProvider(['A', 'B'], { disabled: [0, 1] });
      key(menu, 'ArrowDown');
      expect(ensured).toEqual([]);
    });

    it('handles an empty list', async () => {
      const { menu, ensured } = await withProvider([]);
      expect(() => key(menu, 'ArrowDown')).not.toThrow();
      expect(ensured).toEqual([]);
    });

    it('prevents the default so the page does not scroll', async () => {
      const { menu } = await withProvider();
      expect(key(menu, 'ArrowDown').defaultPrevented).toBe(true);
      expect(key(menu, 'ArrowUp').defaultPrevented).toBe(true);
    });
  });

  describe('Home / End', () => {
    it('Home goes to the first enabled row', async () => {
      const { menu, ensured } = await withProvider(LABELS, { disabled: [0] });
      key(menu, 'End');
      key(menu, 'Home');
      expect(ensured[ensured.length - 1]).toBe(1);
    });

    it('End goes to the last enabled row', async () => {
      const { menu, ensured } = await withProvider(LABELS, { disabled: [4] });
      key(menu, 'End');
      expect(ensured[ensured.length - 1]).toBe(3);
    });
  });

  describe('typeahead', () => {
    it('jumps to the first row matching a typed letter', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'g'); // Gamma
      expect(ensured[ensured.length - 1]).toBe(2);
    });

    it('accumulates a multi-letter buffer', async () => {
      const { menu, ensured } = await withProvider(['Delta', 'Denver', 'Dallas']);
      key(menu, 'd');
      key(menu, 'e');
      key(menu, 'n');
      expect(ensured[ensured.length - 1]).toBe(1);
    });

    it('ignores a letter typed into a search input', async () => {
      const { page, menu, ensured } = await withProvider();
      const input = document.createElement('input');
      page.root?.appendChild(input);
      // Keystrokes in the header field type into it; only navigation keys are
      // intercepted for the list.
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
      expect(ensured).toEqual([]);
    });

    it('ignores modified keystrokes', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'g', { ctrlKey: true });
      key(menu, 'g', { metaKey: true });
      key(menu, 'g', { altKey: true });
      expect(ensured).toEqual([]);
    });

    it('does nothing when nothing matches', async () => {
      const { menu, ensured } = await withProvider();
      key(menu, 'z');
      expect(ensured).toEqual([]);
    });
  });

  describe('Escape / Tab', () => {
    // `quick` so close() resolves synchronously — otherwise it defers behind
    // the close animation and `open` is still true on the next tick.
    const quickProvider = async () => {
      const page = await create('<md-menu open quick></md-menu>');
      const menu = page.root as Menu;
      const p = makeProvider(LABELS);
      await menu.setVirtualProvider(p.provider);
      await page.waitForChanges();
      return { page, menu, ...p };
    };

    it('Escape closes the menu', async () => {
      const { page, menu } = await quickProvider();
      key(menu, 'Escape');
      await page.waitForChanges();
      expect(menu.open).toBe(false);
    });

    it('Tab closes the tree and stops propagating', async () => {
      const { page, menu } = await quickProvider();
      const ev = key(menu, 'Tab');
      await page.waitForChanges();
      expect(menu.open).toBe(false);
      // Otherwise an ancestor menu would also act on the same Tab.
      expect(ev.cancelBubble).toBe(true);
    });
  });

  describe('rows outside the rendered window', () => {
    it('still navigates when no DOM node exists for the row', async () => {
      // The whole point of the provider: focus follows the data model, so a row
      // that is scrolled out of the window is still reachable.
      const { menu, ensured } = await withProvider(LABELS, { windowed: false });
      key(menu, 'ArrowDown');
      key(menu, 'ArrowDown');
      expect(ensured).toEqual([0, 1]);
    });
  });
});

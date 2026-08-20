import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdTabs } from './md-tabs';
import { MdTab } from '../md-tab/md-tab';

/**
 * Arrow navigation and its wrapping, including how it treats disabled tabs and
 * RTL.
 *
 * The handler resolves the origin from `composedPath()[0]`, which mock-doc's
 * synthetic events do not provide — so a plain dispatch fell through to the
 * deep-activeElement walk, found nothing, and returned at `currentIndex === -1`.
 * These events carry a composedPath, which is what the real thing does.
 */
async function create(tabs: string[], attrs = '', disabled: number[] = []) {
  const page = await newSpecPage({
    components: [MdTabs, MdTab],
    html: `<md-tabs ${attrs}>${tabs
      .map((t, i) => `<md-tab id="t${i}" ${disabled.includes(i) ? 'disabled' : ''}>${t}</md-tab>`)
      .join('')}</md-tabs>`,
  });
  await page.waitForChanges();
  return page;
}

const tabs = (page: SpecPage) => Array.from(page.root!.querySelectorAll('md-tab')) as HTMLElement[];

/** Record which tab each focus() landed on — mock-doc will not move focus. */
function watchFocus(page: SpecPage) {
  const focused: string[] = [];
  for (const t of tabs(page)) t.focus = () => focused.push(t.id);
  return focused;
}

/** A keydown whose composedPath names its origin, as a real event does. */
function key(page: SpecPage, from: HTMLElement, k: string) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true }) as KeyboardEvent & {
    composedPath?: () => EventTarget[];
  };
  ev.composedPath = () => [from, page.root!];
  page.root!.dispatchEvent(ev);
  return ev;
}

const THREE = ['One', 'Two', 'Three'];

describe('md-tabs — keyboard', () => {
  describe('arrows', () => {
    it('moves to the next tab on ArrowRight', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('moves back on ArrowLeft', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('wraps past the last tab', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('wraps backward from the first tab', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('prevents the default so the page does not scroll sideways', async () => {
      const page = await create(THREE);
      watchFocus(page);
      expect(key(page, tabs(page)[0], 'ArrowRight').defaultPrevented).toBe(true);
      expect(key(page, tabs(page)[0], 'ArrowLeft').defaultPrevented).toBe(true);
    });
  });

  describe('Home / End', () => {
    it('Home goes to the first tab, End to the last', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'End');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
      key(page, tabs(page)[1], 'Home');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('Home and End skip disabled tabs at the ends', async () => {
      const page = await create(['One', 'Two', 'Three', 'Four'], '', [0, 3]);
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'End');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
      key(page, tabs(page)[2], 'Home');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });
  });

  describe('disabled tabs', () => {
    it('steps over a disabled tab', async () => {
      const page = await create(THREE, '', [1]);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('stays put when every other tab is disabled', async () => {
      const page = await create(THREE, '', [1, 2]);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      // Wrapping back to itself is not a move, so nothing is focused again.
      expect(focused).toHaveLength(0);
    });
  });

  describe('RTL', () => {
    /**
     * `isRtl()` reads the COMPUTED direction, and mock-doc does not derive that
     * from a `dir` attribute — so the attribute alone leaves the component in
     * LTR and the arrows read the wrong way round.
     */
    function forceRtl() {
      const win = globalThis as unknown as { getComputedStyle?: unknown };
      const prev = win.getComputedStyle;
      win.getComputedStyle = () => ({ direction: 'rtl', getPropertyValue: () => '' });
      return () => {
        win.getComputedStyle = prev;
      };
    }

    it('follows VISUAL direction, so ArrowRight moves toward lower indexes', async () => {
      const page = await create(THREE, 'dir="rtl"');
      const restore = forceRtl();
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
      restore();
    });

    it('and ArrowLeft moves toward higher indexes', async () => {
      const page = await create(THREE, 'dir="rtl"');
      const restore = forceRtl();
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
      restore();
    });
  });

  describe('non-navigation keys', () => {
    it('leaves other keys to the browser', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      const ev = key(page, tabs(page)[0], 'a');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
      expect(focused).toHaveLength(0);
    });

    it('ignores a keystroke that did not come from a tab', async () => {
      const page = await create(THREE);
      const focused = watchFocus(page);
      const stray = document.createElement('div');
      key(page, stray, 'ArrowRight');
      await page.waitForChanges();
      expect(focused).toHaveLength(0);
    });

    it('does nothing with no tabs at all', async () => {
      const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs></md-tabs>' });
      await page.waitForChanges();
      const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      expect(() => page.root!.dispatchEvent(ev)).not.toThrow();
    });
  });

  describe('activation', () => {
    it('activates the tab it moves to, so the panel follows focus', async () => {
      const page = await create(THREE);
      watchFocus(page);
      const onChange = jest.fn();
      page.root!.addEventListener('mdTabChange', onChange);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(onChange).toHaveBeenCalled();
    });
  });
});

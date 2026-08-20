import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdNavigationBar } from './md-navigation-bar';
import { MdNavigationTab } from '../md-navigation-tab/md-navigation-tab';

/**
 * Arrow navigation across the bar.
 *
 * The handler identifies the focused tab from `composedPath()[0]`, which
 * mock-doc's synthetic events do not carry — so a plain dispatch found no
 * focused tab and returned at `focusedIndex === -1`. These events supply one,
 * as a real event does.
 */
async function create(tabs: number, disabled: number[] = [], attrs = '') {
  const page = await newSpecPage({
    components: [MdNavigationBar, MdNavigationTab],
    html: `<md-navigation-bar ${attrs}>${Array.from(
      { length: tabs },
      (_, i) => `<md-navigation-tab id="t${i}" label="Tab ${i}" icon="home" ${
        disabled.includes(i) ? 'disabled' : ''
      }></md-navigation-tab>`,
    ).join('')}</md-navigation-bar>`,
  });
  await page.waitForChanges();
  return page;
}

const tabs = (page: SpecPage) =>
  Array.from(page.root!.querySelectorAll('md-navigation-tab')) as HTMLElement[];

/** Record which tab each focus() landed on — mock-doc will not move focus. */
function watchFocus(page: SpecPage) {
  const focused: string[] = [];
  for (const t of tabs(page)) t.focus = () => focused.push(t.id);
  return focused;
}

function key(page: SpecPage, from: HTMLElement, k: string) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true }) as KeyboardEvent & {
    composedPath?: () => EventTarget[];
  };
  ev.composedPath = () => [from, page.root!];
  page.root!.dispatchEvent(ev);
  return ev;
}

/** `isRTL` reads the COMPUTED direction, which mock-doc will not derive from
 *  a `dir` attribute. */
function forceRtl() {
  const win = globalThis as unknown as { getComputedStyle?: unknown };
  const prev = win.getComputedStyle;
  win.getComputedStyle = () => ({ direction: 'rtl', getPropertyValue: () => '' });
  return () => {
    win.getComputedStyle = prev;
  };
}

describe('md-navigation-bar — keyboard', () => {
  describe('arrows', () => {
    it('moves to the next tab', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('moves back', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('wraps at both ends', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
      key(page, tabs(page)[0], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('prevents the default so the page does not scroll', async () => {
      const page = await create(3);
      watchFocus(page);
      expect(key(page, tabs(page)[0], 'ArrowRight').defaultPrevented).toBe(true);
      expect(key(page, tabs(page)[0], 'ArrowLeft').defaultPrevented).toBe(true);
    });

    it('steps over a disabled tab', async () => {
      const page = await create(3, [1]);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('stays put when it is the only enabled tab', async () => {
      const page = await create(3, [1, 2]);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      // Landing back on itself is not a move.
      expect(focused).toHaveLength(0);
    });
  });

  describe('Home / End', () => {
    it('jumps to the first and last tabs', async () => {
      const page = await create(4);
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'End');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t3');
      key(page, tabs(page)[1], 'Home');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('skips disabled tabs at the ends', async () => {
      const page = await create(4, [0, 3]);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'Home');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
      key(page, tabs(page)[1], 'End');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });
  });

  describe('RTL', () => {
    it('follows visual direction, so ArrowRight moves toward lower indexes', async () => {
      const page = await create(3);
      const restore = forceRtl();
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
      restore();
    });

    it('and ArrowLeft toward higher ones', async () => {
      const page = await create(3);
      const restore = forceRtl();
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'ArrowLeft');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
      restore();
    });
  });

  describe('keys it leaves alone', () => {
    it('ignores an unrelated key', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      const ev = key(page, tabs(page)[0], 'a');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
      expect(focused).toHaveLength(0);
    });

    it('ignores a keystroke from outside any tab', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, document.createElement('div'), 'ArrowRight');
      await page.waitForChanges();
      expect(focused).toHaveLength(0);
    });

    it('does nothing with no tabs', async () => {
      const page = await create(0);
      const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      expect(() => page.root!.dispatchEvent(ev)).not.toThrow();
    });
  });
});

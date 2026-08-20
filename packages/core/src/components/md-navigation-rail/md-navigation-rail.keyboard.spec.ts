import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdNavigationRail } from './md-navigation-rail';
import { MdNavigationRailTab } from '../md-navigation-rail-tab/md-navigation-rail-tab';

/**
 * Rail keyboard handling: roving focus across the tabs, and Escape dismissing
 * the modal overlay.
 *
 * Two things the handler needs before it does anything. It finds the current
 * tab by scanning `composedPath()`, which mock-doc's synthetic events do not
 * provide — without one, `currentIndex` stays -1 and every arrow behaves as
 * "nothing focused". And `getTabs()` reads the default slot's assignedElements
 * filtered to `md-navigation-rail-tab`: the rail takes its OWN tab element, not
 * the md-navigation-tab that md-navigation-bar uses, and anything else is
 * simply not a stop.
 */
async function create(tabs: number, disabled: number[] = [], attrs = '') {
  const page = await newSpecPage({
    components: [MdNavigationRail, MdNavigationRailTab],
    html: `<md-navigation-rail ${attrs}>${Array.from(
      { length: tabs },
      (_, i) => `<md-navigation-rail-tab id="t${i}" label="Tab ${i}" icon="home" ${
        disabled.includes(i) ? 'disabled' : ''
      }></md-navigation-rail-tab>`,
    ).join('')}</md-navigation-rail>`,
  });
  await page.waitForChanges();
  return page;
}

const tabs = (page: SpecPage) =>
  Array.from(page.root!.querySelectorAll('md-navigation-rail-tab')) as HTMLElement[];

function watchFocus(page: SpecPage) {
  const focused: string[] = [];
  for (const t of tabs(page)) t.focus = () => focused.push(t.id);
  return focused;
}

/** The handler is bound on the Host itself. */
const surface = (page: SpecPage) => page.root as HTMLElement;

function key(page: SpecPage, from: HTMLElement | null, k: string) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true }) as KeyboardEvent & {
    composedPath?: () => EventTarget[];
  };
  ev.composedPath = () => (from ? [from, page.root!] : [page.root!]);
  surface(page).dispatchEvent(ev);
  return ev;
}

describe('md-navigation-rail — keyboard', () => {
  describe('roving focus', () => {
    it('moves down/right to the next tab', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowDown');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('treats ArrowRight the same as ArrowDown', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowRight');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('moves up/left to the previous tab', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'ArrowUp');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t1');
    });

    it('wraps at both ends', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, tabs(page)[2], 'ArrowDown');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
      key(page, tabs(page)[0], 'ArrowUp');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('starts at the first tab when nothing is focused yet', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, null, 'ArrowDown');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('starts at the LAST tab when arrowing backward from nothing', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      key(page, null, 'ArrowUp');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('Home and End jump to the ends', async () => {
      const page = await create(4);
      const focused = watchFocus(page);
      key(page, tabs(page)[1], 'End');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t3');
      key(page, tabs(page)[1], 'Home');
      await page.waitForChanges();
      expect(focused[focused.length - 1]).toBe('t0');
    });

    it('skips disabled tabs entirely', async () => {
      const page = await create(3, [1]);
      const focused = watchFocus(page);
      key(page, tabs(page)[0], 'ArrowDown');
      await page.waitForChanges();
      // Disabled tabs are filtered out before the walk, so index 1 is not a stop.
      expect(focused[focused.length - 1]).toBe('t2');
    });

    it('prevents the default so the page does not scroll', async () => {
      const page = await create(3);
      watchFocus(page);
      expect(key(page, tabs(page)[0], 'ArrowDown').defaultPrevented).toBe(true);
      expect(key(page, tabs(page)[0], 'End').defaultPrevented).toBe(true);
    });

    it('leaves unrelated keys alone', async () => {
      const page = await create(3);
      const focused = watchFocus(page);
      const ev = key(page, tabs(page)[0], 'a');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
      expect(focused).toHaveLength(0);
    });

    it('does nothing when every tab is disabled', async () => {
      const page = await create(2, [0, 1]);
      const focused = watchFocus(page);
      key(page, null, 'ArrowDown');
      await page.waitForChanges();
      expect(focused).toHaveLength(0);
    });

    it('stands down when focus management is disabled', async () => {
      const page = await create(3, [], 'disable-focus-management');
      const focused = watchFocus(page);
      const ev = key(page, tabs(page)[0], 'ArrowDown');
      await page.waitForChanges();
      // The consumer has taken over; the rail must not fight them for focus.
      expect(focused).toHaveLength(0);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('modal overlay', () => {
    it('Escape collapses an expanded modal rail', async () => {
      const page = await create(3, [], 'modal variant="expanded"');
      const ev = key(page, tabs(page)[0], 'Escape');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(true);
      expect((page.root as HTMLElement & { variant: string }).variant).not.toBe('expanded');
    });

    it('ignores Escape when the rail is not modal', async () => {
      const page = await create(3, [], 'variant="expanded"');
      const ev = key(page, tabs(page)[0], 'Escape');
      await page.waitForChanges();
      // A non-modal rail is not dismissible, so Escape belongs to the page.
      expect(ev.defaultPrevented).toBe(false);
    });

    it('ignores Escape when collapsed', async () => {
      const page = await create(3, [], 'modal');
      const ev = key(page, tabs(page)[0], 'Escape');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
    });
  });
});

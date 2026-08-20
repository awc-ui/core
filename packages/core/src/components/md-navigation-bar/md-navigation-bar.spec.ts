import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdNavigationBar } from './md-navigation-bar';
import { MdNavigationTab } from '../md-navigation-tab/md-navigation-tab';

const THREE_TABS = `
  <md-navigation-bar>
    <md-navigation-tab label="Home" icon="home"></md-navigation-tab>
    <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
    <md-navigation-tab label="Library" icon="library_music"></md-navigation-tab>
  </md-navigation-bar>
`;

async function create(html: string): Promise<SpecPage> {
  return newSpecPage({
    components: [MdNavigationBar, MdNavigationTab],
    html,
  });
}

const tabs = (page: SpecPage): HTMLElement[] =>
  Array.from(page.root?.querySelectorAll('md-navigation-tab') ?? []);

describe('md-navigation-bar', () => {
  // ─── Rendering ───────────────────────────────────────────
  describe('rendering', () => {
    it('renders with three children', async () => {
      const page = await create(THREE_TABS);
      expect(page.root).toBeTruthy();
      expect(tabs(page)).toHaveLength(3);
    });

    it('exposes a tablist container in the shadow root', async () => {
      const page = await create(THREE_TABS);
      const list = page.root?.shadowRoot?.querySelector('[role="tablist"]');
      expect(list).toBeTruthy();
      expect(list?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('forwards the tab count to data-tab-count', async () => {
      const page = await create(THREE_TABS);
      expect(page.root?.getAttribute('data-tab-count')).toBe('3');
    });

    it('renders without any tabs (graceful empty state)', async () => {
      const page = await create('<md-navigation-bar></md-navigation-bar>');
      expect(page.root).toBeTruthy();
      expect(tabs(page)).toHaveLength(0);
    });
  });

  // ─── Accessibility ───────────────────────────────────────
  describe('accessibility', () => {
    it('exposes role="navigation" on the host', async () => {
      const page = await create(THREE_TABS);
      expect(page.root?.getAttribute('role')).toBe('navigation');
    });

    it('sets no aria-label by default (author supplies the landmark name)', async () => {
      const page = await create(THREE_TABS);
      expect(page.root?.hasAttribute('aria-label')).toBe(false);
    });

    it('passes an author-supplied aria-label through to the host', async () => {
      const page = await create(`
        <md-navigation-bar aria-label="Browse sections">
          <md-navigation-tab label="One"></md-navigation-tab>
          <md-navigation-tab label="Two"></md-navigation-tab>
          <md-navigation-tab label="Three"></md-navigation-tab>
        </md-navigation-bar>
      `);
      expect(page.root?.getAttribute('aria-label')).toBe('Browse sections');
    });

    it('renders the inner container as role=tablist with horizontal orientation', async () => {
      const page = await create(THREE_TABS);
      const tablist = page.root?.shadowRoot?.querySelector('[role="tablist"]');
      expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal');
    });
  });

  // ─── Initial selection (roving tabindex + aria-selected) ─
  describe('initial selection', () => {
    it('marks index 0 active by default', async () => {
      const page = await create(THREE_TABS);
      const [home, search, library] = tabs(page);
      expect(home.hasAttribute('active')).toBe(true);
      expect(search.hasAttribute('active')).toBe(false);
      expect(library.hasAttribute('active')).toBe(false);
      expect(home.getAttribute('tabindex')).toBe('0');
      expect(search.getAttribute('tabindex')).toBe('-1');
      expect(library.getAttribute('tabindex')).toBe('-1');
      expect(home.getAttribute('aria-selected')).toBe('true');
      expect(search.getAttribute('aria-selected')).toBe('false');
    });

    it('honors active-index attribute on initial render', async () => {
      const page = await create(`
        <md-navigation-bar active-index="2">
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B"></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const [a, b, c] = tabs(page);
      expect(a.hasAttribute('active')).toBe(false);
      expect(b.hasAttribute('active')).toBe(false);
      expect(c.hasAttribute('active')).toBe(true);
      expect(c.getAttribute('tabindex')).toBe('0');
    });
  });

  // ─── Programmatic selection (watcher path) ───────────────
  describe('programmatic selection', () => {
    it('moves selection when activeIndex changes', async () => {
      const page = await create(THREE_TABS);
      const bar = page.root as HTMLElement;
      (bar as unknown as { activeIndex: number }).activeIndex = 1;
      await page.waitForChanges();
      const [home, search] = tabs(page);
      expect(home.hasAttribute('active')).toBe(false);
      expect(search.hasAttribute('active')).toBe(true);
      expect(search.getAttribute('tabindex')).toBe('0');
    });

    it('clamps out-of-range indices', async () => {
      const page = await create(THREE_TABS);
      const bar = page.root as HTMLElement;
      (bar as unknown as { activeIndex: number }).activeIndex = 42;
      await page.waitForChanges();
      const [, , library] = tabs(page);
      expect(library.hasAttribute('active')).toBe(true);
    });

    it('skips disabled tabs when clamping', async () => {
      const page = await create(`
        <md-navigation-bar>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B" disabled></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const bar = page.root as HTMLElement;
      (bar as unknown as { activeIndex: number }).activeIndex = 1;
      await page.waitForChanges();
      const [a, b, c] = tabs(page);
      // Targeting the disabled middle tab should fall forward to C.
      expect(b.hasAttribute('active')).toBe(false);
      expect(c.hasAttribute('active')).toBe(true);
      expect(a.hasAttribute('active')).toBe(false);
    });
  });

  // ─── Soft-disabled ───────────────────────────────────────
  describe('soft-disabled', () => {
    const SOFT = `
      <md-navigation-bar>
        <md-navigation-tab label="A"></md-navigation-tab>
        <md-navigation-tab label="B" soft-disabled></md-navigation-tab>
        <md-navigation-tab label="C"></md-navigation-tab>
      </md-navigation-bar>
    `;

    it('cannot be selected — clamps forward like hard-disabled', async () => {
      const page = await create(SOFT);
      (page.root as unknown as { activeIndex: number }).activeIndex = 1;
      await page.waitForChanges();
      const [a, b, c] = tabs(page);
      expect(b.hasAttribute('active')).toBe(false);
      expect(c.hasAttribute('active')).toBe(true);
      expect(a.hasAttribute('active')).toBe(false);
    });

    it('stays in the arrow-key tour — nextEnabled lands on it', async () => {
      const page = await create(SOFT);
      const inst = page.rootInstance as unknown as {
        nextEnabled(from: number, dir: 1 | -1): number;
      };
      // Soft-disabled middle tab is reachable (index 1), unlike hard-disabled.
      expect(inst.nextEnabled(0, 1)).toBe(1);
    });

    it('hard-disabled is skipped by nextEnabled (contrast)', async () => {
      const page = await create(`
        <md-navigation-bar>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B" disabled></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const inst = page.rootInstance as unknown as {
        nextEnabled(from: number, dir: 1 | -1): number;
      };
      expect(inst.nextEnabled(0, 1)).toBe(2);
    });
  });

  // ─── Events ──────────────────────────────────────────────
  describe('events', () => {
    // Tabs signal activation with a native, bubbling click (no custom event).
    const clickTab = (tab: HTMLElement) =>
      tab.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));

    it('emits mdChange when a child tab is clicked', async () => {
      const page = await create(THREE_TABS);
      const onChange = jest.fn();
      page.root?.addEventListener('mdChange', onChange);
      const [, search] = tabs(page);
      clickTab(search);
      await page.waitForChanges();
      expect(onChange).toHaveBeenCalledTimes(1);
      const detail = onChange.mock.calls[0][0].detail as { index: number; previousIndex: number };
      expect(detail).toEqual({ index: 1, previousIndex: 0 });
    });

    it('does not re-emit when reselecting the active tab', async () => {
      const page = await create(THREE_TABS);
      const onChange = jest.fn();
      page.root?.addEventListener('mdChange', onChange);
      const [home] = tabs(page);
      clickTab(home);
      await page.waitForChanges();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not select when the clicked tab is disabled', async () => {
      const page = await create(`
        <md-navigation-bar>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B" disabled></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const onChange = jest.fn();
      page.root?.addEventListener('mdChange', onChange);
      const [, b] = tabs(page);
      clickTab(b);
      await page.waitForChanges();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not select when the clicked tab is soft-disabled', async () => {
      const page = await create(`
        <md-navigation-bar>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B" soft-disabled></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const onChange = jest.fn();
      page.root?.addEventListener('mdChange', onChange);
      const [, b] = tabs(page);
      clickTab(b);
      await page.waitForChanges();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Public API: select() ────────────────────────────────
  describe('select() method', () => {
    it('selects a tab by index', async () => {
      const page = await create(THREE_TABS);
      const bar = page.root as unknown as { select: (i: number) => Promise<void> };
      await bar.select(2);
      await page.waitForChanges();
      const [, , library] = tabs(page);
      expect(library.hasAttribute('active')).toBe(true);
    });

    it('is a no-op when selecting the already-active tab', async () => {
      const page = await create(THREE_TABS);
      const onChange = jest.fn();
      page.root?.addEventListener('mdChange', onChange);
      const bar = page.root as unknown as { select: (i: number) => Promise<void> };
      await bar.select(0);
      await page.waitForChanges();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ─── Label behavior propagation ──────────────────────────
  describe('label behavior', () => {
    it('propagates labelBehavior=always to children by default', async () => {
      const page = await create(THREE_TABS);
      tabs(page).forEach(t => {
        expect(t.getAttribute('data-md-inherited-label-behavior')).toBe('always');
      });
    });

    it('propagates labelBehavior=selected to children', async () => {
      const page = await create(`
        <md-navigation-bar label-behavior="selected">
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B"></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      tabs(page).forEach(t => {
        expect(t.getAttribute('data-md-inherited-label-behavior')).toBe('selected');
      });
    });

    it('propagates labelBehavior=none to children', async () => {
      const page = await create(`
        <md-navigation-bar label-behavior="none">
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B"></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);
      tabs(page).forEach(t => {
        expect(t.getAttribute('data-md-inherited-label-behavior')).toBe('none');
      });
    });

    it('does NOT override a child that sets its own label-behavior', async () => {
      const page = await create(`
        <md-navigation-bar label-behavior="none">
          <md-navigation-tab label="A" label-behavior="always"></md-navigation-tab>
          <md-navigation-tab label="B"></md-navigation-tab>
        </md-navigation-bar>
      `);
      const [a, b] = tabs(page);
      // A keeps its own value (no data marker because we never wrote one).
      expect(a.getAttribute('label-behavior')).toBe('always');
      expect(a.hasAttribute('data-md-inherited-label-behavior')).toBe(false);
      expect(b.getAttribute('data-md-inherited-label-behavior')).toBe('none');
    });
  });
});

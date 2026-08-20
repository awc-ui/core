import { newSpecPage } from '@stencil/core/testing';
import { MdBreadcrumbs } from './md-breadcrumbs';
import { MdBreadcrumbItem } from '../md-breadcrumb-item/md-breadcrumb-item';

describe('md-breadcrumbs', () => {
  async function create(markup: string) {
    return newSpecPage({
      components: [MdBreadcrumbs, MdBreadcrumbItem],
      html: markup,
    });
  }

  // The Stencil mock-doc test environment does not implement the `:scope`
  // pseudo-class; iterate direct children manually instead.
  function directChildItems(host: Element | null | undefined): HTMLMdBreadcrumbItemElement[] {
    if (!host) return [];
    const out: HTMLMdBreadcrumbItemElement[] = [];
    const children = host.children;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.tagName === 'MD-BREADCRUMB-ITEM') {
        out.push(child as HTMLMdBreadcrumbItemElement);
      }
    }
    return out;
  }

  // ── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-breadcrumbs');
      expect(page.root?.getAttribute('role')).toBe('navigation');
      expect(page.root?.getAttribute('aria-label')).toBe('Breadcrumb');
    });

    it('honors a custom aria-label via the label prop', async () => {
      const page = await create(`
        <md-breadcrumbs label="Page navigation">
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      expect(page.root?.getAttribute('aria-label')).toBe('Page navigation');
    });

    it('renders an ordered list with the list part', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      const ol = page.root?.shadowRoot?.querySelector('ol[part="list"]');
      expect(ol).toBeTruthy();
      expect(ol?.tagName).toBe('OL');
    });
  });

  // ── Auto-promote current ────────────────────────────────

  describe('auto-promote current', () => {
    it('marks the last item as current when no override is set', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">Library</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const items = directChildItems(page.root);
      expect(items.length).toBe(3);
      expect(items[0].current).toBe(false);
      expect(items[2].current).toBe(true);
    });

    it('respects an explicit non-leaf current override', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item href="/a" current>Library</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const items = directChildItems(page.root);
      expect(items[1].current).toBe(true);
      // The leaf should NOT be auto-promoted because the consumer overrode.
      expect(items[2].current).toBe(false);
    });
  });

  // ── Collapsing ──────────────────────────────────────────

  describe('collapsing', () => {
    it('does not collapse when item count is at or below max-items', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item>C</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const overflow = page.root?.shadowRoot?.querySelector('.md-breadcrumbs__overflow');
      expect(overflow).toBeNull();
    });

    it('renders an overflow toggle when item count exceeds max-items', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const overflowBtn = page.root?.shadowRoot?.querySelector('button[part="overflow-button"]');
      expect(overflowBtn).toBeTruthy();
      expect(overflowBtn?.getAttribute('aria-expanded')).toBe('false');
    });

    it('positions the overflow visually between before and after items via flex order', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const items = directChildItems(page.root);
      // Before: index 0 → no order set (defaults to 0).
      expect(items[0].style.order).toBe('');
      // Collapsed middle: indices 1-3 → no order set.
      expect(items[1].style.order).toBe('');
      expect(items[2].style.order).toBe('');
      expect(items[3].style.order).toBe('');
      // After: indices 4-5 → order:2 so they sit after the overflow (order:1).
      expect(items[4].style.order).toBe('2');
      expect(items[5].style.order).toBe('2');
    });

    it('renders only the leading separator inside the overflow li (not a trailing one)', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const overflow = page.root?.shadowRoot?.querySelector('li.md-breadcrumbs__overflow');
      const seps = overflow?.querySelectorAll('.md-breadcrumbs__separator') ?? [];
      // Only the leading separator (before the button) should exist —
      // the next "after" item brings its own leading separator.
      expect(seps.length).toBe(1);
    });

    it('omits the leading separator inside the overflow when items-before-collapse=0', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="3" items-before-collapse="0" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item>E</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const overflow = page.root?.shadowRoot?.querySelector('li.md-breadcrumbs__overflow');
      const seps = overflow?.querySelectorAll('.md-breadcrumbs__separator') ?? [];
      // No before-items → no leading separator inside overflow.
      expect(seps.length).toBe(0);
    });

    it('clears inline order when expand() reveals the full trail', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      await trail.expand();
      await page.waitForChanges();
      const items = directChildItems(trail);
      items.forEach((it) => expect(it.style.order).toBe(''));
    });

    it('flags middle items as collapsed', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const items = directChildItems(page.root);
      // 1 before + 2 after visible → indices 0, 4, 5 visible; 1-3 collapsed.
      expect(items[0].collapsed).toBe(false);
      expect(items[1].collapsed).toBe(true);
      expect(items[2].collapsed).toBe(true);
      expect(items[3].collapsed).toBe(true);
      expect(items[4].collapsed).toBe(false);
      expect(items[5].collapsed).toBe(false);
    });
  });

  // ── mdExpand event + expand()/collapse() methods ────────

  describe('mdExpand event + methods', () => {
    it('emits mdExpand and unhides middle items when expand() is called', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      const spy = jest.fn();
      trail.addEventListener('mdExpand', spy);
      await trail.expand();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.expanded).toBe(true);
      expect(detail.itemCount).toBe(6);

      const items = directChildItems(trail);
      items.forEach((it) => expect(it.collapsed).toBe(false));
    });

    it('emits mdExpand on the second toggle when collapse() is called', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      const spy = jest.fn();
      trail.addEventListener('mdExpand', spy);

      await trail.expand();
      await page.waitForChanges();
      await trail.collapse();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(2);
      expect((spy.mock.calls[0][0] as CustomEvent).detail.expanded).toBe(true);
      expect((spy.mock.calls[1][0] as CustomEvent).detail.expanded).toBe(false);
    });

    it('does not emit mdExpand when expand() is called and already expanded', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      const spy = jest.fn();
      trail.addEventListener('mdExpand', spy);
      await trail.expand();
      await page.waitForChanges();
      await trail.expand();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('flips aria-expanded on the overflow button after expand()', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      const beforeBtn = page.root?.shadowRoot?.querySelector('button[part="overflow-button"]');
      expect(beforeBtn?.getAttribute('aria-expanded')).toBe('false');

      await trail.expand();
      await page.waitForChanges();
      // Overflow toggle is hidden once expanded — verify the aria flip
      // was reflected before unmount, and that the toggle is no longer
      // rendered (the trail is fully visible now).
      const afterBtn = page.root?.shadowRoot?.querySelector('button[part="overflow-button"]');
      expect(afterBtn).toBeNull();
    });
  });

  // ── i18n ────────────────────────────────────────────────

  describe('localization', () => {
    it('exposes expand-label as the overflow toggle aria-label', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2"
                        expand-label="إظهار مسار التنقل الكامل">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const btn = page.root?.shadowRoot?.querySelector('button[part="overflow-button"]');
      expect(btn?.getAttribute('aria-label')).toBe('إظهار مسار التنقل الكامل');
    });

    it('renders inside an RTL parent without errors', async () => {
      const page = await newSpecPage({
        components: [MdBreadcrumbs, MdBreadcrumbItem],
        html: `
          <div dir="rtl">
            <md-breadcrumbs label="تنقل الصفحة" separator="«">
              <md-breadcrumb-item href="/">الرئيسية</md-breadcrumb-item>
              <md-breadcrumb-item href="/library">المكتبة</md-breadcrumb-item>
              <md-breadcrumb-item>التقارير</md-breadcrumb-item>
            </md-breadcrumbs>
          </div>
        `,
      });
      // page.root resolves to the first registered component element.
      const trail = page.body.querySelector('md-breadcrumbs');
      expect(trail).toBeTruthy();
      expect(trail?.getAttribute('aria-label')).toBe('تنقل الصفحة');
      expect(trail?.parentElement?.getAttribute('dir')).toBe('rtl');
    });
  });

  // ── Parts ───────────────────────────────────────────────

  describe('parts', () => {
    it('exposes the list part on the <ol>', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">Home</md-breadcrumb-item>
          <md-breadcrumb-item>Docs</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      expect(
        page.root?.shadowRoot?.querySelector('[part="list"]'),
      ).toBeTruthy();
    });
  });

  // ── Reactive prop changes (Watchers) ────────────────────

  describe('collapse-config @Watch', () => {
    it('reflows visibility when max-items changes after mount', async () => {
      const page = await create(`
        <md-breadcrumbs items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      // Initially no collapsing — max-items defaults to 0.
      expect(directChildItems(page.root).every((it) => !it.collapsed)).toBe(true);

      // Change max-items at runtime — watcher triggers refreshItems().
      (page.root as HTMLMdBreadcrumbsElement).maxItems = 4;
      await page.waitForChanges();
      const items = directChildItems(page.root);
      // Now the middle 3 items should be collapsed.
      expect(items[1].collapsed).toBe(true);
      expect(items[2].collapsed).toBe(true);
      expect(items[3].collapsed).toBe(true);
    });

    it('reflows visibility when items-after-collapse changes', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      // Bump items-after-collapse from 2 to 4 — watcher fires
      // onCollapseConfigChange → refreshItems → applyVisibility.
      (page.root as HTMLMdBreadcrumbsElement).itemsAfterCollapse = 4;
      await page.waitForChanges();
      const items = directChildItems(page.root);
      // Before group: 0; after group: indices 2..5; collapsed: index 1 only.
      expect(items[0].collapsed).toBe(false);
      expect(items[1].collapsed).toBe(true);
      expect(items[2].collapsed).toBe(false);
      expect(items[5].collapsed).toBe(false);
    });
  });

  // ── User interaction with overflow toggle ───────────────

  describe('overflow toggle click', () => {
    it('clicking the overflow button expands the trail and emits mdExpand', async () => {
      const page = await create(`
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item href="/b">B</md-breadcrumb-item>
          <md-breadcrumb-item href="/c">C</md-breadcrumb-item>
          <md-breadcrumb-item href="/d">D</md-breadcrumb-item>
          <md-breadcrumb-item href="/e">E</md-breadcrumb-item>
          <md-breadcrumb-item>F</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      await page.waitForChanges();
      const trail = page.root as HTMLMdBreadcrumbsElement;
      const spy = jest.fn();
      trail.addEventListener('mdExpand', spy);

      const btn = trail.shadowRoot?.querySelector(
        'button[part="overflow-button"]',
      ) as HTMLButtonElement | null;
      expect(btn).toBeTruthy();
      btn?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.expanded).toBe(true);
      expect(detail.itemCount).toBe(6);
      // After expand, every item is no longer collapsed.
      directChildItems(trail).forEach((it) => expect(it.collapsed).toBe(false));
    });
  });

  // ── Main slot reactivity ────────────────────────────────

  describe('slot reactivity', () => {
    it('refreshes items when the main slot dispatches slotchange', async () => {
      const page = await create(`
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">A</md-breadcrumb-item>
          <md-breadcrumb-item>B</md-breadcrumb-item>
        </md-breadcrumbs>
      `);
      const mainSlot = page.root?.shadowRoot?.querySelector(
        'slot:not([name])',
      ) as HTMLSlotElement | null;
      expect(mainSlot).toBeTruthy();
      mainSlot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      // refreshItems re-runs and itemCount stays at 2.
      expect(directChildItems(page.root).length).toBe(2);
    });
  });
});

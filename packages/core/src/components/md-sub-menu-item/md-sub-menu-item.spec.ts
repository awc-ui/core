import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdSubMenuItem } from './md-sub-menu-item';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';

async function createItem(html: string): Promise<SpecPage> {
  return newSpecPage({ components: [MdSubMenuItem], html });
}

async function createItemWithSubmenu(html: string): Promise<SpecPage> {
  return newSpecPage({ components: [MdSubMenuItem, MdMenu, MdMenuItem], html });
}

describe('md-sub-menu-item', () => {
  afterEach(() => { jest.useRealTimers(); });
  // ── Rendering ──

  it('renders with defaults', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-sub-menu-item')).toBe(true);
  });

  it('renders headline', async () => {
    const page = await createItem(`<md-sub-menu-item headline="Share with"></md-sub-menu-item>`);
    const headline = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__headline');
    expect(headline?.textContent).toBe('Share with');
  });

  it('renders supporting text', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" supporting-text="Additional options"></md-sub-menu-item>`);
    const supporting = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__supporting');
    expect(supporting?.textContent).toBe('Additional options');
  });

  it('does not render supporting text when empty', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const supporting = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__supporting');
    expect(supporting).toBeFalsy();
  });

  it('renders leading-icon slot when content is provided', async () => {
    const page = await createItem(`<md-sub-menu-item headline="Share"><span slot="leading-icon">S</span></md-sub-menu-item>`);
    const wrapper = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__leading');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute('part')).toBe('leading-icon');
  });

  it('does not render leading-icon wrapper without slot content', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const wrapper = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__leading');
    expect(wrapper).toBeFalsy();
  });

  it('renders trailing arrow icon', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const arrow = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__arrow');
    expect(arrow).toBeTruthy();
    expect(arrow?.textContent?.trim()).toBe('arrow_right');
  });

  it('renders submenu slot', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('slot[name="submenu"]')).toBeTruthy();
  });

  it('renders md-ripple', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
  });

  it('renders state layer', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const stateLayer = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__state-layer');
    expect(stateLayer).toBeTruthy();
    expect(stateLayer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders badge when set', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" badge="3"></md-sub-menu-item>`);
    const badge = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('3');
    expect(badge?.getAttribute('part')).toBe('badge');
  });

  it('does not render badge when empty', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const badge = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__badge');
    expect(badge).toBeFalsy();
  });

  // ── States ──

  it('starts with submenu closed', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.classList.contains('md-sub-menu-item--open')).toBe(false);
    expect(page.root?.getAttribute('aria-expanded')).toBe('false');
  });

  it('applies disabled class', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    expect(page.root?.classList.contains('md-sub-menu-item--disabled')).toBe(true);
  });

  it('applies divider class', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" divider></md-sub-menu-item>`);
    expect(page.root?.classList.contains('md-sub-menu-item--divider')).toBe(true);
  });

  it('applies gap class', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" gap></md-sub-menu-item>`);
    expect(page.root?.classList.contains('md-sub-menu-item--gap')).toBe(true);
  });

  // ── Events ──

  it('emits mdClick on click', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdClick when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Keyboard navigation ──

  it('ArrowRight opens submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  it('Enter opens submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  it('Space opens submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  it('ArrowLeft closes open submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-expanded')).toBe('true');

    jest.useFakeTimers();
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('Escape closes open submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('ArrowLeft handleKeyDown closes submenu and refocuses host', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    const event = {
      key: 'ArrowLeft',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as KeyboardEvent;
    page.rootInstance.handleKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('Escape handleKeyDown closes submenu', async () => {
    const page = await createItemWithSubmenu(`
      <md-sub-menu-item headline="More">
        <md-menu slot="submenu">
          <md-menu-item headline="Option A"></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
    `);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    const event = {
      key: 'Escape',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as KeyboardEvent;
    page.rootInstance.handleKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('ArrowLeft does not stop propagation when submenu is closed', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    const stopSpy = jest.spyOn(event, 'stopPropagation');
    page.root?.dispatchEvent(event);
    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('keyboard navigation is a no-op when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  // ── openSubmenu / closeSubmenu ──

  it('openSubmenu sets submenuOpen to true', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  it('openSubmenu is a no-op when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('closeSubmenu sets submenuOpen to false after delay', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.rootInstance.closeSubmenu();
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  it('openSubmenu clears pending close timer', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.rootInstance.closeSubmenu();
    jest.useRealTimers();

    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  // ── resetSubmenuStyles ──

  it('resetSubmenuStyles clears inline styles', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.resetSubmenuStyles();
    const container = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    expect(container?.style.left).toBe('');
    expect(container?.style.right).toBe('');
  });

  // ── componentDidLoad ──

  it('componentDidLoad does not throw without nested menu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  // ── disconnectedCallback ──

  it('disconnectedCallback clears close timer', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(() => page.rootInstance.disconnectedCallback()).not.toThrow();
  });

  // ── Accessibility ──

  it('has role="menuitem"', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.getAttribute('role')).toBe('menuitem');
  });

  it('has aria-haspopup="menu"', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('aria-expanded reflects submenu state', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.getAttribute('aria-expanded')).toBe('false');

    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-disabled when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('sets aria-disabled="false" when enabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.getAttribute('aria-disabled')).toBe('false');
  });

  it('default tabindex is -1 (roving tabindex managed by parent menu)', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('tabindex is -1 when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('trailing arrow is aria-hidden', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const arrow = page.root?.shadowRoot?.querySelector('.md-sub-menu-item__arrow');
    expect(arrow?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── Part attributes ──

  it('exposes part attributes on state-layer, content, and headline', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    expect(page.root?.shadowRoot?.querySelector('[part="headline"]')).toBeTruthy();
  });

  it('exposes leading-icon part when slot has content', async () => {
    const page = await createItem(`<md-sub-menu-item headline="Share"><span slot="leading-icon">S</span></md-sub-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('[part="leading-icon"]')).toBeTruthy();
  });

  it('ripple is disabled when item is disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  // ── componentDidLoad with open nested menu ──

  it('componentDidLoad sets submenuOpen when nested menu is open', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).open = true;
    page.root!.appendChild(nestedMenu);

    page.rootInstance.componentDidLoad();

    expect(page.rootInstance.submenuOpen).toBe(true);
    expect(nestedMenu.style.position).toBe('relative');
  });

  it('componentDidLoad does nothing when nested menu is closed', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).open = false;
    page.root!.appendChild(nestedMenu);

    page.rootInstance.componentDidLoad();

    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  // ── autoPositionSubmenu ──

  // The flyout container is `position: fixed` so no ancestor overflow can clip
  // it — that is what lets a menu with submenus cap and scroll like every other
  // menu. Fixed insets resolve against the VIEWPORT, so these assertions read
  // physical `left`/`top` in viewport pixels. The SIDE is still decided in
  // logical terms, which is what the two dir="rtl" cases pin down.
  describe('autoPositionSubmenu', () => {
    function mockRects(page: SpecPage, hostRect: Partial<DOMRect>, containerRect: Partial<DOMRect>) {
      page.root!.getBoundingClientRect = () => ({
        top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {},
        ...hostRect,
      } as DOMRect);
      const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
      (container as any).getBoundingClientRect = () => ({
        top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {},
        ...containerRect,
      } as DOMRect);
      return container;
    }

    it('returns early when container is not found', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu');
      if (container) container.remove();
      expect(() => page.rootInstance.autoPositionSubmenu()).not.toThrow();
    });

    it('flips submenu to left when right edge overflows', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 850, right: 1000, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 1000, right: 1200, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      // The inline-end side would start at 1000 and need 1200 — off-screen — so
      // it opens on the inline start instead: the row's left edge minus its width.
      expect(container.style.left).toBe('650px');
      expect(container.style.top).toBe('100px');
    });

    it('stays on the inline-end side when only the flipped side would overflow', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 50, right: 200, width: 150, height: 48 },
        { top: 100, bottom: 300, left: -50, right: 150, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      // Inline start would start at 50 - 200 = -150, off the left edge; the
      // inline-end side fits, so it wins. Both candidates are compared up front
      // now — the old "…and flip back" branch re-read a rect captured BEFORE the
      // flip was written, so it could never actually fire.
      expect(container.style.left).toBe('200px');
      expect(container.style.top).toBe('100px');
    });

    it('bottom-aligns to the row when a top-aligned flyout would overflow', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      const container = mockRects(page,
        { top: 300, bottom: 348, left: 100, right: 250, width: 150, height: 48 },
        { top: 300, bottom: 500, left: 250, right: 450, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.left).toBe('250px');
      // 300 + 200 runs past a 400px viewport, so the flyout's BOTTOM meets the
      // row's bottom instead: 348 - 200.
      expect(container.style.top).toBe('148px');
    });

    it('opens on the inline end, top-aligned, when everything fits', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 100, right: 250, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 250, right: 450, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.left).toBe('250px');
      expect(container.style.top).toBe('100px');
    });

    it('uses fallback size when container dimensions are zero', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      const container = mockRects(page,
        { top: 300, bottom: 348, left: 350, right: 500, width: 150, height: 48 },
        { top: 300, bottom: 300, left: 500, right: 500, width: 0, height: 0 }
      );

      page.rootInstance.autoPositionSubmenu();

      // 200×200 stand-in: inline end needs 500…700 in a 500px viewport, so it
      // flips to 350 - 200, and bottom-aligns to 348 - 200.
      expect(container.style.left).toBe('150px');
      expect(container.style.top).toBe('148px');
    });

    it('clamps into the viewport when the flyout fits on neither side', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 260, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 220, configurable: true });

      const container = mockRects(page,
        { top: 90, bottom: 138, left: 60, right: 210, width: 150, height: 48 },
        { top: 0, bottom: 200, left: 0, right: 200, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      // Inline end starts at 210 (needs 410), inline start at -140: neither fits.
      // It keeps the preferred side and pins to the edge minus the 8px margin,
      // rather than bleeding off-screen — the same clamp positionMenu() applies.
      expect(container.style.left).toBe('52px'); // 260 - 200 - 8
      // Bottom-aligning to the row would put it at 138 - 200 = -62, above the
      // screen; the clamp pins it to the top margin instead.
      expect(container.style.top).toBe('8px');
    });

    it('overwrites stale placement instead of inheriting it', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 100, right: 250, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 250, right: 450, width: 200, height: 200 }
      );
      container.style.left = '999px';
      container.style.top = '999px';
      container.style.right = '999px';
      container.style.bottom = '999px';

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.left).toBe('250px');
      expect(container.style.top).toBe('100px');
      // right/bottom must be released, or the box would be stretched between
      // two opposing insets instead of shrink-wrapping its menu.
      expect(container.style.right).toBe('auto');
      expect(container.style.bottom).toBe('auto');
    });

    // RTL was the bug this logical rewrite fixed: the flyout used to open to the
    // physical right regardless of direction. Under rtl it must open toward the
    // inline start (leftward), and only flip when THAT would leave the viewport.
    it('opens toward the inline start under dir=rtl without flipping', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      page.root!.setAttribute('dir', 'rtl');

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 600, right: 750, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 400, right: 600, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      // Inline end is the LEFT under rtl: the row's left edge minus its width.
      expect(container.style.left).toBe('400px');
      expect(container.style.top).toBe('100px');
    });

    it('flips to the inline start under dir=rtl when the end side overflows', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      page.root!.setAttribute('dir', 'rtl');

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 80, right: 230, width: 150, height: 48 },
        { top: 100, bottom: 300, left: -120, right: 80, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      // Inline end (leftward, under rtl) would start at 80 - 200 = -120, so it
      // opens on the inline start instead: rightward, from the row's right edge.
      expect(container.style.left).toBe('230px');
      expect(container.style.top).toBe('100px');
    });
  });

  // ── keeping the flyout glued to its row while an ancestor scrolls ──

  describe('position watch', () => {
    it('binds scroll/resize on open and releases them on close', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      const addSpy = jest.spyOn(window, 'addEventListener');
      const removeSpy = jest.spyOn(window, 'removeEventListener');

      page.rootInstance.openSubmenu(false);
      await page.waitForChanges();
      expect(addSpy.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
      expect(addSpy.mock.calls.some(([type]) => type === 'resize')).toBe(true);

      page.rootInstance.closeSubmenu();
      expect(removeSpy.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
      expect(removeSpy.mock.calls.some(([type]) => type === 'resize')).toBe(true);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('collapse releases the watch even without a close animation', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      page.rootInstance.openSubmenu(false);
      await page.waitForChanges();
      expect(page.rootInstance.positionWatchTargets.length).toBeGreaterThan(0);

      await page.rootInstance.collapse();
      expect(page.rootInstance.positionWatchTargets.length).toBe(0);
    });
  });

  // ── openSubmenu calls show on nested menu ──

  it('openSubmenu calls show on nested menu with autoFocus', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).show = jest.fn();
    page.root!.appendChild(nestedMenu);

    page.rootInstance.openSubmenu(true);
    await page.waitForChanges();

    expect((nestedMenu as any).show).toHaveBeenCalledWith({ autoFocus: true });
    expect(nestedMenu.style.position).toBe('relative');
  });

  it('openSubmenu calls show with autoFocus false', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).show = jest.fn();
    page.root!.appendChild(nestedMenu);

    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();

    expect((nestedMenu as any).show).toHaveBeenCalledWith({ autoFocus: false });
  });

  // ── closeSubmenu calls close on nested menu ──

  it('closeSubmenu calls close on nested menu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).close = jest.fn();
    page.root!.appendChild(nestedMenu);

    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.rootInstance.closeSubmenu();
    expect((nestedMenu as any).close).toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(page.rootInstance.submenuOpen).toBe(false);
  });

  // ── resetSubmenuStyles with nested menu element ──

  it('resetSubmenuStyles clears nested menu position style', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    nestedMenu.style.position = 'relative';
    page.root!.appendChild(nestedMenu);

    page.rootInstance.resetSubmenuStyles();

    expect(nestedMenu.style.position).toBe('');
  });

  // ── submenu div mouse events ──

  it('submenu container mouseenter opens submenu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    const spy = jest.spyOn(page.rootInstance, 'openSubmenu');

    container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('submenu container mouseleave closes submenu after closeDelay', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    jest.useFakeTimers();
    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    // Leaving the FLYOUT waits exactly as long as leaving the row: the pointer
    // may be cutting back across a sibling towards the row it came from.
    jest.advanceTimersByTime(399);
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // ── host mouseenter / mouseleave — hover intent ──

  it('host mouseenter opens the submenu after openDelay, not on contact', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const spy = jest.spyOn(page.rootInstance, 'openSubmenu');

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });

  it('a pointer that crosses the row and leaves never opens it', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const spy = jest.spyOn(page.rootInstance, 'openSubmenu');

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(40);
    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    jest.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
    expect(page.rootInstance.submenuOpen).toBe(false);
    spy.mockRestore();
  });

  it('host mouseleave closes the submenu after closeDelay, not on exit', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    jest.advanceTimersByTime(399);
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a pending close is cancelled by re-entering the row', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    jest.advanceTimersByTime(200);
    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a pending close is cancelled by entering the FLYOUT rather than the row', async () => {
    // The diagonal from a row to its own flyout can miss the row on the way
    // back, so arriving anywhere inside the branch has to call the close off.
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    jest.advanceTimersByTime(200);
    container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('open-delay and close-delay override the defaults', async () => {
    const page = await createItem(
      `<md-sub-menu-item headline="More" open-delay="0" close-delay="20"></md-sub-menu-item>`,
    );
    expect(page.rootInstance.openDelay).toBe(0);
    expect(page.rootInstance.closeDelay).toBe(20);

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(0);
    expect(page.rootInstance.submenuOpen).toBe(true);

    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');
    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    jest.advanceTimersByTime(20);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // ── the keyboard never waits ──

  it('ArrowRight opens with no hover-intent delay', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);

    jest.useFakeTimers();
    page.root!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    // Not one tick advanced.
    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  it('Escape closes without waiting for closeDelay', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const nestedMenu = document.createElement('md-menu');
    nestedMenu.setAttribute('slot', 'submenu');
    (nestedMenu as any).close = jest.fn();
    page.root!.appendChild(nestedMenu);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.root!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect((nestedMenu as any).close).toHaveBeenCalled();
  });

  it('a keyboard open cancels a pending hover open rather than queueing a second one', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);

    jest.useFakeTimers();
    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    page.root!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(page.rootInstance.submenuOpen).toBe(true);

    const spy = jest.spyOn(page.rootInstance, 'openSubmenu');
    jest.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // ── measure before reveal ──

  it('gates the flyout invisible until it has been measured', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;

    page.rootInstance.openSubmenu(false);
    // The gate has to be on BEFORE the patch that flips the container to
    // display: block — that patch and the placement are the same frame.
    expect(container.hasAttribute('data-md-placing')).toBe(true);

    await page.waitForChanges();
    expect(container.hasAttribute('data-md-placing')).toBe(false);
    expect(page.rootInstance.placing).toBe(false);
  });

  it('does not re-arm the placement gate for an already-open flyout', async () => {
    // Re-entering an open flyout calls openSubmenu again. Nothing re-renders, so
    // a gate armed here would never be cleared and the flyout would stay
    // invisible for as long as it was open.
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;

    page.rootInstance.openSubmenu(false);
    await page.waitForChanges();

    page.rootInstance.openSubmenu(false);
    expect(container.hasAttribute('data-md-placing')).toBe(false);
    expect(page.rootInstance.placing).toBe(false);
  });

  /*
   * This used to assert the opposite, and the opposite was the bug.
   *
   * `resetSubmenuStyles` clears the inline placement, which snaps the flyout
   * back to an unplaced `position: fixed` while it is still hit-testable — the
   * render that applies `display: none` has not landed yet. A stray flyout that
   * comes to rest under a stationary pointer gets hit-tested, and because its
   * rows are in this host's light DOM the hit re-opens this row: measured at 50
   * enter/leave pairs in 1.5s with the pointer completely still, which starved
   * the sibling of its open delay so it never opened at all.
   *
   * So the teardown now ARMS the gate rather than clearing it. The invariant
   * that matters was never "the gate ends up off" — it is "the gate is never
   * off while the position is untrue", and that a later open still clears it.
   * Both are asserted, here and in the test below.
   */
  it('resetSubmenuStyles arms the gate, so a torn-down flyout cannot be hit-tested', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;

    page.rootInstance.beginPlacement();
    expect(container.hasAttribute('data-md-placing')).toBe(true);

    page.rootInstance.resetSubmenuStyles();
    expect(container.hasAttribute('data-md-placing')).toBe(true);
    expect(page.rootInstance.placing).toBe(true);
  });

  it('a placement after a teardown still clears the gate', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;

    page.rootInstance.resetSubmenuStyles();
    expect(container.hasAttribute('data-md-placing')).toBe(true);

    // The next open re-arms and then places, which is the only thing allowed to
    // take the gate off — so a torn-down flyout is never left permanently
    // invisible either, which is what the old assertion was really guarding.
    page.rootInstance.beginPlacement();
    page.rootInstance.finishPlacement();
    expect(container.hasAttribute('data-md-placing')).toBe(false);
    expect(page.rootInstance.placing).toBe(false);
  });

  // ── one flyout per menu ──

  it('opening a row collapses its sibling rows in the same menu', async () => {
    const page = await newSpecPage({
      components: [MdSubMenuItem],
      html: `<md-menu>
        <md-sub-menu-item headline="Region"></md-sub-menu-item>
        <md-sub-menu-item headline="Currency"></md-sub-menu-item>
      </md-menu>`,
    });
    const rows = Array.from(page.body.querySelectorAll('md-sub-menu-item'));

    jest.useFakeTimers();
    rows[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
    await page.waitForChanges();
    expect(rows[1].classList.contains('md-sub-menu-item--open')).toBe(true);

    jest.useFakeTimers();
    rows[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
    await page.waitForChanges();

    expect(rows[0].classList.contains('md-sub-menu-item--open')).toBe(true);
    // With a close delay in play the sibling would otherwise sit there expanded,
    // arrow rotated, beside a flyout that is not its own.
    expect(rows[1].classList.contains('md-sub-menu-item--open')).toBe(false);
  });

  // ── handleClick disabled ──

  it('handleClick stops propagation when disabled', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More" disabled></md-sub-menu-item>`);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = jest.spyOn(event, 'stopPropagation');
    const preventSpy = jest.spyOn(event, 'preventDefault');

    page.root!.dispatchEvent(event);
    expect(stopSpy).toHaveBeenCalled();
    expect(preventSpy).toHaveBeenCalled();
  });

  // ── disconnectedCallback clears active close timer ──

  it('disconnectedCallback clears an active close timer', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    page.rootInstance.submenuOpen = true;
    await page.waitForChanges();

    jest.useFakeTimers();
    page.rootInstance.closeSubmenu();
    page.rootInstance.disconnectedCallback();
    jest.advanceTimersByTime(200);

    expect(page.rootInstance.submenuOpen).toBe(true);
  });

  // ── componentWillLoad hasLeadingIcon ──

  it('componentWillLoad detects leading icon', async () => {
    const page = await createItem(`<md-sub-menu-item headline="Share"><span slot="leading-icon">S</span></md-sub-menu-item>`);
    expect(page.rootInstance.hasLeadingIcon).toBe(true);
  });

  it('componentWillLoad no leading icon', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    expect(page.rootInstance.hasLeadingIcon).toBe(false);
  });
});

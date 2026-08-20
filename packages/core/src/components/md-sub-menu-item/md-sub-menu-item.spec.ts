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

      expect(container.style.insetInlineStart).toBe('auto');
      expect(container.style.insetInlineEnd).toBe('100%');
    });

    it('flips submenu back to right when left edge overflows', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 50, right: 200, width: 150, height: 48 },
        { top: 100, bottom: 300, left: -50, right: 150, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.insetInlineStart).toBe('100%');
      expect(container.style.insetInlineEnd).toBe('auto');
    });

    it('flips submenu upward when bottom overflows', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      const container = mockRects(page,
        { top: 300, bottom: 348, left: 100, right: 250, width: 150, height: 48 },
        { top: 300, bottom: 500, left: 250, right: 450, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.top).toBe('auto');
      expect(container.style.bottom).toBe('0');
    });

    it('does not flip when everything fits', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 100, right: 250, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 250, right: 450, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.insetInlineStart).toBe('');
      expect(container.style.insetInlineEnd).toBe('');
      expect(container.style.top).toBe('');
      expect(container.style.bottom).toBe('');
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

      expect(container.style.insetInlineStart).toBe('auto');
      expect(container.style.insetInlineEnd).toBe('100%');
      expect(container.style.top).toBe('auto');
      expect(container.style.bottom).toBe('0');
    });

    it('clears all inline styles before measuring', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 100, right: 250, width: 150, height: 48 },
        { top: 100, bottom: 300, left: 250, right: 450, width: 200, height: 200 }
      );
      container.style.insetInlineStart = '999px';
      container.style.insetInlineEnd = '999px';
      container.style.top = '999px';
      container.style.bottom = '999px';

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.insetInlineStart).toBe('');
      expect(container.style.insetInlineEnd).toBe('');
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

      expect(container.style.insetInlineStart).toBe('');
      expect(container.style.insetInlineEnd).toBe('');
    });

    it('flips to the inline end under dir=rtl when the start side overflows', async () => {
      const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      page.root!.setAttribute('dir', 'rtl');

      const container = mockRects(page,
        { top: 100, bottom: 148, left: 80, right: 230, width: 150, height: 48 },
        { top: 100, bottom: 300, left: -120, right: 80, width: 200, height: 200 }
      );

      page.rootInstance.autoPositionSubmenu();

      expect(container.style.insetInlineStart).toBe('auto');
      expect(container.style.insetInlineEnd).toBe('100%');
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

  it('submenu container mouseleave closes submenu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const container = page.root!.shadowRoot!.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // ── host mouseenter / mouseleave ──

  it('host mouseenter opens submenu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const spy = jest.spyOn(page.rootInstance, 'openSubmenu');

    page.root!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('host mouseleave closes submenu', async () => {
    const page = await createItem(`<md-sub-menu-item headline="More"></md-sub-menu-item>`);
    const spy = jest.spyOn(page.rootInstance, 'closeSubmenu');

    page.root!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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

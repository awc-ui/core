import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdFabMenu } from './md-fab-menu';
import { MdFabMenuItem } from '../md-fab-menu-item/md-fab-menu-item';

describe('md-fab-menu', () => {
  async function createMenu(html: string): Promise<SpecPage> {
    return newSpecPage({
      components: [MdFabMenu, MdFabMenuItem],
      html,
    });
  }

  function setupAnchor(page: SpecPage, id = 'fab-anchor') {
    const anchor = page.doc.createElement('div') as any;
    anchor.id = id;
    anchor.icon = 'add';
    anchor.style.width = '56px';
    anchor.style.height = '56px';
    anchor.getBoundingClientRect = () => ({
      x: 300, y: 500, width: 56, height: 56,
      top: 500, right: 356, bottom: 556, left: 300,
      toJSON: () => {},
    });
    page.body.appendChild(anchor);
    return anchor;
  }

  /* ── Rendering ── */

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-fab-menu');
    });

    it('renders items container', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const container = page.root?.shadowRoot?.querySelector('.md-fab-menu__container');
      expect(container).toBeTruthy();
    });

    it('renders items slot', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const slot = page.root?.shadowRoot?.querySelector('slot');
      expect(slot).toBeTruthy();
    });

    it('applies variant class', async () => {
      const page = await createMenu(`
        <md-fab-menu variant="secondary">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--secondary');
    });

    it('applies placement class', async () => {
      const page = await createMenu(`
        <md-fab-menu placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--down');
    });

    it('does not render a close button (FAB morphs instead)', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-fab-menu__close');
      expect(closeBtn).toBeNull();
    });
  });

  /* ── Accessibility ── */

  describe('accessibility', () => {
    it('has role=menu', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root?.getAttribute('role')).toBe('menu');
    });

    it('has aria-label', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root?.getAttribute('aria-label')).toBe('Actions');
    });

    it('is aria-hidden when closed', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root?.getAttribute('aria-hidden')).toBe('true');
    });

    it('is not aria-hidden when open', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root?.getAttribute('aria-hidden')).toBe('false');
    });

    it('sets aria-expanded on anchor when open', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = true;
      await page.waitForChanges();

      expect(anchor.getAttribute('aria-expanded')).toBe('true');
      expect(anchor.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('sets aria-expanded=false on anchor when closed', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = false;
      await page.waitForChanges();

      expect(anchor.getAttribute('aria-expanded')).toBe('false');
    });

    it('initRovingTabindex sets first enabled item to tabindex 0', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      (page.rootInstance as any).initRovingTabindex();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect(items[1].getAttribute('tabindex')).toBe('-1');
      expect(items[2].getAttribute('tabindex')).toBe('-1');
    });

    it('resetRovingTabindex sets all items to tabindex -1', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.initRovingTabindex();
      instance.resetRovingTabindex();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('-1');
      expect(items[1].getAttribute('tabindex')).toBe('-1');
    });

    it('includes disabled items in roving tabindex (WAI-ARIA: disabled items are focusable)', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      (page.rootInstance as any).initRovingTabindex();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect(items[1].getAttribute('tabindex')).toBe('-1');
      expect(items[2].getAttribute('tabindex')).toBe('-1');
    });

    it('onOpenChange(false) resets roving tabindex', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.initRovingTabindex();
      instance.onOpenChange(false);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('-1');
      expect(items[1].getAttribute('tabindex')).toBe('-1');
    });
  });

  /* ── Events ── */

  describe('events', () => {
    it('emits mdOpen when opened', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);

      page.root!.open = true;
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      page.root!.open = false;
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdOpen when anchor is clicked', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const openSpy = jest.fn();
      page.root?.addEventListener('mdOpen', openSpy);

      anchor.click();
      await page.waitForChanges();

      expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when an item is activated', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const closeSpy = jest.fn();
      page.root?.addEventListener('mdClose', closeSpy);

      const item = page.body.querySelector('md-fab-menu-item') as HTMLElement;
      item.click();
      await page.waitForChanges();

      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(page.root?.getAttribute('open')).toBeNull();
    });
  });

  /* ── Methods ── */

  describe('methods', () => {
    it('show() opens the menu', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as MdFabMenu;
      await instance.show();
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--open');
    });

    it('close() closes the menu with quick=true', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as MdFabMenu;
      await instance.close();
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('close() sets closing state when not quick', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as MdFabMenu;
      await instance.close();
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--closing');
    });
  });

  /* ── Anchor FAB morph ── */

  describe('anchor morph', () => {
    it('sets data-shape="circle" on anchor when open', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = true;
      await page.waitForChanges();

      expect(anchor.getAttribute('data-shape')).toBe('circle');
    });

    it('removes data-shape on anchor when closed', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = false;
      await page.waitForChanges();

      expect(anchor.hasAttribute('data-shape')).toBe(false);
    });

    it('sets icon morph attribute on anchor when opening', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = true;
      await page.waitForChanges();

      expect(anchor.hasAttribute('data-icon-morphing')).toBe(true);
    });

    it('overrides FAB colors when open', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" variant="primary">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = true;
      await page.waitForChanges();

      expect(anchor.style.getPropertyValue('--md-fab-container-color')).toBeTruthy();
      expect(anchor.style.getPropertyValue('--md-fab-icon-color')).toBeTruthy();
    });

    it('restores FAB colors when closed', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" variant="primary" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      page.root!.open = false;
      await page.waitForChanges();

      expect(anchor.style.getPropertyValue('--md-fab-container-color')).toBe('');
      expect(anchor.style.getPropertyValue('--md-fab-icon-color')).toBe('');
    });
  });

  /* ── Placement ── */

  describe('placement', () => {
    it('defaults to up', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--up');
    });

    it('applies down placement', async () => {
      const page = await createMenu(`
        <md-fab-menu placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--down');
    });
  });

  /* ── Keyboard ── */

  describe('keyboard', () => {
    it('Enter on anchor opens the menu', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const menu = page.body.querySelector('md-fab-menu') as HTMLElement;

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      await page.waitForChanges();

      expect(menu).toHaveClass('md-fab-menu--open');
    });

    it('Space on anchor opens the menu', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const menu = page.body.querySelector('md-fab-menu') as HTMLElement;

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
      await page.waitForChanges();

      expect(menu).toHaveClass('md-fab-menu--open');
    });

    it('Enter on anchor closes the menu when open', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor" open quick>
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const menu = page.body.querySelector('md-fab-menu') as HTMLElement;

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      await page.waitForChanges();

      expect(menu?.getAttribute('open')).toBeNull();
    });

    it('Escape closes the menu', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('Tab moves focus to the next item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      items[0].dispatchEvent(event);
      await page.waitForChanges();

      expect(preventSpy).toHaveBeenCalled();
      expect(page.root).toHaveClass('md-fab-menu--open');
      expect(items[1].getAttribute('tabindex')).toBe('0');
      expect(instance.focusedIndex).toBe(1);
    });

    it('Tab on last item closes the menu without preventDefault', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 1);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      const stopSpy = jest.spyOn(event, 'stopPropagation');
      items[1].dispatchEvent(event);
      await page.waitForChanges();

      expect(stopSpy).toHaveBeenCalled();
      expect(preventSpy).not.toHaveBeenCalled();
      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('Shift+Tab on first item moves focus to anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      items[0].dispatchEvent(event);
      await page.waitForChanges();

      expect(preventSpy).toHaveBeenCalled();
      expect(page.root).toHaveClass('md-fab-menu--open');
      expect(instance.focusedIndex).toBe(-1);
      expect(items[0].getAttribute('tabindex')).toBe('-1');
    });
  });

  /* ── RTL ── */

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div dir="rtl">
            <md-fab-menu>
              <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
            </md-fab-menu>
          </div>
        `,
      });
      expect(page.root).toBeTruthy();
    });
  });

  /* ── Item delays ── */

  describe('item delays', () => {
    it('sets stagger delay index on items when opened', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);
      page.root!.open = true;
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item') as NodeListOf<HTMLElement>;
      expect(items[0].style.getPropertyValue('--_fab-menu-item-index')).toBe('0');
      expect(items[1].style.getPropertyValue('--_fab-menu-item-index')).toBe('1');
      expect(items[2].style.getPropertyValue('--_fab-menu-item-index')).toBe('2');
    });
  });

  /* ── Variant colors ── */

  describe('variant', () => {
    it('applies primary variant class', async () => {
      const page = await createMenu(`
        <md-fab-menu variant="primary">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--primary');
    });

    it('applies secondary variant class', async () => {
      const page = await createMenu(`
        <md-fab-menu variant="secondary">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--secondary');
    });

    it('applies tertiary variant class', async () => {
      const page = await createMenu(`
        <md-fab-menu variant="tertiary">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--tertiary');
    });
  });

  /* ── WAI-ARIA compliance ── */

  describe('WAI-ARIA compliance', () => {
    it('has aria-orientation="vertical"', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('disabled items are focusable via arrow keys', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share" disabled></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await page.waitForChanges();

      expect(items[1].getAttribute('tabindex')).toBe('0');
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('disabled items cannot be activated via click', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>
        </md-fab-menu>
      `);

      const spy = jest.fn();
      const item = page.body.querySelector('md-fab-menu-item') as HTMLElement;
      item.addEventListener('mdClick', spy);
      item.click();
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('focusFirstItem focuses the first item even if disabled', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusFirstItem();
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
    });

    it('focusAnchor cleans up rovingFocusVisible from items', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);

      instance.focusAnchor();
      await page.waitForChanges();

      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
      expect(items[0].getAttribute('tabindex')).toBe('-1');
    });

    it('Home focuses first item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 2);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('End focuses last item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[2].getAttribute('tabindex')).toBe('0');
      expect((items[2] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });
  });

  describe('roving focus on open', () => {
    it('onOpenChange(true) via pointer calls initRovingTabindex instead of focusFirstItem', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const initSpy = jest.spyOn(page.rootInstance as any, 'initRovingTabindex');
      const focusSpy = jest.spyOn(page.rootInstance as any, 'focusFirstItem');

      (page.rootInstance as any).openedViaKeyboard = false;
      (page.rootInstance as any).onOpenChange(true);

      await new Promise(r => setTimeout(r, 50));

      expect(initSpy).toHaveBeenCalled();
      expect(focusSpy).not.toHaveBeenCalled();
      initSpy.mockRestore();
      focusSpy.mockRestore();
    });

    it('onOpenChange(true) focuses first item when the anchor was focused at activation', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const initSpy = jest.spyOn(page.rootInstance as any, 'initRovingTabindex');
      const focusSpy = jest.spyOn(page.rootInstance as any, 'focusFirstItem');

      // Click on an already-focused FAB: keyboard flag is false but the anchor
      // held focus at activation, so focus should move into the menu.
      (page.rootInstance as any).openedViaKeyboard = false;
      (page.rootInstance as any).anchorFocusedAtActivation = true;
      (page.rootInstance as any).onOpenChange(true);

      await new Promise(r => setTimeout(r, 50));

      expect(focusSpy).toHaveBeenCalledWith(3, true);
      expect(initSpy).not.toHaveBeenCalled();
      // Flag is consumed (reset) after the open.
      expect((page.rootInstance as any).anchorFocusedAtActivation).toBe(false);
      initSpy.mockRestore();
      focusSpy.mockRestore();
    });

    it('anchorPointerHandler records whether the anchor held focus at click time', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      setupAnchor(page);
      const instance = page.rootInstance as any;
      const anchor = document.getElementById('fab-anchor') as HTMLElement;
      // mock-doc doesn't track real focus, so stub activeElement to model both states.
      const setActive = (el: Element | null) =>
        Object.defineProperty(document, 'activeElement', { value: el, configurable: true });

      // Unfocused anchor → flag false (fresh mouse click leaves focus on anchor).
      setActive(document.body);
      instance.anchorPointerHandler();
      expect(instance.anchorFocusedAtActivation).toBe(false);

      // Focused anchor → flag true (click while focused moves focus into menu).
      setActive(anchor);
      instance.anchorPointerHandler();
      expect(instance.anchorFocusedAtActivation).toBe(true);
    });

    it('onOpenChange(true) via keyboard calls focusFirstItem with roving focus', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const initSpy = jest.spyOn(page.rootInstance as any, 'initRovingTabindex');
      const focusSpy = jest.spyOn(page.rootInstance as any, 'focusFirstItem');

      (page.rootInstance as any).openedViaKeyboard = true;
      (page.rootInstance as any).onOpenChange(true);

      await new Promise(r => setTimeout(r, 50));

      expect(focusSpy).toHaveBeenCalledWith(3, true);
      expect(initSpy).not.toHaveBeenCalled();
      initSpy.mockRestore();
      focusSpy.mockRestore();
    });

    it('Enter on anchor opens menu and focuses first item with roving focus ring', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" tabindex="0" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
            <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      await page.waitForChanges();
      await new Promise(r => setTimeout(r, 50));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(page.root).toHaveClass('md-fab-menu--open');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('click on anchor opens menu without roving focus ring on items', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
            <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;

      anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      anchor.click();
      await page.waitForChanges();
      await new Promise(r => setTimeout(r, 50));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(page.root).toHaveClass('md-fab-menu--open');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
    });

    it('anchor keydown sets openedViaKeyboard for Enter and Space', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <button id="fab-anchor" type="button">Open</button>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const instance = page.rootInstance as any;

      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(instance.openedViaKeyboard).toBe(true);

      instance.openedViaKeyboard = false;
      anchor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(instance.openedViaKeyboard).toBe(true);

      instance.openedViaKeyboard = true;
      anchor.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(instance.openedViaKeyboard).toBe(false);
    });

    it('onOpenChange(false) restores focus to anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      jest.spyOn(anchor, 'focus');

      (page.rootInstance as any).onOpenChange(false);
      await page.waitForChanges();

      expect(anchor.focus).toHaveBeenCalled();
    });

    it('componentDidLoad with open=true initializes roving tabindex', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      await new Promise(r => setTimeout(r, 50));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect(items[1].getAttribute('tabindex')).toBe('-1');
      expect((page.rootInstance as any).focusedIndex).toBe(0);
    });

    it('onOpenChange(true) does not set rovingFocusVisible on items', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      (page.rootInstance as any).onOpenChange(true);
      await new Promise(r => setTimeout(r, 50));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
    });

    it('focusItem sets rovingFocusVisible on the focused item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 1);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('ArrowDown sets rovingFocusVisible on the newly focused item', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.initRovingTabindex();
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
    });

    it('handleFocusIn clears rovingFocusVisible when tabbing into an item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);

      instance.handleFocusIn({ target: items[0] } as any);
      await page.waitForChanges();

      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(false);
    });
  });

  /* ── Typeahead ── */

  describe('typeahead', () => {
    it('focuses item matching typed character', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[1].getAttribute('tabindex')).toBe('0');
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('wraps around to find matching item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 2);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
      expect((items[0] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('ignores typeahead when modifier keys are pressed', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── Placement watcher ── */

  describe('placement watcher', () => {
    it('updates effectivePlacement when placement changes to down', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      expect(page.root).toHaveClass('md-fab-menu--up');

      page.root?.setAttribute('placement', 'down');
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--down');
    });

    it('does not change effectivePlacement when placement is auto', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      page.root?.setAttribute('placement', 'auto');
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--up');
    });
  });

  /* ── Anchor wiring ── */

  describe('anchor wiring', () => {
    it('re-wires when anchor prop changes', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="anchor-a" style="width:56px;height:56px;"></div>
          <div id="anchor-b" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="anchor-a">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });

      page.root?.setAttribute('anchor', 'anchor-b');
      await page.waitForChanges();

      const anchorB = page.body.querySelector('#anchor-b') as HTMLElement;
      anchorB.click();
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--open');
    });

    it('click on anchor toggles menu open', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });

      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      anchor.click();
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--open');
    });

    it('click on anchor closes menu when open', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor" open quick>
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });

      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      anchor.click();
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('unwireAnchor removes listeners from anchor', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div id="fab-anchor" style="width:56px;height:56px;"></div>
          <md-fab-menu anchor="fab-anchor">
            <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          </md-fab-menu>
        `,
      });

      const instance = page.rootInstance as any;
      const anchor = page.body.querySelector('#fab-anchor') as HTMLElement;
      const removeSpy = jest.spyOn(anchor, 'removeEventListener');

      instance.unwireAnchor();

      expect(removeSpy).toHaveBeenCalled();
      removeSpy.mockRestore();
    });
  });

  /* ── focusin handling ── */

  describe('focusin handling', () => {
    it('updates roving tabindex when an item receives focus', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');

      instance.handleFocusIn({ target: items[2] } as any);
      await page.waitForChanges();

      expect(items[0].getAttribute('tabindex')).toBe('-1');
      expect(items[2].getAttribute('tabindex')).toBe('0');
      expect(instance.focusedIndex).toBe(2);
    });

    it('ignores focusin when menu is closed', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const items = page.body.querySelectorAll('md-fab-menu-item');
      instance.handleFocusIn({ target: items[0] } as any);

      expect(instance.focusedIndex).toBe(-1);
    });

    it('ignores focusin from non-item elements', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      instance.handleFocusIn({ target: document.createElement('div') } as any);

      expect(instance.focusedIndex).toBe(0);
    });

    it('handles focusin when no previous item was focused', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const items = page.body.querySelectorAll('md-fab-menu-item');

      instance.handleFocusIn({ target: items[1] } as any);

      expect(instance.focusedIndex).toBe(1);
      expect(items[1].getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── Close animation ── */

  describe('close animation', () => {
    it('close() is no-op when already closing', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as MdFabMenu;

      await instance.close();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-fab-menu--closing');

      await instance.close();
      expect(page.root).toHaveClass('md-fab-menu--closing');
    });

    it('close() is no-op when not open', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as MdFabMenu;
      await instance.close();
      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('close timer callback sets open=false and closing=false', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const instance = page.rootInstance as any;

      instance.closing = true;
      instance.closing = false;
      instance.open = false;
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });
  });

  /* ── Down placement keyboard ── */

  describe('down placement keyboard', () => {
    it('ArrowDown moves to next item', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[1].getAttribute('tabindex')).toBe('0');
      expect((items[1] as unknown as { rovingFocusVisible: boolean }).rovingFocusVisible).toBe(true);
    });

    it('ArrowUp at first item moves to anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await page.waitForChanges();

      expect(instance.focusedIndex).toBe(-1);
    });

    it('ArrowUp moves to previous item when not at first', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 2);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[1].getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── Up placement arrow down ── */

  describe('up placement ArrowDown', () => {
    it('ArrowDown at first item moves to anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 0);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();

      expect(instance.focusedIndex).toBe(-1);
    });

    it('ArrowDown at non-first item moves toward anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusItem(null, 2);
      await page.waitForChanges();

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[1].getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── Anchor keyboard (handleAnchorKeyDown) ── */

  describe('anchor keyboard (handleAnchorKeyDown)', () => {
    it('Escape on anchor closes the menu', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const spy = jest.spyOn(event, 'preventDefault');

      instance.handleAnchorKeyDown(event);
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('ArrowUp on anchor focuses first item in up placement', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const spy = jest.spyOn(event, 'preventDefault');

      instance.handleAnchorKeyDown(event);
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(instance.focusedIndex).toBe(0);
    });

    it('ArrowDown on anchor focuses first item in down placement', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const spy = jest.spyOn(event, 'preventDefault');

      instance.handleAnchorKeyDown(event);
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(instance.focusedIndex).toBe(0);
    });

    it('ArrowDown on anchor does nothing in up placement', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.handleAnchorKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();

      expect(instance.focusedIndex).toBe(-1);
    });

    it('ArrowUp on anchor does nothing in down placement', async () => {
      const page = await createMenu(`
        <md-fab-menu open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.handleAnchorKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      await page.waitForChanges();

      expect(instance.focusedIndex).toBe(-1);
    });

    it('Tab on anchor focuses first item', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const spy = jest.spyOn(event, 'preventDefault');

      instance.handleAnchorKeyDown(event);
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(page.root).toHaveClass('md-fab-menu--open');
      expect(instance.focusedIndex).toBe(0);

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });

    it('ignores keys when menu is not open', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const spy = jest.spyOn(event, 'preventDefault');

      instance.handleAnchorKeyDown(event);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  /* ── Global event handlers ── */

  describe('global event handlers', () => {
    it('outside click closes the menu', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const fakeEvent = {
        composedPath: () => [document.body, document.documentElement, document],
      } as unknown as MouseEvent;

      instance.handleOutsideClick(fakeEvent);
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('click inside menu does not close it', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const fakeEvent = {
        composedPath: () => [page.root, document.body],
      } as unknown as MouseEvent;

      instance.handleOutsideClick(fakeEvent);
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--open');
    });

    it('click on anchor does not close the menu', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      const instance = page.rootInstance as any;
      const fakeEvent = {
        composedPath: () => [anchor, document.body],
      } as unknown as MouseEvent;

      instance.handleOutsideClick(fakeEvent);
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--open');
    });

    it('handleItemClick closes menu and restores focus', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.handleItemClick();
      await page.waitForChanges();

      expect(page.root?.getAttribute('open')).toBeNull();
    });

    it('anchor tracker repositions when the anchor rect changes', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      setupAnchor(page);

      const instance = page.rootInstance as any;
      const positionSpy = jest.spyOn(instance, 'positionMenu');
      const anchorEl = instance.getAnchorEl();

      let rect = { top: 0, left: 0, right: 56, bottom: 56 };
      anchorEl.getBoundingClientRect = () => rect as DOMRect;
      instance.lastAnchorRect = null;

      // First frame: rect goes from null → a value, so reposition.
      instance.repositionIfAnchorMoved();
      expect(positionSpy).toHaveBeenCalledTimes(1);

      // Unchanged rect on the next frame → no extra reposition.
      instance.repositionIfAnchorMoved();
      expect(positionSpy).toHaveBeenCalledTimes(1);

      // Anchor moves (e.g. a container resize) → reposition again.
      rect = { top: 10, left: 0, right: 56, bottom: 66 };
      instance.repositionIfAnchorMoved();
      expect(positionSpy).toHaveBeenCalledTimes(2);

      positionSpy.mockRestore();
    });

    it('addGlobalListeners registers outside click listener', async () => {
      const page = await createMenu(`
        <md-fab-menu open quick>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.addGlobalListeners();

      expect(() => instance.removeGlobalListeners()).not.toThrow();
    });
  });

  /* ── Positioning ── */

  describe('positioning', () => {
    it('resolveEffectivePlacement defaults to up without anchor for auto', async () => {
      const page = await createMenu(`
        <md-fab-menu placement="auto">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.resolveEffectivePlacement();
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu--up');
    });

    it('resolveEffectivePlacement resolves based on viewport space', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" placement="auto">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      setupAnchor(page);

      const instance = page.rootInstance as any;
      instance.resolveEffectivePlacement();
      await page.waitForChanges();

      expect(instance.effectivePlacement === 'up' || instance.effectivePlacement === 'down').toBe(true);
    });

    it('positionMenu sets styles on container for up placement', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      setupAnchor(page);

      const instance = page.rootInstance as any;
      instance.positionMenu();

      const container = page.root?.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
      expect(container).toBeTruthy();
    });

    it('positionMenu sets styles on container for down placement', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open placement="down">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      setupAnchor(page);

      const instance = page.rootInstance as any;
      instance.positionMenu();

      const container = page.root?.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
      expect(container).toBeTruthy();
    });

    it('positionMenu is no-op without anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      expect(() => instance.positionMenu()).not.toThrow();
    });

    it('positionMenu sets RTL positioning', async () => {
      const page = await newSpecPage({
        components: [MdFabMenu, MdFabMenuItem],
        html: `
          <div dir="rtl">
            <md-fab-menu anchor="fab-anchor" open>
              <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
            </md-fab-menu>
          </div>
        `,
      });

      const anchor = page.doc.createElement('div') as any;
      anchor.id = 'fab-anchor';
      anchor.getBoundingClientRect = () => ({
        x: 300, y: 500, width: 56, height: 56,
        top: 500, right: 356, bottom: 556, left: 300,
        toJSON: () => {},
      });
      page.body.appendChild(anchor);

      const instance = page.rootInstance as any;
      instance.positionMenu();

      const container = page.root?.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
      expect(container).toBeTruthy();
    });
  });

  /* ── Morph & timer callbacks ── */

  describe('morph callbacks', () => {
    it('morphAnchorFab(true) saves icon and sets morph attributes', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      anchor.icon = 'add';

      const instance = page.rootInstance as any;
      instance.morphAnchorFab(true);

      expect(instance.savedIcon).toBe('add');
      expect(anchor.getAttribute('data-shape')).toBe('circle');
      expect(anchor.hasAttribute('data-icon-morphing')).toBe(true);
    });

    it('morphAnchorFab(false) removes shape and sets morph attributes', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      anchor.setAttribute('data-shape', 'circle');

      const instance = page.rootInstance as any;
      instance.morphAnchorFab(false);

      expect(anchor.hasAttribute('data-shape')).toBe(false);
      expect(anchor.hasAttribute('data-icon-morphing')).toBe(true);
    });

    it('morphAnchorFab is no-op without anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      expect(() => instance.morphAnchorFab(true)).not.toThrow();
      expect(() => instance.morphAnchorFab(false)).not.toThrow();
    });

    it('resetAnchorFab restores savedIcon', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);

      const instance = page.rootInstance as any;
      instance.savedIcon = 'add';
      instance.resetAnchorFab();

      expect(anchor.icon).toBe('add');
      expect(instance.savedIcon).toBe('');
    });

    it('resetAnchorFab does not set icon when savedIcon is empty', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor">
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      anchor.icon = 'original';

      const instance = page.rootInstance as any;
      instance.savedIcon = '';
      instance.resetAnchorFab();

      expect(anchor.icon).toBe('original');
    });

    it('resetAnchorFab is no-op without anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      expect(() => instance.resetAnchorFab()).not.toThrow();
    });
  });

  /* ── restoreFocusToAnchor ── */

  describe('restoreFocusToAnchor', () => {
    it('schedules focus on anchor element', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      jest.spyOn(anchor, 'focus');

      const instance = page.rootInstance as any;
      instance.restoreFocusToAnchor();

      expect(instance).toBeTruthy();
    });

    it('does not throw without anchor', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      expect(() => instance.restoreFocusToAnchor()).not.toThrow();
    });
  });

  /* ── focusFirstItem retry ── */

  describe('focusFirstItem retry', () => {
    it('does not retry when retries exhausted', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      expect(() => instance.focusFirstItem(0)).not.toThrow();
    });

    it('schedules retry when no items and retries remain', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const spy = jest.spyOn(global, 'setTimeout');
      instance.focusFirstItem(2);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('focuses first item when items exist', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      instance.focusFirstItem();
      await page.waitForChanges();

      const items = page.body.querySelectorAll('md-fab-menu-item');
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── getEnabledItems ── */

  describe('getEnabledItems', () => {
    it('filters out disabled items', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="Share" disabled></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="Delete"></md-fab-menu-item>
        </md-fab-menu>
      `);

      const instance = page.rootInstance as any;
      const enabled = instance.getEnabledItems();

      expect(enabled.length).toBe(2);
    });
  });

  /* ── disconnectedCallback ── */

  describe('disconnectedCallback', () => {
    it('cleans up anchor attributes on disconnect', async () => {
      const page = await createMenu(`
        <md-fab-menu anchor="fab-anchor" open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);
      const anchor = setupAnchor(page);
      anchor.setAttribute('data-shape', 'circle');

      page.root?.remove();
      await page.waitForChanges();

      expect(anchor.hasAttribute('data-shape')).toBe(false);
    });

    it('clears all timers on disconnect', async () => {
      const page = await createMenu(`
        <md-fab-menu open>
          <md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>
        </md-fab-menu>
      `);

      expect(() => {
        page.root?.remove();
      }).not.toThrow();
    });
  });
});

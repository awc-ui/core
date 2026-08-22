import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newSpecPage } from '@stencil/core/testing';
import { MdListItem } from './md-list-item';
import { MdList } from '../md-list/md-list';
import { MdTooltip } from '../md-tooltip/md-tooltip';
import { MdIconButton } from '../md-icon-button/md-icon-button';

const LIST_ITEM_CSS = readFileSync(join(__dirname, 'md-list-item.css'), 'utf8');

describe('md-list-item', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdListItem],
      html,
    });
  }

  /* ----------------------------------------------------------
     1. RENDERING
     ---------------------------------------------------------- */
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-list-item headline="Item"></md-list-item>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-list-item');
      expect(page.root).toHaveClass('md-list-item--type-text');
      expect(page.root).toHaveClass('md-list-item--1-line');
    });

    it('renders headline from prop', async () => {
      const page = await create('<md-list-item headline="Hello"></md-list-item>');
      const headline = page.root?.shadowRoot?.querySelector('.md-list-item__headline');
      expect(headline?.textContent).toContain('Hello');
    });

    it('renders overline from prop', async () => {
      const page = await create('<md-list-item headline="Item" overline="Category"></md-list-item>');
      const overline = page.root?.shadowRoot?.querySelector('.md-list-item__overline');
      expect(overline?.textContent).toContain('Category');
    });

    it('renders supporting text from prop', async () => {
      const page = await create('<md-list-item headline="Item" supporting-text="Sub"></md-list-item>');
      const supporting = page.root?.shadowRoot?.querySelector('.md-list-item__supporting-text');
      expect(supporting?.textContent).toContain('Sub');
    });

    it('renders trailing supporting text from prop', async () => {
      const page = await create('<md-list-item headline="Item" trailing-supporting-text="42"></md-list-item>');
      const trailing = page.root?.shadowRoot?.querySelector('.md-list-item__trailing-text');
      expect(trailing?.textContent).toContain('42');
    });

    it('renders default slot as headline fallback', async () => {
      const page = await create('<md-list-item>Slotted</md-list-item>');
      expect(page.root?.textContent).toContain('Slotted');
    });
  });

  /* ----------------------------------------------------------
     2. SLOT FALLBACKS — headline / overline / supporting-text /
        trailing-supporting-text accept rich slotted content
     ---------------------------------------------------------- */
  describe('slot fallbacks', () => {
    it('exposes a headline named slot', async () => {
      const page = await create('<md-list-item><span slot="headline">Rich</span></md-list-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="headline"]');
      expect(slot).toBeTruthy();
    });

    it('exposes an overline named slot', async () => {
      const page = await create('<md-list-item><span slot="overline">Rich</span></md-list-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="overline"]');
      expect(slot).toBeTruthy();
    });

    it('exposes a supporting-text named slot', async () => {
      const page = await create('<md-list-item><span slot="supporting-text">Rich</span></md-list-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="supporting-text"]');
      expect(slot).toBeTruthy();
    });

    it('exposes a trailing-supporting-text named slot', async () => {
      const page = await create('<md-list-item><span slot="trailing-supporting-text">Rich</span></md-list-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="trailing-supporting-text"]');
      expect(slot).toBeTruthy();
    });

    it('exposes the leading slot unconditionally (slotchange wiring)', async () => {
      const page = await create('<md-list-item headline="Item"></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="leading"]')).toBeTruthy();
    });

    it('renders the trailing wrapper + slot when a trailing prop is set', async () => {
      const page = await create('<md-list-item headline="Item" trailing-icon="check"></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="trailing"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeTruthy();
    });

    it('renders the trailing wrapper when light-DOM children declare slot="trailing"', async () => {
      const page = await create(
        '<md-list-item headline="Item"><span slot="trailing">X</span></md-list-item>',
      );
      expect(page.root?.shadowRoot?.querySelector('slot[name="trailing"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeTruthy();
    });

    it('OMITS the trailing wrapper from shadow DOM when no trailing content is supplied', async () => {
      const page = await create('<md-list-item headline="Item"></md-list-item>');
      // The wrapper is intentionally absent — not just `display:none`. Keeps
      // the row's flex `gap` from leaving a phantom seat for a missing icon.
      expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('slot[name="trailing"]')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__trailing')).toBeNull();
    });

    it('renders the trailing wrapper for expandable rows (caret button lives there)', async () => {
      const page = await create('<md-list-item headline="Item" expandable></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="expand-button"]')).toBeTruthy();
    });

    it('flags `md-list-item--with-video` when a <video slot="leading"> child is present', async () => {
      // Asserts the workaround for the Chromium `:host(:has(...))` limitation —
      // the row must learn from TSX detection that it carries a video thumbnail
      // so the CSS-only top-padding bump (8px → 12px) actually fires.
      const page = await newSpecPage({
        components: [MdListItem],
        html: `<md-list-item headline="Clip"><video slot="leading"></video></md-list-item>`,
      });
      expect(page.root).toHaveClass('md-list-item--with-video');
    });

    it('does NOT flag with-video when leading content is not a <video>', async () => {
      const page = await create(
        '<md-list-item headline="Item" leading-icon="image"></md-list-item>',
      );
      expect(page.root?.className).not.toContain('md-list-item--with-video');
    });
  });

  /* ----------------------------------------------------------
     3. LINE VARIANTS — auto-detection from content
     ---------------------------------------------------------- */
  describe('lines', () => {
    it('defaults to 1-line', async () => {
      const page = await create('<md-list-item headline="Item"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--1-line');
    });

    it('auto-promotes to 2-line when supporting-text is present', async () => {
      const page = await create('<md-list-item headline="Item" supporting-text="Sub"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--2-line');
    });

    it('auto-promotes to 2-line when overline is present', async () => {
      const page = await create('<md-list-item headline="Item" overline="Category"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--2-line');
    });

    it('auto-promotes to 3-line when both overline and supporting-text are present', async () => {
      const page = await create('<md-list-item headline="Item" overline="Category" supporting-text="Sub"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--3-line');
    });

    it('respects explicit lines={3}', async () => {
      const page = await create('<md-list-item headline="Item" lines="3"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--3-line');
    });
  });

  /* ----------------------------------------------------------
     4. LEADING CONTENT — icon / avatar (image) / avatar (label) / image
     ---------------------------------------------------------- */
  describe('leading content', () => {
    it('renders a Material Symbols icon', async () => {
      const page = await create('<md-list-item headline="Item" leading-icon="inbox"></md-list-item>');
      const icon = page.root?.shadowRoot?.querySelector('.md-list-item__icon');
      expect(icon?.textContent).toContain('inbox');
    });

    it('renders an md-avatar with the image src when leading-avatar is set', async () => {
      const page = await create('<md-list-item headline="Item" leading-avatar="a.jpg"></md-list-item>');
      const avatar = page.root?.shadowRoot?.querySelector('md-avatar.md-list-item__avatar');
      expect(avatar).toBeTruthy();
      expect(avatar?.getAttribute('src')).toBe('a.jpg');
    });

    it('forwards leading-avatar-label to md-avatar as initials', async () => {
      const page = await create('<md-list-item headline="Item" leading-avatar-label="AB"></md-list-item>');
      const avatar = page.root?.shadowRoot?.querySelector('md-avatar.md-list-item__avatar');
      expect(avatar).toBeTruthy();
      expect(avatar?.getAttribute('initials')).toBe('AB');
    });

    it('forwards leading-avatar-name to md-avatar so it can derive initials', async () => {
      const page = await create('<md-list-item headline="Item" leading-avatar-name="Ada Lovelace"></md-list-item>');
      const avatar = page.root?.shadowRoot?.querySelector('md-avatar.md-list-item__avatar');
      expect(avatar).toBeTruthy();
      expect(avatar?.getAttribute('name')).toBe('Ada Lovelace');
    });

    it('renders an image thumbnail', async () => {
      const page = await create('<md-list-item headline="Item" leading-image="x.jpg"></md-list-item>');
      const image = page.root?.shadowRoot?.querySelector('.md-list-item__image') as HTMLImageElement | null;
      expect(image).toBeTruthy();
      expect(image?.tagName).toBe('IMG');
    });

    it('wraps leading-image in a container with selection indicator parts', async () => {
      const page = await create('<md-list-item headline="Item" leading-image="x.jpg"></md-list-item>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('.md-list-item__image-wrap')).toBeTruthy();
      expect(shadow?.querySelector('[part="image-wrap"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="image-selection-indicator"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="image-selection-circle"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="image-selection-check"]')).toBeTruthy();
    });

    it('shows image selection overlay when selected', async () => {
      const page = await create(
        '<md-list-item headline="Item" leading-image="x.jpg" selected></md-list-item>',
      );
      const indicator = page.root?.shadowRoot?.querySelector(
        '.md-list-item__image-selection-indicator',
      );
      const circle = page.root?.shadowRoot?.querySelector(
        '.md-list-item__image-selection-circle',
      );
      const check = page.root?.shadowRoot?.querySelector(
        '.md-list-item__image-selection-check.material-symbols-outlined',
      );
      expect(indicator).toBeTruthy();
      expect(circle).toBeTruthy();
      expect(check).toBeTruthy();
      expect(check?.textContent?.trim()).toBe('check');
    });

    it('adds with-leading class when any leading content is present', async () => {
      const page = await create('<md-list-item headline="Item" leading-icon="inbox"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--with-leading');
    });
  });

  /* ----------------------------------------------------------
     5. TRAILING CONTENT
     ---------------------------------------------------------- */
  describe('trailing content', () => {
    it('renders a trailing icon', async () => {
      const page = await create('<md-list-item headline="Item" trailing-icon="chevron_right"></md-list-item>');
      const icon = page.root?.shadowRoot?.querySelector('.md-list-item__trailing-icon');
      expect(icon?.textContent).toContain('chevron_right');
    });

    it('adds with-trailing class when trailing content is present', async () => {
      const page = await create('<md-list-item headline="Item" trailing-supporting-text="42"></md-list-item>');
      expect(page.root).toHaveClass('md-list-item--with-trailing');
    });
  });

  /* ----------------------------------------------------------
     6. TYPE PROP — text / button / link
     ---------------------------------------------------------- */
  describe('type prop', () => {
    it('defaults to type="text" — non-interactive, role=listitem', async () => {
      const page = await create('<md-list-item headline="Static"></md-list-item>');
      expect(page.root?.getAttribute('type')).toBe('text');
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
      expect(page.root).not.toHaveClass('md-list-item--interactive');
    });

    it('type="button" → host is listitem, inner primary is the role=button tab stop', async () => {
      const page = await create('<md-list-item type="button" headline="Action"></md-list-item>');
      // Host stays a structural listitem (a role="list" parent owns it validly).
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
      // The interactive widget + roving tab stop live on the inner primary.
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary');
      expect(primary?.getAttribute('role')).toBe('button');
      expect(primary?.getAttribute('tabindex')).toBe('0');
      expect(page.root).toHaveClass('md-list-item--interactive');
    });

    it('type="link" → host is listitem, inner primary is a real <a href> tab stop', async () => {
      const page = await create('<md-list-item type="link" href="/x" headline="Link"></md-list-item>');
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary') as HTMLAnchorElement | null;
      expect(primary?.tagName).toBe('A');
      expect(primary?.getAttribute('href')).toBe('/x');
      expect(primary?.getAttribute('role')).toBe('link');
      expect(primary?.getAttribute('tabindex')).toBe('0');
    });

    it('type="text" + selection mode forces interactivity', async () => {
      const page = await create('<md-list-item data-selection-mode="single-select" headline="Item"></md-list-item>');
      expect(page.root?.getAttribute('role')).toBe('option');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
      expect(page.root).toHaveClass('md-list-item--interactive');
    });
  });

  /* ----------------------------------------------------------
     7. INTERACTIVITY — click + keyboard
     ---------------------------------------------------------- */
  describe('events', () => {
    it('emits mdClick on click when type=button', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdItemClick (bubbling) on click', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit mdClick when type=text', async () => {
      const page = await create('<md-list-item headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT emit mdClick when disabled', async () => {
      const page = await create('<md-list-item type="button" disabled headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT emit mdClick when soft-disabled', async () => {
      const page = await create('<md-list-item type="button" soft-disabled headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('activates on Enter when interactive', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space when interactive', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does NOT emit mdClick when click originates from trailing icon-button', async () => {
      const page = await create(`
        <md-list-item type="button" headline="X" data-interaction-mode="multi-action">
          <button slot="trailing" id="trail" type="button">More</button>
        </md-list-item>
      `);
      const trail = page.root?.querySelector('#trail') as HTMLButtonElement;
      const rowSpy = jest.fn();
      const trailSpy = jest.fn();
      page.root?.addEventListener('mdClick', rowSpy);
      trail?.addEventListener('click', trailSpy);
      trail?.click();
      await page.waitForChanges();
      expect(trailSpy).toHaveBeenCalledTimes(1);
      expect(rowSpy).not.toHaveBeenCalled();
    });

    it('still emits mdClick for decorative trailing slot content', async () => {
      const page = await create(`
        <md-list-item type="button" headline="X">
          <span slot="trailing" id="check" aria-hidden="true">✓</span>
        </md-list-item>
      `);
      const check = page.root?.querySelector('#check') as HTMLElement;
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      check?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  /* ----------------------------------------------------------
     8. DISABLED + SELECTED STATES
     ---------------------------------------------------------- */
  describe('states', () => {
    it('reflects disabled to host attribute', async () => {
      const page = await create('<md-list-item type="button" disabled headline="X"></md-list-item>');
      expect(page.root?.hasAttribute('disabled')).toBe(true);
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root).toHaveClass('md-list-item--disabled');
    });

    it('reflects soft-disabled to host attribute', async () => {
      const page = await create('<md-list-item type="button" soft-disabled headline="X"></md-list-item>');
      expect(page.root?.getAttribute('soft-disabled')).not.toBeNull();
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root).toHaveClass('md-list-item--disabled');
      expect(page.root).toHaveClass('md-list-item--soft-disabled');
    });

    it('remains focusable when soft-disabled', async () => {
      const page = await create('<md-list-item type="button" soft-disabled headline="X"></md-list-item>');
      // The tab stop lives on the inner primary; it stays focusable + aria-disabled.
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary');
      expect(primary?.getAttribute('tabindex')).toBe('0');
      expect(primary?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root).toHaveClass('md-list-item--interactive');
    });

    it('does not activate on Enter when soft-disabled', async () => {
      const page = await create('<md-list-item type="button" soft-disabled headline="X"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('reflects selected to host attribute and tint, without invalid aria-selected', async () => {
      const page = await create('<md-list-item type="button" selected headline="X"></md-list-item>');
      expect(page.root?.hasAttribute('selected')).toBe(true);
      expect(page.root).toHaveClass('md-list-item--selected');
      // The host is a structural `listitem` (not a selection mode), and
      // `aria-selected` is not an allowed attribute on it (axe `aria-allowed-attr`).
      // The `selected` prop still drives the visual tint via the host class
      // above; only the ARIA reflection is withheld.
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.getAttribute('aria-selected')).toBeNull();
      // Nor is aria-selected placed on the inner primary widget.
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary');
      expect(primary?.getAttribute('aria-selected')).toBeNull();
    });

    it('aria-selected is "false" in selection mode when not selected', async () => {
      const page = await create('<md-list-item data-selection-mode="single-select" headline="X"></md-list-item>');
      expect(page.root?.getAttribute('aria-selected')).toBe('false');
    });
  });

  /* ----------------------------------------------------------
     9. TABBABLE — managed by parent for roving tabindex
     ---------------------------------------------------------- */
  describe('tabbable prop', () => {
    it('primary tabindex=0 when tabbable=true and interactive', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary');
      expect(primary?.getAttribute('tabindex')).toBe('0');
      // The roving tab stop moved off the host — it must not double as one.
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
    });

    it('primary tabindex=-1 when interactive but tabbable was set to false', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const root = page.root as HTMLMdListItemElement;
      root.tabbable = false;
      await page.waitForChanges();
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary');
      expect(primary?.getAttribute('tabindex')).toBe('-1');
    });

    it('does not add roving-focus-visible class by default', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      expect(page.root).not.toHaveClass('md-list-item--roving-focus-visible');
    });

    it('adds roving-focus-visible when rovingFocusVisible is set', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const root = page.root as HTMLMdListItemElement;
      root.rovingFocusVisible = true;
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-list-item--roving-focus-visible');
    });

    it('drops roving-focus-visible when rovingFocusVisible is false', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const root = page.root as HTMLMdListItemElement;
      root.rovingFocusVisible = true;
      await page.waitForChanges();
      root.rovingFocusVisible = false;
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-list-item--roving-focus-visible');
    });

    it('no tabindex when type=text and not in selection mode', async () => {
      const page = await create('<md-list-item headline="X"></md-list-item>');
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
    });
  });

  /* ----------------------------------------------------------
     10. ACCESSIBILITY
     ---------------------------------------------------------- */
  describe('accessibility', () => {
    it('role=listitem when type=text', async () => {
      const page = await create('<md-list-item headline="X"></md-list-item>');
      expect(page.root?.getAttribute('role')).toBe('listitem');
    });

    it('role=option when in selection mode', async () => {
      const page = await create('<md-list-item data-selection-mode="multi-select" headline="X"></md-list-item>');
      expect(page.root?.getAttribute('role')).toBe('option');
    });

    it('exposes parts: state-layer / leading / content / trailing / headline', async () => {
      // `trailing-icon` is set so the trailing wrapper is actually rendered;
      // without any trailing content the wrapper is intentionally omitted from
      // the shadow DOM (see md-list-item.tsx → renderTrailing).
      const page = await create(
        '<md-list-item type="button" headline="X" leading-icon="inbox" supporting-text="Sub" trailing-icon="chevron_right"></md-list-item>',
      );
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="state-layer"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="leading"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="content"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="trailing"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="headline"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="leading-icon"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="supporting-text"]')).toBeTruthy();
    });
  });

  /* ----------------------------------------------------------
     10b. MENU CONTEXT — role adapts under a role="menu" container
     ---------------------------------------------------------- */
  describe('menu context (containerRole)', () => {
    it('button row in a menu → HOST is the role=menuitem widget, no inner primary', async () => {
      const page = await create('<md-list-item type="button" headline="Cut"></md-list-item>');
      const root = page.root as HTMLMdListItemElement & { containerRole: string };
      root.containerRole = 'menu';
      await page.waitForChanges();
      // A `menu` owns its direct light-DOM children (the hosts); a menuitem
      // buried in the host's shadow is not owned by it. So the HOST itself is
      // the menuitem (like `option`), the host carries the roving tabindex, and
      // NO inner primary widget is rendered.
      expect(page.root?.getAttribute('role')).toBe('menuitem');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__primary')).toBeNull();
    });

    it('link row in a menu → HOST is the role=menuitem widget, no inner <a>', async () => {
      const page = await create('<md-list-item type="link" href="/x" headline="Open"></md-list-item>');
      const root = page.root as HTMLMdListItemElement & { containerRole: string };
      root.containerRole = 'menu';
      await page.waitForChanges();
      expect(page.root?.getAttribute('role')).toBe('menuitem');
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__primary')).toBeNull();
    });

    it('reverts to listitem host + inner button primary when containerRole clears', async () => {
      const page = await create('<md-list-item type="button" headline="Cut"></md-list-item>');
      const root = page.root as HTMLMdListItemElement & { containerRole: string };
      root.containerRole = 'menu';
      await page.waitForChanges();
      root.containerRole = 'list';
      await page.waitForChanges();
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__primary')?.getAttribute('role')).toBe('button');
    });
  });

  /* ----------------------------------------------------------
     10c. setFocus() — targets the correct element
     ---------------------------------------------------------- */
  describe('setFocus()', () => {
    it('focuses the inner primary for a button row (not the host)', async () => {
      const page = await create('<md-list-item type="button" headline="X"></md-list-item>');
      const item = page.root as unknown as HTMLMdListItemElement & { setFocus: () => Promise<void> };
      const primary = page.root?.shadowRoot?.querySelector('.md-list-item__primary') as HTMLElement;
      const primarySpy = jest.spyOn(primary, 'focus');
      const hostSpy = jest.spyOn(page.root as HTMLElement, 'focus');
      await item.setFocus();
      expect(primarySpy).toHaveBeenCalledTimes(1);
      expect(hostSpy).not.toHaveBeenCalled();
      primarySpy.mockRestore();
      hostSpy.mockRestore();
    });

    it('focuses the host for a selection (option) row', async () => {
      const page = await create('<md-list-item data-selection-mode="single-select" headline="X"></md-list-item>');
      const item = page.root as unknown as HTMLMdListItemElement & { setFocus: () => Promise<void> };
      const hostSpy = jest.spyOn(page.root as HTMLElement, 'focus');
      await item.setFocus();
      expect(hostSpy).toHaveBeenCalledTimes(1);
      hostSpy.mockRestore();
    });

    it('focuses the host (the menuitem) for a menu-context row', async () => {
      const page = await create('<md-list-item type="button" headline="Cut"></md-list-item>');
      const root = page.root as unknown as HTMLMdListItemElement & {
        containerRole: string;
        setFocus: () => Promise<void>;
      };
      root.containerRole = 'menu';
      await page.waitForChanges();
      const hostSpy = jest.spyOn(page.root as HTMLElement, 'focus');
      await root.setFocus();
      expect(hostSpy).toHaveBeenCalledTimes(1);
      hostSpy.mockRestore();
    });
  });

  /* ----------------------------------------------------------
     11. RTL + custom CSS smoke tests
     ---------------------------------------------------------- */
  describe('RTL + customization', () => {
    it('renders inside dir="rtl" container without errors', async () => {
      const page = await newSpecPage({
        components: [MdListItem],
        html: `<div dir="rtl"><md-list-item headline="عنصر"></md-list-item></div>`,
      });
      expect(page.root).toBeTruthy();
    });

    it('accepts CSS custom-property overrides as inline style', async () => {
      const page = await create(
        '<md-list-item style="--md-list-item-container-color:#fce4ec;" headline="X"></md-list-item>',
      );
      expect((page.root as HTMLElement)?.style.getPropertyValue('--md-list-item-container-color')).toBe('#fce4ec');
    });

    it('defaults leading and trailing icon colors to on-surface-variant', () => {
      expect(LIST_ITEM_CSS).toContain(
        '--_leading-icon-color: var(--md-list-item-leading-icon-color, var(--md-sys-color-on-surface-variant',
      );
      expect(LIST_ITEM_CSS).toContain(
        '--_trailing-icon-color: var(--md-list-item-trailing-icon-color, var(--md-sys-color-on-surface-variant',
      );
      expect(LIST_ITEM_CSS).not.toMatch(/--_leading-icon-color:[^;]*--md-sys-color-primary/);
      expect(LIST_ITEM_CSS).not.toMatch(/--_trailing-icon-color:[^;]*--md-sys-color-primary/);
    });

    it('uses a primary pill for the expanded expand-button only', () => {
      expect(LIST_ITEM_CSS).toMatch(
        /\.md-list-item__expand-button--expanded[\s\S]*?--md-icon-button-container-color:\s*var\(--md-sys-color-primary/,
      );
      expect(LIST_ITEM_CSS).toMatch(
        /\.md-list-item__expand-button--expanded[\s\S]*?--md-icon-button-icon-color:\s*var\(--md-sys-color-on-primary/,
      );
    });
  });

  /* ----------------------------------------------------------
     13. EXPANDABLE
     ---------------------------------------------------------- */
  describe('expandable', () => {
    /* Register MdIconButton so the trailing caret control renders its own
       shadow (icon, state-layer, aria) and its mdClick toggle path works. */
    async function createExpandable(html: string) {
      return newSpecPage({ components: [MdListItem, MdIconButton], html });
    }

    function caret(page: { root?: HTMLElement | null }) {
      return page.root?.shadowRoot?.querySelector(
        '.md-list-item__expand-button',
      ) as (HTMLElement & {
        selected?: boolean;
        icon?: string;
        variant?: string;
        buttonWidth?: string;
      }) | null;
    }

    it('forwards expand chevron color override to the caret md-icon-button', async () => {
      const page = await createExpandable(
        '<md-list-item expandable style="--md-list-item-expand-chevron-color: coral;" headline="Settings"></md-list-item>',
      );
      expect(caret(page)?.classList.contains('md-list-item__expand-button')).toBe(true);
    });

    it('uses button-width narrow on the caret control', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      expect(caret(page)?.buttonWidth).toBe('narrow');
    });

    it('renders the caret md-icon-button when expandable=true', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      const btn = caret(page);
      expect(btn).toBeTruthy();
      expect(btn?.tagName).toBe('MD-ICON-BUTTON');
      // `icon` is a non-reflected @Prop → set as a property, not an attribute.
      expect(btn?.icon).toBe('expand_more');
      expect(btn?.variant).toBe('standard');
      expect(btn?.getAttribute('data-expand-toggle')).toBe('true');
    });

    it('exposes the expand-button part', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="expand-button"]')).toBeTruthy();
    });

    it('renders the expanded panel slot when expandable=true', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="expanded-content"]');
      expect(slot).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="expanded-panel"]')).toBeTruthy();
    });

    it('does not render caret or panel when expandable is false', async () => {
      const page = await createExpandable('<md-list-item headline="Static"></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__expand-button')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="expanded-panel"]')).toBeNull();
    });

    it('panel is role="list" when it holds md-list-item rows (valid listitem owner)', async () => {
      // The child rows render as role="listitem"; axe requires their context to
      // be role="list" (group/region fail aria-required-parent), so the panel
      // becomes a list — in both non-selection and selection modes.
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
        </md-list-item>
      `);
      const panel = page.root?.shadowRoot?.querySelector('[part="expanded-panel"]');
      expect(panel?.getAttribute('role')).toBe('list');
    });

    it('panel is role="region" for arbitrary (non-list-item) content', async () => {
      // A region owns arbitrary content with no required owned role, so a plain
      // FAQ <div> panel can't trip aria-required-children.
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="FAQ">
          <div slot="expanded-content">Some answer text</div>
        </md-list-item>
      `);
      const panel = page.root?.shadowRoot?.querySelector('[part="expanded-panel"]');
      expect(panel?.getAttribute('role')).toBe('region');
    });

    it('keeps the row pointer-interactive but defers keyboard focus to the caret', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      // Row body is still interactive (ripple / state-layer / click-to-toggle)…
      expect(page.root).toHaveClass('md-list-item--interactive');
      // …but it is NOT a keyboard tab stop — the caret button is the control.
      expect(page.root?.getAttribute('tabindex')).toBeFalsy();
      expect(caret(page)?.getAttribute('tabindex')).toBe('0');
    });

    it('marks the caret expanded (pill morph + rotation) via selected + modifier class', async () => {
      const page = await createExpandable('<md-list-item expandable expanded headline="Open"></md-list-item>');
      const btn = caret(page);
      expect(btn?.classList.contains('md-list-item__expand-button--expanded')).toBe(true);
      expect(btn?.selected).toBe(true);
      expect(btn?.variant).toBe('standard');
      expect(page.root).toHaveClass('md-list-item--expanded');
    });

    it('toggles expanded on row body click', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Click me"></md-list-item>');
      expect(page.root?.hasAttribute('expanded')).toBe(false);
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(true);
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
    });

    it('toggles expanded when the caret button is activated', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Caret"></md-list-item>');
      const btn = caret(page);
      btn?.click();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(true);
      btn?.click();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
    });

    it('emits mdExpand on toggle with the new state', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Notify"></md-list-item>');
      const events: Array<{ expanded: boolean; index?: number; value?: string; item?: HTMLElement }> = [];
      page.root?.addEventListener('mdExpand', (e: Event) => {
        events.push((e as CustomEvent<{ expanded: boolean; index?: number; value?: string; item?: HTMLElement }>).detail);
      });
      page.root?.click();
      await page.waitForChanges();
      page.root?.click();
      await page.waitForChanges();
      expect(events).toEqual([
        expect.objectContaining({ expanded: true, index: 0, value: 'Notify', item: page.root }),
        expect.objectContaining({ expanded: false, index: 0, value: 'Notify', item: page.root }),
      ]);
    });

    it('emits mdExpand with distinct index per parent row in a list', async () => {
      const page = await newSpecPage({
        components: [MdList, MdListItem, MdIconButton],
        html: `
          <md-list>
            <md-list-item expandable headline="First"></md-list-item>
            <md-list-item expandable headline="Second"></md-list-item>
          </md-list>
        `,
      });
      const items = page.root?.querySelectorAll('md-list-item');
      const events: Array<{ expanded: boolean; index?: number; value?: string }> = [];
      items?.forEach(item => {
        item.addEventListener('mdExpand', (e: Event) => {
          events.push((e as CustomEvent<{ expanded: boolean; index?: number; value?: string }>).detail);
        });
      });
      items?.[0]?.click();
      await page.waitForChanges();
      items?.[1]?.click();
      await page.waitForChanges();
      expect(events).toEqual([
        expect.objectContaining({ expanded: true, index: 0, value: 'First' }),
        expect.objectContaining({ expanded: true, index: 1, value: 'Second' }),
      ]);
    });

    it('exposes toggle / expand / collapse methods', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Methods"></md-list-item>');
      const item = page.root as unknown as HTMLMdListItemElement;
      await item.expand();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(true);
      await item.collapse();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
      await item.toggle();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(true);
    });

    it('sets aria-expanded and aria-controls on the caret control', async () => {
      const page = await createExpandable('<md-list-item expandable headline="A11y"></md-list-item>');
      const btn = caret(page);
      expect(btn?.getAttribute('aria-expanded')).toBe('false');
      const controls = btn?.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      const panel = page.root?.shadowRoot?.querySelector('[part="expanded-panel"]');
      expect(panel?.id).toBe(controls!);
    });

    it('updates the caret aria-expanded when toggled', async () => {
      const page = await createExpandable('<md-list-item expandable headline="A11y"></md-list-item>');
      page.root?.click();
      await page.waitForChanges();
      expect(caret(page)?.getAttribute('aria-expanded')).toBe('true');
    });

    it('gives the caret a descriptive aria-label', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Settings"></md-list-item>');
      expect(caret(page)?.getAttribute('aria-label')).toBe('Expand Settings');
      page.root?.click();
      await page.waitForChanges();
      expect(caret(page)?.getAttribute('aria-label')).toBe('Collapse Settings');
    });

    it('keeps role="listitem" when expandable (the caret is the button)', async () => {
      const page = await createExpandable('<md-list-item expandable headline="Role"></md-list-item>');
      expect(page.root?.getAttribute('role')).toBe('listitem');
      expect(page.root?.hasAttribute('aria-expanded')).toBe(false);
    });

    it('does not emit mdExpand when soft-disabled', async () => {
      const page = await createExpandable('<md-list-item expandable soft-disabled headline="Off"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdExpand', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.root?.expanded).toBe(false);
    });

    it('does not emit mdExpand when disabled', async () => {
      const page = await createExpandable('<md-list-item expandable disabled headline="Off"></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdExpand', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
    });

    it('expands on ArrowRight / collapses on ArrowLeft when the row is focusable (type=button)', async () => {
      const page = await createExpandable('<md-list-item expandable type="button" headline="Arrows"></md-list-item>');
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(true);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
    });

    it('toggle() is a no-op when not expandable', async () => {
      const page = await createExpandable('<md-list-item headline="Plain"></md-list-item>');
      const item = page.root as unknown as HTMLMdListItemElement;
      await item.toggle();
      await page.waitForChanges();
      expect(page.root?.hasAttribute('expanded')).toBe(false);
    });

    it('marks the host expanded when open so the leading icon can fill', async () => {
      const page = await createExpandable(
        '<md-list-item expandable expanded headline="Open" leading-icon="star"></md-list-item>',
      );
      expect(page.root?.shadowRoot?.querySelector('.md-list-item__icon')).toBeTruthy();
      expect(page.root).toHaveClass('md-list-item--expanded');
    });

    it('selects an expanded-content child without collapsing the parent', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent" data-selection-mode="single-select">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      const children = Array.from(parent.children).filter(
        c => c.tagName === 'MD-LIST-ITEM',
      ) as HTMLMdListItemElement[];
      expect(parent.expanded).toBe(true);

      children[1].click();
      await page.waitForChanges();

      expect(parent.expanded).toBe(true);
      expect(children[0].selected).toBe(false);
      expect(children[1].selected).toBe(true);
    });

    it('emits mdItemSelect when an expanded-content child is activated', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent" data-selection-mode="single-select">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      const children = Array.from(parent.children).filter(
        c => c.tagName === 'MD-LIST-ITEM',
      ) as HTMLMdListItemElement[];
      const spy = jest.fn();
      parent.addEventListener('mdItemSelect', spy);

      children[1].click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.index).toBe(1);
      expect(spy.mock.calls[0][0].detail.value).toBe('Child B');
      expect(spy.mock.calls[0][0].detail.selected).toBe(true);
      expect(spy.mock.calls[0][0].detail.item).toBe(children[1]);
    });

    it('ignores expanded-content clicks when toggling the disclosure', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent">
          <md-list-item slot="expanded-content" type="button" headline="Child"></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      const child = parent.querySelector('[slot="expanded-content"]') as HTMLMdListItemElement;
      child.click();
      await page.waitForChanges();
      expect(parent.expanded).toBe(true);
    });

    it('does not flash parent press state when an expanded-content child is pressed', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent" data-selection-mode="single-select">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      const child = parent.querySelectorAll('[slot="expanded-content"]')[1] as HTMLMdListItemElement;

      /* jsdom has no PointerEvent — synthesize the bubbled pointerdown the parent
         host receives when a slotted child row is pressed. */
      const pointerDown = new MouseEvent('pointerdown', { bubbles: true, composed: true });
      Object.defineProperty(pointerDown, 'composedPath', {
        value: () => [child, parent, document, window],
      });
      parent.dispatchEvent(pointerDown);
      await page.waitForChanges();

      expect(parent).not.toHaveClass('md-list-item--pressed');
      expect(parent.expanded).toBe(true);

      child.click();
      await page.waitForChanges();

      expect(parent).not.toHaveClass('md-list-item--pressed');
      expect(parent.expanded).toBe(true);
      expect(child.selected).toBe(true);
    });

    it('does not participate in list selection when expandable', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent" data-selection-mode="single-select">
          <md-list-item slot="expanded-content" type="button" headline="Child"></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      expect(parent.getAttribute('role')).toBe('listitem');
      expect(parent).not.toHaveClass('md-list-item--selection-mode');
      expect(parent).not.toHaveClass('md-list-item--selected');
      expect(parent.getAttribute('aria-selected')).toBeNull();
    });

    it('clears selected when expandable and does not emit mdItemClick on toggle', async () => {
      const page = await createExpandable(`
        <md-list-item expandable headline="Parent" data-selection-mode="single-select" selected></md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      expect(parent.selected).toBe(false);
      expect(parent).not.toHaveClass('md-list-item--selected');

      const itemClickSpy = jest.fn();
      parent.addEventListener('mdItemClick', itemClickSpy);
      parent.click();
      await page.waitForChanges();

      expect(parent.hasAttribute('expanded')).toBe(true);
      expect(itemClickSpy).not.toHaveBeenCalled();
    });

    it('keeps filled leading icon when expanded without selection tint', async () => {
      const page = await createExpandable(`
        <md-list-item expandable expanded headline="Parent" leading-icon="star" data-selection-mode="single-select" selected>
          <md-list-item slot="expanded-content" type="button" headline="Child" selected></md-list-item>
        </md-list-item>
      `);
      const parent = page.root as HTMLMdListItemElement;
      expect(parent).toHaveClass('md-list-item--expanded');
      expect(parent).not.toHaveClass('md-list-item--selected');
      expect(parent.selected).toBe(false);
    });
  });

  /* ----------------------------------------------------------
     TRUNCATION TOOLTIPS
     The headline + supporting-text spans are wrapped in a STABLE md-tooltip
     that is enabled only while the text is actually clipped. jsdom can't
     compute real layout, so overflow is simulated by stubbing
     scrollWidth/clientWidth and invoking the (synchronous) toggle directly —
     this exercises the same measurement → `disabled` flip used at runtime,
     deterministically and without depending on rAF/ResizeObserver timing.
     ---------------------------------------------------------- */
  describe('truncation tooltips', () => {
    async function createWithTooltip(html: string) {
      return newSpecPage({ components: [MdListItem, MdTooltip], html });
    }

    function stubSize(
      el: Element,
      scrollWidth: number,
      clientWidth: number,
      scrollHeight = 0,
      clientHeight = 0,
    ) {
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth });
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth });
      Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
      Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
    }

    it('wraps headline + supporting text in a stable md-tooltip', async () => {
      const page = await createWithTooltip(
        '<md-list-item headline="Item" supporting-text="Sub"></md-list-item>',
      );
      const headlineTip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip');
      const supportingTip = page.root?.shadowRoot?.querySelector('.md-list-item__supporting-tooltip');
      expect(headlineTip).toBeTruthy();
      expect(supportingTip).toBeTruthy();
    });

    it('uses NO native title attribute on the text spans', async () => {
      const page = await createWithTooltip(
        '<md-list-item headline="Item" supporting-text="Sub"></md-list-item>',
      );
      const headline = page.root?.shadowRoot?.querySelector('.md-list-item__headline');
      const supporting = page.root?.shadowRoot?.querySelector('.md-list-item__supporting-text');
      expect(headline?.hasAttribute('title')).toBe(false);
      expect(supporting?.hasAttribute('title')).toBe(false);
    });

    it('seeds the tooltip text with the full headline / supporting text', async () => {
      const page = await createWithTooltip(
        '<md-list-item headline="Invoice" supporting-text="Accounting · Payment due"></md-list-item>',
      );
      const headlineTip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip') as any;
      const supportingTip = page.root?.shadowRoot?.querySelector('.md-list-item__supporting-tooltip') as any;
      expect(headlineTip.text).toBe('Invoice');
      expect(supportingTip.text).toBe('Accounting · Payment due');
    });

    it('keeps the tooltip DISABLED when the headline fits', async () => {
      const page = await createWithTooltip('<md-list-item headline="Short"></md-list-item>');
      await page.waitForChanges();
      const inst = page.rootInstance as any;
      stubSize(inst.headlineEl, 60, 200); // scrollWidth < clientWidth → fits
      inst.applyTooltipToggle(inst.headlineEl, inst.headlineTooltipEl, 'headlineTruncated', false);
      const tip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip') as any;
      expect(tip.disabled).toBe(true);
    });

    it('ENABLES the headline tooltip when the headline is truncated', async () => {
      const page = await createWithTooltip(
        '<md-list-item headline="Re: Project timeline update and milestone deliverables for Q3"></md-list-item>',
      );
      await page.waitForChanges();
      const inst = page.rootInstance as any;
      stubSize(inst.headlineEl, 600, 120); // scrollWidth > clientWidth → clipped
      inst.applyTooltipToggle(inst.headlineEl, inst.headlineTooltipEl, 'headlineTruncated', false);
      const tip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip') as any;
      expect(tip.disabled).toBe(false);
      expect(tip.text).toBe('Re: Project timeline update and milestone deliverables for Q3');
    });

    it('ENABLES the supporting tooltip when supporting text is clipped (line-clamp height)', async () => {
      const page = await createWithTooltip(
        '<md-list-item headline="Invoice" overline="Bill" supporting-text="Accounting · Payment due in 5 days for the Q3 vendor reconciliation"></md-list-item>',
      );
      await page.waitForChanges();
      const inst = page.rootInstance as any;
      // 3-line row → supporting text line-clamps; simulate vertical clipping only.
      stubSize(inst.supportingEl, 100, 100, 80, 40);
      inst.applyTooltipToggle(inst.supportingEl, inst.supportingTooltipEl, 'supportingTruncated', true);
      const tip = page.root?.shadowRoot?.querySelector('.md-list-item__supporting-tooltip') as any;
      expect(tip.disabled).toBe(false);
    });

    it('only flips `disabled` once per truncation transition (no churn on repeat ticks)', async () => {
      const page = await createWithTooltip('<md-list-item headline="Short"></md-list-item>');
      await page.waitForChanges();
      const inst = page.rootInstance as any;
      stubSize(inst.headlineEl, 600, 120); // clipped
      const tip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip') as any;
      let writes = 0;
      const real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(tip), 'disabled');
      Object.defineProperty(tip, 'disabled', {
        configurable: true,
        get: () => real?.get?.call(tip),
        set: v => {
          writes++;
          real?.set?.call(tip, v);
        },
      });
      inst.applyTooltipToggle(inst.headlineEl, inst.headlineTooltipEl, 'headlineTruncated', false);
      inst.applyTooltipToggle(inst.headlineEl, inst.headlineTooltipEl, 'headlineTruncated', false);
      inst.applyTooltipToggle(inst.headlineEl, inst.headlineTooltipEl, 'headlineTruncated', false);
      expect(writes).toBe(1); // guarded — only the initial flip touches the DOM
    });

    it('updates the tooltip text when the headline prop changes', async () => {
      const page = await createWithTooltip('<md-list-item headline="Short"></md-list-item>');
      await page.waitForChanges();
      page.root!.headline = 'Much longer headline that will truncate in a narrow container';
      await page.waitForChanges();
      const tip = page.root?.shadowRoot?.querySelector('.md-list-item__headline-tooltip') as any;
      expect(tip.text).toBe('Much longer headline that will truncate in a narrow container');
    });
  });

  /* ----------------------------------------------------------
     REORDER (drag handle + keyboard)
     ---------------------------------------------------------- */
  describe('reorderable', () => {
    it('renders a trailing drag handle when reorderable', async () => {
      const page = await create('<md-list-item type="button" headline="A" reorderable></md-list-item>');
      const handle = page.root?.shadowRoot?.querySelector('[data-list-drag-handle="true"]');
      expect(handle).toBeTruthy();
      expect(handle).toHaveClass('md-list-item__drag-handle');
      expect(handle?.getAttribute('part')).toBe('drag-handle');
      expect(page.root).toHaveClass('md-list-item--reorderable');
    });

    it('does not render a drag handle by default', async () => {
      const page = await create('<md-list-item type="button" headline="A"></md-list-item>');
      expect(page.root?.shadowRoot?.querySelector('[data-list-drag-handle="true"]')).toBeFalsy();
    });

    it('emits mdItemRequestReorder=down on Alt+ArrowDown', async () => {
      const page = await create('<md-list-item type="button" headline="A" reorderable></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemRequestReorder', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.direction).toBe('down');
    });

    it('emits mdItemRequestReorder=up on Alt+ArrowUp', async () => {
      const page = await create('<md-list-item type="button" headline="A" reorderable></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemRequestReorder', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail.direction).toBe('up');
    });

    it('does not emit reorder when disabled', async () => {
      const page = await create('<md-list-item type="button" headline="A" reorderable disabled></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemRequestReorder', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('a click bubbling from the drag handle does not activate the row', async () => {
      const page = await create('<md-list-item type="button" headline="A" reorderable></md-list-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      const handle = page.root?.shadowRoot?.querySelector('[data-list-drag-handle="true"]') as HTMLElement;
      handle?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

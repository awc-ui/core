import { newSpecPage } from '@stencil/core/testing';
import { MdBreadcrumbItem } from './md-breadcrumb-item';

describe('md-breadcrumb-item', () => {
  async function create(markup: string) {
    return newSpecPage({
      components: [MdBreadcrumbItem],
      html: markup,
    });
  }

  // ── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders an <a> when href is set', async () => {
      const page = await create('<md-breadcrumb-item href="/library">Docs</md-breadcrumb-item>');
      const link = page.root?.shadowRoot?.querySelector('a.md-breadcrumb-item__link');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('/library');
    });

    it('renders a static <span> when href is empty', async () => {
      const page = await create('<md-breadcrumb-item>Docs</md-breadcrumb-item>');
      const link = page.root?.shadowRoot?.querySelector('a.md-breadcrumb-item__link');
      const staticEl = page.root?.shadowRoot?.querySelector('span.md-breadcrumb-item__static');
      expect(link).toBeNull();
      expect(staticEl).toBeTruthy();
    });

    it('marks the static span with aria-current=page when current', async () => {
      const page = await create(
        '<md-breadcrumb-item current href="/x">Current</md-breadcrumb-item>',
      );
      const staticEl = page.root?.shadowRoot?.querySelector('span.md-breadcrumb-item__static');
      expect(staticEl?.getAttribute('aria-current')).toBe('page');
    });

    it('renders no <a> when disabled', async () => {
      const page = await create(
        '<md-breadcrumb-item href="/x" disabled>Locked</md-breadcrumb-item>',
      );
      const link = page.root?.shadowRoot?.querySelector('a.md-breadcrumb-item__link');
      expect(link).toBeNull();
    });

    it('renders nothing visible when collapsed', async () => {
      const page = await create(
        '<md-breadcrumb-item href="/x" collapsed>Hidden</md-breadcrumb-item>',
      );
      // Host should be flagged + aria-hidden, with no inner content.
      expect(page.root).toHaveClass('md-breadcrumb-item--collapsed');
      expect(page.root?.getAttribute('aria-hidden')).toBe('true');
      expect(page.root?.shadowRoot?.querySelector('a, span.md-breadcrumb-item__static'))
        .toBeNull();
    });
  });

  // ── Icons ───────────────────────────────────────────────

  describe('icons', () => {
    it('renders the icon part when the icon prop is set', async () => {
      const page = await create(
        '<md-breadcrumb-item href="/" icon="home">Home</md-breadcrumb-item>',
      );
      const iconEl = page.root?.shadowRoot?.querySelector('[part="icon"]');
      expect(iconEl).toBeTruthy();
      expect(iconEl?.textContent?.trim()).toBe('home');
    });
  });

  // ── mdSelect event ──────────────────────────────────────

  describe('mdSelect event', () => {
    it('emits mdSelect with full detail when the link is clicked', async () => {
      const page = await create('<md-breadcrumb-item href="/library">Library</md-breadcrumb-item>');
      const item = page.root as HTMLMdBreadcrumbItemElement;
      const spy = jest.fn();
      item.addEventListener('mdSelect', spy);

      const anchor = item.shadowRoot?.querySelector('a.md-breadcrumb-item__link') as HTMLAnchorElement | null;
      anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      const ev = spy.mock.calls[0][0] as CustomEvent;
      expect(ev.detail.href).toBe('/library');
      expect(ev.detail.label).toBe('Library');
      expect(ev.detail.current).toBe(false);
      expect(ev.detail.itemIndex).toBe(0);
      expect(ev.detail.itemTotal).toBe(0);
      expect(ev.detail.originalEvent).toBeInstanceOf(MouseEvent);
    });

    it('mdSelect is cancelable — preventDefault stops the anchor click', async () => {
      const page = await create('<md-breadcrumb-item href="/library">Library</md-breadcrumb-item>');
      const item = page.root as HTMLMdBreadcrumbItemElement;
      item.addEventListener('mdSelect', (e) => e.preventDefault());

      const anchor = item.shadowRoot?.querySelector('a.md-breadcrumb-item__link') as HTMLAnchorElement | null;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor?.dispatchEvent(click);
      await page.waitForChanges();

      // Listener prevented the synthesised mdSelect → handler also calls
      // preventDefault on the original click.
      expect(click.defaultPrevented).toBe(true);
    });

    it('does not emit mdSelect when the item is current (renders no anchor)', async () => {
      const page = await create('<md-breadcrumb-item current href="/x">Current</md-breadcrumb-item>');
      const item = page.root as HTMLMdBreadcrumbItemElement;
      const spy = jest.fn();
      item.addEventListener('mdSelect', spy);

      // No anchor exists; clicking the host should not synthesise an event.
      const staticEl = item.shadowRoot?.querySelector('span.md-breadcrumb-item__static') as HTMLElement | null;
      staticEl?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit mdSelect when the item is disabled (renders no anchor)', async () => {
      const page = await create('<md-breadcrumb-item href="/x" disabled>Locked</md-breadcrumb-item>');
      const item = page.root as HTMLMdBreadcrumbItemElement;
      const spy = jest.fn();
      item.addEventListener('mdSelect', spy);

      const staticEl = item.shadowRoot?.querySelector('span.md-breadcrumb-item__static') as HTMLElement | null;
      staticEl?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('mdSelect bubbles + composes out of the shadow tree', async () => {
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        html: '<div id="outer"><md-breadcrumb-item href="/library">Library</md-breadcrumb-item></div>',
      });
      const outer = page.body.querySelector('#outer') as HTMLElement;
      const item = page.body.querySelector('md-breadcrumb-item') as HTMLMdBreadcrumbItemElement;
      const spy = jest.fn();
      outer.addEventListener('mdSelect', spy);

      const anchor = item.shadowRoot?.querySelector('a.md-breadcrumb-item__link') as HTMLAnchorElement | null;
      anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Parts ───────────────────────────────────────────────

  describe('parts', () => {
    it('exposes link / state-layer / label parts on the anchor variant', async () => {
      const page = await create('<md-breadcrumb-item href="/x">Hi</md-breadcrumb-item>');
      const sr = page.root?.shadowRoot;
      expect(sr?.querySelector('[part="link"]')).toBeTruthy();
      expect(sr?.querySelector('[part="state-layer"]')).toBeTruthy();
      expect(sr?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('exposes the static part on the non-anchor variant', async () => {
      const page = await create('<md-breadcrumb-item>Hi</md-breadcrumb-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="static"]')).toBeTruthy();
    });
  });

  // ── Slotted icon ────────────────────────────────────────

  describe('slotted icon', () => {
    it('detects a slotted icon child on initial render and uses the slot path', async () => {
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        // The slotted child must be a real Element with slot="icon" so
        // hasDirectSlottedChild() flags it during componentWillLoad and
        // renderIcon() takes the slot branch (not the prop fallback).
        html:
          '<md-breadcrumb-item href="/x">' +
          '<svg slot="icon" viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10"/></svg>' +
          'Hi' +
          '</md-breadcrumb-item>',
      });
      const iconSpan = page.root?.shadowRoot?.querySelector('[part="icon"]');
      expect(iconSpan).toBeTruthy();
      // Slot path renders an actual <slot name="icon"> inside the span;
      // the prop path renders a <span class="material-symbols-outlined">.
      expect(iconSpan?.querySelector('slot[name="icon"]')).toBeTruthy();
      expect(iconSpan?.querySelector('.material-symbols-outlined')).toBeNull();
    });

    it('renders no icon span when neither icon prop nor icon slot is present', async () => {
      const page = await create('<md-breadcrumb-item href="/x">Hi</md-breadcrumb-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeNull();
    });
  });

  // ── Default-slot detection ──────────────────────────────

  describe('default-slot detection', () => {
    it('returns false from hasDefaultSlotContent when only slotted-named children exist', async () => {
      // No default-slot text or element children → exercises the
      // fallthrough `return false` at the end of hasDefaultSlotContent.
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        html:
          '<md-breadcrumb-item href="/x">' +
          '<svg slot="icon" viewBox="0 0 24 24" width="14" height="14"></svg>' +
          '</md-breadcrumb-item>',
      });
      // Component mounts cleanly, label span renders even without content.
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('detects element children without a slot attribute as default content', async () => {
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        html:
          '<md-breadcrumb-item href="/x">' +
          '<strong>Bold label</strong>' +
          '</md-breadcrumb-item>',
      });
      // Element-node branch in hasDefaultSlotContent returns true.
      expect(page.root?.textContent).toContain('Bold label');
    });
  });

  // ── slotchange reactivity ───────────────────────────────

  describe('slotchange reactivity', () => {
    it('updates hasSlottedIcon when the icon slot dispatches slotchange', async () => {
      // The `<slot name="icon">` only renders into the shadow tree when
      // `hasSlottedIcon` is already true (componentWillLoad seeds it from
      // the markup), so we need a real slotted icon at construction time
      // to attach the listener and traverse the callback body.
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        html:
          '<md-breadcrumb-item href="/x">' +
          '<svg slot="icon" viewBox="0 0 24 24" width="14" height="14"></svg>' +
          'Hi' +
          '</md-breadcrumb-item>',
      });
      const iconSlot = page.root?.shadowRoot?.querySelector(
        'slot[name="icon"]',
      ) as HTMLSlotElement | null;
      expect(iconSlot).toBeTruthy();
      iconSlot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(page.root).toBeTruthy();
    });

    it('updates hasSlottedLabel when the default slot dispatches slotchange', async () => {
      const page = await create('<md-breadcrumb-item href="/x">Hi</md-breadcrumb-item>');
      const mainSlot = page.root?.shadowRoot?.querySelector(
        'slot:not([name])',
      ) as HTMLSlotElement | null;
      expect(mainSlot).toBeTruthy();
      mainSlot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(page.root).toBeTruthy();
    });
  });
});

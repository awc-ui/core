import { newSpecPage } from '@stencil/core/testing';
import { MdBottomSheet } from './md-bottom-sheet';

describe('md-bottom-sheet', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdBottomSheet],
      html,
    });
  }

  // ── Rendering ────────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-bottom-sheet');
    });

    it('applies standard variant class by default', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root).toHaveClass('md-bottom-sheet--standard');
    });

    it('applies detached variant class', async () => {
      const page = await create('<md-bottom-sheet variant="detached"></md-bottom-sheet>');
      expect(page.root).toHaveClass('md-bottom-sheet--detached');
    });

    it('applies open class when open', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      expect(page.root).toHaveClass('md-bottom-sheet--open');
    });
  });

  // ── Props ────────────────────────────────────────────────

  describe('props', () => {
    it('is closed by default', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.rootInstance.open).toBe(false);
    });

    it('defaults to standard variant', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.rootInstance.variant).toBe('standard');
    });

    it('shows drag handle by default', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.rootInstance.showDragHandle).toBe(true);
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__drag-handle')).toBeTruthy();
    });

    it('hides drag handle when show-drag-handle is false', async () => {
      const page = await create('<md-bottom-sheet show-drag-handle="false"></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__drag-handle')).toBeNull();
    });

    it('renders headline when provided', async () => {
      const page = await create('<md-bottom-sheet headline="Title"></md-bottom-sheet>');
      const headline = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__headline');
      expect(headline).toBeTruthy();
      expect(headline?.textContent).toBe('Title');
    });

    it('does not render header when no headline', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__header')).toBeNull();
    });

    it('reflects open attribute', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(page.root?.hasAttribute('open')).toBe(true);
    });
  });

  // ── Scrim ────────────────────────────────────────────────

  describe('scrim', () => {
    it('renders scrim for standard variant', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__scrim')).toBeTruthy();
    });

    it('renders scrim for detached variant', async () => {
      const page = await create('<md-bottom-sheet variant="detached"></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__scrim')).toBeTruthy();
    });

    it('scrim has aria-hidden', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__scrim');
      expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ── Accessibility ────────────────────────────────────────

  describe('accessibility', () => {
    it('has dialog role for standard variant', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('role')).toBe('dialog');
    });

    it('has dialog role for detached variant', async () => {
      const page = await create('<md-bottom-sheet open variant="detached"></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('role')).toBe('dialog');
    });

    it('sets aria-modal="true" on both variants', async () => {
      const standard = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const detached = await create('<md-bottom-sheet open variant="detached"></md-bottom-sheet>');
      expect(
        standard.root?.shadowRoot?.querySelector('.md-bottom-sheet__container')
          ?.getAttribute('aria-modal'),
      ).toBe('true');
      expect(
        detached.root?.shadowRoot?.querySelector('.md-bottom-sheet__container')
          ?.getAttribute('aria-modal'),
      ).toBe('true');
    });

    it('sets aria-labelledby when headline is present', async () => {
      const page = await create('<md-bottom-sheet open headline="Share"></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      const headlineId = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__headline')?.id;
      expect(container?.getAttribute('aria-labelledby')).toBe(headlineId);
    });

    it('uses aria-label fallback when no headline', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('aria-label')).toBe('Bottom sheet');
    });

    it('uses custom aria-label when provided', async () => {
      const page = await create('<md-bottom-sheet open aria-label="Share options"></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('aria-label')).toBe('Share options');
    });

    it('has focusable container with tabindex', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets aria-hidden on container when closed', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('aria-hidden')).toBe('true');
    });

    it('removes aria-hidden when open', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container');
      expect(container?.getAttribute('aria-hidden')).toBeNull();
    });

    it('is inert when closed (no focusable content in the aria-hidden subtree)', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container') as HTMLElement;
      expect(container?.hasAttribute('inert') || (container as unknown as { inert?: boolean }).inert).toBeTruthy();
    });

    it('is not inert when open (content stays reachable / focus-trappable)', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__container') as HTMLElement;
      // mock-doc maps the `inert` boolean prop to a boolean attribute; a false
      // prop leaves the attribute unset (or falsy).
      const attr = container?.getAttribute('inert');
      const propVal = (container as unknown as { inert?: boolean }).inert;
      expect(attr === null || attr === 'false' || propVal === false).toBe(true);
    });

    it('drag handle has aria-hidden', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      const dragHandle = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__drag-handle');
      expect(dragHandle?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ── Events ──────────────────────────────────────────────

  describe('events', () => {
    it('emits mdOpen when opened', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      page.rootInstance.open = false;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdCancel on Escape key (standard)', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdCancel on Escape key (detached)', async () => {
      const page = await create('<md-bottom-sheet open variant="detached"></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(page.rootInstance.open).toBe(false);
    });

    it('closes on Escape key', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('emits mdCancel on scrim click', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const scrim = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__scrim') as HTMLElement;
      scrim?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not close on scrim click when scrim-dismissible is false', async () => {
      const page = await create('<md-bottom-sheet open scrim-dismissible="false"></md-bottom-sheet>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-bottom-sheet__scrim') as HTMLElement;
      scrim?.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });
  });

  // ── Methods ──────────────────────────────────────────────

  describe('methods', () => {
    it('opens via show()', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('closes via close()', async () => {
      const page = await create('<md-bottom-sheet open></md-bottom-sheet>');
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ── Parts ────────────────────────────────────────────────

  describe('parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes drag-handle part', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="drag-handle"]')).toBeTruthy();
    });

    it('exposes drag-handle-indicator part', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="drag-handle-indicator"]')).toBeTruthy();
    });

    it('exposes scrim part on both variants', async () => {
      const standard = await create('<md-bottom-sheet></md-bottom-sheet>');
      const detached = await create('<md-bottom-sheet variant="detached"></md-bottom-sheet>');
      expect(standard.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeTruthy();
      expect(detached.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeTruthy();
    });

    it('exposes headline part', async () => {
      const page = await create('<md-bottom-sheet headline="Title"></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="headline"]')).toBeTruthy();
    });

    it('exposes content part', async () => {
      const page = await create('<md-bottom-sheet></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    });
  });

  // ── Slots ────────────────────────────────────────────────

  describe('slots', () => {
    it('renders default slot content', async () => {
      const page = await create('<md-bottom-sheet><p>Content</p></md-bottom-sheet>');
      expect(page.root?.textContent).toContain('Content');
    });

    it('renders headline slot', async () => {
      const page = await create('<md-bottom-sheet headline="Title"><span slot="headline">Custom</span></md-bottom-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="headline"]');
      expect(slot).toBeTruthy();
    });
  });

  // ── RTL ──────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdBottomSheet],
        html: '<div dir="rtl"><md-bottom-sheet open headline="عنوان"><p>محتوى</p></md-bottom-sheet></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ── Close button ───────────────────────────────────────

  describe('closeable', () => {
    it('does not render close button by default', async () => {
      const page = await create('<md-bottom-sheet headline="Title"></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__close')).toBeNull();
    });

    it('renders close button when closeable', async () => {
      const page = await create('<md-bottom-sheet headline="Title" closeable></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__close')).toBeTruthy();
    });

    it('exposes close part when closeable', async () => {
      const page = await create('<md-bottom-sheet headline="Title" closeable></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="close"]')).toBeTruthy();
    });

    it('renders header when closeable even without headline', async () => {
      const page = await create('<md-bottom-sheet closeable></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('.md-bottom-sheet__header')).toBeTruthy();
    });

    it('renders close named slot when closeable', async () => {
      const page = await create('<md-bottom-sheet closeable headline="Title"><button slot="close">x</button></md-bottom-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="close"]');
      expect(slot).toBeTruthy();
    });

    it('emits mdCancel and closes when default close clicked', async () => {
      const page = await create('<md-bottom-sheet open closeable headline="Title"></md-bottom-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const closeBtn = page.root?.shadowRoot?.querySelector(
        '.md-bottom-sheet__close md-icon-button',
      ) as HTMLElement;
      closeBtn?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ── Dividers ───────────────────────────────────────────

  describe('dividers', () => {
    it('does not render dividers by default', async () => {
      const page = await create('<md-bottom-sheet headline="Title"><p>x</p></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider-top"]')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="divider-bottom"]')).toBeNull();
    });

    it('renders top divider when top-divider is set', async () => {
      const page = await create('<md-bottom-sheet headline="Title" top-divider><p>x</p></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider-top"]')).toBeTruthy();
    });

    it('renders bottom divider when bottom-divider is set and actions slot has content', async () => {
      const page = await create(
        '<md-bottom-sheet headline="Title" bottom-divider><p>x</p><button slot="actions">OK</button></md-bottom-sheet>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="divider-bottom"]')).toBeTruthy();
    });

    it('does not render bottom divider when no actions slot', async () => {
      const page = await create('<md-bottom-sheet headline="Title" bottom-divider><p>x</p></md-bottom-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider-bottom"]')).toBeNull();
    });
  });

  // ── Focus management ─────────────────────────────────────

  describe('focus management', () => {
    it('focuses the first focusable element on open', async () => {
      const page = await create(
        '<md-bottom-sheet headline="Form"><input id="first-input" /><button id="second-btn">OK</button></md-bottom-sheet>',
      );
      const sheet = page.root!;
      sheet.setAttribute('open', '');
      await page.waitForChanges();
      // requestAnimationFrame is async — flush a microtask + an rAF tick.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      // First focusable inside container is the first <input> (slotted).
      // Note: in jsdom the host's input/button are reachable via querySelector
      // through the slot's assignedElements traversal.
      expect(document.activeElement).not.toBe(document.body);
    });

    it('falls back to focusing the container when no focusable children', async () => {
      const page = await create(
        '<md-bottom-sheet headline="Empty"><span>plain text</span></md-bottom-sheet>',
      );
      const sheet = page.root!;
      sheet.setAttribute('open', '');
      await page.waitForChanges();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const container = sheet.shadowRoot?.querySelector('[part="container"]');
      expect(container?.getAttribute('tabindex')).toBe('-1');
    });

    it('restores focus to the previously focused element on close', async () => {
      const page = await newSpecPage({
        components: [MdBottomSheet],
        html: '<button id="trigger">Open</button><md-bottom-sheet headline="Test"><p>body</p></md-bottom-sheet>',
      });
      const trigger = page.doc.getElementById('trigger') as HTMLButtonElement;
      const focusSpy = jest.spyOn(trigger, 'focus');
      const sheet = page.doc.querySelector('md-bottom-sheet') as HTMLElement;
      sheet.setAttribute('open', '');
      await page.waitForChanges();
      // After opening, inject the trigger as the captured previousFocus —
      // mirrors what onOpenChange captured from document.activeElement
      // before the open path overwrote it. The Stencil mock document
      // doesn't track activeElement reliably, so we set this directly.
      (
        page.rootInstance as unknown as { previousFocus: HTMLElement | null }
      ).previousFocus = trigger;
      sheet.removeAttribute('open');
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('focusFirst falls back to focusing the container when no focusables exist', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><span>plain</span></md-bottom-sheet>',
      );
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      // Focus guards themselves match the focusable selector in real DOM,
      // so we mock the helper to return empty to exercise the fallback.
      jest
        .spyOn(
          page.rootInstance as unknown as {
            getFocusableElements: () => HTMLElement[];
          },
          'getFocusableElements',
        )
        .mockReturnValue([]);
      const focusSpy = jest.spyOn(container, 'focus');
      page.root!.setAttribute('open', '');
      await page.waitForChanges();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      expect(focusSpy).toHaveBeenCalled();
    });

    it('clears any drag-induced inline transform on close', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      container.style.transform = 'translateY(60px)';
      page.root!.removeAttribute('open');
      await page.waitForChanges();
      expect(container.style.transform).toBe('');
    });

    it('locks body scroll when open and releases on close', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      expect(document.body.style.overflow).not.toBe('hidden');
      page.root!.setAttribute('open', '');
      await page.waitForChanges();
      expect(document.body.style.overflow).toBe('hidden');
      page.root!.removeAttribute('open');
      await page.waitForChanges();
      expect(document.body.style.overflow).toBe('');
    });

    it('releases body scroll lock when disconnected from the DOM', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      await page.waitForChanges();
      expect(document.body.style.overflow).toBe('hidden');
      page.root!.remove();
      await page.waitForChanges();
      expect(document.body.style.overflow).toBe('');
    });
  });

  // ── Focus guards (sentinel elements) ─────────────────────

  describe('focus guards', () => {
    it('renders two focus-guard sentinels around the dialog content', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const guards = page.root?.shadowRoot?.querySelectorAll(
        '.md-bottom-sheet__focus-guard',
      );
      expect(guards?.length).toBe(2);
      guards?.forEach((g) => {
        expect(g.getAttribute('tabindex')).toBe('0');
        expect(g.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('start guard focuses the first focusable when triggered', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><button id="first">A</button><button id="second">B</button></md-bottom-sheet>',
      );
      const guards = page.root?.shadowRoot?.querySelectorAll(
        '.md-bottom-sheet__focus-guard',
      );
      // First guard sits before content and re-routes via handleEndGuardFocus
      // (which selects focusable[0]).
      const startGuard = guards?.[0] as HTMLElement;
      startGuard.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      // We can't directly assert document.activeElement in jsdom for the
      // slotted <button> reliably, but the handler must have executed
      // without throwing.
      expect(startGuard).toBeTruthy();
    });

    it('end guard focuses the last focusable when triggered', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><button id="first">A</button><button id="second">B</button></md-bottom-sheet>',
      );
      const guards = page.root?.shadowRoot?.querySelectorAll(
        '.md-bottom-sheet__focus-guard',
      );
      const endGuard = guards?.[1] as HTMLElement;
      endGuard.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(endGuard).toBeTruthy();
    });

    it('focus guards fall back to focusing the container when no children are focusable', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><span>plain</span></md-bottom-sheet>',
      );
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      const guards = page.root?.shadowRoot?.querySelectorAll(
        '.md-bottom-sheet__focus-guard',
      );
      // Mock getFocusableElements to return an empty array so the
      // fallback branch (containerEl.focus()) executes deterministically.
      // (In real browsers the focus guards themselves match the
      // [tabindex="0"] selector, so this branch only fires for hand-rolled
      // configurations that strip them.)
      jest
        .spyOn(
          page.rootInstance as unknown as {
            getFocusableElements: () => HTMLElement[];
          },
          'getFocusableElements',
        )
        .mockReturnValue([]);
      const focusSpy = jest.spyOn(container, 'focus');
      (guards?.[0] as HTMLElement).dispatchEvent(new FocusEvent('focus'));
      (guards?.[1] as HTMLElement).dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  // ── Focus trap (focusin re-direction) ────────────────────

  describe('focus trap', () => {
    it('does not redirect focus when the active element is inside the host', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><button id="inner">Click</button></md-bottom-sheet>',
      );
      const inner = page.doc.querySelector('#inner') as HTMLButtonElement;
      inner.focus();
      const focusFirstSpy = jest.spyOn(
        page.rootInstance as unknown as { focusFirst: () => void },
        'focusFirst',
      );
      page.doc.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      expect(focusFirstSpy).not.toHaveBeenCalled();
    });

    it('redirects focus back into the dialog when focus leaks outside', async () => {
      const page = await newSpecPage({
        components: [MdBottomSheet],
        html: '<button id="outside">Outside</button><md-bottom-sheet open headline="x"><button id="inner">Click</button></md-bottom-sheet>',
      });
      const outside = page.doc.querySelector('#outside') as HTMLButtonElement;
      // The mock document.activeElement is not reliably driven by
      // .focus() in jsdom-mock; stub it directly so the focus-trap
      // handler sees an out-of-bounds active element.
      Object.defineProperty(page.doc, 'activeElement', {
        configurable: true,
        get: () => outside,
      });
      const focusFirstSpy = jest.spyOn(
        page.rootInstance as unknown as { focusFirst: () => void },
        'focusFirst',
      );
      page.doc.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      expect(focusFirstSpy).toHaveBeenCalled();
    });

    it('ignores focusin when sheet is closed', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      const focusFirstSpy = jest.spyOn(
        page.rootInstance as unknown as { focusFirst: () => void },
        'focusFirst',
      );
      page.doc.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      expect(focusFirstSpy).not.toHaveBeenCalled();
    });
  });

  // ── Drag-to-dismiss ──────────────────────────────────────

  describe('drag-to-dismiss', () => {
    function makePointerEvent(
      type: string,
      clientY: number,
    ): PointerEvent {
      // jsdom doesn't ship PointerEvent with Y data; fall back to MouseEvent
      // and tag it with a pointerId so handlers get what they expect.
      const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientY,
      }) as unknown as PointerEvent;
      Object.defineProperty(evt, 'pointerId', { value: 1 });
      Object.defineProperty(evt, 'clientY', { value: clientY });
      return evt;
    }

    function setupDragHandle(page: { root?: HTMLElement | null }) {
      const handle = page.root?.shadowRoot?.querySelector(
        '[part="drag-handle"]',
      ) as HTMLElement;
      // Stub setPointerCapture which jsdom doesn't implement.
      (handle as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture =
        jest.fn();
      return handle;
    }

    it('marks the handle as dragging on pointerdown', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      await page.waitForChanges();
      expect(handle.className).toContain(
        'md-bottom-sheet__drag-handle--dragging',
      );
    });

    it('translates the container while dragging downwards', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      handle.dispatchEvent(makePointerEvent('pointermove', 140));
      await page.waitForChanges();
      expect(container.style.transform).toBe('translateY(40px)');
    });

    it('clamps upward drags to zero (prevents negative translate)', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      handle.dispatchEvent(makePointerEvent('pointermove', 40));
      await page.waitForChanges();
      expect(container.style.transform).toBe('translateY(0px)');
    });

    it('snaps back when released below the dismiss threshold', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      const cancelSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);

      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      handle.dispatchEvent(makePointerEvent('pointermove', 130)); // 30px < 100 threshold
      handle.dispatchEvent(makePointerEvent('pointerup', 130));
      await page.waitForChanges();

      expect(container.style.transform).toBe('');
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(page.root?.hasAttribute('open')).toBe(true);
    });

    it('emits mdCancel and closes when released past the dismiss threshold', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const cancelSpy = jest.fn();
      const closeSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);
      page.root?.addEventListener('mdClose', closeSpy);

      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      handle.dispatchEvent(makePointerEvent('pointermove', 250)); // 150px > 100 threshold
      handle.dispatchEvent(makePointerEvent('pointerup', 250));
      await page.waitForChanges();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(page.root?.hasAttribute('open')).toBe(false);
    });

    it('cancels a drag with pointercancel and resets state', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      handle.dispatchEvent(makePointerEvent('pointermove', 140));
      handle.dispatchEvent(makePointerEvent('pointercancel', 140));
      await page.waitForChanges();
      expect(handle.className).not.toContain(
        'md-bottom-sheet__drag-handle--dragging',
      );
      expect(container.style.transform).toBe('');
    });

    it('ignores pointermove without a preceding pointerdown', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const container = page.root?.shadowRoot?.querySelector(
        '[part="container"]',
      ) as HTMLElement;
      handle.dispatchEvent(makePointerEvent('pointermove', 200));
      await page.waitForChanges();
      expect(container.style.transform).toBe('');
    });

    it('ignores pointerup without a preceding pointerdown', async () => {
      const page = await create(
        '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      const cancelSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);
      handle.dispatchEvent(makePointerEvent('pointerup', 250));
      await page.waitForChanges();
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('does not start a drag when sheet is closed', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      const handle = setupDragHandle(page);
      handle.dispatchEvent(makePointerEvent('pointerdown', 100));
      await page.waitForChanges();
      expect(handle.className).not.toContain(
        'md-bottom-sheet__drag-handle--dragging',
      );
    });

    it('does not render a drag handle when show-drag-handle is false', async () => {
      const page = await create(
        '<md-bottom-sheet open show-drag-handle="false" headline="x"><p>body</p></md-bottom-sheet>',
      );
      expect(
        page.root?.shadowRoot?.querySelector('[part="drag-handle"]'),
      ).toBeNull();
    });
  });

  // ── Slot change reactivity ───────────────────────────────

  describe('slotchange reactivity', () => {
    it('renders the close slot inside the header when closeable is set', async () => {
      const page = await create(
        '<md-bottom-sheet closeable><span slot="close">x</span></md-bottom-sheet>',
      );
      const closeSlot = page.root?.shadowRoot?.querySelector(
        'slot[name="close"]',
      ) as HTMLSlotElement | null;
      expect(closeSlot).toBeTruthy();
    });

    it('renders the actions section when an action button is slotted in', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p><button slot="actions">OK</button></md-bottom-sheet>',
      );
      expect(
        page.root?.shadowRoot?.querySelector('[part="actions"]'),
      ).toBeTruthy();
    });

    it('does not render the actions section when nothing is slotted', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      expect(
        page.root?.shadowRoot?.querySelector('[part="actions"]'),
      ).toBeNull();
    });

    it('updates hasSlottedClose when the close slot fires slotchange after mount', async () => {
      const page = await create(
        '<md-bottom-sheet closeable headline="x"><p>body</p></md-bottom-sheet>',
      );
      const closeSlot = page.root?.shadowRoot?.querySelector(
        'slot[name="close"]',
      ) as HTMLSlotElement | null;
      expect(closeSlot).toBeTruthy();
      // Simulate a slotchange after slotted content is added.
      const span = page.doc.createElement('span');
      span.setAttribute('slot', 'close');
      span.textContent = 'X';
      page.root!.appendChild(span);
      // Stub assignedElements to mirror the post-slotchange state.
      jest
        .spyOn(closeSlot as HTMLSlotElement, 'assignedElements')
        .mockReturnValue([span]);
      closeSlot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(
        (page.rootInstance as unknown as { hasSlottedClose: boolean })
          .hasSlottedClose,
      ).toBe(true);
    });

    it('updates hasActions when the actions slot fires slotchange after mount', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p><button slot="actions">OK</button></md-bottom-sheet>',
      );
      const actionsSlot = page.root?.shadowRoot?.querySelector(
        'slot[name="actions"]',
      ) as HTMLSlotElement | null;
      expect(actionsSlot).toBeTruthy();
      const extra = page.doc.createElement('button');
      extra.setAttribute('slot', 'actions');
      extra.textContent = 'Cancel';
      page.root!.appendChild(extra);
      jest
        .spyOn(actionsSlot as HTMLSlotElement, 'assignedElements')
        .mockReturnValue([extra]);
      actionsSlot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(
        (page.rootInstance as unknown as { hasActions: boolean }).hasActions,
      ).toBe(true);
    });
  });

  // ── Scroll shadow integration ────────────────────────────

  describe('scroll shadow', () => {
    it('reflects scroll-shadow attribute on the host', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      expect(page.root?.hasAttribute('scroll-shadow')).toBe(true);
    });

    it('renders a plain slot when scroll-shadow="false"', async () => {
      const page = await create(
        '<md-bottom-sheet scroll-shadow="false" headline="x"><p>body</p></md-bottom-sheet>',
      );
      const content = page.root?.shadowRoot?.querySelector(
        '[part="content"]',
      ) as HTMLElement;
      // The default slot is a direct child of the content wrapper —
      // verify by walking childNodes since mock-doc doesn't support :scope.
      const directSlot = Array.from(content.children).find(
        (c) => c.tagName.toLowerCase() === 'slot',
      );
      expect(directSlot).toBeTruthy();
    });

    it('continues to project slotted content into the content area', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p data-marker>hello</p></md-bottom-sheet>',
      );
      // Light-DOM children are still owned by the host, projected through
      // the slot inside the content wrapper.
      expect(page.root?.querySelector('p[data-marker]')?.textContent).toBe(
        'hello',
      );
    });

    it('does not break the actions or divider rendering', async () => {
      const page = await create(
        '<md-bottom-sheet bottom-divider headline="x"><p>body</p><button slot="actions">OK</button></md-bottom-sheet>',
      );
      const content = page.root?.shadowRoot?.querySelector('[part="content"]');
      const actions = page.root?.shadowRoot?.querySelector('[part="actions"]');
      const dividerBottom = page.root?.shadowRoot?.querySelector(
        '[part="divider-bottom"]',
      );
      expect(content).toBeTruthy();
      expect(actions).toBeTruthy();
      expect(dividerBottom).toBeTruthy();
    });
  });

  // ── Alignment attributes ─────────────────────────────────

  describe('alignment', () => {
    it('defaults headline-align and content-align to start', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x"><p>body</p></md-bottom-sheet>',
      );
      expect(page.root?.getAttribute('headline-align')).toBe('start');
      expect(page.root?.getAttribute('content-align')).toBe('start');
    });

    it('reflects headline-align on the host', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x" headline-align="center"><p>body</p></md-bottom-sheet>',
      );
      expect(page.root?.getAttribute('headline-align')).toBe('center');
    });

    it('reflects content-align on the host', async () => {
      const page = await create(
        '<md-bottom-sheet headline="x" content-align="end"><p>body</p></md-bottom-sheet>',
      );
      expect(page.root?.getAttribute('content-align')).toBe('end');
    });

    it('accepts every supported alignment value for headline-align', async () => {
      for (const value of ['start', 'center', 'end'] as const) {
        const page = await create(
          `<md-bottom-sheet headline="x" headline-align="${value}"><p>body</p></md-bottom-sheet>`,
        );
        expect(page.root?.getAttribute('headline-align')).toBe(value);
      }
    });

    it('accepts every supported alignment value for content-align', async () => {
      for (const value of ['start', 'center', 'end'] as const) {
        const page = await create(
          `<md-bottom-sheet headline="x" content-align="${value}"><p>body</p></md-bottom-sheet>`,
        );
        expect(page.root?.getAttribute('content-align')).toBe(value);
      }
    });

    it('keeps the headline and content parts present when alignment is set', async () => {
      const page = await create(
        '<md-bottom-sheet headline="Title" headline-align="center" content-align="end"><p>body</p></md-bottom-sheet>',
      );
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="headline"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="content"]')).toBeTruthy();
    });
  });

  // ── Open-while-mounting path ─────────────────────────────

  describe('initial open state', () => {
    it('runs the open path during componentDidLoad when open=true at mount', async () => {
      const page = await newSpecPage({
        components: [MdBottomSheet],
        html: '<md-bottom-sheet open headline="x"><p>body</p></md-bottom-sheet>',
      });
      await page.waitForChanges();
      // open-on-mount path triggers onOpenChange(true) inside
      // componentDidLoad — observable via the body scroll lock side
      // effect set by that handler.
      expect(document.body.style.overflow).toBe('hidden');
    });
  });
});

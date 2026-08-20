import { newSpecPage } from '@stencil/core/testing';
import { MdCard } from './md-card';

describe('md-card', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdCard],
      html,
    });
  }

  // ─── Rendering ─────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults (elevated)', async () => {
      const page = await create('<md-card>Content</md-card>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-card');
      expect(page.root).toHaveClass('md-card--elevated');
    });

    it('renders filled variant', async () => {
      const page = await create('<md-card variant="filled">Content</md-card>');
      expect(page.root).toHaveClass('md-card--filled');
    });

    it('renders outlined variant', async () => {
      const page = await create('<md-card variant="outlined">Content</md-card>');
      expect(page.root).toHaveClass('md-card--outlined');
    });

    it('renders outline element only for outlined variant', async () => {
      const page = await create('<md-card variant="outlined">Content</md-card>');
      const outline = page.root?.shadowRoot?.querySelector('.md-card__outline');
      expect(outline).toBeTruthy();
      expect(outline?.getAttribute('part')).toBe('outline');
    });

    it('does not render outline for elevated variant', async () => {
      const page = await create('<md-card variant="elevated">Content</md-card>');
      const outline = page.root?.shadowRoot?.querySelector('.md-card__outline');
      expect(outline).toBeNull();
    });

    it('does not render outline for filled variant', async () => {
      const page = await create('<md-card variant="filled">Content</md-card>');
      const outline = page.root?.shadowRoot?.querySelector('.md-card__outline');
      expect(outline).toBeNull();
    });

    it('renders slotted content', async () => {
      const page = await create('<md-card><p>Hello</p></md-card>');
      expect(page.root?.textContent).toContain('Hello');
    });
  });

  // ─── Non-interactive (default) ──────────────────────────────
  describe('non-interactive (default)', () => {
    it('has no role attribute', async () => {
      const page = await create('<md-card>Content</md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();
    });

    it('has no tabindex', async () => {
      const page = await create('<md-card>Content</md-card>');
      expect(page.root?.getAttribute('tabindex')).toBeNull();
    });

    it('does not render state-layer', async () => {
      const page = await create('<md-card>Content</md-card>');
      const stateLayer = page.root?.shadowRoot?.querySelector('.md-card__state-layer');
      expect(stateLayer).toBeNull();
    });

    it('does not render ripple', async () => {
      const page = await create('<md-card>Content</md-card>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple).toBeNull();
    });

    it('does not emit mdClick on click', async () => {
      const page = await create('<md-card>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Interactive ────────────────────────────────────────────
  describe('interactive', () => {
    it('applies interactive class', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root).toHaveClass('md-card--interactive');
    });

    it('has role="button"', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('is focusable via tabindex="0"', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('renders state-layer with part', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const stateLayer = page.root?.shadowRoot?.querySelector('.md-card__state-layer');
      expect(stateLayer).toBeTruthy();
      expect(stateLayer?.getAttribute('part')).toBe('state-layer');
      expect(stateLayer?.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders ripple by default', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple).toBeTruthy();
    });

    it('does not render ripple when ripple=false', async () => {
      const page = await create('<md-card interactive ripple="false">Content</md-card>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple).toBeNull();
    });
  });

  // ─── Events ─────────────────────────────────────────────────
  describe('events', () => {
    it('emits mdClick on click when interactive', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit mdClick when disabled', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit mdClick when soft-disabled', async () => {
      const page = await create('<md-card interactive soft-disabled>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Keyboard ───────────────────────────────────────────────
  describe('keyboard', () => {
    it('activates on Enter when interactive', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space when interactive', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does not activate on keyboard when not interactive', async () => {
      const page = await create('<md-card>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not activate on keyboard when disabled', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not activate on irrelevant keys', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Accessibility ──────────────────────────────────────────
  describe('accessibility', () => {
    it('sets aria-disabled="true" when interactive and disabled', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled="true" when interactive and soft-disabled', async () => {
      const page = await create('<md-card interactive soft-disabled>Content</md-card>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when not disabled', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('does not set aria-disabled when not interactive', async () => {
      const page = await create('<md-card disabled>Content</md-card>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('removes from tab order when disabled', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('remains focusable when soft-disabled', async () => {
      const page = await create('<md-card interactive soft-disabled>Content</md-card>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('passes disabled state to ripple', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple?.getAttribute('disabled')).toBe('');
    });
  });

  // ─── Nested-interactive avoidance ──────────────────────────
  // A role="button" host may not contain focusable descendants (WAI-ARIA
  // "children presentational") — that is an axe `nested-interactive` violation.
  // An interactive card that wraps its own controls must therefore keep a plain
  // container role rather than masquerade as a single button.
  describe('nested-interactive avoidance', () => {
    it('drops role="button" when the content has a focusable <button>', async () => {
      const page = await create('<md-card interactive><button>Action</button></md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();
    });

    it('drops host tabindex when the content has a focusable <button>', async () => {
      const page = await create('<md-card interactive><button>Action</button></md-card>');
      expect(page.root?.getAttribute('tabindex')).toBeNull();
    });

    it('drops role="button" when the content has a link (<a href>)', async () => {
      const page = await create('<md-card interactive><a href="#go">Go</a></md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();
    });

    it('drops role="button" when the content has an interactive md-* control', async () => {
      const page = await create('<md-card interactive><md-button>Save</md-button></md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();
      expect(page.root?.getAttribute('tabindex')).toBeNull();
    });

    it('does not claim aria-disabled when it has focusable content (no button role)', async () => {
      const page = await create('<md-card interactive disabled><button>Action</button></md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('keeps role="button" when the only content is a disabled control (not focusable)', async () => {
      const page = await create('<md-card interactive><button disabled>Nope</button></md-card>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('keeps role="button" for plain non-focusable content', async () => {
      const page = await create('<md-card interactive><p>Just text</p></md-card>');
      expect(page.root?.getAttribute('role')).toBe('button');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('still keeps the interactive class and emits mdClick when content is focusable', async () => {
      const page = await create('<md-card interactive><button>Action</button></md-card>');
      expect(page.root).toHaveClass('md-card--interactive');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('re-adds role="button" once the focusable content is removed', async () => {
      const page = await create('<md-card interactive><button>Action</button></md-card>');
      expect(page.root?.getAttribute('role')).toBeNull();

      page.root!.querySelector('button')!.remove();
      (page.rootInstance as any).detectInteractiveContent();
      await page.waitForChanges();
      expect(page.root?.getAttribute('role')).toBe('button');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });
  });

  // ─── Disabled states ───────────────────────────────────────
  describe('disabled states', () => {
    it('adds disabled class when interactive and disabled', async () => {
      const page = await create('<md-card interactive disabled>Content</md-card>');
      expect(page.root).toHaveClass('md-card--disabled');
    });

    it('adds disabled class when interactive and soft-disabled', async () => {
      const page = await create('<md-card interactive soft-disabled>Content</md-card>');
      expect(page.root).toHaveClass('md-card--disabled');
    });

    it('does not add disabled class when not interactive', async () => {
      const page = await create('<md-card disabled>Content</md-card>');
      expect(page.root).not.toHaveClass('md-card--disabled');
    });
  });

  // ─── Draggable (pointer-event-based) ───────────────────────────
  describe('draggable', () => {
    function ptrEvent(type: string, opts: { clientX?: number; clientY?: number; button?: number; pointerId?: number } = {}) {
      const e = new Event(type, { bubbles: true, cancelable: true }) as any;
      e.clientX = opts.clientX ?? 0;
      e.clientY = opts.clientY ?? 0;
      e.button = opts.button ?? 0;
      e.pointerId = opts.pointerId ?? 1;
      return e;
    }

    async function startDrag(el: HTMLElement, startX = 100, startY = 100, moveX = 120, moveY = 100) {
      el.setPointerCapture = jest.fn();
      el.releasePointerCapture = jest.fn();
      el.dispatchEvent(ptrEvent('pointerdown', { clientX: startX, clientY: startY }));
      el.dispatchEvent(ptrEvent('pointermove', { clientX: moveX, clientY: moveY }));
    }

    it('applies draggable class', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      expect(page.root).toHaveClass('md-card--draggable');
    });

    it('renders state-layer and ripple even without interactive', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      expect(page.root?.shadowRoot?.querySelector('.md-card__state-layer')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
    });

    it('sets aria-grabbed="false" when not dragging', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      expect(page.root?.getAttribute('aria-grabbed')).toBe('false');
    });

    it('enters dragged state after pointer moves past threshold', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      await startDrag(el);
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-card--dragged');
      expect(page.root?.getAttribute('aria-grabbed')).toBe('true');
    });

    it('removes dragged state on pointerup', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      await startDrag(el);
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-card--dragged');

      el.dispatchEvent(ptrEvent('pointerup', { clientX: 120, clientY: 100 }));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-card--dragged');
    });

    it('emits mdDragStart when movement exceeds threshold', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      const spy = jest.fn();
      el.addEventListener('mdDragStart', spy);

      await startDrag(el);
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toMatchObject({ startX: 100, startY: 100 });
    });

    it('emits mdDragMove on every pointermove during drag', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      const spy = jest.fn();
      el.addEventListener('mdDragMove', spy);

      await startDrag(el, 100, 100, 120, 100);
      el.dispatchEvent(ptrEvent('pointermove', { clientX: 140, clientY: 100 }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0].detail).toMatchObject({ clientX: 140, offsetX: 40 });
    });

    it('emits mdDragEnd on pointerup after drag', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      const spy = jest.fn();
      el.addEventListener('mdDragEnd', spy);

      await startDrag(el, 100, 100, 130, 110);
      el.dispatchEvent(ptrEvent('pointerup', { clientX: 130, clientY: 110 }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toMatchObject({ offsetX: 30, offsetY: 10 });
    });

    it('does not emit events when movement is below threshold', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      el.setPointerCapture = jest.fn();
      const spy = jest.fn();
      el.addEventListener('mdDragStart', spy);

      el.dispatchEvent(ptrEvent('pointerdown', { clientX: 100, clientY: 100 }));
      el.dispatchEvent(ptrEvent('pointermove', { clientX: 102, clientY: 101 }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not start drag when disabled', async () => {
      const page = await create('<md-card drag-enabled interactive disabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      el.setPointerCapture = jest.fn();
      const spy = jest.fn();
      el.addEventListener('mdDragStart', spy);

      await startDrag(el);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.root).not.toHaveClass('md-card--dragged');
    });

    it('does not start drag on non-primary button', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      el.setPointerCapture = jest.fn();
      const spy = jest.fn();
      el.addEventListener('mdDragStart', spy);

      el.dispatchEvent(ptrEvent('pointerdown', { clientX: 100, clientY: 100, button: 2 }));
      el.dispatchEvent(ptrEvent('pointermove', { clientX: 120, clientY: 100 }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not set aria-grabbed when not drag-enabled', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root?.getAttribute('aria-grabbed')).toBeNull();
    });

    it('works with interactive + drag-enabled together', async () => {
      const page = await create('<md-card interactive drag-enabled>Content</md-card>');
      expect(page.root).toHaveClass('md-card--interactive');
      expect(page.root).toHaveClass('md-card--draggable');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('suppresses click after drag completes', async () => {
      const page = await create('<md-card interactive drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      const clickSpy = jest.fn();
      el.addEventListener('mdClick', clickSpy);

      await startDrag(el, 100, 100, 120, 100);
      el.dispatchEvent(ptrEvent('pointerup', { clientX: 120, clientY: 100 }));
      await page.waitForChanges();

      el.click();
      await page.waitForChanges();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('resets drag visuals on pointercancel', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      await startDrag(el);
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-card--dragged');

      el.dispatchEvent(ptrEvent('pointercancel', { clientX: 120, clientY: 100 }));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-card--dragged');
    });

    it('cancels in-progress drag when dragEnabled is set to false', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      await startDrag(el);
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-card--dragged');

      (page.rootInstance as any).dragEnabled = false;
      (page.rootInstance as any).onDragEnabledChange();
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-card--dragged');
    });

    it('cleans up listeners on disconnect', async () => {
      const page = await create('<md-card drag-enabled>Content</md-card>');
      const el = page.root! as HTMLElement;
      const removeSpy = jest.spyOn(el, 'removeEventListener');
      el.remove();
      expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });
  });

  // ─── Drag states (interactive without drag-enabled) ────────
  describe('drag states (interactive without drag-enabled)', () => {
    it('does not enter drag state when not drag-enabled', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      const el = page.root! as HTMLElement;
      el.setPointerCapture = jest.fn();
      const spy = jest.fn();
      el.addEventListener('mdDragStart', spy);

      el.dispatchEvent(
        Object.assign(new Event('pointerdown', { bubbles: true }), { clientX: 100, clientY: 100, button: 0, pointerId: 1 }),
      );
      el.dispatchEvent(
        Object.assign(new Event('pointermove', { bubbles: true }), { clientX: 120, clientY: 100, button: 0, pointerId: 1 }),
      );
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Parts ──────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes state-layer part when interactive', async () => {
      const page = await create('<md-card interactive>Content</md-card>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes outline part for outlined variant', async () => {
      const page = await create('<md-card variant="outlined">Content</md-card>');
      expect(page.root?.shadowRoot?.querySelector('[part="outline"]')).toBeTruthy();
    });
  });

  // ─── Slots ──────────────────────────────────────────────────
  describe('slots', () => {
    it('renders default slot content', async () => {
      const page = await create('<md-card><div class="my-content">Hello</div></md-card>');
      expect(page.root?.textContent).toContain('Hello');
    });

    it('renders complex slotted content', async () => {
      const page = await create(`
        <md-card>
          <img src="photo.jpg" alt="Photo" />
          <h3>Title</h3>
          <p>Description</p>
        </md-card>
      `);
      expect(page.root?.querySelector('h3')?.textContent).toBe('Title');
      expect(page.root?.querySelector('p')?.textContent).toBe('Description');
    });
  });

  // ─── RTL ────────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdCard],
        html: '<div dir="rtl"><md-card>Content</md-card></div>',
      });
      expect(page.root).toBeTruthy();
    });

    it('renders interactive card in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdCard],
        html: '<div dir="rtl"><md-card interactive>Content</md-card></div>',
      });
      expect(page.root).toHaveClass('md-card--interactive');
    });
  });

  // ─── Custom CSS API ─────────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-card style="--md-card-container-color: red;">Content</md-card>',
      );
      expect(page.root).toBeTruthy();
    });

    it('accepts CSS custom property overrides for inline-axis sizing', async () => {
      const page = await create(
        '<md-card style="--md-card-width: 320px; --md-card-min-width: 200px; --md-card-max-width: 480px;">Content</md-card>',
      );
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-card-width');
      expect(style).toContain('--md-card-min-width');
      expect(style).toContain('--md-card-max-width');
    });

    it('accepts CSS custom property overrides for block-axis sizing', async () => {
      const page = await create(
        '<md-card style="--md-card-height: 240px; --md-card-min-height: 200px; --md-card-max-height: 360px;">Content</md-card>',
      );
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-card-height');
      expect(style).toContain('--md-card-min-height');
      expect(style).toContain('--md-card-max-height');
    });
  });

  // ─── Full-width / Full-height ──────────────────────────────
  describe('full-width / full-height', () => {
    it('does not apply full-width class by default', async () => {
      const page = await create('<md-card>Content</md-card>');
      expect(page.root).not.toHaveClass('md-card--full-width');
    });

    it('does not apply full-height class by default', async () => {
      const page = await create('<md-card>Content</md-card>');
      expect(page.root).not.toHaveClass('md-card--full-height');
    });

    it('applies full-width class when full-width attribute is set', async () => {
      const page = await create('<md-card full-width>Content</md-card>');
      expect(page.root).toHaveClass('md-card--full-width');
    });

    it('applies full-height class when full-height attribute is set', async () => {
      const page = await create('<md-card full-height>Content</md-card>');
      expect(page.root).toHaveClass('md-card--full-height');
    });

    it('reflects fullWidth prop to the full-width attribute', async () => {
      const page = await create('<md-card>Content</md-card>');
      (page.rootInstance as any).fullWidth = true;
      await page.waitForChanges();
      expect(page.root?.hasAttribute('full-width')).toBe(true);
      expect(page.root).toHaveClass('md-card--full-width');
    });

    it('reflects fullHeight prop to the full-height attribute', async () => {
      const page = await create('<md-card>Content</md-card>');
      (page.rootInstance as any).fullHeight = true;
      await page.waitForChanges();
      expect(page.root?.hasAttribute('full-height')).toBe(true);
      expect(page.root).toHaveClass('md-card--full-height');
    });

    it('toggles full-width off at runtime', async () => {
      const page = await create('<md-card full-width>Content</md-card>');
      expect(page.root).toHaveClass('md-card--full-width');

      (page.rootInstance as any).fullWidth = false;
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-card--full-width');
    });

    it('combines full-width and full-height', async () => {
      const page = await create('<md-card full-width full-height>Content</md-card>');
      expect(page.root).toHaveClass('md-card--full-width');
      expect(page.root).toHaveClass('md-card--full-height');
    });
  });
});

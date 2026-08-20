import { newSpecPage } from '@stencil/core/testing';
import { MdSnackbar } from './md-snackbar';

describe('md-snackbar', () => {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function create(html: string) {
    return newSpecPage({
      components: [MdSnackbar],
      html,
    });
  }

  // ─── Rendering ────────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-snackbar></md-snackbar>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-snackbar');
    });

    it('is not open by default', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root).not.toHaveClass('md-snackbar--open');
    });

    it('renders message text', async () => {
      const page = await create('<md-snackbar message="File saved"></md-snackbar>');
      const msg = page.root?.shadowRoot?.querySelector('.md-snackbar__message');
      expect(msg?.textContent).toContain('File saved');
    });

    it('renders action button when action prop is set', async () => {
      const page = await create('<md-snackbar message="Deleted" action="Undo"></md-snackbar>');
      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toBe('Undo');
    });

    it('does not render action button when action is empty', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn');
      expect(btn).toBeNull();
    });

    it('renders close icon button when closeable', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      const close = page.root?.shadowRoot?.querySelector('.md-snackbar__close md-icon-button');
      expect(close).toBeTruthy();
    });

    it('does not render close icon button by default', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      const close = page.root?.shadowRoot?.querySelector('.md-snackbar__close-btn');
      expect(close).toBeNull();
    });

    it('renders surface element', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('.md-snackbar__surface')).toBeTruthy();
    });

    it('renders actions wrapper when action is set', async () => {
      const page = await create('<md-snackbar message="Hello" action="OK"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('.md-snackbar__actions')).toBeTruthy();
    });

    it('does not render actions wrapper when no action', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('.md-snackbar__actions')).toBeNull();
    });

    it('renders close wrapper when closeable', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('.md-snackbar__close')).toBeTruthy();
    });

    it('renders both action and close in stacked mode', async () => {
      const page = await create(
        '<md-snackbar message="Hello" action="Undo this" closeable stacked></md-snackbar>'
      );
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('.md-snackbar__action-btn')).toBeTruthy();
      expect(shadow?.querySelector('.md-snackbar__close md-icon-button')).toBeTruthy();
    });
  });

  // ─── Props ────────────────────────────────────────────────

  describe('props', () => {
    it('reflects open attribute', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      expect(page.root?.hasAttribute('open')).toBe(true);
    });

    it('reflects closeable attribute', async () => {
      const page = await create('<md-snackbar closeable message="Hello"></md-snackbar>');
      expect(page.root?.hasAttribute('closeable')).toBe(true);
    });

    it('reflects position attribute', async () => {
      const page = await create('<md-snackbar position="bottom-start" message="Hello"></md-snackbar>');
      expect(page.root?.getAttribute('position')).toBe('bottom-start');
    });

    it('reflects stacked attribute', async () => {
      const page = await create('<md-snackbar stacked message="Hello" action="OK"></md-snackbar>');
      expect(page.root?.hasAttribute('stacked')).toBe(true);
    });

    it('defaults position to bottom', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--bottom');
    });

    it('defaults autoHide to true', async () => {
      const page = await create('<md-snackbar></md-snackbar>');
      expect(page.rootInstance.autoHide).toBe(true);
    });

    it('defaults autoHideDuration to 4000', async () => {
      const page = await create('<md-snackbar></md-snackbar>');
      expect(page.rootInstance.autoHideDuration).toBe(4000);
    });
  });

  // ─── Classes ──────────────────────────────────────────────

  describe('classes', () => {
    it('applies open class when open', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--open');
    });

    it('applies stacked class', async () => {
      const page = await create('<md-snackbar stacked message="Hello" action="OK"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--stacked');
    });

    it('applies position class bottom-start', async () => {
      const page = await create('<md-snackbar position="bottom-start" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--bottom-start');
    });

    it('applies position class bottom-end', async () => {
      const page = await create('<md-snackbar position="bottom-end" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--bottom-end');
    });

    it('applies position class top', async () => {
      const page = await create('<md-snackbar position="top" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--top');
    });

    it('applies position class top-start', async () => {
      const page = await create('<md-snackbar position="top-start" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--top-start');
    });

    it('applies position class top-end', async () => {
      const page = await create('<md-snackbar position="top-end" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--top-end');
    });

    it('applies position class start', async () => {
      const page = await create('<md-snackbar position="start" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--start');
    });

    it('applies position class end', async () => {
      const page = await create('<md-snackbar position="end" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--end');
    });

    it('applies position class center', async () => {
      const page = await create('<md-snackbar position="center" message="Hello"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--center');
    });

    it('applies with-action class when action is set', async () => {
      const page = await create('<md-snackbar message="Hello" action="OK"></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--with-action');
    });

    it('applies with-close class when closeable', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      expect(page.root).toHaveClass('md-snackbar--with-close');
    });
  });

  // ─── Accessibility ────────────────────────────────────────

  describe('accessibility', () => {
    it('has role="status"', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.getAttribute('role')).toBe('status');
    });

    it('has aria-live="polite"', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.getAttribute('aria-live')).toBe('polite');
    });

    it('has aria-atomic="true"', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.getAttribute('aria-atomic')).toBe('true');
    });

    it('close button has aria-label="Dismiss"', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      const close = page.root?.shadowRoot?.querySelector('.md-snackbar__close md-icon-button');
      expect(close?.getAttribute('aria-label')).toBe('Dismiss');
    });

    it('action renders as an md-button (text variant)', async () => {
      const page = await create('<md-snackbar message="Hello" action="Undo"></md-snackbar>');
      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn');
      // The action is a real md-button, which supplies the accessible button
      // semantics, focus ring, ripple and keyboard activation (matching the
      // close button, which is an md-icon-button).
      expect(btn?.tagName.toLowerCase()).toBe('md-button');
    });

    it('dismisses on Escape key when closeable and open', async () => {
      const page = await create('<md-snackbar open message="Hello" closeable></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await delay(200);
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ reason: 'close' });
    });

    it('does not dismiss on Escape when not closeable', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Events — mdOpen ──────────────────────────────────────

  describe('events - mdOpen', () => {
    it('emits mdOpen when opened via show()', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdOpen when open prop set to true', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Events — mdClose ─────────────────────────────────────

  describe('events - mdClose', () => {
    it('does not emit mdClose when action is clicked', async () => {
      const page = await create('<md-snackbar open message="Hello" action="Undo"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn') as HTMLElement;
      btn?.click();
      await delay(200);
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('emits mdClose with reason "close" when close icon clicked', async () => {
      const page = await create('<md-snackbar open message="Hello" closeable></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      const close = page.root?.shadowRoot?.querySelector('.md-snackbar__close md-icon-button') as HTMLElement;
      close?.click();
      await delay(200);
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ reason: 'close' });
    });

    it('emits mdClose with reason "auto" on auto-hide timeout', async () => {
      const page = await create(
        '<md-snackbar message="Hello" auto-hide-duration="100"></md-snackbar>'
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      page.rootInstance.open = true;
      await page.waitForChanges();

      await new Promise(r => setTimeout(r, 150));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ reason: 'auto' });
    });

    it('emits mdClose with reason "close" via hide() method', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      await page.rootInstance.hide();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ reason: 'close' });
    });

    it('emits mdClose with custom reason via hide(reason)', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      await page.rootInstance.hide('action');
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ reason: 'action' });
    });
  });

  // ─── Events — mdAction ────────────────────────────────────

  describe('events - mdAction', () => {
    it('emits mdAction when action button clicked', async () => {
      const page = await create('<md-snackbar open message="Hello" action="Undo"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdAction', spy);

      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn') as HTMLElement;
      btn?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss the snackbar immediately on action click', async () => {
      const page = await create('<md-snackbar open message="Hello" action="Undo"></md-snackbar>');

      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn') as HTMLElement;
      btn?.click();
      await delay(50);
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(true);
    });

    it('starts auto-hide timer after action click', async () => {
      const page = await create(
        '<md-snackbar open message="Hello" action="Retry" auto-hide-duration="100"></md-snackbar>'
      );
      page.root?.setAttribute('auto-hide', 'false');
      await page.waitForChanges();

      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn') as HTMLElement;
      btn?.click();
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(true);

      await delay(150);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ─── Auto-hide ────────────────────────────────────────────

  describe('auto-hide', () => {

    it('auto-dismisses after autoHideDuration', async () => {
      const page = await create(
        '<md-snackbar message="Hello" auto-hide-duration="100"></md-snackbar>'
      );
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);

      await delay(150);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('does not auto-dismiss when autoHide is false', async () => {
      const page = await create(
        '<md-snackbar message="Hello" auto-hide="false" auto-hide-duration="50"></md-snackbar>'
      );
      page.rootInstance.open = true;
      await page.waitForChanges();

      await delay(100);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('pauses auto-hide on mouseenter and resumes on mouseleave', async () => {
      const page = await create(
        '<md-snackbar message="Hello" auto-hide-duration="100"></md-snackbar>'
      );
      page.rootInstance.open = true;
      await page.waitForChanges();

      const surface = page.root?.shadowRoot?.querySelector('.md-snackbar__surface') as HTMLElement;
      surface?.dispatchEvent(new Event('mouseenter'));
      await page.waitForChanges();

      await delay(150);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);

      surface?.dispatchEvent(new Event('mouseleave'));
      await page.waitForChanges();

      await delay(150);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('clears timer on close', async () => {
      const page = await create(
        '<md-snackbar message="Hello" auto-hide-duration="100"></md-snackbar>'
      );
      page.rootInstance.open = true;
      await page.waitForChanges();

      page.rootInstance.open = false;
      await page.waitForChanges();

      const closeSpy = jest.fn();
      page.root?.addEventListener('mdClose', closeSpy);
      await delay(200);
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Methods ──────────────────────────────────────────────

  describe('methods', () => {
    it('show() opens the snackbar', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(page.root).toHaveClass('md-snackbar--open');
    });

    it('hide() closes the snackbar', async () => {
      const page = await create('<md-snackbar open message="Hello"></md-snackbar>');
      await page.rootInstance.hide();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('hide() is a no-op when already closed', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      await page.rootInstance.hide();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Keyboard ─────────────────────────────────────────────

  describe('keyboard', () => {
    it('action activation is delegated to the md-button (its click → mdAction)', async () => {
      // Keyboard activation (Enter/Space) is now owned by the md-button, which
      // translates it to a native click — covered by md-button's own spec and
      // the snackbar story's play test in a real browser. Here we assert the
      // wiring that path drives: the action md-button's click emits mdAction.
      const page = await create('<md-snackbar open message="Hello" action="Undo"></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdAction', spy);

      const btn = page.root?.shadowRoot?.querySelector('.md-snackbar__action-btn') as HTMLElement;
      btn?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Escape dismisses when closeable', async () => {
      const page = await create('<md-snackbar open message="Hello" closeable></md-snackbar>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await delay(200);
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Escape does nothing when not closeable', async () => {
      const page = await create('<md-snackbar open message="Hello" action="Undo"></md-snackbar>');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(true);
    });
  });

  // ─── Parts ────────────────────────────────────────────────

  describe('parts', () => {
    it('exposes surface part', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="surface"]')).toBeTruthy();
    });

    it('exposes message part', async () => {
      const page = await create('<md-snackbar message="Hello"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="message"]')).toBeTruthy();
    });

    it('exposes actions part when action is present', async () => {
      const page = await create('<md-snackbar message="Hello" action="OK"></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="actions"]')).toBeTruthy();
    });

    it('exposes close part when closeable', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="close"]')).toBeTruthy();
    });
  });

  // ─── Slots ────────────────────────────────────────────────

  describe('slots', () => {
    it('renders default slot for supporting text', async () => {
      const page = await create('<md-snackbar>Custom message</md-snackbar>');
      const slot = page.root?.shadowRoot?.querySelector('.md-snackbar__message slot:not([name])');
      expect(slot).toBeTruthy();
    });

    it('renders action slot', async () => {
      const page = await create('<md-snackbar message="Hello" action="Undo"></md-snackbar>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="action"]');
      expect(slot).toBeTruthy();
    });

    it('renders close slot when closeable', async () => {
      const page = await create('<md-snackbar message="Hello" closeable></md-snackbar>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="close"]');
      expect(slot).toBeTruthy();
    });
  });

  // ─── RTL ──────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdSnackbar],
        html: `<div dir="rtl"><md-snackbar message="Hello" action="OK" closeable></md-snackbar></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ─── Custom CSS API ───────────────────────────────────────

  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-snackbar style="--md-snackbar-container-color: red;" message="Hello"></md-snackbar>'
      );
      expect(page.root).toBeTruthy();
    });
  });
});

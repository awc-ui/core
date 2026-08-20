import { newSpecPage } from '@stencil/core/testing';
import { MdSwitch } from './md-switch';

describe('md-switch', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdSwitch], html });
  }

  // ─── Rendering ────────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-switch');
    });

    it('renders the track', async () => {
      const page = await create('<md-switch></md-switch>');
      const track = page.root?.shadowRoot?.querySelector('.md-switch__track');
      expect(track).toBeTruthy();
    });

    it('renders the handle', async () => {
      const page = await create('<md-switch></md-switch>');
      const handle = page.root?.shadowRoot?.querySelector('.md-switch__handle');
      expect(handle).toBeTruthy();
    });

    it('renders the state layer', async () => {
      const page = await create('<md-switch></md-switch>');
      const stateLayer = page.root?.shadowRoot?.querySelector('.md-switch__state-layer');
      expect(stateLayer).toBeTruthy();
    });

    it('applies selected class when selected', async () => {
      const page = await create('<md-switch selected></md-switch>');
      expect(page.root).toHaveClass('md-switch--selected');
    });

    it('does not apply selected class by default', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root).not.toHaveClass('md-switch--selected');
    });

    it('applies disabled class', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      expect(page.root).toHaveClass('md-switch--disabled');
    });
  });

  // ─── Props ────────────────────────────────────────────────

  describe('props', () => {
    it('defaults selected to false', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.rootInstance.selected).toBe(false);
    });

    it('reflects selected attribute', async () => {
      const page = await create('<md-switch selected></md-switch>');
      expect(page.root?.getAttribute('selected')).not.toBeNull();
    });

    it('defaults disabled to false', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.rootInstance.disabled).toBe(false);
    });

    it('reflects disabled attribute', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      expect(page.root?.getAttribute('disabled')).not.toBeNull();
    });

    it('defaults icons to false', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.rootInstance.icons).toBe(false);
    });

    it('defaults showOnlySelectedIcon to false', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.rootInstance.showOnlySelectedIcon).toBe(false);
    });

    it('accepts external selected prop changes', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root!.selected = true;
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-switch--selected');
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });
  });

  // ─── Accessibility ────────────────────────────────────────

  describe('accessibility', () => {
    it('has role=switch', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.getAttribute('role')).toBe('switch');
    });

    it('has aria-checked=false by default', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.getAttribute('aria-checked')).toBe('false');
    });

    it('has aria-checked=true when selected', async () => {
      const page = await create('<md-switch selected></md-switch>');
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('has tabindex=0 when enabled', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('has tabindex=-1 when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when enabled', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('remains focusable when soft-disabled', async () => {
      const page = await create('<md-switch soft-disabled></md-switch>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  // ─── mdInput event (pre-change, cancelable) ──────────────

  describe('mdInput event', () => {
    it('emits mdInput before state changes', async () => {
      const page = await create('<md-switch></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ selected: true });
    });

    it('emits mdInput with { selected: false } when toggling off', async () => {
      const page = await create('<md-switch selected></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy.mock.calls[0][0].detail).toEqual({ selected: false });
    });

    it('blocks internal toggle when preventDefault is called', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root?.addEventListener('mdInput', (e: Event) => e.preventDefault());

      page.root?.click();
      await page.waitForChanges();

      expect(page.rootInstance.selected).toBe(false);
    });

    it('does not emit mdChange when mdInput is prevented', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root?.addEventListener('mdInput', (e: Event) => e.preventDefault());

      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);

      page.root?.click();
      await page.waitForChanges();

      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('does not emit when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit when soft-disabled', async () => {
      const page = await create('<md-switch soft-disabled></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── mdChange event (post-change, not cancelable) ────────

  describe('mdChange event', () => {
    it('emits mdChange after state commits', async () => {
      const page = await create('<md-switch></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ selected: true });
    });

    it('emits mdChange with { selected: false } when toggled off', async () => {
      const page = await create('<md-switch selected></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy.mock.calls[0][0].detail).toEqual({ selected: false });
    });

    it('does not emit when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.click();
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Toggle behavior ─────────────────────────────────────

  describe('toggle', () => {
    it('toggles selected on click', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.rootInstance.selected).toBe(false);

      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(true);

      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);
    });

    it('does not toggle when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);
    });

    it('updates aria-checked after toggle', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });
  });

  // ─── Controlled mode ─────────────────────────────────────

  describe('controlled mode', () => {
    it('allows developer to prevent toggle and manage state externally', async () => {
      const page = await create('<md-switch></md-switch>');

      page.root?.addEventListener('mdInput', (e: Event) => {
        e.preventDefault();
        // Developer decides to set selected=true
        page.root!.selected = true;
      });

      page.root?.click();
      await page.waitForChanges();

      expect(page.rootInstance.selected).toBe(true);
    });

    it('allows developer to reject the toggle entirely', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root?.addEventListener('mdInput', (e: Event) => e.preventDefault());

      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);

      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);
    });
  });

  // ─── Keyboard ─────────────────────────────────────────────

  describe('keyboard', () => {
    it('toggles on Space', async () => {
      const page = await create('<md-switch></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.selected).toBe(true);
    });

    it('does NOT toggle on Enter (WAI-ARIA switch pattern reserves Enter for form submit)', async () => {
      const page = await create('<md-switch></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.selected).toBe(false);
    });

    it('ignores auto-repeat keydown (holding Space toggles once)', async () => {
      const page = await create('<md-switch></md-switch>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }));
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(page.rootInstance.selected).toBe(true);
    });

    it('does not toggle on Space when disabled', async () => {
      const page = await create('<md-switch disabled></md-switch>');
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);
    });

    it('respects preventDefault on keyboard toggle', async () => {
      const page = await create('<md-switch></md-switch>');
      page.root?.addEventListener('mdInput', (e: Event) => e.preventDefault());

      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();

      expect(page.rootInstance.selected).toBe(false);
    });
  });

  // ─── Icons ────────────────────────────────────────────────

  describe('icons', () => {
    it('does not render icon by default', async () => {
      const page = await create('<md-switch></md-switch>');
      const icon = page.root?.shadowRoot?.querySelector('.md-switch__icon');
      expect(icon).toBeNull();
    });

    it('renders check icon when selected with icons prop', async () => {
      const page = await create('<md-switch selected icons></md-switch>');
      const icon = page.root?.shadowRoot?.querySelector('.md-switch__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('check');
    });

    it('renders close icon when unselected with icons prop', async () => {
      const page = await create('<md-switch icons></md-switch>');
      const icon = page.root?.shadowRoot?.querySelector('.md-switch__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('close');
    });

    it('renders icon only when selected with show-only-selected-icon', async () => {
      const page = await create('<md-switch show-only-selected-icon></md-switch>');
      let icon = page.root?.shadowRoot?.querySelector('.md-switch__icon');
      expect(icon).toBeNull();

      page.root?.click();
      await page.waitForChanges();

      icon = page.root?.shadowRoot?.querySelector('.md-switch__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('check');
    });

    it('applies with-icon class when icon is visible', async () => {
      const page = await create('<md-switch icons></md-switch>');
      expect(page.root).toHaveClass('md-switch--with-icon');
    });

    it('overrides the glyphs via selected-icon / unselected-icon', async () => {
      const on = await create('<md-switch selected icons selected-icon="bolt" unselected-icon="power_off"></md-switch>');
      expect(on.root?.shadowRoot?.querySelector('.md-switch__icon')?.textContent).toBe('bolt');
      const off = await create('<md-switch icons selected-icon="bolt" unselected-icon="power_off"></md-switch>');
      expect(off.root?.shadowRoot?.querySelector('.md-switch__icon')?.textContent).toBe('power_off');
    });

    it('exposes per-state icon slots with glyph fallback', async () => {
      const page = await create('<md-switch selected icons></md-switch>');
      // when nothing is slotted the fallback glyph renders inside the slot
      const slot = page.root?.shadowRoot?.querySelector('slot[name="selected-icon"]');
      expect(slot).toBeTruthy();
      expect(slot?.querySelector('.md-switch__icon')?.textContent).toBe('check');
    });

    it('does not apply with-icon class when no icon', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root).not.toHaveClass('md-switch--with-icon');
    });
  });

  // ─── Parts ────────────────────────────────────────────────

  describe('parts', () => {
    it('exposes track part', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.shadowRoot?.querySelector('[part="track"]')).toBeTruthy();
    });

    it('exposes state-layer part', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes handle part', async () => {
      const page = await create('<md-switch></md-switch>');
      expect(page.root?.shadowRoot?.querySelector('[part="handle"]')).toBeTruthy();
    });

    it('exposes icon part when icons are shown', async () => {
      const page = await create('<md-switch icons></md-switch>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });
  });

  // ─── RTL ──────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdSwitch],
        html: `<div dir="rtl"><md-switch></md-switch></div>`,
      });
      expect(page.root).toBeTruthy();
    });

    it('renders selected state in RTL', async () => {
      const page = await newSpecPage({
        components: [MdSwitch],
        html: `<div dir="rtl"><md-switch selected></md-switch></div>`,
      });
      expect(page.root).toHaveClass('md-switch--selected');
    });
  });

  // ─── Soft-disabled ────────────────────────────────────────

  describe('soft-disabled', () => {
    it('applies disabled class', async () => {
      const page = await create('<md-switch soft-disabled></md-switch>');
      expect(page.root).toHaveClass('md-switch--disabled');
    });

    it('keeps tabindex=0 for focus', async () => {
      const page = await create('<md-switch soft-disabled></md-switch>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('does not toggle on click', async () => {
      const page = await create('<md-switch soft-disabled></md-switch>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(false);
    });
  });

  // ─── Form association ─────────────────────────────────────
  // NOTE: the Stencil spec mock no-ops ElementInternals.setFormValue, so actual
  // FormData submission is verified in e2e. These lock the API + reset wiring.

  describe('form association', () => {
    it('exposes name / value / required props', async () => {
      const page = await create('<md-switch name="wifi" value="yes" required></md-switch>');
      expect(page.rootInstance.name).toBe('wifi');
      expect(page.rootInstance.value).toBe('yes');
      expect(page.rootInstance.required).toBe(true);
    });
    it('reflects required to aria-required', async () => {
      const page = await create('<md-switch required></md-switch>');
      expect(page.root?.getAttribute('aria-required')).toBe('true');
      const off = await create('<md-switch></md-switch>');
      expect(off.root?.getAttribute('aria-required')).toBeNull();
    });
    it('formResetCallback restores the initial selected state', async () => {
      const page = await create('<md-switch selected></md-switch>');
      page.rootInstance.selected = false;
      await page.waitForChanges();
      page.rootInstance.formResetCallback();
      await page.waitForChanges();
      expect(page.rootInstance.selected).toBe(true);
    });
    it('is a form-associated custom element', () => {
      expect((MdSwitch as unknown as { formAssociated?: boolean }).formAssociated).toBe(true);
    });
  });

  // ─── Label association ────────────────────────────────────
  // As a form-associated element md-switch is *labelable*: a wrapping <label>
  // names it and forwards clicks NATIVELY (verified in md-switch.e2e.ts — the
  // mock-doc has no native label→control forwarding, so it can't be spec-tested).
});

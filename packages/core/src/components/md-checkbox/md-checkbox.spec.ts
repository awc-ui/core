import { newSpecPage } from '@stencil/core/testing';
import { MdCheckbox } from './md-checkbox';

describe('md-checkbox', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdCheckbox],
      html,
    });
  }

  // ─── Rendering ─────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults (unchecked)', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-checkbox');
      expect(page.root).toHaveClass('md-checkbox--unselected');
      expect(page.root).not.toHaveClass('md-checkbox--checked');
      expect(page.root).not.toHaveClass('md-checkbox--indeterminate');
    });

    it('renders checked state', async () => {
      const page = await create('<md-checkbox checked></md-checkbox>');
      expect(page.root).toHaveClass('md-checkbox--checked');
      expect(page.root).toHaveClass('md-checkbox--selected');
      expect(page.root).not.toHaveClass('md-checkbox--unselected');
    });

    it('renders indeterminate state', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      expect(page.root).toHaveClass('md-checkbox--indeterminate');
      expect(page.root).toHaveClass('md-checkbox--selected');
    });

    it('renders md-ripple inside 40dp ripple layer', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const layer = page.root?.shadowRoot?.querySelector('.md-checkbox__ripple-layer');
      expect(layer).toBeTruthy();
      expect(layer?.querySelector('md-ripple')).toBeTruthy();
    });

    it('renders state-layer with part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const sl = page.root?.shadowRoot?.querySelector('.md-checkbox__state-layer');
      expect(sl).toBeTruthy();
      expect(sl?.getAttribute('part')).toBe('state-layer');
      expect(sl?.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders container with part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const container = page.root?.shadowRoot?.querySelector('.md-checkbox__container');
      expect(container).toBeTruthy();
      expect(container?.getAttribute('part')).toBe('container');
    });

    it('renders SVG icon with part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const icon = page.root?.shadowRoot?.querySelector('.md-checkbox__icon');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('part')).toBe('icon');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    // The mark is the Material Symbols `check` glyph — the same one md-step
    // draws for a completed step — not a hand-drawn SVG path.
    const glyphOf = (page: { root?: HTMLElement }) =>
      page.root?.shadowRoot
        ?.querySelector('.md-checkbox__icon .material-symbols-outlined')
        ?.textContent?.trim();

    it('renders the check glyph when unchecked/checked', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(glyphOf(page)).toBe('check');
    });

    it('renders the remove glyph when indeterminate', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      expect(glyphOf(page)).toBe('remove');
    });

    it('renders NO nested native input (form participation is via ElementInternals)', async () => {
      // Regression guard for axe `nested-interactive`: a native <input> inside
      // the role="checkbox" host nests an interactive control. Form value now
      // flows through ElementInternals.setFormValue instead — verified in e2e.
      const page = await create('<md-checkbox name="agree" value="yes"></md-checkbox>');
      expect(page.root?.shadowRoot?.querySelector('input')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('.md-checkbox__native')).toBeNull();
    });
  });

  // ─── Checked/Indeterminate toggling ─────────────────────────
  describe('toggling', () => {
    it('toggles checked on click', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-checkbox--checked');
      expect(page.rootInstance.checked).toBe(true);
    });

    it('unchecks on second click', async () => {
      const page = await create('<md-checkbox checked></md-checkbox>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.checked).toBe(false);
      expect(page.root).toHaveClass('md-checkbox--unselected');
    });

    it('transitions from indeterminate to checked on click', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.indeterminate).toBe(false);
      expect(page.rootInstance.checked).toBe(true);
      expect(page.root).toHaveClass('md-checkbox--checked');
    });

    it('emits mdChange on toggle', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ checked: true, indeterminate: false });
    });

    it('emits mdChange with correct detail when unchecking', async () => {
      const page = await create('<md-checkbox checked></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ checked: false, indeterminate: false });
    });

    it('emits mdChange when resolving indeterminate', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ checked: true, indeterminate: false });
    });
  });

  // ─── Keyboard ─────────────────────────────────────────────
  describe('keyboard', () => {
    it('toggles on Space', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(page.rootInstance.checked).toBe(true);
    });

    it('does NOT toggle on Enter (per WAI-ARIA checkbox spec)', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.checked).toBe(false);
    });

    it('does not toggle on irrelevant keys', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not toggle when disabled', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Accessibility ────────────────────────────────────────
  describe('accessibility', () => {
    it('has role="checkbox"', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.getAttribute('role')).toBe('checkbox');
    });

    it('sets aria-checked="false" when unchecked', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.getAttribute('aria-checked')).toBe('false');
    });

    it('sets aria-checked="true" when checked', async () => {
      const page = await create('<md-checkbox checked></md-checkbox>');
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('sets aria-checked="mixed" when indeterminate', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      expect(page.root?.getAttribute('aria-checked')).toBe('mixed');
    });

    it('is focusable via tabindex="0"', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('removes from tab order when disabled', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('is not focusable at all when decorative (aria-hidden="true")', async () => {
      // A decorative selection-indicator checkbox (e.g. slot="trailing" inside
      // an interactive list row) must expose NO tabindex — a focusable
      // role="checkbox" nested in a role="option"/"button" trips
      // nested-interactive, and an aria-hidden tab stop trips aria-hidden-focus.
      // tabindex="-1" is insufficient (nested-interactive flags any focusable
      // widget descendant even with aria-hidden), so the attribute is dropped.
      const page = await create('<md-checkbox aria-hidden="true" checked></md-checkbox>');
      expect(page.root?.hasAttribute('tabindex')).toBe(false);
    });

    it('remains focusable when soft-disabled', async () => {
      const page = await create('<md-checkbox soft-disabled></md-checkbox>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled when soft-disabled', async () => {
      const page = await create('<md-checkbox soft-disabled></md-checkbox>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when enabled', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('sets aria-required when required', async () => {
      const page = await create('<md-checkbox required></md-checkbox>');
      expect(page.root?.getAttribute('aria-required')).toBe('true');
    });

    it('does not set aria-required when not required', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.getAttribute('aria-required')).toBeNull();
    });

    it('passes disabled to md-ripple', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      const ripple = page.root?.shadowRoot?.querySelector('.md-checkbox__ripple-layer md-ripple');
      expect(ripple?.getAttribute('disabled')).toBe('');
    });

    it('preserves aria-labelledby set by consumer', async () => {
      const page = await create('<md-checkbox aria-labelledby="my-label"></md-checkbox>');
      expect(page.root?.getAttribute('aria-labelledby')).toBe('my-label');
    });

    it('preserves aria-describedby set by consumer', async () => {
      const page = await create('<md-checkbox aria-describedby="my-desc"></md-checkbox>');
      expect(page.root?.getAttribute('aria-describedby')).toBe('my-desc');
    });

    it('preserves aria-controls set by consumer', async () => {
      const page = await create('<md-checkbox aria-controls="opt-a opt-b"></md-checkbox>');
      expect(page.root?.getAttribute('aria-controls')).toBe('opt-a opt-b');
    });

    it('preserves aria-label set by consumer', async () => {
      const page = await create('<md-checkbox aria-label="Select all rows"></md-checkbox>');
      expect(page.root?.getAttribute('aria-label')).toBe('Select all rows');
    });
  });

  // ─── Disabled states ──────────────────────────────────────
  describe('disabled states', () => {
    it('adds disabled class', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      expect(page.root).toHaveClass('md-checkbox--disabled');
    });

    it('adds disabled class when soft-disabled', async () => {
      const page = await create('<md-checkbox soft-disabled></md-checkbox>');
      expect(page.root).toHaveClass('md-checkbox--disabled');
    });

    it('does not toggle when disabled', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.checked).toBe(false);
    });

    it('does not toggle when soft-disabled', async () => {
      const page = await create('<md-checkbox soft-disabled></md-checkbox>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('exposes disabled to AT via aria-disabled and a -1 tabindex', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ─── Form integration ────────────────────────────────────
  describe('form integration', () => {
    // The submitted value/name/reset behaviour rides on ElementInternals, which
    // the Stencil spec mock no-ops (setFormValue isn't implemented) — the real
    // FormData round-trip is covered in md-checkbox.e2e.ts. Here we only assert
    // the prop-level contract that feeds it.
    it('uses "on" as default value', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.rootInstance.value).toBe('on');
    });

    it('reflects required as aria-required (not a native attribute)', async () => {
      const page = await create('<md-checkbox required></md-checkbox>');
      expect(page.root?.getAttribute('aria-required')).toBe('true');
    });

    it('restores initial checked state on form reset', async () => {
      const page = await create('<md-checkbox checked></md-checkbox>');
      page.rootInstance.checked = false;
      await page.waitForChanges();
      page.rootInstance.formResetCallback();
      await page.waitForChanges();
      expect(page.rootInstance.checked).toBe(true);
    });
  });

  // ─── Parts ────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes container part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes icon part', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });
  });

  // ─── RTL ──────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdCheckbox],
        html: '<div dir="rtl"><md-checkbox></md-checkbox></div>',
      });
      expect(page.root).toBeTruthy();
    });

    it('renders checked in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdCheckbox],
        html: '<div dir="rtl"><md-checkbox checked></md-checkbox></div>',
      });
      expect(page.root).toHaveClass('md-checkbox--checked');
    });
  });

  // ─── Press animation ────────────────────────────────────
  describe('press animation', () => {
    it('adds pressed class on pointerdown', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      page.root?.dispatchEvent(new Event('pointerdown'));
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-checkbox--pressed');
    });

    it('removes pressed class on pointerup', async () => {
      const page = await create('<md-checkbox></md-checkbox>');
      page.root?.dispatchEvent(new Event('pointerdown'));
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-checkbox--pressed');
      page.root?.dispatchEvent(new Event('pointerup'));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-checkbox--pressed');
    });

    it('does not add pressed class when disabled', async () => {
      const page = await create('<md-checkbox disabled></md-checkbox>');
      page.root?.dispatchEvent(new Event('pointerdown'));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-checkbox--pressed');
    });
  });

  // ─── Label association ───────────────────────────────────
  describe('label association', () => {
    // md-checkbox is form-associated, so a wrapping <label> forwards clicks AND
    // supplies the accessible name NATIVELY (no manual closest('label') wiring).
    // Native label→FACE forwarding isn't implemented by the jsdom spec mock, so
    // the label-click and accessible-name behaviour is verified in the e2e.
    it('does not double-toggle when the checkbox itself is clicked inside a label', async () => {
      const page = await newSpecPage({
        components: [MdCheckbox],
        html: '<label><md-checkbox></md-checkbox> Check me</label>',
      });
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.checked).toBe(true);
    });
  });

  // ─── Tri-state (mixed) checkbox behavior ──────────────────
  describe('tri-state behavior', () => {
    it('cycles: indeterminate → checked on first click', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      expect(page.root?.getAttribute('aria-checked')).toBe('mixed');

      page.root?.click();
      await page.waitForChanges();

      expect(page.rootInstance.indeterminate).toBe(false);
      expect(page.rootInstance.checked).toBe(true);
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('cycles: checked → unchecked on second click', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-checked')).toBe('true');

      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.checked).toBe(false);
      expect(page.root?.getAttribute('aria-checked')).toBe('false');
    });

    it('Space key toggles indeterminate → checked', async () => {
      const page = await create('<md-checkbox indeterminate></md-checkbox>');
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();

      expect(page.rootInstance.indeterminate).toBe(false);
      expect(page.rootInstance.checked).toBe(true);
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('programmatic indeterminate + checked is reflected as mixed', async () => {
      const page = await create('<md-checkbox indeterminate checked></md-checkbox>');
      expect(page.root?.getAttribute('aria-checked')).toBe('mixed');
    });
  });

  // ─── Custom CSS API ───────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-checkbox style="--md-checkbox-selected-container-color: coral;"></md-checkbox>',
      );
      expect(page.root).toBeTruthy();
    });
  });
});

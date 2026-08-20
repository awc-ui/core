import { newSpecPage } from '@stencil/core/testing';
import { MdRadio } from './md-radio';

describe('md-radio', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdRadio],
      html,
    });
  }

  // ─── Rendering ───────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-radio');
    });

    it('renders unchecked by default', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root).toHaveClass('md-radio--unchecked');
      expect(page.root).not.toHaveClass('md-radio--checked');
    });

    it('renders checked when prop is set', async () => {
      const page = await create('<md-radio checked value="a"></md-radio>');
      expect(page.root).toHaveClass('md-radio--checked');
      expect(page.root).not.toHaveClass('md-radio--unchecked');
    });

    it('renders outer circle', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('.md-radio__outer')).toBeTruthy();
    });

    it('renders inner circle', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('.md-radio__inner')).toBeTruthy();
    });

    it('renders hidden native input', async () => {
      const page = await create('<md-radio name="group" value="a"></md-radio>');
      const input = page.root?.shadowRoot?.querySelector('input[type="radio"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input?.getAttribute('name')).toBe('group');
      expect(input?.getAttribute('value')).toBe('a');
    });

    it('renders md-ripple', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
    });
  });

  // ─── Props ───────────────────────────────────────────────────
  describe('props', () => {
    it('reflects checked attribute', async () => {
      const page = await create('<md-radio checked value="a"></md-radio>');
      expect(page.root?.getAttribute('checked')).toBe('');
    });

    it('reflects disabled attribute', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('disabled')).toBe('');
    });

    it('reflects soft-disabled attribute', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('soft-disabled')).toBe('');
    });

    it('defaults value to empty string', async () => {
      const page = await create('<md-radio></md-radio>');
      expect(page.rootInstance.value).toBe('');
    });

    it('defaults name to empty string', async () => {
      const page = await create('<md-radio></md-radio>');
      expect(page.rootInstance.name).toBe('');
    });
  });

  // ─── Accessibility — ARIA attributes ─────────────────────────
  describe('accessibility', () => {
    it('has role="radio"', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('role')).toBe('radio');
    });

    it('sets aria-checked="false" when unchecked', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-checked')).toBe('false');
    });

    it('sets aria-checked="true" when checked', async () => {
      const page = await create('<md-radio checked value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('updates aria-checked to "true" after click', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-checked')).toBe('false');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-checked')).toBe('true');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled when soft-disabled', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when enabled', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('sets aria-required when required', async () => {
      const page = await create('<md-radio required value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-required')).toBe('true');
    });

    it('does not set aria-required when not required', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-required')).toBeNull();
    });

    it('standalone radio (no name) is focusable via tabindex="0"', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('removes from tab order when disabled (tabindex="-1")', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('remains focusable when soft-disabled (tabindex="0")', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('preserves aria-label set by consumer', async () => {
      const page = await create('<md-radio aria-label="Choose option A" value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-label')).toBe('Choose option A');
    });

    it('preserves aria-labelledby set by consumer', async () => {
      const page = await create('<md-radio aria-labelledby="label-id" value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-labelledby')).toBe('label-id');
    });

    it('preserves aria-describedby set by consumer', async () => {
      const page = await create('<md-radio aria-describedby="desc-id" value="a"></md-radio>');
      expect(page.root?.getAttribute('aria-describedby')).toBe('desc-id');
    });
  });

  // ─── Decorative elements are hidden from AT ──────────────────
  describe('decorative elements', () => {
    it('hides ripple-layer from assistive technology', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const ripple = page.root?.shadowRoot?.querySelector('.md-radio__ripple-layer');
      expect(ripple?.getAttribute('aria-hidden')).toBe('true');
    });

    it('hides state-layer from assistive technology', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const stateLayer = page.root?.shadowRoot?.querySelector('.md-radio__state-layer');
      expect(stateLayer?.getAttribute('aria-hidden')).toBe('true');
    });

    it('hides container (visual circles) from assistive technology', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const container = page.root?.shadowRoot?.querySelector('.md-radio__container');
      expect(container?.getAttribute('aria-hidden')).toBe('true');
    });

    it('hides native input from assistive technology', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const input = page.root?.shadowRoot?.querySelector('.md-radio__native');
      expect(input?.getAttribute('aria-hidden')).toBe('true');
      expect(input?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ─── Group exclusivity ──────────────────────────────────────
  describe('group exclusivity', () => {
    it('unchecks sibling radios in the same group on click', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="grp" value="a" checked></md-radio>
            <md-radio name="grp" value="b"></md-radio>
            <md-radio name="grp" value="c"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect((radios[0] as any).checked).toBe(true);

      radios[1].click();
      await page.waitForChanges();

      expect((radios[1] as any).checked).toBe(true);
      expect((radios[0] as any).checked).toBe(false);
      expect((radios[2] as any).checked).toBe(false);
    });

    it('maintains single selection across multiple sequential clicks', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="seq" value="a"></md-radio>
            <md-radio name="seq" value="b"></md-radio>
            <md-radio name="seq" value="c"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');

      radios[0].click();
      await page.waitForChanges();
      expect((radios[0] as any).checked).toBe(true);
      expect((radios[1] as any).checked).toBe(false);
      expect((radios[2] as any).checked).toBe(false);

      radios[2].click();
      await page.waitForChanges();
      expect((radios[0] as any).checked).toBe(false);
      expect((radios[1] as any).checked).toBe(false);
      expect((radios[2] as any).checked).toBe(true);

      radios[1].click();
      await page.waitForChanges();
      expect((radios[0] as any).checked).toBe(false);
      expect((radios[1] as any).checked).toBe(true);
      expect((radios[2] as any).checked).toBe(false);
    });

    it('does not affect radios with a different name', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="grp1" value="a" checked></md-radio>
            <md-radio name="grp2" value="b" checked></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect((radios[0] as any).checked).toBe(true);
      expect((radios[1] as any).checked).toBe(true);
    });

    it('keeps two independent groups isolated', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="g1" value="a" checked></md-radio>
            <md-radio name="g1" value="b"></md-radio>
            <md-radio name="g2" value="x" checked></md-radio>
            <md-radio name="g2" value="y"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');

      radios[1].click();
      await page.waitForChanges();

      expect((radios[0] as any).checked).toBe(false);
      expect((radios[1] as any).checked).toBe(true);
      expect((radios[2] as any).checked).toBe(true);
      expect((radios[3] as any).checked).toBe(false);
    });

    it('reflects name attribute for group queries', async () => {
      const page = await create('<md-radio name="colors" value="red"></md-radio>');
      expect(page.root?.getAttribute('name')).toBe('colors');
    });

    it('reflects value attribute', async () => {
      const page = await create('<md-radio name="colors" value="red"></md-radio>');
      expect(page.root?.getAttribute('value')).toBe('red');
    });

    it('unchecks siblings when checked is set externally (controlled)', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="ctrl" value="a" checked></md-radio>
            <md-radio name="ctrl" value="b"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect((radios[0] as any).checked).toBe(true);

      (radios[1] as any).checked = true;
      await page.waitForChanges();

      expect((radios[1] as any).checked).toBe(true);
      expect((radios[0] as any).checked).toBe(false);
    });
  });

  // ─── Events — mdChange ──────────────────────────────────────
  describe('events - mdChange', () => {
    it('emits mdChange on click with checked and value', async () => {
      const page = await create('<md-radio value="opt1"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ checked: true, value: 'opt1' });
    });

    it('becomes checked on click', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.rootInstance.checked).toBe(true);
    });

    it('does not emit when already checked', async () => {
      const page = await create('<md-radio checked value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit when disabled', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit when soft-disabled', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit mdChange when checked is set externally', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.rootInstance.checked = true;
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Events — mdFocus / mdBlur ──────────────────────────────
  describe('events - mdFocus / mdBlur', () => {
    it('emits mdFocus on focus', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdFocus', spy);
      page.root?.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdBlur on blur', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdBlur', spy);
      page.root?.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('sets focused class on focus', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      page.root?.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-radio--focused');
    });

    it('removes focused class on blur', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      page.root?.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-radio--focused');

      page.root?.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-radio--focused');
    });
  });

  // ─── Public Methods ─────────────────────────────────────────
  describe('public methods', () => {
    it('select() checks the radio and emits mdChange', async () => {
      const page = await create('<md-radio value="x"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      await page.rootInstance.select();
      await page.waitForChanges();
      expect(page.rootInstance.checked).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ checked: true, value: 'x' });
    });

    it('select() is a no-op when already checked', async () => {
      const page = await create('<md-radio checked value="x"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      await page.rootInstance.select();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('select() is a no-op when disabled', async () => {
      const page = await create('<md-radio disabled value="x"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      await page.rootInstance.select();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.checked).toBe(false);
    });

    it('select() unchecks siblings in the group', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <md-radio name="m" value="a" checked></md-radio>
            <md-radio name="m" value="b"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      await (radios[1] as any).select();
      await page.waitForChanges();
      expect((radios[1] as any).checked).toBe(true);
      expect((radios[0] as any).checked).toBe(false);
    });

    it('setFocus() focuses the element', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const focusSpy = jest.spyOn(page.root as HTMLElement, 'focus');
      await page.rootInstance.setFocus();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('setBlur() blurs the element', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const blurSpy = jest.spyOn(page.root as HTMLElement, 'blur');
      await page.rootInstance.setBlur();
      expect(blurSpy).toHaveBeenCalled();
    });
  });

  // ─── Keyboard ───────────────────────────────────────────────
  describe('keyboard', () => {
    it('activates on Space', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.checked).toBe(true);
    });

    it('does NOT activate on Enter (per WAI-ARIA radio spec)', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.checked).toBe(false);
    });

    it('does not activate on Space when disabled', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not activate on Space when soft-disabled', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not activate on irrelevant keys', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('prevents default on Space to avoid page scrolling', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      page.root?.dispatchEvent(event);
      await page.waitForChanges();
      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on ArrowDown', async () => {
      const page = await create('<md-radio name="nav" value="a"></md-radio>');
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      page.root?.dispatchEvent(event);
      await page.waitForChanges();
      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on ArrowUp', async () => {
      const page = await create('<md-radio name="nav" value="a"></md-radio>');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      page.root?.dispatchEvent(event);
      await page.waitForChanges();
      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on ArrowRight', async () => {
      const page = await create('<md-radio name="nav" value="a"></md-radio>');
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      page.root?.dispatchEvent(event);
      await page.waitForChanges();
      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on ArrowLeft', async () => {
      const page = await create('<md-radio name="nav" value="a"></md-radio>');
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
      const preventSpy = jest.spyOn(event, 'preventDefault');
      page.root?.dispatchEvent(event);
      await page.waitForChanges();
      expect(preventSpy).toHaveBeenCalled();
    });
  });

  // ─── States ─────────────────────────────────────────────────
  describe('states', () => {
    it('applies disabled class', async () => {
      const page = await create('<md-radio disabled value="a"></md-radio>');
      expect(page.root).toHaveClass('md-radio--disabled');
    });

    it('applies disabled class for soft-disabled', async () => {
      const page = await create('<md-radio soft-disabled value="a"></md-radio>');
      expect(page.root).toHaveClass('md-radio--disabled');
    });

    it('does not apply disabled class when enabled', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root).not.toHaveClass('md-radio--disabled');
    });

    it('applies checked class after click', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-radio--checked');
      expect(page.root).not.toHaveClass('md-radio--unchecked');
    });

    it('stays checked when clicking an already checked radio', async () => {
      const page = await create('<md-radio checked value="a"></md-radio>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-radio--checked');
      expect(page.rootInstance.checked).toBe(true);
    });
  });

  // ─── Parts ──────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes container part', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes outer-circle part', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('[part="outer-circle"]')).toBeTruthy();
    });

    it('exposes inner-circle part', async () => {
      const page = await create('<md-radio value="a"></md-radio>');
      expect(page.root?.shadowRoot?.querySelector('[part="inner-circle"]')).toBeTruthy();
    });
  });

  // ─── Roving tabindex (WAI-ARIA Radio Group pattern) ─────────
  describe('roving tabindex', () => {
    it('checked radio has tabindex 0, unchecked siblings have tabindex -1', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div role="radiogroup">
            <md-radio name="rt" value="a" checked></md-radio>
            <md-radio name="rt" value="b"></md-radio>
            <md-radio name="rt" value="c"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect(radios[0].getAttribute('tabindex')).toBe('0');
      expect(radios[1].getAttribute('tabindex')).toBe('-1');
      expect(radios[2].getAttribute('tabindex')).toBe('-1');
    });

    it('first enabled radio has tabindex 0 when none are checked', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div role="radiogroup">
            <md-radio name="rt2" value="a"></md-radio>
            <md-radio name="rt2" value="b"></md-radio>
            <md-radio name="rt2" value="c"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect(radios[0].getAttribute('tabindex')).toBe('0');
      expect(radios[1].getAttribute('tabindex')).toBe('-1');
      expect(radios[2].getAttribute('tabindex')).toBe('-1');
    });

    it('tabindex moves when selection changes via click', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div role="radiogroup">
            <md-radio name="rt3" value="a" checked></md-radio>
            <md-radio name="rt3" value="b"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect(radios[0].getAttribute('tabindex')).toBe('0');
      expect(radios[1].getAttribute('tabindex')).toBe('-1');

      radios[1].click();
      await page.waitForChanges();

      expect(radios[0].getAttribute('tabindex')).toBe('-1');
      expect(radios[1].getAttribute('tabindex')).toBe('0');
    });

    it('tabindex moves when selection changes via programmatic select()', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div role="radiogroup">
            <md-radio name="rt4" value="a" checked></md-radio>
            <md-radio name="rt4" value="b"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect(radios[0].getAttribute('tabindex')).toBe('0');

      await (radios[1] as any).select();
      await page.waitForChanges();

      expect(radios[0].getAttribute('tabindex')).toBe('-1');
      expect(radios[1].getAttribute('tabindex')).toBe('0');
    });

    it('disabled radio always has tabindex -1 even in group', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div role="radiogroup">
            <md-radio name="rt5" value="a" disabled></md-radio>
            <md-radio name="rt5" value="b"></md-radio>
          </div>
        `,
      });
      const radios = page.body.querySelectorAll('md-radio');
      expect(radios[0].getAttribute('tabindex')).toBe('-1');
      expect(radios[1].getAttribute('tabindex')).toBe('0');
    });

    it('two independent groups each have their own roving tabindex', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `
          <div>
            <div role="radiogroup">
              <md-radio name="g1" value="a" checked></md-radio>
              <md-radio name="g1" value="b"></md-radio>
            </div>
            <div role="radiogroup">
              <md-radio name="g2" value="x"></md-radio>
              <md-radio name="g2" value="y" checked></md-radio>
            </div>
          </div>
        `,
      });
      const g1 = page.body.querySelectorAll('md-radio[name="g1"]');
      const g2 = page.body.querySelectorAll('md-radio[name="g2"]');

      expect(g1[0].getAttribute('tabindex')).toBe('0');
      expect(g1[1].getAttribute('tabindex')).toBe('-1');
      expect(g2[0].getAttribute('tabindex')).toBe('-1');
      expect(g2[1].getAttribute('tabindex')).toBe('0');
    });
  });

  // ─── RTL ────────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdRadio],
        html: `<div dir="rtl"><md-radio value="a"></md-radio></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ─── Custom CSS API ─────────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-radio style="--md-radio-selected-icon-color: red;" value="a" checked></md-radio>'
      );
      expect(page.root).toBeTruthy();
    });
  });
});

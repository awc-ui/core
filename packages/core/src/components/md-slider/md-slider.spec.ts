import { newSpecPage } from '@stencil/core/testing';
import { MdSlider } from './md-slider';

describe('md-slider', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdSlider],
      html,
    });
  }

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-slider></md-slider>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-slider');
      expect(page.root).toHaveClass('md-slider--size-xs');
      expect(page.root).toHaveClass('md-slider--horizontal');
    });



    it('has default value of 50', async () => {
      const page = await create('<md-slider></md-slider>');
      expect(page.rootInstance.value).toBe(50);
    });

    it('reflects disabled prop', async () => {
      const page = await create('<md-slider disabled></md-slider>');
      expect(page.rootInstance.disabled).toBe(true);
      expect(page.root).toHaveClass('md-slider--disabled');
    });

    it('applies centered variant class', async () => {
      const page = await create('<md-slider variant="centered"></md-slider>');
      expect(page.root).toHaveClass('md-slider--centered');
    });

    it('applies range class', async () => {
      const page = await create('<md-slider range></md-slider>');
      expect(page.root).toHaveClass('md-slider--range');
    });

    it('applies stops attribute', async () => {
      const page = await create('<md-slider stops step="20"></md-slider>');
      expect(page.root).toHaveClass('md-slider--stops');
    });

    it('applies vertical orientation', async () => {
      const page = await create('<md-slider orientation="vertical"></md-slider>');
      expect(page.root).toHaveClass('md-slider--vertical');
      expect(page.root?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('applies size class', async () => {
      const page = await create('<md-slider size="lg"></md-slider>');
      expect(page.root).toHaveClass('md-slider--size-lg');
    });
  });

  describe('events', () => {
    it('emits mdInput on input', async () => {
      const page = await create('<md-slider value="10"></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '42';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.value).toBe(42);
    });
  });

  describe('parts', () => {
    it('exposes shadow parts', async () => {
      const page = await create('<md-slider></md-slider>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="surface"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="track"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="track-inactive"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="track-active"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="thumb-knob"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes value-indicator part when value-indicator is set', async () => {
      const page = await create('<md-slider value-indicator></md-slider>');
      expect(page.root?.shadowRoot?.querySelector('[part="value-indicator"]')).toBeTruthy();
    });
  });

  describe('slots', () => {
    it('renders inset-icon slot (md+ only)', async () => {
      const page = await create(
        '<md-slider size="md" inset-icon><span slot="inset-icon">★</span></md-slider>',
      );
      expect(page.root?.shadowRoot?.querySelector('slot[name="inset-icon"]')).toBeTruthy();
    });

    it('does not render inset-icon slot for xs/sm sizes', async () => {
      const page = await create(
        '<md-slider size="xs" inset-icon><span slot="inset-icon">★</span></md-slider>',
      );
      expect(page.root?.shadowRoot?.querySelector('slot[name="inset-icon"]')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('native input has implicit slider role', async () => {
      const page = await create('<md-slider></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input).toBeTruthy();
    });

    it('sets aria-valuenow to current value', async () => {
      const page = await create('<md-slider value="30"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-valuenow')).toBe('30');
    });

    it('sets aria-valuemin and aria-valuemax', async () => {
      const page = await create('<md-slider min="10" max="90"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-valuemin')).toBe('10');
      expect(input?.getAttribute('aria-valuemax')).toBe('90');
    });

    it('sets aria-orientation to vertical when vertical', async () => {
      const page = await create('<md-slider orientation="vertical"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('sets aria-orientation to horizontal by default', async () => {
      const page = await create('<md-slider></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('applies aria-label from prop', async () => {
      const page = await create('<md-slider aria-label="Volume"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-label')).toBe('Volume');
    });

    it('defaults aria-label to "slider" for single', async () => {
      const page = await create('<md-slider></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-label')).toBe('slider');
    });

    it('defaults range thumb labels to "range start" / "range end"', async () => {
      const page = await create('<md-slider range></md-slider>');
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]');
      expect(inputs?.[0]?.getAttribute('aria-label')).toBe('range start');
      expect(inputs?.[1]?.getAttribute('aria-label')).toBe('range end');
    });

    it('applies per-thumb label-start / label-end', async () => {
      const page = await create(
        '<md-slider range label-start="Min price" label-end="Max price"></md-slider>',
      );
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]');
      expect(inputs?.[0]?.getAttribute('aria-label')).toBe('Min price');
      expect(inputs?.[1]?.getAttribute('aria-label')).toBe('Max price');
    });

    it('falls back range thumb labels to aria-label when per-thumb not set', async () => {
      const page = await create('<md-slider range aria-label="Price range"></md-slider>');
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]');
      expect(inputs?.[0]?.getAttribute('aria-label')).toBe('Price range');
      expect(inputs?.[1]?.getAttribute('aria-label')).toBe('Price range');
    });

    it('sets aria-valuetext on single slider', async () => {
      const page = await create('<md-slider value="3" value-text="Wednesday"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-valuetext')).toBe('Wednesday');
    });

    it('omits aria-valuetext when not provided', async () => {
      const page = await create('<md-slider value="50"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('aria-valuetext')).toBeNull();
    });

    it('sets aria-valuetext on range start and end thumbs', async () => {
      const page = await create(
        '<md-slider range value-start="20" value-end="80" value-start-text="$20" value-end-text="$80"></md-slider>',
      );
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]');
      expect(inputs?.[0]?.getAttribute('aria-valuetext')).toBe('$20');
      expect(inputs?.[1]?.getAttribute('aria-valuetext')).toBe('$80');
    });

    it('sets disabled attribute on native input', async () => {
      const page = await create('<md-slider disabled></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      expect(input?.disabled).toBe(true);
    });

    it('sets aria-valuenow on range inputs', async () => {
      const page = await create('<md-slider range value-start="25" value-end="75"></md-slider>');
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]');
      expect(inputs?.[0]?.getAttribute('aria-valuenow')).toBe('25');
      expect(inputs?.[1]?.getAttribute('aria-valuenow')).toBe('75');
    });
  });

  describe('keyboard', () => {
    it('native input supports step', async () => {
      const page = await create('<md-slider step="5" value="50"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('step')).toBe('5');
    });

    it('native input supports min and max for Home/End', async () => {
      const page = await create('<md-slider min="10" max="90"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]');
      expect(input?.getAttribute('min')).toBe('10');
      expect(input?.getAttribute('max')).toBe('90');
    });
  });

  describe('controlled mode', () => {
    it('does not mutate value prop on input when controlled', async () => {
      const page = await create('<md-slider controlled value="30"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '70';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe(30);
    });

    it('does not mutate value prop on change when controlled', async () => {
      const page = await create('<md-slider controlled value="30"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '70';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe(30);
    });

    it('emits mdInput with proposed value when controlled', async () => {
      const page = await create('<md-slider controlled value="30"></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '70';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.value).toBe(70);
    });

    it('emits mdChange with proposed value when controlled', async () => {
      const page = await create('<md-slider controlled value="30"></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '70';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.value).toBe(70);
    });

    it('does not mutate range props when controlled', async () => {
      const page = await create('<md-slider controlled range value-start="20" value-end="80"></md-slider>');
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '40';
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.valueStart).toBe(20);
      expect(page.rootInstance.valueEnd).toBe(80);
    });

    it('updates when parent writes prop in controlled mode', async () => {
      const page = await create('<md-slider controlled value="30"></md-slider>');
      page.rootInstance.value = 60;
      await page.waitForChanges();
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      expect(input.getAttribute('aria-valuenow')).toBe('60');
    });
  });

  describe('uncontrolled mode', () => {
    it('mutates value prop on input (default behavior)', async () => {
      const page = await create('<md-slider value="30"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '70';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe(70);
    });

    it('mutates value prop on change', async () => {
      const page = await create('<md-slider value="30"></md-slider>');
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.value = '55';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe(55);
    });
  });

  describe('new events', () => {
    it('emits mdFocus when thumb receives focus', async () => {
      const page = await create('<md-slider></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdFocus', spy);
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.thumb).toBe('single');
    });

    it('emits mdBlur when thumb loses focus', async () => {
      const page = await create('<md-slider></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdBlur', spy);
      const input = page.root?.shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('blur'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.thumb).toBe('single');
    });

    it('emits mdFocus with correct thumb for range start', async () => {
      const page = await create('<md-slider range></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdFocus', spy);
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      inputs[0].dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail.thumb).toBe('start');
    });

    it('emits mdFocus with correct thumb for range end', async () => {
      const page = await create('<md-slider range></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdFocus', spy);
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      inputs[1].dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail.thumb).toBe('end');
    });

    it('emits mdChange with range detail', async () => {
      const page = await create('<md-slider range value-start="20" value-end="80"></md-slider>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const inputs = page.root?.shadowRoot?.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '30';
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.valueStart).toBe(30);
      expect(detail.valueEnd).toBe(80);
    });
  });

  describe('RTL', () => {
    it('renders inside rtl context', async () => {
      const page = await newSpecPage({
        components: [MdSlider],
        html: `<div dir="rtl"><md-slider value="30"></md-slider></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });
});

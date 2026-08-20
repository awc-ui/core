import { newSpecPage } from '@stencil/core/testing';
import { MdColorPicker } from './md-color-picker';
import { MdButton } from '../md-button/md-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { parseColor } from './color-utils';

async function create(html: string) {
  return newSpecPage({
    components: [MdColorPicker],
    html,
  });
}

async function createPopover(html: string) {
  return newSpecPage({
    components: [MdColorPicker, MdButton, MdRipple],
    html,
  });
}

async function flushRaf() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('md-color-picker', () => {
  describe('rendering', () => {
    it('renders inline with defaults', async () => {
      const page = await create('<md-color-picker></md-color-picker>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-color-picker');
      expect(page.root).toHaveClass('md-color-picker--inline');
      expect(page.root?.shadowRoot?.querySelector('.md-color-picker__panel')).toBeTruthy();
    });

    it('renders hue and alpha sliders when alpha is enabled', async () => {
      const page = await create('<md-color-picker alpha></md-color-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('.md-color-picker__hue')).toBeTruthy();
      expect(shadow?.querySelector('.md-color-picker__alpha')).toBeTruthy();
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdColorPicker],
        html: `<div dir="rtl"><md-color-picker value="#6750A4" alpha></md-color-picker></div>`,
      });
      expect(page.root).toBeTruthy();
    });

    it('positions hue thumb with inset-inline-start from hue value', async () => {
      const page = await create('<md-color-picker value="#6750A4"></md-color-picker>');
      const parsed = parseColor('#6750A4');
      expect(parsed).toBeTruthy();
      const expectedHuePct = (parsed!.h / 360) * 100;
      const thumb = page.root?.shadowRoot?.querySelector(
        '.md-color-picker__hue .md-color-picker__thumb',
      ) as HTMLElement | null;
      expect(thumb).toBeTruthy();
      expect(parseFloat(thumb!.style.insetInlineStart)).toBeCloseTo(expectedHuePct, 5);
    });

    it('positions hue thumb with inset-inline-start in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdColorPicker],
        html: `<div dir="rtl"><md-color-picker value="#6750A4" alpha></md-color-picker></div>`,
      });
      const parsed = parseColor('#6750A4');
      const expectedHuePct = (parsed!.h / 360) * 100;
      const hueThumb = page.root?.shadowRoot?.querySelector(
        '.md-color-picker__hue .md-color-picker__thumb',
      ) as HTMLElement | null;
      const alphaThumb = page.root?.shadowRoot?.querySelector(
        '.md-color-picker__alpha .md-color-picker__thumb',
      ) as HTMLElement | null;
      expect(parseFloat(hueThumb!.style.insetInlineStart)).toBeCloseTo(expectedHuePct, 5);
      expect(alphaThumb?.style.insetInlineStart).toMatch(/%$/);
    });

    it('centers thumbs with logical margin-inline-start', async () => {
      const page = await create('<md-color-picker alpha></md-color-picker>');
      const thumb = page.root?.shadowRoot?.querySelector(
        '.md-color-picker__hue .md-color-picker__thumb',
      );
      expect(thumb?.classList.contains('md-color-picker__thumb--slider')).toBe(true);
    });

    it('increases hue on ArrowRight in LTR', async () => {
      const page = await create('<md-color-picker value="#FF0000"></md-color-picker>');
      await page.waitForChanges();
      const hue = page.root?.shadowRoot?.querySelector('.md-color-picker__hue') as HTMLElement;
      const before = parseFloat(
        (hue.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const after = parseFloat(
        (hue.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      expect(after).toBeGreaterThan(before);
    });

    it('decreases hue on ArrowRight in RTL', async () => {
      const page = await create('<md-color-picker value="#00FFFF"></md-color-picker>');
      await page.waitForChanges();
      const hue = page.root?.shadowRoot?.querySelector('.md-color-picker__hue') as HTMLElement;
      const before = parseFloat(
        (hue.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      const rtlSpy = jest
        .spyOn(globalThis, 'getComputedStyle')
        .mockReturnValue({ direction: 'rtl' } as CSSStyleDeclaration);
      hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const after = parseFloat(
        (hue.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      expect(after).toBeLessThan(before);
      rtlSpy.mockRestore();
    });
  });

  describe('parts', () => {
    it('exposes plate and thumb parts', async () => {
      const page = await create('<md-color-picker></md-color-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="plate"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="thumb"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="hue"]')).toBeTruthy();
    });
  });

  describe('outside click dismiss', () => {
    it('closes on outside click when dismiss-on-outside-click is true', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open dismiss-on-outside-click></md-color-picker>',
      );
      await page.waitForChanges();
      await flushRaf();
      const outside = page.doc.createElement('div');
      page.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.root?.open).toBe(false);
    });

    it('stays open on outside click when dismiss-on-outside-click is false', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open></md-color-picker>',
      );
      await page.waitForChanges();
      await flushRaf();
      const outside = page.doc.createElement('div');
      page.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.root?.open).toBe(true);
    });

    it('does not close on inside click when dismiss-on-outside-click is true', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open dismiss-on-outside-click></md-color-picker>',
      );
      await page.waitForChanges();
      await flushRaf();
      const handler = (page.rootInstance as unknown as {
        outsideClickHandler?: (e: MouseEvent) => void;
      }).outsideClickHandler;
      handler?.({
        composedPath: () => [page.root],
        target: page.root,
      } as unknown as MouseEvent);
      await page.waitForChanges();
      expect(page.root?.open).toBe(true);
    });
  });

  describe('channel inputs', () => {
    it('renders R/G/B inputs for rgb format', async () => {
      const page = await create(
        '<md-color-picker format="rgb" value="rgb(103, 80, 164)"></md-color-picker>',
      );
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="field-r"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-g"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-b"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-h"]')).toBeFalsy();
    });

    it('renders H/S/L inputs for hsl format', async () => {
      const page = await create(
        '<md-color-picker format="hsl" value="hsl(259, 35%, 48%)"></md-color-picker>',
      );
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="field-h"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-s"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-l"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-r"]')).toBeFalsy();
    });

    it('keeps R/G/B inputs for hex format', async () => {
      const page = await create('<md-color-picker format="hex" value="#6750A4"></md-color-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="field-r"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-h"]')).toBeFalsy();
    });

    it('updates colour when an HSL channel changes', async () => {
      const page = await create(
        '<md-color-picker format="hsl" value="hsl(259, 35%, 48%)"></md-color-picker>',
      );
      const instance = page.rootInstance as MdColorPicker;
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      const hInput = page.root?.shadowRoot?.querySelector(
        '[part="field-h"] input',
      ) as HTMLInputElement;
      hInput.value = '120';
      hInput.dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      expect(instance.value).toMatch(/^hsl\(/);
      const hsl = instance.value.match(/hsl\((\d+)/);
      expect(hsl).toBeTruthy();
      expect(parseInt(hsl![1], 10)).toBe(120);
    });
  });

  describe('variants', () => {
    it('renders a trigger SLOT and no built-in trigger', async () => {
      const page = await createPopover('<md-color-picker variant="popover"></md-color-picker>');
      expect(page.root).toHaveClass('md-color-picker--popover');
      // The trigger is entirely the consumer's — there is no default button.
      expect(page.root?.shadowRoot?.querySelector('slot[name="trigger"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="trigger"]')).toBeFalsy();
      expect(page.root?.shadowRoot?.querySelector('[part="panel"]')).toBeFalsy();
    });

    it('shows the panel when popover is open', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open></md-color-picker>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="popover"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="panel"]')).toBeTruthy();
    });
  });

  describe('props', () => {
    it('reflects format, alpha, and disabled attributes', async () => {
      const page = await create(
        '<md-color-picker format="rgb" alpha disabled></md-color-picker>',
      );
      expect(page.root?.getAttribute('format')).toBe('rgb');
      expect(page.root?.getAttribute('alpha')).toBe('');
      expect(page.root?.getAttribute('disabled')).toBe('');
      expect(page.root).toHaveClass('md-color-picker--disabled');
    });

    it('hides hex input when show-hex is false', async () => {
      const page = await create('<md-color-picker show-hex="false"></md-color-picker>');
      expect(page.root?.shadowRoot?.querySelector('[part="field-hex"]')).toBeFalsy();
    });

    it('hides channel inputs when show-inputs is false', async () => {
      const page = await create('<md-color-picker show-inputs="false"></md-color-picker>');
      expect(page.root?.shadowRoot?.querySelector('[part="inputs"]')).toBeFalsy();
    });

    it('parses an rgb value prop on load', async () => {
      const page = await create(
        '<md-color-picker format="rgb" value="rgb(255, 0, 0)"></md-color-picker>',
      );
      expect(page.rootInstance.value).toBe('rgb(255, 0, 0)');
    });

    it('uses a custom aria-label on the host', async () => {
      const page = await create('<md-color-picker aria-label="Brand colour"></md-color-picker>');
      expect(page.root?.getAttribute('aria-label')).toBe('Brand colour');
    });

    it('renders preset swatches when presets are provided', async () => {
      const page = await create(
        '<md-color-picker presets="#000000,#FFFFFF,#FF5722"></md-color-picker>',
      );
      const presets = page.root?.shadowRoot?.querySelectorAll('[part="preset"]');
      expect(presets?.length).toBe(3);
    });

    it('accepts an array property as well as the comma-separated attribute', async () => {
      const page = await create('<md-color-picker></md-color-picker>');
      (page.root as unknown as { presets: string[] }).presets = [
        '#000000',
        '#FFFFFF',
        '#FF5722',
      ];
      await page.waitForChanges();
      const presets = page.root?.shadowRoot?.querySelectorAll('[part="preset"]');
      expect(presets?.length).toBe(3);
      expect(presets?.[2].getAttribute('aria-label')?.toLowerCase()).toBe('#ff5722');
    });

    it('trims whitespace in both forms', async () => {
      const page = await create(
        '<md-color-picker presets=" #000000 , #FFFFFF ,, "></md-color-picker>',
      );
      expect(page.root?.shadowRoot?.querySelectorAll('[part="preset"]').length).toBe(2);
      (page.root as unknown as { presets: string[] }).presets = [' #FF0000 ', '', '#00FF00'];
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('[part="preset"]').length).toBe(2);
    });
  });

  describe('events', () => {
    it('emits mdChange when a preset is clicked', async () => {
      const page = await create(
        '<md-color-picker presets="#FF0000,#00FF00"></md-color-picker>',
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const preset = page.root?.shadowRoot?.querySelector(
        '[part="preset"]',
      ) as HTMLButtonElement;
      preset.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { value: expect.any(String) } }),
      );
    });

    it('emits mdInput while typing a valid hex value', async () => {
      const page = await create('<md-color-picker value="#6750A4"></md-color-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const input = page.root?.shadowRoot?.querySelector(
        '[part="field-hex"] input',
      ) as HTMLInputElement;
      input.value = '#FF0000';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdOpenChange when popover opens', async () => {
      const page = await createPopover('<md-color-picker variant="popover"></md-color-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpenChange', spy);
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { open: true } }),
      );
    });

    it('emits mdChange on hue keyboard adjustment', async () => {
      const page = await create('<md-color-picker value="#FF0000"></md-color-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const hue = page.root?.shadowRoot?.querySelector('.md-color-picker__hue') as HTMLElement;
      hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('keyboard', () => {
    function stubSliderRect(el: HTMLElement, width = 200) {
      el.getBoundingClientRect = () =>
        ({
          left: 0,
          right: width,
          top: 0,
          bottom: 20,
          width,
          height: 20,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      el.setPointerCapture = jest.fn();
      el.releasePointerCapture = jest.fn();
    }

    it('adjusts saturation with arrow keys on the plate', async () => {
      const page = await create('<md-color-picker value="#6750A4"></md-color-picker>');
      const plate = page.root?.shadowRoot?.querySelector('.md-color-picker__plate') as HTMLElement;
      const before = parseFloat(
        (plate.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      plate.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const after = parseFloat(
        (plate.querySelector('.md-color-picker__thumb') as HTMLElement).style.insetInlineStart,
      );
      expect(after).toBeGreaterThan(before);
    });

    it('adjusts alpha with arrow keys when alpha is enabled', async () => {
      const page = await create('<md-color-picker alpha value="#6750A4"></md-color-picker>');
      const alpha = page.root?.shadowRoot?.querySelector('.md-color-picker__alpha') as HTMLElement;
      const before = parseFloat(alpha.getAttribute('aria-valuenow') ?? '1');
      alpha.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await page.waitForChanges();
      const after = parseFloat(alpha.getAttribute('aria-valuenow') ?? '1');
      expect(after).toBeLessThan(before);
    });

    it('activates a preset on Enter', async () => {
      const page = await create(
        '<md-color-picker presets="#FF0000,#00FF00" value="#6750A4"></md-color-picker>',
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const preset = page.root?.shadowRoot?.querySelector(
        '[part="preset"]',
      ) as HTMLButtonElement;
      preset.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('updates hue from pointer drag on the slider', async () => {
      const page = await create('<md-color-picker value="#FF0000"></md-color-picker>');
      const hue = page.root?.shadowRoot?.querySelector('.md-color-picker__hue') as HTMLElement;
      stubSliderRect(hue);
      const PointerEvt =
        typeof PointerEvent !== 'undefined'
          ? PointerEvent
          : (class extends MouseEvent {
              pointerId: number;
              constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
                super(type, init);
                this.pointerId = init.pointerId ?? 1;
              }
            } as typeof PointerEvent);
      hue.dispatchEvent(
        new PointerEvt('pointerdown', { clientX: 100, bubbles: true, pointerId: 1 }),
      );
      await page.waitForChanges();
      const thumb = hue.querySelector('.md-color-picker__thumb') as HTMLElement;
      expect(parseFloat(thumb.style.insetInlineStart)).toBeCloseTo(50, 0);
    });

    it('closes popover on Escape', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open></md-color-picker>',
      );
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(page.root?.open).toBe(false);
    });
  });

  describe('popover methods', () => {
    it('show() opens the popover', async () => {
      const page = await createPopover('<md-color-picker variant="popover"></md-color-picker>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.root?.open).toBe(true);
    });

    it('close() closes the popover', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open></md-color-picker>',
      );
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(page.root?.open).toBe(false);
    });

    it('does not open when disabled', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" disabled></md-color-picker>',
      );
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.root?.open).toBe(false);
    });
  });

  describe('hex input', () => {
    it('marks invalid hex and recovers on blur', async () => {
      const page = await create('<md-color-picker value="#6750A4"></md-color-picker>');
      const input = page.root?.shadowRoot?.querySelector(
        '[part="field-hex"] input',
      ) as HTMLInputElement;
      input.value = 'not-a-color';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      await page.waitForChanges();
      expect(input.getAttribute('aria-invalid')).toBeNull();
      expect(input.value).toMatch(/^#/);
    });

    it('updates RGB channel values', async () => {
      const page = await create(
        '<md-color-picker format="rgb" value="rgb(103, 80, 164)"></md-color-picker>',
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const rInput = page.root?.shadowRoot?.querySelector(
        '[part="field-r"] input',
      ) as HTMLInputElement;
      rInput.value = '255';
      rInput.dispatchEvent(new Event('change', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.value).toMatch(/rgb\(/);
      expect(page.rootInstance.value).toContain('255');
    });
  });

  describe('accessibility', () => {
    it('inline host exposes role="group" and aria-label', async () => {
      const page = await create('<md-color-picker aria-label="Theme colour"></md-color-picker>');
      expect(page.root?.getAttribute('role')).toBe('group');
      expect(page.root?.getAttribute('aria-label')).toBe('Theme colour');
    });

    it('saturation plate exposes application role and label', async () => {
      const page = await create('<md-color-picker></md-color-picker>');
      const plate = page.root?.shadowRoot?.querySelector('[part="plate"]');
      expect(plate?.getAttribute('role')).toBe('application');
      expect(plate?.getAttribute('aria-label')).toBe('Saturation and brightness');
      expect(plate?.getAttribute('tabindex')).toBe('0');
    });

    it('hue slider exposes slider semantics', async () => {
      const page = await create('<md-color-picker></md-color-picker>');
      const hue = page.root?.shadowRoot?.querySelector('[part="hue"]');
      expect(hue?.getAttribute('role')).toBe('slider');
      expect(hue?.getAttribute('aria-valuemin')).toBe('0');
      expect(hue?.getAttribute('aria-valuemax')).toBe('360');
      expect(hue?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('removes controls from tab order when disabled', async () => {
      const page = await create('<md-color-picker disabled alpha></md-color-picker>');
      const plate = page.root?.shadowRoot?.querySelector('[part="plate"]');
      const hue = page.root?.shadowRoot?.querySelector('[part="hue"]');
      const alpha = page.root?.shadowRoot?.querySelector('[part="alpha"]');
      expect(plate?.getAttribute('tabindex')).toBe('-1');
      expect(hue?.getAttribute('tabindex')).toBe('-1');
      expect(alpha?.getAttribute('tabindex')).toBe('-1');
    });

    it('wires dialog popup semantics onto the SLOTTED trigger', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover"><button slot="trigger">Pick</button></md-color-picker>',
      );
      const trigger = page.root?.querySelector('[slot="trigger"]');
      expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    });

    it('open popover renders a dialog with aria-label', async () => {
      const page = await createPopover(
        '<md-color-picker variant="popover" open aria-label="Swatch picker"></md-color-picker>',
      );
      const dialog = page.root?.shadowRoot?.querySelector('[part="popover"]');
      expect(dialog?.getAttribute('role')).toBe('dialog');
      expect(dialog?.getAttribute('aria-label')).toBe('Swatch picker');
    });

    it('presets expose listbox semantics with selected state', async () => {
      const page = await create(
        '<md-color-picker value="#FF0000" presets="#FF0000,#00FF00"></md-color-picker>',
      );
      const listbox = page.root?.shadowRoot?.querySelector('[part="presets"]');
      expect(listbox?.getAttribute('role')).toBe('listbox');
      const selected = page.root?.shadowRoot?.querySelector('[part="preset"][aria-selected="true"]');
      expect(selected).toBeTruthy();
    });
  });

  describe('parts', () => {
    it('exposes panel, preview, sliders, and input field parts', async () => {
      const page = await create('<md-color-picker alpha></md-color-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="panel"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="preview"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="sliders"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="field-hex"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="alpha"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="inputs"]')).toBeTruthy();
    });
  });
});

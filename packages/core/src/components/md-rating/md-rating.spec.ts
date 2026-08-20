import { newSpecPage } from '@stencil/core/testing';
import { MdRating } from './md-rating';

async function create(html: string) {
  return newSpecPage({ components: [MdRating], html });
}

describe('md-rating', () => {
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-rating></md-rating>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-rating');
      const items = page.root?.shadowRoot?.querySelectorAll('.md-rating__item');
      expect(items?.length).toBe(5);
    });

    it('renders custom max', async () => {
      const page = await create('<md-rating max="10"></md-rating>');
      const items = page.root?.shadowRoot?.querySelectorAll('.md-rating__item');
      expect(items?.length).toBe(10);
    });

    it('renders value-label when show-value-label is set', async () => {
      const page = await create('<md-rating value="3" show-value-label></md-rating>');
      const label = page.root?.shadowRoot?.querySelector('.md-rating__value-label');
      expect(label?.textContent).toContain('Stars');
    });

    it('reflects size on host', async () => {
      const page = await create('<md-rating size="lg"></md-rating>');
      expect(page.root?.getAttribute('size')).toBe('lg');
    });
  });

  describe('value handling', () => {
    it('marks items as full/half/empty based on value', async () => {
      const page = await create('<md-rating value="2.5" precision="0.5"></md-rating>');
      const items = page.root?.shadowRoot?.querySelectorAll('.md-rating__item');
      expect(items?.[0]).toHaveClass('md-rating__item--full');
      expect(items?.[1]).toHaveClass('md-rating__item--full');
      expect(items?.[2]).toHaveClass('md-rating__item--half');
      expect(items?.[3]).toHaveClass('md-rating__item--empty');
    });

    it('clamps value to [0, max]', async () => {
      const page = await create('<md-rating value="-2" max="5"></md-rating>');
      await page.waitForChanges();
      expect((page.root as unknown as { value: number }).value).toBe(0);

      const page2 = await create('<md-rating value="10" max="5"></md-rating>');
      await page2.waitForChanges();
      expect((page2.root as unknown as { value: number }).value).toBe(5);
    });

    // Form participation is form-associated (ElementInternals.setFormValue),
    // not a shadow-DOM hidden input (invisible to FormData). Real submission
    // is covered by the e2e suite; here we assert the contract: name reflects
    // to the host and no hidden input is rendered.
    it('reflects name to the host and renders no hidden input', async () => {
      const page = await create('<md-rating name="quality" value="4"></md-rating>');
      expect(page.root?.getAttribute('name')).toBe('quality');
      expect(page.root?.shadowRoot?.querySelector('input[type="hidden"]')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('exposes slider role and ARIA props', async () => {
      const page = await create('<md-rating value="3" max="5"></md-rating>');
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]');
      expect(slider).toBeTruthy();
      expect(slider?.getAttribute('aria-valuemin')).toBe('0');
      expect(slider?.getAttribute('aria-valuemax')).toBe('5');
      expect(slider?.getAttribute('aria-valuenow')).toBe('3');
      expect(slider?.getAttribute('aria-valuetext')).toBe('3 Stars');
    });

    it('switches to role="img" when readonly', async () => {
      const page = await create('<md-rating value="3" readonly></md-rating>');
      expect(page.root?.shadowRoot?.querySelector('[role="img"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[role="slider"]')).toBeFalsy();
    });

    it('folds the value into the readonly img name (img ignores aria-valuetext)', async () => {
      const page = await create('<md-rating value="3" readonly></md-rating>');
      const img = page.root?.shadowRoot?.querySelector('[role="img"]');
      // img must NOT carry slider-only attrs (aria-allowed-attr) …
      expect(img?.getAttribute('aria-valuenow')).toBeNull();
      expect(img?.getAttribute('aria-valuetext')).toBeNull();
      expect(img?.getAttribute('aria-orientation')).toBeNull();
      expect(img?.getAttribute('aria-readonly')).toBeNull();
      // … the value is announced via the accessible name instead.
      expect(img?.getAttribute('aria-label')).toBe('Rating: 3 Stars');
    });

    it('renders items as non-interactive (no nested control inside the slider)', async () => {
      const page = await create('<md-rating value="3"></md-rating>');
      const items = Array.from(page.root?.shadowRoot?.querySelectorAll('.md-rating__item') ?? []);
      expect(items.length).toBe(5);
      // <button> descendants would trip WAI-ARIA nested-interactive on the slider.
      expect(items.every((el) => el.tagName === 'SPAN')).toBe(true);
      expect(page.root?.shadowRoot?.querySelector('[role="slider"] button')).toBeNull();
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-rating disabled></md-rating>');
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]');
      expect(slider?.getAttribute('aria-disabled')).toBe('true');
      expect(slider?.getAttribute('tabindex')).toBe('-1');
    });

    it('keeps soft-disabled focusable', async () => {
      const page = await create('<md-rating soft-disabled></md-rating>');
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]');
      expect(slider?.getAttribute('aria-disabled')).toBe('true');
      expect(slider?.getAttribute('tabindex')).toBe('0');
    });

    it('exposes parts', async () => {
      const page = await create('<md-rating value="3"></md-rating>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="items"]')).toBeTruthy();
      expect(shadow?.querySelector('[part~="item"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="state-layer"]')).toBeTruthy();
    });
  });

  describe('keyboard', () => {
    it('increases value on ArrowRight', async () => {
      const page = await create('<md-rating value="2"></md-rating>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: 3 }));
    });

    it('leaves Escape untouched (bubbles for dismiss) — Home clears instead', async () => {
      const page = await create('<md-rating value="4"></md-rating>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      slider.dispatchEvent(esc);
      await page.waitForChanges();
      // Escape is not a slider key: value unchanged and the event is not consumed.
      expect(spy).not.toHaveBeenCalled();
      expect((page.root as unknown as { value: number }).value).toBe(4);
      expect(esc.defaultPrevented).toBe(false);
      // Home is the keyboard clear (min = 0 = empty).
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: 0 }));
    });

    it('re-clamps value when max shrinks below it', async () => {
      const page = await create('<md-rating value="5" max="5"></md-rating>');
      (page.root as unknown as { max: number }).max = 3;
      await page.waitForChanges();
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]');
      expect((page.root as unknown as { value: number }).value).toBe(3);
      expect(slider?.getAttribute('aria-valuenow')).toBe('3');
      expect(slider?.getAttribute('aria-valuemax')).toBe('3');
    });

    it('forwards host aria-label / aria-labelledby to the slider name', async () => {
      const page = await newSpecPage({
        components: [MdRating],
        html: `<div><span id="lbl">Movie quality</span><md-rating value="3" aria-labelledby="lbl"></md-rating></div>`,
      });
      const slider = page.body.querySelector('md-rating')?.shadowRoot?.querySelector('[role="slider"]');
      expect(slider?.getAttribute('aria-label')).toBe('Movie quality');
    });

    it('jumps to value via digit key', async () => {
      const page = await create('<md-rating value="0" max="5"></md-rating>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: 4 }));
    });

    it('jumps to end on End key', async () => {
      const page = await create('<md-rating value="1" max="5"></md-rating>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const slider = page.root?.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: 5 }));
    });

    it('does not change value when readonly', async () => {
      const page = await create('<md-rating value="2" readonly></md-rating>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const node = page.root?.shadowRoot?.querySelector('[role="img"]') as HTMLElement;
      node?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdRating],
        html: `<div dir="rtl"><md-rating value="3"></md-rating></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-rating style="--md-rating-active-color: hotpink"></md-rating>',
      );
      expect(page.root?.getAttribute('style')).toContain('--md-rating-active-color');
    });
  });
});

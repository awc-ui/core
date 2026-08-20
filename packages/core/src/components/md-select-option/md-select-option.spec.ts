import { newSpecPage } from '@stencil/core/testing';
import { MdSelectOption } from './md-select-option';

describe('md-select-option', () => {
  it('renders as a hidden data carrier', async () => {
    const page = await newSpecPage({
      components: [MdSelectOption],
      html: `<md-select-option value="red">Red</md-select-option>`,
    });
    expect(page.root).toBeTruthy();
    // aria-hidden so AT doesn't double-announce alongside the live menu item.
    expect(page.root?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps role="option" for DOM semantics', async () => {
    const page = await newSpecPage({
      components: [MdSelectOption],
      html: `<md-select-option value="red">Red</md-select-option>`,
    });
    expect(page.root?.getAttribute('role')).toBe('option');
  });

  it('reflects selected + disabled to aria + attributes', async () => {
    const page = await newSpecPage({
      components: [MdSelectOption],
      html: `<md-select-option value="red" selected disabled>Red</md-select-option>`,
    });
    expect(page.root?.getAttribute('aria-selected')).toBe('true');
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    expect(page.root?.hasAttribute('selected')).toBe(true);
    expect(page.root?.hasAttribute('disabled')).toBe(true);
  });

  it('exposes value / label / icon / iconColor / supportingText props', async () => {
    const page = await newSpecPage({
      components: [MdSelectOption],
      html: `<md-select-option value="r" label="Red" icon="circle" icon-color="#E53935" supporting-text="warm">Red</md-select-option>`,
    });
    const el = page.root as unknown as {
      value: string; label: string; icon: string; iconColor: string; supportingText: string;
    };
    expect(el.value).toBe('r');
    expect(el.label).toBe('Red');
    expect(el.icon).toBe('circle');
    expect(el.iconColor).toBe('#E53935');
    expect(el.supportingText).toBe('warm');
  });

  it('emits mdSelectOptionChange when a data prop changes', async () => {
    const page = await newSpecPage({
      components: [MdSelectOption],
      html: `<md-select-option value="red">Red</md-select-option>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSelectOptionChange', spy);
    (page.root as unknown as { disabled: boolean }).disabled = true;
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });
});

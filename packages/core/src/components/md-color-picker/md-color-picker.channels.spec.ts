import { newSpecPage } from '@stencil/core/testing';
import { MdColorPicker } from './md-color-picker';

describe('md-color-picker editable channel controls', () => {
  it('commits independent RGB channels and clamps numeric alpha', async () => {
    const page = await newSpecPage({ components: [MdColorPicker], html: '<md-color-picker format="rgb" alpha value="#ff0000"></md-color-picker>' });
    const host = page.root as any, changes = jest.fn();
    host.addEventListener('mdChange', changes);
    const change = async (part: string, value: string) => {
      const input = host.shadowRoot.querySelector('[part="field-' + part + '"] input');
      input.value = value; input.dispatchEvent(new Event('change')); await page.waitForChanges();
    };
    await change('g', '255'); expect(host.value).toBe('rgb(255, 255, 0)');
    await change('b', '255'); expect(host.value).toBe('rgb(255, 255, 255)');
    await change('r', '-4'); expect(host.value).toBe('rgb(0, 255, 255)');
    await change('a', '0.5'); expect(host.value).toBe('rgba(0, 255, 255, 0.5)');
    await change('a', '8'); expect(host.value).toBe('rgb(0, 255, 255)');
    await change('a', ''); expect(host.value).toBe('rgba(0, 255, 255, 0)');
    expect(changes).toHaveBeenCalledTimes(6);
  });

  it('commits all HSL fields, including clamped and empty channel input', async () => {
    const page = await newSpecPage({ components: [MdColorPicker], html: '<md-color-picker format="hsl" value="#ff0000"></md-color-picker>' });
    const host = page.root as any;
    const change = async (part: string, value: string) => {
      const input = host.shadowRoot.querySelector('[part="field-' + part + '"] input');
      input.value = value; input.dispatchEvent(new Event('change')); await page.waitForChanges();
    };
    await change('h', '120'); expect(host.value).toBe('hsl(120, 100%, 50%)');
    await change('s', '0'); expect(host.value).toBe('hsl(0, 0%, 50%)');
    await change('l', '1000'); expect(host.value).toBe('hsl(0, 0%, 100%)');
    await change('l', ''); expect(host.value).toBe('hsl(0, 0%, 0%)');
  });

  it('reflects property-driven popover state on its consumer trigger and refuses disabled activation', async () => {
    const page = await newSpecPage({ components: [MdColorPicker], html: '<md-color-picker variant="popover"><button slot="trigger">Choose</button></md-color-picker>' });
    const host = page.root as any, trigger = host.querySelector('button');
    const opens = jest.fn(); host.addEventListener('mdOpenChange', opens);
    trigger.click(); await page.waitForChanges();
    expect(host.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    host.dismissOnOutsideClick = true; await page.waitForChanges();
    host.disabled = true; await page.waitForChanges();
    await host.close(); await page.waitForChanges();
    trigger.click(); await host.show(); await page.waitForChanges();
    expect(host.open).toBe(false);
    host.disabled = false; host.variant = 'inline'; await page.waitForChanges();
    await host.show(); await host.close(); await page.waitForChanges();
    expect(host.open).toBe(false);
    expect(opens.mock.calls.map(([event]) => event.detail.open)).toEqual([true, false]);
  });
});

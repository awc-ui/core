import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): the radio host lives in the light DOM but
 *  is a custom element, so interactions address its properties/methods and read
 *  the reflected `aria-checked` attribute that lands on the next render flush. */
type RadioEl = HTMLElement & {
  checked: boolean;
  value: string;
  disabled: boolean;
  select: () => Promise<void>;
  setFocus: () => Promise<void>;
  setBlur: () => Promise<void>;
};

const getRadios = async (canvasElement: HTMLElement, name: string): Promise<RadioEl[]> => {
  const radios = Array.from(
    canvasElement.querySelectorAll(`md-radio[name="${name}"]`),
  ) as RadioEl[];
  await waitFor(() =>
    expect(radios.length > 0 && radios.every((r) => r.classList.contains('hydrated'))).toBe(true),
  );
  return radios;
};

/** The `value`s of every radio currently reporting `aria-checked="true"` (in DOM order). */
const checkedValues = (radios: RadioEl[]) =>
  radios
    .filter((r) => r.getAttribute('aria-checked') === 'true')
    .map((r) => r.getAttribute('value'));

const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Selection/Radio',
  component: 'md-radio',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the radio is selected',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the radio is disabled',
    },
    value: {
      control: 'text',
      description: 'Form value',
    },
  },
  args: {
    checked: false,
    disabled: false,
    value: 'option',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="display: flex; align-items: center; gap: 8px;">
      <md-radio
        ?checked=${args.checked}
        ?disabled=${args.disabled}
        value=${args.value}
        aria-label="${t(globals.locale, 'radio.labelText')}"
      ></md-radio>
      <span style="font-family: Roboto, sans-serif; font-size: 16px; color: var(--md-sys-color-on-surface, #1C1B1F);">
        ${t(globals.locale, 'radio.labelText')}
      </span>
    </div>
  `,
  /** Standalone radio (no group `name`): stays tabbable, selects on click, and the
   *  group-management paths short-circuit (uncheckOthers early-returns without a name). */
  play: async ({ canvasElement, step }) => {
    const radio = canvasElement.querySelector('md-radio') as RadioEl;
    await waitFor(() => expect(radio.classList.contains('hydrated')).toBe(true));

    await step('A standalone radio (no group name) stays in the tab order', async () => {
      // updateRovingTabIndex hits the `!this.name` branch → always tabindex 0
      await waitFor(() => expect(radio.getAttribute('tabindex')).toBe('0'));
      expect(radio.getAttribute('aria-checked')).toBe('false');
    });

    await step('Clicking the standalone radio checks it and emits its value', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      radio.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      radio.click(); // handleClick selects it; onCheckedChange → uncheckOthers early-returns (no name)

      await waitFor(() => expect(radio.getAttribute('aria-checked')).toBe('true'));
      expect(detail?.value).toBe('option'); // emitted the configured value
    });

    await step('Clicking the already-checked standalone radio is a guarded no-op', async () => {
      let emitted = false;
      radio.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      radio.click(); // handleClick → `this.checked` guard returns before emitting

      await waitFor(() => expect(radio.getAttribute('aria-checked')).toBe('true'));
      expect(emitted).toBe(false); // no redundant mdChange for an already-selected radio
    });

    await step('setFocus() focuses the standalone radio and shows the programmatic focus ring', async () => {
      let focused = false;
      radio.addEventListener('mdFocus', () => { focused = true; }, { once: true });

      await radio.setFocus(); // programmaticFocus = true, then el.focus()

      await waitFor(() => expect(document.activeElement).toBe(radio)); // focus landed on the host
      expect(focused).toBe(true); // handleFocus emitted mdFocus
      await waitFor(() => expect(radio.classList.contains('md-radio--focus-ring')).toBe(true)); // script focus renders the ring (flush after render)
    });

    await step('setBlur() blurs the radio, emits mdBlur, and clears the focus ring', async () => {
      let blurred = false;
      radio.addEventListener('mdBlur', () => { blurred = true; }, { once: true });

      await radio.setBlur();

      await waitFor(() => expect(document.activeElement).not.toBe(radio)); // focus left the host
      expect(blurred).toBe(true); // handleBlur emitted mdBlur
      await waitFor(() => expect(radio.classList.contains('md-radio--focus-ring')).toBe(false)); // ring cleared on blur (flush after render)
    });
  },
};

export const Group: Story = {
  render: (_args, { globals }) => html`
    <div role="radiogroup" aria-label="${t(globals.locale, 'radio.favoriteFruit')}" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="fruit" value="apple" aria-label="${t(globals.locale, 'radio.apple')}" checked></md-radio> ${t(globals.locale, 'radio.apple')}
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="fruit" value="banana" aria-label="${t(globals.locale, 'radio.banana')}"></md-radio> ${t(globals.locale, 'radio.banana')}
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="fruit" value="cherry" aria-label="${t(globals.locale, 'radio.cherry')}"></md-radio> ${t(globals.locale, 'radio.cherry')}
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="fruit" value="dragonfruit" aria-label="${t(globals.locale, 'radio.dragonfruit')}"></md-radio> ${t(globals.locale, 'radio.dragonfruit')}
      </label>
    </div>
  `,
  /** Exclusive selection: clicking one selects it + deselects the rest + emits the
   *  group value; ArrowDown rolls selection to the next radio and emits again. */
  play: async ({ canvasElement, step }) => {
    const group = canvasElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = await getRadios(canvasElement, 'fruit');
    const byValue = (v: string) => radios.find((r) => r.getAttribute('value') === v)!;

    await step('Apple starts selected; every sibling is unselected', async () => {
      await waitFor(() => expect(byValue('apple').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['apple']); // exactly one, exclusive
    });

    await step('Clicking Banana selects it, deselects Apple, and emits the group value', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      byValue('banana').click();

      // Selection transferred: Banana on, Apple off — asserted together so the
      // second radio's re-render (via uncheckOthers) is given the same flush.
      await waitFor(() => {
        expect(byValue('banana').getAttribute('aria-checked')).toBe('true');
        expect(byValue('apple').getAttribute('aria-checked')).toBe('false');
      });
      expect(checkedValues(radios)).toEqual(['banana']); // still exactly one checked
      expect(detail?.value).toBe('banana'); // component emitted its new group value
    });

    await step('ArrowDown moves selection to the next radio and emits the transition', async () => {
      const before = checkedValues(radios)[0]; // live read: 'banana'
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(byValue('banana'), 'ArrowDown');

      await waitFor(() => expect(checkedValues(radios)[0]).not.toBe(before)); // proves it MOVED
      expect(before).toBe('banana'); // sanity: we captured the pre-transition value
      expect(checkedValues(radios)).toEqual(['cherry']); // proves WHERE + still exclusive
      expect(detail?.value).toBe('cherry'); // arrow-key selection emitted too
      expect(document.activeElement).toBe(byValue('cherry')); // focus followed the roving selection
    });

    await step('ArrowUp rolls selection to the PREVIOUS radio and emits the transition', async () => {
      const before = checkedValues(radios)[0]; // live read: 'cherry'
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(byValue('cherry'), 'ArrowUp'); // focusSibling(-1)

      await waitFor(() => expect(checkedValues(radios)[0]).not.toBe(before)); // proves it MOVED
      expect(before).toBe('cherry'); // sanity: captured the pre-transition value
      expect(checkedValues(radios)).toEqual(['banana']); // wrapped back one step, still exclusive
      expect(detail?.value).toBe('banana'); // backward arrow selection emitted too
      expect(document.activeElement).toBe(byValue('banana')); // focus followed the roving selection
    });

    await step('Space activates the targeted (unchecked) radio like a click', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(byValue('dragonfruit'), ' '); // keyboard activation path (preventDefault + handleClick + ripple)

      await waitFor(() => expect(byValue('dragonfruit').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['dragonfruit']); // Space selected it, deselected banana
      expect(detail?.value).toBe('dragonfruit'); // Space emitted the group value
    });

    await step('Clicking the wrapping LABEL (not the radio) still selects the radio', async () => {
      const appleLabel = byValue('apple').closest('label') as HTMLLabelElement;
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      appleLabel.click(); // fires on the label; composedPath excludes the radio → handleLabelClick delegates

      await waitFor(() => expect(byValue('apple').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['apple']); // label delegation drove an exclusive swap
      expect(detail?.value).toBe('apple'); // and emitted the group value
    });

    await step('Pointer press toggles the pressed visual state without changing selection', async () => {
      const target = byValue('banana'); // currently unchecked
      const checkedBefore = checkedValues(radios); // ['apple']

      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await waitFor(() => expect(target.classList.contains('md-radio--pressed')).toBe(true)); // handlePointerDown

      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await waitFor(() => expect(target.classList.contains('md-radio--pressed')).toBe(false)); // handlePointerUp

      expect(checkedValues(radios)).toEqual(checkedBefore); // pressing is not selecting — group unchanged
    });
  },
};

export const States: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface-variant);">Unchecked</span>
        <md-radio name="s1" value="a" aria-label="Unchecked"></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface-variant);">Checked</span>
        <md-radio name="s2" value="a" aria-label="Checked" checked></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface-variant);">Disabled</span>
        <md-radio name="s3" value="a" aria-label="Disabled" disabled></md-radio>
        <md-radio name="s4" value="a" aria-label="Disabled, selected" disabled checked></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface-variant);">Soft-disabled</span>
        <md-radio name="s5" value="a" aria-label="Soft-disabled" soft-disabled></md-radio>
        <md-radio name="s6" value="a" aria-label="Soft-disabled, selected" soft-disabled checked></md-radio>
      </div>
    </div>
  `,
  /** Disabled + soft-disabled radios: the disabled one is removed from the tab order,
   *  and both are inert to clicks/keys — exercises the isDisabled guards in the handlers
   *  and the `disabled` branch of updateRovingTabIndex. */
  play: async ({ canvasElement, step }) => {
    const [disabledRadio] = await getRadios(canvasElement, 's3');
    const [softDisabledRadio] = await getRadios(canvasElement, 's5');

    await step('A disabled radio is removed from the tab order and marked aria-disabled', async () => {
      await waitFor(() => {
        expect(disabledRadio.getAttribute('tabindex')).toBe('-1'); // updateRovingTabIndex disabled branch
        expect(disabledRadio.getAttribute('aria-disabled')).toBe('true');
      });
      expect(disabledRadio.getAttribute('aria-checked')).toBe('false');
    });

    await step('Clicking a disabled radio is a guarded no-op (no selection, no event)', async () => {
      let emitted = false;
      disabledRadio.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      disabledRadio.click(); // handleClick → isDisabled guard returns before mutating

      await waitFor(() => expect(disabledRadio.getAttribute('aria-checked')).toBe('false'));
      expect(emitted).toBe(false);
    });

    await step('Keydown on a disabled radio is ignored by the keyboard handler', async () => {
      let emitted = false;
      disabledRadio.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      key(disabledRadio, ' '); // handleKeyDown → isDisabled early return (Space would otherwise select)

      await waitFor(() => expect(disabledRadio.getAttribute('aria-checked')).toBe('false'));
      expect(emitted).toBe(false);
    });

    await step('A soft-disabled radio also ignores clicks (isDisabled covers softDisabled)', async () => {
      let emitted = false;
      softDisabledRadio.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      softDisabledRadio.click(); // isDisabled = disabled || softDisabled → true → guarded

      await waitFor(() => expect(softDisabledRadio.getAttribute('aria-checked')).toBe('false'));
      expect(emitted).toBe(false);
    });

    await step('select() on a disabled radio is a guarded no-op (isDisabled short-circuit)', async () => {
      let emitted = false;
      disabledRadio.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      await disabledRadio.select(); // select() → isDisabled guard returns before mutating/emitting

      await waitFor(() => expect(disabledRadio.getAttribute('aria-checked')).toBe('false')); // stayed unselected
      expect(emitted).toBe(false); // disabled radios never emit from the public method
    });

    await step('Pointer-pressing a soft-disabled radio clears the programmatic ring but never presses', async () => {
      await softDisabledRadio.setFocus(); // programmaticFocus = true → focus ring shows
      await waitFor(() => expect(softDisabledRadio.classList.contains('md-radio--focus-ring')).toBe(true));

      // handlePointerDown always clears programmaticFocus; the `if (!isDisabled)` guard blocks `pressed`.
      softDisabledRadio.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));

      await waitFor(() => expect(softDisabledRadio.classList.contains('md-radio--focus-ring')).toBe(false)); // ring cleared
      expect(softDisabledRadio.classList.contains('md-radio--pressed')).toBe(false); // guard blocked the pressed state

      softDisabledRadio.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await softDisabledRadio.setBlur();
    });
  },
};

export const WithLabels: Story = {
  render: (_args, { globals }) => html`
    <div role="radiogroup" aria-label="${t(globals.locale, 'radio.shippingMethod')}" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-radius: 12px; cursor: pointer; font-family: Roboto, sans-serif;">
        <md-radio name="ship" value="standard" aria-label="${t(globals.locale, 'radio.standard')}" checked></md-radio>
        <div>
          <div style="font-size: 16px; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'radio.standard')}</div>
          <div style="font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">${t(globals.locale, 'radio.standardDesc')}</div>
        </div>
      </label>
      <label style="display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-radius: 12px; cursor: pointer; font-family: Roboto, sans-serif;">
        <md-radio name="ship" value="express" aria-label="${t(globals.locale, 'radio.express')}"></md-radio>
        <div>
          <div style="font-size: 16px; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'radio.express')}</div>
          <div style="font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">${t(globals.locale, 'radio.expressDesc')}</div>
        </div>
      </label>
      <label style="display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-radius: 12px; cursor: pointer; font-family: Roboto, sans-serif;">
        <md-radio name="ship" value="overnight" aria-label="${t(globals.locale, 'radio.overnight')}"></md-radio>
        <div>
          <div style="font-size: 16px; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'radio.overnight')}</div>
          <div style="font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">${t(globals.locale, 'radio.overnightDesc')}</div>
        </div>
      </label>
    </div>
  `,
};

export const HorizontalGroup: Story = {
  render: (_args, { globals }) => html`
    <div role="radiogroup" aria-label="${t(globals.locale, 'radio.size')}" style="display: flex; gap: 4px; align-items: center;">
      <label style="display: flex; align-items: center; gap: 4px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="size" value="sm" aria-label="S"></md-radio> S
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="size" value="md" aria-label="M" checked></md-radio> M
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="size" value="lg" aria-label="L"></md-radio> L
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="size" value="xl" aria-label="XL"></md-radio> XL
      </label>
    </div>
  `,
  /** Horizontal arrows exercise the ArrowRight/ArrowLeft halves of the keydown
   *  handler: forward and backward roll selection through the group and emit. */
  play: async ({ canvasElement, step }) => {
    const group = canvasElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = await getRadios(canvasElement, 'size');
    const byValue = (v: string) => radios.find((r) => r.getAttribute('value') === v)!;

    await step('M is selected on mount', async () => {
      await waitFor(() => expect(byValue('md').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['md']);
    });

    await step('ArrowRight rolls selection forward to the next radio and emits', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(byValue('md'), 'ArrowRight'); // horizontal forward → focusSibling(1)

      await waitFor(() => expect(checkedValues(radios)).toEqual(['lg']));
      expect(document.activeElement).toBe(byValue('lg')); // focus followed the roving selection
      expect(detail?.value).toBe('lg'); // arrow selection emitted the new value
    });

    await step('ArrowLeft rolls selection backward to the previous radio and emits', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(byValue('lg'), 'ArrowLeft'); // horizontal backward → focusSibling(-1)

      await waitFor(() => expect(checkedValues(radios)).toEqual(['md']));
      expect(document.activeElement).toBe(byValue('md')); // focus rolled back
      expect(detail?.value).toBe('md'); // backward selection emitted too
    });
  },
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" role="radiogroup" aria-label="خيار" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="rtl" value="a" aria-label="الخيار الأول" checked></md-radio> الخيار الأول
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="rtl" value="b" aria-label="الخيار الثاني"></md-radio> الخيار الثاني
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="rtl" value="c" aria-label="الخيار الثالث"></md-radio> الخيار الثالث
      </label>
    </div>
  `,
};

export const Localization: Story = {
  name: 'Localization',
  render: () => html`
    <div style="display: flex; flex-wrap: wrap; gap: 32px; padding: 8px; font-family: Roboto, sans-serif;">

      <!-- English (LTR) -->
      <div>
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">English (LTR)</p>
        <div role="radiogroup" aria-label="Delivery speed" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-en" value="standard" aria-label="Standard delivery" checked></md-radio> Standard delivery
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-en" value="express" aria-label="Express delivery"></md-radio> Express delivery
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-en" value="overnight" aria-label="Overnight delivery"></md-radio> Overnight delivery
          </label>
        </div>
      </div>

      <!-- French (LTR) -->
      <div>
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">French (LTR)</p>
        <div role="radiogroup" aria-label="Mode de livraison" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-fr" value="standard" aria-label="Livraison standard" checked></md-radio> Livraison standard
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-fr" value="express" aria-label="Livraison express"></md-radio> Livraison express
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-fr" value="nuit" aria-label="Livraison de nuit"></md-radio> Livraison de nuit
          </label>
        </div>
      </div>

      <!-- German (LTR) -->
      <div>
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">German (LTR)</p>
        <div role="radiogroup" aria-label="Lieferoption" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-de" value="standard" aria-label="Standardlieferung" checked></md-radio> Standardlieferung
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-de" value="express" aria-label="Expresslieferung"></md-radio> Expresslieferung
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-de" value="nacht" aria-label="Nachtlieferung"></md-radio> Nachtlieferung
          </label>
        </div>
      </div>

      <!-- Japanese (LTR) -->
      <div>
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">Japanese (LTR)</p>
        <div role="radiogroup" aria-label="配送方法" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ja" value="standard" aria-label="通常配送" checked></md-radio> 通常配送
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ja" value="express" aria-label="速達配送"></md-radio> 速達配送
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ja" value="overnight" aria-label="翌日配送"></md-radio> 翌日配送
          </label>
        </div>
      </div>

      <!-- Arabic (RTL) -->
      <div dir="rtl">
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">Arabic (RTL)</p>
        <div role="radiogroup" aria-label="طريقة التوصيل" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ar" value="standard" aria-label="توصيل عادي" checked></md-radio> توصيل عادي
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ar" value="express" aria-label="توصيل سريع"></md-radio> توصيل سريع
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-ar" value="overnight" aria-label="توصيل ليلي"></md-radio> توصيل ليلي
          </label>
        </div>
      </div>

      <!-- Hebrew (RTL) -->
      <div dir="rtl">
        <p style="font: 500 11px/16px Roboto, sans-serif; text-transform: uppercase; letter-spacing: .5px; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 10px;">Hebrew (RTL)</p>
        <div role="radiogroup" aria-label="אפשרות משלוח" style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-he" value="standard" aria-label="משלוח רגיל" checked></md-radio> משלוח רגיל
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-he" value="express" aria-label="משלוח מהיר"></md-radio> משלוח מהיר
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-radio name="loc-he" value="overnight" aria-label="משלוח לילי"></md-radio> משלוח לילי
          </label>
        </div>
      </div>

    </div>
  `,
};

export const DarkTheme: Story = {
  render: () => html`
    <div role="radiogroup" aria-label="Theme test" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer; color: var(--md-sys-color-on-surface);">
        <md-radio name="dark" value="a" aria-label="Option A" checked></md-radio> Option A
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer; color: var(--md-sys-color-on-surface);">
        <md-radio name="dark" value="b" aria-label="Option B"></md-radio> Option B
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer; color: var(--md-sys-color-on-surface);">
        <md-radio name="dark" value="c" aria-label="Disabled" disabled></md-radio> Disabled
      </label>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .error-radio {
        --md-radio-icon-color: var(--md-sys-color-error);
        --md-radio-selected-icon-color: var(--md-sys-color-error);
        --md-radio-selected-state-layer-color: var(--md-sys-color-error);
      }
      .brand-radio {
        --md-radio-selected-icon-color: #6200ee;
        --md-radio-selected-state-layer-color: #6200ee;
      }
      .large-radio {
        --md-radio-icon-size: 28px;
        --md-radio-inner-circle-size: 14px;
        --md-radio-state-layer-size: 52px;
      }
    </style>
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 80px;">Default</span>
        <md-radio name="c1" value="a" aria-label="Default option A" checked></md-radio>
        <md-radio name="c1" value="b" aria-label="Default option B"></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 80px;">Error</span>
        <md-radio name="c2" value="a" aria-label="Error option A" checked class="error-radio"></md-radio>
        <md-radio name="c2" value="b" aria-label="Error option B" class="error-radio"></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 80px;">Brand</span>
        <md-radio name="c3" value="a" aria-label="Brand option A" checked class="brand-radio"></md-radio>
        <md-radio name="c3" value="b" aria-label="Brand option B" class="brand-radio"></md-radio>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; font-family: Roboto, sans-serif;">
        <span style="width: 80px;">Large</span>
        <md-radio name="c4" value="a" aria-label="Large option A" checked class="large-radio"></md-radio>
        <md-radio name="c4" value="b" aria-label="Large option B" class="large-radio"></md-radio>
      </div>
    </div>
  `,
};

export const CSSParts: Story = {
  render: () => html`
    <style>
      .thick-border::part(outer-circle) {
        border-width: 3px;
      }
      .big-dot::part(inner-circle) {
        border-radius: 4px;
      }
      .custom-focus::part(state-layer) {
        background-color: var(--md-sys-color-tertiary);
      }
    </style>
    <div style="display: flex; gap: 16px; align-items: center;">
      <md-radio name="p1" value="a" aria-label="Thick border example" checked class="thick-border"></md-radio>
      <md-radio name="p2" value="a" aria-label="Big dot example" checked class="big-dot"></md-radio>
      <md-radio name="p3" value="a" aria-label="Custom focus example" class="custom-focus"></md-radio>
    </div>
  `,
};

export const InListContext: Story = {
  parameters: { layout: 'padded' },
  render: (_args, { globals }) => html`
    <md-list id="radio-list" style="inline-size: 360px;" label="${t(globals.locale, 'radio.connections')}">
      <md-list-item headline="Wi-Fi" supporting-text="${t(globals.locale, 'radio.wifiDesc')}">
        <md-radio slot="trailing" name="list" value="a" aria-label="Wi-Fi" checked></md-radio>
      </md-list-item>
      <md-list-item headline="Bluetooth" supporting-text="${t(globals.locale, 'radio.bluetoothDesc')}">
        <md-radio slot="trailing" name="list" value="b" aria-label="Bluetooth"></md-radio>
      </md-list-item>
      <md-list-item headline="${t(globals.locale, 'radio.mobileData')}" supporting-text="${t(globals.locale, 'radio.mobileDataDesc')}">
        <md-radio slot="trailing" name="list" value="c" aria-label="${t(globals.locale, 'radio.mobileData')}"></md-radio>
      </md-list-item>
    </md-list>
    <script>
      {
        const list = document.getElementById('radio-list');
        // Selecting a row checks its radio (and unchecks the others).
        list.addEventListener('mdSelect', (e) => {
          const items = list.querySelectorAll('md-list-item');
          items.forEach((item) => {
            const radio = item.querySelector('md-radio');
            if (radio) radio.checked = item === e.detail.item;
          });
        });
        // Clicking the radio itself selects its row.
        list.querySelectorAll('md-radio').forEach((radio) => {
          radio.addEventListener('mdChange', () => {
            radio.closest('md-list-item')?.click();
          });
        });
      }
    </script>
  `,
};

export const ProgrammaticControl: Story = {
  render: () => html`
    <div style="font-family: Roboto, sans-serif;">
      <div role="radiogroup" aria-label="Programmatic demo" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <md-radio name="prog" value="first" id="prog-first" aria-label="First" checked></md-radio> First
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <md-radio name="prog" value="second" id="prog-second" aria-label="Second"></md-radio> Second
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <md-radio name="prog" value="third" id="prog-third" aria-label="Third"></md-radio> Third
        </label>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button
          style="padding: 8px 16px; border-radius: 20px; border: 1px solid var(--md-sys-color-outline); background: transparent; cursor: pointer; font-family: inherit;"
          onclick="document.getElementById('prog-second').select()"
        >
          select() → Second
        </button>
        <button
          style="padding: 8px 16px; border-radius: 20px; border: 1px solid var(--md-sys-color-outline); background: transparent; cursor: pointer; font-family: inherit;"
          onclick="document.getElementById('prog-third').select()"
        >
          select() → Third
        </button>
        <button
          style="padding: 8px 16px; border-radius: 20px; border: 1px solid var(--md-sys-color-outline); background: transparent; cursor: pointer; font-family: inherit;"
          onclick="document.getElementById('prog-first').setFocus()"
        >
          setFocus() → First
        </button>
      </div>
    </div>
  `,
  /** Programmatic selection: the public `select()` method drives an exclusive swap
   *  AND emits mdChange like a user gesture, whereas setting the `checked` property
   *  directly drives the same group swap but stays silent (no event). */
  play: async ({ canvasElement, step }) => {
    const group = canvasElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = await getRadios(canvasElement, 'prog');
    const byValue = (v: string) => radios.find((r) => r.getAttribute('value') === v)!;

    await step('First is selected on mount', async () => {
      await waitFor(() => expect(byValue('first').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['first']);
    });

    await step('select() on Second swaps the selection and emits mdChange', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      await byValue('second').select();

      await waitFor(() => {
        expect(byValue('second').getAttribute('aria-checked')).toBe('true');
        expect(byValue('first').getAttribute('aria-checked')).toBe('false');
      });
      expect(checkedValues(radios)).toEqual(['second']); // exclusive
      expect(detail?.value).toBe('second'); // method emitted like a real interaction
    });

    await step('Setting .checked directly drives selection but emits nothing (guard)', async () => {
      let emitted = false;
      group.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      byValue('third').checked = true; // property assignment, not a user gesture

      await waitFor(() => {
        expect(byValue('third').getAttribute('aria-checked')).toBe('true');
        expect(byValue('second').getAttribute('aria-checked')).toBe('false'); // group swap via watcher
      });
      expect(checkedValues(radios)).toEqual(['third']); // still exactly one
      expect(emitted).toBe(false); // a bare property set is not user interaction → no mdChange
    });

    await step('setFocus() moves focus AND renders the programmatic focus ring', async () => {
      let focusedFired = false;
      byValue('first').addEventListener('mdFocus', () => { focusedFired = true; }, { once: true });

      await byValue('first').setFocus(); // script focus: flags programmaticFocus then el.focus()

      await waitFor(() => expect(document.activeElement).toBe(byValue('first')));
      expect(focusedFired).toBe(true); // handleFocus emitted mdFocus
      await waitFor(() => expect(byValue('first').classList.contains('md-radio--focus-ring')).toBe(true)); // ring shown for script focus (flush after render)
    });

    await step('setBlur() removes focus, emits mdBlur, and clears the focus ring', async () => {
      let blurredFired = false;
      byValue('first').addEventListener('mdBlur', () => { blurredFired = true; }, { once: true });

      await byValue('first').setBlur();

      await waitFor(() => expect(document.activeElement).not.toBe(byValue('first')));
      expect(blurredFired).toBe(true); // handleBlur emitted mdBlur
      await waitFor(() => expect(byValue('first').classList.contains('md-radio--focus-ring')).toBe(false)); // ring cleared on blur (flush after render)
    });

    await step('select() on the already-checked radio is a guarded no-op (no event)', async () => {
      let emitted = false;
      group.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      await byValue('third').select(); // third is already checked → early return before emit

      await waitFor(() => expect(byValue('third').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['third']); // unchanged
      expect(emitted).toBe(false); // guard short-circuited: no redundant mdChange
    });

    await step('Disabling the checked radio flips its roving tabindex 0→-1 via the watcher', async () => {
      const target = byValue('third');
      await waitFor(() => expect(target.getAttribute('tabindex')).toBe('0')); // checked → focusable member

      target.disabled = true; // triggers @Watch('disabled') → updateRovingTabIndex()

      await waitFor(() => {
        expect(target.getAttribute('tabindex')).toBe('-1'); // disabled → removed from tab order
        expect(target.getAttribute('aria-disabled')).toBe('true'); // re-rendered as disabled
      });
      expect(target.getAttribute('aria-checked')).toBe('true'); // still selected, just no longer tabbable
    });
  },
};

export const Required: Story = {
  render: () => html`
    <div role="radiogroup" aria-label="Required choice" aria-required="true" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="req" value="yes" required aria-label="Yes"></md-radio> Yes
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="req" value="no" required aria-label="No"></md-radio> No
      </label>
    </div>
  `,
  /** A required radio group: each radio reflects `required` as aria-required (render
   *  ternary), and with nothing checked on mount the FIRST enabled radio holds the
   *  roving tabindex while the rest sit at -1. */
  play: async ({ canvasElement, step }) => {
    const group = canvasElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = await getRadios(canvasElement, 'req');
    const byValue = (v: string) => radios.find((r) => r.getAttribute('value') === v)!;

    await step('required reflects onto each radio as aria-required="true"', async () => {
      await waitFor(() => {
        expect(byValue('yes').getAttribute('aria-required')).toBe('true'); // render: this.required ? 'true'
        expect(byValue('no').getAttribute('aria-required')).toBe('true');
      });
    });

    await step('With nothing checked, the first enabled radio holds the roving tabindex', async () => {
      await waitFor(() => {
        expect(byValue('yes').getAttribute('tabindex')).toBe('0'); // firstEnabled === self → 0
        expect(byValue('no').getAttribute('tabindex')).toBe('-1'); // not the first enabled → -1
      });
    });

    await step('Clicking a required radio selects it exclusively and emits its value', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      byValue('no').click();

      await waitFor(() => expect(byValue('no').getAttribute('aria-checked')).toBe('true'));
      expect(checkedValues(radios)).toEqual(['no']); // exactly one selected
      expect(detail?.value).toBe('no'); // emitted the group value

      // The newly-selected radio now owns the roving tabindex (checked → 0).
      // updateRovingTabIndex only re-runs for the radio whose own checked/disabled
      // changes (@Watch), so the previously first-enabled sibling is NOT re-evaluated
      // on this click and keeps its mount-time tabindex 0.
      await waitFor(() => {
        expect(byValue('no').getAttribute('tabindex')).toBe('0'); // checked → focusable member
        expect(byValue('yes').getAttribute('tabindex')).toBe('0'); // not re-evaluated on sibling click → stays 0
      });
    });
  },
};

export const OptionalValue: Story = {
  render: () => html`
    <div role="radiogroup" aria-label="Optional value" style="display: flex; flex-direction: column; gap: 4px;">
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="ov" value="first" aria-label="First" checked></md-radio> First
      </label>
      <label style="display: flex; align-items: center; gap: 8px; font-family: Roboto, sans-serif; cursor: pointer;">
        <md-radio name="ov" aria-label="No value assigned"></md-radio> No value
      </label>
    </div>
  `,
  /** A radio with no `value` attribute: arrow-selecting it still transfers selection
   *  and emits mdChange, but the detail value falls back to '' (getAttribute('value') || ''). */
  play: async ({ canvasElement, step }) => {
    const group = canvasElement.querySelector('[role="radiogroup"]') as HTMLElement;
    const radios = await getRadios(canvasElement, 'ov');

    await step('Arrowing onto a valueless radio emits mdChange with an empty-string value', async () => {
      let detail: { checked: boolean; value: string } | undefined;
      group.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      key(radios[0], 'ArrowDown'); // focusSibling(1) targets the second, valueless radio

      await waitFor(() => expect(radios[1].getAttribute('aria-checked')).toBe('true')); // it got selected
      expect(radios[0].getAttribute('aria-checked')).toBe('false'); // and the first was deselected
      expect(detail?.value).toBe(''); // value fallback for a radio with no `value` attribute
    });
  },
};

import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type PickerEl = HTMLElement & { value: string; format: string };
const getPicker = async (
  root: HTMLElement,
  selector = 'md-color-picker',
): Promise<PickerEl> => {
  const el = root.querySelector(selector) as PickerEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};
const part = (el: PickerEl, name: string) =>
  el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;
/** Text of the R/G/B (or H/S/L) numeric-channel labels — the representation
 *  that swaps when `format` changes. Excludes the always-hex field. */
const channelLabels = (el: PickerEl) =>
  [...el.shadowRoot!.querySelectorAll('[part="inputs"] label')].map((l) =>
    l.textContent?.trim(),
  );
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }),
  );

const meta: Meta = {
  title: 'Selection/Color Picker',
  component: 'md-color-picker',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    variant: { control: 'select', options: ['inline', 'popover'] },
    format: { control: 'select', options: ['hex', 'rgb', 'hsl'] },
    // Plain text control on purpose: Storybook's `control: 'color'` swatch is a
    // separately code-split module that the autodocs page imports lazily. With the
    // Vite builder that late import races dep pre-bundling and 404s a stale
    // optimized chunk ("Failed to fetch dynamically imported module: …/Color-*.js").
    // A text field for the hex/rgb/hsl string avoids that import and suits a
    // component that already renders its own colour UI.
    value: { control: 'text' },
    alpha: { control: 'boolean' },
    'show-hex': { control: 'boolean' },
    'show-inputs': { control: 'boolean' },
    disabled: { control: 'boolean' },
    'dismiss-on-outside-click': { control: 'boolean' },
    presets: {
      control: 'text',
      description:
        'Swatch presets. Comma-separated as an attribute, or an array as a property.',
    },
  },
  args: {
    variant: 'inline',
    format: 'hex',
    value: '#6750A4',
    alpha: false,
    'show-hex': true,
    'show-inputs': true,
    disabled: false,
    presets: '',
  },
};
export default meta;
type Story = StoryObj;

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px;';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <md-color-picker
      variant=${args.variant}
      format=${args.format}
      value=${args.value}
      ?alpha=${args.alpha}
      ?disabled=${args.disabled}
      .showHex=${args['show-hex']}
      .showInputs=${args['show-inputs']}
      presets=${args.presets}
    ></md-color-picker>
  `,
};

/* ─── Inline (default) ────────────────────────────────────── */
export const Inline: Story = {
  render: () => html`
    <md-color-picker value="#6750A4"></md-color-picker>
  `,
  /** The hue slider is a real APG slider: Home/End/arrows move it, each
   *  committed move reflects a new `value` and emits `mdChange`. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const hue = () => part(el, 'hue');

    await step('Home on the hue slider jumps to 0 and commits a new colour', async () => {
      const beforeValue = el.getAttribute('value');            // '#6750A4' as seeded
      const beforeHue = hue().getAttribute('aria-valuenow');   // '256' for this colour
      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      key(hue(), 'Home'); // hue → 0 (a red) — a guaranteed colour change

      // The slider physically moved to its minimum…
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('0'));
      expect(hue().getAttribute('aria-valuenow')).not.toBe(beforeHue);
      // …the component committed a genuinely new hex via mdChange…
      expect(committed).toBeTruthy();
      expect(committed!.value).toMatch(/^#[0-9a-f]{6}$/i);
      expect(committed!.value).not.toBe(beforeValue);
      // …and the reflected `value` attribute caught up on the next flush.
      await waitFor(() => expect(el.getAttribute('value')).toBe(committed!.value));
    });

    await step('An unhandled key on the slider is ignored (no phantom commit)', async () => {
      const settled = el.getAttribute('value'); // the colour committed above
      let fired = false;
      el.addEventListener('mdChange', () => { fired = true; }, { once: true });

      key(hue(), 'ArrowUp'); // ArrowUp is not part of the hue slider's key model
      await new Promise((r) => setTimeout(r, 50));

      expect(fired).toBe(false);
      expect(hue().getAttribute('aria-valuenow')).toBe('0'); // unmoved
      expect(el.getAttribute('value')).toBe(settled);        // value untouched
    });

    await step('Home/End/Page/Arrow keys on the saturation plate each commit a colour', async () => {
      const plate = () => part(el, 'plate');
      const before = el.getAttribute('value');

      let firstCommit: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { firstCommit = (e as CustomEvent).detail; },
        { once: true },
      );
      key(plate(), 'End'); // saturation → 100 — a guaranteed change from the seed
      expect(firstCommit).toBeTruthy();
      expect(firstCommit!.value).toMatch(/^#[0-9a-f]{6}$/i);
      await waitFor(() => expect(el.getAttribute('value')).toBe(firstCommit!.value));
      expect(el.getAttribute('value')).not.toBe(before);

      // Every handled key runs emit(true), so each commits an mdChange.
      let changes = 0;
      const bump = () => { changes += 1; };
      el.addEventListener('mdChange', bump);
      (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home'] as const)
        .forEach((k) => key(plate(), k));
      await waitFor(() => expect(changes).toBeGreaterThanOrEqual(7));
      el.removeEventListener('mdChange', bump);

      // An unhandled key on the plate neither moves the colour nor commits.
      // The burst of synchronous plate commits above lands its final colour on
      // the `value` prop first; let it reflect to the attribute before snapshotting,
      // otherwise settledPlate captures the stale pre-flush attribute and the
      // post-Tab compare below races the reflection.
      await waitFor(() => expect(el.getAttribute('value')).toBe(el.value));
      const settledPlate = el.getAttribute('value');
      let stray = false;
      el.addEventListener('mdChange', () => { stray = true; }, { once: true });
      key(plate(), 'Tab');
      await new Promise((r) => setTimeout(r, 40));
      expect(stray).toBe(false);
      expect(el.getAttribute('value')).toBe(settledPlate);
    });

    await step('Arrow and End keys drive the hue slider, wrapping across 0/360', async () => {
      // The earlier steps parked the hue at 0; ArrowLeft wraps below 0 to 359.
      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      key(hue(), 'ArrowLeft'); // h: 0 → -1 → wraps to 359
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('359'));
      expect(committed).toBeTruthy();

      key(hue(), 'End'); // h → 360 → wraps back to 0
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('0'));

      key(hue(), 'ArrowRight'); // h: 0 → 1
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('1'));
    });

    await step('Editing an R/G/B channel input commits a new colour', async () => {
      const rInput = part(el, 'field-r').querySelector('input') as HTMLInputElement;
      const before = el.getAttribute('value');

      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      rInput.value = '10';
      rInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      expect(committed).toBeTruthy();
      expect(committed!.value).toMatch(/^#[0-9a-f]{6}$/i);
      await waitFor(() => expect(el.getAttribute('value')).toBe(committed!.value));
      expect(el.getAttribute('value')).not.toBe(before);
    });

    await step('The hex field parses live input, commits on blur, and rejects garbage', async () => {
      const hexField = part(el, 'field-hex').querySelector('input') as HTMLInputElement;

      // A valid hex updates the live value via mdInput.
      let live: { value: string } | undefined;
      el.addEventListener(
        'mdInput',
        (e) => { live = (e as CustomEvent).detail; },
        { once: true },
      );
      hexField.value = '#00ff00';
      hexField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await waitFor(() => expect(live).toBeTruthy());
      await waitFor(() => expect(el.getAttribute('value')?.toLowerCase()).toBe('#00ff00'));

      // Enter runs the field's commit shortcut (its handler calls blur()).
      hexField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

      // A blur commits the current colour via mdChange.
      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      hexField.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      await waitFor(() => expect(committed).toBeTruthy());

      // Garbage marks the field aria-invalid…
      hexField.value = 'zzz';
      hexField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await waitFor(() => expect(hexField.getAttribute('aria-invalid')).toBe('true'));
      // …and blurring snaps back to the last good colour, clearing the flag.
      hexField.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      await waitFor(() => expect(hexField.getAttribute('aria-invalid')).toBeNull());
    });

    await step('An external value assignment re-parses into the internal colour', async () => {
      const hexField = part(el, 'field-hex').querySelector('input') as HTMLInputElement;

      // A brand-new colour set from outside flows through @Watch('value') → applyValue.
      el.value = '#123456';
      await waitFor(() => expect(hexField.value.toLowerCase()).toBe('#123456'));
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('210')); // #123456 hue

      // An unparseable external value marks the hex field invalid, leaving the colour intact.
      el.value = 'definitely-not-a-color';
      await waitFor(() => expect(hexField.getAttribute('aria-invalid')).toBe('true'));
      expect(hexField.value.toLowerCase()).toBe('#123456');
    });

    // Reset to the fresh-render visual state. The steps above moved the hue,
    // rewrote the colour through several channels, and left the hex field
    // invalid on a garbage external value — none of which matches a clean
    // render. Re-seeding `value` flows through @Watch('value') → applyValue,
    // which re-parses the original colour and clears hexInvalid.
    await step('Reset to the seeded colour (no moved slider / invalid field / focus ring)', async () => {
      const hexField = part(el, 'field-hex').querySelector('input') as HTMLInputElement;
      el.value = '#6750A4';
      await waitFor(() => expect(el.getAttribute('value')).toBe('#6750A4'));
      await waitFor(() => expect(hue().getAttribute('aria-valuenow')).toBe('256')); // seeded hue
      await waitFor(() => expect(hexField.getAttribute('aria-invalid')).toBeNull());
      await waitFor(() => expect(hexField.value.toLowerCase()).toBe('#6750a4'));
      (document.activeElement as HTMLElement)?.blur();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/* ─── Popover ─────────────────────────────────────────────── */
export const Popover: Story = {
  render: () => html`
    <div style="height: 360px;">
      <md-color-picker
        variant="popover"
        value="#FF5722"
        dismiss-on-outside-click
      >
        <md-button slot="trigger" variant="tonal">Pick a colour</md-button>
      </md-color-picker>
    </div>
  `,
  /** The popover trigger toggles a `role="dialog"` surface; because this story
   *  opts into `dismiss-on-outside-click`, a mousedown outside the picker closes
   *  it again (there is no pick-to-close — a preset click never dismisses). */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const trigger = () => el.querySelector('[slot="trigger"]') as HTMLElement; // the consumer's own button
    const surface = () => el.shadowRoot!.querySelector('[part="popover"]');

    await step('Clicking the trigger mounts the popover dialog surface', async () => {
      // Closed to start: no dialog surface, host not --open, trigger collapsed.
      expect(surface()).toBeNull();
      expect(el.hasAttribute('open')).toBe(false);
      await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'));
      // A trigger click is a silent no-op until the md-button hydrates — gate on it.
      await waitFor(() => expect(trigger().classList.contains('hydrated')).toBe(true));

      let opened: { open: boolean } | undefined;
      el.addEventListener(
        'mdOpenChange',
        (e) => { opened = (e as CustomEvent).detail; },
        { once: true },
      );

      trigger().click();

      // The dialog surface mounts, the host reflects `open`, expanded flips true…
      await waitFor(() => expect(surface()).not.toBeNull());
      expect(surface()!.getAttribute('role')).toBe('dialog');
      await waitFor(() => expect(el.hasAttribute('open')).toBe(true));
      expect(el.classList.contains('md-color-picker--open')).toBe(true);
      await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('true'));
      // …and the component announced the transition via mdOpenChange.
      expect(opened).toEqual({ open: true });
    });

    await step('A mousedown outside the picker dismisses it', async () => {
      // The outside-click listener attaches on rAF after opening — let it land.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 50));

      let closed: { open: boolean } | undefined;
      el.addEventListener(
        'mdOpenChange',
        (e) => { closed = (e as CustomEvent).detail; },
        { once: true },
      );

      // Mousedown on the document body — outside the picker's composed path.
      el.ownerDocument.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      // The surface unmounts, `open` clears, expanded flips back, event fires false.
      await waitFor(() => expect(el.hasAttribute('open')).toBe(false));
      await waitFor(() => expect(surface()).toBeNull());
      await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'));
      expect(closed).toEqual({ open: false });

      // Let the trigger's ripple / state-layer transitions settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── With Alpha ──────────────────────────────────────────── */
export const WithAlpha: Story = {
  render: () => html`
    <md-color-picker value="rgba(103, 80, 164, 0.6)" alpha></md-color-picker>
  `,
  /** With `alpha`, an opacity slider and an A field appear; both drive the
   *  alpha channel through the same commit path as the colour sliders. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const alpha = () => part(el, 'alpha');

    await step('Home/End/Arrow keys move the opacity slider and commit', async () => {
      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      key(alpha(), 'Home'); // opacity → 0
      await waitFor(() => expect(alpha().getAttribute('aria-valuenow')).toBe('0'));
      expect(committed).toBeTruthy();

      key(alpha(), 'End'); // opacity → 1
      await waitFor(() => expect(alpha().getAttribute('aria-valuenow')).toBe('1'));

      key(alpha(), 'ArrowLeft'); // 1 → 0.99
      await waitFor(() => expect(alpha().getAttribute('aria-valuenow')).toBe('0.99'));

      key(alpha(), 'ArrowRight'); // 0.99 → 1
      await waitFor(() => expect(alpha().getAttribute('aria-valuenow')).toBe('1'));
    });

    await step('Editing the A number field commits a new opacity', async () => {
      const aField = part(el, 'field-a').querySelector('input') as HTMLInputElement;

      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      aField.value = '0.3';
      aField.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      expect(committed).toBeTruthy();
      await waitFor(() => expect(alpha().getAttribute('aria-valuenow')).toBe('0.3'));
    });
  },
};

/* ─── Formats ─────────────────────────────────────────────── */
export const Formats: Story = {
  render: () => html`
    <div style="display: grid; gap: 32px; grid-template-columns: 1fr 1fr 1fr;">
      <div>
        <div style="${labelStyle}">Hex (default)</div>
        <md-color-picker format="hex" value="#6750A4"></md-color-picker>
      </div>
      <div>
        <div style="${labelStyle}">RGB</div>
        <md-color-picker format="rgb" value="rgb(103, 80, 164)"></md-color-picker>
      </div>
      <div>
        <div style="${labelStyle}">HSL</div>
        <md-color-picker format="hsl" value="hsl(259, 35%, 48%)"></md-color-picker>
      </div>
    </div>
  `,
  /** `format` is a view concern: flipping it re-labels the same underlying
   *  colour without mutating `value`. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement, 'md-color-picker[format="hex"]');
    const preview = () => part(el, 'preview');

    let hexLabel = '';
    await step('Hex format shows a hex value with R/G/B channel inputs', async () => {
      hexLabel = preview().getAttribute('aria-label') ?? '';
      expect(hexLabel).toMatch(/#6750a4/i);              // hex representation
      expect(channelLabels(el)).toEqual(['R', 'G', 'B']);
    });

    await step('Switching to HSL re-labels the SAME colour as HSL', async () => {
      const seededValue = el.getAttribute('value'); // '#6750A4' — the actual colour

      el.format = 'hsl';

      // The displayed representation flips: preview label hex → hsl(...)…
      await waitFor(() => expect(preview().getAttribute('aria-label')).toMatch(/hsl\(/i));
      expect(preview().getAttribute('aria-label')).not.toBe(hexLabel);
      // …and the numeric channel inputs relabel R/G/B → H/S/L…
      await waitFor(() => expect(channelLabels(el)).toEqual(['H', 'S', 'L']));
      // …while the underlying colour is untouched (format never rewrites value).
      expect(el.getAttribute('value')).toBe(seededValue);
    });

    await step('Editing an HSL channel input recolours through mdChange', async () => {
      // `format` is now 'hsl', so the numeric inputs are H/S/L.
      const hField = part(el, 'field-h').querySelector('input') as HTMLInputElement;
      const before = el.getAttribute('value');

      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      hField.value = '120'; // rotate the hue toward green
      hField.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      expect(committed).toBeTruthy();
      await waitFor(() => expect(el.getAttribute('value')).not.toBe(before));
      // The committed value is now expressed in the active HSL format.
      await waitFor(() => expect(el.getAttribute('value')).toMatch(/hsl\(/i));
    });

    // Reset to the fresh-render visual state. The steps above flipped this first
    // picker's `format` to HSL and recoloured it through an H channel edit, so
    // its labels read H/S/L and its swatch is a different hue than a clean
    // render. Re-seed the original colour (re-parsed via @Watch('value')) and
    // restore the default hex format so the R/G/B labels and hex preview return.
    await step('Reset the first picker to hex format on the seeded colour', async () => {
      el.value = '#6750A4';
      el.format = 'hex';
      await waitFor(() => expect(el.getAttribute('value')).toBe('#6750A4'));
      await waitFor(() => expect(channelLabels(el)).toEqual(['R', 'G', 'B']));
      await waitFor(() => expect(preview().getAttribute('aria-label')).toMatch(/#6750a4/i));
      (document.activeElement as HTMLElement)?.blur();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/* ─── Presets ─────────────────────────────────────────────── */
export const WithPresets: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`presets` takes either form — the comma-separated attribute (first) or ' +
          'an array property (second) — so it behaves like every other list-valued ' +
          'prop rather than being the one exception. Whitespace and empty entries ' +
          'are ignored either way.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:32px; flex-wrap:wrap; align-items:flex-start;">
      <md-color-picker
        value="#4CAF50"
        presets="#000000,#FFFFFF,#F44336,#FF9800,#FFEB3B,#4CAF50,#2196F3,#9C27B0,#795548,#607D8B"
      ></md-color-picker>
      <md-color-picker
        value="#4CAF50"
        .presets=${[
          '#000000',
          '#FFFFFF',
          '#F44336',
          '#FF9800',
          '#FFEB3B',
          '#4CAF50',
          '#2196F3',
          '#9C27B0',
          '#795548',
          '#607D8B',
        ]}
      ></md-color-picker>
    </div>
  `,
  /** Each preset is an `role="option"` swatch; clicking one commits that colour
   *  (emitting `mdChange`) and moves the lone `aria-selected` marker onto it. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const presets = () =>
      [...el.shadowRoot!.querySelectorAll('[part="preset"]')] as HTMLButtonElement[];
    const presetByLabel = (label: string) =>
      presets().find((p) => p.getAttribute('aria-label') === label)!;
    const selectedCount = () =>
      el.shadowRoot!.querySelectorAll('[part="preset"][aria-selected="true"]').length;

    await step('Clicking a preset swatch commits that colour and emits mdChange', async () => {
      const beforeValue = el.getAttribute('value');            // '#4CAF50' as seeded
      const red = presetByLabel('#F44336');
      expect(red.getAttribute('aria-selected')).toBe('false'); // not the seeded colour

      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );

      red.click();

      // mdChange fired carrying a real hex payload distinct from the seeded value…
      expect(committed).toBeTruthy();
      expect(committed!.value).toMatch(/^#[0-9a-f]{6}$/i);
      expect(committed!.value).not.toBe(beforeValue);
      // …the reflected `value` caught up to exactly that payload on the next flush…
      await waitFor(() => expect(el.getAttribute('value')).toBe(committed!.value));
      // …and the clicked swatch became the lone selected option.
      await waitFor(() => expect(red.getAttribute('aria-selected')).toBe('true'));
      expect(selectedCount()).toBe(1);
    });

    await step('Picking a second preset moves the single selection marker', async () => {
      const red = presetByLabel('#F44336');
      const blue = presetByLabel('#2196F3');
      const before = el.getAttribute('value'); // the red hex committed above

      blue.click();

      // Selection is exclusive: blue lights up, the previous red goes dark…
      await waitFor(() => expect(blue.getAttribute('aria-selected')).toBe('true'));
      await waitFor(() => expect(red.getAttribute('aria-selected')).toBe('false'));
      expect(selectedCount()).toBe(1);
      // …and the committed value moved off the red hex onto the new one.
      await waitFor(() => expect(el.getAttribute('value')).not.toBe(before));
    });

    await step('Enter and Space select a preset from the keyboard', async () => {
      const orange = presetByLabel('#FF9800');
      const purple = presetByLabel('#9C27B0');

      let committed: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      key(orange, ' '); // Space activates the focused swatch
      expect(committed).toBeTruthy();
      await waitFor(() => expect(orange.getAttribute('aria-selected')).toBe('true'));
      expect(selectedCount()).toBe(1);

      // Re-activating the already-selected swatch re-commits the SAME value.
      const stable = el.getAttribute('value');
      let recommit: { value: string } | undefined;
      el.addEventListener(
        'mdChange',
        (e) => { recommit = (e as CustomEvent).detail; },
        { once: true },
      );
      key(orange, ' ');
      await waitFor(() => expect(recommit).toBeTruthy());
      expect(recommit!.value).toBe(stable);
      expect(el.getAttribute('value')).toBe(stable);

      // Enter moves the exclusive selection onto a different swatch.
      key(purple, 'Enter');
      await waitFor(() => expect(purple.getAttribute('aria-selected')).toBe('true'));
      await waitFor(() => expect(orange.getAttribute('aria-selected')).toBe('false'));
      expect(selectedCount()).toBe(1);
    });

    // Reset to the fresh-render visual state. The steps above committed several
    // presets, so the swatch and the lone aria-selected marker sit on purple,
    // not the seeded green. Re-seed the original colour (re-parsed via
    // @Watch('value') → applyValue); the selection marker is derived from the
    // current colour, so it moves back onto the '#4CAF50' swatch on its own.
    await step('Reset to the seeded colour with its preset re-selected', async () => {
      const green = presetByLabel('#4CAF50');
      el.value = '#4CAF50';
      await waitFor(() => expect(el.getAttribute('value')).toBe('#4CAF50'));
      await waitFor(() => expect(green.getAttribute('aria-selected')).toBe('true'));
      expect(selectedCount()).toBe(1);
      (document.activeElement as HTMLElement)?.blur();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    await step('The array-property picker renders the same swatch row', async () => {
      const byArray = canvasElement.querySelectorAll('md-color-picker')[1] as HTMLElement;
      await waitFor(() => expect(byArray.classList.contains('hydrated')).toBe(true));
      const swatches = byArray.shadowRoot!.querySelectorAll('[part="preset"]');
      expect(swatches.length).toBe(presets().length);
      expect(swatches[2].getAttribute('aria-label')).toBe('#F44336');
    });
  },
};

/* ─── Material palette popover ────────────────────────────── */
export const MaterialPalettePopover: Story = {
  render: () => html`
    <div style="height: 380px;">
      <md-color-picker
        variant="popover"
        value="#6750A4"
        presets="#6750A4,#625B71,#7D5260,#B3261E,#FF5722,#FF9800,#FFEB3B,#4CAF50,#2196F3,#9C27B0,#795548,#607D8B,#000000,#FFFFFF"
      >
        <md-button slot="trigger" variant="tonal">Material palette</md-button>
      </md-color-picker>
    </div>
  `,
  /** The popover can also be driven programmatically: `show()` / `close()`
   *  toggle the dialog surface, and Escape dismisses an open panel. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement, 'md-color-picker[variant="popover"]');
    const popover = el as PickerEl & { show: () => Promise<void>; close: () => Promise<void> };
    const surface = () => el.shadowRoot!.querySelector('[part="popover"]');

    await step('show() opens the dialog surface and announces mdOpenChange', async () => {
      expect(surface()).toBeNull();
      expect(el.hasAttribute('open')).toBe(false);

      let opened: { open: boolean } | undefined;
      el.addEventListener(
        'mdOpenChange',
        (e) => { opened = (e as CustomEvent).detail; },
        { once: true },
      );

      await popover.show();

      await waitFor(() => expect(el.hasAttribute('open')).toBe(true));
      await waitFor(() => expect(surface()).not.toBeNull());
      expect(surface()!.getAttribute('role')).toBe('dialog');
      expect(opened).toEqual({ open: true });
    });

    await step('Escape closes the open popover', async () => {
      let closed: { open: boolean } | undefined;
      el.addEventListener(
        'mdOpenChange',
        (e) => { closed = (e as CustomEvent).detail; },
        { once: true },
      );

      key(el.ownerDocument.body, 'Escape'); // handled by the window-level keydown listener

      await waitFor(() => expect(el.hasAttribute('open')).toBe(false));
      await waitFor(() => expect(surface()).toBeNull());
      expect(closed).toEqual({ open: false });
    });

    await step('close() on an already-closed popover is a no-op; show() reopens', async () => {
      await popover.close(); // already closed — stays closed, no surface mounts
      expect(el.hasAttribute('open')).toBe(false);
      expect(surface()).toBeNull();

      await popover.show();
      await waitFor(() => expect(el.hasAttribute('open')).toBe(true));
      await waitFor(() => expect(surface()).not.toBeNull());

      await popover.close();
      await waitFor(() => expect(el.hasAttribute('open')).toBe(false));
      await waitFor(() => expect(surface()).toBeNull());
    });
  },
};

/* ─── Compact ─────────────────────────────────────────────── */
export const Compact: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px;">
      <div>
        <div style="${labelStyle}">Hex only</div>
        <md-color-picker .showInputs=${false} value="#2196F3"></md-color-picker>
      </div>
      <div>
        <div style="${labelStyle}">No inputs at all</div>
        <md-color-picker .showHex=${false} .showInputs=${false} value="#FF5722"></md-color-picker>
      </div>
    </div>
  `,
};

/* ─── Disabled ────────────────────────────────────────────── */
export const Disabled: Story = {
  render: () => html`
    <md-color-picker value="#9E9E9E" disabled></md-color-picker>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-color-picker value="#6750A4" alpha></md-color-picker>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: () => html`
    <md-color-picker value="#82B1FF" alpha></md-color-picker>
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .compact-picker {
        --md-color-picker-width: 240px;
        --md-color-picker-plate-height: 120px;
        --md-color-picker-radius: 8px;
        --md-color-picker-thumb-size: 14px;
        --md-color-picker-preset-size: 24px;
      }
    </style>
    <md-color-picker
      class="compact-picker"
      value="#FF5722"
      presets="#000000,#F44336,#FF9800,#FFEB3B,#4CAF50,#2196F3,#9C27B0"
    ></md-color-picker>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    // The demo's widest viewport box is 1024px. Under the default centred
    // layout the canvas shrink-wraps its content, so the shell's and the boxes'
    // `max-inline-size: 100%` are circular and never bind — the story then
    // overflows a narrower canvas, and CENTRING clips both edges, taking the
    // first characters off every heading. 'padded' gives the root a definite
    // width so those percentage caps resolve.
    layout: 'padded',
    docs: {
      description: {
        story:
          'The inline picker fills its parent up to ' +
          '<code>--md-color-picker-width</code> (default 280px). In narrow ' +
          'columns it shrinks with the container; override the token or use ' +
          'the popover variant when horizontal space is scarce. Preset swatches ' +
          'wrap automatically inside the panel.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .cp-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .cp-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .cp-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
        overflow: hidden;
      }
      .cp-resp-live { resize: horizontal; overflow: auto; min-inline-size: 200px; max-inline-size: 100%; inline-size: 400px; }
    </style>

    <div class="cp-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Inline picker at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Same inline picker with presets — panel adapts to the parent width.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="cp-resp-vp__label">${vp.label}</div>
              <div class="cp-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-color-picker
                  value="#6750A4"
                  alpha
                  presets="#F44336,#FF9800,#FFEB3B,#4CAF50,#2196F3,#9C27B0,#795548,#607D8B"
                ></md-color-picker>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Compact override for narrow sidebars</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Use CSS custom properties to shrink the plate and swatches in tight layouts.
        </p>
        <div class="cp-resp-vp" style="inline-size: 280px; max-inline-size: 100%;">
          <md-color-picker
            value="#FF5722"
            style="--md-color-picker-width: 100%; --md-color-picker-plate-height: 120px; --md-color-picker-preset-size: 24px;"
            presets="#000000,#F44336,#FF9800,#4CAF50,#2196F3"
          ></md-color-picker>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Popover in a constrained form column</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Popover variant keeps the trigger compact; the panel floats above overflow.
        </p>
        ${[
          { label: 'XS · 320 px', width: '320px' },
          { label: 'MD · 768 px', width: '768px' },
        ].map(
          (vp) => html`
            <div>
              <div class="cp-resp-vp__label">${vp.label}</div>
              <div class="cp-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%; min-block-size: 200px;">
                <label style="display: flex; flex-direction: column; gap: 4px; font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
                  ${t(globals.locale, 'color-picker.brand-color')}
                  <md-color-picker variant="popover" value="#6750A4" dismiss-on-outside-click>
                    <md-button slot="trigger" variant="tonal">Pick a colour</md-button>
                  </md-color-picker>
                </label>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Drag the bottom-right corner to see the inline panel reflow.
        </p>
        <div class="cp-resp-vp cp-resp-live">
          <md-color-picker
            value="#6750A4"
            presets="#F44336,#FF9800,#FFEB3B,#4CAF50,#2196F3,#9C27B0"
          ></md-color-picker>
        </div>
      </section>
    </div>
  `,
};

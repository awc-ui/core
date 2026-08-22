import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import '@awc-ui/core/define';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SliderEl = HTMLElement & {
  value: number;
  valueStart: number;
  valueEnd: number;
  min: number;
  max: number;
  step: number;
  range: boolean;
  controlled: boolean;
  disabled: boolean;
  variant: 'standard' | 'centered';
  orientation: 'horizontal' | 'vertical';
};
const getSlider = async (canvasElement: HTMLElement): Promise<SliderEl> => {
  const sl = canvasElement.querySelector('md-slider') as SliderEl;
  await waitFor(() => expect(sl.classList.contains('hydrated')).toBe(true));
  return sl;
};
/** The focusable thumb is a native <input type="range"> in the shadow root
 *  (`.md-slider__input--start` when `range`, `.md-slider__input` otherwise). */
const thumbInputOf = (sl: SliderEl) =>
  (sl.shadowRoot!.querySelector('.md-slider__input--start') ??
    sl.shadowRoot!.querySelector('.md-slider__input')) as HTMLInputElement;
/** Native range inputs ignore untrusted KeyboardEvents, so mirror the browser's
 *  keyboard model around the real value change: keydown (mdDragStart) →
 *  stepUp / Home / End + input/change (prop + aria-valuenow sync) → keyup
 *  (mdDragEnd). Assertions then run against real component state. */
const pressKey = (input: HTMLInputElement, k: string) => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
  if (k === 'ArrowRight') input.stepUp();
  else if (k === 'End') input.value = input.max;
  else if (k === 'Home') input.value = input.min;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, composed: true }));
};

const meta: Meta = {
  title: 'Selection/Slider',
  component: 'md-slider',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
A Material Design 3 **Slider** — pick a value, or a range, along a continuum.
Horizontal or vertical, single or two-thumb range, discrete steps with tick
marks, a value bubble, and an optional inset icon that travels with the handle.

**Form-associated.** Give it a \`name\` and its value lands in \`FormData\` on
submit, exactly like a native \`<input type="range">\` — reset restores the
authored value and \`disabled\` drops it from submission. A **range** slider
carries two numbers, so it submits one entry per thumb: both under \`name\`
(read with \`formData.getAll(name)\`), or under \`name-start\` / \`name-end\`.
There is deliberately no constraint validation — the value is always inside
\`[min, max]\`, so bound the choice with those instead of \`required\`.
        `,
      },
      source: { language: 'html' },
    },
  },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    value: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
    range: { control: 'boolean' },
    stops: { control: 'boolean' },
    valueIndicator: { control: 'boolean' },
    insetIcon: { control: 'boolean' },
    icon: { control: 'text' },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    variant: {
      control: 'select',
      options: ['standard', 'centered'],
    },
    valueText: { control: 'text', description: 'aria-valuetext for single slider' },
    sliderAriaLabel: { control: 'text', description: 'aria-label for the slider' },
    ariaLabelStart: { control: 'text', description: 'aria-label for range start thumb' },
    ariaLabelEnd: { control: 'text', description: 'aria-label for range end thumb' },
    controlled: { control: 'boolean', description: 'Controlled mode — slider never mutates its own value' },
    name: {
      control: 'text',
      description:
        'Form field name. With it the slider submits into `FormData`; without one it submits nothing (same as a native input with no name).',
    },
    nameStart: {
      control: 'text',
      name: 'name-start',
      description:
        'Range only — key for the lower thumb. Defaults to `name`, which submits both thumbs under the same key.',
    },
    nameEnd: {
      control: 'text',
      name: 'name-end',
      description: 'Range only — key for the upper thumb. Defaults to `name`.',
    },
  },
  args: {
    min: 0,
    max: 100,
    value: 50,
    step: 1,
    disabled: false,
    range: false,
    stops: false,
    valueIndicator: false,
    insetIcon: false,
    icon: 'music_note',
    orientation: 'horizontal',
    size: 'xs',
    variant: 'standard',
    name: '',
    nameStart: '',
    nameEnd: '',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  args: {
    max: 80,
    step: 20,
    range: true,
    stops: true,
    valueIndicator: true,
    insetIcon: true,
    variant: "standard"
  },

  render: (args) => html`
    <div
      style="padding:32px; width:${args.orientation === 'vertical' ? '120px' : '400px'}; min-height:${args.orientation === 'vertical' ? '280px' : 'auto'};"
    >
      <md-slider
        min="${args.min}"
        max="${args.max}"
        value="${args.value}"
        step="${args.step}"
        size="${args.size}"
        variant="${args.variant}"
        orientation="${args.orientation}"
        ?disabled="${args.disabled}"
        ?range="${args.range}"
        ?stops="${args.stops}"
        ?value-indicator="${args.valueIndicator}"
        ?inset-icon="${args.insetIcon}"
        icon="${args.icon}"
      ></md-slider>
    </div>
  `,

  /** The slider keyboard model, scripted on the (start) thumb: ArrowRight steps
   *  once, End/Home jump to the rails (see the Interactions panel). Works with
   *  the default args (range, min 0 / max 80 / step 20 → valueStart drives). */
  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement);
    const input = thumbInputOf(sl);
    const valueNow = () => (sl.range ? sl.valueStart : sl.value);

    await step('Focus lands on the (start) thumb input inside the shadow root', async () => {
      input.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(input));
    });

    await step('ArrowRight increases the value by exactly one step', async () => {
      const before = valueNow();
      const stepSize = Number(input.step) || 1;
      pressKey(input, 'ArrowRight');
      await waitFor(() => expect(valueNow()).toBe(before + stepSize));
      await waitFor(() =>
        expect(input.getAttribute('aria-valuenow')).toBe(String(before + stepSize)),
      );
    });

    await step('End jumps to max', async () => {
      pressKey(input, 'End');
      await waitFor(() => expect(valueNow()).toBe(sl.max));
      await waitFor(() => expect(input.getAttribute('aria-valuenow')).toBe(String(sl.max)));
    });

    await step('Home returns to min', async () => {
      pressKey(input, 'Home');
      await waitFor(() => expect(valueNow()).toBe(sl.min));
      await waitFor(() => expect(input.getAttribute('aria-valuenow')).toBe(String(sl.min)));
    });
  },
};

export const Sizes: Story = {
  render: () => html`
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
        (s) => html`
          <div>
            <div style="margin-bottom:8px; font:var(--md-sys-typescale-label-medium-font,500 12px/16px Roboto,sans-serif); color:var(--md-sys-color-on-surface-variant,#49454F);">${s.toUpperCase()}</div>
            <md-slider size="${s}" value="40"></md-slider>
          </div>
        `,
      )}
    </div>
  `,
};

export const StandardCenteredRange: Story = {
  render: () => html`
    <div style="padding:24px; display:flex; flex-direction:column; gap:28px; width:400px;">
      <md-slider variant="standard" value="35"></md-slider>
      <md-slider variant="centered" value="70"></md-slider>
      <md-slider range value-start="20" value-end="80"></md-slider>
    </div>
  `,
};

export const Stops: Story = {
  name: 'Stops / Overview',
  render: () => html`
    <div style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Standard — step 10
        </div>
        <md-slider stops step="10" value="40" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Standard — step 25 (fewer stops)
        </div>
        <md-slider stops step="25" value="50" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Standard — step 5 (dense stops)
        </div>
        <md-slider stops step="5" value="35" size="sm"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Centered variant with stops
        </div>
        <md-slider variant="centered" stops step="10" value="70" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Range with stops
        </div>
        <md-slider range stops step="10" value-start="20" value-end="70" value-indicator></md-slider>
      </div>
    </div>
  `,
};

export const StopsSizes: Story = {
  name: 'Stops / Sizes',
  render: () => html`
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
        (s) => html`
          <div>
            <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
              ${s.toUpperCase()} — stops scale with track thickness
            </div>
            <md-slider size="${s}" stops step="20" value="60"></md-slider>
          </div>
        `,
      )}
    </div>
  `,
};

export const StopsVertical: Story = {
  name: 'Stops / Vertical',
  render: () => html`
    <div style="padding:24px; display:flex; gap:48px; align-items:flex-end; min-height:300px;">
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:240px;" stops step="10" value="30"></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">XS</div>
      </div>
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:240px;" stops step="10" value="60" size="sm"></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">SM</div>
      </div>
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:240px;" stops step="10" value="50" size="md"></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">MD</div>
      </div>
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:240px;" stops step="20" value="80" size="lg"></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">LG</div>
      </div>
    </div>
  `,
};

export const StopsCustomColors: Story = {
  name: 'Stops / Custom Tick Colors',
  render: () => html`
    <style>
      md-slider.teal-ticks {
        --md-slider-active-color: #009688;
        --md-slider-thumb-color: #009688;
        --md-slider-inactive-color: #b2dfdb;
        --md-slider-tick-filled-color: #e0f2f1;
        --md-slider-tick-inactive-color: #00695c;
      }
      md-slider.amber-ticks {
        --md-slider-active-color: #ff8f00;
        --md-slider-thumb-color: #ff8f00;
        --md-slider-inactive-color: #ffe082;
        --md-slider-tick-filled-color: #fff8e1;
        --md-slider-tick-inactive-color: #e65100;
      }
    </style>
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Default tick colors
        </div>
        <md-slider stops step="10" value="50" size="sm"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Teal — custom tick-filled + tick-inactive
        </div>
        <md-slider class="teal-ticks" stops step="10" value="50" size="sm"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Amber — custom tick-filled + tick-inactive
        </div>
        <md-slider class="amber-ticks" stops step="10" value="40" size="sm"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Amber — range with stops
        </div>
        <md-slider class="amber-ticks" range stops step="10" value-start="20" value-end="70" size="sm"></md-slider>
      </div>
    </div>
  `,
};

export const ValueIndicator: Story = {
  render: () => html`
    <div style="padding:32px 24px; width:400px;">
      <md-slider value="55" value-indicator></md-slider>
    </div>
  `,
};

export const InsetIcon: Story = {
  render: () => html`
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          XS / SM — icon unavailable
        </div>
        <md-slider size="xs" inset-icon icon="volume_up" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          MD — 24px icon
        </div>
        <md-slider size="md" inset-icon icon="volume_up" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          LG — 24px icon
        </div>
        <md-slider size="lg" inset-icon icon="volume_up" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          XL — 32px icon
        </div>
        <md-slider size="xl" inset-icon icon="volume_up" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          LG — slotted SVG icon
        </div>
        <md-slider size="lg" inset-icon value="40">
          <svg slot="inset-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        </md-slider>
      </div>
    </div>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <div style="padding:24px; display:flex; gap:32px; align-items:flex-end; min-height:280px;">
      <md-slider orientation="vertical" style="--md-slider-track-length:220px;" value="30"></md-slider>
      <md-slider orientation="vertical" style="--md-slider-track-length:220px;" value="70" stops step="10"></md-slider>
    </div>
  `,
};

/**
 * Responsive sizing. A horizontal slider already fills its container's width.
 * A vertical slider with `full-height` fills its container's height instead of
 * the fixed `--md-slider-track-length` (with the track length as a no-collapse
 * floor). **Drag the boxes to resize** and watch each track track its container.
 */
export const Responsive: Story = {
  render: () => html`
    <div style="display:flex; gap:32px; padding:24px; flex-wrap:wrap; align-items:flex-start;">
      <div>
        <div style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">
          horizontal — fills width (drag →)
        </div>
        <!-- A resize box needs overflow!=visible for its handle, which would clip
             the value-indicator tooltip (it sits above the track). Omit it here —
             the demo is about width-fill, not the tooltip. -->
        <div
          style="resize:horizontal; overflow:auto; inline-size:320px; min-inline-size:160px; max-inline-size:100%; padding:16px; border:1px dashed var(--md-sys-color-outline,#79747E); border-radius:12px;"
        >
          <md-slider value="50"></md-slider>
        </div>
      </div>

      <div>
        <div style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">
          vertical + full-height — fills height (drag ↕)
        </div>
        <div
          style="resize:vertical; overflow:auto; block-size:240px; min-block-size:120px; inline-size:72px; padding:16px; border:1px dashed var(--md-sys-color-outline,#79747E); border-radius:12px; display:flex; justify-content:center;"
        >
          <md-slider orientation="vertical" full-height value="40"></md-slider>
        </div>
      </div>
    </div>
  `,
};

export const RTL: Story = {
  name: 'RTL / Overview',
  render: () => html`
    <div dir="rtl" style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Standard — active track grows from the right edge
        </div>
        <md-slider value="40" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Centered — fills from midpoint in RTL
        </div>
        <md-slider variant="centered" value="70" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Range — both thumbs mirror in RTL
        </div>
        <md-slider range value-start="20" value-end="75" value-indicator></md-slider>
      </div>
    </div>
  `,
};

export const RTLStops: Story = {
  name: 'RTL / Stops',
  render: () => html`
    <div dir="rtl" style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Standard with stops — ticks mirror correctly
        </div>
        <md-slider stops step="10" value="40" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Centered with stops
        </div>
        <md-slider variant="centered" stops step="10" value="30" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Range with stops
        </div>
        <md-slider range stops step="10" value-start="20" value-end="60" value-indicator></md-slider>
      </div>
    </div>
  `,
};

export const RTLSizes: Story = {
  name: 'RTL / Sizes',
  render: () => html`
    <div dir="rtl" style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
        (s) => html`
          <div>
            <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">${s.toUpperCase()}</div>
            <md-slider size="${s}" value="40"></md-slider>
          </div>
        `,
      )}
    </div>
  `,
};

export const RTLVertical: Story = {
  name: 'RTL / Vertical',
  render: () => html`
    <div dir="rtl" style="padding:24px; display:flex; gap:48px; align-items:flex-end; min-height:280px;">
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:220px;" value="35" value-indicator></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">Standard</div>
      </div>
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:220px;" variant="centered" value="70" value-indicator></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">Centered</div>
      </div>
      <div style="text-align:center;">
        <md-slider orientation="vertical" style="--md-slider-track-length:220px;" stops step="10" value="60"></md-slider>
        <div style="margin-top:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">Stops</div>
      </div>
    </div>
  `,
};

export const RTLInsetIcon: Story = {
  name: 'RTL / Inset Icon',
  render: () => html`
    <div dir="rtl" style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          MD — inset icon mirrors to right edge in RTL
        </div>
        <md-slider size="md" inset-icon icon="volume_up" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          LG — inset icon, value below midpoint (icon on active)
        </div>
        <md-slider size="lg" inset-icon icon="volume_up" value="20"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          XL — slotted SVG icon in RTL
        </div>
        <md-slider size="xl" inset-icon value="45">
          <svg slot="inset-icon" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        </md-slider>
      </div>
    </div>
  `,
};

export const RTLComparison: Story = {
  name: 'RTL / Side-by-Side Comparison',
  render: () => html`
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:48px; padding:48px 24px 24px; min-width:800px;">
      <div>
        <div style="margin-bottom:16px; font:600 14px/20px system-ui; color:var(--md-sys-color-on-surface, #1C1B1F);">LTR (left-to-right)</div>
        <div style="display:flex; flex-direction:column; gap:36px;">
          <md-slider value="35" value-indicator></md-slider>
          <md-slider range value-start="15" value-end="65" value-indicator></md-slider>
          <md-slider stops step="20" value="60" value-indicator size="sm"></md-slider>
          <md-slider stops step="25" value="50" value-indicator size="md"></md-slider>
          <md-slider variant="centered" value="25" value-indicator></md-slider>
        </div>
        <div style="margin-top:36px; display:flex; gap:24px; justify-content:center;">
          <md-slider orientation="vertical" value="40" value-indicator style="--md-slider-track-length:200px;"></md-slider>
          <md-slider orientation="vertical" stops step="25" value="50" value-indicator size="sm" style="--md-slider-track-length:200px;"></md-slider>
          <md-slider orientation="vertical" range value-start="20" value-end="70" value-indicator style="--md-slider-track-length:200px;"></md-slider>
        </div>
      </div>
      <div dir="rtl">
        <div style="margin-bottom:16px; font:600 14px/20px system-ui; color:var(--md-sys-color-on-surface, #1C1B1F);">RTL (right-to-left)</div>
        <div style="display:flex; flex-direction:column; gap:36px;">
          <md-slider value="35" value-indicator></md-slider>
          <md-slider range value-start="15" value-end="65" value-indicator></md-slider>
          <md-slider stops step="20" value="60" value-indicator size="sm"></md-slider>
          <md-slider stops step="25" value="50" value-indicator size="md"></md-slider>
          <md-slider variant="centered" value="25" value-indicator></md-slider>
        </div>
        <div style="margin-top:36px; display:flex; gap:24px; justify-content:center;">
          <md-slider orientation="vertical" value="40" value-indicator style="--md-slider-track-length:200px;"></md-slider>
          <md-slider orientation="vertical" stops step="25" value="50" value-indicator size="sm" style="--md-slider-track-length:200px;"></md-slider>
          <md-slider orientation="vertical" range value-start="20" value-end="70" value-indicator style="--md-slider-track-length:200px;"></md-slider>
        </div>
      </div>
    </div>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => {
      return html`
        <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); color: var(--md-sys-color-on-surface, #E6E1E5); padding: 32px; border-radius: 16px;">
          ${story()}
        </div>
      `;
    },
  ],
  render: () => html`
    <div style="padding:32px; width:400px;">
      <md-slider value="50" value-indicator></md-slider>
    </div>
  `,
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand {
        --md-slider-active-color: var(--md-sys-color-tertiary);
        --md-slider-thumb-color: var(--md-sys-color-tertiary);
        --md-slider-inactive-color: var(--md-sys-color-tertiary-container);
      }
    </style>
    <div style="padding:24px; width:400px;">
      <md-slider class="brand" value="45"></md-slider>
    </div>
  `,
};

export const CSSParts: Story = {
  render: () => html`
    <style>
      md-slider.parts-demo::part(thumb-knob) {
        box-shadow: 0 0 0 2px var(--md-sys-color-secondary);
      }
      md-slider.parts-demo::part(track-active) {
        filter: brightness(1.08);
      }
    </style>
    <div style="padding:24px; width:400px;">
      <md-slider class="parts-demo" value="35"></md-slider>
    </div>
  `,
};

export const CSSPartsRoundThumb: Story = {
  name: 'CSS Parts / Round Thumb',
  render: () => html`
    <style>
      md-slider.round-thumb {
        --md-slider-thumb-width: 20px;
        --md-slider-thumb-height: 20px;
      }
      md-slider.round-thumb::part(thumb-knob) {
        border-radius: 50%;
        box-shadow: var(--md-sys-elevation-2, 0 1px 3px rgba(0,0,0,.3));
      }
    </style>
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Round thumb with elevation
        </div>
        <md-slider class="round-thumb" value="60"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Round thumb — range
        </div>
        <md-slider class="round-thumb" range value-start="25" value-end="75"></md-slider>
      </div>
    </div>
  `,
};

export const CSSPartsTrackGradient: Story = {
  name: 'CSS Parts / Gradient Track',
  render: () => html`
    <style>
      md-slider.gradient-track::part(track-active) {
        background: linear-gradient(to right, #6200ee, #03dac6);
      }
      md-slider.gradient-track::part(track-inactive) {
        background: linear-gradient(to right, #e0d6f6, #c8f5ef);
        opacity: 0.87;
      }
      md-slider.gradient-track {
        --md-slider-thumb-color: #6200ee;
      }
    </style>
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Gradient active + inactive track
        </div>
        <md-slider class="gradient-track" value="55"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Gradient — large size
        </div>
        <md-slider class="gradient-track" value="55" size="lg"></md-slider>
      </div>
    </div>
  `,
};

export const CSSPartsValueIndicator: Story = {
  name: 'CSS Parts / Value Indicator',
  render: () => html`
    <style>
      md-slider.custom-indicator::part(value-indicator) {
        background-color: var(--md-sys-color-tertiary, #7D5260);
        color: var(--md-sys-color-on-tertiary, #FFFFFF);
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        padding: 8px 16px;
      }
      md-slider.pill-indicator::part(value-indicator) {
        background-color: var(--md-sys-color-primary, #6750A4);
        color: var(--md-sys-color-on-primary, #FFFFFF);
        border-radius: 9999px;
        min-width: 36px;
        min-height: 36px;
        font-size: 11px;
        padding: 6px 12px;
      }
      md-slider.outline-indicator::part(value-indicator) {
        background-color: var(--md-sys-color-surface, #FFFBFE);
        color: var(--md-sys-color-primary, #6750A4);
        border: 2px solid var(--md-sys-color-primary, #6750A4);
        border-radius: 12px;
        font-weight: 600;
      }
    </style>
    <div style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Tertiary rounded indicator
        </div>
        <md-slider class="custom-indicator" value="42" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Compact pill indicator
        </div>
        <md-slider class="pill-indicator" value="68" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Outlined indicator
        </div>
        <md-slider class="outline-indicator" value="30" value-indicator></md-slider>
      </div>
    </div>
  `,
};

export const CSSPartsSurface: Story = {
  name: 'CSS Parts / Surface & Track Combo',
  render: () => html`
    <style>
      md-slider.styled-surface::part(surface) {
        background: var(--md-sys-color-surface-container-low, #F7F2FA);
        border-radius: 16px;
        padding-inline: 12px;
      }
      md-slider.styled-surface::part(track) {
        border-radius: 4px;
      }
      md-slider.styled-surface::part(track-active) {
        border-radius: 4px;
      }
      md-slider.styled-surface::part(track-inactive) {
        border-radius: 4px;
      }
      md-slider.styled-surface {
        --md-slider-active-color: var(--md-sys-color-tertiary, #7D5260);
        --md-slider-thumb-color: var(--md-sys-color-tertiary, #7D5260);
        --md-slider-inactive-color: var(--md-sys-color-tertiary-container, #FFD8E4);
      }

      md-slider.bordered-surface::part(surface) {
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        border-radius: 12px;
        padding-inline: 16px;
        background: transparent;
      }
    </style>
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Contained surface with tertiary color
        </div>
        <md-slider class="styled-surface" value="50" size="sm"></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Bordered surface
        </div>
        <md-slider class="bordered-surface" value="65" size="sm"></md-slider>
      </div>
    </div>
  `,
};

export const CSSPartsFullTheme: Story = {
  name: 'CSS Parts / Full Custom Theme',
  render: () => html`
    <style>
      md-slider.ocean-theme {
        --md-slider-active-color: #0077b6;
        --md-slider-inactive-color: #caf0f8;
        --md-slider-thumb-color: #0077b6;
        --md-slider-thumb-width: 14px;
        --md-slider-thumb-height: 14px;
      }
      md-slider.ocean-theme::part(thumb-knob) {
        border-radius: 50%;
        box-shadow: 0 0 0 3px #90e0ef, 0 2px 8px rgba(0,119,182,.3);
      }
      md-slider.ocean-theme::part(track-active) {
        background: linear-gradient(90deg, #0077b6, #00b4d8);
      }
      md-slider.ocean-theme::part(value-indicator) {
        background: #023e8a;
        color: #caf0f8;
        border-radius: 8px;
        font-weight: 600;
      }

      md-slider.sunset-theme {
        --md-slider-active-color: #e63946;
        --md-slider-inactive-color: #ffddd2;
        --md-slider-thumb-color: #e63946;
        --md-slider-thumb-width: 16px;
        --md-slider-thumb-height: 16px;
      }
      md-slider.sunset-theme::part(thumb-knob) {
        border-radius: 50%;
        background: linear-gradient(135deg, #e63946, #f4a261);
        box-shadow: 0 2px 8px rgba(230,57,70,.4);
      }
      md-slider.sunset-theme::part(track-active) {
        background: linear-gradient(90deg, #e63946, #f4a261);
      }
      md-slider.sunset-theme::part(value-indicator) {
        background: linear-gradient(135deg, #e63946, #f4a261);
        color: white;
        border-radius: 12px;
      }

      md-slider.forest-theme {
        --md-slider-active-color: #2d6a4f;
        --md-slider-inactive-color: #d8f3dc;
        --md-slider-thumb-color: #2d6a4f;
        --md-slider-thumb-width: 12px;
        --md-slider-thumb-height: 12px;
      }
      md-slider.forest-theme::part(thumb-knob) {
        border-radius: 3px;
        box-shadow: 0 1px 4px rgba(45,106,79,.35);
      }
      md-slider.forest-theme::part(track) {
        border-radius: 3px;
      }
    </style>
    <div style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Ocean — gradient track, ring thumb, styled indicator
        </div>
        <md-slider class="ocean-theme" value="60" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Sunset — gradient thumb + track, warm tones
        </div>
        <md-slider class="sunset-theme" value="45" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Forest — squared corners, muted green
        </div>
        <md-slider class="forest-theme" value="70" size="sm"></md-slider>
      </div>
    </div>
  `,
};

export const RangeOverlap: Story = {
  name: 'Range / Thumb Overlap',
  render: () => html`
    <div style="padding:24px; display:flex; flex-direction:column; gap:32px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Thumbs start overlapping — drag in either direction to separate
        </div>
        <md-slider range value-start="50" value-end="50" value-indicator></md-slider>
      </div>
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Thumbs close together — can cross over
        </div>
        <md-slider range value-start="48" value-end="52" value-indicator></md-slider>
      </div>
    </div>
  `,

  /** Guard: with both thumbs overlapping at 50, driving the lower (start) thumb
   *  up carries the upper thumb with it — the lower can never overtake the upper
   *  (the `valueStart <= valueEnd` invariant holds). Targets the first slider. */
  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // first slider: range, start=50, end=50
    const startInput = thumbInputOf(sl); // .md-slider__input--start (lower thumb)

    await step('Focus lands on the range-start (lower) thumb input', async () => {
      expect(sl.range).toBe(true);
      startInput.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(startInput));
    });

    await step('Pushing the lower thumb up carries the upper thumb with it', async () => {
      const beforeStart = sl.valueStart; // 50
      const beforeEnd = sl.valueEnd; // 50
      let committed: { valueStart?: number; valueEnd?: number } | undefined;
      sl.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      pressKey(startInput, 'ArrowRight');
      await waitFor(() => expect(sl.valueStart).not.toBe(beforeStart)); // start MOVED
      expect(sl.valueStart).toBe(beforeStart + 1); // by one step
      expect(sl.valueEnd).toBe(beforeEnd + 1); // upper was carried up, not left behind
      expect(sl.valueStart).toBe(sl.valueEnd); // pinned together — never crossed
      // The committed event payload proves the component emitted the clamped pair.
      expect(committed?.valueStart).toBe(committed?.valueEnd);
    });

    await step('Guard: the lower thumb can never overtake the upper', async () => {
      const end = sl.valueEnd; // 51
      pressKey(startInput, 'ArrowRight'); // try to drive start past end again
      await waitFor(() => expect(sl.valueStart).toBe(end + 1)); // both advanced to 52
      expect(sl.valueStart).toBeLessThanOrEqual(sl.valueEnd); // invariant held
      expect(sl.valueStart).toBe(sl.valueEnd); // still pinned, not crossed
    });
  },
};

export const Accessibility: Story = {
  name: 'Accessibility / ARIA',
  render: () => html`
    <div style="padding:48px 24px 24px; display:flex; flex-direction:column; gap:48px; width:400px;">
      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          <code>aria-label</code> — "Volume level"
        </div>
        <md-slider
          aria-label="Volume level"
          value="65"
          value-indicator
        ></md-slider>
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          <code>aria-valuetext</code> — day of the week (value 3 → "Wednesday")
        </div>
        <md-slider
          aria-label="Day of the week"
          min="1"
          max="7"
          step="1"
          value="3"
          value-text="Wednesday"
          value-indicator
        ></md-slider>
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          <code>aria-valuetext</code> — temperature with unit (value 22 → "22°C")
        </div>
        <md-slider
          aria-label="Temperature"
          min="0"
          max="40"
          value="22"
          value-text="22°C"
          orientation="vertical"
          style="--md-slider-track-length:180px;"
          value-indicator
        ></md-slider>
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Range with per-thumb <code>aria-label</code> and <code>aria-valuetext</code>
        </div>
        <md-slider
          range
          label-start="Minimum price"
          label-end="Maximum price"
          min="0"
          max="500"
          step="10"
          value-start="100"
          value-end="350"
          value-start-text="$100"
          value-end-text="$350"
          value-indicator
        ></md-slider>
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Rating scale — <code>aria-valuetext</code> "7 out of 10, Satisfied"
        </div>
        <md-slider
          aria-label="Satisfaction rating"
          min="1"
          max="10"
          step="1"
          value="7"
          value-text="7 out of 10, Satisfied"
          stops
          value-indicator
          size="sm"
        ></md-slider>
      </div>
    </div>
  `,
};

export const AccessibilityKeyboard: Story = {
  name: 'Accessibility / Keyboard Navigation',
  render: () => html`
    <div style="padding:32px 24px; display:flex; flex-direction:column; gap:36px; width:400px;">
      <div style="font:400 14px/20px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F); background:var(--md-sys-color-surface-container, #F3EDF7); padding:16px; border-radius:12px;">
        <strong>Keyboard controls:</strong><br>
        <code>Tab</code> — focus the thumb<br>
        <code>← →</code> / <code>↑ ↓</code> — adjust by step<br>
        <code>Home</code> / <code>End</code> — jump to min / max<br>
        <code>Page Up</code> / <code>Page Down</code> — adjust by larger step
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Single slider — Tab, then use arrow keys
        </div>
        <md-slider
          aria-label="Brightness"
          value="50"
          step="5"
          stops
          value-indicator
        ></md-slider>
      </div>

      <div>
        <div style="margin-bottom:8px; font:500 12px/16px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F);">
          Range slider — Tab between thumbs
        </div>
        <md-slider
          range
          label-start="Range start"
          label-end="Range end"
          value-start="20"
          value-end="80"
          step="5"
          stops
          value-indicator
        ></md-slider>
      </div>
    </div>
  `,

  /** The single-slider keyboard model, scripted on the first ("Brightness")
   *  slider (step 5): ArrowRight steps up by exactly one step and reflects
   *  aria-valuenow, End jumps to max, Home returns to min — asserting each
   *  transition against real component state and the emitted mdChange payload. */
  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // first slider: single, value=50, step=5
    const input = thumbInputOf(sl); // single slider → .md-slider__input

    await step('Focus lands on the single thumb input inside the shadow root', async () => {
      input.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(input));
    });

    await step('ArrowRight steps the value up by one step and emits mdChange', async () => {
      const before = sl.value; // 50
      const stepSize = Number(input.step) || 1; // 5
      let committed: { value?: number } | undefined;
      sl.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      pressKey(input, 'ArrowRight');
      await waitFor(() => expect(sl.value).toBe(before + stepSize)); // moved by exactly one step
      await waitFor(() =>
        expect(input.getAttribute('aria-valuenow')).toBe(String(before + stepSize)),
      ); // aria-valuenow reflects on the next flush
      expect(committed?.value).toBe(before + stepSize); // component fired, not just mutated
    });

    await step('End jumps to max, then Home returns to min', async () => {
      pressKey(input, 'End');
      await waitFor(() => expect(sl.value).toBe(sl.max));
      await waitFor(() => expect(input.getAttribute('aria-valuenow')).toBe(String(sl.max)));

      pressKey(input, 'Home');
      await waitFor(() => expect(sl.value).toBe(sl.min));
      await waitFor(() => expect(input.getAttribute('aria-valuenow')).toBe(String(sl.min)));
    });
  },
};

export const ControlledMode: Story = {
  name: 'State / Controlled',
  render: () => html`
    <div style="padding:48px 24px 24px; width:500px;">
      <div style="margin-bottom:16px; font:400 14px/20px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F); background:var(--md-sys-color-surface-container, #F3EDF7); padding:16px; border-radius:12px;">
        <strong>Controlled mode</strong> — the slider never mutates its own <code>value</code>.
        The parent listens to <code>mdChange</code> and writes the value back.<br><br>
        Try dragging — the value updates only because the event handler sets it.
        The "Clamp to 20–80" checkbox rejects values outside that range.
      </div>
      <div style="margin:16px 0;">
        <label style="font:400 14px/20px system-ui; display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="clamp-toggle" />
          Clamp to 20–80
        </label>
      </div>
      <md-slider
        id="controlled-demo"
        controlled
        value="50"
        value-indicator
      ></md-slider>
      <div id="controlled-readout" style="margin-top:12px; font:500 14px/20px monospace; color:var(--md-sys-color-primary, #6750A4);">
        value: 50
      </div>
      <script>
        {
          const slider = document.getElementById('controlled-demo');
          const readout = document.getElementById('controlled-readout');
          const clamp = document.getElementById('clamp-toggle');
          slider?.addEventListener('mdChange', (e) => {
            let v = e.detail.value;
            if (clamp?.checked) v = Math.max(20, Math.min(80, v));
            slider.value = v;
            if (readout) readout.textContent = 'value: ' + v;
          });
          slider?.addEventListener('mdInput', (e) => {
            if (readout) readout.textContent = 'value: ' + e.detail.value + ' (dragging)';
          });
        }
      </script>
    </div>
  `,

  /** Controlled semantics, scripted on the controlled single slider (value 50,
   *  step 1): a keyed input emits the user's PROPOSED value via mdChange, yet the
   *  slider never writes it to its own `value` — the visible thumb only moves once
   *  the "parent" assigns `value` back. Asserts the emit + the prop-driven update. */
  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // controlled single, value=50
    const input = thumbInputOf(sl);

    await step('Focus lands on the single thumb input inside the shadow root', async () => {
      expect(sl.controlled).toBe(true);
      input.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(input));
    });

    await step('Keying emits mdChange; the parent writes it back (controlled round-trip)', async () => {
      const before = sl.value;
      let committed: { value?: number } | undefined;
      sl.addEventListener(
        'mdChange',
        (e) => { committed = (e as CustomEvent).detail; },
        { once: true },
      );
      pressKey(thumbInputOf(sl), 'ArrowRight'); // component PROPOSES before+1 via mdChange
      // The component emits the user's proposed value — it never writes `value`
      // itself (setSingle only touches its live buffer in controlled mode)…
      await waitFor(() => expect(committed?.value).toBe(before + 1));
      // …the story's mdChange handler is what assigns `value` back, so the
      // controlled loop lands the new value on the prop and the thumb follows.
      await waitFor(() => expect(sl.value).toBe(before + 1));
      await waitFor(() =>
        expect(thumbInputOf(sl).getAttribute('aria-valuenow')).toBe(String(before + 1)),
      );
    });

    await step('Guard: with clamp enabled, the parent rejects out-of-range proposals', async () => {
      const clamp = canvasElement.querySelector('#clamp-toggle') as HTMLInputElement;
      clamp.click(); // enable "Clamp to 20–80" in the parent handler
      await waitFor(() => expect(clamp.checked).toBe(true));
      sl.value = 80; // parent-assigned, at the top of the allowed range
      await waitFor(() => expect(thumbInputOf(sl).getAttribute('aria-valuenow')).toBe('80'));
      // Key up from 80: the component proposes 81, but the parent clamps it to 80.
      pressKey(thumbInputOf(sl), 'ArrowRight');
      await waitFor(() => expect(sl.value).toBe(80)); // rejected — never exceeds the cap
      expect(Number(thumbInputOf(sl).getAttribute('aria-valuenow'))).toBeLessThanOrEqual(80);
    });
  },
};

export const UncontrolledMode: Story = {
  name: 'State / Uncontrolled (default)',
  render: () => html`
    <div style="padding:48px 24px 24px; width:500px;">
      <div style="margin-bottom:16px; font:400 14px/20px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F); background:var(--md-sys-color-surface-container, #F3EDF7); padding:16px; border-radius:12px;">
        <strong>Uncontrolled mode (default)</strong> — the slider manages its own value.
        Listen to <code>mdChange</code> to observe the committed value.
      </div>
      <md-slider
        id="uncontrolled-demo"
        value="50"
        value-indicator
      ></md-slider>
      <div id="uncontrolled-readout" style="margin-top:12px; font:500 14px/20px monospace; color:var(--md-sys-color-primary, #6750A4);">
        value: 50
      </div>
      <script>
        {
          const slider = document.getElementById('uncontrolled-demo');
          const readout = document.getElementById('uncontrolled-readout');
          slider?.addEventListener('mdChange', (e) => {
            if (readout) readout.textContent = 'value: ' + e.detail.value;
          });
          slider?.addEventListener('mdInput', (e) => {
            if (readout) readout.textContent = 'value: ' + e.detail.value + ' (dragging)';
          });
        }
      </script>
    </div>
  `,
};

export const ControlledRange: Story = {
  name: 'State / Controlled Range',
  render: () => html`
    <div style="padding:48px 24px 24px; width:500px;">
      <div style="margin-bottom:16px; font:400 14px/20px system-ui; color:var(--md-sys-color-on-surface-variant, #49454F); background:var(--md-sys-color-surface-container, #F3EDF7); padding:16px; border-radius:12px;">
        <strong>Controlled range</strong> — the parent writes <code>value-start</code> and <code>value-end</code>
        back on each <code>mdChange</code>. Minimum spread of 10 is enforced.
      </div>
      <md-slider
        id="controlled-range-demo"
        controlled
        range
        value-start="30"
        value-end="70"
        step="5"
        stops
        value-indicator
      ></md-slider>
      <div id="controlled-range-readout" style="margin-top:12px; font:500 14px/20px monospace; color:var(--md-sys-color-primary, #6750A4);">
        start: 30 | end: 70
      </div>
      <script>
        {
          const slider = document.getElementById('controlled-range-demo');
          const readout = document.getElementById('controlled-range-readout');
          slider?.addEventListener('mdChange', (e) => {
            let { valueStart: s, valueEnd: en } = e.detail;
            if (en - s < 10) {
              if (e.detail.value === s) s = en - 10;
              else en = s + 10;
            }
            slider.valueStart = Math.max(0, s);
            slider.valueEnd = Math.min(100, en);
            if (readout) readout.textContent = 'start: ' + slider.valueStart + ' | end: ' + slider.valueEnd;
          });
          slider?.addEventListener('mdInput', (e) => {
            if (readout) readout.textContent = 'start: ' + e.detail.valueStart + ' | end: ' + e.detail.valueEnd + ' (dragging)';
          });
        }
      </script>
    </div>
  `,

  /** Controlled-range semantics (start 30 / end 70, step 5): keying a thumb makes
   *  the component PROPOSE a value via mdChange while writing only its internal live
   *  buffer — it never mutates value-start/value-end itself. The story's parent
   *  handler is what assigns the props back, so each thumb round-trips through the
   *  parent. Exercises the controlled setStart/setEnd + commit paths on both thumbs. */
  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // controlled range, start=30 end=70 step=5
    const startInput = thumbInputOf(sl); // .md-slider__input--start

    await step('Focus lands on the range-start thumb (controlled range)', async () => {
      expect(sl.controlled).toBe(true);
      expect(sl.range).toBe(true);
      startInput.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(startInput));
    });

    await step('Keying start emits mdChange; the parent writes value-start back', async () => {
      const before = sl.valueStart; // 30
      let committed: { valueStart?: number; valueEnd?: number } | undefined;
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      pressKey(startInput, 'ArrowRight'); // 30 -> 35; controlled setStart touches only the live buffer
      // The component emitted the proposed range payload (handleChange range + commit ran)…
      await waitFor(() => expect(committed?.valueStart).toBe(before + 5));
      // …and the parent's mdChange handler assigned value-start back onto the prop.
      await waitFor(() => expect(sl.valueStart).toBe(before + 5));
      await waitFor(() =>
        expect(thumbInputOf(sl).getAttribute('aria-valuenow')).toBe(String(before + 5)),
      );
    });

    await step('Keying end round-trips the upper thumb through the parent as well', async () => {
      const endInput = sl.shadowRoot!.querySelector('.md-slider__input--end') as HTMLInputElement;
      const beforeEnd = sl.valueEnd; // 70
      let committed: { valueStart?: number; valueEnd?: number } | undefined;
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      endInput.focus();
      await waitFor(() => expect(sl.shadowRoot!.activeElement).toBe(endInput));
      pressKey(endInput, 'ArrowRight'); // 70 -> 75; controlled setEnd touches only the live buffer
      await waitFor(() => expect(committed?.valueEnd).toBe(beforeEnd + 5));
      await waitFor(() => expect(sl.valueEnd).toBe(beforeEnd + 5)); // parent wrote value-end back
    });

    // Visual reset: the round-trips above left start=35 / end=75, the end thumb
    // focused, and the parent's readout showing the mutated values. Restore the
    // initial range (30 / 70), blur, and rewrite the readout so the screenshot
    // matches the fresh render.
    await step('Reset to the initial resting state for a clean visual baseline', async () => {
      sl.valueStart = 30;
      sl.valueEnd = 70;
      (sl.shadowRoot!.activeElement as HTMLElement | null)?.blur();
      (document.activeElement as HTMLElement | null)?.blur();
      const readout = canvasElement.querySelector('#controlled-range-readout');
      if (readout) readout.textContent = 'start: 30 | end: 70';
      await waitFor(() => {
        expect(sl.valueStart).toBe(30);
        expect(sl.valueEnd).toBe(70);
        expect(sl.shadowRoot!.activeElement).toBeNull();
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/**
 * Pointer-drag interaction on a horizontal RANGE slider. Synthetic PointerEvents on
 * the shadow-DOM rail exercise the pointer path the keyboard tests never touch:
 * nearest-thumb pickup, live drag, thumb crossover, commit, and lost-pointer-capture.
 */
export const RangePointerDrag: Story = {
  name: 'Range / Pointer Drag',
  render: () => html`
    <div style="padding:32px; width:400px;">
      <md-slider range value-start="20" value-end="80" step="1"></md-slider>
    </div>
  `,

  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // range, min 0 / max 100, start=20 end=80
    const rail = sl.shadowRoot!.querySelector('.md-slider__rail') as HTMLElement;
    await waitFor(() => expect(rail.getBoundingClientRect().width).toBeGreaterThan(0));

    // Dispatch a PointerEvent at the client X that maps (via the rail rect) to `value`.
    const firePointer = (type: string, value: number) => {
      const r = rail.getBoundingClientRect();
      rail.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: r.left + (value / 100) * r.width,
          clientY: r.top + r.height / 2,
          pointerId: 1,
        }),
      );
    };

    await step('Pressing near the start thumb picks it up and drags it to a new value', async () => {
      let dragStart: { thumb?: string } | undefined;
      let committed: { valueStart?: number; valueEnd?: number } | undefined;
      let dragEnd: { thumb?: string } | undefined;
      sl.addEventListener('mdDragStart', (e) => { dragStart = (e as CustomEvent).detail; }, { once: true });
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      sl.addEventListener('mdDragEnd', (e) => { dragEnd = (e as CustomEvent).detail; }, { once: true });

      firePointer('pointerdown', 25); // nearest to start (20), not end (80)
      await waitFor(() => expect(dragStart?.thumb).toBe('start'));
      firePointer('pointermove', 40); // drag the start thumb up to 40
      await waitFor(() => expect(sl.valueStart).toBe(40));
      expect(sl.valueEnd).toBe(80); // end thumb untouched
      firePointer('pointerup', 40);
      await waitFor(() => expect(committed?.valueStart).toBe(40)); // committed on release
      expect(committed?.valueEnd).toBe(80);
      expect(dragEnd?.thumb).toBe('start');
    });

    await step('Dragging the start thumb past the end thumb hands the gesture to the end thumb', async () => {
      let dragEnd: { thumb?: string } | undefined;
      sl.addEventListener('mdDragEnd', (e) => { dragEnd = (e as CustomEvent).detail; }, { once: true });
      firePointer('pointerdown', 40); // pick up start (now at 40)
      firePointer('pointermove', 90); // drive it above the end thumb (80) → crossover
      await waitFor(() => expect(sl.valueEnd).toBe(90)); // the end thumb absorbed the value
      firePointer('pointerup', 90);
      await waitFor(() => expect(dragEnd?.thumb).toBe('end')); // active thumb switched mid-drag
    });

    await step('Losing pointer capture mid-drag commits the in-progress value', async () => {
      let committed: { valueStart?: number } | undefined;
      let dragEnd: { thumb?: string } | undefined;
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      sl.addEventListener('mdDragEnd', (e) => { dragEnd = (e as CustomEvent).detail; }, { once: true });
      firePointer('pointerdown', 60); // pick up nearest thumb, sets start to 60
      await waitFor(() => expect(sl.valueStart).toBe(60));
      // Interrupt the gesture — the browser fires lostpointercapture instead of pointerup.
      rail.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
      await waitFor(() => expect(committed?.valueStart).toBe(60)); // committed via the lost-capture path
      expect(dragEnd?.thumb).toBe('start');
    });
  },
};

/**
 * Pointer-drag interaction on a VERTICAL single slider. Exercises the vertical
 * pointer path (bottom-anchored ratio) plus its lost-pointer-capture branch.
 */
export const VerticalPointerDrag: Story = {
  name: 'Vertical / Pointer Drag',
  render: () => html`
    <div style="padding:24px; min-height:320px; display:flex;">
      <md-slider orientation="vertical" style="--md-slider-track-length:240px;" value="30" step="1"></md-slider>
    </div>
  `,

  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // vertical single, value=30
    const rail = sl.shadowRoot!.querySelector('.md-slider__rail') as HTMLElement;
    await waitFor(() => expect(rail.getBoundingClientRect().height).toBeGreaterThan(0));

    // Vertical: higher value = higher up, so anchor the client Y off the rail bottom.
    const firePointer = (type: string, value: number) => {
      const r = rail.getBoundingClientRect();
      rail.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: r.left + r.width / 2,
          clientY: r.bottom - (value / 100) * r.height,
          pointerId: 1,
        }),
      );
    };

    await step('Pressing and dragging up the vertical rail moves the value toward the top', async () => {
      let dragStart: { thumb?: string; value?: number } | undefined;
      let committed: { value?: number } | undefined;
      let dragEnd: { thumb?: string; value?: number } | undefined;
      sl.addEventListener('mdDragStart', (e) => { dragStart = (e as CustomEvent).detail; }, { once: true });
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      sl.addEventListener('mdDragEnd', (e) => { dragEnd = (e as CustomEvent).detail; }, { once: true });

      firePointer('pointerdown', 60);
      await waitFor(() => expect(dragStart?.thumb).toBe('single'));
      expect(sl.value).toBe(60); // press jumped the value to the pressed position
      firePointer('pointermove', 80); // drag further up
      await waitFor(() => expect(sl.value).toBe(80));
      firePointer('pointerup', 80);
      await waitFor(() => expect(committed?.value).toBe(80)); // committed on release
      expect(dragEnd?.value).toBe(80);
    });

    await step('Losing pointer capture on the vertical rail commits the current value', async () => {
      let committed: { value?: number } | undefined;
      sl.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      firePointer('pointerdown', 20); // begin a fresh gesture at value 20
      await waitFor(() => expect(sl.value).toBe(20));
      rail.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
      await waitFor(() => expect(committed?.value).toBe(20)); // committed via the lost-capture path
    });
  },
};

/**
 * Runtime prop reactions: the min/max and variant/range watchers, re-clamping and
 * re-layout, plus the centered inset-area and the step<=0 formatter branch — all
 * driven by mutating props on a live, hydrated slider.
 */
export const PropReactions: Story = {
  name: 'State / Prop Reactions',
  render: () => html`
    <div style="padding:32px; width:400px;">
      <md-slider value="50" size="md" inset-icon icon="volume_up" value-indicator></md-slider>
    </div>
  `,

  play: async ({ canvasElement, step }) => {
    const sl = await getSlider(canvasElement); // single, value=50, min 0 / max 100

    await step('Raising min above the value re-clamps the value up (min watcher)', async () => {
      sl.min = 60; // onBoundsChange → clampValues pulls value up to the new floor
      await waitFor(() => expect(sl.value).toBe(60));
      await waitFor(() => expect(thumbInputOf(sl).getAttribute('aria-valuemin')).toBe('60'));
    });

    await step('Lowering max below the value re-clamps the value down (max watcher)', async () => {
      sl.min = 0; // restore the floor
      sl.max = 40; // onBoundsChange → clampValues pulls value down to the new ceiling
      await waitFor(() => expect(sl.value).toBe(40));
      await waitFor(() => expect(thumbInputOf(sl).getAttribute('aria-valuemax')).toBe('40'));
    });

    await step('Flipping range on re-renders the slider as dual-thumb (range watcher)', async () => {
      sl.range = true; // onLayoutDeps → syncCssVars + re-render into the range layout
      await waitFor(() =>
        expect(sl.shadowRoot!.querySelector('.md-slider__input--start')).not.toBeNull(),
      );
      await waitFor(() =>
        expect(sl.shadowRoot!.querySelector('.md-slider__input--end')).not.toBeNull(),
      );
      expect(sl.classList.contains('md-slider--range')).toBe(true);
      expect(sl.style.getPropertyValue('--_start-pct')).not.toBe(''); // range CSS vars synced
    });

    await step('Switching to the centered variant re-lays-out and re-renders the inset (variant watcher)', async () => {
      sl.range = false;
      sl.variant = 'centered'; // onLayoutDeps → centered layout; inset-area recomputes on active
      await waitFor(() => expect(sl.classList.contains('md-slider--centered')).toBe(true));
      // Centered + inset-icon on a md size renders the inset element (insetOnActive centered branch).
      await waitFor(() =>
        expect(sl.shadowRoot!.querySelector('.md-slider__inset')).not.toBeNull(),
      );
    });

    await step('A non-positive step formats the indicator as a rounded integer', async () => {
      sl.step = 0; // formatValue falls back to String(Math.round(v))
      await waitFor(() => {
        const indicator = sl.shadowRoot!.querySelector('.md-slider__value-indicator');
        expect(indicator?.textContent?.trim()).toBe('40'); // value is 40 after the max clamp above
      });
    });
  },
};


/* ── Forms ──────────────────────────────────────────────── */

export const Forms: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`md-slider` is form-associated: give it a `name` and its value lands in `FormData` ' +
          'on submit, like a native `<input type="range">`. A **range** slider carries two ' +
          'numbers, so it submits one entry per thumb — both under `name` (read them with ' +
          '`formData.getAll(name)`), or under `name-start` / `name-end`. Reset restores the ' +
          'authored values and `disabled` drops the control from submission. There is no ' +
          'constraint validation by design: the value is always inside `[min, max]`.',
      },
    },
  },
  render: () => html`
    <form id="sb-slider-form" style="display:grid; gap:20px; width:420px; padding:24px; font-family:sans-serif;">
      <md-slider name="volume" value="60" labeled></md-slider>
      <md-slider name="price" range value-start="20" value-end="80" labeled></md-slider>
      <md-slider name="ignored" value="10" disabled></md-slider>
      <div style="display:flex; gap:12px;">
        <md-button type="submit" variant="filled">Submit</md-button>
        <md-button type="reset" variant="outlined">Reset</md-button>
      </div>
      <output id="sb-slider-out" style="font-size:13px; color:#666;"></output>
    </form>
  `,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('#sb-slider-form') as HTMLFormElement;
    const sliders = [...canvasElement.querySelectorAll('md-slider')] as SliderEl[];
    await waitFor(() => expect(sliders.every((s) => s.classList.contains('hydrated'))).toBe(true));

    const entries = () => [...new FormData(form).entries()].map(([k, v]) => `${k}=${v}`);

    // Single thumb submits one entry; range submits two under the same name;
    // the disabled slider contributes nothing.
    await waitFor(() =>
      expect(entries()).toEqual(['volume=60', 'price=20', 'price=80']),
    );
    expect(new FormData(form).getAll('price')).toEqual(['20', '80']);

    // The submitted value tracks the control.
    sliders[0].value = 25;
    await waitFor(() => expect(entries()[0]).toBe('volume=25'));

    // Reset returns to the authored values.
    form.reset();
    await waitFor(() => expect(entries()).toEqual(['volume=60', 'price=20', 'price=80']));
  },
};

import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import { drivingCoverage, exerciseProps } from '../testing/coverage-mode';

const meta: Meta = {
  title: 'Communication/Meter',
  component: 'md-meter',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100 },
      description: 'Current value (clamped into [min, max])',
    },
    min: { control: 'number', description: 'Lower bound of the range' },
    max: { control: 'number', description: 'Upper bound of the range' },
    label: {
      control: 'text',
      description: 'Accessible name; also the visible header label with show-label',
    },
    showLabel: {
      control: 'boolean',
      name: 'show-label',
      description: 'Render the label in a header row above the track',
    },
    showValue: {
      control: 'boolean',
      name: 'show-value',
      description: 'Render the formatted value in the header row',
    },
    valueText: {
      control: 'text',
      name: 'value-text',
      description: 'Overrides the formatted value text (aria-valuetext + visible value)',
    },
    locale: {
      control: 'text',
      description:
        'BCP-47 locale for the Intl-formatted value. Leave empty to follow the toolbar Locale global. (`formatOptions` is a JS-only object prop — see the Formatting story.)',
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info'],
      description: 'Theme colour role for fill + track (any theme-defined role name works)',
    },
    thickness: {
      control: { type: 'range', min: 1, max: 16 },
      description: 'Track thickness in dp (density-scaled, floored at 2px)',
    },
    variant: {
      control: 'inline-radio',
      options: ['linear', 'circular'],
      description:
        'Shape of the reading. `circular` draws a ring, puts the value in its centre and captions it underneath instead of using the header row.',
    },
    size: {
      control: { type: 'range', min: 24, max: 240, step: 4 },
      description: 'Ring diameter in dp — circular only, clamped to 24–240.',
    },
    density: {
      control: 'select',
      options: [0, -1, -2, -3, -4],
      description: 'Local density rung',
    },
  },
  args: {
    value: 65,
    min: 0,
    max: 100,
    label: 'Storage used',
    showLabel: true,
    showValue: true,
    valueText: '',
    locale: '',
    variant: 'linear',
    size: 48,
    color: 'primary',
    thickness: 4,
    density: 0,
  },
};
export default meta;
type Story = StoryObj;

/* ── play() helpers ─────────────────────────────────────────
 * testing-library queries can't cross shadow roots, so play()
 * interactions address the component and its shadowRoot directly.
 * Mirrors the Stencil-hydration gate used across the other stories. */
type MeterEl = HTMLElement & {
  value: number;
  min: number;
  max: number;
  label: string;
  showLabel: boolean;
  showValue: boolean;
  valueText: string;
  locale: string;
  formatOptions?: Intl.NumberFormatOptions;
  color: string;
  thickness: number;
  density: number;
};
const getMeter = async (canvasElement: HTMLElement, selector = 'md-meter'): Promise<MeterEl> => {
  const el = canvasElement.querySelector(selector) as MeterEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};
const fillPct = (el: MeterEl) =>
  (el.shadowRoot?.querySelector('[part="indicator"]') as HTMLElement | null)?.style.getPropertyValue(
    '--_fill-pct',
  );

const ROW = 'display:flex; flex-direction:column; gap:20px; width:320px; padding:24px;';
const CAPTION = 'margin:0; font-size:13px; font-family:sans-serif; color:#666;';

/* ── Playground ─────────────────────────────────────────── */

export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: '<md-meter value="65" label="Storage used" show-label show-value></md-meter>',
      },
    },
  },
  render: (args) => html`
    <div style="width: 320px;">
      <md-meter
        value=${args.value}
        min=${args.min}
        max=${args.max}
        label=${args.label}
        ?show-label=${args.showLabel}
        ?show-value=${args.showValue}
        value-text=${args.valueText || ''}
        .locale=${args.locale || ''}
        color=${args.color}
        thickness=${args.thickness}
        density=${args.density}
      ></md-meter>
    </div>
  `,
  /** The host-level meter ARIA contract plus the fill geometry variable. */
  play: async ({ canvasElement, step }) => {
    const el = await getMeter(canvasElement);

    await step('host carries the full role=meter value contract', async () => {
      expect(el.getAttribute('role')).toBe('meter');
      expect(el.getAttribute('aria-label')).toBe('Storage used');
      expect(el.getAttribute('aria-valuemin')).toBe('0');
      expect(el.getAttribute('aria-valuemax')).toBe('100');
      expect(el.getAttribute('aria-valuenow')).toBe('65');
      expect(el.getAttribute('aria-valuetext')).toBeTruthy();
      expect(fillPct(el)).toBe('65%');
    });

    // Everything below MUTATES the live component, and play() runs on VIEW —
    // gate it so a human opening the story doesn't watch the meter thrash.
    if (drivingCoverage()) {
      await step('value changes re-derive ARIA + fill', async () => {
        el.value = 90;
        await waitFor(() => expect(el.getAttribute('aria-valuenow')).toBe('90'));
        expect(fillPct(el)).toBe('90%');
      });

      await step('out-of-range values clamp', async () => {
        el.value = 150;
        await waitFor(() => expect(el.getAttribute('aria-valuenow')).toBe('100'));
        el.value = -5;
        await waitFor(() => expect(el.getAttribute('aria-valuenow')).toBe('0'));
      });

      await step('formatOptions switches to clamped-value formatting', async () => {
        el.value = 40;
        el.formatOptions = { style: 'unit', unit: 'gigabyte' };
        const expected = new Intl.NumberFormat(undefined, {
          style: 'unit',
          unit: 'gigabyte',
        }).format(40);
        await waitFor(() => expect(el.getAttribute('aria-valuetext')).toBe(expected));
        el.formatOptions = undefined;
      });

      await step('restore + sweep the remaining draw paths', async () => {
        el.value = 65;
        await waitFor(() => expect(el.getAttribute('aria-valuenow')).toBe('65'));
        await exerciseProps(el, [
          ['color', 'success'],
          ['color', 'warning'],
          ['color', 'error'],
          ['color', 'not a valid ident!'],
          ['thickness', 8],
          ['showLabel', false],
          ['showValue', false],
          ['valueText', '65 GB of 100 GB'],
          ['min', 50],
          ['max', 200],
          ['locale', 'de-DE'],
          ['density', -2],
        ]);
      });
    }
  },
};

/* ── Colors ─────────────────────────────────────────────── */

export const Colors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every theme colour role, including the semantic status roles. The default ' +
          "(`primary`) keeps md-progress-indicator's neutral look — primary fill on a " +
          'secondary-container track; every other role paints `role` on `role-container`. ' +
          'Any role a theme defines works (`color="brand"`), not just the seven listed.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      ${['primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info'].map(
        (c) => html`
          <md-meter
            color=${c}
            value="65"
            label="${c} meter"
            show-label
            show-value
          ></md-meter>
        `,
      )}
    </div>
  `,
  play: async ({ canvasElement }) => {
    const success = await getMeter(canvasElement, 'md-meter[color="success"]');
    // The colour role rides two inline custom-property slots (md-chip pattern).
    expect(success.style.getPropertyValue('--_c-main')).toBe(
      'var(--md-sys-color-success, var(--md-sys-color-primary))',
    );
    // The default role sets NO inline slots — neutral CSS defaults apply.
    const primary = await getMeter(canvasElement, 'md-meter[color="primary"]');
    expect(primary.style.getPropertyValue('--_c-main')).toBe('');
  },
};

/* ── Label & value header ───────────────────────────────── */

export const WithLabelAndValue: Story = {
  render: () => html`
    <div style="${ROW}">
      <p style="${CAPTION}">Bare track (label is ARIA-only)</p>
      <md-meter value="40" label="Quota used"></md-meter>

      <p style="${CAPTION}">show-label</p>
      <md-meter value="40" label="Quota used" show-label></md-meter>

      <p style="${CAPTION}">show-value</p>
      <md-meter value="40" label="Quota used" show-value></md-meter>

      <p style="${CAPTION}">show-label + show-value</p>
      <md-meter value="40" label="Quota used" show-label show-value></md-meter>

      <p style="${CAPTION}">value-text override</p>
      <md-meter
        value="3"
        max="10"
        label="Seats taken"
        value-text="3 of 10 seats"
        show-label
        show-value
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const meters = canvasElement.querySelectorAll('md-meter');
    const bare = await getMeter(canvasElement);
    expect(bare.shadowRoot?.querySelector('.md-meter__header')).toBeNull();
    const seats = meters[meters.length - 1] as MeterEl;
    await waitFor(() => expect(seats.classList.contains('hydrated')).toBe(true));
    expect(seats.getAttribute('aria-valuetext')).toBe('3 of 10 seats');
    // The visible duplicate is hidden from AT — the host announces instead.
    expect(
      seats.shadowRoot?.querySelector('.md-meter__header')?.getAttribute('aria-hidden'),
    ).toBe('true');
  },
};

/* ── Formatting ─────────────────────────────────────────── */

export const Formatting: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The value text is `Intl.NumberFormat` output. Default: the value's position " +
          'in the range as a locale-aware percentage. `formatOptions` (a JS-only object ' +
          'prop) switches to formatting the clamped raw value — units, currency, plain ' +
          'numbers. The un-pinned first meter follows the toolbar Locale global; the ' +
          'others pin `locale` themselves.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      <p style="${CAPTION}">Default — percent of the range</p>
      <md-meter value="24" label="Storage used" show-label show-value></md-meter>

      <p style="${CAPTION}">Unit — gigabytes (formatOptions)</p>
      <md-meter
        value="256"
        max="512"
        label="Storage used"
        show-label
        show-value
        .formatOptions=${{ style: 'unit', unit: 'gigabyte' } as Intl.NumberFormatOptions}
      ></md-meter>

      <p style="${CAPTION}">Currency — EUR, de-DE</p>
      <md-meter
        value="750"
        max="1000"
        label="Budget spent"
        locale="de-DE"
        show-label
        show-value
        .formatOptions=${{ style: 'currency', currency: 'EUR' } as Intl.NumberFormatOptions}
      ></md-meter>

      <p style="${CAPTION}">Plain number — one decimal</p>
      <md-meter
        value="7.4"
        max="10"
        label="Signal quality"
        show-label
        show-value
        .formatOptions=${{ maximumFractionDigits: 1 } as Intl.NumberFormatOptions}
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const meters = canvasElement.querySelectorAll('md-meter');
    const gb = meters[1] as MeterEl;
    await waitFor(() => expect(gb.classList.contains('hydrated')).toBe(true));
    const expectedGb = new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit: 'gigabyte',
    }).format(256);
    await waitFor(() => expect(gb.getAttribute('aria-valuetext')).toBe(expectedGb));

    const eur = meters[2] as MeterEl;
    const expectedEur = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(750);
    await waitFor(() => expect(eur.getAttribute('aria-valuetext')).toBe(expectedEur));
  },
};

/* ── Thickness ──────────────────────────────────────────── */

export const Thickness: Story = {
  render: () => html`
    <div style="${ROW}">
      <p style="${CAPTION}">2px</p>
      <md-meter value="65" thickness="2" label="Thin meter"></md-meter>

      <p style="${CAPTION}">4px (default)</p>
      <md-meter value="65" label="Default meter"></md-meter>

      <p style="${CAPTION}">8px</p>
      <md-meter value="65" thickness="8" label="Thick meter"></md-meter>

      <p style="${CAPTION}">12px</p>
      <md-meter value="65" thickness="12" label="Extra thick meter"></md-meter>

      <p style="${CAPTION}">--md-meter-height override (16px)</p>
      <md-meter
        value="65"
        label="CSS-sized meter"
        style="--md-meter-height: 16px;"
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const thin = await getMeter(canvasElement, 'md-meter[thickness="2"]');
    // Non-default thickness re-declares --_thickness inline, hook-first.
    expect(thin.style.getPropertyValue('--_thickness')).toContain('var(--md-meter-height,');
    // The default stays pure CSS — no inline override.
    const def = await getMeter(canvasElement, 'md-meter:not([thickness])');
    expect(def.style.getPropertyValue('--_thickness')).toBe('');
  },
};

/* ── Density ────────────────────────────────────────────── */

export const Density: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Each rung thins the track by 0.5px (floored at 2px) and tightens the header ' +
          'spacing and type. The local prop overrides an inherited global `data-density`.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      ${[0, -1, -2, -3, -4].map(
        (d) => html`
          <p style="${CAPTION}">density="${d}"</p>
          <md-meter
            density=${d}
            value="65"
            label="Storage used, rung ${d}"
            show-label
            show-value
          ></md-meter>
        `,
      )}
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getMeter(canvasElement, 'md-meter[density="-4"]');
    expect(el.getAttribute('density')).toBe('-4');
  },
};

/* ── RTL ────────────────────────────────────────────────── */

export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Geometry is 100% logical properties, so under `dir="rtl"` the fill anchors to ' +
          'the right edge and grows leftward with no configuration and no JS branch.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" lang="ar" style="${ROW}">
      <md-meter value="65" label="مساحة التخزين المستخدمة" show-label show-value></md-meter>
      <md-meter
        value="82"
        color="warning"
        label="مستوى البطارية"
        show-label
        show-value
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getMeter(canvasElement);
    expect(getComputedStyle(el).direction).toBe('rtl');
    // The fill anchors to the track's RIGHT edge in RTL. Re-measure inside
    // waitFor so a mid-flight fill transition can't wedge the assertion.
    await waitFor(() => {
      const track = el.shadowRoot!.querySelector('[part="track"]')!.getBoundingClientRect();
      const indicator = el.shadowRoot!.querySelector('[part="indicator"]')!.getBoundingClientRect();
      expect(Math.abs(indicator.right - track.right)).toBeLessThanOrEqual(1.5);
    });
  },
};

/* ── Localization ───────────────────────────────────────── */

export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Labels are plain text props resolved by the demo i18n dictionary — the component ' +
          'itself is i18n-engine-agnostic. The `locale` prop is Intl-only: the toolbar ' +
          'Locale global drives it, so digits, separators and percent signs follow the ' +
          'locale while your app supplies the translated label.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${ROW}">
      <md-meter
        value="65"
        label=${t(globals.locale, 'meter.storageUsed')}
        show-label
        show-value
      ></md-meter>
      <md-meter
        value="82"
        color="success"
        label=${t(globals.locale, 'meter.batteryLevel')}
        show-label
        show-value
      ></md-meter>
      <md-meter
        value="35"
        color="warning"
        label=${t(globals.locale, 'meter.passwordStrength')}
        show-label
        show-value
      ></md-meter>
    </div>
  `,
};

/* ── Accessibility ──────────────────────────────────────── */

export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The host is the single ARIA surface: `role="meter"` + `aria-valuemin/max/now` ' +
          '(clamped) + `aria-valuetext` (the formatted reading) + `aria-label`. All ' +
          'internal DOM is `aria-hidden`, so the visible value is never announced twice. ' +
          "Nothing is focusable — a meter is a reading, not a control. Don't rely on " +
          'colour alone: pair status colours with the visible value or label.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      <p style="${CAPTION}">
        Announced as: "Storage used, meter, 65%"
      </p>
      <md-meter value="65" label="Storage used" show-label show-value></md-meter>

      <p style="${CAPTION}">
        value-text makes the announcement concrete: "3 of 10 seats"
      </p>
      <md-meter
        value="3"
        max="10"
        label="Seats taken"
        value-text="3 of 10 seats"
        show-label
        show-value
      ></md-meter>

      <p style="${CAPTION}">
        Status colour + visible value — never colour alone
      </p>
      <md-meter value="96" color="error" label="Quota used" show-label show-value></md-meter>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const el = await getMeter(canvasElement);

    await step('single host-level ARIA surface', async () => {
      expect(el.getAttribute('role')).toBe('meter');
      expect(el.getAttribute('aria-label')).toBe('Storage used');
      expect(el.getAttribute('aria-valuenow')).toBe('65');
      expect(el.getAttribute('aria-valuetext')).toBeTruthy();
      expect(el.shadowRoot?.querySelector('.md-meter__header')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      expect(el.shadowRoot?.querySelector('[part="track"]')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    });

    await step('nothing is focusable', async () => {
      expect(el.hasAttribute('tabindex')).toBe(false);
      el.focus();
      expect(document.activeElement).not.toBe(el);
    });
  },
};

/* ── Custom CSS ─────────────────────────────────────────── */

export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <style>
      .brand-meter {
        --md-meter-indicator-color: #6200ee;
        --md-meter-track-color: #e0d4f5;
      }
      .square-meter {
        --md-meter-track-shape: 2px;
      }
      .tall-meter {
        --md-meter-height: 12px;
      }
      .toned-header {
        --md-meter-label-color: var(--md-sys-color-primary, #6750a4);
        --md-meter-value-color: var(--md-sys-color-primary, #6750a4);
      }
    </style>
    <div style="${ROW}">
      <p style="${CAPTION}">Default</p>
      <md-meter value="65" label="Default meter"></md-meter>

      <p style="${CAPTION}">Brand colours</p>
      <md-meter class="brand-meter" value="65" label="Brand meter"></md-meter>

      <p style="${CAPTION}">Square corners</p>
      <md-meter class="square-meter" value="65" label="Square meter"></md-meter>

      <p style="${CAPTION}">--md-meter-height: 12px</p>
      <md-meter class="tall-meter" value="65" label="Tall meter"></md-meter>

      <p style="${CAPTION}">Toned header text</p>
      <md-meter
        class="toned-header"
        value="65"
        label="Toned header"
        show-label
        show-value
      ></md-meter>

      <p style="${CAPTION}">Inline override</p>
      <md-meter
        value="65"
        label="Inline meter"
        style="--md-meter-indicator-color: coral; --md-meter-track-color: #ffe0d0;"
      ></md-meter>
    </div>
  `,
};

/* ── CSS Parts ──────────────────────────────────────────── */

export const CSSParts: Story = {
  name: 'CSS ::part() Styling',
  render: () => html`
    <style>
      /* Gradient fill — impossible with the single indicator-color var */
      .gradient-fill::part(indicator) {
        background: linear-gradient(to right, #1a237e, #7c4dff, #ce93d8);
      }
      .faded-track::part(track) {
        opacity: 0.35;
      }
      .strong-label::part(label) {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .boxed-value::part(value) {
        padding: 1px 6px;
        border-radius: 6px;
        background: var(--md-sys-color-secondary-container, #e8def8);
        color: var(--md-sys-color-on-secondary-container, #1d192b);
      }
    </style>
    <div style="${ROW}">
      <p style="${CAPTION}">Gradient indicator</p>
      <md-meter class="gradient-fill" value="65" label="Gradient meter"></md-meter>

      <p style="${CAPTION}">Faded track</p>
      <md-meter class="faded-track" value="40" label="Faded track meter"></md-meter>

      <p style="${CAPTION}">Styled label + value parts</p>
      <md-meter
        class="strong-label boxed-value"
        value="65"
        label="Styled header"
        show-label
        show-value
      ></md-meter>
    </div>
  `,
};

/* ── Circular ───────────────────────────────────────────── */

export const Circular: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`variant="circular"` is the same reading as a ring: same `color` roles, same ' +
          '`thickness`, same Intl formatting, same ARIA on the host. `show-value` moves the ' +
          'value into the middle and `show-label` captions it underneath — the header row is ' +
          "the bar's layout, not the ring's. `size` is the diameter in dp (48 by default, " +
          "clamped to 24–240). The ring fills clockwise from twelve o'clock in every locale: " +
          'it is deliberately NOT mirrored under `dir="rtl"`, matching Material\'s circular ' +
          'progress indicator.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display:flex; align-items:flex-start; gap:32px; flex-wrap:wrap; padding:24px;">
      <md-meter variant="circular" value="72" show-value></md-meter>
      <md-meter
        variant="circular"
        value="72"
        size="72"
        thickness="6"
        label="${t(globals.locale, 'meter.storageUsed')}"
        show-value
        show-label
      ></md-meter>
      <md-meter
        variant="circular"
        value="41"
        size="96"
        thickness="8"
        color="tertiary"
        label="${t(globals.locale, 'meter.batteryLevel')}"
        show-value
        show-label
      ></md-meter>
      <md-meter
        variant="circular"
        value="96"
        size="96"
        thickness="8"
        color="error"
        label="${t(globals.locale, 'meter.storageUsed')}"
        show-value
        show-label
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const rings = [...canvasElement.querySelectorAll('md-meter[variant="circular"]')] as HTMLElement[];
    await waitFor(() => expect(rings.every((r) => r.classList.contains('hydrated'))).toBe(true));

    const first = rings[0];
    const shadow = first.shadowRoot!;

    // The shape is presentational: the reading still lives on the host.
    expect(first.getAttribute('role')).toBe('meter');
    expect(first.getAttribute('aria-valuenow')).toBe('72');
    expect(shadow.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');

    // 72% of a path normalised to 1 leaves 0.28 of it undrawn.
    const arc = shadow.querySelector('.md-meter__ring-indicator')!;
    expect(arc.getAttribute('pathLength')).toBe('1');
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0.28, 5);

    // The bar's header row must not come along for the ride.
    expect(shadow.querySelector('.md-meter__header')).toBe(null);
    expect(shadow.querySelector('.md-meter__center')).not.toBe(null);

    // size drives the rendered box, not just the viewBox.
    const small = rings[0].getBoundingClientRect().width;
    const medium = rings[1].getBoundingClientRect().width;
    expect(medium).toBeGreaterThan(small);
  },
};

/* ── Dark Theme ─────────────────────────────────────────── */

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1c1b1f); padding: 32px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:20px; width:320px;">
      <md-meter value="65" label="Storage used" show-label show-value></md-meter>
      <md-meter value="82" color="success" label="Battery level" show-label show-value></md-meter>
      <md-meter value="88" color="warning" label="Quota used" show-label show-value></md-meter>
      <md-meter value="97" color="error" label="Disk almost full" show-label show-value></md-meter>
    </div>
  `,
};

/* ── Storage quota recipe ───────────────────────────────── */

export const StorageQuota: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The canonical meter recipe: one reading whose colour role tracks thresholds — ' +
          '`success` while healthy, `warning` near the limit, `error` at/over it. The ' +
          'switch is a plain `color` swap in your state layer; the value text stays the ' +
          'single source of truth for what is announced.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      <p style="${CAPTION}">Healthy — 45 of 100 GB</p>
      <md-meter
        value="45"
        color="success"
        label="Storage used"
        value-text="45 GB of 100 GB"
        show-label
        show-value
      ></md-meter>

      <p style="${CAPTION}">Near the limit — 82 of 100 GB</p>
      <md-meter
        value="82"
        color="warning"
        label="Storage used"
        value-text="82 GB of 100 GB"
        show-label
        show-value
      ></md-meter>

      <p style="${CAPTION}">Critical — 96 of 100 GB</p>
      <md-meter
        value="96"
        color="error"
        label="Storage used"
        value-text="96 GB of 100 GB"
        show-label
        show-value
      ></md-meter>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getMeter(canvasElement, 'md-meter[color="success"]');
    expect(el.getAttribute('aria-valuetext')).toBe('45 GB of 100 GB');

    if (drivingCoverage()) {
      // Walk one meter through the whole threshold ladder.
      await exerciseProps(el, [
        ['value', 60],
        ['color', 'warning'],
        ['value', 90],
        ['color', 'error'],
        ['value', 100],
      ]);
    }
  },
};

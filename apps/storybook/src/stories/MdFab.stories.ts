import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the FAB host (which carries
 *  role="button" and the reflected state attributes) directly. */
type FabEl = HTMLElement & { disabled: boolean; softDisabled: boolean; label: string; icon: string; extended?: boolean };
const getFab = async (canvasElement: HTMLElement): Promise<FabEl> => {
  const fab = canvasElement.querySelector('md-fab') as FabEl;
  await waitFor(() => expect(fab.classList.contains('hydrated')).toBe(true));
  return fab;
};
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Actions/FAB',
  component: 'md-fab',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: {
        type: 'code',
        language: 'html',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'surface',
        'primary-container', 'secondary-container', 'tertiary-container',
        'primary', 'secondary', 'tertiary',
      ],
    },
    size: {
      control: 'select',
      options: ['standard', 'medium', 'large'],
    },
    disabled: { control: 'boolean' },
    softDisabled: { control: 'boolean' },
    ripple: { control: 'boolean' },
    lowered: { control: 'boolean' },
    icon: { control: 'text' },
    label: { control: 'text' },
  },
  args: {
    variant: 'primary-container',
    size: 'standard',
    disabled: false,
    softDisabled: false,
    ripple: true,
    lowered: false,
    icon: 'add',
    label: '',
  },
};

export default meta;
type Story = StoryObj;

const ROW = 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';
const containerVariants = ['primary-container', 'secondary-container', 'tertiary-container'] as const;
const directVariants = ['primary', 'secondary', 'tertiary'] as const;
/* M3's own default FAB colour: a neutral container with a primary-role icon.
   It is also the only variant whose container colour changes when `lowered`
   (surface-container-high -> surface-container-low). */
const surfaceVariant = ['surface'] as const;
const allVariants = [...surfaceVariant, ...containerVariants, ...directVariants] as const;
const sizes = ['standard', 'medium', 'large'] as const;

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: `<md-fab
  variant="primary-container"
  size="standard"
  icon="add"
  aria-label="Create"
></md-fab>`,
      },
    },
  },
  render: (args) => html`
    <md-fab
      .variant="${args.variant}"
      .size="${args.size}"
      .disabled="${args.disabled}"
      .softDisabled="${args.softDisabled}"
      .ripple="${args.ripple}"
      .lowered="${args.lowered}"
      .icon="${args.icon}"
      .label="${args.label}"
      aria-label="Action"
    ></md-fab>
  `,
  /** Activation contract: pointer + keyboard emit mdClick; disabled/soft-disabled
   *  stay silent (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const fab = await getFab(canvasElement);

    // One delegated listener records every activation + the forwarded payload.
    let clicks = 0;
    let lastDetail: MouseEvent | undefined;
    fab.addEventListener('mdClick', (e) => {
      clicks += 1;
      lastDetail = (e as CustomEvent<MouseEvent>).detail;
    });

    await step('Pointer click emits mdClick carrying the MouseEvent', async () => {
      expect(clicks).toBe(0); // nothing fired yet
      fab.click();
      await waitFor(() => expect(clicks).toBe(1)); // proves it emitted, once
      // detail is the underlying activation event, not a synthetic stand-in.
      expect(lastDetail).toBeInstanceOf(MouseEvent);
      expect(lastDetail!.type).toBe('click');
    });

    await step('Enter and Space keyboard-activate identically to a click', async () => {
      const before = clicks; // 1
      press(fab, 'Enter');
      await waitFor(() => expect(clicks).toBe(before + 1)); // keydown → el.click() → emit
      press(fab, ' ');
      await waitFor(() => expect(clicks).toBe(before + 2)); // Space activates too
    });

    await step('Soft-disabled keeps the tab stop but never emits', async () => {
      fab.softDisabled = true;
      // Reflected state lands on the next render flush → assert inside waitFor.
      await waitFor(() => expect(fab.getAttribute('aria-disabled')).toBe('true'));
      expect(fab.getAttribute('tabindex')).toBe('0'); // still focusable (soft = advisory)
      const before = clicks;
      fab.click();
      press(fab, 'Enter');
      await new Promise((r) => setTimeout(r, 50));
      expect(clicks).toBe(before); // guard: no activation while soft-disabled
    });

    await step('Hard-disabled drops the tab stop AND stays silent', async () => {
      const beforeTab = fab.getAttribute('tabindex'); // '0'
      fab.softDisabled = false;
      fab.disabled = true;
      await waitFor(() => expect(fab.getAttribute('tabindex')).not.toBe(beforeTab)); // moved
      expect(fab.getAttribute('tabindex')).toBe('-1'); // removed from tab order
      expect(fab.getAttribute('aria-disabled')).toBe('true');
      const before = clicks;
      fab.click();
      press(fab, 'Enter');
      await new Promise((r) => setTimeout(r, 50));
      expect(clicks).toBe(before); // guard: hard-disabled emits nothing
    });

    // Let any ripple/state-layer animation from the keyboard steps settle so
    // teardown doesn't race an in-flight transition.
    await new Promise((r) => setTimeout(r, 300));

    // ── Additional coverage (appended; every step below runs after the
    //    activation contract above and only adds new assertions) ──

    await step('A non-activation key is ignored (no mdClick)', async () => {
      // Re-enable after the disabled checks so the key path runs on a live FAB.
      fab.disabled = false;
      await waitFor(() => expect(fab.getAttribute('tabindex')).toBe('0'));
      const before = clicks;
      press(fab, 'ArrowDown'); // neither Enter nor Space → handler must no-op
      press(fab, 'a');
      await new Promise((r) => setTimeout(r, 50));
      expect(clicks).toBe(before); // guard: only Enter/Space activate
    });

    await step('Setting a label morphs to extended and measures its width', async () => {
      fab.label = 'Compose';
      // The @Watch('label') → measureLabel path renders the label span…
      await waitFor(() =>
        expect(fab.shadowRoot!.querySelector('.md-fab__label')?.textContent).toBe('Compose'),
      );
      // …the host morphs to the extended layout (hasLabel && default-extended)…
      await waitFor(() => expect(fab.classList.contains('md-fab--extended')).toBe(true));
      // …and measureLabel records the natural label width as a CSS custom prop.
      await waitFor(() => {
        const w = fab.style.getPropertyValue('--_fab-label-w').trim();
        expect(w).toMatch(/^\d+(\.\d+)?px$/);
        expect(parseFloat(w)).toBeGreaterThan(0);
      });
    });

    await step('extended=false collapses the label and hides it from AT', async () => {
      fab.extended = false;
      await waitFor(() => expect(fab.classList.contains('md-fab--collapsed')).toBe(true));
      expect(fab.classList.contains('md-fab--extended')).toBe(false);
      // Collapsed label stays in the DOM (accessible name) but is aria-hidden.
      await waitFor(() =>
        expect(
          fab.shadowRoot!.querySelector('.md-fab__label')?.getAttribute('aria-hidden'),
        ).toBe('true'),
      );
    });

    await step('extended=true re-expands and unhides the label', async () => {
      fab.extended = true;
      await waitFor(() => expect(fab.classList.contains('md-fab--extended')).toBe(true));
      expect(fab.classList.contains('md-fab--collapsed')).toBe(false);
      await waitFor(() =>
        expect(
          fab.shadowRoot!.querySelector('.md-fab__label')?.getAttribute('aria-hidden'),
        ).toBe(null),
      );
    });

    // Settle again after the extended↔collapsed morph transitions.
    await new Promise((r) => setTimeout(r, 200));

    // ── Icon rendering + label round-trip (appended; only new assertions
    //    below, each exercising a render/prop path the steps above don't) ──

    await step('The icon prop renders its glyph and marks the FAB with-icon', async () => {
      // Default arg icon="add" → the shadow icon span carries that exact glyph…
      const iconEl = fab.shadowRoot!.querySelector('.md-fab__icon');
      expect(iconEl?.textContent).toBe('add');
      // …and a present icon flips the with-icon layout class on the host.
      expect(fab.classList.contains('md-fab--with-icon')).toBe(true);
    });

    await step('Changing the icon prop swaps the rendered glyph', async () => {
      fab.icon = 'edit';
      // Prop change → re-render replaces the glyph text (componentDidRender path).
      await waitFor(() =>
        expect(fab.shadowRoot!.querySelector('.md-fab__icon')?.textContent).toBe('edit'),
      );
      expect(fab.classList.contains('md-fab--with-icon')).toBe(true);
    });

    await step('Clearing the label morphs back to icon-only', async () => {
      fab.label = '';
      // @Watch('label') → re-render drops the label span entirely…
      await waitFor(() => expect(fab.shadowRoot!.querySelector('.md-fab__label')).toBe(null));
      // …and with no label neither morph class can be present.
      expect(fab.classList.contains('md-fab--extended')).toBe(false);
      expect(fab.classList.contains('md-fab--collapsed')).toBe(false);
    });

    await step('extended toggling is inert while there is no label', async () => {
      // Guard: md-fab--collapsed/--extended require a label, so toggling
      // `extended` on a label-less FAB must not add either class.
      fab.extended = false;
      await new Promise((r) => setTimeout(r, 50));
      expect(fab.classList.contains('md-fab--collapsed')).toBe(false);
      expect(fab.classList.contains('md-fab--extended')).toBe(false);
    });

    await step('Re-adding a label re-extends and re-measures its width', async () => {
      fab.extended = true;
      fab.label = 'Reroute';
      // Label span comes back with the new text…
      await waitFor(() =>
        expect(fab.shadowRoot!.querySelector('.md-fab__label')?.textContent).toBe('Reroute'),
      );
      // …the host returns to the extended layout…
      await waitFor(() => expect(fab.classList.contains('md-fab--extended')).toBe(true));
      // …and measureLabel records a fresh, positive natural width.
      await waitFor(() => {
        const w = fab.style.getPropertyValue('--_fab-label-w').trim();
        expect(parseFloat(w)).toBeGreaterThan(0);
      });
    });

    // Settle after the icon/label round-trip morph transitions.
    await new Promise((r) => setTimeout(r, 200));

    // ── State-neutral reset (appended) ──
    // The coverage steps above leave the FAB extended with label "Reroute" and
    // icon "edit" — that's what VISUAL mode would screenshot. Restore the clean
    // resting render (args: icon="add", label="" → icon-only, enabled, unfocused)
    // so the visual baseline captures the fresh state, not the post-interaction one.
    fab.label = '';
    fab.icon = 'add';
    fab.disabled = false;
    fab.softDisabled = false;
    (document.activeElement as HTMLElement)?.blur();
    // Clearing the label drops the label span and both morph classes…
    await waitFor(() => expect(fab.shadowRoot!.querySelector('.md-fab__label')).toBe(null));
    expect(fab.classList.contains('md-fab--extended')).toBe(false);
    expect(fab.classList.contains('md-fab--collapsed')).toBe(false);
    // …and the glyph returns to the default "add".
    await waitFor(() =>
      expect(fab.shadowRoot!.querySelector('.md-fab__icon')?.textContent).toBe('add'),
    );
    // Let the collapse transition settle before the screenshot is taken.
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ==========================================================
   ALL VARIANTS
   ========================================================== */
export const AllVariants: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Surface — M3's own default</p>
      <div style="${ROW}">
        <md-fab variant="surface" icon="edit" aria-label="surface"></md-fab>
        <md-fab variant="surface" lowered icon="edit" aria-label="surface lowered"></md-fab>
        <md-fab variant="surface" extended icon="edit" label="Surface extended"></md-fab>
      </div>

      <p style="${HEADING}">Container variants</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Direct variants (M3 Expressive)</p>
      <div style="${ROW}">
        ${directVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   STATES — Enabled · Disabled · Soft-Disabled
   ========================================================== */
export const States: Story = {
  name: 'States (Enabled / Disabled / Soft-Disabled)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Enabled</p>
      <div style="${ROW}">
        ${allVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Disabled</p>
      <div style="${ROW}">
        ${allVariants.map(v => html`<md-fab variant="${v}" icon="edit" disabled aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Soft-Disabled (focusable)</p>
      <div style="${ROW}">
        ${allVariants.map(v => html`<md-fab variant="${v}" icon="edit" soft-disabled aria-label="${v}"></md-fab>`)}
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Hover, focus (Tab), and press states are interactive — try them above.
      </p>
    </div>
  `,
};

/* ==========================================================
   SIZES
   ========================================================== */
export const Sizes: Story = {
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">All sizes</p>
      <div style="${ROW}; align-items: flex-end;">
        ${sizes.map(s => html`<md-fab size="${s}" icon="add" aria-label="${s}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Extended FAB</p>
      <div style="${ROW}">
        <md-fab icon="add" label="${t(globals.locale, 'fab.create')}"></md-fab>
        <md-fab variant="secondary-container" icon="edit" label="${t(globals.locale, 'edit')}"></md-fab>
        <md-fab variant="tertiary-container" label="${t(globals.locale, 'fab.reroute')}"></md-fab>
      </div>
    </div>
  `,
};

/* ==========================================================
   EXTENDED FAB
   ========================================================== */
export const ExtendedFab: Story = {
  name: 'Extended FAB',
  parameters: {
    docs: {
      source: {
        code: `<!-- With icon + label -->
<md-fab icon="add" label="Create"></md-fab>

<!-- Label only -->
<md-fab label="Reroute"></md-fab>`,
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">With icon + label</p>
      <div style="${ROW}">
        <md-fab icon="add" label="${t(globals.locale, 'fab.create')}"></md-fab>
        <md-fab variant="secondary-container" icon="edit" label="${t(globals.locale, 'edit')}"></md-fab>
        <md-fab variant="tertiary-container" icon="navigation" label="${t(globals.locale, 'fab.navigate')}"></md-fab>
        <md-fab variant="primary" icon="bookmark" label="${t(globals.locale, 'fab.bookmark')}"></md-fab>
      </div>

      <p style="${HEADING}">Label only (no icon)</p>
      <div style="${ROW}">
        <md-fab label="${t(globals.locale, 'fab.create')}"></md-fab>
        <md-fab variant="secondary-container" label="${t(globals.locale, 'fab.reroute')}"></md-fab>
        <md-fab variant="tertiary" label="${t(globals.locale, 'fab.navigate')}"></md-fab>
      </div>

      <p style="${HEADING}">Extended + lowered</p>
      <div style="${ROW}">
        <md-fab icon="add" label="${t(globals.locale, 'fab.create')}" lowered></md-fab>
        <md-fab variant="tertiary-container" icon="edit" label="${t(globals.locale, 'edit')}" lowered></md-fab>
      </div>
    </div>
  `,
};

/* ==========================================================
   LOWERED
   ========================================================== */
export const Lowered: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:12px; font-size:14px;">
        Lowered FABs have reduced elevation. Use when the FAB sits on an already-elevated surface.
      </p>
      <p style="${HEADING}">Normal elevation</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Lowered elevation</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" lowered aria-label="${v}"></md-fab>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   RIPPLE (enable / disable)
   ========================================================== */
export const Ripple: Story = {
  parameters: {
    docs: {
      source: {
        code: `<!-- With ripple (default) -->
<md-fab icon="add" aria-label="Add"></md-fab>

<!-- Without ripple -->
<md-fab icon="add" .ripple="\${false}" aria-label="Add"></md-fab>`,
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:12px; font-size:14px;">
        Ripple is enabled by default. Set <code>.ripple="\${false}"</code> to disable the press animation.
      </p>
      <p style="${HEADING}">With ripple (default)</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}">Without ripple</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" .ripple="${false}" aria-label="${v}"></md-fab>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   ALL VARIANTS × ALL SIZES (matrix)
   ========================================================== */
export const AllVariantsAllSizes: Story = {
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      ${allVariants.map(variant => html`
        <p style="${HEADING}">${variant}</p>
        <div style="${ROW}; align-items: flex-end;">
          ${sizes.map(s => html`<md-fab variant="${variant}" size="${s}" icon="edit" aria-label="${variant} ${s}"></md-fab>`)}
          <md-fab variant="${variant}" icon="edit" label="${t(globals.locale, 'fab.extended')}"></md-fab>
        </div>
      `)}
    </div>
  `,
};

/* ==========================================================
   CUSTOM CSS (--md-fab-* properties)
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <style>
      .danger-fab {
        --md-fab-container-color: var(--md-sys-color-error-container, #F9DEDC);
        --md-fab-icon-color: var(--md-sys-color-on-error-container, #370606);
      }
      .brand-fab {
        --md-fab-container-color: #1a73e8;
        --md-fab-icon-color: #ffffff;
        --md-fab-container-shape: 8px;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">--md-fab-container-color / --md-fab-icon-color</p>
      <div style="${ROW}">
        <md-fab class="danger-fab" icon="delete" aria-label="Delete"></md-fab>
        <md-fab class="brand-fab" icon="add" aria-label="Add"></md-fab>
      </div>

      <p style="${HEADING}">--md-fab-container-shape</p>
      <div style="${ROW}">
        <md-fab icon="add" style="--md-fab-container-shape: 0px" aria-label="Add"></md-fab>
        <md-fab icon="add" style="--md-fab-container-shape: 4px" aria-label="Add"></md-fab>
        <md-fab icon="add" aria-label="Add"></md-fab>
        <md-fab icon="add" style="--md-fab-container-shape: 50%" aria-label="Add"></md-fab>
      </div>

      <p style="${HEADING}">--md-fab-icon-size</p>
      <div style="${ROW}; align-items: flex-end;">
        <md-fab size="large" icon="add" style="--md-fab-icon-size: 48px" aria-label="Add"></md-fab>
      </div>
    </div>
  `,
};

/* ==========================================================
   SLOTTED ICONS (custom iconography)
   ========================================================== */
export const SlottedIcons: Story = {
  name: 'Custom Icons (Named Slot)',
  parameters: {
    docs: {
      source: {
        code: `<!-- SVG icon via slot -->
<md-fab aria-label="Star">
  <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77z"/>
  </svg>
</md-fab>`,
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">SVG icon via slot="icon"</p>
      <div style="${ROW}">
        <md-fab aria-label="Star">
          <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </md-fab>
        <md-fab aria-label="Favorite">
          <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </md-fab>
      </div>

      <p style="${HEADING}">Emoji as slotted icon</p>
      <div style="${ROW}">
        <md-fab aria-label="Launch">
          <span slot="icon" style="font-size:24px">🚀</span>
        </md-fab>
        <md-fab label="${t(globals.locale, 'fab.celebrate')}">
          <span slot="icon" style="font-size:24px">🎉</span>
        </md-fab>
      </div>
    </div>
  `,
};

/* ==========================================================
   RTL — layout swap in dir="rtl"
   ========================================================== */
export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Extended FABs use CSS logical properties, so the icon and label ' +
          'swap sides automatically inside <code>dir="rtl"</code>. ' +
          'Icon-only FABs still require a localized <code>aria-label</code> ' +
          'for screen readers.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" lang="ar" style="${SECTION}">
      <p style="${HEADING}">Standard FAB (icon-only)</p>
      <div style="${ROW}">
        <md-fab icon="add" aria-label="إنشاء"></md-fab>
        <md-fab variant="secondary-container" icon="edit" aria-label="تحرير"></md-fab>
        <md-fab variant="tertiary-container" icon="navigation" aria-label="تنقل"></md-fab>
        <md-fab size="medium" icon="favorite" aria-label="مفضلة"></md-fab>
        <md-fab size="large" icon="share" aria-label="مشاركة"></md-fab>
      </div>

      <p style="${HEADING}">Extended FAB (icon + label)</p>
      <div style="${ROW}">
        <md-fab icon="add" label="إنشاء"></md-fab>
        <md-fab variant="secondary-container" icon="edit" label="تحرير"></md-fab>
        <md-fab variant="tertiary-container" icon="navigation" label="تنقل"></md-fab>
        <md-fab label="إعادة التوجيه"></md-fab>
      </div>

      <p style="${HEADING}">Hebrew (עברית)</p>
      <div style="${ROW}">
        <md-fab icon="add" aria-label="הוסף"></md-fab>
        <md-fab icon="edit" label="עריכה"></md-fab>
        <md-fab variant="secondary-container" icon="share" label="שיתוף"></md-fab>
      </div>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION — localized aria-label and extended labels
   ========================================================== */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Icon-only FABs need a localized <code>aria-label</code>; extended ' +
          'FABs expose the visible <code>label</code> as the accessible name ' +
          'automatically. Set <code>lang</code> and <code>dir</code> on a ' +
          'wrapping element so screen readers pronounce labels correctly and ' +
          'extended layout mirrors in RTL locales.',
      },
    },
  },
  render: () => {
    const rows = [
      { code: 'en', dir: 'ltr', name: 'English',  create: 'Create',  edit: 'Edit',    share: 'Share' },
      { code: 'fr', dir: 'ltr', name: 'Français', create: 'Créer',   edit: 'Modifier', share: 'Partager' },
      { code: 'de', dir: 'ltr', name: 'Deutsch',  create: 'Erstellen', edit: 'Bearbeiten', share: 'Teilen' },
      { code: 'ja', dir: 'ltr', name: '日本語',     create: '作成',     edit: '編集',     share: '共有' },
      { code: 'ar', dir: 'rtl', name: 'العربية',   create: 'إنشاء',   edit: 'تحرير',    share: 'مشاركة' },
      { code: 'he', dir: 'rtl', name: 'עברית',    create: 'הוסף',    edit: 'עריכה',    share: 'שיתוף' },
    ];
    return html`
      <style>
        .fab-l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .fab-l10n .grid { display: flex; flex-direction: column; }
        .fab-l10n .row {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .fab-l10n .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .fab-l10n .code {
          color: #6750a4;
          font-weight: 600;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .fab-l10n .name { color: #49454F; font-size: 14px; }
        .fab-l10n .fabs {
          flex: 1 1 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
      </style>
      <div class="fab-l10n">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          Each row carries its own <code>lang</code> and <code>dir</code> so
          extended FAB layout mirrors in RTL and screen readers use the right
          pronunciation. Icon-only FABs use <code>aria-label</code>; extended
          FABs use the <code>label</code> prop.
        </p>
        <div class="grid">
          ${rows.map(r => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.name}</span>
              </div>
              <div class="fabs">
                <md-fab icon="add" aria-label="${r.create}"></md-fab>
                <md-fab icon="edit" label="${r.edit}"></md-fab>
                <md-fab variant="secondary-container" icon="share" label="${r.share}"></md-fab>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   DARK THEME
   ========================================================== */
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
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}; color:#CAC4D0;">Container variants</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Direct variants</p>
      <div style="${ROW}">
        ${directVariants.map(v => html`<md-fab variant="${v}" icon="edit" aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">All sizes</p>
      <div style="${ROW}; align-items: flex-end;">
        ${sizes.map(s => html`<md-fab size="${s}" icon="add" aria-label="Add"></md-fab>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Extended</p>
      <div style="${ROW}">
        <md-fab icon="add" label="${t(globals.locale, 'fab.create')}"></md-fab>
        <md-fab variant="secondary-container" icon="edit" label="${t(globals.locale, 'edit')}"></md-fab>
        <md-fab label="${t(globals.locale, 'fab.reroute')}"></md-fab>
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Lowered</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" lowered aria-label="${v}"></md-fab>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Disabled</p>
      <div style="${ROW}">
        ${containerVariants.map(v => html`<md-fab variant="${v}" icon="edit" disabled aria-label="${v}"></md-fab>`)}
      </div>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    // The demo's widest viewport box is 1024px. Under the default centred
    // layout the canvas shrink-wraps its content, so `inline-size: 100%` on the
    // shell is circular and resolves to that 1024px — the story then overflows a
    // narrower canvas and CENTRING clips both edges, taking the first character
    // off the heading. 'padded' gives the root a definite width, so the shell's
    // 100% and the boxes' max-inline-size: 100% both bind.
    layout: 'padded',
    docs: {
      description: {
        story:
          'FABs are fixed-size controls — responsiveness is about placement ' +
          'and when to switch from extended (icon + label) to icon-only. ' +
          'Pin the FAB to a corner with <code>position: fixed</code> and ' +
          'safe-area insets on phones. Hide the extended label below 480px ' +
          'via a container query, keeping only the icon with an ' +
          '<code>aria-label</code>.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      /* inline-size:100% + min-inline-size:0 keep the shell inside the canvas.
         Without them it sized to its widest child (the 1024px viewport box), and
         a canvas narrower than that centred the overflow — clipping BOTH edges,
         so the heading lost its first character. The children already carry
         max-inline-size:100%, which only binds once the shell itself is bounded. */
      .fab-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; inline-size: 100%; min-inline-size: 0; }
      .fab-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .fab-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 0;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
        position: relative;
        overflow: hidden;
        container-type: inline-size;
      }
      .fab-resp-corner {
        position: absolute;
        inset-block-end: 16px;
        inset-inline-end: 16px;
      }
      .fab-resp-scaffold {
        padding: 16px;
        min-block-size: 160px;
        font: 400 14px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
      @container (max-width: 480px) {
        .fab-resp-extended::part(label) { display: none; }
        .fab-resp-extended { --md-fab-extended-width: auto; }
      }
      .fab-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 480px; min-block-size: 200px; }
    </style>

    <div class="fab-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Corner placement at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Icon-only FAB pinned to the bottom-end corner — standard mobile pattern.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="fab-resp-vp__label">${vp.label}</div>
              <div class="fab-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="fab-resp-scaffold">
                  Page content area — FAB floats in the corner.
                </div>
                <div class="fab-resp-corner">
                  <md-fab icon="add" aria-label="Create new"></md-fab>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Extended FAB: label hides below 480px</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Extended FAB collapses to icon-only in narrow containers via <code>::part(label)</code>.
        </p>
        ${[
          { label: 'XS · 320 px (icon-only)', width: '320px' },
          { label: 'MD · 768 px (extended)', width: '768px' },
        ].map(
          (vp) => html`
            <div>
              <div class="fab-resp-vp__label">${vp.label}</div>
              <div class="fab-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="fab-resp-scaffold">
                  Resize to see the extended label appear.
                </div>
                <div class="fab-resp-corner">
                  <md-fab class="fab-resp-extended" icon="edit" label="${t(globals.locale, 'fab.compose')}" aria-label="Compose"></md-fab>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Drag the bottom-right corner — watch the extended label collapse.
        </p>
        <div class="fab-resp-vp fab-resp-live">
          <div class="fab-resp-scaffold">Drag to resize this frame.</div>
          <div class="fab-resp-corner">
            <md-fab class="fab-resp-extended" icon="add" label="${t(globals.locale, 'fab.create')}" aria-label="Create"></md-fab>
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   SLOT CHANGE — runtime hasSlottedIcon reaction
   ========================================================== */
export const SlotChangeUpdatesIcon: Story = {
  name: 'Slot Change Updates Icon',
  parameters: {
    docs: {
      description: {
        story:
          'The FAB reacts to slotted icons added or removed at runtime — a ' +
          '`slotchange` in the `icon` slot toggles the `md-fab--with-icon` ' +
          'layout, not just icons present at mount time.',
      },
    },
  },
  /* Both states are rendered side by side on purpose. Autodocs does NOT autoplay
     play(), so in the Docs tab this story shows exactly what render() returns —
     and a lone empty FAB there reads as a broken component rather than as the
     "before" half of a demonstration. The play() below still drives the first
     one through add → remove → add; the second is a static reference for what
     the slotted state looks like. */
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icon slotted at runtime</p>
      <div style="${ROW}; align-items: flex-start; gap: 40px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <md-fab id="fab-slot-runtime" aria-label="Bookmark"></md-fab>
          <span style="font-size: 12px; opacity: 0.7;">No icon yet — empty by design</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <md-fab aria-label="Bookmark">
            <span slot="icon" class="material-symbols-outlined">bookmark</span>
          </md-fab>
          <span style="font-size: 12px; opacity: 0.7;">After an icon is slotted</span>
        </div>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // The FIRST fab — the one that starts empty. getFab() returns the first
    // match, but be explicit now that the story renders two.
    const fab = canvasElement.querySelector('#fab-slot-runtime') as HTMLElement;
    await waitFor(() => expect(fab.classList.contains('hydrated')).toBe(true));
    // No icon prop and nothing slotted yet → not marked as carrying an icon.
    expect(fab.classList.contains('md-fab--with-icon')).toBe(false);

    // Slotting an icon at runtime must flip hasSlottedIcon via the slotchange
    // handler (the listener is attached in componentDidLoad, so only runtime
    // mutations reach it).
    const star = document.createElement('span');
    star.setAttribute('slot', 'icon');
    star.textContent = '★';
    fab.appendChild(star);
    await waitFor(() => expect(fab.classList.contains('md-fab--with-icon')).toBe(true));

    // Removing the only slotted node flips the state back off.
    fab.removeChild(star);
    await waitFor(() => expect(fab.classList.contains('md-fab--with-icon')).toBe(false));

    // Put it back. This is the last step, so whatever it leaves behind is what
    // you are then looking at — and an empty FAB reads as a broken component
    // rather than a demo. Re-slotting also makes the assertion stronger: the
    // slotchange handler has to work on a SECOND insertion, not just the first.
    fab.appendChild(star);
    await waitFor(() => expect(fab.classList.contains('md-fab--with-icon')).toBe(true));
  },
};

/* ==========================================================
   ACCESSIBLE NAME — missing name warns (dev guard)
   ========================================================== */
export const MissingAccessibleNameWarns: Story = {
  name: 'Missing Accessible Name Warns',
  parameters: {
    docs: {
      description: {
        story:
          'A dev-time guard warns (WCAG 1.1.1) when an icon-only FAB mounts ' +
          'with no `aria-label`, `aria-labelledby`, or `label`. The displayed ' +
          'FAB is correctly labelled; the guard is exercised on a nameless FAB ' +
          'created during the interaction test.',
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Correctly labelled (no warning)</p>
      <div style="${ROW}">
        <md-fab icon="add" label="Labelled FAB"></md-fab>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Capture warnings emitted while a nameless FAB hydrates.
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      const nameless = document.createElement('md-fab');
      nameless.setAttribute('icon', 'add'); // no aria-label / aria-labelledby / label
      canvasElement.appendChild(nameless);
      await customElements.whenDefined('md-fab');
      await waitFor(() => expect(nameless.classList.contains('hydrated')).toBe(true));
      // componentDidLoad → warnMissingAccessibleName fires the WCAG warning.
      await waitFor(() =>
        expect(warnings.some((w) => /accessible name/i.test(w))).toBe(true),
      );
      nameless.remove();
    } finally {
      console.warn = original;
    }
  },
};

/* ==========================================================
   ACCESSIBLE NAME — label vs aria-labelledby sources
   ========================================================== */
export const AccessibleNameSources: Story = {
  name: 'Accessible Name Sources',
  parameters: {
    docs: {
      description: {
        story:
          'An extended FAB with only a `label` exposes that label as its host ' +
          '`aria-label`. A FAB pointed at an external element via ' +
          '`aria-labelledby` keeps that reference and is not given a synthesized ' +
          '`aria-label`.',
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <span id="fab-ext-name" style="display:block; margin-bottom:8px; color:#49454F; font-size:13px;">Compose message</span>
      <div style="${ROW}">
        <md-fab id="fab-name-label" icon="edit" label="Compose"></md-fab>
        <md-fab id="fab-name-labelledby" icon="edit" aria-labelledby="fab-ext-name"></md-fab>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Label-only FAB (no explicit aria-label) synthesizes aria-label from label.
    const labelFab = canvasElement.querySelector('#fab-name-label') as FabEl;
    await waitFor(() => expect(labelFab.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(labelFab.getAttribute('aria-label')).toBe('Compose'));

    // A FAB referencing an external label via aria-labelledby keeps that
    // reference and must NOT get its own synthesized aria-label.
    const refFab = canvasElement.querySelector('#fab-name-labelledby') as FabEl;
    await waitFor(() => expect(refFab.classList.contains('hydrated')).toBe(true));
    expect(refFab.getAttribute('aria-labelledby')).toBe('fab-ext-name');
    expect(refFab.getAttribute('aria-label')).toBe(null);
  },
};

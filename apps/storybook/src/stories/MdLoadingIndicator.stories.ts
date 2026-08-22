import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { t } from '../i18n';

const meta: Meta = {
  title: 'Communication/Loading Indicator',
  component: 'md-loading-indicator',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['uncontained', 'contained'],
      description: 'Visual style variant',
    },
    label: {
      control: 'text',
      description: 'Accessible label for screen readers',
    },
  },
  args: {
    variant: 'uncontained',
    label: 'Loading',
  },
};
export default meta;
type Story = StoryObj;

const labelStyle = 'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 0;';
const cardStyle = 'background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; padding: 24px; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <md-loading-indicator
      variant=${args.variant}
      label=${args.label}
    ></md-loading-indicator>
  `,
};

/* ─── All Variants ────────────────────────────────────────── */
export const AllVariants: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator></md-loading-indicator>
        <span style="${labelStyle}">Uncontained</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained"></md-loading-indicator>
        <span style="${labelStyle}">Contained</span>
      </div>
    </div>
  `,
};

/* ─── Sizes ───────────────────────────────────────────────── */
export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator style="--md-loading-indicator-size: 32px; --md-loading-indicator-shape-size: 24px;"></md-loading-indicator>
        <span style="${labelStyle}">Small (32px)</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator></md-loading-indicator>
        <span style="${labelStyle}">Default (48px)</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator style="--md-loading-indicator-size: 64px; --md-loading-indicator-shape-size: 52px;"></md-loading-indicator>
        <span style="${labelStyle}">Large (64px)</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained" style="--md-loading-indicator-size: 32px; --md-loading-indicator-shape-size: 24px;"></md-loading-indicator>
        <span style="${labelStyle}">Small contained</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained"></md-loading-indicator>
        <span style="${labelStyle}">Default contained</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained" style="--md-loading-indicator-size: 64px; --md-loading-indicator-shape-size: 52px;"></md-loading-indicator>
        <span style="${labelStyle}">Large contained</span>
      </div>
    </div>
  `,
};

/* ─── In Context ──────────────────────────────────────────── */
export const InContext: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 400px;">
      <div>
        <div style="${labelStyle}">Page loading</div>
        <div style="${cardStyle}; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 16px;">
          <md-loading-indicator variant="contained"></md-loading-indicator>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">${t(globals.locale, 'loading.loading-content')}</span>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Inline loading</div>
        <div style="${cardStyle}; display: flex; align-items: center; gap: 12px;">
          <md-loading-indicator style="--md-loading-indicator-size: 32px; --md-loading-indicator-shape-size: 24px;"></md-loading-indicator>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'loading.fetching-results')}</span>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Pull-to-refresh</div>
        <div style="position: relative; ${cardStyle}; min-height: 160px; overflow: hidden;">
          <div style="position: absolute; inset-inline: 0; inset-block-start: 0; display: flex; justify-content: center; padding-block-start: 16px;">
            <md-loading-indicator variant="contained"></md-loading-indicator>
          </div>
          <div style="padding-block-start: 72px;">
            <div style="padding: 8px 0; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'loading.list-item-one')}</div>
            <div style="padding: 8px 0; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">${t(globals.locale, 'loading.list-item-two')}</div>
          </div>
        </div>
      </div>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="${cardStyle}; display: flex; align-items: center; gap: 12px; max-width: 360px;">
      <md-loading-indicator style="--md-loading-indicator-size: 32px; --md-loading-indicator-shape-size: 24px;"></md-loading-indicator>
      <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">جارٍ التحميل…</span>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator></md-loading-indicator>
        <span style="${labelStyle}">Uncontained</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained"></md-loading-indicator>
        <span style="${labelStyle}">Contained</span>
      </div>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .tertiary-indicator { --md-loading-indicator-color: var(--md-sys-color-tertiary, #7D5260); }
      .error-indicator { --md-loading-indicator-color: var(--md-sys-color-error, #B3261E); }
      .brand-contained {
        --md-loading-indicator-color: #ffffff;
        --md-loading-indicator-container-color: #6200ee;
      }
    </style>
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator class="tertiary-indicator"></md-loading-indicator>
        <span style="${labelStyle}">Tertiary</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator class="error-indicator"></md-loading-indicator>
        <span style="${labelStyle}">Error</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator variant="contained" class="brand-contained"></md-loading-indicator>
        <span style="${labelStyle}">Brand contained</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator style="--md-loading-indicator-color: coral;"></md-loading-indicator>
        <span style="${labelStyle}">Inline override</span>
      </div>
    </div>
  `,
};

/* ─── Accessibility ───────────────────────────────────────── */
export const Accessibility: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 480px;">
      <div>
        <div style="${labelStyle}">role="progressbar" + aria-label</div>
        <div style="${cardStyle}; display: flex; align-items: center; gap: 12px;">
          <md-loading-indicator label="Loading messages"></md-loading-indicator>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            Screen reader announces: "Loading messages, progress bar"
          </span>
        </div>
      </div>

      <div>
        <div style="${labelStyle}">aria-busy container pattern</div>
        <div
          style="${cardStyle}; min-height: 100px; display: flex; align-items: center; justify-content: center; gap: 12px;"
          aria-busy="true"
          aria-label="Messages panel"
          role="region"
        >
          <md-loading-indicator variant="contained" label="Loading messages"></md-loading-indicator>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
            Container has aria-busy="true"
          </span>
        </div>
      </div>

      <div>
        <div style="${labelStyle}">Sufficient color contrast (contained)</div>
        <div style="display: flex; gap: 16px; align-items: center;">
          <md-loading-indicator variant="contained"></md-loading-indicator>
          <span style="font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
            on-primary-container vs primary-container ≥ 3:1 contrast
          </span>
        </div>
      </div>

      <div>
        <div style="${labelStyle}">Reduced motion (opacity pulse fallback)</div>
        <div style="${cardStyle}; display: flex; align-items: center; gap: 12px;">
          <md-loading-indicator
            style="--md-loading-indicator-size: 38px; --md-loading-indicator-shape-size: 28px;"
          ></md-loading-indicator>
          <span style="font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
            With prefers-reduced-motion: reduce, shape becomes a gently pulsing circle
          </span>
        </div>
      </div>
    </div>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */
export const CSSParts: Story = {
  render: () => html`
    <style>
      .low-opacity::part(shape) { opacity: 0.87; }
      .shadow-shape::part(shape) { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    </style>
    <div style="display: flex; gap: 32px; align-items: center;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator class="low-opacity"></md-loading-indicator>
        <span style="${labelStyle}">Reduced opacity</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <md-loading-indicator class="shadow-shape"></md-loading-indicator>
        <span style="${labelStyle}">Drop shadow</span>
      </div>
    </div>
  `,
};

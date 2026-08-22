import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';

const meta: Meta = {
  title: 'Containment/Divider',
  component: 'md-divider',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    inset: { control: 'boolean', description: 'Middle-inset (16px both sides)' },
    'inset-start': { control: 'boolean', description: 'Inset start only (16px leading)' },
    'inset-end': { control: 'boolean', description: 'Inset end only (16px trailing)' },
    vertical: { control: 'boolean', description: 'Vertical orientation' },
  },
  args: {
    inset: false,
    'inset-start': false,
    'inset-end': false,
    vertical: false,
  },
};
export default meta;
type Story = StoryObj;

const listItemStyle = 'padding: 12px 16px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);';
const labelStyle = 'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 0;';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <div style="width: 360px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
      <div style="${listItemStyle}">Item above the divider</div>
      <md-divider
        ?inset=${args.inset}
        ?inset-start=${args['inset-start']}
        ?inset-end=${args['inset-end']}
        ?vertical=${args.vertical}
      ></md-divider>
      <div style="${listItemStyle}">Item below the divider</div>
    </div>
  `,
};

/* ─── All Variants ────────────────────────────────────────── */
export const AllVariants: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; width: 360px;">
      <div>
        <div style="${labelStyle}">Full-width (default)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Inset start (16px leading, 0px trailing)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider inset-start></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Middle-inset (16px both sides)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider inset></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Inset end (0px leading, 16px trailing)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider inset-end></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
    </div>
  `,
};

/* ─── Vertical ────────────────────────────────────────────── */
export const Vertical: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div>
        <div style="${labelStyle}">Vertical divider (stretches to container height)</div>
        <div style="display: flex; align-items: stretch; height: 56px; gap: 16px; padding: 0 16px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); display: flex; align-items: center;">Section A</span>
          <md-divider vertical></md-divider>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); display: flex; align-items: center;">Section B</span>
          <md-divider vertical></md-divider>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); display: flex; align-items: center;">Section C</span>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Vertical with inset</div>
        <div style="display: flex; align-items: stretch; height: 56px; gap: 16px; padding: 0 16px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); display: flex; align-items: center;">Left</span>
          <md-divider vertical inset></md-divider>
          <span style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); display: flex; align-items: center;">Right</span>
        </div>
      </div>
    </div>
  `,
};

/* ─── In a List ───────────────────────────────────────────── */
export const InAList: Story = {
  render: () => html`
    <div style="width: 360px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
      <div style="${listItemStyle}; display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'Material Symbols Outlined'; font-size: 24px; color: var(--md-sys-color-on-surface-variant, #49454F);">inbox</span>
        <span>Inbox</span>
      </div>
      <div style="${listItemStyle}; display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'Material Symbols Outlined'; font-size: 24px; color: var(--md-sys-color-on-surface-variant, #49454F);">send</span>
        <span>Sent</span>
      </div>
      <md-divider inset-start style="--md-divider-inset-start: 56px;"></md-divider>
      <div style="${listItemStyle}; display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'Material Symbols Outlined'; font-size: 24px; color: var(--md-sys-color-on-surface-variant, #49454F);">drafts</span>
        <span>Drafts</span>
      </div>
      <div style="${listItemStyle}; display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'Material Symbols Outlined'; font-size: 24px; color: var(--md-sys-color-on-surface-variant, #49454F);">delete</span>
        <span>Trash</span>
      </div>
      <md-divider></md-divider>
      <div style="${listItemStyle}; display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'Material Symbols Outlined'; font-size: 24px; color: var(--md-sys-color-on-surface-variant, #49454F);">settings</span>
        <span>Settings</span>
      </div>
    </div>
    <div style="margin-top: 12px; padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
      <strong>Usage pattern:</strong> Inset-start dividers group related items (Inbox/Sent separated from Drafts/Trash).
      Full-width divider separates major sections (mail vs settings).
      The start inset is set to <code>56px</code> to align with the text after the icon.
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="width: 360px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
      <div style="${listItemStyle}">عنصر أول</div>
      <md-divider inset-start></md-divider>
      <div style="${listItemStyle}">عنصر ثاني</div>
      <md-divider inset-start></md-divider>
      <div style="${listItemStyle}">عنصر ثالث</div>
    </div>
    <div style="margin-top: 12px; padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
      <strong>RTL:</strong> <code>inset-start</code> margin flips to the right side automatically via logical properties.
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: () => html`
    <div style="width: 360px; background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
      <div style="${listItemStyle}">Item one</div>
      <md-divider></md-divider>
      <div style="${listItemStyle}">Item two</div>
      <md-divider inset></md-divider>
      <div style="${listItemStyle}">Item three</div>
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
      .thick-divider { --md-divider-thickness: 2px; --md-divider-color: var(--md-sys-color-primary, #6750A4); }
      .subtle-divider { --md-divider-color: rgba(0,0,0,0.06); }
      .wide-inset { --md-divider-inset-start: 72px; }
    </style>
    <div style="display: flex; flex-direction: column; gap: 24px; width: 360px;">
      <div>
        <div style="${labelStyle}">Thick + primary color</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider class="thick-divider"></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Subtle (very light)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider class="subtle-divider"></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
      </div>
      <div>
        <div style="${labelStyle}">Wide inset start (72px)</div>
        <div style="background: var(--md-sys-color-surface, #FFFBFE); border-radius: 12px; overflow: hidden; box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));">
          <div style="${listItemStyle}">Above</div>
          <md-divider inset-start class="wide-inset"></md-divider>
          <div style="${listItemStyle}">Below</div>
        </div>
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
    // layout the canvas shrink-wraps its content, so the shell's and the boxes'
    // `max-inline-size: 100%` are circular and never bind — the story then
    // overflows a narrower canvas, and CENTRING clips both edges, taking the
    // first characters off every heading. 'padded' gives the root a definite
    // width so those percentage caps resolve.
    layout: 'padded',
    docs: {
      description: {
        story:
          'Dividers are block-level and span 100% of their parent inline-size. ' +
          'In narrow list columns (320px) they separate items edge-to-edge; ' +
          'inset-start dividers keep alignment with leading icons regardless ' +
          'of width. Vertical dividers need an explicit block-size on the parent ' +
          'flex row — they do not stretch automatically.',
      },
    },
  },
  render: () => html`
    <style>
      .div-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .div-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .div-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 0;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
        overflow: hidden;
        box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0,0,0,0.3));
      }
      .div-resp-live { resize: horizontal; overflow: auto; min-inline-size: 200px; max-inline-size: 100%; inline-size: 480px; }
    </style>

    <div class="div-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">List dividers at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Full-width and inset-start dividers in a list shell that grows with the frame.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="div-resp-vp__label">${vp.label}</div>
              <div class="div-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div style="${listItemStyle}">Inbox</div>
                <md-divider inset-start style="--md-divider-inset-start: 56px;"></md-divider>
                <div style="${listItemStyle}">Sent</div>
                <md-divider inset-start style="--md-divider-inset-start: 56px;"></md-divider>
                <div style="${listItemStyle}">Drafts</div>
                <md-divider></md-divider>
                <div style="${listItemStyle}">Settings</div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Vertical divider in a toolbar row</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Vertical dividers need a fixed block-size parent. Toolbar wraps on narrow widths.
        </p>
        ${[
          { label: 'XS · 320 px', width: '320px' },
          { label: 'MD · 768 px', width: '768px' },
        ].map(
          (vp) => html`
            <div>
              <div class="div-resp-vp__label">${vp.label}</div>
              <div class="div-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%; padding: 8px 12px;">
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; block-size: 40px;">
                  <span style="font: 500 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface);">View</span>
                  <md-divider vertical style="block-size: 24px; align-self: center;"></md-divider>
                  <span style="font: 400 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">List</span>
                  <md-divider vertical style="block-size: 24px; align-self: center;"></md-divider>
                  <span style="font: 400 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">Grid</span>
                  <md-divider vertical style="block-size: 24px; align-self: center;"></md-divider>
                  <span style="font: 400 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">Board</span>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Drag the bottom-right corner — dividers stretch with the list shell.
        </p>
        <div class="div-resp-vp div-resp-live">
          <div style="${listItemStyle}">Item one</div>
          <md-divider inset-start style="--md-divider-inset-start: 56px;"></md-divider>
          <div style="${listItemStyle}">Item two</div>
          <md-divider></md-divider>
          <div style="${listItemStyle}">Item three</div>
        </div>
      </section>
    </div>
  `,
};

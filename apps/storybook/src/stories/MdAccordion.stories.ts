import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/* ── Shadow-piercing test helpers for play() ──────────────────────────
   testing-library can't cross shadow roots, so interactions address the
   real internals directly: each item's header <button> and disclosure
   panel live inside that item's own shadow root. getAccordion() gates on
   hydration of BOTH the accordion and its child items before returning. */
type AccordionEl = HTMLElement;
type ItemEl = HTMLElement;

const itemsOf = (acc: AccordionEl): ItemEl[] =>
  Array.from(acc.querySelectorAll('md-accordion-item')) as ItemEl[];

const getAccordion = async (
  canvasElement: HTMLElement,
  selector = 'md-accordion',
): Promise<AccordionEl> => {
  const acc = canvasElement.querySelector(selector) as AccordionEl;
  await waitFor(() => expect(acc?.classList.contains('hydrated')).toBe(true));
  await waitFor(() =>
    itemsOf(acc).forEach((it) =>
      expect(it.classList.contains('hydrated')).toBe(true),
    ),
  );
  return acc;
};

const headerOf = (item: ItemEl): HTMLButtonElement =>
  item.shadowRoot!.querySelector('.md-accordion-item__header') as HTMLButtonElement;

const panelOf = (item: ItemEl): HTMLElement =>
  item.shadowRoot!.querySelector('.md-accordion-item__panel') as HTMLElement;

/** Count of items whose header currently advertises aria-expanded="true". */
const openCount = (acc: AccordionEl): number =>
  itemsOf(acc).filter(
    (it) => headerOf(it).getAttribute('aria-expanded') === 'true',
  ).length;

const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }),
  );

const meta: Meta = {
  title: 'Containment/Accordion',
  component: 'md-accordion',
  tags: ['autodocs'],
  parameters: {
    docs: { source: { language: 'html' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['filled', 'outlined'],
      description: 'Visual style.',
    },
    density: {
      control: { type: 'select' },
      options: [0, -1, -2],
      description: 'Density scale (0 default, -1 compact, -2 dense).',
    },
    elevation: {
      control: { type: 'select' },
      options: [0, 1, 2, 3, 4, 5],
      description:
        'MD3 elevation level applied to the surface (0 = flat, 5 = highest). Items also lift one level when expanded.',
    },
    reorderable: {
      control: 'boolean',
      description:
        'Allow drag-to-reorder of items. Drag the leading handle, or focus a header and press Alt + ArrowUp / ArrowDown.',
    },
    floating: {
      control: 'boolean',
      description:
        'Render as a free-form draggable panel. Reveals a small move-grip on the first item — grab it to drag the whole accordion anywhere on screen.',
    },
    exclusive: { control: 'boolean', description: 'Only one item open at a time.' },
    keepOneExpanded: {
      control: 'boolean',
      description:
        'Require at least one panel to remain expanded (APG variant — the locked-open button advertises aria-disabled and ignores Enter/Space/click).',
    },
    headingLevel: {
      control: { type: 'select' },
      options: [1, 2, 3, 4, 5, 6],
      description:
        "Heading level for each item's heading wrapper (renders native <h1>–<h6>). Pick the value that matches the page's information architecture.",
    },
    region: {
      control: { type: 'select' },
      options: ['auto', 'always', 'never'],
      description:
        'Region-role policy. `auto` (default) downgrades panels from role=region to role=group past `region-threshold` items, per APG landmark-proliferation guidance.',
    },
    transition: {
      control: { type: 'inline-radio' },
      options: ['expressive', 'standard', 'fade', 'collapse', 'none'],
      description:
        'Motion preset. **expressive** (default) — full MD3 expressive choreography (asymmetric easing, spring chevron, container morph). **standard** — symmetric `emphasized` easing, no spring. **fade** — opacity-led cross-fade, no spatial translate. **collapse** — pure height collapse, no fade. **none** — instant snap.',
    },
  },
  args: {
    variant: 'filled',
    density: 0,
    elevation: 0,
    reorderable: false,
    floating: false,
    exclusive: false,
    keepOneExpanded: false,
    headingLevel: 3,
    region: 'auto',
    transition: 'expressive',
  },
};
export default meta;
type Story = StoryObj;

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="width: 480px;">
      <md-accordion
        variant=${args.variant}
        density=${args.density}
        elevation=${args.elevation}
        heading-level=${args.headingLevel}
        region=${args.region}
        transition=${args.transition}
        ?reorderable=${args.reorderable}
        ?floating=${args.floating}
        ?exclusive=${args.exclusive}
        ?keep-one-expanded=${args.keepOneExpanded}
        default-expanded="0"
      >
        <md-accordion-item headline=${t(globals.locale, 'accordion.account')} supporting-text=${t(globals.locale, 'accordion.emailPassword')}>
          <p>${t(globals.locale, 'accordion.accountBody')}</p>
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.notifications')}>
          <p>${t(globals.locale, 'accordion.notificationsBody')}</p>
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.billing')}>
          <p>${t(globals.locale, 'accordion.billingBody')}</p>
        </md-accordion-item>
      </md-accordion>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const acc = await getAccordion(canvasElement);
    const items = itemsOf(acc);

    await step('Hydrates with item 0 pre-expanded (default-expanded="0")', async () => {
      expect(items.length).toBe(3);
      await waitFor(() =>
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true'),
      );
      expect(headerOf(items[1]).getAttribute('aria-expanded')).toBe('false');
      // The open panel is live; the collapsed one is inert + aria-hidden.
      expect(panelOf(items[0]).hasAttribute('inert')).toBe(false);
      expect(panelOf(items[1]).hasAttribute('inert')).toBe(true);
    });

    await step('Clicking a collapsed header expands its panel + fires mdToggle', async () => {
      const header = headerOf(items[1]);
      const before = header.getAttribute('aria-expanded'); // 'false'
      let detail: { index: number; expanded: boolean; expandedIndices: number[] } | undefined;
      acc.addEventListener(
        'mdToggle',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      header.click();
      // aria-* reflects on the NEXT render flush, so poll for the change.
      await waitFor(() =>
        expect(header.getAttribute('aria-expanded')).not.toBe(before),
      );
      expect(header.getAttribute('aria-expanded')).toBe('true');
      // Panel becomes live (not inert / not aria-hidden) on the same flush.
      await waitFor(() => expect(panelOf(items[1]).hasAttribute('inert')).toBe(false));
      expect(panelOf(items[1]).getAttribute('aria-hidden')).toBe('false');
      // Non-exclusive: item 0 stays open, so both indices are reported.
      expect(detail?.index).toBe(1);
      expect(detail?.expanded).toBe(true);
      expect(detail?.expandedIndices).toEqual([0, 1]);
    });

    await step('Enter on a focused header opens it (keyboard path)', async () => {
      const header = headerOf(items[2]);
      header.focus();
      const before = header.getAttribute('aria-expanded'); // 'false'
      let detail: { index: number; expanded: boolean; expandedIndices: number[] } | undefined;
      acc.addEventListener(
        'mdToggle',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      key(header, 'Enter');
      await waitFor(() =>
        expect(header.getAttribute('aria-expanded')).not.toBe(before),
      );
      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(detail?.index).toBe(2);
      expect(detail?.expandedIndices).toEqual([0, 1, 2]);
    });

    await step('Space on the same header collapses it again (toggles both ways)', async () => {
      const header = headerOf(items[2]);
      const before = header.getAttribute('aria-expanded'); // 'true'
      let detail: { index: number; expanded: boolean; expandedIndices: number[] } | undefined;
      acc.addEventListener(
        'mdToggle',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      key(header, ' ');
      await waitFor(() =>
        expect(header.getAttribute('aria-expanded')).not.toBe(before),
      );
      expect(header.getAttribute('aria-expanded')).toBe('false');
      await waitFor(() => expect(panelOf(items[2]).hasAttribute('inert')).toBe(true));
      expect(detail?.expanded).toBe(false);
      expect(detail?.expandedIndices).toEqual([0, 1]);
      // Let the collapse animation settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Arrow / Home / End rove focus across headers (APG keyboard model)', async () => {
      const h0 = headerOf(items[0]);
      h0.focus();
      // ArrowDown → focus moves to the next header (item 1).
      key(h0, 'ArrowDown');
      await waitFor(() =>
        expect(items[1].shadowRoot!.activeElement).toBe(headerOf(items[1])),
      );
      // ArrowUp → back to the previous header (item 0).
      key(headerOf(items[1]), 'ArrowUp');
      await waitFor(() =>
        expect(items[0].shadowRoot!.activeElement).toBe(headerOf(items[0])),
      );
      // End → jump to the last header…
      key(headerOf(items[0]), 'End');
      await waitFor(() =>
        expect(items[2].shadowRoot!.activeElement).toBe(headerOf(items[2])),
      );
      // …Home → back to the first.
      key(headerOf(items[2]), 'Home');
      await waitFor(() =>
        expect(items[0].shadowRoot!.activeElement).toBe(headerOf(items[0])),
      );
      // Roving focus must NOT toggle anything — items 0 and 1 stay open.
      expect(openCount(acc)).toBe(2);
    });

    await step('Switching into exclusive mode collapses all but the first open item', async () => {
      // Items 0 and 1 are both open from the steps above.
      expect(openCount(acc)).toBe(2);
      (acc as HTMLElement & { exclusive: boolean }).exclusive = true;
      // onExclusiveChange keeps the first open item and collapses the rest.
      await waitFor(() =>
        expect(headerOf(items[1]).getAttribute('aria-expanded')).toBe('false'),
      );
      expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true');
      expect(openCount(acc)).toBe(1);
    });

    await step('Reset to the clean resting state for the visual snapshot', async () => {
      // Restore the `exclusive` prop toggled above to its initial arg value
      // (leaving exclusive mode is a no-op for item state — item 0 stays open).
      (acc as HTMLElement & { exclusive: boolean }).exclusive = false;
      // Drop the roving focus so no header renders a focus ring in the shot.
      items.forEach((it) => (it.shadowRoot!.activeElement as HTMLElement | null)?.blur());
      (document.activeElement as HTMLElement)?.blur();
      // End state matches the fresh render: item 0 expanded, items 1 & 2 collapsed,
      // nothing focused, `exclusive` back to false.
      await waitFor(() => {
        expect(openCount(acc)).toBe(1);
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true');
        expect((acc as HTMLElement & { exclusive: boolean }).exclusive).toBe(false);
      });
      // Let the exclusive-mode collapse animation settle before the screenshot.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Variants ────────────────────────────────────────────── */
export const Variants: Story = {
  render: () => html`
    <div style="display: grid; gap: 32px; max-width: 520px;">
      <div>
        <div style="${labelStyle}">Filled (tiles with gaps)</div>
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Section 1">Body 1</md-accordion-item>
          <md-accordion-item headline="Section 2">Body 2</md-accordion-item>
          <md-accordion-item headline="Section 3">Body 3</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">Outlined (shared chassis)</div>
        <md-accordion variant="outlined" default-expanded="1">
          <md-accordion-item headline="Terms" supporting-text="Updated 12 May 2026">
            <p>Lorem ipsum dolor sit amet…</p>
          </md-accordion-item>
          <md-accordion-item headline="Privacy">
            <p>We respect your privacy. Here's how…</p>
          </md-accordion-item>
          <md-accordion-item headline="Cookies">
            <p>This site uses cookies for…</p>
          </md-accordion-item>
        </md-accordion>
      </div>
    </div>
  `,
};

/* ─── Density ─────────────────────────────────────────────── */
export const Density: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; max-width: 520px;">
      <div>
        <div style="${labelStyle}">Default (56px header)</div>
        <md-accordion>
          <md-accordion-item headline="Default density">Lorem ipsum.</md-accordion-item>
          <md-accordion-item headline="Default density">Lorem ipsum.</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">Density -1 (48px)</div>
        <md-accordion density="-1">
          <md-accordion-item headline="Compact">Lorem ipsum.</md-accordion-item>
          <md-accordion-item headline="Compact">Lorem ipsum.</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">Density -2 (40px)</div>
        <md-accordion density="-2">
          <md-accordion-item headline="Dense">Lorem ipsum.</md-accordion-item>
          <md-accordion-item headline="Dense">Lorem ipsum.</md-accordion-item>
        </md-accordion>
      </div>
    </div>
  `,
};

/* ─── Elevation ───────────────────────────────────────────── */
export const Elevation: Story = {
  render: () => html`
    <div style="display: grid; gap: 32px; max-width: 560px; padding: 16px;">
      <div>
        <div style="${labelStyle}">Filled — every tile carries its own shadow; expanded item lifts one M3 level</div>
        <div style="display: grid; gap: 28px;">
          ${[0, 1, 2, 3, 4, 5].map(
            (n) => html`
              <div>
                <div style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); padding-bottom: 6px;">
                  elevation = ${n}
                </div>
                <md-accordion elevation=${n} default-expanded="0">
                  <md-accordion-item headline="Account" supporting-text="Email & password" icon="person">
                    <p style="margin: 0;">Update your email address, change your password, manage two-factor authentication.</p>
                  </md-accordion-item>
                  <md-accordion-item headline="Notifications" icon="notifications">
                    <p style="margin: 0;">Email digest, in-app banners, mobile push.</p>
                  </md-accordion-item>
                </md-accordion>
              </div>
            `,
          )}
        </div>
      </div>

      <div>
        <div style="${labelStyle}">Outlined — shadow is drawn on the shared chassis</div>
        <div style="display: grid; gap: 28px;">
          ${[0, 1, 3, 5].map(
            (n) => html`
              <div>
                <div style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); padding-bottom: 6px;">
                  elevation = ${n}
                </div>
                <md-accordion variant="outlined" elevation=${n} default-expanded="1">
                  <md-accordion-item headline="Terms">Lorem ipsum…</md-accordion-item>
                  <md-accordion-item headline="Privacy">We respect your privacy…</md-accordion-item>
                  <md-accordion-item headline="Cookies">This site uses cookies…</md-accordion-item>
                </md-accordion>
              </div>
            `,
          )}
        </div>
      </div>
    </div>
  `,
};

/* ─── Transitions ─────────────────────────────────────────── */
export const Transitions: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Five motion presets ship out of the box, controlled via the `transition` ' +
          'prop on `<md-accordion>`. The prop is reflected as an attribute, so child ' +
          'items pick it up automatically through `:host-context(...)` — no per-item ' +
          'wiring required.\n\n' +
          '- **expressive** (default) — full MD3 Expressive choreography: asymmetric ' +
          'easing (`emphasized-decelerate` on open / `emphasized-accelerate` on close), ' +
          'spring-spatial chevron rotation with overshoot, container shape & elevation ' +
          'morph, leading-icon FILL-axis swap.\n' +
          '- **standard** — symmetric MD3 `emphasized` easing, no spring overshoot. The ' +
          '"product" preset — same shape morph + tone shift, calmer timing.\n' +
          '- **fade** — opacity-led cross-fade. The inner translateY is suppressed so ' +
          'the motion reads as a quiet dissolve.\n' +
          '- **collapse** — pure height collapse with `ease-out` / `ease-in`. No fade, ' +
          'no spring, no spatial sub-motion. Classic browser-disclosure feel.\n' +
          '- **none** — every transition is killed. Instant snap. Ideal for ' +
          'screenshot harnesses, automated tests, ambient layouts that should never ' +
          'pull focus.\n\n' +
          'Hit the **Toggle all** button below to compare the five presets side-by-side ' +
          'on the same gesture.',
      },
    },
  },
  render: () => {
    const presets: Array<{ id: string; name: string; blurb: string }> = [
      {
        id: 'expressive',
        name: 'expressive',
        blurb:
          'Default MD3 Expressive: asymmetric emphasized easing, spring chevron, container morph.',
      },
      {
        id: 'standard',
        name: 'standard',
        blurb: 'Symmetric MD3 emphasized easing — calmer, "product" preset.',
      },
      {
        id: 'fade',
        name: 'fade',
        blurb: 'Opacity-led cross-fade. No spatial sub-motion.',
      },
      {
        id: 'collapse',
        name: 'collapse',
        blurb: 'Pure height collapse. No fade, no spring.',
      },
      {
        id: 'none',
        name: 'none',
        blurb: 'Instant snap. Zero animation.',
      },
    ];

    const toggleAll = () => {
      document.querySelectorAll<HTMLElement>('.tx-demo md-accordion').forEach((acc) => {
        const first = acc.querySelector('md-accordion-item') as
          | (HTMLElement & { expanded?: boolean })
          | null;
        if (first) first.expanded = !first.expanded;
      });
    };

    return html`
      <style>
        .tx-page {
          padding: 24px;
          max-inline-size: 1280px;
          margin-inline: auto;
        }
        .tx-page__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-block-end: 20px;
        }
        .tx-page__head h2 {
          margin: 0;
          font: 500 22px/28px Roboto, sans-serif;
        }
        .tx-page__head button {
          font: 500 14px/20px Roboto, sans-serif;
          padding: 10px 20px;
          border-radius: 999px;
          border: none;
          background: var(--md-sys-color-primary, #6750A4);
          color: var(--md-sys-color-on-primary, #FFFBFE);
          cursor: pointer;
          box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0, 0, 0, 0.12));
          transition: box-shadow 200ms ease, transform 200ms ease;
        }
        .tx-page__head button:hover {
          box-shadow: var(--md-sys-elevation-2, 0 2px 4px rgba(0, 0, 0, 0.16));
          transform: translateY(-1px);
        }
        .tx-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .tx-card {
          display: grid;
          gap: 12px;
        }
        .tx-card__head {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .tx-card__name {
          font: 500 13px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .tx-card__chip {
          font: 500 10px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-tertiary-container, #31111D);
          background: var(--md-sys-color-tertiary-container, #FFD8E4);
          padding: 1px 6px;
          border-radius: 999px;
        }
        .tx-card__blurb {
          margin: 0;
          font: 400 12px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
      </style>

      <div class="tx-page">
        <header class="tx-page__head">
          <h2>Motion presets</h2>
          <button type="button" @click=${toggleAll}>Toggle all · first item</button>
        </header>

        <div class="tx-grid tx-demo">
          ${presets.map(
            (p) => html`
              <div class="tx-card">
                <div class="tx-card__head">
                  <span class="tx-card__name">${p.name}</span>
                  <span class="tx-card__chip">transition="${p.id}"</span>
                </div>
                <p class="tx-card__blurb">${p.blurb}</p>
                <md-accordion transition=${p.id} default-expanded="0" elevation="1">
                  <md-accordion-item headline="Account" supporting-text="Email & password" icon="person">
                    <p style="margin:0;">
                      Update your email address, change your password, manage two-factor
                      authentication.
                    </p>
                  </md-accordion-item>
                  <md-accordion-item headline="Notifications" icon="notifications">
                    <p style="margin:0;">Email digest, in-app banners, mobile push.</p>
                  </md-accordion-item>
                  <md-accordion-item headline="Billing" icon="credit_card">
                    <p style="margin:0;">Plan, invoices, payment method on file.</p>
                  </md-accordion-item>
                </md-accordion>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  },
};

/* ─── Transitions · pair with custom durations ───────────────── */
export const TransitionsCustomDurations: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The presets re-bind the same internal duration variables you would override ' +
          'manually via `--md-accordion-item-expand-duration` and ' +
          '`--md-accordion-item-collapse-duration`. Set those tokens on the host (or a ' +
          'class) to slow the motion down or speed it up while keeping the preset\'s ' +
          'easing curve.',
      },
    },
  },
  render: () => html`
    <style>
      .slow {
        --md-accordion-item-expand-duration: 800ms;
        --md-accordion-item-collapse-duration: 600ms;
      }
      .fast {
        --md-accordion-item-expand-duration: 120ms;
        --md-accordion-item-collapse-duration: 100ms;
      }
    </style>
    <div style="display: grid; gap: 24px; max-inline-size: 520px; padding: 16px;">
      <section>
        <div style="${labelStyle}">Default duration · transition="standard"</div>
        <md-accordion transition="standard" default-expanded="0">
          <md-accordion-item headline="Default 300ms / 200ms" icon="schedule">Lorem ipsum.</md-accordion-item>
          <md-accordion-item headline="Default 300ms / 200ms" icon="schedule">Lorem ipsum.</md-accordion-item>
        </md-accordion>
      </section>
      <section>
        <div style="${labelStyle}">Slow · 800ms / 600ms</div>
        <md-accordion transition="standard" class="slow" default-expanded="0">
          <md-accordion-item headline="Slow expand/collapse" icon="timer">Watch the easing stretch.</md-accordion-item>
          <md-accordion-item headline="Slow expand/collapse" icon="timer">Watch the easing stretch.</md-accordion-item>
        </md-accordion>
      </section>
      <section>
        <div style="${labelStyle}">Fast · 120ms / 100ms</div>
        <md-accordion transition="standard" class="fast" default-expanded="0">
          <md-accordion-item headline="Snappy" icon="bolt">Almost instant — but still eased.</md-accordion-item>
          <md-accordion-item headline="Snappy" icon="bolt">Almost instant — but still eased.</md-accordion-item>
        </md-accordion>
      </section>
    </div>
  `,
};

/* ─── With Icons ──────────────────────────────────────────── */
export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 480px;">
      <md-accordion>
        <md-accordion-item headline=${t(globals.locale, 'accordion.profile')} icon="person">
          ${t(globals.locale, 'accordion.profileBody')}
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.security')} icon="lock">
          ${t(globals.locale, 'accordion.securityBody')}
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.notifications')} icon="notifications">
          ${t(globals.locale, 'accordion.notificationsBodyShort')}
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.integrations')} icon="extension">
          Slack, GitHub, Linear.
        </md-accordion-item>
      </md-accordion>
    </div>
  `,
};

/* ─── Reorderable ─────────────────────────────────────────── */
export const Reorderable: Story = {
  render: () => html`
    <style>
      .reorder-demo .log {
        margin-top: 16px;
        padding: 12px 16px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        border-radius: 12px;
        font: 400 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        max-height: 120px;
        overflow: auto;
      }
    </style>
    <div class="reorder-demo" style="width: 520px;">
      <div style="${labelStyle}">
        Drag the grip on the leading edge — or focus a header and press
        <kbd>Alt+&uarr;</kbd>&thinsp;/&thinsp;<kbd>Alt+&darr;</kbd>.
      </div>
      <md-accordion
        reorderable
        elevation="1"
        @mdReorder=${(e: CustomEvent) => {
          const log = document.querySelector('.reorder-demo .log');
          if (!log) return;
          const { from, to, order } = e.detail;
          const line = document.createElement('div');
          line.textContent = `mdReorder → from: ${from}, to: ${to}, order: [${order.join(', ')}]`;
          log.prepend(line);
        }}
      >
        <md-accordion-item headline="Account" supporting-text="Email & password" icon="person">
          <p style="margin:0;">Update your email address, change your password, manage two-factor authentication.</p>
        </md-accordion-item>
        <md-accordion-item headline="Notifications" icon="notifications">
          <p style="margin:0;">Email digest, in-app banners, mobile push.</p>
        </md-accordion-item>
        <md-accordion-item headline="Billing" icon="credit_card">
          <p style="margin:0;">Plan, invoices, payment method on file.</p>
        </md-accordion-item>
        <md-accordion-item headline="Integrations" icon="extension">
          <p style="margin:0;">Slack, GitHub, Linear.</p>
        </md-accordion-item>
        <md-accordion-item headline="Locked feature" icon="lock" disabled>
          <p style="margin:0;">Disabled items can't be moved.</p>
        </md-accordion-item>
      </md-accordion>
      <div class="log" aria-live="polite">mdReorder events appear here…</div>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const acc = await getAccordion(canvasElement);
    const headlines = () => itemsOf(acc).map((it) => it.getAttribute('headline'));
    const altArrow = (target: Element, dir: 'ArrowUp' | 'ArrowDown') =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: dir,
          altKey: true,
          bubbles: true,
          composed: true,
        }),
      );

    await step('Alt+ArrowDown reorders the focused item down and fires mdReorder', async () => {
      const items = itemsOf(acc);
      expect(items.length).toBe(5);
      expect(headlines()).toEqual([
        'Account',
        'Notifications',
        'Billing',
        'Integrations',
        'Locked feature',
      ]);
      let detail: { from: number; to: number; order: number[] } | undefined;
      acc.addEventListener(
        'mdReorder',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      altArrow(headerOf(items[0]), 'ArrowDown');
      // The DOM re-orders once on the keyboard gesture; item 0 drops to row 1.
      await waitFor(() =>
        expect(headlines()).toEqual([
          'Notifications',
          'Account',
          'Billing',
          'Integrations',
          'Locked feature',
        ]),
      );
      expect(detail?.from).toBe(0);
      expect(detail?.to).toBe(1);
      // `order` re-expresses the new sequence against the ORIGINAL indices.
      expect(detail?.order).toEqual([1, 0, 2, 3, 4]);
      // Focus follows the moved item to its new row.
      await waitFor(() =>
        expect(itemsOf(acc)[1].shadowRoot!.activeElement).toBe(
          headerOf(itemsOf(acc)[1]),
        ),
      );
    });

    await step('Alt+ArrowUp at the top edge is a guarded no-op', async () => {
      const items = itemsOf(acc);
      let fired = false;
      const onReorder = () => { fired = true; };
      acc.addEventListener('mdReorder', onReorder);
      altArrow(headerOf(items[0]), 'ArrowUp'); // item at index 0 → to = -1, rejected
      await new Promise((r) => setTimeout(r, 60));
      acc.removeEventListener('mdReorder', onReorder);
      expect(fired).toBe(false);
      expect(headlines()[0]).toBe('Notifications'); // order unchanged
    });

    await step('Alt+ArrowUp moves an item back up, restoring the original order', async () => {
      const items = itemsOf(acc);
      let detail: { from: number; to: number; order: number[] } | undefined;
      acc.addEventListener(
        'mdReorder',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      altArrow(headerOf(items[1]), 'ArrowUp'); // "Account" now sits at index 1
      await waitFor(() =>
        expect(headlines()).toEqual([
          'Account',
          'Notifications',
          'Billing',
          'Integrations',
          'Locked feature',
        ]),
      );
      expect(detail?.from).toBe(1);
      expect(detail?.to).toBe(0);
    });

    await step('Pointer-dragging the leading handle reorders on drop', async () => {
      const items = itemsOf(acc);
      const handle = items[0].shadowRoot!.querySelector(
        '[data-accordion-drag-handle="true"]',
      ) as HTMLElement;
      const r0 = items[0].getBoundingClientRect();
      const r1 = items[1].getBoundingClientRect();
      const px = r0.left + 20;
      const py = r0.top + r0.height / 2;
      // Push the dragged row's centre just past the second row's centre (but
      // short of the third), so the computed drop target settles on index 1.
      const dy = Math.round(1.5 * (r1.top - r0.top));
      let detail: { from: number; to: number; order: number[] } | undefined;
      acc.addEventListener(
        'mdReorder',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          button: 0,
          clientX: px,
          clientY: py,
          bubbles: true,
          composed: true,
        }),
      );
      acc.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          clientX: px,
          clientY: py + dy,
          bubbles: true,
          composed: true,
        }),
      );
      acc.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 2,
          clientX: px,
          clientY: py + dy,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(detail?.from).toBe(0));
      expect(detail?.to).toBe(1);
      // The pointer path physically moved "Account" out of the first row.
      await waitFor(() =>
        expect(headlines()).toEqual([
          'Notifications',
          'Account',
          'Billing',
          'Integrations',
          'Locked feature',
        ]),
      );
      await new Promise((r) => setTimeout(r, 60));
    });

    await step('Reset order, focus, and event log to the clean resting state', async () => {
      // The gestures above left "Account" at row 1; move it back to the top so
      // the DOM order matches the fresh render (Account, Notifications, …).
      const accountIdx = headlines().indexOf('Account');
      if (accountIdx > 0) {
        altArrow(headerOf(itemsOf(acc)[accountIdx]), 'ArrowUp');
        await waitFor(() =>
          expect(headlines()).toEqual([
            'Account',
            'Notifications',
            'Billing',
            'Integrations',
            'Locked feature',
          ]),
        );
      }
      // Blur the header the reorder gestures left focused — no focus ring in the shot.
      itemsOf(acc).forEach(
        (it) => (it.shadowRoot!.activeElement as HTMLElement | null)?.blur(),
      );
      (document.activeElement as HTMLElement)?.blur();
      // The demo log prepended a line per mdReorder; restore its initial placeholder.
      const log = canvasElement.querySelector('.reorder-demo .log');
      if (log) log.textContent = 'mdReorder events appear here…';
      // Let the reorder settle before the screenshot.
      await new Promise((r) => setTimeout(r, 60));
    });
  },
};

/* ─── Floating (drag anywhere) ───────────────────────────── */
export const Floating: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'A free-form draggable panel. A small move-grip appears in the top-left corner ' +
          'of the first item — grab it and drag to move the whole accordion anywhere on screen. ' +
          "The rest of the accordion behaves normally: header clicks still toggle items. " +
          "Useful for inspector palettes, floating toolwindows, ad-hoc settings popovers, and any other case where the accordion shouldn't be tied to a fixed position.\n\n" +
          'Events:\n' +
          '- `mdDragStart` — fires once when a drag begins.\n' +
          '- `mdDragMove` — fires continuously while dragging.\n' +
          '- `mdDragEnd` — fires when the pointer is released.',
      },
    },
  },
  render: () => html`
    <style>
      .floating-demo {
        position: relative;
        block-size: 600px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        background-image:
          linear-gradient(var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px),
          linear-gradient(90deg, var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px);
        background-size: 24px 24px;
        background-position: -1px -1px;
        border-radius: 12px;
        overflow: hidden;
        padding: 16px;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
      .floating-demo__hint {
        display: inline-block;
        background: var(--md-sys-color-surface, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        border-radius: 999px;
        padding: 4px 12px;
        font: 500 12px/16px Roboto, sans-serif;
      }
      .floating-demo .log {
        position: absolute;
        inset-block-end: 16px;
        inset-inline-end: 16px;
        inline-size: 280px;
        max-block-size: 140px;
        overflow: auto;
        padding: 12px 14px;
        background: var(--md-sys-color-surface, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        border-radius: 12px;
        font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        box-shadow: var(--md-sys-elevation-1, 0 1px 2px rgba(0, 0, 0, 0.12));
      }
    </style>
    <div class="floating-demo">
      <span class="floating-demo__hint">
        Grab the small move-grip on the top-left of the first item — the accordion
        follows the pointer anywhere on screen.
      </span>

      <md-accordion
        floating
        initial-x="48"
        initial-y="80"
        default-expanded="0"
        @mdDragStart=${(e: CustomEvent) => {
          const log = document.querySelector('.floating-demo .log');
          if (!log) return;
          const line = document.createElement('div');
          line.textContent = `mdDragStart → (${Math.round(e.detail.x)}, ${Math.round(e.detail.y)})`;
          log.prepend(line);
        }}
        @mdDragEnd=${(e: CustomEvent) => {
          const log = document.querySelector('.floating-demo .log');
          if (!log) return;
          const line = document.createElement('div');
          line.textContent = `mdDragEnd   → (${Math.round(e.detail.x)}, ${Math.round(e.detail.y)})  Δ(${Math.round(e.detail.dx)}, ${Math.round(e.detail.dy)})`;
          log.prepend(line);
        }}
      >
        <md-accordion-item headline="Layout" supporting-text="Position & size" icon="dashboard">
          <p style="margin:0;">X, Y, width, height, rotation.</p>
        </md-accordion-item>
        <md-accordion-item headline="Appearance" icon="palette">
          <p style="margin:0;">Fill, stroke, opacity, blend mode.</p>
        </md-accordion-item>
        <md-accordion-item headline="Effects" icon="auto_awesome">
          <p style="margin:0;">Shadow, blur, glow.</p>
        </md-accordion-item>
        <md-accordion-item headline="Typography" icon="text_fields">
          <p style="margin:0;">Font, weight, size, leading, tracking.</p>
        </md-accordion-item>
      </md-accordion>

      <!-- A second panel — independently draggable -->
      <md-accordion
        floating
        variant="outlined"
        initial-x="440"
        initial-y="260"
      >
        <md-accordion-item headline="Background" icon="image">
          Move and resize the background layer.
        </md-accordion-item>
        <md-accordion-item headline="Foreground" icon="layers">
          Subject and props.
        </md-accordion-item>
        <md-accordion-item headline="UI Overlay" icon="grid_view">
          Buttons, labels, HUD.
        </md-accordion-item>
      </md-accordion>

      <div class="log" aria-live="polite">Drag events appear here…</div>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const acc = await getAccordion(canvasElement);
    const items = itemsOf(acc);

    await step('Floating panel seeds its transform from initial-x / initial-y', async () => {
      // componentDidLoad copies initial-x / initial-y into the chassis translate.
      await waitFor(() =>
        expect(acc.style.transform).toContain('translate3d(48px, 80px'),
      );
      // The chassis-drag grip is tucked onto the FIRST item only.
      expect(items[0].hasAttribute('data-chassis-handle')).toBe(true);
      expect(items[1].hasAttribute('data-chassis-handle')).toBe(false);
      // bring-to-front (default) assigned a stacking z-index at mount.
      expect(acc.style.zIndex).not.toBe('');
    });

    await step('Dragging the chassis grip translates the panel and fires drag events', async () => {
      const grip = items[0].shadowRoot!.querySelector(
        '[data-accordion-chassis-drag="true"]',
      ) as HTMLElement;
      const starts: Array<{ x: number; y: number; dx: number; dy: number }> = [];
      const moves: Array<{ x: number; y: number; dx: number; dy: number }> = [];
      const ends: Array<{ x: number; y: number; dx: number; dy: number }> = [];
      const onStart = (e: Event) => starts.push((e as CustomEvent).detail);
      const onMove = (e: Event) => moves.push((e as CustomEvent).detail);
      const onEnd = (e: Event) => ends.push((e as CustomEvent).detail);
      acc.addEventListener('mdDragStart', onStart);
      acc.addEventListener('mdDragMove', onMove);
      acc.addEventListener('mdDragEnd', onEnd);

      const rect = grip.getBoundingClientRect();
      const x0 = rect.left + rect.width / 2 || 60;
      const y0 = rect.top + rect.height / 2 || 90;
      grip.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          button: 0,
          clientX: x0,
          clientY: y0,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(starts.length).toBe(1));
      acc.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: x0 + 60,
          clientY: y0 + 40,
          bubbles: true,
          composed: true,
        }),
      );
      acc.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: x0 + 120,
          clientY: y0 + 90,
          bubbles: true,
          composed: true,
        }),
      );
      // Each pointermove streams one mdDragMove (no component-side throttle).
      await waitFor(() => expect(moves.length).toBe(2));
      acc.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          clientX: x0 + 120,
          clientY: y0 + 90,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(ends.length).toBe(1));
      acc.removeEventListener('mdDragStart', onStart);
      acc.removeEventListener('mdDragMove', onMove);
      acc.removeEventListener('mdDragEnd', onEnd);

      // Drag detail carries the cumulative delta and the new translated origin
      // (seeded 48 / 80 from initial-x / initial-y, plus the 120 / 90 drag).
      expect(ends[0].dx).toBe(120);
      expect(ends[0].dy).toBe(90);
      expect(ends[0].x).toBe(48 + 120);
      expect(ends[0].y).toBe(80 + 90);
      // The host transform reflects the drop position.
      await waitFor(() =>
        expect(acc.style.transform).toContain('translate3d(168px, 170px'),
      );
    });
  },
};

/* ─── Floating + reorderable ──────────────────────────────── */
export const FloatingReorderable: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Floating panels and reorderable items combine — drag the small move-grip ' +
          'in the top-left corner of the first item to move the whole accordion, or drag ' +
          'a per-item handle to reorder. Both gestures are mutually exclusive based on the pointer-down target.',
      },
    },
  },
  render: () => html`
    <div style="position: relative; block-size: 540px; background: var(--md-sys-color-surface-container-lowest, #FFFBFE); border-radius: 12px; padding: 24px;">
      <md-accordion
        floating
        reorderable
        initial-x="80"
        initial-y="64"
      >
        <md-accordion-item headline="Account" icon="person">Update profile.</md-accordion-item>
        <md-accordion-item headline="Notifications" icon="notifications">Email, push.</md-accordion-item>
        <md-accordion-item headline="Billing" icon="credit_card">Plan & invoices.</md-accordion-item>
        <md-accordion-item headline="Integrations" icon="extension">Slack, GitHub.</md-accordion-item>
      </md-accordion>
    </div>
  `,
};

/* ─── Controlled vs uncontrolled state ────────────────────── */
export const ControlledAndUncontrolled: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The accordion supports both stateful patterns out of the box. **Pick whichever fits your app**, and you can mix the two on the same page.\n\n' +
          '### Uncontrolled (component owns the state)\n\n' +
          'Set <code>default-expanded</code> on the parent (or <code>expanded</code> on individual items) at mount time and let the accordion manage which items are open from then on. <code>mdToggle</code> is informational — you don\'t need to listen to it for the UI to work.\n\n' +
          '```html\n' +
          '<md-accordion default-expanded="0,2">\n' +
          '  <md-accordion-item headline="Account">…</md-accordion-item>\n' +
          '  <md-accordion-item headline="Billing">…</md-accordion-item>\n' +
          '  <md-accordion-item headline="Privacy">…</md-accordion-item>\n' +
          '</md-accordion>\n' +
          '```\n\n' +
          '### Controlled (your app owns the state)\n\n' +
          'Drive the open/closed set from your own state container (Redux, Pinia, signals, useState — whatever you use). Listen to <code>mdToggle</code>, update your state, then push the new <code>expanded</code> values back onto the items. Other parts of the UI (toolbars, keyboard shortcuts, server pushes) can drive the accordion just as well.\n\n' +
          '```js\n' +
          'let openSet = new Set([0]);\n' +
          'accordion.addEventListener("mdToggle", (e) => {\n' +
          '  openSet = new Set(e.detail.expandedIndices);\n' +
          '  // …push to your store, render, etc.\n' +
          '  syncDom();\n' +
          '});\n' +
          'function syncDom() {\n' +
          '  accordion.querySelectorAll("md-accordion-item").forEach((it, i) => {\n' +
          '    it.expanded = openSet.has(i);\n' +
          '  });\n' +
          '}\n' +
          '```\n\n' +
          'The example below puts the two patterns side by side, with the controlled accordion driven entirely from external buttons (Expand all, Collapse all, Open random) and a single source-of-truth label that mirrors the live state.',
      },
    },
  },
  render: () => {
    setTimeout(() => {
      const root = document.querySelector('.cu-demo');
      if (root) bootstrapControlledUncontrolled(root as HTMLElement);
    }, 0);
    return html`
      <style>
        .cu-demo {
          max-inline-size: 1180px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 32px;
          font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
        }
        .cu-demo h3 {
          margin: 0 0 4px;
          font: 500 13px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .cu-demo p {
          margin: 0 0 14px;
          font: 400 13px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          max-inline-size: 760px;
        }
        .cu-demo code {
          background: var(--md-sys-color-surface-container, #F3EDF7);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
        }
        .cu-cols {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          align-items: start;
        }
        .cu-card {
          padding: 20px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          display: grid;
          gap: 14px;
        }
        .cu-card__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .cu-card__title {
          font: 500 16px/24px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .cu-card__tag {
          font: 600 10px/12px ui-monospace, SFMono-Regular, Menlo, monospace;
          padding: 4px 8px;
          border-radius: 999px;
          background: var(--md-sys-color-secondary-container, #E8DEF8);
          color: var(--md-sys-color-on-secondary-container, #1D192B);
          letter-spacing: 0.6px;
        }
        .cu-card__tag--ctrl {
          background: var(--md-sys-color-primary, #6750A4);
          color: var(--md-sys-color-on-primary, #FFFFFF);
        }
        .cu-card__state {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--md-sys-color-surface-container, #F3EDF7);
          font: 500 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .cu-card__state strong {
          color: var(--md-sys-color-primary, #6750A4);
        }
        .cu-card__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cu-card__hint {
          margin: 0;
          font: 400 12px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .cu-compare {
          width: 100%;
          border-collapse: collapse;
          font: 400 13px/20px Roboto, sans-serif;
        }
        .cu-compare th, .cu-compare td {
          text-align: start;
          padding: 8px 12px;
          border-block-end: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          vertical-align: top;
        }
        .cu-compare th {
          font-weight: 500;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          background: var(--md-sys-color-surface-container, #F3EDF7);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.6px;
        }
      </style>

      <div class="cu-demo">
        <section class="cu-cols">
          <!-- ── Uncontrolled ─────────────────────────────── -->
          <article class="cu-card cu-card--uncontrolled">
            <header class="cu-card__head">
              <span class="cu-card__title">Uncontrolled</span>
              <span class="cu-card__tag">component-owned</span>
            </header>
            <p class="cu-card__hint">
              <code>default-expanded="0,2"</code> seeds the initial state.
              From then on the accordion manages itself; the field below
              just reports what <code>mdToggle</code> emits.
            </p>
            <md-accordion class="cu-card__accordion" default-expanded="0,2">
              <md-accordion-item headline="Account"   icon="person">Profile, password, 2FA.</md-accordion-item>
              <md-accordion-item headline="Billing"   icon="credit_card">Plan &amp; invoices.</md-accordion-item>
              <md-accordion-item headline="Privacy"   icon="lock">Data &amp; cookies.</md-accordion-item>
              <md-accordion-item headline="Advanced"  icon="tune">Experimental flags.</md-accordion-item>
            </md-accordion>
            <div class="cu-card__state" aria-live="polite">
              expandedIndices: <strong class="cu-card__indices">[0, 2]</strong>
            </div>
          </article>

          <!-- ── Controlled ───────────────────────────────── -->
          <article class="cu-card cu-card--controlled">
            <header class="cu-card__head">
              <span class="cu-card__title">Controlled</span>
              <span class="cu-card__tag cu-card__tag--ctrl">app-owned</span>
            </header>
            <p class="cu-card__hint">
              The buttons mutate an external <code>Set&lt;number&gt;</code>;
              that set is the single source of truth. The accordion only
              renders what's in the set, regardless of whether the change
              came from a click, a button, or any other surface.
            </p>
            <md-accordion class="cu-card__accordion">
              <md-accordion-item headline="Account"   icon="person">Profile, password, 2FA.</md-accordion-item>
              <md-accordion-item headline="Billing"   icon="credit_card">Plan &amp; invoices.</md-accordion-item>
              <md-accordion-item headline="Privacy"   icon="lock">Data &amp; cookies.</md-accordion-item>
              <md-accordion-item headline="Advanced"  icon="tune">Experimental flags.</md-accordion-item>
            </md-accordion>
            <div class="cu-card__controls">
              <md-button class="cu-card__btn-expand"   variant="filled"   size="sm" icon="unfold_more">Expand all</md-button>
              <md-button class="cu-card__btn-collapse" variant="outlined" size="sm" icon="unfold_less">Collapse all</md-button>
              <md-button class="cu-card__btn-random"   variant="tonal"    size="sm" icon="casino">Open random</md-button>
              <md-button class="cu-card__btn-only-1"   variant="text"     size="sm" icon="filter_1">Only item 1</md-button>
            </div>
            <div class="cu-card__state" aria-live="polite">
              app state: <strong class="cu-card__indices">[]</strong>
            </div>
          </article>
        </section>

        <section>
          <h3>When to pick which</h3>
          <table class="cu-compare">
            <thead>
              <tr>
                <th></th>
                <th>Uncontrolled</th>
                <th>Controlled</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Setup</strong></td>
                <td><code>default-expanded</code> on the parent, or <code>expanded</code> on individual items.</td>
                <td>No <code>default-expanded</code>. Listen to <code>mdToggle</code> and re-apply <code>expanded</code> on the items.</td>
              </tr>
              <tr>
                <td><strong>Source of truth</strong></td>
                <td>Inside the component.</td>
                <td>Anywhere in your app — store, signal, server response, URL.</td>
              </tr>
              <tr>
                <td><strong>Best for</strong></td>
                <td>Marketing pages, FAQs, docs, anywhere you don't need to read or override the state from outside.</td>
                <td>Settings pages with deep links, modal flows, undo / redo, server-driven UIs, multi-pane layouts that need to coordinate.</td>
              </tr>
              <tr>
                <td><strong>Reading state</strong></td>
                <td>Inspect <code>md-accordion-item.expanded</code> on each item, or listen to <code>mdToggle</code>.</td>
                <td>Read your store directly.</td>
              </tr>
              <tr>
                <td><strong>Driving from outside</strong></td>
                <td>Call <code>await item.toggle()</code> on the item.</td>
                <td>Mutate your store; sync runs in your <code>mdToggle</code> handler / effect.</td>
              </tr>
              <tr>
                <td><strong>Mix &amp; match?</strong></td>
                <td colspan="2">Yes. Most real apps are uncontrolled until they aren't — start simple, lift state when you need it.</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    `;
  },
};

/* ─── Exclusive ───────────────────────────────────────────── */
export const Exclusive: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 480px;">
      <div style="${labelStyle}">Only one item can be open at a time.</div>
      <md-accordion exclusive default-expanded="0">
        <md-accordion-item headline=${t(globals.locale, 'accordion.step1')}>Form…</md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.step2')}>Form…</md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.step3')}>Summary…</md-accordion-item>
      </md-accordion>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const acc = await getAccordion(canvasElement);
    const items = itemsOf(acc);

    await step('Hydrates with exactly one panel open (item 0)', async () => {
      expect(items.length).toBe(3);
      await waitFor(() =>
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true'),
      );
      expect(openCount(acc)).toBe(1);
    });

    await step('GUARD: opening item 2 auto-collapses the previously-open item 0', async () => {
      const h0 = headerOf(items[0]);
      const h2 = headerOf(items[2]);
      expect(h0.getAttribute('aria-expanded')).toBe('true'); // precondition
      const events: Array<{ index: number; expanded: boolean; expandedIndices: number[] }> = [];
      const onToggle = (e: Event) => events.push((e as CustomEvent).detail);
      acc.addEventListener('mdToggle', onToggle);
      h2.click();
      await waitFor(() => expect(h2.getAttribute('aria-expanded')).toBe('true'));
      // The whole point of exclusive mode: item 0 gets closed for us.
      await waitFor(() => expect(h0.getAttribute('aria-expanded')).toBe('false'));
      acc.removeEventListener('mdToggle', onToggle);
      expect(openCount(acc)).toBe(1); // exclusivity held
      // The auto-collapse of item 0 was announced as its own event…
      expect(events.some((d) => d.index === 0 && d.expanded === false)).toBe(true);
      // …and the authoritative final set names only item 2.
      expect(events[events.length - 1].expandedIndices).toEqual([2]);
    });

    await step('Switching again (item 1) keeps the one-open invariant', async () => {
      const h1 = headerOf(items[1]);
      const h2 = headerOf(items[2]);
      expect(h2.getAttribute('aria-expanded')).toBe('true'); // item 2 is the open one now
      h1.click();
      await waitFor(() => expect(h1.getAttribute('aria-expanded')).toBe('true'));
      await waitFor(() => expect(h2.getAttribute('aria-expanded')).toBe('false'));
      expect(openCount(acc)).toBe(1);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Heading level (APG) ─────────────────────────────────── */
export const HeadingLevel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Per APG: *aria-level that is appropriate for the information architecture of the page*. " +
          'Set `heading-level` on the parent accordion (or per-item) to render the matching native ' +
          '<code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>. The button stays the only child of the heading.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 24px; max-width: 520px;">
      <section>
        <h1 style="margin:0 0 12px; font: 500 22px/28px Roboto, sans-serif;">${t(globals.locale, 'settings')}</h1>
        <div style="${labelStyle}">heading-level = 2 (children of an &lt;h1&gt; page title)</div>
        <md-accordion heading-level="2" default-expanded="0">
          <md-accordion-item headline=${t(globals.locale, 'accordion.account')} icon="person">${t(globals.locale, 'accordion.emailPassword2fa')}</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.notifications')} icon="notifications">${t(globals.locale, 'accordion.emailDigestPush')}</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h2 style="margin:0 0 12px; font: 500 18px/24px Roboto, sans-serif;">${t(globals.locale, 'accordion.billing')}</h2>
        <h3 style="margin:0 0 12px; font: 500 16px/22px Roboto, sans-serif;">${t(globals.locale, 'accordion.subscriptionDetails')}</h3>
        <div style="${labelStyle}">heading-level = 4 (nested inside &lt;h2&gt;/&lt;h3&gt;)</div>
        <md-accordion heading-level="4" default-expanded="0">
          <md-accordion-item headline=${t(globals.locale, 'accordion.currentPlan')} icon="workspace_premium">Pro · billed monthly.</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.paymentMethod')} icon="credit_card">Visa ending in 4242.</md-accordion-item>
        </md-accordion>
      </section>
    </div>
  `,
};

/* ─── Keep one expanded (APG) ─────────────────────────────── */
export const KeepOneExpanded: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "APG variant: *if the accordion does not permit the panel to be collapsed, the header button " +
          "element has aria-disabled set to true*. With <code>keep-one-expanded</code> the currently-open " +
          'panel rejects collapse attempts (click, Enter, Space) and the locked button advertises ' +
          '<code>aria-disabled="true"</code> so screen readers can announce that it is the open panel. ' +
          'Pair with <code>exclusive</code> to enforce "exactly one panel is always open".',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 32px; max-width: 520px;">
      <div>
        <div style="${labelStyle}">keep-one-expanded only — multiple can be open, but at least one must remain</div>
        <md-accordion keep-one-expanded default-expanded="0">
          <md-accordion-item headline=${t(globals.locale, 'accordion.account')} icon="person">${t(globals.locale, 'accordion.keepOneAccountBody')}</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.notifications')} icon="notifications">${t(globals.locale, 'accordion.emailDigestPush')}</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.billing')} icon="credit_card">${t(globals.locale, 'accordion.planInvoices')}</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">exclusive + keep-one-expanded — exactly one panel is always open</div>
        <md-accordion exclusive keep-one-expanded default-expanded="1">
          <md-accordion-item headline=${t(globals.locale, 'accordion.personalInfo')} icon="badge">${t(globals.locale, 'accordion.personalInfoBody')}</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.shipping')} icon="local_shipping">${t(globals.locale, 'accordion.shippingBody')}</md-accordion-item>
          <md-accordion-item headline=${t(globals.locale, 'accordion.review')} icon="check_circle">${t(globals.locale, 'accordion.orderSummary')}</md-accordion-item>
        </md-accordion>
      </div>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    // The first accordion in this story is `keep-one-expanded` (no exclusive):
    // multiple panels may open, but the LAST remaining one can't be collapsed.
    const acc = await getAccordion(canvasElement);
    const items = itemsOf(acc);

    await step('The sole open panel is advertised as locked (aria-disabled)', async () => {
      expect(items.length).toBe(3);
      await waitFor(() => {
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true');
        // APG: the panel that can't be collapsed advertises aria-disabled.
        expect(headerOf(items[0]).getAttribute('aria-disabled')).toBe('true');
      });
      // Siblings are freely collapsible, so they carry no aria-disabled.
      expect(headerOf(items[1]).getAttribute('aria-disabled')).toBe(null);
    });

    await step('GUARD: clicking/Entering the last-open header does NOT collapse it', async () => {
      const h0 = headerOf(items[0]);
      const before = h0.getAttribute('aria-expanded'); // 'true'
      let fired = false;
      const onToggle = () => { fired = true; };
      acc.addEventListener('mdToggle', onToggle);
      h0.click();
      key(h0, 'Enter'); // the keyboard path is guarded too
      // No real transition to await — give any erroneous toggle time to flush.
      await new Promise((r) => setTimeout(r, 80));
      acc.removeEventListener('mdToggle', onToggle);
      expect(h0.getAttribute('aria-expanded')).toBe(before); // still open
      expect(openCount(acc)).toBe(1);
      expect(fired).toBe(false); // component emitted nothing
    });

    await step('Opening a 2nd panel unlocks the first, which can then collapse', async () => {
      const h0 = headerOf(items[0]);
      const h1 = headerOf(items[1]);
      // Two panels open → item 0 is no longer the sole panel → unlocked.
      h1.click();
      await waitFor(() => expect(h1.getAttribute('aria-expanded')).toBe('true'));
      await waitFor(() => expect(h0.getAttribute('aria-disabled')).toBe(null));
      // Now item 0 collapses for real, leaving item 1 as the kept-open panel.
      let detail: { index: number; expanded: boolean; expandedIndices: number[] } | undefined;
      acc.addEventListener(
        'mdToggle',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      h0.click();
      await waitFor(() => expect(h0.getAttribute('aria-expanded')).toBe('false'));
      expect(detail?.index).toBe(0);
      expect(detail?.expanded).toBe(false);
      expect(detail?.expandedIndices).toEqual([1]);
      // The invariant migrated: item 1 is now the locked sole-open panel.
      await waitFor(() => expect(h1.getAttribute('aria-disabled')).toBe('true'));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Region-role policy (APG) ────────────────────────────── */
export const RegionRolePolicy: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "APG: *Avoid using the region role in circumstances that create landmark region proliferation, " +
          'e.g., in an accordion that contains more than approximately 6 panels that can be expanded at the ' +
          'same time*. The <code>region</code> prop controls this:' +
          '<ul>' +
          '<li><code>auto</code> (default) — uses <code>role="region"</code> while the item count is ≤ ' +
          '<code>region-threshold</code> (6 by default), then downgrades to <code>role="group"</code>.</li>' +
          '<li><code>always</code> — every panel is a region landmark.</li>' +
          '<li><code>never</code> — no panel carries a region role (still labelled via aria-labelledby).</li>' +
          '</ul>' +
          'Use a screen reader / Accessibility Inspector to confirm the panel roles change.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: 28px; max-width: 520px;">
      <div>
        <div style="${labelStyle}">auto · 4 items → panels = role="region"</div>
        <md-accordion region="auto" default-expanded="0">
          <md-accordion-item headline="Step 1">Body</md-accordion-item>
          <md-accordion-item headline="Step 2">Body</md-accordion-item>
          <md-accordion-item headline="Step 3">Body</md-accordion-item>
          <md-accordion-item headline="Step 4">Body</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">auto · 9 items → panels = role="group" (over threshold of 6)</div>
        <md-accordion region="auto" default-expanded="0">
          ${Array.from({ length: 9 }).map(
            (_, i) => html`<md-accordion-item headline="FAQ ${i + 1}">Answer ${i + 1}</md-accordion-item>`,
          )}
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">always · forces role="region" even with many items</div>
        <md-accordion region="always" default-expanded="0">
          <md-accordion-item headline="Section A">Body A</md-accordion-item>
          <md-accordion-item headline="Section B">Body B</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">never · drops the region role entirely</div>
        <md-accordion region="never" default-expanded="0">
          <md-accordion-item headline="Section A">Body A</md-accordion-item>
          <md-accordion-item headline="Section B">Body B</md-accordion-item>
        </md-accordion>
      </div>
    </div>
  `,
};

/* ─── Prop reactions (live @Watch coverage) ───────────────── */
export const PropReactions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Live-updating the orchestration props re-syncs every child item: `heading-level` ' +
          'swaps the native heading tag, `region` / `region-threshold` re-police the panel ' +
          'roles, `floating` seeds the chassis translate + grip, and `keep-one-expanded` ' +
          'force-opens and locks the sole panel. This mirrors what a framework binding does ' +
          'when the app state driving these props changes at runtime.',
      },
    },
  },
  render: () => html`
    <div style="width: 480px;">
      <md-accordion class="reactive" default-expanded="0">
        <md-accordion-item headline="Alpha" icon="looks_one">Body A</md-accordion-item>
        <md-accordion-item headline="Beta" icon="looks_two">Body B</md-accordion-item>
        <md-accordion-item headline="Gamma" icon="looks_3">Body C</md-accordion-item>
      </md-accordion>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const acc = await getAccordion(canvasElement, '.reactive');
    const items = itemsOf(acc);
    const props = acc as HTMLElement & {
      headingLevel: number;
      region: 'auto' | 'always' | 'never';
      regionThreshold: number;
      floating: boolean;
      keepOneExpanded: boolean;
    };
    const headingTag = (it: ItemEl): string =>
      (it.shadowRoot!.querySelector('.md-accordion-item__heading') as HTMLElement).tagName;
    const panelRole = (it: ItemEl): string | null => panelOf(it).getAttribute('role');

    await step('heading-level propagates the native heading tag to every item', async () => {
      expect(headingTag(items[0])).toBe('H3'); // default
      props.headingLevel = 5;
      await waitFor(() => expect(headingTag(items[0])).toBe('H5'));
      expect(headingTag(items[2])).toBe('H5');
    });

    await step('region="never" downgrades every panel role from region to group', async () => {
      // auto @ 3 items ≤ threshold(6) → region.
      await waitFor(() => expect(panelRole(items[0])).toBe('region'));
      props.region = 'never';
      await waitFor(() => expect(panelRole(items[0])).toBe('group'));
      expect(panelRole(items[2])).toBe('group');
    });

    await step('region-threshold re-evaluates the auto policy when lowered below the count', async () => {
      props.region = 'auto';
      await waitFor(() => expect(panelRole(items[0])).toBe('region'));
      props.regionThreshold = 1; // 3 items > 1 → downgrade to group
      await waitFor(() => expect(panelRole(items[0])).toBe('group'));
    });

    await step('Setting floating live seeds the chassis translate + first-item grip', async () => {
      props.floating = true;
      await waitFor(() => expect(items[0].hasAttribute('data-chassis-handle')).toBe(true));
      expect(items[1].hasAttribute('data-chassis-handle')).toBe(false);
      // default initial-x / initial-y are 24 / 24.
      await waitFor(() => expect(acc.style.transform).toContain('translate3d(24px, 24px'));
      // Unsetting floating clears the grip again.
      props.floating = false;
      await waitFor(() => expect(items[0].hasAttribute('data-chassis-handle')).toBe(false));
    });

    await step('keep-one-expanded, set with nothing open, force-opens + locks the first item', async () => {
      const h0 = headerOf(items[0]);
      // Collapse the sole open panel so the accordion has zero open items.
      h0.click();
      await waitFor(() => expect(h0.getAttribute('aria-expanded')).toBe('false'));
      expect(openCount(acc)).toBe(0);
      props.keepOneExpanded = true;
      // The watch re-opens the first enabled item and advertises it locked.
      await waitFor(() => expect(h0.getAttribute('aria-expanded')).toBe('true'));
      await waitFor(() => expect(h0.getAttribute('aria-disabled')).toBe('true'));
      expect(openCount(acc)).toBe(1);
    });
  },
};

/* ─── Initial-state edge cases (default-expanded resolution) ── */
export const InitialStateEdgeCases: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`applyInitialState` resolves conflicting seeds at mount. Under `exclusive`, a ' +
          'multi-index `default-expanded` collapses to just the lowest index ("first wins"). ' +
          'Under `keep-one-expanded` with no seed at all, the first enabled item is ' +
          'force-opened, so the accordion never advertises "keep one open" while showing none.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: 24px; max-width: 480px;">
      <div>
        <div style="${labelStyle}">exclusive + default-expanded="0,2" → first wins (only 0 open)</div>
        <md-accordion class="excl-multi" exclusive default-expanded="0,2">
          <md-accordion-item headline="First">Body A</md-accordion-item>
          <md-accordion-item headline="Second">Body B</md-accordion-item>
          <md-accordion-item headline="Third">Body C</md-accordion-item>
        </md-accordion>
      </div>
      <div>
        <div style="${labelStyle}">keep-one-expanded, no default → first item force-opened</div>
        <md-accordion class="k1-nodefault" keep-one-expanded>
          <md-accordion-item headline="One">Body 1</md-accordion-item>
          <md-accordion-item headline="Two">Body 2</md-accordion-item>
        </md-accordion>
      </div>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    await step('exclusive + multi default-expanded keeps only the lowest index open', async () => {
      const excl = await getAccordion(canvasElement, '.excl-multi');
      const items = itemsOf(excl);
      await waitFor(() =>
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true'),
      );
      expect(headerOf(items[2]).getAttribute('aria-expanded')).toBe('false');
      expect(openCount(excl)).toBe(1);
    });

    await step('keep-one-expanded with no seed force-opens the first enabled item', async () => {
      const k1 = await getAccordion(canvasElement, '.k1-nodefault');
      const items = itemsOf(k1);
      await waitFor(() =>
        expect(headerOf(items[0]).getAttribute('aria-expanded')).toBe('true'),
      );
      expect(openCount(k1)).toBe(1);
      // The lone open panel is advertised as locked (aria-disabled).
      expect(headerOf(items[0]).getAttribute('aria-disabled')).toBe('true');
    });
  },
};

/* ─── Disabled ────────────────────────────────────────────── */
export const Disabled: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 480px;">
      <md-accordion>
        <md-accordion-item headline=${t(globals.locale, 'accordion.available')}>${t(globals.locale, 'accordion.clickToExpand')}</md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.comingSoon')} supporting-text=${t(globals.locale, 'accordion.availableInV2')} disabled icon="lock">
          ${t(globals.locale, 'accordion.cantSeeMe')}
        </md-accordion-item>
        <md-accordion-item headline=${t(globals.locale, 'accordion.available')}>${t(globals.locale, 'accordion.clickToExpand')}</md-accordion-item>
      </md-accordion>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Every part of the accordion is built on CSS logical properties — padding, ' +
          'margins, borders, drag handles, the floating chassis grip, even the chevron ' +
          'rotation — so flipping the parent container to <code>dir="rtl"</code> mirrors ' +
          'the whole component without any extra wiring. Side-by-side comparisons below ' +
          'show each feature in both writing directions.',
      },
    },
  },
  render: () => html`
    <style>
      .rtl-grid {
        display: grid;
        gap: 32px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        padding: 24px;
        max-inline-size: 1200px;
        margin: 0 auto;
      }
      .rtl-grid section {
        display: grid;
        gap: 8px;
      }
      .rtl-grid h3 {
        margin: 0;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rtl-grid .rtl-grid__hint {
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
    </style>

    <div class="rtl-grid">
      <!-- 1. Basic Arabic, side-by-side with LTR -->
      <section>
        <h3>Basic · Arabic (RTL)</h3>
        <div dir="rtl">
          <md-accordion default-expanded="0">
            <md-accordion-item headline="الحساب" supporting-text="البريد و كلمة السر" icon="person">
              <p style="margin:0;">حدّث عنوان البريد الإلكتروني وكلمة السر، وفعّل التحقق بخطوتين.</p>
            </md-accordion-item>
            <md-accordion-item headline="الإشعارات" icon="notifications">
              <p style="margin:0;">ملخص يومي عبر البريد، إشعارات داخل التطبيق، تنبيهات الجوال.</p>
            </md-accordion-item>
            <md-accordion-item headline="الفواتير" icon="credit_card">
              <p style="margin:0;">الخطة، الفواتير، وسيلة الدفع المسجّلة.</p>
            </md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <!-- 2. Same content in LTR for comparison -->
      <section>
        <h3>Basic · English (LTR)</h3>
        <div dir="ltr">
          <md-accordion default-expanded="0">
            <md-accordion-item headline="Account" supporting-text="Email & password" icon="person">
              <p style="margin:0;">Update your email address, change your password, manage two-factor authentication.</p>
            </md-accordion-item>
            <md-accordion-item headline="Notifications" icon="notifications">
              <p style="margin:0;">Email digest, in-app banners, mobile push.</p>
            </md-accordion-item>
            <md-accordion-item headline="Billing" icon="credit_card">
              <p style="margin:0;">Plan, invoices, payment method on file.</p>
            </md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <!-- 3. Hebrew, outlined variant -->
      <section>
        <h3>Outlined · Hebrew (RTL)</h3>
        <div dir="rtl">
          <md-accordion variant="outlined" default-expanded="1">
            <md-accordion-item headline="תנאי שימוש" supporting-text="עודכן ב-12 במאי 2026">
              <p style="margin:0;">קרא בעיון לפני אישור — תנאי השימוש מסבירים את זכויותיך וחובותיך.</p>
            </md-accordion-item>
            <md-accordion-item headline="פרטיות">
              <p style="margin:0;">אנו מכבדים את פרטיותך. כך אנו אוספים, מאחסנים ומגנים על המידע שלך.</p>
            </md-accordion-item>
            <md-accordion-item headline="עוגיות">
              <p style="margin:0;">האתר משתמש בעוגיות כדי לשפר את חוויית הגלישה.</p>
            </md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <!-- 4. RTL + reorderable (drag handle on the right) -->
      <section>
        <h3>Reorderable · drag handle mirrors to the right</h3>
        <p class="rtl-grid__hint">
          The leading-edge reorder grip moves to the visual right in RTL. Try
          dragging or use <kbd>Alt+&uarr;</kbd>/<kbd>Alt+&darr;</kbd>.
        </p>
        <div dir="rtl">
          <md-accordion reorderable elevation="1">
            <md-accordion-item headline="ملف شخصي" icon="person">الاسم الظاهر، الصورة، السيرة.</md-accordion-item>
            <md-accordion-item headline="الأمان" icon="lock">كلمة السر، الجلسات، الأجهزة.</md-accordion-item>
            <md-accordion-item headline="الإشعارات" icon="notifications">البريد، التنبيهات، داخل التطبيق.</md-accordion-item>
            <md-accordion-item headline="التكاملات" icon="extension">Slack وGitHub وLinear.</md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <!-- 5. Long content that wraps right-to-left -->
      <section>
        <h3>Long content · wraps right-to-left</h3>
        <div dir="rtl">
          <md-accordion default-expanded="0">
            <md-accordion-item headline="عن المنتج" icon="info">
              <p style="margin:0;">
                مكتبة AWC UI هي مجموعة من مكوّنات الويب المبنية على Stencil.js
                وفق توجيهات Material Design 3 المُعبِّرة. تدعم RTL بالكامل، تستخدم
                خصائص CSS المنطقية، وتلتزم بإرشادات WAI-ARIA APG لكلّ سلوك تفاعلي.
                هذا النص يُظهر التفاف النص الطويل ومحاذاته إلى اليمين تلقائياً.
              </p>
            </md-accordion-item>
            <md-accordion-item headline="البدء السريع" icon="rocket_launch">
              <p style="margin:0;">ثبّت الحزمة ثم استورد المكوّنات المطلوبة فقط لتقليل حجم الحزمة النهائية.</p>
            </md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <!-- 6. RTL + custom slotted icons (directional ones can mirror too) -->
      <section>
        <h3>Custom slotted icons · directional</h3>
        <p class="rtl-grid__hint">
          A directional SVG arrow used in the leading-icon slot can be flipped
          purely through CSS by listening to <code>[dir="rtl"]</code> on a wrapping
          element.
        </p>
        <style>
          .rtl-arrow [dir="rtl"] svg.directional { transform: scaleX(-1); }
        </style>
        <div class="rtl-arrow" dir="rtl">
          <md-accordion variant="outlined" default-expanded="0">
            <md-accordion-item headline="إرسال">
              <svg slot="leading-icon" class="directional" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
              </svg>
              <p style="margin:0;">السهم في الأيقونة المُمرَّرة عبر الـ slot يَنعكس مع اتجاه الصفحة.</p>
            </md-accordion-item>
            <md-accordion-item headline="استلام">
              <svg slot="leading-icon" class="directional" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M19 13H5v-2h14v2zm-7-9l-5 5h3v4h4V9h3l-5-5z" transform="rotate(-90 12 12)"/>
              </svg>
              <p style="margin:0;">يُمكن للأيقونة الافتراضية أن تُترك دون انعكاس عند عدم الحاجة.</p>
            </md-accordion-item>
          </md-accordion>
        </div>
      </section>
    </div>
  `,
};

/* ─── RTL · Floating panel ────────────────────────────────── */
export const RTLFloating: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Inside a floating accordion the layout still uses logical properties — text ' +
          'aligns to the right, the chevron mirrors, the reorder grip moves to the visual ' +
          "right. But the panel's position itself uses PHYSICAL viewport coordinates: " +
          '`initial-x="120"` always means "120px from the left edge of the screen", LTR or RTL. ' +
          'That keeps the drag math (which reads physical `clientX`) in lockstep with the ' +
          "translate, so the panel never ends up off-screen on the trailing side. The slim grip " +
          'pill at the top centre is the chassis-drag affordance.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="
      position: relative;
      block-size: 540px;
      background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
      background-image:
        linear-gradient(var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px),
        linear-gradient(90deg, var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px);
      background-size: 24px 24px;
      border-radius: 12px;
      padding: 24px;
    ">
      <md-accordion floating reorderable initial-x="120" initial-y="80">
        <md-accordion-item headline="التخطيط" icon="dashboard">الموضع، الحجم، الدوران.</md-accordion-item>
        <md-accordion-item headline="المظهر" icon="palette">التعبئة، الحدود، الشفافية.</md-accordion-item>
        <md-accordion-item headline="التأثيرات" icon="auto_awesome">الظل، التمويه، التوهج.</md-accordion-item>
      </md-accordion>
    </div>
  `,
};

/* ─── Localization ────────────────────────────────────────── */
/*
  Localization is fully delegated to the consumer. The accordion ships
  ZERO hard-coded user-facing text — `headline` and `supporting-text`
  are props, the body is a default slot, and the headline can be
  slotted (`slot="headline"`) for rich composition. Both drag affordances
  (`part="chassis-handle"` and `part="drag-handle"`) are `aria-hidden`
  gesture-only widgets, so they need no translation.

  This story demonstrates three real-world i18n patterns:
    1. A live locale switcher that swaps the active dictionary, updating
       `dir`/`lang` on a wrapper so the accordion mirrors automatically.
    2. A side-by-side gallery of the same UI in six languages — three
       writing systems (Latin, CJK, Arabic/Hebrew) and two directions.
    3. `Intl.PluralRules` + `Intl.DateTimeFormat` + `Intl.NumberFormat`
       used inside slotted content for locale-aware formatting.
*/

type LocaleId = 'en' | 'fr' | 'de' | 'ja' | 'ar' | 'he';

interface LocalePackItem {
  headline: string;
  supporting: string;
  icon: string;
  body: string;
}

interface LocalePack {
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  lang: string;
  items: LocalePackItem[];
}

const L10N_PACKS: Record<LocaleId, LocalePack> = {
  en: {
    label: 'English',
    flag: 'EN',
    dir: 'ltr',
    lang: 'en',
    items: [
      {
        headline: 'Account',
        supporting: 'Email & password',
        icon: 'person',
        body: 'Update your email address, change your password, manage two-factor authentication.',
      },
      {
        headline: 'Notifications',
        supporting: 'Email, push & in-app',
        icon: 'notifications',
        body: 'Choose how and when we contact you — daily digest, push alerts, banner messages.',
      },
      {
        headline: 'Privacy',
        supporting: 'Data & permissions',
        icon: 'shield',
        body: 'Control which apps see your activity, downloads, and export your personal data.',
      },
      {
        headline: 'About',
        supporting: 'Build, version, credits',
        icon: 'info',
        body: 'Find the app version, build hash, license information, and acknowledgements.',
      },
    ],
  },
  fr: {
    label: 'Français',
    flag: 'FR',
    dir: 'ltr',
    lang: 'fr',
    items: [
      {
        headline: 'Compte',
        supporting: 'E-mail et mot de passe',
        icon: 'person',
        body: "Modifiez votre adresse e-mail, changez votre mot de passe et activez l'authentification à deux facteurs.",
      },
      {
        headline: 'Notifications',
        supporting: 'E-mail, push et in-app',
        icon: 'notifications',
        body: 'Choisissez comment et quand nous vous contactons — résumé quotidien, alertes push, bannières.',
      },
      {
        headline: 'Confidentialité',
        supporting: 'Données et autorisations',
        icon: 'shield',
        body: "Contrôlez quelles applications voient votre activité et exportez vos données personnelles.",
      },
      {
        headline: 'À propos',
        supporting: 'Version, build, mentions',
        icon: 'info',
        body: "Retrouvez la version, l'empreinte du build, la licence et les remerciements.",
      },
    ],
  },
  de: {
    label: 'Deutsch',
    flag: 'DE',
    dir: 'ltr',
    lang: 'de',
    items: [
      {
        headline: 'Konto',
        supporting: 'E-Mail & Passwort',
        icon: 'person',
        body: 'Aktualisieren Sie Ihre E-Mail-Adresse, ändern Sie das Passwort und verwalten Sie die Zwei-Faktor-Authentifizierung.',
      },
      {
        headline: 'Benachrichtigungen',
        supporting: 'E-Mail, Push & In-App',
        icon: 'notifications',
        body: 'Legen Sie fest, wie und wann wir Sie kontaktieren — tägliche Zusammenfassung, Push-Hinweise, Banner.',
      },
      {
        headline: 'Datenschutzeinstellungen',
        supporting: 'Daten und Berechtigungen',
        icon: 'shield',
        body: 'Bestimmen Sie, welche Anwendungen Ihre Aktivitäten sehen, und exportieren Sie Ihre persönlichen Daten.',
      },
      {
        headline: 'Über die Anwendung',
        supporting: 'Version, Build, Danksagungen',
        icon: 'info',
        body: 'Hier finden Sie Version, Build-Hash, Lizenzinformationen und Danksagungen.',
      },
    ],
  },
  ja: {
    label: '日本語',
    flag: 'JA',
    dir: 'ltr',
    lang: 'ja',
    items: [
      {
        headline: 'アカウント',
        supporting: 'メール・パスワード',
        icon: 'person',
        body: 'メールアドレスの更新、パスワードの変更、二段階認証の管理を行えます。',
      },
      {
        headline: '通知',
        supporting: 'メール、プッシュ、アプリ内',
        icon: 'notifications',
        body: '日次サマリー、プッシュ通知、アプリ内バナー — 連絡方法とタイミングを選べます。',
      },
      {
        headline: 'プライバシー',
        supporting: 'データと権限',
        icon: 'shield',
        body: 'どのアプリがアクティビティを参照できるかを設定し、個人データをエクスポートできます。',
      },
      {
        headline: '情報',
        supporting: 'バージョン・ビルド・クレジット',
        icon: 'info',
        body: 'バージョン、ビルドハッシュ、ライセンス、クレジットを確認できます。',
      },
    ],
  },
  ar: {
    label: 'العربية',
    flag: 'AR',
    dir: 'rtl',
    lang: 'ar',
    items: [
      {
        headline: 'الحساب',
        supporting: 'البريد وكلمة السر',
        icon: 'person',
        body: 'حدّث عنوان البريد الإلكتروني، غيّر كلمة السر، وفعِّل التحقّق بخطوتين.',
      },
      {
        headline: 'الإشعارات',
        supporting: 'بريد، دفع، داخل التطبيق',
        icon: 'notifications',
        body: 'اختر كيف ومتى نتواصل معك — ملخص يومي، تنبيهات الدفع، شريط داخل التطبيق.',
      },
      {
        headline: 'الخصوصية',
        supporting: 'البيانات والصلاحيات',
        icon: 'shield',
        body: 'تحكّم في التطبيقات التي ترى نشاطك وقم بتصدير بياناتك الشخصية.',
      },
      {
        headline: 'حول',
        supporting: 'الإصدار والبناء والشكر',
        icon: 'info',
        body: 'الإصدار، بصمة البناء، الترخيص، والشكر.',
      },
    ],
  },
  he: {
    label: 'עברית',
    flag: 'HE',
    dir: 'rtl',
    lang: 'he',
    items: [
      {
        headline: 'חשבון',
        supporting: 'אימייל וסיסמה',
        icon: 'person',
        body: 'עדכן את כתובת האימייל, שנה סיסמה ונהל אימות דו-שלבי.',
      },
      {
        headline: 'התראות',
        supporting: 'מייל, דחיפה ובאפליקציה',
        icon: 'notifications',
        body: 'בחר איך ומתי ניצור איתך קשר — סיכום יומי, התראות דחיפה, באנרים בתוך האפליקציה.',
      },
      {
        headline: 'פרטיות',
        supporting: 'נתונים והרשאות',
        icon: 'shield',
        body: 'שלוט באילו אפליקציות רואות את הפעילות שלך וייצא את הנתונים האישיים שלך.',
      },
      {
        headline: 'אודות',
        supporting: 'גרסה, בנייה, קרדיטים',
        icon: 'info',
        body: 'גרסה, חתימת בנייה, רישיון וקרדיטים.',
      },
    ],
  },
};

function buildLocalisedAccordion(pack: LocalePack): HTMLElement {
  const accordion = document.createElement('md-accordion');
  accordion.setAttribute('variant', 'filled');
  accordion.setAttribute('elevation', '1');
  accordion.setAttribute('default-expanded', '0');
  pack.items.forEach((item) => {
    const node = document.createElement('md-accordion-item');
    node.setAttribute('headline', item.headline);
    node.setAttribute('supporting-text', item.supporting);
    node.setAttribute('icon', item.icon);
    const p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = item.body;
    node.appendChild(p);
    accordion.appendChild(node);
  });
  return accordion;
}

function bootstrapLocaleSwitcher(root: HTMLElement) {
  if (root.dataset.l10nReady === 'true') return;
  root.dataset.l10nReady = 'true';

  const mount = root.querySelector('.l10n-switcher__mount');
  const liveRegion = root.querySelector('.l10n-switcher__status');
  if (!mount) return;

  const apply = (id: LocaleId) => {
    const pack = L10N_PACKS[id];
    root.setAttribute('dir', pack.dir);
    root.setAttribute('lang', pack.lang);

    // Remount the accordion so Stencil's componentDidLoad re-runs:
    // item collection, index assignment, chassis-handle marker, and
    // initial-expanded resolution all kick off fresh. Swapping the
    // children of a long-lived accordion instance would leave its
    // internal items[] cache stale (there is no MutationObserver).
    mount.innerHTML = '';
    mount.appendChild(buildLocalisedAccordion(pack));

    // The locale buttons are <md-button toggle> instances. We swap the
    // variant (filled = selected, outlined = resting) and let md-button
    // manage `aria-pressed` itself via its toggle/selected API. We also
    // mirror the toggle state into the `selected` property because it
    // is mutable+reflected on the host.
    root.querySelectorAll<HTMLElement>('[data-locale]').forEach((btn) => {
      const isActive = btn.dataset.locale === id;
      btn.setAttribute('variant', isActive ? 'filled' : 'outlined');
      // Stencil reflects `selected` to attribute when set as a property.
      (btn as HTMLElement & { selected?: boolean }).selected = isActive;
    });
    if (liveRegion) liveRegion.textContent = `Locale: ${pack.label} (${pack.lang}, ${pack.dir})`;
  };

  root.querySelectorAll<HTMLElement>('[data-locale]').forEach((btn) => {
    btn.addEventListener('click', () => apply(btn.dataset.locale as LocaleId));
  });

  apply('en');
}

/* ──────────────────────────────────────────────────────────────
   Bootstrap helper for the ControlledAndUncontrolled story
   ──────────────────────────────────────────────────────────── */

function bootstrapControlledUncontrolled(root: HTMLElement) {
  if (root.dataset.cuReady === 'true') return;
  root.dataset.cuReady = 'true';

  // Uncontrolled card — just mirror mdToggle's expandedIndices into a label.
  const uncontrolled = root.querySelector('.cu-card--uncontrolled');
  const uncontrolledAcc = uncontrolled?.querySelector<HTMLMdAccordionElement>(
    '.cu-card__accordion',
  );
  const uncontrolledLabel = uncontrolled?.querySelector('.cu-card__indices');
  uncontrolledAcc?.addEventListener('mdToggle', (e) => {
    const detail = (e as CustomEvent<{ expandedIndices: number[] }>).detail;
    if (uncontrolledLabel) {
      uncontrolledLabel.textContent = `[${detail.expandedIndices.join(', ')}]`;
    }
  });

  // Controlled card — external Set<number> is the single source of truth.
  const controlled = root.querySelector('.cu-card--controlled');
  const controlledAcc = controlled?.querySelector<HTMLMdAccordionElement>(
    '.cu-card__accordion',
  );
  const controlledLabel = controlled?.querySelector('.cu-card__indices');
  if (!controlledAcc) return;

  let openSet = new Set<number>();
  // Re-entrancy guard. When syncDom() flips `expanded` on items, each
  // change emits `mdToggle`, our listener re-enters and mutates openSet
  // mid-iteration, and the closure-captured loop sees the wrong target.
  // The flag suppresses listener feedback while we are programmatically
  // pushing state, leaving user-driven header clicks fully observed.
  let syncing = false;

  const updateLabel = () => {
    if (!controlledLabel) return;
    const sorted = Array.from(openSet).sort((a, b) => a - b);
    controlledLabel.textContent = `[${sorted.join(', ')}]`;
  };

  // Push the external state down into the accordion. Snapshots the
  // target set up-front so re-entrant mdToggle events can't poison the
  // closure-captured value mid-iteration.
  const syncDom = () => {
    if (syncing) return;
    syncing = true;
    try {
      const target = new Set(openSet);
      const items =
        controlledAcc.querySelectorAll<HTMLMdAccordionItemElement>(
          'md-accordion-item',
        );
      items.forEach((it, i) => {
        const shouldBeOpen = target.has(i);
        if (it.expanded !== shouldBeOpen) it.expanded = shouldBeOpen;
      });
    } finally {
      syncing = false;
    }
    updateLabel();
  };

  // Listen to user-driven changes (header click, Enter / Space). The
  // accordion has already updated its DOM, so we only mirror the state
  // into our external set + label — no syncDom call needed.
  controlledAcc.addEventListener('mdToggle', (e) => {
    if (syncing) return;
    const detail = (e as CustomEvent<{ expandedIndices: number[] }>).detail;
    openSet = new Set(detail.expandedIndices);
    updateLabel();
  });

  // External controls mutate the state, then push it back to the DOM.
  const totalItems = () =>
    controlledAcc.querySelectorAll('md-accordion-item').length;

  controlled
    ?.querySelector('.cu-card__btn-expand')
    ?.addEventListener('click', () => {
      openSet = new Set(Array.from({ length: totalItems() }, (_, i) => i));
      syncDom();
    });

  controlled
    ?.querySelector('.cu-card__btn-collapse')
    ?.addEventListener('click', () => {
      openSet = new Set();
      syncDom();
    });

  controlled
    ?.querySelector('.cu-card__btn-random')
    ?.addEventListener('click', () => {
      const n = totalItems();
      if (n === 0) return;
      const pick = Math.floor(Math.random() * n);
      openSet = new Set([pick]);
      syncDom();
    });

  controlled
    ?.querySelector('.cu-card__btn-only-1')
    ?.addEventListener('click', () => {
      openSet = new Set([1]);
      syncDom();
    });

  syncDom();
}

/* ─── Localization ────────────────────────────────────────── */
export const Localization: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The accordion is **content-agnostic** — every visible string comes from your own ' +
          'i18n layer. There are zero hard-coded user-facing strings inside the shadow DOM: ' +
          '<code>headline</code> and <code>supporting-text</code> are props, the body is the ' +
          'default slot, and the headline itself can be rich content via <code>slot="headline"</code>. ' +
          'Both drag affordances are <code>aria-hidden</code> gesture widgets, so they need no ' +
          'translation. ARIA wiring (<code>aria-expanded</code>, <code>aria-controls</code>, ' +
          '<code>aria-labelledby</code>, <code>role="region"</code>) references DOM IDs and ' +
          'boolean state — not language strings — so it works identically in every locale.<br><br>' +
          '**Pattern**: drive the accordion from your i18n dictionary the same way you drive any ' +
          'other component. Set <code>lang="…"</code> on a wrapping element so screen readers ' +
          'pronounce correctly and font fallbacks pick the right glyphs; set <code>dir="rtl"</code> ' +
          'on the wrapper for RTL scripts (Arabic, Hebrew, Persian, Urdu). Both attributes inherit ' +
          'through the light DOM into the accordion automatically. Works out of the box with ' +
          '<code>i18next</code>, <code>@formatjs/intl</code>, <code>react-intl</code>, <code>vue-i18n</code>, ' +
          '<code>$localize</code>, <code>svelte-i18n</code>, or any other dictionary-driven system.',
      },
    },
  },
  render: () => {
    // Schedule a one-shot bootstrap so lit-html finishes mounting first.
    setTimeout(() => {
      const root = document.querySelector('.l10n-switcher');
      if (root) bootstrapLocaleSwitcher(root as HTMLElement);
    }, 0);

    // Locale-aware Intl demo computed at template-render time. Each
    // tile builds its own headlines / supporting-text / body content
    // using Intl.* so the formatting matches the active locale even
    // though the source data (count, date, percent) is identical.
    const sampleDate = new Date(2026, 4, 21, 9, 30);
    const intlLocales: { id: LocaleId; count: number; ratio: number }[] = [
      { id: 'en', count: 1, ratio: 0.04 },
      { id: 'fr', count: 12, ratio: 0.18 },
      { id: 'de', count: 1283, ratio: 0.73 },
      { id: 'ja', count: 5, ratio: 0.5 },
      { id: 'ar', count: 7, ratio: 0.62 },
      { id: 'he', count: 2, ratio: 0.31 },
    ];

    return html`
      <style>
        .l10n-page {
          max-inline-size: 1200px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 40px;
          font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
        }
        .l10n-section h3 {
          margin: 0 0 4px;
          font: 500 13px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .l10n-section p {
          margin: 0 0 16px;
          font: 400 13px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          max-inline-size: 760px;
        }
        .l10n-section p code {
          background: var(--md-sys-color-surface-container, #F3EDF7);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
        }

        /* ── Live locale switcher ───────────────────────────── */
        .l10n-switcher {
          display: grid;
          gap: 16px;
          padding: 20px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-low, #F7F2FA);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        }
        .l10n-switcher__bar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .l10n-switcher__label {
          font: 500 12px/16px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-inline-end: 8px;
        }
        /* Tiny lang-code chip that rides inside the button as a slotted
           leading-icon. The button itself is the library md-button — we
           only style this content fragment. The chip uses currentColor
           so it inverts cleanly when the button flips between filled
           (selected) and outlined (resting) variants.

           md-button ships a ::slotted([slot="leading-icon"]) rule that
           forces a square icon box (width/height: --_icon-size, ~20px
           at size="md"). That sizing assumes a square Material Symbols
           glyph — our chip is text ("EN", "العربية" lang code, etc.) and
           needs to size to its content. Light-DOM styles win over the
           shadow's ::slotted rules, so we opt out of the icon-box here
           and lay the chip out as a centred inline-flex pill. */
        .l10n-switcher__code {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          inline-size: auto;
          block-size: auto;
          min-inline-size: 24px;
          padding: 2px 6px;
          font: 600 10px/12px ui-monospace, SFMono-Regular, Menlo, monospace;
          border-radius: 4px;
          background: color-mix(in srgb, currentColor 14%, transparent);
          color: inherit;
          letter-spacing: 0.4px;
          /* Lang codes are always LTR even when the surrounding button
             label is RTL ("AR العربية"). Locking the chip to LTR keeps
             "EN" / "AR" / "HE" rendered left-to-right inside the chip. */
          direction: ltr;
          unicode-bidi: isolate;
          flex-shrink: 0;
        }
        .l10n-switcher__status {
          font: 500 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          padding-block-start: 4px;
        }

        /* ── Side-by-side gallery ───────────────────────────── */
        .l10n-gallery {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .l10n-gallery__tile {
          display: grid;
          gap: 8px;
          padding: 16px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        }
        .l10n-gallery__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .l10n-gallery__name {
          font: 500 14px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .l10n-gallery__meta {
          font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }

        /* ── Intl integration tiles ─────────────────────────── */
        .l10n-intl {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .l10n-intl__tile {
          padding: 16px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        }
        .l10n-intl__tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font: 500 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          padding-block-end: 8px;
        }
        .l10n-intl__tile dl {
          margin: 0;
          display: grid;
          gap: 4px;
          grid-template-columns: max-content 1fr;
          column-gap: 12px;
          font: 400 12px/18px Roboto, sans-serif;
        }
        .l10n-intl__tile dt {
          color: var(--md-sys-color-on-surface-variant, #49454F);
          font-weight: 500;
        }
        .l10n-intl__tile dd {
          margin: 0;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
      </style>

      <div class="l10n-page">
        <!-- 1. Interactive locale switcher ───────────────── -->
        <section class="l10n-section">
          <h3>1 · Live locale switcher</h3>
          <p>
            One accordion, six dictionaries. Clicking a language re-renders the items from
            <code>L10N_PACKS[id]</code> and flips <code>dir</code> / <code>lang</code> on the
            wrapping element — the accordion mirrors automatically because every layout property
            uses CSS logical equivalents. The component itself receives no localization
            configuration at all — it just renders whatever <code>headline</code>,
            <code>supporting-text</code>, and slotted body content you pass in.
          </p>
          <div class="l10n-switcher" lang="en" dir="ltr">
            <div class="l10n-switcher__bar" role="group" aria-label="Choose locale">
              <span class="l10n-switcher__label">Locale</span>
              ${(Object.keys(L10N_PACKS) as LocaleId[]).map(
                (id) => html`
                  <md-button
                    toggle
                    variant="outlined"
                    size="md"
                    data-locale=${id}
                    lang=${L10N_PACKS[id].lang}
                  >
                    <span
                      slot="leading-icon"
                      class="l10n-switcher__code"
                      aria-hidden="true"
                    >${L10N_PACKS[id].flag}</span>
                    ${L10N_PACKS[id].label}
                  </md-button>
                `,
              )}
            </div>
            <div class="l10n-switcher__mount">
              <!-- accordion is mounted (and remounted on every locale
                   change) by bootstrapLocaleSwitcher() — this keeps
                   Stencil's componentDidLoad lifecycle clean. -->
            </div>
            <div class="l10n-switcher__status" role="status" aria-live="polite"></div>
          </div>
        </section>

        <!-- 2. Side-by-side gallery ──────────────────────── -->
        <section class="l10n-section">
          <h3>2 · Same content · six locales side by side</h3>
          <p>
            Each tile uses its own <code>lang</code> and <code>dir</code> attributes, so screen
            readers announce in the correct language and the browser picks the right font
            fallbacks (e.g. Noto Sans CJK for Japanese, Noto Naskh for Arabic). The component
            doesn't share locale state between instances — every accordion is independent.
          </p>
          <div class="l10n-gallery">
            ${(Object.keys(L10N_PACKS) as LocaleId[]).map((id) => {
              const pack = L10N_PACKS[id];
              return html`
                <div class="l10n-gallery__tile" lang=${pack.lang} dir=${pack.dir}>
                  <div class="l10n-gallery__head">
                    <span class="l10n-gallery__name">${pack.label}</span>
                    <span class="l10n-gallery__meta">${pack.lang} · ${pack.dir}</span>
                  </div>
                  <md-accordion variant="outlined" default-expanded="0">
                    ${pack.items.slice(0, 3).map(
                      (item, idx) => html`
                        <md-accordion-item
                          headline=${item.headline}
                          supporting-text=${item.supporting}
                          icon=${item.icon}
                          ?expanded=${idx === 0}
                        >
                          <p style="margin: 0;">${item.body}</p>
                        </md-accordion-item>
                      `,
                    )}
                  </md-accordion>
                </div>
              `;
            })}
          </div>
        </section>

        <!-- 3. Intl APIs inside slotted content ──────────── -->
        <section class="l10n-section">
          <h3>3 · Intl.* inside the slot · pluralisation, dates, numbers</h3>
          <p>
            Slots are plain DOM — you can drop <code>Intl.PluralRules</code>,
            <code>Intl.NumberFormat</code> and <code>Intl.DateTimeFormat</code> output straight
            into <code>supporting-text</code> or the body, and they'll format to the active
            locale. The accordion does not interpret the text, it just renders it. Below: the
            same raw data (count, ratio, timestamp) is formatted six different ways using only
            the platform's built-in <code>Intl</code> APIs.
          </p>
          <div class="l10n-intl">
            ${intlLocales.map(({ id, count, ratio }) => {
              const pack = L10N_PACKS[id];
              const pr = new Intl.PluralRules(pack.lang);
              const cat = pr.select(count);
              // Build a tiny CLDR-like message bank per locale so the
              // pluralisation rule selects the correct branch.
              const PLURALS: Record<LocaleId, Record<string, string>> = {
                en: { one: '{n} notification', other: '{n} notifications' },
                fr: { one: '{n} notification', other: '{n} notifications', many: '{n} notifications' },
                de: { one: '{n} Benachrichtigung', other: '{n} Benachrichtigungen' },
                ja: { other: '{n}件の通知' },
                ar: {
                  zero: 'لا توجد إشعارات',
                  one: 'إشعار واحد',
                  two: 'إشعاران',
                  few: '{n} إشعارات',
                  many: '{n} إشعارًا',
                  other: '{n} إشعار',
                },
                he: { one: 'התראה אחת', two: 'שתי התראות', many: '{n} התראות', other: '{n} התראות' },
              };
              const template = PLURALS[id][cat] || PLURALS[id].other || '{n}';
              const formattedCount = new Intl.NumberFormat(pack.lang).format(count);
              const pluralLabel = template.replace('{n}', formattedCount);
              const percent = new Intl.NumberFormat(pack.lang, {
                style: 'percent',
                maximumFractionDigits: 1,
              }).format(ratio);
              const longDate = new Intl.DateTimeFormat(pack.lang, {
                dateStyle: 'long',
                timeStyle: 'short',
              }).format(sampleDate);
              const relative = new Intl.RelativeTimeFormat(pack.lang, { numeric: 'auto' }).format(-2, 'day');
              return html`
                <div class="l10n-intl__tile" lang=${pack.lang} dir=${pack.dir}>
                  <div class="l10n-intl__tag" dir="ltr">
                    <span>Intl.* · ${pack.lang}</span>
                  </div>
                  <md-accordion variant="filled" default-expanded="0">
                    <md-accordion-item
                      headline=${pack.items[1].headline}
                      supporting-text=${pluralLabel}
                      icon="notifications"
                    >
                      <dl>
                        <dt>Plural rule</dt>
                        <dd dir="ltr">${cat}</dd>
                        <dt>Count</dt>
                        <dd>${formattedCount}</dd>
                        <dt>Percent</dt>
                        <dd>${percent}</dd>
                        <dt>Date</dt>
                        <dd>${longDate}</dd>
                        <dt>Relative</dt>
                        <dd>${relative}</dd>
                      </dl>
                    </md-accordion-item>
                  </md-accordion>
                </div>
              `;
            })}
          </div>
        </section>

        <!-- 4. Slotted headline for rich i18n composition ─ -->
        <section class="l10n-section">
          <h3>4 · Slotted headline · for HTML-aware translations</h3>
          <p>
            Some i18n systems return rich content — links, dates inside headings, formatted
            numbers, marker spans for translation-management tools. Pass them through the
            <code>headline</code> slot and the prop becomes irrelevant. The component still
            applies its own typography and ARIA wiring; you control the inline composition.
          </p>
          <div lang="en" dir="ltr" style="max-inline-size: 640px;">
            <md-accordion variant="outlined" default-expanded="0">
              <md-accordion-item supporting-text="Localized via i18next + Intl">
                <span slot="headline">
                  <strong>${new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(1240.5)}</strong>
                  · <em>${new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(sampleDate)}</em>
                </span>
                <p style="margin: 0;">
                  The headline slot accepts any DOM, including <code>&lt;strong&gt;</code> and
                  <code>&lt;em&gt;</code> emphasis around interpolated values. The icon prop and
                  the chevron continue to render normally — only the text node is replaced.
                </p>
              </md-accordion-item>
              <md-accordion-item icon="receipt_long">
                <span slot="headline">
                  Invoice
                  <span lang="ja" style="font-weight: 600;">明細</span>
                  ·
                  <span lang="ar" dir="rtl" style="font-weight: 600;">فاتورة</span>
                </span>
                <p style="margin: 0;">
                  Mixed-script headlines work because each segment carries its own
                  <code>lang</code> / <code>dir</code> attribute — the browser handles the
                  bidi resolution and font selection on a per-segment basis.
                </p>
              </md-accordion-item>
            </md-accordion>
          </div>
        </section>

        <!-- 5. Cheat-sheet ───────────────────────────────── -->
        <section class="l10n-section">
          <h3>5 · Cheat-sheet · what to translate, what not to</h3>
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            max-inline-size: 980px;
          ">
            <div class="l10n-intl__tile">
              <div class="l10n-intl__tag" dir="ltr">Translate · driven by your i18n layer</div>
              <ul style="margin: 0; padding-inline-start: 18px; font: 400 13px/20px Roboto, sans-serif;">
                <li><code>headline</code> prop (or <code>slot="headline"</code>)</li>
                <li><code>supporting-text</code> prop</li>
                <li>Default-slot body content</li>
                <li>Slotted <code>leading-icon</code> alt text (if any)</li>
                <li>Any <code>aria-label</code> you put on a wrapper</li>
              </ul>
            </div>
            <div class="l10n-intl__tile">
              <div class="l10n-intl__tag" dir="ltr">No-op · component handles automatically</div>
              <ul style="margin: 0; padding-inline-start: 18px; font: 400 13px/20px Roboto, sans-serif;">
                <li><code>aria-expanded</code>, <code>aria-controls</code>, <code>aria-labelledby</code> — reference IDs / boolean state</li>
                <li><code>role="region"</code> / <code>group</code> — semantic role only</li>
                <li>Chassis-drag pill + reorder grip — <code>aria-hidden="true"</code></li>
                <li>RTL mirroring of layout — CSS logical properties everywhere</li>
                <li>Keyboard model (Enter, Space, Arrow, Home, End, Alt+Arrow) — direction-agnostic</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    `;
  },
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <md-accordion variant="outlined" default-expanded="0">
      <md-accordion-item headline=${t(globals.locale, 'accordion.whatsNew')} icon="auto_awesome">
        ${t(globals.locale, 'accordion.darkModeBody')}
      </md-accordion-item>
      <md-accordion-item headline=${t(globals.locale, 'accordion.knownIssues')} icon="warning">
        ${t(globals.locale, 'accordion.knownIssuesBody')}
      </md-accordion-item>
      <md-accordion-item headline=${t(globals.locale, 'accordion.roadmap')} icon="map">
        ${t(globals.locale, 'accordion.roadmapBody')}
      </md-accordion-item>
    </md-accordion>
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px; width: 520px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Minimal sanity-check that the public CSS custom properties pierce the ' +
          'shadow DOM as expected. See the dedicated **CustomColors**, **CustomSizes**, ' +
          '**CustomCaret** and **CustomDragHandles** stories for richer recipes.',
      },
    },
  },
  render: () => html`
    <style>
      .accent md-accordion-item {
        --md-accordion-item-container-color: color-mix(in srgb, var(--md-sys-color-primary, #6750A4) 8%, var(--md-sys-color-surface, #FFFBFE));
        --md-accordion-item-headline-color: var(--md-sys-color-primary, #6750A4);
        --md-accordion-item-icon-color: var(--md-sys-color-primary, #6750A4);
      }
    </style>
    <div class="accent" style="width: 480px;">
      <md-accordion default-expanded="0">
        <md-accordion-item headline="Premium feature" icon="bolt">
          This item uses primary-tinted surface, headline and icon colours.
        </md-accordion-item>
        <md-accordion-item headline="Locked feature" icon="workspace_premium">
          Available on the Pro plan.
        </md-accordion-item>
      </md-accordion>
    </div>
  `,
};

/* ─── Custom · Colors ─────────────────────────────────────── */
export const CustomColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every paintable surface is exposed as a public CSS custom property — ' +
          'override on the host (per-instance) or via a class. The expanded state has ' +
          'its own `*-expanded` variants so the "selected" look stays in your palette. ' +
          'Status palettes (success / warning / danger) and full brand themes are ' +
          'just a handful of token swaps.',
      },
    },
  },
  render: () => html`
    <style>
      .palette-grid {
        display: grid;
        gap: 32px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        max-inline-size: 1200px;
        padding: 16px;
      }
      .palette-grid h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .palette-grid code {
        font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
        background: color-mix(in srgb, var(--md-sys-color-on-surface, #1C1B1F) 6%, transparent);
        padding: 0 4px;
        border-radius: 4px;
      }

      /* 1. Brand palette — single source of truth on the host */
      .brand {
        --md-accordion-outline-color: #7C4DFF;
        --md-accordion-item-container-color: color-mix(in srgb, #7C4DFF 6%, #FFFBFE);
        --md-accordion-item-container-color-expanded: #7C4DFF;
        --md-accordion-item-header-color-expanded: #7C4DFF;
        --md-accordion-item-headline-color: #311B92;
        --md-accordion-item-headline-color-expanded: #FFFFFF;
        --md-accordion-item-icon-color: #5E35B1;
        --md-accordion-item-icon-color-expanded: #FFFFFF;
        --md-accordion-item-state-layer-color-expanded: #FFFFFF;
        --md-accordion-item-supporting-color: #5E35B1;
      }

      /* 2. Status palettes — set per item with a class */
      .status .ok {
        --md-accordion-item-container-color: #E8F5E9;
        --md-accordion-item-headline-color: #1B5E20;
        --md-accordion-item-icon-color: #2E7D32;
        --md-accordion-item-header-color-expanded: #C8E6C9;
        --md-accordion-item-headline-color-expanded: #1B5E20;
        --md-accordion-item-icon-color-expanded: #1B5E20;
      }
      .status .warn {
        --md-accordion-item-container-color: #FFF8E1;
        --md-accordion-item-headline-color: #5D4037;
        --md-accordion-item-icon-color: #F57F17;
        --md-accordion-item-header-color-expanded: #FFE082;
        --md-accordion-item-headline-color-expanded: #4E342E;
        --md-accordion-item-icon-color-expanded: #4E342E;
      }
      .status .danger {
        --md-accordion-item-container-color: #FFEBEE;
        --md-accordion-item-headline-color: #B71C1C;
        --md-accordion-item-icon-color: #C62828;
        --md-accordion-item-header-color-expanded: #FFCDD2;
        --md-accordion-item-headline-color-expanded: #B71C1C;
        --md-accordion-item-icon-color-expanded: #B71C1C;
      }
      .status .info {
        --md-accordion-item-container-color: #E3F2FD;
        --md-accordion-item-headline-color: #0D47A1;
        --md-accordion-item-icon-color: #1565C0;
        --md-accordion-item-header-color-expanded: #BBDEFB;
        --md-accordion-item-headline-color-expanded: #0D47A1;
        --md-accordion-item-icon-color-expanded: #0D47A1;
      }

      /* 3. Inline per-instance override */
      .inline md-accordion-item:first-child {
        --md-accordion-item-container-color: #FCE4EC;
        --md-accordion-item-headline-color: #880E4F;
        --md-accordion-item-icon-color: #AD1457;
      }
    </style>

    <div class="palette-grid">
      <section>
        <h3>1 · Brand theme on the host</h3>
        <p style="margin:0 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
          Single class on the &lt;md-accordion&gt; element sets every token at once.
        </p>
        <md-accordion class="brand" variant="outlined" default-expanded="0">
          <md-accordion-item headline="Hero" supporting-text="Cape sold separately" icon="bolt">
            Override every public surface in one place.
          </md-accordion-item>
          <md-accordion-item headline="Sidekick" icon="favorite">Backup hero.</md-accordion-item>
          <md-accordion-item headline="Villain" icon="block">Plot device.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>2 · Status palettes per item</h3>
        <p style="margin:0 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
          Apply a class to individual items — useful for log timelines, audits, alerts.
        </p>
        <md-accordion class="status">
          <md-accordion-item class="ok" headline="Build succeeded" supporting-text="exit 0" icon="check_circle">
            <p style="margin:0;">All 124 tests passed in 38.4s.</p>
          </md-accordion-item>
          <md-accordion-item class="info" headline="Build started" supporting-text="ci · webhook" icon="play_circle">
            <p style="margin:0;">Triggered by push to main · sha 9c3f0a.</p>
          </md-accordion-item>
          <md-accordion-item class="warn" headline="Flaky test" supporting-text="2 of 3 retries passed" icon="warning">
            <p style="margin:0;">tests/accordion.e2e.ts:84 — investigating.</p>
          </md-accordion-item>
          <md-accordion-item class="danger" headline="Build failed" supporting-text="exit 1" icon="error">
            <p style="margin:0;">Type error in <code>md-accordion.tsx</code>:299.</p>
          </md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>3 · Inline style on a single instance</h3>
        <p style="margin:0 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
          Inline <code>style="--md-accordion-item-…"</code> still wins.
        </p>
        <md-accordion class="inline" default-expanded="0">
          <md-accordion-item headline="Pink highlight" icon="palette">
            First item is tinted via <code>md-accordion-item:first-child</code>.
          </md-accordion-item>
          <md-accordion-item
            headline="Per-instance inline"
            icon="format_color_fill"
            style="
              --md-accordion-item-container-color: #FFF3E0;
              --md-accordion-item-headline-color: #BF360C;
              --md-accordion-item-icon-color: #E64A19;
            "
          >
            Second item uses an inline <code>style</code> attribute.
          </md-accordion-item>
          <md-accordion-item headline="Default" icon="settings">Untouched defaults for comparison.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>4 · Outline color (outlined variant)</h3>
        <p style="margin:0 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
          Use <code>--md-accordion-outline-color</code> to tint the chassis border.
        </p>
        <md-accordion
          variant="outlined"
          style="--md-accordion-outline-color: #6A1B9A; --md-accordion-item-headline-color-expanded: #6A1B9A;"
          default-expanded="0"
        >
          <md-accordion-item headline="Purple outline">Outline tint propagates to the chassis border.</md-accordion-item>
          <md-accordion-item headline="Header keeps default highlight">…unless you also override the expanded tokens.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>5 · State-layer color (hover / focus / press)</h3>
        <p style="margin:0 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);">
          Hover any header to see the override. The expanded state-layer also has its own token.
        </p>
        <md-accordion
          style="
            --md-accordion-item-state-layer-color: #00897B;
            --md-accordion-item-state-layer-color-expanded: #FFFFFF;
            --md-accordion-item-header-color-expanded: #00897B;
            --md-accordion-item-headline-color-expanded: #FFFFFF;
            --md-accordion-item-icon-color-expanded: #FFFFFF;
          "
          default-expanded="1"
        >
          <md-accordion-item headline="Teal hover ripple">Hover to see the teal state-layer.</md-accordion-item>
          <md-accordion-item headline="Expanded uses white-on-teal">Open the item to see the inverted overlay.</md-accordion-item>
        </md-accordion>
      </section>
    </div>
  `,
};

/* ─── Custom · Sizes ──────────────────────────────────────── */
export const CustomSizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Sizing is fully token-driven: header padding, header min-height, content ' +
          'padding, gap between filled tiles, container shape, expanded shape, and the ' +
          'floating panel width — all overridable per-instance. Combine with the ' +
          '`density` prop for the common compact / dense presets.',
      },
    },
  },
  render: () => html`
    <style>
      .size-grid {
        display: grid;
        gap: 32px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        max-inline-size: 1200px;
        padding: 16px;
      }
      .size-grid h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .size-grid p {
        margin: 0 0 12px;
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
    </style>

    <div class="size-grid">
      <section>
        <h3>Header padding & min-height</h3>
        <p>
          <code>--md-accordion-item-header-padding</code> (16px 24px) and
          <code>--md-accordion-item-header-min-height</code> (64px).
        </p>
        <md-accordion
          style="
            --md-accordion-item-header-padding: 24px 32px;
            --md-accordion-item-header-min-height: 80px;
          "
          default-expanded="0"
        >
          <md-accordion-item headline="Roomy header" icon="open_in_full" supporting-text="80px min-height, 24×32 padding">
            Pair with larger headings to keep the rhythm consistent.
          </md-accordion-item>
          <md-accordion-item headline="Roomy header" icon="open_in_full">
            Same recipe applied across the accordion.
          </md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>Content padding</h3>
        <p>
          <code>--md-accordion-item-content-padding</code> (20px 24px) drives the
          inner panel padding — top and bottom are equal by default.
        </p>
        <md-accordion
          style="--md-accordion-item-content-padding: 32px 40px;"
          default-expanded="0"
        >
          <md-accordion-item headline="Generous content" icon="article">
            <p style="margin:0;">Use this when the panel hosts forms, cards, or long-form copy that benefits from breathing room.</p>
          </md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>Gap between filled tiles</h3>
        <p>
          <code>--md-accordion-gap</code> (8px) — useful when the accordion lives
          in a denser layout, or when you want airier separation between tiles.
        </p>
        <md-accordion
          style="--md-accordion-gap: 16px;"
          default-expanded="0"
        >
          <md-accordion-item headline="Tile · 16px gap">First.</md-accordion-item>
          <md-accordion-item headline="Tile · 16px gap">Second.</md-accordion-item>
          <md-accordion-item headline="Tile · 16px gap">Third.</md-accordion-item>
        </md-accordion>

        <div style="height: 24px;"></div>

        <md-accordion
          style="--md-accordion-gap: 2px;"
          default-expanded="0"
        >
          <md-accordion-item headline="Tile · 2px gap">First.</md-accordion-item>
          <md-accordion-item headline="Tile · 2px gap">Second.</md-accordion-item>
          <md-accordion-item headline="Tile · 2px gap">Third.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>Container shape</h3>
        <p>
          Set per-instance via <code>--md-accordion-item-container-shape</code>
          (resting) and <code>--md-accordion-item-container-shape-expanded</code>.
        </p>
        <md-accordion
          style="
            --md-accordion-item-container-shape: 4px;
            --md-accordion-item-container-shape-expanded: 4px;
          "
          default-expanded="0"
        >
          <md-accordion-item headline="Sharp corners (4px)" icon="square">Compact, slab-y feel.</md-accordion-item>
          <md-accordion-item headline="Sharp corners (4px)" icon="square">Same as above.</md-accordion-item>
        </md-accordion>

        <div style="height: 24px;"></div>

        <md-accordion
          style="
            --md-accordion-item-container-shape: 28px;
            --md-accordion-item-container-shape-expanded: 28px;
          "
          default-expanded="0"
        >
          <md-accordion-item headline="Pill corners (28px)" icon="circle">Soft, modern feel.</md-accordion-item>
          <md-accordion-item headline="Pill corners (28px)" icon="circle">Same as above.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>Density presets</h3>
        <p>
          Use the <code>density</code> prop (0 / -1 / -2) for the common compact and
          dense layouts. Underneath it tweaks the min-height + paddings.
        </p>
        <md-accordion>
          <md-accordion-item headline="Default · 56-64px">…</md-accordion-item>
          <md-accordion-item headline="Default · 56-64px">…</md-accordion-item>
        </md-accordion>
        <div style="height: 16px;"></div>
        <md-accordion density="-1">
          <md-accordion-item headline="Compact · 48px">…</md-accordion-item>
          <md-accordion-item headline="Compact · 48px">…</md-accordion-item>
        </md-accordion>
        <div style="height: 16px;"></div>
        <md-accordion density="-2">
          <md-accordion-item headline="Dense · 40px">…</md-accordion-item>
          <md-accordion-item headline="Dense · 40px">…</md-accordion-item>
        </md-accordion>
      </section>
    </div>
  `,
};

/* ─── Custom · Caret / trailing icon ──────────────────────── */
export const CustomCaret: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Three patterns for customising the caret/chevron, in order of intrusiveness:\n\n' +
          '1. **Recolor & retint** via `--md-accordion-item-icon-color` / `-expanded`.\n' +
          '2. **Style the chevron part** via `::part(trailing-icon)` (rotation, size, transform).\n' +
          '3. **Replace entirely** by slotting your own SVG into `trailing-icon` — or swap two ' +
          'icons based on `[expanded]` for a classic +/- toggle.',
      },
    },
  },
  render: () => html`
    <style>
      .caret-grid {
        display: grid;
        gap: 32px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        max-inline-size: 1200px;
        padding: 16px;
      }
      .caret-grid h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .caret-grid p {
        margin: 0 0 12px;
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }

      /* 1. Recolor via tokens only */
      .caret-color md-accordion-item {
        --md-accordion-item-icon-color: #00ACC1;
        --md-accordion-item-icon-color-expanded: #006064;
      }

      /* 2. Style the chevron part */
      .caret-part md-accordion-item::part(trailing-icon) {
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750A4) 12%, transparent);
        border-radius: 50%;
        inline-size: 32px;
        block-size: 32px;
        color: var(--md-sys-color-primary, #6750A4);
        transition:
          background-color 200ms ease,
          transform 350ms cubic-bezier(0.38, 1.21, 0.22, 1.00);
      }
      .caret-part md-accordion-item[expanded]::part(trailing-icon) {
        background: var(--md-sys-color-primary, #6750A4);
        color: var(--md-sys-color-on-primary, #FFFFFF);
      }

      /* 3. Plus/minus swap via two slotted glyphs gated by [expanded] */
      .caret-pm md-accordion-item::part(trailing-icon) {
        /* The default chevron is hidden when we slot custom content, but we
           also need to neutralise the host's expand-rotation that targets
           the trailing wrapper — otherwise our + sign would spin. */
        transform: none !important;
      }
      .caret-pm md-accordion-item .glyph--collapsed { display: inline-flex; }
      .caret-pm md-accordion-item .glyph--expanded { display: none; }
      .caret-pm md-accordion-item[expanded] .glyph--collapsed { display: none; }
      .caret-pm md-accordion-item[expanded] .glyph--expanded { display: inline-flex; }
      .caret-pm .glyph {
        align-items: center;
        justify-content: center;
        inline-size: 18px;
        block-size: 18px;
        font: 500 18px/1 'Material Symbols Outlined', 'Material Icons';
      }

      /* 4. Slotted SVG caret — animated outline arrow */
      .caret-svg md-accordion-item::part(trailing-icon) {
        transform: none !important;
      }
      .caret-svg svg.caret {
        transition: transform 350ms cubic-bezier(0.38, 1.21, 0.22, 1.00);
      }
      .caret-svg md-accordion-item[expanded] svg.caret {
        transform: rotate(90deg);
      }
    </style>

    <div class="caret-grid">
      <section class="caret-color">
        <h3>1 · Recolor only</h3>
        <p>Override <code>--md-accordion-item-icon-color</code> and the expanded variant.</p>
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Cyan chevron" icon="info">Resting and expanded colours both swapped.</md-accordion-item>
          <md-accordion-item headline="Cyan chevron" icon="info">Same recipe.</md-accordion-item>
        </md-accordion>
      </section>

      <section class="caret-part">
        <h3>2 · Style the part</h3>
        <p>
          Round the chevron and tint it via <code>::part(trailing-icon)</code>.
          Open an item to see the expanded styling kick in.
        </p>
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Pill-shaped caret" icon="expand_more">
            Background and color flip when expanded.
          </md-accordion-item>
          <md-accordion-item headline="Pill-shaped caret" icon="expand_more">Same recipe.</md-accordion-item>
        </md-accordion>
      </section>

      <section class="caret-pm">
        <h3>3 · Plus / minus swap</h3>
        <p>
          Two glyphs slotted into <code>trailing-icon</code> — CSS toggles them
          based on the host's <code>[expanded]</code> attribute. The default
          rotation is neutralised so the + / − doesn't spin.
        </p>
        <md-accordion variant="outlined" default-expanded="0">
          <md-accordion-item headline="Show details">
            <span slot="trailing-icon" class="glyph glyph--collapsed">add</span>
            <span slot="trailing-icon" class="glyph glyph--expanded">remove</span>
            <p style="margin:0;">Classic FAQ-style toggle. Click the header to swap glyphs.</p>
          </md-accordion-item>
          <md-accordion-item headline="Show details">
            <span slot="trailing-icon" class="glyph glyph--collapsed">add</span>
            <span slot="trailing-icon" class="glyph glyph--expanded">remove</span>
            <p style="margin:0;">Same recipe.</p>
          </md-accordion-item>
        </md-accordion>
      </section>

      <section class="caret-svg">
        <h3>4 · Custom slotted SVG</h3>
        <p>
          Replace the chevron with any SVG. Animate it through your own CSS by
          driving off the host's <code>[expanded]</code> attribute.
        </p>
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Outline arrow" icon="navigation">
            <svg slot="trailing-icon" class="caret" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6"/>
            </svg>
            Right-arrow rotates 90° on expand.
          </md-accordion-item>
          <md-accordion-item headline="Outline arrow" icon="navigation">
            <svg slot="trailing-icon" class="caret" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6"/>
            </svg>
            Same recipe.
          </md-accordion-item>
        </md-accordion>
      </section>
    </div>
  `,
};

/* ─── Custom · Drag handles ───────────────────────────────── */
export const CustomDragHandles: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Both drag affordances are first-class CSS Parts:\n\n' +
          '- `::part(drag-handle)` — the per-item reorder grip (shown when the parent is `reorderable`).\n' +
          '- `::part(chassis-handle)` — the small "move panel" grip on the first item of a `floating` accordion.\n\n' +
          'Public tokens cover the common cases (colors), and `::part(...)` covers everything else ' +
          '(size, position, glyph swap via `content` is **not** supported on parts, so for glyph swaps ' +
          'tweak the visible icon via tokens or via the matching child class).',
      },
    },
  },
  render: () => html`
    <style>
      .handle-grid {
        display: grid;
        gap: 32px;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        max-inline-size: 1200px;
        padding: 16px;
      }
      .handle-grid h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .handle-grid p {
        margin: 0 0 12px;
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }

      /* 1. Tinted reorder handle */
      .handle-tinted md-accordion-item::part(drag-handle) {
        color: var(--md-sys-color-tertiary, #7D5260);
        opacity: 1;
      }
      .handle-tinted md-accordion-item::part(drag-handle):hover {
        color: var(--md-sys-color-on-tertiary-container, #31111D);
        background: var(--md-sys-color-tertiary-container, #FFD8E4);
        border-radius: 8px;
      }

      /* 2. Recolored chassis pill via the public token */
      .chassis-tinted md-accordion {
        --md-accordion-item-chassis-handle-color: #00897B;
        --md-accordion-item-chassis-handle-bg-hover:
          color-mix(in srgb, #00897B 18%, transparent);
      }

      /* 3. Larger pill + wider hit area via the two parts */
      .chassis-large md-accordion-item::part(chassis-handle) {
        inline-size: 88px;
        block-size: 22px;
        inset-block-start: 6px;
      }
      .chassis-large md-accordion-item::part(chassis-handle-bar) {
        inline-size: 56px;
        block-size: 6px;
        background-color: var(--md-sys-color-primary, #6750A4);
        opacity: 0.85;
      }

      /* Backdrop for the floating sections */
      .canvas {
        position: relative;
        block-size: 280px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        background-image:
          linear-gradient(var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px),
          linear-gradient(90deg, var(--md-sys-color-outline-variant, #CAC4D0) 1px, transparent 1px);
        background-size: 24px 24px;
        border-radius: 12px;
        overflow: hidden;
      }

      /*
        In real use a floating accordion is position: fixed and anchors
        to the viewport. For these inline customization demos we re-
        anchor each one to its own .canvas (which is position: relative)
        so they stay contained side-by-side and don't pile up at the
        viewport's top-left. Drag math is delta-based, so absolute vs.
        fixed positioning is transparent to the gesture itself.
      */
      .canvas md-accordion[floating] {
        position: absolute !important;
      }
    </style>

    <div class="handle-grid">
      <section>
        <h3>1 · Reorder handle · default</h3>
        <p>Reference look — Material Symbols <code>drag_indicator</code> grip on the leading edge.</p>
        <md-accordion reorderable>
          <md-accordion-item headline="Item A">Drag the grip.</md-accordion-item>
          <md-accordion-item headline="Item B">Drag the grip.</md-accordion-item>
          <md-accordion-item headline="Item C">Drag the grip.</md-accordion-item>
        </md-accordion>
      </section>

      <section class="handle-tinted">
        <h3>2 · Reorder handle · tinted via part</h3>
        <p>
          <code>::part(drag-handle)</code> with tertiary palette and a soft
          pill background on hover.
        </p>
        <md-accordion reorderable>
          <md-accordion-item headline="Item A">Hover to see the pill.</md-accordion-item>
          <md-accordion-item headline="Item B">Hover to see the pill.</md-accordion-item>
          <md-accordion-item headline="Item C">Hover to see the pill.</md-accordion-item>
        </md-accordion>
      </section>

      <section class="chassis-tinted">
        <h3>3 · Chassis pill · tokens only</h3>
        <p>
          Teal pill via <code>--md-accordion-item-chassis-handle-color</code> and
          <code>--md-accordion-item-chassis-handle-bg-hover</code>. Hover the
          pill — it widens & brightens automatically.
        </p>
        <div class="canvas">
          <md-accordion floating initial-x="32" initial-y="32" default-expanded="0">
            <md-accordion-item headline="Inspector" icon="info">Drag the slim teal grip.</md-accordion-item>
            <md-accordion-item headline="Appearance" icon="palette">…</md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <section class="chassis-large">
        <h3>4 · Chassis pill · oversized via parts</h3>
        <p>
          Two parts ship: <code>::part(chassis-handle)</code> is the hit area,
          <code>::part(chassis-handle-bar)</code> is the visible pill. Restyle
          either independently — here we widen the hit area to 88px and the pill
          to 56×6 in the primary tone.
        </p>
        <div class="canvas">
          <md-accordion floating initial-x="32" initial-y="32" default-expanded="0">
            <md-accordion-item headline="Layers" icon="layers">Bigger pill, primary tone.</md-accordion-item>
            <md-accordion-item headline="Filters" icon="tune">…</md-accordion-item>
          </md-accordion>
        </div>
      </section>
    </div>
  `,
};

/* ─── Width ───────────────────────────────────────────────── */
export const Width: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The accordion is a block-level element and naturally fills its parent. There is no ' +
          '`width` prop — you size it the same way you size any other layout primitive:\n\n' +
          '- **Default** — drop it in any block context, it takes 100% of the parent.\n' +
          '- **Full-bleed** — give the parent the viewport width (or a fluid container) and the accordion follows.\n' +
          '- **Explicit** — set `inline-size` / `max-inline-size` on the host or a wrapper.\n' +
          '- **Floating** — the chassis width is driven by `--md-accordion-floating-width` (defaults to 360px).',
      },
    },
  },
  render: () => html`
    <style>
      .width-stack { display: grid; gap: 28px; padding: 16px; }
      .width-stack h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .width-stack p {
        margin: 0 0 12px;
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
      .ruler {
        position: relative;
        padding-block-end: 8px;
        font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }

      /*
        Demo-only: re-anchor the floating accordions to their preview
        canvas. Floating accordions ship with position: fixed (they
        live in the viewport), which inside Storybook would float them
        to the top-left corner and overlap the other Width subsections.
        Switching to position: absolute parents them to the .float-canvas
        (which is itself position: relative). Drag math is delta-based,
        so the gesture is unaffected.
      */
      .float-canvas {
        position: relative;
        block-size: 320px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        border-radius: 12px;
        overflow: hidden;
      }
      .float-canvas md-accordion[floating] {
        position: absolute !important;
      }
    </style>

    <div class="width-stack">
      <section>
        <h3>1 · Default · fills the parent (100%)</h3>
        <p>No width set anywhere — the accordion fills whatever block container hosts it.</p>
        <div style="border: 1px dashed var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 8px; padding: 12px;">
          <md-accordion default-expanded="0">
            <md-accordion-item headline="Account" icon="person">100% of parent.</md-accordion-item>
            <md-accordion-item headline="Notifications" icon="notifications">100% of parent.</md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <section>
        <h3>2 · Full · spans the full container width</h3>
        <p>Container is 100% of its column — the accordion follows.</p>
        <md-accordion default-expanded="0" elevation="1">
          <md-accordion-item headline="Hero · full width" icon="panorama_wide_angle">
            Great for full-bleed settings pages or marketing layouts.
          </md-accordion-item>
          <md-accordion-item headline="Sub-section">…</md-accordion-item>
          <md-accordion-item headline="Sub-section">…</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>3 · Explicit · 360px</h3>
        <p>Set <code>inline-size</code> on the host (or a wrapper).</p>
        <md-accordion style="inline-size: 360px;" default-expanded="0">
          <md-accordion-item headline="Inspector" icon="info">360px wide.</md-accordion-item>
          <md-accordion-item headline="Appearance" icon="palette">360px wide.</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>4 · Explicit · min(100%, 480px) — responsive cap</h3>
        <p>
          Most common pattern in real apps: fill the parent, but never get wider
          than a comfortable reading width.
        </p>
        <md-accordion style="inline-size: min(100%, 480px);" default-expanded="0">
          <md-accordion-item headline="Capped at 480px" icon="straighten">
            Fluid below 480px, capped above it.
          </md-accordion-item>
          <md-accordion-item headline="Capped at 480px" icon="straighten">…</md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>5 · Explicit · max-inline-size with auto centering</h3>
        <p>
          For settings pages, pair <code>max-inline-size</code> with
          <code>margin-inline: auto</code> on a wrapper.
        </p>
        <div style="max-inline-size: 720px; margin-inline: auto;">
          <md-accordion variant="outlined" default-expanded="0">
            <md-accordion-item headline="Centered · 720px max" icon="center_focus_strong">
              The accordion takes the full available width up to 720px.
            </md-accordion-item>
            <md-accordion-item headline="Centered · 720px max" icon="center_focus_strong">…</md-accordion-item>
          </md-accordion>
        </div>
      </section>

      <section>
        <h3>6 · Floating · explicit chassis width</h3>
        <p>
          For <code>floating</code> accordions the host is <code>position: fixed</code>.
          Use <code>--md-accordion-floating-width</code> to size the panel — defaults
          to 360px, capped at <code>calc(100vw - 16px)</code>.
        </p>
        <div class="float-canvas">
          <md-accordion
            floating
            initial-x="24"
            initial-y="24"
            style="--md-accordion-floating-width: 280px;"
            default-expanded="0"
          >
            <md-accordion-item headline="280px floating">Narrow palette.</md-accordion-item>
            <md-accordion-item headline="…">…</md-accordion-item>
          </md-accordion>
          <md-accordion
            floating
            variant="outlined"
            initial-x="340"
            initial-y="24"
            style="--md-accordion-floating-width: 440px;"
            default-expanded="0"
          >
            <md-accordion-item headline="440px floating">Wider workspace.</md-accordion-item>
            <md-accordion-item headline="…">…</md-accordion-item>
          </md-accordion>
        </div>
      </section>
    </div>
  `,
};

/* ─── Height ──────────────────────────────────────────────── */
export const Height: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Height is content-driven by default — the accordion grows with its items. ' +
          'For fixed-height layouts (sidebars, dashboards, floating panels) cap a wrapper ' +
          'with <code>block-size</code> + <code>overflow: auto</code>, or cap the content ' +
          'inside an expanded item via the panel slot.',
      },
    },
  },
  render: () => html`
    <style>
      .h-stack { display: grid; gap: 28px; padding: 16px; }
      .h-stack h3 {
        margin: 0 0 8px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .h-stack p {
        margin: 0 0 12px;
        font: 400 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
    </style>

    <div class="h-stack">
      <section>
        <h3>1 · Default · height grows with content</h3>
        <p>No height set — every panel can expand freely.</p>
        <md-accordion style="inline-size: 520px;" default-expanded="0">
          <md-accordion-item headline="Account" icon="person">
            <p style="margin:0;">Settings, password, two-factor.</p>
          </md-accordion-item>
          <md-accordion-item headline="Notifications" icon="notifications">
            <p style="margin:0;">Email digest, push, in-app.</p>
          </md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>2 · Explicit · capped scroll region</h3>
        <p>
          Wrap the accordion in a fixed-height container with <code>overflow: auto</code>.
          The accordion still drives layout — the wrapper scrolls when needed.
        </p>
        <div
          tabindex="0"
          role="region"
          aria-label="Scrollable sections"
          style="
          inline-size: 480px;
          block-size: 320px;
          overflow: auto;
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          border-radius: 12px;
          padding: 12px;
        ">
          <md-accordion default-expanded="0">
            ${Array.from({ length: 14 }).map(
              (_, i) => html`
                <md-accordion-item headline="Section ${i + 1}" supporting-text="Lorem ipsum dolor">
                  <p style="margin:0;">Body of section ${i + 1}. Try scrolling the container.</p>
                </md-accordion-item>
              `,
            )}
          </md-accordion>
        </div>
      </section>

      <section>
        <h3>3 · Explicit · cap an item's content panel</h3>
        <p>
          When a single panel hosts a long form or list, cap the slotted
          content with <code>max-block-size</code> + <code>overflow: auto</code>.
          The accordion's expand animation still plays — only the inner content
          scrolls.
        </p>
        <md-accordion style="inline-size: 520px;" default-expanded="0">
          <md-accordion-item headline="Activity log" icon="receipt_long" supporting-text="Last 24h">
            <div tabindex="0" role="region" aria-label="Activity log" style="max-block-size: 220px; overflow: auto; padding-inline-end: 4px;">
              ${Array.from({ length: 18 }).map(
                (_, i) => html`
                  <div style="
                    display: flex; gap: 12px; align-items: center;
                    padding: 8px 0;
                    border-block-end: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
                    font: 400 13px/18px Roboto, sans-serif;
                  ">
                    <span style="font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface-variant, #49454F);">
                      14:${String((i * 7) % 60).padStart(2, '0')}
                    </span>
                    <span>Event #${i + 1} — payload synced.</span>
                  </div>
                `,
              )}
            </div>
          </md-accordion-item>
          <md-accordion-item headline="Summary" icon="summarize">
            <p style="margin:0;">No-scroll panel for short content.</p>
          </md-accordion-item>
        </md-accordion>
      </section>

      <section>
        <h3>4 · Sidebar layout · accordion fills viewport column</h3>
        <p>
          Real-world dashboard sidebar — the column is the full height of the
          frame, the accordion fills it and its overflow scrolls.
        </p>
        <div style="
          display: grid; grid-template-columns: 280px 1fr;
          gap: 16px;
          block-size: 360px;
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          border-radius: 12px;
          overflow: hidden;
        ">
          <div
            tabindex="0"
            role="region"
            aria-label="Sidebar groups"
            style="overflow: auto; padding: 12px; background: var(--md-sys-color-surface-container-lowest, #FFFBFE);"
          >
            <md-accordion variant="outlined" default-expanded="0">
              ${Array.from({ length: 9 }).map(
                (_, i) => html`
                  <md-accordion-item headline="Group ${i + 1}" icon="folder">
                    <p style="margin:0;">Items ${i * 3 + 1}–${i * 3 + 3}</p>
                  </md-accordion-item>
                `,
              )}
            </md-accordion>
          </div>
          <div style="padding: 24px; font: 400 14px/22px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
            Main content area — the sidebar to the left hosts a vertically-scrolling accordion.
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ─── Accessibility ───────────────────────────────────────── */
export const Accessibility: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Live cheat sheet aligned with the **WAI-ARIA APG** accordion pattern. Each header ' +
          'is the only child of a native <code>&lt;h3&gt;</code> (configurable via ' +
          '<code>heading-level</code>); the button advertises <code>aria-expanded</code>, ' +
          '<code>aria-controls</code>, and (when the parent uses <code>keep-one-expanded</code>) ' +
          '<code>aria-disabled</code> on the locked-open header. Panels carry ' +
          '<code>role="region"</code> with <code>aria-labelledby</code>; the <code>region</code> ' +
          'prop downgrades to <code>group</code> past the configurable threshold to avoid landmark ' +
          'proliferation. The reorder gesture is also keyboard-accessible via ' +
          '<kbd>Alt+&uarr;</kbd> / <kbd>Alt+&darr;</kbd>.',
      },
    },
  },
  render: () => html`
    <style>
      .a11y-page {
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
        padding: 24px;
        max-inline-size: 1200px;
        margin: 0 auto;
        font-family: var(--md-sys-typescale-body-medium-font-family, Roboto, sans-serif);
        color: var(--md-sys-color-on-surface, #1C1B1F);
      }
      @media (max-width: 880px) {
        .a11y-page { grid-template-columns: 1fr; }
      }
      .a11y-page h2 {
        margin: 0 0 12px;
        font: 500 22px/28px Roboto, sans-serif;
      }
      .a11y-page h3 {
        margin: 24px 0 8px;
        font: 500 14px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
      .a11y-page p { margin: 0 0 12px; font: 400 14px/22px Roboto, sans-serif; }
      .a11y-page code {
        font: 400 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
        background: color-mix(in srgb, var(--md-sys-color-on-surface, #1C1B1F) 6%, transparent);
        padding: 0 4px;
        border-radius: 4px;
      }
      .a11y-page kbd {
        display: inline-block;
        font: 500 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
        background: var(--md-sys-color-surface-container-high, #ECE6F0);
        color: var(--md-sys-color-on-surface, #1C1B1F);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        border-block-end-width: 2px;
        padding: 1px 6px;
        border-radius: 4px;
        margin: 0 1px;
      }
      .a11y-card {
        border-radius: 16px;
        padding: 20px;
        background: var(--md-sys-color-surface-container-low, #F7F2FA);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      .a11y-card h3 { margin-block-start: 0; }
      .a11y-card ul { padding-inline-start: 18px; margin: 0; }
      .a11y-card li { margin-block-end: 6px; font: 400 13px/19px Roboto, sans-serif; }
      .a11y-card .kbd-row {
        display: flex; gap: 8px; align-items: center;
        font: 400 13px/19px Roboto, sans-serif;
        margin-block-end: 6px;
      }
      .a11y-card .kbd-row span { color: var(--md-sys-color-on-surface-variant, #49454F); }
    </style>

    <div class="a11y-page">
      <!-- Live demo column -->
      <div>
        <h2>WAI-ARIA APG accordion</h2>
        <p>
          Try every interaction below using only your keyboard. Inspect the
          rendered DOM with the browser's Accessibility tree to confirm the
          ARIA states.
        </p>

        <h3>1 · Single-select pattern</h3>
        <p>
          One panel can be open at a time, and at least one must remain open
          (APG variant). The currently-open header advertises
          <code>aria-disabled="true"</code> and ignores Enter / Space / click.
        </p>
        <md-accordion exclusive keep-one-expanded heading-level="3" default-expanded="0" region="auto">
          <md-accordion-item headline="Personal info" supporting-text="Required" icon="badge">
            <p style="margin:0;">First name, last name, date of birth.</p>
          </md-accordion-item>
          <md-accordion-item headline="Shipping address" icon="local_shipping">
            <p style="margin:0;">Street, city, postcode, country.</p>
          </md-accordion-item>
          <md-accordion-item headline="Review" icon="check_circle">
            <p style="margin:0;">Order summary, total, place order.</p>
          </md-accordion-item>
        </md-accordion>

        <h3>2 · Reorderable · keyboard-driven</h3>
        <p>
          Focus a header, then press <kbd>Alt</kbd>+<kbd>&uarr;</kbd> / <kbd>Alt</kbd>+<kbd>&darr;</kbd>
          to reorder without ever leaving the keyboard. Visible drag handle remains
          for pointer users.
        </p>
        <md-accordion reorderable elevation="1" heading-level="3">
          <md-accordion-item headline="Apples" icon="circle">…</md-accordion-item>
          <md-accordion-item headline="Bananas" icon="circle">…</md-accordion-item>
          <md-accordion-item headline="Cherries" icon="circle">…</md-accordion-item>
          <md-accordion-item headline="Locked · Disabled" icon="lock" disabled>Can't be moved.</md-accordion-item>
        </md-accordion>

        <h3>3 · Region-role policy</h3>
        <p>
          With many items the parent automatically downgrades panel roles from
          <code>region</code> (landmark) to <code>group</code> (non-landmark) to
          avoid landmark-region proliferation.
        </p>
        <md-accordion region="auto" region-threshold="6">
          ${Array.from({ length: 9 }).map(
            (_, i) => html`
              <md-accordion-item headline="FAQ ${i + 1}">
                Answer ${i + 1}. Inspect this panel — its role is <code>group</code>, not <code>region</code>.
              </md-accordion-item>
            `,
          )}
        </md-accordion>

        <h3>4 · Heading level</h3>
        <p>
          The accordion's headers are rendered as native
          <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code> elements so they
          participate in the page's heading outline. Set
          <code>heading-level</code> to the value that matches your information
          architecture.
        </p>
        <md-accordion heading-level="2" default-expanded="0">
          <md-accordion-item headline="Native h2 wrapper">Inspect — the heading is an &lt;h2&gt;.</md-accordion-item>
          <md-accordion-item headline="Native h2 wrapper">Inspect — the heading is an &lt;h2&gt;.</md-accordion-item>
        </md-accordion>

        <h3>5 · Disabled item</h3>
        <p>
          Disabled items advertise <code>aria-disabled="true"</code>, leave the
          tab order via <code>tabindex="-1"</code>, and ignore all activation
          gestures. Drag handles (if any) also hide.
        </p>
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Available" icon="check_circle">Click to expand.</md-accordion-item>
          <md-accordion-item headline="Coming soon" icon="lock" disabled supporting-text="v2.0">
            You can't see me.
          </md-accordion-item>
          <md-accordion-item headline="Available" icon="check_circle">Click to expand.</md-accordion-item>
        </md-accordion>
      </div>

      <!-- Reference column -->
      <aside>
        <div class="a11y-card">
          <h3>Keyboard</h3>
          <div class="kbd-row"><kbd>Tab</kbd> <span>Move focus to next focusable header.</span></div>
          <div class="kbd-row"><kbd>Shift</kbd>+<kbd>Tab</kbd> <span>Previous header.</span></div>
          <div class="kbd-row"><kbd>Enter</kbd> or <kbd>Space</kbd> <span>Toggle the focused panel (or expand if locked).</span></div>
          <div class="kbd-row"><kbd>Alt</kbd>+<kbd>&uarr;</kbd> / <kbd>&darr;</kbd> <span>Reorder item up / down (when <code>reorderable</code>).</span></div>
          <div class="kbd-row"><kbd>Esc</kbd> <span>No effect — accordions don't trap focus.</span></div>
        </div>

        <div class="a11y-card" style="margin-block-start: 16px;">
          <h3>ARIA attributes (per APG)</h3>
          <ul>
            <li>Headings render as native <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>.</li>
            <li>The button is the only child of the heading.</li>
            <li><code>aria-expanded</code> on the button reflects panel state.</li>
            <li><code>aria-controls</code> links the button to the panel id.</li>
            <li><code>aria-disabled="true"</code> on a button that can't collapse (locked open).</li>
            <li>Panels carry <code>role="region"</code> + <code>aria-labelledby</code> by default.</li>
            <li>Over ~6 items the role downgrades to <code>group</code> to avoid landmark proliferation.</li>
          </ul>
        </div>

        <div class="a11y-card" style="margin-block-start: 16px;">
          <h3>Visual A11y</h3>
          <ul>
            <li>Focus ring uses MD3 <code>secondary</code> at 3px with 2px offset.</li>
            <li>State-layer opacities follow MD3 (hover 8%, focus 12%, press 12%).</li>
            <li>Disabled containers use 12% surface, disabled text uses 38% — overridable.</li>
            <li>Reduced motion: respects <code>prefers-reduced-motion: reduce</code>.</li>
            <li>Forced colors: chassis-handle and outline render against <code>CanvasText</code>.</li>
            <li>RTL: every layout property uses CSS logical equivalents.</li>
          </ul>
        </div>

        <div class="a11y-card" style="margin-block-start: 16px;">
          <h3>How to test</h3>
          <ol style="padding-inline-start: 18px; margin: 0;">
            <li style="margin-block-end: 6px;">Navigate the live demo using only the keyboard.</li>
            <li style="margin-block-end: 6px;">Open DevTools → Elements → expand a header — confirm <code>aria-expanded</code>, <code>aria-controls</code>, <code>aria-disabled</code>.</li>
            <li style="margin-block-end: 6px;">Switch the OS to "Reduce motion" — animations should shorten or stop.</li>
            <li style="margin-block-end: 6px;">Inspect the panels with the Accessibility tree — confirm role <code>region</code> / <code>group</code>.</li>
            <li>Run <code>axe-core</code> on the page — expect zero WCAG 2.1 AA failures.</li>
          </ol>
        </div>
      </aside>
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
          'Accordions are inherently fluid — the surface fills its parent ' +
          'inline-size and panel content reflows automatically. The ' +
          'frames below show the same accordion at four breakpoints to ' +
          'illustrate how summary text wraps, supporting text positions ' +
          'itself, and panel bodies adapt. Headers always honor a 48px ' +
          'minimum touch target so they stay usable on phones, even at ' +
          '<code>density="-2"</code>. The live frame at the bottom is ' +
          'resizable and uses a container query to switch from ' +
          '<code>filled</code> to <code>outlined</code> below 480px ' +
          '(an example of style adaptation, not just layout).',
      },
    },
  },
  render: (_args, { globals }) => {
    const items = [
      {
        headline: t(globals.locale, 'accordion.accountProfile'),
        supportingText: t(globals.locale, 'accordion.respAccountSupporting'),
        body: t(globals.locale, 'accordion.respAccountBody'),
      },
      {
        headline: t(globals.locale, 'accordion.notifications'),
        supportingText: t(globals.locale, 'accordion.respNotifSupporting'),
        body: t(globals.locale, 'accordion.respNotifBody'),
      },
      {
        headline: t(globals.locale, 'accordion.billingSubscription'),
        supportingText: 'Current plan: Pro Annual · Renews 12 May 2027',
        body: t(globals.locale, 'accordion.respBillingBody'),
      },
    ];

    return html`
      <style>
        .acc-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
        .acc-resp-section h3 { margin: 0 0 4px; }
        .acc-resp-section p { margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F); }
        .acc-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
        .acc-resp-vp {
          border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
          border-radius: 12px;
          padding: 12px;
          background: var(--md-sys-color-surface-container-lowest, #fffbfe);
          box-sizing: border-box;
          container-type: inline-size;
          margin-block-end: 12px;
        }
        .acc-resp-live { resize: horizontal; overflow: auto; min-inline-size: 280px; max-inline-size: 100%; inline-size: 720px; }

        /* Container-query example: hide supporting text on narrow widths
           via the exposed 'supporting-text' shadow part. */
        @container (max-width: 480px) {
          .acc-resp-cq md-accordion-item::part(supporting-text) {
            display: none;
          }
        }
      </style>

      <div class="acc-resp-shell">
        <section class="acc-resp-section">
          <h3>1 · Same accordion at four breakpoints</h3>
          <p>
            Single-line summaries wrap if needed. Supporting text drops to
            its own line on narrow widths to preserve the headline's
            legibility.
          </p>
          ${[
            { label: 'XS · 320 px', width: '320px' },
            { label: 'SM · 480 px', width: '480px' },
            { label: 'MD · 768 px', width: '768px' },
            { label: 'LG · 1024 px', width: '1024px' },
          ].map(
            (vp) => html`
              <div>
                <div class="acc-resp-vp__label">${vp.label}</div>
                <div class="acc-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                  <md-accordion variant="filled">
                    ${items.map(
                      (it) => html`
                        <md-accordion-item
                          headline=${it.headline}
                          supporting-text=${it.supportingText}
                        >
                          <p style="margin: 0 0 12px;">${it.body}</p>
                        </md-accordion-item>
                      `,
                    )}
                  </md-accordion>
                </div>
              </div>
            `,
          )}
        </section>

        <section class="acc-resp-section">
          <h3>2 · Hide supporting text below 480px (container query + ::part)</h3>
          <p>
            Wider frames keep the supporting text under each headline;
            narrow frames hide it via
            <code>::part(supporting-text) { display: none }</code> driven
            by a container query, so the headline gets the full width to
            wrap naturally.
          </p>
          ${[
            { label: 'XS · 360 px (no supporting text)', width: '360px' },
            { label: 'SM · 520 px (supporting text shown)', width: '520px' },
            { label: 'LG · 1024 px (supporting text shown)', width: '1024px' },
          ].map(
            (vp) => html`
              <div>
                <div class="acc-resp-vp__label">${vp.label}</div>
                <div class="acc-resp-vp acc-resp-cq" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                  <md-accordion variant="outlined">
                    ${items.map(
                      (it) => html`
                        <md-accordion-item
                          headline=${it.headline}
                          supporting-text=${it.supportingText}
                        >
                          <p style="margin: 0;">${it.body}</p>
                        </md-accordion-item>
                      `,
                    )}
                  </md-accordion>
                </div>
              </div>
            `,
          )}
        </section>

        <section class="acc-resp-section">
          <h3>3 · Live resize playground</h3>
          <p>
            Drag the bottom-right corner of the frame. Watch summary text
            re-flow and supporting text drop to its own line as the
            accordion narrows.
          </p>
          <div class="acc-resp-vp acc-resp-live">
            <md-accordion variant="filled">
              ${items.map(
                (it) => html`
                  <md-accordion-item
                    headline=${it.headline}
                    supporting-text=${it.supportingText}
                  >
                    <p style="margin: 0 0 12px;">${it.body}</p>
                  </md-accordion-item>
                `,
              )}
            </md-accordion>
          </div>
        </section>
      </div>
    `;
  },
};

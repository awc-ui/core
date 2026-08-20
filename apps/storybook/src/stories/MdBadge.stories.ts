import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Await the Stencil `.hydrated` class before reading reflected attrs / shadow DOM. */
const hydrateBadge = async (el: HTMLElement): Promise<HTMLElement> => {
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};

const meta: Meta = {
  title: 'Communication/Badge',
  component: 'md-badge',
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
      options: ['small', 'large'],
    },
    value: { control: 'text' },
    max: { control: 'number' },
    icon: { control: 'text' },
  },
  args: {
    variant: 'large',
    value: '3',
    max: 999,
    icon: '',
  },
};

export default meta;
type Story = StoryObj;

const ICON_WRAPPER = 'position:relative; display:inline-flex;';
const ICON = 'font-size:24px; color:var(--md-sys-color-on-surface-variant, #49454F);';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';
const ROW = 'display:flex; gap:40px; flex-wrap:wrap; align-items:center;';

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  render: (args) => html`
    <div style="${SECTION}">
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">notifications</span>
          <md-badge
            variant="${args.variant}"
            value="${args.value}"
            max="${args.max}"
            icon="${args.icon}"
          ></md-badge>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   VARIANTS
   ========================================================== */
export const Variants: Story = {
  name: 'Small vs Large',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Small (dot)</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">notifications</span>
          <md-badge variant="small"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">mail</span>
          <md-badge variant="small"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">chat</span>
          <md-badge variant="small"></md-badge>
        </div>
      </div>

      <p style="${HEADING}">Large (with label)</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">notifications</span>
          <md-badge value="1"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">mail</span>
          <md-badge value="24"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">chat</span>
          <md-badge value="999"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">shopping_cart</span>
          <md-badge value="2000" max="999"></md-badge>
        </div>
      </div>

      <p style="${HEADING}">Large (no label — empty dot)</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">notifications</span>
          <md-badge></md-badge>
        </div>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Overflow: value 2000 with max 999 must collapse to the "{max}+" indicator.
    const overflow = (await hydrateBadge(
      canvasElement.querySelector('md-badge[value="2000"]') as HTMLElement,
    ));
    await waitFor(() =>
      expect(overflow.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('999+'),
    );
    // The derived aria-label mirrors the clamped display string, not the raw value.
    await waitFor(() => expect(overflow.getAttribute('aria-label')).toBe('999+'));

    // Small dot: derives the "notification" label and renders no visible content.
    const dot = await hydrateBadge(
      canvasElement.querySelector('md-badge[variant="small"]') as HTMLElement,
    );
    await waitFor(() => expect(dot.getAttribute('aria-label')).toBe('notification'));
    expect(dot.shadowRoot!.querySelector('.md-badge__label')).toBeNull();
    expect(dot.shadowRoot!.querySelector('.md-badge__icon')).toBeNull();

    // A plain in-range numeric label renders verbatim (no clamping).
    const labeled = await hydrateBadge(
      canvasElement.querySelector('md-badge[value="24"]') as HTMLElement,
    );
    await waitFor(() =>
      expect(labeled.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('24'),
    );

    // Large with no value + no icon: no content, so accessibleLabel is undefined
    // and no aria-label attribute is reflected at all. `variant` is a reflected
    // prop, so on hydration this badge gains variant="large" — match on that
    // (not :not([variant])) and wait for the reflection to land.
    const empty = await hydrateBadge(
      await waitFor(() => {
        const el = canvasElement.querySelector(
          'md-badge[variant="large"]:not([value]):not([icon])',
        ) as HTMLElement | null;
        expect(el).not.toBeNull();
        return el!;
      }),
    );
    expect(empty).not.toBeNull();
    expect(empty.hasAttribute('aria-label')).toBe(false);
    expect(empty.shadowRoot!.querySelector('.md-badge__label')).toBeNull();
    expect(empty.shadowRoot!.querySelector('.md-badge__icon')).toBeNull();

    // ── Dynamic prop reactions: force the getters to recompute on re-render ──

    // Lowering `max` below an in-range label flips it into the "{max}+" overflow
    // indicator, and the derived aria-label tracks the clamped display string.
    labeled.setAttribute('max', '9');
    await waitFor(() =>
      expect(labeled.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('9+'),
    );
    await waitFor(() => expect(labeled.getAttribute('aria-label')).toBe('9+'));

    // Icon fallback: a large badge with no value but an icon derives its
    // aria-label from the icon name and renders the default glyph slot.
    empty.setAttribute('icon', 'lock');
    await waitFor(() => expect(empty.getAttribute('aria-label')).toBe('lock'));
    await waitFor(() =>
      expect(empty.shadowRoot!.querySelector('.md-badge__icon')?.textContent?.trim()).toBe('lock'),
    );

    // Removing the icon strips all content again: no derived label, no aria-label
    // attribute at all, and neither the glyph nor the label span survive.
    empty.removeAttribute('icon');
    await waitFor(() => expect(empty.hasAttribute('aria-label')).toBe(false));
    await waitFor(() => expect(empty.shadowRoot!.querySelector('.md-badge__icon')).toBeNull());
    expect(empty.shadowRoot!.querySelector('.md-badge__label')).toBeNull();

    // Switching an overflow label to the small dot variant clears the visible
    // value and swaps the derived aria-label to the generic "notification".
    overflow.setAttribute('variant', 'small');
    await waitFor(() => expect(overflow.getAttribute('aria-label')).toBe('notification'));
    await waitFor(() =>
      expect(overflow.shadowRoot!.querySelector('.md-badge__label')).toBeNull(),
    );
  },
};

/* ==========================================================
   NUMERIC VALUES & MAX
   ========================================================== */
export const NumericValues: Story = {
  name: 'Numeric Values & Max Threshold',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Default max (999)</p>
      <div style="${ROW}">
        ${[1, 9, 42, 100, 999, 1500].map(
          (n) => html`
            <div style="text-align:center;">
              <div style="${ICON_WRAPPER}">
                <span class="material-icons" style="${ICON}">mail</span>
                <md-badge value="${n}"></md-badge>
              </div>
              <div style="margin-top:8px; font-size:11px; color:#49454F;">${n}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Custom max (max="9")</p>
      <div style="${ROW}">
        ${[1, 5, 9, 10, 50, 100].map(
          (n) => html`
            <div style="text-align:center;">
              <div style="${ICON_WRAPPER}">
                <span class="material-icons" style="${ICON}">notifications</span>
                <md-badge value="${n}" max="9"></md-badge>
              </div>
              <div style="margin-top:8px; font-size:11px; color:#49454F;">${n}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Custom max (max="99")</p>
      <div style="${ROW}">
        ${[1, 50, 99, 100, 999].map(
          (n) => html`
            <div style="text-align:center;">
              <div style="${ICON_WRAPPER}">
                <span class="material-icons" style="${ICON}">chat</span>
                <md-badge value="${n}" max="99"></md-badge>
              </div>
              <div style="margin-top:8px; font-size:11px; color:#49454F;">${n}</div>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   STRING LABELS
   ========================================================== */
export const StringLabels: Story = {
  name: 'String Labels (4-char max)',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Text content (up to 4 characters)</p>
      <div style="${ROW}">
        ${['!', t(globals.locale, 'badge.new'), t(globals.locale, 'badge.sale'), t(globals.locale, 'badge.beta')].map(
          (label) => html`
            <div style="text-align:center;">
              <div style="${ICON_WRAPPER}">
                <span class="material-icons" style="${ICON}">star</span>
                <md-badge value="${label}"></md-badge>
              </div>
              <div style="margin-top:8px; font-size:11px; color:#49454F;">"${label}"</div>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   WITH ICONS
   ========================================================== */
export const WithIcons: Story = {
  name: 'With Icons (Material Symbols)',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icon-only badges</p>
      <div style="${ROW}">
        ${['error', 'star', 'lock', 'warning'].map(
          (iconName) => html`
            <div style="text-align:center;">
              <div style="${ICON_WRAPPER}">
                <span class="material-icons" style="${ICON}">notifications</span>
                <md-badge icon="${iconName}"></md-badge>
              </div>
              <div style="margin-top:8px; font-size:11px; color:#49454F;">${iconName}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Icon + label combined</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">mail</span>
          <md-badge icon="priority_high" value="5"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">chat</span>
          <md-badge icon="star" value="${t(globals.locale, 'badge.new')}"></md-badge>
        </div>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Icon-only: no value, so accessibleLabel falls back to the icon name,
    // and the default icon slot renders the Material Symbols glyph text.
    const iconOnly = await hydrateBadge(
      canvasElement.querySelector('md-badge[icon="error"]') as HTMLElement,
    );
    await waitFor(() => expect(iconOnly.getAttribute('aria-label')).toBe('error'));
    const glyph = iconOnly.shadowRoot!.querySelector('.md-badge__icon');
    expect(glyph).not.toBeNull();
    expect(glyph!.textContent?.trim()).toBe('error');
    // No label span when there is no value.
    expect(iconOnly.shadowRoot!.querySelector('.md-badge__label')).toBeNull();

    // Icon + value: the visible label wins over the icon for the derived aria-label,
    // and both the icon glyph and the label span render together.
    const iconLabel = await hydrateBadge(
      canvasElement.querySelector('md-badge[icon="priority_high"][value="5"]') as HTMLElement,
    );
    await waitFor(() => expect(iconLabel.getAttribute('aria-label')).toBe('5'));
    expect(iconLabel.shadowRoot!.querySelector('.md-badge__icon')).not.toBeNull();
    await waitFor(() =>
      expect(iconLabel.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('5'),
    );

    // ── Dynamic prop reactions on the icon-only badge ──

    // Adding a value to an icon-only badge makes the label win the derived
    // aria-label while the icon glyph keeps rendering alongside it.
    iconOnly.setAttribute('value', '7');
    await waitFor(() => expect(iconOnly.getAttribute('aria-label')).toBe('7'));
    await waitFor(() =>
      expect(iconOnly.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('7'),
    );
    expect(iconOnly.shadowRoot!.querySelector('.md-badge__icon')).not.toBeNull();

    // A value beyond the default max collapses to "999+" even with an icon present.
    iconOnly.setAttribute('value', '5000');
    await waitFor(() =>
      expect(iconOnly.shadowRoot!.querySelector('.md-badge__label')?.textContent).toBe('999+'),
    );
    await waitFor(() => expect(iconOnly.getAttribute('aria-label')).toBe('999+'));
  },
};

/* ==========================================================
   CUSTOM ICON SLOT
   ========================================================== */
export const CustomIconSlot: Story = {
  name: 'Custom Icon (Slot)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">SVG icon via slot</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">favorite</span>
          <md-badge icon="custom">
            <svg slot="icon" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </md-badge>
        </div>

        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">security</span>
          <md-badge icon="custom">
            <svg slot="icon" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </md-badge>
        </div>
      </div>

      <p style="${HEADING}">Emoji via slot</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">local_fire_department</span>
          <md-badge icon="custom">
            <span slot="icon" style="font-size:10px; line-height:1;">🔥</span>
          </md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="${ICON}">bolt</span>
          <md-badge icon="custom">
            <span slot="icon" style="font-size:10px; line-height:1;">⚡</span>
          </md-badge>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   WITH NAVIGATION
   ========================================================== */
export const WithNavigation: Story = {
  name: 'Anchored on Icons (common use case)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Navigation-style layout</p>
      <div style="display:flex; gap:32px; align-items:flex-end; background:var(--md-sys-color-surface-container, #F3EDF7); padding:16px 24px; border-radius:16px;">
        ${[
          { icon: 'home', badge: '' },
          { icon: 'favorite', badge: '3' },
          { icon: 'notifications', badge: '', variant: 'small' },
          { icon: 'mail', badge: '128' },
          { icon: 'person', badge: '' },
        ].map(
          (item) => html`
            <div style="${ICON_WRAPPER}; cursor:pointer;">
              <span class="material-icons" style="font-size:24px; color:var(--md-sys-color-on-surface-variant, #49454F);">
                ${item.icon}
              </span>
              ${item.badge || item.variant
                ? html`<md-badge
                    variant="${item.variant || 'large'}"
                    value="${item.badge}"
                  ></md-badge>`
                : ''}
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION
   ========================================================== */
export const Localization: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The badge is **content-agnostic** — it renders whatever string you put into <code>value</code>. ' +
          'Pair it with <code>Intl.NumberFormat</code> for locale-correct digit shapes (Arabic-Indic, ' +
          'Devanagari, Eastern Arabic), grouping separators ("1,200" vs "1.200" vs "1\u202F200"), and ' +
          'compact notation ("1.2K" vs "1,2 mil"). Set <code>lang</code> on a wrapping element so screen ' +
          'readers pronounce the digits correctly and the right font fallback ships the right glyphs.\n\n' +
          'For the overflow indicator (<code>{max}+</code>), the component formats `${max}+` literally ' +
          'because the plus sign is universal in number-overflow notation; if your locale prefers a different ' +
          'glyph, set <code>max</code> to the same large number and pass a pre-formatted <code>value</code> ' +
          'instead of letting the badge format it.',
      },
    },
  },
  render: () => {
    type LocaleId = 'en' | 'fr' | 'de' | 'ja' | 'ar' | 'he' | 'hi';
    interface LocalePack {
      label: string;
      lang: string;
      dir: 'ltr' | 'rtl';
      flag: string;
      announce: string;
    }
    const PACKS: Record<LocaleId, LocalePack> = {
      en: { label: 'English',  lang: 'en',    dir: 'ltr', flag: 'EN', announce: '{n} unread notifications' },
      fr: { label: 'Français', lang: 'fr-FR', dir: 'ltr', flag: 'FR', announce: '{n} notifications non lues' },
      de: { label: 'Deutsch',  lang: 'de-DE', dir: 'ltr', flag: 'DE', announce: '{n} ungelesene Benachrichtigungen' },
      ja: { label: '日本語',    lang: 'ja-JP', dir: 'ltr', flag: 'JA', announce: '未読の通知{n}件' },
      ar: { label: 'العربية',  lang: 'ar-EG', dir: 'rtl', flag: 'AR', announce: '{n} إشعارات غير مقروءة' },
      he: { label: 'עברית',    lang: 'he-IL', dir: 'rtl', flag: 'HE', announce: '{n} התראות שלא נקראו' },
      hi: { label: 'हिन्दी',    lang: 'hi-IN', dir: 'ltr', flag: 'HI', announce: '{n} अपठित सूचनाएँ' },
    };

    const counts = [3, 42, 1284];

    return html`
      <style>
        .l10n-badge {
          max-inline-size: 1080px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 32px;
          font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
        }
        .l10n-badge h3 {
          margin: 0 0 6px;
          font: 500 13px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .l10n-badge p {
          margin: 0 0 14px;
          font: 400 13px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          max-inline-size: 760px;
        }
        .l10n-badge p code {
          background: var(--md-sys-color-surface-container, #F3EDF7);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
        }
        .l10n-badge__grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .l10n-badge__tile {
          padding: 16px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          display: grid;
          gap: 12px;
        }
        .l10n-badge__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .l10n-badge__name {
          font: 500 14px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .l10n-badge__meta {
          font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .l10n-badge__row {
          display: flex;
          gap: 28px;
          align-items: flex-end;
          padding: 10px 6px 4px;
        }
        .l10n-badge__icon-wrap {
          position: relative;
          display: inline-flex;
        }
        .l10n-badge__icon {
          font-family: 'Material Icons';
          font-size: 28px;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .l10n-badge__caption {
          margin: 0;
          font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .l10n-badge__caption strong { color: var(--md-sys-color-on-surface, #1C1B1F); }
        .l10n-badge__sr {
          font: 400 12px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          padding: 8px 10px;
          border-radius: 8px;
          background: var(--md-sys-color-surface-container, #F3EDF7);
        }
        .l10n-badge__compact {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
      </style>

      <div class="l10n-badge">
        <!-- 1 · Locale-aware numeric values ───────────────── -->
        <section>
          <h3>1 · Locale-aware numeric values</h3>
          <p>
            Pre-format the number with <code>new Intl.NumberFormat(lang).format(n)</code> and pass the
            result as <code>value</code>. Each tile shows the same three counts (3, 42, 1,284) rendered
            with locale-correct digit shapes and grouping. Notice Arabic and Hindi switch to native
            digit families (Arabic-Indic and Devanagari) while still respecting the badge's 4-character
            cap.
          </p>
          <div class="l10n-badge__grid">
            ${(Object.keys(PACKS) as LocaleId[]).map((id) => {
              const pack = PACKS[id];
              const fmt = (n: number) => new Intl.NumberFormat(pack.lang).format(n);
              return html`
                <article class="l10n-badge__tile" lang=${pack.lang} dir=${pack.dir}>
                  <header class="l10n-badge__head">
                    <span class="l10n-badge__name">${pack.label}</span>
                    <span class="l10n-badge__meta">${pack.lang} · ${pack.dir}</span>
                  </header>
                  <div class="l10n-badge__row">
                    ${counts.map(
                      (n) => html`
                        <div class="l10n-badge__icon-wrap">
                          <span class="l10n-badge__icon">notifications</span>
                          <md-badge value=${fmt(n)} max=${999}></md-badge>
                        </div>
                      `,
                    )}
                  </div>
                  <p class="l10n-badge__caption">
                    raw: <strong>${counts.join(', ')}</strong> →
                    formatted: <strong>${counts.map(fmt).join(', ')}</strong>
                  </p>
                </article>
              `;
            })}
          </div>
        </section>

        <!-- 2 · Compact / short notation ─────────────────── -->
        <section>
          <h3>2 · Compact notation for crowded UIs</h3>
          <p>
            For nav bars where space is at a premium, use
            <code>Intl.NumberFormat(lang, { notation: "compact" })</code> — "1.2K", "1,2\u202Fmil",
            "1.2\u4E07" — and pass the formatted string as <code>value</code>. The badge's
            4-character cap keeps even verbose locale outputs visually contained.
          </p>
          <div class="l10n-badge__compact">
            ${(['en', 'fr', 'de', 'ja', 'ar', 'hi'] as LocaleId[]).map((id) => {
              const pack = PACKS[id];
              const compact = new Intl.NumberFormat(pack.lang, {
                notation: 'compact',
                maximumFractionDigits: 1,
              });
              return html`
                <article class="l10n-badge__tile" lang=${pack.lang} dir=${pack.dir}>
                  <header class="l10n-badge__head">
                    <span class="l10n-badge__name">${pack.label}</span>
                    <span class="l10n-badge__meta">${pack.lang}</span>
                  </header>
                  <div class="l10n-badge__row">
                    <div class="l10n-badge__icon-wrap">
                      <span class="l10n-badge__icon">mail</span>
                      <md-badge value=${compact.format(1284)}></md-badge>
                    </div>
                    <div class="l10n-badge__icon-wrap">
                      <span class="l10n-badge__icon">forum</span>
                      <md-badge value=${compact.format(28500)}></md-badge>
                    </div>
                  </div>
                  <p class="l10n-badge__caption">
                    <strong>${compact.format(1284)}</strong>,
                    <strong>${compact.format(28500)}</strong>
                  </p>
                </article>
              `;
            })}
          </div>
        </section>

        <!-- 3 · Translated screen-reader labels ─────────── -->
        <section>
          <h3>3 · Translated screen-reader labels</h3>
          <p>
            The default <code>aria-label</code> falls back to the visible value or "notification" for the
            small dot variant. Override with a fully-translated phrase for accessibility — the badge's
            <code>aria-label</code> attribute always wins over the auto-derived one.
          </p>
          <div class="l10n-badge__grid">
            ${(['en', 'fr', 'de', 'ja', 'ar', 'he'] as LocaleId[]).map((id) => {
              const pack = PACKS[id];
              const fmt = (n: number) => new Intl.NumberFormat(pack.lang).format(n);
              const label = pack.announce.replace('{n}', fmt(7));
              return html`
                <article class="l10n-badge__tile" lang=${pack.lang} dir=${pack.dir}>
                  <header class="l10n-badge__head">
                    <span class="l10n-badge__name">${pack.label}</span>
                    <span class="l10n-badge__meta">${pack.lang} · ${pack.dir}</span>
                  </header>
                  <div class="l10n-badge__row">
                    <div class="l10n-badge__icon-wrap">
                      <span class="l10n-badge__icon">notifications</span>
                      <md-badge value=${fmt(7)} aria-label=${label}></md-badge>
                    </div>
                  </div>
                  <p class="l10n-badge__sr">aria-label: ${label}</p>
                </article>
              `;
            })}
          </div>
        </section>
      </div>
    `;
  },
};

/* ==========================================================
   RTL
   ========================================================== */
export const RTL: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          '**Where the badge sits in RTL.** The base styles anchor the host with the physical ' +
          'shorthands <code>top: 0; right: 0;</code> and a translate of <code>(50%, -50%)</code>, so ' +
          'the badge sits at the visual top-right corner regardless of writing direction. The MD3 spec ' +
          'puts the badge at the *trailing-top* corner — that\'s top-right in LTR and **top-left** in ' +
          'RTL. Side 2 below shows the official MD3-aligned RTL pattern: a thin per-instance class ' +
          'flips the anchor with logical positioning. Pick the variant your app needs.\n\n' +
          'Bidirectional content (a Latin number next to an Arabic / Hebrew label) needs ' +
          '<code>unicode-bidi: isolate</code> on the wrapping element so the digits and the surrounding ' +
          'script don\'t reorder around each other.',
      },
    },
  },
  render: () => html`
    <style>
      .rtl-badge {
        max-inline-size: 1080px;
        margin: 0 auto;
        padding: 24px;
        display: grid;
        gap: 32px;
        font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
      }
      .rtl-badge h3 {
        margin: 0 0 6px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rtl-badge p {
        margin: 0 0 14px;
        font: 400 13px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        max-inline-size: 760px;
      }
      .rtl-badge p code, .rtl-badge li code {
        background: var(--md-sys-color-surface-container, #F3EDF7);
        padding: 1px 6px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
      .rtl-badge__panel {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .rtl-badge__tile {
        padding: 20px 24px;
        border-radius: 16px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      .rtl-badge__tile h4 {
        margin: 0 0 6px;
        font: 500 16px/24px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface, #1C1B1F);
      }
      .rtl-badge__tile p {
        margin: 0 0 12px;
        font: 400 12px/18px Roboto, sans-serif;
      }
      .rtl-badge__row {
        display: flex;
        gap: 28px;
        align-items: flex-end;
        padding: 12px 8px;
        background: var(--md-sys-color-surface-container, #F3EDF7);
        border-radius: 12px;
      }
      .rtl-badge__icon-wrap {
        position: relative;
        display: inline-flex;
      }
      .rtl-badge__icon {
        font-family: 'Material Icons';
        font-size: 28px;
        color: var(--md-sys-color-on-surface, #1C1B1F);
      }

      /* RTL-aware override that flips the anchor for RTL contexts.
         Uses :dir() so the override only fires when the closest dir
         is rtl — works for nested LTR islands inside an RTL page. */
      .rtl-badge__leading-anchored:dir(rtl) md-badge {
        --md-badge-offset-x: -50%;
        right: auto;
        left: 0;
      }

      .rtl-badge__bidi {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--md-sys-color-surface-container, #F3EDF7);
        unicode-bidi: isolate;
      }
    </style>

    <div class="rtl-badge">
      <!-- 1 · Default behaviour vs explicit RTL anchor ────── -->
      <section>
        <h3>1 · Default vs MD3-aligned RTL anchor</h3>
        <p>
          Both panels render the same badges inside a <code>dir="rtl"</code> wrapper. Side A keeps the
          ship-as-is anchor (visual top-right). Side B applies the
          <code>.rtl-badge__leading-anchored</code> helper class, which uses <code>:dir(rtl)</code> +
          <code>--md-badge-offset-x</code> + a <code>left: 0; right: auto</code> override to move the
          badge to the trailing-top corner that MD3 specifies — the visual top-left in RTL.
        </p>
        <div class="rtl-badge__panel">
          <article class="rtl-badge__tile" dir="rtl" lang="ar-EG">
            <h4>A · Default (visual top-right)</h4>
            <p>Badge sits on the visual right regardless of <code>dir</code>.</p>
            <div class="rtl-badge__row">
              ${[
                { icon: 'home', value: '' },
                { icon: 'favorite', value: '٣' },
                { icon: 'mail', value: '٤٢' },
                { icon: 'notifications', value: '١٢٨٤' },
              ].map(
                (it) => html`
                  <div class="rtl-badge__icon-wrap">
                    <span class="rtl-badge__icon">${it.icon}</span>
                    <md-badge value=${it.value} variant=${it.value ? 'large' : 'small'}></md-badge>
                  </div>
                `,
              )}
            </div>
          </article>

          <article class="rtl-badge__tile rtl-badge__leading-anchored" dir="rtl" lang="ar-EG">
            <h4>B · MD3-aligned (trailing-top, visually left)</h4>
            <p>
              Per-instance helper flips the anchor in RTL contexts using
              <code>:dir(rtl)</code> + <code>--md-badge-offset-x</code>. LTR pages are unaffected.
            </p>
            <div class="rtl-badge__row">
              ${[
                { icon: 'home', value: '' },
                { icon: 'favorite', value: '٣' },
                { icon: 'mail', value: '٤٢' },
                { icon: 'notifications', value: '١٢٨٤' },
              ].map(
                (it) => html`
                  <div class="rtl-badge__icon-wrap">
                    <span class="rtl-badge__icon">${it.icon}</span>
                    <md-badge value=${it.value} variant=${it.value ? 'large' : 'small'}></md-badge>
                  </div>
                `,
              )}
            </div>
          </article>
        </div>
      </section>

      <!-- 2 · LTR vs RTL side by side ─────────────────────── -->
      <section>
        <h3>2 · LTR ↔ RTL · same content</h3>
        <p>
          Same icon, same numeric value, only the writing direction of the wrapper changes. The badge
          itself doesn't reorder — only the surrounding label flow does, because the badge is positioned
          out of the document flow.
        </p>
        <div class="rtl-badge__panel">
          <article class="rtl-badge__tile" dir="ltr" lang="en">
            <h4>LTR · English</h4>
            <div class="rtl-badge__row">
              <div class="rtl-badge__icon-wrap">
                <span class="rtl-badge__icon">notifications</span>
                <md-badge value="42" aria-label="42 unread notifications"></md-badge>
              </div>
              <span>Unread mail</span>
            </div>
          </article>
          <article class="rtl-badge__tile" dir="rtl" lang="he-IL">
            <h4>RTL · עברית</h4>
            <div class="rtl-badge__row">
              <div class="rtl-badge__icon-wrap">
                <span class="rtl-badge__icon">notifications</span>
                <md-badge value="42" aria-label="42 התראות שלא נקראו"></md-badge>
              </div>
              <span>הודעות שלא נקראו</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 3 · Bidirectional content inside a label ────────── -->
      <section>
        <h3>3 · Bidirectional content · isolate Latin numerals from RTL labels</h3>
        <p>
          When mixing Latin digits with Arabic / Hebrew labels in the same line, wrap each segment in
          <code>unicode-bidi: isolate</code> so the digits keep their native order. The badge itself is
          single-token text, so its internal direction is preserved automatically.
        </p>
        <div class="rtl-badge__row" dir="rtl" lang="ar-EG">
          <div class="rtl-badge__icon-wrap">
            <span class="rtl-badge__icon">mail</span>
            <md-badge value="42" aria-label="42 إشعارات غير مقروءة"></md-badge>
          </div>
          <span class="rtl-badge__bidi">
            <span lang="en" style="unicode-bidi: isolate;">42</span>
            <span>إشعارات</span>
          </span>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   ACCESSIBILITY
   ========================================================== */
export const Accessibility: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The badge ships <code>role="status"</code> + a computed <code>aria-label</code> derived from ' +
          '<code>value</code> / <code>icon</code> (or "notification" for the small dot). The defaults ' +
          'are sensible for the majority of UIs but every aria attribute is overridable on the host.\n\n' +
          '**The five accessibility patterns you actually need:**\n\n' +
          '1. **Default** — let the badge derive its label. Best for stand-alone numeric counters.\n' +
          '2. **Override <code>aria-label</code>** — when you want a translated phrase ("3 unread messages") instead of just "3".\n' +
          '3. **Decorative** — set <code>aria-hidden="true"</code> when the parent already exposes the count to AT (avoids double-announcement).\n' +
          '4. **Live regions** — wrap the badge in <code>role="status"</code> / <code>aria-live="polite"</code> when the count changes dynamically (e.g. polling).\n' +
          '5. **Forced colors / High contrast** — the built-in <code>@media (forced-colors: active)</code> block maps the badge to system <code>Mark</code> / <code>MarkText</code> automatically.',
      },
    },
  },
  render: () => html`
    <style>
      .a11y-badge {
        max-inline-size: 1080px;
        margin: 0 auto;
        padding: 24px;
        display: grid;
        gap: 32px;
        font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
      }
      .a11y-badge h3 {
        margin: 0 0 6px;
        font: 500 13px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .a11y-badge p {
        margin: 0 0 14px;
        font: 400 13px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        max-inline-size: 760px;
      }
      .a11y-badge p code, .a11y-badge li code, .a11y-badge dl code {
        background: var(--md-sys-color-surface-container, #F3EDF7);
        padding: 1px 6px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
      .a11y-badge__cards {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .a11y-badge__card {
        padding: 20px;
        border-radius: 16px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        display: grid;
        gap: 12px;
      }
      .a11y-badge__card h4 {
        margin: 0;
        font: 500 16px/24px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface, #1C1B1F);
      }
      .a11y-badge__demo {
        display: flex;
        gap: 28px;
        align-items: flex-end;
        padding: 12px 8px;
      }
      .a11y-badge__icon-wrap {
        position: relative;
        display: inline-flex;
      }
      .a11y-badge__icon {
        font-family: 'Material Icons';
        font-size: 28px;
        color: var(--md-sys-color-on-surface, #1C1B1F);
      }
      .a11y-badge__btn {
        position: relative;
      }
      .a11y-badge__sr {
        font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface, #1C1B1F);
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--md-sys-color-surface-container, #F3EDF7);
        white-space: pre-wrap;
      }
      .a11y-badge__live-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .a11y-badge__hc {
        forced-color-adjust: none;
        background: Canvas;
        color: CanvasText;
        border: 1px dashed CanvasText;
        padding: 16px;
        border-radius: 12px;
      }
      .a11y-badge__hc * { forced-color-adjust: auto; }
      .a11y-badge__table {
        width: 100%;
        border-collapse: collapse;
        font: 400 13px/20px Roboto, sans-serif;
      }
      .a11y-badge__table th, .a11y-badge__table td {
        text-align: start;
        padding: 8px 12px;
        border-block-end: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        vertical-align: top;
      }
      .a11y-badge__table th {
        font-weight: 500;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        background: var(--md-sys-color-surface-container, #F3EDF7);
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.6px;
      }
    </style>

    <div class="a11y-badge">
      <!-- 1 · Default + override patterns ────────────────── -->
      <section>
        <h3>1 · Default · override · decorative</h3>
        <p>
          Three side-by-side patterns. Inspect each badge's <code>aria-label</code> /
          <code>aria-hidden</code> in dev-tools to confirm the contract.
        </p>
        <div class="a11y-badge__cards">
          <article class="a11y-badge__card">
            <h4>Default (auto-label)</h4>
            <p>
              <code>role="status"</code>, <code>aria-label="3"</code> derived from
              <code>value</code>. Best for raw counters.
            </p>
            <div class="a11y-badge__demo">
              <div class="a11y-badge__icon-wrap">
                <span class="a11y-badge__icon">notifications</span>
                <md-badge value="3"></md-badge>
              </div>
            </div>
            <pre class="a11y-badge__sr">SR: "status, 3"</pre>
          </article>

          <article class="a11y-badge__card">
            <h4>Translated override</h4>
            <p>Pass an explicit <code>aria-label</code> for a full natural-language phrase.</p>
            <div class="a11y-badge__demo">
              <div class="a11y-badge__icon-wrap">
                <span class="a11y-badge__icon">mail</span>
                <md-badge value="3" aria-label="3 unread emails"></md-badge>
              </div>
            </div>
            <pre class="a11y-badge__sr">SR: "status, 3 unread emails"</pre>
          </article>

          <article class="a11y-badge__card">
            <h4>Decorative (suppressed)</h4>
            <p>
              <code>aria-hidden="true"</code> when the parent already speaks the count, so screen
              readers don't announce it twice.
            </p>
            <div class="a11y-badge__demo">
              <button
                type="button"
                class="a11y-badge__btn"
                aria-label="Open inbox, 3 unread emails"
                style="position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 1px solid var(--md-sys-color-outline, #79747E); background: transparent; color: var(--md-sys-color-on-surface, #1C1B1F); cursor: pointer; font: inherit;"
              >
                <span class="a11y-badge__icon" style="font-size:20px;">inbox</span>
                <span>Inbox</span>
                <md-badge value="3" aria-hidden="true"></md-badge>
              </button>
            </div>
            <pre class="a11y-badge__sr">SR: "Open inbox, 3 unread emails, button"</pre>
          </article>
        </div>
      </section>

      <!-- 2 · Live regions for changing counts ───────────── -->
      <section>
        <h3>2 · Live counters · announce updates</h3>
        <p>
          The badge itself sets <code>role="status"</code>, but for predictable announcements when
          counts change you generally want to control the live region at the wrapper level. Click the
          buttons below to mutate the count — your screen reader should announce each change.
        </p>
        <div class="a11y-badge__cards">
          <article class="a11y-badge__card" data-a11y-live>
            <h4>Polite live region</h4>
            <div class="a11y-badge__demo">
              <div class="a11y-badge__icon-wrap" role="status" aria-live="polite" aria-atomic="true">
                <span class="a11y-badge__icon">forum</span>
                <md-badge data-a11y-count value="0" aria-label="0 new replies"></md-badge>
              </div>
            </div>
            <div class="a11y-badge__live-controls">
              <md-button data-a11y-action="inc" variant="filled" size="sm" icon="add">+1</md-button>
              <md-button data-a11y-action="dec" variant="outlined" size="sm" icon="remove">−1</md-button>
              <md-button data-a11y-action="reset" variant="text" size="sm" icon="refresh">Reset</md-button>
            </div>
            <pre class="a11y-badge__sr">SR: "0 new replies" → "1 new reply" → "2 new replies"</pre>
          </article>
        </div>
      </section>

      <!-- 3 · Forced-colors mode preview ─────────────────── -->
      <section>
        <h3>3 · Forced colors · Windows High Contrast</h3>
        <p>
          The component ships a <code>@media (forced-colors: active)</code> block that remaps the badge
          to the system <code>Mark</code> background and <code>MarkText</code> foreground. Test in
          Windows High Contrast or Edge "Forced Colors" emulation — no per-app theming required.
        </p>
        <div class="a11y-badge__hc">
          <div class="a11y-badge__demo">
            <div class="a11y-badge__icon-wrap">
              <span class="a11y-badge__icon">notifications</span>
              <md-badge value="3"></md-badge>
            </div>
            <div class="a11y-badge__icon-wrap">
              <span class="a11y-badge__icon">mail</span>
              <md-badge value="42"></md-badge>
            </div>
            <div class="a11y-badge__icon-wrap">
              <span class="a11y-badge__icon">favorite</span>
              <md-badge variant="small"></md-badge>
            </div>
          </div>
        </div>
      </section>

      <!-- 4 · ARIA reference table ───────────────────────── -->
      <section>
        <h3>4 · ARIA quick reference</h3>
        <table class="a11y-badge__table">
          <thead>
            <tr><th>Attribute</th><th>Default</th><th>When to override</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>role</code></td>
              <td><code>"status"</code></td>
              <td>
                Set to <code>presentation</code> when the badge is purely decorative and the parent
                already exposes meaning to AT.
              </td>
            </tr>
            <tr>
              <td><code>aria-label</code></td>
              <td>
                Auto: visible <code>value</code>, falling back to <code>icon</code>, falling back to
                "notification" (small).
              </td>
              <td>
                Override with a translated phrase or pluralised count
                ("3 unread messages") instead of just the number.
              </td>
            </tr>
            <tr>
              <td><code>aria-hidden</code></td>
              <td>—</td>
              <td>
                Set <code>"true"</code> when the parent button / link already announces the count
                — prevents AT from reading it twice.
              </td>
            </tr>
            <tr>
              <td><code>aria-live</code></td>
              <td>—</td>
              <td>
                Set on the wrapping element (with <code>aria-atomic="true"</code>) when the count
                changes dynamically and you want updates announced.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 5 · Why no event emitters / controlled-vs-uncontrolled -->
      <section>
        <h3>5 · Note on Event Emitters &amp; Controlled vs Uncontrolled</h3>
        <p>
          <code>md-badge</code> is purely presentational — it has no events and no internal state.
          Every visible field comes from a prop the parent passes in, so the controlled / uncontrolled
          distinction does not apply. If you need click handling, attach the listener to the
          surrounding element (an <code>md-button</code>, <code>md-icon-button</code>, or any other
          actionable parent); the badge sits on top with <code>pointer-events: none</code> so it never
          intercepts the click.
        </p>
      </section>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Wire the live-counter demo. Idempotent — safe to re-run on hot reload.
    const root = canvasElement.querySelector('[data-a11y-live]');
    if (!root || (root as HTMLElement).dataset.ready === 'true') return;
    (root as HTMLElement).dataset.ready = 'true';

    const badge = root.querySelector<HTMLElement>('[data-a11y-count]');
    if (!badge) return;
    let n = 0;
    const apply = () => {
      badge.setAttribute('value', String(n));
      const phrase =
        n === 0 ? '0 new replies' : n === 1 ? '1 new reply' : `${n} new replies`;
      badge.setAttribute('aria-label', phrase);
    };

    root
      .querySelector('[data-a11y-action="inc"]')
      ?.addEventListener('click', () => {
        n = Math.min(n + 1, 9999);
        apply();
      });
    root
      .querySelector('[data-a11y-action="dec"]')
      ?.addEventListener('click', () => {
        n = Math.max(n - 1, 0);
        apply();
      });
    root
      .querySelector('[data-a11y-action="reset"]')
      ?.addEventListener('click', () => {
        n = 0;
        apply();
      });
  },
};

/* ==========================================================
   CUSTOM CSS
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Custom colors</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">check_circle</span>
            <md-badge value="OK" style="--md-badge-container-color: #1B5E20; --md-badge-label-color: #FFFFFF;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Green success</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">warning</span>
            <md-badge value="!" style="--md-badge-container-color: #E65100; --md-badge-label-color: #FFFFFF;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Orange warning</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">info</span>
            <md-badge value="i" style="--md-badge-container-color: #0D47A1; --md-badge-label-color: #FFFFFF;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Blue info</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">notifications</span>
            <md-badge variant="small" style="--md-badge-container-color: #1B5E20;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Green dot</div>
        </div>
      </div>

      <p style="${HEADING}">Custom size & padding</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="font-size:32px; color:#49454F;">mail</span>
            <md-badge value="99+" style="--md-badge-large-height: 20px; --md-badge-large-padding: 0 6px;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Larger badge</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="font-size:32px; color:#49454F;">notifications</span>
            <md-badge variant="small" style="--md-badge-small-size: 10px;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Larger dot</div>
        </div>
      </div>

      <p style="${HEADING}">Custom shape</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">mail</span>
            <md-badge value="5" style="--md-badge-container-shape: 4px;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Square corners</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">mail</span>
            <md-badge value="5" style="--md-badge-container-shape: 0;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Sharp corners</div>
        </div>
      </div>

      <p style="${HEADING}">Custom position offset</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">mail</span>
            <md-badge value="3" style="--md-badge-offset-x: 80%; --md-badge-offset-y: -80%;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Pushed outward</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">mail</span>
            <md-badge value="3" style="--md-badge-offset-x: 20%; --md-badge-offset-y: -20%;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Pulled inward</div>
        </div>
      </div>

      <p style="${HEADING}">Custom icon size & color</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">lock</span>
            <md-badge icon="star" style="--md-badge-icon-size: 12px; --md-badge-large-height: 20px;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Larger icon</div>
        </div>
        <div style="text-align:center;">
          <div style="${ICON_WRAPPER}">
            <span class="material-icons" style="${ICON}">lock</span>
            <md-badge icon="error" style="--md-badge-container-color: #E65100; --md-badge-icon-color: #FFF8E1;"></md-badge>
          </div>
          <div style="margin-top:8px; font-size:11px; color:#49454F;">Custom icon color</div>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   DARK THEME
   ========================================================== */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); color: var(--md-sys-color-on-surface, #E6E1E5); padding: 32px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}; color:#CAC4D0;">Dark Theme</p>
      <div style="${ROW}">
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="font-size:24px; color:#CAC4D0;">notifications</span>
          <md-badge variant="small"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="font-size:24px; color:#CAC4D0;">mail</span>
          <md-badge value="5"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="font-size:24px; color:#CAC4D0;">chat</span>
          <md-badge value="2000" max="999"></md-badge>
        </div>
        <div style="${ICON_WRAPPER}">
          <span class="material-icons" style="font-size:24px; color:#CAC4D0;">lock</span>
          <md-badge icon="error"></md-badge>
        </div>
      </div>
    </div>
  `,
};

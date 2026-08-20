import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { t } from '../i18n';
import { ICON_NAMES } from './icon-names';

const meta: Meta = {
  title: 'Foundations/Icons',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // Reference page, not a component — no a11y gate (the copy-on-click cards
    // aren't focusable controls) or visual baseline (huge icon grid), matching
    // the Design Tokens foundation page.
    a11y: { disable: true },
    visual: { skip: true },
    docs: {
      description: {
        component:
          'The complete Material Symbols set the components ship with. Use a name in any ' +
          '`icon=""` prop (e.g. `<md-button icon="save">`) or as `<span class="material-symbols-outlined">name</span>`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** Copy the icon name and flash a "copied ✓" confirmation on the card. */
const copyIcon = (e: Event) => {
  const card = e.currentTarget as HTMLElement;
  if (card.dataset.copying) return;
  const name = card.dataset.name || '';
  navigator.clipboard?.writeText(name);
  const label = card.querySelector('.icon-name');
  if (!label) return;
  card.dataset.copying = '1';
  const original = label.textContent;
  label.textContent = 'copied ✓';
  card.classList.add('icon-card--copied');
  setTimeout(() => {
    label.textContent = original;
    card.classList.remove('icon-card--copied');
    delete card.dataset.copying;
  }, 1000);
};

/** Filter the grid live by icon name. */
const filterIcons = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const q = input.value.trim().toLowerCase();
  const page = input.closest('.icons-page');
  if (!page) return;
  const grid = page.querySelector('.icons-grid');
  const counter = page.querySelector('.icons-count');
  if (!grid) return;
  let shown = 0;
  for (const card of Array.from(grid.children) as HTMLElement[]) {
    const match = !q || (card.dataset.name || '').includes(q);
    card.style.display = match ? '' : 'none';
    if (match) shown += 1;
  }
  if (counter) counter.textContent = `${shown.toLocaleString()} of ${ICON_NAMES.length.toLocaleString()} icons`;
};

const gridStyles = html`
  <style>
    .icons-page {
      padding: 24px;
      font-family: var(--md-sys-typescale-body-medium-font, Roboto, sans-serif);
      color: var(--md-sys-color-on-surface, #1c1b1f);
    }
    .icons-page h2 { font-size: 22px; font-weight: 400; margin: 0 0 4px; }
    .icons-page p { font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454f); margin: 0 0 16px; }
    .icons-page code {
      font-family: 'Roboto Mono', ui-monospace, monospace; font-size: 12px;
      background: var(--md-sys-color-surface-container-high, #ece6f0); padding: 1px 5px; border-radius: 4px;
    }
    .icons-search {
      width: 100%; max-width: 420px; box-sizing: border-box;
      padding: 10px 14px; margin-bottom: 8px; font-size: 14px;
      border: 1px solid var(--md-sys-color-outline, #79747e); border-radius: 24px;
      background: var(--md-sys-color-surface, #fffbfe); color: inherit;
    }
    .icons-search:focus { outline: 2px solid var(--md-sys-color-primary, #6750a4); outline-offset: -1px; }
    .icons-count { font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454f); margin-bottom: 16px; }
    .icons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
    .icon-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 16px 8px; border-radius: 12px; cursor: pointer; user-select: none;
      background: var(--md-sys-color-surface-container, #f3edf7);
      transition: background 150ms;
      /* Only render on-screen cards — keeps the full ~3.8k-icon grid fast. */
      content-visibility: auto;
      contain-intrinsic-size: auto 84px;
    }
    .icon-card:hover { background: var(--md-sys-color-surface-container-high, #ece6f0); }
    .icon-card--copied { background: var(--md-sys-color-primary-container, #eaddff); }
    .icon-card .material-symbols-outlined { font-size: 28px; color: var(--md-sys-color-on-surface-variant, #49454f); }
    .icon-card .icon-name {
      font-size: 10px; color: var(--md-sys-color-on-surface-variant, #49454f);
      text-align: center; word-break: break-word; line-height: 1.3;
    }
    .icon-card--copied .icon-name, .icon-card--copied .material-symbols-outlined {
      color: var(--md-sys-color-on-primary-container, #21005d);
    }
  </style>
`;

export const AllIcons: Story = {
  name: 'All Icons',
  render: () => html`
    ${gridStyles}
    <div class="icons-page">
      <h2>Material Symbols</h2>
      <p>
        ${ICON_NAMES.length.toLocaleString()} icons. Click any to copy its name. Use it as
        <code>icon="name"</code> or <code>&lt;span class="material-symbols-outlined"&gt;name&lt;/span&gt;</code>.
      </p>
      <input
        class="icons-search"
        type="search"
        placeholder="Search icons…"
        aria-label="Search icons"
        @input=${filterIcons}
      />
      <div class="icons-count">${ICON_NAMES.length.toLocaleString()} icons</div>
      <div class="icons-grid">
        ${ICON_NAMES.map(
          (name) => html`
            <div class="icon-card" data-name="${name}" title="${name}" @click=${copyIcon}>
              <span class="material-symbols-outlined">${name}</span>
              <span class="icon-name">${name}</span>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex;align-items:center;gap:24px;padding:32px;flex-wrap:wrap;">
      ${[18, 24, 36, 48].map(
        (size) => html`
          <div style="text-align:center">
            <span class="material-symbols-outlined" style="font-size:${size}px;color:var(--md-sys-color-on-surface,#1c1b1f)">star</span>
            <p style="font-size:11px;margin:4px 0 0;color:var(--md-sys-color-on-surface-variant,#49454f)">
              ${size}px${size === 24 ? ' (default)' : ''}
            </p>
          </div>
        `,
      )}
    </div>
  `,
};

export const WithComponents: Story = {
  name: 'Icons in Components',
  render: (_args, { globals }) => html`
    <div style="display:flex;flex-direction:column;gap:16px;padding:24px;align-items:flex-start;">
      <md-button variant="filled" icon="add">${t(globals.locale, 'icons.addItem')}</md-button>
      <md-button variant="outlined" icon="download">${t(globals.locale, 'icons.download')}</md-button>
      <md-button variant="tonal" icon="share" trailing-icon="arrow_forward">${t(globals.locale, 'icons.share')}</md-button>
      <div style="display:flex;gap:8px;">
        <md-icon-button icon="favorite" aria-label="${t(globals.locale, 'icons.favorite')}"></md-icon-button>
        <md-icon-button icon="bookmark" aria-label="${t(globals.locale, 'icons.bookmark')}"></md-icon-button>
        <md-icon-button icon="more_vert" aria-label="${t(globals.locale, 'icons.moreOptions')}"></md-icon-button>
        <md-icon-button icon="notifications" aria-label="${t(globals.locale, 'icons.notifications')}"></md-icon-button>
      </div>
      <md-fab icon="edit" variant="primary" aria-label="${t(globals.locale, 'edit')}"></md-fab>
    </div>
  `,
};

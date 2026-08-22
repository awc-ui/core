import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   play() helpers — testing-library can't cross shadow roots, and md-list rows
   are slotted in the LIGHT DOM (direct children of md-list), so interactions
   address the real elements directly. getMdList first awaits hydration: the
   roving tabindex and the reflected ARIA / selected state only exist once the
   `.hydrated` class lands.
   ═══════════════════════════════════════════════════════════════════════════ */
const getMdList = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const list = canvasElement.querySelector('md-list') as HTMLElement;
  await waitFor(() => expect(list.classList.contains('hydrated')).toBe(true));
  return list;
};
/** Direct-child rows only — excludes interleaved dividers AND nested expanded-content rows. */
const rowsOf = (list: HTMLElement): HTMLElement[] =>
  Array.from(list.querySelectorAll(':scope > md-list-item'));
const selectedRows = (list: HTMLElement): NodeListOf<HTMLElement> =>
  list.querySelectorAll(':scope > md-list-item[aria-selected="true"]');
const onlySelectedHeadline = (list: HTMLElement): string | null =>
  (
    list.querySelector(':scope > md-list-item[aria-selected="true"]') as HTMLElement | null
  )?.getAttribute('headline') ?? null;
/**
 * A row can only be *selected* once md-list has (a) hydrated it and
 * (b) propagated `selection-mode` down to it. That propagation runs in
 * md-list's `componentDidLoad` (AFTER the row's own hydration) and, in the
 * same render, flips the row to `role="option"` while wiring its host
 * `onClick` handler. A *preselected* row already reports `aria-selected="true"`
 * from its `selected` attribute alone — before propagation — so the
 * "preselected" checks do NOT prove the rows are interactive yet. Clicking a
 * row before that interactive render lands is a silent no-op (no handler → no
 * `mdItemClick` → md-list never runs `activateItem`), so selection never flips
 * and the row's `aria-selected` is stuck at `"false"`. Gate every selection
 * click on this readiness fingerprint so the click can never be dropped.
 */
const rowSelectionReady = async (row: HTMLElement): Promise<void> => {
  await waitFor(() => {
    expect(row.classList.contains('hydrated')).toBe(true);
    expect(row.getAttribute('role')).toBe('option');
  });
};
const tabbableRow = (list: HTMLElement): HTMLElement | null =>
  list.querySelector(':scope > md-list-item[tabindex="0"]');
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

/* ═══════════════════════════════════════════════════════════════════════════
   Shared style helpers — kept minimal and themed so every story behaves
   correctly in dark mode and respects the host application's typography.
   ═══════════════════════════════════════════════════════════════════════════ */
const sectionLabel = (text: string) => html`
  <h4
    style="
      margin: 0 0 4px;
      font-family: var(--md-sys-typescale-title-small-font-family, system-ui, sans-serif);
      font-size: 14px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    "
  >${text}</h4>
`;

const caption = (text: string) => html`
  <p
    style="
      margin: 0 0 12px;
      font-family: var(--md-sys-typescale-body-small-font-family, system-ui, sans-serif);
      font-size: 12px;
      line-height: 16px;
      color: var(--md-sys-color-on-surface-variant);
    "
  >${text}</p>
`;

const grid = (children: unknown) => html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; align-items: start;">
    ${children}
  </div>
`;

const meta: Meta = {
  title: 'Containment/List',
  component: 'md-list',
  tags: ['autodocs'],
  parameters: {
    /* List rows truncate (min-inline-size: 0), so under Storybook's global
       `layout: 'centered'` the list — a shrink-to-fit child — collapsed to its
       min-content (icon) width and every row crammed. `padded` gives stories a
       normal full-width canvas; combined with the component's default
       `inline-size: 100%`, lists render at a readable width in Canvas AND
       Docs. Per-story `inline-size` / `max-inline-size` still constrain width. */
    layout: 'padded',
    docs: {
      source: { language: 'html' },
      description: {
        component:
          'Material Design 3 list container. Provides two visual variants ' +
          '(`standard`, `segmented`), two interaction modes (`single-action`, ' +
          '`multi-action`), optional single / multi-select coordination across ' +
          'child rows, drag-and-drop reordering (`reorderable`), full ' +
          'roving-tabindex keyboard support (arrows, Home / End, typeahead), and ' +
          'an imperative API for programmatic activation and selection. ' +
          'A list uses exactly one interaction mode and one selection mode at a time.',
      },
    },
  },
  argTypes: {
    listStyle: {
      control: 'select',
      options: ['standard', 'segmented'],
      description:
        'Visual style. `standard` (default, M3 Expressive) shares one rounded chassis with no gap. ' +
        '`segmented` renders each row as its own rounded tile with a small gap.',
    },
    selectionMode: {
      control: 'select',
      options: ['none', 'single-select', 'multi-select'],
      description:
        'When set, the container becomes `role="listbox"`, items become `role="option"`, ' +
        'and plain `type="text"` rows auto-promote to focusable.',
    },
    interactionMode: {
      control: 'select',
      options: ['single-action', 'multi-action'],
      description:
        'Row interaction pattern. `single-action` (default): whole row is one tap target. ' +
        '`multi-action`: primary row action + separate trailing icon-buttons.',
    },
    reorderable: {
      control: 'boolean',
      description:
        'Enable drag-to-reorder. Each row renders a trailing drag handle; ' +
        'drop emits `mdReorder`. Rows also move with Alt+ArrowUp/Down when focused.',
    },
    label: {
      control: 'text',
      description: 'Optional aria-label for the container.',
    },
    roleOverride: {
      control: 'text',
      description: 'Override the auto-computed ARIA role (e.g. `menu`, `tree`).',
    },
  },
  args: {
    listStyle: 'standard',
    selectionMode: 'none',
    interactionMode: 'single-action',
    reorderable: false,
    label: '',
    roleOverride: '',
  },
};
export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   1. PLAYGROUND
   ═══════════════════════════════════════════════════════════════════════════ */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-list
      style="max-inline-size: 380px;"
      list-style=${args.listStyle}
      selection-mode=${args.selectionMode}
      interaction-mode=${args.interactionMode}
      ?reorderable=${args.reorderable}
      label=${args.label || t(globals.locale, 'list.playgroundList')}
      role-override=${args.roleOverride}
    >
      <md-list-item
        type="button"
        headline=${t(globals.locale, 'list.inbox')}
        supporting-text=${t(globals.locale, 'list.inbox12New')}
        leading-icon="inbox"
        trailing-supporting-text="24"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline=${t(globals.locale, 'list.starred')}
        supporting-text=${t(globals.locale, 'list.markedImportant')}
        leading-icon="star"
        trailing-supporting-text="3"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline=${t(globals.locale, 'list.drafts')}
        supporting-text=${t(globals.locale, 'list.draftsResume')}
        leading-icon="drafts"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline=${t(globals.locale, 'list.sent')}
        supporting-text=${t(globals.locale, 'list.sentOutgoing')}
        leading-icon="send"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. VISUAL STYLES — standard / segmented side-by-side
   ═══════════════════════════════════════════════════════════════════════════ */
export const ListStyles: Story = {
  render: (_args, { globals }) => html`
    ${grid(html`
      <div>
        ${sectionLabel('Standard (default)')}
        ${caption('Shared rounded chassis, no gap. Interleave dividers for separators.')}
        <md-list list-style="standard">
          <md-list-item type="button" headline=${t(globals.locale, 'list.profile')} leading-icon="person"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline=${t(globals.locale, 'list.privacy')} leading-icon="lock"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline=${t(globals.locale, 'list.signOut')} leading-icon="logout"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Segmented')}
        ${caption('Separated rounded tiles with a 2 px gap — each row reads as its own affordance.')}
        <md-list list-style="segmented">
          <md-list-item type="button" headline=${t(globals.locale, 'list.photos')} leading-icon="photo" trailing-supporting-text="128"></md-list-item>
          <md-list-item type="button" headline=${t(globals.locale, 'list.videos')} leading-icon="videocam" trailing-supporting-text="42"></md-list-item>
          <md-list-item type="button" headline=${t(globals.locale, 'list.music')} leading-icon="music_note" trailing-supporting-text="256"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. LINE HEIGHTS — 1 / 2 / 3 line variants
   ═══════════════════════════════════════════════════════════════════════════ */
export const OneLine: Story = {
  render: () => html`
    ${caption('Single headline row, 56 dp minimum height.')}
    <md-list style="max-inline-size: 380px;">
      <md-list-item type="button" headline="Plain label"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="With leading icon" leading-icon="person"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="With trailing icon" trailing-icon="chevron_right"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="With trailing supporting text"
        leading-icon="notifications"
        trailing-supporting-text="99+"
      ></md-list-item>
    </md-list>
  `,
};

export const TwoLine: Story = {
  render: () => html`
    ${caption('Auto-promotes to 2-line (72 dp) when an overline OR supporting text is present.')}
    <md-list style="max-inline-size: 400px;">
      <md-list-item
        type="button"
        headline="Headline + supporting"
        supporting-text="Supporting text on the second line"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="With leading icon"
        supporting-text="Auto-promotes to 2-line"
        leading-icon="inbox"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Overline-only also 2-line"
        overline="OVERLINE"
        leading-icon="label"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Full configuration"
        supporting-text="Headline + supporting + trailing meta"
        leading-icon="star"
        trailing-supporting-text="5 min ago"
      ></md-list-item>
    </md-list>
  `,
};

export const ThreeLine: Story = {
  render: () => {
    /* Same row-as-source-of-truth pattern as the MultiSelect story —
       see the comment there for the full rationale. */
    const syncCheckboxes = (e: Event) => {
      const list = e.currentTarget as HTMLElement;
      list.querySelectorAll('md-list-item').forEach(item => {
        const cb = item.querySelector('md-checkbox') as (HTMLElement & { checked: boolean }) | null;
        if (cb) cb.checked = (item as unknown as { selected: boolean }).selected;
      });
    };
    return html`
    ${caption(
      'Auto-promotes to 3-line (88px+) when both overline and supporting-text are present, or explicitly via `lines="3"`. Leading + trailing slots top-align, supporting-text clamps to 2 visible lines, and top/bottom padding flips to 12px per the M3 spec. The eight sections below walk every officially supported three-line composition.',
    )}

    <!-- ─── 1. Icon leading — classic 3-line row ─────────────────────────── -->
    ${sectionLabel('1. Icon leading — overline + headline + supporting')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;">
      <md-list-item
        type="button"
        overline="CATEGORY"
        headline="Three-line row"
        supporting-text="Long supporting text describing the row in detail across multiple lines"
        leading-icon="article"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="NEWS"
        headline="Breaking: Major event"
        supporting-text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna."
        leading-icon="newspaper"
        trailing-supporting-text="2h ago"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="UPDATE"
        headline="System notification"
        supporting-text="Your device was updated successfully and all features are now available."
        leading-icon="system_update"
      ></md-list-item>
    </md-list>

    <!-- ─── 2. Avatar leading — inbox / contacts pattern ──────────────────── -->
    ${sectionLabel('2. Avatar leading — inbox / contacts pattern')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;" label="Inbox">
      <md-list-item
        type="button"
        overline="UNREAD"
        headline="Amelia Hart"
        supporting-text="Re: Q4 roadmap review — added agenda items plus the deck draft for tomorrow's sync, ping me if anything looks off before EOD."
        leading-avatar="https://i.pravatar.cc/80?img=11"
        leading-avatar-alt="Amelia Hart"
        trailing-supporting-text="9:14 AM"
        trailing-icon="circle"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="STARRED"
        headline="Marcus Tan"
        supporting-text="Shipping reminder: please verify the EU customs declaration before Friday's release so we don't slip the launch window."
        leading-avatar-label="MT"
        trailing-supporting-text="Mon"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="REPLIED"
        headline="Priya Iyer"
        supporting-text="Thanks for the review — pushed the requested edits, responded to every inline comment, and rebased on main."
        leading-avatar="https://i.pravatar.cc/80?img=47"
        leading-avatar-alt="Priya Iyer"
        trailing-supporting-text="Fri"
      ></md-list-item>
    </md-list>

    <!-- ─── 3. Image leading — article / media row ────────────────────────── -->
    ${sectionLabel('3. Image leading (56px) — article / media row')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;">
      <md-list-item
        type="button"
        overline="ARTICLE · 6 MIN READ"
        headline="Building accessible web components"
        supporting-text="A deep-dive into roving tabindex, slot composition, and the ARIA mappings every design-system primitive should ship by default."
        leading-image="https://picsum.photos/seed/article1/80/80"
        leading-image-alt="Decorative cover for an accessibility article"
        trailing-icon="bookmark_border"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="GUIDE"
        headline="Designing for variable density"
        supporting-text="Why the same row needs to flex from 56px (mobile) all the way down to 40px (desktop dense) without losing M3 fidelity or readability."
        leading-image="https://picsum.photos/seed/article2/80/80"
        leading-image-alt=""
        trailing-icon="bookmark"
      ></md-list-item>
    </md-list>

    <!-- ─── 4. Video leading — bumped 12px top padding ────────────────────── -->
    ${sectionLabel('4. Video leading (100×56px) — top padding bumps to 12px')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;">
      <md-list-item
        type="button"
        overline="0:10 · TUTORIAL"
        headline="Setting up your workspace"
        supporting-text="Step-by-step walkthrough of the onboarding flow and the productivity shortcuts you'll lean on every day after."
        trailing-icon="play_circle"
      >
        <video
          slot="leading"
          muted
          loop
          autoplay
          playsinline
          preload="auto"
          poster="https://picsum.photos/seed/v1/200/112"
        >
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
        </video>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="0:52 · DEMO"
        headline="What's new in version 4"
        supporting-text="A tour of the new selection-mode list, segmented chips, the imperative activation API, and the improved keyboard model."
        trailing-icon="play_circle"
      >
        <video
          slot="leading"
          muted
          loop
          autoplay
          playsinline
          preload="auto"
          poster="https://picsum.photos/seed/v2/200/112"
        >
          <source src="https://media.w3.org/2010/05/sintel/trailer.mp4" type="video/mp4">
        </video>
      </md-list-item>
    </md-list>

    <!-- ─── 5. Long supporting-text — clamps to 2 visible lines + ellipsis ── -->
    ${sectionLabel('5. Long supporting-text — clamps to 2 lines with ellipsis')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;">
      <md-list-item
        type="button"
        overline="POLICY"
        headline="Privacy &amp; data handling"
        supporting-text="We collect minimal data, store it encrypted at rest with AES-256, never share it with third parties without your explicit consent, and you can request a full export or deletion at any moment from the settings panel — this entire paragraph is here to demonstrate the 2-line clamp + ellipsis behavior in three-line rows."
        leading-icon="shield"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="LEGAL"
        headline="Terms of service"
        supporting-text="By continuing to use this product you agree to the latest terms — please skim before activation, the highlights are called out in the changelog."
        leading-icon="gavel"
        trailing-icon="chevron_right"
      ></md-list-item>
    </md-list>

    <!-- ─── 6. Multi-select 3-line — preferences / subscriptions ──────────── -->
    ${sectionLabel('6. Multi-select 3-line — preferences / subscriptions')}
    <md-list
      style="max-inline-size: 480px; margin-block-end: 24px;"
      selection-mode="multi-select"
      label="Subscribe to alerts"
      @mdSelect=${syncCheckboxes}
    >
      <md-list-item
        overline="EMAIL"
        headline="Weekly digest"
        supporting-text="A curated round-up of new features, community posts, and product changes, delivered every Monday morning."
        leading-icon="mail"
        selected
      >
        <md-checkbox slot="trailing" checked style="pointer-events: none;" aria-hidden="true"></md-checkbox>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        overline="PUSH"
        headline="Real-time alerts"
        supporting-text="Get notified the moment an item ships, a comment lands on your work, or a deadline shifts unexpectedly."
        leading-icon="notifications"
      >
        <md-checkbox slot="trailing" style="pointer-events: none;" aria-hidden="true"></md-checkbox>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        overline="SMS"
        headline="Critical only"
        supporting-text="Text messages are reserved for outages and security events — never marketing, never promotional content."
        leading-icon="sms"
        selected
      >
        <md-checkbox slot="trailing" checked style="pointer-events: none;" aria-hidden="true"></md-checkbox>
      </md-list-item>
    </md-list>

    <!-- ─── 7. Expandable 3-line — FAQ disclosure pattern ─────────────────── -->
    ${sectionLabel('7. Expandable 3-line — FAQ disclosure pattern')}
    ${caption('Same `expandable` API as the dedicated **Expandable** story: caret is an auto-rendered `md-icon-button` (not a manual chevron). FAQ copy goes in `slot="expanded-content"`.')}
    <md-list style="max-inline-size: 480px; margin-block-end: 24px;">
      <md-list-item
        expandable
        overline="FAQ"
        headline="How do I reset my password?"
        supporting-text="Tap to expand for the step-by-step guide and the available recovery options."
        leading-icon="help"
      >
        <div
          slot="expanded-content"
          style="padding-block: 8px; font-family: var(--md-sys-typescale-body-medium-font-family, system-ui); font-size: 14px; line-height: 20px; color: var(--md-sys-color-on-surface-variant);"
        >
          <ol style="margin: 0; padding-inline-start: 20px;">
            <li>Open <strong>Settings → Account</strong> from the app menu.</li>
            <li>Pick <strong>Sign-in &amp; security</strong>.</li>
            <li>Tap <strong>Reset password</strong> and follow the email link.</li>
          </ol>
          <p style="margin: 8px 0 0;">
            Recovery email options live on the same screen under <em>Backup</em>.
          </p>
        </div>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        expandable
        overline="FAQ"
        headline="What happens to my data if I cancel?"
        supporting-text="Your data stays available for 30 days after cancellation, then it's permanently deleted from our servers."
        leading-icon="help"
      ></md-list-item>
    </md-list>

    <!-- ─── 8. lines="3" opt-in — headline + 2-line supporting, NO overline ─ -->
    ${sectionLabel('8. lines="3" opt-in — headline + multi-line supporting, no overline')}
    ${caption(
      'Without an overline the row defaults to 2-line. Setting `lines="3"` forces the 88px chassis + 12px insets so supporting-text gets room to breathe — useful for trip cards, summaries, or anything where the second line of body copy carries real meaning.',
    )}
    <md-list style="max-inline-size: 480px;">
      <md-list-item
        type="button"
        lines="3"
        headline="Trip to Reykjavík"
        supporting-text="6 nights · Northern lights tour, Blue Lagoon spa, ice cave expedition, and a private chef-tasted final dinner."
        leading-icon="flight"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        lines="3"
        headline="Trip to Kyoto"
        supporting-text="9 nights · Temple route, Arashiyama bamboo grove, ryokan stays, kaiseki dinners, and the Philosopher's Path walk."
        leading-icon="temple_buddhist"
        trailing-icon="chevron_right"
      ></md-list-item>
    </md-list>
  `;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. LEADING CONTENT — icons / avatars / images / video / custom slots
   ═══════════════════════════════════════════════════════════════════════════ */
export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    ${caption('24 dp Material Symbols icons (auto-tightens to 20 dp inside the Expressive list styles).')}
    <md-list style="max-inline-size: 380px;" label=${t(globals.locale, 'list.networkSettings')}>
      <md-list-item type="button" headline=${t(globals.locale, 'list.wifi')} supporting-text=${t(globals.locale, 'list.homeNetwork')} leading-icon="wifi" trailing-icon="chevron_right"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.bluetooth')} supporting-text=${t(globals.locale, 'list.devicesConnected2')} leading-icon="bluetooth" trailing-icon="chevron_right"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.mobileData')} supporting-text=${t(globals.locale, 'list.on')} leading-icon="signal_cellular_4_bar" trailing-icon="chevron_right"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.vpn')} supporting-text=${t(globals.locale, 'list.disconnected')} leading-icon="vpn_lock" trailing-icon="chevron_right"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.airplaneMode')} leading-icon="flight"></md-list-item>
    </md-list>
  `,
};

export const WithAvatars: Story = {
  render: () => html`
    ${grid(html`
      <div>
        ${sectionLabel('Photo avatars')}
        ${caption('40 dp circular images via the `leading-avatar` prop.')}
        <md-list>
          <md-list-item
            type="button"
            headline="Jane Cooper"
            supporting-text="Hey, are you free tonight?"
            leading-avatar="https://i.pravatar.cc/80?img=1"
            leading-avatar-alt="Jane Cooper"
            trailing-supporting-text="5m"
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            type="button"
            headline="Wade Warren"
            supporting-text="Sounds good, see you then!"
            leading-avatar="https://i.pravatar.cc/80?img=3"
            leading-avatar-alt="Wade Warren"
            trailing-supporting-text="15m"
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            type="button"
            headline="Esther Howard"
            supporting-text="Thanks for the update"
            leading-avatar="https://i.pravatar.cc/80?img=5"
            leading-avatar-alt="Esther Howard"
            trailing-supporting-text="1h"
          ></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Initials avatars')}
        ${caption('Text-only filled circles via `leading-avatar-label` — colors map to the primary-container palette.')}
        <md-list>
          <md-list-item
            type="button"
            headline="Joaquim Reyes"
            supporting-text="Online"
            leading-avatar-label="JR"
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            type="button"
            headline="Mae Lin"
            supporting-text="Away — back at 3pm"
            leading-avatar-label="ML"
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            type="button"
            headline="Theo Bennett"
            supporting-text="Do not disturb"
            leading-avatar-label="TB"
          ></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

export const WithImages: Story = {
  render: () => html`
    ${caption('56 dp square thumbnails. Inside Expressive list styles they auto-round to 8 dp; outside a list they keep sharp corners.')}
    <md-list style="max-inline-size: 440px;">
      <md-list-item
        type="button"
        headline="Vacation Photos"
        supporting-text="12 new photos added"
        leading-image="https://picsum.photos/seed/a/112/112"
        leading-image-alt="Vacation thumbnail"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Family Album"
        supporting-text="3 new photos added"
        leading-image="https://picsum.photos/seed/b/112/112"
        leading-image-alt="Family thumbnail"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Work Portfolio"
        supporting-text="Updated yesterday"
        leading-image="https://picsum.photos/seed/c/112/112"
        leading-image-alt="Portfolio thumbnail"
        trailing-icon="chevron_right"
      ></md-list-item>
    </md-list>
  `,
};

export const WithVideo: Story = {
  render: () => html`
    ${caption(
      'Slot a `<video>` element with `slot="leading"` and it is sized per the M3 video token (100 × 56 dp). The clips below stream from the public W3Schools / W3C media test mirrors so they load reliably in any review environment.',
    )}
    <md-list style="max-inline-size: 460px;">
      <md-list-item type="button" headline="Onboarding clip" supporting-text="0:10 · Tutorial" trailing-icon="play_circle">
        <video
          slot="leading"
          muted
          loop
          autoplay
          playsinline
          preload="auto"
          poster="https://picsum.photos/seed/v1/200/112"
        >
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
        </video>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="Product demo" supporting-text="0:52 · Marketing" trailing-icon="play_circle">
        <video
          slot="leading"
          muted
          loop
          autoplay
          playsinline
          preload="auto"
          poster="https://picsum.photos/seed/v2/200/112"
        >
          <source src="https://media.w3.org/2010/05/sintel/trailer.mp4" type="video/mp4">
        </video>
      </md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. ITEM TYPES — text / button / link
   ═══════════════════════════════════════════════════════════════════════════ */
export const ItemTypes: Story = {
  render: () => html`
    ${caption('`text` rows are non-interactive (no focus / ripple), `button` rows fire `mdClick`, `link` rows navigate via `href` / `target`.')}
    <md-list style="max-inline-size: 440px;">
      <md-list-item
        type="text"
        headline="Static text row"
        supporting-text="Not focusable — no ripple, no click event"
        leading-icon="text_fields"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Button row"
        supporting-text="Focusable, ripples on press, emits mdClick"
        leading-icon="touch_app"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="link"
        href="https://m3.material.io/components/lists/specs"
        target="_blank"
        headline="Link row"
        supporting-text="Navigates to href in target"
        leading-icon="open_in_new"
        trailing-icon="north_east"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. INTERACTION MODES — single-action vs multi-action (M3 spec)
   ═══════════════════════════════════════════════════════════════════════════ */
export const SingleActionList: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '**Single-action list** — each row is one tappable area. The leading icon and ' +
          'headline activate together (`type="button"`). Use `interaction-mode="single-action"` ' +
          '(the default). A list has exactly one interaction mode at a time.',
      },
    },
  },
  render: () => html`
    ${caption(
      'Single-action: the whole row (icon + label) is one affordance. Set `interaction-mode="single-action"` on `md-list` (default).',
    )}
    <md-list style="max-inline-size: 380px;" interaction-mode="single-action" label="Single-action list">
      <md-list-item type="button" headline="List item" leading-icon="star"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star"></md-list-item>
    </md-list>
  `,
};

export const MultiActionList: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '**Multi-action list** — each row has a primary action (the row body) plus ' +
          'secondary actions in `slot="trailing"` (`md-icon-button`). Trailing controls ' +
          'keep their own focus stops and clicks do not activate the primary row action. ' +
          'Set `interaction-mode="multi-action"` on `md-list`.',
      },
    },
  },
  render: () => html`
    ${caption(
      'Multi-action: primary tap = row body; secondary taps = trailing `md-icon-button` controls (bookmark, more). Clicks on trailing buttons do not fire the row `mdClick`.',
    )}
    <md-list style="max-inline-size: 420px;" interaction-mode="multi-action" label="Multi-action list">
      <md-list-item type="button" headline="List item" leading-icon="star">
        <md-icon-button slot="trailing" icon="bookmark_border" aria-label="Bookmark"></md-icon-button>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star">
        <md-icon-button slot="trailing" icon="bookmark_border" aria-label="Bookmark"></md-icon-button>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star">
        <md-icon-button slot="trailing" icon="bookmark_border" aria-label="Bookmark"></md-icon-button>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="List item" leading-icon="star">
        <md-icon-button slot="trailing" icon="bookmark_border" aria-label="Bookmark"></md-icon-button>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. TRAILING CONTENT — text / icon / switch / checkbox / icon-button
   ═══════════════════════════════════════════════════════════════════════════ */
export const TrailingContent: Story = {
  render: (_args, { globals }) => html`
    ${caption('The trailing slot accepts metadata text, icons, switches, checkboxes, icon-buttons, or any arbitrary element.')}
    <md-list style="max-inline-size: 460px;">
      <md-list-item type="text" headline=${t(globals.locale, 'list.wifi')} supporting-text=${t(globals.locale, 'list.connectedToHomeNetwork')} leading-icon="wifi">
        <md-switch slot="trailing" selected aria-label="Toggle Wi-Fi"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.bluetooth')} supporting-text=${t(globals.locale, 'list.off')} leading-icon="bluetooth">
        <md-switch slot="trailing" aria-label="Toggle Bluetooth"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.subscribeToDigest')} supporting-text=${t(globals.locale, 'list.weeklySummaryEmail')} leading-icon="mail">
        <md-checkbox slot="trailing" checked aria-label="Subscribe to digest"></md-checkbox>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.autoUpdateApps')} supporting-text=${t(globals.locale, 'list.overWifiOnly')} leading-icon="autorenew">
        <md-checkbox slot="trailing" aria-label="Auto-update apps"></md-checkbox>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.accountSettings')} supporting-text=${t(globals.locale, 'list.lastEdited2Days')} leading-icon="manage_accounts">
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline=${t(globals.locale, 'list.notifications')}
        supporting-text=${t(globals.locale, 'list.unread42')}
        leading-icon="notifications"
        trailing-supporting-text="42"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. SLOTTED CONTENT — custom leading + rich text via slots
   ═══════════════════════════════════════════════════════════════════════════ */
export const SlottedContent: Story = {
  render: () => html`
    ${caption('Slot custom leading SVGs / emoji / components, or override the entire headline / overline / supporting text with rich markup.')}
    <md-list style="max-inline-size: 460px;">
      <md-list-item type="button" headline="Custom SVG leading">
        <svg slot="leading" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="Emoji leading">
        <span slot="leading" style="font-size: 24px;" aria-hidden="true">🚀</span>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="Slotted trailing badge">
        <md-badge slot="trailing" value="NEW"></md-badge>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button">
        <span slot="overline" style="color: var(--md-sys-color-tertiary); font-weight: 700;">PINNED</span>
        <span slot="headline"><strong>Project</strong> kick-off</span>
        <span slot="supporting-text">3 collaborators · due Friday</span>
        <span slot="trailing-supporting-text">Now</span>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text">
        <span slot="headline">Inline trailing controls</span>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   8. SELECTION — single / multi / segmented
   ═══════════════════════════════════════════════════════════════════════════ */
export const SingleSelect: Story = {
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const rows = rowsOf(list); // [Free, Pro, Team, Enterprise]

    await step('Preselected: exactly one row carries aria-selected (Pro)', async () => {
      await waitFor(() => expect(selectedRows(list).length).toBe(1));
      expect(onlySelectedHeadline(list)).toBe('Pro');
    });

    await step('Clicking Team swaps selection Pro → Team and emits mdSelect', async () => {
      const team = rows[2];
      const before = onlySelectedHeadline(list); // 'Pro'
      // Row must be interactive (hydrated + role="option") before the click,
      // else the click predates md-list wiring the row's handler and is dropped.
      await rowSelectionReady(team);
      let detail: { index: number; value: string; selected: boolean; item: HTMLElement } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      team.click();
      // aria-selected reflects on the NEXT render flush → assert inside waitFor.
      await waitFor(() => {
        expect(selectedRows(list).length).toBe(1);
        expect(team.getAttribute('aria-selected')).toBe('true');
      });
      const after = onlySelectedHeadline(list); // 'Team'
      expect(after).not.toBe(before);                              // selection MOVED off Pro
      expect(after).toBe('Team');                                  // and landed on Team
      expect(rows[1].getAttribute('aria-selected')).toBe('false'); // prior 'Pro' cleared
      expect(detail?.index).toBe(2);
      expect(detail?.value).toBe('Team');
      expect(detail?.selected).toBe(true);
      expect(detail?.item).toBe(team);
    });

    await step('Single-select is sticky — re-clicking Team never drops below one (guard)', async () => {
      let detail: { selected: boolean } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      rows[2].click();
      await waitFor(() => expect(detail?.selected).toBe(true));
      expect(selectedRows(list).length).toBe(1);
      expect(onlySelectedHeadline(list)).toBe('Team');
    });
  },
  render: (_args, { globals }) => html`
    <style>
      /* M3 single-select list: trailing checkmark on the active row only.
         Driven purely by [selected] attribute so it stays in sync with md-list's
         own state — no manual JS wiring required in the story. */
      .ss-check { display: none; }
      md-list-item[selected] .ss-check { display: inline-flex; }
    </style>
    ${caption(
      'Per the M3 spec a list has exactly one selection mode at a time. Single-select promotes the container to `role="listbox"` and rows to `role="option"`; exactly one row carries `aria-selected="true"` AND the M3 trailing checkmark affordance — tone alone is too subtle on light backgrounds.'
    )}
    <md-list style="max-inline-size: 380px;" selection-mode="single-select" label=${t(globals.locale, 'list.subscriptionPlan')}>
      <md-list-item headline=${t(globals.locale, 'list.free')} supporting-text=${t(globals.locale, 'list.upTo3Projects')}>
        <span slot="trailing" class="ss-check material-symbols-outlined" aria-hidden="true">check</span>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline=${t(globals.locale, 'list.pro')} supporting-text=${t(globals.locale, 'list.unlimitedProjects')} selected>
        <span slot="trailing" class="ss-check material-symbols-outlined" aria-hidden="true">check</span>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline=${t(globals.locale, 'list.team')} supporting-text=${t(globals.locale, 'list.collaborationSso')}>
        <span slot="trailing" class="ss-check material-symbols-outlined" aria-hidden="true">check</span>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline=${t(globals.locale, 'list.enterprise')} supporting-text=${t(globals.locale, 'list.customContracts')}>
        <span slot="trailing" class="ss-check material-symbols-outlined" aria-hidden="true">check</span>
      </md-list-item>
    </md-list>
  `,
};

export const MultiSelect: Story = {
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const rows = rowsOf(list); // [Email, SMS, Push, In-app banner]

    await step('multi-select container is aria-multiselectable with two rows preselected', async () => {
      expect(list.getAttribute('aria-multiselectable')).toBe('true');
      await waitFor(() => expect(selectedRows(list).length).toBe(2)); // Email + Push
    });

    await step('Clicking SMS adds a THIRD selection — priors retained + emits mdSelect', async () => {
      const sms = rows[1];
      const before = selectedRows(list).length; // 2
      // Row must be interactive (hydrated + role="option") before the click,
      // else the click predates md-list wiring the row's handler and is dropped.
      await rowSelectionReady(sms);
      let detail: { index: number; value: string; selected: boolean } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      sms.click();
      await waitFor(() => {
        expect(sms.getAttribute('aria-selected')).toBe('true');
        expect(selectedRows(list).length).toBe(before + 1); // 3 selected simultaneously
      });
      expect(rows[0].getAttribute('aria-selected')).toBe('true'); // Email NOT swapped out (multi ≠ single)
      expect(detail?.index).toBe(1);
      expect(detail?.value).toBe('SMS');
      expect(detail?.selected).toBe(true);
    });

    await step('Toggling Email off is independent — SMS & Push stay selected (guard)', async () => {
      const email = rows[0];
      let detail: { selected: boolean } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      email.click();
      await waitFor(() => expect(email.getAttribute('aria-selected')).toBe('false'));
      expect(detail?.selected).toBe(false);
      expect(selectedRows(list).length).toBe(2);                  // two remain (different pair)
      expect(rows[1].getAttribute('aria-selected')).toBe('true'); // SMS retained
      expect(rows[2].getAttribute('aria-selected')).toBe('true'); // Push retained
    });
  },
  render: (_args, { globals }) => {
    /* The row is the single source of truth for selection — md-list flips
       `[selected]` on click. The trailing `md-checkbox` is a presentational
       affordance only: `pointer-events: none` makes pointer events pass
       through to the row so we never get a double-toggle race, and the
       `mdSelect` handler below mirrors the row's new `selected` state onto
       the checkbox's `checked` prop. */
    const syncCheckboxes = (e: Event) => {
      const list = e.currentTarget as HTMLElement;
      list.querySelectorAll('md-list-item').forEach(item => {
        const cb = item.querySelector('md-checkbox') as (HTMLElement & { checked: boolean }) | null;
        if (cb) cb.checked = (item as unknown as { selected: boolean }).selected;
      });
    };
    return html`
      ${caption(
        'Multi-select uses `selection-mode="multi-select"` (adds `aria-multiselectable="true"`). Per M3 each row carries a trailing `md-checkbox` affordance. The checkbox is kept presentational with `pointer-events: none` so the row click stays the only selection event — the `mdSelect` listener mirrors the state back onto each checkbox.',
      )}
      <md-list
        style="max-inline-size: 380px;"
        selection-mode="multi-select"
        label=${t(globals.locale, 'list.notifications')}
        @mdSelect=${syncCheckboxes}
      >
        <md-list-item headline=${t(globals.locale, 'list.email')} leading-icon="mail" selected>
          <md-checkbox slot="trailing" checked style="pointer-events: none;" aria-hidden="true"></md-checkbox>
        </md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline=${t(globals.locale, 'list.sms')} leading-icon="sms">
          <md-checkbox slot="trailing" style="pointer-events: none;" aria-hidden="true"></md-checkbox>
        </md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline=${t(globals.locale, 'list.push')} leading-icon="notifications" selected>
          <md-checkbox slot="trailing" checked style="pointer-events: none;" aria-hidden="true"></md-checkbox>
        </md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline=${t(globals.locale, 'list.inAppBanner')} leading-icon="campaign">
          <md-checkbox slot="trailing" style="pointer-events: none;" aria-hidden="true"></md-checkbox>
        </md-list-item>
      </md-list>
    `;
  },
};

export const SegmentedSelection: Story = {
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const rows = rowsOf(list); // [Photos, Videos, Music, Documents]

    await step('Preselected: exactly one segmented tile carries aria-selected (Photos)', async () => {
      await waitFor(() => expect(selectedRows(list).length).toBe(1));
      expect(onlySelectedHeadline(list)).toBe('Photos');
    });

    await step('Clicking Videos moves the filled tile Photos → Videos and emits mdSelect', async () => {
      const videos = rows[1];
      const before = onlySelectedHeadline(list); // 'Photos'
      // Segmented tiles are single-select rows: gate the click until md-list has
      // wired the row (hydrated + role="option"), else the click predates the
      // handler and is silently dropped.
      await rowSelectionReady(videos);
      let detail: { index: number; value: string; selected: boolean; item: HTMLElement } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      videos.click();
      // aria-selected reflects on the NEXT render flush → assert inside waitFor.
      await waitFor(() => {
        expect(selectedRows(list).length).toBe(1);
        expect(videos.getAttribute('aria-selected')).toBe('true');
      });
      const after = onlySelectedHeadline(list); // 'Videos'
      expect(after).not.toBe(before);                              // filled tile MOVED off Photos
      expect(after).toBe('Videos');                                // and landed on Videos
      expect(rows[0].getAttribute('aria-selected')).toBe('false'); // Photos tile cleared
      expect(detail?.index).toBe(1);
      expect(detail?.value).toBe('Videos');
      expect(detail?.selected).toBe(true);
      expect(detail?.item).toBe(videos);
    });

    await step('Selection keeps moving within the segment — Music swaps again, never accumulates (guard)', async () => {
      const music = rows[2];
      const before = onlySelectedHeadline(list); // 'Videos'
      await rowSelectionReady(music);
      let detail: { index: number; value: string } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      music.click();
      await waitFor(() => {
        expect(music.getAttribute('aria-selected')).toBe('true');
        expect(selectedRows(list).length).toBe(1); // single-select never lights a 2nd tile
      });
      expect(onlySelectedHeadline(list)).not.toBe(before);          // filled tile advanced again
      expect(onlySelectedHeadline(list)).toBe('Music');
      expect(rows[1].getAttribute('aria-selected')).toBe('false');  // prior 'Videos' tile cleared
      expect(detail?.index).toBe(2);
      expect(detail?.value).toBe('Music');
    });
  },
  render: (_args, { globals }) => html`
    ${caption(
      'On segmented lists the filled tile IS the selection affordance — the M3 Expressive pattern for filter / pivot rows. The chosen tile lifts in tone + shape, the others stay flat. No checkbox/checkmark is layered on top.'
    )}
    <md-list
      style="max-inline-size: 380px;"
      list-style="segmented"
      selection-mode="single-select"
      label=${t(globals.locale, 'list.mediaLibrary')}
    >
      <md-list-item headline=${t(globals.locale, 'list.photos')} leading-icon="photo" trailing-supporting-text="128" selected></md-list-item>
      <md-list-item headline=${t(globals.locale, 'list.videos')} leading-icon="videocam" trailing-supporting-text="42"></md-list-item>
      <md-list-item headline=${t(globals.locale, 'list.music')} leading-icon="music_note" trailing-supporting-text="256"></md-list-item>
      <md-list-item headline=${t(globals.locale, 'list.documents')} leading-icon="description" trailing-supporting-text="89"></md-list-item>
    </md-list>
  `,
};

export const ThumbnailSelection: Story = {
  name: 'Thumbnail selection (MD3)',
  parameters: {
    docs: {
      description: {
        story:
          'MD3 playlist pattern: image thumbnail on the leading edge, single-select on the row, ' +
          'selected row gets secondary-container fill plus a scrim + checkmark circle on the thumbnail. ' +
          'Do not combine a trailing bookmark/checkbox with thumbnail selection on the same item — ' +
          'one selection interaction per row.',
      },
    },
  },
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const rows = rowsOf(list); // [Your Likes, Chill Vibes, Deep Focus, Road Trip]

    await step('Preselected: exactly one playlist row is selected (Your Likes)', async () => {
      await waitFor(() => expect(selectedRows(list).length).toBe(1));
      expect(onlySelectedHeadline(list)).toBe('Your Likes');
    });

    await step('Clicking "Chill Vibes" flips it selected + swaps off "Your Likes" and emits mdSelect', async () => {
      const chill = rows[1];
      const before = onlySelectedHeadline(list);              // 'Your Likes'
      const wasSelected = chill.getAttribute('aria-selected'); // 'false'
      // Thumbnail rows are plain type="text" that selection-mode auto-promotes:
      // wait for md-list to make the row role="option" before clicking.
      await rowSelectionReady(chill);
      let detail: { index: number; value: string; selected: boolean; item: HTMLElement } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      chill.click();
      // aria-selected reflects on the NEXT render flush → assert inside waitFor.
      await waitFor(() => {
        expect(selectedRows(list).length).toBe(1);
        expect(chill.getAttribute('aria-selected')).toBe('true');
      });
      expect(chill.getAttribute('aria-selected')).not.toBe(wasSelected); // row flipped false → true
      expect(onlySelectedHeadline(list)).toBe('Chill Vibes');
      expect(onlySelectedHeadline(list)).not.toBe(before);
      expect(rows[0].getAttribute('aria-selected')).toBe('false');       // 'Your Likes' released
      expect(detail?.index).toBe(1);
      expect(detail?.value).toBe('Chill Vibes');
      expect(detail?.selected).toBe(true);
      expect(detail?.item).toBe(chill);
    });

    await step('Single-select is sticky — re-clicking the selected row keeps it on, never zero (guard)', async () => {
      const chill = rows[1];
      let detail: { selected: boolean } | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      chill.click();
      await waitFor(() => expect(detail?.selected).toBe(true));
      expect(chill.getAttribute('aria-selected')).toBe('true');
      expect(selectedRows(list).length).toBe(1);
      expect(onlySelectedHeadline(list)).toBe('Chill Vibes');
    });
  },
  render: () => html`
    ${caption(
      'Per M3, when the selection affordance lives on the thumbnail the whole row is the tap target — ' +
        'no trailing bookmark, checkbox, or second checkmark. The selected row lifts to secondary-container ' +
        'and the thumbnail shows a semi-transparent scrim with a white check in a dark circle. Click a row to change selection.',
    )}
    <md-list
      style="inline-size: 420px; max-inline-size: 100%;"
      selection-mode="single-select"
      label="Your library"
    >
      <md-list-item
        headline="Your Likes"
        supporting-text="Music · 8 songs"
        leading-image="https://picsum.photos/seed/likes/112/112"
        leading-image-alt="Your Likes playlist artwork"
        selected
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        headline="Chill Vibes"
        supporting-text="Music · 24 songs"
        leading-image="https://picsum.photos/seed/chill/112/112"
        leading-image-alt="Chill Vibes playlist artwork"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        headline="Deep Focus"
        supporting-text="Music · 42 songs"
        leading-image="https://picsum.photos/seed/focus/112/112"
        leading-image-alt="Deep Focus playlist artwork"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        headline="Road Trip"
        supporting-text="Music · 15 songs"
        leading-image="https://picsum.photos/seed/road/112/112"
        leading-image-alt="Road Trip playlist artwork"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   9. STATES — resting / selected / disabled / soft-disabled / selected+disabled
   ═══════════════════════════════════════════════════════════════════════════ */
export const States: Story = {
  render: () => html`
    ${caption('Every documented item state — selected uses the `secondary-container` palette, disabled drops content to 38 % opacity and removes pointer events, soft-disabled keeps the same visuals but stays focusable.')}
    <md-list style="max-inline-size: 420px;">
      <md-list-item
        type="button"
        headline="Enabled"
        supporting-text="Default interactive row"
        leading-icon="check_circle"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Selected"
        supporting-text="Secondary-container background"
        leading-icon="check_circle"
        selected
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Disabled"
        supporting-text="No pointer events, 38 % content opacity"
        leading-icon="block"
        disabled
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Soft-disabled"
        supporting-text="Focusable, aria-disabled, no activation"
        leading-icon="visibility_off"
        soft-disabled
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Selected + disabled"
        supporting-text="on-surface @ 12 % container"
        leading-icon="lock"
        selected
        disabled
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="text"
        headline="Non-interactive (type=&quot;text&quot;)"
        supporting-text="Display only — no focus, no ripple"
        leading-icon="info"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   10. SHAPE MORPH — interact to watch corners morph through hover / focus /
       press / select per the M3 Lists spec
   ═══════════════════════════════════════════════════════════════════════════ */
export const ShapeMorph: Story = {
  render: () => html`
    ${caption('Hover, focus (Tab) and press each row — the container morphs to corner-large (16px) on every interactive state so a standard row in hover / focus / selected / pressed matches the segmented tile resting shape. The animation is wired with `border-radius` transitions on both the host and the row.')}
    <md-list style="max-inline-size: 420px;" selection-mode="single-select" label="Shape morph demo">
      <md-list-item headline="Hover me" supporting-text="Corner-large on hover" leading-icon="touch_app"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline="Focus me with Tab" supporting-text="Corner-large on focus" leading-icon="keyboard"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline="Press and hold" supporting-text="Corner-large on press" leading-icon="ads_click"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline="Selected resting state" supporting-text="Corner-large always" leading-icon="check_circle" selected></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   11. EXPANDABLE (DISCLOSURE) ROWS — single-level MD3 expansion list
   ═══════════════════════════════════════════════════════════════════════════ */
export const Expandable: Story = {
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const parents = Array.from(
      list.querySelectorAll(':scope > md-list-item[expandable]'),
    ) as HTMLElement[];
    const collapsed = parents[1]; // the second parent renders collapsed
    const panel = () =>
      collapsed.shadowRoot!.querySelector('.md-list-item__expanded-panel') as HTMLElement;

    await step('Second parent starts collapsed — its expanded panel is hidden', async () => {
      await waitFor(() => expect(collapsed.classList.contains('hydrated')).toBe(true));
      expect(collapsed.hasAttribute('expanded')).toBe(false);
      expect(panel().hidden).toBe(true);
    });

    await step('Clicking the row body expands it — nested panel reveals + mdExpand fires', async () => {
      const hiddenBefore = panel().hidden; // true
      let detail: { expanded: boolean; index?: number } | undefined;
      collapsed.addEventListener('mdExpand', e => { detail = (e as CustomEvent).detail; }, { once: true });
      collapsed.click();
      // `expanded` reflects + the panel's `hidden` flips on the next render flush.
      await waitFor(() => expect(collapsed.hasAttribute('expanded')).toBe(true));
      expect(panel().hidden).toBe(false);
      expect(panel().hidden).not.toBe(hiddenBefore); // nested content toggled OPEN
      expect(detail?.expanded).toBe(true);
      expect(detail?.index).toBe(1); // second top-level row
    });

    await step('Clicking again collapses it back — panel re-hidden (toggle guard)', async () => {
      let detail: { expanded: boolean } | undefined;
      collapsed.addEventListener('mdExpand', e => { detail = (e as CustomEvent).detail; }, { once: true });
      collapsed.click();
      await waitFor(() => expect(collapsed.hasAttribute('expanded')).toBe(false));
      expect(panel().hidden).toBe(true);
      expect(detail?.expanded).toBe(false);
      // Let the emphasized-accelerate retract animation settle before teardown.
      await new Promise(r => setTimeout(r, 300));
    });

    await step('A child row of the expanded parent re-emits as mdSelect with the parent index + childIndex', async () => {
      // parents[0] is authored `expanded` with flat `expanded-content` children.
      const expandedParent = parents[0];
      await waitFor(() => expect(expandedParent.classList.contains('hydrated')).toBe(true));
      const children = Array.from(
        expandedParent.querySelectorAll(':scope > md-list-item[slot="expanded-content"]'),
      ) as HTMLElement[];
      expect(children.length).toBeGreaterThan(0);
      const firstChild = children[0];
      // The child bubbles `mdItemSelect`; md-list maps it to a top-level `mdSelect`
      // carrying the resolved parent index, the parent's expanded state, and the child.
      let detail:
        | { index: number; childIndex?: number; expanded?: boolean; value: string; selected: boolean; item: HTMLElement }
        | undefined;
      list.addEventListener('mdSelect', e => { detail = (e as CustomEvent).detail; }, { once: true });
      firstChild.dispatchEvent(
        new CustomEvent('mdItemSelect', {
          detail: { index: 0, value: 'Child selection', selected: true, item: firstChild },
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(detail).toBeDefined());
      expect(detail?.index).toBe(0);              // md-list resolved the expandable parent (items[0])
      expect(detail?.childIndex).toBe(0);         // threaded through from the child event
      expect(detail?.expanded).toBe(true);        // parent is currently expanded
      expect(detail?.value).toBe('Child selection');
      expect(detail?.selected).toBe(true);
      expect(detail?.item).toBe(firstChild);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Expansion list (MD3)** — set `expandable` on a row to turn it into a single-level ' +
          'disclosure. The component auto-renders a trailing **`md-icon-button`** caret (`expand_more`); ' +
          'do **not** add `trailing-icon="expand_more"` or manual chevron markup. The caret owns ' +
          '`aria-expanded` / `aria-controls`, morphs to the icon-button pill/squircle when expanded, ' +
          'and rotates 180°. Slot one level of flat `md-list-item` children into `expanded-content` ' +
          '(not a nested `md-list` chassis). Child rows appear inline at the same level with connected ' +
          'dividers. Toggle via the caret (Tab → Enter / Space) or by clicking the row body. The panel ' +
          'opens with `emphasized-decelerate` and retracts with `emphasized-accelerate`. Listen for ' +
          '`mdExpand` with `{ expanded, index?, value?, item? }`.',
      },
    },
  },
  render: () => {
    const logExpand = (e: CustomEvent<{ expanded: boolean; index?: number; value?: string }>) => {
      const log = document.getElementById('expand-event-log');
      if (!log) return;
      if (log.textContent === 'Expand or collapse a row to log mdExpand events…') {
        log.textContent = '';
      }
      const { index, value, expanded } = e.detail;
      const ts = new Date().toLocaleTimeString();
      log.textContent +=
        `${ts}  mdExpand → index=${index ?? '?'} value="${value || '(none)'}" expanded=${expanded}\n`;
      log.scrollTop = log.scrollHeight;
    };

    const logSelect = (e: CustomEvent<{ index: number; childIndex?: number; expanded?: boolean; value: string; selected: boolean }>) => {
      const log = document.getElementById('expand-select-log');
      if (!log) return;
      if (log.textContent === 'Select a child row to log mdSelect events…') {
        log.textContent = '';
      }
      const { index, childIndex, expanded, value, selected } = e.detail;
      const ts = new Date().toLocaleTimeString();
      const childPart = childIndex !== undefined ? ` childIndex=${childIndex}` : '';
      const expandedPart = expanded !== undefined ? ` expanded=${expanded}` : '';
      log.textContent +=
        `${ts}  mdSelect → index=${index}${childPart}${expandedPart} value="${value || '(none)'}" selected=${selected}\n`;
      log.scrollTop = log.scrollHeight;
    };

    const childRow = (selected = false) => html`
      <md-list-item
        slot="expanded-content"
        type="button"
        headline="List item"
        leading-icon="star"
        ?selected=${selected}
      ></md-list-item>
      <md-divider slot="expanded-content" inset-start></md-divider>
    `;

    return html`
      ${caption(
        'MD3 connected expansion list (`list-style="standard"`, `selection-mode="single-select"`): parent row with star icon + auto caret, ' +
          'five flat child rows revealed inline below (no nested sub-box). The third child is selected. ' +
          'Click a child to move selection — the parent stays expanded. A collapsed sibling shows the caret pointing down.',
      )}
      <div
        style="
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(220px, 1fr);
          gap: 24px;
          align-items: start;
        "
      >
        <md-list
          list-style="standard"
          label="Expansion list"
          selection-mode="single-select"
          style="max-inline-size: 360px;"
          @mdSelect=${logSelect}
        >
          <md-list-item
            expandable
            expanded
            headline="List item"
            leading-icon="star"
            @mdExpand=${logExpand}
          >
            ${childRow()}
            ${childRow()}
            ${childRow(true)}
            ${childRow()}
            <md-list-item
              slot="expanded-content"
              type="button"
              headline="List item"
              leading-icon="star"
            ></md-list-item>
          </md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            expandable
            headline="List item"
            leading-icon="star"
            @mdExpand=${logExpand}
          >
            ${childRow()}
            ${childRow()}
            ${childRow()}
            ${childRow()}
            <md-list-item
              slot="expanded-content"
              type="button"
              headline="List item"
              leading-icon="star"
            ></md-list-item>
          </md-list-item>
        </md-list>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${sectionLabel('mdExpand event log')}
          <pre
            id="expand-event-log"
            style="
              margin: 0;
              padding: 12px 16px;
              min-block-size: 80px;
              max-block-size: 160px;
              overflow-y: auto;
              border-radius: 12px;
              background: var(--md-sys-color-surface-container, #f3edf7);
              color: var(--md-sys-color-on-surface, #1c1b1f);
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            "
          >Expand or collapse a row to log mdExpand events…</pre>
          ${sectionLabel('mdSelect event log')}
          <pre
            id="expand-select-log"
            style="
              margin: 0;
              padding: 12px 16px;
              min-block-size: 80px;
              max-block-size: 160px;
              overflow-y: auto;
              border-radius: 12px;
              background: var(--md-sys-color-surface-container, #f3edf7);
              color: var(--md-sys-color-on-surface, #1c1b1f);
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            "
          >Select a child row to log mdSelect events…</pre>
        </div>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   11b. EXPANDABLE SEGMENTED — tile gaps + inline expansion panel
   ═══════════════════════════════════════════════════════════════════════════ */
export const ExpandableSegmented: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '**Segmented expansion list (MD3 Expressive)** — same `expandable` / `expanded-content` ' +
          'API as the connected **Expandable** story, but each parent row is its own rounded tile ' +
          'separated by `--md-list-segmented-gap`. Gaps replace top-level dividers; child rows still ' +
          'slot flat into the parent panel with inset dividers. Parent leading icons fill while ' +
          'expanded; `selection-mode="single-select"` on children moves highlight without collapsing ' +
          'the disclosure.',
      },
    },
  },
  render: () => {
    setTimeout(() => {
      const list = document.getElementById('expand-seg-list');
      const expandLog = document.getElementById('expand-seg-event-log');
      const selectLog = document.getElementById('expand-seg-select-log');
      const expandPlaceholder = 'Expand or collapse a row to log mdExpand events…';
      const selectPlaceholder = 'Select a child row to log mdSelect events…';

      const clearPlaceholder = (log: HTMLElement | null, placeholder: string) => {
        if (log && log.textContent === placeholder) log.textContent = '';
      };

      list?.addEventListener('mdSelect', (e: Event) => {
        const ce = e as CustomEvent<{
          index: number;
          childIndex?: number;
          expanded?: boolean;
          value: string;
          selected: boolean;
        }>;
        clearPlaceholder(selectLog, selectPlaceholder);
        const { index, childIndex, expanded, value, selected } = ce.detail;
        const ts = new Date().toLocaleTimeString();
        const childPart = childIndex !== undefined ? ` childIndex=${childIndex}` : '';
        const expandedPart = expanded !== undefined ? ` expanded=${expanded}` : '';
        selectLog!.textContent +=
          `${ts}  mdSelect → index=${index}${childPart}${expandedPart} value="${value || '(none)'}" selected=${selected}\n`;
        selectLog!.scrollTop = selectLog!.scrollHeight;
      });

      list?.querySelectorAll('md-list-item[expandable]').forEach(item => {
        item.addEventListener('mdExpand', (e: Event) => {
          const ce = e as CustomEvent<{
            expanded: boolean;
            index?: number;
            value?: string;
          }>;
          clearPlaceholder(expandLog, expandPlaceholder);
          const { index, value, expanded } = ce.detail;
          const ts = new Date().toLocaleTimeString();
          const indexPart = index !== undefined ? `index=${index} ` : '';
          const valuePart = value ? `value="${value}" ` : '';
          expandLog!.textContent +=
            `${ts}  mdExpand → ${indexPart}${valuePart}expanded=${expanded}\n`;
          expandLog!.scrollTop = expandLog!.scrollHeight;
        });
      });
    }, 0);

    const childRow = (headline: string, icon: string, selected = false) => html`
      <md-list-item
        slot="expanded-content"
        type="button"
        headline=${headline}
        leading-icon=${icon}
        ?selected=${selected}
      ></md-list-item>
      <md-divider slot="expanded-content" inset-start></md-divider>
    `;

    return html`
      ${caption(
        'Segmented expansion list (`list-style="segmented"`, `selection-mode="single-select"`): ' +
          'each category is its own tile with a gap below the next. The open parent\'s star icon is filled; ' +
          'click a child to move selection — the parent stays expanded. Collapsed tiles show the caret pointing down.',
      )}
      <div
        style="
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(220px, 1fr);
          gap: 24px;
          align-items: start;
        "
      >
      <md-list
        id="expand-seg-list"
        list-style="segmented"
        label="Media library"
        selection-mode="single-select"
        style="max-inline-size: 360px;"
      >
        <md-list-item expandable expanded headline="Albums" leading-icon="album" supporting-text="12 items">
          ${childRow('Favorites', 'star', true)}
          ${childRow('Recently added', 'schedule')}
          ${childRow('Shared with me', 'group')}
          <md-list-item
            slot="expanded-content"
            type="button"
            headline="Downloads"
            leading-icon="download"
          ></md-list-item>
        </md-list-item>

        <md-list-item expandable headline="Artists" leading-icon="person" supporting-text="48 artists">
          ${childRow('Following', 'favorite')}
          ${childRow('On tour', 'mic')}
          <md-list-item
            slot="expanded-content"
            type="button"
            headline="Suggested"
            leading-icon="auto_awesome"
          ></md-list-item>
        </md-list-item>

        <md-list-item expandable headline="Playlists" leading-icon="queue_music" supporting-text="6 playlists">
          ${childRow('Workout', 'fitness_center')}
          ${childRow('Focus', 'headphones')}
          <md-list-item
            slot="expanded-content"
            type="button"
            headline="Road trip"
            leading-icon="directions_car"
          ></md-list-item>
        </md-list-item>
      </md-list>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${sectionLabel('mdExpand event log')}
          <pre
            id="expand-seg-event-log"
            style="
              margin: 0;
              padding: 12px 16px;
              min-block-size: 80px;
              max-block-size: 160px;
              overflow-y: auto;
              border-radius: 12px;
              background: var(--md-sys-color-surface-container, #f3edf7);
              color: var(--md-sys-color-on-surface, #1c1b1f);
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            "
          >Expand or collapse a row to log mdExpand events…</pre>
          ${sectionLabel('mdSelect event log')}
          <pre
            id="expand-seg-select-log"
            style="
              margin: 0;
              padding: 12px 16px;
              min-block-size: 80px;
              max-block-size: 160px;
              overflow-y: auto;
              border-radius: 12px;
              background: var(--md-sys-color-surface-container, #f3edf7);
              color: var(--md-sys-color-on-surface, #1c1b1f);
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 12px;
              line-height: 1.5;
              white-space: pre-wrap;
            "
          >Select a child row to log mdSelect events…</pre>
        </div>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   12. DIVIDERS — full / inset-start / inset both / no dividers
   ═══════════════════════════════════════════════════════════════════════════ */
export const Dividers: Story = {
  render: () => html`
    ${grid(html`
      <div>
        ${sectionLabel('Full width')}
        <md-list>
          <md-list-item type="button" headline="Item 1" leading-icon="star"></md-list-item>
          <md-divider></md-divider>
          <md-list-item type="button" headline="Item 2" leading-icon="star"></md-list-item>
          <md-divider></md-divider>
          <md-list-item type="button" headline="Item 3" leading-icon="star"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Inset start')}
        ${caption('Lines start past the leading icon column — the most common pattern.')}
        <md-list>
          <md-list-item type="button" headline="Item 1" leading-icon="person"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Item 2" leading-icon="person"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Item 3" leading-icon="person"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Inset both sides')}
        <md-list>
          <md-list-item type="button" headline="Item 1" leading-icon="check_circle"></md-list-item>
          <md-divider inset></md-divider>
          <md-list-item type="button" headline="Item 2" leading-icon="check_circle"></md-list-item>
          <md-divider inset></md-divider>
          <md-list-item type="button" headline="Item 3" leading-icon="check_circle"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('No dividers')}
        ${caption('Segmented list-style relies on gaps and never needs dividers. See the dedicated **NoDividers** story below for six divider-less patterns.')}
        <md-list list-style="segmented">
          <md-list-item type="button" headline="Item 1" leading-icon="favorite"></md-list-item>
          <md-list-item type="button" headline="Item 2" leading-icon="favorite"></md-list-item>
          <md-list-item type="button" headline="Item 3" leading-icon="favorite"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   12b. NO DIVIDERS — every divider-less pattern the system supports
   ═══════════════════════════════════════════════════════════════════════════ */
export const NoDividers: Story = {
  render: () => html`
    ${caption(
      'Dividers are optional. When rows already separate themselves visually — segmented gaps, hover/selected shape morph, avatar/image leading content, dense standard chrome — interleaved `md-divider` elements add noise. The six tiles below cover every M3 pattern that intentionally omits dividers.',
    )}
    ${grid(html`
      <!-- 1 ─── Segmented quick actions: gaps separate, no chrome needed ──── -->
      <div>
        ${sectionLabel('1. Segmented action set')}
        ${caption('Each row is its own rounded tile. The 4px inter-tile gap is the separator — adding dividers would double the visual chrome.')}
        <md-list list-style="segmented" label="Quick actions">
          <md-list-item type="button" headline="Share" leading-icon="share" trailing-icon="chevron_right"></md-list-item>
          <md-list-item type="button" headline="Duplicate" leading-icon="content_copy" trailing-icon="chevron_right"></md-list-item>
          <md-list-item type="button" headline="Archive" leading-icon="archive" trailing-icon="chevron_right"></md-list-item>
          <md-list-item type="button" headline="Delete" leading-icon="delete" trailing-icon="chevron_right"></md-list-item>
        </md-list>
      </div>

      <!-- 2 ─── Segmented single-select pills: tile fill IS the affordance ── -->
      <div>
        ${sectionLabel('2. Segmented single-select pills')}
        ${caption('Tile fill ≠ supplementary cue — for segmented selection the rounded tonal fill *is* the selection affordance. Dividers would fight the contrast.')}
        <md-list
          list-style="segmented"
          selection-mode="single-select"
          label="Notification cadence"
        >
          <md-list-item headline="Real-time" supporting-text="Push the moment it happens" leading-icon="bolt" selected></md-list-item>
          <md-list-item headline="Daily digest" supporting-text="One email each morning" leading-icon="schedule"></md-list-item>
          <md-list-item headline="Weekly digest" supporting-text="Mondays at 9am only" leading-icon="calendar_month"></md-list-item>
          <md-list-item headline="Off" supporting-text="Never notify me" leading-icon="notifications_off"></md-list-item>
        </md-list>
      </div>

      <!-- 3 ─── Avatar inbox: tall rows + photo leading make dividers redundant -->
      <div>
        ${sectionLabel('3. Avatar inbox (standard)')}
        ${caption('80px three-line rows with photo avatars give every entry its own gravity — hover/focus shape morph is the only delimiter needed.')}
        <md-list label="Recent threads">
          <md-list-item
            type="button"
            overline="9:42 AM"
            headline="Camille Rivera"
            supporting-text="Pushed v2.4 to the staging branch — ready for QA whenever you are."
            leading-avatar="https://i.pravatar.cc/80?img=11"
            trailing-icon="chevron_right"
          ></md-list-item>
          <md-list-item
            type="button"
            overline="8:17 AM"
            headline="Devon Park"
            supporting-text="Asked about the rollback plan for tomorrow's release — needs a quick yes/no."
            leading-avatar="https://i.pravatar.cc/80?img=47"
            trailing-icon="chevron_right"
          ></md-list-item>
          <md-list-item
            type="button"
            overline="YESTERDAY"
            headline="Priya Mehta"
            supporting-text="Sent the updated onboarding deck — three slides changed, mostly in the metrics section."
            leading-avatar="https://i.pravatar.cc/80?img=5"
            trailing-icon="chevron_right"
          ></md-list-item>
          <md-list-item
            type="button"
            overline="TUE"
            headline="Eli Tanaka"
            supporting-text="Booked the design-system sync for Thursday 2pm — declined the Friday slot."
            leading-avatar="https://i.pravatar.cc/80?img=33"
            trailing-icon="chevron_right"
          ></md-list-item>
        </md-list>
      </div>

      <!-- 4 ─── Settings switches: trailing control + supporting text ───────── -->
      <div>
        ${sectionLabel('4. Settings switches (standard)')}
        ${caption('Two-line rows with leading icon + supporting text + trailing `md-switch`. The 64px row height + trailing controls already separate items visually.')}
        <md-list label="Privacy settings">
          <md-list-item
            headline="Personalised ads"
            supporting-text="Tailor ads using your activity across our apps"
            leading-icon="ads_click"
          >
            <md-switch slot="trailing" selected aria-label="Personalised ads"></md-switch>
          </md-list-item>
          <md-list-item
            headline="Crash diagnostics"
            supporting-text="Send anonymised crash reports automatically"
            leading-icon="bug_report"
          >
            <md-switch slot="trailing" selected aria-label="Crash diagnostics"></md-switch>
          </md-list-item>
          <md-list-item
            headline="Location history"
            supporting-text="Keep a private timeline of where you've been"
            leading-icon="my_location"
          >
            <md-switch slot="trailing" aria-label="Location history"></md-switch>
          </md-list-item>
          <md-list-item
            headline="Voice & audio activity"
            supporting-text="Improve speech recognition over time"
            leading-icon="mic"
          >
            <md-switch slot="trailing" aria-label="Voice & audio activity"></md-switch>
          </md-list-item>
        </md-list>
      </div>

      <!-- 5 ─── Image news feed: 3-line cards where the image IS the divider ── -->
      <div>
        ${sectionLabel('5. Image news feed (three-line)')}
        ${caption('56px leading images at 88px row height. The hard-edged image rectangle + content density carry the separation; a divider would just clutter the seam.')}
        <md-list label="Today's stories">
          <md-list-item
            type="button"
            overline="DESIGN · 4 MIN READ"
            headline="Why M3 dropped the universal divider rule"
            supporting-text="The 2024 M3 Expressive update treats dividers as a last resort, not a default — here's the reasoning."
            leading-image="https://picsum.photos/seed/news1/112/112"
            trailing-icon="bookmark_border"
          ></md-list-item>
          <md-list-item
            type="button"
            overline="ENGINEERING · 7 MIN READ"
            headline="Shape morphing without layout thrash"
            supporting-text="Animating border-radius is cheap, animating geometry is not — and the trick is knowing the difference."
            leading-image="https://picsum.photos/seed/news2/112/112"
            trailing-icon="bookmark_border"
          ></md-list-item>
          <md-list-item
            type="button"
            overline="ACCESSIBILITY · 3 MIN READ"
            headline="Roving tabindex, explained for the rest of us"
            supporting-text="One Tab stop per widget, arrow keys for the rest — the pattern every menu, tablist, and listbox needs."
            leading-image="https://picsum.photos/seed/news3/112/112"
            trailing-icon="bookmark_border"
          ></md-list-item>
        </md-list>
      </div>

      <!-- 6 ─── Dense standard file list: compressed padding, monospace data column ── -->
      <div>
        ${sectionLabel('6. Dense standard (file manager)')}
        ${caption('`list-style="standard"` with compressed top/bottom padding via tokens — the row stripe itself is the divider. Desktop file managers and inboxes use this pattern.')}
        <md-list
          style="
            --md-list-item-top-space: 4px;
            --md-list-item-bottom-space: 4px;
            --md-list-item-leading-space: 12px;
            --md-list-item-trailing-space: 12px;
          "
          list-style="standard"
          label="Recent files"
        >
          <md-list-item type="button" headline="annual-report.pdf" leading-icon="picture_as_pdf" trailing-supporting-text="2.4 MB"></md-list-item>
          <md-list-item type="button" headline="design-system.figma" leading-icon="palette" trailing-supporting-text="14.8 MB"></md-list-item>
          <md-list-item type="button" headline="budget-2026.xlsx" leading-icon="table_chart" trailing-supporting-text="384 KB"></md-list-item>
          <md-list-item type="button" headline="meeting-notes.md" leading-icon="article" trailing-supporting-text="12 KB"></md-list-item>
          <md-list-item type="button" headline="brand-guidelines.pdf" leading-icon="picture_as_pdf" trailing-supporting-text="6.1 MB"></md-list-item>
          <md-list-item type="button" headline="logo-assets.zip" leading-icon="folder_zip" trailing-supporting-text="22 MB"></md-list-item>
          <md-list-item type="button" headline="research-notes.docx" leading-icon="article" trailing-supporting-text="92 KB"></md-list-item>
          <md-list-item type="button" headline="metrics-dashboard.csv" leading-icon="data_table" trailing-supporting-text="48 KB"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   13. DENSE LAYOUT — compress paddings via spacing tokens
   ═══════════════════════════════════════════════════════════════════════════ */
export const DenseLayout: Story = {
  render: () => html`
    ${caption('Override `--md-list-item-top-space` / `--md-list-item-bottom-space` / `--md-list-item-leading-space` to compress a list for desktop chrome.')}
    <md-list
      style="
        max-inline-size: 380px;
        --md-list-item-top-space: 4px;
        --md-list-item-bottom-space: 4px;
        --md-list-item-leading-space: 12px;
        --md-list-item-trailing-space: 12px;
      "
      list-style="standard"
      label="Dense file list"
    >
      <md-list-item type="button" headline="annual-report.pdf" leading-icon="picture_as_pdf" trailing-supporting-text="2.4 MB"></md-list-item>
      <md-list-item type="button" headline="design-system.figma" leading-icon="palette" trailing-supporting-text="14.8 MB"></md-list-item>
      <md-list-item type="button" headline="budget-2026.xlsx" leading-icon="table_chart" trailing-supporting-text="384 KB"></md-list-item>
      <md-list-item type="button" headline="meeting-notes.md" leading-icon="article" trailing-supporting-text="12 KB"></md-list-item>
      <md-list-item type="button" headline="brand-guidelines.pdf" leading-icon="picture_as_pdf" trailing-supporting-text="6.1 MB"></md-list-item>
      <md-list-item type="button" headline="logo-assets.zip" leading-icon="folder_zip" trailing-supporting-text="22 MB"></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   14. LONG TEXT — overflow / ellipsis behavior
   ═══════════════════════════════════════════════════════════════════════════ */
export const LongText: Story = {
  render: () => html`
    ${caption('Headlines and 1- / 2-line supporting text truncate with an ellipsis. 3-line rows wrap supporting text up to two lines.')}
    <md-list style="max-inline-size: 360px;">
      <md-list-item
        type="button"
        headline="An extremely long headline that the row truncates with an ellipsis when it exceeds the available inline space"
        supporting-text="A long single supporting line that also truncates"
        leading-icon="text_fields"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="OVERLINE TRUNCATES ALSO"
        headline="3-line row with long supporting text"
        supporting-text="Three-line rows allow the supporting text to wrap to two lines before truncating with an ellipsis at the end — useful for chat previews, news feeds, and notifications."
        leading-icon="article"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   15. EDGE CASES — single item, empty list, mixed types
   ═══════════════════════════════════════════════════════════════════════════ */
export const EdgeCases: Story = {
  render: (_args, { globals }) => html`
    ${grid(html`
      <div>
        ${sectionLabel('Single item — all corners rounded')}
        ${caption('Standard lists detect `:only-of-type` and round all four corners.')}
        <md-list>
          <md-list-item
            type="button"
            headline="The only item"
            supporting-text="Rounds all four corners"
            leading-icon="circle"
          ></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Empty list with placeholder')}
        ${caption('No children — slot in an empty-state row.')}
        <md-list>
          <md-list-item
            type="text"
            headline=${t(globals.locale, 'list.noResults')}
            supporting-text=${t(globals.locale, 'list.tryDifferentSearch')}
            leading-icon="search_off"
          ></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Mixed text + interactive')}
        ${caption('Text rows act as section headers; interactive rows below them.')}
        <md-list>
          <md-list-item type="text" overline=${t(globals.locale, 'list.favorites')} headline=""></md-list-item>
          <md-list-item type="button" headline=${t(globals.locale, 'home')} leading-icon="home"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline=${t(globals.locale, 'list.work')} leading-icon="work"></md-list-item>
          <md-list-item type="text" overline=${t(globals.locale, 'list.other')} headline=""></md-list-item>
          <md-list-item type="button" headline=${t(globals.locale, 'list.gym')} leading-icon="fitness_center"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline=${t(globals.locale, 'list.cafe')} leading-icon="local_cafe"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   16. KEYBOARD NAVIGATION — roving tabindex + typeahead
   ═══════════════════════════════════════════════════════════════════════════ */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const doc = list.ownerDocument;

    await step('Roving tabindex: exactly one row is tabbable (the preselected Canada)', async () => {
      await waitFor(() =>
        expect(list.querySelectorAll(':scope > md-list-item[tabindex="0"]').length).toBe(1),
      );
      expect(tabbableRow(list)?.getAttribute('headline')).toBe('Canada');
    });

    await step('ArrowDown moves roving focus to the next row + emits mdActivate', async () => {
      const canada = tabbableRow(list)!;
      canada.focus();
      await waitFor(() => expect(doc.activeElement).toBe(canada));
      const before = canada.getAttribute('headline'); // 'Canada'
      let activate: { index: number } | undefined;
      list.addEventListener('mdActivate', e => { activate = (e as CustomEvent).detail; }, { once: true });
      key(canada, 'ArrowDown');
      // Focus follows via requestAnimationFrame → wait for it to actually land.
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).not.toBe(before),
      );
      expect((doc.activeElement as HTMLElement).getAttribute('headline')).toBe('Denmark'); // where it went
      expect(tabbableRow(list)?.getAttribute('headline')).toBe('Denmark'); // roving tabindex followed focus
      expect(canada.getAttribute('tabindex')).toBe('-1');                  // old anchor released
      expect(activate?.index).toBe(3);                                     // Denmark is items[3]
    });

    await step('Navigation continues: ArrowDown → Egypt, End → last row (Hungary)', async () => {
      key(doc.activeElement!, 'ArrowDown');
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).toBe('Egypt'),
      );
      key(doc.activeElement!, 'End');
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).toBe('Hungary'),
      );
      expect(tabbableRow(list)?.getAttribute('headline')).toBe('Hungary');
    });

    await step('Home jumps roving focus back to the first row (Argentina)', async () => {
      key(doc.activeElement!, 'Home');
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).toBe('Argentina'),
      );
      expect(tabbableRow(list)?.getAttribute('headline')).toBe('Argentina');
    });

    await step('ArrowUp from the first row wraps roving focus to the last (Hungary)', async () => {
      const first = doc.activeElement as HTMLElement; // Argentina (items[0])
      key(first, 'ArrowUp');
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).toBe('Hungary'),
      );
      expect(tabbableRow(list)?.getAttribute('headline')).toBe('Hungary'); // roving tabindex wrapped too
      expect(first.getAttribute('tabindex')).toBe('-1');                   // released off the first row
    });

    await step('Typeahead: pressing "b" jumps roving focus to Brazil', async () => {
      key(doc.activeElement!, 'b');
      await waitFor(() =>
        expect(tabbableRow(list)?.getAttribute('headline')).toBe('Brazil'),
      );
      await waitFor(() =>
        expect((doc.activeElement as HTMLElement)?.getAttribute('headline')).toBe('Brazil'),
      );
    });
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 12px; max-inline-size: 440px;">
      ${caption('Tab into the list, then use ↑ / ↓, Home / End, or type letters to jump. Enter / Space selects.')}
      <md-list selection-mode="single-select" label="Countries">
        <md-list-item headline="Argentina" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Brazil" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Canada" leading-icon="flag" selected></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Denmark" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Egypt" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="France" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Germany" leading-icon="flag"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Hungary" leading-icon="flag"></md-list-item>
      </md-list>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   17. PROGRAMMATIC API — methods + events
   ═══════════════════════════════════════════════════════════════════════════ */
export const ProgrammaticAPI: Story = {
  render: () => {
    /* Lit `@click` / `@mdActivate` on Stencil hosts are unreliable in Storybook.
       Delegate `mdClick` from the demo root once (guarded) so HMR/remounts do not
       stack duplicate handlers that skip rows or no-op on stale element refs. */
    requestAnimationFrame(() => {
      const root = document.getElementById('programmatic-api-demo');
      const out = document.getElementById('api-out') as HTMLPreElement | null;
      if (!root || !out || root.dataset.programmaticApiWired === 'true') return;
      root.dataset.programmaticApiWired = 'true';

      const getList = () =>
        document.getElementById('api-list') as HTMLMdListElement | null;

      const items = (list: HTMLMdListElement) =>
        Array.from(list.querySelectorAll('md-list-item')) as HTMLMdListItemElement[];

      const refreshApiOutput = async (activeIndex?: number) => {
        const list = getList();
        if (!list) return;
        const selected = await list.getSelectedIndices();
        const active =
          activeIndex ?? items(list).findIndex((item) => item.tabbable);
        out.textContent =
          `Active index: ${active} — selected indices: ${JSON.stringify(selected)}`;
      };

      const listItemIndex = (
        list: HTMLMdListElement,
        item: HTMLMdListItemElement | null,
      ): number | undefined => {
        if (!item) return undefined;
        return items(list).indexOf(item);
      };

      const restoreListFocus = (item: HTMLMdListItemElement | null) => {
        requestAnimationFrame(() =>
          item?.focus({ focusVisible: true, preventScroll: true } as FocusOptions),
        );
      };

      root.addEventListener('mdClick', (event: Event) => {
        const path = event.composedPath() as HTMLElement[];
        const control = path.find(
          (el) => el?.dataset?.api && root.contains(el),
        );
        const action = control?.dataset.api;
        if (!action) return;

        const list = getList();
        if (!list) return;

        void (async () => {
          switch (action) {
            case 'previous': {
              const item = await list.activatePrevious();
              restoreListFocus(item);
              await refreshApiOutput(listItemIndex(list, item));
              break;
            }
            case 'next': {
              const item = await list.activateNext();
              restoreListFocus(item);
              await refreshApiOutput(listItemIndex(list, item));
              break;
            }
            case 'select-first': {
              await list.selectItem(0);
              await refreshApiOutput();
              break;
            }
            case 'read': {
              await refreshApiOutput();
              break;
            }
          }
        })();
      });

      getList()?.addEventListener('mdActivate', (event: Event) => {
        const { index } = (event as CustomEvent<{ index: number }>).detail;
        void refreshApiOutput(index);
      });

      void refreshApiOutput();
    });

    return html`
    <div
      id="programmatic-api-demo"
      style="display: flex; flex-direction: column; gap: 16px; max-inline-size: 440px;"
    >
      ${caption('Imperatively drive roving focus and selection via `activatePrevious() / activateNext() / selectItem() / getSelectedIndices()`. Previous / Next move roving focus (focus ring); selected rows stay highlighted until toggled.')}
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <md-button data-api="previous" variant="outlined">Previous</md-button>
        <md-button data-api="next" variant="outlined">Next</md-button>
        <md-button data-api="select-first" variant="outlined">Select first</md-button>
        <md-button data-api="read" variant="filled">Read selection</md-button>
      </div>
      <md-list
        id="api-list"
        selection-mode="multi-select"
        label="Programmatic API demo"
      >
        <md-list-item headline="Apple" leading-icon="eco"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Banana" leading-icon="eco" selected></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Cherry" leading-icon="eco"></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Date" leading-icon="eco" selected></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item headline="Elderberry" leading-icon="eco"></md-list-item>
      </md-list>
      <pre
        id="api-out"
        style="
          margin: 0;
          padding: 12px;
          background: var(--md-sys-color-surface-container);
          color: var(--md-sys-color-on-surface);
          border-radius: 8px;
          font-size: 12px;
          font-family: ui-monospace, monospace;
        "
      >Loading…</pre>
    </div>
    `;
  },
  /** Drive the list purely through its imperative @Method API — no row clicks. */
  play: async ({ canvasElement, step }) => {
    const list = (await getMdList(canvasElement)) as HTMLMdListElement;
    const rows = rowsOf(list); // [Apple, Banana, Cherry, Date, Elderberry]

    await step('getSelectedIndices() reports the two preseeded selections (Banana, Date)', async () => {
      // multi-select seeds `selected` on Banana (1) + Date (3).
      await waitFor(() => expect(selectedRows(list).length).toBe(2));
      expect(await list.getSelectedIndices()).toEqual([1, 3]);
    });

    await step('selectItem(0) adds Apple imperatively — selection grows, NO mdSelect fires (guard)', async () => {
      const before = await list.getSelectedIndices(); // [1, 3]
      let fired = false;
      list.addEventListener('mdSelect', () => { fired = true; }, { once: true });
      await list.selectItem(0);
      // aria-selected reflects on the NEXT render flush → assert inside waitFor.
      await waitFor(() => expect(rows[0].getAttribute('aria-selected')).toBe('true'));
      const after = await list.getSelectedIndices();
      expect(after).not.toEqual(before);   // selection changed…
      expect(after).toEqual([0, 1, 3]);    // …Apple joined, priors retained (multi-select)
      expect(fired).toBe(false);           // the programmatic API mutates state silently
    });

    await step('activateNext() advances the roving tab stop without touching selection', async () => {
      // Roving tabindex converges on the preselected anchor (Banana) — capture that single tab stop.
      await waitFor(() =>
        expect(list.querySelectorAll(':scope > md-list-item[tabindex="0"]').length).toBe(1),
      );
      const tabBefore = tabbableRow(list); // Banana (index 1)
      expect(tabBefore).toBe(rows[1]);
      const selBefore = await list.getSelectedIndices(); // [0, 1, 3]
      const moved = await list.activateNext();
      // tabbable → tabindex reflects on the next render flush.
      await waitFor(() => expect(tabbableRow(list)).not.toBe(tabBefore)); // the tab stop MOVED
      expect(moved).toBe(rows[2]);                                // Banana(1) → Cherry(2)
      expect(tabbableRow(list)).toBe(rows[2]);
      expect(await list.getSelectedIndices()).toEqual(selBefore); // guard: roving focus ≠ selection
    });

    await step('activatePrevious() walks the roving tab stop back (Cherry → Banana), selection untouched', async () => {
      const tabBefore = tabbableRow(list);              // Cherry (index 2)
      const selBefore = await list.getSelectedIndices(); // [0, 1, 3]
      const moved = await list.activatePrevious();
      // tabbable → tabindex reflects on the next render flush.
      await waitFor(() => expect(tabbableRow(list)).not.toBe(tabBefore)); // the tab stop moved back
      expect(moved).toBe(rows[1]);                                 // Cherry(2) → Banana(1)
      expect(tabbableRow(list)).toBe(rows[1]);
      expect(await list.getSelectedIndices()).toEqual(selBefore);  // guard: roving focus ≠ selection
    });
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   18. ROLE OVERRIDE — embed the list inside a wider widget
   ═══════════════════════════════════════════════════════════════════════════ */
export const RoleOverride: Story = {
  render: (_args, { globals }) => html`
    ${caption('`role-override` lets you reuse the chassis inside a wider widget pattern — here a dropdown `menu`.')}
    <md-list
      role-override="menu"
      list-style="standard"
      style="max-inline-size: 320px;"
      label=${t(globals.locale, 'list.editMenu')}
    >
      <md-list-item type="button" headline=${t(globals.locale, 'list.cut')} leading-icon="content_cut" trailing-supporting-text="⌘X"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.copy')} leading-icon="content_copy" trailing-supporting-text="⌘C"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'list.paste')} leading-icon="content_paste" trailing-supporting-text="⌘V"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline=${t(globals.locale, 'delete')} leading-icon="delete" trailing-supporting-text="⌫" disabled></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   19. CUSTOM CSS — public custom properties
   ═══════════════════════════════════════════════════════════════════════════ */
export const CustomCSS: Story = {
  render: () => html`
    ${caption('Override `--md-list-*` / `--md-list-item-*` custom properties to retheme containers and rows without touching the shadow boundary.')}
    <style>
      .branded-list {
        --md-list-container-color: var(--md-sys-color-surface-container);
        --md-list-container-shape: 24px;
        --md-list-padding-block: 8px;
      }
      .branded-list md-list-item {
        --md-list-item-container-color: transparent;
        --md-list-item-label-text-color: var(--md-sys-color-primary);
        --md-list-item-leading-icon-color: var(--md-sys-color-tertiary);
      }
      .branded-list md-list-item.highlight-row {
        --md-list-item-container-color: var(--md-sys-color-tertiary-container);
        --md-list-item-label-text-color: var(--md-sys-color-on-tertiary-container);
        --md-list-item-leading-icon-color: var(--md-sys-color-on-tertiary-container);
      }
      .brand-segmented {
        --md-list-segmented-gap: 8px;
      }
      .brand-segmented md-list-item {
        --md-list-item-container-shape: 24px;
        --md-list-item-container-color: var(--md-sys-color-primary-container);
        --md-list-item-label-text-color: var(--md-sys-color-on-primary-container);
        --md-list-item-leading-icon-color: var(--md-sys-color-on-primary-container);
      }
    </style>
    ${grid(html`
      <div>
        ${sectionLabel('Branded standard')}
        ${caption('Surface-container chassis, primary headlines, tertiary icons.')}
        <md-list class="branded-list">
          <md-list-item type="button" headline="Branded row 1" leading-icon="palette"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Highlighted row" leading-icon="star" class="highlight-row"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Branded row 3" leading-icon="brush"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Branded segmented')}
        ${caption('Primary-container tiles, larger 8 px gap, 24 dp radius.')}
        <md-list class="brand-segmented" list-style="segmented">
          <md-list-item type="button" headline="Photos" leading-icon="photo"></md-list-item>
          <md-list-item type="button" headline="Videos" leading-icon="videocam"></md-list-item>
          <md-list-item type="button" headline="Music" leading-icon="music_note"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   20. SHAPE OVERRIDES — override the per-state corner radii
   ═══════════════════════════════════════════════════════════════════════════ */
export const ShapeOverrides: Story = {
  render: () => html`
    ${caption('Use `--md-list-item-active-container-shape` to set a single shape across all active states, or override individual states (`hover` / `focus` / `pressed` / `selected` / `dragged`).')}
    ${grid(html`
      <div>
        ${sectionLabel('Single-shape override')}
        ${caption('All active states morph to a 28 px radius.')}
        <md-list
          selection-mode="single-select"
          label="Active shape states"
          style="
            --md-list-item-active-container-shape: 28px;
          "
        >
          <md-list-item headline="Hover, focus, press, select" leading-icon="rounded_corner" selected></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item headline="All morph to 28 px" leading-icon="rounded_corner"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item headline="Try hovering" leading-icon="rounded_corner"></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Per-state overrides')}
        ${caption('Hover stays at 4 px, focus jumps to 12 px, pressed lifts to 24 px.')}
        <md-list
          style="
            --md-list-item-hover-container-shape: 4px;
            --md-list-item-focus-container-shape: 12px;
            --md-list-item-pressed-container-shape: 24px;
            --md-list-item-selected-container-shape: 24px;
          "
        >
          <md-list-item type="button" headline="Hover → 4 px" leading-icon="adjust"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Focus (Tab) → 12 px" leading-icon="adjust"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="button" headline="Press → 24 px" leading-icon="adjust"></md-list-item>
        </md-list>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   21. CSS PARTS — style internal elements through the shadow boundary
   ═══════════════════════════════════════════════════════════════════════════ */
export const CSSParts: Story = {
  render: () => html`
    ${caption('Every internal element exposes a `part` attribute — style them with the `::part()` pseudo-element.')}
    <style>
      .parts-demo md-list-item::part(headline) {
        font-weight: 600;
        letter-spacing: 0.4px;
      }
      .parts-demo md-list-item::part(supporting-text) {
        font-style: italic;
      }
      .parts-demo md-list-item::part(leading-icon) {
        font-variation-settings: 'FILL' 1;
      }
      .parts-demo md-list-item::part(trailing-supporting-text) {
        color: var(--md-sys-color-primary);
        font-weight: 700;
      }
      .parts-demo md-list-item::part(state-layer) {
        background: var(--md-sys-color-tertiary);
      }
    </style>
    <md-list class="parts-demo" style="max-inline-size: 400px;">
      <md-list-item
        type="button"
        headline="Bold headline"
        supporting-text="Italic supporting text"
        leading-icon="favorite"
        trailing-supporting-text="!"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Filled leading icon"
        supporting-text="Via FILL variation axis"
        leading-icon="star"
        trailing-supporting-text="5"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        headline="Themed trailing text"
        supporting-text="Styled via ::part(trailing-supporting-text)"
        leading-icon="palette"
        trailing-supporting-text="New"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   22. LOCALIZATION — inbox labels in 6 locales (incl. RTL)
   ═══════════════════════════════════════════════════════════════════════════ */
export const Localization: Story = {
  name: 'Localization',
  parameters: {
    docs: {
      description: {
        story:
          'Pass translated strings from your i18n layer into ' +
          '<code>headline</code>, <code>supporting-text</code>, and the ' +
          'list <code>label</code> (exposed as <code>aria-label</code>). ' +
          'Wrap each locale row in <code>lang</code> and <code>dir</code> ' +
          'so screen readers pronounce content correctly and leading / ' +
          'trailing layout mirrors automatically in Arabic and Hebrew ' +
          'thanks to CSS logical properties.',
      },
    },
  },
  render: () => {
    type L10nItem = {
      headline: string;
      supporting: string;
      icon: string;
      trailing?: string;
    };
    type L10nRow = {
      code: string;
      dir: 'ltr' | 'rtl';
      name: string;
      listLabel: string;
      items: L10nItem[];
    };
    const rows: L10nRow[] = [
      {
        code: 'en',
        dir: 'ltr',
        name: 'English',
        listLabel: 'Inbox',
        items: [
          { headline: 'Inbox', supporting: '12 new messages', icon: 'inbox', trailing: '24' },
          { headline: 'Notifications', supporting: '3 unread alerts', icon: 'notifications', trailing: '3' },
          { headline: 'Starred', supporting: 'Marked important', icon: 'star' },
        ],
      },
      {
        code: 'fr',
        dir: 'ltr',
        name: 'Français',
        listLabel: 'Boîte de réception',
        items: [
          { headline: 'Boîte de réception', supporting: '12 nouveaux messages', icon: 'inbox', trailing: '24' },
          { headline: 'Notifications', supporting: '3 alertes non lues', icon: 'notifications', trailing: '3' },
          { headline: 'Favoris', supporting: 'Marqué comme important', icon: 'star' },
        ],
      },
      {
        code: 'de',
        dir: 'ltr',
        name: 'Deutsch',
        listLabel: 'Posteingang',
        items: [
          { headline: 'Posteingang', supporting: '12 neue Nachrichten', icon: 'inbox', trailing: '24' },
          { headline: 'Benachrichtigungen', supporting: '3 ungelesene Warnungen', icon: 'notifications', trailing: '3' },
          { headline: 'Markiert', supporting: 'Als wichtig markiert', icon: 'star' },
        ],
      },
      {
        code: 'ja',
        dir: 'ltr',
        name: '日本語',
        listLabel: '受信トレイ',
        items: [
          { headline: '受信トレイ', supporting: '12件の新着メッセージ', icon: 'inbox', trailing: '24' },
          { headline: '通知', supporting: '3件の未読アラート', icon: 'notifications', trailing: '3' },
          { headline: 'スター付き', supporting: '重要としてマーク', icon: 'star' },
        ],
      },
      {
        code: 'ar',
        dir: 'rtl',
        name: 'العربية',
        listLabel: 'البريد الوارد',
        items: [
          { headline: 'البريد الوارد', supporting: '١٢ رسالة جديدة', icon: 'inbox', trailing: '٢٤' },
          { headline: 'الإشعارات', supporting: '٣ تنبيهات غير مقروءة', icon: 'notifications', trailing: '٣' },
          { headline: 'المميز بنجمة', supporting: 'مُعلَّم كمهم', icon: 'star' },
        ],
      },
      {
        code: 'he',
        dir: 'rtl',
        name: 'עברית',
        listLabel: 'תיבת דואר נכנס',
        items: [
          { headline: 'תיבת דואר נכנס', supporting: '12 הודעות חדשות', icon: 'inbox', trailing: '24' },
          { headline: 'התראות', supporting: '3 התראות שלא נקראו', icon: 'notifications', trailing: '3' },
          { headline: 'מסומן בכוכב', supporting: 'מסומן כחשוב', icon: 'star' },
        ],
      },
    ];
    return html`
      <style>
        .list-l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .list-l10n .grid { display: flex; flex-direction: column; }
        .list-l10n .row {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .list-l10n .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding-block-start: 8px;
        }
        .list-l10n .code {
          color: #6750a4;
          font-weight: 600;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .list-l10n .name { color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 14px; }
        .list-l10n .demo {
          flex: 1 1 auto;
          min-inline-size: 0;
        }
      </style>
      <div class="list-l10n">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          The same <code>md-list</code> markup rendered with translated
          <code>headline</code>, <code>supporting-text</code>, and
          <code>label</code> props. Each row carries its own
          <code>lang</code> and <code>dir</code> so layout mirrors in RTL
          and screen readers use the correct pronunciation.
        </p>
        <div class="grid">
          ${rows.map((r) => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.name}</span>
              </div>
              <div class="demo">
                <md-list style="max-inline-size: 380px;" label=${r.listLabel}>
                  ${r.items.map(
                    (item, i) => html`
                      <md-list-item
                        type="button"
                        headline=${item.headline}
                        supporting-text=${item.supporting}
                        leading-icon=${item.icon}
                        trailing-supporting-text=${item.trailing ?? ''}
                        trailing-icon=${r.dir === 'rtl' ? 'chevron_left' : 'chevron_right'}
                      ></md-list-item>
                      ${i < r.items.length - 1 ? html`<md-divider inset-start></md-divider>` : ''}
                    `,
                  )}
                </md-list>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   23. RTL — logical properties + Arabic content
   ═══════════════════════════════════════════════════════════════════════════ */
export const RTL: Story = {
  render: () => html`
    ${caption('All layout flows via CSS logical properties — wrapping the list in `dir="rtl"` flips leading / trailing automatically.')}
    <div dir="rtl">
      ${grid(html`
        <div>
          ${sectionLabel('Standard')}
          <md-list style="max-inline-size: 360px;" label="قائمة">
            <md-list-item
              type="button"
              headline="البريد الوارد"
              supporting-text="٥ رسائل جديدة"
              leading-icon="inbox"
              trailing-supporting-text="٢٤"
            ></md-list-item>
            <md-divider inset-start></md-divider>
            <md-list-item
              type="button"
              headline="المميز بنجمة"
              supporting-text="٣ عناصر"
              leading-icon="star"
              trailing-icon="chevron_left"
            ></md-list-item>
            <md-divider inset-start></md-divider>
            <md-list-item
              type="button"
              headline="المرسلة"
              leading-icon="send"
            ></md-list-item>
          </md-list>
        </div>
        <div>
          ${sectionLabel('Segmented + selected')}
          <md-list list-style="segmented" selection-mode="single-select" label="مكتبة الوسائط">
            <md-list-item
              headline="الصور"
              leading-icon="photo"
              trailing-supporting-text="١٢٨"
              selected
            ></md-list-item>
            <md-list-item
              headline="الفيديو"
              leading-icon="videocam"
              trailing-supporting-text="٤٢"
            ></md-list-item>
            <md-list-item
              headline="الموسيقى"
              leading-icon="music_note"
              trailing-supporting-text="٢٥٦"
            ></md-list-item>
          </md-list>
        </div>
      `)}
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   23. DARK THEME
   ═══════════════════════════════════════════════════════════════════════════ */
export const DarkTheme: Story = {
  render: () => html`
    <div
      data-theme="dark"
      style="
        background: var(--md-sys-color-surface);
        padding: 24px;
        border-radius: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
      "
    >
      <div>
        ${sectionLabel('Standard + single-select')}
        <md-list selection-mode="single-select" label="Dark theme list">
          <md-list-item
            headline="Inbox"
            supporting-text="12 new"
            leading-icon="inbox"
            trailing-supporting-text="24"
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            headline="Starred"
            supporting-text="Marked important"
            leading-icon="star"
            selected
          ></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item
            headline="Sent"
            supporting-text="Outgoing items"
            leading-icon="send"
          ></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Segmented')}
        <md-list list-style="segmented">
          <md-list-item
            type="button"
            headline="Photos"
            leading-icon="photo"
            trailing-supporting-text="128"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Videos"
            leading-icon="videocam"
            trailing-supporting-text="42"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Music"
            leading-icon="music_note"
            trailing-supporting-text="256"
          ></md-list-item>
        </md-list>
      </div>
      <div>
        ${sectionLabel('Standard (dense)')}
        <md-list list-style="standard">
          <md-list-item type="button" headline="annual-report.pdf" leading-icon="picture_as_pdf"></md-list-item>
          <md-divider></md-divider>
          <md-list-item type="button" headline="design-system.figma" leading-icon="palette"></md-list-item>
          <md-divider></md-divider>
          <md-list-item type="button" headline="budget-2026.xlsx" leading-icon="table_chart"></md-list-item>
        </md-list>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   24. REAL-WORLD RECIPE — Settings
   ═══════════════════════════════════════════════════════════════════════════ */
export const SettingsRecipe: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 24px; inline-size: 440px; max-inline-size: 100%;">
      ${sectionLabel('Settings')}
      <md-list label=${t(globals.locale, 'list.system')}>
        <md-list-item
          type="button"
          headline=${t(globals.locale, 'list.wifi')}
          supporting-text=${t(globals.locale, 'list.homeNetwork')}
          leading-icon="wifi"
          trailing-icon="chevron_right"
        ></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item
          type="button"
          headline=${t(globals.locale, 'list.bluetooth')}
          supporting-text=${t(globals.locale, 'list.devicesConnected2')}
          leading-icon="bluetooth"
          trailing-icon="chevron_right"
        ></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item
          type="button"
          headline=${t(globals.locale, 'list.display')}
          supporting-text=${t(globals.locale, 'list.adaptiveBrightness')}
          leading-icon="display_settings"
          trailing-icon="chevron_right"
        ></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item
          type="button"
          headline=${t(globals.locale, 'list.sound')}
          supporting-text=${t(globals.locale, 'list.mediaVolume80')}
          leading-icon="volume_up"
          trailing-icon="chevron_right"
        ></md-list-item>
        <md-divider inset-start></md-divider>
        <md-list-item
          type="button"
          headline=${t(globals.locale, 'list.battery')}
          supporting-text=${t(globals.locale, 'list.battery68')}
          leading-icon="battery_5_bar"
          trailing-icon="chevron_right"
        ></md-list-item>
      </md-list>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   25. REAL-WORLD RECIPE — Inbox (segmented + selectable)
   ═══════════════════════════════════════════════════════════════════════════ */
export const InboxRecipe: Story = {
  render: () => html`
    <md-list
      style="inline-size: 640px; max-inline-size: 100%;"
      list-style="segmented"
      selection-mode="single-select"
      label="Inbox"
    >
      <md-list-item
        overline="UNREAD"
        headline="Alice Johnson"
        supporting-text="Hey, can we meet tomorrow at 10am?"
        leading-avatar="https://i.pravatar.cc/80?img=10"
        leading-avatar-alt="Alice Johnson"
        trailing-supporting-text="2m"
      ></md-list-item>
      <md-list-item
        headline="Bob Smith"
        supporting-text="The report is ready for review — please take a look"
        leading-avatar="https://i.pravatar.cc/80?img=12"
        leading-avatar-alt="Bob Smith"
        trailing-supporting-text="15m"
        selected
      ></md-list-item>
      <md-list-item
        headline="Charlie Brown"
        supporting-text="Great work on the presentation!"
        leading-avatar="https://i.pravatar.cc/80?img=14"
        leading-avatar-alt="Charlie Brown"
        trailing-supporting-text="1h"
      ></md-list-item>
      <md-list-item
        headline="Dana Lee"
        supporting-text="See you Friday for the team lunch"
        leading-avatar-label="DL"
        trailing-supporting-text="3h"
      ></md-list-item>
      <md-list-item
        headline="Evan Tran"
        supporting-text="Out of office until Monday — back on the 18th"
        leading-avatar-label="ET"
        trailing-supporting-text="Yesterday"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   26. REAL-WORLD RECIPE — Contacts (mixed avatars + sections)
   ═══════════════════════════════════════════════════════════════════════════ */
export const ContactsRecipe: Story = {
  render: () => html`
    <md-list style="inline-size: 440px; max-inline-size: 100%;" label="Contacts">
      <md-list-item type="text" overline="A"></md-list-item>
      <md-list-item type="button" headline="Alice Johnson" supporting-text="Mobile · +1 (555) 010-2345" leading-avatar-label="AJ"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="Aiden Brooks" supporting-text="Work · aiden@studio.io" leading-avatar-label="AB"></md-list-item>
      <md-list-item type="text" overline="B"></md-list-item>
      <md-list-item type="button" headline="Bea Chen" supporting-text="Mobile · +44 7700 900112" leading-avatar="https://i.pravatar.cc/80?img=22" leading-avatar-alt="Bea Chen"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="button" headline="Ben Walker" supporting-text="Work · ben@walker.com" leading-avatar-label="BW"></md-list-item>
      <md-list-item type="text" overline="C"></md-list-item>
      <md-list-item type="button" headline="Carla Reyes" supporting-text="Home · carla@reyes.fam" leading-avatar="https://i.pravatar.cc/80?img=24" leading-avatar-alt="Carla Reyes"></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   27. REAL-WORLD RECIPE — File manager (standard + trailing icon buttons)
   ═══════════════════════════════════════════════════════════════════════════ */
export const FileManagerRecipe: Story = {
  render: () => html`
    <md-list style="inline-size: 520px; max-inline-size: 100%;" list-style="standard" label="Documents">
      <md-list-item
        type="button"
        headline="annual-report.pdf"
        supporting-text="2.4 MB · Modified yesterday"
        leading-icon="picture_as_pdf"
      >
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item
        type="button"
        headline="design-system.figma"
        supporting-text="14.8 MB · Modified 2 days ago"
        leading-icon="palette"
      >
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item
        type="button"
        headline="budget-2026.xlsx"
        supporting-text="384 KB · Modified last week"
        leading-icon="table_chart"
      >
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item
        type="button"
        headline="vacation-photos/"
        supporting-text="12 items · Folder"
        leading-icon="folder"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-divider></md-divider>
      <md-list-item
        type="button"
        headline="archive.zip"
        supporting-text="220 MB · Modified last month"
        leading-icon="folder_zip"
      >
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More options"></md-icon-button>
      </md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   28. REAL-WORLD RECIPE — Notification preferences with switches
   ═══════════════════════════════════════════════════════════════════════════ */
export const NotificationPreferencesRecipe: Story = {
  render: (_args, { globals }) => html`
    <md-list style="inline-size: 480px; max-inline-size: 100%;" label=${t(globals.locale, 'list.notificationPreferences')}>
      <md-list-item type="text" headline=${t(globals.locale, 'list.email')} supporting-text=${t(globals.locale, 'list.dailyDigestActivity')} leading-icon="mail">
        <md-switch slot="trailing" selected aria-label="Toggle email notifications"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.push')} supporting-text=${t(globals.locale, 'list.realTimeMobileAlerts')} leading-icon="notifications_active">
        <md-switch slot="trailing" selected aria-label="Toggle push notifications"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.sms')} supporting-text=${t(globals.locale, 'list.criticalAlertsOnly')} leading-icon="sms">
        <md-switch slot="trailing" aria-label="Toggle SMS notifications"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.doNotDisturb')} supporting-text=${t(globals.locale, 'list.silenceAll')} leading-icon="do_not_disturb_on">
        <md-switch slot="trailing" selected icons aria-label="Toggle do not disturb"></md-switch>
      </md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item type="text" headline=${t(globals.locale, 'list.autoUpdateApps')} supporting-text=${t(globals.locale, 'list.overWifiOnly')} leading-icon="autorenew">
        <md-checkbox slot="trailing" checked aria-label="Auto-update apps"></md-checkbox>
      </md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   29. REAL-WORLD RECIPE — Music library (images + supporting metadata)
   ═══════════════════════════════════════════════════════════════════════════ */
export const MusicLibraryRecipe: Story = {
  render: () => html`
    <md-list style="inline-size: 520px; max-inline-size: 100%;" label="Recently played">
      <md-list-item
        type="button"
        overline="ALBUM"
        headline="Random Access Memories"
        supporting-text="Daft Punk · 2013 · 13 tracks"
        leading-image="https://picsum.photos/seed/m1/112/112"
        leading-image-alt="Random Access Memories cover"
        trailing-icon="play_arrow"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="SINGLE"
        headline="Get Lucky"
        supporting-text="Daft Punk feat. Pharrell Williams · 6:09"
        leading-image="https://picsum.photos/seed/m2/112/112"
        leading-image-alt="Get Lucky cover"
        trailing-icon="play_arrow"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="PLAYLIST"
        headline="Focus deep work"
        supporting-text="42 tracks · 3 h 12 min"
        leading-image="https://picsum.photos/seed/m3/112/112"
        leading-image-alt="Playlist cover"
        trailing-icon="play_arrow"
      ></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item
        type="button"
        overline="PODCAST"
        headline="The Daily — Wednesday"
        supporting-text="The New York Times · 28 min · New"
        leading-image="https://picsum.photos/seed/m4/112/112"
        leading-image-alt="The Daily artwork"
        trailing-icon="play_arrow"
      ></md-list-item>
    </md-list>
  `,
};

// ──────────────────────────────────────────────────────────────
// Reorderable (drag-and-drop repro)
// ──────────────────────────────────────────────────────────────
/* Native drag-to-reorder. The list owns the interaction: set `reorderable`
   and each row renders its own trailing drag handle (≡). Grab the handle and
   drag — the row lifts with the `.md-list-item--dragged` affordance (level-4
   elevation + 16 % state layer + corner-large morph), follows the pointer in
   flow (so it keeps its full width / rounded shape), the rows it passes over
   glide aside, and on drop the list reorders its children and emits
   `mdReorder` with { from, to, order }. Rows also move with Alt+ArrowUp/Down
   when focused. This helper just logs each `mdReorder` into the status line so
   the event is visible during verification. */
function wireReorderLogger(list: HTMLElement | null, status: HTMLElement | null) {
  if (!list || !status || (list as any).__reorderLoggerWired) return;
  (list as any).__reorderLoggerWired = true;
  list.addEventListener('mdReorder', (e: Event) => {
    const { from, to, order } = (e as CustomEvent).detail;
    status.textContent = `mdReorder → from ${from} to ${to} · order [${order.join(', ')}]`;
  });
}

export const Reorderable: Story = {
  name: 'Reorderable (drag handle)',
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const initial = rowsOf(list).map(r => r.getAttribute('headline'));
    // [21st Century Strangers, Midnight City, Instant Crush, The Less I Know the Better]

    await step('Keyboard reorder: row 0 requests move-down → it swaps past row 1 and emits mdReorder', async () => {
      const first = rowsOf(list)[0];
      await waitFor(() => expect(first.classList.contains('hydrated')).toBe(true));
      let detail: { from: number; to: number; order: number[] } | undefined;
      list.addEventListener('mdReorder', e => { detail = (e as CustomEvent).detail; }, { once: true });
      // Rows relay Alt+ArrowDown as a `mdItemRequestReorder`; drive that request directly.
      first.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => {
        const order = rowsOf(list).map(r => r.getAttribute('headline'));
        expect(order[0]).toBe(initial[1]); // Midnight City is now first
        expect(order[1]).toBe(initial[0]); // 21st Century Strangers dropped to second
      });
      expect(detail?.from).toBe(0);
      expect(detail?.to).toBe(1);
      expect(detail?.order).toEqual([1, 0, 2, 3]); // new position → original index mapping
    });

    await step('Moving the same row back up restores the authored order + emits mdReorder { from:1, to:0 }', async () => {
      const movedRow = rowsOf(list)[1]; // 21st Century Strangers, now at index 1
      let detail: { from: number; to: number; order: number[] } | undefined;
      list.addEventListener('mdReorder', e => { detail = (e as CustomEvent).detail; }, { once: true });
      movedRow.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'up', from: 1 },
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => {
        const order = rowsOf(list).map(r => r.getAttribute('headline'));
        expect(order[0]).toBe(initial[0]); // authored first row restored to the top
      });
      expect(detail?.from).toBe(1);
      expect(detail?.to).toBe(0);
      expect(detail?.order).toEqual([0, 1, 2, 3]); // back to the identity order
    });
  },
  render: () => {
    setTimeout(() => {
      wireReorderLogger(
        document.getElementById('reorder-repro-list'),
        document.getElementById('reorder-status'),
      );
    }, 0);
    return html`
      ${caption('Grab a row\u2019s trailing drag handle (\u2807) and drag to reorder. The dragged row lifts with a level-4 shadow + 16 % state layer, keeps its resting width and rounded shape, and the list emits mdReorder { from, to, order } on drop. The status line below logs the latest event.')}
      <md-list
        id="reorder-repro-list"
        style="inline-size: 520px; max-inline-size: 100%;"
        label="Reorder queue"
        reorderable
        interaction-mode="multi-action"
      >
        <md-list-item
          type="button"
          headline="21st Century Strangers"
          supporting-text="For Now · NBR"
          leading-image="https://picsum.photos/seed/r1/112/112"
          leading-image-alt="21st Century Strangers cover"
        ></md-list-item>
        <md-list-item
          type="button"
          headline="Midnight City"
          supporting-text="M83 · Hurry Up, We're Dreaming"
          leading-image="https://picsum.photos/seed/r2/112/112"
          leading-image-alt="Midnight City cover"
        ></md-list-item>
        <md-list-item
          type="button"
          headline="Instant Crush"
          supporting-text="Daft Punk feat. Julian Casablancas"
          leading-image="https://picsum.photos/seed/r3/112/112"
          leading-image-alt="Instant Crush cover"
        ></md-list-item>
        <md-list-item
          type="button"
          headline="The Less I Know the Better"
          supporting-text="Tame Impala · Currents"
          leading-image="https://picsum.photos/seed/r4/112/112"
          leading-image-alt="The Less I Know the Better cover"
        ></md-list-item>
      </md-list>
      <p
        id="reorder-status"
        style="margin-block-start: 16px; font-family: var(--md-sys-typescale-body-medium-font, system-ui); font-size: 13px; color: var(--md-sys-color-on-surface-variant, #49454f);"
      >
        mdReorder → (drag a row to see the event)
      </p>
    `;
  },
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    docs: {
      description: {
        story:
          'Lists fill their parent inline-size — constrain with ' +
          '<code>max-inline-size</code> on the host for comfortable reading ' +
          'width. List items truncate headline and supporting text via the ' +
          'built-in ellipsis when space is tight; hover truncated text to ' +
          'read the full string via the native browser tooltip. At 320px ' +
          'three-line items still keep trailing controls accessible. Pair ' +
          'with <code>md-divider inset-start</code> for inset separators ' +
          'that scale with the list width.',
      },
    },
  },
  render: () => html`
    <style>
      .list-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .list-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); margin-block-end: 6px; }
      .list-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 0;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
        overflow: hidden;
      }
      .list-resp-live { resize: horizontal; overflow: hidden; min-inline-size: 200px; max-inline-size: 100%; inline-size: 480px; }
    </style>

    <div class="list-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">List width at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Same list markup — items truncate headlines and supporting text at narrow widths.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="list-resp-vp__label">${vp.label}</div>
              <div class="list-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-list label="Inbox">
                  <md-list-item
                    type="button"
                    headline="Quarterly revenue report and forecast analysis for all regions"
                    supporting-text="Finance team · Updated 2 hours ago · Requires your review before end of day"
                    leading-icon="description"
                    trailing-icon="chevron_right"
                  ></md-list-item>
                  <md-divider inset-start></md-divider>
                  <md-list-item
                    type="button"
                    headline="Design system component audit — accessibility and RTL checklist"
                    supporting-text="Design · 14 comments · Assigned to you"
                    leading-icon="design_services"
                    trailing-icon="chevron_right"
                  ></md-list-item>
                  <md-divider inset-start></md-divider>
                  <md-list-item
                    type="button"
                    headline="Team offsite planning"
                    supporting-text="HR · March 15–17 · 3 days"
                    leading-icon="event"
                    trailing-icon="chevron_right"
                  ></md-list-item>
                </md-list>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Capped reading width on desktop</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          <code>max-inline-size: 480px</code> keeps line length comfortable on wide screens.
        </p>
        <md-list style="max-inline-size: 480px; margin-inline: auto;" label="Settings">
          <md-list-item type="text" headline="Notifications" supporting-text="Push, email, and SMS" leading-icon="notifications"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="text" headline="Privacy" supporting-text="Data and permissions" leading-icon="lock"></md-list-item>
          <md-divider inset-start></md-divider>
          <md-list-item type="text" headline="Account" supporting-text="Profile and security" leading-icon="person"></md-list-item>
        </md-list>
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Drag the bottom-right corner to see text truncation in action.
        </p>
        <div class="list-resp-vp list-resp-live">
          <md-list label="Messages">
            <md-list-item
              type="button"
              headline="Re: Project timeline update and milestone deliverables for Q3"
              supporting-text="Alex Chen · Hey, can we sync on the revised schedule before Friday's standup?"
              leading-icon="mail"
              trailing-icon="chevron_right"
            ></md-list-item>
            <md-divider inset-start></md-divider>
            <md-list-item
              type="button"
              headline="Invoice #4821"
              supporting-text="Accounting · Payment due in 5 days"
              leading-icon="receipt"
              trailing-icon="chevron_right"
            ></md-list-item>
          </md-list>
        </div>
      </section>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   RUNTIME RECONFIGURATION — prop @Watch handlers + MutationObserver
   ═══════════════════════════════════════════════════════════════════════════ */
export const DynamicReconfiguration: Story = {
  name: 'Dynamic reconfiguration (watchers + observer)',
  play: async ({ canvasElement, step }) => {
    const list = await getMdList(canvasElement);
    const el = list as HTMLMdListElement;
    const divider = list.querySelector(':scope > md-divider') as HTMLElement;

    await step('Baseline: a plain list is role="list" and interleaved dividers are hidden from AT', async () => {
      await waitFor(() => expect(list.getAttribute('role')).toBe('list'));
      // A list/listbox may only own listitems/options, so md-list marks dividers aria-hidden.
      await waitFor(() => expect(divider.getAttribute('aria-hidden')).toBe('true'));
    });

    await step('Setting selection-mode at runtime promotes the container to listbox + rows to option', async () => {
      el.selectionMode = 'single-select';
      await waitFor(() => expect(list.getAttribute('role')).toBe('listbox'));
      await waitFor(() => expect(rowsOf(list)[0].getAttribute('role')).toBe('option'));
      expect(list.getAttribute('aria-multiselectable')).toBe(null); // single-select, not multi
    });

    await step('role-override wins over selection mode and revives the divider separator semantics', async () => {
      el.roleOverride = 'menu';
      await waitFor(() => expect(list.getAttribute('role')).toBe('menu'));
      // A menu permits separators → md-list stops hiding the divider (else-branch of syncDividers).
      await waitFor(() => expect(divider.hasAttribute('aria-hidden')).toBe(false));
    });

    await step('Clearing role-override falls back to the listbox role + re-hides the divider', async () => {
      el.roleOverride = '';
      await waitFor(() => expect(list.getAttribute('role')).toBe('listbox'));
      await waitFor(() => expect(divider.getAttribute('aria-hidden')).toBe('true'));
    });

    await step('interaction-mode watch stamps data-interaction-mode onto every row', async () => {
      el.interactionMode = 'multi-action';
      await waitFor(() =>
        expect(rowsOf(list)[0].getAttribute('data-interaction-mode')).toBe('multi-action'),
      );
    });

    await step('reorderable watch flips the host into reorder mode', async () => {
      el.reorderable = true;
      await waitFor(() => expect(list.classList.contains('md-list--reorderable')).toBe(true));
    });

    await step('MutationObserver adopts a row appended at runtime — it inherits option semantics', async () => {
      const before = rowsOf(list).length;
      const added = document.createElement('md-list-item');
      added.setAttribute('headline', 'Appended row');
      list.appendChild(added);
      await waitFor(() => expect(rowsOf(list).length).toBe(before + 1));
      // The new row only becomes role="option" once md-list's observer propagates
      // selection-mode down to it — so this proves the observer ran.
      await waitFor(() => expect(added.getAttribute('role')).toBe('option'));
    });
  },
  render: () => html`
    ${caption(
      'Every list prop reacts at runtime. The play() function flips selection-mode, role-override, ' +
        'interaction-mode and reorderable, then appends a row — and the container re-syncs its ARIA role, ' +
        'divider semantics, per-row modes and roving focus with no re-authoring.',
    )}
    <md-list id="dynamic-reconfig-list" style="max-inline-size: 380px;" label="Reconfigurable list">
      <md-list-item headline="One" leading-icon="looks_one"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline="Two" leading-icon="looks_two"></md-list-item>
      <md-divider inset-start></md-divider>
      <md-list-item headline="Three" leading-icon="looks_3"></md-list-item>
    </md-list>
  `,
};

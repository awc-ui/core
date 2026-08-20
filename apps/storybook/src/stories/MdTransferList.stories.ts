import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type TlEl = HTMLElement & { value: string[] };
const getTl = async (canvasElement: HTMLElement): Promise<TlEl> => {
  const tl = canvasElement.querySelector('md-transfer-list') as TlEl;
  await waitFor(() => expect(tl.classList.contains('hydrated')).toBe(true));
  return tl;
};
const columnOf = (tl: TlEl, side: 'source' | 'target') =>
  tl.shadowRoot!.querySelector(`[part~="column-${side}"]`) as HTMLElement;
const rowsOf = (tl: TlEl, side: 'source' | 'target') =>
  columnOf(tl, side).querySelectorAll('li[role="option"]');
const rowByLabel = (tl: TlEl, side: 'source' | 'target', label: string) =>
  [...rowsOf(tl, side)].find(
    (r) => r.querySelector('.md-transfer-list__label')?.textContent === label,
  ) as HTMLElement;
const countOf = (tl: TlEl, side: 'source' | 'target') =>
  columnOf(tl, side).querySelector('.md-transfer-list__count')!.textContent?.trim();
const moverOf = (tl: TlEl, label: string) =>
  tl.shadowRoot!.querySelector(`md-icon-button[aria-label="${label}"]`) as HTMLElement;
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }),
  );
const searchOf = (tl: TlEl, side: 'source' | 'target') =>
  columnOf(tl, side).querySelector('[part~="search"]') as HTMLElement;
const setSearch = (tl: TlEl, side: 'source' | 'target', q: string) =>
  searchOf(tl, side).dispatchEvent(
    new CustomEvent('mdInput', { detail: q, bubbles: true, composed: true }),
  );
const selectAllOf = (tl: TlEl, side: 'source' | 'target') =>
  columnOf(tl, side).querySelector('.md-transfer-list__select-all') as HTMLElement;
const fireSelectAll = (tl: TlEl, side: 'source' | 'target') =>
  selectAllOf(tl, side).dispatchEvent(
    new CustomEvent('mdChange', { detail: true, bubbles: true, composed: true }),
  );

const roles = [
  { value: 'admin',  label: 'Administrator', description: 'Full system access' },
  { value: 'editor', label: 'Editor',        description: 'Can publish drafts' },
  { value: 'author', label: 'Author' },
  { value: 'guest',  label: 'Guest',         description: 'Read-only access' },
  { value: 'svc',    label: 'Service account', disabled: true },
];

const skills = Array.from({ length: 14 }, (_, i) => ({
  value: `s${i + 1}`,
  label: `Skill ${i + 1}`,
}));

const meta: Meta = {
  title: 'Selection/Transfer List',
  component: 'md-transfer-list',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    searchable: { control: 'boolean' },
    showSelectAll: { control: 'boolean' },
    singleStepOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    sourceTitle: { control: 'text' },
    targetTitle: { control: 'text' },
  },
  args: {
    searchable: true,
    showSelectAll: true,
    singleStepOnly: false,
    disabled: false,
    sourceTitle: 'Available',
    targetTitle: 'Assigned',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <md-transfer-list
      ?searchable=${args.searchable}
      ?show-select-all=${args.showSelectAll}
      ?single-step-only=${args.singleStepOnly}
      ?disabled=${args.disabled}
      source-title=${args.sourceTitle}
      target-title=${args.targetTitle}
      .items=${roles}
      .value=${['editor', 'guest']}
    ></md-transfer-list>
  `,
};

export const Basic: Story = {
  render: (_args, { globals }) => html`
    <md-transfer-list source-title=${t(globals.locale, 'transfer.available')} target-title=${t(globals.locale, 'transfer.assigned')} .items=${roles}></md-transfer-list>
  `,
  /** The core check → move → move-back flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('Clicking two source rows checks them and updates the count pill', async () => {
      // 'Service account' is disabled, so only 4 of the 5 rows are eligible.
      expect(countOf(tl, 'source')).toBe('0/4 selected');
      rowByLabel(tl, 'source', 'Administrator').click();
      rowByLabel(tl, 'source', 'Editor').click();
      await waitFor(() => {
        expect(rowByLabel(tl, 'source', 'Administrator').getAttribute('aria-selected')).toBe('true');
        expect(rowByLabel(tl, 'source', 'Editor').getAttribute('aria-selected')).toBe('true');
      });
      await waitFor(() => expect(countOf(tl, 'source')).toBe('2/4 selected'));
    });

    await step('The ">" mover transfers the checked rows to the target column', async () => {
      moverOf(tl, 'Move selected to target').click();
      await waitFor(() => expect(tl.value).toEqual(['admin', 'editor']));
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(2));
      expect(rowsOf(tl, 'source').length).toBe(3);
      // Checks reset after a move — nothing is pre-checked on either side.
      expect(countOf(tl, 'source')).toBe('0/2 selected');
      expect(countOf(tl, 'target')).toBe('0/2 selected');
    });

    await step('Keyboard: Space checks a target row, "<" moves it back', async () => {
      const editor = rowByLabel(tl, 'target', 'Editor');
      editor.focus();
      expect(tl.shadowRoot!.activeElement).toBe(editor);
      key(editor, ' ');
      await waitFor(() =>
        expect(rowByLabel(tl, 'target', 'Editor').getAttribute('aria-selected')).toBe('true'),
      );
      await waitFor(() => expect(countOf(tl, 'target')).toBe('1/2 selected'));
      moverOf(tl, 'Move selected to source').click();
      await waitFor(() => expect(tl.value).toEqual(['admin']));
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(1));
      expect(rowsOf(tl, 'source').length).toBe(4);
    });

    await step('Enter toggles a row, an unrelated key does not, and disabled rows resist', async () => {
      // Only 'admin' is on target now; source holds 4 rows (editor, author,
      // guest and the disabled svc → 3 eligible), starting all-unchecked.
      const author = rowByLabel(tl, 'source', 'Author');
      author.focus();
      key(author, 'Enter');
      await waitFor(() =>
        expect(rowByLabel(tl, 'source', 'Author').getAttribute('aria-selected')).toBe('true'),
      );
      await waitFor(() => expect(countOf(tl, 'source')).toBe('1/3 selected'));

      // A key the row doesn't handle (ArrowDown) leaves the check untouched.
      key(rowByLabel(tl, 'source', 'Author'), 'ArrowDown');
      await new Promise((r) => setTimeout(r, 60));
      expect(rowByLabel(tl, 'source', 'Author').getAttribute('aria-selected')).toBe('true');
      expect(countOf(tl, 'source')).toBe('1/3 selected');

      // Enter again un-checks it (the toggle path runs both ways).
      key(rowByLabel(tl, 'source', 'Author'), 'Enter');
      await waitFor(() =>
        expect(rowByLabel(tl, 'source', 'Author').getAttribute('aria-selected')).toBe('false'),
      );

      // Clicking the disabled 'Service account' row never checks it.
      const svc = rowByLabel(tl, 'source', 'Service account');
      svc.click();
      await new Promise((r) => setTimeout(r, 60));
      expect(svc.getAttribute('aria-selected')).toBe('false');
      expect(countOf(tl, 'source')).toBe('0/3 selected');
    });
  },
};

export const SingleStepOnly: Story = {
  render: (_args, { globals }) => html`
    <md-transfer-list single-step-only source-title=${t(globals.locale, 'transfer.skills')} target-title=${t(globals.locale, 'transfer.selected')} .items=${skills}></md-transfer-list>
  `,
  /** With only single-step movers, one item crosses per action — value, counts
   *  and the mdMove payload all track the single transfer. */
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('single-step-only drops the move-all (>>/<<) buttons', async () => {
      // Guard: the two "move all" movers must not exist in this variant.
      expect(moverOf(tl, 'Move all to target')).toBeNull();
      expect(moverOf(tl, 'Move all to source')).toBeNull();
      expect(moverOf(tl, 'Move selected to target')).not.toBeNull();
      // All 14 skills start on the source side, nothing chosen yet.
      expect(rowsOf(tl, 'source').length).toBe(14);
      expect(rowsOf(tl, 'target').length).toBe(0);
      expect(tl.value).toEqual([]);
      expect(countOf(tl, 'source')).toBe('0/14 selected');
    });

    await step('Check one skill, then ">" transfers exactly it (value + mdMove payload)', async () => {
      rowByLabel(tl, 'source', 'Skill 1').click();
      await waitFor(() =>
        expect(rowByLabel(tl, 'source', 'Skill 1').getAttribute('aria-selected')).toBe('true'),
      );
      await waitFor(() => expect(countOf(tl, 'source')).toBe('1/14 selected'));

      let moved: { direction: string; moved: string[]; target: string[] } | undefined;
      tl.addEventListener('mdMove', (e) => { moved = (e as CustomEvent).detail; }, { once: true });

      moverOf(tl, 'Move selected to target').click();

      await waitFor(() => expect(tl.value).toEqual(['s1']));
      // The emitted move describes the single crossing, not a bulk transfer.
      expect(moved).toEqual({ direction: 'right', moved: ['s1'], target: ['s1'] });
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(1));
      expect(rowsOf(tl, 'source').length).toBe(13);
      // Checks reset after a move — the source pill drops back to 0.
      expect(countOf(tl, 'source')).toBe('0/13 selected');
    });

    await step('The single-step "<" mover sends it back', async () => {
      rowByLabel(tl, 'target', 'Skill 1').click();
      await waitFor(() =>
        expect(rowByLabel(tl, 'target', 'Skill 1').getAttribute('aria-selected')).toBe('true'),
      );
      moverOf(tl, 'Move selected to source').click();
      await waitFor(() => expect(tl.value).toEqual([]));
      await waitFor(() => expect(rowsOf(tl, 'source').length).toBe(14));
      expect(rowsOf(tl, 'target').length).toBe(0);
    });
  },
};

export const Disabled: Story = {
  render: () => html`
    <md-transfer-list disabled .items=${roles} .value=${['editor']}></md-transfer-list>
  `,
  /** Guard: a disabled control neither checks rows nor transfers — the movers
   *  are disabled and clicking them mutates nothing and emits no events. */
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('Clicking a source row does not check it while disabled', async () => {
      const admin = rowByLabel(tl, 'source', 'Administrator');
      expect(admin.getAttribute('aria-selected')).toBe('false');
      admin.click();
      // toggleItem() bails while disabled — allow a flush, then confirm no change.
      await new Promise((r) => setTimeout(r, 60));
      expect(admin.getAttribute('aria-selected')).toBe('false');
      // Service account is disabled, so 3 of the 4 source rows are eligible.
      expect(countOf(tl, 'source')).toBe('0/3 selected');
    });

    await step('The movers are disabled and transfer nothing (no mdChange/mdMove)', async () => {
      const moveRight = moverOf(tl, 'Move selected to target');
      const moveLeft = moverOf(tl, 'Move selected to source');
      expect(moveRight.hasAttribute('disabled')).toBe(true);
      expect(moveLeft.hasAttribute('disabled')).toBe(true);

      let fired = false;
      tl.addEventListener('mdChange', () => { fired = true; });
      tl.addEventListener('mdMove', () => { fired = true; });

      moveRight.click();
      moveLeft.click();
      await new Promise((r) => setTimeout(r, 60));

      // Nothing crossed: target still holds only the pre-seeded 'editor'.
      expect(fired).toBe(false);
      expect(tl.value).toEqual(['editor']);
      expect(rowsOf(tl, 'target').length).toBe(1);
      expect(rowsOf(tl, 'source').length).toBe(4);
    });

    await step('Disabled: the scroll region stays keyboard-reachable and the host is aria-disabled', async () => {
      // Every row is tabindex=-1 while disabled, so the list itself takes
      // tabindex=0 to remain scrollable by keyboard.
      const list = columnOf(tl, 'source').querySelector('ul[role="listbox"]') as HTMLElement | null;
      expect(list).toBeTruthy();
      expect(list!.getAttribute('tabindex')).toBe('0');
      // The whole control advertises its disabled state on the host.
      expect(tl.getAttribute('aria-disabled')).toBe('true');
    });
  },
};

/**
 * Both lists are named `listbox`es (`aria-label` = column title,
 * `aria-multiselectable`) whose rows are the interactive options — the
 * checkbox visuals are decorative (`inert`), so there is no nested control.
 * Every affordance label is a prop, so the whole control localises.
 */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'Named multiselect listboxes with row-level toggling (Space/Enter), a tri-state select-all per column, localisable mover labels, and disabled rows exposed via `aria-disabled`. axe: 0 violations across every story, light + dark.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-transfer-list
      source-title=${t(globals.locale, 'transfer.available-roles')}
      target-title=${t(globals.locale, 'transfer.assigned-roles')}
      .items=${roles}
      .value=${['editor']}
    ></md-transfer-list>
    <details style="font: 13px/1.6 system-ui; opacity: 0.85; margin-top: 20px; max-inline-size: 620px;">
      <summary>Keyboard &amp; AT contract</summary>
      <ul style="line-height: 1.9;">
        <li><b>Tab</b> — walks each column: select-all checkbox → search field → every row, then the movers.</li>
        <li><b>Space / Enter</b> on a row — toggles its check; state is exposed as <code>aria-selected</code>.</li>
        <li>Each list is <code>role="listbox"</code> + <code>aria-multiselectable</code>, named by its column title.</li>
        <li>The row checkbox is decorative (<code>inert</code>) — the row itself is the option, so no nested interactive control.</li>
        <li>Select-all is a tri-state <code>md-checkbox</code> (checked / indeterminate) scoped to the <em>visible</em> (filtered) rows.</li>
        <li>Movers act on rows that are checked <em>and</em> visible; their names come from <code>move-right-label</code> etc. (localisable).</li>
        <li>Disabled rows: <code>aria-disabled</code>, unfocusable, never moved — even by "move all".</li>
        <li>Disabled control: lists stay keyboard-scrollable (<code>tabindex="0"</code> on the scroll region).</li>
      </ul>
    </details>
  `,
};

/** Fully mirrored + localised Arabic instance: layout flips via grid/logical
 *  properties, the mover chevrons mirror, and every label rides its prop. */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-transfer-list
        source-title="متاح"
        target-title="مُعيَّن"
        source-search-placeholder="ابحث في المتاح"
        target-search-placeholder="ابحث في المعيَّن"
        count-template="{checked} من {total} محدد"
        empty-icon="inbox"
        empty-text="لا توجد عناصر"
        move-right-label="نقل المحدد إلى المعيَّن"
        move-left-label="نقل المحدد إلى المتاح"
        move-all-right-label="نقل الكل إلى المعيَّن"
        move-all-left-label="نقل الكل إلى المتاح"
        .items=${[
          { value: 'admin', label: 'مدير النظام', description: 'صلاحيات كاملة' },
          { value: 'editor', label: 'محرِّر', description: 'يمكنه نشر المسودات' },
          { value: 'author', label: 'كاتب' },
          { value: 'guest', label: 'زائر', description: 'قراءة فقط' },
        ]}
        .value=${['editor']}
      ></md-transfer-list>
    </div>
  `,
};

/**
 * Below 640px the columns stack (source → movers → target) and the mover
 * chevrons rotate 90° — "move to target" now points down. The movers become
 * a horizontal row between the lists.
 */
export const Responsive: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: (_args, { globals }) => html`
    <md-transfer-list source-title=${t(globals.locale, 'transfer.available')} target-title=${t(globals.locale, 'transfer.assigned')} .items=${roles} .value=${['guest']}></md-transfer-list>
  `,
};

/** Japanese (LTR) instance — every text affordance is a prop. German lives in
 *  the Icon-customization story; Arabic (RTL) in the RTL story. */
export const Localization: Story = {
  render: () => html`
    <md-transfer-list
      source-title="利用可能"
      target-title="割り当て済み"
      source-search-placeholder="利用可能を検索"
      target-search-placeholder="割り当て済みを検索"
      count-template="{total}件中{checked}件選択"
      empty-icon="inbox"
      empty-text="項目がありません"
      move-right-label="選択した項目を割り当てる"
      move-left-label="選択した項目を戻す"
      move-all-right-label="すべて割り当てる"
      move-all-left-label="すべて戻す"
      .items=${[
        { value: 'admin', label: '管理者', description: 'システム全体へのアクセス' },
        { value: 'editor', label: '編集者', description: '下書きを公開できます' },
        { value: 'author', label: '執筆者' },
        { value: 'guest', label: 'ゲスト', description: '閲覧のみ' },
      ]}
      .value=${['author']}
    ></md-transfer-list>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: (_args, { globals }) => html`
    <md-transfer-list source-title=${t(globals.locale, 'transfer.available')} target-title=${t(globals.locale, 'transfer.assigned')} .items=${roles}></md-transfer-list>
  `,
};

/**
 * Every glyph and label is a prop: the four mover icons, the search leading
 * icon (`''` hides it), the empty-state icon + text, and the count-pill
 * template (`{checked}` / `{total}` placeholders) — so the control fully
 * localises and rebrands without CSS.
 */
export const IconCustomization: Story = {
  name: 'Icon customization',
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <div>
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          Custom mover + search + empty icons, count template
        </p>
        <md-transfer-list
          move-right-icon="arrow_forward"
          move-left-icon="arrow_back"
          move-all-right-icon="fast_forward"
          move-all-left-icon="fast_rewind"
          search-icon="filter_list"
          empty-icon="inbox"
          empty-text=${t(globals.locale, 'transfer.empty')}
          count-template=${t(globals.locale, 'transfer.count-picked')}
          source-title=${t(globals.locale, 'transfer.backlog')}
          target-title=${t(globals.locale, 'transfer.sprint')}
          .items=${roles}
        ></md-transfer-list>
      </div>
      <div>
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          No search icon (<code>search-icon=""</code>), localised German labels
        </p>
        <md-transfer-list
          search-icon=""
          empty-icon="folder_open"
          empty-text="Keine Einträge"
          count-template="{checked} von {total} ausgewählt"
          source-title="Verfügbar"
          target-title="Zugewiesen"
          source-search-placeholder="Verfügbare durchsuchen"
          target-search-placeholder="Zugewiesene durchsuchen"
          move-right-label="Auswahl zuweisen"
          move-left-label="Auswahl entfernen"
          move-all-right-label="Alle zuweisen"
          move-all-left-label="Alle entfernen"
          .items=${roles}
          .value=${['editor']}
        ></md-transfer-list>
      </div>
    </div>
  `,
};

/**
 * Sizing is fully configurable: `--md-transfer-list-width/height` (any CSS
 * length — `100%` fills the parent, the column cap tracks the height), the
 * `full-width` / `full-height` attribute sugar, and min/max variants.
 */
export const Sizing: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <div>
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          Fixed via vars — <code>--md-transfer-list-width: 720px; --md-transfer-list-height: 460px</code>
        </p>
        <md-transfer-list
          style="--md-transfer-list-width: 720px; --md-transfer-list-height: 460px;"
          .items=${skills}
          .value=${['s1']}
        ></md-transfer-list>
      </div>
      <div>
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          100% × 100% — <code>full-width full-height</code> inside a bounded 420px container
        </p>
        <div style="block-size: 420px; inline-size: 100%; max-inline-size: 900px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: 12px; padding: 12px; box-sizing: border-box;">
          <md-transfer-list full-width full-height .items=${skills} .value=${['s2', 's4']}></md-transfer-list>
        </div>
      </div>
    </div>
  `,
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .compact { --md-transfer-list-column-min-width: 200px; --md-transfer-list-column-max-block: 280px; }
      .branded { --md-transfer-list-container-color: color-mix(in srgb, var(--md-sys-color-primary) 6%, var(--md-sys-color-surface-container-low));
                 --md-transfer-list-header-color: color-mix(in srgb, var(--md-sys-color-primary) 12%, var(--md-sys-color-surface-container)); }
    </style>
    <div style="display:flex; flex-direction:column; gap:24px;">
      <md-transfer-list class="compact" .items=${roles}></md-transfer-list>
      <md-transfer-list class="branded" .items=${roles} .value=${['editor']}></md-transfer-list>
    </div>
  `,
};

/**
 * Search-driven filtering: typing narrows each list to matching rows (label
 * OR description), a no-match query collapses the column to its empty state,
 * and the tri-state select-all toggles every *visible eligible* row on/off.
 */
export const Filtering: Story = {
  render: () => html`
    <md-transfer-list source-title="Available" target-title="Assigned" .items=${roles}></md-transfer-list>
  `,
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('Typing a query filters the source to matching rows', async () => {
      // All 5 items start on source (svc disabled → 4 eligible).
      expect(rowsOf(tl, 'source').length).toBe(5);
      setSearch(tl, 'source', 'edi');
      // Only 'Editor' matches label.includes('edi').
      await waitFor(() => expect(rowsOf(tl, 'source').length).toBe(1));
      expect(rowByLabel(tl, 'source', 'Editor')).toBeTruthy();
      // The count pill re-scopes its total to the filtered eligible set.
      await waitFor(() => expect(countOf(tl, 'source')).toBe('0/1 selected'));
    });

    await step('A no-match query collapses the column to its empty state', async () => {
      setSearch(tl, 'source', 'zzzzz');
      await waitFor(() => expect(rowsOf(tl, 'source').length).toBe(0));
      expect(columnOf(tl, 'source').querySelector('[part~="empty"]')).toBeTruthy();
      // Clearing the query restores every row.
      setSearch(tl, 'source', '');
      await waitFor(() => expect(rowsOf(tl, 'source').length).toBe(5));
    });

    await step('Select-all checks every eligible visible row, then clears them', async () => {
      fireSelectAll(tl, 'source');
      // The disabled 'Service account' is excluded — 4 of 5 get checked.
      await waitFor(() => expect(countOf(tl, 'source')).toBe('4/4 selected'));
      expect(rowByLabel(tl, 'source', 'Administrator').getAttribute('aria-selected')).toBe('true');
      expect(rowByLabel(tl, 'source', 'Service account').getAttribute('aria-selected')).toBe('false');
      // Firing it again (now all-checked) takes the uncheck-all branch.
      fireSelectAll(tl, 'source');
      await waitFor(() => expect(countOf(tl, 'source')).toBe('0/4 selected'));
      expect(rowByLabel(tl, 'source', 'Administrator').getAttribute('aria-selected')).toBe('false');
    });

    await step('Checking some-but-not-all rows drives the select-all into its indeterminate state', async () => {
      // One of four eligible rows checked → the select-all checkbox is tri-state.
      rowByLabel(tl, 'source', 'Administrator').click();
      await waitFor(() => expect(countOf(tl, 'source')).toBe('1/4 selected'));
      await waitFor(() => {
        expect(selectAllOf(tl, 'source').hasAttribute('indeterminate')).toBe(true);
        expect(selectAllOf(tl, 'source').hasAttribute('checked')).toBe(false);
      });

      // Checking the remaining three flips it to fully checked (not indeterminate).
      rowByLabel(tl, 'source', 'Editor').click();
      rowByLabel(tl, 'source', 'Author').click();
      rowByLabel(tl, 'source', 'Guest').click();
      await waitFor(() => expect(countOf(tl, 'source')).toBe('4/4 selected'));
      await waitFor(() => {
        expect(selectAllOf(tl, 'source').hasAttribute('checked')).toBe(true);
        expect(selectAllOf(tl, 'source').hasAttribute('indeterminate')).toBe(false);
      });
    });
  },
};

/**
 * The bulk movers (>>/<<) and the imperative `moveSelectedRight()` /
 * `moveSelectedLeft()` API move eligible items across sides — the disabled
 * 'Service account' is never carried, even by "move all".
 */
export const BulkMove: Story = {
  render: () => html`
    <md-transfer-list source-title="Available" target-title="Assigned" .items=${roles}></md-transfer-list>
  `,
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('The imperative moveSelectedRight()/Left() API moves the checked row', async () => {
      let changed: string[] | undefined;
      tl.addEventListener('mdChange', (e) => { changed = (e as CustomEvent).detail; });

      rowByLabel(tl, 'source', 'Administrator').click();
      await waitFor(() =>
        expect(rowByLabel(tl, 'source', 'Administrator').getAttribute('aria-selected')).toBe('true'),
      );
      await (tl as unknown as { moveSelectedRight: () => Promise<void> }).moveSelectedRight();
      await waitFor(() => expect(tl.value).toEqual(['admin']));
      expect(changed).toEqual(['admin']);
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(1));

      // Send it back through the sibling method.
      rowByLabel(tl, 'target', 'Administrator').click();
      await waitFor(() =>
        expect(rowByLabel(tl, 'target', 'Administrator').getAttribute('aria-selected')).toBe('true'),
      );
      await (tl as unknown as { moveSelectedLeft: () => Promise<void> }).moveSelectedLeft();
      await waitFor(() => expect(tl.value).toEqual([]));
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(0));
    });

    await step('"Move all to target" carries every eligible item (disabled row stays)', async () => {
      let moved: { direction: string; moved: string[]; target: string[] } | undefined;
      tl.addEventListener('mdMove', (e) => { moved = (e as CustomEvent).detail; }, { once: true });

      moverOf(tl, 'Move all to target').click();
      await waitFor(() => expect(tl.value).toEqual(['admin', 'editor', 'author', 'guest']));
      expect(moved?.direction).toBe('right');
      expect(moved?.moved).toEqual(['admin', 'editor', 'author', 'guest']);
      // The disabled 'Service account' is left behind on the source side.
      await waitFor(() => expect(rowsOf(tl, 'source').length).toBe(1));
      expect(rowByLabel(tl, 'source', 'Service account')).toBeTruthy();
    });

    await step('"Move all to source" returns everything', async () => {
      moverOf(tl, 'Move all to source').click();
      await waitFor(() => expect(tl.value).toEqual([]));
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(0));
      expect(rowsOf(tl, 'source').length).toBe(5);
    });
  },
};

/**
 * With `searchable` off, `renderSearch()` returns null — neither column shows a
 * search field, yet checking rows and moving them still works end-to-end.
 */
export const NonSearchable: Story = {
  render: () => html`
    <md-transfer-list
      .searchable=${false}
      source-title="Available"
      target-title="Assigned"
      .items=${roles}
    ></md-transfer-list>
  `,
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('No search field renders on either column when searchable is off', async () => {
      await waitFor(() => expect((tl as unknown as { searchable: boolean }).searchable).toBe(false));
      expect(searchOf(tl, 'source')).toBeNull();
      expect(searchOf(tl, 'target')).toBeNull();
      // The lists themselves still render every item.
      expect(rowsOf(tl, 'source').length).toBe(5);
    });

    await step('Selection + move still work without a search field', async () => {
      rowByLabel(tl, 'source', 'Author').click();
      await waitFor(() =>
        expect(rowByLabel(tl, 'source', 'Author').getAttribute('aria-selected')).toBe('true'),
      );
      moverOf(tl, 'Move selected to target').click();
      await waitFor(() => expect(tl.value).toEqual(['author']));
      await waitFor(() => expect(rowsOf(tl, 'target').length).toBe(1));
    });
  },
};

/**
 * With no items at all, both columns fall back to their empty state — the
 * `empty-icon` glyph renders above the `empty-text`, and no option rows exist.
 */
export const EmptyState: Story = {
  render: () => html`
    <md-transfer-list
      source-title="Available"
      target-title="Assigned"
      empty-icon="inbox"
      empty-text="Nothing here"
      .items=${[]}
    ></md-transfer-list>
  `,
  play: async ({ canvasElement, step }) => {
    const tl = await getTl(canvasElement);

    await step('Both columns render the empty state with its icon and text', async () => {
      for (const side of ['source', 'target'] as const) {
        const empty = columnOf(tl, side).querySelector('[part~="empty"]');
        expect(empty).toBeTruthy();
        expect(empty!.getAttribute('role')).toBe('status');
        expect(
          columnOf(tl, side).querySelector('[part~="empty-icon"]')?.textContent?.trim(),
        ).toBe('inbox');
        expect(empty!.textContent).toContain('Nothing here');
        // No option rows exist when the list is empty.
        expect(rowsOf(tl, side).length).toBe(0);
      }
    });
  },
};

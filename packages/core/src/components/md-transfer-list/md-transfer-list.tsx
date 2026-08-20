import {
  Component,
  Host,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Watch,
  Method,
} from '@stencil/core';
import { parseJsonArrayProp } from '../../utils/json-prop';

export interface MdTransferListItem {
  /** Stable identifier. */
  value: string;
  /** Visible label. */
  label: string;
  /** Optional secondary description. */
  description?: string;
  /** Disable selection / movement of this item. */
  disabled?: boolean;
}

/**
 * `md-transfer-list` — Material Design 3 dual-list selector.
 *
 * Reference parity: https://mui.com/material-ui/react-transfer-list/.
 *
 * Two columns ("source" and "target") with header chips that show the
 * "{n} / {total} selected" count, a search field per side, paired
 * `md-checkbox` rows, and four `md-icon-button` movers in the centre
 * column. Selection inside each side is independent of which side a
 * card lives in; the move buttons only act on items that are both
 * selected AND visible (i.e. matching the search filter).
 *
 * MD3 Expressive: containers are `surface-container-low`, the headers
 * use the `secondary-container` tone for emphasis when the title slot
 * is populated, and movements run on the `motion-emphasized` curve.
 */
@Component({
  tag: 'md-transfer-list',
  styleUrl: 'md-transfer-list.css',
  shadow: true,
})
export class MdTransferList {
  @Element() el!: HTMLElement;

  /** All available items. */
  /**
   * The full item pool — both columns are derived from it.
   *
   * Accepts the array (property) or a **JSON string** (attribute), so a
   * plain-HTML page can declare its data inline instead of reaching for a
   * script. Malformed JSON degrades to an empty list with a console warning.
   */
  @Prop() items: MdTransferListItem[] | string = [];

  /** Values currently in the *target* (right) column. */
  @Prop({ mutable: true }) value: string[] = [];

  /** `items` as an array, whether it arrived as one or as a JSON attribute. */
  private get itemList(): MdTransferListItem[] {
    return parseJsonArrayProp<MdTransferListItem>(this.items, 'md-transfer-list', 'items');
  }

  /** Title for the source side. */
  @Prop({ attribute: 'source-title' }) sourceTitle: string = 'Choices';

  /** Title for the target side. */
  @Prop({ attribute: 'target-title' }) targetTitle: string = 'Chosen';

  /** Render search inputs above each list. */
  @Prop({ reflect: true }) searchable: boolean = true;

  /** Source-side search placeholder. */
  @Prop({ attribute: 'source-search-placeholder' }) sourceSearchPlaceholder: string = 'Search choices';

  /** Target-side search placeholder. */
  @Prop({ attribute: 'target-search-placeholder' }) targetSearchPlaceholder: string = 'Search chosen';

  /** Show the "select all" select-all checkbox in each header. */
  @Prop({ attribute: 'show-select-all', reflect: true }) showSelectAll: boolean = true;

  /** Material Symbols glyph for the search fields' leading icon ('' = none). */
  @Prop({ attribute: 'search-icon' }) searchIcon: string = 'search';

  /** Material Symbols glyph for the "move selected to target" (>) button. */
  @Prop({ attribute: 'move-right-icon' }) moveRightIcon: string = 'chevron_right';

  /** Material Symbols glyph for the "move selected to source" (<) button. */
  @Prop({ attribute: 'move-left-icon' }) moveLeftIcon: string = 'chevron_left';

  /** Material Symbols glyph for the "move all to target" (>>) button. */
  @Prop({ attribute: 'move-all-right-icon' }) moveAllRightIcon: string = 'keyboard_double_arrow_right';

  /** Material Symbols glyph for the "move all to source" (<<) button. */
  @Prop({ attribute: 'move-all-left-icon' }) moveAllLeftIcon: string = 'keyboard_double_arrow_left';

  /** Optional Material Symbols glyph shown above the empty-state text. */
  @Prop({ attribute: 'empty-icon' }) emptyIcon: string = '';

  /** Empty-state text (localisable). */
  @Prop({ attribute: 'empty-text' }) emptyText: string = 'No items';

  /**
   * Template for the header count pill (localisable). `{checked}` and
   * `{total}` are replaced with the live numbers.
   */
  @Prop({ attribute: 'count-template' }) countTemplate: string = '{checked}/{total} selected';

  /** Density scale: 0 (default), -1, -2, -3, -4. Passed to the search text field. */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Disable the entire control. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Show only the >/< buttons (drop >>/<< "move all"). */
  @Prop({ attribute: 'single-step-only', reflect: true }) singleStepOnly: boolean = false;

  /** Accessible label for the > button (localisable). NB: deliberately NOT an
   *  `aria-*`-prefixed attribute — a custom attribute in the aria namespace is
   *  invalid ARIA (axe aria-valid-attr). */
  @Prop({ attribute: 'move-right-label' }) moveRightLabel: string = 'Move selected to target';

  /** Accessible label for the < button (localisable). */
  @Prop({ attribute: 'move-left-label' }) moveLeftLabel: string = 'Move selected to source';

  /** Accessible label for the >> button (localisable). */
  @Prop({ attribute: 'move-all-right-label' }) moveAllRightLabel: string = 'Move all to target';

  /** Accessible label for the << button (localisable). */
  @Prop({ attribute: 'move-all-left-label' }) moveAllLeftLabel: string = 'Move all to source';

  /** Fires on every change to the target value. */
  @Event() mdChange: EventEmitter<string[]>;

  /** Fires after items are moved. detail describes the operation. */
  @Event() mdMove: EventEmitter<{
    direction: 'left' | 'right';
    moved: string[];
    target: string[];
  }>;

  @State() private sourceChecked: Set<string> = new Set();
  @State() private targetChecked: Set<string> = new Set();
  @State() private sourceQuery: string = '';
  @State() private targetQuery: string = '';

  @Watch('value')
  syncCheckedSets() {
    // Drop any checked items that no longer exist on the side they came from.
    const known = new Set(this.itemList.map((i) => i.value));
    this.sourceChecked = new Set(Array.from(this.sourceChecked).filter((v) => known.has(v)));
    this.targetChecked = new Set(Array.from(this.targetChecked).filter((v) => known.has(v)));
  }

  /** Move selected items to the target side. */
  @Method()
  async moveSelectedRight() {
    this.moveRight();
  }

  /** Move selected items to the source side. */
  @Method()
  async moveSelectedLeft() {
    this.moveLeft();
  }

  private get sourceItems(): MdTransferListItem[] {
    return this.itemList.filter((i) => !this.value.includes(i.value));
  }

  private get targetItems(): MdTransferListItem[] {
    return this.itemList.filter((i) => this.value.includes(i.value));
  }

  private filter(items: MdTransferListItem[], q: string) {
    if (!q) return items;
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        (i.description?.toLowerCase().includes(needle) ?? false),
    );
  }

  private getVisible(side: 'source' | 'target'): MdTransferListItem[] {
    return side === 'source'
      ? this.filter(this.sourceItems, this.sourceQuery)
      : this.filter(this.targetItems, this.targetQuery);
  }

  private getEligibleChecked(side: 'source' | 'target'): string[] {
    const visible = new Set(
      this.getVisible(side).filter((i) => !i.disabled).map((i) => i.value),
    );
    const set = side === 'source' ? this.sourceChecked : this.targetChecked;
    return Array.from(set).filter((v) => visible.has(v));
  }

  private commit(next: string[], direction: 'left' | 'right', moved: string[]) {
    this.value = next;
    this.mdChange.emit(next);
    this.mdMove.emit({ direction, moved, target: next });
  }

  private moveRight = () => {
    if (this.disabled) return;
    const moved = this.getEligibleChecked('source');
    if (moved.length === 0) return;
    const next = [...this.value, ...moved];
    this.sourceChecked = new Set();
    this.commit(next, 'right', moved);
  };

  private moveLeft = () => {
    if (this.disabled) return;
    const moved = this.getEligibleChecked('target');
    if (moved.length === 0) return;
    const next = this.value.filter((v) => !moved.includes(v));
    this.targetChecked = new Set();
    this.commit(next, 'left', moved);
  };

  private moveAllRight = () => {
    if (this.disabled) return;
    const moved = this.sourceItems.filter((i) => !i.disabled).map((i) => i.value);
    if (moved.length === 0) return;
    const next = [...this.value, ...moved];
    this.sourceChecked = new Set();
    this.commit(next, 'right', moved);
  };

  private moveAllLeft = () => {
    if (this.disabled) return;
    const moved = this.targetItems.filter((i) => !i.disabled).map((i) => i.value);
    if (moved.length === 0) return;
    const next = this.value.filter((v) => !moved.includes(v));
    this.targetChecked = new Set();
    this.commit(next, 'left', moved);
  };

  private toggleItem = (side: 'source' | 'target', val: string) => {
    if (this.disabled) return;
    const item = this.itemList.find((i) => i.value === val);
    if (item?.disabled) return;
    const set = new Set(side === 'source' ? this.sourceChecked : this.targetChecked);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    if (side === 'source') this.sourceChecked = set;
    else this.targetChecked = set;
  };

  private toggleSelectAll = (side: 'source' | 'target') => () => {
    if (this.disabled) return;
    const visible = this.getVisible(side).filter((i) => !i.disabled);
    const set = side === 'source' ? this.sourceChecked : this.targetChecked;
    const allChecked = visible.length > 0 && visible.every((i) => set.has(i.value));
    const next = new Set(set);
    if (allChecked) {
      visible.forEach((i) => next.delete(i.value));
    } else {
      visible.forEach((i) => next.add(i.value));
    }
    if (side === 'source') this.sourceChecked = next;
    else this.targetChecked = next;
  };

  private renderHeader(side: 'source' | 'target') {
    const title = side === 'source' ? this.sourceTitle : this.targetTitle;
    const visible = this.getVisible(side);
    const eligibleVisible = visible.filter((i) => !i.disabled);
    const set = side === 'source' ? this.sourceChecked : this.targetChecked;
    const numChecked = eligibleVisible.filter((i) => set.has(i.value)).length;
    const allChecked = eligibleVisible.length > 0 && numChecked === eligibleVisible.length;
    const someChecked = numChecked > 0 && !allChecked;

    return (
      // A <div>, not <header>: two <header>s at the top level of the shadow
      // root read as duplicate `banner` landmarks (axe landmark-unique).
      <div class="md-transfer-list__header" part="header">
        {this.showSelectAll && (
          <md-checkbox
            class="md-transfer-list__select-all"
            checked={allChecked}
            indeterminate={someChecked}
            disabled={this.disabled || eligibleVisible.length === 0}
            onMdChange={this.toggleSelectAll(side)}
            aria-label={`Select all ${title}`}
          />
        )}
        <div class="md-transfer-list__header-title" part="header-title">
          <span class="md-transfer-list__title">{title}</span>
          <span class="md-transfer-list__count" part="count">
            {this.countTemplate
              .replace('{checked}', String(numChecked))
              .replace('{total}', String(eligibleVisible.length))}
          </span>
        </div>
      </div>
    );
  }

  private renderSearch(side: 'source' | 'target') {
    if (!this.searchable) return null;
    const placeholder = side === 'source' ? this.sourceSearchPlaceholder : this.targetSearchPlaceholder;
    const value = side === 'source' ? this.sourceQuery : this.targetQuery;
    return (
      <md-text-field
        class="md-transfer-list__search"
        part="search"
        variant="outlined"
        density={this.density}
        label={placeholder}
        value={value}
        clearable="internal"
        disabled={this.disabled}
        onMdInput={(e: CustomEvent<string>) => {
          if (side === 'source') this.sourceQuery = e.detail ?? '';
          else this.targetQuery = e.detail ?? '';
        }}
      >
        {this.searchIcon && (
          <span slot="leading-icon" class="material-symbols-outlined" aria-hidden="true">
            {this.searchIcon}
          </span>
        )}
      </md-text-field>
    );
  }

  private renderList(side: 'source' | 'target') {
    const visible = this.getVisible(side);
    const set = side === 'source' ? this.sourceChecked : this.targetChecked;
    const title = side === 'source' ? this.sourceTitle : this.targetTitle;

    if (visible.length === 0) {
      return (
        <div class="md-transfer-list__empty" role="status" part="empty">
          {this.emptyIcon && (
            <span
              class="md-transfer-list__empty-icon material-symbols-outlined"
              part="empty-icon"
              aria-hidden="true"
            >
              {this.emptyIcon}
            </span>
          )}
          {this.emptyText}
        </div>
      );
    }

    return (
      <ul
        class="md-transfer-list__list"
        role="listbox"
        aria-multiselectable="true"
        aria-label={title}
        // Keep the scroll region keyboard-reachable when every option is
        // tabindex=-1 (disabled control) — axe scrollable-region-focusable.
        tabindex={this.disabled ? '0' : undefined}
        part="list"
      >
        {visible.map((item) => {
          const isChecked = set.has(item.value);
          return (
            <li
              class={{
                'md-transfer-list__item': true,
                'md-transfer-list__item--checked': isChecked,
                'md-transfer-list__item--disabled': !!item.disabled,
              }}
              role="option"
              aria-selected={String(isChecked)}
              aria-disabled={item.disabled ? 'true' : 'false'}
              key={item.value}
              onClick={() => this.toggleItem(side, item.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  this.toggleItem(side, item.value);
                }
              }}
              tabindex={item.disabled || this.disabled ? '-1' : '0'}
              part="item"
            >
              <md-ripple disabled={item.disabled || this.disabled}></md-ripple>
              {/* Decorative: the row IS the interactive option (click/Space on
                  the li toggles), so a focusable checkbox inside it would be a
                  nested interactive control. `inert` drops it from focus, AT,
                  and hit-testing — clicks fall through to the row. */}
              <md-checkbox
                checked={isChecked}
                disabled={item.disabled || this.disabled}
                inert
                aria-hidden="true"
              />
              <div class="md-transfer-list__labels">
                <span class="md-transfer-list__label">{item.label}</span>
                {item.description && (
                  <span class="md-transfer-list__description">{item.description}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  private renderColumn(side: 'source' | 'target') {
    return (
      <div class="md-transfer-list__column" part={`column column-${side}`}>
        {this.renderHeader(side)}
        {this.renderSearch(side)}
        {this.renderList(side)}
      </div>
    );
  }

  private renderControls() {
    const sourceCount = this.getEligibleChecked('source').length;
    const targetCount = this.getEligibleChecked('target').length;
    const sourceAvailable = this.sourceItems.some((i) => !i.disabled);
    const targetAvailable = this.targetItems.some((i) => !i.disabled);
    return (
      <div class="md-transfer-list__controls" part="controls">
        {/* Icons ride the `icon` prop — md-icon-button has no named "icon"
            slot (the old slotted spans never projected → empty buttons). */}
        {!this.singleStepOnly && (
          <md-icon-button
            variant="tonal"
            icon={this.moveAllRightIcon}
            disabled={this.disabled || !sourceAvailable}
            aria-label={this.moveAllRightLabel}
            onClick={this.moveAllRight}
          ></md-icon-button>
        )}
        <md-icon-button
          variant="filled"
          icon={this.moveRightIcon}
          disabled={this.disabled || sourceCount === 0}
          aria-label={this.moveRightLabel}
          onClick={this.moveRight}
        ></md-icon-button>
        <md-icon-button
          variant="filled"
          icon={this.moveLeftIcon}
          disabled={this.disabled || targetCount === 0}
          aria-label={this.moveLeftLabel}
          onClick={this.moveLeft}
        ></md-icon-button>
        {!this.singleStepOnly && (
          <md-icon-button
            variant="tonal"
            icon={this.moveAllLeftIcon}
            disabled={this.disabled || !targetAvailable}
            aria-label={this.moveAllLeftLabel}
            onClick={this.moveAllLeft}
          ></md-icon-button>
        )}
      </div>
    );
  }

  render() {
    return (
      <Host
        class={{
          'md-transfer-list': true,
          'md-transfer-list--disabled': this.disabled,
        }}
        role="group"
        aria-disabled={this.disabled ? 'true' : 'false'}
      >
        {this.renderColumn('source')}
        {this.renderControls()}
        {this.renderColumn('target')}
      </Host>
    );
  }
}

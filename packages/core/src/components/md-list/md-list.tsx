import {
  Component,
  Host,
  h,
  Prop,
  Element,
  Event,
  EventEmitter,
  Listen,
  Watch,
  State,
  Method,
} from '@stencil/core';

export type MdListStyle = 'standard' | 'segmented';
export type MdListSelectionMode = 'none' | 'single-select' | 'multi-select';
export type MdListInteractionMode = 'single-action' | 'multi-action';

/** Detail payload emitted by `md-list`'s `mdSelect` event. */
export type MdListSelectDetail = {
  /** Top-level row index in the list (parent index for expanded-content children). */
  index: number;
  value: string;
  selected: boolean;
  item: HTMLMdListItemElement;
  /** Index of the selected child within the parent's `expanded-content` slot. */
  childIndex?: number;
  /** Whether the expandable parent row is open when a child is selected. */
  expanded?: boolean;
};

/**
 * Whether `el` holds focus, counting focus inside its shadow tree — the
 * portable equivalent of `:focus-within`.
 *
 * Focus is read from the element's own root (so a row inside a shadow tree is
 * resolved against that tree, not the document), then walked outward through
 * parents and shadow HOSTS until `el` is reached or the walk runs out.
 */
function containsFocus(el: Element): boolean {
  let node = (el.getRootNode() as Document | ShadowRoot).activeElement as Element | null;
  while (node) {
    if (node === el) return true;
    // Step out of a shadow tree via its host, otherwise up the parent chain.
    node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null);
  }
  return false;
}

@Component({ tag: 'md-list', styleUrl: 'md-list.css', shadow: true })
export class MdList {
  @Element() el!: HTMLElement;

  /**
   * Visual style of the list.
   *
   * - `standard` (default, M3 Expressive): rows share a single rounded
   *   chassis with **no gap** between them. The first row rounds its
   *   top corners, the last rounds its bottom corners, and middle rows
   *   are square so the stack reads as one continuous shape — the M3
   *   "connected" pattern. Best for settings panels, option groups,
   *   and iOS-style sectioned tables. To add hairline separators
   *   between rows, interleave `<md-divider>` elements.
   * - `segmented` (M3 Expressive): rows are individually rounded "tiles"
   *   separated by a small gap. Each tile rounds all four corners. Best
   *   for action sets, quick-action menus, and card-like sections where
   *   each row should read as its own affordance.
   */
  @Prop({ attribute: 'list-style' }) listStyle: MdListStyle = 'standard';

  /**
   * Selection coordination across child rows.
   *
   * - `none` (default): each row stands alone and the container is always
   *   `role="list"` (rows are `listitem`s). Interactive rows (`type="button"` /
   *   `type="link"`) expose their widget role on an inner primary element, so
   *   the list validly owns only `listitem`s while still providing the same
   *   roving-tabindex + arrow-key navigation. `type="text"` rows stay
   *   non-focusable.
   * - `single-select`: the container behaves as `role="listbox"`, items
   *   become `role="option"`, and exactly one item carries `aria-selected`.
   * - `multi-select`: same as above plus `aria-multiselectable="true"`.
   *
   * Switching to a selection mode also auto-promotes plain `type="text"`
   * rows to focusable so users can pick from a list of label-only rows
   * without authoring extra props.
   */
  @Prop({ attribute: 'selection-mode' }) selectionMode: MdListSelectionMode = 'none';

  /**
   * Row interaction pattern for the whole list. A list uses exactly one
   * interaction mode at a time (per the M3 Lists spec).
   *
   * - `single-action` (default): each row is one tappable area — leading
   *   icon + label activate together. Use `type="button"` (or selection
   *   mode) on items.
   * - `multi-action`: rows expose a primary action (the row body) plus
   *   optional secondary actions in `slot="trailing"` (e.g. `md-icon-button`).
   *   Clicks on trailing controls do not activate the primary row action;
   *   each secondary control keeps its own focus stop and keyboard behavior.
   */
  @Prop({ attribute: 'interaction-mode' }) interactionMode: MdListInteractionMode = 'single-action';

  /**
   * Enable drag-to-reorder. Each row renders a trailing drag handle (grab it
   * to drag the row to a new position); rows can also be moved with
   * `Alt + ArrowUp / ArrowDown` while focused. On drop the list reorders its
   * children in the DOM and emits {@link mdReorder}. Disabled rows can't be
   * picked up. Works alongside `single-action` / `multi-action` and selection
   * modes.
   */
  @Prop({ reflect: true }) reorderable: boolean = false;

  /** Optional aria-label for the container. */
  @Prop() label: string = '';

  /** Optional aria-labelledby for the container. */
  @Prop() labelledby: string = '';

  /**
   * Override the auto-computed ARIA role. Useful when wiring the list
   * into a wider widget pattern (e.g. `role="menu"` for a dropdown).
   * Leave empty to use the role implied by `selectionMode`.
   */
  @Prop({ attribute: 'role-override' }) roleOverride: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emitted when selection changes via user input (click / Enter / Space). */
  @Event() mdSelect: EventEmitter<MdListSelectDetail>;

  /** Emitted whenever roving focus lands on a different row. */
  @Event() mdActivate: EventEmitter<{ index: number; item: HTMLMdListItemElement }>;

  /**
   * Emitted after a drag (or keyboard) reorder completes.
   *
   * - `from` / `to`: the moved row's old and new positions (item indices,
   *   ignoring non-item children like dividers).
   * - `order`: the new order expressed as the original (as-authored) indices,
   *   so `order[newPosition] === originalPosition`. Use it to reorder a
   *   backing data array in one pass.
   */
  @Event() mdReorder: EventEmitter<{ from: number; to: number; order: number[] }>;

  @State() private activeIndex = 0;

  /**
   * Geometry of the drop-target placeholder shown in the dragged row's
   * vacated slot during a pointer reorder. `null` when no drag is active.
   * `top` is the placeholder's block-start offset from the list's padding
   * box; `height` matches the lifted row. Tracking the live target index
   * keeps the ghost slot under the insertion point as the user drags.
   */
  @State() private dropPlaceholder: { top: number; height: number } | null = null;

  private typeaheadBuffer = '';
  private typeaheadTimer: number | null = null;
  private childObserver: MutationObserver | null = null;

  /** As-authored item order, captured once at load, for `mdReorder.order`. */
  private originalOrder: HTMLMdListItemElement[] = [];

  /** Live pointer-drag bookkeeping; null when no drag is in progress. */
  private dragState: {
    item: HTMLMdListItemElement;
    pointerId: number;
    startClientY: number;
    rects: { item: HTMLMdListItemElement; top: number; height: number; center: number }[];
    fromIndex: number;
    targetIndex: number;
    rowGap: number;
    /** List padding-box block-start in client coords, captured at drag start. */
    listTop: number;
  } | null = null;

  private get items(): HTMLMdListItemElement[] {
    return Array.from(this.el.children).filter(
      el => el.tagName === 'MD-LIST-ITEM',
    ) as HTMLMdListItemElement[];
  }

  private get focusableItems(): HTMLMdListItemElement[] {
    return this.items.filter(i => this.isItemFocusable(i));
  }

  /**
   * True when any direct row is an `expandable` disclosure. Such a row is a
   * collapsible *group* whose selectable rows live in a per-row nested listbox
   * (rendered by `md-list-item`), so it can't be a flat `option`/`group` child
   * of a top-level listbox. When present in a selection mode the container
   * therefore uses `role="list"` (its rows are `listitem`s) and defers the
   * option semantics to those nested listboxes — see {@link effectiveRole}.
   */
  private hasExpandableRows(): boolean {
    return this.items.some(item => item.expandable || item.hasAttribute('expandable'));
  }

  /**
   * ARIA container role implied by props + child composition, in priority order:
   * - `role-override` wins outright (author is wiring a wider pattern, e.g.
   *   `menu`; child rows adapt via {@link syncContainerRole}).
   * - a selection mode → `listbox` (rows are `option`s) — UNLESS the list holds
   *   expandable rows, in which case it degrades to `list` (see
   *   {@link hasExpandableRows}).
   * - otherwise → `list`.
   *
   * A non-selection list is ALWAYS `role="list"`. Every row's host is a
   * structural `listitem`; interactive rows (`type="button"` / `type="link"`)
   * expose their widget role on an inner primary element inside the row (see
   * `md-list-item`), so the container validly owns only `listitem`s regardless
   * of interaction mode, and interleaved `md-divider`s are decorative
   * (`aria-hidden`). This replaces the earlier `hasInteractiveRows() → toolbar`
   * promotion, which made a `toolbar` illegally own the static rows' `listitem`s
   * (axe `aria-required-parent`) and let a `role="button"` host contain trailing
   * focusables (axe `nested-interactive`).
   */
  private get effectiveRole(): string {
    if (this.roleOverride) return this.roleOverride;
    if (this.selectionMode !== 'none') {
      return this.hasExpandableRows() ? 'list' : 'listbox';
    }
    return 'list';
  }

  /** Direct-child `md-divider` rows interleaved between items. */
  private get childDividers(): HTMLElement[] {
    return Array.from(this.el.children).filter(
      el => el.tagName === 'MD-DIVIDER',
    ) as HTMLElement[];
  }

  /**
   * A `list` / `listbox` container may only own `listitem`s / `option`s (plus
   * `group`s); a `separator` is not a permitted owned child, so interleaved
   * `md-divider` rows are purely decorative there and must be removed from the
   * accessibility tree. `aria-hidden` (rather than overriding `role`) is used so
   * `md-divider`'s own shadow `role="separator"` is never fought over on a
   * re-render, and the hairline stays visually present. In separator-permitting
   * containers (a `role-override` such as `menu` or `toolbar`) the dividers keep
   * their native separator semantics.
   */
  private syncDividers() {
    const role = this.effectiveRole;
    const presentational = role === 'list' || role === 'listbox';
    this.childDividers.forEach(divider => {
      if (presentational) divider.setAttribute('aria-hidden', 'true');
      else divider.removeAttribute('aria-hidden');
    });
  }

  private isItemFocusable(item: HTMLMdListItemElement): boolean {
    if (item.disabled) return false;
    if (this.selectionMode !== 'none') return true;
    if (this.reorderable) return true;
    return item.type !== 'text';
  }

  componentDidLoad() {
    this.syncSelectionMode();
    this.syncInteractionMode();
    this.syncReorderable();
    this.syncContainerRole();
    this.syncDividers();
    this.originalOrder = [...this.items];
    this.refreshRovingTabindex(this.findInitialActiveIndex(), false);
    this.el.addEventListener('mdItemSelect', this.handleMdItemSelect);

    if (typeof MutationObserver !== 'undefined') {
      this.childObserver = new MutationObserver(records => {
        const childListChanged = records.some(r => r.type === 'childList');
        if (childListChanged) {
          this.syncSelectionMode();
          this.syncInteractionMode();
          this.syncReorderable();
          this.syncContainerRole();
          this.syncDividers();
          /* Adopt any newly-added rows into the as-authored baseline so their
             `mdReorder.order` index isn't -1. Existing rows keep their slot. */
          this.items.forEach(item => {
            if (!this.originalOrder.includes(item)) this.originalOrder.push(item);
          });
          this.refreshRovingTabindex(this.activeIndex, false);
        }
      });
      this.childObserver.observe(this.el, { childList: true });
    }
  }

  disconnectedCallback() {
    this.el.removeEventListener('mdItemSelect', this.handleMdItemSelect);
    this.childObserver?.disconnect();
    this.childObserver = null;
    if (this.typeaheadTimer !== null) {
      window.clearTimeout(this.typeaheadTimer);
      this.typeaheadTimer = null;
    }
    if (this.dragState) {
      this.el.removeEventListener('pointermove', this.onDragMove);
      this.el.removeEventListener('pointerup', this.onDragEnd);
      this.el.removeEventListener('pointercancel', this.onDragEnd);
      this.dragState = null;
      this.dropPlaceholder = null;
    }
  }

  @Watch('selectionMode')
  onSelectionModeChange() {
    this.syncSelectionMode();
    this.syncDividers();
    this.refreshRovingTabindex(this.activeIndex, false);
  }

  @Watch('interactionMode')
  onInteractionModeChange() {
    this.syncInteractionMode();
  }

  @Watch('reorderable')
  onReorderableChange() {
    this.syncReorderable();
    this.refreshRovingTabindex(this.activeIndex, false);
  }

  @Watch('roleOverride')
  onRoleOverrideChange() {
    this.syncContainerRole();
    this.syncDividers();
  }

  private syncReorderable() {
    const on = this.reorderable;
    this.items.forEach(item => {
      item.reorderable = on;
    });
  }

  /**
   * Propagate the resolved container role to each direct row so it can adapt.
   * Only a `menu` / `menubar` container (via `role-override`) changes anything:
   * interactive rows then render `role="menuitem"` on their inner primary and
   * `role="none"` on the host, so the menu validly owns the menuitem (a
   * `listitem` under a `menu` fails axe `aria-required-parent`; a `menu` needs
   * `menuitem` children). For a plain `list` / `listbox` the default roles apply.
   * Expanded-content children are intentionally NOT addressed here — they are
   * owned by their per-row expanded panel (a `list`), not the top container.
   */
  private syncContainerRole() {
    const role = this.effectiveRole;
    this.items.forEach(item => {
      item.containerRole = role;
    });
  }

  private syncInteractionMode() {
    const mode = this.interactionMode;
    this.items.forEach(item => {
      item.interactionMode = mode;
      if (mode === 'single-action') {
        item.removeAttribute('data-interaction-mode');
      } else {
        item.setAttribute('data-interaction-mode', mode);
      }
    });
  }

  private syncSelectionMode() {
    const mode = this.selectionMode;
    const applyMode = (item: HTMLMdListItemElement) => {
      /* Property assignment is the primary path — it triggers Stencil
         reactivity even when MutationObserver is unavailable (jsdom). */
      item.selectionMode = mode;
      /* The data-attribute is kept for legacy authoring scenarios where
         someone hand-rolls the item outside of an `md-list`. */
      if (mode === 'none') {
        item.removeAttribute('data-selection-mode');
      } else {
        item.setAttribute('data-selection-mode', mode);
      }
      /* Expansion-list child rows live in `expanded-content`, not as direct
         list children — thread selection mode through so they can highlight.
         Disclosure triggers themselves never carry selection state. */
      if (item.expandable) {
        if (item.selected) item.selected = false;
        Array.from(item.children).forEach(child => {
          if (child.tagName === 'MD-LIST-ITEM' && child.getAttribute('slot') === 'expanded-content') {
            applyMode(child as HTMLMdListItemElement);
          }
        });
      }
    };
    this.items.forEach(applyMode);
  }

  private findInitialActiveIndex(): number {
    const items = this.items;
    if (items.length === 0) return 0;
    const selected = items.findIndex(
      i => i.selected && !i.expandable && this.isItemFocusable(i),
    );
    if (selected >= 0) return selected;
    const focusable = items.findIndex(i => this.isItemFocusable(i));
    return focusable >= 0 ? focusable : 0;
  }

  private refreshRovingTabindex(targetIndex: number, emit: boolean, showRovingFocus = false) {
    const items = this.items;
    const focusable = this.focusableItems;
    if (items.length === 0) return;

    if (focusable.length === 0) {
      items.forEach(i => {
        i.tabbable = false;
        i.rovingFocusVisible = false;
      });
      return;
    }

    let actual = targetIndex;
    if (!items[actual] || !this.isItemFocusable(items[actual])) {
      actual = items.indexOf(focusable[0]);
    }
    this.activeIndex = actual;

    items.forEach((item, i) => {
      item.tabbable = i === actual;
      item.rovingFocusVisible = showRovingFocus && i === actual;
    });

    if (emit) {
      this.mdActivate.emit({ index: actual, item: items[actual] });
    }
  }

  @Listen('mdItemClick')
  onItemClick(event: CustomEvent<{ index: number; selected: boolean }>) {
    const detail = event.detail;
    const items = this.items;
    const clickedItem = items[detail.index];
    if (!clickedItem || clickedItem.expandable) return;
    this.activateItem(detail.index, true);
  }

  /**
   * Expanded-content child rows coordinate selection on the expandable parent;
   * they bubble `mdItemSelect` so this list can emit `mdSelect`.
   */
  private handleMdItemSelect = (event: Event) => {
    this.onExpandedItemSelect(
      event as CustomEvent<{
        index: number;
        value: string;
        selected: boolean;
        item: HTMLMdListItemElement;
      }>,
    );
  };

  onExpandedItemSelect(
    event: CustomEvent<{
      index: number;
      value: string;
      selected: boolean;
      item: HTMLMdListItemElement;
    }>,
  ) {
    if (this.selectionMode === 'none') return;

    const parentItem = this.findExpandableParentFromEvent(event);
    if (!parentItem) return;

    const parentIndex = this.items.indexOf(parentItem);
    if (parentIndex < 0) return;

    this.mdSelect.emit({
      index: parentIndex,
      childIndex: event.detail.index,
      expanded: parentItem.expanded,
      value: event.detail.value,
      selected: event.detail.selected,
      item: event.detail.item,
    });
  }

  @Listen('mdRequestActivation')
  onRequestActivation(event: Event) {
    const target = event.composedPath().find(el => {
      return (el as HTMLElement)?.tagName === 'MD-LIST-ITEM';
    }) as HTMLMdListItemElement | undefined;
    if (!target) return;
    const idx = this.items.indexOf(target);
    if (idx >= 0 && idx !== this.activeIndex) {
      this.refreshRovingTabindex(idx, true);
    }
  }

  /* ── Drag-to-reorder ──────────────────────────────────────────────────
     Pointer-based, vertical-only reorder (the MD3 list pattern). The drag
     starts from a row's trailing drag handle (`data-list-drag-handle`),
     lifts that row with the `.md-list-item--dragged` affordance, follows the
     pointer with a translateY transform (the row stays IN FLOW so it keeps
     its full width / rounded shape), and shifts the rows it passes over.
     On drop the row is moved in the DOM and `mdReorder` is emitted. */

  @Listen('pointerdown')
  onHostPointerDown(event: PointerEvent) {
    if (!this.reorderable || event.button !== 0) return;

    const path = event.composedPath() as Array<HTMLElement & { dataset?: DOMStringMap }>;
    const onHandle = path.some(n => n?.dataset?.listDragHandle === 'true');
    if (!onHandle) return;

    const item = path.find(
      n => (n as HTMLElement)?.tagName === 'MD-LIST-ITEM',
    ) as HTMLMdListItemElement | undefined;
    if (!item || item.disabled) return;

    // Stop the press from turning into a click/activation or text selection.
    event.preventDefault();
    this.startDrag(item, event);
  }

  private startDrag(item: HTMLMdListItemElement, event: PointerEvent) {
    const items = this.items;
    const fromIndex = items.indexOf(item);
    if (fromIndex < 0) return;

    // Snapshot geometry up-front so reorder math is independent of the live
    // (shifting) layout. `rowGap` is the visual distance between row tops.
    const rects = items.map(it => {
      const r = it.getBoundingClientRect();
      return { item: it, top: r.top, height: r.height, center: r.top + r.height / 2 };
    });
    const rowGap =
      rects.length > 1 ? rects[1].top - rects[0].top : rects[0]?.height ?? 0;

    // Border box == padding box block-start (the list carries no border), so
    // this is the reference for the placeholder's absolute block offset.
    const listTop = this.el.getBoundingClientRect().top;

    this.dragState = {
      item,
      pointerId: event.pointerId,
      startClientY: event.clientY,
      rects,
      fromIndex,
      targetIndex: fromIndex,
      rowGap,
      listTop,
    };

    // Open the ghost slot in the lifted row's original position. It tracks the
    // live target as the drag crosses sibling centers (see onDragMove).
    this.dropPlaceholder = {
      top: rects[fromIndex].top - listTop,
      height: rects[fromIndex].height,
    };

    item.classList.add('md-list-item--dragged');
    try {
      this.el.setPointerCapture(event.pointerId);
    } catch {
      /* setPointerCapture can throw if the pointer is already gone */
    }
    this.el.addEventListener('pointermove', this.onDragMove);
    this.el.addEventListener('pointerup', this.onDragEnd);
    this.el.addEventListener('pointercancel', this.onDragEnd);
  }

  private onDragMove = (event: PointerEvent) => {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    const delta = event.clientY - state.startClientY;
    // The dragged row follows the pointer vertically (stays in flow, full width).
    state.item.style.transform = `translateY(${delta}px)`;

    // Where is the dragged row's center now?
    const draggedRect = state.rects[state.fromIndex];
    const draggedCenter = draggedRect.center + delta;

    // Target = how many resting centers the dragged center has crossed.
    let targetIndex = state.fromIndex;
    for (let i = 0; i < state.rects.length; i++) {
      if (i === state.fromIndex) continue;
      const r = state.rects[i];
      if (i < state.fromIndex && draggedCenter < r.center) targetIndex = Math.min(targetIndex, i);
      if (i > state.fromIndex && draggedCenter > r.center) targetIndex = Math.max(targetIndex, i);
    }

    if (targetIndex !== state.targetIndex) {
      state.targetIndex = targetIndex;
      this.applySiblingShifts();
      // The vacated slot opens at the resting top of the row originally at the
      // target index (the siblings between have shifted one row-step to fill
      // the old gap), so the placeholder follows the insertion point.
      this.dropPlaceholder = {
        top: state.rects[targetIndex].top - state.listTop,
        height: state.rects[state.fromIndex].height,
      };
    }
  };

  private applySiblingShifts() {
    const state = this.dragState;
    if (!state) return;
    const { fromIndex, targetIndex, rowGap, rects } = state;

    rects.forEach((r, i) => {
      if (r.item === state.item) return;
      let shift = 0;
      // Rows between the old and new slot slide one row-step to fill the gap.
      if (fromIndex < targetIndex && i > fromIndex && i <= targetIndex) shift = -rowGap;
      else if (fromIndex > targetIndex && i < fromIndex && i >= targetIndex) shift = rowGap;
      r.item.classList.add('md-list-item--shifting');
      r.item.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }

  private onDragEnd = (event: PointerEvent) => {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    this.el.removeEventListener('pointermove', this.onDragMove);
    this.el.removeEventListener('pointerup', this.onDragEnd);
    this.el.removeEventListener('pointercancel', this.onDragEnd);
    try {
      this.el.releasePointerCapture(state.pointerId);
    } catch {
      /* already released */
    }

    // Clear all transient transforms / classes.
    state.rects.forEach(r => {
      r.item.classList.remove('md-list-item--shifting');
      r.item.style.transform = '';
    });
    state.item.classList.remove('md-list-item--dragged');
    // Drop the ghost slot in the same tick the row settles so there is no
    // leftover placeholder and no flash between drop and re-layout.
    this.dropPlaceholder = null;

    const { fromIndex, targetIndex } = state;
    this.dragState = null;

    if (targetIndex !== fromIndex) {
      this.moveItem(fromIndex, targetIndex);
      this.emitReorder(fromIndex, targetIndex);
    }
  };

  /** Keyboard reorder request bubbled from a row (Alt + ArrowUp/Down). */
  @Listen('mdItemRequestReorder')
  onItemRequestReorder(event: CustomEvent<{ direction: 'up' | 'down'; from: number }>) {
    if (!this.reorderable) return;
    event.stopPropagation();
    const { direction, from } = event.detail;
    const items = this.items;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= items.length) return;
    if (items[from]?.disabled) return;

    this.moveItem(from, to);
    this.emitReorder(from, to);

    // Keep focus on the moved row at its new position.
    const moved = this.items[to];
    if (moved) {
      this.refreshRovingTabindex(to, false, true);
      requestAnimationFrame(() => this.focusListItem(moved));
    }
  }

  private moveItem(from: number, to: number) {
    const items = this.items;
    const moving = items[from];
    const reference = items[to];
    if (!moving || !reference) return;

    /* Re-slot via insertBefore on the shared parent (works in jsdom/mock-doc
       where Element.after/before are unavailable). Moving DOWN lands the row
       just after the target item (before whatever follows it — typically a
       divider); moving UP lands it just before the target. Interleaved
       dividers stay put and keep separating positions. */
    if (from < to) {
      this.el.insertBefore(moving, reference.nextSibling);
    } else {
      this.el.insertBefore(moving, reference);
    }
  }

  private emitReorder(from: number, to: number) {
    const order = this.items.map(it => this.originalOrder.indexOf(it));
    this.mdReorder.emit({ from, to, order });
  }

  @Listen('keydown')
  handleKeyDown(event: KeyboardEvent) {
    // md-search owns arrow navigation for slotted result lists (input ↔ rows,
    // one step per key). Handling here as well would advance roving focus
    // twice per keystroke (e.g. first → last with three items).
    if (this.el.closest('md-search')) return;

    // Alt+Arrow is reserved for keyboard reorder (the item emits
    // mdItemRequestReorder, handled in onItemRequestReorder). Don't also
    // advance roving focus on the same keystroke.
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return;

    const focusable = this.focusableItems;
    if (focusable.length === 0) return;

    const items = this.items;
    /* Which row holds focus — on the host itself (option / reorderable rows) or
       on the inner primary element inside its shadow tree (button / link /
       menuitem rows), which is why a plain `:focus` will not do.

       Computed by walking the active element out through its shadow hosts
       rather than with `:focus-within`: that pseudo-class is not parseable by
       every selector engine (mock-doc throws "unsupported pseudo" on it, which
       made this handler die and took ALL keyboard navigation with it), and a
       throw from a keydown handler is a bad failure mode for a nav path. */
    const activeEl = items.find(i => containsFocus(i));
    const currentIdx = activeEl ? focusable.indexOf(activeEl) : -1;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = currentIdx < focusable.length - 1 ? currentIdx + 1 : 0;
        this.focusItem(focusable[next]);
        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : focusable.length - 1;
        this.focusItem(focusable[prev]);
        return;
      }
      case 'Home': {
        event.preventDefault();
        this.focusItem(focusable[0]);
        return;
      }
      case 'End': {
        event.preventDefault();
        this.focusItem(focusable[focusable.length - 1]);
        return;
      }
    }

    // Typeahead: jump to the first focusable item whose headline / text
    // starts with the typed buffer. Buffer clears after 500ms of inactivity.
    if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      this.handleTypeahead(event.key.toLowerCase());
    }
  }

  private handleTypeahead(char: string) {
    this.typeaheadBuffer += char;
    if (this.typeaheadTimer !== null) {
      window.clearTimeout(this.typeaheadTimer);
    }
    this.typeaheadTimer = window.setTimeout(() => {
      this.typeaheadBuffer = '';
      this.typeaheadTimer = null;
    }, 500);

    const focusable = this.focusableItems;
    const buffer = this.typeaheadBuffer;
    const match = focusable.find(item => {
      const headline = (item.headline || item.textContent || '').trim().toLowerCase();
      return headline.startsWith(buffer);
    });
    if (match) {
      this.focusItem(match);
    }
  }

  /**
   * Programmatic focus with a visible ring. Routed through the row's
   * `setFocus()` @Method (NOT native `.focus()`): setFocus targets the correct
   * element — the inner primary for button/link/menuitem rows, the host for
   * option/reorderable rows — AND ensures it is focusable *now*, so focus can't
   * be dropped to `<body>` when the roving `tabindex` render hasn't flushed yet.
   */
  private focusListItem(item: HTMLMdListItemElement) {
    void item.setFocus({ focusVisible: true, preventScroll: true } as FocusOptions);
  }

  private focusItem(item: HTMLMdListItemElement) {
    if (!item) return;
    const idx = this.items.indexOf(item);
    if (idx < 0) return;
    this.refreshRovingTabindex(idx, true, true);
    /* Let md-list-item re-render tabbable → tabindex before focus so the
       roving target is the page's next tab stop, not a stale tabindex=-1 row. */
    requestAnimationFrame(() => this.focusListItem(item));
  }

  /** Clear programmatic roving-focus chrome when focus leaves the list. */
  @Listen('focusout')
  onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && this.el.contains(next)) return;
    this.items.forEach(item => {
      item.rovingFocusVisible = false;
    });
  }

  /** Resolve the expandable parent row that emitted `mdItemSelect`. */
  private findExpandableParentFromEvent(event: Event): HTMLMdListItemElement | null {
    const path = (
      typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
    ) as EventTarget[];

    for (const node of path) {
      const item = node as HTMLMdListItemElement;
      if (item?.tagName !== 'MD-LIST-ITEM' || !item.expandable) continue;
      if (item.parentElement === this.el) return item;
    }

    return null;
  }

  private activateItem(index: number, fromUserAction: boolean) {
    const items = this.items;
    const item = items[index];
    if (!item || item.expandable) return;

    if (this.selectionMode === 'single-select') {
      items.forEach((it, i) => {
        if (i !== index && it.selected) it.selected = false;
      });
      item.selected = true;
      if (fromUserAction) {
        this.mdSelect.emit({
          index,
          value: item.headline || (item.textContent ?? '').trim(),
          selected: true,
          item,
        });
      }
    } else if (this.selectionMode === 'multi-select') {
      item.selected = !item.selected;
      if (fromUserAction) {
        this.mdSelect.emit({
          index,
          value: item.headline || (item.textContent ?? '').trim(),
          selected: item.selected,
          item,
        });
      }
    }
  }

  /**
   * Move roving focus to the next focusable item, wrapping at the end.
   * Returns the newly active item, or `null` when no items are focusable.
   */
  /** Roving-focus anchor for programmatic navigation (not `:focus`, which drifts when toolbar buttons steal focus). */
  private getRovingFocusItem(focusable: HTMLMdListItemElement[]): HTMLMdListItemElement | null {
    if (focusable.length === 0) return null;
    const tabbable = focusable.find(i => i.tabbable);
    if (tabbable) return tabbable;
    const fromIndex = this.items[this.activeIndex];
    if (fromIndex && focusable.includes(fromIndex)) return fromIndex;
    return focusable[0];
  }

  @Method()
  async activateNext(): Promise<HTMLMdListItemElement | null> {
    const focusable = this.focusableItems;
    if (focusable.length === 0) return null;
    const current = this.getRovingFocusItem(focusable);
    const currentIdx = current ? focusable.indexOf(current) : -1;
    const next = currentIdx < focusable.length - 1 ? currentIdx + 1 : 0;
    this.focusItem(focusable[next]);
    return focusable[next];
  }

  /**
   * Move roving focus to the previous focusable item, wrapping at the start.
   * Returns the newly active item, or `null` when no items are focusable.
   */
  @Method()
  async activatePrevious(): Promise<HTMLMdListItemElement | null> {
    const focusable = this.focusableItems;
    if (focusable.length === 0) return null;
    const current = this.getRovingFocusItem(focusable);
    const currentIdx = current ? focusable.indexOf(current) : -1;
    const prev = currentIdx > 0 ? currentIdx - 1 : focusable.length - 1;
    this.focusItem(focusable[prev]);
    return focusable[prev];
  }

  /**
   * Programmatically toggle selection on the item at `index` according
   * to the current `selection-mode`. Does not emit `mdSelect` (use it
   * to sync external state without a user action).
   */
  @Method()
  async selectItem(index: number): Promise<void> {
    if (this.selectionMode === 'none') return;
    this.activateItem(index, false);
  }

  /** Returns the indices of all currently selected items. */
  @Method()
  async getSelectedIndices(): Promise<number[]> {
    return this.items
      .map((it, i) => (it.selected ? i : -1))
      .filter(i => i >= 0);
  }

  render() {
    /* Container role — see {@link effectiveRole} for the full priority order. */
    const role = this.effectiveRole;
    /* `aria-multiselectable` is only a valid attribute on a `listbox`. An
       expandable selection list degrades to `role="list"` (its per-row nested
       listboxes carry the option semantics), so gate the attribute on the role. */
    const ariaMulti =
      role === 'listbox' && this.selectionMode === 'multi-select' ? 'true' : null;

    return (
      <Host
        class={{
          'md-list': true,
          [`md-list--${this.listStyle}`]: true,
          [`md-list--${this.selectionMode}`]: this.selectionMode !== 'none',
          [`md-list--${this.interactionMode}`]: true,
          'md-list--reorderable': this.reorderable,
          'md-list--reordering': !!this.dropPlaceholder,
        }}
        role={role}
        aria-label={this.label || null}
        aria-labelledby={this.labelledby || null}
        aria-multiselectable={ariaMulti}
      >
        {this.dropPlaceholder && (
          <div
            class="md-list__drop-placeholder"
            part="drop-placeholder"
            aria-hidden="true"
            style={{
              transform: `translateY(${this.dropPlaceholder.top}px)`,
              blockSize: `${this.dropPlaceholder.height}px`,
            }}
          ></div>
        )}
        <slot />
      </Host>
    );
  }
}

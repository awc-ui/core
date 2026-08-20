import {
  Component,
  Host,
  h,
  Prop,
  State,
  Element,
  Event,
  EventEmitter,
  Listen,
  Method,
  Watch,
} from '@stencil/core';
import { captureFlip } from '../../utils/flip';

export type MdTableSortOrder = 'asc' | 'desc' | 'none';

export interface MdTableSortState {
  /** Column id of the active sort, or empty for "no sort". */
  column: string;
  /** Sort direction. */
  order: MdTableSortOrder;
}

export interface MdTableSelectionState {
  /** Number of selected rows. */
  count: number;
  /** Total number of selectable rows (rendered). */
  total: number;
  /** Selected row "value" or id (or row index) for each selected row. */
  values: string[];
  /** Whether all visible rows are selected. */
  all: boolean;
  /** Whether some (but not all) rows are selected. */
  indeterminate: boolean;
}

interface SelectableRow extends HTMLElement {
  selected: boolean;
  disabled: boolean;
  value: string;
  selectable: boolean;
}

/**
 * Material Design 3 — Table
 *
 * The core composable table primitive for hand-authored tables.
 *
 * Layout architecture: the shadow `.md-table__grid` owns the column tracks
 * (`grid-template-columns`), and every slotted `md-table-row` is a REAL grid
 * item spanning all tracks that lays its cells on the shared tracks via
 * `grid-template-columns: subgrid`. Rows being real boxes is what makes row
 * hover, stripes, dividers, sticky headers and focus rings actually work —
 * and a wrong cell count skews one row, never the whole table.
 *
 * Coordination is push-based (the house pattern): the table stamps context
 * onto its rows (`rowgroup`, stripe parity, stickiness) and pushes sort state
 * into `md-table-sort-label`s — no MutationObservers, no `:host-context()`.
 *
 * High-level features:
 *   - Density: `compact` | `standard` | `comfortable`
 *   - Sticky header / footer (pair with `md-table-container` for the scroll box)
 *   - Sticky first / last column via cell `sticky="start" | "end"`
 *   - Sortable columns via `<md-table-sort-label>` (3-state asc → desc → none)
 *   - Selection coordination — emits `mdSelectionChange`; `selectAll()` /
 *     `deselectAll()` / `toggleSelectAll()` for the select-all checkbox
 *   - Horizontal scroll when the content is wider than the container
 *   - Loading + empty-state slots, striped rows, configurable dividers
 */
@Component({
  tag: 'md-table',
  styleUrl: 'md-table.css',
  shadow: true,
})
export class MdTable {
  @Element() el!: HTMLElement;

  /**
   * Layout density. Accepts BOTH vocabularies:
   *
   * - the semantic sizes `'compact' | 'standard' | 'comfortable'` (row heights
   *   36 / 52 / 60px), which is this component's original API, and
   * - a numeric rung `0 | -1 | -2 | -3 | -4`, the scale every other component in
   *   the library uses.
   *
   * A numeric value drives `--md-sys-density-scale` on the host (see the DENSITY
   * block in the CSS) exactly as a global `data-density` ancestor would, and
   * takes the `standard` row-height base. The two are not exclusive: the
   * semantic sizes are themselves scale-aware, so `density="compact"` inside a
   * `data-density="-2"` region condenses further.
   */
  @Prop({ reflect: true }) density:
    | 'compact'
    | 'standard'
    | 'comfortable'
    | 0
    | -1
    | -2
    | -3
    | -4 = 'standard';

  /**
   * CSS `grid-template-columns` value (e.g. `"auto 1fr 120px"`).
   * Takes precedence over the `columns` prop. Use this for fine control,
   * including using `minmax()`, `fr` units and `auto`.
   */
  @Prop({ attribute: 'column-template' }) columnTemplate: string = '';

  /**
   * Number of columns when no `column-template` is provided. The grid uses
   * `repeat(<columns>, minmax(0, 1fr))`. When neither is set, the column
   * count is derived from the first row's cells.
   */
  @Prop() columns: number = 0;

  /**
   * Minimum table width (e.g. `"640px"`). When the container is narrower, the
   * grid keeps this width and the container shows a horizontal scrollbar
   * instead of squishing the columns. Also settable via
   * `--md-table-min-width`.
   */
  @Prop({ attribute: 'min-width' }) minWidth: string = '';

  /** Stick the head row(s) to the top of the scroll container. */
  @Prop({ reflect: true, attribute: 'sticky-header' }) stickyHeader: boolean = false;

  /**
   * Frozen-header architecture: the header is rendered OUTSIDE the vertical
   * scroll area, so the scrollbar spans only the body and runs UNDER the head
   * Pair with `md-table-container[max-height]` to cap
   * the body — max-height controls the SIZE, this prop controls the
   * ARCHITECTURE. Without it, a max-height container scrolls the whole table
   * (use `sticky-header` there for the classic in-flow pinned header).
   */
  @Prop({ reflect: true, attribute: 'frozen-header' }) frozenHeader: boolean = false;

  /**
   * Height ratchet (default ON): once the table has rendered, it never
   * shrinks below that initial height. Paging, filtering to fewer/zero rows,
   * or an async refetch that momentarily empties the body keep the table (and
   * therefore the page) geometrically stable — no content below jumps up, and
   * no scrollbar can flash from a transient collapse (async rebuilds have a
   * few frames where fresh rows haven't hydrated and measure 0). Set
   * `keep-height="false"` for tables that intentionally resize (e.g. a
   * density-toggle demo).
   */
  @Prop({ reflect: true, attribute: 'keep-height' }) keepHeight: boolean = true;

  /**
   * Vertical scrollbar presentation (frozen mode):
   * - `overlay` (default) — a custom always-visible thumb FLOATS over the
   *   rows' right edge; no gutter is reserved, so row backgrounds and
   *   dividers run the full width and the bar never takes layout space.
   * - `gutter` — classic inset bar in a reserved gap: `scrollbar-gutter:
   *   stable` keeps a fixed strip inside the table (rows stop short of the
   *   edge) and the native bar renders in it, crossing the row borders.
   */
  @Prop({ reflect: true }) scrollbar: 'overlay' | 'gutter' = 'overlay';

  /**
   * How MULTIPLE pinned columns on the same side behave during horizontal
   * scroll:
   * - `stack` (default) — every pinned column sticks at the same edge, so
   *   later ones slide OVER earlier ones while scrolling (a deck-of-cards
   *   effect; only the top one stays fully visible).
   * - `static` — each pinned column gets a cumulative inset equal to the
   *   widths of the pinned columns before it, so ALL of them stay visible
   *   side-by-side (spreadsheet-style).
   */
  @Prop({ reflect: true, attribute: 'pin-mode' }) pinMode: 'stack' | 'static' = 'stack';

  /**
   * Table-wide custom pin-indicator icon (Material Symbols ligature, e.g.
   * "anchor"). Cast to every pinned header cell so consumers set it once;
   * a cell's own `pin-icon` attribute wins over the cast. Empty = built-in
   * push-pin SVG.
   */
  @Prop({ attribute: 'pin-icon' }) pinIcon: string = '';

  @Watch('pinIcon')
  onPinIconChange() {
    this.syncRows();
  }

  @Watch('pinMode')
  onPinModeChange() {
    this.syncStickyOffsets();
  }

  /**
   * Stamp cumulative sticky offsets on pinned cells (pin-mode="static").
   * Widths come from the resolved grid tracks; in stack mode the vars are
   * cleared so cells fall back to inset 0.
   */
  private syncStickyOffsets() {
    const rows = Array.from(this.el.querySelectorAll('md-table-row')) as HTMLElement[];
    if (!rows.length) return;
    const clear = () =>
      rows.forEach((row) =>
        (Array.from(row.children) as HTMLElement[]).forEach((c) => c.style.removeProperty('--_sticky-offset')),
      );
    if (this.pinMode !== 'static') {
      clear();
      return;
    }
    const gridEl = this.frozenHeader ? this.bodyGridEl : (this.el.shadowRoot?.querySelector('.md-table__grid') as HTMLElement | null);
    if (!gridEl) return;
    const tracks = getComputedStyle(gridEl)
      .gridTemplateColumns.split(' ')
      .map((t) => parseFloat(t))
      .filter((n) => !Number.isNaN(n));
    if (!tracks.length) return;
    rows.forEach((row) => {
      const cells = (Array.from(row.children) as HTMLElement[]).filter(
        (c) => c.tagName === 'MD-TABLE-CELL' && !c.hasAttribute('data-md-col-hidden'),
      );
      let startCum = 0;
      cells.forEach((cell, i) => {
        if (cell.getAttribute('sticky') === 'start') {
          cell.style.setProperty('--_sticky-offset', `${startCum}px`);
          startCum += tracks[i] ?? 0;
        }
      });
      let endCum = 0;
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i].getAttribute('sticky') === 'end') {
          cells[i].style.setProperty('--_sticky-offset', `${endCum}px`);
          endCum += tracks[i] ?? 0;
        }
      }
    });
  }

  /** Stick the foot row(s) to the bottom of the scroll container. */
  @Prop({ reflect: true, attribute: 'sticky-footer' }) stickyFooter: boolean = false;

  /** Show alternating row colors. */
  @Prop({ reflect: true }) striped: boolean = false;

  /** Hide the dividers between rows. */
  @Prop({ reflect: true, attribute: 'no-dividers' }) noDividers: boolean = false;

  /** Hover surface on rows. */
  @Prop({ reflect: true }) hoverable: boolean = true;

  /**
   * Built-in expressive motion. With `expressive` (the default) the table
   * FLIP-animates its rows around sort and page changes: it snapshots the row
   * boxes when the triggering event fires (`mdSortRequest`, or a pagination
   * event heard by the surrounding `md-table-container`), lets the consumer's
   * synchronous handler mutate the rows, then glides survivors to their new
   * positions and fades + rises entrants. Async mutations settle as a clean
   * no-op. `prefers-reduced-motion` always wins; set `none` to opt out —
   * e.g. when driving your own `flipRows` wiring around the same events.
   */
  @Prop({ reflect: true }) motion: 'expressive' | 'none' = 'expressive';

  /**
   * Selection mode.
   * - `none`     — no selection (default)
   * - `single`   — radio-like: selecting a row DESELECTS every other row;
   *                `selectAll()`/the select-all checkbox are inert (disabled)
   * - `multiple` — checkbox-like; select-all checkbox + selectAll() available
   */
  @Prop({ reflect: true }) selection: 'none' | 'single' | 'multiple' = 'none';

  /**
   * Currently active sort column id. Read by `<md-table-sort-label column="…">`
   * to render its arrow. Empty = no sort.
   */
  @Prop({ mutable: true, reflect: true, attribute: 'sort-by' })
  sortBy: string = '';

  /** Currently active sort direction. */
  @Prop({ mutable: true, reflect: true, attribute: 'sort-order' })
  sortOrder: MdTableSortOrder = 'asc';

  /** Show the loading state. */
  @Prop({ reflect: true }) loading: boolean = false;

  /**
   * Loading presentation:
   * - `overlay` (default) — an indeterminate progress line under the header
   *   plus a scrim that dims/disables the body while the header/footer stay put.
   * - `skeleton` — the body is replaced by shimmering skeleton rows; the
   *   header and footer are untouched.
   */
  @Prop({ reflect: true, attribute: 'loading-mode' }) loadingMode: 'overlay' | 'skeleton' = 'overlay';

  /** Number of skeleton rows rendered in `loading-mode="skeleton"`. */
  @Prop({ attribute: 'loading-rows' }) loadingRows: number = 4;

  /** Render the empty-state slot when true. */
  @Prop({ reflect: true }) empty: boolean = false;

  /**
   * Accessible name for the `role="table"`. When omitted, the `caption` text
   * names the table (WAI: a caption identifies the table for screen-reader
   * users browsing in tables mode); the generic "Data table" is the last
   * resort. IDREFs cannot cross the shadow boundary, so the caption text is
   * mirrored into `aria-label` rather than referenced via `aria-labelledby`.
   */
  @Prop() label: string = '';

  /** Optional caption rendered above the table head. */
  @Prop() caption: string = '';

  /**
   * Long description of a COMPLEX table's structure (WAI caption & summary
   * pattern) — e.g. "Columns are grouped under Profile and Employment".
   * Exposed as `aria-description` on the table; invisible otherwise.
   */
  @Prop() summary: string = '';

  /**
   * Absolute 0-based index of the FIRST rendered body row within the full
   * dataset (WAI/ARIA pagination): with `row-count` set, each row gets an
   * `aria-rowindex` so AT reports "row 42 of 5000" instead of a position
   * within the rendered page. Update it on every page change.
   */
  @Prop({ attribute: 'row-offset' }) rowOffset: number = 0;

  /** Total row count for assistive tech when only a subset is rendered
   *  (pagination / virtualization). 0 = use the rendered count. */
  @Prop({ attribute: 'row-count' }) rowCount: number = 0;

  /** Emitted when sort changes (after a `md-table-sort-label` is clicked). */
  @Event() mdSortChange: EventEmitter<MdTableSortState>;

  /** Emitted whenever the row selection state changes. */
  @Event() mdSelectionChange: EventEmitter<MdTableSelectionState>;

  /** Emits when a column is pinned/unpinned via `pinColumn`. */
  @Event() mdPinChange: EventEmitter<{ column: number; side: 'start' | 'end' | null }>;

  /** Emits when a column is hidden/shown via `setColumnVisibility`. */
  @Event() mdColumnVisibilityChange: EventEmitter<{ column: number; visible: boolean; hidden: number[] }>;

  /** rAF-throttled scroll position of the frozen body scroller. */
  @Event() mdScroll: EventEmitter<{ scrollLeft: number; scrollTop: number }>;

  private selectionCache: MdTableSelectionState = {
    count: 0,
    total: 0,
    values: [],
    all: false,
    indeterminate: false,
  };

  /** Guards against the O(n²) event storm during bulk selection changes. */
  private bulkSelecting = false;

  // Frozen-header refs + observer.
  private headScrollEl?: HTMLElement;
  private bodyScrollEl?: HTMLElement;
  private headGridEl?: HTMLElement;
  private bodyGridEl?: HTMLElement;
  private frozenObserver?: ResizeObserver;

  // Custom horizontal scrollbar (frozen mode) — native overlay scrollbars are
  // invisible at rest on macOS, so we draw our own always-visible, draggable
  // bar that works identically on every OS.
  private hTrackEl?: HTMLElement;
  private hThumbEl?: HTMLElement;
  private hDragging = false;
  private hDragStartX = 0;
  private hDragStartScroll = 0;

  // Custom vertical OVERLAY scrollbar (frozen mode): floats over the rows'
  // right edge instead of reserving a gutter, so row backgrounds and dividers
  // run the full width and no space-taking bar can ever shift the content.
  private vTrackEl?: HTMLElement;
  private vThumbEl?: HTMLElement;
  private vDragging = false;
  private vDragStartY = 0;
  private vDragStartScroll = 0;

  /** RTL flips the scrollLeft convention: 0 at the inline start (right edge)
   *  running NEGATIVE toward the end. All custom-hscroll math normalizes
   *  through |scrollLeft| plus this direction check. */
  private get isRtl(): boolean {
    return getComputedStyle(this.el).direction === 'rtl';
  }

  /** Size + position the custom horizontal scroll thumb from the body scroll. */
  private updateHScroll = () => {
    const sc = this.bodyScrollEl;
    const track = this.hTrackEl;
    const thumb = this.hThumbEl;
    if (!sc || !track || !thumb) return;
    const overflow = sc.scrollWidth - sc.clientWidth;
    if (overflow <= 1) {
      track.style.display = 'none';
      return;
    }
    track.style.display = 'block';
    const trackW = track.clientWidth;
    const thumbW = Math.max(24, (sc.clientWidth / sc.scrollWidth) * trackW);
    const maxThumbLeft = trackW - thumbW;
    // 0..1 progress from the inline START of the content, direction-agnostic.
    const progress = Math.min(1, Math.abs(sc.scrollLeft) / overflow);
    // In RTL the content start sits at the RIGHT, so the thumb starts at the
    // track's right end and travels left as the user scrolls toward the end.
    const left = (this.isRtl ? 1 - progress : progress) * maxThumbLeft;
    thumb.style.inlineSize = `${thumbW}px`;
    thumb.style.transform = `translateX(${left}px)`;
  };

  private onHThumbPointerDown = (e: PointerEvent) => {
    if (!this.bodyScrollEl) return;
    this.hDragging = true;
    this.hDragStartX = e.clientX;
    this.hDragStartScroll = this.bodyScrollEl.scrollLeft;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  private onHThumbPointerMove = (e: PointerEvent) => {
    if (!this.hDragging || !this.bodyScrollEl || !this.hTrackEl || !this.hThumbEl) return;
    const sc = this.bodyScrollEl;
    const maxThumbLeft = this.hTrackEl.clientWidth - this.hThumbEl.offsetWidth;
    const overflow = sc.scrollWidth - sc.clientWidth;
    const perPx = maxThumbLeft > 0 ? overflow / maxThumbLeft : 0;
    sc.scrollLeft = this.hDragStartScroll + (e.clientX - this.hDragStartX) * perPx;
  };
  private onHThumbPointerUp = (e: PointerEvent) => {
    this.hDragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* no capture to release */
    }
  };

  /** Size + position the vertical overlay thumb from the body scroll. */
  private updateVScroll = () => {
    const sc = this.bodyScrollEl;
    const track = this.vTrackEl;
    const thumb = this.vThumbEl;
    if (!sc || !track || !thumb) return;
    if (this.scrollbar === 'gutter') {
      track.style.display = 'none';
      return;
    }
    const overflow = sc.scrollHeight - sc.clientHeight;
    if (overflow <= 1) {
      track.style.display = 'none';
      return;
    }
    track.style.display = 'block';
    // Track spans exactly the body area inside the frozen wrapper.
    track.style.insetBlockStart = `${sc.offsetTop}px`;
    track.style.blockSize = `${sc.clientHeight}px`;
    const trackH = sc.clientHeight;
    const thumbH = Math.max(24, (sc.clientHeight / sc.scrollHeight) * trackH);
    const maxThumbTop = trackH - thumbH;
    const top = (sc.scrollTop / overflow) * maxThumbTop;
    thumb.style.blockSize = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  };

  private onVThumbPointerDown = (e: PointerEvent) => {
    if (!this.bodyScrollEl) return;
    this.vDragging = true;
    this.vDragStartY = e.clientY;
    this.vDragStartScroll = this.bodyScrollEl.scrollTop;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  private onVThumbPointerMove = (e: PointerEvent) => {
    if (!this.vDragging || !this.bodyScrollEl || !this.vTrackEl || !this.vThumbEl) return;
    const sc = this.bodyScrollEl;
    const maxThumbTop = this.vTrackEl.clientHeight - this.vThumbEl.offsetHeight;
    const overflow = sc.scrollHeight - sc.clientHeight;
    const perPx = maxThumbTop > 0 ? overflow / maxThumbTop : 0;
    sc.scrollTop = this.vDragStartScroll + (e.clientY - this.vDragStartY) * perPx;
  };
  private onVThumbPointerUp = (e: PointerEvent) => {
    this.vDragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* no capture to release */
    }
  };

  componentDidLoad() {
    this.syncRows();
    this.syncSortLabels();
    this.recomputeSelection(false);
    this.setupFrozenHeader();
    // Frozen tables floor their header tracks to the header CONTENT (sort
    // arrows are wider than short body values — without this they cram into
    // the next column).
    requestAnimationFrame(() => this.scheduleHeaderFloors());
    // Height ratchet: after the first laid-out frame, floor the table at its
    // initial height so it never shrinks (see keepHeight). In frozen mode the
    // floor goes on the BODY SCROLL AREA, not the host: flooring the host
    // would leave the extra space BELOW the frozen flex column, stranding the
    // custom horizontal scrollbar mid-table — flooring the body keeps rows /
    // empty state absorbing the height and the bar pinned at the bottom.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.keepHeight) return;
        const target = this.frozenHeader && this.bodyScrollEl ? this.bodyScrollEl : this.el;
        const h = target.getBoundingClientRect().height;
        if (h > 1) target.style.minBlockSize = `${Math.round(h)}px`;
      }),
    );
  }

  componentDidRender() {
    // Keep the frozen header's tracks aligned after every render (data/columns
    // can change). Cheap: a single getComputedStyle read + string compare.
    this.syncFrozenColumns();
    this.updateHScroll();
    this.updateVScroll();
    this.syncStickyOffsets();
  }

  disconnectedCallback() {
    this.frozenObserver?.disconnect();
    this.frozenObserver = undefined;
  }

  @Watch('selection')
  onSelectionModeChange() {
    // Mode switches must re-run the selection machinery WITHOUT a re-mount:
    // the select-all checkbox keeps its element across renders, so single-mode's
    // disabled state stuck when switching back to multiple (dead checkbox),
    // and entering single never disabled it until some selection event fired.
    let trimmed = false;
    if (this.selection === 'single') {
      // Entering radio-like mode with several rows selected: keep the first.
      const sel = this.getSelectableRows().filter((r) => r.selected);
      if (sel.length > 1) {
        this.bulkSelecting = true;
        try {
          sel.slice(1).forEach((r) => (r.selected = false));
        } finally {
          this.bulkSelecting = false;
        }
        trimmed = true;
      }
    }
    this.syncRows(); // aria-selected stamping is mode-dependent
    // Sync checkbox enabled/checked states; emit only if the switch actually
    // changed the selection (the trim), so consumers hear about it.
    this.recomputeSelection(trimmed);
  }

  @Watch('empty')
  onEmptyChange() {
    // SRs don't announce a swapped-in empty state on their own.
    this.srAnnouncement = this.empty ? 'No data' : '';
  }

  @State() private srAnnouncement = '';

  /**
   * True when at least one slotted row is `expandable`. Such rows carry
   * `aria-expanded`, which is only a valid property on a ROW inside a
   * `treegrid` — on a plain `table` row it is a conditional-attribute
   * violation (axe `aria-conditional-attr`). So the structural element
   * promotes from `role="table"` to `role="treegrid"` whenever this is set;
   * treegrid is a superset of table for every other property we expose
   * (rowcount/rowindex, colspan, aria-sort, aria-selected). Recomputed in
   * `syncRows()` (runs on load + every slot change), so the role tracks rows
   * appearing / disappearing / toggling `expandable`.
   */
  @State() private hasExpandableRow = false;

  @Watch('frozenHeader')
  @Watch('stickyHeader')
  onStickyHeaderChange() {
    this.syncRows();
    // Refs are recreated on the next render; re-attach the observer then.
    // RETRY across frames: a single rAF can fire before Stencil commits the
    // re-render (the audit's plausible race) — poll until the body grid ref
    // exists or ~half a second passes.
    this.frozenObserver?.disconnect();
    this.frozenObserver = undefined;
    const attach = (tries = 0) => {
      if (!this.frozenHeader) return;
      if (this.bodyGridEl) {
        this.setupFrozenHeader();
        return;
      }
      if (tries < 30) requestAnimationFrame(() => attach(tries + 1));
    };
    requestAnimationFrame(() => attach());
  }

  /** Observe the body grid so the header tracks re-sync on any size change. */
  private setupFrozenHeader() {
    if (!this.frozenHeader || !this.bodyGridEl || typeof ResizeObserver === 'undefined') return;
    this.frozenObserver?.disconnect();
    this.frozenObserver = new ResizeObserver(() => {
      this.syncFrozenColumns();
      this.updateHScroll();
      // Row show/hide (pagination, filters) resizes the grid WITHOUT a table
      // re-render — the overlay thumb must follow here, not just on scroll.
      this.updateVScroll();
      this.syncStickyOffsets(); // track widths may have changed
    });
    this.frozenObserver.observe(this.bodyGridEl);
    this.syncFrozenColumns();
    this.updateHScroll();
    this.updateVScroll();
  }

  /** Copy the body grid's RESOLVED pixel tracks onto the header grid so columns
   *  align exactly (and the header naturally reserves the body's scrollbar
   *  gutter, since its tracks sum to less than its full width). */
  private syncFrozenColumns() {
    if (!this.frozenHeader || !this.bodyGridEl || !this.headGridEl) return;
    // When the body has no laid-out rows (all filtered out / a page transition
    // that momentarily hides everything), its `auto` and content-sized tracks
    // collapse to 0 — copying those onto the header would squash the columns.
    // RETAIN the last-applied tracks instead of clearing: transient all-hidden
    // states (display-toggle paging, animated swaps) must not flap the header
    // widths every transition. A table that STARTS empty simply has no inline
    // override yet, so the header keeps the template's real widths.
    const hasVisibleRow = Array.from(this.el.querySelectorAll('md-table-body md-table-row')).some(
      (r) => (r as HTMLElement).getBoundingClientRect().height > 0,
    );
    if (!hasVisibleRow) return;
    const tracks = getComputedStyle(this.bodyGridEl).gridTemplateColumns;
    if (tracks && tracks !== 'none') {
      // Append a filler track that absorbs the head wrapper's leftover width
      // (the body's scrollbar gutter): header rows span 1/-1, so their
      // background AND dividers stretch edge-to-edge instead of stopping a
      // gutter short. No cell ever places into it (cells auto-place into the
      // real tracks), and it collapses to 0 when the grid h-overflows.
      const headTracks = `${tracks} minmax(0, 1fr)`;
      if (this.headGridEl.style.gridTemplateColumns !== headTracks) {
        this.headGridEl.style.gridTemplateColumns = headTracks;
      }
    }
  }

  /** Mirror the body's horizontal scroll onto the (clipped) header + thumb. */
  private onBodyScroll = () => {
    if (this.headScrollEl && this.bodyScrollEl) {
      this.headScrollEl.scrollLeft = this.bodyScrollEl.scrollLeft;
    }
    this.updateHScroll();
    this.updateVScroll();
    // one mdScroll per frame, not per native scroll event
    if (!this.scrollEmitQueued && typeof requestAnimationFrame !== 'undefined') {
      this.scrollEmitQueued = true;
      requestAnimationFrame(() => {
        this.scrollEmitQueued = false;
        const sc = this.bodyScrollEl;
        if (sc) this.mdScroll.emit({ scrollLeft: sc.scrollLeft, scrollTop: sc.scrollTop });
      });
    }
  };

  /** overflow-x is hidden (no native horizontal bar), so translate horizontal
   *  wheel / trackpad (and shift+wheel) into programmatic horizontal scroll. */
  /**
   * Keyboard horizontal scrolling (WCAG 2.1.1): overflow-x is hidden (the
   * custom bar owns the axis) and the custom thumbs are pointer-only, so
   * without this a keyboard user could never reach off-screen columns.
   * Vertical arrows/PageUp/Down stay native (overflow-y: auto).
   */
  private onBodyKeyDown = (e: KeyboardEvent) => {
    const sc = this.bodyScrollEl;
    if (!sc || e.target !== sc) return;
    const max = sc.scrollWidth - sc.clientWidth;
    if (max <= 0) return;
    const step = 48;
    let dx = 0;
    if (e.key === 'ArrowRight') dx = this.isRtl ? -step : step;
    else if (e.key === 'ArrowLeft') dx = this.isRtl ? step : -step;
    else if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) dx = -Infinity;
    else if (e.key === 'End' && (e.ctrlKey || e.metaKey)) dx = Infinity;
    else return;
    e.preventDefault();
    // RTL scrollLeft runs [-max, 0]; LTR [0, max] — same clamp as onBodyWheel.
    const lo = this.isRtl ? -max : 0;
    const hi = this.isRtl ? 0 : max;
    sc.scrollLeft = Math.max(lo, Math.min(hi, dx === -Infinity ? lo : dx === Infinity ? hi : sc.scrollLeft + dx));
  };

  private onBodyWheel = (e: WheelEvent) => {
    const sc = this.bodyScrollEl;
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!dx) return;
    const max = sc.scrollWidth - sc.clientWidth;
    // Valid scrollLeft range flips with direction: [0, max] in LTR, [-max, 0]
    // in RTL (scrollLeft runs negative from the right-hand content start).
    const lo = this.isRtl ? -max : 0;
    const hi = this.isRtl ? 0 : max;
    const next = Math.max(lo, Math.min(hi, sc.scrollLeft + dx));
    if (next !== sc.scrollLeft) {
      sc.scrollLeft = next;
      e.preventDefault();
    }
  };

  @Watch('density')
  @Watch('striped')
  @Watch('stickyHeader')
  @Watch('stickyFooter')
  @Watch('columns')
  @Watch('columnTemplate')
  onLayoutChange() {
    this.syncRows();
  }

  @Watch('sortBy')
  @Watch('sortOrder')
  onSortStateChange() {
    this.syncSortLabels();
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Returns the current selection state (synchronous snapshot). */
  @Method()
  async getSelection(): Promise<MdTableSelectionState> {
    this.recomputeSelection(false);
    return this.selectionCache;
  }

  /** Programmatically select all selectable body rows (no-op when selection="none"). */
  @Method()
  async selectAll(): Promise<void> {
    // Select-all is a MULTIPLE-mode concept: in single (radio-like) mode a
    // bulk select would violate the one-row invariant — the select-all checkbox
    // previously behaved identically in both modes, making them
    // indistinguishable.
    if (this.selection !== 'multiple') return;
    this.bulkSelecting = true;
    try {
      this.getSelectableRows().forEach((r) => {
        if (!r.disabled) r.selected = true;
      });
    } finally {
      this.bulkSelecting = false;
    }
    this.recomputeSelection();
  }

  /** Programmatically deselect every row. */
  @Method()
  async deselectAll(): Promise<void> {
    this.bulkSelecting = true;
    try {
      this.getSelectableRows().forEach((r) => (r.selected = false));
    } finally {
      this.bulkSelecting = false;
    }
    this.recomputeSelection();
  }

  /** Toggle the "all selected" state (used by the select-all checkbox). */
  @Method()
  async toggleSelectAll(): Promise<void> {
    if (this.selectionCache.all) await this.deselectAll();
    else await this.selectAll();
  }

  /** Set the active sort column / order programmatically. */
  @Method()
  async setSort(column: string, order: MdTableSortOrder): Promise<void> {
    this.sortBy = column;
    this.sortOrder = order;
    const play = this.armMotion();
    this.mdSortChange.emit({ column, order });
    play?.();
  }

  // ------------------------------------------------------------------
  // Column pinning — core-owned cell reorder + sticky attrs + template
  // ------------------------------------------------------------------

  /** Pinned columns by ORIGINAL column index (their position before any
   *  pinning). Initialized from markup `sticky` attributes on first use, so a
   *  hard-coded sticky checkbox column keeps its place at the front. */
  private pinnedColumns = new Map<number, 'start' | 'end'>();
  private hiddenColumns = new Set<number>();
  private scrollEmitQueued = false;
  /** The ORIGINAL column tracks, parsed once — permutations and minmax floors
   *  are always derived from these, never from the rewritten attribute. */
  private pinBaseTracks: string[] | null = null;

  /** Split a grid template into top-level tracks (minmax(a, b) stays one). */
  private static splitTracks(template: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of template.trim()) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (/\s/.test(ch) && depth === 0) {
        if (cur) {
          out.push(cur);
          cur = '';
        }
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /** Stamp every cell with its original column index + parse the base tracks.
   *  Returns false when the table can't support pinning — warning unless
   *  `silent` (the mount-time header-floor pass probes speculatively; e.g. a
   *  legit grouped-header table with colspans must not spam the console). */
  /**
   * Direct element children matching a tag / attribute predicate.
   *
   * Deliberately NOT `:scope >` — Stencil's mock-doc selector engine throws
   * outright on `:scope` ("jQuery does not support the :scope selector"), which
   * made pinColumn and setColumnVisibility unrunnable in a spec. Every other
   * component in this library already avoids it for the same reason (see
   * md-accordion, md-dialog, md-tooltip, md-breadcrumbs, utils/select-options).
   */
  private static directChildren(parent: Element, match: (el: HTMLElement) => boolean): HTMLElement[] {
    return (Array.from(parent.children) as HTMLElement[]).filter(match);
  }

  private static isTag(tag: string) {
    return (el: HTMLElement) => el.tagName.toLowerCase() === tag;
  }

  private ensurePinBase(silent = false): boolean {
    if (this.pinBaseTracks) return true;
    const warn = (msg: string) => {
      if (!silent) console.warn(`[md-table] ${msg}`);
    };
    if (!this.columnTemplate || this.columnTemplate.includes('repeat(')) {
      warn('pinColumn needs an explicit column-template without repeat().');
      return false;
    }
    const tracks = (this.constructor as typeof MdTable).splitTracks(this.columnTemplate);
    const rows = Array.from(this.el.querySelectorAll('md-table-row'));
    for (const row of rows) {
      const cells = MdTable.directChildren(row, MdTable.isTag('md-table-cell'));
      if (cells.some((c) => c.hasAttribute('colspan') && c.getAttribute('colspan') !== '1')) {
        warn('pinColumn does not support colspan cells.');
        return false;
      }
      if (cells.length !== tracks.length) {
        warn('pinColumn needs every row to have one cell per column.');
        return false;
      }
      cells.forEach((c, i) => c.setAttribute('data-md-col', String(i)));
    }
    // Seed pins from markup sticky attributes (head row = source of truth), so
    // e.g. a sticky checkbox column stays first among the pinned-start group.
    const headRow = this.el.querySelector('md-table-head md-table-row');
    const headCells = headRow
      ? MdTable.directChildren(headRow, MdTable.isTag('md-table-cell'))
      : [];
    headCells.forEach((c, i) => {
      const s = c.getAttribute('sticky');
      if (s === 'start' || s === 'end') this.pinnedColumns.set(i, s);
    });
    this.pinBaseTracks = tracks;
    return true;
  }

  /**
   * Pin a column to an edge (or unpin with `'none'`). `column` is the ORIGINAL
   * 0-based column index (its position before any pinning). The table owns the
   * whole mechanic: it physically re-sequences every row's cells (selection and
   * expansion state survive — the elements just move), maintains `sticky`
   * attributes, permutes the column template, and re-floors the header tracks
   * so pin icons / sort arrows never clip in frozen mode. The move itself is an
   * intentional SNAP (no FLIP) — the frozen header re-measures its tracks over
   * the next frames, and animating against that settling would jitter.
   * Resolves to the column's effective side after the call.
   */
  @Method()
  async pinColumn(column: number, side: 'start' | 'end' | 'none'): Promise<'start' | 'end' | null> {
    if (!this.ensurePinBase()) return null;
    if (side === 'none' || this.pinnedColumns.get(column) === side) {
      this.pinnedColumns.delete(column);
    } else {
      this.pinnedColumns.set(column, side);
    }
    this.applyPinLayout();
    const effective = this.pinnedColumns.get(column) ?? null;
    this.mdPinChange.emit({ column, side: effective });
    return effective;
  }

  /**
   * Hide or show a column. `column` is the ORIGINAL 0-based index (same
   * addressing as `pinColumn`). Hidden cells stay in the DOM (state
   * survives — they just stop displaying) and their track leaves the
   * template. The last visible column cannot be hidden. Resolves to the
   * column's effective visibility.
   */
  @Method()
  async setColumnVisibility(column: number, visible: boolean): Promise<boolean> {
    if (!this.ensurePinBase()) return true;
    if (column < 0 || column >= (this.pinBaseTracks?.length ?? 0)) return true;
    if (!visible && this.hiddenColumns.size >= (this.pinBaseTracks!.length - 1) && !this.hiddenColumns.has(column)) {
      console.warn('[md-table] setColumnVisibility: refusing to hide the last visible column.');
      return true;
    }
    if (visible) this.hiddenColumns.delete(column);
    else this.hiddenColumns.add(column);
    this.applyPinLayout();
    const effective = !this.hiddenColumns.has(column);
    this.mdColumnVisibilityChange.emit({
      column,
      visible: effective,
      hidden: Array.from(this.hiddenColumns).sort((a, b) => a - b),
    });
    return effective;
  }

  /** Re-sequence cells + sticky attrs + template for the current pin state. */
  private applyPinLayout() {
    const tracks = this.pinBaseTracks!;
    const all = tracks.map((_, i) => i);
    const start = all.filter((i) => this.pinnedColumns.get(i) === 'start');
    const end = all.filter((i) => this.pinnedColumns.get(i) === 'end');
    const mid = all.filter((i) => !this.pinnedColumns.has(i));
    const order = [...start, ...mid, ...end];

    this.el.querySelectorAll('md-table-row').forEach((row) => {
      order.forEach((k) => {
        const cell =
          MdTable.directChildren(row, (c) => c.getAttribute('data-md-col') === String(k))[0] ?? null;
        if (!cell) return;
        row.appendChild(cell); // appending in `order` re-sequences the cells
        const side = this.pinnedColumns.get(k);
        if (side) cell.setAttribute('sticky', side);
        else cell.removeAttribute('sticky');
        // hidden columns: cells stay in the DOM (state survives), just
        // undisplayed — their track leaves the template below
        if (this.hiddenColumns.has(k)) cell.setAttribute('data-md-col-hidden', '');
        else cell.removeAttribute('data-md-col-hidden');
      });
    });
    const visibleOrder = order.filter((k) => !this.hiddenColumns.has(k));
    this.el.setAttribute('column-template', visibleOrder.map((k) => tracks[k]).join(' '));
    this.syncHeaderContentFloors(visibleOrder);
  }

  /**
   * Content-driven header floors: in frozen mode each header track is forced
   * to its BODY cell's width, so header content that is wider than the body
   * values — a sort arrow, a pin icon — would spill into the next column.
   * Measure every header cell's light-DOM content span and floor its track
   * with minmax(need, base). The pin icon renders asynchronously in the cell's
   * shadow root, so pinned headers get a fixed allowance for it instead of
   * waiting on that render (16px icon + 4px gap).
   */
  private syncHeaderContentFloors(order?: number[]) {
    if (!this.frozenHeader || !this.pinBaseTracks) return;
    const tracks = this.pinBaseTracks;
    const seq = order ?? tracks.map((_, i) => i);
    requestAnimationFrame(() => {
      const headRow = this.el.querySelector('md-table-head md-table-row');
      if (!headRow) return;
      const tpl = seq.map((k) => {
        const base = tracks[k];
        const cell =
          MdTable.directChildren(headRow, (c) => c.getAttribute('data-md-col') === String(k))[0] ?? null;
        if (!cell || cell.getAttribute('padding') === 'checkbox') return base;
        const kids = Array.from(cell.children) as HTMLElement[];
        if (!kids.length) return base;
        const left = Math.min(...kids.map((el) => el.getBoundingClientRect().left));
        const right = Math.max(...kids.map((el) => el.getBoundingClientRect().right));
        const span = right - left;
        if (span <= 1) return base; // not laid out yet — no bogus floor
        const cs = getComputedStyle(cell);
        const pad = (parseFloat(cs.paddingInlineStart) || 0) + (parseFloat(cs.paddingInlineEnd) || 0);
        const pin =
          this.pinnedColumns.has(k) && !cell.hasAttribute('no-pin-indicator') ? 20 : 0;
        return `minmax(${Math.ceil(span + pad + pin)}px, ${base})`;
      });
      this.el.setAttribute('column-template', tpl.join(' '));
    });
  }

  /** Mount-time floors: a frozen table with sort labels needs its header
   *  content floored even before any pinning (the always-reserved sort arrow
   *  is wider than a short body value). Retries until the labels lay out. */
  private scheduleHeaderFloors(attempt = 0) {
    if (!this.frozenHeader || !this.columnTemplate) return;
    const probe = this.el.querySelector('md-table-head md-table-sort-label') as HTMLElement | null;
    if (!probe) return; // no sort labels — nothing wider than the body values
    const ready = probe.getBoundingClientRect().width > 1;
    if (!ready && attempt <= 30) {
      requestAnimationFrame(() => this.scheduleHeaderFloors(attempt + 1));
      return;
    }
    if (this.ensurePinBase(true)) this.syncHeaderContentFloors();
  }

  // ------------------------------------------------------------------
  // Built-in expressive motion (FLIP bracketing around sort / page events)
  // ------------------------------------------------------------------

  /**
   * Snapshot the current row boxes and FLIP-animate whatever the next
   * SYNCHRONOUS DOM mutation does to them. Call it right before you reorder /
   * show-hide rows outside the table's own events (custom filters, async
   * refetch completion, …); sort and pagination are bracketed automatically.
   */
  @Method()
  async animateNextChange(): Promise<void> {
    this.armMotion()?.();
  }

  /** Internal, synchronous arm signal — dispatched by md-table-container when
   *  it hears a pagination event in the CAPTURE phase (a cross-shadow @Method
   *  call would resolve on a microtask, after the consumer already mutated). */
  @Listen('mdMotionArm')
  handleMotionArm(e: CustomEvent) {
    e.stopPropagation();
    this.armMotion()?.();
  }

  /** Capture FIRST rects of the slotted body rows; returns the rAF-deferred
   *  play(), or null when motion is off / there is nothing to animate. */
  private armMotion(): (() => void) | null {
    if (this.motion === 'none') return null;
    const body = this.el.querySelector('md-table-body') as HTMLElement | null;
    if (!body) return null;
    return captureFlip(body, { enter: true, stagger: 18, staggerCap: 6, spring: 'fast' });
  }

  // ------------------------------------------------------------------
  // Sort / selection event coordination
  // ------------------------------------------------------------------

  @Listen('mdSortRequest')
  handleSortRequest(e: CustomEvent<{ column: string; defaultOrder?: 'asc' | 'desc' }>) {
    e.stopPropagation();
    const col = e.detail.column;
    if (!col) return;

    // First activation starts at the label's default-order; subsequent clicks
    // cycle from there (desc-first columns cycle desc -> asc -> none).
    const first: MdTableSortOrder = e.detail.defaultOrder === 'desc' ? 'desc' : 'asc';
    let order: MdTableSortOrder = first;
    if (this.sortBy === col) {
      const second: MdTableSortOrder = first === 'asc' ? 'desc' : 'asc';
      order = this.sortOrder === first ? second : this.sortOrder === second ? 'none' : first;
    }
    this.sortBy = order === 'none' ? '' : col;
    this.sortOrder = order === 'none' ? 'asc' : order;
    // Bracket the consumer's reorder: capture rows now, emit (handlers run
    // synchronously during emit), then play — the rAF-deferred FLIP glides
    // survivors and fades in rows the new order revealed.
    const play = this.armMotion();
    this.mdSortChange.emit({ column: this.sortBy, order });
    play?.();
  }

  /**
   * AUTO-WIRED selection checkboxes: the table already keeps slotted
   * md-checkboxes in sync (syncSelectionUI) — it now also HANDLES them, so
   * plain markup works with zero consumer wiring. Deliberately DECLARATIVE
   * (set state to the checkbox's checked value, never toggle): consumers that
   * wired their own handlers apply the same end state, so double-handling is
   * idempotent instead of self-cancelling.
   */
  @Listen('mdChange')
  handleSlottedCheckboxChange(e: CustomEvent<{ checked?: boolean }>) {
    if (this.selection === 'none') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'MD-CHECKBOX') return;
    const checked = !!e.detail?.checked;
    // DEFER one microtask. Consumer handlers run earlier in the dispatch
    // (target phase) but their table calls go through Stencil @Method
    // proxies, whose bodies also run on a microtask — queued BEFORE this one
    // (FIFO). Acting synchronously here inverted stateful consumer wiring:
    // auto-wire selected all during bubble, then the consumer's deferred
    // toggleSelectAll() read all=true and DESELECTED — the click net-reverted
    // (proven with an event trace). Deferred, the consumer's toggle executes
    // against the pre-click state and this declarative set converges last.
    queueMicrotask(() => {
      if (target.closest('md-table-head')) {
        if (this.selection !== 'multiple') return; // select-all box is inert in single mode
        if (checked) void this.selectAll();
        else void this.deselectAll();
        return;
      }
      const row = target.closest('md-table-row') as SelectableRow | null;
      if (row && row.closest('md-table-body') && !row.disabled && row.selectable !== false) {
        row.selected = checked;
      }
    });
  }

  /** Rowgroups relay their internal slot changes (row reorders/additions
   *  never cross their shadow boundary as slotchange) — re-stamp context. */
  @Listen('mdRowgroupSlotChange')
  handleRowgroupSlotChange() {
    this.syncRows();
    // Covers checkbox columns appearing with a mode switch: the select-all box
    // must pick up its single-mode disabled state even though it was
    // inserted AFTER the selection watch ran.
    this.recomputeSelection(false);
    // Cell-count changes alter the resolved body tracks — the frozen header
    // held stale tracks (8 vs the body's 6 after Playground none->single)
    // until the next unrelated resize.
    this.syncFrozenColumns();
    this.updateHScroll();
    this.updateVScroll();
  }

  @Listen('mdRowSelectionChange')
  handleRowSelectionChange(e: CustomEvent<{ selected: boolean; value: string }>) {
    if (this.bulkSelecting) return; // one recompute at the end of the bulk op
    if (this.selection === 'single' && e.detail.selected) {
      // Enforce single-selection: deselect all OTHER rows
      const target = e.target as HTMLElement;
      this.bulkSelecting = true;
      try {
        this.getSelectableRows().forEach((r) => {
          if (r !== target) r.selected = false;
        });
      } finally {
        this.bulkSelecting = false;
      }
    }
    this.recomputeSelection();
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /** Body rows only — header/footer rows must never join selection math. */
  private getSelectableRows(): SelectableRow[] {
    return (Array.from(this.el.querySelectorAll('md-table-row')) as unknown as SelectableRow[]).filter(
      (r) => (r.closest('md-table-head') || r.closest('md-table-foot')) == null,
    );
  }

  private recomputeSelection(emit: boolean = true) {
    const rows = this.getSelectableRows();
    const selectable = rows.filter((r) => !r.disabled && r.selectable !== false);
    const selected = selectable.filter((r) => r.selected);
    const all = selectable.length > 0 && selected.length === selectable.length;
    const indeterminate = selected.length > 0 && !all;

    this.selectionCache = {
      count: selected.length,
      total: selectable.length,
      values: selected.map((r, i) => r.value || String(i)),
      all,
      indeterminate,
    };

    this.syncSelectionUI(rows, all, indeterminate);

    if (emit) this.mdSelectionChange.emit(this.selectionCache);
  }

  /**
   * Push the selection MODEL back into the slotted checkboxes (the missing half
   * of the two-way sync): each body row's checkbox mirrors `row.selected`, and
   * the header checkbox reflects all / indeterminate. Row `selected` is the
   * source of truth; a checkbox is just its view. `md-checkbox` only emits
   * `mdChange` on user interaction (not on programmatic `.checked`), and the
   * value-equality guards make this a no-op once in sync — so no event loops.
   */
  private syncSelectionUI(rows: SelectableRow[], all: boolean, indeterminate: boolean) {
    // Keep the ARIA selected state in lockstep with the visual one.
    if (this.selection !== 'none') {
      for (const r of rows) {
        const host = r as unknown as HTMLElement;
        if (host.closest('md-table-body') == null) continue;
        if (r.selectable === false || r.disabled) host.removeAttribute('aria-selected');
        else host.setAttribute('aria-selected', String(!!r.selected));
      }
    }

    if (this.selection === 'none') {
      // Clear any residue a previous mode left on the select-all checkbox.
      const staleHead = this.el.querySelector('md-table-head md-checkbox') as
        | (HTMLElement & { checked: boolean; disabled: boolean; indeterminate: boolean })
        | null;
      if (staleHead) {
        staleHead.disabled = false;
        staleHead.checked = false;
        staleHead.indeterminate = false;
      }
      return;
    }
    for (const r of rows) {
      const cb = (r as unknown as HTMLElement).querySelector('md-checkbox') as
        | (HTMLElement & { checked: boolean; disabled: boolean })
        | null;
      if (!cb) continue;
      if (cb.checked !== r.selected) cb.checked = r.selected;
      if (cb.disabled !== !!r.disabled) cb.disabled = !!r.disabled;
    }
    const headCb = this.el.querySelector('md-table-head md-checkbox') as
      | (HTMLElement & { checked: boolean; indeterminate: boolean; disabled: boolean })
      | null;
    if (headCb) {
      if (this.selection === 'single') {
        // No select-all in radio-like mode: the affordance is disabled and
        // cleared so single visibly differs from multiple.
        if (!headCb.disabled) headCb.disabled = true;
        if (headCb.checked) headCb.checked = false;
        if (headCb.indeterminate) headCb.indeterminate = false;
      } else {
        if (headCb.disabled) headCb.disabled = false;
        if (headCb.indeterminate !== indeterminate) headCb.indeterminate = indeterminate;
        if (headCb.checked !== all) headCb.checked = all;
      }
    }
  }

  /**
   * Stamp layout context onto slotted rows (the stepper-style push pattern):
   * rowgroup (head/body/foot), stripe parity, sticky flags. Rows/cells style
   * themselves from these attributes — no `:host-context()`, no observers.
   */
  private syncRows() {
    // Frozen header: project md-table-head into the dedicated header grid via
    // the `head` slot (only when sticky-header, else it stays in the main grid).
    const headEl = this.el.querySelector('md-table-head');
    if (headEl) {
      if (this.frozenHeader) headEl.setAttribute('slot', 'head');
      else if (headEl.getAttribute('slot') === 'head') headEl.removeAttribute('slot');
    }

    // Rowgroup role coordination for the frozen split. The body/foot render
    // inside `.md-table__body-scroll`, which is itself role="rowgroup" (it must
    // be a valid child of role="table" despite being a focusable scroll tab
    // stop). Their own rowgroup role would then nest inside that wrapper
    // rowgroup (axe aria-required-children: a rowgroup may only own rows), so
    // they drop to presentation and their rows promote to the wrapper. The head
    // sits in a presentational header wrapper, so it keeps its own rowgroup
    // role. Pushed as a reflected prop (not an imperative role override) so the
    // child decides its own role on render — no race with its first paint.
    (Array.from(this.el.querySelectorAll('md-table-body, md-table-foot')) as HTMLElement[]).forEach((rg) => {
      if (this.frozenHeader) rg.setAttribute('presentational', '');
      else rg.removeAttribute('presentational');
    });

    const rows = Array.from(this.el.querySelectorAll('md-table-row')) as HTMLElement[];
    const lastIndex = rows.length - 1;
    // A treegrid is the only table-family container whose rows may carry
    // aria-expanded (the disclosure state md-table-row stamps when expandable).
    // Recompute here so the structural role in render() promotes to treegrid
    // exactly when such a row exists, and drops back to table when none do.
    const hasExpandable = rows.some((r) => r.hasAttribute('expandable'));
    if (this.hasExpandableRow !== hasExpandable) this.hasExpandableRow = hasExpandable;
    // Suppress the final row's divider ONLY when that row actually sits at the
    // container's rounded bottom corner: i.e. the table is inside an
    // md-table-container AND nothing is slotted below it (a `slot="bottom"`
    // pagination bar owns the corner instead, and needs the divider above it
    // kept). A bare md-table has no rounded corner, so its bottom border stays.
    const container = this.el.closest('md-table-container');
    const hasBottomBar =
      !!container &&
      MdTable.directChildren(container, (c) => c.getAttribute('slot') === 'bottom').length > 0;
    const suppressLastDivider = !!container && !hasBottomBar;
    // The foot row carries its own top divider (border-block-start); the last
    // body row before it must drop its bottom divider or the two double up.
    const footExists = rows.some((r) => r.closest('md-table-foot') != null);
    let lastBodyIdx = -1;
    rows.forEach((r, i) => {
      if (r.closest('md-table-head') == null && r.closest('md-table-foot') == null) lastBodyIdx = i;
    });
    const nHead = rows.filter((r) => r.closest('md-table-head') != null).length;
    let bodyIndex = 0;
    let headIndex = 0;
    let footIndex = 0;
    rows.forEach((row, i) => {
      const inHead = row.closest('md-table-head') != null;
      const inFoot = row.closest('md-table-foot') != null;
      const group = inHead ? 'head' : inFoot ? 'foot' : 'body';
      const set = (k: string, v: string | null) => {
        if (v === null) {
          if (row.hasAttribute(k)) row.removeAttribute(k);
        } else if (row.getAttribute(k) !== v) {
          row.setAttribute(k, v);
        }
      };
      set('rowgroup', group);
      set('data-stripe', group === 'body' && this.striped && bodyIndex % 2 === 1 ? 'true' : null);
      set('data-sticky', (inHead && this.stickyHeader) || (inFoot && this.stickyFooter) ? 'true' : null);
      // Stamp the final row only when it truly meets the container's rounded
      // bottom (see suppressLastDivider). `:host([data-last])` in
      // md-table-row.css drops just that row's divider; all others are kept.
      set('data-last', suppressLastDivider && i === lastIndex ? 'true' : null);
      // Drop the last body row's bottom divider when a footer follows (the foot
      // supplies the single body/foot divider via border-block-start).
      set('data-adjacent-foot', footExists && i === lastBodyIdx ? 'true' : null);
      // ARIA pagination positions: with row-count set only a subset is in the
      // DOM, so every row needs aria-rowindex (1-based, headers first, body
      // offset by row-offset). Foot rows have no well-defined absolute index.
      if (this.rowCount > 0) {
        if (inHead) set('aria-rowindex', String(headIndex + 1));
        else if (!inFoot) set('aria-rowindex', String(nHead + this.rowOffset + bodyIndex + 1));
        // Foot rows sit AFTER the full dataset in reading order.
        else set('aria-rowindex', String(nHead + this.rowCount + footIndex + 1));
      } else {
        set('aria-rowindex', null);
      }
      if (inFoot) footIndex++;
      // aria-selected belongs ONLY on selectable body rows of a
      // selection-enabled table (never head/foot, never selection="none").
      if (group === 'body' && this.selection !== 'none') {
        const r = row as unknown as SelectableRow;
        set('aria-selected', r.selectable === false || r.disabled ? null : String(!!r.selected));
      } else {
        set('aria-selected', null);
      }
      if (group === 'body') bodyIndex++;
      if (inHead) headIndex++;
      // Cast the table-wide pin icon to pinned header cells (author-set
      // values win; our previous casts are tracked and replaceable).
      if (inHead) {
        (Array.from(row.children) as HTMLElement[]).forEach((cell) => {
          const side = cell.getAttribute('sticky');
          if (cell.tagName !== 'MD-TABLE-CELL' || (side !== 'start' && side !== 'end')) return;
          const cast = cell.getAttribute('data-pin-icon-cast');
          const own = cell.getAttribute('pin-icon');
          if (own !== null && own !== cast) return; // author override — hands off
          if (this.pinIcon) {
            if (own !== this.pinIcon) {
              cell.setAttribute('pin-icon', this.pinIcon);
              cell.setAttribute('data-pin-icon-cast', this.pinIcon);
            }
          } else if (cast !== null) {
            cell.removeAttribute('pin-icon');
            cell.removeAttribute('data-pin-icon-cast');
          }
        });
      }
    });
  }

  /** Push the active sort state into every slotted sort label. */
  private syncSortLabels() {
    const labels = Array.from(this.el.querySelectorAll('md-table-sort-label')) as Array<
      HTMLElement & { active: boolean; order: MdTableSortOrder }
    >;
    for (const l of labels) {
      const col = l.getAttribute('column') || '';
      const active = !!col && col === this.sortBy;
      if (l.active !== active) l.active = active;
      const order = active ? this.sortOrder : 'none';
      if (l.order !== order) l.order = order;
      // aria-sort lives on the columnheader CELL (it is ignored on the sort
      // label's role="button"); sortable-but-inactive columns expose "none".
      const cell = l.closest('md-table-cell');
      if (cell) {
        const ariaSort = !active || order === 'none' ? 'none' : order === 'asc' ? 'ascending' : 'descending';
        if (cell.getAttribute('aria-sort') !== ariaSort) cell.setAttribute('aria-sort', ariaSort);
      }
    }
  }

  private handleSlotChange = () => {
    this.syncRows();
    this.syncSortLabels();
    this.recomputeSelection(false);
  };

  /** Best-effort column count for the skeleton loader. */
  private get columnCount(): number {
    if (this.columns > 0) return this.columns;
    if (this.columnTemplate) {
      const t = this.columnTemplate.trim();
      const m = t.match(/repeat\(\s*(\d+)/);
      if (m) return parseInt(m[1], 10);
      return t.split(/\s+/).filter(Boolean).length || 1;
    }
    const firstRow = this.el.querySelector('md-table-row');
    return firstRow ? firstRow.querySelectorAll('md-table-cell').length || 1 : 1;
  }

  /** Skeleton body rows: one shimmer bar PER COLUMN (fills the row, on the
   *  shared subgrid tracks), varied widths for a natural look. */
  private renderSkeletonRows() {
    const cols = Math.max(1, this.columnCount);
    return Array.from({ length: Math.max(1, this.loadingRows) }).map((_, r) => (
      <div class="md-table__skeleton-row" part="skeleton-row" aria-hidden="true" key={`sk-${r}`}>
        {Array.from({ length: cols }).map((__, c) => (
          <span class="md-table__bar" key={`sk-${r}-${c}`} />
        ))}
      </div>
    ));
  }

  private renderEmpty() {
    return (
      <div class="md-table__empty" part="empty">
        <slot name="empty">
          <span class="md-table__empty-text">No data</span>
        </slot>
      </div>
    );
  }

  render() {
    // Template resolution: explicit prop → public CSS var (in stylesheet
    // fallback chain) → derived-from-first-row count.
    const style: { [k: string]: string } = {};
    if (this.columnTemplate) {
      style['--_columns-template'] = this.columnTemplate;
    } else if (this.columns > 0) {
      style['--_columns-template'] = `repeat(${this.columns}, minmax(0, 1fr))`;
    } else {
      const firstRow = this.el.querySelector('md-table-row');
      const count = firstRow ? firstRow.querySelectorAll('md-table-cell').length : 0;
      if (count > 0) style['--_derived-template'] = `repeat(${count}, minmax(0, 1fr))`;
    }
    if (this.minWidth) style['--_min-width'] = this.minWidth;
    // ARIA for the structural table element (see host comment). When any row
    // is expandable the container is a `treegrid` rather than a plain `table`
    // so those rows' `aria-expanded` is valid (aria-conditional-attr); every
    // other property below is shared by both roles.
    const tableAria = {
      role: this.hasExpandableRow ? 'treegrid' : 'table',
      'aria-label': this.label || this.caption || 'Data table',
      'aria-description': this.summary || null,
      'aria-busy': this.loading ? 'true' : null,
      // Header + foot rows count toward the ARIA row total.
      'aria-rowcount':
        this.rowCount > 0
          ? String(
              this.rowCount +
                this.el.querySelectorAll('md-table-head md-table-row, md-table-foot md-table-row').length,
            )
          : null,
    };

    return (
      <Host
        class={{
          'md-table': true,
          [`md-table--density-${this.density}`]: typeof this.density === 'string',
          'md-table--sticky-header': this.stickyHeader,
          'md-table--sticky-footer': this.stickyFooter,
          'md-table--striped': this.striped,
          'md-table--no-dividers': this.noDividers,
          'md-table--hoverable': this.hoverable,
          'md-table--loading': this.loading,
          [`md-table--loading-${this.loadingMode}`]: this.loading,
          'md-table--empty': this.empty,
        }}
        // The table / treegrid role lives on the inner STRUCTURAL wrapper, not
        // the host: the table content model admits only rowgroups/rows, and the
        // host also hosts the caption, live region, loading overlay and empty
        // state (axe aria-required-children).
        style={style}
      >
        {/* Persistent polite live region: announces the empty state appearing.
            NO role="status" — an explicit status role is an invalid child of
            role="table" (axe aria-required-children); a bare aria-live span
            announces identically without entering the table content model. */}
        <span class="md-table__sr-status" aria-live="polite">
          {this.srAnnouncement}
        </span>
        {/* Caption is VISUAL only: its text names the table via aria-label
            (IDREFs can't cross the shadow boundary, and axe rejects
            role="caption" as a table child) — aria-hidden avoids the name
            being announced twice. */}
        {this.caption && (
          <div class="md-table__caption" part="caption" aria-hidden="true">
            {this.caption}
          </div>
        )}

        {this.frozenHeader ? (
          // Frozen header: the header grid sits above a vertically-scrolling
          // body grid, so the scrollbar spans only the body. Both grids share
          // the column tracks (syncFrozenColumns copies the body's resolved
          // pixel tracks onto the header, which also reserves the body's
          // scrollbar gutter on the header). Horizontal scroll is mirrored.
          <div class="md-table__frozen" {...tableAria}>
            <div
              class="md-table__head-scroll"
              role="presentation"
              ref={(el) => (this.headScrollEl = el as HTMLElement)}
            >
              <div
                class="md-table__grid md-table__grid--head"
                part="header-grid"
                ref={(el) => (this.headGridEl = el as HTMLElement)}
              >
                <slot name="head" onSlotchange={this.handleSlotChange}></slot>
              </div>
            </div>
            <div
              class="md-table__body-scroll"
              // Keyboard users must be able to scroll the capped body without
              // a pointer (WAI: scrollable region), hence the tab stop. A
              // focusable element may not sit as a bare child of role="table"
              // (axe aria-required-children — only rowgroup/row are allowed),
              // so this wrapper IS the body's rowgroup: role="rowgroup" is a
              // required child of table, so axe walks THROUGH it to the rows
              // even though it is a scroll tab stop. The slotted md-table-body/
              // md-table-foot inside drop to presentation (see syncRows) so
              // their rows promote here instead of nesting a second rowgroup.
              role="rowgroup"
              tabindex="0"
              ref={(el) => (this.bodyScrollEl = el as HTMLElement)}
              onScroll={this.onBodyScroll}
              onWheel={this.onBodyWheel}
              onKeyDown={this.onBodyKeyDown}
            >
              <div
                class="md-table__grid md-table__grid--body"
                part="grid"
                // Layout-only grid between the rowgroup wrapper and the rows.
                role="presentation"
                ref={(el) => (this.bodyGridEl = el as HTMLElement)}
              >
                <slot onSlotchange={this.handleSlotChange}></slot>
                {this.loading && this.loadingMode === 'skeleton' && this.renderSkeletonRows()}
              </div>
              {/* Frozen mode: empty message lives inside the body scroll area so
                  it sits directly under the header and fills the body. */}
              {this.empty && !this.loading && this.renderEmpty()}
            </div>
            {/* Custom, always-visible horizontal scrollbar (JS-toggled when the
                body overflows) — replaces the invisible native overlay bar. */}
            <div
              class="md-table__hscroll"
              part="hscrollbar"
              aria-hidden="true"
              ref={(el) => (this.hTrackEl = el as HTMLElement)}
            >
              <div
                class="md-table__hscroll-thumb"
                part="hscrollbar-thumb"
                ref={(el) => (this.hThumbEl = el as HTMLElement)}
                onPointerDown={this.onHThumbPointerDown}
                onPointerMove={this.onHThumbPointerMove}
                onPointerUp={this.onHThumbPointerUp}
                onPointerCancel={this.onHThumbPointerUp}
              ></div>
            </div>
            {/* Custom vertical OVERLAY scrollbar — floats over the rows' right
                edge (no reserved gutter, rows stay full width). */}
            <div
              class="md-table__vscroll"
              part="vscrollbar"
              aria-hidden="true"
              ref={(el) => (this.vTrackEl = el as HTMLElement)}
            >
              <div
                class="md-table__vscroll-thumb"
                part="vscrollbar-thumb"
                ref={(el) => (this.vThumbEl = el as HTMLElement)}
                onPointerDown={this.onVThumbPointerDown}
                onPointerMove={this.onVThumbPointerMove}
                onPointerUp={this.onVThumbPointerUp}
                onPointerCancel={this.onVThumbPointerUp}
              ></div>
            </div>
          </div>
        ) : (
          <div class="md-table__grid" part="grid" {...tableAria}>
            <slot onSlotchange={this.handleSlotChange}></slot>
            {this.loading && this.loadingMode === 'skeleton' && this.renderSkeletonRows()}
          </div>
        )}

        {this.loading && this.loadingMode === 'overlay' && (
          <div class="md-table__loading" part="loading" aria-hidden="true">
            {/* `loader` is the library-wide name for "swap the loading affordance";
                `loading` is kept as the older alias. Nesting them means either
                works — the outer slot falls back to the inner one, which falls
                back to the default below — and `loader` wins if both are given. */}
            <slot name="loader">
              <slot name="loading">
              <div class="md-table__progress" part="progress">
                <md-progress-indicator variant="linear" indeterminate aria-label="Loading"></md-progress-indicator>
              </div>
              <div class="md-table__scrim" />
            </slot>
            </slot>
          </div>
        )}

        {/* Non-frozen: empty message is a sibling that flex-fills below the grid. */}
        {this.empty && !this.loading && !this.frozenHeader && this.renderEmpty()}
      </Host>
    );
  }
}

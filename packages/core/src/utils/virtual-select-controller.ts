/**
 * `VirtualSelectController` — the shared virtualization engine for `md-select`
 * and `md-multi-select`, so neither component duplicates the window math,
 * scroll wiring, or the `VirtualMenuProvider` glue.
 *
 * It owns a `WasmOptionStore` (the dataset, packed in WASM memory) and the
 * current scroll window. The host component supplies a tiny adapter
 * (`queryItem` + `requestRender`) and reads the controller's public window
 * fields from its `render()`.
 */
import { computeWindow, DEFAULT_MAX_SCROLL_HEIGHT } from './virtual-window';

/** Floor under which a measured scrollHeight cannot be a genuine browser
 *  element-height clamp (real clamps are millions of px — Chrome ~33.5M,
 *  Firefox ~17.8M) — it just means layout wasn't ready (see detectScrollCap). */
const MIN_PLAUSIBLE_SCROLL_CAP = 1_000_000;
import {
  FilterMode,
  isWasmSupported,
  VirtualRow,
  WasmOptionStore,
} from './wasm-option-store';
import { isRowSource, OptionRowSource, SelectOptionInit } from './select-options';
import { VirtualMenuProvider } from './types';

// Larger overscan than a typical virtual list: in the scaled regime a single
// scroll frame can advance many rows, and render is async, so extra buffered
// rows above/below the fold keep the body from flashing blank on fast scrolls.
const OVERSCAN = 8;
const DEFAULT_ROW_HEIGHT = 48;
const DEFAULT_VIEWPORT_HEIGHT = 320;
// Extra px to keep a keyboard-revealed row clear of the viewport's top/bottom
// edge. Historically 32px to clear md-scroll-shadow's edge fade; the scroll
// shadow was removed, so a revealed row can sit flush against the edge (0). Kept
// as a named knob in case a future edge treatment needs slack again.
const EDGE_SCRIM_PAD = 0;

export interface VirtualSelectHost {
  /** The rendered `md-menu-item` for a filtered index, from the host's shadow DOM. */
  queryItem(filteredIndex: number): HTMLElement | null;
  /** Re-render the host (it reads the controller's window fields). */
  requestRender(): void;
}

export class VirtualSelectController {
  readonly store = new WasmOptionStore();

  /** True once a dataset is loaded and the component should render windowed. */
  active = false;
  /** First filtered index currently rendered. */
  windowStart = 0;
  /** The decoded rows in the current window. */
  windowRows: VirtualRow[] = [];
  /** Spacer heights (px) that preserve the full scroll height. */
  topPad = 0;
  bottomPad = 0;
  /** Current filtered row count. */
  filteredLength = 0;
  /** Effective fixed row height (measured or overridden). */
  rowHeight = DEFAULT_ROW_HEIGHT;

  private fixedRowHeight?: number;
  private viewportEl?: HTMLElement;
  private scrollRaf = 0;

  /**
   * The browser's observed maximum element height. Browsers clamp very tall
   * elements (a few-million-row list × row height blows past the ~16–33M px
   * cap), so the spacers can't reproduce the true height. We start optimistic
   * and shrink to the real clamp once we can measure it (see `detectScrollCap`).
   */
  private browserMaxScroll = Infinity;
  /** The scrollable height the last `recompute` asked the spacers to produce. */
  private intendedScrollHeight = 0;
  private detectRaf = 0;
  /** Retries left for detectScrollCap while layout isn't ready (see below). */
  private detectRetries = 0;

  /**
   * Scaled-regime keyboard nav: the first row to render, pinned independent of
   * the (too-coarse) integer scrollTop. -1 means the window is scroll-driven.
   */
  private navAnchorFirstRow = -1;
  /** The scroll offset the last `recompute` laid the window out for. */
  private usedScrollTop = 0;

  constructor(private host: VirtualSelectHost) {}

  /** Ceiling on the spacer height: our safe default, lowered by any real clamp. */
  private effectiveMaxScroll(): number {
    return Math.min(DEFAULT_MAX_SCROLL_HEIGHT, this.browserMaxScroll);
  }

  setFixedRowHeight(px?: number): void {
    this.fixedRowHeight = px && px > 0 ? px : undefined;
    if (this.fixedRowHeight) this.rowHeight = this.fixedRowHeight;
  }

  setFilterMode(mode: FilterMode): void {
    this.store.setFilterMode(mode);
  }

  /** Load a dataset into WASM memory. Returns false if WASM is unavailable. */
  async load(source: ReadonlyArray<SelectOptionInit> | OptionRowSource): Promise<boolean> {
    const count = isRowSource(source) ? source.count : source.length;
    if (!isWasmSupported() || count === 0) return false;
    try {
      await this.store.ensureReady();
    } catch {
      return false;
    }
    await this.store.load(source);
    this.active = true;
    this.filteredLength = this.store.length;
    this.recompute(this.viewportEl?.scrollTop ?? 0);
    return true;
  }

  /** Apply a filter query and reset the scroll to the top. */
  setQuery(query: string): void {
    if (!this.active) return;
    this.filteredLength = this.store.setQuery(query);
    this.navAnchorFirstRow = -1;
    if (this.viewportEl) this.viewportEl.scrollTop = 0;
    this.recompute(0);
  }

  getLabels(values: ReadonlyArray<string>): Map<string, string> {
    return this.store.getLabels(values);
  }

  reset(): void {
    this.store.reset();
    this.active = false;
    this.windowRows = [];
    this.filteredLength = 0;
    this.windowStart = 0;
    this.topPad = 0;
    this.bottomPad = 0;
    this.navAnchorFirstRow = -1;
  }

  // ── Viewport wiring (call when the menu opens / closes) ──────

  async attachViewport(getViewport: () => Promise<HTMLElement | null>): Promise<void> {
    this.detachViewport();
    const vp = await getViewport();
    this.viewportEl = vp ?? undefined;
    if (this.viewportEl) {
      this.viewportEl.addEventListener('scroll', this.onScroll, { passive: true });
      this.measureRowHeight();
      this.recompute(this.viewportEl.scrollTop);
      this.detectRetries = 60; // ~2s of rAF pairs — spacers may render late
      this.detectScrollCap();
    }
  }

  detachViewport(): void {
    if (this.scrollRaf) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
    if (this.detectRaf) {
      cancelAnimationFrame(this.detectRaf);
      this.detectRaf = 0;
    }
    this.viewportEl?.removeEventListener('scroll', this.onScroll);
    this.viewportEl = undefined;
  }

  private onScroll = () => {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      const vp = this.viewportEl;
      if (!vp) return;
      // Tell our own programmatic scroll (driving an anchored keyboard-nav
      // window) from a genuine user scroll by value: if the offset still matches
      // what the current window was laid out for, keep the anchor; otherwise the
      // user scrolled, so resume scroll-driven windowing. (A value check is
      // robust to event coalescing/ordering, unlike a one-shot flag.)
      if (this.navAnchorFirstRow >= 0 && Math.abs(vp.scrollTop - this.usedScrollTop) <= 1) {
        return;
      }
      this.navAnchorFirstRow = -1;
      this.recompute(vp.scrollTop);
    });
  };

  private measureRowHeight(): void {
    if (this.fixedRowHeight) {
      this.rowHeight = this.fixedRowHeight;
      return;
    }
    const first = this.host.queryItem(this.windowStart);
    const h = first?.offsetHeight ?? 0;
    if (h > 0 && h !== this.rowHeight) {
      this.rowHeight = h;
      if (this.viewportEl) this.recompute(this.viewportEl.scrollTop);
    }
  }

  private recompute(scrollTop: number): void {
    const vpH = this.viewportEl?.clientHeight || DEFAULT_VIEWPORT_HEIGHT;
    const calc = computeWindow(
      scrollTop,
      vpH,
      this.rowHeight,
      this.filteredLength,
      OVERSCAN,
      this.effectiveMaxScroll(),
      this.navAnchorFirstRow,
    );
    this.windowStart = calc.start;
    this.topPad = calc.topPad;
    this.bottomPad = calc.bottomPad;
    this.intendedScrollHeight = calc.scrollHeight;
    this.usedScrollTop = calc.scrollTop;
    this.windowRows = this.store.getWindow(calc.start, calc.end - calc.start);
    this.host.requestRender();
  }

  /**
   * Detect the browser's real maximum element height. After the spacers lay
   * out, if the viewport's `scrollHeight` came back shorter than we asked for,
   * the browser clamped it — and that clamp *is* the true maximum, so adopt it
   * and re-window against it. Runs a couple of frames after attach so the
   * (async) spacer render has committed; idempotent and only ever shrinks.
   */
  private detectScrollCap(): void {
    if (this.detectRaf) cancelAnimationFrame(this.detectRaf);
    this.detectRaf = requestAnimationFrame(() => {
      this.detectRaf = requestAnimationFrame(() => {
        this.detectRaf = 0;
        const vp = this.viewportEl;
        if (!vp) return;
        const measured = vp.scrollHeight;
        if (
          measured > 0 &&
          measured + 2 < this.intendedScrollHeight &&
          measured < this.browserMaxScroll
        ) {
          // A small reading is NOT a browser clamp — the spacers simply have
          // not been laid out yet (e.g. the menu opened during a dataset pack
          // and still showed the uncapped busy bar when we measured). Locking
          // it in would permanently collapse the scroll geometry (the cap
          // never grows back), so retry instead.
          if (measured < MIN_PLAUSIBLE_SCROLL_CAP) {
            if (this.detectRetries-- > 0) this.detectScrollCap();
            return;
          }
          this.browserMaxScroll = measured;
          this.recompute(vp.scrollTop);
        }
      });
    });
  }

  // ── VirtualMenuProvider (md-menu drives nav through this) ────

  readonly provider: VirtualMenuProvider = {
    count: () => this.filteredLength,
    labelAt: (i) => this.store.labelAt(i),
    isDisabledAt: (i) => this.store.disabledAt(i),
    ensureVisible: (i) => this.ensureVisible(i),
    domItemForIndex: (i) => this.host.queryItem(i),
    findPrefix: (buffer, from) => this.store.findLabelPrefix(buffer, from),
  };

  private async ensureVisible(filteredIndex: number): Promise<void> {
    const vp = this.viewportEl;
    if (!vp) return;
    const clientH = vp.clientHeight || DEFAULT_VIEWPORT_HEIGHT;
    const realHeight = this.filteredLength * this.rowHeight;

    if (realHeight <= this.effectiveMaxScroll()) {
      // Exact regime: pixel offset is the row index times the row height.
      this.navAnchorFirstRow = -1;
      const top = filteredIndex * this.rowHeight;
      const bottom = top + this.rowHeight;
      // Reveal with EDGE_SCRIM_PAD of slack so the row clears the edge fade.
      // Clamped to [0, maxScroll]: rows at the very top/bottom — where no scrim
      // shows — still seat flush.
      const maxScroll = Math.max(0, vp.scrollHeight - clientH);
      if (top - EDGE_SCRIM_PAD < vp.scrollTop) {
        vp.scrollTop = Math.max(0, top - EDGE_SCRIM_PAD);
      } else if (bottom + EDGE_SCRIM_PAD > vp.scrollTop + clientH) {
        vp.scrollTop = Math.min(maxScroll, bottom + EDGE_SCRIM_PAD - clientH);
      }
      this.recompute(vp.scrollTop);
    } else {
      // Scaled regime: integer scrollTop can't address single rows (millions of
      // rows compressed into a capped height — one pixel can be dozens of rows).
      // When the target row isn't already on screen, pin the window to an anchor
      // and let `computeWindow` choose the matching scroll offset, then apply it.
      const visibleRows = Math.max(1, Math.floor(clientH / this.rowHeight));
      const visibleCount = Math.ceil(clientH / this.rowHeight);
      const maxFirstRow = Math.max(0, this.filteredLength - visibleCount);
      // First visible row: take it exactly from the anchor when the window is
      // anchor-driven (deriving it from a fractional scrollTop drifts by a row);
      // fall back to the live geometry only when scroll-driven.
      const firstVisible =
        this.navAnchorFirstRow >= 0
          ? this.navAnchorFirstRow
          : this.windowStart +
            Math.max(0, Math.round((vp.scrollTop - this.topPad) / this.rowHeight));
      const lastVisible = firstVisible + visibleRows - 1;

      // Re-anchor when the focused row is outside the visible range OR within
      // `padRows` of either edge. The edge check matters even when the row is
      // already visible: navigating up one row at a time makes the focused row
      // the *first* visible row (flush against the top), which is never "outside"
      // the range — so without it the top scroll-shadow scrim would still cover
      // the focused row. Mirrors the exact-regime branch above.
      const padRows = Math.ceil(EDGE_SCRIM_PAD / this.rowHeight);
      if (
        filteredIndex < firstVisible + padRows ||
        filteredIndex > lastVisible - padRows
      ) {
        // Reveal `padRows` clear of the top (scrolling up) or bottom (scrolling
        // down) edge, clamped to [0, maxFirstRow] so the list ends — where no
        // scrim shows — still seat the row flush.
        this.navAnchorFirstRow = Math.min(
          maxFirstRow,
          Math.max(
            0,
            filteredIndex < firstVisible + padRows
              ? filteredIndex - padRows
              : filteredIndex - visibleRows + 1 + padRows,
          ),
        );
      }
      this.recompute(vp.scrollTop);
      // Sync the browser scroll to the offset the (anchored) window was laid out
      // for. Clamp to the viewport's real max — the capped element can render a
      // hair shorter than we asked (scroll-shadow sentinels), and overshooting by
      // even a pixel near the end gets clamped by the browser — then adopt
      // whatever it actually applied, so the scroll guard and the next "first
      // visible" never drift out of sync and clear the anchor.
      if (this.navAnchorFirstRow >= 0) {
        const maxScroll = Math.max(0, vp.scrollHeight - clientH);
        const target = Math.min(Math.round(this.usedScrollTop), maxScroll);
        if (target !== Math.round(vp.scrollTop)) {
          vp.scrollTop = target;
        }
        this.usedScrollTop = vp.scrollTop;
      }
    }
    // Wait for the host to render the target row into the window so the menu
    // can move real focus onto it.
    for (let tries = 0; tries < 8; tries++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (this.host.queryItem(filteredIndex)) return;
    }
  }
}

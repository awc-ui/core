/**
 * `WasmOptionStore` — the single integration point both `md-select` and
 * `md-multi-select` use for virtualized, WASM-backed option data.
 *
 * It hides the engine ABI entirely (see `wasm/engine-abi.ts`): the dataset is
 * packed into WASM linear memory at `load()` time and JS keeps no copy, so a
 * select can hold millions of options while only ever decoding the ~visible
 * window back out per render. Filtering/typeahead run inside WASM.
 *
 * One instance per component → one `WebAssembly.Instance` → isolated memory.
 */
import {
  EngineExports,
  FILTER_SUBSTRING,
  instantiateEngine,
} from '../wasm/engine-abi';
import { isRowSource, OptionRowSource, SelectOptionInit } from './select-options';

/** A row read back out of the store for rendering. */
export interface VirtualRow {
  /** Absolute row index in the dataset (stable across filtering). */
  index: number;
  value: string;
  label: string;
  disabled: boolean;
  /** Material Symbols leading-icon glyph, or '' when the dataset has no icons. */
  icon: string;
  /** Secondary line under the label, or '' when the dataset has no supporting text. */
  supportingText: string;
}

/** Filter strategy, mapped to the engine's `setQuery` mode. */
export type FilterMode = 'substring' | 'prefix' | 'fuzzy';

const FILTER_MODE: Record<FilterMode, number> = {
  substring: 0,
  prefix: 1,
  fuzzy: 2,
};

const DISABLED_FLAG = 1;

/**
 * Time budget (ms) for one main-thread slice while packing. Bounding every
 * slice to roughly a frame keeps busy animations (the loading indicator)
 * fluid during multi-million-row loads — a fixed row-count chunk (formerly
 * 250k rows) blocked 100ms+ per chunk and dropped the spinner to ~7fps.
 */
const LOAD_SLICE_BUDGET_MS = 6;

/** Rows between clock reads inside a slice (amortises performance.now()).
 *  Small enough that one stride stays well inside the slice budget even with
 *  an expensive consumer getRow (~1.4µs/row measured → ~3ms per stride). */
const LOAD_STRIDE = 2_048;

/** Millisecond clock that also works in non-DOM (spec) environments. */
const nowMs: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

/** Yield to the event loop so the browser can handle input mid-load. NB:
 *  scheduler.yield() continuations PREEMPT rendering, so this alone does not
 *  produce paints — see yieldForPaint(). */
function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Work window between paint yields. Deliberately UNDER a 60Hz frame (16.7ms):
 * we resume ~1ms after a paint, so a 16ms window would finish just past the
 * next vsync and miss it (measured: alternating 17/33ms gaps → 25ms average).
 * 12ms of work + up to a stride of overshoot still lands the rAF request
 * before the deadline, giving a consistent ~16.7ms cadence.
 */
const PAINT_INTERVAL_MS = 12;

/**
 * Yield in a way that guarantees the browser can PAINT when a frame is due —
 * scheduler.yield continuations outprioritise rendering, which froze the
 * loading animation to ~10fps during multi-million-row packs. When a frame is
 * due, await requestAnimationFrame (a real rendering opportunity); otherwise
 * take the cheap yield.
 */
async function yieldForPaint(lastPaint: { t: number }): Promise<void> {
  if (
    typeof requestAnimationFrame === 'function' &&
    nowMs() - lastPaint.t >= PAINT_INTERVAL_MS
  ) {
    // Resume AFTER the paint, not inside the rAF callback: resolving in rAF
    // would continue the pack as a microtask still inside the rendering-steps
    // task — the paint would then wait behind the next 16ms of work (measured
    // as ~33ms frame gaps). rAF marks the frame; the nested macrotask lands
    // once rendering has actually flushed.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
    lastPaint.t = nowMs();
    return;
  }
  await yieldToMain();
}

/** True when this runtime can host the engine (false in non-WASM SSR/test envs). */
export function isWasmSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
}

/**
 * UTF-8 byte length of a string, matching `TextEncoder` semantics (lone
 * surrogates count as the 3-byte U+FFFD replacement). Allocation-free, so the
 * load sizing pass over millions of rows stays cheap.
 */
export function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes += 1;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3; // lone high surrogate → U+FFFD
      }
    } else {
      bytes += 3; // BMP ≥ 0x800, or lone low surrogate → U+FFFD
    }
  }
  return bytes;
}

export class WasmOptionStore {
  private engine?: EngineExports;
  private ready?: Promise<void>;
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  private _length = 0;
  private _total = 0;
  private mode: number = FILTER_SUBSTRING;

  /** Lazily instantiate the engine (memoized). */
  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = isWasmSupported()
        ? instantiateEngine().then((e) => {
            this.engine = e;
          })
        : Promise.reject(new Error('WebAssembly is not available in this environment'));
    }
    return this.ready;
  }

  get ready$(): boolean {
    return !!this.engine;
  }

  /** Current filtered row count. */
  get length(): number {
    return this._length;
  }

  /** Total rows loaded (ignores the active filter). */
  get total(): number {
    return this._total;
  }

  setFilterMode(mode: FilterMode): void {
    this.mode = FILTER_MODE[mode] ?? FILTER_SUBSTRING;
  }

  private mem(): Uint8Array {
    // Re-derived on every read batch: a prior `memory.grow` detaches the old
    // ArrayBuffer, so a cached view would throw.
    return new Uint8Array(this.engine!.memory.buffer);
  }

  /**
   * Load a dataset into WASM memory. Accepts either a materialised array or a
   * row factory (`{ count, getRow }`) — the factory path never holds more than
   * one row in JS at a time, so it scales to tens of millions of options. Two
   * passes over the input: size, then encode each row's UTF-8 directly into the
   * engine's buffers. JS references to the rows are not retained.
   */
  async load(source: ReadonlyArray<SelectOptionInit> | OptionRowSource): Promise<void> {
    await this.ensureReady();
    const e = this.engine!;

    let count: number;
    let at: (i: number) => SelectOptionInit;
    if (isRowSource(source)) {
      count = source.count;
      at = source.getRow;
    } else {
      count = source.length;
      at = (i) => source[i];
    }

    const lastPaint = { t: nowMs() };

    // Pass 1 — size the columns. TIME-SLICED with yields so a
    // multi-million-row load never blocks the main thread longer than about a
    // frame: the browser paints (fluid loading animation) and handles input
    // between slices. Icon / supporting-text totals stay 0 when the dataset
    // uses neither, so the engine skips those columns entirely.
    let valueBytesTotal = 0;
    let labelBytesTotal = 0;
    let iconBytesTotal = 0;
    let supportBytesTotal = 0;
    for (let i = 0; i < count; ) {
      const sliceStart = nowMs();
      do {
        const end = Math.min(count, i + LOAD_STRIDE);
        for (; i < end; i++) {
          const r = at(i);
          valueBytesTotal += utf8ByteLength(r.value);
          labelBytesTotal += utf8ByteLength(r.label ?? r.value);
          if (r.icon) iconBytesTotal += utf8ByteLength(r.icon);
          if (r.supportingText) supportBytesTotal += utf8ByteLength(r.supportingText);
        }
      } while (i < count && nowMs() - sliceStart < LOAD_SLICE_BUDGET_MS);
      if (i < count) await yieldForPaint(lastPaint);
    }

    e.reserve(count, valueBytesTotal, labelBytesTotal, iconBytesTotal, supportBytesTotal);

    // Pass 2 — encode each row's UTF-8 straight into the engine buffers, also
    // time-sliced + yielding. The memory view is re-derived per slice: appendRow
    // never grows memory, but a yield could let other work run in between. Read
    // all four write pointers before appendRow — it advances every cursor.
    for (let i = 0; i < count; ) {
      const sliceStart = nowMs();
      const mem = this.mem();
      do {
        const end = Math.min(count, i + LOAD_STRIDE);
        for (; i < end; i++) {
          const r = at(i);
          const vp = e.valueWritePtr();
          const v = this.enc.encodeInto(r.value, mem.subarray(vp));
          const lp = e.labelWritePtr();
          const l = this.enc.encodeInto(r.label ?? r.value, mem.subarray(lp));
          const ip = e.iconWritePtr();
          const ic =
            iconBytesTotal > 0 ? this.enc.encodeInto(r.icon ?? '', mem.subarray(ip)) : null;
          const sp = e.supportWritePtr();
          const sc =
            supportBytesTotal > 0
              ? this.enc.encodeInto(r.supportingText ?? '', mem.subarray(sp))
              : null;
          e.appendRow(
            v.written ?? 0,
            l.written ?? 0,
            ic?.written ?? 0,
            sc?.written ?? 0,
            r.disabled ? DISABLED_FLAG : 0,
          );
        }
      } while (i < count && nowMs() - sliceStart < LOAD_SLICE_BUDGET_MS);
      if (i < count) await yieldForPaint(lastPaint);
    }

    e.finalizeLoad(); // allocates the value index — may grow memory

    this._total = e.totalCount();
    this._length = e.filteredCount();
  }

  /** Write a string into the engine's scratch buffer; returns bytes written. */
  private writeScratch(s: string): number {
    const e = this.engine!;
    const cap = e.queryCapacity();
    const ptr = e.queryPtr();
    const { written } = this.enc.encodeInto(s, this.mem().subarray(ptr, ptr + cap));
    return written ?? 0;
  }

  /** Apply a filter query. Returns the new filtered length. */
  setQuery(query: string): number {
    if (!this.engine) return 0;
    const len = this.writeScratch(query);
    this._length = this.engine.setQuery(len, this.mode);
    return this._length;
  }

  private decodeRow(absIndex: number, mem: Uint8Array): VirtualRow {
    const e = this.engine!;
    const vp = e.valuePtr(absIndex);
    const vl = e.valueLen(absIndex);
    const lp = e.labelPtr(absIndex);
    const ll = e.labelLen(absIndex);
    // Icon / supporting-text columns return 0-length ranges when the dataset
    // didn't supply them, so these decode to '' at no extra packing cost.
    const ip = e.iconPtr(absIndex);
    const il = e.iconLen(absIndex);
    const sp = e.supportPtr(absIndex);
    const sl = e.supportLen(absIndex);
    return {
      index: absIndex,
      value: this.dec.decode(mem.subarray(vp, vp + vl)),
      label: this.dec.decode(mem.subarray(lp, lp + ll)),
      disabled: (e.rowFlags(absIndex) & DISABLED_FLAG) !== 0,
      icon: il > 0 ? this.dec.decode(mem.subarray(ip, ip + il)) : '',
      supportingText: sl > 0 ? this.dec.decode(mem.subarray(sp, sp + sl)) : '',
    };
  }

  /** Decode `count` rows starting at filtered position `start`. */
  getWindow(start: number, count: number): VirtualRow[] {
    if (!this.engine) return [];
    const e = this.engine;
    const mem = this.mem();
    const out: VirtualRow[] = [];
    const from = Math.max(0, start);
    const to = Math.min(this._length, start + count);
    for (let fi = from; fi < to; fi++) {
      const abs = e.rowAt(fi);
      if (abs >= 0) out.push(this.decodeRow(abs, mem));
    }
    return out;
  }

  /** Decode a single row at filtered position `filteredIndex`, or null. */
  getRow(filteredIndex: number): VirtualRow | null {
    if (!this.engine) return null;
    const abs = this.engine.rowAt(filteredIndex);
    if (abs < 0) return null;
    return this.decodeRow(abs, this.mem());
  }

  /** Map a filtered position to its absolute row index, or -1. */
  rowAt(filteredIndex: number): number {
    return this.engine ? this.engine.rowAt(filteredIndex) : -1;
  }

  /** Disabled flag for a filtered position — flag-only, no string decode. */
  disabledAt(filteredIndex: number): boolean {
    if (!this.engine) return false;
    const abs = this.engine.rowAt(filteredIndex);
    if (abs < 0) return false;
    return (this.engine.rowFlags(abs) & DISABLED_FLAG) !== 0;
  }

  /** Label for a filtered position — decodes a single label. */
  labelAt(filteredIndex: number): string {
    if (!this.engine) return '';
    const abs = this.engine.rowAt(filteredIndex);
    if (abs < 0) return '';
    const lp = this.engine.labelPtr(abs);
    const ll = this.engine.labelLen(abs);
    return this.dec.decode(this.mem().subarray(lp, lp + ll));
  }

  /**
   * Resolve labels for selected values that may be outside the current filter
   * (e.g. the trigger text / chips). O(1) per value via the engine's index.
   */
  getLabels(values: ReadonlyArray<string>): Map<string, string> {
    const result = new Map<string, string>();
    if (!this.engine) return result;
    const e = this.engine;
    for (const value of values) {
      const len = this.writeScratch(value);
      const abs = e.indexOfValue(len);
      if (abs >= 0) {
        const lp = e.labelPtr(abs);
        const ll = e.labelLen(abs);
        result.set(value, this.dec.decode(this.mem().subarray(lp, lp + ll)));
      }
    }
    return result;
  }

  /** Whether a value exists in the dataset. */
  has(value: string): boolean {
    if (!this.engine) return false;
    return this.engine.indexOfValue(this.writeScratch(value)) >= 0;
  }

  /**
   * Typeahead helper: first filtered position at/after `fromFilteredIndex`
   * whose label starts with `query` (wraps the filtered list). Returns a
   * filtered-list index, or -1.
   */
  findLabelPrefix(query: string, fromFilteredIndex: number): number {
    if (!this.engine) return -1;
    const len = this.writeScratch(query);
    return this.engine.findLabelPrefix(len, fromFilteredIndex);
  }

  /** Drop the dataset. */
  reset(): void {
    this.engine?.reset();
    this._length = 0;
    this._total = 0;
  }
}

// AssemblyScript source — compiled to WebAssembly by `asc` (see asconfig.json)
// and base64-inlined into `engine.wasm.ts` by scripts/build-wasm.mjs.
//
// This module is the *engine*, not the data: it holds an option dataset packed
// in WASM linear memory and runs filtering/search there, so the JS side only
// ever marshals the ~visible window of rows back across the boundary. It is
// compiled by `asc` only — excluded from tsc/Stencil (see tsconfig.json).
//
// Memory model (columnar, packed):
//   valueBytes / labelBytes  — all value / label strings concatenated, UTF-8
//   labelLower               — ASCII-lowercased copy of labelBytes (match column)
//   iconBytes / supportBytes — optional display columns (leading-icon glyph and
//                               secondary line), UTF-8; only allocated when the
//                               dataset actually uses them, so the common
//                               label-only case keeps its memory footprint
//   valueOff / labelOff / iconOff / supportOff
//                            — i32 offset tables, length rows+1; row r spans
//                               [off[r], off[r+1]) in the corresponding byte column
//   flags                    — one byte per row (bit0 = disabled)
//   filtered                 — compacted absolute indices passing the current query
//   hashTable                — open-addressing index over value hashes (indexOfValue)
//
// Strings go IN by JS writing UTF-8 directly into the byte columns at the write
// pointers, then calling appendRow. The visible window comes OUT via the per-row
// {value,label,icon,support,flags} getters. Case-insensitivity is ASCII-fold
// only (sufficient for v1 substring/prefix matching); non-ASCII case folding is
// not applied. Only the label column is searched — icon/support are display-only.

// ── Columns ────────────────────────────────────────────────────
let valueBytes: Uint8Array = new Uint8Array(0);
let labelBytes: Uint8Array = new Uint8Array(0);
let labelLower: Uint8Array = new Uint8Array(0);
let iconBytes: Uint8Array = new Uint8Array(0);
let supportBytes: Uint8Array = new Uint8Array(0);
let valueOff: Int32Array = new Int32Array(1);
let labelOff: Int32Array = new Int32Array(1);
let iconOff: Int32Array = new Int32Array(1);
let supportOff: Int32Array = new Int32Array(1);
let flags: Uint8Array = new Uint8Array(0);
let filtered: Int32Array = new Int32Array(0);

let rowCount: i32 = 0;
let valueCursor: i32 = 0;
let labelCursor: i32 = 0;
let iconCursor: i32 = 0;
let supportCursor: i32 = 0;
let filteredLen: i32 = 0;

// Display columns are opt-in: skipped entirely (no per-row offset table) unless
// the dataset has at least one non-empty icon / supporting-text value.
let hasIcon: bool = false;
let hasSupport: bool = false;

// Scratch buffer JS writes the query (or a value to look up) into.
const QUERY_CAP: i32 = 1024;
let queryBuf: Uint8Array = new Uint8Array(QUERY_CAP);
let queryLowerBuf: Uint8Array = new Uint8Array(QUERY_CAP);

// Previous query (lowercased) + mode. When the next query extends this one (the
// common case of typing forward), setQuery re-tests only the current match set
// instead of rescanning every row.
let lastQueryBuf: Uint8Array = new Uint8Array(QUERY_CAP);
let lastQueryLen: i32 = 0;
let lastMode: i32 = -1;

// Open-addressing hash index over value bytes → absolute row index.
let hashTable: Int32Array = new Int32Array(1);
let hashMask: i32 = 0;

function toLowerAscii(b: u8): u8 {
  return b >= 65 && b <= 90 ? b + 32 : b;
}

function fnv1a(buf: Uint8Array, start: i32, end: i32): u32 {
  let h: u32 = 2166136261;
  for (let i = start; i < end; i++) {
    h ^= <u32>buf[i];
    h = h * 16777619;
  }
  return h;
}

function rangesEqual(
  a: Uint8Array,
  aStart: i32,
  aEnd: i32,
  b: Uint8Array,
  bStart: i32,
  bEnd: i32,
): bool {
  if (aEnd - aStart != bEnd - bStart) return false;
  const n = aEnd - aStart;
  for (let i = 0; i < n; i++) {
    if (a[aStart + i] != b[bStart + i]) return false;
  }
  return true;
}

// ── Loading ────────────────────────────────────────────────────

/**
 * Allocate all columns up front. Must be called before appendRow. Pass 0 for
 * `iconBytesTotal` / `supportBytesTotal` to skip those display columns entirely
 * (no per-row offset table is allocated for an unused column).
 */
export function reserve(
  rows: i32,
  valueBytesTotal: i32,
  labelBytesTotal: i32,
  iconBytesTotal: i32,
  supportBytesTotal: i32,
): void {
  valueBytes = new Uint8Array(valueBytesTotal);
  labelBytes = new Uint8Array(labelBytesTotal);
  labelLower = new Uint8Array(labelBytesTotal);
  valueOff = new Int32Array(rows + 1);
  labelOff = new Int32Array(rows + 1);
  flags = new Uint8Array(rows);
  filtered = new Int32Array(rows);

  hasIcon = iconBytesTotal > 0;
  hasSupport = supportBytesTotal > 0;
  iconBytes = new Uint8Array(iconBytesTotal);
  supportBytes = new Uint8Array(supportBytesTotal);
  iconOff = new Int32Array(hasIcon ? rows + 1 : 1);
  supportOff = new Int32Array(hasSupport ? rows + 1 : 1);

  rowCount = 0;
  valueCursor = 0;
  labelCursor = 0;
  iconCursor = 0;
  supportCursor = 0;
  filteredLen = 0;
  valueOff[0] = 0;
  labelOff[0] = 0;
  iconOff[0] = 0;
  supportOff[0] = 0;
}

/** Pointer JS writes the next row's value bytes into (UTF-8). */
export function valueWritePtr(): usize {
  return valueBytes.dataStart + <usize>valueCursor;
}

/** Pointer JS writes the next row's label bytes into (UTF-8). */
export function labelWritePtr(): usize {
  return labelBytes.dataStart + <usize>labelCursor;
}

/** Pointer JS writes the next row's leading-icon bytes into (UTF-8). */
export function iconWritePtr(): usize {
  return iconBytes.dataStart + <usize>iconCursor;
}

/** Pointer JS writes the next row's supporting-text bytes into (UTF-8). */
export function supportWritePtr(): usize {
  return supportBytes.dataStart + <usize>supportCursor;
}

/** Commit a row from the bytes JS just wrote at the write pointers. */
export function appendRow(
  valueLen: i32,
  labelLen: i32,
  iconLen: i32,
  supportLen: i32,
  flag: u8,
): i32 {
  const row = rowCount;
  valueCursor += valueLen;
  valueOff[row + 1] = valueCursor;
  const lStart = labelCursor;
  for (let k = 0; k < labelLen; k++) {
    labelLower[lStart + k] = toLowerAscii(labelBytes[lStart + k]);
  }
  labelCursor += labelLen;
  labelOff[row + 1] = labelCursor;
  if (hasIcon) {
    iconCursor += iconLen;
    iconOff[row + 1] = iconCursor;
  }
  if (hasSupport) {
    supportCursor += supportLen;
    supportOff[row + 1] = supportCursor;
  }
  flags[row] = flag;
  rowCount = row + 1;
  return row;
}

function resetFilter(): void {
  for (let i = 0; i < rowCount; i++) filtered[i] = i;
  filteredLen = rowCount;
  lastQueryLen = 0; // next query must do a clean full scan
}

/** Build the value index and reset the filter to "all rows". */
export function finalizeLoad(): void {
  let cap = 1;
  while (cap < rowCount * 2) cap <<= 1;
  hashTable = new Int32Array(cap);
  hashMask = cap - 1;
  for (let i = 0; i < cap; i++) hashTable[i] = -1;

  for (let r = 0; r < rowCount; r++) {
    const start = valueOff[r];
    const end = valueOff[r + 1];
    const h = fnv1a(valueBytes, start, end);
    let slot = <i32>(h & <u32>hashMask);
    let duplicate = false;
    while (hashTable[slot] != -1) {
      const other = hashTable[slot];
      if (rangesEqual(valueBytes, valueOff[other], valueOff[other + 1], valueBytes, start, end)) {
        duplicate = true; // first occurrence wins
        break;
      }
      slot = (slot + 1) & hashMask;
    }
    if (!duplicate) hashTable[slot] = r;
  }
  resetFilter();
}

// ── Query scratch ──────────────────────────────────────────────
export function queryPtr(): usize {
  return queryBuf.dataStart;
}
export function queryCapacity(): i32 {
  return QUERY_CAP;
}

// ── Matchers (operate on the lowercased label column) ──────────
function substringMatch(start: i32, end: i32, qlen: i32): bool {
  const hayLen = end - start;
  if (qlen > hayLen) return false;
  const last = hayLen - qlen;
  for (let i = 0; i <= last; i++) {
    let j = 0;
    while (j < qlen && labelLower[start + i + j] == queryLowerBuf[j]) j++;
    if (j == qlen) return true;
  }
  return false;
}

function prefixMatch(start: i32, end: i32, qlen: i32): bool {
  if (qlen > end - start) return false;
  for (let j = 0; j < qlen; j++) {
    if (labelLower[start + j] != queryLowerBuf[j]) return false;
  }
  return true;
}

function subseqMatch(start: i32, end: i32, qlen: i32): bool {
  let j = 0;
  for (let i = start; i < end && j < qlen; i++) {
    if (labelLower[i] == queryLowerBuf[j]) j++;
  }
  return j == qlen;
}

/**
 * Filter rows by the query in the scratch buffer.
 * mode: 0 = substring (default), 1 = prefix, 2 = fuzzy (subsequence).
 * Returns the number of matching rows.
 */
export function setQuery(queryLen: i32, mode: i32): i32 {
  if (queryLen <= 0) {
    resetFilter();
    lastMode = mode;
    return filteredLen;
  }
  if (queryLen > QUERY_CAP) queryLen = QUERY_CAP;
  for (let i = 0; i < queryLen; i++) queryLowerBuf[i] = toLowerAscii(queryBuf[i]);

  // Incremental narrowing: if the mode is unchanged and the new query extends
  // the previous one (the previous query is a prefix of this one), every row
  // that can match now is already in `filtered` — so re-test just that set
  // rather than rescanning all rows. Holds for substring, prefix, and fuzzy:
  // in each, matches(prefix + more) ⊆ matches(prefix).
  let narrow = lastMode == mode && lastQueryLen > 0 && queryLen >= lastQueryLen;
  if (narrow) {
    for (let i = 0; i < lastQueryLen; i++) {
      if (lastQueryBuf[i] != queryLowerBuf[i]) {
        narrow = false;
        break;
      }
    }
  }

  if (narrow) {
    // Re-test the current match set, compacting in place (write ≤ read).
    let w = 0;
    for (let k = 0; k < filteredLen; k++) {
      const r = filtered[k];
      const start = labelOff[r];
      const end = labelOff[r + 1];
      let match: bool;
      if (mode == 1) match = prefixMatch(start, end, queryLen);
      else if (mode == 2) match = subseqMatch(start, end, queryLen);
      else match = substringMatch(start, end, queryLen);
      if (match) {
        filtered[w] = r;
        w++;
      }
    }
    filteredLen = w;
  } else {
    filteredLen = 0;
    for (let r = 0; r < rowCount; r++) {
      const start = labelOff[r];
      const end = labelOff[r + 1];
      let match: bool;
      if (mode == 1) match = prefixMatch(start, end, queryLen);
      else if (mode == 2) match = subseqMatch(start, end, queryLen);
      else match = substringMatch(start, end, queryLen);
      if (match) {
        filtered[filteredLen] = r;
        filteredLen++;
      }
    }
  }

  // Remember this query so the next call can narrow against it.
  for (let i = 0; i < queryLen; i++) lastQueryBuf[i] = queryLowerBuf[i];
  lastQueryLen = queryLen;
  lastMode = mode;
  return filteredLen;
}

// ── Read-out ───────────────────────────────────────────────────
export function totalCount(): i32 {
  return rowCount;
}
export function filteredCount(): i32 {
  return filteredLen;
}

/** Map a position in the filtered list to its absolute row index, or -1. */
export function rowAt(filteredIndex: i32): i32 {
  if (filteredIndex < 0 || filteredIndex >= filteredLen) return -1;
  return filtered[filteredIndex];
}

export function valuePtr(absIndex: i32): usize {
  if (absIndex < 0 || absIndex >= rowCount) return 0;
  return valueBytes.dataStart + <usize>valueOff[absIndex];
}
export function valueLen(absIndex: i32): i32 {
  if (absIndex < 0 || absIndex >= rowCount) return 0;
  return valueOff[absIndex + 1] - valueOff[absIndex];
}
export function labelPtr(absIndex: i32): usize {
  if (absIndex < 0 || absIndex >= rowCount) return 0;
  return labelBytes.dataStart + <usize>labelOff[absIndex];
}
export function labelLen(absIndex: i32): i32 {
  if (absIndex < 0 || absIndex >= rowCount) return 0;
  return labelOff[absIndex + 1] - labelOff[absIndex];
}
export function iconPtr(absIndex: i32): usize {
  if (!hasIcon || absIndex < 0 || absIndex >= rowCount) return 0;
  return iconBytes.dataStart + <usize>iconOff[absIndex];
}
export function iconLen(absIndex: i32): i32 {
  if (!hasIcon || absIndex < 0 || absIndex >= rowCount) return 0;
  return iconOff[absIndex + 1] - iconOff[absIndex];
}
export function supportPtr(absIndex: i32): usize {
  if (!hasSupport || absIndex < 0 || absIndex >= rowCount) return 0;
  return supportBytes.dataStart + <usize>supportOff[absIndex];
}
export function supportLen(absIndex: i32): i32 {
  if (!hasSupport || absIndex < 0 || absIndex >= rowCount) return 0;
  return supportOff[absIndex + 1] - supportOff[absIndex];
}
export function rowFlags(absIndex: i32): u8 {
  if (absIndex < 0 || absIndex >= rowCount) return 0;
  return flags[absIndex];
}

/** Exact-match the value in the scratch buffer → absolute index, or -1. */
export function indexOfValue(queryLen: i32): i32 {
  if (rowCount == 0) return -1;
  const h = fnv1a(queryBuf, 0, queryLen);
  let slot = <i32>(h & <u32>hashMask);
  while (hashTable[slot] != -1) {
    const r = hashTable[slot];
    if (rangesEqual(valueBytes, valueOff[r], valueOff[r + 1], queryBuf, 0, queryLen)) {
      return r;
    }
    slot = (slot + 1) & hashMask;
  }
  return -1;
}

/**
 * Typeahead: first filtered position at/after `fromFilteredIndex` whose label
 * starts with the scratch-buffer query (wrapping around the filtered list).
 * Returns a filtered-list index, or -1.
 */
export function findLabelPrefix(queryLen: i32, fromFilteredIndex: i32): i32 {
  if (queryLen <= 0 || filteredLen == 0) return -1;
  if (queryLen > QUERY_CAP) queryLen = QUERY_CAP;
  for (let i = 0; i < queryLen; i++) queryLowerBuf[i] = toLowerAscii(queryBuf[i]);
  let from = fromFilteredIndex < 0 ? 0 : fromFilteredIndex;
  for (let k = 0; k < filteredLen; k++) {
    const idx = (from + k) % filteredLen;
    const r = filtered[idx];
    if (prefixMatch(labelOff[r], labelOff[r + 1], queryLen)) return idx;
  }
  return -1;
}

/** Drop the dataset (GC reclaims the columns). */
export function reset(): void {
  valueBytes = new Uint8Array(0);
  labelBytes = new Uint8Array(0);
  labelLower = new Uint8Array(0);
  iconBytes = new Uint8Array(0);
  supportBytes = new Uint8Array(0);
  valueOff = new Int32Array(1);
  labelOff = new Int32Array(1);
  iconOff = new Int32Array(1);
  supportOff = new Int32Array(1);
  flags = new Uint8Array(0);
  filtered = new Int32Array(0);
  hashTable = new Int32Array(1);
  hashMask = 0;
  rowCount = 0;
  valueCursor = 0;
  labelCursor = 0;
  iconCursor = 0;
  supportCursor = 0;
  filteredLen = 0;
  hasIcon = false;
  hasSupport = false;
  lastQueryLen = 0;
  lastMode = -1;
}

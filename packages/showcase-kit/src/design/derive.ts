/**
 * Every question the Pictor screens ask about a document, answered once.
 *
 * A screen that computes any of this itself has created a fifth answer to a
 * question that already has one, and parity will eventually catch it as a
 * difference between builds. The rule the other six verticals follow applies
 * here with more force, because almost nothing in this vertical can be read
 * straight off a record: the document is a tree and the interesting properties
 * are inherited.
 *
 * FOUR THINGS THIS FILE EXISTS TO GET RIGHT, and they are the four the vertical
 * was built to demonstrate:
 *
 *   1. THE CANVAS IS A GRID. Placement, dragging, resizing and the marquee are
 *      integer arithmetic on cells. Nothing here returns a pixel.
 *   2. THE TREE INHERITS. Visibility, locking and paint order are answers about
 *      a layer AND its ancestors, and `effectiveVisible` is the one that gets
 *      re-implemented wrong.
 *   3. A SELECTION IS A SET. `commonValue` is how an inspector field decides
 *      between a value, a mix, and nothing selected.
 *   4. AN EDIT HAS AN INVERSE. The history stores values, so undo is a write
 *      rather than a replay.
 */

import {
  CANVAS_COLS,
  CANVAS_ROWS,
  CONTAINER_KINDS,
  HISTORY_LIMIT,
  MIN_LAYER_CELLS,
  MIXED,
  TREE_MAX_DEPTH,
  ZOOM_LEVELS,
  type Adjustment,
  type AlignAxis,
  type BooleanOp,
  type Common,
  type DistributeAxis,
  type Edit,
  type Layer,
  type Rect,
} from './types';

/* =========================================================== 1. the canvas */

/** Clamp a single cell coordinate into `0..max-1`. */
const clampCell = (value: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(value)));

/**
 * KEEP A RECT ON THE ARTBOARD, preserving size where possible.
 *
 * Size wins over position: a layer dragged off the right edge slides back
 * rather than being squashed, because a drag should never silently resize.
 * Only a rect that is genuinely larger than the artboard gets clipped.
 */
export function clampRect(rect: Rect): Rect {
  const w = Math.max(MIN_LAYER_CELLS, Math.min(CANVAS_COLS, Math.round(rect.w)));
  const h = Math.max(MIN_LAYER_CELLS, Math.min(CANVAS_ROWS, Math.round(rect.h)));
  const x = Math.max(0, Math.min(CANVAS_COLS - w, Math.round(rect.x)));
  const y = Math.max(0, Math.min(CANVAS_ROWS - h, Math.round(rect.y)));
  return { x, y, w, h };
}

/**
 * TURN A PIXEL DRAG INTO A WHOLE NUMBER OF CELLS.
 *
 * The only place pixels enter this file, and they leave as integers. A pointer
 * handler measures the drag in pixels because that is what a pointer reports;
 * everything downstream is cells, which is why two builds dragging the same
 * distance land on the same cell.
 */
export function cellsMoved(deltaPx: number, canvasPx: number, cells: number): number {
  if (canvasPx <= 0) return 0;
  return Math.round(deltaPx / (canvasPx / Math.max(1, cells)));
}

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The smallest rect containing both. The primitive behind bounds and union. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Zoom moves by rungs; both ends saturate rather than wrapping. */
export const zoomIn = (index: number) => Math.min(ZOOM_LEVELS.length - 1, index + 1);
export const zoomOut = (index: number) => Math.max(0, index - 1);
export const zoomPercent = (index: number) => ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index))];

/**
 * THE RULER'S LABELLED TICKS. Every `step` cells, plus the far edge, so the
 * ruler always closes. Returned as data rather than markup because five builds
 * render it five ways and none of them should be deciding where the marks go.
 */
export function rulerTicks(cells: number, step: number): readonly { cell: number; label: string }[] {
  const ticks: { cell: number; label: string }[] = [];
  for (let cell = 0; cell < cells; cell += step) ticks.push({ cell, label: String(cell) });
  if (ticks[ticks.length - 1]?.cell !== cells) ticks.push({ cell: cells, label: String(cells) });
  return ticks;
}

/* ============================================================= 2. the tree */

export const isContainer = (layer: Layer): boolean => CONTAINER_KINDS.includes(layer.kind);

/** A layer's direct children, in sibling order. */
export function childrenOf(layers: readonly Layer[], parentId: string | null): readonly Layer[] {
  return layers.filter((l) => l.parentId === parentId).slice().sort((a, b) => a.order - b.order);
}

export function layerById(layers: readonly Layer[], id: string): Layer | null {
  return layers.find((l) => l.id === id) ?? null;
}

/** Every ancestor from the immediate parent up to the root. */
export function ancestorIds(layers: readonly Layer[], id: string): readonly string[] {
  const out: string[] = [];
  let current = layerById(layers, id);
  /* Bounded by the layer count rather than by trust: a malformed fixture with a
     parent cycle would otherwise hang every build that renders it. */
  let guard = layers.length + 1;
  while (current?.parentId && guard-- > 0) {
    out.push(current.parentId);
    current = layerById(layers, current.parentId);
  }
  return out;
}

/** Every descendant, at any depth. */
export function descendantIds(layers: readonly Layer[], id: string): ReadonlySet<string> {
  const out = new Set<string>();
  const walk = (parentId: string) => {
    for (const child of layers) {
      if (child.parentId !== parentId || out.has(child.id)) continue;
      out.add(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export const depthOf = (layers: readonly Layer[], id: string): number => ancestorIds(layers, id).length;

/**
 * THE INHERITED ANSWER, and the one this vertical exists to get right.
 *
 * A layer is visible only if it is visible AND every ancestor is. This is the
 * Pictor equivalent of Cygnus's solo-and-mute rule: the property a reader sees
 * is not the property stored on the record, and a screen that reads
 * `layer.visible` to decide whether to paint has quietly implemented a
 * different application.
 *
 * Returned as a set rather than a predicate so a render pass computes it once
 * instead of walking to the root per layer — which is O(n·depth) done wrong and
 * O(n) done here.
 */
export function visibleLayers(layers: readonly Layer[]): ReadonlySet<string> {
  const out = new Set<string>();
  const walk = (parentId: string | null, inherited: boolean) => {
    for (const layer of childrenOf(layers, parentId)) {
      const visible = inherited && layer.visible;
      if (visible) out.add(layer.id);
      walk(layer.id, visible);
    }
  };
  walk(null, true);
  return out;
}

export const effectiveVisible = (layers: readonly Layer[], id: string): boolean => visibleLayers(layers).has(id);

/**
 * LOCKING INHERITS THE SAME WAY, and for the same reason: a child of a locked
 * group cannot be dragged out of it. Kept separate from visibility because the
 * two flags are independent — a hidden layer may be unlocked, and a locked one
 * is usually visible.
 */
export function lockedLayers(layers: readonly Layer[]): ReadonlySet<string> {
  const out = new Set<string>();
  const walk = (parentId: string | null, inherited: boolean) => {
    for (const layer of childrenOf(layers, parentId)) {
      const locked = inherited || layer.locked;
      if (locked) out.add(layer.id);
      walk(layer.id, locked);
    }
  };
  walk(null, false);
  return out;
}

export const effectiveLocked = (layers: readonly Layer[], id: string): boolean => lockedLayers(layers).has(id);

/**
 * PAINT ORDER: a depth-first walk in sibling order, parents before children.
 *
 * The layer PANEL shows this reversed — topmost first — which is what every
 * design tool does and what catches people out. `zOrder` returns paint order;
 * the panel calls `.slice().reverse()` and says so.
 */
export function zOrder(layers: readonly Layer[]): readonly Layer[] {
  const out: Layer[] = [];
  const walk = (parentId: string | null) => {
    for (const layer of childrenOf(layers, parentId)) {
      out.push(layer);
      walk(layer.id);
    }
  };
  walk(null);
  return out;
}

/**
 * MAY THIS LAYER BECOME A CHILD OF THAT ONE?
 *
 * Four refusals, and each one is a bug someone has shipped:
 *   - into itself, which is the trivial cycle
 *   - into its own descendant, which is the cycle people actually create
 *   - into a leaf, because a rectangle has no inside
 *   - past the depth limit, counting the dragged subtree's own height so a deep
 *     group cannot be smuggled in one level at a time
 */
export function canReparent(layers: readonly Layer[], dragId: string, targetParentId: string | null): boolean {
  const drag = layerById(layers, dragId);
  if (!drag) return false;
  if (dragId === targetParentId) return false;
  if (targetParentId !== null) {
    const target = layerById(layers, targetParentId);
    if (!target || !isContainer(target)) return false;
    if (descendantIds(layers, dragId).has(targetParentId)) return false;
  }
  const targetDepth = targetParentId === null ? 0 : depthOf(layers, targetParentId) + 1;
  let subtreeHeight = 0;
  for (const id of descendantIds(layers, dragId)) {
    subtreeHeight = Math.max(subtreeHeight, depthOf(layers, id) - depthOf(layers, dragId));
  }
  return targetDepth + subtreeHeight < TREE_MAX_DEPTH;
}

/** Renumber one parent's children 0..n-1 so `order` never develops gaps. */
function renumber(layers: readonly Layer[], parentId: string | null): Layer[] {
  const siblings = childrenOf(layers, parentId);
  const index = new Map(siblings.map((l, i) => [l.id, i]));
  return layers.map((l) => (index.has(l.id) ? { ...l, order: index.get(l.id) as number } : l));
}

/**
 * MOVE A LAYER TO A NEW PARENT AND POSITION. Refuses rather than throwing when
 * `canReparent` says no, because the caller is a drop handler and a refused
 * drop is a normal outcome.
 */
export function reparent(
  layers: readonly Layer[],
  dragId: string,
  targetParentId: string | null,
  index: number,
): readonly Layer[] {
  if (!canReparent(layers, dragId, targetParentId)) return layers;
  const siblings = childrenOf(layers, targetParentId).filter((l) => l.id !== dragId);
  const at = Math.max(0, Math.min(siblings.length, index));
  const ordered = [...siblings.slice(0, at).map((l) => l.id), dragId, ...siblings.slice(at).map((l) => l.id)];
  const position = new Map(ordered.map((id, i) => [id, i]));
  const oldParent = layerById(layers, dragId)?.parentId ?? null;
  let next = layers.map((l) =>
    l.id === dragId
      ? { ...l, parentId: targetParentId, order: position.get(l.id) as number }
      : position.has(l.id)
        ? { ...l, order: position.get(l.id) as number }
        : l,
  );
  if (oldParent !== targetParentId) next = renumber(next, oldParent);
  return next;
}

/** Reorder within the current parent. A reparent that keeps the parent. */
export function reorderSibling(layers: readonly Layer[], id: string, toIndex: number): readonly Layer[] {
  const layer = layerById(layers, id);
  if (!layer) return layers;
  return reparent(layers, id, layer.parentId, toIndex);
}

/* ======================================================== 3. the selection */

/**
 * WHAT THE WHOLE SELECTION AGREES ON.
 *
 * `null` when nothing is selected, `MIXED` when the selected layers disagree,
 * otherwise the shared value. Three outcomes because an inspector field has
 * three states, and collapsing mixed into null is the bug that makes editing a
 * multi-selection silently clobber values the reader could not see.
 */
export function commonValue<T>(layers: readonly Layer[], ids: readonly string[], pick: (l: Layer) => T): Common<T> {
  const picked = ids.map((id) => layerById(layers, id)).filter((l): l is Layer => l !== null).map(pick);
  if (picked.length === 0) return null;
  const first = picked[0];
  return picked.every((v) => Object.is(v, first)) ? first : MIXED;
}

export const isMixed = <T,>(value: Common<T>): value is typeof MIXED => value === MIXED;

/** The union rect of a selection, or `null` when nothing is selected. */
export function selectionBounds(layers: readonly Layer[], ids: readonly string[]): Rect | null {
  const rects = ids.map((id) => layerById(layers, id)?.rect).filter((r): r is Rect => r !== undefined);
  if (rects.length === 0) return null;
  return rects.reduce(unionRect);
}

/**
 * MOVE A LAYER AND EVERYTHING INSIDE IT.
 *
 * Rects are absolute on the artboard, so a frame's children do not follow it
 * for free — which is the price of the flat model and is paid here, once. The
 * whole subtree is clamped as a unit: if any part would leave the artboard the
 * delta is reduced for all of it, so a group never tears apart at the edge.
 */
export function moveSubtree(layers: readonly Layer[], id: string, dx: number, dy: number): readonly Layer[] {
  const moving = new Set<string>([id, ...descendantIds(layers, id)]);
  const rects = layers.filter((l) => moving.has(l.id)).map((l) => l.rect);
  if (rects.length === 0) return layers;
  const bounds = rects.reduce(unionRect);
  const clampedDx = Math.max(-bounds.x, Math.min(CANVAS_COLS - (bounds.x + bounds.w), dx));
  const clampedDy = Math.max(-bounds.y, Math.min(CANVAS_ROWS - (bounds.y + bounds.h), dy));
  if (clampedDx === 0 && clampedDy === 0) return layers;
  return layers.map((l) =>
    moving.has(l.id) ? { ...l, rect: { ...l.rect, x: l.rect.x + clampedDx, y: l.rect.y + clampedDy } } : l,
  );
}

/** Resize from one edge or corner, honouring the minimum and the artboard. */
export function resizeRect(rect: Rect, edge: 'e' | 's' | 'se', dx: number, dy: number): Rect {
  const w = edge === 's' ? rect.w : Math.max(MIN_LAYER_CELLS, rect.w + dx);
  const h = edge === 'e' ? rect.h : Math.max(MIN_LAYER_CELLS, rect.h + dy);
  return clampRect({ ...rect, w, h });
}

/** Which unlocked, visible layers a marquee touches. */
export function marqueeHits(layers: readonly Layer[], marquee: Rect): readonly string[] {
  const visible = visibleLayers(layers);
  const locked = lockedLayers(layers);
  return layers
    .filter((l) => visible.has(l.id) && !locked.has(l.id) && rectsIntersect(l.rect, marquee))
    .map((l) => l.id);
}

/* ================================================ 4. edits, and their inverse */

/** The single mapping from adjustments to a CSS filter. */
export function filterCss(adjustments: readonly Adjustment[]): string {
  const parts: string[] = [];
  for (const a of adjustments) {
    if (a.value === 0) continue;
    const unit = a.value / 100;
    if (a.kind === 'exposure') parts.push('brightness(' + (1 + unit * 0.6).toFixed(3) + ')');
    if (a.kind === 'contrast') parts.push('contrast(' + (1 + unit * 0.6).toFixed(3) + ')');
    if (a.kind === 'saturation') parts.push('saturate(' + (1 + unit).toFixed(3) + ')');
    if (a.kind === 'temperature') parts.push('sepia(' + Math.max(0, unit).toFixed(3) + ')');
  }
  return parts.join(' ');
}

const axisOf = (axis: AlignAxis) => (axis === 'left' || axis === 'center-x' || axis === 'right' ? 'x' : 'y');

/**
 * ALIGN A SELECTION TO ITS OWN BOUNDS.
 *
 * To the selection's bounding box, not to the artboard — which is what every
 * design tool does and what readers expect: aligning two layers left puts them
 * on the leftmost one's edge, not on the canvas edge.
 *
 * Fewer than two layers is a no-op rather than an error. One layer is already
 * aligned with itself, and the toolbar leaves the buttons enabled so the reader
 * can see what they are; pressing one simply does nothing.
 */
export function alignLayers(layers: readonly Layer[], ids: readonly string[], axis: AlignAxis): readonly Layer[] {
  if (ids.length < 2) return layers;
  const bounds = selectionBounds(layers, ids);
  if (!bounds) return layers;
  const set = new Set(ids);
  return layers.map((l) => {
    if (!set.has(l.id)) return l;
    const r = l.rect;
    if (axisOf(axis) === 'x') {
      const x =
        axis === 'left' ? bounds.x
        : axis === 'right' ? bounds.x + bounds.w - r.w
        : bounds.x + Math.round((bounds.w - r.w) / 2);
      return { ...l, rect: clampRect({ ...r, x }) };
    }
    const y =
      axis === 'top' ? bounds.y
      : axis === 'bottom' ? bounds.y + bounds.h - r.h
      : bounds.y + Math.round((bounds.h - r.h) / 2);
    return { ...l, rect: clampRect({ ...r, y }) };
  });
}

/**
 * SPREAD THE GAPS EVENLY between the outermost two, which stay put.
 *
 * Needs three layers to mean anything: with two there is one gap and it is
 * already even. Integer cells mean the gaps can differ by one where the span
 * does not divide evenly, and that is correct — the alternative is fractional
 * positions the grid cannot express.
 */
export function distributeLayers(
  layers: readonly Layer[],
  ids: readonly string[],
  axis: DistributeAxis,
): readonly Layer[] {
  if (ids.length < 3) return layers;
  const picked = ids
    .map((id) => layerById(layers, id))
    .filter((l): l is Layer => l !== null)
    .slice()
    .sort((a, b) => (axis === 'horizontal' ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
  if (picked.length < 3) return layers;

  const first = picked[0].rect;
  const last = picked[picked.length - 1].rect;
  const span =
    axis === 'horizontal' ? last.x + last.w - first.x - first.w : last.y + last.h - first.y - first.h;
  const inner = picked.slice(1, -1);
  const occupied = inner.reduce((sum, l) => sum + (axis === 'horizontal' ? l.rect.w : l.rect.h), 0);
  const gap = (span - occupied) / (inner.length + 1);

  const moved = new Map<string, Rect>();
  let cursor = axis === 'horizontal' ? first.x + first.w : first.y + first.h;
  for (const l of inner) {
    cursor += gap;
    const at = Math.round(cursor);
    moved.set(l.id, clampRect(axis === 'horizontal' ? { ...l.rect, x: at } : { ...l.rect, y: at }));
    cursor += axis === 'horizontal' ? l.rect.w : l.rect.h;
  }
  return layers.map((l) => (moved.has(l.id) ? { ...l, rect: moved.get(l.id) as Rect } : l));
}

/**
 * BOOLEAN OPERATIONS, ON RECTANGLES.
 *
 * Honest about what it is: the model is a grid of cells, so the result of a
 * boolean is the rect the operation implies, not a path. `union` is the
 * bounding box, `intersect` is the overlap, `subtract` is the first layer with
 * the others' overlap trimmed off whichever edge it bites into, and `exclude`
 * falls back to the union — a true exclusion is not a rectangle.
 *
 * The result replaces the operands with a single `rect` layer, which is what
 * makes it undoable as one edit: the before is every operand, the after is the
 * one shape.
 */
export function booleanRect(rects: readonly Rect[], op: BooleanOp): Rect | null {
  if (rects.length < 2) return null;
  if (op === 'union' || op === 'exclude') return rects.reduce(unionRect);
  if (op === 'intersect') {
    let acc = rects[0];
    for (const r of rects.slice(1)) {
      if (!rectsIntersect(acc, r)) return null;
      const x = Math.max(acc.x, r.x);
      const y = Math.max(acc.y, r.y);
      acc = { x, y, w: Math.min(acc.x + acc.w, r.x + r.w) - x, h: Math.min(acc.y + acc.h, r.y + r.h) - y };
    }
    return acc;
  }
  /* subtract: trim the base wherever a later rect spans it fully on one axis. */
  let base = rects[0];
  for (const r of rects.slice(1)) {
    if (!rectsIntersect(base, r)) continue;
    const spansY = r.y <= base.y && r.y + r.h >= base.y + base.h;
    const spansX = r.x <= base.x && r.x + r.w >= base.x + base.w;
    if (spansY && r.x <= base.x) {
      const right = base.x + base.w;
      const x = Math.min(right - MIN_LAYER_CELLS, r.x + r.w);
      base = { ...base, x, w: right - x };
    } else if (spansY && r.x + r.w >= base.x + base.w) {
      base = { ...base, w: Math.max(MIN_LAYER_CELLS, r.x - base.x) };
    } else if (spansX && r.y <= base.y) {
      const bottom = base.y + base.h;
      const y = Math.min(bottom - MIN_LAYER_CELLS, r.y + r.h);
      base = { ...base, y, h: bottom - y };
    } else if (spansX && r.y + r.h >= base.y + base.h) {
      base = { ...base, h: Math.max(MIN_LAYER_CELLS, r.y - base.y) };
    }
  }
  return clampRect(base);
}

/* ------------------------------------------------------------- the history */

/**
 * The undo stack and where in it the reader is standing. `index` is how many
 * entries are applied, so 0 is "fully undone" and `entries.length` is "at the
 * present".
 */
export interface History {
  readonly entries: readonly Edit[];
  readonly index: number;
}

export const EMPTY_HISTORY: History = Object.freeze({ entries: Object.freeze([]) as readonly Edit[], index: 0 });

/**
 * RECORD AN EDIT, DISCARDING THE REDO BRANCH.
 *
 * Editing after undoing throws away what was undone — the behaviour of every
 * editor, and the half people forget. The stack is also bounded: past
 * `HISTORY_LIMIT` the oldest entry drops, which is why `index` is recomputed
 * from the trimmed length rather than incremented.
 */
export function pushEdit(history: History, edit: Edit): History {
  const kept = history.entries.slice(0, history.index);
  const entries = [...kept, edit].slice(-HISTORY_LIMIT);
  return { entries, index: entries.length };
}

export const canUndo = (history: History): boolean => history.index > 0;
export const canRedo = (history: History): boolean => history.index < history.entries.length;

/** Write a set of whole layer values back over the document. */
function writeLayers(layers: readonly Layer[], values: readonly Layer[]): readonly Layer[] {
  if (values.length === 0) return layers;
  const byId = new Map(values.map((l) => [l.id, l]));
  const present = new Set(layers.map((l) => l.id));
  const restored = layers.map((l) => byId.get(l.id) ?? l);
  /* A layer the edit deleted is absent from the document and has to come back,
     not just be overwritten — which is why this is not a plain map. */
  const reintroduced = values.filter((l) => !present.has(l.id));
  return reintroduced.length === 0 ? restored : [...restored, ...reintroduced];
}

/** Layers the edit created must disappear again on undo. */
function removeCreated(layers: readonly Layer[], edit: Edit): readonly Layer[] {
  const before = new Set(edit.before.map((l) => l.id));
  const created = edit.after.filter((l) => !before.has(l.id)).map((l) => l.id);
  return created.length === 0 ? layers : layers.filter((l) => !created.includes(l.id));
}

function removeDeleted(layers: readonly Layer[], edit: Edit): readonly Layer[] {
  const after = new Set(edit.after.map((l) => l.id));
  const deleted = edit.before.filter((l) => !after.has(l.id)).map((l) => l.id);
  return deleted.length === 0 ? layers : layers.filter((l) => !deleted.includes(l.id));
}

export function undo(layers: readonly Layer[], history: History): { layers: readonly Layer[]; history: History } {
  if (!canUndo(history)) return { layers, history };
  const edit = history.entries[history.index - 1];
  return { layers: writeLayers(removeCreated(layers, edit), edit.before), history: { ...history, index: history.index - 1 } };
}

export function redo(layers: readonly Layer[], history: History): { layers: readonly Layer[]; history: History } {
  if (!canRedo(history)) return { layers, history };
  const edit = history.entries[history.index];
  return { layers: writeLayers(removeDeleted(layers, edit), edit.after), history: { ...history, index: history.index + 1 } };
}

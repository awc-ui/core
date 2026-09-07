import {
  DEFAULT_ZOOM_INDEX,
  EMPTY_HISTORY,
  REPORTING_INSTANT,
  alignLayers,
  booleanRect,
  canReparent,
  childrenOf,
  clampRect,
  defaultFile,
  descendantIds,
  distributeLayers,
  fileById,
  layerById,
  lockedLayers,
  moveSubtree,
  pushEdit,
  redo as redoDoc,
  reparent,
  undo as undoDoc,
  zoomIn as zoomInIndex,
  zoomOut as zoomOutIndex,
  type AlignAxis,
  type BooleanOp,
  type DistributeAxis,
  type Edit,
  type EditKind,
  type History,
  type Layer,
  type Rect,
  type ToolMode,
} from '@awc-ui/showcase-kit/design';
import { curatedLayersForFile } from './document-seeds';
import { STORAGE_KEY, parseWorkspaceCache, serializeWorkspaceCache, type StoredDocument } from './document-store';
import { commitDocument, documentId, selectableIds, type LayerSelection } from './document-transactions';
export interface DocumentState {
  /** Each file retains its document, selection, and history. */
  readonly fileId: string;
  readonly layers: readonly Layer[];
  /** A SET, not a cursor. See `commonValue` for what that costs the inspector. */
  readonly selection: readonly string[];
  readonly history: History;
  readonly tool: ToolMode;
  readonly zoomIndex: number;
  readonly showGrid: boolean;
}

export interface DocumentApi extends DocumentState {
  openFile(fileId: string): void;
  /** Live edits, then the stored document, then curated initial content. Never opens or saves a file. */
  layersForFile(fileId: string): readonly Layer[];
  commitLayers(kind: EditKind, transform: (layers: readonly Layer[]) => readonly Layer[], nextSelection?: LayerSelection): void;
  replaceCanvas(layers: readonly Layer[]): void;
  duplicate(): void;
  jumpHistory(index: number): void;
  save(): boolean;
  readonly saveStatus: 'saved' | 'unsaved' | 'unavailable';
  readonly lastSavedAt: number | null;
  select(ids: readonly string[]): void;
  toggleInSelection(id: string): void;
  clearSelection(): void;
  setTool(tool: ToolMode): void;
  zoomIn(): void;
  zoomOut(): void;
  toggleGrid(): void;

  /** Move a whole subtree by a delta in cells. */
  moveBy(id: string, dx: number, dy: number): void;
  /** Resize one layer from an edge. */
  resizeTo(id: string, rect: Rect): void;
  /** Set one property across the whole selection. */
  restyle(patch: Partial<Pick<Layer, 'fill' | 'opacity' | 'blend' | 'blendKey' | 'name' | 'masked' | 'textKey'>>): void;
  /** Set an adjustment's value on every selected image layer. */
  setAdjustment(kind: string, value: number): void;
  toggleVisible(id: string): void;
  toggleLocked(id: string): void;
  reorderTo(id: string, parentId: string | null, index: number): void;
  align(axis: AlignAxis): void;
  distribute(axis: DistributeAxis): void;
  combine(op: BooleanOp): void;
  group(): void;
  ungroup(): void;
  remove(): void;
  undo(): void;
  redo(): void;
}

const nextId = documentId;
function seed(fileId: string): DocumentState {
  const file = fileById(fileId) ?? defaultFile();
  return {
    fileId: file.id,
    layers: curatedLayersForFile(file.id),
    selection: [],
    history: EMPTY_HISTORY,
    tool: 'select',
    zoomIndex: DEFAULT_ZOOM_INDEX,
    showGrid: false,
  };
}

export interface DocumentStore {
  getSnapshot(): DocumentApi;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** One immutable snapshot per change. All frameworks share transactions and storage. */
export function createDocumentStore(): DocumentStore {
  let initial;
  try { initial = parseWorkspaceCache(localStorage.getItem(STORAGE_KEY)); } catch { initial = null; }
  let state: DocumentState = initial?.documents[initial.activeFileId] ?? seed(defaultFile().id);
  const files: Record<string, StoredDocument> = { ...initial?.documents };
  let saveStatus: DocumentApi['saveStatus'] = initial ? 'saved' : 'unsaved';
  let lastSavedAt: number | null = initial?.savedAt ?? null;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = () => { snapshot = makeApi(); for (const listener of [...listeners]) listener(); };
  const save = () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    try {
      files[state.fileId] = state;
      const savedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, serializeWorkspaceCache({version: 1, activeFileId: state.fileId, documents: files, savedAt}));
      saveStatus = 'saved'; lastSavedAt = savedAt; notify(); return true;
    } catch { saveStatus = 'unavailable'; notify(); return false; }
  };
  const update = (transform: (value: DocumentState) => DocumentState) => {
    const next = transform(state);
    if (next === state) return;
    state = next; files[state.fileId] = state; saveStatus = 'unsaved';
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 350);
    notify();
  };
  const commit = (kind: EditKind, transform: (layers: readonly Layer[]) => readonly Layer[], nextSelection?: LayerSelection, flagChange?: {id: string; property: 'locked' | 'visible'}) => update(value => commitDocument(value, kind, transform, nextSelection, flagChange));
  function makeApi(): DocumentApi {
    const selected = () => selectableIds(state.layers, state.selection);

    return {
      ...state, saveStatus, lastSavedAt, save, commitLayers: commit,
      replaceCanvas: (layers) => update((value) => commitDocument(value, 'create', () => layers, [], undefined, true)),
      layersForFile: (fileId) => fileId === state.fileId
        ? state.layers
        : files[fileId]?.layers ?? curatedLayersForFile(fileId),

      openFile: (fileId) => {
        if (!fileById(fileId) || fileId === state.fileId) return;
        update((value) => {
          files[value.fileId] = value;
          return files[fileId] ?? seed(fileId);
        });
      },
      select: (ids) => update((c) => ({ ...c, selection: selectableIds(c.layers, ids) })),
      toggleInSelection: (id) =>
        update((c) => ({
          ...c,
          selection: selectableIds(c.layers, c.selection.includes(id) ? c.selection.filter((x) => x !== id) : [...c.selection, id]),
        })),
      clearSelection: () => update((c) => ({ ...c, selection: [] })),
      setTool: (tool) => update((c) => ({ ...c, tool })),
      zoomIn: () => update((c) => ({ ...c, zoomIndex: zoomInIndex(c.zoomIndex) })),
      zoomOut: () => update((c) => ({ ...c, zoomIndex: zoomOutIndex(c.zoomIndex) })),
      toggleGrid: () => update((c) => ({ ...c, showGrid: !c.showGrid })),

      moveBy: (id, dx, dy) => commit('move', (layers) => moveSubtree(layers, id, dx, dy)),

      resizeTo: (id, rect) =>
        commit('resize', (layers) =>
          layers.map((l) => (l.id === id ? { ...l, rect: clampRect(rect) } : l)),
        ),

      restyle: (patch) =>
        commit('style', (layers) => {
          const set = new Set(selected());
          if (set.size === 0) return layers;
          return layers.map((l) => (set.has(l.id) ? { ...l, ...patch } : l));
        }),

      setAdjustment: (kind, value) =>
        commit('style', (layers) => {
          const set = new Set(selected());
          if (set.size === 0) return layers;
          return layers.map((l) => {
            if (!set.has(l.id) || l.adjustments.length === 0) return l;
            return {
              ...l,
              adjustments: l.adjustments.map((a) => (a.kind === kind ? { ...a, value } : a)),
            };
          });
        }),

      toggleVisible: (id) =>
        commit('style', (layers) => layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)), undefined, { id, property: 'visible' }),

      toggleLocked: (id) =>
        commit('style', (layers) => layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)), undefined, { id, property: 'locked' }),

      reorderTo: (id, parentId, index) =>
        commit('reorder', (layers) => (canReparent(layers, id, parentId) ? reparent(layers, id, parentId, index) : layers)),

      align: (axis) => commit('align', (layers) => alignLayers(layers, selected(), axis)),
      distribute: (axis) => commit('distribute', (layers) => distributeLayers(layers, selected(), axis)),

      /**
       * COMBINE REPLACES THE OPERANDS WITH ONE SHAPE, which is what makes it a
       * single reversible entry: the before is every operand and the after is
       * the one rect. The result inherits the FIRST operand's paint properties,
       * because a combined shape that came out a colour none of its inputs were
       * would read as a bug.
       */
      combine: (op) =>
        commit('boolean', (layers) => {
          const ids = selected();
          if (ids.length < 2) return layers;
          const operands = ids.map((id) => layerById(layers, id)).filter((l): l is Layer => l !== null);
          const rect = booleanRect(operands.map((l) => l.rect), op);
          if (!rect) return layers;
          const first = operands[0];
          const merged: Layer = {
            ...first,
            id: nextId('ly'),
            kind: 'rect',
            kindKey: 'design.layerKind.rect',
            rect,
            adjustments: [],
            art: null,
            textKey: null,
            componentId: null,
          };
          const gone = new Set(ids);
          const kept = layers.filter((l) => !gone.has(l.id));
          return [...kept, merged];
        }),

      group: () =>
        commit('group', (layers) => {
          const ids = selected();
          if (ids.length < 2) return layers;
          const members = ids.map((id) => layerById(layers, id)).filter((l): l is Layer => l !== null);
          /* Only siblings can be grouped: pulling layers out of three different
             parents into one group is a reparent of each, and the reader did
             not ask for that. */
          const parentId = members[0].parentId;
          if (!members.every((m) => m.parentId === parentId)) return layers;
          const rects = members.map((m) => m.rect);
          const x = Math.min(...rects.map((r) => r.x));
          const y = Math.min(...rects.map((r) => r.y));
          const group: Layer = {
            id: nextId('ly'),
            parentId,
            kind: 'group',
            kindKey: 'design.layerKind.group',
            name: 'Group',
            rect: {
              x,
              y,
              w: Math.max(...rects.map((r) => r.x + r.w)) - x,
              h: Math.max(...rects.map((r) => r.y + r.h)) - y,
            },
            order: Math.min(...members.map((m) => m.order)),
            visible: true,
            locked: false,
            opacity: 100,
            blend: 'normal',
            blendKey: 'design.blend.normal',
            fill: null,
            adjustments: [],
            masked: false,
            art: null,
            textKey: null,
            componentId: null,
          };
          const ownIds = new Set(ids);
          return [
            ...layers.map((l, i) => (ownIds.has(l.id) ? { ...l, parentId: group.id, order: i } : l)),
            group,
          ];
        }),

      ungroup: () =>
        commit('ungroup', (layers) => {
          const ids = selected();
          const groups = ids
            .map((id) => layerById(layers, id))
            .filter((l): l is Layer => l !== null && (l.kind === 'group' || l.kind === 'frame'));
          if (groups.length === 0) return layers;
          const dissolving = new Set(groups.map((g) => g.id));
          const promoted = layers.map((l) =>
            l.parentId && dissolving.has(l.parentId)
              ? { ...l, parentId: layerById(layers, l.parentId)?.parentId ?? null }
              : l,
          );
          return promoted.filter((l) => !dissolving.has(l.id));
        }),

      remove: () =>
        commit('delete', (layers) => {
          const ids = selected();
          if (ids.length === 0) return layers;
          const doomed = new Set(ids);
          for (const id of ids) for (const d of descendantIds(layers, id)) doomed.add(d);
          return layers.filter((l) => !doomed.has(l.id));
        }),

      duplicate: () => {
        const roots = selected().filter((id) => !selected().some((other) => other !== id && descendantIds(state.layers, other).has(id)));
        if (!roots.length) return;
        const wanted = new Set(roots.flatMap((id) => [id, ...descendantIds(state.layers, id)]));
        const remap = new Map([...wanted].map((id) => [id, nextId('layer')]));
        commit('create', (layers) => {
          const copies = layers.filter((layer) => wanted.has(layer.id)).map((layer) => ({
            ...layer, id: remap.get(layer.id)!, parentId: remap.get(layer.parentId!) ?? layer.parentId,
            name: roots.includes(layer.id) ? layer.name + ' copy' : layer.name,
            order: layer.order + layers.length,
          }));
          let next: readonly Layer[] = [...layers, ...copies];
          for (const id of roots) next = moveSubtree(next, remap.get(id)!, 2, 2);
          return next;
        }, roots.map((id) => remap.get(id)!));
      },
      jumpHistory: (index) => update((c) => {
        const target = Math.max(0, Math.min(c.history.entries.length, Math.round(index)));
        let next = { layers: c.layers, history: c.history };
        while (next.history.index > target) next = undoDoc(next.layers, next.history);
        while (next.history.index < target) next = redoDoc(next.layers, next.history);
        return { ...c, ...next, selection: selectableIds(next.layers, c.selection) };
      }),

      undo: () =>
        update((c) => {
          const next = undoDoc(c.layers, c.history);
          const alive = new Set(next.layers.map((l) => l.id));
          return { ...c, ...next, selection: selectableIds(next.layers, c.selection) };
        }),

      redo: () =>
        update((c) => {
          const next = redoDoc(c.layers, c.history);
          const alive = new Set(next.layers.map((l) => l.id));
          return { ...c, ...next, selection: c.selection.filter((id) => alive.has(id)) };
        }),
    };

  }
  let snapshot = makeApi();
  const flush = () => { if (saveStatus === 'unsaved') save(); };
  const stop = () => {
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
    if (timer) { clearTimeout(timer); timer = undefined; }
    flush();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      const first = listeners.size === 0;
      listeners.add(listener);
      if (first && saveStatus === 'unsaved' && !timer) timer = setTimeout(save, 350);
      if (first && typeof window !== 'undefined') window.addEventListener('pagehide', flush);
      return () => { listeners.delete(listener); if (!listeners.size) stop(); };
    },
    dispose() { listeners.clear(); stop(); },
  };
}

export function treeRows(layers: readonly Layer[]): readonly {layer: Layer; level: number}[] {
  const rows: {layer: Layer; level: number}[] = [];
  const walk = (parentId: string | null, level: number) => {
    for (const layer of childrenOf(layers, parentId)) { rows.push({layer, level}); walk(layer.id, level + 1); }
  };
  walk(null, 0); return rows.reverse();
}

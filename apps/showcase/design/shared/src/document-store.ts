/** Versioned browser storage. Cached data is untrusted and never merged unchecked. */
import {
  CANVAS_COLS, CANVAS_ROWS, HISTORY_LIMIT, TREE_MAX_DEPTH, ZOOM_LEVELS,
  fileById, redo, undo, type Edit, type History, type Layer, type ToolMode,
} from '@awc-ui/showcase-kit/design';

export const STORAGE_KEY = 'awc:pictor:documents:v1';
const MAX_CACHE_BYTES = 4_500_000;
const MAX_LAYERS = 500;
const kinds = new Set(['frame', 'group', 'rect', 'ellipse', 'text', 'image', 'component', 'instance']);
const blends = new Set(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference']);
const edits = new Set(['create', 'delete', 'move', 'resize', 'reorder', 'reparent', 'style', 'group', 'ungroup', 'boolean', 'align', 'distribute']);
const tools = new Set(['select', 'frame', 'rect', 'ellipse', 'text', 'image', 'hand']);
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 300): value is string => typeof value === 'string' && value.length <= max;
const nullableText = (value: unknown, max = 300) => value === null || text(value, max);
const number = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export interface StoredDocument {
  readonly fileId: string;
  readonly layers: readonly Layer[];
  readonly selection: readonly string[];
  readonly history: History;
  readonly tool: ToolMode;
  readonly zoomIndex: number;
  readonly showGrid: boolean;
}
export interface WorkspaceCache {
  version: 1;
  activeFileId: string;
  documents: Record<string, StoredDocument>;
  savedAt: number;
}

function validLayer(value: unknown): value is Layer {
  if (!record(value) || !text(value.id) || !value.id || !nullableText(value.parentId) || !kinds.has(value.kind)) return false;
  const r = value.rect;
  if (!record(r) || ![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > CANVAS_COLS || r.y + r.h > CANVAS_ROWS) return false;
  if (!text(value.name, 4000) || !text(value.kindKey) || !text(value.blendKey) || !blends.has(value.blend)) return false;
  if (!number(value.order, 0, 100000) || !number(value.opacity, 0, 100)) return false;
  if (![value.visible, value.locked, value.masked].every((flag) => typeof flag === 'boolean')) return false;
  if (value.fill !== null && !(typeof value.fill === 'string' && /^(?:p[0-9]|ink|paper|#[a-f\d]{3}|#[a-f\d]{4}|#[a-f\d]{6}|#[a-f\d]{8})$/i.test(value.fill))) return false;
  if (!nullableText(value.textKey, 1000) || !nullableText(value.componentId)) return false;
  if (!Array.isArray(value.adjustments) || value.adjustments.length > 4 || !value.adjustments.every((a: unknown) => record(a) && ['exposure', 'contrast', 'saturation', 'temperature'].includes(a.kind) && text(a.kindKey) && number(a.value, -100, 100))) return false;
  // Artwork remains image data, never arbitrary remote URLs or executable markup.
  return value.art === null || (record(value.art) && text(value.art.src, 150000) && /^data:image\/(?:svg\+xml|png|jpeg|webp)[;,]/.test(value.art.src) && text(value.art.altKey));
}

export function validLayerTree(value: unknown): value is readonly Layer[] {
  if (!Array.isArray(value) || value.length > MAX_LAYERS || !value.every(validLayer)) return false;
  const map = new Map<string, Layer>(value.map((layer) => [layer.id, layer]));
  if (map.size !== value.length) return false;
  for (const layer of value) {
    const seen = new Set([layer.id]);
    let parentId = layer.parentId;
    let depth = 0;
    while (parentId !== null) {
      const parent = map.get(parentId);
      if (!parent || !['frame', 'group'].includes(parent.kind) || seen.has(parentId) || ++depth > TREE_MAX_DEPTH) return false;
      seen.add(parentId);
      parentId = parent.parentId;
    }
  }
  return true;
}

function validEdit(value: unknown): value is Edit {
  if (!record(value) || !text(value.id) || !edits.has(value.kind) || !text(value.kindKey) || !text(value.labelKey) || !text(value.at) || !Number.isFinite(Date.parse(value.at))) return false;
  if (!Array.isArray(value.layerIds) || value.layerIds.length > MAX_LAYERS || !value.layerIds.every((id: unknown) => text(id))) return false;
  return [value.before, value.after].every((layers) => Array.isArray(layers) && layers.length <= MAX_LAYERS && layers.every(validLayer) && new Set(layers.map((l: Layer) => l.id)).size === layers.length);
}

function validDocument(value: unknown, fileId: string): value is StoredDocument {
  if (!record(value) || value.fileId !== fileId || !validLayerTree(value.layers) || !tools.has(value.tool)) return false;
  if (!Number.isInteger(value.zoomIndex) || !number(value.zoomIndex, 0, ZOOM_LEVELS.length - 1) || typeof value.showGrid !== 'boolean') return false;
  if (!Array.isArray(value.selection) || !value.selection.every((id: unknown) => text(id) && value.layers.some((layer: Layer) => layer.id === id))) return false;
  const h = value.history;
  if (!record(h) || !Array.isArray(h.entries) || h.entries.length > HISTORY_LIMIT || !h.entries.every(validEdit) || !Number.isInteger(h.index) || !number(h.index, 0, h.entries.length)) return false;
  // Individual change sets may be fragments. Validate every reconstructed whole
  // tree, so a poisoned redo cannot introduce dangling parents or a cycle later.
  let cursor = { layers: value.layers as readonly Layer[], history: h as History };
  while (cursor.history.index > 0) {
    cursor = undo(cursor.layers, cursor.history);
    if (!validLayerTree(cursor.layers)) return false;
  }
  while (cursor.history.index < cursor.history.entries.length) {
    cursor = redo(cursor.layers, cursor.history);
    if (!validLayerTree(cursor.layers)) return false;
  }
  return true;
}

export function parseWorkspaceCache(raw: string | null): WorkspaceCache | null {
  if (!raw || raw.length > MAX_CACHE_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !record(value.documents) || !text(value.activeFileId) || !fileById(value.activeFileId) || !number(value.savedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
    const documents: Record<string, StoredDocument> = Object.create(null);
    for (const [id, document] of Object.entries(value.documents)) {
      if (fileById(id) && validDocument(document, id)) documents[id] = document;
    }
    if (!documents[value.activeFileId]) return null;
    return { version: 1, activeFileId: value.activeFileId, documents, savedAt: value.savedAt };
  } catch { return null; }
}

export function serializeWorkspaceCache(cache: WorkspaceCache): string {
  const raw = JSON.stringify(cache);
  if (raw.length > MAX_CACHE_BYTES) throw new Error('The browser document cache is full');
  return raw;
}

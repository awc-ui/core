import { ancestorIds, lockedLayers, pushEdit, type Edit, type EditKind, type Layer } from '@awc-ui/showcase-kit/design';
import { validLayerTree, type StoredDocument } from './document-store';

export type LayerSelection = readonly string[] | ((layers: readonly Layer[]) => readonly string[]);
let sequence = 0;
export const documentId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++sequence}`}`;

export function selectableIds(layers: readonly Layer[], ids: readonly string[]): readonly string[] {
  const locked = lockedLayers(layers);
  const alive = new Set(layers.map((layer) => layer.id));
  return [...new Set(ids)].filter((id) => alive.has(id) && !locked.has(id));
}

/** A single validated, reversible transaction, including structural batch edits. */
export function commitDocument(
  current: StoredDocument,
  kind: EditKind,
  transform: (layers: readonly Layer[]) => readonly Layer[],
  nextSelection?: LayerSelection,
  flagChange?: { id: string; property: 'visible' | 'locked' },
  replaceCanvas = false,
): StoredDocument {
  const after = transform(current.layers);
  if (!validLayerTree(after)) return current;
  const beforeById = new Map(current.layers.map((layer) => [layer.id, layer]));
  const afterById = new Map(after.map((layer) => [layer.id, layer]));
  const locked = lockedLayers(current.layers);
  const protectedParents = new Set([...locked].flatMap((id) => ancestorIds(current.layers, id)));
  for (const id of replaceCanvas ? [] : locked) {
    const before = beforeById.get(id)!;
    const value = afterById.get(id);
    const comparable = value && flagChange?.id === id ? { ...value, [flagChange.property]: before[flagChange.property] } : value;
    if (JSON.stringify(before) !== JSON.stringify(comparable)) return current;
  }
  for (const id of replaceCanvas ? [] : protectedParents) {
    const before = beforeById.get(id)!;
    const value = afterById.get(id);
    if (!value || value.parentId !== before.parentId || JSON.stringify(value.rect) !== JSON.stringify(before.rect)) return current;
  }
  // New children cannot be inserted into a locked container either.
  for (const layer of after) if (!replaceCanvas && !beforeById.has(layer.id) && layer.parentId && locked.has(layer.parentId)) return current;
  const before: Layer[] = [];
  const changed: Layer[] = [];
  for (const id of new Set([...beforeById.keys(), ...afterById.keys()])) {
    const a = beforeById.get(id);
    const b = afterById.get(id);
    if (a === b || JSON.stringify(a) === JSON.stringify(b)) continue;
    if (a) before.push(a);
    if (b) changed.push(b);
  }
  const requested = typeof nextSelection === 'function' ? nextSelection(after) : nextSelection ?? current.selection;
  const selection = selectableIds(after, requested);
  if (!before.length && !changed.length) return JSON.stringify(selection) === JSON.stringify(current.selection) ? current : { ...current, selection };
  const edit: Edit = {
    id: documentId('edit'), kind, kindKey: `design.edit.${kind}`, labelKey: `design.edit.${kind}`,
    layerIds: [...new Set([...before, ...changed].map((layer) => layer.id))],
    before, after: changed, at: new Date().toISOString(),
  };
  return { ...current, layers: after, selection, history: pushEdit(current.history, edit) };
}

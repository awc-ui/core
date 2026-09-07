import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { lockedLayers } from '@awc-ui/showcase-kit/design';
import { createDocumentStore, treeRows, type DocumentApi, type DocumentStore } from '@awc-ui/pictor-model';
export type { DocumentApi, DocumentState } from '@awc-ui/pictor-model';

const DocumentContext = createContext<DocumentStore | null>(null);
export function DocumentProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createDocumentStore());
  return <DocumentContext.Provider value={store}>{children}</DocumentContext.Provider>;
}
export function useDocument(): DocumentApi {
  const store = useContext(DocumentContext);
  if (!store) throw new Error('[showcase] useDocument outside DocumentProvider');
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
export function useSelectableLayers(): ReadonlySet<string> {
  const { layers } = useDocument();
  return useMemo(() => { const locked = lockedLayers(layers); return new Set(layers.filter(layer => !locked.has(layer.id)).map(layer => layer.id)); }, [layers]);
}
export function useTreeRows() {
  const { layers } = useDocument();
  return useMemo(() => treeRows(layers), [layers]);
}

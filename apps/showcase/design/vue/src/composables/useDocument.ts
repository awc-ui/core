import { shallowRef, computed } from "vue";
import {
  createDocumentStore,
  treeRows,
  type DocumentApi,
} from "@awc-ui/pictor-model";
import { lockedLayers } from "@awc-ui/showcase-kit/design";
const store = createDocumentStore();
const snapshot = shallowRef(store.getSnapshot());
const unsubscribe = store.subscribe(() => {
  snapshot.value = store.getSnapshot();
});
const documentApi = new Proxy({} as DocumentApi, {
  get: (_target, key) => Reflect.get(snapshot.value, key),
});
export const useDocument = () => documentApi;
export const useTreeRows = () => treeRows(snapshot.value.layers);
export const useSelectableIds = () =>
  new Set(
    snapshot.value.layers
      .filter((layer) => !lockedLayers(snapshot.value.layers).has(layer.id))
      .map((layer) => layer.id),
  );
export function disposeDocument() {
  unsubscribe();
  store.dispose();
}

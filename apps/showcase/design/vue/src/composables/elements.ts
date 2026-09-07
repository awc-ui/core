import { watch, type Ref } from "vue";
export function useCustomEvent<E extends Event = CustomEvent>(
  element: Ref<HTMLElement | null>,
  name: string,
  handler: (event: E) => void,
) {
  watch(
    element,
    (node, _old, onCleanup) => {
      if (!node) return;
      const listener = (event: Event) => handler(event as E);
      node.addEventListener(name, listener);
      onCleanup(() => node.removeEventListener(name, listener));
    },
    { immediate: true, flush: "post" },
  );
}
export function useElementProps<T extends object>(
  element: Ref<HTMLElement | null>,
  values: T,
) {
  watch(
    () => [element.value, values] as const,
    ([node, props]) => {
      if (node) Object.assign(node, props);
    },
    { immediate: true, deep: true, flush: "post" },
  );
}

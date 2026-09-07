/** Private bridge for capturing tab geometry before its rail changes layout. */
const transitionPreparations = new WeakMap<HTMLElement, () => void>();

export function registerRailTabTransition(
  element: HTMLElement,
  callback: () => void,
): () => void {
  transitionPreparations.set(element, callback);
  return () => {
    // A disconnected instance must not unregister a newer connection's callback.
    if (transitionPreparations.get(element) === callback) {
      transitionPreparations.delete(element);
    }
  };
}

export function prepareRailTabTransition(element: HTMLElement): void {
  transitionPreparations.get(element)?.();
}

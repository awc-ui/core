type DefinitionCallbacks = Map<string, Set<() => void>>;
const pending = new WeakMap<CustomElementRegistry, DefinitionCallbacks>();

// Keep the native promise's closure scope independent of individual subscribers.
function getDefinitionCallbacks(registry: CustomElementRegistry, tag: string): Set<() => void> {
  const existing = pending.get(registry);
  const definitions = existing ?? new Map<string, Set<() => void>>();
  if (!existing) pending.set(registry, definitions);

  let callbacks = definitions.get(tag);
  if (!callbacks) {
    const waiting = new Set<() => void>();
    definitions.set(tag, waiting);
    void registry.whenDefined(tag).then(() => {
      definitions.delete(tag);
      for (const notify of waiting) {
        queueMicrotask(() => {
          if (waiting.delete(notify)) notify();
        });
      }
    }, () => {
      definitions.delete(tag);
      waiting.clear();
    });
    callbacks = waiting;
  }
  return callbacks;
}

/** Share the native definition promise without retaining cancelled subscribers. */
export function observeElementDefinition(registry: CustomElementRegistry, tag: string, callback: () => void): () => void {
  const callbacks = getDefinitionCallbacks(registry, tag);
  const notify = () => callback();
  callbacks.add(notify);
  return () => { callbacks.delete(notify); };
}

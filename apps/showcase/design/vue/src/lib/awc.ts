import type { Directive } from "vue";

type Listeners = Record<string, EventListener>;

interface AwcBinding {
  props?: Record<string, unknown>;
  on?: Listeners;
}

interface Bound {
  listeners: Listeners;
  attached: Map<string, EventListener>;
}

const bound = new WeakMap<HTMLElement, Bound>();

function applyProps(
  el: HTMLElement,
  props: Record<string, unknown> | undefined,
): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    // Undefined clears previously applied values, including boolean state.
    const boolean = [
      "disabled",
      "selected",
      "checked",
      "active",
      "open",
      "icons",
      "fullscreen",
      "valueIndicator",
    ].includes(key);
    (el as unknown as Record<string, unknown>)[key] = boolean
      ? Boolean(value)
      : value;
  }
}

function applyListeners(
  el: HTMLElement,
  listeners: Listeners | undefined,
): void {
  // The annotation is load-bearing under `strict`. Without it the fallback
  // literal infers as `{ listeners: {}; attached: Map<any, any> }`, `record`
  // widens to a union with `Bound`, and the `name` in the loop below degrades to
  // `any` — which is how the twin's copy of this file compiles while silently
  // type-checking nothing inside it.
  const record: Bound = bound.get(el) ?? { listeners: {}, attached: new Map() };
  bound.set(el, record);

  // Remove anything that is gone or whose handler identity changed.
  for (const [name, attached] of record.attached) {
    if (listeners?.[name] === record.listeners[name]) continue;
    el.removeEventListener(name, attached);
    record.attached.delete(name);
  }

  for (const [name, handler] of Object.entries(listeners ?? {})) {
    if (record.attached.has(name)) continue;
    // A stable wrapper, so re-binding is driven by handler identity above
    // rather than by the anonymous function a template creates each render.
    const wrapper: EventListener = (event) => handler(event);
    el.addEventListener(name, wrapper);
    record.attached.set(name, wrapper);
  }

  record.listeners = { ...(listeners ?? {}) };
}

export const awcDirective: Directive<HTMLElement, AwcBinding> = {
  mounted(el, binding) {
    applyProps(el, binding.value?.props);
    applyListeners(el, binding.value?.on);
  },
  updated(el, binding) {
    applyProps(el, binding.value?.props);
    applyListeners(el, binding.value?.on);
  },
  unmounted(el) {
    const record = bound.get(el);
    if (!record) return;
    for (const [name, attached] of record.attached)
      el.removeEventListener(name, attached);
    bound.delete(el);
  },
};

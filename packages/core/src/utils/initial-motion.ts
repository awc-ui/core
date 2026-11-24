import { Build, getElement } from '@stencil/core';

/** Private presentation marker. Never serialized by the server renderer. */
const READY = 'data-awc-motion-ready';
type ComponentRef = object | HTMLElement;
interface MotionState {
  element: HTMLElement;
  loaded: boolean;
  rendered: boolean;
  ready: boolean;
  frames: number;
  registry: MotionRegistry;
}
interface MotionRegistry {
  document: Document;
  pending: Set<MotionState>;
  frame: number | undefined;
  timer: number | undefined;
  inputEpoch: number;
  inputEvent?: Event;
  flushedEpoch: number;
}
const states = new WeakMap<HTMLElement, MotionState>();
const registries = new WeakMap<Document, MotionRegistry>();

function host(ref: ComponentRef): HTMLElement {
  return (ref as HTMLElement).nodeType === 1 ? ref as HTMLElement : getElement(ref);
}

function parent(element: Element): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as ShadowRoot;
  return (root.host as HTMLElement | undefined) ?? null;
}

function ancestors(element: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (let current = parent(element); current; current = parent(current)) result.push(current);
  return result;
}

/** Walk both trees: a late-defined owner can adopt already-rendered children. */
function descendants(element: HTMLElement, visit: (element: HTMLElement) => void): void {
  for (const child of Array.from(element.children)) {
    visit(child as HTMLElement);
    descendants(child as HTMLElement, visit);
  }
  if (element.shadowRoot) {
    for (const child of Array.from(element.shadowRoot.children)) {
      visit(child as HTMLElement);
      descendants(child as HTMLElement, visit);
    }
  }
}

function schedule(registry: MotionRegistry): void {
  if (registry.frame !== undefined || registry.timer !== undefined || !registry.pending.size) return;
  const view = registry.document.defaultView;
  if (!view) return;
  if (registry.document.hidden || !view.requestAnimationFrame) {
    const TimerPromise = (view as Window & typeof globalThis).Promise ?? Promise;
    const elapsed = new TimerPromise<void>(resolve => {
      registry.timer = view.setTimeout(resolve, 16);
    });
    const timer = registry.timer;
    void elapsed.then(() => {
      if (registry.timer !== timer) return;
      registry.timer = undefined;
      tick(registry);
    });
  } else {
    // A callback created in a discarded iframe can be skipped by native rAF.
    // Use the destination realm's resolver, then run the existing code as a
    // Promise reaction so adopted components finish their pending baseline.
    const FramePromise = (view as Window & typeof globalThis).Promise ?? Promise;
    const painted = new FramePromise<number>(resolve => {
      registry.frame = view.requestAnimationFrame(resolve);
    });
    const frame = registry.frame;
    void painted.then(() => {
      if (registry.frame !== frame) return;
      registry.frame = undefined;
      tick(registry);
    });
  }
}

function arm(state: MotionState): void {
  state.ready = true;
  state.registry.pending.delete(state);
  state.element.setAttribute(READY, '');
}

function tick(registry: MotionRegistry): void {
  for (const state of registry.pending) {
    if (!state.element.isConnected) {
      registry.pending.delete(state);
    } else if (state.loaded) {
      state.frames++;
    }
  }
  for (const state of registry.pending) {
    if (!state.loaded || state.frames < 2) continue;
    const ownerPending = ancestors(state.element).some(element => {
      const owner = states.get(element);
      return owner && !owner.ready && (!owner.loaded || owner.frames < 2);
    });
    if (!ownerPending) arm(state);
  }
  // A not-yet-loaded owner will schedule us when its lifecycle completes.
  if ([...registry.pending].some(state => state.loaded && state.element.isConnected &&
    !ancestors(state.element).some(element => {
      const owner = states.get(element);
      return owner && !owner.ready && !owner.loaded;
    }))) schedule(registry);
}

function registryFor(document: Document): MotionRegistry {
  let registry = registries.get(document);
  if (registry) return registry;
  registry = { document, pending: new Set(), frame: undefined, timer: undefined, inputEpoch: 0, flushedEpoch: -1 };
  registries.set(document, registry);
  // Capture precedes component handlers. A first genuine action must not lose
  // feedback merely because it arrived before the normal paint boundary.
  const onInput = (event: Event) => {
    if (!registry.pending.size) return;
    const epoch = ++registry.inputEpoch;
    registry.inputEvent = event;
    // Native dispatch may checkpoint microtasks between capture and target.
    // eventPhase tracks the actual dispatch lifetime; clear the bounded event
    // reference after the task instead of dropping provenance before handlers.
    setTimeout(() => {
      if (registry.inputEpoch === epoch) registry.inputEvent = undefined;
    }, 0);
    const path = event.composedPath();
    const target = path.find(node => states.has(node as HTMLElement)) as HTMLElement | undefined;
    if (target) activateInteractionMotion(target);
  };
  for (const type of ['pointerdown', 'keydown', 'click']) document.addEventListener(type, onInput, true);
  return registry;
}

function inputInProgress(registry?: MotionRegistry): boolean {
  return !!registry?.inputEvent && registry.inputEvent.eventPhase !== 0;
}

function quiet(state: MotionState): void {
  state.ready = false;
  state.frames = 0;
  state.element.removeAttribute(READY);
  if (state.element.isConnected) state.registry.pending.add(state);
}

/** Called before initial property/slot/owner synchronization. */
export function beginInitialInteractionMotion(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const element = host(ref);
  if (states.has(element)) return;
  const registry = registryFor(element.ownerDocument);
  const state: MotionState = { element, loaded: false, rendered: false, ready: false, frames: 0, registry };
  states.set(element, state);
  quiet(state);
  // A parent module can land after its independently imported children.
  // Its first ownership assignment is still initialization for those children.
  descendants(element, child => {
    const nested = states.get(child);
    if (nested) quiet(nested);
  });
}

/** Called after the component's complete componentDidLoad work. */
export function completeInitialInteractionMotion(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const element = host(ref);
  if (!states.has(element)) beginInitialInteractionMotion(element);
  const state = states.get(element)!;
  state.loaded = true;
  state.frames = 0;
  if (!state.ready && element.isConnected) state.registry.pending.add(state);
  schedule(state.registry);
}

/** Initial reconciliation renders restart the baseline, never later renders. */
export function initialInteractionMotionRendered(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const state = states.get(host(ref));
  if (!state) return;
  state.rendered = true;
  if (state.ready) return;
  state.frames = 0;
  if (state.loaded && state.element.isConnected) {
    state.registry.pending.add(state);
    schedule(state.registry);
  }
}

/** Preserve readiness across moves; resume a disconnected initial render. */
export function reconnectInteractionMotion(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const state = states.get(host(ref));
  if (!state) return;
  if (state.registry.document !== state.element.ownerDocument) {
    const previous = state.registry;
    previous.pending.delete(state);
    cancelIdleRegistry(previous);
    state.registry = registryFor(state.element.ownerDocument);
    if (!state.ready && state.loaded && state.rendered && state.element.isConnected) {
      // The defining document may be discarded immediately after adoption.
      // Commit the already-rendered snapshot while its callbacks are live.
      state.element.getBoundingClientRect();
      arm(state);
    }
  }
  if (state.ready || !state.loaded) return;
  state.frames = 0;
  state.registry.pending.add(state);
  schedule(state.registry);
}

export function disconnectInteractionMotion(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const state = states.get(host(ref));
  if (!state) return;
  state.registry.pending.delete(state);
  cancelIdleRegistry(state.registry);
}

function cancelIdleRegistry(registry: MotionRegistry): void {
  if (registry.pending.size) return;
  if (registry.frame !== undefined) {
    registry.document.defaultView?.cancelAnimationFrame(registry.frame);
    registry.frame = undefined;
  }
  if (registry.timer !== undefined) {
    registry.document.defaultView?.clearTimeout(registry.timer);
    registry.timer = undefined;
  }
}

/** For an initial owner snapshot applied to a separately rendered control. */
export function suppressInteractionMotion(element: HTMLElement): void {
  if (!Build.isBrowser) return;
  const state = states.get(element);
  if (!state) return;
  quiet(state);
  descendants(element, child => {
    const nested = states.get(child);
    if (nested) quiet(nested);
  });
  schedule(state.registry);
}

/** Arm a real imperative action or early input after committing its baseline. */
export function activateInteractionMotion(element: HTMLElement): void {
  if (!Build.isBrowser) return;
  const registry = registries.get(element.ownerDocument);
  if (!registry?.pending.size) return;
  const scope = [element, ...ancestors(element)].filter(owner => states.has(owner));
  const root = scope.at(-1) ?? element;
  const pending = scope.map(candidate => states.get(candidate)!).filter(state =>
    !state.ready && state.rendered && state.element.isConnected);
  if (!pending.length) return;
  // Only the exceptional early-action path needs a synchronous layout flush.
  // The normal path uses shared paint scheduling, with no per-component reads.
  if (!inputInProgress(registry) || registry.flushedEpoch !== registry.inputEpoch) {
    root.getBoundingClientRect();
    registry.flushedEpoch = registry.inputEpoch;
  }
  for (const state of pending) arm(state);
}

/** Synchronous property updates made by an external input handler are actions,
 * even when the affected control is not on the original event's composed path. */
export function prepareInteractionUpdate(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const element = host(ref);
  const registry = registries.get(element.ownerDocument);
  if (inputInProgress(registry)) activateInteractionMotion(element);
}

/** Use for interaction keyframes/WAAPI, never for intrinsic loading activity. */
export function canAnimateInteraction(element: HTMLElement): boolean {
  if (!Build.isBrowser || !element.isConnected) return false;
  if (inputInProgress(registries.get(element.ownerDocument))) activateInteractionMotion(element);
  if (!element.hasAttribute(READY)) return false;
  if (element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return !ancestors(element).some(owner => {
    const state = states.get(owner);
    return state && !state.ready;
  });
}

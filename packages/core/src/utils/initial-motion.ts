import { Build, getElement } from '@stencil/core';

/** Private presentation marker. Never serialized by the server renderer. */
const READY = 'data-awc-motion-ready';
type ComponentRef = object | HTMLElement;
interface MotionState {
  element: HTMLElement;
  loaded: boolean;
  rendered: boolean;
  ready: boolean;
  counted: boolean;
  frames: number;
  registry: MotionRegistry;
}
interface MotionRegistry {
  document: Document;
  pending: Set<MotionState>;
  frame: number | undefined;
  timer: number | undefined;
  readyCount: number;
  inputEpoch: number;
  inputEvents: Event[];
  flushedEpoch: number;
}
const states = new WeakMap<HTMLElement, MotionState>();
const registries = new WeakMap<Document, MotionRegistry>();

function host(ref: ComponentRef): HTMLElement {
  return (ref as HTMLElement).nodeType === 1 ? ref as HTMLElement : getElement(ref);
}

function parent(element: Element): HTMLElement | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as ShadowRoot;
  return (root.host as HTMLElement | undefined) ?? null;
}

function hasPendingOwner(element: HTMLElement, minimumFrames = Infinity): boolean {
  for (let current = parent(element); current; current = parent(current)) {
    const owner = states.get(current);
    if (owner && !owner.ready && (!owner.loaded || owner.frames < minimumFrames)) return true;
  }
  return false;
}

/** A late-defined owner can adopt controls in light DOM, shadow DOM or slots. */
function quietDescendants(owner: MotionState): void {
  // Without an armed control there is no enabled descendant to quiet.
  // Pending children already wait on their owner via the composed ancestry.
  if (!owner.registry.readyCount) return;
  const queue: Element[] = [owner.element];
  const visited = new Set<Element>();
  while (queue.length) {
    const node = queue.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    if (node !== owner.element) {
      const child = states.get(node as HTMLElement);
      if (child?.ready) quiet(child);
      if (!owner.registry.readyCount) return;
    }
    for (const child of Array.from(node.children)) queue.push(child);
    if (node.shadowRoot) for (const child of Array.from(node.shadowRoot.children)) queue.push(child);
    if (node.localName === 'slot') {
      for (const child of (node as HTMLSlotElement).assignedElements?.() ?? []) queue.push(child);
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
  countReady(state, true);
  state.registry.pending.delete(state);
  state.element.setAttribute(READY, '');
}

function countReady(state: MotionState, counted: boolean): void {
  if (state.counted === counted) return;
  state.counted = counted;
  state.registry.readyCount += counted ? 1 : -1;
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
    if (!hasPendingOwner(state.element, 2)) arm(state);
  }
  // A not-yet-loaded owner will schedule us when its lifecycle completes.
  for (const state of registry.pending) {
    if (state.loaded && state.element.isConnected && !hasPendingOwner(state.element, 0)) {
      schedule(registry);
      break;
    }
  }
}

function registryFor(document: Document): MotionRegistry {
  let registry = registries.get(document);
  if (registry) return registry;
  registry = {
    document, pending: new Set(), frame: undefined, timer: undefined, readyCount: 0,
    inputEpoch: 0, inputEvents: [], flushedEpoch: -1,
  };
  registries.set(document, registry);
  // Capture precedes component handlers. A first genuine action must not lose
  // feedback merely because it arrived before the normal paint boundary.
  const onInput = (event: Event) => {
    if (!registry.pending.size) return;
    if (!inputInProgress(registry)) {
      const epoch = ++registry.inputEpoch;
      // Native dispatch may checkpoint microtasks between capture and target.
      // Keep the dispatch stack until the task ends, regardless of nesting.
      setTimeout(() => {
        if (registry.inputEpoch === epoch) registry.inputEvents.length = 0;
      }, 0);
    }
    registry.inputEvents.push(event);
    const path = event.composedPath();
    const target = path.find(node => states.has(node as HTMLElement)) as HTMLElement | undefined;
    if (target) activateInteractionMotion(target);
  };
  for (const type of ['pointerdown', 'keydown', 'click']) document.addEventListener(type, onInput, true);
  return registry;
}

function inputInProgress(registry?: MotionRegistry): boolean {
  if (!registry) return false;
  const { inputEvents } = registry;
  while (inputEvents.at(-1)?.eventPhase === 0) inputEvents.pop();
  return inputEvents.length > 0;
}

function quiet(state: MotionState): void {
  state.ready = false;
  countReady(state, false);
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
  const state: MotionState = { element, loaded: false, rendered: false, ready: false, counted: false, frames: 0, registry };
  states.set(element, state);
  quiet(state);
  // A parent module can land after its independently imported children.
  // Its first ownership assignment is still initialization for those children.
  quietDescendants(state);
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
    countReady(state, false);
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
  if (state.ready) {
    countReady(state, true);
    return;
  }
  if (!state.loaded) return;
  state.frames = 0;
  state.registry.pending.add(state);
  schedule(state.registry);
}

export function disconnectInteractionMotion(ref: ComponentRef): void {
  if (!Build.isBrowser) return;
  const state = states.get(host(ref));
  if (!state) return;
  countReady(state, false);
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
  quietDescendants(state);
  schedule(state.registry);
}

/** Arm a real imperative action or early input after committing its baseline. */
export function activateInteractionMotion(element: HTMLElement): void {
  if (!Build.isBrowser) return;
  const registry = registries.get(element.ownerDocument);
  if (!registry?.pending.size) return;
  // Walk once without allocating arrays for every ancestor at cold startup.
  const pending: MotionState[] = [];
  let root = element;
  for (let current: HTMLElement | null = element; current; current = parent(current)) {
    const state = states.get(current);
    if (!state) continue;
    root = current;
    if (!state.ready && state.rendered && current.isConnected) pending.push(state);
  }
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
  return !hasPendingOwner(element);
}

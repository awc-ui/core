import { activateInteractionMotion } from './initial-motion';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function afterFrame(document: Document, callback: () => void): () => void {
  const view = document.defaultView as (Window & typeof globalThis) | null;
  if (!view) {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }

  // A host may belong to a new window while its class still lives in a
  // detached iframe. Schedule a native callback from the destination realm.
  const ViewPromise = view.Promise ?? Promise;
  let cancel!: () => void;
  void new ViewPromise<unknown>((resolve) => {
    if (!view.requestAnimationFrame || document.hidden) {
      const timer = view.setTimeout(resolve, 0);
      cancel = () => view.clearTimeout(timer);
    } else {
      const frame = view.requestAnimationFrame(resolve);
      cancel = () => view.cancelAnimationFrame?.(frame);
    }
  }).then(callback);
  return cancel;
}

async function painted(element: HTMLElement): Promise<void> {
  await new Promise<void>(resolve => { afterFrame(element.ownerDocument, resolve); });
  await new Promise<void>(resolve => { afterFrame(element.ownerDocument, resolve); });
}

/** Wait only for this overlay's shell, not slotted controls or their spinners. */
export async function finishShellMotion(element: HTMLElement): Promise<void> {
  await painted(element);
  const animations = new Set([
    ...(element.getAnimations?.({ subtree: true }) ?? []),
    ...(element.shadowRoot?.getAnimations?.() ?? []),
  ]);
  await Promise.allSettled([...animations].filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    return (target === element || target?.getRootNode() === element.shadowRoot)
      && animation.effect?.getTiming().iterations !== Infinity;
  }).map((animation) => animation.finished));
}

/**
 * Shared imperative-overlay lifecycle. CSR @Method calls are not queued by
 * Stencil, so a first show() must wait for the initial closed render/paint.
 * Existing close()/mdClose timing stays unchanged; whenClosed() is the separate
 * completion contract for consumers that remove or replace an overlay.
 */
export class OverlayLifecycle {
  private initialized = deferred();
  private initialDocument?: Document;
  private initialBaselineComplete = false;
  private initializationEpoch = 0;
  private cancelInitializationFrame?: () => void;
  private pendingOpen?: ReturnType<typeof deferred>;
  private cycle?: ReturnType<typeof deferred>;
  private request = 0;
  private transition = 0;
  private disconnected = false;

  constructor(private element: () => HTMLElement, private isOpen: () => boolean) {}

  connected(): void {
    this.disconnected = false;
    this.prepareInitialBaseline();
  }

  loaded(): void {
    if (!this.initialBaselineComplete) this.initialDocument ??= this.element().ownerDocument;
    if (this.isOpen()) this.opened();
    this.prepareInitialBaseline();
  }

  private prepareInitialBaseline(): void {
    if (!this.initialDocument || this.initialBaselineComplete || this.disconnected) return;
    this.cancelInitializationFrame?.();
    const element = this.element();
    const document = element.ownerDocument;
    const epoch = ++this.initializationEpoch;
    if (document !== this.initialDocument) {
      // The rendered overlay can outlive the iframe that defined its class.
      // Commit its existing styles in the new document before enabling show().
      element.getBoundingClientRect();
      this.completeInitialBaseline();
      return;
    }
    const isCurrent = () => epoch === this.initializationEpoch && element.ownerDocument === document;
    this.cancelInitializationFrame = afterFrame(document, () => {
      if (!isCurrent()) return;
      this.cancelInitializationFrame = afterFrame(document, () => {
        if (!isCurrent()) return;
        this.completeInitialBaseline();
      });
    });
  }

  private completeInitialBaseline(): void {
    this.initialDocument = undefined;
    this.cancelInitializationFrame = undefined;
    this.initialBaselineComplete = true;
    this.initialized.resolve();
  }

  async show(open: () => void): Promise<void> {
    this.pendingOpen?.resolve();
    const pending = this.pendingOpen = deferred();
    const request = ++this.request;
    ++this.transition;
    this.cycle ??= deferred();
    await Promise.race([this.initialized.promise, pending.promise]);
    if (this.disconnected || request !== this.request) return;
    this.pendingOpen = undefined;
    activateInteractionMotion(this.element());
    open();
  }

  cancelOpen(): void {
    ++this.request;
    this.pendingOpen?.resolve();
    this.pendingOpen = undefined;
    if (!this.isOpen()) this.closed();
  }

  opened(): void {
    ++this.transition;
    this.cycle ??= deferred();
  }

  closed(): void {
    const cycle = this.cycle;
    if (!cycle) return;
    const transition = ++this.transition;
    void finishShellMotion(this.element()).then(() => {
      if (transition !== this.transition || this.isOpen() || this.pendingOpen) return;
      this.cycle = undefined;
      cycle.resolve();
    });
  }

  whenClosed(): Promise<void> {
    if (this.disconnected) return Promise.resolve();
    if (this.isOpen()) this.cycle ??= deferred();
    return this.cycle?.promise ?? Promise.resolve();
  }

  disconnect(): void {
    this.disconnected = true;
    ++this.initializationEpoch;
    this.cancelInitializationFrame?.();
    this.cancelInitializationFrame = undefined;
    ++this.request;
    ++this.transition;
    this.pendingOpen?.resolve();
    this.pendingOpen = undefined;
    this.cycle?.resolve();
    this.cycle = undefined;
  }
}

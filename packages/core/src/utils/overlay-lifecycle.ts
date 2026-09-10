function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function frame(element: HTMLElement): Promise<void> {
  const view = element.ownerDocument?.defaultView;
  return new Promise((resolve) => {
    if (!view?.requestAnimationFrame || element.ownerDocument.hidden) {
      setTimeout(resolve, 0);
    } else {
      view.requestAnimationFrame(() => resolve());
    }
  });
}

async function painted(element: HTMLElement): Promise<void> {
  await frame(element);
  await frame(element);
}

/** Wait only for this overlay's shell, not slotted controls or their spinners. */
async function finishShellMotion(element: HTMLElement): Promise<void> {
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
  private pendingOpen?: ReturnType<typeof deferred>;
  private cycle?: ReturnType<typeof deferred>;
  private request = 0;
  private transition = 0;
  private disconnected = false;

  constructor(private element: () => HTMLElement, private isOpen: () => boolean) {}

  connected(): void { this.disconnected = false; }

  loaded(): void {
    if (this.isOpen()) this.opened();
    void painted(this.element()).then(() => this.initialized.resolve());
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
    ++this.request;
    ++this.transition;
    this.pendingOpen?.resolve();
    this.pendingOpen = undefined;
    this.cycle?.resolve();
    this.cycle = undefined;
  }
}

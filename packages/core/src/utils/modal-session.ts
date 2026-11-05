type DocumentSession = {
  owners: ModalSession[];
  overflow: string;
  priority: string;
};

// Shared by every modal component type. One component cannot release another
// component's scroll lock or restore focus behind the current modal.
const sessions = new WeakMap<Document, DocumentSession>();

function composedContains(container: Element, node: Element | null): boolean {
  for (let current = node; current; ) {
    if (current === container) return true;
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
  }
  return false;
}

/** Owns modal scroll/focus resources; event listeners remain with the component. */
export class ModalSession {
  private acquiredDocument?: Document;
  private previousFocus: HTMLElement | null = null;

  constructor(
    private readonly getElement: () => HTMLElement,
    private readonly onCovered?: () => void,
  ) {}

  get document(): Document | undefined { return this.acquiredDocument; }
  get owns(): boolean { return this.acquiredDocument !== undefined; }

  isTop(): boolean {
    const doc = this.acquiredDocument;
    if (!doc || doc !== this.getElement().ownerDocument) return false;
    const owners = sessions.get(doc)?.owners;
    return owners?.[owners.length - 1] === this;
  }

  acquire(): void {
    const element = this.getElement();
    const doc = element.ownerDocument;
    if (this.acquiredDocument === doc) return;
    // ownerDocument can change before a disconnect callback during adoption.
    if (this.acquiredDocument) this.release();
    let session = sessions.get(doc);
    if (!session) {
      session = {
        owners: [],
        overflow: doc.body.style.overflow,
        priority: typeof doc.body.style.getPropertyPriority === 'function'
          ? doc.body.style.getPropertyPriority('overflow') : '',
      };
      sessions.set(doc, session);
    }
    // The component's own root remains observable inside a closed outer root.
    const root = element.getRootNode() as Document | ShadowRoot;
    let focused = root.activeElement ?? doc.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    this.previousFocus = focused as HTMLElement | null;
    const previousOwner = session.owners[session.owners.length - 1];
    session.owners.push(this);
    this.acquiredDocument = doc;
    doc.body.style.setProperty('overflow', 'hidden');
    // Publish ownership first, so any late pointer callback already sees that
    // the previous modal is covered when its capture is released.
    previousOwner?.onCovered?.();
  }

  release(): void {
    const doc = this.acquiredDocument;
    if (!doc) return;
    const session = sessions.get(doc);
    const wasTop = session?.owners[session.owners.length - 1] === this;
    const returnFocus = this.previousFocus;
    if (session) {
      // Preserve the original return target if a lower modal closes first.
      for (const owner of session.owners) {
        if (owner !== this && composedContains(this.getElement(), owner.previousFocus)) {
          owner.previousFocus = returnFocus;
        }
      }
      session.owners = session.owners.filter(owner => owner !== this);
      if (session.owners.length === 0) {
        doc.body.style.setProperty('overflow', session.overflow, session.priority);
        sessions.delete(doc);
      }
    }
    // Clear ownership before focus(), which may synchronously open another modal.
    this.acquiredDocument = undefined;
    this.previousFocus = null;
    if (wasTop && returnFocus?.isConnected) returnFocus.focus?.({ preventScroll: true });
  }
}

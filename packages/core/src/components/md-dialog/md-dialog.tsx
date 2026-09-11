import { Component, Host, h, Prop, Event, EventEmitter, Method, Watch, State, Element, Listen } from '@stencil/core';
import { OverlayLifecycle } from '../../utils/overlay-lifecycle';
import { resolveDialogLabel } from './dialog-utils';

@Component({
  tag: 'md-dialog',
  styleUrl: 'md-dialog.css',
  shadow: true,
})
export class MdDialog {
  @Element() el!: HTMLElement;

  private overlayLifecycle = new OverlayLifecycle(() => this.el, () => this.open);

  /** Whether the dialog is open */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Headline text (or use the headline slot) */
  @Prop() headline: string = '';

  /** Icon name (Material Symbols shorthand, or use the icon slot) */
  @Prop() icon: string = '';

  /** Full-screen variant */
  @Prop({ reflect: true }) fullscreen: boolean = false;

  /** Whether clicking the scrim closes the dialog */
  @Prop({ attribute: 'scrim-dismissible' }) scrimDismissible: boolean = true;

  /** BCP-47 locale for built-in button labels (Close, Cancel, OK). */
  @Prop() locale: string = 'en-US';

  /**
   * Accessible label for the full-screen close button.
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'close-label' }) closeLabel: string = '';

  /**
   * Label for the default cancel action button (slot fallback).
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'cancel-label' }) cancelLabel: string = '';

  /**
   * Label for the default confirm action button (slot fallback).
   * Leave empty to derive from `locale`.
   */
  @Prop({ attribute: 'ok-label' }) okLabel: string = '';

  /** Show divider between content and actions */
  @Prop({ reflect: true }) divider: boolean = false;

  /** Show divider between header and content (full-screen) */
  @Prop({ attribute: 'header-divider', reflect: true }) headerDivider: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when the dialog opens */
  @Event() mdOpen: EventEmitter<void>;

  /** Emits when the dialog closes */
  @Event() mdClose: EventEmitter<void>;

  /** Emits when dismissed via scrim or Escape */
  @Event() mdCancel: EventEmitter<void>;

  @State() private animating: boolean = false;
  @State() private hasSlottedIcon = false;
  @State() private hasSlottedHeadline = false;
  @State() private hasSlottedActions = false;

  private headlineId = `md-dialog-headline-${Math.random().toString(36).slice(2)}`;
  private contentId = `md-dialog-content-${Math.random().toString(36).slice(2)}`;
  private containerEl!: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private openFocusFrame?: number;

  @Watch('open')
  openChanged(newVal: boolean) {
    this.cancelOpenFocus();
    if (newVal) this.overlayLifecycle.opened();
    else this.overlayLifecycle.closed();
    this.animating = true;
    setTimeout(() => { this.animating = false; }, 300);

    if (newVal) {
      this.previousFocus = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      this.mdOpen.emit();
      this.openFocusFrame = requestAnimationFrame(() => {
        this.openFocusFrame = undefined;
        if (!this.open || !this.el.isConnected) return;
        this.focusFirst();
      });
    } else {
      document.body.style.overflow = '';
      this.mdClose.emit();
      // `preventScroll` because a bare focus() scrolls its target into view: an
      // overlay opened programmatically (or whose opener has since scrolled out
      // of sight) would yank the page on close.
      this.previousFocus?.focus?.({ preventScroll: true });
      this.previousFocus = null;
    }
  }

  connectedCallback() {
    this.overlayLifecycle.connected();
    if (this.open) {
      document.body.style.overflow = 'hidden';
    }
  }

  componentWillLoad() {
    // Seed slot-presence flags from the LIGHT-DOM children that are
    // already in place on first render. The headline / icon slots
    // are rendered *conditionally* — the surrounding wrapper only
    // mounts when "we have a headline". If the user passes ONLY
    // slotted content (no `headline` / `icon` prop), the first
    // render has no slot in shadow DOM yet, so `slotchange` (wired
    // in componentDidLoad) can never fire and we'd be stuck rendering
    // nothing — exactly the "custom headline slot doesn't show" bug.
    //
    // We walk direct children explicitly (rather than running a
    // `:scope > [slot="…"]` query) because Stencil's mock-doc
    // doesn't yet implement the `:scope` pseudo-class. Children-
    // walking is also fractionally cheaper for the small N of
    // direct dialog children.
    this.hasSlottedHeadline = this.hasDirectSlottedChild('headline');
    this.hasSlottedIcon = this.hasDirectSlottedChild('icon');
    this.hasSlottedActions = this.hasDirectSlottedChild('actions');
  }

  private hasDirectSlottedChild(slotName: string): boolean {
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].getAttribute('slot') === slotName) return true;
    }
    return false;
  }

  componentDidLoad() {
    this.overlayLifecycle.loaded();
    // Once the slot wrappers exist (because the seed above made them
    // render), register `slotchange` listeners so dynamic add/remove
    // of slotted children at runtime keeps the host state in sync.
    this.bindSlotListener('icon', (v) => { this.hasSlottedIcon = v; });
    this.bindSlotListener('headline', (v) => {
      this.hasSlottedHeadline = v;
    });
    this.bindSlotListener('actions', (v) => {
      this.hasSlottedActions = v;
    });
  }

  private bindSlotListener(
    name: string,
    setter: (hasContent: boolean) => void,
  ): void {
    const slot = this.el.shadowRoot?.querySelector(
      `slot[name="${name}"]`,
    ) as HTMLSlotElement | null;
    if (!slot) return;
    slot.addEventListener('slotchange', () => {
      setter(slot.assignedElements().length > 0);
    });
  }

  disconnectedCallback() {
    this.cancelOpenFocus();
    this.overlayLifecycle.disconnect();
    document.body.style.overflow = '';
  }

  /** Open the dialog */
  @Method()
  async show() {
    await this.overlayLifecycle.show(() => { this.open = true; });
  }

  /** Resolves after the current open cycle and shell exit motion finish; safe to unmount afterward. */
  @Method()
  async whenClosed(): Promise<void> {
    await this.overlayLifecycle.whenClosed();
  }

  /** Close the dialog */
  @Method()
  async close() {
    this.overlayLifecycle.cancelOpen();
    this.open = false;
  }

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.mdCancel.emit();
      this.open = false;
      return;
    }

    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private handleScrimClick = () => {
    if (!this.scrimDismissible) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleCloseClick = () => {
    this.mdCancel.emit();
    this.open = false;
  };

  private handleDefaultOkClick = () => {
    this.open = false;
  };

  private resolvedLabel(
    explicit: string,
    key: 'close' | 'cancel' | 'ok',
  ): string {
    return explicit || resolveDialogLabel(this.locale, key);
  }

  private cancelOpenFocus() {
    if (this.openFocusFrame === undefined) return;
    cancelAnimationFrame(this.openFocusFrame);
    this.openFocusFrame = undefined;
  }

  private focusFirst() {
    if (!this.containerEl) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl.focus();
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // The naïve `document.activeElement === first` check breaks the
    // moment a slotted custom element (md-text-field, md-radio, …) owns
    // focus: focus retargets to the host at every shadow boundary, so
    // `document.activeElement` reports the host while `focusable[]`
    // contains the inner <input>. `getDeepActiveElement()` walks down
    // every open `shadowRoot.activeElement` link until it bottoms out
    // on the actual focused leaf, which is what `focusable[]` stores.
    const deep = getDeepActiveElement();

    if (e.shiftKey) {
      if (deep === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (deep === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Tabbable selector intentionally excludes hidden inputs / radios
  // managed by a roving tabindex (-1) — those should never count as
  // a stop in the dialog's tab order.
  private static FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), ' +
    'audio[controls], video[controls], summary, ' +
    '[tabindex]:not([tabindex="-1"])';

  private renderActions() {
    if (this.hasSlottedActions) {
      return (
        <div class="md-dialog__actions" part="actions">
          <slot name="actions" />
        </div>
      );
    }

    return (
      <div class="md-dialog__actions" part="actions">
        <md-button
          variant="text"
          onMdClick={this.handleCloseClick}
          part="cancel-button"
        >
          {this.resolvedLabel(this.cancelLabel, 'cancel')}
        </md-button>
        <md-button
          variant="filled"
          onMdClick={this.handleDefaultOkClick}
          part="ok-button"
        >
          {this.resolvedLabel(this.okLabel, 'ok')}
        </md-button>
      </div>
    );
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.containerEl) return [];

    const collected: HTMLElement[] = [];
    collectTabbablesDeep(this.containerEl, MdDialog.FOCUSABLE_SELECTOR, collected);
    return collected.filter(isVisible);
  }

  render() {
    const hasIcon = !!this.icon || this.hasSlottedIcon;
    // `headline` prop OR slotted `[slot="headline"]` child counts as
    // "has a headline". Without the slot fork the entire headline
    // wrapper (and the slot inside it) was suppressed when only
    // slotted content was provided, which made the slot effectively
    // unreachable.
    const hasHeadline = !!this.headline || this.hasSlottedHeadline;

    return (
      <Host
        class={{
          'md-dialog': true,
          'md-dialog--open': this.open,
          'md-dialog--fullscreen': this.fullscreen,
          'md-dialog--animating': this.animating,
          'md-dialog--has-icon': hasIcon,
        }}
      >
        {/* Scrim */}
        {!this.fullscreen && (
          <div
            class="md-dialog__scrim"
            part="scrim"
            aria-hidden="true"
            onClick={this.handleScrimClick}
          ></div>
        )}

        {/* Container */}
        <div
          class="md-dialog__container"
          part="container"
          role={this.fullscreen ? 'dialog' : 'alertdialog'}
          aria-modal="true"
          aria-labelledby={hasHeadline ? this.headlineId : undefined}
          aria-describedby={this.contentId}
          tabindex={-1}
          ref={(el) => (this.containerEl = el!)}
        >
          {/* Full-screen header */}
          {this.fullscreen && (
            <div class="md-dialog__header" part="header">
              <button
                class="md-dialog__close-btn"
                part="close-button"
                aria-label={this.resolvedLabel(this.closeLabel, 'close')}
                onClick={this.handleCloseClick}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
              {hasHeadline && (
                <span id={this.headlineId} class="md-dialog__header-headline" part="headline">
                  {this.headline}
                </span>
              )}
              <slot name="header-action"></slot>
            </div>
          )}

          {this.fullscreen && this.headerDivider && (
            <div class="md-dialog__divider" part="divider" aria-hidden="true"></div>
          )}

          {/* Basic header: icon + headline */}
          {!this.fullscreen && (
            <div class="md-dialog__basic-header" part="header">
              {/* Icon */}
              <slot name="icon">
                {this.icon && (
                  <span class="md-dialog__icon material-symbols-outlined" part="icon" aria-hidden="true">
                    {this.icon}
                  </span>
                )}
              </slot>

              {/* Headline */}
              {hasHeadline && (
                <div
                  id={this.headlineId}
                  class="md-dialog__headline"
                  part="headline"
                >
                  <slot name="headline">{this.headline}</slot>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div id={this.contentId} class="md-dialog__content" part="content">
            <slot></slot>
          </div>

          {/* Divider */}
          {this.divider && (
            <div class="md-dialog__divider" part="divider" aria-hidden="true"></div>
          )}

          {/* Actions */}
          {this.renderActions()}
        </div>
      </Host>
    );
  }
}

// ─── Module-private focus-trap helpers ─────────────────────────────
//
// Lifted out of the class so the focus-trap logic stays declarative
// (`getFocusableElements()` reads as a pipeline, not a maze of inline
// recursions) AND so each helper is independently unit-testable in
// the future without instantiating a Stencil component.

/** Walk the rendered (composed) tree in order. A shadow root replaces its
 * host's light children; a slot inserts assigned children at that position.
 * Collecting all light-DOM controls before shadow controls would focus a later
 * switch before an earlier text field and give the trap the wrong edges. */
function collectTabbablesDeep(
  root: Element | ShadowRoot,
  selector: string,
  out: HTMLElement[],
): void {
  const seen = new Set<Element>();
  const visit = (element: Element): void => {
    if (seen.has(element)) return;
    seen.add(element);
    if (element.hasAttribute('hidden') || element.hasAttribute('inert')) return;

    if (element.localName === 'slot') {
      const assigned = (element as HTMLSlotElement).assignedElements({ flatten: true });
      const children = assigned.length ? assigned : Array.from(element.children);
      children.forEach(visit);
      return;
    }

    const shadow = element.shadowRoot;
    const tabindex = element.getAttribute('tabindex');
    const excluded = tabindex !== null && Number(tabindex) < 0;
    // A negative-tabindex shadow host removes its entire focus scope from
    // sequential navigation. Ordinary non-tabbable wrappers still expose theirs.
    if (shadow && excluded) return;
    // delegatesFocus hosts focus their inner control, not a separate stop. Do
    // not discard a composite widget's inner fields just because its host is
    // also focusable: without delegation those are distinct browser tab stops.
    if (!excluded && !shadow?.delegatesFocus && element.matches(selector)) {
      out.push(element as HTMLElement);
    }
    Array.from((shadow ?? element).children).forEach(visit);
  };
  Array.from(root.children).forEach(visit);
}

/** Find the actually-focused element, regardless of how many open
 *  shadow boundaries it sits behind. `document.activeElement` reports
 *  the host of the topmost open shadow root, so for an `<input>`
 *  inside `<md-text-field>` it returns `<md-text-field>` rather than
 *  the input. We chase `shadowRoot.activeElement` until it bottoms
 *  out — the leaf is what `collectTabbablesDeep()` stored in the
 *  focusable list, so a `===` comparison against it works. */
function getDeepActiveElement(): Element | null {
  let active: Element | null = document.activeElement;
  while (active) {
    const sr = (active as Element & { shadowRoot?: ShadowRoot | null })
      .shadowRoot;
    if (!sr || !sr.activeElement) break;
    active = sr.activeElement;
  }
  return active;
}

/** Tab-order visibility check that survives shadow boundaries.
 *  `offsetParent` returns null for shadow descendants in some engines
 *  (and for `position: fixed` elements always), so we fall back to a
 *  bounding-rect probe — an element with non-zero size in the layout
 *  tree is what the user can actually focus. */
function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return true;
  // Off-screen-but-laid-out check (e.g. virtualised inputs that have
  // zero box but are still tabbable in the DOM). Conservative — if
  // both probes fail we treat the element as not focusable.
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

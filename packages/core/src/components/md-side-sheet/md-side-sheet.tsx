import { createId } from '../../utils/id';
import { Component, Host, h, Prop, Event, EventEmitter, Method, Watch, State, Element } from '@stencil/core';
import { OverlayLifecycle } from '../../utils/overlay-lifecycle';
import { ModalSession } from '../../utils/modal-session';

/**
 * MD3 Side sheet — anchored panel for secondary content and actions.
 *
 * @slot - Main content
 * @slot headline - Custom headline content
 * @slot back - Custom back icon element (modal only)
 * @slot actions - Bottom action buttons (optional)
 * @slot close - Custom close element (replaces default close icon button)
 *
 * @part scrim - Modal scrim overlay
 * @part container - Sheet surface
 * @part header - Header row (headline + close)
 * @part headline - Headline text
 * @part close - Close button wrapper
 * @part divider-top - Top divider (between header and content)
 * @part divider-bottom - Bottom divider (between content and actions)
 * @part content - Scrollable content area
 * @part actions - Bottom action bar
 */
@Component({
  tag: 'md-side-sheet',
  styleUrl: 'md-side-sheet.css',
  shadow: true,
})
export class MdSideSheet {
  @Element() el!: HTMLElement;

  private overlayLifecycle = new OverlayLifecycle(() => this.el, () => this.open);
  private modalSession = new ModalSession(() => this.el);
  private loaded = false;
  private connected = false;

  /** Whether the sheet is visible */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** `standard` coexists with page content; `modal` overlays with scrim */
  @Prop({ reflect: true }) variant: 'standard' | 'modal' = 'standard';

  /** Which edge the sheet is anchored to */
  @Prop({ reflect: true }) side: 'start' | 'end' = 'end';

  /** Headline text (or use the headline slot) */
  @Prop() headline: string = '';

  /** Show close icon button */
  @Prop({ reflect: true }) closeable: boolean = true;

  /** Show optional back navigation icon (modal only) */
  @Prop({ reflect: true, attribute: 'show-back' }) showBack: boolean = false;

  /** Whether clicking the scrim closes the sheet (modal only) */
  @Prop({ attribute: 'scrim-dismissible' }) scrimDismissible: boolean = true;

  /** Show divider between header and content */
  @Prop({ reflect: true, attribute: 'top-divider' }) topDivider: boolean = false;

  /** Show divider between content and actions */
  @Prop({ reflect: true, attribute: 'bottom-divider' }) bottomDivider: boolean = false;

  /** Detached style with rounded corners and margin */
  @Prop({ reflect: true }) detached: boolean = false;

  /** Custom aria-label for the container */
  @Prop({ attribute: 'aria-label' }) sheetAriaLabel: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ── Events ──────────────────────────────────────────────

  /** Emits when the sheet opens */
  @Event() mdOpen: EventEmitter<void>;

  /** Emits when the sheet closes */
  @Event() mdClose: EventEmitter<void>;

  /** Emits when dismissed via scrim click or Escape */
  @Event() mdCancel: EventEmitter<void>;

  /** Emits when the back button is pressed (modal only) */
  @Event() mdBack: EventEmitter<void>;

  // ── Internal state ──────────────────────────────────────

  @State() private hasActions = false;
  @State() private hasSlottedHeadline = false;

  private slotObserver?: MutationObserver;
  private containerEl!: HTMLElement;
  private openFocusFrame?: number;
  private headlineId = createId('md-side-sheet-headline');

  // ── Lifecycle ───────────────────────────────────────────

  connectedCallback() {
    this.connected = true;
    this.overlayLifecycle.connected();
    this.syncSlots();
    // React can append children after the host connects. The actions slot is
    // conditional, so its own slotchange cannot discover the first insertion.
    // Observe only changes that affect this host's direct slot assignments.
    if (typeof MutationObserver !== 'undefined') {
      this.slotObserver = new MutationObserver((records) => {
        if (records.some((record) => record.type === 'childList'
          ? record.target === this.el
          : record.target.parentNode === this.el)) {
          this.syncSlots();
        }
      });
      this.slotObserver.observe(this.el, {
        childList: true,
        attributes: true,
        attributeFilter: ['slot'],
        subtree: true,
      });
    }
    if (this.loaded && this.open && this.variant === 'modal') this.activateSession();
  }

  componentWillLoad() {
    this.syncSlots();
  }

  componentDidLoad() {
    this.loaded = true;
    this.syncSlots();
    this.overlayLifecycle.loaded();

    if (this.open) {
      this.onOpenChange(true);
    }
  }

  disconnectedCallback() {
    this.connected = false;
    this.slotObserver?.disconnect();
    this.slotObserver = undefined;
    this.deactivateSession();
    this.overlayLifecycle.disconnect();
  }

  private syncSlots = () => {
    // Nested slot attributes belong to their own component, not this sheet.
    const children = Array.from(this.el.children);
    this.hasActions = children.some(child => child.getAttribute('slot') === 'actions');
    this.hasSlottedHeadline = children.some(child => child.getAttribute('slot') === 'headline');
  };

  // ── Watchers ────────────────────────────────────────────

  @Watch('open')
  onOpenChange(newVal: boolean) {
    this.cancelOpenFocus();
    if (!this.loaded || !this.connected) return;
    if (newVal) {
      this.overlayLifecycle.opened();
      if (this.variant === 'modal') this.activateSession();
      this.mdOpen.emit();
    } else {
      this.overlayLifecycle.closed();
      this.deactivateSession();
      this.mdClose.emit();
    }
  }

  @Watch('variant')
  onVariantChange() {
    if (!this.loaded || !this.connected || !this.open) return;
    if (this.variant === 'modal') this.activateSession();
    else this.deactivateSession();
  }

  private activateSession() {
    if (this.modalSession.owns && this.modalSession.document !== this.el.ownerDocument) this.deactivateSession();
    this.modalSession.acquire();
    this.addGlobalListeners();
    this.cancelOpenFocus();
    this.openFocusFrame = requestAnimationFrame(() => {
      this.openFocusFrame = undefined;
      if (!this.connected || !this.open || this.variant !== 'modal' || !this.modalSession.isTop()) return;
      this.containerEl?.removeAttribute('inert');
      this.focusFirst();
    });
  }

  private deactivateSession() {
    this.cancelOpenFocus();
    this.removeGlobalListeners();
    this.modalSession.release();
  }

  // ── Public methods ──────────────────────────────────────

  private cancelOpenFocus() {
    if (this.openFocusFrame === undefined) return;
    cancelAnimationFrame(this.openFocusFrame);
    this.openFocusFrame = undefined;
  }

  @Method()
  async show() {
    await this.overlayLifecycle.show(() => { this.open = true; });
  }

  /** Resolves after the current open cycle and shell exit motion finish; safe to unmount afterward. */
  @Method()
  async whenClosed(): Promise<void> {
    await this.overlayLifecycle.whenClosed();
  }

  @Method()
  async close() {
    this.overlayLifecycle.cancelOpen();
    this.open = false;
  }

  // ── Global listeners ──────────────────────────────────────

  private addGlobalListeners() {
    const doc = this.modalSession.document ?? this.el.ownerDocument;
    // Nested menus get the first chance to consume Escape.
    doc.addEventListener('keydown', this.handleDocKeyDown);
    doc.addEventListener('focusin', this.handleDocFocusIn);
  }

  private removeGlobalListeners() {
    const doc = this.modalSession.document ?? this.el.ownerDocument;
    doc.removeEventListener('keydown', this.handleDocKeyDown);
    doc.removeEventListener('focusin', this.handleDocFocusIn);
  }

  // ── Keyboard ────────────────────────────────────────────

  private handleDocKeyDown = (e: KeyboardEvent) => {
    if (!this.open || this.variant !== 'modal' || !this.modalSession.isTop() || e.defaultPrevented) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!this.scrimDismissible) return;
      this.mdCancel.emit();
      this.open = false;
    }
  };

  // ── Focus trap via focusin ──────────────────────────────

  private handleDocFocusIn = () => {
    if (!this.open || this.variant !== 'modal' || !this.modalSession.isTop()) return;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    let active = root.activeElement ?? this.el.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!active || composedContains(this.el, active)) return;
    this.focusFirst();
  };

  // ── Focus guard handlers (sentinel elements) ────────────

  private handleStartGuardFocus = () => {
    if (!this.open || this.variant !== 'modal' || !this.modalSession.isTop()) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  private handleEndGuardFocus = () => {
    if (!this.open || this.variant !== 'modal' || !this.modalSession.isTop()) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  // ── Private handlers ────────────────────────────────────

  private handleScrimClick = () => {
    if (!this.open || this.variant !== 'modal' || !this.modalSession.isTop() || !this.scrimDismissible) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleCloseClick = () => {
    if (!this.open || !this.connected || (this.variant === 'modal' && !this.modalSession.isTop())) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleBackClick = () => {
    if (!this.open || this.variant !== 'modal' || !this.showBack || !this.modalSession.isTop()) return;
    this.mdBack.emit();
  };

  // ── Focus management (modal) ────────────────────────────

  private focusFirst() {
    if (!this.containerEl) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), audio[controls], video[controls], summary, [tabindex]';
    const collected: HTMLElement[] = [];
    const seen = new Set<Element>();
    // Follow slot and shadow-root order instead of collecting all shadow
    // controls before light-DOM controls. Hidden branches and sentinels are
    // excluded, while actual inner inputs of custom elements remain reachable.
    const visit = (element: Element) => {
      if (seen.has(element)) return;
      seen.add(element);
      if (element.hasAttribute('hidden') || element.hasAttribute('inert') ||
        element.classList.contains('md-side-sheet__focus-guard')) return;
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return;
      if (element.localName === 'slot') {
        const assigned = (element as HTMLSlotElement).assignedElements({ flatten: true });
        (assigned.length ? assigned : Array.from(element.children)).forEach(visit);
        return;
      }
      const shadow = element.shadowRoot;
      const tabIndex = element.getAttribute('tabindex');
      const excluded = tabIndex !== null && Number(tabIndex) < 0;
      if (shadow && excluded) return;
      if (element.localName === 'input' && element.getAttribute('type') === 'hidden') return;
      if (!excluded && !shadow?.delegatesFocus && element.matches(selector) && !disabledFormControl(element)) {
        collected.push(element as HTMLElement);
      }
      Array.from((shadow ?? element).children).forEach(visit);
    };
    Array.from(this.containerEl?.children ?? []).forEach(visit);
    return collected;
  }

  // ── Render ──────────────────────────────────────────────

  render() {
    const isModal = this.variant === 'modal';
    const hasHeadline = !!this.headline || this.hasSlottedHeadline;
    const showBackBtn = isModal && this.showBack;

    return (
      <Host
        class={{
          'md-side-sheet': true,
          [`md-side-sheet--${this.variant}`]: true,
          [`md-side-sheet--${this.side}`]: true,
          'md-side-sheet--open': this.open,
          'md-side-sheet--detached': this.detached,
        }}
      >
        {isModal && (
          <div
            class="md-side-sheet__scrim"
            part="scrim"
            aria-hidden="true"
            onClick={this.handleScrimClick}
          ></div>
        )}

        <div
          class="md-side-sheet__container"
          part="container"
          role={isModal ? 'dialog' : 'region'}
          aria-modal={isModal ? 'true' : undefined}
          aria-labelledby={hasHeadline && !this.sheetAriaLabel ? this.headlineId : undefined}
          aria-label={this.sheetAriaLabel || (!hasHeadline ? 'Side sheet' : undefined)}
          aria-hidden={!this.open ? 'true' : undefined}
          // A closed sheet stays in the DOM (slid off-screen for the
          // enter/exit motion, never display:none), so its focus guards,
          // close/back buttons, and slotted controls remain tab-reachable
          // inside an aria-hidden subtree — that fails axe `aria-hidden-focus`.
          // `inert` drops the whole panel from focus order and the a11y tree
          // while hidden; it flips off in the same render that clears
          // aria-hidden, before the modal focusFirst() runs. When open, the
          // standard variant stays non-inert so its content joins the page
          // tab order normally.
          inert={!this.open}
          tabindex={-1}
          ref={(el) => (this.containerEl = el!)}
        >
          {isModal && (
            <span
              class="md-side-sheet__focus-guard"
              tabindex={0}
              aria-hidden="true"
              onFocus={this.handleStartGuardFocus}
            ></span>
          )}

          <div class="md-side-sheet__header" part="header">
            {showBackBtn && (
              <div class="md-side-sheet__back">
                <slot name="back">
                  <md-icon-button
                    variant="standard"
                    icon="arrow_back"
                    aria-label="Back"
                    onClick={this.handleBackClick}
                  ></md-icon-button>
                </slot>
              </div>
            )}

            <span
              id={this.headlineId}
              class="md-side-sheet__headline"
              part="headline"
            >
              <slot name="headline" onSlotchange={this.syncSlots}>{this.headline}</slot>
            </span>

            {this.closeable && (
              <div class="md-side-sheet__close" part="close">
                <slot name="close">
                  <md-icon-button
                    variant="standard"
                    icon="close"
                    aria-label="Close side sheet"
                    onClick={this.handleCloseClick}
                  ></md-icon-button>
                </slot>
              </div>
            )}
          </div>

          {this.topDivider && (
            <div class="md-side-sheet__divider" part="divider-top" aria-hidden="true"></div>
          )}

          <div class="md-side-sheet__content" part="content">
            <slot></slot>
          </div>

          {this.hasActions && this.bottomDivider && (
            <div class="md-side-sheet__divider md-side-sheet__divider--bottom" part="divider-bottom" aria-hidden="true"></div>
          )}

          {this.hasActions && (
            <div class="md-side-sheet__actions" part="actions">
              <slot name="actions" onSlotchange={this.syncSlots}></slot>
            </div>
          )}

          {isModal && (
            <span
              class="md-side-sheet__focus-guard"
              tabindex={0}
              aria-hidden="true"
              onFocus={this.handleEndGuardFocus}
            ></span>
          )}
        </div>
      </Host>
    );
  }
}

function composedContains(container: Element, node: Element | null): boolean {
  for (let current = node; current; ) {
    if (current === container) return true;
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
  }
  return false;
}

function disabledFormControl(element: Element): boolean {
  if (element.hasAttribute('disabled')) return true;
  if (!['button', 'input', 'select', 'textarea', 'fieldset', 'option', 'optgroup'].includes(element.localName)) return false;
  // A disabled fieldset still permits controls in its first legend. Keep links
  // and authored non-form controls focusable rather than pruning the branch.
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.localName !== 'fieldset' || !ancestor.hasAttribute('disabled')) continue;
    const legend = Array.from(ancestor.children).find(child => child.localName === 'legend');
    if (!legend?.contains(element)) return true;
  }
  return false;
}


import { Component, Host, h, Prop, Event, EventEmitter, Method, Watch, State, Element } from '@stencil/core';

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

  @State() private hasSlottedClose = false;
  @State() private hasSlottedBack = false;
  @State() private hasActions = false;

  private containerEl!: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private headlineId = `md-side-sheet-headline-${Math.random().toString(36).slice(2)}`;

  // ── Lifecycle ───────────────────────────────────────────

  connectedCallback() {
    this.hasActions = !!this.el.querySelector('[slot="actions"]');
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const closeSlot = shadow.querySelector('slot[name="close"]') as HTMLSlotElement | null;
    const backSlot = shadow.querySelector('slot[name="back"]') as HTMLSlotElement | null;
    const actionsSlot = shadow.querySelector('slot[name="actions"]') as HTMLSlotElement | null;

    closeSlot?.addEventListener('slotchange', () => {
      this.hasSlottedClose = closeSlot.assignedElements().length > 0;
    });
    backSlot?.addEventListener('slotchange', () => {
      this.hasSlottedBack = backSlot.assignedElements().length > 0;
    });
    actionsSlot?.addEventListener('slotchange', () => {
      this.hasActions = actionsSlot.assignedElements().length > 0;
    });

    if (this.open) {
      this.onOpenChange(true);
    }
  }

  disconnectedCallback() {
    this.removeGlobalListeners();
    document.body.style.overflow = '';
  }

  // ── Watchers ────────────────────────────────────────────

  @Watch('open')
  onOpenChange(newVal: boolean) {
    if (newVal) {
      this.addGlobalListeners();
      if (this.variant === 'modal') {
        this.previousFocus = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
          // The re-render that clears `inert` is scheduled *after* this watcher
          // (Stencil runs @Watch before scheduleUpdate), so it may not have
          // committed yet. Unlike aria-hidden, `inert` blocks .focus(); drop it
          // imperatively — matching the declarative open state — so focus can
          // enter the panel this frame instead of bouncing off an inert subtree.
          this.containerEl?.removeAttribute('inert');
          this.focusFirst();
        });
      }
      this.mdOpen.emit();
    } else {
      this.removeGlobalListeners();
      if (this.variant === 'modal') {
        document.body.style.overflow = '';
        // `preventScroll` because a bare focus() scrolls its target into view: an
      // overlay opened programmatically (or whose opener has since scrolled out
      // of sight) would yank the page on close.
      this.previousFocus?.focus?.({ preventScroll: true });
        this.previousFocus = null;
      }
      this.mdClose.emit();
    }
  }

  // ── Public methods ──────────────────────────────────────

  @Method()
  async show() {
    this.open = true;
  }

  @Method()
  async close() {
    this.open = false;
  }

  // ── Global listeners ──────────────────────────────────────

  private addGlobalListeners() {
    // ONLY a modal sheet listens on the document. A `standard` sheet is a
    // non-modal inline region — it has no scrim and does not trap focus, so it
    // must not answer a document-level Escape either. It used to: every open
    // sheet on the page registered this listener, so one Escape (aimed at a
    // modal, or at nothing) collapsed every inline sheet on the page at once.
    if (this.variant !== 'modal') return;
    document.addEventListener('keydown', this.handleDocKeyDown, true);
    document.addEventListener('focusin', this.handleDocFocusIn);
  }

  private removeGlobalListeners() {
    document.removeEventListener('keydown', this.handleDocKeyDown, true);
    document.removeEventListener('focusin', this.handleDocFocusIn);
  }

  // ── Keyboard ────────────────────────────────────────────

  private handleDocKeyDown = (e: KeyboardEvent) => {
    if (!this.open || this.variant !== 'modal') return;

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
    if (!this.open || this.variant !== 'modal') return;

    const active = document.activeElement;
    if (!active) return;

    if (active === this.el || this.el.contains(active)) return;

    const isShadowEl = this.containerEl?.contains(active);
    if (isShadowEl) return;

    this.focusFirst();
  };

  // ── Focus guard handlers (sentinel elements) ────────────

  private handleStartGuardFocus = () => {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  private handleEndGuardFocus = () => {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  // ── Private handlers ────────────────────────────────────

  private handleScrimClick = () => {
    if (!this.scrimDismissible) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleCloseClick = () => {
    this.mdCancel.emit();
    this.open = false;
  };

  private handleBackClick = () => {
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
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), md-icon-button:not([disabled]), md-button:not([disabled]), md-text-field:not([disabled]), md-checkbox:not([disabled]), md-switch:not([disabled]), md-radio:not([disabled]), md-slider:not([disabled])';

    const shadowEls = Array.from(
      this.containerEl?.querySelectorAll(selector) ?? [],
    ) as HTMLElement[];

    const slots = this.containerEl?.querySelectorAll('slot') ?? [];
    const slottedEls: HTMLElement[] = [];
    slots.forEach((slot) => {
      const assigned = (slot as HTMLSlotElement).assignedElements({ flatten: true });
      assigned.forEach((el) => {
        if ((el as HTMLElement).matches?.(selector)) {
          slottedEls.push(el as HTMLElement);
        }
        const nested = (el as HTMLElement).querySelectorAll?.(selector);
        if (nested) slottedEls.push(...(Array.from(nested) as HTMLElement[]));
      });
    });

    return [...shadowEls, ...slottedEls];
  }

  // ── Render ──────────────────────────────────────────────

  render() {
    const isModal = this.variant === 'modal';
    const hasHeadline = !!this.headline;
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
          aria-labelledby={hasHeadline ? this.headlineId : undefined}
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
              onFocus={this.handleEndGuardFocus}
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
              <slot name="headline">{this.headline}</slot>
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
              <slot name="actions"></slot>
            </div>
          )}

          {isModal && (
            <span
              class="md-side-sheet__focus-guard"
              tabindex={0}
              aria-hidden="true"
              onFocus={this.handleStartGuardFocus}
            ></span>
          )}
        </div>
      </Host>
    );
  }
}

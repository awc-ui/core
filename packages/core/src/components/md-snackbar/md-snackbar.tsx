import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Method, Watch } from '@stencil/core';

/**
 * @slot - Supporting text (overrides `message` prop)
 * @slot action - Custom action element (overrides `action` prop)
 * @slot close - Custom close element (overrides default X icon button)
 *
 * @part surface - Outer container surface
 * @part message - Supporting text wrapper
 * @part actions - Action button wrapper
 * @part close - Close button wrapper
 */
@Component({
  tag: 'md-snackbar',
  styleUrl: 'md-snackbar.css',
  shadow: true,
})
export class MdSnackbar {
  @Element() el!: HTMLElement;

  // ─── Public Props ──────────────────────────────────────────

  /** Whether the snackbar is visible */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Primary supporting text */
  @Prop() message: string = '';

  /** Action button label (leave empty for no action) */
  @Prop() action: string = '';

  /** Show a close (X) icon button */
  @Prop({ reflect: true }) closeable: boolean = false;

  /** Auto-dismiss after `autoHideDuration` ms (dismissive behavior) */
  @Prop() autoHide: boolean = true;

  /** Time in ms before auto-dismiss */
  @Prop() autoHideDuration: number = 4000;

  /** Screen position */
  @Prop({ reflect: true }) position:
    | 'bottom' | 'bottom-start' | 'bottom-end'
    | 'top' | 'top-start' | 'top-end'
    | 'start' | 'end' | 'center' = 'bottom';

  /** Stack action below text (for longer action labels) */
  @Prop({ reflect: true }) stacked: boolean = false;

  /**
   * Live-region politeness. `'polite'` (default) → `role="status"` /
   * `aria-live="polite"` (announced when idle). `'assertive'` → `role="alert"` /
   * `aria-live="assertive"` — interrupts the screen reader; use sparingly for
   * important / error messages.
   */
  @Prop({ reflect: true }) politeness: 'polite' | 'assertive' = 'polite';

  /** Accessible label for the close button. Localize per the page locale. */
  @Prop({ attribute: 'dismiss-label' }) dismissLabel: string = 'Dismiss';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ─── Events ────────────────────────────────────────────────

  /** Emits when the snackbar becomes visible */
  @Event() mdOpen: EventEmitter<void>;

  /** Emits when the snackbar is dismissed, with reason */
  @Event() mdClose: EventEmitter<{ reason: 'auto' | 'action' | 'close' }>;

  /** Emits when the action button is clicked */
  @Event() mdAction: EventEmitter<void>;

  // ─── Internal State ────────────────────────────────────────

  @State() private hasSlottedAction = false;
  @State() private hasSlottedClose = false;
  @State() private hasSlottedDefault = false;

  private autoHideTimer?: ReturnType<typeof setTimeout>;
  private rippleDismissTimer?: ReturnType<typeof setTimeout>;
  private timerPaused = false;

  /** Coerce autoHide — HTML attribute `auto-hide="false"` arrives as string "false" */
  private get isAutoHide(): boolean {
    return this.autoHide !== false && (this.autoHide as unknown) !== 'false';
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const defaultSlot = shadow.querySelector('slot:not([name])') as HTMLSlotElement | null;
    const actionSlot = shadow.querySelector('slot[name="action"]') as HTMLSlotElement | null;
    const closeSlot = shadow.querySelector('slot[name="close"]') as HTMLSlotElement | null;

    defaultSlot?.addEventListener('slotchange', () => {
      this.hasSlottedDefault = defaultSlot.assignedNodes().some(n =>
        n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim() !== ''),
      );
    });
    actionSlot?.addEventListener('slotchange', () => {
      this.hasSlottedAction = actionSlot.assignedElements().length > 0;
    });
    closeSlot?.addEventListener('slotchange', () => {
      this.hasSlottedClose = closeSlot.assignedElements().length > 0;
    });

    if (this.open) {
      this.onOpenChange(true, false);
    }
  }

  disconnectedCallback() {
    this.clearAutoHide();
    if (this.rippleDismissTimer != null) {
      clearTimeout(this.rippleDismissTimer);
      this.rippleDismissTimer = undefined;
    }
    window.removeEventListener('keydown', this.handleEscape);
  }

  // ─── Watchers ──────────────────────────────────────────────

  /**
   * Lift this snackbar above any that are already open.
   *
   * All snackbars share one z-index token, and equal z-index falls back to DOM
   * order — so showing a snackbar declared earlier in the markup put it BEHIND
   * one already on screen. Ranking against the currently-open peers (rather
   * than counting every open ever) keeps the offset bounded by how many are up
   * at once, so it never climbs into the range of dialogs above it.
   */
  private raiseAboveOpenPeers() {
    const peers = Array.from(document.querySelectorAll('md-snackbar')).filter(
      (s) => s !== this.el && (s as HTMLMdSnackbarElement).open,
    );
    const highest = peers.reduce(
      (max, s) => Math.max(max, Number((s as HTMLElement).style.getPropertyValue('--_stack-order')) || 0),
      0,
    );
    this.el.style.setProperty('--_stack-order', String(highest + 1));
  }

  @Watch('open')
  onOpenChange(newVal: boolean, _oldVal?: boolean) {
    if (newVal) {
      this.raiseAboveOpenPeers();
      this.mdOpen.emit();
      if (this.isAutoHide) {
        this.startAutoHide();
      }
      window.addEventListener('keydown', this.handleEscape);
    } else {
      this.clearAutoHide();
      this.timerPaused = false;
      window.removeEventListener('keydown', this.handleEscape);
    }
  }

  // ─── Public Methods ────────────────────────────────────────

  /** Show the snackbar */
  @Method()
  async show() {
    this.open = true;
  }

  /** Hide the snackbar with an optional reason */
  @Method()
  async hide(reason: 'auto' | 'action' | 'close' = 'close') {
    if (!this.open) return;
    this.open = false;
    this.mdClose.emit({ reason });
  }

  // ─── Private ───────────────────────────────────────────────

  private startAutoHide() {
    this.clearAutoHide();
    this.autoHideTimer = setTimeout(() => {
      if (this.open) {
        this.open = false;
        this.mdClose.emit({ reason: 'auto' });
      }
    }, this.autoHideDuration);
  }

  private clearAutoHide() {
    if (this.autoHideTimer != null) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = undefined;
    }
  }

  private dismissAfterRipple(reason: 'action' | 'close') {
    this.rippleDismissTimer = setTimeout(() => {
      this.rippleDismissTimer = undefined;
      if (this.open) {
        this.open = false;
        this.mdClose.emit({ reason });
      }
    }, 150);
  }

  private handleActionClick = () => {
    this.mdAction.emit();
    this.startAutoHide();
  };

  private handleCloseClick = () => {
    this.dismissAfterRipple('close');
  };

  private handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open && this.closeable) {
      e.preventDefault();
      this.handleCloseClick();
    }
  };

  /** WCAG 2.2.1 — pause auto-hide while the user is interacting */
  private pauseAutoHide = () => {
    if (this.autoHideTimer != null && this.open) {
      this.timerPaused = true;
      this.clearAutoHide();
    }
  };

  private resumeAutoHide = () => {
    if (this.timerPaused && this.open) {
      this.timerPaused = false;
      this.startAutoHide();
    }
  };

  private handleSurfaceFocusOut = (e: FocusEvent) => {
    const surface = e.currentTarget as HTMLElement;
    if (e.relatedTarget && surface.contains(e.relatedTarget as Node)) {
      return;
    }
    this.resumeAutoHide();
  };

  // ─── Render ────────────────────────────────────────────────

  render() {
    const hasAction = !!this.action || this.hasSlottedAction;
    const hasClose = this.closeable || this.hasSlottedClose;

    return (
      <Host
        class={{
          'md-snackbar': true,
          'md-snackbar--open': this.open,
          'md-snackbar--stacked': this.stacked,
          [`md-snackbar--${this.position}`]: true,
          'md-snackbar--with-action': hasAction,
          'md-snackbar--with-close': hasClose,
        }}
        role={this.politeness === 'assertive' ? 'alert' : 'status'}
        aria-live={this.politeness}
        aria-atomic="true"
      >
        <div
          class="md-snackbar__surface"
          part="surface"
          onMouseEnter={this.pauseAutoHide}
          onMouseLeave={this.resumeAutoHide}
          onFocusin={this.pauseAutoHide}
          onFocusout={this.handleSurfaceFocusOut}
        >
          <span class="md-snackbar__message" part="message">
            <slot>{this.message}</slot>
          </span>

          {hasAction && (
            <div class="md-snackbar__actions" part="actions">
              <slot name="action">
                {this.action && (
                  <md-button
                    variant="text"
                    size="sm"
                    class="md-snackbar__action-btn"
                    onClick={this.handleActionClick}
                  >
                    {this.action}
                  </md-button>
                )}
              </slot>
            </div>
          )}

          {hasClose && (
            <div class="md-snackbar__close" part="close">
              <slot name="close">
                {this.closeable && (
                  <md-icon-button
                    variant="standard"
                    icon="close"
                    aria-label={this.dismissLabel}
                    onClick={this.handleCloseClick}
                    exportparts="icon:close-icon"
                  ></md-icon-button>
                )}
              </slot>
            </div>
          )}
        </div>
      </Host>
    );
  }
}

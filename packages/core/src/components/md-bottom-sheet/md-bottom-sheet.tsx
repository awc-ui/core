import {
  Component,
  Host,
  h,
  Prop,
  Event,
  EventEmitter,
  Method,
  Watch,
  State,
  Element,
} from '@stencil/core';

/**
 * MD3 Bottom sheet — secondary content anchored to the bottom of the screen.
 *
 * Two variants per the M3 spec
 * (https://m3.material.io/components/bottom-sheets/overview). Both are
 * modal dialogs — they always render a scrim, trap focus, lock body
 * scroll, close on Escape, and support drag-to-dismiss.
 *
 * - `standard` (default) — anchored to the bottom edge of the viewport.
 *   Full-width up to a responsive max, with rounded top corners only.
 * - `detached` — floats with a margin on every side and rounded corners
 *   on every side. Best for compact, dialog-like sheets on larger
 *   screens.
 *
 * Width and height are entirely token-driven, so the only thing you
 * change to switch from anchored to floating chrome is the `variant`
 * attribute. The default media query reflows the sheet between
 * full-width on mobile and a centred 640px panel on desktop; consumers
 * can opt out via `--md-bottom-sheet-width` / `--md-bottom-sheet-max-width`.
 *
 * @slot - Main content
 * @slot headline - Custom headline content
 * @slot actions - Bottom action buttons (optional)
 * @slot close - Custom close element (replaces default close icon button)
 *
 * @part scrim - Scrim overlay
 * @part container - Sheet surface
 * @part drag-handle - Drag handle hit area
 * @part drag-handle-indicator - Drag handle visible bar
 * @part header - Header row (headline + close)
 * @part headline - Headline text
 * @part close - Close button wrapper
 * @part divider-top - Top divider (between header and content)
 * @part divider-bottom - Bottom divider (between content and actions)
 * @part content - Content area wrapper (inline padding, edge-to-edge frame); the content scrolls directly here
 * @part actions - Bottom action bar
 */
@Component({
  tag: 'md-bottom-sheet',
  styleUrl: 'md-bottom-sheet.css',
  shadow: true,
})
export class MdBottomSheet {
  @Element() el!: HTMLElement;

  /** Whether the sheet is visible */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /**
   * `standard` (default) anchors the sheet to the bottom edge.
   * `detached` floats it with margin on every side.
   * Both variants always render a scrim and trap focus.
   */
  @Prop({ reflect: true }) variant: 'standard' | 'detached' = 'standard';

  /** Headline text (or use the `headline` slot) */
  @Prop() headline: string = '';

  /** Show the drag handle indicator */
  @Prop({ reflect: true, attribute: 'show-drag-handle' })
  showDragHandle: boolean = true;

  /** Show a close icon-button in the top-end corner of the header */
  @Prop({ reflect: true }) closeable: boolean = false;

  /** Whether clicking the scrim closes the sheet */
  @Prop({ attribute: 'scrim-dismissible' }) scrimDismissible: boolean = true;

  /** Show divider between header and content */
  @Prop({ reflect: true, attribute: 'top-divider' }) topDivider: boolean =
    false;

  /** Show divider between content and actions */
  @Prop({ reflect: true, attribute: 'bottom-divider' }) bottomDivider: boolean =
    false;

  /** Custom aria-label for the container */
  @Prop({ attribute: 'aria-label' }) sheetAriaLabel: string = '';

  /**
   * Retained for API compatibility, but now a no-op: the content area
   * always plain-scrolls when it overflows (no scroll shadow / edge fades).
   * Setting this has no visual effect.
   */
  @Prop({ reflect: true, attribute: 'scroll-shadow' })
  scrollShadow: boolean = true;

  /**
   * Inline-axis alignment of the headline text. `start` (default) reads
   * left in LTR / right in RTL, `end` reads right in LTR / left in RTL,
   * `center` is direction-agnostic. Use the matching `::part(headline)`
   * selector for finer control (e.g. `text-align: justify`).
   */
  @Prop({ reflect: true, attribute: 'headline-align' })
  headlineAlign: 'start' | 'center' | 'end' = 'start';

  /**
   * Inline-axis alignment of the slotted content. Inherits to all
   * default-slot children, so prose, lists, and forms all pick it up.
   * `start` (default) reads left in LTR / right in RTL, `end` reads
   * right in LTR / left in RTL, `center` is direction-agnostic.
   * Slotted children that explicitly set their own `text-align` win.
   */
  @Prop({ reflect: true, attribute: 'content-align' })
  contentAlign: 'start' | 'center' | 'end' = 'start';

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

  /** Emits when dismissed via scrim click, Escape, drag, or close button */
  @Event() mdCancel: EventEmitter<void>;

  // ── Internal state ──────────────────────────────────────

  @State() private hasSlottedClose = false;
  @State() private hasActions = false;
  @State() private dragging = false;

  private containerEl!: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private headlineId = `md-bottom-sheet-headline-${Math.random()
    .toString(36)
    .slice(2)}`;

  private dragStartY = 0;
  private dragCurrentY = 0;
  private readonly DISMISS_THRESHOLD = 100;

  // ── Lifecycle ───────────────────────────────────────────

  connectedCallback() {
    this.hasActions = !!this.el.querySelector('[slot="actions"]');
  }

  componentWillLoad() {
    // Seed from the light DOM. The slotchange listener below cannot do this on
    // its own: the `close` slot only renders once this flag (or `closeable`) is
    // set, so waiting for slotchange means it never fires and a slotted close
    // is silently dropped.
    this.hasSlottedClose = Array.from(this.el.children).some(
      (c) => c.getAttribute('slot') === 'close',
    );
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const closeSlot = shadow.querySelector(
      'slot[name="close"]',
    ) as HTMLSlotElement | null;
    const actionsSlot = shadow.querySelector(
      'slot[name="actions"]',
    ) as HTMLSlotElement | null;

    closeSlot?.addEventListener('slotchange', () => {
      this.hasSlottedClose = closeSlot.assignedElements().length > 0;
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
      this.previousFocus = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      this.addGlobalListeners();
      requestAnimationFrame(() => {
        // The re-render that clears `inert` is scheduled *after* this watcher
        // (Stencil runs @Watch before scheduleUpdate), so it may not have
        // committed yet. Unlike aria-hidden, `inert` blocks .focus(); drop it
        // imperatively — matching the declarative open state — so focus can
        // enter the panel this frame instead of bouncing off an inert subtree.
        this.containerEl?.removeAttribute('inert');
        this.focusFirst();
      });
      this.mdOpen.emit();
    } else {
      this.removeGlobalListeners();
      document.body.style.overflow = '';
      // `preventScroll` because a bare focus() scrolls its target into view: an
      // overlay opened programmatically (or whose opener has since scrolled out
      // of sight) would yank the page on close.
      this.previousFocus?.focus?.({ preventScroll: true });
      this.previousFocus = null;
      if (this.containerEl) {
        // Clear any inline transform left over from a drag-then-snap-back.
        this.containerEl.style.transform = '';
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

  // ── Global listeners ────────────────────────────────────

  private addGlobalListeners() {
    document.addEventListener('keydown', this.handleDocKeyDown, true);
    document.addEventListener('focusin', this.handleDocFocusIn);
  }

  private removeGlobalListeners() {
    document.removeEventListener('keydown', this.handleDocKeyDown, true);
    document.removeEventListener('focusin', this.handleDocFocusIn);
  }

  // ── Keyboard ────────────────────────────────────────────

  private handleDocKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.mdCancel.emit();
      this.open = false;
    }
  };

  // ── Focus trap via focusin ──────────────────────────────

  private handleDocFocusIn = () => {
    if (!this.open) return;

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

  // ── Drag handling ───────────────────────────────────────

  private handleDragStart = (e: PointerEvent) => {
    if (!this.open || !this.showDragHandle) return;

    this.dragging = true;
    this.dragStartY = e.clientY;
    this.dragCurrentY = 0;

    if (this.containerEl) {
      this.containerEl.style.transition = 'none';
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  private handleDragMove = (e: PointerEvent) => {
    if (!this.dragging) return;

    const deltaY = e.clientY - this.dragStartY;
    this.dragCurrentY = Math.max(0, deltaY);

    if (this.containerEl) {
      this.containerEl.style.transform = `translateY(${this.dragCurrentY}px)`;
    }
  };

  private handleDragEnd = () => {
    if (!this.dragging) return;
    this.dragging = false;

    if (this.containerEl) {
      this.containerEl.style.transition = '';
    }

    if (this.dragCurrentY > this.DISMISS_THRESHOLD) {
      this.mdCancel.emit();
      this.open = false;
    } else if (this.containerEl) {
      this.containerEl.style.transform = '';
    }

    this.dragCurrentY = 0;
  };

  // ── Focus management ────────────────────────────────────

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
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), md-icon-button:not([disabled]), md-button:not([disabled]), md-text-field:not([disabled]), md-checkbox:not([disabled]), md-switch:not([disabled]), md-radio:not([disabled]), md-slider:not([disabled])';

    const shadowEls = Array.from(
      this.containerEl?.querySelectorAll(selector) ?? [],
    ) as HTMLElement[];

    const slots = this.containerEl?.querySelectorAll('slot') ?? [];
    const slottedEls: HTMLElement[] = [];
    slots.forEach((slot) => {
      const assigned = (slot as HTMLSlotElement).assignedElements({
        flatten: true,
      });
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
    const hasHeadline = !!this.headline;
    const showHeader = hasHeadline || this.closeable || this.hasSlottedClose;

    return (
      <Host
        class={{
          'md-bottom-sheet': true,
          [`md-bottom-sheet--${this.variant}`]: true,
          'md-bottom-sheet--open': this.open,
          'md-bottom-sheet--no-drag-handle': !this.showDragHandle,
        }}
      >
        <div
          class="md-bottom-sheet__scrim"
          part="scrim"
          aria-hidden="true"
          onClick={this.handleScrimClick}
        ></div>

        <div
          class="md-bottom-sheet__container"
          part="container"
          role="dialog"
          aria-modal="true"
          aria-labelledby={hasHeadline ? this.headlineId : undefined}
          aria-label={
            this.sheetAriaLabel ||
            (!hasHeadline ? 'Bottom sheet' : undefined)
          }
          aria-hidden={!this.open ? 'true' : undefined}
          // A closed sheet stays in the DOM (translated off-screen for the
          // enter/exit motion, never display:none), so its focus guards,
          // close button, and slotted controls remain tab-reachable inside an
          // aria-hidden subtree — that fails axe `aria-hidden-focus`. `inert`
          // drops the whole panel from focus order and the a11y tree while
          // hidden; it flips off in the same render that clears aria-hidden,
          // before the post-open focusFirst() runs.
          inert={!this.open}
          tabindex={-1}
          ref={(el) => (this.containerEl = el!)}
        >
          <span
            class="md-bottom-sheet__focus-guard"
            tabindex={0}
            aria-hidden="true"
            onFocus={this.handleEndGuardFocus}
          ></span>

          {this.showDragHandle && (
            <div
              class={{
                'md-bottom-sheet__drag-handle': true,
                'md-bottom-sheet__drag-handle--dragging': this.dragging,
              }}
              part="drag-handle"
              aria-hidden="true"
              onPointerDown={this.handleDragStart}
              onPointerMove={this.handleDragMove}
              onPointerUp={this.handleDragEnd}
              onPointerCancel={this.handleDragEnd}
            >
              <div
                class="md-bottom-sheet__drag-handle-indicator"
                part="drag-handle-indicator"
              ></div>
            </div>
          )}

          {showHeader && (
            <div class="md-bottom-sheet__header" part="header">
              {hasHeadline && (
                <span
                  id={this.headlineId}
                  class="md-bottom-sheet__headline"
                  part="headline"
                >
                  <slot name="headline">{this.headline}</slot>
                </span>
              )}

              {(this.closeable || this.hasSlottedClose) && (
                <div class="md-bottom-sheet__close" part="close">
                  <slot name="close">
                    <md-icon-button
                      variant="standard"
                      icon="close"
                      aria-label="Close bottom sheet"
                      onClick={this.handleCloseClick}
                    ></md-icon-button>
                  </slot>
                </div>
              )}
            </div>
          )}

          {this.topDivider && (
            <div
              class="md-bottom-sheet__divider"
              part="divider-top"
              aria-hidden="true"
            ></div>
          )}

          <div class="md-bottom-sheet__content" part="content">
            <slot></slot>
          </div>

          {this.hasActions && this.bottomDivider && (
            <div
              class="md-bottom-sheet__divider md-bottom-sheet__divider--bottom"
              part="divider-bottom"
              aria-hidden="true"
            ></div>
          )}

          {this.hasActions && (
            <div class="md-bottom-sheet__actions" part="actions">
              <slot name="actions"></slot>
            </div>
          )}

          <span
            class="md-bottom-sheet__focus-guard"
            tabindex={0}
            aria-hidden="true"
            onFocus={this.handleStartGuardFocus}
          ></span>
        </div>
      </Host>
    );
  }
}

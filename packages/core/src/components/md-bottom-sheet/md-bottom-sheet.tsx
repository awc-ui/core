import { createId } from '../../utils/id';
import { ModalSession } from '../../utils/modal-session';
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
  @State() private hasSlottedHeadline = false;
  @State() private hasActions = false;
  @State() private dragging = false;

  private containerEl!: HTMLElement;
  private headlineId = createId('md-bottom-sheet-headline');
  private loaded = false;
  private connected = false;
  private modalSession = new ModalSession(() => this.el, () => this.cancelDrag());
  private openFocusFrame?: number;
  private slotObserver?: MutationObserver;

  private dragStartY = 0;
  private dragCurrentY = 0;
  private dragPointerId?: number;
  private dragTarget?: HTMLElement;
  private readonly DISMISS_THRESHOLD = 100;

  // ── Lifecycle ───────────────────────────────────────────

  connectedCallback() {
    this.connected = true;
    this.syncSlots();
    this.observeSlots();
    if (this.loaded && this.open) this.activateSession();
  }

  componentWillLoad() {
    this.syncSlots();
  }

  componentDidLoad() {
    this.loaded = true;
    if (this.open) {
      this.onOpenChange(true);
    }
  }

  disconnectedCallback() {
    this.connected = false;
    this.slotObserver?.disconnect();
    this.slotObserver = undefined;
    this.deactivateSession();
  }

  private syncSlots = () => {
    const children = Array.from(this.el.children);
    this.hasSlottedClose = children.some(child => child.getAttribute('slot') === 'close');
    this.hasSlottedHeadline = children.some(child => child.getAttribute('slot') === 'headline');
    this.hasActions = children.some(child => child.getAttribute('slot') === 'actions');
  };

  private observeSlots() {
    if (this.slotObserver || typeof MutationObserver === 'undefined') return;
    this.slotObserver = new MutationObserver(records => {
      if (records.some(record => record.target === this.el ||
        (record.type === 'attributes' && (record.target as Element).parentElement === this.el))) {
        this.syncSlots();
      }
    });
    this.slotObserver.observe(this.el, { childList: true, subtree: true, attributes: true, attributeFilter: ['slot'] });
  }

  // ── Watchers ────────────────────────────────────────────

  @Watch('open')
  onOpenChange(newVal: boolean) {
    this.cancelOpenFocus();
    if (!this.loaded || !this.connected) return;
    if (newVal) {
      this.activateSession();
      this.mdOpen.emit();
    } else {
      this.deactivateSession();
      this.mdClose.emit();
    }
  }

  private isTopSheet() {
    return this.modalSession.isTop();
  }

  private activateSession() {
    // Listeners belong to the acquired document, including during adoption.
    if (this.modalSession.owns && this.modalSession.document !== this.el.ownerDocument) this.deactivateSession();
    this.modalSession.acquire();
    this.addGlobalListeners();
    this.cancelOpenFocus();
    this.openFocusFrame = requestAnimationFrame(() => {
      this.openFocusFrame = undefined;
      if (!this.connected || !this.open || !this.isTopSheet()) return;
      this.containerEl?.removeAttribute('inert');
      this.focusFirst();
    });
  }

  private cancelOpenFocus() {
    if (this.openFocusFrame === undefined) return;
    cancelAnimationFrame(this.openFocusFrame);
    this.openFocusFrame = undefined;
  }

  private deactivateSession() {
    this.cancelOpenFocus();
    this.cancelDrag();
    this.removeGlobalListeners();
    this.modalSession.release();
  }

  @Watch('showDragHandle')
  onDragHandleChange() {
    if (!this.showDragHandle) this.cancelDrag();
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
    const doc = this.modalSession.document ?? this.el.ownerDocument;
    // Authored editors and child overlays may consume Escape before the modal.
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
    if (!this.open || !this.isTopSheet() || e.defaultPrevented) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.mdCancel.emit();
      this.open = false;
    }
  };

  // ── Focus trap via focusin ──────────────────────────────

  private handleDocFocusIn = () => {
    if (!this.open || !this.isTopSheet()) return;

    // The owning root is observable even when the sheet itself lives inside
    // an enclosing closed shadow root. document.activeElement alone would be
    // that outer host, making our own focus look like an escape from the trap.
    const root = this.el.getRootNode() as Document | ShadowRoot;
    let active = root.activeElement ?? this.el.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!active || composedContains(this.el, active)) return;

    this.focusFirst();
  };

  // ── Focus guard handlers (sentinel elements) ────────────

  private handleStartGuardFocus = () => {
    if (!this.open || !this.isTopSheet()) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  private handleEndGuardFocus = () => {
    if (!this.open || !this.isTopSheet()) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.containerEl?.focus();
    }
  };

  // ── Private handlers ────────────────────────────────────

  private handleScrimClick = () => {
    if (!this.open || !this.isTopSheet() || !this.scrimDismissible) return;
    this.mdCancel.emit();
    this.open = false;
  };

  private handleCloseClick = () => {
    if (!this.open || !this.isTopSheet()) return;
    this.mdCancel.emit();
    this.open = false;
  };

  // ── Drag handling ───────────────────────────────────────

  private handleDragStart = (e: PointerEvent) => {
    if (!this.open || !this.showDragHandle || !this.isTopSheet() || this.dragging || e.button !== 0 || e.isPrimary === false) return;

    this.dragging = true;
    this.dragStartY = e.clientY;
    this.dragCurrentY = 0;
    this.dragPointerId = e.pointerId;
    this.dragTarget = e.currentTarget as HTMLElement;

    if (this.containerEl) {
      this.containerEl.style.transition = 'none';
    }

    try { this.dragTarget.setPointerCapture?.(e.pointerId); } catch { /* Pointer already released. */ }
  };

  private handleDragMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragPointerId) return;
    if (!this.open || !this.showDragHandle || !this.isTopSheet()) { this.cancelDrag(); return; }

    const deltaY = e.clientY - this.dragStartY;
    this.dragCurrentY = Math.max(0, deltaY);

    if (this.containerEl) {
      this.containerEl.style.transform = `translateY(${this.dragCurrentY}px)`;
    }
  };

  private handleDragEnd = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragPointerId) return;
    if (!this.open || !this.showDragHandle || !this.isTopSheet()) { this.cancelDrag(); return; }
    const dismiss = this.dragCurrentY > this.DISMISS_THRESHOLD;
    this.cancelDrag();
    if (dismiss) {
      this.mdCancel.emit();
      this.open = false;
    }
  };

  private cancelDrag = (e?: PointerEvent) => {
    if (e && e.pointerId !== this.dragPointerId) return;
    const target = this.dragTarget, pointerId = this.dragPointerId;
    this.dragging = false;
    this.dragPointerId = undefined;
    this.dragTarget = undefined;
    this.dragCurrentY = 0;
    if (this.containerEl) {
      this.containerEl.style.transition = '';
      this.containerEl.style.transform = '';
    }
    if (pointerId !== undefined) {
      try { target?.releasePointerCapture?.(pointerId); } catch { /* Capture ended with the gesture. */ }
    }
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
        element.classList.contains('md-bottom-sheet__focus-guard')) return;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return;
      if (element.localName === 'slot') {
        const assigned = (element as HTMLSlotElement).assignedElements({ flatten: true });
        (assigned.length ? assigned : Array.from(element.children)).forEach(visit);
        return;
      }
      const shadow = element.shadowRoot;
      const tabIndex = element.getAttribute('tabindex');
      const excluded = tabIndex !== null && Number(tabIndex) < 0;
      if (shadow && excluded) return;
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
    const hasHeadline = !!this.headline || this.hasSlottedHeadline;
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
          aria-labelledby={hasHeadline && !this.sheetAriaLabel ? this.headlineId : undefined}
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
            onFocus={this.handleStartGuardFocus}
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
              onPointerCancel={this.cancelDrag}
              onLostPointerCapture={this.cancelDrag}
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
                  <slot name="headline" onSlotchange={this.syncSlots}>{this.headline}</slot>
                </span>
              )}

              {(this.closeable || this.hasSlottedClose) && (
                <div class="md-bottom-sheet__close" part="close">
                  <slot name="close" onSlotchange={this.syncSlots}>
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
              <slot name="actions" onSlotchange={this.syncSlots}></slot>
            </div>
          )}

          <span
            class="md-bottom-sheet__focus-guard"
            tabindex={0}
            aria-hidden="true"
            onFocus={this.handleEndGuardFocus}
          ></span>
        </div>
      </Host>
    );
  }
}

import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Watch } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

export interface MdCardDragDetail {
  /** Pointer X in viewport coordinates */
  clientX: number;
  /** Pointer Y in viewport coordinates */
  clientY: number;
  /** Horizontal distance from the drag start point */
  offsetX: number;
  /** Vertical distance from the drag start point */
  offsetY: number;
  /** X where the drag gesture began */
  startX: number;
  /** Y where the drag gesture began */
  startY: number;
}

@Component({ tag: 'md-card', styleUrl: 'md-card.css', shadow: true })
export class MdCard {
  @Element() el!: HTMLElement;

  /** Visual style variant */
  @Prop() variant: 'elevated' | 'filled' | 'outlined' = 'elevated';

  /**
   * Makes the card interactive (clickable, with ripple and state layers).
   *
   * When the card's own content has no focusable controls the host exposes
   * `role="button"` + `tabindex` and is keyboard-activatable. If the content
   * *does* include its own focusable controls (buttons, links, form fields,
   * interactive `md-*` components) the host does not claim `role="button"` —
   * that would be a `nested-interactive` a11y violation — and instead stays a
   * plain container that is still mouse-clickable (emits `mdClick`) while the
   * inner controls remain the keyboard tab stops.
   */
  @Prop({ reflect: true }) interactive: boolean = false;

  /** Enables pointer-event-based drag on the card */
  @Prop({ reflect: true, attribute: 'drag-enabled' }) dragEnabled: boolean = false;

  /** Disables the card — only meaningful when interactive */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled: disabled visuals but remains focusable — only meaningful when interactive */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Whether the ripple effect is enabled when interactive */
  @Prop() ripple: boolean = true;

  /**
   * When `true` the card stretches to 100% of its container's inline-size.
   * Pair with the `--md-card-max-width` custom property to cap the fluid
   * width (useful inside dashboards and responsive grids).
   */
  @Prop({ reflect: true, attribute: 'full-width' }) fullWidth: boolean = false;

  /**
   * When `true` the card stretches to 100% of its container's block-size.
   * The parent must have a definite block-size (e.g. a fixed height row in
   * a CSS grid, or a flex item with `align-items: stretch`) for `100%` to
   * resolve.
   */
  @Prop({ reflect: true, attribute: 'full-height' }) fullHeight: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when an interactive card is clicked or activated via keyboard */
  @Event() mdClick: EventEmitter<MouseEvent>;

  /** Emits once when a draggable card starts being dragged (after crossing the movement threshold) */
  @Event() mdDragStart: EventEmitter<MdCardDragDetail>;

  /** Emits continuously as a dragged card moves — use for drop-zone detection or position tracking */
  @Event() mdDragMove: EventEmitter<MdCardDragDetail>;

  /** Emits when a draggable card is released after dragging */
  @Event() mdDragEnd: EventEmitter<MdCardDragDetail>;

  @State() private dragging = false;

  /**
   * True when the default slot contains its own focusable/interactive
   * descendants (buttons, links, form controls, or interactive `md-*`
   * components).
   *
   * An interactive card that wraps such controls must NOT expose itself as a
   * single `role="button"`: a `button` has "children presentational" per
   * WAI-ARIA, so nesting focusable content inside it is a `nested-interactive`
   * violation and hides the inner controls from assistive tech. In that case
   * the host degrades to a plain (still mouse-clickable) container and the
   * inner controls remain the real tab stops — mirroring the `md-list-item`
   * rule of keeping a container role "rather than masquerading as a button".
   */
  @State() private hasInteractiveContent = false;

  private startX = 0;
  private startY = 0;
  private dragStarted = false;
  private suppressClick = false;
  private contentObserver: MutationObserver | null = null;
  private loaded = false;
  private activePointer: number | null = null;
  private clearClickFrame: number | null = null;
  private dragStyles: { transform: string; transformPriority: string; zIndex: string; zIndexPriority: string } | null = null;

  private static readonly DRAG_THRESHOLD = 5;

  /**
   * Widget-role focusables whose presence makes the host stop masquerading as
   * a button. Covers the descendants axe's `nested-interactive` rule counts
   * (native controls + explicit interactive ARIA roles), plus the library's
   * own interactive components before their shadow roots hydrate. Discovered
   * authored open shadow roots are also traversed and observed.
   */
  private static readonly INTERACTIVE_CONTENT_SELECTOR = [
    'a[href]', 'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])',
    'audio[controls]', 'video[controls]', 'iframe',
    '[contenteditable="true"]', '[contenteditable=""]', '[contenteditable="plaintext-only"]',
    '[tabindex]', 'summary',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
    '[role="switch"]', '[role="tab"]', '[role="menuitem"]',
    '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="option"]',
    '[role="slider"]', '[role="spinbutton"]', '[role="textbox"]',
    '[role="combobox"]', '[role="searchbox"]',
    'md-button', 'md-icon-button', 'md-fab', 'md-checkbox', 'md-switch',
    'md-radio', 'md-chip', 'md-select', 'md-multi-select', 'md-text-field',
    'md-slider', 'md-segmented-button', 'md-menu-button', 'md-link',
    'md-autocomplete',
  ].join(',');

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  connectedCallback() {
    this.el.addEventListener('pointerdown', this.onPointerDown);
    if (this.loaded) this.observeContent();
  }

  componentWillLoad() {
    // Initial composed-content scan BEFORE the first render, so `hasInteractiveContent` is already settled when render() first
    // computes `role`/`tabindex`. Doing this here (not in componentDidLoad)
    // guarantees an interactive card wrapping focusable content NEVER paints a
    // transient `role="button"` around it — the nested-interactive window that a
    // pre-hydration snapshot (SSR / jsdom, where `slotchange` hasn't fired yet)
    // would otherwise catch — and avoids Stencil's "state changed during
    // componentDidLoad → extra re-render" warning.
    this.detectInteractiveContent();
  }

  componentDidLoad() {
    // A late deep scan catches any focusable content that only became present
    // between componentWillLoad and mount; the guard inside
    // detectInteractiveContent makes this a no-op (no re-render) when the state
    // is already correct.
    this.loaded = true;
    this.observeContent();
  }

  private observeContent() {
    if (typeof MutationObserver !== 'undefined' && !this.contentObserver) {
      this.contentObserver = new MutationObserver(this.detectInteractiveContent);
    }
    this.detectInteractiveContent();
  }

  disconnectedCallback() {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.contentObserver?.disconnect();
    this.contentObserver = null;
    this.cancelDrag();
    if (this.clearClickFrame !== null) cancelAnimationFrame(this.clearClickFrame);
    this.clearClickFrame = null;
    this.suppressClick = false;
  }

  @Watch('dragEnabled')
  onDragEnabledChange() {
    if (!this.dragEnabled) this.cancelDrag();
  }

  @Watch('disabled')
  @Watch('softDisabled')
  onDisabledChange() {
    if (this.isDisabled) this.cancelDrag();
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.dragEnabled || this.isDisabled || e.button !== 0 || e.isPrimary === false || this.activePointer !== null) return;
    // Authored controls retain their pointer gestures and native activation.
    const path = e.composedPath?.() || [e.target];
    for (const target of path) {
      if (target === this.el) break;
      if (target instanceof HTMLElement && this.isInteractiveContent(target)) return;
    }

    this.activePointer = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.dragStarted = false;

    this.dragStyles = {
      transform: this.el.style.getPropertyValue('transform'),
      transformPriority: typeof this.el.style.getPropertyPriority === 'function' ? this.el.style.getPropertyPriority('transform') : '',
      zIndex: this.el.style.getPropertyValue('z-index'),
      zIndexPriority: typeof this.el.style.getPropertyPriority === 'function' ? this.el.style.getPropertyPriority('z-index') : '',
    };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* Synthetic or released pointers have no capture. */ }
    this.el.addEventListener('pointermove', this.onPointerMove);
    this.el.addEventListener('pointerup', this.onPointerUp);
    this.el.addEventListener('pointercancel', this.onPointerCancel);
    this.el.addEventListener('lostpointercapture', this.onPointerCancel);
  };

  private buildDetail(e: PointerEvent): MdCardDragDetail {
    return {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: e.clientX - this.startX,
      offsetY: e.clientY - this.startY,
      startX: this.startX,
      startY: this.startY,
    };
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (!this.dragStarted) {
      if (Math.abs(dx) + Math.abs(dy) < MdCard.DRAG_THRESHOLD) return;
      this.dragStarted = true;
      this.dragging = true;
      this.el.style.zIndex = '1000';
      this.mdDragStart.emit(this.buildDetail(e));
      // An authored start handler may disable, detach or cancel this card.
      // Do not repaint or emit movement after that synchronous cancellation.
      if (this.activePointer !== e.pointerId || !this.dragStarted || this.isDisabled || !this.dragEnabled) return;
    }

    const authoredTransform = this.dragStyles?.transform;
    this.el.style.setProperty('transform', `translate(${dx}px, ${dy}px)${authoredTransform && authoredTransform !== 'none' ? ` ${authoredTransform}` : ''}`);
    this.mdDragMove.emit(this.buildDetail(e));
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    if (this.dragStarted) {
      this.suppressClick = true;
      if (this.clearClickFrame !== null) cancelAnimationFrame(this.clearClickFrame);
      this.clearClickFrame = requestAnimationFrame(() => { this.suppressClick = false; this.clearClickFrame = null; });
      this.mdDragEnd.emit(this.buildDetail(e));
    }

    this.resetDragVisuals();
    this.cleanupListeners();
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === this.activePointer) this.cancelDrag();
  };

  private cancelDrag() {
    this.resetDragVisuals();
    this.cleanupListeners();
  }

  private resetDragVisuals() {
    this.dragging = false;
    this.dragStarted = false;
    if (this.dragStyles) {
      const { transform, transformPriority, zIndex, zIndexPriority } = this.dragStyles;
      this.el.style.setProperty('transform', transform, transformPriority);
      this.el.style.setProperty('z-index', zIndex, zIndexPriority);
      this.dragStyles = null;
    }
  }

  private cleanupListeners() {
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerCancel);
    this.el.removeEventListener('lostpointercapture', this.onPointerCancel);
    const pointer = this.activePointer;
    this.activePointer = null;
    if (pointer !== null) {
      try { this.el.releasePointerCapture(pointer); } catch { /* Capture may already be released. */ }
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (!this.interactive) return;
    if (this.suppressClick) return;
    if (this.isDisabled) { e.preventDefault(); return; }
    this.mdClick.emit(e);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.interactive || this.isDisabled || this.hasInteractiveContent || e.target !== this.el || e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerRipple(this.el);
      this.el.click();
    }
  };

  /** Scan authored composed content while excluding the card's own chrome. */
  private detectInteractiveContent = () => {
    let found = false;
    const roots: Node[] = [this.el];
    const visit = (node: Element) => {
      if (node.closest('[hidden], [inert]')) return;
      if (this.isInteractiveContent(node)) found = true;
      if (node.shadowRoot) {
        roots.push(node.shadowRoot);
        Array.from(node.shadowRoot.children).forEach(visit);
      } else if (node.localName === 'slot') {
        const assigned = (node as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
        Array.from(assigned.length ? assigned : node.children).forEach(visit);
      } else {
        Array.from(node.children).forEach(visit);
      }
    };
    Array.from(this.el.children).forEach(visit);
    if (found !== this.hasInteractiveContent) this.hasInteractiveContent = found;
    // MutationObserver does not cross shadow boundaries. Subscribe to the
    // discovered authored roots and release roots removed from composition.
    if (this.contentObserver) {
      this.contentObserver.disconnect();
      for (const root of roots) this.contentObserver.observe(root, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['disabled', 'href', 'type', 'role', 'tabindex', 'contenteditable', 'controls', 'hidden', 'inert', 'slot'],
      });
    }
  };

  private isInteractiveContent = (node: Element): boolean => {
    if (node.closest('[hidden], [inert]')) return false;
    const tabIndex = node.getAttribute('tabindex');
    const withoutTabIndex = MdCard.INTERACTIVE_CONTENT_SELECTOR.replace('[tabindex],', '');
    return node.matches(withoutTabIndex) || (tabIndex !== null && Number(tabIndex) >= 0);
  };

  render() {
    const isEffectivelyDisabled = this.isDisabled;

    /* A card only exposes single `role="button"` semantics when it is the sole
       action — i.e. it does NOT wrap its own focusable controls. A button may
       not contain focusable content (WAI-ARIA "children presentational"), so an
       interactive card that holds buttons/links/form controls keeps a plain
       container role instead of masquerading as one giant button. It stays
       mouse-clickable (host `onClick` → `mdClick`) and visually interactive, but
       the inner controls are the real keyboard tab stops. */
    const actsAsButton = this.interactive && !this.hasInteractiveContent;

    return (
      <Host
        class={{
          'md-card': true,
          [`md-card--${this.variant}`]: true,
          'md-card--interactive': this.interactive,
          'md-card--draggable': this.dragEnabled,
          'md-card--disabled': this.interactive && isEffectivelyDisabled,
          'md-card--dragged': this.dragging,
          'md-card--full-width': this.fullWidth,
          'md-card--full-height': this.fullHeight,
        }}
        role={actsAsButton ? 'button' : undefined}
        aria-disabled={actsAsButton && isEffectivelyDisabled ? 'true' : undefined}
        aria-grabbed={this.dragEnabled ? (this.dragging ? 'true' : 'false') : undefined}
        tabindex={actsAsButton ? (this.disabled ? '-1' : '0') : undefined}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        {(this.interactive || this.dragEnabled) && this.ripple && <md-ripple disabled={isEffectivelyDisabled}></md-ripple>}
        {(this.interactive || this.dragEnabled) && <span class="md-card__state-layer" part="state-layer" aria-hidden="true"></span>}
        {this.variant === 'outlined' && <span class="md-card__outline" part="outline" aria-hidden="true"></span>}
        <slot onSlotchange={this.detectInteractiveContent} />
      </Host>
    );
  }
}

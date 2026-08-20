import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Method, Watch } from '@stencil/core';

export type Placement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

/** Minimum gap kept between a popup and the viewport edge when cross-axis clamping. */
const TOOLTIP_VIEWPORT_MARGIN = 8;

/**
 * @slot - Trigger element the tooltip is anchored to
 * @slot content - Rich tooltip supporting text (overrides `text` prop)
 * @slot subhead - Rich tooltip subhead (overrides `subhead` prop)
 * @slot actions - Rich tooltip action buttons
 *
 * @part popup - Tooltip popup container
 * @part subhead - Rich tooltip subhead wrapper
 * @part supporting-text - Rich tooltip supporting text wrapper
 * @part actions - Rich tooltip action button wrapper
 * @part text - Plain tooltip text wrapper
 */
@Component({
  tag: 'md-tooltip',
  styleUrl: 'md-tooltip.css',
  shadow: true,
})
export class MdTooltip {
  @Element() el!: HTMLElement;

  /** Plain tooltip text, or rich tooltip supporting text */
  @Prop() text: string = '';

  /** Rich tooltip subhead (headline) */
  @Prop() subhead: string = '';

  /** Visual variant */
  @Prop({ reflect: true }) variant: 'plain' | 'rich' = 'plain';

  /** Preferred placement relative to the trigger */
  @Prop() position: Placement = 'top';

  /** Automatically reposition if overflowing the viewport */
  @Prop() autoPosition: boolean = true;

  /** Distance from the trigger in pixels */
  @Prop() offset: number = 8;

  /** Cross-axis offset in pixels */
  @Prop() crossOffset: number = 0;

  /** Programmatic open state */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Delay before showing (ms) */
  @Prop() showDelay: number = 500;

  /** Delay before hiding (ms) — for rich variant hover-out grace period */
  @Prop() hideDelay: number = 200;

  /** When true, hover/focus handlers are ignored and any open tooltip is dismissed. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Emits when the tooltip becomes visible. `bubbles:false` + `composed:false` keep it
   * from crossing the shadow boundary and retargeting onto an embedding host (the repo's
   * documented composed-event-leak class — see md-date-picker's swallow guards).
   */
  @Event({ bubbles: false, composed: false }) mdOpen: EventEmitter<void>;

  /** Emits when the tooltip is dismissed (does not bubble or cross shadow boundaries). */
  @Event({ bubbles: false, composed: false }) mdClose: EventEmitter<void>;

  @State() private isVisible = false;
  @State() private resolvedPlacement: Placement = 'top';
  @State() private hasSlottedActions = false;
  @State() private hasSlottedSubhead = false;

  private popupEl?: HTMLElement;
  private triggerEl?: HTMLElement;
  private triggerSlot?: HTMLSlotElement;
  private slotObserver?: MutationObserver;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private tooltipId = `md-tooltip-${Math.random().toString(36).slice(2, 9)}`;
  private scrollListenerBound = false;
  private escapeListenerBound = false;
  private hostHoverBound = false;
  private hasLoaded = false;
  /** Set on Escape dismissal; blocks re-show until the pointer/focus leaves the trigger. */
  private suppressed = false;

  // ─── Lifecycle ───────────────────────────────────────────

  componentWillLoad() {
    // Seed slot flags + visible state BEFORE the first render so the didLoad setup()
    // re-computes them to the same values — a no-op write rather than a state change
    // during componentDidLoad (which triggers Stencil's extra-re-render warning).
    // Honor `disabled`: a disabled tooltip must never render visible, and seeding
    // isVisible while disabled would also leak an unbalanced mdClose on the next hide.
    this.syncSlotFlags();
    if (this.open && !this.disabled) this.isVisible = true;
  }

  componentDidLoad() {
    this.hasLoaded = true;
    this.setup();
    if (this.open) this.showTooltip();
  }

  connectedCallback() {
    // On a REPARENT (disconnect→connect after first load), re-establish bindings —
    // componentDidLoad runs only once, so without this a moved tooltip goes dead.
    if (!this.hasLoaded) return;
    this.setup();
    // If the tooltip was still visible when it was moved, disconnectedCallback tore
    // down its scroll/Escape listeners without hiding it — restore them and reposition
    // against the moved trigger so it isn't stranded open, undismissable and detached.
    if (this.isVisible && !this.disabled) {
      this.addScrollListener();
      this.addEscapeListener();
      this.schedulePositionUpdate();
      this.startPositionWatchdog();
    } else if (this.open && !this.isVisible && !this.disabled) {
      // `open` was set while the element was DETACHED (showTooltip refuses to bind
      // global listeners there) — honor it now that we are connected again.
      this.showTooltip();
    }
  }

  /** (Re)attach trigger binding, slot detection and the host focusout listener. */
  private setup() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    this.triggerSlot = (shadow.querySelector('slot:not([name])') as HTMLSlotElement | null) ?? undefined;
    // addEventListener dedupes identical (fn, capture) pairs, so a re-setup is safe.
    this.triggerSlot?.addEventListener('slotchange', this.onTriggerSlotChange);
    this.el.addEventListener('focusout', this.handleHostFocusOut);

    // Rich content is authored in light DOM regardless of variant, so detect it there —
    // the shadow content/subhead/actions slots only exist while variant="rich" renders,
    // which is why shadow-slot detection missed a runtime plain→rich switch.
    this.syncSlotFlags();
    if (typeof MutationObserver !== 'undefined' && !this.slotObserver) {
      // childList catches slotted content add/remove; subtree+characterData catches
      // edits to slotted text so a slot-only rich tooltip's aria-description stays fresh.
      this.slotObserver = new MutationObserver(() => {
        this.syncSlotFlags();
        if (this.triggerEl) this.updateTriggerAria(this.triggerEl);
      });
      this.slotObserver.observe(this.el, { childList: true, subtree: true, characterData: true });
    }

    const first = this.triggerSlot?.assignedElements()[0] as HTMLElement | undefined;
    if (first) this.bindTrigger(first);
  }

  private onTriggerSlotChange = () => {
    const els = this.triggerSlot?.assignedElements();
    if (els && els.length > 0) this.bindTrigger(els[0] as HTMLElement);
  };

  private syncSlotFlags() {
    // Direct-child scan (not `:scope >`, which Stencil's mock-doc can't parse).
    const children = Array.from(this.el.children);
    this.hasSlottedActions = children.some((c) => c.getAttribute('slot') === 'actions');
    this.hasSlottedSubhead = children.some((c) => c.getAttribute('slot') === 'subhead');
  }

  disconnectedCallback() {
    this.clearTimers();
    this.stopPositionWatchdog();
    this.unbindTrigger();
    this.removeScrollListener();
    this.removeEscapeListener();
    this.el.removeEventListener('focusout', this.handleHostFocusOut);
    this.triggerSlot?.removeEventListener('slotchange', this.onTriggerSlotChange);
    this.triggerSlot = undefined;
    this.slotObserver?.disconnect();
    this.slotObserver = undefined;
  }

  // ─── Watchers ────────────────────────────────────────────

  @Watch('open')
  onOpenChange(val: boolean) {
    if (val) {
      this.showTooltip();
    } else {
      this.hideTooltip();
    }
  }

  @Watch('disabled')
  onDisabledChange(disabled: boolean) {
    if (disabled) {
      this.clearTimers();
      if (this.open) this.open = false;
      this.triggerEl?.removeAttribute('aria-description');
    } else if (this.triggerEl) {
      this.updateTriggerAria(this.triggerEl);
    }
  }

  /** Keep the trigger's aria-description in sync when the tooltip's text changes
   *  after binding (bindTrigger and the disabled watcher were the only refreshers). */
  @Watch('text')
  @Watch('subhead')
  onDescriptionChange() {
    if (this.triggerEl) this.updateTriggerAria(this.triggerEl);
  }

  // ─── Public Methods ──────────────────────────────────────

  /** Show the tooltip programmatically (no-op while `disabled`). */
  @Method()
  async show() {
    // Don't flip `open` (a reflected attribute) true while disabled — showTooltip
    // would early-return, leaving open=true with nothing visible (a state desync).
    if (this.disabled) return;
    this.open = true;
  }

  /** Dismiss the tooltip programmatically. */
  @Method()
  async hide() {
    this.open = false;
  }

  // ─── Trigger Binding ─────────────────────────────────────

  private bindTrigger(el: HTMLElement) {
    this.unbindTrigger();
    this.triggerEl = el;

    // Presentational triggers (e.g. weekday spans) are not focusable; hover the host instead.
    if (this.useHostHover(el)) {
      this.el.addEventListener('mouseenter', this.handleTriggerEnter);
      this.el.addEventListener('mouseleave', this.handleTriggerLeave);
      this.hostHoverBound = true;
    } else {
      el.addEventListener('mouseenter', this.handleTriggerEnter);
      el.addEventListener('mouseleave', this.handleTriggerLeave);
    }

    el.addEventListener('focus', this.handleTriggerFocus);
    el.addEventListener('blur', this.handleTriggerBlur);
    this.updateTriggerAria(el);
  }

  private unbindTrigger() {
    if (this.hostHoverBound) {
      this.el.removeEventListener('mouseenter', this.handleTriggerEnter);
      this.el.removeEventListener('mouseleave', this.handleTriggerLeave);
      this.hostHoverBound = false;
    } else if (this.triggerEl) {
      this.triggerEl.removeEventListener('mouseenter', this.handleTriggerEnter);
      this.triggerEl.removeEventListener('mouseleave', this.handleTriggerLeave);
    }

    if (!this.triggerEl) return;

    this.triggerEl.removeEventListener('focus', this.handleTriggerFocus);
    this.triggerEl.removeEventListener('blur', this.handleTriggerBlur);
    this.triggerEl.removeAttribute('aria-description');
    this.triggerEl = undefined;
  }

  /** True when hover should be tracked on the tooltip host (non-interactive triggers). */
  private useHostHover(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') {
      return false;
    }
    if (el.hasAttribute('tabindex') && el.tabIndex >= 0) return false;
    if (tag.startsWith('md-')) return false;
    return true;
  }

  /** aria-description works across shadow DOM (unlike aria-describedby IDREFs) */
  private updateTriggerAria(el: HTMLElement) {
    if (this.disabled) {
      el.removeAttribute('aria-description');
      return;
    }
    const desc = this.computeDescription();
    if (desc) {
      el.setAttribute('aria-description', desc);
    } else {
      el.removeAttribute('aria-description');
    }
  }

  /**
   * The trigger's accessible description: `text`/`subhead` props first, then a
   * fallback to slotted rich content (subhead + supporting text) so a slot-only
   * rich tooltip is still announced to screen readers. Action buttons are excluded
   * — they are not description text and carry their own accessible names.
   */
  private computeDescription(): string {
    if (this.text) return this.text;
    if (this.subhead) return this.subhead;
    const parts: string[] = [];
    for (const child of Array.from(this.el.children)) {
      const slot = child.getAttribute('slot');
      if (slot === 'subhead' || slot === 'content') {
        const t = (child.textContent || '').trim();
        if (t) parts.push(t);
      }
    }
    return parts.join('. ');
  }

  // ─── Event Handlers ──────────────────────────────────────

  /** Arm the show timer, unless disabled or Escape-suppressed until re-entry. */
  private scheduleShow() {
    if (this.disabled || this.suppressed) return;
    this.clearTimers();
    this.showTimer = setTimeout(() => {
      this.open = true;
    }, this.showDelay);
  }

  /** Arm the hide grace timer (both variants) so the pointer can travel from the
   *  trigger onto the popup without it vanishing — WCAG 1.4.13 "hoverable". */
  private scheduleHide() {
    this.clearTimers();
    this.hideTimer = setTimeout(() => {
      this.open = false;
    }, this.hideDelay);
  }

  private handleTriggerEnter = () => this.scheduleShow();

  private handleTriggerLeave = () => {
    // A fresh hover may re-show after an Escape dismissal.
    this.suppressed = false;
    this.scheduleHide();
  };

  private handleTriggerFocus = () => this.scheduleShow();

  private handleTriggerBlur = (e: FocusEvent) => {
    // Focus moving into the popup (rich action buttons) keeps the tooltip open.
    if (e.relatedTarget && this.el.contains(e.relatedTarget as Node)) return;
    this.suppressed = false;
    this.scheduleHide();
  };

  /**
   * Handles focusout at the host level — covers focus leaving
   * both the trigger AND slotted rich-tooltip action buttons.
   */
  private handleHostFocusOut = (e: FocusEvent) => {
    if (this.variant !== 'rich' || !this.isVisible) return;
    if (e.relatedTarget && this.el.contains(e.relatedTarget as Node)) return;
    this.scheduleHide();
  };

  /** Pointer over the popup keeps it open (hoverable) — both variants. */
  private handlePopupEnter = () => {
    this.clearTimers();
  };

  private handlePopupLeave = () => {
    this.scheduleHide();
  };

  // ─── Show / Hide ─────────────────────────────────────────

  /** Document-level Escape handler — dismisses from any focused descendant */
  private handleGlobalEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.isVisible) return;
    e.preventDefault();
    this.clearTimers();
    // Suppress re-show until the pointer/focus leaves and returns, so refocusing
    // the trigger (below) or a lingering hover can't immediately reopen it.
    this.suppressed = true;
    // WCAG 1.4.13: dismissal must NOT move focus. Only return focus to the trigger
    // when focus is currently inside the tooltip (popup/actions) or on the trigger —
    // never yank it from an unrelated element the user is interacting with.
    const active = this.getDeepActiveElement();
    const focusInside = !!active && (this.el.contains(active) || active === this.triggerEl);
    this.open = false;
    if (focusInside && this.triggerEl) this.triggerEl.focus();
  };

  /** Deepest focused element, piercing shadow roots. */
  private getDeepActiveElement(): Element | null {
    if (typeof document === 'undefined') return null;
    let a: Element | null = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  private addEscapeListener() {
    if (!this.escapeListenerBound) {
      document.addEventListener('keydown', this.handleGlobalEscape, true);
      this.escapeListenerBound = true;
    }
  }

  private removeEscapeListener() {
    if (this.escapeListenerBound) {
      document.removeEventListener('keydown', this.handleGlobalEscape, true);
      this.escapeListenerBound = false;
    }
  }

  private showTooltip() {
    if (this.disabled) return;
    // A DETACHED element must not bind global listeners or start the rAF loop —
    // disconnectedCallback can never fire again to clean them up (a stale ref
    // toggling `open` after removal would otherwise leak a 60fps loop plus a
    // document-level Escape handler forever). connectedCallback re-shows on
    // reconnect via the open/isVisible checks.
    if (!this.el.isConnected) return;
    this.isVisible = true;
    this.mdOpen.emit();
    this.addScrollListener();
    this.addEscapeListener();
    // Measure after layout so fixed coords are accurate (retry if popup not yet sized).
    this.schedulePositionUpdate();
    this.startPositionWatchdog();
  }

  private schedulePositionUpdate(attempt = 0) {
    requestAnimationFrame(() => {
      const positioned = this.updatePosition();
      if (!positioned && attempt < 3) {
        this.schedulePositionUpdate(attempt + 1);
      }
    });
  }

  // ─── Position Watchdog ──────────────────────────────────
  //
  // The scroll listener only repairs staleness that arrives as a light-DOM scroll.
  // Everything else that moves the anchor or resizes the popup after positioning is
  // invisible to it: window resize reflow, scrollers inside OTHER shadow roots
  // (scroll is composed:false), sibling layout shift, web-font/text growth, and a
  // containing-block appearing/vanishing at rest (md-list's --shifting adds
  // will-change:transform to rows that haven't moved; md-date-picker's entrance
  // transform settles back to none). Rather than plumbing per-ancestor listeners +
  // ResizeObservers + animation hooks (large lifecycle surface), a single rAF
  // watchdog runs ONLY while the tooltip is visible and repositions when the anchor
  // rect, popup size, the popup's ACTUAL viewport position (which shifts when a
  // containing block reinterprets the stored coords), or the viewport changes.
  // Cost: two getBoundingClientRect calls (anchor + popup) and two offset reads per
  // frame, per visible tooltip (tooltips are transient, effectively one at a time).

  /** Geometry snapshot from the last successful updatePosition. ex/ey are the popup's
   *  EXPECTED viewport coords — if a containing-block change reinterprets the stored
   *  style.top/left, the popup's real rect drifts from these and we reposition. */
  private lastGeom = { at: 0, al: 0, aw: 0, ah: 0, pw: 0, ph: 0, vw: 0, vh: 0, ex: 0, ey: 0 };
  private watchdogFrame = 0;

  private startPositionWatchdog() {
    if (typeof requestAnimationFrame !== 'function') return;
    this.stopPositionWatchdog();
    const tick = () => {
      if (!this.isVisible || !this.el.isConnected) {
        this.watchdogFrame = 0;
        return;
      }
      const popup = this.popupEl;
      if (popup && this.triggerEl) {
        const pw = popup.offsetWidth;
        const ph = popup.offsetHeight;
        // A 0x0 popup means a hidden ancestor — positioning would fail without
        // refreshing the snapshot, so skip until it has a box again (the size
        // delta versus the snapshot triggers the reposition on reveal).
        if (pw !== 0 || ph !== 0) {
          const a = this.getAnchorRect();
          const p = popup.getBoundingClientRect();
          const g = this.lastGeom;
          const drifted =
            a.top !== g.at || a.left !== g.al || a.width !== g.aw || a.height !== g.ah ||
            pw !== g.pw || ph !== g.ph ||
            // 0.5px tolerance absorbs subpixel churn; the entrance scale animation
            // exceeds it for a few frames, which just re-writes the same coords.
            Math.abs(p.top - g.ey) > 0.5 || Math.abs(p.left - g.ex) > 0.5 ||
            window.innerWidth !== g.vw || window.innerHeight !== g.vh;
          if (drifted) this.updatePosition();
        }
      }
      this.watchdogFrame = requestAnimationFrame(tick);
    };
    this.watchdogFrame = requestAnimationFrame(tick);
  }

  private stopPositionWatchdog() {
    if (this.watchdogFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.watchdogFrame);
    }
    this.watchdogFrame = 0;
  }

  private hideTooltip() {
    // No spurious mdClose if it was never actually shown (e.g. hide() after a
    // show() that was suppressed by `disabled`) — keep open/close events balanced.
    if (!this.isVisible) return;
    this.isVisible = false;
    this.mdClose.emit();
    this.removeScrollListener();
    this.removeEscapeListener();
    this.stopPositionWatchdog();
  }

  private clearTimers() {
    if (this.showTimer != null) {
      clearTimeout(this.showTimer);
      this.showTimer = undefined;
    }
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  // ─── Scroll Listener ────────────────────────────────────

  private addScrollListener() {
    if (!this.scrollListenerBound) {
      window.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
      this.scrollListenerBound = true;
    }
  }

  private removeScrollListener() {
    if (this.scrollListenerBound) {
      window.removeEventListener('scroll', this.handleScroll, true);
      this.scrollListenerBound = false;
    }
  }

  private handleScroll = () => {
    if (this.isVisible) this.updatePosition();
  };

  // ─── Positioning ─────────────────────────────────────────

  private updatePosition(): boolean {
    if (!this.popupEl || !this.triggerEl) return false;

    const anchorRect = this.getAnchorRect();
    const popupW = this.popupEl.offsetWidth;
    const popupH = this.popupEl.offsetHeight;

    if (popupW === 0 && popupH === 0) return false;

    let placement = this.physicalPlacement(this.position);

    if (this.autoPosition) {
      placement = this.findBestPlacement(anchorRect, popupW, popupH, placement);
    }

    const coords = this.calcCoords(anchorRect.width, anchorRect.height, popupW, popupH, placement);

    // crossOffset shifts the popup along the axis PERPENDICULAR to the placement:
    // horizontal for top/bottom, vertical for left/right. Applying it to `left`
    // unconditionally moved it along the MAIN axis for left/right placements.
    if (placement.startsWith('top') || placement.startsWith('bottom')) {
      coords.left += this.crossOffset;
    } else {
      coords.top += this.crossOffset;
    }

    // Cross-axis clamp: nudge the popup along the axis perpendicular to the
    // placement so it stays in the viewport, instead of flipping. A centered
    // top/bottom tooltip on an edge trigger (e.g. the first/last nav chevron in
    // a docked md-date-picker) would otherwise overflow horizontally — keep the
    // requested side and shift it inward so it stays bottom and fully visible.
    if (this.autoPosition) {
      const isVertical = placement.startsWith('top') || placement.startsWith('bottom');
      const M = TOOLTIP_VIEWPORT_MARGIN;
      if (isVertical) {
        const absLeft = anchorRect.left + coords.left;
        const maxLeft = window.innerWidth - popupW - M;
        const clampedLeft = Math.min(Math.max(absLeft, M), Math.max(M, maxLeft));
        coords.left += clampedLeft - absLeft;
      } else {
        const absTop = anchorRect.top + coords.top;
        const maxTop = window.innerHeight - popupH - M;
        const clampedTop = Math.min(Math.max(absTop, M), Math.max(M, maxTop));
        coords.top += clampedTop - absTop;
      }
    }

    const fixedCoords = this.toFixedCoords(anchorRect.top + coords.top, anchorRect.left + coords.left);

    // position:fixed — use physical top/left; getBoundingClientRect is viewport-physical.
    // Logical inset-inline-start would misplace popups in RTL (inline-start is on the right).
    this.popupEl.style.top = `${fixedCoords.top}px`;
    this.popupEl.style.left = `${fixedCoords.left}px`;
    this.popupEl.style.insetBlockStart = '';
    this.popupEl.style.insetInlineStart = '';
    this.resolvedPlacement = placement as Placement;
    // Snapshot the geometry this position was computed FROM — the watchdog
    // repositions when any of it drifts. ex/ey are the intended VIEWPORT position
    // (pre containing-block conversion): if a CB later appears/vanishes at rest,
    // the popup's real rect diverges from these with no other signal.
    this.lastGeom = {
      at: anchorRect.top, al: anchorRect.left, aw: anchorRect.width, ah: anchorRect.height,
      pw: popupW, ph: popupH,
      vw: window.innerWidth, vh: window.innerHeight,
      ex: anchorRect.left + coords.left, ey: anchorRect.top + coords.top,
    };
    return true;
  }

  /** Prefer the slotted trigger; fall back to the tooltip host when the trigger has
   *  no box. Reads the trigger rect FIRST so the common case costs one rect read —
   *  this runs every watchdog frame. */
  private getAnchorRect(): DOMRect {
    if (this.triggerEl) {
      const triggerRect = this.triggerEl.getBoundingClientRect();
      if (triggerRect.width > 0 || triggerRect.height > 0) return triggerRect;
    }
    return this.el.getBoundingClientRect();
  }

  /**
   * `position:fixed` is viewport-relative unless an ancestor has transform/filter/perspective,
   * in which case fixed is relative to that ancestor. Convert viewport coords accordingly.
   */
  private toFixedCoords(viewportTop: number, viewportLeft: number): { top: number; left: number } {
    const containingBlock = this.getFixedContainingBlock();
    if (!containingBlock) {
      return { top: viewportTop, left: viewportLeft };
    }

    const cbRect = containingBlock.getBoundingClientRect();
    return {
      top: viewportTop - cbRect.top,
      left: viewportLeft - cbRect.left,
    };
  }

  /** Whether this element's computed style makes it a containing block for
   *  position:fixed descendants. Beyond transform/filter/perspective/backdrop-filter,
   *  this includes will-change of those properties (md-list-item's --shifting uses
   *  will-change: transform), layout/paint containment (incl. the contain shorthands
   *  and container-type, which md-app-bar uses), and content-visibility. */
  private createsFixedContainingBlock(style: CSSStyleDeclaration): boolean {
    const s = style as CSSStyleDeclaration & {
      backdropFilter?: string;
      contain?: string;
      contentVisibility?: string;
      containerType?: string;
      translate?: string;
      rotate?: string;
      scale?: string;
    };
    // NB: check truthiness too — mock-doc (spec env) returns '' for unset
    // properties, and '' !== 'none' would make every element a containing block.
    if (
      (style.transform && style.transform !== 'none') ||
      (style.filter && style.filter !== 'none') ||
      (style.perspective && style.perspective !== 'none')
    ) return true;
    // The individual transform properties create containing blocks too.
    if (
      (s.translate && s.translate !== 'none') ||
      (s.rotate && s.rotate !== 'none') ||
      (s.scale && s.scale !== 'none')
    ) return true;
    if (s.backdropFilter && s.backdropFilter !== 'none') return true;
    if (/\b(transform|perspective|filter|translate|rotate|scale)\b/.test(style.willChange || '')) return true;
    if (/(layout|paint|strict|content)\b/.test(s.contain || '')) return true;
    if (s.contentVisibility === 'auto' || s.contentVisibility === 'hidden') return true;
    // Only size containment creates a containing block — `scroll-state` query
    // containers apply no containment at all.
    if (s.containerType && /\bsize\b/.test(s.containerType)) return true;
    return false;
  }

  private getFixedContainingBlock(): HTMLElement | null {
    // Start at the HOST itself — a transformed md-tooltip is the popup's containing
    // block too (the popup lives inside its shadow root).
    let node: HTMLElement | null = this.el;

    while (node) {
      if (this.createsFixedContainingBlock(getComputedStyle(node))) {
        return node;
      }

      if (node.parentElement) {
        node = node.parentElement;
      } else if (node.parentNode instanceof ShadowRoot) {
        node = node.parentNode.host as HTMLElement;
      } else {
        node = null;
      }
    }

    return null;
  }

  private physicalPlacement(placement: string): string {
    if (typeof window === 'undefined') return placement;
    const isRTL = getComputedStyle(this.el).direction === 'rtl';
    if (!isRTL) return placement;

    const [axis, align = ''] = [placement.split('-')[0], placement.split('-').slice(1).join('-')];
    // The placement SIDE mirrors in RTL for left/right (inline axis).
    const flippedAxis = axis === 'left' ? 'right' : axis === 'right' ? 'left' : axis;
    // The -start/-end SUFFIX is inline-axis alignment only for top/bottom placements —
    // for left/right it aligns on the BLOCK (vertical) axis, which does not mirror
    // in RTL. Flipping it there swapped top-aligned to bottom-aligned.
    const flippedAlign =
      axis === 'top' || axis === 'bottom'
        ? align === 'start' ? 'end' : align === 'end' ? 'start' : align
        : align;
    return flippedAlign ? `${flippedAxis}-${flippedAlign}` : flippedAxis;
  }

  private calcCoords(
    hostW: number, hostH: number,
    popupW: number, popupH: number,
    placement: string,
  ): { top: number; left: number } {
    const o = this.offset;

    switch (placement) {
      case 'top':         return { top: -(popupH + o), left: (hostW - popupW) / 2 };
      case 'top-start':   return { top: -(popupH + o), left: 0 };
      case 'top-end':     return { top: -(popupH + o), left: hostW - popupW };
      case 'bottom':      return { top: hostH + o, left: (hostW - popupW) / 2 };
      case 'bottom-start': return { top: hostH + o, left: 0 };
      case 'bottom-end':  return { top: hostH + o, left: hostW - popupW };
      case 'left':        return { top: (hostH - popupH) / 2, left: -(popupW + o) };
      case 'left-start':  return { top: 0, left: -(popupW + o) };
      case 'left-end':    return { top: hostH - popupH, left: -(popupW + o) };
      case 'right':       return { top: (hostH - popupH) / 2, left: hostW + o };
      case 'right-start': return { top: 0, left: hostW + o };
      case 'right-end':   return { top: hostH - popupH, left: hostW + o };
      default:            return { top: -(popupH + o), left: (hostW - popupW) / 2 };
    }
  }

  /**
   * Whether the placement fits the viewport along its MAIN axis only — the axis
   * the popup is pushed along (vertical for top/bottom, horizontal for left/right).
   * Cross-axis overflow is handled by clamping in `updatePosition`, not flipping,
   * so an edge-anchored centered tooltip keeps its requested side.
   */
  private fitsMainAxis(
    hostRect: DOMRect,
    popupW: number,
    popupH: number,
    relTop: number,
    relLeft: number,
    placement: string,
  ): boolean {
    const isVertical = placement.startsWith('top') || placement.startsWith('bottom');
    if (isVertical) {
      const absTop = hostRect.top + relTop;
      return absTop >= 0 && absTop + popupH <= window.innerHeight;
    }
    const absLeft = hostRect.left + relLeft;
    return absLeft >= 0 && absLeft + popupW <= window.innerWidth;
  }

  private getOppositePlacement(p: string): string {
    const [axis, align] = [p.split('-')[0], p.split('-').slice(1).join('-')];
    const opp: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    return align ? `${opp[axis]}-${align}` : opp[axis];
  }

  private findBestPlacement(
    hostRect: DOMRect,
    popupW: number,
    popupH: number,
    preferred: string,
  ): string {
    const check = (p: string) => {
      const c = this.calcCoords(hostRect.width, hostRect.height, popupW, popupH, p);
      return this.fitsMainAxis(hostRect, popupW, popupH, c.top, c.left, p);
    };

    if (check(preferred)) return preferred;

    const opposite = this.getOppositePlacement(preferred);
    if (check(opposite)) return opposite;

    const align = preferred.split('-')[1] || '';
    const axes = ['top', 'bottom', 'right', 'left'];
    for (const axis of axes) {
      const candidate = align ? `${axis}-${align}` : axis;
      if (candidate !== preferred && candidate !== opposite && check(candidate)) {
        return candidate;
      }
    }

    return preferred;
  }

  // ─── Render ──────────────────────────────────────────────

  render() {
    const isRich = this.variant === 'rich';
    const hasSubhead = !!this.subhead || this.hasSlottedSubhead;
    const hasActions = this.hasSlottedActions;

    return (
      <Host class="md-tooltip-wrapper">
        <slot></slot>
        <div
          class={{
            'md-tooltip__popup': true,
            'md-tooltip__popup--plain': !isRich,
            'md-tooltip__popup--rich': isRich,
            'md-tooltip__popup--visible': this.isVisible,
            [`md-tooltip__popup--${this.resolvedPlacement}`]: true,
          }}
          id={this.tooltipId}
          role="tooltip"
          part="popup"
          aria-hidden={this.isVisible ? 'false' : 'true'}
          ref={el => (this.popupEl = el)}
          onMouseEnter={this.handlePopupEnter}
          onMouseLeave={this.handlePopupLeave}
        >
          {isRich ? ([
            hasSubhead && (
              <div class="md-tooltip__subhead" part="subhead" key="subhead">
                <slot name="subhead">{this.subhead}</slot>
              </div>
            ),
            <div class="md-tooltip__supporting-text" part="supporting-text" key="text">
              <slot name="content">{this.text}</slot>
            </div>,
            <div class={{ 'md-tooltip__actions': true, 'md-tooltip__actions--empty': !hasActions }} part="actions" key="actions">
              <slot name="actions"></slot>
            </div>,
          ]) : (
            <span class="md-tooltip__text" part="text">{this.text}</span>
          )}
        </div>
      </Host>
    );
  }
}

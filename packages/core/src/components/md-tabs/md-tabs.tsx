import { Component, Host, h, Prop, Event, EventEmitter, Element, Watch, State, Method, Listen } from '@stencil/core';

/**
 * @slot - Tab items (`md-tab` elements)
 *
 * @part container - Scrollable tab container
 */
@Component({
  tag: 'md-tabs',
  styleUrl: 'md-tabs.css',
  shadow: true,
})
export class MdTabs {
  @Element() el!: HTMLElement;

  /** Index of the currently active tab */
  @Prop({ mutable: true }) activeTabIndex: number = 0;

  /** Visual variant applied to all child tabs */
  @Prop({ reflect: true }) variant: 'primary' | 'secondary' = 'primary';

  /**
   * How far the bottom rule under the strip runs.
   *
   * - `auto` — each tab draws its own 1px segment, so the rule is exactly as
   *   wide as the tabs collectively are (default; unchanged behaviour).
   * - `full` — one rule across the whole container, drawn by md-tabs itself
   *   and running past the last tab to the container's edge.
   *
   * `auto` is right when the strip fills its container, which it does at
   * `tab-width="equal"`. It reads as a bug at `tab-width="auto"` in a wide
   * panel, where three content-sized tabs leave the rule stopping a third of
   * the way across and the panel below appearing to hang off the end of it.
   *
   * In `full` mode the per-tab segments are suppressed by setting
   * `--md-tab-divider-color: transparent` on the host — custom properties
   * inherit through the slotted tabs' shadow roots, so there is no second
   * source of truth about which mode is active.
   */
  @Prop({ reflect: true }) divider: 'auto' | 'full' = 'auto';

  /** Accessible label for the tablist */
  @Prop({ attribute: 'aria-label' }) ariaLabelProp: string = '';

  /**
   * How tabs size along the strip. All modes are layout-stable under
   * dynamic content (labels/badges can change without reshuffling the
   * strip); long labels ellipsize instead of forcing a tab wider.
   * - `equal` (default) — tabs share the parent's FULL width equally;
   *   tracks change only when the PARENT resizes.
   * - `auto` — each tab takes its content width (the strip scrolls), so
   *   tracks follow content by design.
   * - any CSS length (e.g. `"140px"`, `"10rem"`) — every tab gets exactly
   *   that width regardless of parent or content.
   */
  @Prop({ attribute: 'tab-width' }) tabWidth: string = 'equal';

  /**
   * Explicit width for the WHOLE strip (any CSS size: `"480px"`, `"40rem"`,
   * `"100%"`). By default the strip is `100%` of its parent — in
   * shrink-to-fit layouts (inline-block cards, auto grid columns, flex
   * items) that parent's width follows the ACTIVE TAB PANEL, so switching
   * to a tab with tiny content collapses the whole tablist. Set `width` to
   * anchor the strip regardless of what the panels do.
   */
  @Prop() width: string = '';

  @Watch('tabWidth')
  onTabWidthChange() {
    this.updateOverflow();
  }

  private get tabWidthMode(): 'equal' | 'auto' | 'fixed' {
    if (this.tabWidth === 'auto') return 'auto';
    if (!this.tabWidth || this.tabWidth === 'equal') return 'equal';
    return 'fixed';
  }

  /** Emits when the active tab changes */
  @Event() mdTabChange: EventEmitter<{ index: number; previousIndex: number }>;

  @State() private tabCount = 0;

  private tabs: HTMLElement[] = [];
  private containerEl?: HTMLElement;
  private listenersBound = false;
  private hasLoaded = false;
  /** The active tab ELEMENT — selection survives reorders/removals by
   *  identity, not position (removing a preceding tab must not silently
   *  select a different tab). */
  private activeTabEl: HTMLElement | null = null;
  /** Guards the activeTabIndex watch while we reconcile internally. */
  private syncingIndex = false;
  /** Consumer-requested index awaiting a tab that hasn't slotted in yet. */
  private pendingRequestedIndex: number | null = null;
  private prevTabs: HTMLElement[] = [];
  private glideToken = 0;
  private resizeObserver?: ResizeObserver;
  private dirObserver?: MutationObserver;
  private uniquePrefix = `md-tabs-${Math.random().toString(36).slice(2, 7)}`;

  // ─── Lifecycle ───────────────────────────────────────────

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const slot = shadow.querySelector('slot') as HTMLSlotElement | null;
    slot?.addEventListener('slotchange', () => this.syncTabs());
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateOverflow());
    }
    if (typeof MutationObserver !== 'undefined') {
      // A runtime dir flip moves the clipped side without firing scroll or
      // resize — the fades went stale on the wrong edge.
      this.dirObserver = new MutationObserver(() => this.updateOverflow());
    }
    this.hasLoaded = true;
    this.attachObservers();
    this.syncTabs();
  }

  connectedCallback() {
    // Reparenting disconnects (tearing down tab listeners) and reconnects
    // WITHOUT a slotchange — the slot's assignment inside our own shadow
    // never changed. Rebind, or the component is permanently dead after
    // an appendChild elsewhere.
    if (this.hasLoaded) {
      queueMicrotask(() => {
        this.attachObservers(); // disconnect() wiped subscriptions — re-observe
        this.syncTabs();
      });
    }
  }

  disconnectedCallback() {
    this.removeTabListeners();
    this.resizeObserver?.disconnect();
    this.dirObserver?.disconnect();
  }

  private attachObservers() {
    if (this.containerEl) this.resizeObserver?.observe(this.containerEl);
    if (this.dirObserver) {
      this.dirObserver.observe(this.el, { attributes: true, attributeFilter: ['dir'] });
      this.dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    }
  }

  // ─── Watchers ────────────────────────────────────────────

  @Watch('activeTabIndex')
  onActiveChange(newIndex: number) {
    if (this.syncingIndex) return;
    // The prop is the primary framework-wrapper path — it must be FULLY
    // reactive: clamp, then active state + roving tabindex + scroll, exactly
    // like the click/keyboard path (previously only the visuals updated,
    // leaving focus on the old tab and the new one offscreen).
    const sanitized = this.sanitizeIndex(newIndex);
    // "append a tab and select it" sets an index the (stale, pre-slotchange)
    // list doesn't have yet — remember the INTENT and honor it when the tab
    // registers, instead of permanently rewriting the consumer's value.
    this.pendingRequestedIndex = sanitized > this.tabs.length - 1 ? sanitized : null;
    const clamped = this.clampIndex(sanitized);
    if (clamped !== newIndex) {
      this.setIndexInternal(clamped); // guarded — the watch will NOT re-fire
    }
    this.applyIndex(clamped);
  }

  @Watch('variant')
  onVariantChange() {
    this.tabs.forEach(tab => tab.setAttribute('variant', this.variant));
  }

  // ─── Public Methods ──────────────────────────────────────

  /** Programmatically select a tab by index */
  @Method()
  async selectTab(index: number) {
    if (index < 0 || index >= this.tabs.length) return;
    this.activateTab(index);
  }

  // ─── Keyboard Navigation ─────────────────────────────────

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (this.tabs.length === 0) return;

    // composedPath()[0] is the true origin even through CLOSED shadow roots
    // (the deep activeElement walk stops at a closed host — arrows were dead
    // there). Fallback to the walk for synthetic events without a path.
    const origin = (e.composedPath?.()[0] as HTMLElement | undefined) ?? (this.deepActiveElement() as HTMLElement);
    const originTab = origin?.closest?.('md-tab') ?? origin;
    const currentIndex = this.tabs.indexOf(originTab as HTMLElement);
    if (currentIndex === -1) return;

    // Arrow keys follow VISUAL direction: in RTL, ArrowRight moves toward
    // lower indexes (same contract as md-navigation-bar).
    const dir: 1 | -1 = this.isRtl() ? -1 : 1;
    let targetIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        targetIndex = this.findNextEnabledWrapping(currentIndex, dir);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        targetIndex = this.findNextEnabledWrapping(currentIndex, (dir * -1) as 1 | -1);
        break;
      case 'Home':
        e.preventDefault();
        targetIndex = this.findFirstEnabled();
        break;
      case 'End':
        e.preventDefault();
        targetIndex = this.findLastEnabled();
        break;
    }

    if (targetIndex !== null && targetIndex !== currentIndex) {
      this.tabs[targetIndex].focus();
      this.activateTab(targetIndex);
    }
  }

  /** A disabled state change re-roves so exactly one tab stays focusable. */
  @Listen('mdTabDisabledChange')
  handleTabDisabledChange() {
    this.updateRovingTabindex();
  }

  private deepActiveElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  private isRtl(): boolean {
    return typeof getComputedStyle !== 'undefined' && getComputedStyle(this.el).direction === 'rtl';
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Wraps around: last→first and first→last, skipping disabled tabs. */
  private findNextEnabledWrapping(from: number, direction: 1 | -1): number | null {
    const len = this.tabs.length;
    if (len === 0) return null;
    let idx = from;
    for (let i = 0; i < len; i++) {
      idx = (idx + direction + len) % len;
      if (!this.isDisabledTab(this.tabs[idx])) return idx;
    }
    return null;
  }

  private findFirstEnabled(): number | null {
    for (let i = 0; i < this.tabs.length; i++) {
      if (!this.isDisabledTab(this.tabs[i])) return i;
    }
    return null;
  }

  private findLastEnabled(): number | null {
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (!this.isDisabledTab(this.tabs[i])) return i;
    }
    return null;
  }

  // ─── Tab Sync ────────────────────────────────────────────

  private syncTabs() {
    this.removeTabListeners();

    const slot = this.el.shadowRoot?.querySelector('slot') as HTMLSlotElement | null;
    if (!slot) return;

    // flatten:true — tabs forwarded through a wrapper's <slot> must be
    // managed too (without it, assignedElements() returns the nested SLOT
    // element and zero tabs register).
    this.tabs = slot.assignedElements({ flatten: true }).filter(
      el => el.tagName === 'MD-TAB',
    ) as HTMLElement[];

    this.tabCount = this.tabs.length;

    this.tabs.forEach((tab, index) => {
      tab.setAttribute('variant', this.variant);
      tab.addEventListener('mdTabClick', this.createTabClickHandler(index));

      if (!tab.id) {
        tab.id = `${this.uniquePrefix}-tab-${index}`;
      }
    });

    this.listenersBound = true;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      if (this.containerEl) this.resizeObserver.observe(this.containerEl);
      // A tab GROWING (label/min-width change) overflows the strip without
      // resizing the container box — observe the tabs themselves.
      this.tabs.forEach((t) => this.resizeObserver!.observe(t));
    }
    this.reconcileActiveTab();
    this.updateOverflow();
  }

  /**
   * Selection integrity across mutations: follow the active ELEMENT if it
   * still exists; if it was removed (or the index is out of range), clamp to
   * the nearest valid enabled tab and tell consumers. Never leave the
   * tablist without a focusable tab.
   */
  private reconcileActiveTab() {
    // Tabs that LEFT the managed set must not keep selected-looking state
    // (a moved-out active tab kept active + aria-selected + tabindex=0).
    this.prevTabs.forEach((t) => {
      if (!this.tabs.includes(t)) {
        t.removeAttribute('active');
        t.removeAttribute('tabindex'); // its own reconnect stamps standalone
      }
    });
    this.prevTabs = this.tabs;

    if (this.tabs.length === 0) {
      this.activeTabEl = null;
      return;
    }

    // A consumer index that outran the slotted list ("append + select")
    // wins the moment the tab registers — consumer-initiated, so no emit.
    if (this.pendingRequestedIndex !== null) {
      const pending = this.pendingRequestedIndex;
      this.pendingRequestedIndex = null; // single-shot: first reconcile only
      if (pending <= this.tabs.length - 1) {
        const idx = this.clampIndex(pending);
        this.setIndexInternal(idx);
        this.applyIndex(idx);
        return;
      }
    }

    // No enabled tab at all: nothing may claim aria-selected or the tab
    // stop (previously a DISABLED tab ended active with zero focusable tabs).
    if (this.findFirstEnabled() === null) {
      const hadSelection = this.activeTabEl !== null;
      const previousIndex = this.activeTabIndex;
      this.tabs.forEach((t) => t.removeAttribute('active'));
      this.activeTabEl = null;
      this.updateRovingTabindex();
      if (hadSelection) this.mdTabChange.emit({ index: -1, previousIndex });
      return;
    }

    const prevEl = this.activeTabEl;
    let index: number;
    if (prevEl && this.tabs.includes(prevEl)) {
      index = this.tabs.indexOf(prevEl);
    } else {
      index = this.clampIndex(this.activeTabIndex);
    }
    const previousIndex = this.activeTabIndex;
    this.setIndexInternal(index);
    this.applyIndex(index, { scroll: false });
    // Emit on ELEMENT-identity change, not index change: removing a mid-list
    // active tab keeps the same NUMBER while selecting a different tab —
    // the old numeric guard made that emit dead code.
    if (prevEl !== null && this.activeTabEl !== prevEl) {
      this.mdTabChange.emit({ index, previousIndex });
    }
  }

  /** NaN / floats / attribute garbage must never wipe the tablist. */
  private sanitizeIndex(index: unknown): number {
    const num = Math.round(Number(index));
    return Number.isFinite(num) ? num : 0;
  }

  /** Property writes reflect to the attribute ASYNC — read the prop first
   *  so a just-disabled tab is never left holding the tab stop. */
  private isDisabledTab(tab: HTMLElement): boolean {
    return (tab as HTMLElement & { disabled?: boolean }).disabled === true || tab.hasAttribute('disabled');
  }

  /** Clamp into range, preferring an enabled tab (falls back to nearest). */
  private clampIndex(index: number): number {
    const len = this.tabs.length;
    if (len === 0) return 0;
    let idx = Math.max(0, Math.min(this.sanitizeIndex(index), len - 1));
    if (this.tabs[idx] && this.isDisabledTab(this.tabs[idx])) {
      const enabled = this.findNextEnabledWrapping(idx, 1) ?? this.findFirstEnabled();
      if (enabled !== null) idx = enabled;
    }
    return idx;
  }

  private setIndexInternal(index: number) {
    if (this.activeTabIndex === index) return;
    this.syncingIndex = true;
    this.activeTabIndex = index;
    this.syncingIndex = false;
  }

  private removeTabListeners() {
    if (!this.listenersBound) return;
    this.tabs.forEach((tab, index) => {
      tab.removeEventListener('mdTabClick', this.createTabClickHandler(index));
    });
    this.listenersBound = false;
  }

  private tabClickHandlers = new Map<number, () => void>();

  private createTabClickHandler(index: number): () => void {
    if (!this.tabClickHandlers.has(index)) {
      this.tabClickHandlers.set(index, () => this.activateTab(index));
    }
    return this.tabClickHandlers.get(index)!;
  }

  private activateTab(index: number) {
    this.pendingRequestedIndex = null;
    if (index === this.activeTabIndex && this.tabs[index]?.hasAttribute('active')) return;
    const previousIndex = this.activeTabIndex;
    this.setIndexInternal(index);
    this.applyIndex(index);
    this.mdTabChange.emit({ index, previousIndex });
  }

  /** SINGLE application path — active state + roving tabindex + scroll (+
   *  indicator glide). Used by the watch, activation and reconciliation so
   *  no caller can half-update again. */
  private applyIndex(index: number, opts: { scroll?: boolean } = {}) {
    const prevEl = this.activeTabEl;
    const nextEl = this.tabs[index] ?? null;
    this.applyActiveState(index);
    this.updateRovingTabindex();
    this.activeTabEl = nextEl;
    if (opts.scroll !== false) this.scrollTabIntoView(index);
    if (prevEl && nextEl && prevEl !== nextEl) this.glideIndicator(prevEl, nextEl);
  }

  private applyActiveState(activeIndex: number) {
    this.tabs.forEach((tab, i) => {
      if (i === activeIndex) {
        tab.setAttribute('active', '');
      } else {
        tab.removeAttribute('active');
      }
    });
  }

  /** md-tabs is the ONLY tabindex writer (md-tab renders none inside a
   *  tablist) and always leaves exactly one focusable tab — the active one,
   *  or the first enabled tab when the active one is disabled/invalid. */
  private updateRovingTabindex() {
    let holder = this.activeTabIndex;
    if (this.tabs[holder] && this.isDisabledTab(this.tabs[holder])) {
      holder = this.findFirstEnabled() ?? holder;
    }
    this.tabs.forEach((tab, i) => {
      if (this.isDisabledTab(tab)) {
        tab.setAttribute('tabindex', '-1');
      } else {
        tab.setAttribute('tabindex', i === holder ? '0' : '-1');
      }
    });
  }

  /**
   * MD3 indicator glide: FLIP the incoming tab's indicator from the
   * outgoing one's position/width to its own. The indicators live in each
   * tab's shadow root, so the transform is driven via inherited custom
   * properties the indicator CSS consumes.
   */
  private glideIndicator(prevTab: HTMLElement, nextTab: HTMLElement) {
    if (this.prefersReducedMotion()) return;
    const measure = (tab: HTMLElement) =>
      (tab.shadowRoot?.querySelector('.md-tab__indicator') ?? tab).getBoundingClientRect();
    const p = measure(prevTab);
    const n = measure(nextTab);
    if (!p.width || !n.width) return;
    const dx = p.left + p.width / 2 - (n.left + n.width / 2);
    const sx = p.width / n.width;
    if (typeof requestAnimationFrame === 'undefined') return;
    // Releasing synchronously never glided: the `active` class lands on the
    // NEXT render, after the vars were already back at identity — the
    // indicator just popped in place. Hold the translated start frame
    // through the render (duration 0), release on a double rAF so the
    // transition carries it home. Token guards rapid tab-hopping.
    const token = ++this.glideToken;
    prevTab.style.removeProperty('--md-tab-glide-x');
    prevTab.style.removeProperty('--md-tab-glide-scale');
    prevTab.style.removeProperty('--md-tab-glide-duration');
    nextTab.style.setProperty('--md-tab-glide-duration', '0s');
    nextTab.style.setProperty('--md-tab-glide-x', `${dx}px`);
    nextTab.style.setProperty('--md-tab-glide-scale', `${sx}`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== this.glideToken) return;
      nextTab.style.removeProperty('--md-tab-glide-duration');
      nextTab.style.setProperty('--md-tab-glide-x', '0px');
      nextTab.style.setProperty('--md-tab-glide-scale', '1');
      setTimeout(() => {
        if (token !== this.glideToken) return;
        nextTab.style.removeProperty('--md-tab-glide-x');
        nextTab.style.removeProperty('--md-tab-glide-scale');
      }, 500);
    }));
  }

  private scrollTabIntoView(index: number) {
    const tab = this.tabs[index];
    if (!tab || !this.containerEl) return;
    tab.scrollIntoView?.({
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  // ─── Overflow affordance ─────────────────────────────────

  /** Vertical wheel scrolls the tab strip horizontally when it overflows —
   *  otherwise clipped tabs are unreachable for mouse-only users (the
   *  scrollbar is hidden by design). */
  private handleWheel = (e: WheelEvent) => {
    const c = this.containerEl;
    if (!c || c.scrollWidth <= c.clientWidth) return;
    // Horizontal gestures (trackpad swipes) scroll the strip NATIVELY —
    // intercepting them replayed the motion through the tarpit below.
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || e.deltaY === 0) return;
    e.preventDefault();
    // deltaMode: 0=pixels, 1=lines (Firefox wheel), 2=pages
    const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? c.clientWidth : 1;
    // MUST bypass the container's scroll-behavior:smooth — incremental
    // scrollLeft writes read the mid-animation position, so a wheel burst
    // compounded off barely-moved values and crawled (10x120px netted
    // 155px of 320). 'instant' applies each tick fully.
    c.scrollBy({ left: e.deltaY * factor, behavior: 'instant' as ScrollBehavior });
  };

  /** Edge fades signal clipped tabs. Detection uses tab GEOMETRY (physical
   *  rects), so it is RTL-correct by construction. */
  private updateOverflow = () => {
    const c = this.containerEl;
    if (!c || this.tabs.length === 0) {
      this.el.classList.remove('md-tabs--clip-left', 'md-tabs--clip-right');
      return;
    }
    const box = c.getBoundingClientRect();
    const first = this.tabs[0].getBoundingClientRect();
    const last = this.tabs[this.tabs.length - 1].getBoundingClientRect();
    const left = Math.min(first.left, last.left);
    const right = Math.max(first.right, last.right);
    this.el.classList.toggle('md-tabs--clip-left', left < box.left - 1);
    this.el.classList.toggle('md-tabs--clip-right', right > box.right + 1);
  };

  // ─── Render ──────────────────────────────────────────────

  render() {
    return (
      <Host
        class={{
          'md-tabs': true,
          [`md-tabs--${this.variant}`]: true,
          'md-tabs--tw-auto': this.tabWidthMode === 'auto',
          'md-tabs--tw-fixed': this.tabWidthMode === 'fixed',
        }}
        style={{
          ...(this.tabWidthMode === 'fixed' ? { '--_tab-width': this.tabWidth } : {}),
          ...(this.width ? { 'inline-size': this.width } : {}),
        }}
        role="tablist"
        aria-label={this.ariaLabelProp || 'tabs'}
        aria-orientation="horizontal"
      >
        <div
          class="md-tabs__container"
          part="container"
          ref={el => (this.containerEl = el)}
          onWheel={this.handleWheel}
          onScroll={this.updateOverflow}
        >
          <slot />
        </div>
      </Host>
    );
  }
}

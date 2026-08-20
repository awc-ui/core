import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Listen,
  Method,
  Prop,
  Watch,
  h,
} from '@stencil/core';

export type MdNavigationBarLabelBehavior = 'always' | 'selected' | 'none';

/**
 * `md-navigation-bar` — Material Design 3 navigation bar.
 *
 * A bottom-anchored row of 3–5 top-level destinations, optimized for
 * compact-width screens (mobile). Each destination is an `<md-navigation-tab>`
 * child; the bar orchestrates selection, label visibility, keyboard
 * navigation (roving tabindex + arrow keys), and emits change events.
 *
 * References:
 *   - {@link https://m3.material.io/components/navigation-bar/overview Overview}
 *   - {@link https://m3.material.io/components/navigation-bar/specs Specs}
 *   - {@link https://m3.material.io/components/navigation-bar/guidelines Guidelines}
 *   - {@link https://m3.material.io/components/navigation-bar/accessibility Accessibility}
 *
 * @slot - One `<md-navigation-tab>` per destination (3–5 recommended).
 *
 * @part container - Inner `tablist` container that lays out the tabs.
 */
@Component({
  tag: 'md-navigation-bar',
  styleUrl: 'md-navigation-bar.css',
  shadow: true,
})
export class MdNavigationBar {
  @Element() el!: HTMLElement;

  /**
   * Index of the currently selected destination. Two-way:
   * external writes drive selection, internal selection writes back.
   */
  @Prop({ mutable: true, reflect: true, attribute: 'active-index' })
  activeIndex: number = 0;

  /**
   * Label visibility for child tabs.
   *
   * - `always`   — Show all labels (default; M3 baseline).
   * - `selected` — Show only the selected tab's label.
   * - `none`     — Icon-only mode (no labels rendered).
   *
   * Per child can be overridden with `label-behavior` on the tab.
   */
  @Prop({ attribute: 'label-behavior' })
  labelBehavior: MdNavigationBarLabelBehavior = 'always';

  /**
   * Keyboard activation policy. When `false` (default), arrow keys move
   * focus AND immediately activate the focused tab (automatic activation;
   * matches the MD3 reference and most nav bar implementations).
   *
   * When `true`, arrow keys only move focus — the user must press
   * `Enter` / `Space` to activate. Use this when activation triggers
   * destructive or expensive work.
   */
  @Prop({ attribute: 'manual-activation' })
  manualActivation: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Emitted when the selected destination changes (user click,
   * keyboard activation, or programmatic `select()` call).
   * Detail includes both the new and previous indices so listeners
   * can short-circuit no-op reselects.
   */
  @Event() mdChange: EventEmitter<{ index: number; previousIndex: number }>;

  private tabs: HTMLElement[] = [];
  private previousIndex: number = -1;
  private slotObserver?: MutationObserver;

  // ─── Lifecycle ───────────────────────────────────────────────────

  componentDidLoad() {
    this.syncTabs();
    this.applyActiveState(this.activeIndex, /* announce */ false);
    this.previousIndex = this.activeIndex;
  }

  disconnectedCallback() {
    this.slotObserver?.disconnect();
  }

  // ─── Watchers ────────────────────────────────────────────────────

  @Watch('activeIndex')
  onActiveIndexChange(newIndex: number, oldIndex: number) {
    const clamped = this.clampToEnabled(newIndex);
    if (clamped !== newIndex) {
      // Re-assigning here triggers the watcher again — but with the
      // already-clamped value it will be a no-op next time.
      this.activeIndex = clamped;
      return;
    }
    this.applyActiveState(clamped, /* announce */ true, oldIndex);
  }

  @Watch('labelBehavior')
  onLabelBehaviorChange() {
    this.tabs.forEach(tab => this.propagateLabelBehavior(tab));
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Programmatically select a destination by index. Out-of-range or
   * disabled targets are clamped to the next enabled tab.
   */
  @Method()
  async select(index: number): Promise<void> {
    const clamped = this.clampToEnabled(index);
    if (clamped === this.activeIndex) return;
    this.activeIndex = clamped; // Triggers @Watch which emits events.
  }

  /**
   * Focus the tab at `index` without selecting it. Used by hosts that
   * implement manual activation flows (e.g. wizards).
   */
  @Method()
  async focusTab(index: number): Promise<void> {
    const t = this.tabs[index];
    if (!t || this.isHardDisabled(t)) return; // soft-disabled stays focusable
    t.focus();
  }

  // ─── Slot / Tab Sync ─────────────────────────────────────────────

  private syncTabs() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const slot = shadow.querySelector('slot') as HTMLSlotElement | null;
    if (!slot) return;

    this.tabs = (slot.assignedElements() as HTMLElement[]).filter(
      el => el.tagName === 'MD-NAVIGATION-TAB',
    );

    // Expose the count as a data attribute on the host without going
    // through @State (avoids the post-load re-render warning).
    if (this.tabs.length > 0) {
      this.el.setAttribute('data-tab-count', String(this.tabs.length));
    } else {
      this.el.removeAttribute('data-tab-count');
    }

    this.tabs.forEach(tab => this.propagateLabelBehavior(tab));

    this.applyActiveState(this.activeIndex, /* announce */ false);
  }

  private propagateLabelBehavior(tab: HTMLElement) {
    // Only set when the tab hasn't been given an explicit per-instance value.
    // We treat presence of the attribute as an explicit override.
    if (!tab.hasAttribute('label-behavior')) {
      // Set via property when defined (Stencil prop), else fall back to attribute.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tab as any).labelBehavior = this.labelBehavior;
      tab.setAttribute('data-md-inherited-label-behavior', this.labelBehavior);
    }
  }

  /**
   * Activation/selection blocked: hard `disabled` OR soft-disabled
   * (`aria-disabled="true"`, set by the tab when `soft-disabled`).
   */
  private isDisabled(tab: HTMLElement): boolean {
    return tab.hasAttribute('disabled') ||
      tab.getAttribute('aria-disabled') === 'true';
  }

  /**
   * Removed from the keyboard tour: only hard `disabled`. Soft-disabled tabs
   * stay arrow-key reachable so they can be discovered (but never activated).
   */
  private isHardDisabled(tab: HTMLElement): boolean {
    return tab.hasAttribute('disabled');
  }

  /**
   * Clamp `index` to a valid enabled tab. Strategy:
   *   1. If the requested index is enabled → use it.
   *   2. Otherwise search forward, then backward for the nearest enabled.
   *   3. If nothing is enabled, returns -1 (no selection).
   */
  private clampToEnabled(index: number): number {
    if (this.tabs.length === 0) return -1;
    const inRange = Math.max(0, Math.min(index, this.tabs.length - 1));
    if (!this.isDisabled(this.tabs[inRange])) return inRange;

    for (let i = inRange + 1; i < this.tabs.length; i++) {
      if (!this.isDisabled(this.tabs[i])) return i;
    }
    for (let i = inRange - 1; i >= 0; i--) {
      if (!this.isDisabled(this.tabs[i])) return i;
    }
    return -1;
  }

  private applyActiveState(activeIndex: number, announce: boolean, oldIndex?: number) {
    this.tabs.forEach((tab, i) => {
      if (i === activeIndex) {
        if (!tab.hasAttribute('active')) tab.setAttribute('active', '');
        tab.setAttribute('tabindex', '0');
        tab.setAttribute('aria-selected', 'true');
      } else {
        if (tab.hasAttribute('active')) tab.removeAttribute('active');
        tab.setAttribute('tabindex', '-1');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    if (announce) {
      const prev = oldIndex ?? this.previousIndex;
      this.previousIndex = activeIndex;
      this.mdChange.emit({ index: activeIndex, previousIndex: prev });
    } else {
      this.previousIndex = activeIndex;
    }
  }

  // ─── Event handling ──────────────────────────────────────────────

  /**
   * Tabs signal activation via `mdTabClick` (fired for both pointer and
   * keyboard Enter/Space). Disabled / soft-disabled tabs suppress the event
   * before it reaches here, so we only see activatable destinations.
   */
  @Listen('mdTabClick')
  handleTabClick(e: CustomEvent<{ index: number }>) {
    e.stopPropagation();

    const tab = e.target as HTMLElement | null;
    if (!tab) return;
    if (this.isDisabled(tab)) return;

    const index = this.tabs.indexOf(tab);
    if (index < 0) return;
    if (index === this.activeIndex) return;

    this.activeIndex = index; // @Watch emits mdChange.
  }

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (this.tabs.length === 0) return;

    // Identify the focused tab (the active element walks shadow boundaries
    // when retargeted — Stencil's focus model gives us the host on focusin).
    const active = document.activeElement as HTMLElement | null;
    const composedTarget = (e.composedPath()[0] as HTMLElement) ?? active;
    const focusedIndex = this.tabs.findIndex(t => t === composedTarget || t.contains(composedTarget));
    if (focusedIndex === -1) return;

    let nextIndex: number | null = null;
    const isRTL = getComputedStyle(this.el).direction === 'rtl';
    const forward = isRTL ? 'ArrowLeft' : 'ArrowRight';
    const backward = isRTL ? 'ArrowRight' : 'ArrowLeft';

    switch (e.key) {
      case forward:
        e.preventDefault();
        nextIndex = this.nextEnabled(focusedIndex, +1);
        break;
      case backward:
        e.preventDefault();
        nextIndex = this.nextEnabled(focusedIndex, -1);
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = this.firstEnabled();
        break;
      case 'End':
        e.preventDefault();
        nextIndex = this.lastEnabled();
        break;
    }

    if (nextIndex === null || nextIndex === focusedIndex) return;

    this.tabs[nextIndex].focus();
    // Soft-disabled tabs are reachable but never auto-activate.
    if (!this.manualActivation && !this.isDisabled(this.tabs[nextIndex])) {
      this.activeIndex = nextIndex;
    }
  }

  private nextEnabled(from: number, direction: 1 | -1): number {
    const len = this.tabs.length;
    let idx = from;
    for (let i = 0; i < len; i++) {
      idx = (idx + direction + len) % len;
      if (!this.isHardDisabled(this.tabs[idx])) return idx;
    }
    return from;
  }

  private firstEnabled(): number {
    for (let i = 0; i < this.tabs.length; i++) {
      if (!this.isHardDisabled(this.tabs[i])) return i;
    }
    return 0;
  }

  private lastEnabled(): number {
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (!this.isHardDisabled(this.tabs[i])) return i;
    }
    return this.tabs.length - 1;
  }

  // ─── Render ──────────────────────────────────────────────────────

  render() {
    // The host carries the `nav` landmark; the inner container carries
    // the `tablist` role so keyboard semantics match the W3C tab pattern
    // while screen-reader users still see a navigation landmark. Authors give
    // the landmark a name by setting `aria-label` directly on the element.
    return (
      <Host role="navigation">
        <div
          class="md-navigation-bar__container"
          part="container"
          role="tablist"
          aria-orientation="horizontal"
        >
          <slot onSlotchange={() => this.syncTabs()} />
        </div>
      </Host>
    );
  }
}

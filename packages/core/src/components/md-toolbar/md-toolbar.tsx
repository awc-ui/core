import { Component, Host, h, Prop, State, Element, Method, Watch, Build } from '@stencil/core';

/**
 * The toolbar host has no built-in actions — all behavior comes from slotted controls.
 * On the web, the default is `role="toolbar"` implementing the WAI-ARIA toolbar pattern
 * with an ADAPTIVE roving tabindex:
 *
 *  - **Activator buttons** (`md-icon-button`, `md-button`, native `button`/`a[href]`,
 *    `role=button`/`menuitem`/`link`) form a single roving group — one Tab stop, and
 *    ArrowLeft/Right (or Up/Down when floating+vertical), Home, End move focus between them.
 *  - **Everything else** is left as its OWN Tab stop with its native behavior — text-entry /
 *    value controls (input, textarea, contenteditable, md-text-field, md-select, `select`,
 *    range/spinbutton), ALL toggles (`md-switch`/`md-checkbox`/`md-chip`, native
 *    checkbox/radio, role=checkbox/radio), and self-managing composites (md-button-group,
 *    md-menu, role=group/radiogroup/listbox/menu). Arrows are never stolen from them, and
 *    they never become roving dead-ends.
 *
 * A soft-disabled (`aria-disabled`) group member stays arrow-reachable (APG: disabled
 * items remain focusable for discoverability). The default Tab stop prefers an enabled
 * control, falling back to the first member only when every member is soft-disabled;
 * focusing any member makes it the stop.
 *
 * This keeps every control keyboard-reachable regardless of the mix, per APG guidance for
 * toolbars that contain text fields. Use `generic` for a non-semantic container (no role,
 * no roving).
 *
 * @slot - Action items (icon buttons, buttons, text fields, menus, etc.)
 * @slot leading - Leading (start) content section
 * @slot trailing - Trailing (end) content section
 * @slot fab - FAB paired with the toolbar (floating variant). Not part of the toolbar
 *   roving set — it stays a separate Tab stop, matching its separate role.
 *
 * @part container - Inner container holding slotted content
 * @part fab-container - FAB wrapper (shown only when fab slot has content)
 */
@Component({
  tag: 'md-toolbar',
  styleUrl: 'md-toolbar.css',
  shadow: true,
})
export class MdToolbar {
  @Element() el!: HTMLElement;

  /** Toolbar type: docked (anchored to bottom) or floating (free-placed) */
  @Prop({ reflect: true }) variant: 'docked' | 'floating' = 'docked';

  /**
   * Toolbar color scheme (bar chrome). Also applies the MD3 expressive **toolbar-only**
   * token map to slotted `md-icon-button` — does not change standalone icon buttons elsewhere.
   */
  @Prop({ reflect: true }) color: 'standard' | 'vibrant' = 'standard';

  /** Layout direction for floating toolbar */
  @Prop({ reflect: true }) layout: 'horizontal' | 'vertical' = 'horizontal';

  /** Alignment of items within the container */
  @Prop({ reflect: true }) alignment: 'start' | 'center' | 'end' | 'space-between' = 'start';

  /**
   * `toolbar` (default): `role="toolbar"`, adaptive roving tabindex, and toolbar ARIA on the
   * host for web. `generic`: no toolbar role — plain container, no roving/arrow navigation.
   * A generic container cannot be named (ARIA name-prohibited): an author-set `aria-label`/
   * `aria-labelledby` is left in place but ignored by assistive tech, and a dev-mode
   * warning is logged.
   */
  @Prop({ reflect: true }) containerSemantics: 'toolbar' | 'generic' = 'toolbar';

  /**
   * Accessible name for the toolbar (`containerSemantics="toolbar"`). Provide a meaningful
   * label describing the toolbar's purpose (e.g. "Text formatting"); prefer `aria-labelledby`
   * when a visible label exists. When neither is set the toolbar is left unnamed (valid ARIA)
   * and a dev-mode warning is logged.
   */
  @Prop({ attribute: 'aria-label' }) ariaLabelProp: string = '';

  /** ID(s) of visible label element(s); takes precedence over `aria-label` for the accessible name */
  @Prop({ attribute: 'aria-labelledby' }) ariaLabelledby: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @State() private hasFab = false;

  /** The control that currently owns the roving group's single Tab stop. */
  private activeItem: HTMLElement | null = null;
  /** Elements whose tabindex/groupTabindex this toolbar rewrote, plus how to restore. */
  private roved = new Map<HTMLElement, { kind: 'group' | 'attr'; orig: string | null }>();
  private slotObserver?: MutationObserver;
  private fabSlot?: HTMLSlotElement;
  private hasLoaded = false;
  private rovingFrame = 0;
  private readonly onHostKeyDown = (ev: KeyboardEvent) => this.handleKeyDown(ev);
  private readonly onFocusIn = (ev: FocusEvent) => this.handleFocusIn(ev);
  private readonly syncFab = () => {
    this.hasFab = (this.fabSlot?.assignedElements().length ?? 0) > 0;
  };
  /** Coalesce mutation-driven re-syncs into one per frame: slotted controls toggle
   *  host classes (state layers) on hover/press, which would otherwise fire a full
   *  roving recompute per interaction. Direct callers (setup, watches) run synchronously. */
  private readonly syncRoving = () => {
    if (typeof requestAnimationFrame !== 'function') {
      this.updateRoving();
      return;
    }
    if (this.rovingFrame) return;
    this.rovingFrame = requestAnimationFrame(() => {
      this.rovingFrame = 0;
      this.updateRoving();
    });
  };

  @Watch('containerSemantics')
  @Watch('variant')
  @Watch('layout')
  onNavPropChange(newValue: unknown, _oldValue: unknown, propName?: string) {
    // aria-orientation / nav axis / whether we rove at all can all change; re-sync so a
    // runtime toolbar→generic switch tears down stale roving and orphans nothing.
    this.updateRoving();
    // Docs promise the ignored-name-on-generic case is never a silent surprise —
    // that must hold for a RUNTIME switch to generic too, not just initial load.
    if (Build.isDev && propName === 'containerSemantics' && newValue === 'generic' && this.hasAccessibleName()) {
      this.warnGenericNamed();
    }
  }

  private hasAccessibleName(): boolean {
    return (this.ariaLabelledby ?? '').trim().length > 0 || (this.ariaLabelProp ?? '').trim().length > 0;
  }

  private warnGenericNamed() {
    console.warn(
      '[md-toolbar] `aria-label`/`aria-labelledby` on container-semantics="generic": a generic container cannot be named (ARIA name-prohibited), so assistive tech will ignore it. Use container-semantics="toolbar" if the name matters.',
    );
  }

  componentWillLoad() {
    // A whitespace-only aria-label yields an empty accessible name — strip it so
    // the host renders as unnamed (the `aria-label` attribute both feeds the prop
    // and is rendered, so a blank value would otherwise linger on the host).
    const raw = this.el.getAttribute('aria-label');
    if (raw !== null && raw.trim() === '') this.el.removeAttribute('aria-label');
  }

  connectedCallback() {
    /* Bubble: slotted controls dispatch keydown/focusin; the host receives after the
       target (matches real Tab/arrow use). */
    this.el.addEventListener('keydown', this.onHostKeyDown, false);
    this.el.addEventListener('focusin', this.onFocusIn, false);
    // On a REPARENT (disconnect→connect after first load), re-establish the observers +
    // roving that componentDidLoad set up — componentDidLoad does not run again on move.
    if (this.hasLoaded) this.setupObservers();
  }

  componentDidLoad() {
    this.hasLoaded = true;
    this.setupObservers();
    if (Build.isDev) {
      const named = this.hasAccessibleName();
      if (this.containerSemantics === 'toolbar' && !named) {
        console.warn(
          '[md-toolbar] role="toolbar" without an accessible name. Set `aria-label` (or `aria-labelledby`) to a meaningful description, e.g. aria-label="Text formatting".',
        );
      } else if (this.containerSemantics === 'generic' && named) {
        this.warnGenericNamed();
      }
    }
  }

  disconnectedCallback() {
    this.el.removeEventListener('keydown', this.onHostKeyDown, false);
    this.el.removeEventListener('focusin', this.onFocusIn, false);
    this.teardownObservers();
    this.clearRoving();
  }

  private setupObservers() {
    const root = this.el.shadowRoot;
    this.fabSlot = (root?.querySelector('slot[name="fab"]') as HTMLSlotElement | null) ?? undefined;
    this.fabSlot?.addEventListener('slotchange', this.syncFab);
    this.syncFab();

    root?.querySelectorAll('slot').forEach((s) => s.addEventListener('slotchange', this.syncRoving));
    if (typeof MutationObserver !== 'undefined' && !this.slotObserver) {
      this.slotObserver = new MutationObserver(this.syncRoving);
      // NB: `tabindex` is deliberately NOT observed — applyRoving writes it and would loop.
      // `class`/`style` are watched so a control hidden via CSS re-syncs the active Tab
      // stop; the per-frame coalescing in syncRoving absorbs interaction-state churn.
      this.slotObserver.observe(this.el, {
        childList: true,
        subtree: true,
        attributes: true,
        // `role`/`type` are watched because they change a control's CLASSIFICATION
        // (e.g. a roved <button> upgraded to role="checkbox" becomes independent) —
        // without a re-sync the stale roving stamp would strand it at tabindex="-1".
        attributeFilter: ['disabled', 'aria-disabled', 'aria-hidden', 'hidden', 'class', 'style', 'role', 'type'],
      });
    }
    this.updateRoving();
  }

  private teardownObservers() {
    this.fabSlot?.removeEventListener('slotchange', this.syncFab);
    this.el.shadowRoot?.querySelectorAll('slot').forEach((s) => s.removeEventListener('slotchange', this.syncRoving));
    this.slotObserver?.disconnect();
    this.slotObserver = undefined;
    if (this.rovingFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rovingFrame);
    this.rovingFrame = 0;
  }

  /** Focus the toolbar's active roving control. No-op when the roving group is empty. */
  @Method()
  async setFocus(): Promise<void> {
    const items = this.getItems();
    const target = this.activeItem && items.includes(this.activeItem) ? this.activeItem : this.preferredActive(items);
    target?.focus();
  }

  // ───────────────────────────── ITEM CLASSIFICATION ─────────────────────────────

  /** Self-managing composites: own Tab stop, handle their own arrow keys — never descended
   *  into, never roved (would fight their internal focus management). */
  private static readonly COMPOSITE_SELECTOR =
    'md-button-group,md-menu,[role="group"],[role="radiogroup"],[role="listbox"],[role="menu"],[role="tablist"],[role="toolbar"]';
  /** Controls that use arrow keys for themselves (text entry, value, options) or are
   *  toggles: own Tab stop, arrows pass through, never roved. */
  private static readonly INDEPENDENT_SELECTOR = [
    // NB: type="checkbox" is deliberately NOT excluded — native checkboxes are independent
    // (see the toggle comment below).
    'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="file"]):not([type="color"]):not([type="hidden"])',
    'textarea', 'select', '[contenteditable]:not([contenteditable="false"])',
    'md-text-field', 'md-select', 'md-radio',
    // md-chip/md-switch/md-checkbox render their OWN host tabindex reactively (no
    // groupTabindex hook), so roving them via setAttribute is fragile (a prop-driven
    // re-render clobbers it) and a removable md-chip exposes an inner remove <button>
    // the host tabindex can't reach. Keep them as their own Tab stops instead — safe,
    // and they don't use arrows themselves. Native checkboxes and role="checkbox" follow
    // the same rule so ALL toggles (checkbox / switch / radio, native or md-*) have the
    // same Tab semantics when mixed in one toolbar.
    'md-chip', 'md-switch', 'md-checkbox',
    // md-fab is the paired action; even if mis-slotted into the default slot it must not
    // join the roving group (it re-renders its own host tabindex on prop changes, which
    // would resurrect a stray second Tab stop). Keep it an independent stop.
    'md-fab',
    '[role="textbox"]', '[role="searchbox"]', '[role="spinbutton"]', '[role="combobox"]',
    '[role="slider"]', '[role="radio"]', '[role="checkbox"]',
  ].join(',');
  /** Simple activators that JOIN the roving group (single Tab stop, arrow-navigable).
   *  Limited to controls that rove reliably: native focusables (tabindex attribute) and
   *  md-button/md-icon-button (cooperative `groupTabindex`). */
  private static readonly ROVING_SELECTOR = [
    'button', 'a[href]', 'md-button', 'md-icon-button',
    'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
    'input[type="image"]', 'input[type="file"]', 'input[type="color"]',
    '[role="button"]', '[role="menuitem"]', '[role="link"]',
  ].join(',');
  private static readonly ANY_CONTROL_SELECTOR =
    MdToolbar.COMPOSITE_SELECTOR + ',' + MdToolbar.INDEPENDENT_SELECTOR + ',' + MdToolbar.ROVING_SELECTOR;

  private classify(el: HTMLElement): 'composite' | 'independent' | 'roving' | 'wrapper' {
    // Any editable region (contenteditable="", "true", "plaintext-only", or inherited)
    // uses arrows for its caret — treat as an independent Tab stop, never roved.
    if ('isContentEditable' in el && el.isContentEditable) return 'independent';
    if (el.matches(MdToolbar.COMPOSITE_SELECTOR)) return 'composite';
    if (el.matches(MdToolbar.INDEPENDENT_SELECTOR)) return 'independent';
    if (el.matches(MdToolbar.ROVING_SELECTOR)) return 'roving';
    // Only a NON-negative tabindex makes a bare element a roving leaf; an explicit
    // tabindex="-1" is the author opting a control out of the toolbar (honored in
    // isNavigable), and a negative-tabindex non-control descends as a wrapper.
    if (el.matches('[tabindex]:not([tabindex^="-"])')) {
      // A bare tabbable element is a leaf control UNLESS it wraps real controls
      // (e.g. a tabbable scroll region) — then descend so the inner controls rove.
      return el.querySelector(MdToolbar.ANY_CONTROL_SELECTOR) ? 'wrapper' : 'roving';
    }
    return 'wrapper';
  }

  /** An element whose AUTHOR tabindex is negative has opted out of the toolbar's tab
   *  order — honor it (don't promote it to a roving Tab stop). Only applies to plain/
   *  native controls: md-* components manage their own tabindex via `groupTabindex`, so
   *  the tabindex attribute we (or they) render is not an author opt-out signal. Reads
   *  the pre-roving original from the roved map so our own −1 stamps don't count. */
  private optedOut(el: HTMLElement): boolean {
    if ('groupTabindex' in el) return false;
    const rec = this.roved.get(el);
    const ti = rec && rec.kind === 'attr' ? rec.orig : el.getAttribute('tabindex');
    return ti !== null && ti.trim() !== '' && parseInt(ti, 10) < 0;
  }

  private slotOf(el: Element): 'leading' | 'default' | 'trailing' | 'fab' {
    const s = el.getAttribute('slot');
    if (s === 'leading') return 'leading';
    if (s === 'trailing') return 'trailing';
    if (s === 'fab') return 'fab';
    return 'default';
  }

  private slotPriority(el: Element): number {
    const s = this.slotOf(el);
    return s === 'leading' ? 0 : s === 'trailing' ? 2 : s === 'fab' ? 3 : 1;
  }

  /** Layout-aware visibility. Uses checkVisibility where available; otherwise falls back to
   *  computed display/visibility (real browsers) and assumes visible in no-layout SSR/spec. */
  private isVisible(el: HTMLElement): boolean {
    const cv = (el as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
    if (typeof cv === 'function') return cv.call(el, { checkVisibilityCSS: true });
    if (typeof getComputedStyle !== 'function') return true;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.visibility !== 'collapse';
  }

  /** aria-hidden="true" on the element or a wrapper BETWEEN it and the toolbar host
   *  (does not walk above the host — a hidden region containing the whole toolbar is the
   *  app's concern, not a per-item exclusion). */
  private ariaHiddenWithin(el: HTMLElement): boolean {
    let n: HTMLElement | null = el;
    while (n && n !== this.el) {
      if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true;
      n = n.parentElement;
    }
    return false;
  }

  /** A roving-group member: visible, not hard-disabled, not opted-out, not aria-hidden.
   *  A soft-disabled (aria-disabled) control IS a member — it is roved like any other so it
   *  never leaks a stray extra Tab stop, AND stays arrow-reachable so it is discoverable
   *  (WAI-ARIA APG explicitly allows focus to move to disabled toolbar items). Hard-disabled
   *  native controls are not focusable at all, so they are excluded entirely. */
  private isNavigable(el: HTMLElement): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden) return false;
    if (el.hasAttribute('disabled')) return false;
    if ('disabled' in el && (el as unknown as { disabled?: boolean }).disabled === true) return false;
    if (this.optedOut(el)) return false;
    if (this.ariaHiddenWithin(el)) return false;
    return this.isVisible(el);
  }

  /** Collect roving-group members from a slotted subtree: descend through plain wrappers,
   *  stop at composites/independent controls (their own Tab stops), collect roving leaves. */
  private collectRoving(el: HTMLElement, out: HTMLElement[]) {
    const kind = this.classify(el);
    if (kind === 'composite' || kind === 'independent') return; // own Tab stop — leave alone
    if (kind === 'roving') {
      if (this.isNavigable(el) && !out.includes(el)) out.push(el);
      return;
    }
    // wrapper → descend into element children
    for (const child of Array.from(el.children) as HTMLElement[]) this.collectRoving(child, out);
  }

  /** The default active Tab stop prefers an ENABLED control so Tab does not land on a
   *  soft-disabled one first, while arrows can still reach the disabled members. */
  private preferredActive(items: HTMLElement[]): HTMLElement | undefined {
    return items.find((el) => el.getAttribute('aria-disabled') !== 'true') ?? items[0];
  }

  /**
   * The roving group in visual order (leading → default → trailing), EXCLUDING the FAB.
   * Derived from light-DOM children (works in spec + browser; slot.assignedElements is
   * unreliable in the spec mock).
   */
  private getItems(): HTMLElement[] {
    const children = (Array.from(this.el.children) as HTMLElement[]).filter((c) => this.slotOf(c) !== 'fab');
    const docOrder = new Map<Element, number>();
    children.forEach((c, i) => docOrder.set(c, i));
    children.sort((a, b) => {
      const pa = this.slotPriority(a);
      const pb = this.slotPriority(b);
      if (pa !== pb) return pa - pb;
      return (docOrder.get(a) ?? 0) - (docOrder.get(b) ?? 0);
    });

    const items: HTMLElement[] = [];
    for (const child of children) this.collectRoving(child, items);
    return items;
  }

  // ───────────────────────────── ROVING TABINDEX ─────────────────────────────

  private applyRoving(el: HTMLElement, active: boolean) {
    if ('groupTabindex' in el) {
      if (!this.roved.has(el)) this.roved.set(el, { kind: 'group', orig: null });
      (el as unknown as { groupTabindex: number }).groupTabindex = active ? 0 : -1;
    } else {
      if (!this.roved.has(el)) this.roved.set(el, { kind: 'attr', orig: el.getAttribute('tabindex') });
      el.setAttribute('tabindex', active ? '0' : '-1');
    }
  }

  private restoreOne(el: HTMLElement) {
    const rec = this.roved.get(el);
    if (!rec) return;
    if (rec.kind === 'group') {
      try { (el as unknown as { groupTabindex: number | null }).groupTabindex = null; } catch { /* detached */ }
    } else if (rec.orig === null) {
      el.removeAttribute('tabindex');
    } else {
      el.setAttribute('tabindex', rec.orig);
    }
    this.roved.delete(el);
  }

  private clearRoving() {
    for (const el of Array.from(this.roved.keys())) this.restoreOne(el);
  }

  /**
   * Designate ONE roving-group member as its single Tab stop and make the rest untabbable.
   * Text-entry controls and composites are never touched (they keep their own Tab stop).
   * `generic` mode does not rove at all.
   */
  private updateRoving() {
    if (this.containerSemantics !== 'toolbar') {
      this.clearRoving();
      return;
    }
    const items = this.getItems();
    // Restore any previously-roved element no longer a member (removed, hidden, disabled).
    for (const el of Array.from(this.roved.keys())) {
      if (!items.includes(el)) this.restoreOne(el);
    }
    if (items.length === 0) {
      this.activeItem = null;
      return;
    }
    const active =
      this.activeItem && items.includes(this.activeItem) ? this.activeItem : this.preferredActive(items);
    this.activeItem = active ?? null;
    for (const el of items) this.applyRoving(el, el === active);
  }

  private handleFocusIn(ev: FocusEvent) {
    if (this.containerSemantics !== 'toolbar') return;
    const items = this.getItems();
    const item = this.resolveItem(ev.target, items);
    if (!item || item === this.activeItem) return;
    this.activeItem = item;
    for (const el of items) this.applyRoving(el, el === item);
  }

  // ───────────────────────────── KEYBOARD ─────────────────────────────

  /** Map an event target to the roving-group item that contains it (null if the focus is
   *  on an independent control / composite / outside the group). */
  private resolveItem(target: EventTarget | null, items: HTMLElement[]): HTMLElement | null {
    const node = target as Node | null;
    if (!node) return null;
    for (const it of items) {
      if (it === node || it.contains(node)) return it;
    }
    return null;
  }

  /**
   * Tab enters/leaves the roving group as a single stop. Arrow keys / Home / End move focus
   * between roving-group members. When focus is on an independent control (text field, select,
   * range, composite) it is NOT in the group, so arrows pass through untouched — caret movement,
   * text selection, value adjustment, and the composite's own arrow handling keep working.
   * Activation stays with each control (Space / Enter).
   */
  private handleKeyDown(ev: KeyboardEvent) {
    if (this.containerSemantics !== 'toolbar') return;
    if (ev.defaultPrevented) return;
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const key = ev.key;
    const isNavKey =
      key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown' ||
      key === 'Home' || key === 'End';
    if (!isNavKey) return;

    const items = this.getItems();
    if (items.length === 0) return;
    const current = this.resolveItem(ev.target, items);
    if (!current) return; // focus is on an independent control — do not hijack

    const vertical = this.variant === 'floating' && this.layout === 'vertical';
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this.el).direction === 'rtl';

    let delta = 0;
    if (vertical) {
      if (key === 'ArrowDown') delta = 1;
      else if (key === 'ArrowUp') delta = -1;
    } else {
      if (key === 'ArrowRight') delta = rtl ? -1 : 1;
      else if (key === 'ArrowLeft') delta = rtl ? 1 : -1;
    }

    let nextIdx: number;
    if (key === 'Home') {
      nextIdx = 0;
    } else if (key === 'End') {
      nextIdx = items.length - 1;
    } else if (delta !== 0) {
      const idx = items.indexOf(current);
      nextIdx = (idx + delta + items.length) % items.length;
    } else {
      return; // off-axis arrow (e.g. ArrowUp on a horizontal toolbar) — leave it alone
    }

    const next = items[nextIdx];
    if (!next) return;
    ev.preventDefault();
    if (next !== current) {
      this.activeItem = next;
      for (const el of items) this.applyRoving(el, el === next);
      next.focus();
    }
  }

  render() {
    const isFloating = this.variant === 'floating';
    const isVertical = isFloating && this.layout === 'vertical';

    const isToolbar = this.containerSemantics === 'toolbar';
    // Null-safe: componentWillLoad may remove a blank aria-label attribute, which
    // resets the mapped prop to null.
    const labelledby = (this.ariaLabelledby ?? '').trim();
    const label = (this.ariaLabelProp ?? '').trim();
    // Naming attributes are AUTHOR-owned and rendered as a pure function of their props
    // in BOTH modes — a value emitted in only one mode would be vdom-removed by the other,
    // which used to destroy the author's aria-label on a toolbar→generic→toolbar round
    // trip when both attributes were set. No precedence-stripping either: when both are
    // present, the ARIA accname algorithm itself prefers aria-labelledby, so removing
    // aria-label was never needed. Only component-OWNED ARIA (role, aria-orientation)
    // is mode-dependent; AT ignores names on generic containers (dev warning explains).
    const ariaLabel = label.length > 0 ? this.ariaLabelProp : undefined;
    const ariaLabelledbyOut = labelledby.length > 0 ? this.ariaLabelledby : undefined;
    const ariaOrientation = isToolbar ? (isVertical ? 'vertical' : 'horizontal') : undefined;

    return (
      <Host
        class={{
          'md-toolbar': true,
          [`md-toolbar--${this.variant}`]: true,
          [`md-toolbar--${this.color}`]: true,
          [`md-toolbar--${this.layout}`]: isFloating,
          [`md-toolbar--align-${this.alignment}`]: true,
          'md-toolbar--vertical': isVertical,
          'md-toolbar--generic': !isToolbar,
        }}
        role={isToolbar ? 'toolbar' : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledbyOut}
        aria-orientation={ariaOrientation}
      >
        <div class="md-toolbar__container" part="container">
          <slot name="leading"></slot>
          <slot></slot>
          <slot name="trailing"></slot>
        </div>
        <div
          class={{
            'md-toolbar__fab-container': true,
            'md-toolbar__fab-container--floating': isFloating,
            'md-toolbar__fab-container--hidden': !this.hasFab,
          }}
          part="fab-container"
        >
          <slot name="fab"></slot>
        </div>
      </Host>
    );
  }
}

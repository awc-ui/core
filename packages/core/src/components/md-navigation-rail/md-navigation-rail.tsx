import {
  Component,
  Host,
  h,
  Prop,
  Event,
  EventEmitter,
  Element,
  State,
  Watch,
  Listen,
  Method,
} from '@stencil/core';

/**
 * Material Design 3 — Navigation Rail
 *
 * A vertical navigation surface for the left or right edge of medium / large
 * window sizes. Holds 3–7 top-level destinations and optionally a header
 * (menu / brand), a FAB, and a footer.
 *
 * Implements MD3 specs:
 *   - https://m3.material.io/components/navigation-rail/overview
 *   - https://m3.material.io/components/navigation-rail/specs
 *   - https://m3.material.io/components/navigation-rail/guidelines
 *   - https://m3.material.io/components/navigation-rail/accessibility
 */
@Component({
  tag: 'md-navigation-rail',
  styleUrl: 'md-navigation-rail.css',
  shadow: true,
})
export class MdNavigationRail {
  @Element() el!: HTMLElement;

  /**
   * Visual variant — `standard` (the spec's *collapsed* rail: 80px wide,
   * stacked icon + label) or `expanded` (icons + label inline, 220–360px wide).
   */
  @Prop({ mutable: true, reflect: true }) variant: 'standard' | 'expanded' = 'standard';

  /**
   * Modal styling for the expanded variant per spec: `surface-container`
   * background, level-2 elevation, large corner shape. Use when the expanded
   * rail floats over content instead of being docked; positioning and the
   * scrim are the host app's responsibility. No effect while collapsed.
   */
  @Prop({ reflect: true }) modal: boolean = false;

  /**
   * Stretch the rail to the full viewport height (`100dvh`) instead of filling
   * its parent container. Opt-in: by default the rail fills whatever height its
   * container gives it (`100%`), which keeps it embeddable in split-pane /
   * nested / modal-docked layouts. Set this when the rail is the app's
   * top-level side navigation and should always span the screen.
   */
  @Prop({ reflect: true, attribute: 'full-height' }) fullHeight: boolean = false;

  /** Vertical alignment of destinations relative to the rail. */
  @Prop({ reflect: true }) alignment: 'top' | 'middle' | 'bottom' = 'top';

  /**
   * Render a built-in leading menu button that toggles between the collapsed
   * (`standard`) and `expanded` variants. The icon animates between `menu`
   * (collapsed) and `menu_open` (expanded) per the MD3 navigation rail figure.
   * When you'd rather supply your own control, leave this `false` and place a
   * button in the `header` slot wired to the `expand()` / `collapse()` /
   * `toggle()` methods.
   */
  @Prop({ reflect: true }) expandable: boolean = false;

  /**
   * Accessible label for the built-in toggle button (only rendered when
   * `expandable` is set). Announced to assistive tech as the button's name.
   */
  @Prop({ attribute: 'toggle-label' }) toggleLabel: string = 'Toggle navigation';

  /**
   * Controls whether destination labels are shown.
   *  - `all`: every destination shows its label (default — recommended by MD3 for 3–7 destinations)
   *  - `selected`: only the active destination shows its label
   *  - `none`: icons only
   */
  @Prop({ reflect: true, attribute: 'label-visibility' })
  labelVisibility: 'all' | 'selected' | 'none' = 'all';

  /**
   * Index of the currently active destination. -1 means no destination is
   * active. Two-way bound: updates when the user selects a destination and
   * can be set externally to programmatically change the active destination.
   */
  @Prop({ mutable: true, reflect: true, attribute: 'active-index' })
  activeIndex: number = -1;

  /**
   * Accessible name announced for the rail's `navigation` landmark.
   * Required for screen reader users (WAI-ARIA APG / WCAG 2.4.1).
   */
  @Prop() label: string = 'Navigation';

  /**
   * Set to `true` to disable focus management (roving tabindex + arrow keys).
   * Use when embedding inside a custom focus management system.
   */
  @Prop() disableFocusManagement: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emitted when the user selects a destination. */
  @Event() mdTabChange: EventEmitter<{ index: number; value: string }>;

  /** Emitted when the rail transitions from collapsed → expanded. */
  @Event() mdExpand: EventEmitter<void>;

  /** Emitted when the rail transitions from expanded → collapsed. */
  @Event() mdCollapse: EventEmitter<void>;

  @State() private hasLogo = false;
  @State() private hasLogoExpanded = false;
  @State() private hasHeader = false;
  @State() private hasFab = false;
  @State() private hasFooter = false;

  /**
   * True when one or more destinations render as links (`href` set). A `tablist`
   * may only contain `tab` children per ARIA, so when destinations are links the
   * container drops its `tablist` semantics and is just a grouping element inside
   * the `navigation` landmark.
   */
  @State() private hasLinkDestinations = false;
  @State() private overflowCount = 0;
  /** True while any destination's dropdown is open — lifts the rail's stacking
   *  context so the fixed-position menu is not trapped inside it. */
  @State() private submenuOpen = false;

  /**
   * Drives the *destination layout* (stacked vs. inline) independently of the
   * rail's own width. On expand it flips with the width so labels reveal as the
   * rail grows; on collapse it lingers in the inline layout until the width
   * animation has finished, then drops to the stacked resting layout — keeping
   * the label reveal/conceal in sync with the width instead of snapping.
   */
  @State() private tabsExpanded = false;

  /** Programmatically expand the rail (shows labels inline with icons). */
  @Method()
  async expand(): Promise<void> {
    if (this.variant !== 'expanded') {
      this.variant = 'expanded';
    }
  }

  /** Programmatically collapse the rail (standard 80px width). */
  @Method()
  async collapse(): Promise<void> {
    if (this.variant !== 'standard') {
      this.variant = 'standard';
    }
  }

  /** Toggle between expanded and standard. */
  @Method()
  async toggle(): Promise<void> {
    this.variant = this.variant === 'expanded' ? 'standard' : 'expanded';
  }

  /** Move keyboard focus to the destination at `index`. */
  @Method()
  async focusTab(index: number): Promise<void> {
    const tabs = this.getTabs();
    const target = tabs[index];
    if (target) {
      this.setRovingTabindex(index);
      target.focus();
    }
  }

  componentWillLoad() {
    this.tabsExpanded = this.variant === 'expanded';
    /*
     * Seed the slot-presence flags from the light DOM BEFORE the first render —
     * the same technique the active-tab adoption below already uses. They used
     * to be written only by each slot's `slotchange`, which fires after first
     * render, so every rail's first painted frame had no `--with-fab` host
     * class, a `hidden` FAB wrapper, and no header-space padding on the
     * destinations. Measured on a cold load: the destinations painted at y=114
     * and dropped to y=213 one frame later when the band opened — a 99px shift
     * on every load, which a consumer could only pre-pad from outside with
     * hand copies of this component's internal expressions. Whether a slot is
     * filled is a fact of the light DOM and is readable here; `slotchange`
     * still owns every later change.
     */
    // Direct-children iteration rather than `:scope >` — same pattern as the
    // active-tab adoption below, and mock-doc's selector engine has no :scope.
    const slotted = (name: string) =>
      Array.from(this.el.children).some((child) => child.getAttribute('slot') === name);
    this.hasLogo = slotted('logo');
    this.hasLogoExpanded = slotted('logo-expanded');
    this.hasHeader = slotted('header');
    this.hasFab = slotted('fab');
    this.hasFooter = slotted('footer');
    // Adopt a pre-marked destination: authors can write `active` directly on a
    // child tab instead of `active-index` on the rail. This MUST run before the
    // first slotchange-driven syncTabs(), which (with activeIndex still -1)
    // would clear the child's `active` attribute before we could read it. Read
    // the light-DOM children directly since the shadow slot isn't assigned yet.
    if (this.activeIndex < 0) {
      const tabs = Array.from(this.el.children).filter(
        (el) => el.tagName.toLowerCase() === 'md-navigation-rail-tab',
      );
      const marked = tabs.findIndex((t) => t.hasAttribute('active'));
      if (marked >= 0) this.activeIndex = marked;
    }
  }

  componentDidLoad() {
    this.syncTabs();
    this.syncFab();
    this.wireSlottedMenus();
  }

  @Watch('variant')
  onVariantChange(newVal: 'standard' | 'expanded', oldVal: 'standard' | 'expanded') {
    if (newVal === oldVal) return;
    if (newVal === 'expanded') this.mdExpand.emit();
    else this.mdCollapse.emit();

    // Switch the destination layout immediately in both directions (modal and
    // standard alike). Each tab glides its icon + label to the new layout, the
    // FAB morphs, and — for modal — the overlay container grows/shrinks and the
    // scrim fades, all driven by CSS transitions on the same spring (see the
    // modal section of the stylesheet). No JS deferral needed.
    this.tabsExpanded = newVal === 'expanded';
    this.syncTabs();
    this.syncFab();
  }

  /**
   * Mirror the rail's expanded state onto a slotted FAB's `extended` prop so it
   * morphs between the extended (icon + label) and icon-only forms. No-op for
   * slotted content that doesn't expose `extended`.
   */
  private syncFab() {
    const slot = this.el.shadowRoot?.querySelector(
      'slot[name="fab"]',
    ) as HTMLSlotElement | null;
    slot?.assignedElements().forEach((el) => {
      this.setProp(el as HTMLElement, 'extended', this.variant === 'expanded');
    });
  }

  @Watch('labelVisibility')
  onLabelVisibilityChange() {
    this.syncTabs();
  }

  @Watch('activeIndex')
  onActiveIndexChange() {
    this.syncTabs();
  }

  @Listen('mdTabClick')
  handleTabClick(e: CustomEvent<{ value: string }>) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tabs = this.getTabs();
    const index = tabs.indexOf(target);
    if (index < 0) return;

    if (this.isTabDisabled(target)) {
      e.stopPropagation();
      return;
    }

    // `mdTabClick` (from the tab) fires on every activation — including
    // re-clicking the already-active destination (which replays the ripple).
    // `mdTabChange` is the higher-level *selection changed* event, so only
    // emit it when the active index actually moves.
    const changed = index !== this.activeIndex;
    this.activeIndex = index;
    this.setRovingTabindex(index);
    this.clearOtherSubmenuSelections(target);
    if (changed) {
      this.mdTabChange.emit({ index, value: e.detail?.value ?? '' });
    }
  }

  /**
   * A destination whose dropdown row is chosen wears the same pill as the
   * active one, so a stale selection in *another* dropdown reads as a second
   * active destination. Only one destination can be current, so activating any
   * of them clears the rest.
   */
  private clearOtherSubmenuSelections(active: HTMLElement | null) {
    this.getTabs().forEach((tab) => {
      if (tab === active) return;
      const clear = (tab as HTMLMdNavigationRailTabElement).clearSubmenuSelection;
      if (typeof clear === 'function') void clear.call(tab);
    });
  }

  private isTabDisabled(tab: HTMLElement): boolean {
    // A destination collapsed into the overflow menu is no longer in the rail,
    // so arrow keys must skip it exactly as they skip a disabled one.
    return (
      tab.hasAttribute('disabled') ||
      tab.getAttribute('aria-disabled') === 'true' ||
      tab.hasAttribute('data-overflowed')
    );
  }

  private getTabs(): HTMLElement[] {
    const slot = this.el.shadowRoot?.querySelector(
      'slot:not([name])',
    ) as HTMLSlotElement | null;
    if (!slot) return [];
    return slot
      .assignedElements()
      .filter((el) => el.tagName.toLowerCase() === 'md-navigation-rail-tab') as HTMLElement[];
  }

  private syncTabs() {
    const tabs = this.getTabs();
    // Detect link-style destinations so the container can shed its invalid
    // `tablist` role (a tablist must only contain `tab` children).
    this.hasLinkDestinations = tabs.some(
      (tab) => !!(tab as HTMLElement & { href?: string }).href || !!tab.getAttribute('href'),
    );
    tabs.forEach((tab, i) => {
      const active = i === this.activeIndex;
      this.setProp(tab, 'active', active);
      this.setProp(tab, 'labelVisibility', this.labelVisibility);
      this.setProp(tab, 'expanded', this.tabsExpanded);
      // The tab styles its own indicator, and shadow DOM keeps the rail out of
      // it — so hand the axis down as an attribute it can key off.
      tab.setAttribute('data-orientation', this.orientation);

      if (!this.disableFocusManagement) {
        const focusable = !this.isTabDisabled(tab);
        const isRoving =
          (this.activeIndex >= 0 && active) ||
          (this.activeIndex < 0 && i === tabs.findIndex((t) => !this.isTabDisabled(t)));
        tab.tabIndex = focusable && isRoving ? 0 : -1;
      }
    });

    // Recompute the overflow set from every sync path, not just slotchange.
    this.applyOverflow();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setProp(el: HTMLElement, key: string, value: any) {
    try {
      (el as any)[key] = value;
    } catch {
      /* property may not be defined yet */
    }
  }

  private setRovingTabindex(index: number) {
    if (this.disableFocusManagement) return;
    const tabs = this.getTabs();
    tabs.forEach((tab, i) => {
      tab.tabIndex = i === index && !this.isTabDisabled(tab) ? 0 : -1;
    });
  }

  /**
   * Layout axis.
   *
   * - `vertical` (default) — the MD3 rail: a fixed-width column on the leading
   *   edge.
   * - `horizontal` — the same parts laid out as a top-of-page bar: logo
   *   leading, destinations in a row, FAB and footer trailing. For wide layouts
   *   where a side rail would spend width the content wants.
   *
   * The expand/collapse affordance is vertical-only — a bar has nowhere to grow
   * — so `expandable` is ignored while horizontal.
   */
  @Prop({ reflect: true }) orientation: 'vertical' | 'horizontal' = 'vertical';

  /**
   * Cap on how many destinations stay in the rail. Any beyond it collapse into
   * an overflow trigger that opens a menu of the rest; choosing one activates
   * that destination. Leave unset for no overflow.
   *
   * The trigger is a `button` with `aria-haspopup="menu"`, deliberately OUTSIDE
   * the `tablist` — a tablist may only contain tabs.
   */
  @Prop({ attribute: 'max-visible' }) maxVisible?: number;

  /** Accessible name and label for the overflow trigger. Localize per page. */
  @Prop({ attribute: 'overflow-label' }) overflowLabel: string = 'More';

  /** Material Symbols ligature for the overflow trigger. */
  @Prop({ attribute: 'overflow-icon' }) overflowIcon: string = 'more_horiz';

  /** Nearest explicit `dir`, matching md-button-group / md-sub-menu-item. */
  private resolveDirection(): 'ltr' | 'rtl' {
    let node: HTMLElement | null = this.el;
    while (node) {
      const dir = node.getAttribute?.('dir');
      if (dir === 'rtl' || dir === 'ltr') return dir;
      node = node.parentElement;
    }
    return 'ltr';
  }

  // md-menu's own mdOpen/mdClose are non-bubbling and non-composed, so the rail
  // listens for the destination's re-announcement instead.
  @Listen('mdSubmenuToggle')
  onDescendantSubmenuToggle(e: CustomEvent<{ open: boolean }>) {
    this.submenuOpen = e.detail?.open ? true : this.anyMenuOpen();
  }

  /**
   * A menu can also be slotted straight into the rail — an account avatar in
   * the `footer` that opens a dropdown, say. That menu is not owned by a
   * destination, so it never emits `mdSubmenuToggle`, and without this the
   * rail keeps its `isolation: isolate` and the page paints straight over the
   * open menu. Listening on the element itself is the only option: md-menu's
   * own events are non-bubbling and non-composed.
   */
  private wiredMenus = new WeakSet<Element>();

  private wireSlottedMenus() {
    this.el.querySelectorAll('md-menu').forEach((menu) => {
      if (this.wiredMenus.has(menu)) return;
      this.wiredMenus.add(menu);
      menu.addEventListener('mdOpen', this.handleSlottedMenuOpen);
      menu.addEventListener('mdClose', this.handleSlottedMenuClose);
    });
  }

  private handleSlottedMenuOpen = () => {
    this.submenuOpen = true;
  };

  private handleSlottedMenuClose = () => {
    this.submenuOpen = this.anyMenuOpen();
  };

  /**
   * Read the `open` *property*, never the `[open]` attribute: reflection lands
   * a tick after the menu emits `mdOpen`, so an attribute query run from that
   * handler reports every menu closed and stamps the rail shut again.
   */
  private anyMenuOpen(): boolean {
    return Array.from(this.el.querySelectorAll('md-menu')).some(
      (menu) => (menu as HTMLMdMenuElement).open,
    );
  }

  private overflowId = `md-rail-overflow-${Math.random().toString(36).slice(2, 9)}`;

  /** Destinations pushed past `max-visible`, in author order. */
  private get overflowedTabs(): HTMLElement[] {
    const cap = this.maxVisible;
    const tabs = this.getTabs();
    if (!cap || cap < 1 || tabs.length <= cap) return [];
    return tabs.slice(cap);
  }

  /** Mark the collapsed destinations so CSS hides them and nav skips them. */
  private applyOverflow() {
    const overflowed = this.overflowedTabs;
    const set = new Set(overflowed);
    this.getTabs().forEach((tab) => {
      if (set.has(tab)) tab.setAttribute('data-overflowed', '');
      else tab.removeAttribute('data-overflowed');
    });
    this.overflowCount = overflowed.length;
  }

  @Watch('maxVisible')
  onMaxVisibleChange() {
    this.applyOverflow();
  }

  private overflowMenu(): (HTMLElement & { show(): Promise<void>; close(): Promise<void>; open: boolean }) | null {
    return this.el.shadowRoot?.querySelector('md-menu') as never;
  }

  private toggleOverflow = () => {
    const menu = this.overflowMenu();
    if (!menu) return;
    if (menu.open) void menu.close();
    else void menu.show();
  };

  private selectOverflowed(tab: HTMLElement) {
    // NOT by re-dispatching mdTabClick: a collapsed destination reads as
    // disabled (so arrow keys skip it), and handleTabClick drops clicks from
    // disabled tabs. Drive the selection directly instead.
    const index = this.getTabs().indexOf(tab);
    if (index < 0) return;
    const changed = index !== this.activeIndex;
    this.activeIndex = index;
    this.setRovingTabindex(index);
    this.clearOtherSubmenuSelections(tab);
    if (changed) {
      this.mdTabChange.emit({ index, value: tab.getAttribute('value') ?? '' });
    }
    void this.overflowMenu()?.close();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Escape dismisses the modal overlay (standard modal behaviour).
    if (e.key === 'Escape' && this.modal && this.variant === 'expanded') {
      e.preventDefault();
      this.collapse();
      this.focusToggle();
      return;
    }
    if (this.disableFocusManagement) return;
    const tabs = this.getTabs().filter((t) => !this.isTabDisabled(t));
    if (tabs.length === 0) return;

    const current = e.composedPath().find((node) => {
      return node instanceof HTMLElement && tabs.includes(node);
    }) as HTMLElement | undefined;
    const currentIndex = current ? tabs.indexOf(current) : -1;

    let nextIndex: number | null = null;

    // A horizontal rail reads along the inline axis, so Left/Right must follow
    // the writing direction — in RTL, ArrowRight moves toward the START.
    const rtl = this.orientation === 'horizontal' && this.resolveDirection() === 'rtl';
    const forward = (key: string) =>
      key === 'ArrowDown' || (rtl ? key === 'ArrowLeft' : key === 'ArrowRight');
    const backward = (key: string) =>
      key === 'ArrowUp' || (rtl ? key === 'ArrowRight' : key === 'ArrowLeft');

    switch (true) {
      case forward(e.key):
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
        break;
      case backward(e.key):
        nextIndex = currentIndex < 0 ? tabs.length - 1 : (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case e.key === 'Home':
        nextIndex = 0;
        break;
      case e.key === 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const target = tabs[nextIndex!];
    if (!target) return;
    const allTabs = this.getTabs();
    this.setRovingTabindex(allTabs.indexOf(target));
    target.focus();
  };

  private handleToggleClick = () => {
    this.toggle();
  };

  /** Dismiss the modal overlay when its scrim is clicked. */
  private handleScrimClick = () => {
    if (this.modal && this.variant === 'expanded') {
      this.collapse();
      this.focusToggle();
    }
  };

  /** Return focus to the built-in toggle after a modal dismiss (a11y). */
  private focusToggle() {
    const toggle = this.el.shadowRoot?.querySelector(
      '.md-navigation-rail__toggle-button',
    ) as HTMLElement | null;
    toggle?.focus();
  }

  private handleSlotChange = () => {
    this.syncTabs();
  };

  private handleLogoSlotChange = (e: Event) => {
    this.hasLogo = (e.target as HTMLSlotElement).assignedElements().length > 0;
  };

  private handleLogoExpandedSlotChange = (e: Event) => {
    this.hasLogoExpanded = (e.target as HTMLSlotElement).assignedElements().length > 0;
  };

  private handleHeaderSlotChange = (e: Event) => {
    this.hasHeader = (e.target as HTMLSlotElement).assignedElements().length > 0;
  };

  private handleFabSlotChange = (e: Event) => {
    this.hasFab = (e.target as HTMLSlotElement).assignedElements().length > 0;
    this.syncFab();
  };

  private handleFooterSlotChange = (e: Event) => {
    this.hasFooter = (e.target as HTMLSlotElement).assignedElements().length > 0;
    this.wireSlottedMenus();
  };

  render() {
    return (
      <Host
        class={{
          'md-navigation-rail': true,
          [`md-navigation-rail--${this.variant}`]: true,
          'md-navigation-rail--tabs-expanded': this.tabsExpanded,
          'md-navigation-rail--horizontal': this.orientation === 'horizontal',
          'md-navigation-rail--submenu-open': this.submenuOpen,
          'md-navigation-rail--modal': this.modal,
          'md-navigation-rail--full-height': this.fullHeight,
          [`md-navigation-rail--align-${this.alignment}`]: true,
          [`md-navigation-rail--labels-${this.labelVisibility}`]: true,
          'md-navigation-rail--with-logo': this.hasLogo || this.hasLogoExpanded,
          'md-navigation-rail--with-logo-expanded': this.hasLogoExpanded,
          'md-navigation-rail--with-header': this.hasHeader,
          'md-navigation-rail--with-fab': this.hasFab,
          'md-navigation-rail--with-footer': this.hasFooter,
        }}
        role="navigation"
        aria-label={this.label}
        onKeyDown={this.handleKeyDown}
      >
        {/* Scrim — only interactive/visible when the rail is a modal overlay
            (modal + expanded). Clicking it collapses the rail. */}
        <div
          class="md-navigation-rail__scrim"
          part="scrim"
          aria-hidden="true"
          onClick={this.handleScrimClick}
        ></div>

        <div class="md-navigation-rail__container" part="container">
          {/* Logo / brand — topmost slot. Two variants cross-fade IN PLACE (no
              drift): `logo` is the contracted mark (centred, shown collapsed),
              `logo-expanded` is the full mark (leading, shown expanded). If only
              `logo` is provided it shows in both states. */}
          <div
            class="md-navigation-rail__logo"
            part="logo"
            hidden={!this.hasLogo && !this.hasLogoExpanded}
          >
            <span class="md-navigation-rail__logo-contracted" part="logo-contracted">
              <slot name="logo" onSlotchange={this.handleLogoSlotChange} />
            </span>
            <span class="md-navigation-rail__logo-expanded" part="logo-expanded">
              <slot name="logo-expanded" onSlotchange={this.handleLogoExpandedSlotChange} />
            </span>
          </div>

          {this.expandable && this.orientation === 'vertical' && (
            <div class="md-navigation-rail__toggle" part="toggle">
              <md-icon-button
                class="md-navigation-rail__toggle-button"
                icon={this.variant === 'expanded' ? 'menu_open' : 'menu'}
                aria-label={this.toggleLabel}
                aria-expanded={this.variant === 'expanded' ? 'true' : 'false'}
                onClick={this.handleToggleClick}
              ></md-icon-button>
            </div>
          )}

          <div class="md-navigation-rail__header" part="header" hidden={!this.hasHeader}>
            <slot name="header" onSlotchange={this.handleHeaderSlotChange} />
          </div>

          <div class="md-navigation-rail__fab" part="fab" hidden={!this.hasFab}>
            <slot name="fab" onSlotchange={this.handleFabSlotChange} />
          </div>

          <div
            class="md-navigation-rail__destinations"
            part="destinations"
            role={this.hasLinkDestinations ? undefined : 'tablist'}
            aria-orientation={this.hasLinkDestinations ? undefined : this.orientation}
            aria-label={this.hasLinkDestinations ? undefined : this.label}
          >
            <slot onSlotchange={this.handleSlotChange} />
          </div>

          {this.overflowCount > 0 && (
            <div class="md-navigation-rail__overflow" part="overflow">
              <button
                id={this.overflowId}
                type="button"
                class="md-navigation-rail__overflow-trigger"
                part="overflow-trigger"
                aria-haspopup="menu"
                aria-label={this.overflowLabel}
                onClick={this.toggleOverflow}
              >
                <span class="material-symbols-outlined md-navigation-rail__overflow-icon" aria-hidden="true">
                  {this.overflowIcon}
                </span>
                <span class="md-navigation-rail__overflow-label">{this.overflowLabel}</span>
              </button>
              {/* md-menu resolves `anchor` against its own root first, so an id
                  inside this shadow root is enough. */}
              {/* The trigger sits at the END of the destinations, so a vertical
                  rail opens UPWARD — downward would run off the bottom of a
                  bounded rail and be clipped. */}
              <md-menu
                anchor={this.overflowId}
                placement={this.orientation === 'horizontal' ? 'bottom-end' : 'top-start'}
              >
                {this.overflowedTabs.map((tab) => (
                  <md-menu-item
                    key={tab.getAttribute('value') || tab.getAttribute('label') || ''}
                    headline={tab.getAttribute('label') || ''}
                    onClick={() => this.selectOverflowed(tab)}
                  >
                    {tab.getAttribute('icon') && (
                      <span slot="leading-icon" class="material-symbols-outlined">
                        {tab.getAttribute('icon')}
                      </span>
                    )}
                  </md-menu-item>
                ))}
              </md-menu>
            </div>
          )}

          <div class="md-navigation-rail__footer" part="footer" hidden={!this.hasFooter}>
            <slot name="footer" onSlotchange={this.handleFooterSlotChange} />
          </div>
        </div>
      </Host>
    );
  }
}

import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Method, Watch, Listen } from '@stencil/core';
import { FabElement } from '../../utils/types';

type FabMenuFocusableElement = HTMLElement & { rovingFocusVisible?: boolean };

const CLOSE_ANIMATION_MS = 180;
const _ITEM_STAGGER_MS = 50;
const MORPH_BACK_MS = 400;
const ICON_FADE_MS = 120;

const VARIANT_COLORS: Record<string, { bg: string; fg: string }> = {
  primary:   { bg: 'var(--md-sys-color-primary)',   fg: 'var(--md-sys-color-on-primary)' },
  secondary: { bg: 'var(--md-sys-color-secondary)', fg: 'var(--md-sys-color-on-secondary)' },
  tertiary:  { bg: 'var(--md-sys-color-tertiary)',  fg: 'var(--md-sys-color-on-tertiary)' },
};

let fabMenuIdCounter = 0;

@Component({
  tag: 'md-fab-menu',
  styleUrl: 'md-fab-menu.css',
  shadow: true,
})
export class MdFabMenu {
  @Element() el!: HTMLElement;

  /** Whether the menu is open. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** ID of the anchor FAB element to position relative to. */
  @Prop() anchor: string = '';

  /**
   * Color set for the menu.
   * Controls the FAB's open-state color (vibrant) and item container color (softer).
   */
  @Prop({ reflect: true }) variant: 'primary' | 'secondary' | 'tertiary' = 'primary';

  /**
   * Direction items fan out from the FAB.
   * - 'up': items stack above the FAB (default, standard bottom-right placement)
   * - 'down': items stack below the FAB
   * - 'auto': detect based on available viewport space
   */
  @Prop({ reflect: true }) placement: 'up' | 'down' | 'auto' = 'up';

  /** Skip open/close animation. */
  @Prop() quick: boolean = false;

  /**
   * Accessible name for the popup itself (the `role="menu"` container).
   *
   * A prop rather than a hardcoded string, matching how every other
   * user-facing string in the library is localised: components stay
   * i18n-engine-agnostic and the consumer resolves the text from its own
   * dictionary. The default is English, so a translated app must set it.
   */
  @Prop({ attribute: 'menu-label' }) menuLabel: string = 'Actions';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the menu opens. */
  @Event() mdOpen: EventEmitter<void>;

  /** Fires when the menu closes. */
  @Event() mdClose: EventEmitter<void>;

  @State() private closing = false;
  @State() private effectivePlacement: 'up' | 'down' = 'up';

  private menuId = `md-fab-menu-${++fabMenuIdCounter}`;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private morphCleanupTimer?: ReturnType<typeof setTimeout>;
  private iconMorphTimer?: ReturnType<typeof setTimeout>;
  private focusedIndex = -1;
  /** Set when the anchor is activated via Enter/Space (cleared on pointer down). */
  private openedViaKeyboard = false;
  /** True after pointer/mouse down on the anchor until the following click completes. */
  private pointerActivated = false;
  /** Whether the anchor already held focus when a pointer activation began — a
      click on an already-focused FAB moves focus into the menu (like keyboard). */
  private anchorFocusedAtActivation = false;
  private savedIcon = '';
  /** rAF handle for the open-menu anchor tracker (see startAnchorTracking). */
  private positionRafId: number | null = null;
  /** Last anchor rect observed by the tracker; reposition only when it changes. */
  private lastAnchorRect: { top: number; left: number; right: number; bottom: number } | null =
    null;

  connectedCallback() {
    this.effectivePlacement = this.placement === 'auto' ? 'up' : this.placement;
  }

  componentDidLoad() {
    this.wireAnchor();
    if (this.open) {
      this.resolveEffectivePlacement();
      requestAnimationFrame(() => this.positionMenu());
      // Initial open=true requires the same anchor-FAB setup that
      // `@Watch('open')` does on a closed→open transition. Without
      // morphAnchorFab() here, `savedIcon` would stay '' (its default)
      // and the next close cycle would write an empty string back
      // to anchorEl.icon, leaving a blank FAB. We deliberately skip
      // mdOpen.emit() and the autofocus dance — both are interaction
      // semantics; this branch is for "already open at mount" only.
      this.updateAnchorAria(true);
      this.morphAnchorFab(true);
      this.addGlobalListeners();
      this.updateItemDelays();
      this.scheduleFocus(() => this.initRovingTabindex());
    }
  }

  disconnectedCallback() {
    this.unwireAnchor();
    this.removeGlobalListeners();
    clearTimeout(this.closeTimer);
    clearTimeout(this.morphCleanupTimer);
    clearTimeout(this.iconMorphTimer);
    clearTimeout(this.typeaheadTimer);
    this.resetAnchorFab();
  }

  @Watch('anchor')
  onAnchorChange() {
    this.unwireAnchor();
    this.wireAnchor();
  }

  @Watch('placement')
  onPlacementChange() {
    if (this.placement !== 'auto') {
      this.effectivePlacement = this.placement;
    }
  }

  @Watch('open')
  onOpenChange(open: boolean) {
    if (open) {
      this.resolveEffectivePlacement();
      requestAnimationFrame(() => this.positionMenu());
      this.mdOpen.emit();
      this.updateAnchorAria(true);
      this.morphAnchorFab(true);
      this.addGlobalListeners();
      this.updateItemDelays();
      if (this.openedViaKeyboard || this.anchorFocusedAtActivation) {
        this.scheduleFocus(() => this.focusFirstItem(3, true));
      } else {
        this.scheduleFocus(() => this.initRovingTabindex());
      }
      this.openedViaKeyboard = false;
      this.anchorFocusedAtActivation = false;
    } else {
      this.updateAnchorAria(false);
      this.morphAnchorFab(false);
      this.removeGlobalListeners();
      this.mdClose.emit();
      this.focusedIndex = -1;
      this.resetRovingTabindex();
      this.restoreFocusToAnchor();
    }
  }

  @Listen('focusin')
  handleFocusIn(e: FocusEvent) {
    if (!this.open) return;
    const target = e.target as HTMLElement;
    const items = this.getItems();
    const index = this.getItemIndex(target, items);
    if (index >= 0 && index !== this.focusedIndex) {
      if (this.focusedIndex >= 0 && this.focusedIndex < items.length) {
        items[this.focusedIndex].setAttribute('tabindex', '-1');
      }
      this.focusedIndex = index;
      target.setAttribute('tabindex', '0');
    }
    if (index >= 0) {
      this.clearRovingFocusVisible(items);
    }
  }

  /** Opens the menu programmatically. */
  @Method()
  async show() {
    clearTimeout(this.closeTimer);
    this.closing = false;
    this.open = true;
  }

  /** Closes the menu programmatically. */
  @Method()
  async close() {
    if (!this.open || this.closing) return;

    if (this.quick) {
      this.open = false;
      return;
    }

    this.closing = true;
    this.closeTimer = setTimeout(() => {
      this.closing = false;
      this.open = false;
    }, CLOSE_ANIMATION_MS);
  }

  /* ── Anchor wiring ────────────────────────────────────── */

  private getAnchorEl(): HTMLElement | null {
    return this.anchor ? document.getElementById(this.anchor) : null;
  }

  private toggleMenu() {
    if (this.open || this.closing) {
      this.close();
    } else {
      this.show();
    }
  }

  private anchorKeyHandler = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    this.openedViaKeyboard = true;

    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;

    // md-fab / md-button synthesize a click — toggle there to avoid double-toggle.
    const tag = anchorEl.tagName.toLowerCase();
    if (tag === 'md-fab' || tag === 'md-button' || tag === 'button') return;

    e.preventDefault();
    e.stopPropagation();
    this.toggleMenu();
  };

  /**
   * Keyboard-synthesized clicks (Enter/Space on buttons) have `detail === 0` and
   * no preceding pointer event. Capture-phase click runs before inline handlers.
   */
  private anchorClickHandler = (e: Event) => {
    if (!this.pointerActivated && (e as MouseEvent).detail === 0) {
      this.openedViaKeyboard = true;
    }
    this.pointerActivated = false;
    e.stopPropagation();
    this.toggleMenu();
  };

  private anchorPointerHandler = () => {
    this.pointerActivated = true;
    this.openedViaKeyboard = false;
    // Capture focus state BEFORE the click moves focus to the anchor: clicking an
    // already-focused FAB should land focus on the first menu item; a fresh mouse
    // click on an unfocused FAB should leave focus on the anchor. activeElement
    // resolves to the shadow host for custom-element anchors (e.g. md-fab).
    const anchorEl = this.getAnchorEl();
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    this.anchorFocusedAtActivation =
      !!anchorEl && !!active && (anchorEl === active || anchorEl.contains(active));
  };

  private wireAnchor() {
    this.unwireAnchor();
    if (!this.anchor || typeof document === 'undefined') return;
    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;

    anchorEl.addEventListener('keydown', this.anchorKeyHandler, true);
    anchorEl.addEventListener('click', this.anchorClickHandler, true);
    anchorEl.addEventListener('mousedown', this.anchorPointerHandler);
    anchorEl.addEventListener('pointerdown', this.anchorPointerHandler);
  }

  private unwireAnchor() {
    if (!this.anchor || typeof document === 'undefined') return;
    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;

    anchorEl.removeEventListener('keydown', this.anchorKeyHandler, true);
    anchorEl.removeEventListener('click', this.anchorClickHandler, true);
    anchorEl.removeEventListener('mousedown', this.anchorPointerHandler);
    anchorEl.removeEventListener('pointerdown', this.anchorPointerHandler);
  }

  private updateAnchorAria(open: boolean) {
    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;

    if (open) {
      anchorEl.setAttribute('aria-expanded', 'true');
      anchorEl.setAttribute('aria-haspopup', 'menu');
      anchorEl.setAttribute('aria-controls', this.menuId);
    } else {
      anchorEl.setAttribute('aria-expanded', 'false');
    }
  }

  /* ── FAB shape-morph (icon + shape + colors) ────────── */

  /**
   * Morphs the anchor FAB: shape → circle, icon cross-fades to "close",
   * colors → vibrant. Reverse on close.
   *
   * Icon cross-fade: fade-out (120ms) → swap icon → fade-in (120ms).
   */
  private morphAnchorFab(toOpen: boolean) {
    const anchorEl = this.getAnchorEl() as FabElement | null;
    if (!anchorEl) return;

    clearTimeout(this.morphCleanupTimer);
    clearTimeout(this.iconMorphTimer);

    if (toOpen) {
      this.savedIcon = anchorEl.icon || '';

      anchorEl.setAttribute('data-shape', 'circle');
      anchorEl.setAttribute('data-icon-morphing', '');

      const colors = VARIANT_COLORS[this.variant];
      if (colors) {
        anchorEl.style.setProperty('--md-fab-container-color', colors.bg);
        anchorEl.style.setProperty('--md-fab-icon-color', colors.fg);
      }

      this.iconMorphTimer = setTimeout(() => {
        anchorEl.icon = 'close';
        anchorEl.removeAttribute('data-icon-morphing');
      }, ICON_FADE_MS);

      anchorEl.addEventListener('keydown', this.handleAnchorKeyDown);
    } else {
      anchorEl.removeAttribute('data-shape');
      anchorEl.setAttribute('data-icon-morphing', '');

      anchorEl.style.removeProperty('--md-fab-container-color');
      anchorEl.style.removeProperty('--md-fab-icon-color');

      this.iconMorphTimer = setTimeout(() => {
        anchorEl.icon = this.savedIcon;
        anchorEl.removeAttribute('data-icon-morphing');
      }, ICON_FADE_MS);

      anchorEl.removeEventListener('keydown', this.handleAnchorKeyDown);

      this.morphCleanupTimer = setTimeout(() => {
        this.savedIcon = '';
      }, MORPH_BACK_MS);
    }
  }

  private resetAnchorFab() {
    const anchorEl = this.getAnchorEl() as FabElement | null;
    if (!anchorEl) return;
    clearTimeout(this.morphCleanupTimer);
    clearTimeout(this.iconMorphTimer);
    anchorEl.removeAttribute('data-shape');
    anchorEl.removeAttribute('data-icon-morphing');
    if (this.savedIcon) {
      anchorEl.icon = this.savedIcon;
      this.savedIcon = '';
    }
    anchorEl.style.removeProperty('--md-fab-container-color');
    anchorEl.style.removeProperty('--md-fab-icon-color');
    anchorEl.removeEventListener('keydown', this.handleAnchorKeyDown);
  }

  private restoreFocusToAnchor() {
    this.getAnchorEl()?.focus();
  }

  /* ── Positioning ──────────────────────────────────────── */

  private resolveEffectivePlacement() {
    if (this.placement !== 'auto') {
      this.effectivePlacement = this.placement;
      return;
    }

    const anchorEl = this.getAnchorEl();
    if (!anchorEl) {
      this.effectivePlacement = 'up';
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    this.effectivePlacement = spaceAbove > spaceBelow ? 'up' : 'down';
  }

  private positionMenu() {
    const anchorEl = this.getAnchorEl();
    const container = this.el.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
    if (!anchorEl || !container) return;

    const rect = anchorEl.getBoundingClientRect();
    const isRtl = getComputedStyle(this.el).direction === 'rtl';
    const gap = 8;

    if (isRtl) {
      container.style.left = `${rect.left}px`;
      container.style.right = '';
    } else {
      container.style.right = `${window.innerWidth - rect.right}px`;
      container.style.left = '';
    }

    if (this.effectivePlacement === 'up') {
      container.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      container.style.top = '';
    } else {
      container.style.top = `${rect.bottom + gap}px`;
      container.style.bottom = '';
    }
  }

  /* ── Items ────────────────────────────────────────────── */

  private getItems(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll('md-fab-menu-item'));
  }

  private getItemIndex(target: HTMLElement, items: HTMLElement[]): number {
    const direct = items.indexOf(target);
    if (direct >= 0) return direct;
    return items.findIndex(item => item === target || item.contains(target));
  }

  private getEnabledItems(): HTMLElement[] {
    return this.getItems().filter(item => !item.hasAttribute('disabled'));
  }

  private updateItemDelays() {
    const items = this.getItems();
    items.forEach((item, i) => {
      item.style.setProperty('--_fab-menu-item-index', String(i));
    });
  }

  /* ── Focus management (roving tabindex) ──────────────── */

  private initRovingTabindex() {
    const items = this.getItems();
    items.forEach((item, i) => {
      item.setAttribute('tabindex', i === 0 ? '0' : '-1');
    });
    this.focusedIndex = 0;
  }

  private resetRovingTabindex() {
    const items = this.getItems();
    items.forEach(item => {
      item.setAttribute('tabindex', '-1');
    });
    this.clearRovingFocusVisible(items);
  }

  private scheduleFocus(fn: () => void) {
    setTimeout(() => requestAnimationFrame(() => fn()), 0);
  }

  private setRovingFocusVisible(items: HTMLElement[], index: number, visible: boolean) {
    items.forEach((item, i) => {
      (item as FabMenuFocusableElement).rovingFocusVisible = visible && i === index;
    });
  }

  private clearRovingFocusVisible(items: HTMLElement[]) {
    items.forEach(item => {
      (item as FabMenuFocusableElement).rovingFocusVisible = false;
    });
  }

  private focusFirstItem(retries = 3, showRovingFocus = false) {
    const items = this.getItems();
    if (items.length) {
      this.focusItem(items, 0, showRovingFocus);
    } else if (retries > 0) {
      this.scheduleFocus(() => this.focusFirstItem(retries - 1, showRovingFocus));
    }
  }

  private focusAnchor() {
    const items = this.getItems();
    items.forEach(item => {
      item.setAttribute('tabindex', '-1');
    });
    this.clearRovingFocusVisible(items);
    const anchorEl = this.getAnchorEl();
    anchorEl?.focus();
    this.focusedIndex = -1;
  }

  private focusItem(items: HTMLElement[] | null, index: number, showRovingFocus = true) {
    const allItems = items ?? this.getItems();
    if (allItems.length === 0) return;

    if (index < 0) index = allItems.length - 1;
    if (index >= allItems.length) index = 0;

    if (this.focusedIndex >= 0 && this.focusedIndex < allItems.length) {
      allItems[this.focusedIndex].setAttribute('tabindex', '-1');
    }

    this.focusedIndex = index;
    allItems[index].setAttribute('tabindex', '0');
    this.setRovingFocusVisible(allItems, index, showRovingFocus);
    allItems[index].focus();
  }

  /* ── Keyboard navigation ──────────────────────────────── */

  /**
   * Handles keyboard events when focus is on menu items.
   * Bound on Host (not @Listen) so keydown from slotted light-DOM items
   * reliably reaches the handler in browsers.
   */
  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;

    const target = e.target as HTMLElement;
    if (target && target.closest('md-fab-menu') !== this.el) return;

    const items = this.getItems();
    if (!items.length) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        this.restoreFocusToAnchor();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.effectivePlacement === 'up') {
          this.focusItem(items, this.focusedIndex + 1);
        } else {
          if (this.focusedIndex <= 0) {
            this.focusAnchor();
          } else {
            this.focusItem(items, this.focusedIndex - 1);
          }
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (this.effectivePlacement === 'up') {
          if (this.focusedIndex <= 0) {
            this.focusAnchor();
          } else {
            this.focusItem(items, this.focusedIndex - 1);
          }
        } else {
          this.focusItem(items, this.focusedIndex + 1);
        }
        break;

      case 'Home':
        e.preventDefault();
        this.focusItem(items, 0);
        break;

      case 'End':
        e.preventDefault();
        this.focusItem(items, items.length - 1);
        break;

      case 'Tab': {
        const itemIndex = this.getItemIndex(target, items);
        const currentIndex = itemIndex >= 0 ? itemIndex : this.focusedIndex;

        if (e.shiftKey) {
          if (currentIndex <= 0) {
            e.preventDefault();
            this.focusAnchor();
          } else {
            e.preventDefault();
            this.focusItem(items, currentIndex - 1, false);
          }
        } else if (currentIndex >= items.length - 1) {
          e.stopPropagation();
          this.close();
        } else {
          e.preventDefault();
          this.focusItem(items, currentIndex + 1, false);
        }
        break;
      }

      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          this.handleTypeahead(items, e.key);
        }
        break;
    }
  };

  private typeaheadBuffer = '';
  private typeaheadTimer?: ReturnType<typeof setTimeout>;

  /**
   * Moves focus to the next item whose label starts with the typed character(s).
   * Accumulates characters typed within 300ms into a search buffer.
   */
  private handleTypeahead(items: HTMLElement[], char: string) {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimer = setTimeout(() => { this.typeaheadBuffer = ''; }, 300);

    const startIndex = this.focusedIndex >= 0 ? this.focusedIndex : 0;
    const len = items.length;

    for (let offset = 1; offset <= len; offset++) {
      const idx = (startIndex + offset) % len;
      const label = (items[idx].getAttribute('label') || items[idx].textContent || '').trim().toLowerCase();
      if (label.startsWith(this.typeaheadBuffer)) {
        this.focusItem(items, idx);
        return;
      }
    }
  }

  /**
   * Handles keyboard events when focus is on the anchor FAB (menu is open).
   */
  private handleAnchorKeyDown = (e: KeyboardEvent) => {
    if (!this.open && !this.closing) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        break;

      case 'ArrowUp':
        if (this.effectivePlacement === 'up') {
          e.preventDefault();
          this.focusItem(null, 0);
        }
        break;

      case 'ArrowDown':
        if (this.effectivePlacement === 'down') {
          e.preventDefault();
          this.focusItem(null, 0);
        }
        break;

      case 'Tab':
        if (!e.shiftKey) {
          e.preventDefault();
          this.focusItem(null, 0, false);
        }
        break;
    }
  };

  /* ── Global event handlers ────────────────────────────── */

  private handleOutsideClick = (e: MouseEvent) => {
    const path = e.composedPath();
    const anchorEl = this.getAnchorEl();
    if (!path.includes(this.el) && (!anchorEl || !path.includes(anchorEl))) {
      this.close();
    }
  };

  private handleItemClick = () => {
    this.close();
    this.restoreFocusToAnchor();
  };

  /**
   * Keep the open menu glued to the anchor FAB on any layout change. A plain
   * `scroll`/`resize` listener only fires for window-level events, so it misses
   * moves that don't resize the window — e.g. dragging a CSS `resize:both`
   * container, a flex/grid reflow, or an animated ancestor. Following Floating
   * UI's `autoUpdate({ animationFrame: true })`, we poll the anchor rect each
   * frame and reposition only when it actually moves. The loop is bounded by the
   * menu's open lifetime (started in addGlobalListeners, stopped on close).
   */
  private startAnchorTracking() {
    this.stopAnchorTracking();
    const tick = () => {
      this.repositionIfAnchorMoved();
      this.positionRafId = requestAnimationFrame(tick);
    };
    this.positionRafId = requestAnimationFrame(tick);
  }

  /** One tracking frame: reposition only if the anchor rect changed since the last. */
  private repositionIfAnchorMoved() {
    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const prev = this.lastAnchorRect;
    if (
      !prev ||
      prev.top !== r.top ||
      prev.left !== r.left ||
      prev.right !== r.right ||
      prev.bottom !== r.bottom
    ) {
      this.lastAnchorRect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      this.positionMenu();
    }
  }

  private stopAnchorTracking() {
    if (this.positionRafId !== null) {
      cancelAnimationFrame(this.positionRafId);
      this.positionRafId = null;
    }
    this.lastAnchorRect = null;
  }

  private addGlobalListeners() {
    requestAnimationFrame(() => {
      document.addEventListener('click', this.handleOutsideClick);
    });
    this.startAnchorTracking();
    this.el.addEventListener('mdClick', this.handleItemClick);
  }

  private removeGlobalListeners() {
    document.removeEventListener('click', this.handleOutsideClick);
    this.stopAnchorTracking();
    this.el.removeEventListener('mdClick', this.handleItemClick);
  }

  /* ── Render ───────────────────────────────────────────── */

  render() {
    return (
      <Host
        class={{
          'md-fab-menu': true,
          'md-fab-menu--open': this.open,
          'md-fab-menu--closing': this.closing,
          [`md-fab-menu--${this.variant}`]: true,
          [`md-fab-menu--${this.effectivePlacement}`]: true,
        }}
        role="menu"
        id={this.menuId}
        aria-label={this.menuLabel}
        aria-orientation="vertical"
        aria-hidden={(!this.open && !this.closing) ? 'true' : 'false'}
        onKeyDown={this.handleKeyDown}
      >
        <div class="md-fab-menu__container">
          <div class="md-fab-menu__items">
            <slot></slot>
          </div>
        </div>
      </Host>
    );
  }
}

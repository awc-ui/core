import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Method, Watch, Listen } from '@stencil/core';
import { MenuElement, VirtualMenuProvider } from '../../utils/types';
import { fixedContainingBlockOrigin } from '../../utils/fixed-position';
import { releaseIsolatingAncestors } from '../../utils/isolation-escape';

const CLOSE_ANIMATION_MS = 150;
const TYPEAHEAD_TIMEOUT_MS = 500;
/** Gap kept between the menu surface and every viewport edge when clamping. */
const VIEWPORT_MARGIN = 8;
/** MD3 "compact" window-class breakpoint — below this `responsive` goes full-width. */
const COMPACT_BREAKPOINT = 600;
/** Anchor roles for which `aria-expanded` is a valid, announced state. A roleless
 *  anchor (e.g. a md-text-field trigger host) can't carry it — see updateAnchorAria. */
const EXPANDABLE_ANCHOR_ROLES = new Set([
  'button', 'combobox', 'link', 'menuitem', 'tab', 'treeitem', 'checkbox', 'gridcell', 'row', 'rowheader', 'columnheader',
]);
/** Native tags whose IMPLICIT role supports aria-expanded (used when the anchor
 *  sets no explicit `role` — a custom element like md-text-field is roleless). */
const NATIVE_EXPANDABLE_TAGS = new Set(['BUTTON', 'SUMMARY']);

let menuIdCounter = 0;

@Component({ tag: 'md-menu', styleUrl: 'md-menu.css', shadow: true })
export class MdMenu {
  @Element() el!: HTMLElement;

  /** Whether the menu is open. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;
  /** ID of the anchor element to position relative to. */
  @Prop() anchor: string = '';
  /** Position of the menu relative to the anchor. */
  @Prop({ reflect: true }) placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' = 'bottom-start';
  /** Skip open/close animation. */
  @Prop() quick: boolean = false;
  /**
   * Visual variant.
   * - 'baseline': MD3 baseline menu (square corners, surface container)
   * - 'standard': M3 Expressive vertical menu (rounded, surface-based colors)
   * - 'vibrant': M3 Expressive vertical menu (rounded, tertiary-based colors)
   */
  @Prop({ reflect: true }) variant: 'baseline' | 'standard' | 'vibrant' = 'baseline';
  /** Layout style for vertical menus. 'standard' is flat, 'grouped' uses visual section separators. */
  @Prop({ reflect: true }) layout: 'standard' | 'grouped' = 'standard';
  /** Use gap separators instead of dividers between groups (vertical menu only). */
  @Prop({ attribute: 'use-gap', reflect: true }) useGap: boolean = false;
  /** Message shown when all menu items are hidden (e.g. no filter results). Empty string disables. */
  @Prop({ attribute: 'empty-text' }) emptyText: string = '';
  /** When true, the menu surface min-width matches the anchor element's width. The menu still grows wider if items need more space. */
  @Prop({ attribute: 'match-anchor-width', reflect: true }) matchAnchorWidth: boolean = false;
  /**
   * Adapt to compact viewports. The menu is *always* clamped within the
   * viewport (it never overflows the screen and pins to the edges with a
   * margin). When `responsive` is set, on viewports at or below the compact
   * breakpoint (600px) the menu additionally expands to near-full-width
   * below the trigger for comfortable touch use.
   */
  @Prop({ reflect: true }) responsive: boolean = false;
  /**
   * When set, the menu does NOT auto-dismiss in response to interaction
   * elsewhere on the page. By default a menu closes when:
   *   1. The user clicks outside the menu and its anchor.
   *   2. Another non-persistent menu opens (single-open coordination —
   *      opening menu B closes menu A so two top-level menus never
   *      overlap each other on screen).
   *
   * `persistent` opts out of both auto-dismiss paths. The menu then only
   * closes via `close()`, the anchor's toggle, item activation, or
   * Escape. Useful for modal-style pickers, multi-step menus, and any
   * context where the consumer manages dismissal explicitly.
   *
   * Submenus (an `<md-menu>` rendered inside a parent menu's `submenu`
   * slot) are never affected by sibling-menu dismissal even without this
   * flag — ancestors and descendants are always preserved.
   */
  @Prop({ reflect: true }) persistent: boolean = false;
  /**
   * When false, opening the menu initializes roving tabindex without moving
   * focus to the first item. The consumer handles focus (e.g. docked pickers
   * that scroll to the selected option). `show({ autoFocus: false })` still
   * takes precedence for a single open.
   */
  @Prop({ attribute: 'auto-focus', reflect: true }) autoFocus: boolean = true;

  /**
   * Cap the menu surface block-size. When the items exceed it the list
   * scrolls vertically inside a plain scroll viewport. A number is treated
   * as pixels; any CSS length is passed through (e.g. `'50vh'`). Unset, the
   * cap falls back to `--md-menu-max-block-size` (250px). Applies to menus
   * with submenus too: their flyouts are `position: fixed` and escape the
   * scroll viewport rather than being clipped by it.
   */
  @Prop({ attribute: 'max-height' }) maxHeight?: number | string;

  /**
   * Fires when the menu opens. Scoped to the menu element: `bubbles: false`
   * stops it climbing the light-DOM tree, and `composed: false` stops it
   * escaping the shadow root of a host that embeds this menu (md-select,
   * md-multi-select, md-date-picker …). Without `composed: false` a
   * `composed` event still surfaces at the embedding host as an
   * `AT_TARGET` event — so a consumer's `mdOpen` listener on the wrapper
   * would fire for both the wrapper's own event and this inner one
   * (duplicate open/close). Wrappers listen via `onMdOpen` on the menu
   * element itself, which still fires regardless.
   */
  @Event({ bubbles: false, composed: false }) mdOpen: EventEmitter<void>;
  /** Fires when the menu closes. Scoped like `mdOpen` — see its note. */
  @Event({ bubbles: false, composed: false }) mdClose: EventEmitter<void>;

  @State() private closing = false;
  @State() private sectioned = false;
  @State() private empty = false;
  /** True when the menu contains submenus — they fly out and must not be
   *  clipped, so the surface keeps `overflow: visible` instead of scrolling. */
  @State() private hasSubmenu = false;

  private focusedIndex = -1;
  /**
   * Monotonic token for virtualized keyboard nav. `focusVirtual` is async (it
   * awaits `ensureVisible` to scroll the target row into the window). Under fast
   * ArrowUp/Down key-repeat the calls overlap; without this guard a superseded
   * call would resolve *after* a newer one and re-stamp `data-md-focused` on its
   * stale index — leaving a lingering focus state-layer on whatever row now sits
   * in that slot (the "second item background flickers" bug). Each call captures
   * the token and bails if a newer call has since incremented it.
   */
  private navSeq = 0;
  /**
   * Filtered index of the row that currently shows the visible focus ring
   * (`data-md-focused`) in provider/virtual mode, or -1 for none. The ring is
   * removed only by the *winning* `focusVirtual` call, just before it stamps the
   * new row — never synchronously up-front. That keeps the ring on a real row
   * across the whole ArrowUp/Down autorepeat burst instead of blinking off for
   * the frames between a press and its async `ensureVisible` settling.
   */
  private ringedIndex = -1;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private skipAutoFocus = false;
  private menuId = `md-menu-${++menuIdCounter}`;
  private typeaheadBuffer = '';
  private typeaheadTimer?: ReturnType<typeof setTimeout>;
  private itemObserver?: MutationObserver;
  /**
   * Tracks whether the most recent interaction was via keyboard. Used to
   * decide if the initial focus ring should show when the menu opens: a
   * mouse-opened menu auto-focuses the first item (so arrow keys work)
   * but stays ring-less until the user actually uses the keyboard.
   */
  private keyboardModality = false;
  private openedViaKeyboard = false;

  /**
   * When set, the menu's keyboard navigation / typeahead / focus run against a
   * *virtualized* data model instead of `querySelectorAll('md-menu-item')` —
   * only the rows in the current scroll window exist in the DOM. Null = the
   * default DOM-driven behaviour (every other menu in the app). See
   * `setVirtualProvider`. In provider mode `focusedIndex` is a filtered row
   * index rather than an index into the live DOM items.
   */
  private provider?: VirtualMenuProvider;

  /**
   * In provider (virtualized `md-select`) mode the popup is a WAI-ARIA
   * combobox/listbox, not a menu. `listboxMode` flips the surface role to
   * `listbox` (reactive, so the role updates when a provider is registered) and
   * `comboboxEl` is the element that owns DOM focus (the select's search input):
   * keyboard nav moves `aria-activedescendant` on it instead of moving real
   * focus onto recycled virtual rows. `listboxLabel` names the listbox.
   */
  @State() private listboxMode = false;
  private comboboxEl?: HTMLElement;
  @Prop({ attribute: 'list-label' }) listLabel?: string;

  /**
   * Present the popup as a WAI-ARIA listbox (surface `role="presentation"`,
   * anchor `aria-haspopup="listbox"`) rather than a menu. `md-select` sets this
   * for both its virtual and non-virtual lists so the popup is a listbox of
   * options regardless of size. (The virtual path additionally registers a
   * provider, which adds the aria-activedescendant focus model.)
   */
  @Prop({ reflect: true }) listbox: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** True when the popup should expose listbox semantics (prop or provider). */
  private get asListbox(): boolean {
    return this.listbox || this.listboxMode;
  }

  /**
   * Register (or clear with `null`) the combobox element that holds focus while
   * a virtual provider drives the list. When set, keyboard navigation manages
   * `aria-activedescendant` on it rather than calling `.focus()` on options —
   * the canonical pattern for a listbox whose rows are virtualized/recycled.
   */
  @Method()
  async setComboboxElement(el: HTMLElement | null) {
    if (this.comboboxEl && this.comboboxEl !== el) {
      this.comboboxEl.removeAttribute('aria-activedescendant');
    }
    this.comboboxEl = el ?? undefined;
  }

  connectedCallback() {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', this.trackKeyboardModality, true);
    document.addEventListener('pointerdown', this.trackPointerModality, true);
  }

  private trackKeyboardModality = () => { this.keyboardModality = true; };
  private trackPointerModality = () => { this.keyboardModality = false; };

  componentDidLoad() {
    if (this.open) {
      this.applyDepthZIndex();
    }
    // Run an initial scan so a menu that mounts already-empty
    // (e.g. SSR snapshot, or items hidden before first paint)
    // shows the empty-state on its first frame instead of after
    // the first slotchange.
    this.wireItemObserver();
    this.updateEmpty();
    // Propagate variant/use-gap to slotted groups on load. The initial
    // `slotchange` can fire before our handler is wired (so it's missed), which
    // left grouped+gap groups without their data-variant/data-use-gap
    // attributes — the group cards then have no background (transparent surface,
    // floating items). componentDidLoad runs once children are assigned, so this
    // is the reliable initial pass; handleSlotChange keeps it in sync after.
    this.propagateVariant();
  }

  @Watch('emptyText')
  onEmptyTextChange() {
    this.updateEmpty();
  }

  // Re-propagate to slotted groups/items when the visual variant or gap mode
  // changes at runtime (e.g. via Storybook controls) — reflect only updates the
  // host attribute, not the children the group-card CSS keys off.
  @Watch('variant')
  @Watch('useGap')
  onVariantChange() {
    this.propagateVariant();
  }

  /**
   * Register (or clear with `null`) a virtual provider. With a provider set,
   * keyboard nav, typeahead, and roving focus run against the data model so a
   * windowed list of millions of options behaves like a normal menu. Without
   * one the menu is unchanged.
   */
  @Method()
  async setVirtualProvider(provider: VirtualMenuProvider | null) {
    this.provider = provider ?? undefined;
    // Flip the surface to a listbox (reactive via @State) so the virtualized
    // select's popup is exposed as a WAI-ARIA listbox, not a menu.
    this.listboxMode = !!this.provider;
  }

  /**
   * The scrollable viewport element (the menu's `.md-menu__scroll-shadow`
   * scroll div). Present on every menu, including submenu menus and the
   * inline-fill embed. A virtualized host attaches its scroll listener and
   * reads `scrollTop`/`clientHeight` from this. Null only before the shadow
   * root exists.
   */
  @Method()
  async getScrollViewport(): Promise<HTMLElement | null> {
    return (
      (this.el.shadowRoot?.querySelector('.md-menu__scroll-shadow') as HTMLElement | null) ??
      null
    );
  }

  /** Opens the menu programmatically. Pass `{ autoFocus: false }` to keep focus on the caller (e.g. a text field). */
  @Method()
  async show(opts?: { autoFocus?: boolean }) {
    clearTimeout(this.closeTimer);
    this.closing = false;
    // Top-level menus always (re)open from a clean state. This also covers
    // the case where a prior close was interrupted — e.g. clicking the
    // trigger fires the anchor's show() which cancels the close timer, so
    // `open` never flips to false and the close-path reset never runs.
    // Submenus (no anchor) are skipped so live drill-down isn't disturbed.
    if (this.anchor) this.collapseSubmenus();
    this.skipAutoFocus = opts?.autoFocus === false;
    this.open = true;
    this.applyDepthZIndex();
  }

  /**
   * Recompute the menu's position against its anchor immediately. While open,
   * md-menu already tracks scroll, resize, its own surface size AND the anchor
   * moving (a per-frame rect watch — covers transform-animated ancestors like
   * a sliding bottom sheet, and sibling reflow shifting the trigger), so this
   * is rarely needed; call it when the next frame is too late — e.g. to avoid
   * a one-frame lag right after a synchronous layout change.
   */
  @Method()
  async reposition() {
    if (this.open) this.positionMenu();
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

  @Watch('open')
  onOpenChange(open: boolean) {
    if (open) {
      // Snapshot the modality that triggered this open; the actual focus
      // is deferred (scheduleFocus), so capture it now before it drifts.
      this.openedViaKeyboard = this.keyboardModality;
      this.dismissPeerMenus();
      this.applyDepthZIndex();
      requestAnimationFrame(() => this.positionMenu());
      this.mdOpen.emit();
      this.updateAnchorAria(true);
      if (this.anchor) {
        requestAnimationFrame(() => {
          document.addEventListener('click', this.handleOutsideClick);
          document.addEventListener('keydown', this.handleDocumentKeyDown);
        });
        window.addEventListener('scroll', this.handleScroll, true);
        window.addEventListener('resize', this.handleScroll);
        this.observeSurfaceResize();
        this.startAnchorWatch();
      }
      if (this.skipAutoFocus || !this.autoFocus) {
        this.scheduleFocus(() => this.initRovingTabindex());
      } else {
        // Always move focus to the first item so it leaves the trigger
        // (a mouse-clicked trigger must not keep its keyboard ring). The
        // ring on the item itself is shown only for keyboard opens — see
        // focusFirstItem(): mouse opens focus the item ring-less, and the
        // ring appears once the user navigates with the keyboard.
        this.scheduleFocus(() => this.focusFirstItem());
      }
      this.skipAutoFocus = false;
    } else {
      // After the close animation (`open` flips only when it finishes), so the
      // menu stays on top while it fades out.
      this.releaseAncestorIsolation();
      this.mdClose.emit();
      this.focusedIndex = -1;
      this.updateAnchorAria(false);
      this.resetRovingTabindex();
      this.collapseSubmenus();
      if (this.anchor) {
        document.removeEventListener('click', this.handleOutsideClick);
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
        window.removeEventListener('scroll', this.handleScroll, true);
        window.removeEventListener('resize', this.handleScroll);
      }
      this.stopAnchorWatch();
      this.unobserveSurfaceResize();
    }
  }

  /** Reposition when the open surface's own size changes — e.g. an
   *  autocomplete's list shrinking as the user types. A top-flipped menu
   *  positioned for the taller list would otherwise keep its stale `top`
   *  and float detached above the anchor. */
  private surfaceRO?: ResizeObserver;
  private lastSurfaceSize = '';

  private observeSurfaceResize() {
    if (typeof ResizeObserver === 'undefined') return;
    const surface = this.el.shadowRoot?.querySelector('.md-menu__surface');
    if (!surface) return;
    this.lastSurfaceSize = '';
    this.surfaceRO = new ResizeObserver((entries) => {
      if (!this.open) return;
      const r = entries[entries.length - 1]?.contentRect;
      if (!r) return;
      // Guard against feedback loops: only reposition on a REAL size change
      // (positionMenu itself tweaks min-width, which would re-fire once).
      const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (size === this.lastSurfaceSize) return;
      this.lastSurfaceSize = size;
      this.positionMenu();
    });
    this.surfaceRO.observe(surface);
  }

  private unobserveSurfaceResize() {
    this.surfaceRO?.disconnect();
    this.surfaceRO = undefined;
  }

  /** While open, track the ANCHOR itself moving. The scroll/resize listeners
   *  cover viewport-driven movement and the surface RO covers the menu's own
   *  size, but a transform-animated ancestor — a bottom sheet, side sheet or
   *  dialog still sliding in when the user opens the menu — moves the anchor
   *  without firing any of those, leaving the surface glued to the anchor's
   *  mid-flight position. So does sibling reflow (a multi-select's trigger
   *  shifting as chips wrap). A per-frame rect compare (Floating UI's
   *  autoUpdate `animationFrame` strategy) is the only signal that catches
   *  every cause; the cost is one getBoundingClientRect per frame, only while
   *  a menu is open. */
  private anchorWatchRaf?: number;
  private lastAnchorRect = '';

  private startAnchorWatch() {
    if (this.anchorWatchRaf != null || typeof requestAnimationFrame === 'undefined') return;
    this.lastAnchorRect = '';
    const tick = () => {
      if (!this.open) {
        this.anchorWatchRaf = undefined;
        return;
      }
      // Re-resolved every frame on purpose: wrappers can re-render the
      // trigger, and a cached element would track a detached node. Watches the
      // same box positionMenu measures, so a supporting message appearing or
      // clearing (which moves that box) is itself a trigger to reposition.
      const anchorEl = this.getAnchorRectEl();
      if (anchorEl) {
        const r = anchorEl.getBoundingClientRect();
        const key = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
        // The first frame only records the baseline — positionMenu already ran
        // for this open; reposition only when the anchor has actually moved.
        if (this.lastAnchorRect && key !== this.lastAnchorRect) this.positionMenu();
        this.lastAnchorRect = key;
      }
      this.anchorWatchRaf = requestAnimationFrame(tick);
    };
    this.anchorWatchRaf = requestAnimationFrame(tick);
  }

  private stopAnchorWatch() {
    if (this.anchorWatchRaf != null) cancelAnimationFrame(this.anchorWatchRaf);
    this.anchorWatchRaf = undefined;
  }

  @Listen('focusin')
  handleFocusIn(e: FocusEvent) {
    if (!this.open) return;
    const target = e.target as HTMLElement;

    if (this.provider) {
      // Map a pointer-focused windowed item back to its filtered index via the
      // `data-vindex` the host stamps on each rendered row.
      const item = target.closest('md-menu-item') as HTMLElement | null;
      const attr = item?.getAttribute('data-vindex');
      if (item && attr != null) {
        const index = parseInt(attr, 10);
        if (!isNaN(index) && index !== this.focusedIndex) {
          const prev =
            this.focusedIndex >= 0 ? this.provider.domItemForIndex(this.focusedIndex) : null;
          prev?.setAttribute('tabindex', '-1');
          this.focusedIndex = index;
          item.setAttribute('tabindex', '0');
          // Pointer focus is ring-less; drop any deferred keyboard ring still
          // seated on a different row so it can't linger after a hover/click.
          if (this.ringedIndex >= 0 && this.ringedIndex !== index) {
            const ringed = this.provider.domItemForIndex(this.ringedIndex);
            ringed?.removeAttribute('data-md-focused');
          }
          this.ringedIndex = -1;
        }
      }
      return;
    }

    const items = this.getMenuItems();
    const index = items.indexOf(target);
    if (index >= 0 && index !== this.focusedIndex) {
      if (this.focusedIndex >= 0 && this.focusedIndex < items.length) {
        items[this.focusedIndex].setAttribute('tabindex', '-1');
      }
      this.focusedIndex = index;
      target.setAttribute('tabindex', '0');
    }
  }

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (!this.open) return;

    const target = e.target as HTMLElement;
    if (target && target.closest('md-menu') !== this.el) return;

    if (this.provider) {
      this.handleKeyDownVirtual(e);
      return;
    }

    const items = this.getMenuItems();
    if (!items.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusItem(items, this.focusedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusItem(items, this.focusedIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        this.focusItem(items, 0);
        break;
      case 'End':
        e.preventDefault();
        this.focusItem(items, items.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        this.restoreFocusToAnchor();
        break;
      case 'Tab':
        e.stopPropagation();
        this.closeEntireMenuTree();
        // Return focus to the trigger (like Escape) so it doesn't fall to <body>
        // when the focused option/search input unmounts; the user tabs onward from
        // there.
        this.restoreFocusToAnchor();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          this.handleTypeahead(e.key, items);
        }
        break;
    }
  }

  // ── Virtualized (provider) navigation ────────────────────
  // Mirrors the DOM-driven path but operates on filtered row indices in the
  // provider's data model, scrolling the target row into the rendered window
  // (ensureVisible) before moving real focus to it. `focusedIndex` is a
  // filtered index here, not a DOM-items index.

  private handleKeyDownVirtual(e: KeyboardEvent) {
    const p = this.provider!;
    const count = p.count();
    // Keystrokes inside a header search field (the filterable select) type into
    // the input; only navigation keys are intercepted for the list.
    const fromInput = (e.target as HTMLElement)?.tagName === 'INPUT';
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusVirtual(this.nextEnabled(this.focusedIndex, 1, count));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusVirtual(this.nextEnabled(this.focusedIndex, -1, count));
        break;
      case 'Home':
        e.preventDefault();
        this.focusVirtual(this.nextEnabled(-1, 1, count));
        break;
      case 'End':
        e.preventDefault();
        this.focusVirtual(this.nextEnabled(count, -1, count));
        break;
      case 'Enter':
        // In combobox mode the input keeps focus, so the active option never
        // receives the keystroke itself — activate it here. (In roving-focus
        // mode the focused option handles its own Enter, so don't double-fire.)
        if (this.comboboxEl && this.focusedIndex >= 0) {
          e.preventDefault();
          this.provider!.domItemForIndex(this.focusedIndex)?.click();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        this.restoreFocusToAnchor();
        break;
      case 'Tab':
        e.stopPropagation();
        this.closeEntireMenuTree();
        // Return focus to the trigger (like Escape) so it doesn't fall to <body>
        // when the focused option/search input unmounts; the user tabs onward from
        // there.
        this.restoreFocusToAnchor();
        break;
      default:
        if (
          !fromInput &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey
        ) {
          this.handleTypeaheadVirtual(e.key);
        }
        break;
    }
  }

  /**
   * Next non-disabled filtered index from `from` in `dir` (±1), wrapping like
   * the DOM path. Returns -1 only when every row is disabled / the list empty.
   */
  private nextEnabled(from: number, dir: number, count: number): number {
    if (count <= 0) return -1;
    let idx = from;
    for (let i = 0; i < count; i++) {
      idx += dir;
      if (idx < 0) idx = count - 1;
      else if (idx >= count) idx = 0;
      if (!this.provider!.isDisabledAt(idx)) return idx;
    }
    return from >= 0 && from < count ? from : -1;
  }

  private async focusVirtual(index: number, showRing = true) {
    if (index < 0) return;
    const p = this.provider!;
    const seq = ++this.navSeq;
    // Advance the logical active index immediately, but do NOT strip the visible
    // ring from the old row up-front: `ensureVisible` is async, and under
    // ArrowUp/Down autorepeat each press supersedes the last. Removing the ring
    // here left ~1-in-4 frames with no ring on any row (the held-key flicker).
    // The winning call below swaps the ring atomically once its row is windowed.
    this.focusedIndex = index;
    await p.ensureVisible(index);
    // A newer keystroke superseded this one while we awaited the scroll. Bail so
    // we don't re-stamp the focus ring / move focus to this now-stale row — the
    // latest call owns those. The current ring stays put (we never removed it).
    if (seq !== this.navSeq) return;
    const node = p.domItemForIndex(index);
    if (!node) return;
    // Atomic swap: clear the previously ringed row, then ring/seat the new one,
    // so the ring is never absent between the two.
    if (this.ringedIndex >= 0 && this.ringedIndex !== index) {
      const old = p.domItemForIndex(this.ringedIndex);
      old?.setAttribute('tabindex', '-1');
      old?.removeAttribute('data-md-focused');
    }
    if (showRing) {
      node.setAttribute('data-md-focused', '');
      this.ringedIndex = index;
    } else {
      node.removeAttribute('data-md-focused');
      this.ringedIndex = -1;
    }
    if (this.comboboxEl) {
      // WAI-ARIA combobox/listbox: focus stays on the combobox (the select's
      // search input); the active option is conveyed via aria-activedescendant.
      // This is the robust model for a virtualized listbox — no real focus is
      // moved onto rows that scroll out of the window and get recycled. The
      // option keeps tabindex -1 (only the combobox is in the tab order).
      node.id ||= `${this.menuId}-opt-${index}`;
      if (node.id) this.comboboxEl.setAttribute('aria-activedescendant', node.id);
    } else {
      // No combobox (e.g. a non-filterable virtual list): fall back to the
      // standalone-listbox roving-focus model.
      node.setAttribute('tabindex', '0');
      // ensureVisible already revealed the row; preventScroll stops the browser's
      // own scroll-into-view from fighting the (anchor-driven) virtual window.
      node.focus({ preventScroll: true });
    }
  }

  private handleTypeaheadVirtual(char: string) {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimer = setTimeout(() => {
      this.typeaheadBuffer = '';
    }, TYPEAHEAD_TIMEOUT_MS);

    const from =
      this.typeaheadBuffer.length === 1 ? this.focusedIndex + 1 : this.focusedIndex;
    const idx = this.provider!.findPrefix(this.typeaheadBuffer, from < 0 ? 0 : from);
    if (idx >= 0) this.focusVirtual(idx);
  }

  private getMenuItems(): HTMLElement[] {
    const all = Array.from(
      this.el.querySelectorAll('md-menu-item, md-sub-menu-item')
    ) as HTMLElement[];
    return all.filter(item => item.closest('md-menu') === this.el);
  }

  private getItemLabel(item: HTMLElement): string {
    return (item as MenuElement).headline || item.textContent?.trim() || '';
  }

  private handleTypeahead(char: string, items: HTMLElement[]) {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimer = setTimeout(() => { this.typeaheadBuffer = ''; }, TYPEAHEAD_TIMEOUT_MS);

    const startIndex = this.typeaheadBuffer.length === 1
      ? this.focusedIndex + 1
      : this.focusedIndex;

    for (let i = 0; i < items.length; i++) {
      const idx = (startIndex + i) % items.length;
      const label = this.getItemLabel(items[idx]).toLowerCase();
      if (label.startsWith(this.typeaheadBuffer)) {
        this.focusItem(items, idx);
        return;
      }
    }
  }

  private focusItem(items: HTMLElement[], index: number, showRing = true) {
    if (items.length === 0) return;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    if (this.focusedIndex >= 0 && this.focusedIndex < items.length) {
      items[this.focusedIndex].setAttribute('tabindex', '-1');
      items[this.focusedIndex].removeAttribute('data-md-focused');
    }

    this.focusedIndex = index;
    items[index].setAttribute('tabindex', '0');
    // `data-md-focused` is the visible focus ring. Keyboard navigation always
    // shows it; a mouse-opened menu focuses without it (see focusFirstItem)
    // so the ring only appears once the user reaches for the keyboard.
    if (showRing) {
      items[index].setAttribute('data-md-focused', '');
    } else {
      items[index].removeAttribute('data-md-focused');
    }
    items[index].focus();
  }

  private initRovingTabindex() {
    if (this.provider) {
      // No focus move (skipAutoFocus path, e.g. a combobox whose search input
      // keeps focus). Seat the active index *before* the first row (-1) so the
      // first ArrowDown lands on the first item — seating it on row 0 instead
      // made the first ArrowDown skip to the second item. Nothing is active /
      // ringed until the user actually arrows.
      this.focusedIndex = -1;
      return;
    }
    const items = this.getMenuItems();
    items.forEach((item, i) => {
      item.setAttribute('tabindex', i === 0 ? '0' : '-1');
    });
    this.focusedIndex = 0;
  }

  private resetRovingTabindex() {
    if (this.provider) {
      const node =
        this.focusedIndex >= 0 ? this.provider.domItemForIndex(this.focusedIndex) : null;
      node?.setAttribute('tabindex', '-1');
      node?.removeAttribute('data-md-focused');
      // Also clear any deferred ring still seated on a different row.
      if (this.ringedIndex >= 0 && this.ringedIndex !== this.focusedIndex) {
        const ringed = this.provider.domItemForIndex(this.ringedIndex);
        ringed?.setAttribute('tabindex', '-1');
        ringed?.removeAttribute('data-md-focused');
      }
      this.ringedIndex = -1;
      // Drop the active-option pointer on the combobox so a screen reader
      // doesn't announce a stale active row after the listbox closes.
      this.comboboxEl?.removeAttribute('aria-activedescendant');
      return;
    }
    const items = this.getMenuItems();
    items.forEach(item => {
      item.setAttribute('tabindex', '-1');
      item.removeAttribute('data-md-focused');
    });
  }

  /**
   * Reset the entire subtree when this menu closes: collapse every
   * descendant submenu and clear lingering focus markers / tabindex at
   * all depths. Without this, reopening the menu restores whichever
   * submenu was open and whichever item was focused last time.
   */
  private collapseSubmenus() {
    const subItems = Array.from(
      this.el.querySelectorAll('md-sub-menu-item')
    ) as Array<HTMLElement & { collapse?: () => Promise<void> }>;
    subItems.forEach(item => item.collapse?.());

    const allItems = Array.from(
      this.el.querySelectorAll('md-menu-item, md-sub-menu-item')
    ) as HTMLElement[];
    allItems.forEach(item => {
      item.removeAttribute('data-md-focused');
      item.setAttribute('tabindex', '-1');
    });
  }

  private scheduleFocus(fn: () => void) {
    setTimeout(() => requestAnimationFrame(() => fn()), 0);
  }

  private focusFirstItem(retries = 3) {
    if (this.provider) {
      const count = this.provider.count();
      if (count > 0) {
        // Ring only on keyboard opens, matching the DOM path.
        this.focusVirtual(this.nextEnabled(-1, 1, count), this.openedViaKeyboard);
      } else if (retries > 0) {
        this.scheduleFocus(() => this.focusFirstItem(retries - 1));
      }
      return;
    }
    const items = this.getMenuItems();
    if (items.length) {
      // Only show the ring on auto-focus when the menu was opened by keyboard.
      this.focusItem(items, 0, this.openedViaKeyboard);
    } else if (retries > 0) {
      this.scheduleFocus(() => this.focusFirstItem(retries - 1));
    }
  }

  /**
   * Resolve the anchor element by id. Looks within the menu's own root node
   * first — so a menu rendered inside another component's shadow root (e.g.
   * md-select) finds a sibling trigger that `document.getElementById` can't
   * see across the shadow boundary — then falls back to the document for
   * light-DOM anchors.
   */
  private getAnchorEl(id: string = this.anchor): HTMLElement | null {
    if (!id) return null;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    return (
      (root.getElementById?.(id) as HTMLElement | null) ??
      document.getElementById(id)
    );
  }

  /**
   * The element whose BOX the menu is positioned against. Normally the anchor
   * itself, but an anchor whose host box is bigger than the box the menu should
   * align to may nominate an inner element with `data-md-anchor-box`, and that
   * box wins.
   *
   * The case this exists for is a field trigger. `md-select`, `md-multi-select`
   * and `md-autocomplete` all point `anchor` at their `md-text-field` HOST,
   * whose box includes the supporting-text row. With `reserve-supporting-space`
   * and no message that row is a blank line, so the host's bottom edge sits a
   * full line below the field's bottom border and the menu hung off it with a
   * visible gap. md-text-field marks its field box only while that row is
   * empty, so a field WITH supporting or error text still measures the host and
   * the menu clears the text rather than covering it.
   *
   * Deliberately separate from `getAnchorEl`: the nominated box is a piece of
   * another component's internals with no role and no tabindex, so it may carry
   * geometry but must never receive the popup ARIA or focus on close. Those
   * stay on the anchor.
   *
   * Re-queried per call rather than cached — the marker appears and disappears
   * as the supporting message clears and returns, and the anchor may re-render
   * between measurements.
   */
  private getAnchorRectEl(): HTMLElement | null {
    const anchorEl = this.getAnchorEl();
    return (
      anchorEl?.shadowRoot?.querySelector<HTMLElement>('[data-md-anchor-box]') ?? anchorEl
    );
  }

  private updateAnchorAria(open: boolean) {
    if (!this.anchor) return;
    const anchorEl = this.getAnchorEl();
    if (!anchorEl) return;

    // aria-expanded is only VALID on roles that support it. Some anchors can't
    // carry it — e.g. a md-text-field trigger whose HOST is roleless (its textbox
    // role sits on the inner input): a screen reader ignores it there and axe
    // flags aria-supported-attr. Gate it on the anchor's role; the popup stays
    // discoverable via aria-haspopup + focus moving into the menu, and role-bearing
    // triggers (a role="button" opener) still get it.
    const anchorRole = anchorEl.getAttribute('role');
    const supportsExpanded =
      anchorRole !== null
        ? EXPANDABLE_ANCHOR_ROLES.has(anchorRole)
        : NATIVE_EXPANDABLE_TAGS.has(anchorEl.tagName) ||
          (anchorEl.tagName === 'A' && anchorEl.hasAttribute('href'));

    if (open) {
      anchorEl.setAttribute('aria-haspopup', this.asListbox ? 'listbox' : 'menu');
      // In listbox/provider mode the OWNER (md-select / md-multi-select) renders the
      // real role="listbox" in ITS OWN shadow and points the trigger's aria-controls
      // at it (an in-scope IDREF). Don't clobber that with menuId, which identifies
      // this menu's role="presentation" surface in a DIFFERENT shadow root (an
      // unresolvable cross-shadow reference).
      if (!this.asListbox) anchorEl.setAttribute('aria-controls', this.menuId);
    }
    if (supportsExpanded) anchorEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    else anchorEl.removeAttribute('aria-expanded');
  }

  /** Restores the ancestor `isolation` this menu relaxed for the current open. */
  private isolationRelease?: () => void;

  private applyDepthZIndex() {
    if (!this.anchor) return;
    this.el.style.zIndex = 'var(--md-sys-z-index-popup, 1000)';
    // That z-index only ranks this menu inside its OWN stacking context. An
    // ancestor with `isolation: isolate` — md-table-toolbar, md-table-container,
    // md-table, md-navigation-rail, or any consumer wrapper — caps it at the
    // ancestor's rung, so the menu paints (and therefore hit-tests) behind
    // whatever follows that ancestor in tree order. Suspend the isolate for as
    // long as the menu is open; see utils/isolation-escape.
    // Anchorless menus returned above: embedded/inline-fill menus (md-date-picker's
    // docked month/year lists) are in flow and must not disturb their surroundings.
    if (!this.isolationRelease) this.isolationRelease = releaseIsolatingAncestors(this.el);
  }

  private releaseAncestorIsolation() {
    this.isolationRelease?.();
    this.isolationRelease = undefined;
  }

  /** Apply a VIEWPORT-space position, converted to whatever containing block
   *  this host resolves against (see utils/fixed-position). */
  private applyPosition(top: number, left: number) {
    const origin = fixedContainingBlockOrigin(this.el);
    this.el.style.top = `${top - origin.y}px`;
    this.el.style.left = `${left - origin.x}px`;
  }

  private positionMenu() {
    if (!this.anchor) return;
    const anchorEl = this.getAnchorRectEl();
    if (!anchorEl) return;

    const anchorRect = anchorEl.getBoundingClientRect();
    const surface = this.el.shadowRoot?.querySelector('.md-menu__surface') as HTMLElement;
    if (!surface) return;

    const gap = 4;
    surface.style.minWidth = this.matchAnchorWidth ? `${anchorRect.width}px` : '';

    // Park at top-left with right/bottom cleared so stale inline styles
    // cannot shrink-to-fit the surface and corrupt the measurements.
    this.el.style.top = '0';
    this.el.style.left = '0';
    this.el.style.right = 'auto';
    this.el.style.bottom = 'auto';

    const menuW = surface.offsetWidth;
    let menuH = surface.offsetHeight;

    if (menuW === 0 || menuH === 0) {
      requestAnimationFrame(() => this.positionMenu());
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = VIEWPORT_MARGIN;

    // Compact + responsive: drop the trigger-relative horizontal placement and
    // present a near-full-width sheet below (or above, if cramped) the anchor.
    // The CSS media query sizes the surface to `100vw - 2*margin`.
    if (this.responsive && vw <= COMPACT_BREAKPOINT) {
      const h = surface.offsetHeight;
      let top = anchorRect.bottom + gap;
      if (top + h + m > vh && anchorRect.top - gap - h >= m) {
        top = anchorRect.top - gap - h;
        surface.style.transformOrigin = 'bottom left';
      } else {
        surface.style.transformOrigin = 'top left';
      }
      top = Math.max(m, Math.min(top, vh - h - m));
      this.applyPosition(top, m);
      return;
    }

    let vertical: 'bottom' | 'top' = this.placement.startsWith('bottom') ? 'bottom' : 'top';
    let horizontal: 'start' | 'end' = this.placement.endsWith('start') ? 'start' : 'end';

    const spaceBelow = vh - anchorRect.bottom - gap - m;
    const spaceAbove = anchorRect.top - gap - m;

    // Keep the requested vertical side if the menu fits; otherwise flip to the side
    // that fits. A CAPPED (scrollable) menu that fits neither side picks the side
    // with MORE room and shrinks its scroll region to it (below), so it scrolls
    // instead of being clamped over the anchor.
    if (vertical === 'bottom' && menuH > spaceBelow) {
      if (menuH <= spaceAbove || (this.scrollCapped && spaceAbove > spaceBelow)) vertical = 'top';
    } else if (vertical === 'top' && menuH > spaceAbove) {
      if (menuH <= spaceBelow || (this.scrollCapped && spaceBelow > spaceAbove)) vertical = 'bottom';
    }

    if (horizontal === 'start' && anchorRect.left + menuW > vw) {
      if (anchorRect.right - menuW >= 0) horizontal = 'end';
    } else if (horizontal === 'end' && anchorRect.right - menuW < 0) {
      if (anchorRect.left + menuW <= vw) horizontal = 'start';
    }

    // Cap a scrollable menu's height to the chosen side's available space so it
    // scrolls instead of overflowing or being clamped across the anchor. Only
    // capped menus have the scroll viewport that makes this safe.
    if (this.scrollCapped) {
      const avail = vertical === 'bottom' ? spaceBelow : spaceAbove;
      const scrollEl = surface.querySelector('.md-menu__scroll-shadow') as HTMLElement | null;
      const chrome = surface.offsetHeight - (scrollEl?.offsetHeight ?? 0); // header + padding
      this.el.style.setProperty('--md-menu-avail-block', `${Math.max(48, avail - chrome)}px`);
      menuH = surface.offsetHeight; // re-measure after the cap reflows the surface
    } else {
      this.el.style.removeProperty('--md-menu-avail-block');
    }

    const vOrigin = vertical === 'bottom' ? 'top' : 'bottom';
    const hOrigin = horizontal === 'start' ? 'left' : 'right';
    surface.style.transformOrigin = `${vOrigin} ${hOrigin}`;

    const top = vertical === 'bottom'
      ? anchorRect.bottom + gap
      : anchorRect.top - gap - menuH;

    const left = horizontal === 'start'
      ? anchorRect.left
      : anchorRect.right - menuW;

    // Viewport clamp (always on): keep the surface fully on-screen with a
    // margin so it never bleeds off any edge. Width is capped in CSS, so a
    // clamp to `margin` here simply pins an oversized menu to the edge.
    const clampedLeft = Math.max(m, Math.min(left, vw - menuW - m));
    const clampedTop = Math.max(m, Math.min(top, vh - menuH - m));

    this.applyPosition(clampedTop, clampedLeft);
  }

  private restoreFocusToAnchor() {
    if (!this.anchor) return;
    const anchorEl = this.getAnchorEl();
    anchorEl?.focus();
  }

  private closeEntireMenuTree() {
    let rootMenu: MenuElement = this.el as unknown as MenuElement;
    let current: HTMLElement | null = this.el;
    while (current) {
      const parentMenu = current.parentElement?.closest('md-menu') as MenuElement | null;
      if (parentMenu) {
        rootMenu = parentMenu;
        current = parentMenu;
      } else {
        break;
      }
    }

    const allItems = rootMenu.querySelectorAll('md-menu-item, md-sub-menu-item');
    allItems.forEach(item => item.setAttribute('tabindex', '-1'));

    if (rootMenu.close) rootMenu.close();

    const anchorId = rootMenu.anchor;
    if (anchorId) {
      const root = (rootMenu as unknown as HTMLElement).getRootNode() as
        | Document
        | ShadowRoot;
      const anchorEl =
        (root.getElementById?.(anchorId) as HTMLElement | null) ??
        document.getElementById(anchorId);
      anchorEl?.focus();
    }
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.persistent) return;
    const path = e.composedPath();
    if (!path.includes(this.el)) {
      this.close();
    }
  };

  /**
   * Single-open coordination. When this menu opens, dismiss every other
   * non-persistent top-level menu currently open on the page so two
   * unrelated menus never overlap. Ancestors and descendants of `this`
   * are deliberately preserved — submenus must not close their parent
   * menu when they open, and parent menus must not nuke an in-flight
   * submenu the user is interacting with.
   */
  private dismissPeerMenus() {
    if (this.persistent) return;
    if (typeof document === 'undefined') return;
    const all = Array.from(document.querySelectorAll('md-menu')) as MenuElement[];
    for (const peer of all) {
      if (peer === this.el) continue;
      if (!peer.open) continue;
      if (peer.persistent) continue;
      if (peer.contains(this.el)) continue;
      if (this.el.contains(peer)) continue;
      peer.close();
    }
  }

  private handleDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      this.close();
      this.restoreFocusToAnchor();
    }
  };

  private handleScroll = () => {
    if (this.open && !this.closing) {
      this.positionMenu();
    }
  };

  private handleSlotChange = () => {
    this.updateSections();
    this.propagateVariant();
    this.wireItemObserver();
    this.updateEmpty();
    this.hasSubmenu = !!this.el.querySelector('md-sub-menu-item');
  };

  /**
   * Returns true when the element is *explicitly* hidden — either the HTML
   * `hidden` attribute is set, or `style="display: none"` is applied
   * inline. We deliberately avoid `getComputedStyle()` here because
   * `display: none` from a stylesheet rule on `<md-menu-item>` would
   * report the element as hidden during the brief window before the
   * loader finishes registering the custom element, which would flash
   * the empty-state on every menu open.
   */
  private isHidden(el: HTMLElement): boolean {
    if (el.hasAttribute('hidden')) return true;
    if (el.style.display === 'none') return true;
    return false;
  }

  private hasVisibleItem(el: HTMLElement): boolean {
    if (this.isHidden(el)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'md-menu-item' || tag === 'md-sub-menu-item') return true;
    if (tag === 'md-menu-item-group') {
      return Array.from(el.children).some((child) =>
        this.hasVisibleItem(child as HTMLElement),
      );
    }
    return false;
  }

  private updateEmpty() {
    if (!this.emptyText) {
      // No empty-text configured — the empty UI is opt-in; skip the
      // class entirely so the surface stays its natural collapsed
      // height when an unconfigured menu has no items.
      this.empty = false;
      return;
    }
    const slot = this.getContentSlot();
    if (!slot) return;
    const children = slot.assignedElements() as HTMLElement[];
    this.empty = !children.some((child) => this.hasVisibleItem(child));
  }

  private wireItemObserver() {
    // The empty-state has to react to consumer code toggling
    // `style="display: none"` / `hidden` on items (the canonical
    // type-to-filter pattern). `slotchange` fires when *children* of
    // the menu are added/removed, but NOT when their attributes
    // change in place — so a MutationObserver covers that gap.
    this.itemObserver?.disconnect();
    // Stencil's jsdom-lite test environment doesn't ship a
    // MutationObserver. Skip the observer there — the slotchange-
    // driven path still keeps the empty-state in sync, and the
    // dynamic-attribute path is exercised by browser-only e2e tests.
    if (typeof MutationObserver === 'undefined') return;
    const slot = this.getContentSlot();
    if (!slot) return;
    const children = slot.assignedElements() as HTMLElement[];
    if (children.length === 0) return;
    this.itemObserver = new MutationObserver(() => this.updateEmpty());
    for (const child of children) {
      this.itemObserver.observe(child, {
        attributes: true,
        attributeFilter: ['style', 'hidden'],
        subtree: true,
      });
    }
  }

  /**
   * The default (content) slot — NOT the named `header` slot, which renders
   * FIRST inside the surface (a virtualized select's pinned search field). A
   * plain `querySelector('slot')` grabs that header slot (empty for normal
   * menus), so every slot-scanning method must filter by name — otherwise
   * grouped+gap groups never receive data-variant/data-use-gap and lose their
   * card background (transparent surface → floating items). Built from
   * querySelectorAll (a simple selector Stencil's jsdom-lite mock supports)
   * rather than `slot:not([name])`, which the mock can't parse.
   */
  private getContentSlot(): HTMLSlotElement | null {
    const root = this.el.shadowRoot;
    if (!root) return null;
    const slots = Array.from(root.querySelectorAll('slot')) as HTMLSlotElement[];
    // Match on the `name` ATTRIBUTE, not the `.name` property — Stencil's
    // jsdom-lite mock doesn't reflect the attribute onto the property, so `.name`
    // is undefined there and would wrongly match the header slot first.
    return slots.find((s) => !s.getAttribute('name')) ?? null;
  }

  private propagateVariant() {
    const slot = this.getContentSlot();
    if (!slot) return;
    const children = slot.assignedElements() as HTMLElement[];
    for (const child of children) {
      child.setAttribute('data-variant', this.variant);
      if (child.tagName.toLowerCase() === 'md-menu-item-group') {
        if (this.useGap) {
          child.setAttribute('data-use-gap', '');
        } else {
          child.removeAttribute('data-use-gap');
        }
        const nested = child.querySelectorAll('md-menu-item, md-sub-menu-item');
        for (const item of Array.from(nested)) {
          item.setAttribute('data-variant', this.variant);
        }
      }
    }
  }

  private updateSections() {
    const slot = this.getContentSlot();
    if (!slot) return;
    const children = slot.assignedElements() as HTMLElement[];

    let foundGap = false;
    let afterGap = false;

    for (const child of children) {
      if (afterGap) {
        child.setAttribute('data-after-gap', '');
        afterGap = false;
      } else {
        child.removeAttribute('data-after-gap');
      }

      if (child.hasAttribute('gap')) {
        foundGap = true;
        afterGap = true;
      }
    }

    this.sectioned = foundGap;
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    document.removeEventListener('keydown', this.trackKeyboardModality, true);
    document.removeEventListener('pointerdown', this.trackPointerModality, true);
    window.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('resize', this.handleScroll);
    clearTimeout(this.closeTimer);
    clearTimeout(this.typeaheadTimer);
    this.itemObserver?.disconnect();
    this.itemObserver = undefined;
    this.stopAnchorWatch();
    this.unobserveSurfaceResize();
    this.updateAnchorAria(false);
    // A menu torn down while open must not leave an ancestor un-isolated.
    this.releaseAncestorIsolation();
  }

  /** Embedded flex menus (e.g. md-date-picker docked month/year lists). */
  private get inlineFill(): boolean {
    return this.el.classList.contains('md-menu--inline-fill');
  }

  /** Resolved `max-height` as a CSS length, or null when unset. */
  private get maxHeightValue(): string | null {
    if (this.maxHeight === undefined || this.maxHeight === null || this.maxHeight === '') {
      return null;
    }
    // A bare number — or a numeric string (attributes and `md-select`
    // forwarding both arrive as strings) — is treated as pixels; any other
    // CSS length (`'50vh'`, `'20rem'`, …) is passed through verbatim.
    const raw = String(this.maxHeight);
    return /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw;
  }

  /** EVERY menu except an inline-fill embed is bounded by the viewport and scrolls
   *  inside its scroll viewport when it would overflow — with OR without an
   *  explicit max-height. This keeps a pinned header and plain scrolling for every
   *  overflowing menu, not just capped ones.
   *
   *  Submenu menus used to be excluded here, because the flyout was an ordinary
   *  `position: absolute` child of its row and any overflow on an ancestor clipped
   *  it out of existence — laid out at `inset-inline-start: 100%` it sits entirely
   *  OUTSIDE the box that clips, so the overlap was zero and the flyout read as
   *  "absent" rather than "cut off". The flyout container is now `position: fixed`
   *  and placed in viewport coordinates by md-sub-menu-item, and overflow never
   *  captures a fixed descendant — so a submenu menu caps and scrolls exactly like
   *  the ones md-select, md-multi-select and md-autocomplete render. */
  private get scrollCapped(): boolean {
    return !this.inlineFill;
  }

  /** Inline-fill and every capped menu wrap their body in a scroll viewport. */
  private get useScrollViewport(): boolean {
    return this.inlineFill || this.scrollCapped;
  }

  private renderMenuBody() {
    return [
      <slot onSlotchange={this.handleSlotChange} />,
      this.emptyText ? (
        <span class="md-menu__empty" part="empty-text" role="status">
          {this.emptyText}
        </span>
      ) : null,
    ];
  }

  render() {
    return (
      <Host
        class={{
          'md-menu': true,
          'md-menu--open': this.open,
          'md-menu--closing': this.closing,
          'md-menu--quick': this.quick,
          [`md-menu--${this.variant}`]: true,
          [`md-menu--${this.layout}`]: this.variant !== 'baseline',
          'md-menu--gap': this.useGap,
          'md-menu--sectioned': this.sectioned,
          'md-menu--empty': this.empty,
          'md-menu--responsive': this.responsive,
          'md-menu--has-submenu': this.hasSubmenu,
          'md-menu--scroll': this.scrollCapped,
        }}
        aria-hidden={(!this.open || this.closing) ? 'true' : 'false'}
        // A closed menu stays in the DOM (opacity 0, never display:none, so the
        // open/close motion can play), which leaves focusable content — items, a
        // filterable select's search input — inside an aria-hidden subtree. That
        // is tab-reachable-but-invisible for keyboard users and fails axe
        // aria-hidden-focus (caught as a transient on story navigation, but the
        // closed steady state is just as affected). `inert` while hidden removes
        // the whole subtree from focus order and the a11y tree; it flips off in
        // the same render that clears aria-hidden, before any post-open focus.
        inert={!this.open || this.closing}
      >
        <div
          class="md-menu__surface"
          part="surface"
          // In provider/listbox mode the surface is just a container: it holds
          // the combobox (header slot) AND the listbox, so it must not itself be
          // a menu or a listbox. The host (md-select) renders the actual
          // role="listbox" wrapper around the options in its own shadow root, so
          // aria-controls / aria-activedescendant IDREFs resolve.
          role={this.asListbox ? 'presentation' : 'menu'}
          id={this.menuId}
          aria-orientation={this.asListbox ? undefined : 'vertical'}
          aria-labelledby={this.asListbox ? undefined : this.anchor || undefined}
        >
          {/* Pinned header above the scroll area (e.g. a virtualized select's
              search field). Empty — and zero-cost — for every other menu. */}
          <slot name="header" />
          {this.useScrollViewport ? (
            <div
              class="md-menu__scroll-shadow"
              part="menu-viewport"
              // Keyboard access to the scrolling option list (WCAG 2.1.1): the
              // active option's roving tabindex can sit on a PINNED HEADER item
              // (e.g. a select's "Select all") that lives outside this viewport,
              // leaving the scroll area with no focusable child. Make it focusable
              // — but ONLY in listbox mode. There the surface is role="presentation"
              // (the owner renders the real listbox), so a focusable tabindex="0"
              // viewport is harmless. In a plain role="menu" the viewport would be a
              // role-less `div[tabindex]` OWNED by the menu, which axe flags as a
              // disallowed menu child (aria-required-children) — and a menu's own
              // menuitems (roving tabindex) already satisfy WCAG 2.1.1 without it.
              tabindex={this.asListbox ? '0' : undefined}
              // inline-fill is bounded by its flex parent; a capped menu is
              // bounded by max-height so the viewport scrolls within it. Clamp
              // to the viewport so an oversized cap can't run off-screen.
              style={
                this.inlineFill
                  ? undefined // flexes to fill its parent; no fixed cap
                  : {
                      // Bound the scroll region to the smallest of: any explicit
                      // max-height, the default cap, the space on the chosen side
                      // (--md-menu-avail-block, set by positionMenu), and the
                      // viewport — so it scrolls instead of overflowing.
                      //
                      // `--md-menu-max-block-size` is in the fallback branch and
                      // NOT the first, because this is where a capped menu is
                      // actually sized: the CSS rule on `.md-menu__surface` never
                      // applies to `md-menu--scroll`, which is the variant
                      // md-select, md-multi-select and md-autocomplete all use.
                      // A default set only in the stylesheet therefore reached
                      // every menu except the three that most needed it.
                      maxBlockSize: this.maxHeightValue
                        ? `min(${this.maxHeightValue}, var(--md-menu-avail-block, 100dvh), calc(100dvh - 2 * var(--md-menu-viewport-margin, 8px)))`
                        : `min(var(--md-menu-max-block-size, 250px), var(--md-menu-avail-block, 100dvh), calc(100dvh - 2 * var(--md-menu-viewport-margin, 8px)))`,
                    }
              }
            >
              {this.renderMenuBody()}
            </div>
          ) : (
            this.renderMenuBody()
          )}
        </div>
      </Host>
    );
  }
}

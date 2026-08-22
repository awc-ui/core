import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Watch, Method, Listen } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';
import { sanitizeHref, SAFE_LINK_REL, SAFE_WINDOW_FEATURES } from '../../utils/url';

export type MdListItemType = 'text' | 'button' | 'link';

/** Detail payload emitted by `md-list-item`'s `mdExpand` event. */
export type MdListItemExpandDetail = {
  expanded: boolean;
  /** Top-level row index among sibling `md-list-item` rows in the parent list. */
  index?: number;
  /** Headline text (prop or slotted) identifying the row. */
  value?: string;
  /** Reference to the expandable row element. */
  item?: HTMLMdListItemElement;
};

let expandedPanelIdCounter = 0;

@Component({
  tag: 'md-list-item',
  styleUrl: 'md-list-item.css',
  shadow: true,
})
export class MdListItem {
  @Element() el!: HTMLElement;

  /**
   * Behavior of the row.
   *
   * - `text` (default): non-interactive content row. No focus, no ripple,
   *   no click event. Use for static labels and section headers.
   * - `button`: focusable, ripples, fires `mdClick` on activation.
   * - `link`: same as `button` but also navigates to `href` in `target`.
   *
   * When the row sits inside an `md-list` with `selection-mode` set, the
   * row becomes focusable + clickable regardless of `type` so users can
   * pick from a list of plain rows without authoring extra props.
   */
  @Prop({ reflect: true }) type: MdListItemType = 'text';

  /** Headline text. Overridden by `slot="headline"`. */
  @Prop() headline: string = '';

  /** Overline text shown above the headline. Overridden by `slot="overline"`. */
  @Prop() overline: string = '';

  /** Supporting text below the headline. Overridden by `slot="supporting-text"`. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Trailing supporting text on the right. Overridden by `slot="trailing-supporting-text"`. */
  @Prop({ attribute: 'trailing-supporting-text' }) trailingSupportingText: string = '';

  /** Material Symbols name for the leading slot (24 dp container, 18 dp icon). */
  @Prop({ attribute: 'leading-icon' }) leadingIcon: string = '';

  /** Material Symbols name for the trailing slot (24 dp icon). */
  @Prop({ attribute: 'trailing-icon' }) trailingIcon: string = '';

  /**
   * Avatar image URL — forwarded to an internal `md-avatar` rendered in
   * the leading slot. Falls back to `leadingAvatarName` / `leadingAvatarLabel`
   * if the image fails to load.
   */
  @Prop({ attribute: 'leading-avatar' }) leadingAvatar: string = '';

  /** Alt text for `leadingAvatar`. Also surfaced as the avatar's accessible label. */
  @Prop({ attribute: 'leading-avatar-alt' }) leadingAvatarAlt: string = '';

  /**
   * Full name forwarded to the internal `md-avatar` so it can auto-derive
   * initials when no image is available (`"Ada Lovelace"` → `"AL"`).
   * When both this and `leadingAvatarLabel` are empty the avatar falls
   * back to a `person` icon.
   */
  @Prop({ attribute: 'leading-avatar-name' }) leadingAvatarName: string = '';

  /**
   * Explicit initials shown by the internal `md-avatar`. Overrides the
   * `leadingAvatarName` parsing. Used for "C", "JD" style labels.
   */
  @Prop({ attribute: 'leading-avatar-label' }) leadingAvatarLabel: string = '';

  /** Image thumbnail URL (56 dp square by default). */
  @Prop({ attribute: 'leading-image' }) leadingImage: string = '';

  /** Alt text for `leadingImage`. */
  @Prop({ attribute: 'leading-image-alt' }) leadingImageAlt: string = '';

  /**
   * Number of text rows. Auto-detected when 1 + content suggests more
   * (overline → 2-line, overline + supporting → 3-line). Set explicitly
   * to override the auto-promotion.
   */
  @Prop() lines: 1 | 2 | 3 = 1;

  /** Link href. Honored when `type='link'`. */
  @Prop() href: string = '';

  /** Link target. Honored when `type='link'`. */
  @Prop() target: string = '_self';

  /** Disables interaction, removes from tab order, and dims content to 38 % opacity. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Visually disabled but remains focusable for discoverability. Does not emit activation events. */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Selected state. Toggled by `md-list` when `selection-mode` is on. */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;

  /**
   * Turns the row into a single-level collapsible disclosure. When `true`:
   *   - a trailing **`md-icon-button`** caret renders after any author-supplied
   *     trailing content. It is the disclosure control: it carries
   *     `aria-expanded` + `aria-controls`, gets the icon-button pill/squircle
   *     shape morph when selected (expanded), and its `expand_more` glyph
   *     rotates 180° (points up) when expanded.
   *   - the `expanded-content` slot reveals one level of flat `md-list-item`
   *     child rows (not a nested `md-list` chassis) inline below the parent
   *     with an MD3 expressive open (emphasized-decelerate) / retract
   *     (emphasized-accelerate) height + opacity animation.
   *   - clicking the row body also toggles the panel as a convenience; the
   *     caret button additionally toggles on Enter / Space when focused.
   *   - ArrowRight expands, ArrowLeft collapses (when the row itself is
   *     focusable, e.g. `type="button"` / reorderable rows).
   */
  @Prop({ reflect: true }) expandable: boolean = false;

  /** Reflects/controls the expanded state of an `expandable` row. */
  @Prop({ mutable: true, reflect: true }) expanded: boolean = false;

  /**
   * Whether this item is the currently tabbable one in its parent list.
   * Managed by `md-list`'s roving tabindex. Standalone items leave this
   * as `true` and become focusable when `type !== 'text'`.
   */
  @Prop({ mutable: true, reflect: false }) tabbable: boolean = true;

  /**
   * When `true`, paints the keyboard-focus ring even if the row does not
   * hold DOM focus (e.g. toolbar buttons drove `activateNext()`). Set
   * imperatively by `md-list` during programmatic / arrow-key navigation —
   * not on initial load.
   */
  @Prop({ mutable: true, reflect: false }) rovingFocusVisible: boolean = false;

  /**
   * Selection mode propagated from parent `md-list`. Set imperatively by
   * the parent — authors should not need to touch this directly. When
   * non-`none`, the item becomes focusable + clickable regardless of
   * `type` and renders with `role="option"` + `aria-selected`.
   */
  @Prop({ mutable: true, reflect: false }) selectionMode: 'none' | 'single-select' | 'multi-select' = 'none';

  /**
   * Interaction mode propagated from parent `md-list`. Set imperatively by
   * the parent — authors should not need to touch this directly.
   *
   * - `single-action`: the whole row is one primary action.
   * - `multi-action`: trailing slot may host secondary controls (icon
   *   buttons, switches) that keep their own focus/click semantics.
   */
  @Prop({ mutable: true, reflect: false }) interactionMode: 'single-action' | 'multi-action' = 'single-action';

  /**
   * The resolved ARIA role of the parent `md-list` container, propagated
   * imperatively by that parent — authors should not touch this. It lets a row
   * adapt its own role to its container: when the container is a `menu` /
   * `menubar` (via `role-override`) an interactive row exposes `role="menuitem"`
   * on the HOST itself (the host IS the widget, like `option`) and skips the
   * inner primary widget, because a `menu` owns its direct light-DOM children
   * (the hosts) and must own `menuitem`s — a `listitem` / `role="none"` host is a
   * disallowed menu child (axe `aria-required-children`). Empty for a plain
   * `list` / `listbox`, where the default `listitem` / `option` roles apply.
   */
  @Prop({ mutable: true, reflect: false }) containerRole: string = '';

  /**
   * Whether this row can be reordered via drag-and-drop. Set imperatively by
   * the parent `md-list[reorderable]` — authors should not need to touch this
   * directly. When `true` the row renders a trailing drag handle (grab it to
   * drag) and supports `Alt + ArrowUp / ArrowDown` to move when focused.
   * Disabled rows ignore it.
   */
  @Prop({ mutable: true, reflect: false }) reorderable: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when an interactive row is activated (click, Enter, or Space). */
  @Event() mdClick: EventEmitter<{ item: HTMLElement }>;

  /** Bubbles to parent `md-list` so it can manage selection state. */
  @Event({ bubbles: true, composed: true }) mdItemClick: EventEmitter<{ index: number; selected: boolean }>;

  /**
   * Bubbles to parent `md-list` when an `expanded-content` child row is
   * selected. The list re-emits `mdSelect` with the parent's list index,
   * `childIndex`, `expanded`, and the child in `item`.
   */
  @Event({ bubbles: true, composed: true }) mdItemSelect: EventEmitter<{
    index: number;
    value: string;
    selected: boolean;
    item: HTMLMdListItemElement;
  }>;

  /** Asks the parent `md-list` to give this row roving focus. */
  @Event({ bubbles: true, composed: true }) mdRequestActivation: EventEmitter<void>;

  /**
   * Internal event the parent `md-list` listens to for keyboard reordering
   * (`Alt + ArrowUp / ArrowDown`). Bubbles + composed so it crosses the
   * shadow boundary up to the list.
   */
  @Event({ bubbles: true, composed: true }) mdItemRequestReorder: EventEmitter<{
    direction: 'up' | 'down';
    from: number;
  }>;

  /** Fires whenever the expanded state of an expandable row changes. */
  @Event() mdExpand: EventEmitter<MdListItemExpandDetail>;

  @State() private hasSlottedLeading = false;
  @State() private hasSlottedTrailing = false;
  @State() private hasSlottedHeadline = false;
  @State() private hasSlottedOverline = false;
  @State() private hasSlottedSupportingText = false;
  @State() private hasSlottedTrailingSupportingText = false;
  @State() private hasSlottedExpandedContent = false;
  /** True when the `expanded-content` slot holds at least one `md-list-item`
   *  child. Such children render as `role="listitem"`, whose only valid axe
   *  context is `role="list"` — so the expanded panel becomes a `list` (not a
   *  `region`/`group`) when this is true, and stays a `region` for arbitrary
   *  slotted content (which has no required owned role). */
  @State() private hasExpandedListItemChildren = false;
  /** True when the row has a direct `<video slot="leading">` child.
   *  Drives the `md-list-item--with-video` class which CSS uses to bump
   *  top padding to 12px per M3. Detected from light DOM (in
   *  `detectSlottedFromLightDom`) because `:host(:has(...))` can't cross
   *  the shadow boundary in Chromium. */
  @State() private hasLeadingVideo = false;
  @State() private pressed = false;
  @State() private hostedByList = false;

  private observer: MutationObserver | null = null;
  private expandedPanelId = `md-list-item-panel-${++expandedPanelIdCounter}`;

  /* ----- Conditional md-tooltip truncation detection -----
     The headline + supporting-text spans are ALWAYS wrapped in a stable
     `md-tooltip` (never mounted/unmounted on resize). One ResizeObserver on
     the host drives a debounced + rAF-batched measurement pass that compares
     scroll vs client size on each text span and toggles the tooltip's
     `disabled` prop ONLY when the clipped state actually changes. The span
     refs feed measurement; the tooltip refs receive the imperative toggle.
     The `*Truncated` booleans are plain instance fields (NOT @State) — they
     back the `disabled={!truncated}` binding so re-renders stay consistent
     without the field flip itself triggering a Stencil re-render. */
  /** The inner primary-action element (`role="button"` / `menuitem` span, or a
   *  real `<a href>`) rendered for interactive non-selection rows. It is the
   *  roving-tabindex focus target; `setFocus()` focuses it (ensuring its
   *  tabindex is present first, since the roving render may not have flushed). */
  private primaryEl?: HTMLElement;
  private headlineEl?: HTMLSpanElement;
  private supportingEl?: HTMLSpanElement;
  private headlineTooltipEl?: HTMLMdTooltipElement;
  private supportingTooltipEl?: HTMLMdTooltipElement;
  private resizeObserver: ResizeObserver | null = null;
  private truncationRaf = 0;
  private truncationDebounceTimer = 0;
  private headlineTruncated = false;
  private supportingTruncated = false;

  private get inSelectionMode(): boolean {
    return this.selectionMode !== 'none';
  }

  /**
   * True when this row is slotted as a parent row's `expanded-content` child.
   * Such a row lives in the light DOM as a child of the (role=`listitem`)
   * parent host, while its would-be owning `listbox` is buried in that parent's
   * shadow DOM. axe resolves an `option`'s required parent from the light-DOM
   * ancestry (the `listitem` host), NOT the cross-slot shadow container, so a
   * nested `role="option"` here fails `aria-required-parent`. These rows must
   * therefore NOT claim `role="option"`; their selection is still coordinated
   * by the parent row (see `onExpandedChildItemClick`).
   */
  private get isExpandedContentSlotted(): boolean {
    return this.el.getAttribute('slot') === 'expanded-content';
  }

  /**
   * Expandable disclosure triggers propagate selection mode to children but
   * never select themselves. Nested `expanded-content` children are excluded
   * too: their owning listbox is not a real light-DOM ancestor, so they can't
   * be a resolvable `option` (see {@link isExpandedContentSlotted}).
   */
  private get participatesInSelection(): boolean {
    return this.inSelectionMode && !this.expandable && !this.isExpandedContentSlotted;
  }

  private get isMultiAction(): boolean {
    return this.interactionMode === 'multi-action';
  }

  private get isEffectivelyDisabled(): boolean {
    return this.disabled || this.softDisabled;
  }

  private get isInteractive(): boolean {
    return !this.disabled && (this.type !== 'text' || this.inSelectionMode || this.expandable);
  }

  /** True when the parent container is a `menu` / `menubar` (via role-override). */
  private get isMenuContext(): boolean {
    return this.containerRole === 'menu' || this.containerRole === 'menubar';
  }

  /**
   * True when the row exposes its interactive widget on an INNER primary
   * element instead of the host — the WAI-ARIA-correct model for a plain
   * non-selection `type="button"` / `type="link"` row inside a `role="list"`.
   * The host stays a structural `listitem` and the inner element carries the
   * `button` / link role + roving tabindex, with any trailing controls as its
   * siblings.
   *
   * Excluded (host IS the widget / focus target instead, no inner primary):
   *   - selection (`option`) rows — selection isn't failing axe,
   *   - `reorderable` rows — the host must stay focusable for keyboard reorder,
   *   - `menu` / `menubar` context — a `menu` owns its direct light-DOM children
   *     (the hosts), and a widget in the host's shadow DOM is not "owned" by the
   *     menu; so the HOST itself must be the `menuitem` (like `option`),
   *   - plain `text` rows and expandable-only text rows (the caret is the
   *     control there).
   */
  private get hasPrimaryAction(): boolean {
    return (
      !this.participatesInSelection &&
      !this.reorderable &&
      !this.isMenuContext &&
      (this.type === 'button' || this.type === 'link')
    );
  }

  private get hasLeadingContent(): boolean {
    return (
      !!this.leadingIcon ||
      !!this.leadingAvatar ||
      !!this.leadingAvatarLabel ||
      !!this.leadingAvatarName ||
      !!this.leadingImage ||
      this.hasSlottedLeading
    );
  }

  private get hasTrailingContent(): boolean {
    return (
      !!this.trailingIcon ||
      !!this.trailingSupportingText ||
      this.hasSlottedTrailing ||
      this.hasSlottedTrailingSupportingText ||
      this.expandable ||
      this.reorderable
    );
  }

  private get effectiveLines(): 1 | 2 | 3 {
    if (this.lines !== 1) return this.lines;
    const overlineFilled = !!this.overline || this.hasSlottedOverline;
    const supportingFilled = !!this.supportingText || this.hasSlottedSupportingText;
    if (overlineFilled && supportingFilled) return 3;
    if (overlineFilled || supportingFilled) return 2;
    return 1;
  }

  componentWillLoad() {
    const parent = this.el.parentElement;
    this.hostedByList = !!parent && parent.tagName === 'MD-LIST';
    if (this.expandable && this.selected) {
      this.selected = false;
    }
    /* Allow standalone authors to opt in via a data-attribute. The
       parent `md-list` always uses the prop path. */
    if (this.selectionMode === 'none') {
      const attr = this.el.getAttribute('data-selection-mode');
      if (attr === 'single-select' || attr === 'multi-select') {
        this.selectionMode = attr;
      }
    }
    if (this.interactionMode === 'single-action') {
      const interactionAttr = this.el.getAttribute('data-interaction-mode');
      if (interactionAttr === 'multi-action') {
        this.interactionMode = 'multi-action';
      }
    }
    /* Seed `hasSlotted*` from light DOM BEFORE first paint so we can
       elide wrappers (e.g. `.md-list-item__trailing`) that would
       otherwise render empty just to host a `<slot>` whose content we
       haven't detected yet. Slotchange fires too late — it'd flash the
       empty wrapper for one frame. */
    this.detectSlottedFromLightDom();
    if (this.expandable && this.selected) {
      this.selected = false;
    }
  }

  /** Inspect light-DOM children for `slot=` attributes and populate the
   *  corresponding `hasSlotted*` state. Cheap (single Array.from) and
   *  safe to call repeatedly; only writes state when the value actually
   *  changes so it never causes a re-render storm. */
  private detectSlottedFromLightDom() {
    if (!this.el || !this.el.children) return;
    const children = Array.from(this.el.children);
    const has = (name: string) => children.some(c => c.getAttribute('slot') === name);

    const trailing = has('trailing');
    if (trailing !== this.hasSlottedTrailing) this.hasSlottedTrailing = trailing;

    const trailingSupporting = has('trailing-supporting-text');
    if (trailingSupporting !== this.hasSlottedTrailingSupportingText) {
      this.hasSlottedTrailingSupportingText = trailingSupporting;
    }

    const headline = has('headline');
    if (headline !== this.hasSlottedHeadline) this.hasSlottedHeadline = headline;

    const supportingText = has('supporting-text');
    if (supportingText !== this.hasSlottedSupportingText) this.hasSlottedSupportingText = supportingText;

    const overline = has('overline');
    if (overline !== this.hasSlottedOverline) this.hasSlottedOverline = overline;

    const leading = has('leading');
    if (leading !== this.hasSlottedLeading) this.hasSlottedLeading = leading;

    /* The video check uses tagName instead of just `slot=` because the
       M3 spec specifically bumps top padding for the 100×56px video
       thumbnail token — not for arbitrary slotted leading content. */
    const video = children.some(
      c => c.tagName === 'VIDEO' && c.getAttribute('slot') === 'leading',
    );
    if (video !== this.hasLeadingVideo) this.hasLeadingVideo = video;

    /* Whether the expanded panel holds flat `md-list-item` rows — drives its
       `role="list"` (valid `listitem` owner) vs `region` (arbitrary content). */
    const expandedListItems = children.some(
      c => c.tagName === 'MD-LIST-ITEM' && c.getAttribute('slot') === 'expanded-content',
    );
    if (expandedListItems !== this.hasExpandedListItemChildren) {
      this.hasExpandedListItemChildren = expandedListItems;
    }
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const wireSlot = (name: string, setHas: (v: boolean) => void, onChange?: () => void) => {
      const slot = shadow.querySelector(`slot[name="${name}"]`) as HTMLSlotElement | null;
      if (!slot) return;
      const update = () => {
        try {
          setHas(slot.assignedElements().length > 0);
        } catch {
          /* jsdom mock may not implement assignedElements; ignore */
        }
        onChange?.();
      };
      slot.addEventListener('slotchange', update);
      update();
    };

    wireSlot('leading', v => (this.hasSlottedLeading = v));
    wireSlot('trailing', v => (this.hasSlottedTrailing = v));
    /* Headline + supporting slots re-measure truncation on slotchange — rich
       slotted content can be wider/narrower than the prop fallback it
       replaces, flipping whether the tooltip should be enabled. */
    wireSlot('headline', v => (this.hasSlottedHeadline = v), () => this.scheduleTruncationCheck());
    wireSlot('overline', v => (this.hasSlottedOverline = v));
    wireSlot('supporting-text', v => (this.hasSlottedSupportingText = v), () => this.scheduleTruncationCheck());
    wireSlot('trailing-supporting-text', v => (this.hasSlottedTrailingSupportingText = v));
    wireSlot('expanded-content', v => (this.hasSlottedExpandedContent = v));

    if (typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(mutations => {
        let rescanSlots = false;
        for (const m of mutations) {
          if (m.type === 'attributes' && m.target === this.el && m.attributeName === 'data-selection-mode') {
            const attr = this.el.getAttribute('data-selection-mode');
            if (attr === 'single-select' || attr === 'multi-select') {
              this.selectionMode = attr;
            } else if (!attr) {
              this.selectionMode = 'none';
            }
          }
          if (m.type === 'attributes' && m.target === this.el && m.attributeName === 'data-interaction-mode') {
            const attr = this.el.getAttribute('data-interaction-mode');
            if (attr === 'multi-action') {
              this.interactionMode = 'multi-action';
            } else if (!attr) {
              this.interactionMode = 'single-action';
            }
          }
          /* Either a child was added/removed OR a child's `slot=` attr
             changed — both can flip our render decision for the
             trailing wrapper. */
          if (m.type === 'childList') rescanSlots = true;
          if (m.type === 'attributes' && m.attributeName === 'slot' && m.target !== this.el) {
            rescanSlots = true;
          }
        }
        if (rescanSlots) {
          this.detectSlottedFromLightDom();
          this.syncExpandedContentSelectionMode();
          this.syncExpandedContentDividers();
        }
      });
      this.observer.observe(this.el, {
        attributes: true,
        attributeFilter: ['data-selection-mode', 'data-interaction-mode', 'slot'],
        childList: true,
        subtree: true,
      });
    }

    /* Single ResizeObserver on the host. Width changes are the only thing
       that can flip whether the headline / supporting text clips, so we
       observe the host and re-measure (debounced) on every resize. */
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleTruncationCheck());
      this.resizeObserver.observe(this.el);
    }

    /* Initial pass once layout has settled after first paint. */
    this.runTruncationCheck();
    this.syncExpandedContentSelectionMode();
    this.syncExpandedContentDividers();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.truncationDebounceTimer) {
      clearTimeout(this.truncationDebounceTimer);
      this.truncationDebounceTimer = 0;
    }
    if (this.truncationRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.truncationRaf);
      this.truncationRaf = 0;
    }
  }

  @Watch('selected')
  onSelectedChange(newVal: boolean) {
    if (this.expandable && newVal) {
      this.selected = false;
    }
  }

  @Watch('expandable')
  onExpandableChange() {
    if (this.expandable && this.selected) {
      this.selected = false;
    }
    this.syncExpandedContentSelectionMode();
    this.syncExpandedContentDividers();
  }

  @Watch('selectionMode')
  onSelectionModeChange() {
    this.syncExpandedContentSelectionMode();
  }

  @Watch('expanded')
  onExpandedChange(newVal: boolean, oldVal: boolean) {
    if (newVal !== oldVal) {
      this.mdExpand.emit(this.buildExpandDetail(newVal));
    }
  }

  @Watch('headline')
  onHeadlineChange() {
    this.scheduleTruncationCheck();
  }

  @Watch('supportingText')
  onSupportingTextChange() {
    this.scheduleTruncationCheck();
  }

  /**
   * The element that should receive DOM focus for this row: the inner primary
   * element for interactive non-selection rows (button / link / menuitem), or
   * the host for selection (`option`) and `reorderable` rows (which keep a
   * focusable host).
   */
  private resolveFocusTarget(): HTMLElement {
    if (this.hasPrimaryAction && this.primaryEl) return this.primaryEl;
    return this.el;
  }

  /**
   * Reliable imperative focus used by the parent `md-list`'s roving tabindex /
   * `activateNext` / `activatePrevious`. It does NOT depend on the async Stencil
   * render having flushed the roving `tabindex` onto the target: it ensures the
   * target is focusable *now* (adding a tabindex if the render hasn't written
   * one yet), then focuses it. This fixes the case where `md-list` calls
   * `.focus()` right after toggling `tabbable` — before the re-render — which
   * otherwise left focus on `<body>`.
   */
  @Method()
  async setFocus(options?: FocusOptions): Promise<void> {
    const target = this.resolveFocusTarget();
    if (!target) return;
    if (target.getAttribute('tabindex') === null) {
      target.setAttribute('tabindex', this.tabbable ? '0' : '-1');
    }
    target.focus(options);
  }

  /** Programmatically focus this row (delegates to {@link setFocus}). */
  @Method()
  async focusItem(): Promise<void> {
    await this.setFocus();
  }

  /** Toggles the `expanded` state. No-op when `expandable` is false. */
  @Method()
  async toggle(): Promise<void> {
    if (!this.expandable || this.isEffectivelyDisabled) return;
    this.expanded = !this.expanded;
  }

  /** Expand the row. No-op when `expandable` is false. */
  @Method()
  async expand(): Promise<void> {
    if (!this.expandable || this.isEffectivelyDisabled) return;
    this.expanded = true;
  }

  /** Collapse the row. No-op when `expandable` is false. */
  @Method()
  async collapse(): Promise<void> {
    if (!this.expandable || this.isEffectivelyDisabled) return;
    this.expanded = false;
  }

  /** True when `event` originated from an interactive trailing-slot control. */
  private isTrailingActionTarget(event: Event): boolean {
    const path = (
      typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
    ) as EventTarget[];

    for (const node of path) {
      if (!node || node === this.el || !this.isElementLike(node)) continue;

      let current: Element | null = node as Element;
      while (current && current !== this.el) {
        if (current.getAttribute('slot') === 'trailing' && this.isInteractiveTrailingElement(current)) {
          return true;
        }
        current = current.parentElement as Element | null;
      }
    }
    return false;
  }

  private isElementLike(node: EventTarget): node is Element {
    return typeof (node as Element).getAttribute === 'function';
  }

  private isInteractiveTrailingElement(el: Element): boolean {
    const tag = el.tagName;
    const INTERACTIVE_TAGS = new Set([
      'MD-ICON-BUTTON',
      'MD-SWITCH',
      'MD-CHECKBOX',
      'MD-BUTTON',
      'MD-FAB',
      'BUTTON',
      'A',
      'INPUT',
      'SELECT',
      'TEXTAREA',
    ]);
    if (INTERACTIVE_TAGS.has(tag)) return true;

    const htmlEl = el as HTMLElement;
    if (typeof htmlEl.tabIndex === 'number' && htmlEl.tabIndex >= 0) return true;

    const role = el.getAttribute('role');
    if (role === 'button' || role === 'switch' || role === 'checkbox' || role === 'menuitem') {
      return true;
    }
    return false;
  }

  private isDragHandleTarget(event: Event): boolean {
    const path = (
      typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
    ) as Array<EventTarget & { dataset?: DOMStringMap }>;
    return path.some(
      n => (n as HTMLElement)?.dataset?.listDragHandle === 'true',
    );
  }

  /** Flat `md-list-item` children slotted into `expanded-content`. */
  private getExpandedContentItems(): HTMLMdListItemElement[] {
    return Array.from(this.el.children).filter(
      child => child.tagName === 'MD-LIST-ITEM' && child.getAttribute('slot') === 'expanded-content',
    ) as HTMLMdListItemElement[];
  }

  /** True when `item` is a direct `expanded-content` child of this row. */
  private isExpandedContentChild(item: HTMLElement): boolean {
    return item.parentElement === this.el && item.getAttribute('slot') === 'expanded-content';
  }

  /** Propagate list selection mode to slotted expansion child rows. */
  private syncExpandedContentSelectionMode() {
    if (!this.expandable) return;
    const mode = this.selectionMode;
    this.getExpandedContentItems().forEach(child => {
      child.selectionMode = mode;
      if (mode === 'none') {
        child.removeAttribute('data-selection-mode');
      } else {
        child.setAttribute('data-selection-mode', mode);
      }
    });
  }

  /**
   * `md-divider`s slotted into `expanded-content` are decorative separators
   * between the nested rows. The panel that owns them is a `listbox` (selection
   * mode) or a `region`; a `separator` is not a permitted owned child of a
   * `listbox`, so mark them `aria-hidden` — mirroring how the parent `md-list`
   * treats its own interleaved dividers — so the nested container owns only its
   * rows. `aria-hidden` (not `role`) leaves `md-divider`'s shadow role intact
   * and keeps the hairline visible.
   */
  private syncExpandedContentDividers() {
    if (!this.expandable) return;
    Array.from(this.el.children).forEach(child => {
      if (
        child.tagName === 'MD-DIVIDER' &&
        child.getAttribute('slot') === 'expanded-content'
      ) {
        child.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /**
   * True when `event` originated from slotted `expanded-content` children
   * (child rows, dividers, etc.). Those activations must not toggle the
   * parent disclosure.
   */
  private isExpandedContentTarget(event: Event): boolean {
    const path = (
      typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
    ) as EventTarget[];

    const expandedContentRoots = Array.from(this.el.children).filter(
      child => child.getAttribute('slot') === 'expanded-content',
    );

    for (const node of path) {
      if (!node || node === this.el) continue;
      for (const root of expandedContentRoots) {
        if (node === root) return true;
        if (node instanceof Node && root.contains(node)) return true;
      }
    }
    return false;
  }

  /** True when `event` originated from the trailing caret icon-button. */
  private isExpandButtonTarget(event: Event): boolean {
    const path = (
      typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
    ) as Array<EventTarget & { dataset?: DOMStringMap }>;
    return path.some(
      n => (n as HTMLElement)?.dataset?.expandToggle === 'true',
    );
  }

  /** Toggles `expanded`. Shared by the row body, caret button, and methods. */
  private toggleExpanded() {
    if (!this.expandable || this.isEffectivelyDisabled) return;
    this.expanded = !this.expanded;
  }

  /**
   * Caret `md-icon-button` activation (pointer + keyboard). The icon-button
   * emits a composed `mdClick`; we stop it here so it does not surface as a
   * stray row-level `mdClick`, then drive the expansion from the single
   * source of truth.
   */
  private handleCaretToggle = (e: CustomEvent) => {
    e.stopPropagation();
    this.toggleExpanded();
  };

  /** Accessible label for the caret control, e.g. "Expand Settings". */
  private expandToggleLabel(): string {
    const action = this.expanded ? 'Collapse' : 'Expand';
    const name = this.headlineFullText();
    return name ? `${action} ${name}` : action;
  }

  /**
   * Child rows in `expanded-content` emit `mdItemClick` while bubbling.
   * Coordinate selection locally so the parent list is not addressed with a
   * wrong sibling index and the disclosure stays open.
   */
  @Listen('mdItemClick')
  onExpandedChildItemClick(event: CustomEvent<{ index: number; selected: boolean }>) {
    if (!this.expandable || this.selectionMode === 'none') return;

    const clickedItem = event
      .composedPath()
      .find(el => (el as HTMLElement)?.tagName === 'MD-LIST-ITEM') as HTMLMdListItemElement | undefined;
    if (!clickedItem || clickedItem === this.el || !this.isExpandedContentChild(clickedItem)) return;

    event.stopPropagation();

    const children = this.getExpandedContentItems();
    if (this.selectionMode === 'single-select') {
      children.forEach(child => {
        child.selected = child === clickedItem;
      });
    } else if (this.selectionMode === 'multi-select') {
      clickedItem.selected = !clickedItem.selected;
    }

    const childIndex = children.indexOf(clickedItem);
    this.mdItemSelect.emit({
      index: childIndex,
      value: clickedItem.headline || (clickedItem.textContent ?? '').trim(),
      selected: clickedItem.selected,
      item: clickedItem,
    });
  }

  private handleClick = (e: MouseEvent) => {
    if (!this.isInteractive) return;
    if (this.isEffectivelyDisabled) {
      e.preventDefault();
      return;
    }
    /* A click that bubbled up from the drag handle (e.g. a pointerup that the
       browser synthesised into a click after a tiny drag) must NOT activate
       the row. */
    if (this.isDragHandleTarget(e)) return;
    if (this.isTrailingActionTarget(e)) return;
    /* The caret md-icon-button owns its own toggle (see handleCaretToggle).
       Its native click still bubbles up to this row handler, so bail to
       avoid a second toggle that would cancel the first one out. */
    if (this.isExpandButtonTarget(e)) return;
    /* Child rows / dividers in expanded-content must not collapse the parent. */
    if (this.isExpandedContentTarget(e)) return;
    if (this.expandable) {
      this.expanded = !this.expanded;
      /* When the primary action is a real inner `<a href>` it navigates
         natively; only synthesize navigation for the legacy host-driven path
         (e.g. a reorderable link row, which has no inner anchor). */
      const href = sanitizeHref(this.href);
      if (this.type === 'link' && href && !this.hasPrimaryAction) {
        window.open(href, this.target, SAFE_WINDOW_FEATURES);
      }
      this.mdClick.emit({ item: this.el });
      /* Disclosure triggers must not bubble selection to md-list. */
      return;
    }
    const href = sanitizeHref(this.href);
    if (this.type === 'link' && href && !this.hasPrimaryAction) {
      window.open(href, this.target, SAFE_WINDOW_FEATURES);
    }
    this.mdClick.emit({ item: this.el });
    this.mdItemClick.emit({ index: this.computeIndex(), selected: this.selected });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    /* Keyboard reorder works for any reorderable row (even non-interactive
       text rows), so it is handled BEFORE the isInteractive gate. Alt+Arrow
       asks the parent list to move this row; the list ignores it when it is
       not reorderable. */
    if (this.reorderable && !this.isEffectivelyDisabled && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.mdItemRequestReorder.emit({
        direction: e.key === 'ArrowUp' ? 'up' : 'down',
        from: this.computeIndex(),
      });
      return;
    }
    if (!this.isInteractive) return;
    if (this.expandable && !this.isEffectivelyDisabled) {
      if (e.key === 'ArrowRight' && !this.expanded) {
        e.preventDefault();
        this.expanded = true;
        return;
      }
      if (e.key === 'ArrowLeft' && this.expanded) {
        e.preventDefault();
        this.expanded = false;
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isEffectivelyDisabled) {
        this.pressed = true;
        triggerRipple(this.el);
        /* Route activation through the inner `<a>` so a link row navigates
           natively (its click still bubbles to the host's onClick → mdClick).
           Button / menuitem / selection / expandable rows keep clicking the
           host, whose onClick handler is the single source of truth. */
        if (this.type === 'link' && this.primaryEl) {
          this.primaryEl.click();
        } else {
          this.el.click();
        }
        window.setTimeout(() => {
          this.pressed = false;
        }, 150);
      }
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (this.isExpandButtonTarget(e) || this.isTrailingActionTarget(e)) return;
    /* Child rows in expanded-content bubble pointerdown to this host; suppress
       the parent press affordance so the disclosure trigger does not flash. */
    if (this.isExpandedContentTarget(e)) return;
    if (this.isInteractive && !this.isEffectivelyDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  private handleFocus = () => {
    if (this.hostedByList && this.isInteractive) {
      this.mdRequestActivation.emit();
    }
  };

  private computeIndex(): number {
    const parent = this.el.parentElement;
    if (!parent) return 0;
    const items = Array.from(parent.children).filter(
      el => el.tagName === 'MD-LIST-ITEM',
    );
    return items.indexOf(this.el as unknown as HTMLMdListItemElement);
  }

  private buildExpandDetail(expanded: boolean): MdListItemExpandDetail {
    const item = this.el as HTMLMdListItemElement;
    const index = this.computeIndex();
    const value = this.headlineFullText();
    return {
      expanded,
      ...(index >= 0 ? { index } : {}),
      ...(value ? { value } : {}),
      item,
    };
  }

  private getSlottedText(slotName: string): string {
    const slot = this.el.shadowRoot?.querySelector(
      `slot[name="${slotName}"]`,
    ) as HTMLSlotElement | null;
    if (!slot) return '';
    try {
      return slot
        .assignedNodes()
        .map(node => node.textContent || '')
        .join('')
        .trim();
    } catch {
      return '';
    }
  }

  private getDefaultSlotText(): string {
    return Array.from(this.el.children)
      .filter(child => !child.hasAttribute('slot'))
      .map(child => child.textContent || '')
      .join('')
      .trim();
  }

  /** Full headline text — slotted content wins, else prop, else default slot. */
  private headlineFullText(): string {
    return this.hasSlottedHeadline
      ? this.getSlottedText('headline')
      : this.headline || this.getDefaultSlotText();
  }

  /** Full supporting text — slotted content wins, else prop. */
  private supportingFullText(): string {
    return this.hasSlottedSupportingText
      ? this.getSlottedText('supporting-text')
      : this.supportingText;
  }

  /* ----- Truncation → tooltip toggle -----
     `scheduleTruncationCheck` debounces ResizeObserver bursts (~100ms) so we
     don't measure on every layout tick. `runTruncationCheck` reads geometry
     inside a single rAF (avoiding layout thrash) then toggles each tooltip's
     `disabled` only when the clipped state flips. Falls back to a synchronous
     run when rAF is unavailable (jsdom / SSR). */
  private scheduleTruncationCheck = () => {
    if (this.truncationDebounceTimer) clearTimeout(this.truncationDebounceTimer);
    this.truncationDebounceTimer = (typeof setTimeout !== 'undefined'
      ? setTimeout(() => {
          this.truncationDebounceTimer = 0;
          this.runTruncationCheck();
        }, 100)
      : 0) as unknown as number;
  };

  private runTruncationCheck = () => {
    const measure = () => {
      this.truncationRaf = 0;
      this.applyTooltipToggle(
        this.headlineEl,
        this.headlineTooltipEl,
        'headlineTruncated',
        false,
      );
      this.applyTooltipToggle(
        this.supportingEl,
        this.supportingTooltipEl,
        'supportingTruncated',
        this.effectiveLines === 3,
      );
    };

    if (typeof requestAnimationFrame === 'function') {
      if (this.truncationRaf) cancelAnimationFrame(this.truncationRaf);
      this.truncationRaf = requestAnimationFrame(measure);
    } else {
      measure();
    }
  };

  /**
   * Compares scroll vs client size of `span` and flips `tooltip.disabled`
   * only when the truncated state actually changes. `checkBlock` adds a
   * height comparison for the line-clamped (3-line) supporting text. The
   * boolean guard lives on the instance (NOT @State) so updating it never
   * re-renders the list-item.
   */
  private applyTooltipToggle(
    span: HTMLElement | undefined,
    tooltip: HTMLMdTooltipElement | undefined,
    guardKey: 'headlineTruncated' | 'supportingTruncated',
    checkBlock: boolean,
  ) {
    if (!span || !tooltip) return;
    if (typeof span.scrollWidth !== 'number') return;

    const overflowing =
      span.scrollWidth > span.clientWidth ||
      (checkBlock && span.scrollHeight > span.clientHeight);

    /* Guard: bail unless the clipped state actually flipped. This is what
       keeps the DOM quiet during a resize sweep — md-tooltip.disabled is set
       at most once per truncation transition, never per ResizeObserver tick. */
    if (overflowing === this[guardKey]) return;
    this[guardKey] = overflowing;
    tooltip.disabled = !overflowing;
  }

  private renderLeading() {
    return (
      <span
        class={{
          'md-list-item__leading': true,
          'md-list-item__leading--empty': !this.hasLeadingContent,
        }}
        part="leading"
      >
        <slot name="leading">
          {(this.leadingAvatar || this.leadingAvatarLabel || this.leadingAvatarName) ? (
            <md-avatar
              class="md-list-item__avatar"
              exportparts="image: avatar-image, initials: avatar-initials, icon: avatar-icon"
              part="avatar"
              src={this.leadingAvatar || undefined}
              alt={this.leadingAvatarAlt || undefined}
              name={this.leadingAvatarName || undefined}
              initials={this.leadingAvatarLabel || undefined}
              size="medium"
              shape="circle"
            ></md-avatar>
          ) : this.leadingImage ? (
            <span class="md-list-item__image-wrap" part="image-wrap">
              <img
                class="md-list-item__image"
                part="image"
                src={this.leadingImage}
                alt={this.leadingImageAlt || ''}
                aria-hidden={!this.leadingImageAlt ? 'true' : null}
              />
              <span
                class="md-list-item__image-selection-indicator"
                part="image-selection-indicator"
                aria-hidden="true"
              >
                <span
                  class="md-list-item__image-selection-circle"
                  part="image-selection-circle"
                >
                  <span
                    class="md-list-item__image-selection-check material-symbols-outlined"
                    part="image-selection-check"
                    aria-hidden="true"
                  >
                    check
                  </span>
                </span>
              </span>
            </span>
          ) : this.leadingIcon ? (
            <span
              class="md-list-item__icon material-symbols-outlined"
              part="leading-icon"
              aria-hidden="true"
            >
              {this.leadingIcon}
            </span>
          ) : null}
        </slot>
      </span>
    );
  }

  private renderContent() {
    const showOverline = !!this.overline || this.hasSlottedOverline;
    const showSupporting = !!this.supportingText || this.hasSlottedSupportingText;
    /* Headline + supporting text are ALWAYS wrapped in a stable md-tooltip
       (never mounted/unmounted on resize → no DOM-swap flicker). The wrapper
       is made layout-transparent in CSS (.md-list-item__*-tooltip) so the
       inner span keeps its flex ellipsis behavior unchanged. Each tooltip
       starts `disabled` and is enabled imperatively ONLY while its text is
       actually clipped (see applyTooltipToggle). The `disabled={!truncated}`
       binding mirrors the imperative state so unrelated re-renders stay
       consistent — the `*Truncated` fields are plain (non-@State) so flipping
       them never triggers a re-render. The overline stays a plain span. */
    return (
      <span class="md-list-item__content" part="content">
        <span
          class={{
            'md-list-item__overline': true,
            'md-list-item__overline--empty': !showOverline,
          }}
          part="overline"
        >
          <slot name="overline">{this.overline}</slot>
        </span>
        <md-tooltip
          class="md-list-item__headline-tooltip"
          variant="plain"
          text={this.headlineFullText() || undefined}
          disabled={!this.headlineTruncated}
          exportparts="popup: headline-tooltip-popup"
          ref={el => (this.headlineTooltipEl = el as HTMLMdTooltipElement | undefined)}
        >
          <span
            class="md-list-item__headline"
            part="headline"
            ref={el => (this.headlineEl = el as HTMLSpanElement | undefined)}
          >
            <slot name="headline">{this.headline || <slot />}</slot>
          </span>
        </md-tooltip>
        <md-tooltip
          class={{
            'md-list-item__supporting-tooltip': true,
            'md-list-item__supporting-tooltip--empty': !showSupporting,
          }}
          variant="plain"
          text={this.supportingFullText() || undefined}
          disabled={!this.supportingTruncated}
          exportparts="popup: supporting-tooltip-popup"
          ref={el => (this.supportingTooltipEl = el as HTMLMdTooltipElement | undefined)}
        >
          <span
            class={{
              'md-list-item__supporting-text': true,
              'md-list-item__supporting-text--empty': !showSupporting,
            }}
            part="supporting-text"
            ref={el => (this.supportingEl = el as HTMLSpanElement | undefined)}
          >
            <slot name="supporting-text">{this.supportingText}</slot>
          </span>
        </md-tooltip>
      </span>
    );
  }

  private renderTrailing() {
    /* Skip the wrapper entirely when nothing wants to live there. Keeps
       the row's shadow DOM clean (no phantom <span> with display:none)
       and lets the row's flex `gap` collapse naturally between leading
       and content. The light-DOM MutationObserver re-renders if a
       trailing slot child is added later. */
    if (!this.hasTrailingContent) return null;

    const showTrailingText = !!this.trailingSupportingText || this.hasSlottedTrailingSupportingText;
    return (
      <span class="md-list-item__trailing" part="trailing">
        <slot name="trailing">
          {showTrailingText && (
            <span class="md-list-item__trailing-text" part="trailing-supporting-text">
              <slot name="trailing-supporting-text">{this.trailingSupportingText}</slot>
            </span>
          )}
          {this.trailingIcon && (
            <span
              class="md-list-item__trailing-icon material-symbols-outlined"
              part="trailing-icon"
              aria-hidden="true"
            >
              {this.trailingIcon}
            </span>
          )}
        </slot>
        {this.expandable && (
          <md-icon-button
            class={{
              'md-list-item__expand-button': true,
              'md-list-item__expand-button--expanded': this.expanded,
            }}
            part="expand-button"
            exportparts="state-layer:expand-button-state-layer,icon:expand-button-icon"
            data-expand-toggle="true"
            variant="standard"
            size="xs"
            buttonWidth="narrow"
            icon="expand_more"
            selected={this.expanded}
            disabled={this.isEffectivelyDisabled}
            aria-expanded={this.expanded ? 'true' : 'false'}
            aria-controls={this.expandedPanelId}
            aria-label={this.expandToggleLabel()}
            onMdClick={this.handleCaretToggle}
          ></md-icon-button>
        )}
        {this.reorderable && (
          <span
            class="md-list-item__drag-handle material-symbols-outlined"
            part="drag-handle"
            data-list-drag-handle="true"
            aria-hidden="true"
          >
            drag_indicator
          </span>
        )}
      </span>
    );
  }

  /**
   * Inner primary-action element for plain non-selection interactive rows
   * (`type="button"` / `type="link"`) inside a `role="list"`. It is the ARIA
   * widget — a `role="button"` span or a real `<a href>` link — and the
   * roving-tabindex focus target, wrapping the leading + content clusters. The
   * trailing controls stay SIBLINGS of this element inside the row, so the host
   * owns `[primary-action, trailing-controls]` as two peer focusables (never
   * nested → no axe `nested-interactive`). NOT rendered for selection / menu /
   * reorderable rows — those make the HOST the widget instead (see
   * {@link hasPrimaryAction}).
   *
   * Click / keydown / pointer handlers stay on the HOST (they catch the primary
   * element's bubbled events, and `host.click()` still drives them for spec +
   * programmatic use); only `focus` is wired here because it doesn't bubble.
   * Ripple, state layer and focus ring remain host/row-level so their visuals
   * are unchanged.
   */
  private renderPrimary(tabIndex: string | null) {
    const setRef = (el?: HTMLElement) => (this.primaryEl = el);
    if (this.type === 'link') {
      /* An unsafe URL renders the anchor without `href`, which leaves it
         inert — preferable to dropping the element, since the row keeps its
         layout, ripple and focus behaviour. */
      const href = sanitizeHref(this.href);
      return (
        <a
          class="md-list-item__primary"
          part="primary"
          role="link"
          href={href}
          target={href ? this.target : undefined}
          rel={href && this.target ? SAFE_LINK_REL : undefined}
          tabindex={tabIndex ?? undefined}
          aria-disabled={this.isEffectivelyDisabled ? 'true' : null}
          onFocus={this.handleFocus}
          ref={el => setRef(el as HTMLElement | undefined)}
        >
          {this.renderLeading()}
          {this.renderContent()}
        </a>
      );
    }
    return (
      <span
        class="md-list-item__primary"
        part="primary"
        role="button"
        tabindex={tabIndex ?? undefined}
        aria-disabled={this.isEffectivelyDisabled ? 'true' : null}
        onFocus={this.handleFocus}
        ref={el => setRef(el as HTMLElement | undefined)}
      >
        {this.renderLeading()}
        {this.renderContent()}
      </span>
    );
  }

  render() {
    const lines = this.effectiveLines;
    const isInteractive = this.isInteractive;

    /* WAI-ARIA list model: for a non-selection list the HOST is a STRUCTURAL
       role — never a widget role. Interactive rows (`type="button"` /
       `type="link"`) expose their widget role on an inner primary element (see
       {@link hasPrimaryAction} / renderPrimary), so a `role="list"` container
       validly owns only listitems, and any trailing controls stay focusable
       SIBLINGS of that primary rather than nested inside a `role="button"` host
       (axe `nested-interactive`).

       Host role:
         - selection row → `option` (host IS the widget),
         - inside a `menu` / `menubar` (role-override), an interactive row → the
           HOST is the `menuitem` (host IS the widget, like `option`). A `menu`
           owns its direct light-DOM children (the hosts), and a `menuitem`
           buried in the host's shadow DOM is NOT owned by the menu — so `none`
           host + inner menuitem fails `aria-required-children` on the menu. No
           inner primary is rendered for menu rows (`hasPrimaryAction` is false).
         - otherwise → `listitem`. */
    const hasPrimaryAction = this.hasPrimaryAction;
    const isMenuItemRow =
      this.isMenuContext && !this.participatesInSelection && (this.type === 'button' || this.type === 'link');
    let role: string | null;
    if (this.participatesInSelection) {
      role = 'option';
    } else if (isMenuItemRow) {
      role = 'menuitem';
    } else {
      role = 'listitem';
    }

    /* Expandable-only text rows are toggled via the focusable caret button
       (and as a convenience, a pointer click on the row body). The host
       itself is NOT a keyboard tab stop in that case — the caret is. Rows
       that are independently interactive (button/link/selection) or
       reorderable keep their own focusability. */
    const isExpandableOnly =
      this.expandable && !this.participatesInSelection && this.type === 'text';

    /* `aria-selected` is only a permitted attribute on roles that support a
       selected state (here, `option`). Emitting it on a `listitem` / `menuitem`
       host (e.g. a standalone `type="button"` row with the `selected` prop) is
       invalid ARIA (`aria-allowed-attr`). The `selected` prop still drives the
       visual `--selected` tint via its host class — only the ARIA reflection is
       gated on the role actually being `option`. */
    const ariaSelected = this.participatesInSelection
      ? this.selected
        ? 'true'
        : 'false'
      : null;

    /* Roving tab stop. Reorderable rows are focusable (even plain text rows) so
       keyboard reorder (Alt+Arrow) has a focus target; expandable-only rows
       defer focus to the caret button. The resulting `tabindex` lands on the
       INNER primary element for `hasPrimaryAction` rows and on the HOST for the
       host-widget rows — selection (option), menu (menuitem), reorderable. */
    const focusable = (isInteractive && !isExpandableOnly) || this.reorderable;
    const rovingTabIndex = focusable ? (this.tabbable ? '0' : '-1') : null;
    const hostTabIndex = hasPrimaryAction ? null : rovingTabIndex;
    const primaryTabIndex = hasPrimaryAction ? rovingTabIndex : null;

    /* Expanded-panel role. Its slotted `md-list-item` rows render as
       `role="listitem"`, whose ONLY valid axe context is `role="list"`
       (`group`/`region` fail `aria-required-parent` — verified against
       axe-core's `requiredContext: ['list']`). So the panel is a `list` when it
       holds those rows, in BOTH selection and non-selection modes. For
       arbitrary slotted content (no list-item rows) it stays a `region`
       (non-selection) / `group` (selection) — neither of which requires an
       owned role, so a bare FAQ/`<div>` panel can't trip `aria-required-children`. */
    const panelRole = this.hasExpandedListItemChildren
      ? 'list'
      : this.inSelectionMode
        ? 'group'
        : 'region';
    const panelLabel =
      panelRole === 'region' ? undefined : this.headlineFullText() || undefined;

    return (
      <Host
        class={{
          'md-list-item': true,
          [`md-list-item--${lines}-line`]: true,
          [`md-list-item--type-${this.type}`]: true,
          'md-list-item--selection-mode': this.participatesInSelection,
          'md-list-item--multi-action': this.isMultiAction,
          'md-list-item--interactive': isInteractive,
          'md-list-item--disabled': this.disabled || this.softDisabled,
          'md-list-item--soft-disabled': this.softDisabled,
          'md-list-item--selected': this.selected && !this.expandable,
          'md-list-item--pressed': this.pressed,
          'md-list-item--with-leading': this.hasLeadingContent,
          'md-list-item--with-trailing': this.hasTrailingContent,
          'md-list-item--with-avatar':
            !!this.leadingAvatar || !!this.leadingAvatarLabel || !!this.leadingAvatarName,
          'md-list-item--with-image': !!this.leadingImage,
          'md-list-item--with-video': this.hasLeadingVideo,
          'md-list-item--expandable': this.expandable,
          'md-list-item--expanded': this.expandable && this.expanded,
          'md-list-item--reorderable': this.reorderable,
          'md-list-item--roving-focus-visible': this.rovingFocusVisible,
        }}
        role={role}
        aria-disabled={this.isEffectivelyDisabled ? 'true' : null}
        aria-selected={ariaSelected}
        tabindex={hostTabIndex}
        onClick={isInteractive ? this.handleClick : undefined}
        onKeyDown={isInteractive || this.reorderable ? this.handleKeyDown : undefined}
        onPointerDown={isInteractive ? this.handlePointerDown : undefined}
        onPointerUp={isInteractive ? this.handlePointerUp : undefined}
        onPointerLeave={isInteractive ? this.handlePointerUp : undefined}
        onPointerCancel={isInteractive ? this.handlePointerUp : undefined}
        /* When the tab stop is the inner primary element, focus lands there —
           `focus` doesn't bubble, so handleFocus is wired on the primary in
           renderPrimary. The host keeps onFocus for selection / reorderable
           rows, which focus the host directly. */
        onFocus={isInteractive && !hasPrimaryAction ? this.handleFocus : undefined}
      >
        <span class="md-list-item__row" part="row">
          {isInteractive && <md-ripple disabled={this.isEffectivelyDisabled}></md-ripple>}
          {isInteractive && (
            <span class="md-list-item__state-layer" part="state-layer" aria-hidden="true"></span>
          )}

          {hasPrimaryAction && this.renderPrimary(primaryTabIndex)}
          {!hasPrimaryAction && this.renderLeading()}
          {!hasPrimaryAction && this.renderContent()}
          {this.renderTrailing()}
        </span>

        {this.expandable && (
          <span
            class="md-list-item__expanded-panel"
            part="expanded-panel"
            id={this.expandedPanelId}
            /* The disclosed panel owns the row's slotted content. When that
               content is flat `md-list-item` rows they render as `listitem`,
               whose only valid axe context is `list` (verified against
               axe-core `requiredContext: ['list']`) — so the panel is a `list`
               in BOTH selection and non-selection modes. For arbitrary content
               it is a `region` (non-selection) / `group` (selection); neither
               requires an owned role, so a plain `<div>`/FAQ panel can't trip
               `aria-required-children`. Interleaved dividers are `aria-hidden`
               (see syncExpandedContentDividers) so a `list` owns only its rows. */
            role={panelRole}
            aria-label={panelLabel}
            hidden={!this.expanded}
          >
            <span class="md-list-item__expanded-panel-inner" part="expanded-panel-inner">
              <slot name="expanded-content" />
            </span>
          </span>
        )}
      </Host>
    );
  }
}

import {
  Component,
  Host,
  h,
  Prop,
  State,
  Element,
  Listen,
  Watch,
  Event,
  EventEmitter,
} from '@stencil/core';

export interface MdAccordionDragDetail {
  /** Pointer X in viewport coordinates */
  clientX: number;
  /** Pointer Y in viewport coordinates */
  clientY: number;
  /** Accordion's current X translation (px) */
  x: number;
  /** Accordion's current Y translation (px) */
  y: number;
  /** Distance dragged since drag start, X */
  dx: number;
  /** Distance dragged since drag start, Y */
  dy: number;
}

let _floatingZ = 1000;

@Component({
  tag: 'md-accordion',
  styleUrl: 'md-accordion.css',
  shadow: true,
})
export class MdAccordion {
  @Element() el!: HTMLElement;

  /**
   * Visual variant. Both share the same expand/collapse mechanics.
   * - `filled` (default) — each item is a tonal surface tile.
   * - `outlined` — items share a single rounded chassis with an outline.
   */
  @Prop({ reflect: true }) variant: 'filled' | 'outlined' = 'filled';

  /**
   * Density scale: `0` (default, 56 dp headers), `-1` (48 dp),
   * `-2` (40 dp).
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * MD3 elevation level applied to the surface — `0` (default, flat)
   * through `5` (highest). In the `filled` variant each item gets its
   * own shadow; in the `outlined` variant the shadow is drawn on the
   * shared chassis. Expanded items lift to the next elevation level
   * for an expressive "lift off the page" affordance.
   */
  @Prop({ reflect: true }) elevation: 0 | 1 | 2 | 3 | 4 | 5 = 0;

  /**
   * Allow drag-to-reorder of items via the leading drag handles. Items
   * can also be reordered with `Alt + ArrowUp / ArrowDown` while the
   * header is focused. Disabled items can't be moved.
   */
  @Prop({ reflect: true }) reorderable: boolean = false;

  /**
   * Render the accordion as a free-floating panel that can be dragged
   * anywhere on the screen via the top drag-bar. The panel uses
   * `position: fixed` and translates via CSS transform, so it lifts
   * out of normal document flow.
   */
  @Prop({ reflect: true }) floating: boolean = false;

  /**
   * Initial X translation (px) for floating panels — measured in
   * PHYSICAL viewport coordinates from the top-left corner of the
   * viewport, so a positive value always moves the panel to the
   * right regardless of writing direction (LTR or RTL). Default: 24.
   */
  @Prop({ attribute: 'initial-x' }) initialX: number = 24;

  /**
   * Initial Y translation (px) for floating panels — measured in
   * physical viewport coordinates from the top-left corner. Default: 24.
   */
  @Prop({ attribute: 'initial-y' }) initialY: number = 24;

  /**
   * When a floating accordion starts being dragged, bring it to the
   * front by bumping `z-index`. Disable if you manage stacking
   * yourself.
   */
  @Prop({ attribute: 'bring-to-front' }) bringToFront: boolean = true;

  /**
   * Whether only one item may be expanded at a time. When `true`,
   * expanding an item collapses any other expanded item.
   */
  @Prop({ reflect: true }) exclusive: boolean = false;

  /**
   * Require at least one item to remain expanded. APG variant: the
   * implementation does not permit the currently-open panel to be
   * collapsed when doing so would leave zero panels open. The locked-
   * open button advertises `aria-disabled="true"`. Pairs naturally
   * with `exclusive` to enforce "exactly one panel is always open".
   */
  @Prop({ reflect: true, attribute: 'keep-one-expanded' }) keepOneExpanded: boolean = false;

  /**
   * ARIA heading level for each item's heading wrapper (`<h1>`–`<h6>`).
   * Pick the value matching the page's information architecture — e.g.
   * `2` inside a top-level page section, `4` deep inside a card. APG:
   * "aria-level that is appropriate for the information architecture
   * of the page". Default `3`.
   */
  @Prop({ attribute: 'heading-level' }) headingLevel: 1 | 2 | 3 | 4 | 5 | 6 = 3;

  /**
   * Region-role policy for panels:
   * - `auto` (default) — applies `role="region"` only when the item
   *   count is at or below `region-threshold`, otherwise downgrades
   *   to `role="group"` to avoid landmark proliferation (per APG
   *   recommendation for accordions with more than ~6 panels).
   * - `always` — every panel is a landmark region.
   * - `never` — no panel carries a region role (still labelled via
   *   `aria-labelledby` though).
   */
  @Prop({ reflect: true }) region: 'auto' | 'always' | 'never' = 'auto';

  /**
   * Threshold above which `region="auto"` downgrades panel roles
   * from `region` to `group`. APG suggests ~6.
   */
  @Prop({ attribute: 'region-threshold' }) regionThreshold: number = 6;

  /**
   * Motion preset applied when items expand and collapse. The prop
   * is reflected so the item CSS can pick it up via
   * `:host-context(md-accordion[transition="…"])`.
   *
   * - `expressive` (default) — full MD3 Expressive choreography:
   *    asymmetric easing (decelerate-on-open, accelerate-on-close),
   *    spring-spatial chevron rotation, container shape & elevation
   *    morph, leading-icon FILL-axis swap. Use for hero surfaces,
   *    settings shells, anything that wants to feel premium.
   * - `standard` — MD3 standard easing (symmetric `emphasized`) with
   *    no spring overshoot. Container morph still happens. The
   *    "neutral" preset — good default for dense product UI.
   * - `fade` — content fades in/out alongside the height animation
   *    using shorter `standard` easing. Chevron rotates without a
   *    spring. Best for content-heavy panels (forms, long copy)
   *    where the motion should be unobtrusive.
   * - `collapse` — pure height collapse with simple `ease-in-out`
   *    timing — no spring, no morph, no fade. The classic
   *    "browser disclosure" look.
   * - `none` — disables every transition (instant snap). Useful for
   *    automated tests, screenshot harnesses, or environments where
   *    motion is undesirable.
   */
  @Prop({ reflect: true }) transition: 'expressive' | 'standard' | 'fade' | 'collapse' | 'none' = 'expressive';

  /**
   * Comma-separated list of item indexes that should be expanded on
   * first render. Items with `expanded` set in their own attribute
   * also count.
   */
  @Prop({ attribute: 'default-expanded' }) defaultExpanded: string = '';

  /**
   * Emitted when an item expands or collapses. Detail carries the
   * full set of expanded indices.
   */
  @Event() mdToggle: EventEmitter<{
    index: number;
    expanded: boolean;
    expandedIndices: number[];
  }>;

  /**
   * Emitted when items are reordered via drag-and-drop or keyboard
   * (Alt+ArrowUp / Alt+ArrowDown). `order` is the new index sequence
   * relative to the original order, e.g. moving the item that was at
   * index 0 to index 2 yields `order: [1, 2, 0]`.
   */
  @Event() mdReorder: EventEmitter<{
    from: number;
    to: number;
    order: number[];
  }>;

  /** Emitted once a floating panel starts being dragged. */
  @Event() mdDragStart: EventEmitter<MdAccordionDragDetail>;

  /** Emitted continuously while a floating panel is being dragged. */
  @Event() mdDragMove: EventEmitter<MdAccordionDragDetail>;

  /** Emitted when a floating panel is released. */
  @Event() mdDragEnd: EventEmitter<MdAccordionDragDetail>;

  @State() private chassisX = 0;
  @State() private chassisY = 0;
  @State() private chassisDragging = false;

  /**
   * Geometry of the drop-target ghost shown in the dragged item's vacated
   * slot during a pointer reorder — the same affordance md-list renders, so
   * the two reorder surfaces read alike. `top` is measured from the
   * accordion's own border box; `null` when no drag is active.
   */
  @State() private dropPlaceholder: { top: number; height: number } | null = null;

  private items: HTMLMdAccordionItemElement[] = [];
  private originalOrder: HTMLMdAccordionItemElement[] = [];
  private dragState: {
    item: HTMLMdAccordionItemElement;
    pointerId: number;
    startY: number;
    startRects: DOMRect[];
    shiftDistance: number;
    /** Accordion border-box block-start at drag start — the placeholder origin. */
    hostTop: number;
    fromIndex: number;
    currentTarget: number;
  } | null = null;
  private chassisDragState: {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null = null;

  connectedCallback() {
    this.collectItems();
    this.el.addEventListener('pointerdown', this.onPointerDown);
    this.el.addEventListener(
      'mdItemRequestReorder',
      this.onKeyboardReorder as EventListener,
    );
  }

  disconnectedCallback() {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener(
      'mdItemRequestReorder',
      this.onKeyboardReorder as EventListener,
    );
    this.cancelDrag();
  }

  componentDidLoad() {
    this.collectItems();
    this.originalOrder = [...this.items];
    // IMPORTANT: assign indexes BEFORE applying initial state. The
    // child `@Watch('expanded')` fires synchronously and emits
    // `mdItemToggle` carrying `this.index`, which the parent's
    // exclusive-mode listener uses to decide which other items to
    // collapse. If indexes are still -1 at that moment, the listener
    // collapses every item — including the one we just expanded.
    this.assignIndexes();
    this.applyInitialState();
    this.syncChildren();
    // Seed floating-mode position from the initial-x / initial-y props.
    if (this.floating) {
      this.chassisX = this.initialX;
      this.chassisY = this.initialY;
      if (this.bringToFront) {
        this.el.style.zIndex = String(++_floatingZ);
      }
    }
  }

  @Watch('floating')
  onFloatingChange(value: boolean) {
    if (value) {
      this.chassisX = this.initialX;
      this.chassisY = this.initialY;
    } else {
      this.chassisX = 0;
      this.chassisY = 0;
      this.el.style.zIndex = '';
    }
    // Toggle the chassis-drag glyph on / off the first item.
    this.applyChassisHandleMarker();
  }

  @Watch('exclusive')
  onExclusiveChange(value: boolean) {
    if (!value) return;
    // Switching INTO exclusive mode while multiple items are open is
    // ambiguous; we keep the first expanded item open and collapse the
    // rest so the resulting state is internally consistent.
    let kept = false;
    this.items.forEach((it) => {
      if (it.expanded) {
        if (kept) it.expanded = false;
        else kept = true;
      }
    });
  }

  @Listen('mdItemToggle')
  onChildToggle(e: CustomEvent<{ expanded: boolean; index: number }>) {
    const { expanded, index } = e.detail;
    if (this.exclusive && expanded) {
      this.items.forEach((it, i) => {
        if (i !== index) it.expanded = false;
      });
    }
    // Recompute which item is locked-open after every state change, so
    // `aria-disabled` and the click-guard stay in sync with reality.
    this.syncCollapsible();
    const expandedIndices = this.items
      .map((it, i) => (it.expanded ? i : -1))
      .filter((i) => i >= 0);
    this.mdToggle.emit({ index, expanded, expandedIndices });
  }

  @Listen('mdItemRequestFocus')
  onChildRequestFocus(
    e: CustomEvent<{ direction: 'next' | 'prev' | 'first' | 'last'; from: number }>,
  ) {
    const { direction, from } = e.detail;
    if (this.items.length === 0) return;
    let target: number;
    if (direction === 'first') target = 0;
    else if (direction === 'last') target = this.items.length - 1;
    else if (direction === 'next') target = (from + 1) % this.items.length;
    else
      target =
        (from - 1 + this.items.length) % this.items.length;
    this.items[target]?.focusHeader();
  }

  private collectItems() {
    // Iterate direct children rather than using `:scope > md-accordion-item`.
    // The CSS `:scope` pseudo-class is fully supported by modern browsers,
    // but Stencil's mock-doc (Sizzle-based) and a handful of older test
    // engines don't implement it — picking children manually keeps the
    // semantics identical and lets the component remain unit-testable.
    const out: HTMLMdAccordionItemElement[] = [];
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      const node = children[i] as HTMLElement;
      if (node && node.tagName === 'MD-ACCORDION-ITEM') {
        out.push(node as HTMLMdAccordionItemElement);
      }
    }
    this.items = out;
  }

  private assignIndexes() {
    this.items.forEach((it, i) => {
      it.setAttribute('data-index', String(i));
    });
    this.applyChassisHandleMarker();
  }

  /**
   * In `floating` mode the chassis-drag affordance is tucked into the
   * FIRST item rather than living in a dedicated bar. We mark that
   * item with `data-chassis-handle` so its CSS reveals the grip glyph
   * and the parent's pointerdown listener (which scans `composedPath`
   * for `data-accordion-chassis-drag`) picks it up. The attribute is
   * re-applied after every reorder so the marker follows whichever
   * item is currently at position 0.
   */
  private applyChassisHandleMarker() {
    this.items.forEach((it, i) => {
      if (this.floating && i === 0) {
        it.setAttribute('data-chassis-handle', '');
      } else {
        it.removeAttribute('data-chassis-handle');
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     Drag-to-reorder
     - Listens for pointerdown on the host (events from children
       bubble across the shadow boundary via composedPath()).
     - Uses snapshotted rects to compute drop target so the live
       transforms applied during the drag don't confuse subsequent
       hit-testing.
     - Reorders DOM only once on drop; siblings animate into place
       via the .md-accordion-item--shifting class.
     ────────────────────────────────────────────────────────── */

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    const path = e.composedPath() as Array<EventTarget & { dataset?: DOMStringMap }>;

    // Item-reorder takes precedence — the per-item drag handle lives
    // INSIDE an item's shadow root and is matched by a data attribute.
    if (this.reorderable) {
      const handle = path.find(
        (n) => (n as HTMLElement)?.dataset?.accordionDragHandle === 'true',
      ) as HTMLElement | undefined;
      if (handle) {
        this.startItemDrag(e, path);
        return;
      }
    }

    // Free-form chassis drag — the affordance is a small grip on the
    // first item that carries `data-accordion-chassis-drag`. Anything
    // else (header click, headline tap, etc.) keeps its normal behaviour.
    if (this.floating) {
      const handle = path.find(
        (n) => (n as HTMLElement)?.dataset?.accordionChassisDrag === 'true',
      ) as HTMLElement | undefined;
      if (handle) {
        this.startChassisDrag(e);
        return;
      }
    }
  };

  private startItemDrag(
    e: PointerEvent,
    path: Array<EventTarget & { dataset?: DOMStringMap }>,
  ) {
    const item = path.find(
      (n) => (n as HTMLElement)?.tagName === 'MD-ACCORDION-ITEM',
    ) as HTMLMdAccordionItemElement | undefined;
    if (!item || item.hasAttribute('disabled')) return;

    this.collectItems();
    const fromIndex = this.items.indexOf(item);
    if (fromIndex < 0 || this.items.length < 2) return;

    e.preventDefault();

    const startRects = this.items.map((it) => it.getBoundingClientRect());
    // Distance to shift other items when the dragged one passes them.
    // Use the gap between successive items (which already includes any
    // CSS margin/border between siblings), falling back to the item's
    // own height when there's only one neighbour.
    const fromRect = startRects[fromIndex];
    const refRect =
      fromIndex < this.items.length - 1
        ? startRects[fromIndex + 1]
        : startRects[fromIndex - 1];
    const shiftDistance =
      refRect && fromIndex < this.items.length - 1
        ? refRect.top - fromRect.top
        : fromRect.top - (refRect?.top ?? fromRect.top);

    const hostTop = this.el.getBoundingClientRect().top;

    this.dragState = {
      item,
      pointerId: e.pointerId,
      startY: e.clientY,
      startRects,
      shiftDistance: Math.abs(shiftDistance) || fromRect.height,
      fromIndex,
      currentTarget: fromIndex,
      hostTop,
    };

    // Open the ghost slot where the item was lifted from; it then tracks the
    // insertion point as the drag crosses sibling centres.
    this.dropPlaceholder = {
      top: fromRect.top - hostTop,
      height: fromRect.height,
    };

    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture is best-effort */
    }
    this.el.addEventListener('pointermove', this.onPointerMove);
    this.el.addEventListener('pointerup', this.onPointerUp);
    this.el.addEventListener('pointercancel', this.onPointerUp);

    item.classList.add('md-accordion-item--dragging');
    this.items.forEach((it) => {
      if (it !== item) it.classList.add('md-accordion-item--shifting');
    });
  }

  private startChassisDrag(e: PointerEvent) {
    if (this.chassisDragState) return;
    e.preventDefault();

    this.chassisDragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: this.chassisX,
      startY: this.chassisY,
    };
    this.chassisDragging = true;

    if (this.bringToFront) {
      this.el.style.zIndex = String(++_floatingZ);
    }

    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* best-effort */
    }
    this.el.addEventListener('pointermove', this.onChassisPointerMove);
    this.el.addEventListener('pointerup', this.onChassisPointerUp);
    this.el.addEventListener('pointercancel', this.onChassisPointerUp);

    this.mdDragStart.emit({
      clientX: e.clientX,
      clientY: e.clientY,
      x: this.chassisX,
      y: this.chassisY,
      dx: 0,
      dy: 0,
    });
  }

  private onChassisPointerMove = (e: PointerEvent) => {
    const s = this.chassisDragState;
    if (!s) return;
    const dx = e.clientX - s.startClientX;
    const dy = e.clientY - s.startClientY;

    this.chassisX = s.startX + dx;
    this.chassisY = s.startY + dy;

    this.mdDragMove.emit({
      clientX: e.clientX,
      clientY: e.clientY,
      x: this.chassisX,
      y: this.chassisY,
      dx,
      dy,
    });
  };

  private onChassisPointerUp = (e: PointerEvent) => {
    const s = this.chassisDragState;
    if (!s) return;

    this.el.removeEventListener('pointermove', this.onChassisPointerMove);
    this.el.removeEventListener('pointerup', this.onChassisPointerUp);
    this.el.removeEventListener('pointercancel', this.onChassisPointerUp);
    try {
      this.el.releasePointerCapture(s.pointerId);
    } catch {
      /* best-effort */
    }

    const dx = e.clientX - s.startClientX;
    const dy = e.clientY - s.startClientY;

    this.chassisDragState = null;
    this.chassisDragging = false;

    this.mdDragEnd.emit({
      clientX: e.clientX,
      clientY: e.clientY,
      x: this.chassisX,
      y: this.chassisY,
      dx,
      dy,
    });
  };

  private onPointerMove = (e: PointerEvent) => {
    const s = this.dragState;
    if (!s) return;

    const dy = e.clientY - s.startY;
    s.item.style.transform = `translateY(${dy}px)`;

    const origRect = s.startRects[s.fromIndex];
    const draggedCenter = origRect.top + origRect.height / 2 + dy;

    let target = s.fromIndex;
    if (dy > 0) {
      for (let i = s.fromIndex + 1; i < this.items.length; i++) {
        const r = s.startRects[i];
        if (draggedCenter > r.top + r.height / 2) target = i;
        else break;
      }
    } else if (dy < 0) {
      for (let i = s.fromIndex - 1; i >= 0; i--) {
        const r = s.startRects[i];
        if (draggedCenter < r.top + r.height / 2) target = i;
        else break;
      }
    }

    if (target !== s.currentTarget) {
      s.currentTarget = target;
      this.applySiblingShifts();
      // The vacated slot opens at the resting top of the item currently at the
      // target index — the siblings in between have already shifted one step.
      this.dropPlaceholder = {
        top: s.startRects[target].top - s.hostTop,
        height: s.startRects[s.fromIndex].height,
      };
    }
  };

  private applySiblingShifts() {
    const s = this.dragState;
    if (!s) return;
    this.items.forEach((it, i) => {
      if (it === s.item) return;
      let offset = 0;
      if (s.currentTarget > s.fromIndex && i > s.fromIndex && i <= s.currentTarget) {
        offset = -s.shiftDistance;
      } else if (
        s.currentTarget < s.fromIndex &&
        i < s.fromIndex &&
        i >= s.currentTarget
      ) {
        offset = s.shiftDistance;
      }
      it.style.transform = offset ? `translateY(${offset}px)` : '';
    });
  }

  private onPointerUp = (e: PointerEvent) => {
    const s = this.dragState;
    if (!s) return;

    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerUp);
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* releasePointerCapture is best-effort */
    }

    this.items.forEach((it) => {
      it.style.transform = '';
      it.classList.remove('md-accordion-item--shifting');
    });
    s.item.classList.remove('md-accordion-item--dragging');

    // Drop the ghost in the same tick the item settles — this path does NOT go
    // through cancelDrag(), so clearing it there alone left it on screen after
    // every successful drop.
    this.dropPlaceholder = null;

    if (s.currentTarget !== s.fromIndex) {
      this.moveItem(s.fromIndex, s.currentTarget);
      this.emitReorder(s.fromIndex, s.currentTarget);
    }

    this.dragState = null;
  };

  private cancelDrag() {
    const s = this.dragState;
    if (!s) return;
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerUp);
    this.items.forEach((it) => {
      it.style.transform = '';
      it.classList.remove('md-accordion-item--shifting');
    });
    s.item.classList.remove('md-accordion-item--dragging');
    // Dropped in the same tick the item settles, so there is no leftover ghost
    // and no flash between the drop and the re-layout.
    this.dropPlaceholder = null;
    this.dragState = null;
  }

  private moveItem(from: number, to: number) {
    if (from === to) return;
    const item = this.items[from];
    if (!item) return;
    const ref =
      to > from
        ? this.items[to].nextElementSibling
        : this.items[to];
    this.el.insertBefore(item, ref);
    this.collectItems();
    this.assignIndexes();
  }

  private emitReorder(from: number, to: number) {
    // Re-express the new DOM order in terms of the original indices.
    const order = this.items.map((it) => this.originalOrder.indexOf(it));
    this.mdReorder.emit({ from, to, order });
  }

  private onKeyboardReorder = (
    e: CustomEvent<{ direction: 'up' | 'down'; from: number }>,
  ) => {
    if (!this.reorderable) return;
    const { direction, from } = e.detail;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= this.items.length) return;
    this.moveItem(from, to);
    this.items[to]?.focusHeader();
    this.emitReorder(from, to);
  };

  private applyInitialState() {
    // Parse the `default-expanded` attribute. Important: an EMPTY
    // string splits to [''], which would map to [0] (because Number('')
    // is 0), unintentionally auto-expanding the first item. Trim and
    // drop blanks before converting.
    const fromAttr = (this.defaultExpanded || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 0);

    // Compute the FINAL expanded set up front. Setting `expanded` on
    // children fires their @Watch which bubbles `mdItemToggle` and
    // re-enters our @Listen — in exclusive mode that would race
    // against ourselves and leave only the LAST item open. Computing
    // the target set first sidesteps the race entirely.
    const targetExpanded = new Set<number>();
    this.items.forEach((it, i) => {
      if (fromAttr.includes(i) || it.expanded) targetExpanded.add(i);
    });

    if (this.exclusive && targetExpanded.size > 1) {
      // "First wins" — the lowest index stays open, the rest collapse.
      const first = Math.min(...targetExpanded);
      targetExpanded.clear();
      targetExpanded.add(first);
    }

    // keep-one-expanded: if nothing would be open, force open the
    // first non-disabled item so we never advertise an empty accordion
    // as "must keep one expanded".
    if (this.keepOneExpanded && targetExpanded.size === 0) {
      const firstEnabled = this.items.findIndex((it) => !it.disabled);
      if (firstEnabled >= 0) targetExpanded.add(firstEnabled);
    }

    // Single-pass apply so any subsequent @Listen entry sees the
    // already-settled state.
    this.items.forEach((it, i) => {
      const should = targetExpanded.has(i);
      if (it.expanded !== should) it.expanded = should;
    });
  }

  /* ──────────────────────────────────────────────────────────
     APG coordination helpers
     - Heading level, region role, and collapsible flag are all
       parent-orchestrated. We push them onto child items rather
       than asking each child to look up to its parent.
     ────────────────────────────────────────────────────────── */

  private computeRegionRole(): 'region' | 'group' | 'none' {
    if (this.region === 'always') return 'region';
    if (this.region === 'never') return 'group';
    // auto: degrade to `group` past the APG-recommended threshold to
    // avoid landmark-region proliferation.
    return this.items.length <= this.regionThreshold ? 'region' : 'group';
  }

  /** Push heading level and region role onto every child item. */
  private syncChildren() {
    const role = this.computeRegionRole();
    this.items.forEach((it) => {
      it.headingLevel = this.headingLevel;
      it.regionRole = role;
    });
    this.syncCollapsible();
  }

  /**
   * Recompute each item's `collapsible` flag based on `keep-one-expanded`.
   * When that mode is on and exactly one item is open, that item is
   * advertised as not-collapsible (aria-disabled + click guard).
   */
  private syncCollapsible() {
    if (!this.keepOneExpanded) {
      this.items.forEach((it) => (it.collapsible = true));
      return;
    }
    const openItems = this.items.filter((it) => it.expanded);
    if (openItems.length === 1) {
      this.items.forEach((it) => (it.collapsible = it !== openItems[0]));
    } else {
      // Either zero (transient) or several — none locked open.
      this.items.forEach((it) => (it.collapsible = true));
    }
  }

  @Watch('headingLevel')
  onHeadingLevelChange() {
    this.syncChildren();
  }

  @Watch('region')
  onRegionChange() {
    this.syncChildren();
  }

  @Watch('regionThreshold')
  onRegionThresholdChange() {
    this.syncChildren();
  }

  @Watch('keepOneExpanded')
  onKeepOneExpandedChange(value: boolean) {
    if (value && !this.items.some((it) => it.expanded)) {
      const first = this.items.find((it) => !it.disabled);
      if (first) first.expanded = true;
    }
    this.syncCollapsible();
  }

  render() {
    const floatingStyle = this.floating
      ? {
          transform: `translate3d(${this.chassisX}px, ${this.chassisY}px, 0)`,
        }
      : {};

    return (
      <Host
        class={{
          'md-accordion': true,
          [`md-accordion--${this.variant}`]: true,
          [`md-accordion--density-${Math.abs(this.density)}`]: this.density !== 0,
          [`md-accordion--elevation-${this.elevation}`]: this.elevation > 0,
          'md-accordion--floating': this.floating,
          'md-accordion--floating-dragging': this.chassisDragging,
        }}
        role="presentation"
        style={floatingStyle}
      >
        {this.dropPlaceholder && (
          <div
            class="md-accordion__drop-placeholder"
            part="drop-placeholder"
            aria-hidden="true"
            style={{
              transform: `translateY(${this.dropPlaceholder.top}px)`,
              blockSize: `${this.dropPlaceholder.height}px`,
            }}
          ></div>
        )}
        <slot></slot>
      </Host>
    );
  }
}

import { Component, Host, h, Prop, Event, EventEmitter, Element, State, Method } from '@stencil/core';
import { MenuElement } from '../../utils/types';
import { triggerRipple } from '../../utils/ripple';
import { fixedContainingBlockOrigin, stepUpFlatTree } from '../../utils/fixed-position';

/** Gap kept between the flyout and every viewport edge when clamping — the same
 *  8px md-menu keeps for its own surface, so a flyout and the menu it hangs off
 *  stop at the same line. */
const VIEWPORT_MARGIN = 8;

/** Stand-in extent for a flyout that measures zero — it is still `display: none`
 *  and nothing has laid it out yet. With the measure-then-reveal pass below this
 *  is a safety net rather than the normal path: the placement that decides the
 *  side now runs while the flyout is laid out (and merely invisible), so it
 *  reads the real extent. */
const UNMEASURED_SUBMENU_EXTENT = 200;

/**
 * HOVER INTENT — how long the pointer must rest on a row before its flyout
 * opens. 100ms is `--md-sys-motion-duration-short2`.
 *
 * The number is chosen against the gesture, not against taste: a 48px row is
 * crossed in around 20ms by a pointer on its way somewhere else (the diagonal
 * from a row to its own flyout, measured in the wealth showcase, spends 21ms
 * over the sibling row it passes). 100ms clears that by a wide margin while
 * still reading as instant to someone who actually stopped on the row.
 */
const DEFAULT_OPEN_DELAY = 100;

/**
 * HOVER INTENT — how long an open flyout survives the pointer leaving its row.
 * 400ms is `--md-sys-motion-duration-medium4`.
 *
 * This is the delay the whole feature exists for. A flyout opens BESIDE its row
 * and is taller than it, so the pointer's natural path to anything but its first
 * item is a diagonal that leaves the row and crosses the rows below it. Every
 * one of those crossings used to switch the flyout out from under the pointer
 * mid-gesture. Long enough to cover that diagonal, short enough that a flyout
 * you have genuinely walked away from does not sit there.
 */
const DEFAULT_CLOSE_DELAY = 400;

/**
 * How long one pointer move that is aimed INTO an open flyout holds the corridor
 * open against sibling rows. Refreshed by every qualifying move, so a pointer
 * still travelling keeps the claim alive; it lapses on its own once the pointer
 * stops heading that way, which is what stops a claim from ever wedging a
 * sibling shut.
 */
const CORRIDOR_GRACE_MS = 250;

/**
 * Live "the pointer is walking into a flyout" claims, keyed by the md-menu that
 * owns the rows.
 *
 * It lives here, not as an expando on md-menu, because it is entirely this
 * component's business — md-menu neither sets nor reads it — and a WeakMap
 * cannot keep a detached menu alive. One claim per menu is enough: only one
 * flyout under a given menu is ever open.
 */
const corridorClaims = new WeakMap<Element, number>();

/** Barycentric sign test — which side of the segment ab does p fall on. */
function sign(p: Point, a: Point, b: Point): number {
  return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
}

/** True when p is inside triangle abc (edges count as inside). */
function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

interface Point {
  x: number;
  y: number;
}

/** `performance.now()` where it exists, `Date.now()` in the spec environment. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

@Component({ tag: 'md-sub-menu-item', styleUrl: 'md-sub-menu-item.css', shadow: true })
export class MdSubMenuItem {
  @Element() el!: HTMLElement;

  /** Primary label text. */
  @Prop() headline: string = '';
  /** Secondary descriptive text below the headline. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';
  /** Whether the item is disabled. */
  @Prop({ reflect: true }) disabled: boolean = false;
  /** Render a divider line below this item. */
  @Prop({ reflect: true }) divider: boolean = false;
  /** Render a gap (extra space) below this item — an alternative separator to divider. */
  @Prop({ reflect: true }) gap: boolean = false;
  /** Small badge label (e.g. "New") displayed before the trailing arrow. */
  @Prop() badge: string = '';

  /**
   * Hover intent — milliseconds the pointer must rest on the row before the
   * flyout opens. Keeps a pointer that is merely passing over the row on its
   * way elsewhere from opening it. `0` opens on contact. The KEYBOARD never
   * waits: ArrowRight / Enter / Space open immediately whatever this is set to.
   */
  @Prop({ attribute: 'open-delay' }) openDelay: number = DEFAULT_OPEN_DELAY;

  /**
   * Hover intent — milliseconds an open flyout survives the pointer leaving the
   * row, so a diagonal from the row to the flyout can cross the sibling rows
   * in between without the flyout switching. Cancelled the moment the pointer
   * re-enters the row OR the flyout. `0` closes on exit. Escape and ArrowLeft
   * never wait.
   */
  @Prop({ attribute: 'close-delay' }) closeDelay: number = DEFAULT_CLOSE_DELAY;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the item row itself is clicked (not the submenu). */
  @Event() mdClick: EventEmitter<void>;

  @State() private submenuOpen: boolean = false;
  @State() private hasLeadingIcon = false;

  /** Teardown after a close: collapses the row once the flyout has faded. */
  private closeTimer?: ReturnType<typeof setTimeout>;
  /** Hover intent — the pending open, cancelled if the pointer leaves first. */
  private openTimer?: ReturnType<typeof setTimeout>;
  /** Hover intent — the pending close, cancelled if the pointer comes back. */
  private closeIntentTimer?: ReturnType<typeof setTimeout>;
  /** Ancestors bound while the flyout is open, so it tracks them — see startPositionWatch. */
  private positionWatchTargets: EventTarget[] = [];
  private repositionFrame?: number;
  /**
   * True between "the flyout has been told to open" and "it has been measured
   * and placed". The container is laid out but `visibility: hidden` for exactly
   * that long — see beginPlacement.
   */
  private placing = false;
  /** The menu whose pointermoves this row is watching while its flyout is open. */
  private corridorMenu?: HTMLElement;
  /** Previous pointer position, so a move has a direction to test. */
  private lastPointer?: Point;
  /** Cached corridor geometry — see corridorGeometry. */
  private corridorRect?: { nearX: number; top: number; bottom: number };

  componentWillLoad() {
    this.hasLeadingIcon = !!this.el.querySelector('[slot="leading-icon"]');
  }

  componentDidLoad() {
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.open) {
      nestedMenu.style.position = 'relative';
      // A flyout that is open in the initial markup never goes through
      // openSubmenu, and the container is `position: fixed` — with no placement
      // it would sit at its static position for good. Gate the reveal on the
      // same measure-first pass, then track it.
      this.beginPlacement();
      this.submenuOpen = true;
      this.schedulePlacement();
      this.startPositionWatch();
      this.startCorridorWatch();
    }
  }

  /**
   * Measure and place the flyout in the same frame the browser first paints it.
   *
   * Stencil runs this synchronously after the DOM patch and BEFORE the paint, so
   * the patch that flipped the container to `display: block` and this placement
   * land together. That window is the whole fix: `getBoundingClientRect` on the
   * container now reports the flyout's REAL extent (it is laid out, merely
   * invisible), so the side decision is made from a measurement instead of the
   * 200px stand-in — and the first frame the reader sees is already the final
   * one. Measured on the wealth showcase holdings menu at 1600px, the flyout
   * used to paint at x=1207 and jump to 1213.1 one frame later.
   */
  componentDidRender() {
    if (this.placing) this.finishPlacement();
  }

  private getNestedMenu(): HTMLElement | null {
    return this.el.querySelector('[slot="submenu"]');
  }

  private getContainer(): HTMLElement | null {
    return (this.el.shadowRoot?.querySelector('.md-sub-menu-item__submenu') as HTMLElement) ?? null;
  }

  /**
   * Hold the flyout invisible — laid out, but not painted — until it has been
   * measured.
   *
   * `visibility: hidden` rather than `opacity: 0` because it also takes the
   * container out of hit-testing, so the frame it spends being measured can
   * never swallow a pointer event. The attribute is written straight onto the
   * element instead of being rendered: it has to be on the container BEFORE the
   * render that reveals it, and a vdom-driven attribute that this component then
   * removes by hand would not be re-applied on the next open (Stencil skips an
   * attribute whose vnode value has not changed).
   */
  private beginPlacement() {
    const container = this.getContainer();
    if (!container) return;
    this.placing = true;
    container.setAttribute('data-md-placing', '');
  }

  /** Place the flyout, then let it paint. Idempotent. */
  private finishPlacement() {
    if (!this.placing) return;
    this.placing = false;
    this.autoPositionSubmenu();
    this.getContainer()?.removeAttribute('data-md-placing');
  }

  /**
   * Collapse this row's submenu and reset its visual state. Called by an
   * ancestor menu when it closes, so reopening the menu tree always starts
   * fresh instead of restoring the previously-open submenu and focus ring.
   */
  @Method()
  async collapse() {
    this.cancelHoverIntent();
    clearTimeout(this.closeTimer);
    this.stopPositionWatch();
    this.stopCorridorWatch();
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.open) nestedMenu.open = false;
    this.submenuOpen = false;
    this.resetSubmenuStyles();
    this.el.removeAttribute('data-md-focused');
  }

  /**
   * Open NOW. Every path that must not wait — the keyboard, and the pointer
   * arriving inside the flyout itself — calls this directly; only the two
   * pointer-hover paths go through scheduleOpen.
   */
  private openSubmenu(autoFocus = false) {
    if (this.disabled) return;
    this.cancelHoverIntent();
    clearTimeout(this.closeTimer);

    // A second open while the flyout is already up (the pointer re-entering it,
    // say) must NOT restart the measure-and-reveal gate: nothing re-renders, so
    // nothing would ever clear it and the flyout would stay invisible.
    const wasOpen = this.submenuOpen;
    if (!wasOpen) {
      // Exactly one flyout under a menu, always. md-menu's own peer dismissal
      // already closes the sibling's nested MENU, but nothing reset the sibling
      // ROW — and with a close delay in play that row would sit there expanded,
      // arrow rotated, next to a flyout that is not its own.
      this.collapseSiblings();
      this.beginPlacement();
    }
    this.submenuOpen = true;

    if (autoFocus) {
      // Keyboard descent into the submenu: DOM focus is leaving this row,
      // so drop the roving focus-ring marker. Otherwise the parent keeps
      // its ring lit while the focused child submenu item also shows one.
      this.el.removeAttribute('data-md-focused');
    }

    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu) {
      nestedMenu.style.position = 'relative';
      if (nestedMenu.show) nestedMenu.show({ autoFocus });
    }

    this.schedulePlacement();
    this.startPositionWatch();
    this.startCorridorWatch();
  }

  /** Collapse every sibling row of the SAME menu. Rows of a deeper menu own
   *  their own exclusivity, so they are filtered out the way md-menu filters
   *  its own item list. */
  private collapseSiblings() {
    const menu = this.owningMenu();
    if (!menu) return;
    const rows = Array.from(menu.querySelectorAll('md-sub-menu-item')) as Array<
      HTMLElement & { collapse?: () => Promise<void> }
    >;
    for (const row of rows) {
      if (row === this.el) continue;
      if (row.closest('md-menu') !== menu) continue;
      void row.collapse?.();
    }
  }

  /** The md-menu this row is a child of — the scope for sibling exclusivity and
   *  for the pointer corridor. */
  private owningMenu(): HTMLElement | null {
    return this.el.closest('md-menu');
  }

  /** Two frames: one for the render that reveals the flyout, one for the nested
   *  menu inside it to lay out, so the rect we measure is its real one. The
   *  second frame is also the FALLBACK reveal — if no render ever followed the
   *  open, componentDidRender never ran, and a flyout left at
   *  `visibility: hidden` would be far worse than one unplaced frame. */
  private schedulePlacement() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.placing) this.finishPlacement();
        else this.autoPositionSubmenu();
      });
    });
  }

  /**
   * Place the flyout in VIEWPORT coordinates.
   *
   * The container is `position: fixed` (md-sub-menu-item.css §8) so that no
   * ancestor overflow can clip it — which is what lets the parent menu cap and
   * scroll. The cost is that `inset-inline-start: 100%` no longer means "just
   * past this row", it means "past the viewport", so every edge is computed
   * here instead.
   */
  private autoPositionSubmenu() {
    const container = this.getContainer();
    if (!container) return;

    // Park at the viewport origin before measuring. A fixed box with only
    // `left` set shrink-wraps against the room LEFT of the right edge, so
    // measuring it where it will finally sit reports a width already squeezed
    // by that edge — and the side decision is made from that width. Parked at 0
    // it reports the width it actually wants. (Same reason positionMenu() parks
    // the menu surface at the top-left before measuring.)
    container.style.left = '0px';
    container.style.top = '0px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';

    const hostRect = this.el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const submenuWidth = containerRect.width > 0 ? containerRect.width : UNMEASURED_SUBMENU_EXTENT;
    const submenuHeight = containerRect.height > 0 ? containerRect.height : UNMEASURED_SUBMENU_EXTENT;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = VIEWPORT_MARGIN;

    // The SIDE is still chosen in LOGICAL terms so RTL mirrors for free: the
    // flyout opens toward the inline end, and flips to the inline start only
    // when that would leave the viewport. Only the two candidate x positions
    // are physical, because that is what a fixed inset actually takes.
    const rtl = this.resolveDirection() === 'rtl';
    const inlineEndLeft = rtl ? hostRect.left - submenuWidth : hostRect.right;
    const inlineStartLeft = rtl ? hostRect.right : hostRect.left - submenuWidth;
    const fits = (left: number) => left >= 0 && left + submenuWidth <= vw;

    // Preferred side unless it overflows AND the other one doesn't. Deciding it
    // from the two candidates rather than from the CURRENT rect is what the old
    // "…and flip back" branch was reaching for: it re-read a rect captured
    // BEFORE the flip was applied, so in practice it could never fire.
    let left = inlineEndLeft;
    if (!fits(inlineEndLeft) && fits(inlineStartLeft)) left = inlineStartLeft;

    // Top-align with the row, or bottom-align when a top-aligned flyout would
    // run off the screen — what `top: auto; bottom: 0` used to express against
    // the row's own box.
    let top = hostRect.top;
    if (top + submenuHeight > vh) top = hostRect.bottom - submenuHeight;

    // Viewport clamp, as on the parent menu: a flyout that fits on neither side
    // pins to the edge instead of bleeding off it. It also keeps the shrink-wrap
    // honest — after clamping there is always `submenuWidth` of room to the
    // right of `left`, so the box never re-narrows once it lands.
    left = Math.max(m, Math.min(left, vw - submenuWidth - m));
    top = Math.max(m, Math.min(top, vh - submenuHeight - m));

    // A transform / filter / contain on an ancestor makes IT the containing
    // block for this fixed box, and the offsets are read from its padding box
    // instead of the viewport. Convert.
    const origin = fixedContainingBlockOrigin(container);
    container.style.left = `${left - origin.x}px`;
    container.style.top = `${top - origin.y}px`;

    // The flyout just moved, so the corridor's near edge did too. This is the
    // ONE place that can happen while it is open, which is what makes caching
    // the geometry safe.
    this.corridorRect = undefined;
  }

  /**
   * Track the flyout to its row while an ancestor scrolls.
   *
   * A fixed box is anchored to the viewport, so it does NOT move when the
   * parent menu's 250px scroll viewport scrolls under it — it would hang beside
   * empty space. Nothing re-ran the placement before, because before the cap no
   * menu containing a submenu could scroll at all.
   *
   * The listeners go on each scrolling ancestor, not on `window` with capture:
   * a `scroll` event on an element neither bubbles nor is composed, so it never
   * reaches a window listener from inside a shadow root — and the parent menu's
   * viewport is exactly that.
   */
  private startPositionWatch() {
    if (this.positionWatchTargets.length) return;
    const targets: EventTarget[] = [];

    if (typeof getComputedStyle === 'function') {
      const scrolls = (value: string) => !!value && value !== 'visible';
      let node: Element | null = stepUpFlatTree(this.el);
      while (node) {
        const cs = getComputedStyle(node as HTMLElement);
        if (scrolls(cs.overflowY) || scrolls(cs.overflowX)) targets.push(node);
        node = stepUpFlatTree(node);
      }
    }
    targets.push(window);

    for (const target of targets) {
      target.addEventListener('scroll', this.handleReposition, { passive: true });
    }
    window.addEventListener('resize', this.handleReposition);
    this.positionWatchTargets = targets;
  }

  private stopPositionWatch() {
    for (const target of this.positionWatchTargets) {
      target.removeEventListener('scroll', this.handleReposition);
    }
    this.positionWatchTargets = [];
    window.removeEventListener('resize', this.handleReposition);
    if (this.repositionFrame !== undefined) {
      cancelAnimationFrame(this.repositionFrame);
      this.repositionFrame = undefined;
    }
  }

  /**
   * THE POINTER CORRIDOR — the "safe triangle".
   *
   * The close delay alone already saves the fast diagonal, because the pointer
   * is over the sibling row for less time than that row's open delay. This
   * covers the SLOW version of the same gesture: someone tracing carefully down
   * and across to the bottom of a tall flyout can dwell on the row in between
   * for longer than the open delay, and that row would then take over even
   * though the pointer never stopped heading for the flyout.
   *
   * While the flyout is open this row watches pointer moves anywhere in the
   * owning menu. When a move lands inside the triangle spanned by the previous
   * pointer position and the flyout's near edge — the definition of "still
   * walking towards it" — it stamps a claim the sibling rows read. It can only
   * ever POSTPONE a sibling's open, never cancel it, and the claim lapses on its
   * own {@link CORRIDOR_GRACE_MS} after the last qualifying move, so a pointer
   * that stops or turns away frees the siblings immediately.
   */
  private startCorridorWatch() {
    if (this.corridorMenu) return;
    const menu = this.owningMenu();
    if (!menu) return;
    this.corridorMenu = menu;
    this.lastPointer = undefined;
    menu.addEventListener('pointermove', this.handleCorridorMove);
  }

  private stopCorridorWatch() {
    if (!this.corridorMenu) return;
    this.corridorMenu.removeEventListener('pointermove', this.handleCorridorMove);
    // Drop the claim with the flyout it protected — a stale one would hold up
    // the very row the pointer is now on.
    corridorClaims.delete(this.corridorMenu);
    this.corridorMenu = undefined;
    this.lastPointer = undefined;
    this.corridorRect = undefined;
  }

  private handleCorridorMove = (e: PointerEvent) => {
    const previous = this.lastPointer;
    const point: Point = { x: e.clientX, y: e.clientY };
    this.lastPointer = point;
    if (!previous || !this.submenuOpen || !this.corridorMenu) return;

    const corridor = this.corridorGeometry();
    if (!corridor) return;
    if (
      !pointInTriangle(
        point,
        previous,
        { x: corridor.nearX, y: corridor.top },
        { x: corridor.nearX, y: corridor.bottom },
      )
    ) {
      return;
    }
    corridorClaims.set(this.corridorMenu, now() + CORRIDOR_GRACE_MS);
  };

  /**
   * The flyout's near edge, cached.
   *
   * A pointermove can fire more than once per frame and each of these reads is a
   * forced layout, so the geometry is computed once and held until something
   * actually moves the flyout — which is exactly when autoPositionSubmenu runs,
   * and that is where it is invalidated.
   */
  private corridorGeometry(): { nearX: number; top: number; bottom: number } | undefined {
    if (this.corridorRect) return this.corridorRect;
    const container = this.getContainer();
    if (!container) return undefined;
    const flyout = container.getBoundingClientRect();
    if (flyout.width <= 0 || flyout.height <= 0) return undefined;
    // The near edge is whichever vertical edge of the flyout faces the row — the
    // flyout flips sides, and under RTL it starts on the other one.
    const host = this.el.getBoundingClientRect();
    this.corridorRect = {
      nearX: flyout.left >= host.right ? flyout.left : flyout.right,
      top: flyout.top,
      bottom: flyout.bottom,
    };
    return this.corridorRect;
  }

  /** Milliseconds left on another row's corridor claim, or 0 when the path is
   *  clear. Only ever read by a row that is about to open. */
  private corridorRemaining(): number {
    const menu = this.owningMenu();
    if (!menu) return 0;
    const until = corridorClaims.get(menu);
    return until ? Math.max(0, until - now()) : 0;
  }

  private handleReposition = () => {
    if (!this.submenuOpen || this.repositionFrame !== undefined) return;
    // Coalesce to one placement per frame: a trackpad scroll fires far more
    // events than there are frames, and each placement forces a layout.
    this.repositionFrame = requestAnimationFrame(() => {
      this.repositionFrame = undefined;
      if (!this.submenuOpen) return;
      // Once the row itself has scrolled out of the capped list there is nothing
      // for the flyout to hang off, and a panel floating beside a row you can no
      // longer see reads as a stray. Collapse instead of chasing it.
      if (this.rowScrolledOutOfView()) this.closeSubmenu();
      else this.autoPositionSubmenu();
    });
  };

  /** True when the row is entirely past the top or bottom edge of a scrolling
   *  ancestor — i.e. clipped away rather than merely offset. */
  private rowScrolledOutOfView(): boolean {
    const hostRect = this.el.getBoundingClientRect();
    for (const target of this.positionWatchTargets) {
      if (target === window) continue;
      const rect = (target as HTMLElement).getBoundingClientRect();
      if (rect.height === 0) continue;
      if (hostRect.bottom <= rect.top || hostRect.top >= rect.bottom) return true;
    }
    return false;
  }

  /** Nearest explicit `dir`, matching md-button-group's resolution. */
  private resolveDirection(): 'ltr' | 'rtl' {
    let node: HTMLElement | null = this.el;
    while (node) {
      const dir = node.getAttribute?.('dir');
      if (dir === 'rtl' || dir === 'ltr') return dir;
      node = node.parentElement;
    }
    return 'ltr';
  }

  /**
   * Close NOW. The hover-intent wait happens BEFORE this is called (see
   * scheduleClose) — Escape, ArrowLeft and the scrolled-out-of-view collapse all
   * land here directly and must not be made to wait for anything.
   */
  private closeSubmenu() {
    this.cancelHoverIntent();
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.close) nestedMenu.close();
    this.stopPositionWatch();
    this.stopCorridorWatch();

    this.closeTimer = setTimeout(() => {
      this.submenuOpen = false;
      this.resetSubmenuStyles();
    }, 100);
  }

  private resetSubmenuStyles() {
    const container = this.getContainer();

    /*
     * THE GATE GOES ON BEFORE THE PLACEMENT COMES OFF, AND IT STAYS ON.
     *
     * Clearing the inline placement below returns the flyout to its stylesheet
     * position — `position: fixed` with no offsets — which is somewhere else
     * entirely, and it stays HIT-TESTABLE until the render that applies
     * `display: none` lands a frame or more later. Measured: the stray flyout
     * came to rest under a stationary pointer, so the browser hit-tested one of
     * its own `md-menu-item`s. Those items are in THIS row's light DOM
     * (`slot="submenu"`), so the hit fired `mouseenter` on this host, which
     * cancelled the close and re-opened the row. Re-placing moved the flyout
     * away, the pointer "left", the close restarted, and round it went — 50
     * enter/leave pairs in 1.5s with the pointer completely still, holding this
     * row open ~118ms per cycle and its sibling ~16ms. The sibling could
     * therefore never accumulate its open delay and NEVER opened: rest the
     * pointer on Currency and Region's flyout simply stayed up.
     *
     * `data-md-placing` already means "laid out, but not placed yet — do not
     * paint and do not hit-test". That is exactly the state a teardown passes
     * through, so it wears the same gate. It is deliberately NOT removed here:
     * `beginPlacement` re-applies it on the next open and `finishPlacement`
     * takes it off once the flyout has real coordinates, so the only frames it
     * is ever off are the ones in which the position is true.
     */
    if (container) {
      this.placing = true;
      container.setAttribute('data-md-placing', '');
    }

    const nestedMenu = this.el.querySelector('[slot="submenu"]') as HTMLElement;
    if (nestedMenu) {
      nestedMenu.style.position = '';
    }
    if (container) {
      container.style.left = '';
      container.style.top = '';
      container.style.right = '';
      container.style.bottom = '';
    }
  }

  /* ── hover intent ────────────────────────────────────────────────────────
     The pointer paths, and ONLY the pointer paths, wait. Both timers are
     cancelled by their opposite gesture, so a pointer that changes its mind
     leaves nothing pending behind it. */

  private cancelHoverIntent() {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeIntentTimer);
  }

  /** The pointer arrived on the row. */
  private scheduleOpen() {
    if (this.disabled) return;
    // Whatever close was pending is off the moment the pointer is back, whether
    // or not this enter goes on to open anything.
    clearTimeout(this.closeIntentTimer);
    if (this.submenuOpen) return;
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => this.attemptScheduledOpen(), Math.max(0, this.openDelay));
  }

  /** The open delay has elapsed. Re-read the corridor HERE rather than when the
   *  timer was armed: the pointer moves that reveal where it is heading arrive
   *  after the `mouseenter` that armed it. */
  private attemptScheduledOpen() {
    const remaining = this.corridorRemaining();
    if (remaining > 0) {
      this.openTimer = setTimeout(() => this.attemptScheduledOpen(), remaining);
      return;
    }
    this.openSubmenu(false);
  }

  /** The pointer left the row (or the flyout). */
  private scheduleClose() {
    clearTimeout(this.openTimer);
    if (!this.submenuOpen) return;
    clearTimeout(this.closeIntentTimer);
    this.closeIntentTimer = setTimeout(() => this.closeSubmenu(), Math.max(0, this.closeDelay));
  }

  private handleMouseEnter = () => { this.scheduleOpen(); };
  private handleMouseLeave = () => { this.scheduleClose(); };

  /**
   * The pointer reached the flyout itself.
   *
   * This is a SEPARATE path from the row's own `mouseenter` on purpose. Cutting
   * the corner from the row into the flyout can put the pointer inside the
   * flyout without it ever re-entering the row, and the pending close has to be
   * called off by arriving anywhere inside the branch — not only by going back.
   * No delay here: the pointer is already in the thing it would be waiting for.
   */
  private handleFlyoutEnter = () => {
    clearTimeout(this.closeIntentTimer);
    this.openSubmenu(false);
  };

  private handleFlyoutLeave = () => { this.scheduleClose(); };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      triggerRipple(this.el);
      this.openSubmenu(true);
    }

    if ((e.key === 'ArrowLeft' || e.key === 'Escape') && this.submenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      // Same teardown as a mouse-out close — routed through closeSubmenu so the
      // scroll/resize watch is released and the reset timer is the tracked one
      // openSubmenu can cancel, instead of a stray setTimeout that reopening
      // could not call off.
      this.closeSubmenu();
      this.el.focus();
      // Focus is returning to this row — restore the roving focus-ring
      // marker so the ring reappears on the parent item.
      this.el.setAttribute('data-md-focused', '');
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (this.disabled) { e.preventDefault(); e.stopPropagation(); return; }
    this.mdClick.emit();
  };

  disconnectedCallback() {
    this.cancelHoverIntent();
    clearTimeout(this.closeTimer);
    this.stopPositionWatch();
    this.stopCorridorWatch();
  }

  render() {
    return (
      <Host
        class={{
          'md-sub-menu-item': true,
          'md-sub-menu-item--disabled': this.disabled,
          'md-sub-menu-item--open': this.submenuOpen,
          'md-sub-menu-item--divider': this.divider,
          'md-sub-menu-item--gap': this.gap,
        }}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={String(this.submenuOpen)}
        aria-disabled={this.disabled ? 'true' : 'false'}
        tabindex="-1"
        onClick={this.handleClick}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={this.disabled}></md-ripple>
        <span class="md-sub-menu-item__state-layer" part="state-layer" aria-hidden="true"></span>

        {this.hasLeadingIcon && (
          <span class="md-sub-menu-item__leading" part="leading-icon" aria-hidden="true">
            <slot name="leading-icon"></slot>
          </span>
        )}

        <span class="md-sub-menu-item__content" part="content">
          <span class="md-sub-menu-item__headline" part="headline">{this.headline}</span>
          {this.supportingText && (
            <span class="md-sub-menu-item__supporting" part="supporting-text">{this.supportingText}</span>
          )}
        </span>

        {this.badge && (
          <span class="md-sub-menu-item__badge" part="badge">{this.badge}</span>
        )}

        <span class="md-sub-menu-item__arrow material-symbols-outlined" aria-hidden="true">
          arrow_right
        </span>

        <div
          class="md-sub-menu-item__submenu"
          onMouseEnter={this.handleFlyoutEnter}
          onMouseLeave={this.handleFlyoutLeave}
        >
          <slot name="submenu" />
        </div>
      </Host>
    );
  }
}

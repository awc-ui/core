import {
  Component,
  Host,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Method,
  Watch,
  Listen,
} from '@stencil/core';
import { LazyLoadingIndicator } from '../../utils/lazy-loading-indicator';

/**
 * Minimal structural type for the Web Speech API `SpeechRecognition`
 * instance — the DOM lib doesn't ship these types in every TS target, and we
 * only touch a small surface. Indexing the global ctor avoids a hard
 * dependency on the (prefixed / non-standard) API.
 */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Payload for the `mdLeadingIconClick` event. Emitted when the interactive
 * leading affordance (the morphing back/dismiss button, or a custom slotted
 * `leading` icon) is clicked.
 */
export interface MdSearchLeadingIconClickDetail {
  /** The bar's current input value at click time. */
  value: string;
  /** Whether the bar / panel is open at click time. */
  open: boolean;
}

/**
 * Payload for the `mdTrailingIconClick` event. Emitted when a slotted
 * `trailing` affordance is clicked (the built-in clear / voice buttons emit
 * their own `mdClear` / `mdVoice` events instead).
 */
export interface MdSearchTrailingIconClickDetail {
  /** The bar's current input value at click time. */
  value: string;
  /** Whether the bar / panel is open at click time. */
  open: boolean;
}

/**
 * Material Design 3 Search.
 *
 * Implements the M3 Search specification
 * (https://m3.material.io/components/search/specs).
 *
 * Two orthogonal axes describe every spec configuration:
 *  - `variant`: `contained` (M3 Expressive default) | `divided` (baseline)
 *  - `layout` : `full-screen` (modal overlay) | `docked` (anchored panel)
 *
 * The component renders a single resting bar plus a results panel. When the
 * `full-screen` layout is `open` the bar pins itself to the top of the
 * viewport via `position: fixed` so consumers don't need a portal — CSS does
 * the work, and the input keeps a stable identity throughout the open/close
 * lifecycle.
 */
@Component({
  tag: 'md-search',
  styleUrl: 'md-search.css',
  shadow: true,
})
export class MdSearch {
  @Element() el!: HTMLElement;

  // ────────────────────────────────────────────────────────────────────────
  // Spec axes
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Visual style. `contained` is the M3 Expressive default with a filled
   * surface and rounded shape; `divided` is the baseline pre-Expressive look
   * that uses a hairline divider between bar and results.
   */
  @Prop({ reflect: true }) variant: 'contained' | 'divided' = 'contained';

  /**
   * How the focused panel appears. `full-screen` fills the viewport
   * edge-to-edge with an opaque results surface and a focus trap (no scrim —
   * open/close uses the same translateY + opacity motion as md-dialog
   * fullscreen); `docked` anchors a popup beneath the bar
   * (min 360dp / max 720dp wide; results drawer shrinks to content up to max ⅔ vh).
   */
  @Prop({ reflect: true }) layout: 'full-screen' | 'docked' = 'full-screen';

  /**
   * What the user sees while the search view is closed. `bar` renders the
   * resting search field (docked default). `icon` renders a compact search
   * icon button that opens the view — the default for `full-screen` layout
   * (contained and divided spec sheets). Docked layouts should keep `bar`.
   */
  @Prop({ reflect: true }) trigger?: 'bar' | 'icon';

  /**
   * Material Symbols glyph for the built-in icon trigger (`trigger="icon"`).
   * Ignored when a custom element is slotted in `trigger`.
   */
  @Prop({ attribute: 'trigger-icon' }) triggerIcon: string = 'search';

  /**
   * Open the search from an element that lives ELSEWHERE on the page — a
   * button in the app bar, a menu item, a keyboard-shortcut hint — rather than
   * from the built-in trigger or the `trigger` slot, both of which have to sit
   * inside this element.
   *
   * Takes a CSS selector resolved against the document
   * (`trigger-for="#app-bar-search"`), or an element assigned to the
   * `triggerElement` property when you already hold a reference. The component
   * wires it rather than rendering it: activating it opens the view,
   * `aria-haspopup="dialog"` and `aria-expanded` are kept in step, and closing
   * returns focus to it.
   *
   * With one set, the built-in trigger is not rendered — otherwise the page
   * would show two ways in.
   */
  @Prop({ attribute: 'trigger-for' }) triggerFor: string = '';

  /** The external trigger as an element, for consumers that hold a reference. */
  @Prop() triggerElement?: HTMLElement;

  /**
   * Make the docked / inline bar span its container's full inline width with
   * NO side gutters. This zeroes both expand insets for the instance
   * (resting + focused = 0), so there is no 24 → 12dp margin animation and the
   * aligned results drawer fills the same full width. Purely an ergonomic
   * switch over the CSS vars — the identical effect is available by setting
   * `--md-search-expand-inset: 0` and `--md-search-expand-focused-inset: 0`.
   * Has no effect on `full-screen` layout (already edge-to-edge).
   */
  @Prop({ reflect: true, attribute: 'full-width' }) fullWidth: boolean = false;

  // ────────────────────────────────────────────────────────────────────────
  // Bar state
  // ────────────────────────────────────────────────────────────────────────

  /** Current input text, two-way bindable. */
  @Prop({ mutable: true, reflect: true }) value: string = '';

  /**
   * Placeholder text — the spec calls this "supporting text" within the bar
   * anatomy.
   */
  @Prop() placeholder: string = 'Search';

  /** Whether the focused panel is open. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Whether interaction is blocked. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Resting bar elevation level, mapped to `--md-sys-elevation-{n}`. `0`
   * (the M3 default) renders no shadow; `1`–`5` apply the matching MD3
   * elevation tier. For a fully custom shadow, set the CSS custom property
   * `--md-search-container-elevation` instead (it overrides this prop).
   */
  @Prop({ reflect: true }) elevation: 0 | 1 | 2 | 3 | 4 | 5 = 0;

  // ────────────────────────────────────────────────────────────────────────
  // Icon configuration
  // ────────────────────────────────────────────────────────────────────────

  /** Material Symbols glyph for the resting leading icon. */
  @Prop({ attribute: 'leading-icon' }) leadingIcon: string = 'search';

  /**
   * Material Symbols glyph used for the leading button when the bar is
   * open. Defaults are variant-aware: the `contained` (Expressive) bar
   * uses `chevron_left` so the caret matches the bar's softer, pill-
   * shaped silhouette, while the `divided` (baseline) bar uses the
   * classic `arrow_back` to match its squared, app-bar-like chrome.
   * Pass an explicit value to override either default.
   */
  @Prop({ attribute: 'open-leading-icon' }) openLeadingIcon?: string;

  // ────────────────────────────────────────────────────────────────────────
  // Behaviour
  // ────────────────────────────────────────────────────────────────────────

  /** Show the trailing clear (×) button when the input has a value. */
  @Prop({ attribute: 'show-clear-button' }) showClearButton: boolean = true;

  /**
   * Opt-in voice search. When `true` AND the browser exposes the Web Speech
   * API (`SpeechRecognition` / `webkitSpeechRecognition`), a microphone
   * icon-button is rendered in the trailing cluster. Clicking it starts
   * recognition and streams the interim + final transcript into the input,
   * firing the normal `mdInput` / `mdSearch` flow as if typed. When the API is
   * unavailable the mic is not rendered (graceful no-op). Default `false`.
   */
  @Prop({ attribute: 'voice-search' }) voiceSearch: boolean = false;

  /** Close on Escape key. */
  @Prop({ attribute: 'escape-closes' }) escapeCloses: boolean = true;

  /** Close on outside click (docked layout). */
  @Prop({ attribute: 'dismiss-on-outside-click' }) dismissOnOutsideClick: boolean = true;

  /**
   * Retained for API compatibility, but now a no-op: when the results list
   * overflows it always plain-scrolls inside the results viewport (no scroll
   * shadow / edge fades). Setting this has no visual effect.
   */
  @Prop({ reflect: true, attribute: 'scroll-shadow' })
  scrollShadow: boolean = true;

  /**
   * Maximum block-size of the open search surface (`"480px"`, `"66vh"`, etc.).
   * Full-screen: caps the fixed overlay height. Docked: caps the results panel
   * (bar height is unchanged). Prefer the CSS custom property
   * `--md-search-max-block-size` for stylesheet-based theming.
   */
  @Prop({ attribute: 'max-block-size' }) maxBlockSize: string = '';

  /**
   * Accessible label for the search bar / input. Per the M3 labeling guidance
   * the hinted search text (`placeholder`) describes the bar, so when this is
   * left empty the label falls back to `placeholder`. Set it explicitly only
   * when the visible hint and the accessible name should differ.
   */
  @Prop({ attribute: 'input-aria-label' }) inputAriaLabel: string = '';

  /**
   * Where focus lands when the panel opens. `auto` (default) and `input` focus
   * the text field so the user can type immediately. `leading` focuses the
   * leading button instead (falling back to the input if it isn't focusable).
   *
   * Note: the M3 "initial focus lands on a leading icon, else the text field"
   * rule applies to the RESTING bar's first tab stop and is handled by DOM
   * order — a slotted interactive leading icon button is the first tabbable
   * element, otherwise the text field. This prop only controls the open view.
   */
  @Prop({ attribute: 'initial-focus' }) initialFocus: 'auto' | 'input' | 'leading' =
    'auto';

  /**
   * Announce the number of available suggestions / results to assistive
   * technology via a polite live region whenever the slotted results change
   * while the panel is open (M3 "autosuggest" requirement). Set to `false`
   * if you manage your own live region in the results slot.
   */
  @Prop({ attribute: 'announce-results' }) announceResults: boolean = true;

  /**
   * Template for the results announcement. `{count}` is replaced with the
   * number of detected result items (counts `md-list-item`, `[role="option"]`,
   * or `<li>` descendants of the results slot, falling back to the number of
   * slotted elements).
   */
  @Prop({ attribute: 'results-label' }) resultsLabel: string =
    '{count} results available';

  /**
   * Message shown when the panel is open, the user has entered a query, and
   * there are no slotted results — both the on-screen empty state and the
   * polite live-region announcement (unless the visible empty state is shown,
   * in which case the live region defers to it to avoid duplicate speech).
   */
  @Prop({ attribute: 'no-results-label' }) noResultsLabel: string =
    'No results available';

  // ────────────────────────────────────────────────────────────────────────
  // Async / loading
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Whether an async results fetch is in flight. When `true` the M3 loading
   * indicator (the looping shape-morph) shows in the bar's trailing cluster.
   * Controlled by the consumer: set it `true` before awaiting your fetch and
   * back to `false` once results are slotted in. The component never flips
   * this itself — it only reflects the state visually + to assistive tech.
   */
  @Prop({ mutable: true, reflect: true }) loading: boolean = false;

  /**
   * Trailing debounce (ms) applied to the `mdSearch` event so a fetch only
   * fires after the user pauses typing. `0` (default) emits on every change.
   * `mdInput` always fires immediately on every keystroke regardless.
   */
  @Prop() debounce: number = 0;

  /**
   * Maximum wait (ms) before `mdSearch` is forced to fire during sustained
   * typing — a throttle/`maxWait` safety net so the user still sees interim
   * results when they never pause long enough for the debounce to settle.
   * `0` (default) disables it. Only meaningful alongside a non-zero
   * `debounce`.
   */
  @Prop() throttle: number = 0;

  /** Accessible label for the in-bar loading indicator. */
  @Prop({ attribute: 'loading-label' }) loadingLabel: string = 'Searching';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ────────────────────────────────────────────────────────────────────────
  // Events
  // ────────────────────────────────────────────────────────────────────────

  /** Fires on every input change (immediate, every keystroke). */
  @Event() mdInput: EventEmitter<{ value: string }>;

  /**
   * Debounced, de-duplicated query event — the one to wire an async results
   * fetch to. Honours `debounce` / `throttle` and applies a
   * distinct-until-changed guard on the trimmed query (so re-typing the same
   * term, or only adding surrounding whitespace, won't re-trigger a fetch).
   * Pressing Enter or clearing the field flushes it immediately.
   */
  @Event() mdSearch: EventEmitter<{ value: string }>;

  /** Fires when the user presses Enter to submit a query. */
  @Event() mdSubmit: EventEmitter<{ value: string }>;

  /** Fires when the input loses focus with a different value than on focus. */
  @Event() mdChange: EventEmitter<{ value: string }>;

  /** Fires when the panel opens. */
  @Event() mdOpen: EventEmitter<void>;

  /** Fires when the panel closes. */
  @Event() mdClose: EventEmitter<void>;

  /** Fires when the user clicks the clear (×) button. */
  @Event() mdClear: EventEmitter<void>;

  /**
   * Fires while voice search is active as the transcript streams in. `value`
   * is the current (interim or final) transcript; `final` is `true` on the
   * recognised final result. The component already mirrors the transcript into
   * the input and fires `mdInput` / `mdSearch`, so listen to this only if you
   * need voice-specific UI (e.g. a transcript preview).
   */
  @Event() mdVoice: EventEmitter<{ value: string; final: boolean }>;

  /**
   * Fires when the interactive leading affordance is clicked — the morphing
   * back / dismiss button while the bar is open, or a custom slotted `leading`
   * icon. The default back button still dismisses the panel as before; this
   * event is additive. The closed resting search glyph is intentionally NOT a
   * click target (a click there focuses the input), so it does not emit.
   */
  @Event() mdLeadingIconClick: EventEmitter<MdSearchLeadingIconClickDetail>;

  /**
   * Fires when a slotted `trailing` affordance is clicked. The built-in clear
   * (×) and voice (mic) buttons own their dedicated `mdClear` / `mdVoice`
   * events and do NOT trigger this. Only emitted when slotted trailing content
   * is actually present and was the click target.
   */
  @Event() mdTrailingIconClick: EventEmitter<MdSearchTrailingIconClickDetail>;

  // ────────────────────────────────────────────────────────────────────────
  // Methods
  // ────────────────────────────────────────────────────────────────────────

  /** Open the focused panel. */
  @Method() async show(): Promise<void> {
    this.open = true;
  }

  /** Close the focused panel. */
  @Method() async close(): Promise<void> {
    this.open = false;
  }

  /** Toggle the focused panel. */
  @Method() async toggle(): Promise<void> {
    this.open = !this.open;
  }

  /** Programmatically focus the input. */
  @Method() async focusInput(): Promise<void> {
    this.input?.focus();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  @State() private focused = false;
  @State() private hasSlottedLeading = false;
  @State() private hasSlottedTrailing = false;
  @State() private hasSlottedTrigger = false;
  /** Live-region message announcing the count of available results. */
  @State() private resultsStatus = '';
  /** Bar expansion / icon morph — lags `open` on close so the panel can fade first. */
  @State() private barExpanded = false;
  /** Results panel visibility / fade state — tracks `open` immediately on close. */
  @State() private panelVisible = false;
  /**
   * Whether to render the focus ring. Only true when focus arrives via the
   * keyboard — a text input always matches `:focus-visible` (even on click),
   * so we track focus modality ourselves to keep the ring keyboard-only.
   */
  @State() private showFocusRing = false;
  /** Whether voice recognition is currently active (drives the mic pulse). */
  @State() private listening = false;
  /**
   * Trailing loading↔clear morph state. `loadingMorphMounted` keeps the
   * loading indicator in the DOM through its fade-out so the swap cross-fades
   * in BOTH directions; `loadingMorphIn` is the visible (committed) state that
   * the entry/exit transitions animate between.
   */
  @State() private loadingMorphMounted = false;
  @State() private loadingMorphIn = false;

  /**
   * Whether the most recent user interaction came from the keyboard. Mirrors
   * the browser's `:focus-visible` heuristic so the bar's focus ring only shows
   * for keyboard focus — never on click — even when focus is moved
   * programmatically (e.g. when a click opens the view and we focus the input
   * in a later frame).
   */
  private keyboardModality = false;

  private input?: HTMLInputElement;
  private rippleEl?: HTMLElement;
  private insetProbeEl?: HTMLElement;
  private trailingSlotEl?: HTMLSlotElement;
  private resizeObserver?: ResizeObserver;
  private previousFocus: HTMLElement | null = null;
  private valueOnFocus: string = '';
  private outsideClickHandler?: (e: MouseEvent) => void;
  private closeTimer?: ReturnType<typeof setTimeout>;
  /**
   * Set when a full-screen open is waiting for the `position: fixed` overlay
   * layout to commit before the panel surface reveal. `componentDidRender`
   * picks it up so the fade animates over an already-settled layout
   * (see `onOpenChange`).
   */
  private pendingFullScreenReveal = false;
  private revealRaf?: number;
  /** Debounce / throttle timers + dedupe state for the `mdSearch` event. */
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;
  private searchMaxWaitTimer?: ReturnType<typeof setTimeout>;
  private pendingSearchValue: string | null = null;
  private lastEmittedSearch: string | null = null;

  /** Full-screen close duration — keep in sync with `--_fs-collapse-duration` in md-search.css. */
  private static readonly PANEL_CLOSE_MS = 300;
  /** Loading↔clear morph duration — keep in sync with the CSS morph transition. */
  private static readonly MORPH_MS = 300;

  /** Active SpeechRecognition instance while listening (Web Speech API). */
  private recognition?: SpeechRecognitionLike;
  private loadingMorphTimer?: ReturnType<typeof setTimeout>;
  private loadingMorphInRaf?: number;

  // ────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────

  connectedCallback() {
    if (typeof document !== 'undefined') {
      // Capture phase so we record the modality before the resulting focus
      // event fires (and before any programmatic focus we trigger on open).
      document.addEventListener('keydown', this.trackKeyboardModality, true);
      document.addEventListener('pointerdown', this.trackPointerModality, true);
    }
  }

  componentWillLoad() {
    this.barExpanded = this.open;
    this.panelVisible = this.open;
    // Seed the loading morph so an initial `loading` renders without a flash.
    this.loadingMorphMounted = this.loading;
    this.loadingMorphIn = this.loading;
    // Seed the distinct-until-changed baseline with any initial value so the
    // first user-driven change emits correctly (and a programmatic initial
    // value is treated as already-searched, not re-fetched on mount).
    this.lastEmittedSearch = this.value.trim();
    // Compute the initial announcement here (light-DOM result children already
    // exist) so we don't mutate @State inside componentDidLoad.
    this.updateResultsStatus();
  }

  componentDidLoad() {
    this.wireExternalTrigger();
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const leadingSlot = shadow.querySelector('slot[name="leading"]') as HTMLSlotElement | null;
    const trailingSlot = shadow.querySelector('slot[name="trailing"]') as HTMLSlotElement | null;
    // Kept for mdTrailingIconClick hit-testing against assigned (slotted) nodes.
    this.trailingSlotEl = trailingSlot ?? undefined;

    leadingSlot?.addEventListener('slotchange', () => {
      this.hasSlottedLeading = leadingSlot.assignedElements().length > 0;
    });
    trailingSlot?.addEventListener('slotchange', () => {
      this.hasSlottedTrailing = trailingSlot.assignedElements().length > 0;
    });

    // Recompute the announcement when the slotted results change in a real
    // browser. The count itself is read from the host's light DOM (see
    // countResults) so it also works in environments without slotchange.
    const resultsSlot = shadow.querySelector(
      'slot[name="results"]',
    ) as HTMLSlotElement | null;
    resultsSlot?.addEventListener('slotchange', () => this.updateResultsStatus());

    const triggerSlot = shadow.querySelector(
      'slot[name="trigger"]',
    ) as HTMLSlotElement | null;
    triggerSlot?.addEventListener('slotchange', () => {
      this.hasSlottedTrigger = triggerSlot.assignedElements().length > 0;
    });
    this.hasSlottedTrigger = (triggerSlot?.assignedElements().length ?? 0) > 0;

    this.measureRippleExtend();
    this.observeHostResize();

    if (this.open) this.applyOpenSideEffects();
  }

  @Watch('triggerFor')
  @Watch('triggerElement')
  onExternalTriggerChange() {
    this.wireExternalTrigger();
  }

  disconnectedCallback() {
    this.unwireExternalTrigger();
    this.clearCloseTimer();
    this.cancelReveal();
    this.clearSearchTimers();
    this.stopVoice();
    this.clearLoadingMorphTimers();
    this.removeOutsideClickHandler();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.trackKeyboardModality, true);
      document.removeEventListener('pointerdown', this.trackPointerModality, true);
    }
    if (this.layout === 'full-screen' && typeof document !== 'undefined') {
      document.body.style.removeProperty('overflow');
    }
  }

  /**
   * Resolve the bar's per-side focus travel to a concrete pixel length and
   * forward it to the ripple as `--md-ripple-extend-inline`. The docked/inline
   * bar springs from `100% - 2 * resting` to `100% - 2 * focused` on focus,
   * which moves each edge out by exactly `resting - focused` (24 → 12 = 12dp
   * default) — the probe resolves that delta. md-ripple
   * applies the extend PER SIDE — `left = rect.left - extend`,
   * `right = rect.right + extend` — so the per-side value it needs is one
   * inset, not two. (Forwarding `2 * inset` over-inflated the wave to ~2×
   * the actual growth, reading as an oversized wash near the press point.)
   * The default inset is the responsive `clamp(0px, 8%, 64px)`, so its
   * concrete length must be measured rather than parsed: a percentage would
   * resolve against the bar instead of the host once the token reaches
   * md-ripple's shadow tree, so we resolve it in JS via the host-anchored
   * probe (see md-search.css for the full rationale).
   */
  /**
   * Resolved trigger mode. Explicit `trigger` wins; otherwise full-screen
   * uses the icon button entry point and docked keeps the resting bar.
   */
  private get effectiveTrigger(): 'bar' | 'icon' {
    // An external opener owns the resting affordance, so the component keeps
    // nothing on screen until it opens — the same "hidden until invoked"
    // shape as the icon trigger, minus the icon.
    if (this.hasExternalTrigger) return 'icon';
    if (this.trigger != null) return this.trigger;
    return this.layout === 'full-screen' ? 'icon' : 'bar';
  }

  /** Whether the consumer has pointed at an opener outside this element. */
  private get hasExternalTrigger(): boolean {
    return Boolean(this.triggerFor || this.triggerElement);
  }

  private get usesIconTrigger(): boolean {
    return this.effectiveTrigger === 'icon';
  }

  // ── External trigger ──────────────────────────────────────────────────

  /** The element currently wired as the external opener, if any. */
  private wiredTrigger: HTMLElement | null = null;

  private resolveExternalTrigger(): HTMLElement | null {
    if (this.triggerElement) return this.triggerElement;
    if (!this.triggerFor || typeof document === 'undefined') return null;
    const sel = this.triggerFor.trim();
    if (!sel) return null;
    try {
      return document.querySelector(sel) as HTMLElement | null;
    } catch {
      // A malformed selector is an authoring mistake, not a reason to break the
      // search — warn once and carry on with the built-in trigger.
      if (typeof console !== 'undefined') {
        console.warn('[md-search] `trigger-for` is not a valid selector:', this.triggerFor);
      }
      return null;
    }
  }

  private wireExternalTrigger() {
    const next = this.resolveExternalTrigger();
    if (next === this.wiredTrigger) {
      this.syncExternalTriggerAria();
      return;
    }
    this.unwireExternalTrigger();
    if (!next) return;
    next.addEventListener('click', this.handleExternalTriggerClick);
    this.wiredTrigger = next;
    this.syncExternalTriggerAria();
  }

  private unwireExternalTrigger() {
    this.wiredTrigger?.removeEventListener('click', this.handleExternalTriggerClick);
    this.wiredTrigger?.removeAttribute('aria-expanded');
    this.wiredTrigger = null;
  }

  /** The element is the consumer's, so it is wired rather than re-rendered. */
  private handleExternalTriggerClick = (e: Event) => {
    if (this.disabled) return;
    // The document-level outside-click handler runs in the CAPTURE phase, and
    // the trigger is outside this element — without this the same click would
    // close an open panel and then reopen it, or open and immediately close.
    e.stopPropagation();
    this.open = !this.open;
  };

  private syncExternalTriggerAria() {
    const t = this.wiredTrigger;
    if (!t) return;
    t.setAttribute('aria-haspopup', 'dialog');
    t.setAttribute('aria-expanded', String(this.open));
  }

  /** Whether the search bar chrome is in the DOM (icon trigger hides it until open). */
  private get showBar(): boolean {
    return !this.usesIconTrigger || this.barExpanded;
  }

  private measureRippleExtend() {
    if (!this.showBar) return;
    const ripple = this.rippleEl;
    if (!ripple) return;

    // Full-screen: the bar snaps from its resting (inset / max-720dp) width
    // to the full viewport width on open. md-ripple sizes the wave from the
    // bar's rect AT PRESS TIME — the resting width — so without an extend the
    // wave only covers the initial bar and stops half-way across the
    // expanded full-screen bar. Inflate the farthest-corner reach by exactly
    // the growth delta (viewport − resting bar width). That sizes the wave
    // to finish filling right as it reaches the expanded bar's far edge —
    // not so much that it fills instantly (which reads as a flat wash) — and
    // keeps the wave's origin near the press point. When the bar is already
    // open its width ≈ the viewport, so the delta collapses to ~0 and the
    // normal press-sized ripple is used.
    if (this.layout === 'full-screen' && typeof window !== 'undefined') {
      const bar = this.el.shadowRoot?.querySelector('.md-search__bar') as HTMLElement | null;
      const barWidth = bar?.getBoundingClientRect().width ?? 0;
      const delta = window.innerWidth - barWidth;
      if (delta > 1) {
        ripple.style.setProperty('--md-ripple-extend-inline', `${delta}px`);
        return;
      }
    }

    const probe = this.insetProbeEl;
    if (!probe) return;
    const inset = probe.getBoundingClientRect().width;
    if (!Number.isFinite(inset) || inset <= 0) {
      ripple.style.removeProperty('--md-ripple-extend-inline');
      return;
    }
    ripple.style.setProperty('--md-ripple-extend-inline', `${inset}px`);
  }

  private observeHostResize() {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      // The ripple extent only matters for the resting → press expansion, which
      // is measured before the view opens. Re-measuring while the bar is
      // expanded (or mid open/close transition) would call getBoundingClientRect
      // — a forced synchronous reflow — on the very frames the full-screen
      // reveal animates, stuttering it. Skip until the bar is back at rest.
      if (this.barExpanded) return;
      this.measureRippleExtend();
    });
    this.resizeObserver.observe(this.el);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Open / close side effects
  // ────────────────────────────────────────────────────────────────────────

  @Watch('open')
  onOpenChange(newVal: boolean, oldVal: boolean) {
    if (newVal === oldVal) return;
    this.clearCloseTimer();
    this.cancelReveal();
    if (newVal) {
      // Expand the bar first — in full-screen this flips the host to the
      // position:fixed overlay (a one-off layout + paint). The panel surface
      // reveal is deferred to AFTER that layout has committed and painted
      // (see componentDidRender) so the fade is a pure compositor
      // transition over a settled layout. Doing both in the same frame made
      // the reveal compete with the overlay relayout and stuttered it.
      this.barExpanded = true;
      if (this.layout === 'full-screen') {
        this.pendingFullScreenReveal = true;
      } else {
        // Docked keeps the host in-flow, so there's no overlay relayout to
        // wait on — reveal synchronously.
        this.panelVisible = true;
      }
      this.applyOpenSideEffects();
      this.updateResultsStatus();
      this.syncExternalTriggerAria();
      this.mdOpen.emit();
    } else {
      // Panel surface fades out first; bar contraction follows after the fade.
      this.pendingFullScreenReveal = false;
      this.panelVisible = false;
      // Closing the view (Escape, back button, outside/dismiss) ends any
      // active voice session — the input has lost its search context.
      this.stopVoice();
      this.removeOutsideClickHandler();
      this.updateResultsStatus();
      this.mdClose.emit();
      this.syncExternalTriggerAria();
      this.closeTimer = setTimeout(() => {
        this.barExpanded = false;
        this.finishCloseSideEffects();
        // An external opener is the thing the user left to get here, so it is
        // where focus belongs on the way back — the built-in trigger gets this
        // for free by being inside the component.
        if (this.wiredTrigger && typeof document !== 'undefined') {
          const active = document.activeElement;
          const inSearch = active === this.el || this.el.contains(active as Node);
          if (active === document.body || inSearch) this.wiredTrigger.focus?.();
        }
        this.closeTimer = undefined;
      }, MdSearch.PANEL_CLOSE_MS);
    }
  }

  @Watch('loading')
  onLoadingChange(newVal: boolean) {
    // Re-announce so screen readers hear "Searching…" while the fetch is in
    // flight and the result count once it resolves.
    this.updateResultsStatus();
    this.updateLoadingMorph(newVal);
  }

  /**
   * Drive the trailing loading↔clear cross-fade. Mounting the loading
   * indicator immediately (and committing the visible state on the next frame)
   * animates the entry; keeping it mounted for one morph duration after
   * `loading` clears animates the exit before it unmounts.
   */
  private updateLoadingMorph(loading: boolean) {
    this.clearLoadingMorphTimers();
    if (loading) {
      this.loadingMorphMounted = true;
      if (typeof requestAnimationFrame === 'undefined') {
        this.loadingMorphIn = true;
        return;
      }
      this.loadingMorphInRaf = requestAnimationFrame(() => {
        this.loadingMorphInRaf = undefined;
        if (this.loading) this.loadingMorphIn = true;
      });
    } else {
      this.loadingMorphIn = false;
      this.loadingMorphTimer = setTimeout(() => {
        this.loadingMorphTimer = undefined;
        if (!this.loading) this.loadingMorphMounted = false;
      }, MdSearch.MORPH_MS);
    }
  }

  private clearLoadingMorphTimers() {
    if (this.loadingMorphTimer) {
      clearTimeout(this.loadingMorphTimer);
      this.loadingMorphTimer = undefined;
    }
    if (this.loadingMorphInRaf !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.loadingMorphInRaf);
      this.loadingMorphInRaf = undefined;
    }
  }

  componentDidRender() {
    if (!this.pendingFullScreenReveal) return;
    // The host's position:fixed overlay layout (floating bar + the
    // full-viewport panel surface) is now committed to the DOM and will
    // paint at the end of this frame while the panel is still transparent.
    // Flip the reveal on the NEXT frame so the opacity fade starts
    // from that painted, settled layout — no relayout on the animating
    // frames, which is what made the open read as stepped / slow.
    this.pendingFullScreenReveal = false;
    if (typeof requestAnimationFrame === 'undefined') {
      this.panelVisible = true;
      return;
    }
    this.revealRaf = requestAnimationFrame(() => {
      this.revealRaf = undefined;
      // Guard against a close that landed between the layout commit and here.
      if (this.open) this.panelVisible = true;
    });
  }

  private cancelReveal() {
    if (this.revealRaf !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.revealRaf);
    }
    this.revealRaf = undefined;
  }

  private clearCloseTimer() {
    if (this.closeTimer === undefined) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
  }

  private applyOpenSideEffects() {
    if (typeof document === 'undefined') return;
    this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    if (this.layout === 'full-screen') {
      // Lock document scroll. Compensate for the removed scrollbar with an
      // equal-width padding so the page (and the fixed overlay) doesn't
      // shift sideways when the scrollbar disappears — that lateral jump
      // was the main source of the open/close jitter.
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
    }
    this.attachOutsideClickHandler();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.focusInitialTarget());
    } else {
      this.focusInitialTarget();
    }
  }

  /**
   * Focus the open view's initial target. Defaults to the text field so the
   * user can type immediately; `initialFocus="leading"` focuses the leading
   * button instead. (The resting bar's leading-icon-first tab order is handled
   * by DOM order, not here.)
   */
  private focusInitialTarget() {
    const target = this.resolveInitialFocusTarget();
    // preventScroll: focusing the input must not trigger a scroll-into-view,
    // which forces a synchronous layout on the same frame the open transition
    // starts and stutters the reveal.
    target?.focus?.({ preventScroll: true });
  }

  private resolveInitialFocusTarget(): HTMLElement | undefined {
    // Opening the search view is about typing, so by default focus the text
    // field. The M3 "initial focus lands on a leading icon, else the text
    // field" rule is satisfied by the RESTING tab order: a slotted interactive
    // leading icon button is the first tabbable element, otherwise the input.
    // `initialFocus="leading"` opts the open view into focusing the leading
    // button instead.
    if (this.initialFocus === 'leading') {
      return this.leadingFocusTarget() ?? this.input;
    }
    return this.input;
  }

  /**
   * The focusable element representing the leading action: a focusable slotted
   * leading element (or its first inner focusable), falling back to the
   * built-in leading button when it's interactive (i.e. the bar is open).
   */
  private leadingFocusTarget(): HTMLElement | undefined {
    const focusableSel =
      'button, a[href], input, select, textarea, md-icon-button, md-button, [tabindex]:not([tabindex="-1"])';
    const slotted = this.el.querySelector('[slot="leading"]') as HTMLElement | null;
    if (slotted) {
      if (typeof slotted.focus === 'function' && slotted.getAttribute('tabindex') !== '-1') {
        if (slotted.matches(focusableSel)) return slotted;
      }
      const inner = slotted.querySelector(focusableSel) as HTMLElement | null;
      if (inner) return inner;
      return slotted;
    }
    const builtin = this.el.shadowRoot?.querySelector(
      '.md-search__leading-button',
    ) as HTMLElement | null;
    if (builtin && builtin.getAttribute('tabindex') !== '-1') return builtin;
    return undefined;
  }

  private finishCloseSideEffects() {
    if (typeof document !== 'undefined' && this.layout === 'full-screen') {
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-inline-end');
    }
    this.previousFocus?.focus?.();
    this.previousFocus = null;
  }

  private attachOutsideClickHandler() {
    if (!this.dismissOnOutsideClick || typeof document === 'undefined') return;
    this.outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this.el)) return;
      if (this.el.contains(target)) return;
      // An external trigger is by definition outside this element. Closing on
      // its mousedown would fight its own click handler — the view would shut
      // and reopen in the same gesture — so let the trigger own the toggle.
      const trigger = this.wiredTrigger;
      if (trigger && (path.includes(trigger) || trigger.contains(target))) return;
      this.open = false;
    };
    document.addEventListener('mousedown', this.outsideClickHandler, true);
  }

  private removeOutsideClickHandler() {
    if (this.outsideClickHandler && typeof document !== 'undefined') {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
    }
    this.outsideClickHandler = undefined;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Bar handlers
  // ────────────────────────────────────────────────────────────────────────

  private handleTriggerActivate = () => {
    if (this.disabled) return;
    if (!this.open) this.open = true;
  };

  private handleTriggerClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.handleTriggerActivate();
  };

  private handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this.handleTriggerActivate();
  };

  private handleBarClick = (e: MouseEvent) => {
    if (this.disabled) return;
    // Ignore clicks that originated inside the trailing cluster (those
    // belong to icon buttons / avatars) so they don't toggle the panel.
    const target = e.target as HTMLElement;
    if (target.closest('[part="trailing"]')) return;
    if (!this.open) this.open = true;
    this.input?.focus();
  };

  private handleLeadingClick = (e: MouseEvent) => {
    if (this.disabled) return;
    // The default leading button is interactive only while the bar is open —
    // clicking the morphed back-arrow dismisses the search. When closed, it is
    // non-interactive (pointer-events: none in CSS) so clicks fall through to
    // the bar's own handler which focuses the input. A custom slotted `leading`
    // icon, by contrast, is interactive in any state.
    const slotted = this.hasSlottedLeading;
    const interactiveDefault = !slotted && this.open;
    // Closed resting search glyph (no slot, not open): not a click target —
    // let it bubble to the bar to focus the input. No event.
    if (!slotted && !interactiveDefault) return;

    this.mdLeadingIconClick.emit({ value: this.value, open: this.open });

    // Preserve the default back-button dismiss behaviour; the slotted variant
    // leaves bar semantics to the consumer.
    if (interactiveDefault) {
      e.stopPropagation();
      this.open = false;
    }
  };

  private handleTrailingClick = (e: MouseEvent) => {
    if (this.disabled) return;
    const path = (typeof e.composedPath === 'function'
      ? e.composedPath()
      : []) as Array<EventTarget>;
    const nodes = path.length ? path : [e.target as EventTarget];
    // The clear (×) and voice (mic) affordances emit their own dedicated
    // events (mdClear / mdVoice) — don't double-fire a generic trailing event.
    const isOwnAffordance = nodes.some((n) => {
      const cl = (n as Partial<HTMLElement>)?.classList;
      return (
        !!cl?.contains?.('md-search__clear') ||
        !!cl?.contains?.('md-search__voice')
      );
    });
    if (isOwnAffordance) return;
    // Only emit when a slotted trailing affordance is actually present and was
    // the click target (ignore empty wrapper padding / the morph box). Read the
    // slot's assigned nodes directly rather than the slotchange-driven state,
    // which isn't seeded for content present at first render.
    const assigned = this.trailingSlotEl?.assignedElements?.() ?? [];
    if (assigned.length === 0) return;
    const target = nodes[0] as Node | undefined;
    const hitSlotted = assigned.some(
      (el) => el === target || (target ? el.contains(target) : false),
    );
    if (!hitSlotted) return;

    // Treat the slotted affordance like the built-in icon buttons: don't let
    // the click bubble to the bar and toggle the panel.
    e.stopPropagation();
    this.mdTrailingIconClick.emit({ value: this.value, open: this.open });
  };

  private handleClearClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.disabled) return;
    this.value = '';
    this.input?.focus();
    this.mdInput.emit({ value: '' });
    // Clearing should drop results immediately — flush past any pending
    // debounce so the empty query reaches the consumer without delay.
    this.pendingSearchValue = '';
    this.flushSearch();
    this.mdClear.emit();
  };

  // ────────────────────────────────────────────────────────────────────────
  // Voice search (Web Speech API)
  // ────────────────────────────────────────────────────────────────────────

  /** Resolve the (possibly prefixed) SpeechRecognition constructor, if any. */
  private getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
    if (typeof window === 'undefined') return undefined;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition;
  }

  /** Whether the Web Speech API is available in this environment. */
  private isVoiceSupported(): boolean {
    return !!this.getSpeechRecognitionCtor();
  }

  private resolveVoiceLang(): string {
    if (typeof document !== 'undefined') {
      const lang = this.el.getAttribute('lang') || document.documentElement.lang;
      if (lang) return lang;
    }
    return 'en-US';
  }

  private handleVoiceClick = (e: MouseEvent) => {
    // Keep the bar's click handler from re-toggling the panel.
    e.stopPropagation();
    if (this.disabled) return;
    if (this.listening) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  };

  /** Start streaming voice transcription into the input. No-op if unsupported. */
  @Method() async startVoice(): Promise<void> {
    this.startVoiceInternal();
  }

  /** Stop any active voice transcription. */
  @Method() async stopVoice(): Promise<void> {
    this.listening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* stop() throws if not started — safe to ignore. */
      }
    }
  }

  private startVoiceInternal() {
    const Ctor = this.getSpeechRecognitionCtor();
    if (!Ctor || this.disabled || this.listening) return;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        /* no-op */
      }
      this.recognition = undefined;
    }
    const recognition = new Ctor();
    recognition.lang = this.resolveVoiceLang();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = this.handleVoiceResult;
    recognition.onerror = this.handleVoiceEnd;
    recognition.onend = this.handleVoiceEnd;
    this.recognition = recognition;
    // Opening the view surfaces streamed results just like typing would.
    if (!this.open) this.open = true;
    this.input?.focus();
    this.listening = true;
    try {
      recognition.start();
    } catch {
      // start() throws if invoked while already running — reset our state.
      this.listening = false;
      this.recognition = undefined;
    }
  }

  private handleVoiceResult = (event: SpeechRecognitionEventLike) => {
    let transcript = '';
    let isFinal = false;
    const results = event.results;
    for (let i = 0; i < results.length; i++) {
      transcript += results[i][0].transcript;
      if (results[i].isFinal) isFinal = true;
    }
    transcript = transcript.replace(/^\s+/, '');
    // Mirror the transcript into the input and drive the normal typed flow.
    this.value = transcript;
    if (!this.open) this.open = true;
    this.mdInput.emit({ value: transcript });
    this.scheduleSearch(transcript);
    this.mdVoice.emit({ value: transcript, final: isFinal });
    if (isFinal) {
      // Flush the final query immediately, then end the session.
      this.pendingSearchValue = transcript;
      this.flushSearch();
      this.stopVoice();
    }
  };

  private handleVoiceEnd = () => {
    this.listening = false;
    this.recognition = undefined;
  };

  private handleInput = (e: Event) => {
    const next = (e.target as HTMLInputElement).value;
    this.value = next;
    // Typing activates the search view (it isn't opened by focus alone).
    if (!this.open && !this.disabled) this.open = true;
    // mdInput is immediate (every keystroke); mdSearch is debounced/throttled.
    this.mdInput.emit({ value: next });
    this.scheduleSearch(next);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Debounced search emission (debounce + throttle + distinctUntilChanged)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Queue an `mdSearch` emission for `value`, honouring `debounce` (trailing
   * wait for a typing pause) and `throttle` (maxWait — guarantees an emit at
   * least every `throttle` ms during sustained typing). With both at `0` the
   * emit is synchronous. Either way the actual emit is de-duplicated in
   * `flushSearch` (distinct-until-changed on the trimmed query).
   */
  private scheduleSearch(value: string) {
    this.pendingSearchValue = value;
    const debounceMs = Math.max(0, Number(this.debounce) || 0);
    const throttleMs = Math.max(0, Number(this.throttle) || 0);

    if (debounceMs === 0 && throttleMs === 0) {
      this.flushSearch();
      return;
    }

    // (Re)start the trailing debounce timer on every keystroke.
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => this.flushSearch(), debounceMs);

    // Throttle / maxWait: if the user keeps typing past `throttle` ms without
    // the debounce ever settling, force an emit so interim results still show.
    if (throttleMs > 0 && this.searchMaxWaitTimer === undefined) {
      this.searchMaxWaitTimer = setTimeout(() => this.flushSearch(), throttleMs);
    }
  }

  /** Emit the pending query now (clearing timers), if it differs from the last. */
  private flushSearch() {
    this.clearSearchTimers();
    if (this.pendingSearchValue === null) return;
    const value = this.pendingSearchValue;
    this.pendingSearchValue = null;
    const normalized = value.trim();
    if (normalized === this.lastEmittedSearch) return; // distinctUntilChanged
    this.lastEmittedSearch = normalized;
    this.mdSearch.emit({ value: normalized });
  }

  private clearSearchTimers() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = undefined;
    }
    if (this.searchMaxWaitTimer) {
      clearTimeout(this.searchMaxWaitTimer);
      this.searchMaxWaitTimer = undefined;
    }
  }

  /** Global modality trackers (capture phase) — see `keyboardModality`. */
  private trackKeyboardModality = () => {
    this.keyboardModality = true;
  };
  private trackPointerModality = () => {
    this.keyboardModality = false;
  };

  private handleInputFocus = () => {
    // Focus (e.g. via Tab) must NOT open the search view — it only moves focus.
    // The view opens on explicit activation: typing, Enter / Space, or click
    // (M3 keyboard spec: "Space or Enter activates the search text field").
    this.focused = true;
    // The focus ring is keyboard-only: show it only when the latest interaction
    // was via the keyboard (Tab, Enter / Space activation, arrows).
    this.showFocusRing = this.keyboardModality;
    this.valueOnFocus = this.value;
  };

  private handleInputBlur = () => {
    this.focused = false;
    this.showFocusRing = false;
    if (this.value !== this.valueOnFocus) {
      this.mdChange.emit({ value: this.value });
    }
  };

  private handleInputKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    // When closed, Enter / Space activate the field for input (open the view)
    // rather than submitting / inserting a space.
    if (!this.open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.open = true;
      }
      return;
    }
    if (e.key === 'Enter') {
      // Submitting should fetch the current query at once — flush past any
      // pending debounce before notifying submit listeners.
      this.pendingSearchValue = this.value;
      this.flushSearch();
      this.mdSubmit.emit({ value: this.value });
    }
  };

  @Listen('keydown', { target: 'window' })
  handleWindowKeyDown(e: KeyboardEvent) {
    if (!this.open) return;
    if (e.key === 'Escape' && this.escapeCloses) {
      e.preventDefault();
      this.open = false;
      return;
    }
    // Arrow keys move focus between the slotted search result items (M3
    // keyboard spec). Down from the input lands on the first item; Up from the
    // first item returns to the input.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (this.moveResultFocus(e.key === 'ArrowDown' ? 1 : -1)) {
        e.preventDefault();
      }
      return;
    }
    // Focus trap (full-screen only — docked is non-modal so Tab should
    // continue to the document like any other popup).
    if (this.layout !== 'full-screen' || e.key !== 'Tab') return;
    const focusables = this.collectFocusables();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = (this.el.shadowRoot?.activeElement ?? document.activeElement) as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private collectFocusables(): HTMLElement[] {
    const root = this.el.shadowRoot;
    if (!root) return [];
    const sel =
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), md-icon-button, md-button';
    const inShadow = Array.from(root.querySelectorAll(sel)) as HTMLElement[];
    const inLight = Array.from(this.el.querySelectorAll(sel)) as HTMLElement[];
    return [...inShadow, ...inLight].filter((node) => {
      if (node.hasAttribute('disabled')) return false;
      const tabindex = node.getAttribute('tabindex');
      return tabindex !== '-1';
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Autosuggest announcements (live region)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Count the result items the consumer placed in `slot="results"`. Reads the
   * host's light DOM (the slotted elements are children of `<md-search>`) so it
   * works regardless of slot/flatten support. Prefers semantic item selectors
   * (`md-list-item`, `[role="option"]`, `<li>`) so a single wrapping list
   * doesn't read as one result; falls back to the number of slotted containers
   * when no items are found.
   */
  private countResults(): number {
    const containers = Array.from(
      this.el.querySelectorAll('[slot="results"]'),
    ) as HTMLElement[];
    const itemSelector =
      'md-list-item, [role="option"], li, [data-search-result]';
    const items = new Set<Element>();
    for (const el of containers) {
      if (el.matches(itemSelector)) items.add(el);
      el.querySelectorAll(itemSelector).forEach((node) => items.add(node));
    }
    return items.size > 0 ? items.size : containers.length;
  }

  /**
   * The slotted result items, in DOM order. Uses the same semantic item
   * selectors as the announcement counter so arrow navigation steps through
   * the real list rows rather than a wrapping container.
   */
  private resultItems(): HTMLElement[] {
    const itemSelector =
      'md-list-item, [role="option"], [role="menuitem"], [data-search-result], li';
    const containers = Array.from(
      this.el.querySelectorAll('[slot="results"]'),
    ) as HTMLElement[];
    const items = new Set<HTMLElement>();
    for (const el of containers) {
      if (el.matches(itemSelector)) items.add(el);
      el.querySelectorAll(itemSelector).forEach((node) =>
        items.add(node as HTMLElement),
      );
    }
    return Array.from(items);
  }

  /**
   * Move focus across result items by `delta` (+1 / -1). Returns `true` if it
   * handled the key (so the caller can `preventDefault`). Stepping up past the
   * first item returns focus to the text field.
   */
  private moveResultFocus(delta: number): boolean {
    const items = this.resultItems();
    if (items.length === 0) return false;
    const active = (this.el.shadowRoot?.activeElement ??
      (typeof document !== 'undefined' ? document.activeElement : null)) as
      | HTMLElement
      | null;
    const current = active
      ? items.findIndex((it) => it === active || it.contains(active))
      : -1;

    if (delta > 0) {
      const next = current < 0 ? 0 : Math.min(current + 1, items.length - 1);
      this.focusResultItem(items[next]);
      return true;
    }
    // delta < 0
    if (current <= 0) {
      this.input?.focus();
      return true;
    }
    this.focusResultItem(items[current - 1]);
    return true;
  }

  private focusResultItem(item: HTMLElement) {
    // Make the row programmatically focusable if the consumer hasn't (roving
    // tabindex) so .focus() lands and screen readers announce the row.
    if (item.getAttribute('tabindex') === null) {
      item.setAttribute('tabindex', '-1');
    }
    item.focus?.();
  }

  /**
   * Recompute the polite live-region message. Only speaks while the panel is
   * open so suggestions are announced as they appear / change; clears when
   * closed so re-opening re-announces.
   */
  private updateResultsStatus() {
    if (!this.announceResults || !this.open) {
      this.resultsStatus = '';
      return;
    }
    // While a fetch is in flight, announce the loading state rather than a
    // (stale) count so screen-reader users know results are on the way.
    if (this.loading) {
      this.resultsStatus = this.loadingLabel;
      return;
    }
    const count = this.countResults();
    if (count > 0) {
      this.resultsStatus = this.resultsLabel.replace('{count}', String(count));
    } else if (this.shouldShowVisibleEmptyState()) {
      // The visible empty state (role="status", aria-live) owns this copy.
      this.resultsStatus = '';
    } else {
      this.resultsStatus = this.value.trim() ? this.noResultsLabel : '';
    }
  }

  /**
   * Whether to render the on-screen empty state in the results panel.
   * Requires an open panel, a non-empty query, zero detected result rows,
   * and no in-flight loading fetch.
   */
  private shouldShowVisibleEmptyState(): boolean {
    return (
      this.panelVisible &&
      !this.loading &&
      this.countResults() === 0 &&
      this.value.trim().length > 0
    );
  }

  /**
   * Whether the results panel should render visible chrome (divider, drawer,
   * empty state, slotted list). When the bar is open but there is nothing to
   * show yet — no query, no rows, not loading — keep the bar alone so a stray
   * divider or empty panel shell does not appear under it.
   */
  private shouldShowResultsChrome(): boolean {
    if (!this.panelVisible || this.loading) return false;
    if (this.countResults() > 0) return true;
    return this.shouldShowVisibleEmptyState();
  }

  /**
   * Whether the results panel surface is visible (opacity / pointer-events).
   * Full-screen open is always an edge-to-edge overlay once the panel commits,
   * even before slotted rows are detected. Docked / inline only open the drawer
   * when there is meaningful content to show.
   */
  private isPanelRevealed(): boolean {
    if (this.layout === 'full-screen') {
      return this.panelVisible && this.barExpanded;
    }
    return this.shouldShowResultsChrome();
  }

  /**
   * The accessible name for the bar / input. Falls back to the hinted search
   * text (`placeholder`) per the M3 labeling guidance when `inputAriaLabel`
   * isn't set.
   */
  private effectiveLabel(): string {
    return this.inputAriaLabel || this.placeholder || 'Search';
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the open-state glyph. When a consumer hasn't passed
   * `open-leading-icon` we fall back to a variant-aware default —
   * `chevron_left` for the Expressive `contained` bar (whose pill shape
   * pairs better with a caret) and the spec-canonical `arrow_back` for
   * the baseline `divided` bar.
   */
  private resolveOpenLeadingIcon(): string {
    if (this.openLeadingIcon) return this.openLeadingIcon;
    return this.variant === 'contained' ? 'chevron_left' : 'arrow_back';
  }

  private renderTrigger() {
    if (!this.usesIconTrigger || this.barExpanded) return null;
    // An external opener replaces the built-in one — two ways in would be a
    // confusing surface, and only one of them can own the focus round trip.
    if (this.hasExternalTrigger) return null;

    return (
      <div class="md-search__trigger" part="trigger">
        <slot name="trigger">
          <md-icon-button
            class="md-search__trigger-button"
            part="trigger-button"
            icon={this.triggerIcon}
            variant="standard"
            size="md"
            disabled={this.disabled}
            aria-label={this.effectiveLabel()}
            onClick={this.handleTriggerClick}
            onKeyDown={this.handleTriggerKeyDown}
          ></md-icon-button>
        </slot>
      </div>
    );
  }

  private renderLeading() {
    // The leading button is always rendered with BOTH glyphs stacked so the
    // search ↔ back-arrow change reads as a single icon morphing rather than
    // two icons swapping. The `--button` modifier flips on as soon as the
    // bar is open in either layout (M3 docked panels traditionally keep the
    // search glyph, but the morph affordance reads better and ties the
    // dismiss action to a single, predictable spot).
    const showCloseButton = this.barExpanded;
    const ariaLabel = showCloseButton ? 'Close search' : 'Search';
    const openGlyph = this.resolveOpenLeadingIcon();

    return (
      <span
        class={{
          'md-search__leading': true,
          'md-search__leading--button': showCloseButton,
        }}
        part="leading"
        onClick={this.handleLeadingClick}
      >
        <slot name="leading">
          <button
            type="button"
            class="md-search__leading-button"
            aria-label={ariaLabel}
            tabIndex={showCloseButton ? 0 : -1}
            disabled={this.disabled}
          >
            <span
              class="md-search__leading-state-layer"
              part="leading-state-layer"
              aria-hidden="true"
            ></span>
            <span
              class="md-search__icon md-search__icon--resting material-symbols-outlined"
              aria-hidden="true"
            >
              {this.leadingIcon}
            </span>
            <span
              class="md-search__icon md-search__icon--open material-symbols-outlined"
              aria-hidden="true"
            >
              {openGlyph}
            </span>
          </button>
        </slot>
      </span>
    );
  }

  private renderClearButton() {
    if (!this.showClearButton || !this.value) return null;
    return (
      <button
        type="button"
        class="md-search__icon-button md-search__clear"
        part="clear-button"
        aria-label="Clear search"
        onClick={this.handleClearClick}
      >
        <span class="md-search__icon material-symbols-outlined" aria-hidden="true">
          close
        </span>
      </button>
    );
  }

  private renderVoiceButton() {
    return (
      <button
        type="button"
        class={{
          'md-search__icon-button': true,
          'md-search__voice': true,
          'md-search__voice--listening': this.listening,
        }}
        part="voice-button"
        aria-label={this.listening ? 'Stop voice search' : 'Search by voice'}
        aria-pressed={this.listening ? 'true' : 'false'}
        disabled={this.disabled}
        onClick={this.handleVoiceClick}
      >
        <span class="md-search__icon material-symbols-outlined" aria-hidden="true">
          mic
        </span>
      </button>
    );
  }

  private renderTrailing() {
    const showClear = this.showClearButton && this.value.length > 0;
    // The loading indicator stays mounted through its fade-out (morph), so the
    // box is shown whenever there's a clear button OR the morph is in-flight.
    const showMorph = showClear || this.loadingMorphMounted;
    const showVoice = this.voiceSearch && this.isVoiceSupported();

    // Don't render an empty trailing wrapper: only mount it when it has a morph
    // box, a mic, or (potential) slotted content. The named slot itself is the
    // projection point and must stay so slotchange detection keeps working.
    return (
      <span
        class="md-search__trailing"
        part="trailing"
        onClick={this.handleTrailingClick}
      >
        {/* Loading indicator and clear-× share one fixed-size box and cross-fade
            (scale + rotate) in BOTH directions as `loading` toggles, so the
            cluster width never jumps. */}
        {showMorph && (
          <span
            class={{
              'md-search__trailing-morph': true,
              'md-search__trailing-morph--loading': this.loadingMorphIn,
            }}
          >
            {this.loadingMorphMounted && (
              // `loader` swaps the spinner (e.g. for a circular
              // md-progress-indicator); the default keeps the morph classes and
              // the exported shape part.
              <slot name="loader">
                <LazyLoadingIndicator
                  class="md-search__loading"
                  part="loading"
                  exportparts="shape:loading-shape"
                  label={this.loadingLabel}
                ></LazyLoadingIndicator>
              </slot>
            )}
            {showClear && this.renderClearButton()}
          </span>
        )}
        {showVoice && this.renderVoiceButton()}
        <slot name="trailing"></slot>
      </span>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  render() {
    const isFullScreen = this.layout === 'full-screen';
    const hostStyle: Record<string, string> = {};
    if (this.maxBlockSize) {
      hostStyle['--_max-block-size'] = this.maxBlockSize;
    }

    return (
      <Host
        class={{
          'md-search': true,
          [`md-search--${this.variant}`]: true,
          [`md-search--${this.layout}`]: true,
          [`md-search--trigger-${this.effectiveTrigger}`]: true,
          'md-search--open': this.barExpanded,
          'md-search--panel-content':
            this.layout === 'full-screen'
              ? this.isPanelRevealed()
              : this.shouldShowResultsChrome(),
          'md-search--closed': !this.barExpanded,
          'md-search--has-slotted-trigger': this.hasSlottedTrigger,
          'md-search--disabled': this.disabled,
          'md-search--focused': this.focused,
          'md-search--has-value': this.value.length > 0,
          'md-search--has-slotted-leading': this.hasSlottedLeading,
          'md-search--has-slotted-trailing': this.hasSlottedTrailing,
          'md-search--full-width': this.fullWidth,
          [`md-search--elevation-${this.elevation}`]: true,
        }}
        style={Object.keys(hostStyle).length > 0 ? hostStyle : undefined}
      >
        {/* Hidden probe — resolves the bar's per-side focus travel
            (resting − focused inset) to a pixel length so
            measureRippleExtend() can forward the value to <md-ripple>.
            Lives directly under :host (NOT inside the bar) so its
            absolute-positioning containing block matches the bar's,
            which is what makes any percentage in the insets resolve
            against the same inline-size for both. */}
        <span
          class="md-search__inset-probe"
          ref={(el) => (this.insetProbeEl = el as HTMLElement)}
          aria-hidden="true"
        ></span>

        {/* Polite live region — announces suggestion / result availability to
            assistive tech as the slotted results change (M3 autosuggest). */}
        <div
          class="md-search__a11y-status"
          part="status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {this.resultsStatus}
        </div>

        {this.renderTrigger()}

        {/* Search bar — hidden for full-screen icon trigger until open */}
        {this.showBar && (
          <div
            class={{
              'md-search__bar': true,
              'md-search__bar--focused': this.focused,
              'md-search__bar--focus-ring': this.showFocusRing,
            }}
            part="bar"
            onClick={this.handleBarClick}
          >
            {!this.disabled && (
              <md-ripple ref={(el) => (this.rippleEl = el as HTMLElement)}></md-ripple>
            )}
            <span class="md-search__state-layer" part="state-layer" aria-hidden="true"></span>

            {this.renderLeading()}

            <input
              ref={(el) => (this.input = el)}
              class="md-search__input"
              part="input"
              type="search"
              role="combobox"
              value={this.value}
              placeholder={this.placeholder}
              disabled={this.disabled}
              aria-label={this.effectiveLabel()}
              aria-expanded={this.open ? 'true' : 'false'}
              aria-controls="md-search-panel"
              aria-autocomplete="list"
              autocomplete="off"
              spellcheck={false}
              onInput={this.handleInput}
              onFocus={this.handleInputFocus}
              onBlur={this.handleInputBlur}
              onKeyDown={this.handleInputKeyDown}
            />

            {this.renderTrailing()}
          </div>
        )}

        {/* Results panel — positioning + dialog chrome. Long lists plain-scroll
            in the results viewport (`.md-search__results-scroll`) with a native
            scrollbar aligned to the slotted surface. */}
        <div
          id="md-search-panel"
          class={{
            'md-search__panel': true,
            [`md-search__panel--${this.layout}`]: true,
            'md-search__panel--open': this.isPanelRevealed(),
          }}
          part="panel"
          role="dialog"
          aria-modal={isFullScreen && this.isPanelRevealed() ? 'true' : 'false'}
          aria-hidden={this.isPanelRevealed() ? 'false' : 'true'}
          aria-label={this.effectiveLabel()}
        >
          {/* Hairline divider is a `divided`-variant affordance only — don't
              emit the empty element for the contained variant. */}
          {this.variant === 'divided' && this.isPanelRevealed() && (
            <div class="md-search__divider" part="divider" aria-hidden="true"></div>
          )}

          <div
            class={{
              'md-search__panel-body': true,
              'md-search__panel-body--empty': this.shouldShowVisibleEmptyState(),
            }}
            part="panel-body"
          >
            {this.shouldShowVisibleEmptyState() && (
              <p
                class="md-search__empty"
                part="empty"
                role="status"
                aria-live="polite"
              >
                {this.noResultsLabel}
              </p>
            )}
            <div
              class="md-search__results-host"
              part="results-host"
              hidden={this.shouldShowVisibleEmptyState() ? true : undefined}
              aria-hidden={this.shouldShowVisibleEmptyState() ? 'true' : undefined}
            >
              <div class="md-search__results-scroll" part="results-viewport">
                <slot name="results"></slot>
              </div>
            </div>
          </div>
        </div>
      </Host>
    );
  }
}

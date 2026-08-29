import {
  Component,
  Host,
  h,
  Prop,
  State,
  Element,
  Watch,
  Listen,
  Event,
  EventEmitter,
  Method,
  forceUpdate,
} from '@stencil/core';

/**
 * `md-stepper` — Material Design 3 stepper. Orchestrates a set of slotted
 * `md-step` children: it owns the active index and navigation, and pushes
 * layout / i18n down to each step.
 *
 * **Controlled, with optional auto-progress.** The stepper owns `active`
 * (updated on click / `next` / `prev` / `goTo`, emitting `mdStepChange`). With
 * `auto-complete` (default), advancing marks the step you leave as `completed`,
 * so the progress line + checks "just work" — no manual wiring. Set
 * `auto-complete="false"` to own `completed` yourself.
 *
 * ```html
 * <md-stepper active="0">
 *   <md-step label="Account"><p>…</p></md-step>
 *   <md-step label="Shipping" optional><p>…</p></md-step>
 *   <md-step label="Payment" editable><p>…</p></md-step>
 * </md-stepper>
 * ```
 *
 * @slot - `md-step` children.
 * @slot content - Content area for **horizontal** steppers, rendered between
 *                 the step row and the built-in nav bar. Put the active step's
 *                 panel here and swap it on `mdStepChange` (vertical steppers
 *                 render content inside each step instead).
 * @part list - The ordered list wrapping the steps.
 * @part content - Wrapper around the `content` slot.
 * @part nav - The horizontal Back / Continue button bar.
 * @part mobile-nav - The compact `variant="mobile"` bar.
 * @part mobile-progress - The centered progress (dots / caption) in the mobile bar.
 */
@Component({
  tag: 'md-stepper',
  styleUrl: 'md-stepper.css',
  shadow: true,
})
export class MdStepper {
  @Element() el!: HTMLElement;

  /** Layout orientation. */
  @Prop({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';

  /** Indicator style: `numbered` circles or minimal `dot`s. */
  @Prop({ reflect: true }) indicator: 'numbered' | 'dot' = 'numbered';

  /**
   * Layout variant:
   * - `default` — the full step row (headers + connectors).
   * - `mobile` — a compact MUI-style bar for narrow screens: **Back**, a centered
   *   progress (dots for `indicator="dot"`, else a "Step N of M" caption), and
   *   **Continue / Finish**. The step headers are hidden; put the active step's
   *   panel in the `content` slot and swap it on `mdStepChange`.
   */
  @Prop({ reflect: true }) variant: 'default' | 'mobile' = 'default';

  /**
   * - `linear` (default) — steps must be completed in order; future steps are
   *   not reachable until the prior ones are done or optional (an `editable`
   *   completed step can always be revisited).
   * - `non-linear` — any step can be selected.
   */
  @Prop({ reflect: true }) mode: 'linear' | 'non-linear' = 'linear';

  /** Index of the active step. Two-way bindable. Out-of-range values clamp. */
  @Prop({ mutable: true, reflect: true }) active: number = 0;

  /**
   * When advancing (via `next()` or a step's built-in Continue button), mark the
   * step being left as `completed`. Default `true`. Turn off to fully control
   * completion yourself.
   */
  @Prop({ attribute: 'auto-complete' }) autoComplete: boolean = true;

  /**
   * Show the built-in **Back / Continue** navigation (default `true`) so users
   * always have a clear way to move through the flow:
   * - vertical → the buttons sit under each active step (Material wizard style),
   * - horizontal → a single button bar below the stepper.
   * Set `nav="false"` to drive navigation entirely yourself (clicking steps,
   * `next()` / `prev()`, or your own controls).
   */
  @Prop() nav: boolean = true;

  /**
   * Render the stepper as a **status trail**: something to read, not to drive.
   * Every step header stops being a button — no click, no keyboard activation,
   * no ripple, no hover state layer, no tab stop, no `role="button"` — while
   * `aria-current` still says which stage it is on. Not the same as
   * `nav="false"`, which only hides the Back / Continue bar.
   */
  @Prop({ reflect: true }) readonly: boolean = false;

  /**
   * Disable the built-in **Continue / Finish** button without disabling Back or
   * the whole step. Bind this to your current step's form validity to gate
   * advancement declaratively (the most common wizard need). Step clicks and the
   * `next()`/`goTo()` methods are unaffected — use `mode="linear"` and/or
   * `mdBeforeChange` for those.
   */
  @Prop({ attribute: 'next-disabled' }) nextDisabled: boolean = false;

  /**
   * Put the built-in **Continue / Finish** button into a loading state (spinner +
   * interactive-disabled) and disable **Back**, for async submit-on-Continue
   * (prevents double-submit). Toggle it around your `await` — typically inside an
   * `mdBeforeChange` handler that `preventDefault()`s, does async work, then
   * commits by setting `active`.
   */
  @Prop() loading: boolean = false;

  /**
   * Only mount the **active** vertical step's content panel; inactive panels are
   * removed from layout and the a11y tree (no collapse animation). Use for
   * wizards with heavy per-step content. Note: slotted custom elements stay
   * *connected* in the light DOM — for full teardown, conditionally render the
   * content in your framework.
   */
  @Prop() lazy: boolean = false;

  // ─── i18n ──────────────────────────────────────────────────
  /** Accessible name for the navigation landmark. */
  @Prop() label: string = 'Progress';
  /** Localized word for "Step" in each step's announced name ("Step 2 of 4"). */
  @Prop({ attribute: 'step-word' }) stepWord: string = 'Step';
  /** Localized word for "of" in each step's announced name ("Step 2 of 4"). */
  @Prop({ attribute: 'of-word' }) ofWord: string = 'of';
  /** Localized word announced for a completed step ("…, completed"). */
  @Prop({ attribute: 'completed-word' }) completedWord: string = 'completed';
  /** Localized word announced for the current step ("…, current"). */
  @Prop({ attribute: 'current-word' }) currentWord: string = 'current';
  /** Localized word announced for a step in error ("…, error: message"). */
  @Prop({ attribute: 'error-word' }) errorWord: string = 'error';
  /** Caption + announced word for optional steps. */
  @Prop({ attribute: 'optional-word' }) optionalWord: string = 'Optional';
  /** Label for the built-in Continue button. */
  @Prop({ attribute: 'next-label' }) nextLabel: string = 'Continue';
  /** Label for the built-in Back button. */
  @Prop({ attribute: 'back-label' }) backLabel: string = 'Back';
  /** Label for the built-in Continue button on the last step. */
  @Prop({ attribute: 'finish-label' }) finishLabel: string = 'Finish';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires BEFORE a user-driven step change commits (step click, built-in nav, or
   * `next()`/`prev()`/`goTo()`). Cancelable: call `event.preventDefault()` to
   * veto the transition (e.g. block Continue until the current step validates).
   * `detail.index` is the requested step, `detail.previous` the current one.
   * Does not fire for a direct `active` property assignment — set `active`
   * yourself to commit authoritatively (e.g. after async validation).
   */
  @Event({ cancelable: true }) mdBeforeChange: EventEmitter<{ index: number; previous: number }>;

  /** Active step changed (after it commits). */
  @Event() mdStepChange: EventEmitter<{ index: number; previous: number }>;

  /** Continue pressed on the last step (the flow is finished). */
  @Event() mdComplete: EventEmitter<void>;

  /** Step count — drives the horizontal nav bar's Continue↔Finish label. */
  @State() private stepCount = 0;

  /** Visually-hidden polite announcement of the active step (a11y). */
  @State() private liveMessage = '';

  /** Visually-hidden assertive announcement when a step enters error (a11y). */
  @State() private errorMessage = '';

  private steps: HTMLMdStepElement[] = [];

  /** Last known-valid active index — the true `previous` for mdStepChange even
   *  when the watch re-enters through clamping (where Stencil's `oldVal` is the
   *  bogus out-of-range value). */
  private lastActive = 0;

  componentWillLoad() {
    // Sync before first render: steps get correct data-* immediately (no
    // "every bubble is 1" flash), stepCount is set outside didLoad (no Stencil
    // re-render warning), and an out-of-range initial `active` clamps.
    this.collectSteps();
    this.active = this.clampToValidStep(this.active);
    this.lastActive = this.active;
    this.syncSteps();
  }

  componentDidLoad() {
    this.syncSteps();
    this.observeStepState();
  }

  disconnectedCallback() {
    this.stepObserver?.disconnect();
    this.stepObserver = undefined;
  }

  @Watch('active')
  onActiveChange(newVal: number) {
    this.collectSteps();
    const clamped = this.clampToValidStep(newVal);
    if (clamped !== newVal) {
      this.active = clamped; // re-enters this watch with the clamped value
      return;
    }
    const previous = this.lastActive;
    if (clamped === previous) return; // clamp round-trip — nothing changed
    this.lastActive = clamped;
    // Auto-complete treats completion as strict progress. This lives in the WATCH
    // (not next()) so EVERY commit path is consistent — the built-in nav, the
    // methods, AND a direct `active = n` assignment (the async-veto bypass):
    //  • FORWARD → mark every non-disabled step you passed over as completed;
    //  • BACKWARD → un-complete the target step and everything after it, so a
    //    later step can never stay checked while an earlier one isn't (e.g.
    //    finishing then stepping back mustn't orphan the last step as completed).
    //    Exception: revisiting an `editable` completed step is review-in-place,
    //    so downstream completion survives.
    // (In controlled mode, `auto-complete="false"`, completion is always yours.)
    if (this.autoComplete) {
      this.mutatingSelf(() => {
        if (clamped > previous) {
          this.steps.forEach((s, i) => {
            if (i >= previous && i < clamped && !s.disabled) {
              s.completed = true;
              s.error = false;
            }
          });
        } else {
          const target = this.steps[clamped];
          if (!(target?.editable && target?.completed)) {
            this.steps.forEach((s, i) => {
              if (i >= clamped) s.completed = false;
            });
          }
        }
      });
    }
    this.syncSteps();
    this.mdStepChange.emit({ index: clamped, previous });
    this.announceStep(clamped);
  }

  @Watch('orientation')
  @Watch('indicator')
  @Watch('mode')
  @Watch('nav')
  @Watch('readonly')
  @Watch('variant')
  @Watch('lazy')
  @Watch('loading')
  @Watch('nextDisabled')
  @Watch('stepWord')
  @Watch('ofWord')
  @Watch('completedWord')
  @Watch('currentWord')
  @Watch('errorWord')
  @Watch('optionalWord')
  @Watch('nextLabel')
  @Watch('backLabel')
  @Watch('finishLabel')
  onConfigChange() {
    this.syncSteps();
  }

  // ─── Navigation from children ──────────────────────────────
  /** Step events are internal coordination between a step and ITS stepper —
   *  only honor events from direct children (a nested stepper's steps must not
   *  drive this one) and stop them there. */
  private ownsStepEvent(e: globalThis.Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && t.parentElement === this.el && t.tagName.toLowerCase() === 'md-step';
  }

  @Listen('mdStepClick')
  onStepClick(e: CustomEvent<{ index: number }>) {
    if (!this.ownsStepEvent(e)) return;
    e.stopPropagation();
    const target = e.detail.index;
    if (target === this.active) return;
    if (this.canNavigateTo(target)) this.commitChange(target);
  }

  @Listen('mdStepNext')
  async onStepNext(e: CustomEvent<{ index: number }>) {
    if (!this.ownsStepEvent(e)) return;
    e.stopPropagation();
    const before = this.active;
    await this.next();
    // The button that was pressed collapses with its panel — move focus to the
    // new active header so keyboard users aren't dropped to <body>.
    if (this.active !== before) this.focusActiveStep();
  }

  @Listen('mdStepBack')
  async onStepBack(e: CustomEvent<{ index: number }>) {
    if (!this.ownsStepEvent(e)) return;
    e.stopPropagation();
    const before = this.active;
    await this.prev();
    if (this.active !== before) this.focusActiveStep();
  }

  /** The footer bar's own md-buttons emit composed `mdClick` that retargets to
   *  this host — internal chrome, don't leak it to app-level delegation. */
  @Listen('mdClick')
  onInternalMdClick(e: globalThis.Event) {
    if (e.target === this.el) e.stopPropagation();
  }

  // ─── Public methods ────────────────────────────────────────
  /** Advance to the next non-disabled step (emitting a cancelable
   *  `mdBeforeChange`). When `auto-complete` is on, the step you leave is marked
   *  completed; past the last reachable step it emits `mdComplete`. */
  @Method()
  async next(): Promise<void> {
    this.collectSteps();
    if (this.steps.length === 0) return;
    let target = this.active + 1;
    while (target < this.steps.length && this.steps[target].disabled) target++;
    if (target >= this.steps.length) {
      // Finishing on the last step: complete it (auto-complete) and emit
      // mdComplete. Async submit-on-finish is done by the consumer via `loading`
      // + the `mdComplete` handler.
      const current = this.steps[this.active];
      if (this.autoComplete && current && !current.disabled) {
        this.mutatingSelf(() => {
          current.completed = true;
          current.error = false;
        });
      }
      this.syncSteps();
      this.mdComplete.emit();
      return;
    }
    this.commitChange(target);
  }

  /** Step backward to the previous non-disabled step (emitting `mdBeforeChange`). */
  @Method()
  async prev(): Promise<void> {
    this.collectSteps();
    let target = this.active - 1;
    while (target >= 0 && this.steps[target]?.disabled) target--;
    if (target < 0) return;
    this.commitChange(target);
  }

  /** Jump to a step (out-of-range clamps; honors `linear` reachability; emits
   *  `mdBeforeChange`). */
  @Method()
  async goTo(index: number): Promise<void> {
    this.collectSteps();
    const clamped = this.clampToValidStep(index);
    if (this.canNavigateTo(clamped)) this.commitChange(clamped);
  }

  /** Reset to the first step and clear completed / error state. */
  @Method()
  async reset(): Promise<void> {
    this.collectSteps();
    this.mutatingSelf(() => {
      this.steps.forEach((s) => {
        s.completed = false;
        s.error = false;
      });
    });
    this.active = 0;
    this.syncSteps();
  }

  // ─── Internals ─────────────────────────────────────────────
  /** Commit a user-driven step change, first giving the app a chance to veto via
   *  the cancelable `mdBeforeChange` event. Returns whether the change committed. */
  private commitChange(target: number): boolean {
    if (target === this.active) return false;
    const ev = this.mdBeforeChange.emit({ index: target, previous: this.active });
    if (ev.defaultPrevented) return false;
    this.active = target;
    return true;
  }

  /** Watch the light-DOM children's reflected state attributes so the stepper
   *  re-gates reachability when a controlled host mutates completed/optional/
   *  disabled without a navigation, and announces a step that enters error. */
  private stepObserver?: MutationObserver;
  private observeStepState() {
    if (typeof MutationObserver === 'undefined') return;
    this.stepObserver = new MutationObserver((records) => {
      let entered: HTMLMdStepElement | null = null;
      for (const r of records) {
        if (r.attributeName === 'error') {
          const el = r.target as HTMLMdStepElement;
          if (el.error && el.tagName.toLowerCase() === 'md-step') entered = el;
        }
      }
      // Re-gate the affordance against the new state (idempotent — settles).
      this.syncSteps();
      if (entered) this.announceError(entered);
    });
    this.attachObserver();
  }

  private attachObserver() {
    // `active` is stamped by the stepper itself; excluding it avoids a feedback
    // loop. The remaining attrs are watched only for APP-driven changes — the
    // stepper's own completion writes run inside `mutatingSelf` (observer off).
    this.stepObserver?.observe(this.el, {
      subtree: true,
      attributes: true,
      attributeFilter: ['completed', 'error', 'optional', 'disabled'],
    });
  }

  /** Run a block that mutates the steps' own completed/error state without the
   *  observer reacting — those writes are already reconciled by syncSteps, so
   *  self-triggering it again is redundant work (and perturbs fill animations).
   *  External writes, made while the observer is attached, still re-gate. */
  private mutatingSelf(fn: () => void) {
    this.stepObserver?.disconnect();
    try {
      fn();
    } finally {
      this.attachObserver();
    }
  }

  private announceStep(index: number) {
    const step = this.steps[index];
    if (!step) return;
    let msg = `${this.stepWord} ${index + 1} ${this.ofWord} ${this.stepCount}`;
    if (step.label) msg += `: ${step.label}`;
    if (step.optional) msg += `, ${this.optionalWord}`;
    if (step.completed) msg += `, ${this.completedWord}`;
    msg += `, ${this.currentWord}`;
    this.liveMessage = msg;
  }

  private announceError(step: HTMLMdStepElement) {
    const index = this.steps.indexOf(step);
    let msg = `${this.stepWord} ${index + 1} ${this.ofWord} ${this.stepCount}`;
    if (step.label) msg += `: ${step.label}`;
    msg += `, ${this.errorWord}`;
    if (step.errorText) msg += `: ${step.errorText}`;
    this.errorMessage = msg;
  }

  private canNavigateTo(target: number): boolean {
    this.collectSteps();
    const step = this.steps[target];
    if (!step || step.disabled) return false;
    if (this.mode !== 'linear') return true;
    if (target <= this.active) return true; // back is always allowed
    if (step.completed) return true; // revisit a completed (e.g. editable) step
    // forward only when every prior step is completed or skippable
    return this.steps.slice(0, target).every((s) => s.completed || s.optional);
  }

  private clampToValidStep(index: number): number {
    if (this.steps.length === 0) return 0;
    return Math.max(0, Math.min(this.steps.length - 1, index | 0));
  }

  private collectSteps() {
    this.steps = (Array.from(this.el.children) as HTMLElement[]).filter(
      (c) => c.tagName.toLowerCase() === 'md-step',
    ) as HTMLMdStepElement[];
  }

  private focusActiveStep() {
    const step = this.steps[this.active];
    (step?.shadowRoot?.querySelector('.md-step__inner') as HTMLElement | null)?.focus();
  }

  /** Whitespace-only text (pretty-printed markup) is not content. Mirrors
   *  md-step's own computeSlottedContent so the two agree on "has a panel". */
  private static hasOwnContent(step: Element): boolean {
    return Array.from(step.childNodes).some(
      (n) =>
        n.nodeType === Node.ELEMENT_NODE ||
        (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''),
    );
  }

  private syncSteps() {
    this.collectSteps();
    const total = this.steps.length;
    this.stepCount = total;
    // Per-step panels are opt-in and detected, not configured: if any step has
    // light-DOM content of its own, the horizontal row switches to the grid
    // layout. A stepper whose steps are all empty renders byte-identically to
    // before this existed.
    const panelMode =
      this.orientation === 'horizontal' && this.steps.some((s) => MdStepper.hasOwnContent(s))
        ? 'step'
        : 'shared';
    if (this.el.getAttribute('data-panel-mode') !== panelMode) {
      this.el.setAttribute('data-panel-mode', panelMode);
    }
    this.el.style.setProperty('--md-stepper-step-count', String(total));

    this.steps.forEach((step, index) => {
      const set = (k: string, v: string) => {
        if (step.getAttribute(k) !== v) step.setAttribute(k, v);
      };
      set('data-index', String(index));
      set('data-total', String(total));
      set('data-active', String(this.active));
      set('data-orientation', this.orientation);
      set('data-indicator', this.indicator);
      set('data-mode', this.mode);
      set('data-position', index === 0 ? 'first' : index === total - 1 ? 'last' : 'middle');
      set('data-step-word', this.stepWord);
      set('data-of-word', this.ofWord);
      set('data-completed-word', this.completedWord);
      set('data-current-word', this.currentWord);
      set('data-error-word', this.errorWord);
      set('data-optional-word', this.optionalWord);
      set('data-next-label', this.nextLabel);
      set('data-back-label', this.backLabel);
      set('data-finish-label', this.finishLabel);
      set('data-nav', String(this.nav));
      set('data-readonly', String(this.readonly));
      set('data-loading', String(this.loading));
      set('data-next-disabled', String(this.nextDisabled));
      set('data-lazy', String(this.lazy));
      // Horizontal panel placement. A horizontal stepper normally takes ONE
      // shared panel in its own `content` slot, because a slot cannot reach a
      // grandchild — `md-step`'s children can only ever be rendered by
      // `md-step` itself. When steps carry their own content we opt the row
      // into a grid instead, so each step's panel can span the full width
      // under the row (see md-step.css §"horizontal panel").
      set('data-panel-mode', panelMode);
      // Drives the staggered entrance animation delay in CSS.
      step.style.setProperty('--md-step-idx', String(index));
      const shouldBeActive = index === this.active;
      if (step.active !== shouldBeActive) step.active = shouldBeActive;
      // The connector fill is position-driven (index vs active), read from the
      // `data-active` attribute — which isn't a reactive prop. Steps whose own
      // `active` flag didn't change (e.g. those between the old and new active
      // on a multi-step jump) wouldn't otherwise re-render, leaving their
      // connectors stale. Force each step to re-render so the fill stays exact.
      forceUpdate(step);
    });
  }

  private handleSlotChange = () => {
    this.collectSteps();
    const clamped = this.clampToValidStep(this.active);
    if (clamped !== this.active) {
      // Steps were removed out from under the active index — re-clamp (the
      // watch syncs + emits with the true previous).
      this.active = clamped;
    } else {
      this.syncSteps();
    }
  };

  private handleFooterBack = async () => {
    await this.prev();
    // Back disables itself on the first step while focused — rescue focus.
    if (this.active === 0) this.focusActiveStep();
  };

  render() {
    const mobile = this.variant === 'mobile';
    return (
      <Host
        class={{
          'md-stepper': true,
          [`md-stepper--${this.orientation}`]: true,
          [`md-stepper--indicator-${this.indicator}`]: true,
          [`md-stepper--mode-${this.mode}`]: true,
          'md-stepper--mobile': mobile,
        }}
        role="navigation"
        aria-label={this.label}
      >
        {/* Visually-hidden announcers: the horizontal footer nav keeps focus on
            its buttons (so Continue can be pressed repeatedly), so step changes
            and freshly-set errors are surfaced to assistive tech here instead. */}
        <div class="md-stepper__live" aria-live="polite" role="status">{this.liveMessage}</div>
        <div class="md-stepper__live" aria-live="assertive" role="alert">{this.errorMessage}</div>

        <ol class="md-stepper__list" part="list">
          <slot onSlotchange={this.handleSlotChange}></slot>
        </ol>

        {/* Horizontal content area — the app renders the active step's panel
            here (see the `content` slot docs). Sits between the step row and
            the nav bar, matching the M3 wizard order: steps → content → actions. */}
        <div class="md-stepper__content" part="content">
          <slot name="content"></slot>
        </div>

        {/* Horizontal nav lives in a footer bar (vertical steps carry their own
            Back/Continue in each content panel). Back stays mounted (disabled
            on the first step) so the bar never reflows underfoot. */}
        {this.nav && !mobile && this.orientation === 'horizontal' && this.stepCount > 0 && (
          <div class="md-stepper__nav" part="nav">
            <md-button
              variant="text"
              size="sm"
              disabled={this.active <= 0 || this.loading}
              onClick={this.handleFooterBack}
            >
              {this.backLabel}
            </md-button>
            <md-button
              variant="filled"
              size="sm"
              loading={this.loading}
              disabled={this.nextDisabled || this.loading}
              onClick={() => this.next()}
            >
              {this.active >= this.stepCount - 1 ? this.finishLabel : this.nextLabel}
            </md-button>
          </div>
        )}

        {/* Compact mobile bar: Back · centered progress (dots or "N of M") ·
            Continue/Finish. Replaces the step-header row + footer nav. */}
        {this.nav && mobile && this.stepCount > 0 && (
          <div class="md-stepper__mobile" part="mobile-nav">
            <md-button
              variant="text"
              size="sm"
              disabled={this.active <= 0 || this.loading}
              onClick={this.handleFooterBack}
            >
              {this.backLabel}
            </md-button>
            <div
              class="md-stepper__mobile-progress"
              part="mobile-progress"
              aria-hidden={this.indicator === 'dot' ? 'true' : undefined}
            >
              {this.indicator === 'dot'
                ? this.steps.map((s, i) => (
                    <span
                      class={{
                        'md-stepper__mobile-dot': true,
                        'is-active': i === this.active,
                        'is-done': i < this.active || !!s.completed,
                      }}
                    ></span>
                  ))
                : <span class="md-stepper__mobile-text">{`${this.stepWord} ${this.active + 1} ${this.ofWord} ${this.stepCount}`}</span>}
            </div>
            <md-button
              variant="filled"
              size="sm"
              loading={this.loading}
              disabled={this.nextDisabled || this.loading}
              onClick={() => this.next()}
            >
              {this.active >= this.stepCount - 1 ? this.finishLabel : this.nextLabel}
            </md-button>
          </div>
        )}
      </Host>
    );
  }
}

import {
  Component,
  Host,
  h,
  Prop,
  Element,
  Event,
  EventEmitter,
  Listen,
  State,
} from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

/**
 * `md-step` — one step inside an `<md-stepper>`.
 *
 * Layout, position and i18n are pushed down from the parent stepper via
 * `data-*` attributes, so a step is almost always authored declaratively:
 *
 * ```html
 * <md-stepper active="1">
 *   <md-step label="Account" completed></md-step>
 *   <md-step label="Shipping" description="Address & method"></md-step>
 *   <md-step label="Payment" optional></md-step>
 * </md-stepper>
 * ```
 *
 * @slot - Step content. Rendered as an expanding panel in **vertical**
 * orientation, and — since the horizontal per-step panel mode — as a
 * full-width panel under the step row in **horizontal** orientation too. The
 * parent opts the row in automatically the moment any step has content; a
 * horizontal stepper whose steps are all empty is unaffected and keeps taking
 * one shared panel through `md-stepper`'s own `content` slot.
 *
 * @part inner             - The clickable step header (indicator + text).
 * @part indicator         - Circular wrapper around the bubble/dot (hover/ripple).
 * @part bubble            - Numbered / icon indicator.
 * @part dot               - Dot indicator (dot variant).
 * @part state-layer       - Hover / focus / press overlay inside the indicator.
 * @part text              - Label + supporting text wrapper.
 * @part label             - Step label.
 * @part optional          - The "Optional" caption.
 * @part description       - Supporting / helper text (or error / optional caption).
 * @part connector         - Connector line (leading or trailing).
 * @part connector-leading - The rail segment above the bubble (vertical).
 * @part connector-trailing- The rail/line segment after the bubble.
 * @part content           - Vertical content panel.
 * @part actions           - Back / Continue action row in the content panel.
 */
@Component({
  tag: 'md-step',
  styleUrl: 'md-step.css',
  shadow: true,
})
export class MdStep {
  @Element() el!: HTMLElement;

  /** Step caption ("Account info", "Shipping", …). */
  @Prop() label: string = '';

  /** Supporting text beneath the label. */
  @Prop() description: string = '';

  /** Whether this step is completed (shows a check / fills its connector). */
  @Prop({ reflect: true }) completed: boolean = false;

  /** Whether this step is the active one. Usually managed by the parent. */
  @Prop({ mutable: true, reflect: true }) active: boolean = false;

  /** Whether this step is in an error state. */
  @Prop({ reflect: true }) error: boolean = false;

  /** Error message shown beneath the label (overrides `description` on error). */
  @Prop({ attribute: 'error-text' }) errorText: string = '';

  /** Manually disable the step (parent's `mode="linear"` also gates reachability). */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Mark the step optional — shows an "Optional" caption and may be skipped. */
  @Prop({ reflect: true }) optional: boolean = false;

  /**
   * Editable: a completed step shows an edit (pencil) affordance, and — with
   * `auto-complete` on — revisiting it preserves downstream completion
   * (review/edit in place). Revisiting a non-editable step restarts progress
   * from there.
   */
  @Prop({ reflect: true }) editable: boolean = false;

  /** Override the indicator glyph (Material Symbols name), e.g. "lock". */
  @Prop() icon: string = '';

  /** Glyph shown when completed (Material Symbols name). */
  @Prop({ attribute: 'completed-icon' }) completedIcon: string = 'check';

  /** Glyph shown when in error (Material Symbols name). */
  @Prop({ attribute: 'error-icon' }) errorIcon: string = 'priority_high';

  /** Full override for the announced accessible name (i18n escape hatch). */
  @Prop({ attribute: 'accessible-name' }) accessibleName?: string;

  /** Hide the built-in Back / Continue actions in the vertical content panel. */
  @Prop({ attribute: 'hide-actions', reflect: true }) hideActions: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Bubbled to the parent stepper, which decides whether the move is allowed.
   *  Internal coordination event — consumed (and stopped) by `md-stepper`. */
  @Event({ bubbles: true, composed: false }) mdStepClick: EventEmitter<{ index: number }>;

  /** Continue pressed in this step's content panel. Consumed by `md-stepper`. */
  @Event({ bubbles: true, composed: false }) mdStepNext: EventEmitter<{ index: number }>;

  /** Back pressed in this step's content panel. Consumed by `md-stepper`. */
  @Event({ bubbles: true, composed: false }) mdStepBack: EventEmitter<{ index: number }>;

  @State() private hasSlottedContent = false;

  private contentObserver?: MutationObserver;

  // ─── Parent-pushed layout / i18n (read from data-* attributes) ────────────
  private attr(name: string, fallback = ''): string {
    const v = this.el.getAttribute(name);
    return v != null && v !== '' ? v : fallback;
  }
  private get index(): number { return Number(this.attr('data-index', '0')); }
  private get total(): number { return Number(this.attr('data-total', '0')); }
  private get activeIndex(): number { return Number(this.attr('data-active', '0')); }
  private get position(): 'first' | 'middle' | 'last' {
    return (this.el.getAttribute('data-position') as 'first' | 'middle' | 'last') ?? 'first';
  }
  private get orientation(): 'horizontal' | 'vertical' {
    return (this.el.getAttribute('data-orientation') as 'horizontal' | 'vertical') ?? 'horizontal';
  }
  private get indicatorKind(): 'numbered' | 'dot' {
    return (this.el.getAttribute('data-indicator') as 'numbered' | 'dot') ?? 'numbered';
  }
  private get linearMode(): boolean { return this.el.getAttribute('data-mode') === 'linear'; }
  /**
   * The parent stepper is a status trail (`readonly`), so this header is text
   * rather than a control. Distinct from `disabled`, which is still a control —
   * one that refuses. A readonly step does not refuse anything, because it never
   * offered.
   */
  private get readonlyMode(): boolean { return this.el.getAttribute('data-readonly') === 'true'; }

  connectedCallback() {
    this.computeSlottedContent();
    // Slot-based `slotchange` can't be used here: the default slot is only
    // rendered while the panel exists, so content appended when there is no
    // panel would never re-trigger it. Watch the light DOM instead.
    if (typeof MutationObserver !== 'undefined') {
      this.contentObserver = new MutationObserver(() => this.computeSlottedContent());
      this.contentObserver.observe(this.el, { childList: true });
    }
  }

  disconnectedCallback() {
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
  }

  private computeSlottedContent() {
    // Whitespace-only text nodes (pretty-printed markup) are not content.
    this.hasSlottedContent = Array.from(this.el.childNodes).some(
      (n) =>
        n.nodeType === Node.ELEMENT_NODE ||
        (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''),
    );
  }

  // ─── Reachability (linear gating) ─────────────────────────────────────────
  private stepSiblings(): HTMLMdStepElement[] {
    const parent = this.el.parentElement;
    if (!parent) return [];
    return (Array.from(parent.children) as HTMLElement[]).filter(
      (c) => c.tagName.toLowerCase() === 'md-step',
    ) as HTMLMdStepElement[];
  }

  /** Every prior step completed — or optional, which may be skipped. Mirrors
   *  the parent stepper's `canNavigateTo` so header affordance and actual
   *  navigability never disagree. */
  private allPriorPassable(): boolean {
    const siblings = this.stepSiblings();
    for (let i = 0; i < this.index; i++) {
      const s = siblings[i];
      if (!s?.completed && !s?.optional) return false;
    }
    return true;
  }

  /** Can the user navigate to this step right now? */
  private get reachable(): boolean {
    // A status trail has no navigation, so there is nothing to gate. Without
    // this, linear mode would dim every stage after the current one to 0.38 and
    // call it unreachable — but "Not started" is a fact being reported, not a
    // door being held shut, and it has to stay as legible as the rest of the
    // trail. An explicitly `disabled` step is still disabled: that is the author
    // saying this stage does not apply, which readonly has no business undoing.
    if (this.readonlyMode) return true;
    if (!this.linearMode) return true;
    return this.index <= this.activeIndex || this.completed || this.allPriorPassable();
  }

  private get effectivelyDisabled(): boolean {
    return this.disabled || !this.reachable;
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────
  private handleClick = (e: Event) => {
    if (this.readonlyMode || this.effectivelyDisabled) return;
    e.preventDefault();
    this.mdStepClick.emit({ index: this.index });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.readonlyMode || this.effectivelyDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Shared library helper — md-ripple only listens to pointerdown, so
      // keyboard activations trigger a centered wave the same way every other
      // interactive component does (radio, checkbox, icon-button, …).
      triggerRipple(this.el);
      this.mdStepClick.emit({ index: this.index });
    }
  };

  private emitNext = () => this.mdStepNext.emit({ index: this.index });
  private emitBack = () => this.mdStepBack.emit({ index: this.index });

  /** The built-in action buttons are internal chrome — their composed
   *  `mdClick` retargets to this host; stop it there so it never masquerades
   *  as an app-level button event. Slotted user buttons (target ≠ host) are
   *  left alone. */
  @Listen('mdClick')
  onInternalMdClick(e: Event) {
    if (e.target === this.el) e.stopPropagation();
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  private glyph(name: string) {
    return (
      <span class="md-step__bubble" part="bubble" aria-hidden="true">
        <span class="material-symbols-outlined">{name}</span>
      </span>
    );
  }

  private renderIndicator() {
    if (this.indicatorKind === 'dot') {
      return <span class="md-step__dot" part="dot" aria-hidden="true"></span>;
    }
    if (this.error) return this.glyph(this.errorIcon);
    if (this.icon) return this.glyph(this.icon);
    if (this.completed) return this.glyph(this.editable ? 'edit' : this.completedIcon);
    return (
      <span class="md-step__bubble" part="bubble" aria-hidden="true">
        {this.index + 1}
      </span>
    );
  }

  private composeA11yLabel(): string {
    if (this.accessibleName?.trim()) return this.accessibleName;
    const w = (n: string, f: string) => this.attr(n, f);
    let s = `${w('data-step-word', 'Step')} ${this.index + 1} ${w('data-of-word', 'of')} ${this.total}`;
    if (this.label) s += `: ${this.label}`;
    if (this.optional) s += `, ${w('data-optional-word', 'optional')}`;
    if (this.completed) s += `, ${w('data-completed-word', 'completed')}`;
    if (this.active) s += `, ${w('data-current-word', 'current')}`;
    if (this.error) s += `, ${w('data-error-word', 'error')}${this.errorText ? `: ${this.errorText}` : ''}`;
    return s;
  }

  render() {
    const isFirst = this.position === 'first';
    const isLast = this.position === 'last';
    const isVertical = this.orientation === 'vertical';
    const disabled = this.effectivelyDisabled;
    const readonly = this.readonlyMode;
    const supporting = this.error && this.errorText ? this.errorText : this.description;
    const optionalCaption = this.optional ? this.attr('data-optional-word', 'Optional') : '';
    // Built-in Back/Continue: on unless the stepper disabled nav (data-nav)
    // or this step opted out (hide-actions).
    const navActions = this.attr('data-nav', 'true') !== 'false' && !this.hideActions;
    // Loading / continue-gating pushed down from the parent stepper.
    const loading = this.attr('data-loading', 'false') === 'true';
    const nextDisabled = this.attr('data-next-disabled', 'false') === 'true';
    // Lazy: only the active step's panel is mounted (no collapse animation).
    const lazy = this.attr('data-lazy', 'false') === 'true';
    // Vertical always panels (built-in Back/Continue live there too). Horizontal
    // panels only when the parent opted the row into the grid AND this step has
    // its own content — the horizontal nav bar is the stepper's, not the step's,
    // so navActions alone must never conjure a panel here.
    const panelMode = this.attr('data-panel-mode', 'shared');
    const hasPanel = isVertical
      ? this.hasSlottedContent || navActions
      : panelMode === 'step' && this.hasSlottedContent;
    const renderPanel = hasPanel && (!lazy || this.active);

    // Header = [leading connector?, inner, trailing connector?]. In the
    // horizontal panel mode the host goes `display: contents`, so these three
    // must be wrapped in ONE box to stay a single grid item (the wrapper
    // inherits the flex properties the host used to carry). Every other mode
    // renders them bare, exactly as before — no extra box, no layout change.
    const headerNodes = [
      !isFirst && isVertical && (
        <span
          class={{
            'md-step__connector': true,
            'md-step__connector--leading': true,
            'md-step__connector--filled': this.index <= this.activeIndex,
          }}
          part="connector connector-leading"
          aria-hidden="true"
        ></span>
      ),
      /*
       * In `readonly` the header stops being a control, and that has to be true
       * in the accessibility tree as well as under the pointer. A `role="button"`
       * that ignores its own click is worse than no button: it is announced as
       * pressable, it takes a tab stop on the way to something that matters, and
       * `aria-disabled` would be a lie in the other direction — nothing here is
       * unavailable. So the roles, the tab stop, the composed button label and
       * the ripple all come off, and what remains is the visible text, which the
       * step already renders and a reader can already read.
       *
       * `aria-current` STAYS. "Which one is it on" is the entire point of a
       * status trail, and it is the one thing the visible text does not carry.
       */
      <div
        class="md-step__inner"
        part="inner"
        tabindex={readonly ? undefined : disabled ? -1 : 0}
        role={readonly ? undefined : 'button'}
        aria-label={readonly ? undefined : this.composeA11yLabel()}
        aria-disabled={!readonly && disabled ? 'true' : undefined}
        aria-current={this.active ? 'step' : undefined}
        aria-expanded={hasPanel ? (this.active ? 'true' : 'false') : undefined}
        aria-controls={renderPanel ? 'md-step-panel' : undefined}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <span class="md-step__indicator" part="indicator">
          {!readonly && <md-ripple disabled={disabled}></md-ripple>}
          <span class="md-step__state-layer" part="state-layer" aria-hidden="true"></span>
          {this.renderIndicator()}
        </span>

        {(this.label || supporting || optionalCaption) && (
          <span class="md-step__text" part="text">
            {this.label && <span class="md-step__label" part="label">{this.label}</span>}
            {optionalCaption && (
              <span class="md-step__optional" part="optional">{optionalCaption}</span>
            )}
            {supporting && (
              <span class="md-step__description" part="description">{supporting}</span>
            )}
          </span>
        )}
      </div>,
      !isLast && (
        <span
          class={{
            'md-step__connector': true,
            'md-step__connector--trailing': true,
            'md-step__connector--filled': this.index < this.activeIndex,
          }}
          part="connector connector-trailing"
          aria-hidden="true"
        ></span>
      ),
    ];
    const panelStep = !isVertical && hasPanel;

    return (
      <Host
        class={{
          'md-step': true,
          [`md-step--${this.orientation}`]: true,
          [`md-step--indicator-${this.indicatorKind}`]: true,
          'md-step--active': this.active,
          'md-step--completed': this.completed,
          'md-step--error': this.error,
          'md-step--optional': this.optional,
          'md-step--editable': this.editable,
          'md-step--disabled': disabled,
          'md-step--readonly': readonly,
          'md-step--first': isFirst,
          'md-step--last': isLast,
          'md-step--panel-step': !isVertical && hasPanel,
        }}
        role="listitem"
        aria-current={this.active ? 'step' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
      >
        {panelStep ? <div class="md-step__header">{headerNodes}</div> : headerNodes}

        {/* Vertical content panel — always in the tree so both expand AND
            collapse animate (grid-rows 0fr↔1fr spring); closed panels are
            visibility:hidden, keeping them out of the a11y tree + tab order. */}
        {renderPanel && (
          <div
            id="md-step-panel"
            class={{
              'md-step__content': true,
              'md-step__content--open': this.active,
              'md-step__content--lazy': lazy,
            }}
            part="content"
            role="region"
            aria-label={this.label || this.composeA11yLabel()}
          >
            <div class="md-step__content-sizer">
              <div class="md-step__content-inner">
                <slot></slot>
                {navActions && isVertical && (
                  <div class="md-step__actions" part="actions">
                    <md-button variant="text" size="sm" disabled={isFirst || loading} onClick={this.emitBack}>
                      {this.attr('data-back-label', 'Back')}
                    </md-button>
                    <md-button
                      variant="filled"
                      size="sm"
                      loading={loading}
                      disabled={nextDisabled || loading}
                      onClick={this.emitNext}
                    >
                      {isLast ? this.attr('data-finish-label', 'Finish') : this.attr('data-next-label', 'Continue')}
                    </md-button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Host>
    );
  }
}

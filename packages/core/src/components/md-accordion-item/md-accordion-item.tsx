import {
  Component,
  Host,
  h,
  Prop,
  State,
  Element,
  Event,
  EventEmitter,
  Method,
  Watch,
} from '@stencil/core';

let _uid = 0;
const nextUid = () => `md-acc-item-${++_uid}`;

@Component({
  tag: 'md-accordion-item',
  styleUrl: 'md-accordion-item.css',
  shadow: true,
})
export class MdAccordionItem {
  @Element() el!: HTMLElement;

  /** Header text (or use the `headline` slot). */
  @Prop() headline: string = '';

  /** Optional small caption below the headline. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Optional leading-icon (Material Symbols shorthand). */
  @Prop() icon: string = '';

  /** Whether the item is expanded. Two-way bindable. */
  @Prop({ mutable: true, reflect: true }) expanded: boolean = false;

  /** Disable interaction. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * ARIA heading level (`aria-level`) for the item's heading wrapper.
   * Renders a native `<h1>`–`<h6>` so the implicit semantics match the
   * page's information architecture. Per WAI-ARIA APG: "an element with
   * role heading that has a value set for aria-level that is
   * appropriate for the information architecture of the page".
   *
   * Set per-item, or let the parent `<md-accordion heading-level>`
   * propagate the same value to every item.
   */
  @Prop({ attribute: 'heading-level' }) headingLevel: 1 | 2 | 3 | 4 | 5 | 6 = 3;

  /**
   * Whether the item can be collapsed when it is expanded. Set to
   * `false` to implement the APG variant where the accordion does not
   * permit a panel to be collapsed — the open button then advertises
   * `aria-disabled="true"`, and Enter / Space / click no longer toggle
   * it. Typically managed by the parent's `keep-one-expanded` mode.
   */
  @Prop() collapsible: boolean = true;

  /**
   * Role applied to the accordion panel. APG recommends `region` for
   * structural clarity, but warns against using it when more than ~6
   * panels can be open at once (landmark proliferation). The parent
   * `<md-accordion region>` orchestrates this automatically.
   *
   * - `region` (default) — full landmark semantics.
   * - `group` — semantically a group but not a landmark.
   * - `none` — drop the role entirely (still labelled via aria-labelledby).
   */
  @Prop({ mutable: true, attribute: 'region-role' }) regionRole:
    | 'region'
    | 'group'
    | 'none' = 'region';

  /**
   * Cap the panel body's block-size (e.g. `"220px"`, `"40vh"`). When set,
   * the content region becomes a scroll container instead of growing to
   * fit — and, crucially, it is made keyboard-focusable (`tabindex="0"`)
   * so keyboard-only users can scroll it. A scrollable region whose
   * content isn't itself focusable is otherwise unreachable without a
   * pointer (WCAG 2.1.1 — axe `scrollable-region-focusable`). Its
   * accessible name comes from the enclosing labelled panel region.
   *
   * Prefer this over hand-rolling a slotted `overflow:auto` wrapper: an
   * authored scroll `<div>` lives in light DOM the component can't make
   * focusable, so it would trip the same axe rule. Leave empty (default)
   * for a panel that grows to fit its content.
   */
  @Prop({ attribute: 'content-max-height' }) contentMaxHeight: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Emitted whenever the item toggles. The parent `md-accordion` uses
   * this to coordinate exclusive mode.
   */
  @Event() mdItemToggle: EventEmitter<{ expanded: boolean; index: number }>;

  /**
   * Internal event the parent listens to for arrow-key roving focus.
   * Bubbles + composed so the parent receives it through the shadow.
   */
  @Event({ bubbles: true, composed: true })
  mdItemRequestFocus: EventEmitter<{
    direction: 'next' | 'prev' | 'first' | 'last';
    from: number;
  }>;

  /**
   * Internal event the parent listens to for Alt+Arrow keyboard
   * reordering. Bubbles + composed so the parent receives it
   * through the shadow.
   */
  @Event({ bubbles: true, composed: true })
  mdItemRequestReorder: EventEmitter<{
    direction: 'up' | 'down';
    from: number;
  }>;

  @State() private hasSlottedHeadline = false;
  @State() private hasSlottedTrailingIcon = false;
  @State() private hasSlottedLeadingIcon = false;

  private readonly contentId = nextUid();
  private readonly headerId = `${this.contentId}-header`;
  private headerEl?: HTMLButtonElement;

  private get index(): number {
    const v = this.el.getAttribute('data-index');
    return v == null ? -1 : Number(v);
  }

  componentWillLoad() {
    this.hasSlottedHeadline = this.hasDirectSlottedChild('headline');
    this.hasSlottedLeadingIcon = this.hasDirectSlottedChild('leading-icon');
    this.hasSlottedTrailingIcon = this.hasDirectSlottedChild('trailing-icon');
  }

  componentDidLoad() {
    this.bindSlotListener('headline', (v) => (this.hasSlottedHeadline = v));
    this.bindSlotListener('leading-icon', (v) => (this.hasSlottedLeadingIcon = v));
    this.bindSlotListener('trailing-icon', (v) => (this.hasSlottedTrailingIcon = v));
  }

  private hasDirectSlottedChild(slotName: string): boolean {
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].getAttribute('slot') === slotName) return true;
    }
    return false;
  }

  private bindSlotListener(name: string, setter: (b: boolean) => void) {
    const slot = this.el.shadowRoot?.querySelector(
      `slot[name="${name}"]`,
    ) as HTMLSlotElement | null;
    if (!slot) return;
    slot.addEventListener('slotchange', () => {
      setter(slot.assignedElements().length > 0);
    });
  }

  @Watch('expanded')
  onExpandedChange(value: boolean) {
    this.mdItemToggle.emit({ expanded: value, index: this.index });
  }

  /** Programmatically toggle the item. */
  @Method()
  async toggle(): Promise<void> {
    if (this.disabled) return;
    this.expanded = !this.expanded;
  }

  /**
   * Move keyboard focus to the item's header.
   *
   * Uses `{ focusVisible: true }` so the focus ring is painted even when
   * the call originates from a mouse-driven action (e.g. another button
   * in the page calling `await item.focusHeader()`). Without it, browsers
   * inherit the last input modality and skip the focus-visible ring on
   * mouse-initiated programmatic focus, leaving the user wondering whether
   * the call did anything. The option is supported in evergreen Chromium
   * (137+), Firefox (134+) and Safari (17.4+); older runtimes ignore it
   * harmlessly and fall back to the prior behaviour.
   */
  @Method()
  async focusHeader(): Promise<void> {
    this.headerEl?.focus({ focusVisible: true } as FocusOptions);
  }

  /**
   * `true` when the button must advertise itself as un-actionable even
   * though it still receives focus (so screen readers can announce
   * state). Native `disabled` is reserved for the developer-set
   * `disabled` prop, because a natively-disabled button is unreachable
   * by keyboard — APG wants the locked-open button to still be focusable
   * so users can hear that it is the open panel.
   */
  private get ariaDisabledHeader(): boolean {
    return this.disabled || (this.expanded && !this.collapsible);
  }

  /**
   * Whether the next toggle attempt would be rejected. Used to guard
   * click / Enter / Space so the implementation matches the ARIA
   * advertisement of "can't be collapsed".
   */
  private toggleBlocked(): boolean {
    if (this.disabled) return true;
    if (this.expanded && !this.collapsible) return true;
    return false;
  }

  private handleHeaderClick = () => {
    if (this.toggleBlocked()) return;
    this.expanded = !this.expanded;
  };

  private handleHeaderKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    // Alt+ArrowUp/Down → ask the parent to reorder this item.
    // Only meaningful when the parent has `reorderable` set; the parent
    // ignores the event otherwise.
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.mdItemRequestReorder.emit({
        direction: e.key === 'ArrowUp' ? 'up' : 'down',
        from: this.index,
      });
      return;
    }
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (this.toggleBlocked()) return;
        this.expanded = !this.expanded;
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.mdItemRequestFocus.emit({ direction: 'next', from: this.index });
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.mdItemRequestFocus.emit({ direction: 'prev', from: this.index });
        break;
      case 'Home':
        e.preventDefault();
        this.mdItemRequestFocus.emit({ direction: 'first', from: this.index });
        break;
      case 'End':
        e.preventDefault();
        this.mdItemRequestFocus.emit({ direction: 'last', from: this.index });
        break;
    }
  };

  /**
   * Drag handles live INSIDE the header `<button>`, so a tap on the
   * handle would normally also fire the button click and toggle the
   * panel. We block click + keydown from bubbling out of the handle
   * — the actual drag is managed by the parent accordion via
   * pointerdown on the bubbling event path.
   */
  private handleDragHandleClick = (e: MouseEvent) => {
    e.stopPropagation();
  };
  private handleDragHandleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
  };

  render() {
    const hasLeading = !!this.icon || this.hasSlottedLeadingIcon;
    // Clamp heading-level to a valid 1..6 range; render the matching
    // native heading element so the implicit `aria-level` is correct
    // without us having to emit an explicit `aria-level` attribute.
    const level = Math.min(6, Math.max(1, this.headingLevel | 0));
    const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    // A capped panel body scrolls; it must be keyboard-reachable so
    // arrow keys can scroll it (WCAG 2.1.1 / axe scrollable-region-focusable).
    const scrollable = this.contentMaxHeight.trim().length > 0;
    return (
      <Host
        class={{
          'md-accordion-item': true,
          'md-accordion-item--expanded': this.expanded,
          'md-accordion-item--disabled': this.disabled,
        }}
      >
        {/*
          Chassis-drag handle — a slim horizontal grip pill, centered at the
          top edge of the first item (the parent reveals it via
          `data-chassis-handle`). Same affordance iOS / macOS / Android use
          for "drag this sheet". Lives OUTSIDE the heading button so pressing
          it doesn't also fire the expand toggle. `data-accordion-chassis-drag`
          is the convention the parent looks for in `composedPath`.

          Two parts ship: the outer span is the (intentionally larger) hit
          area, the inner span is the visible pill. Consumers can restyle
          either via `::part(chassis-handle)` / `::part(chassis-handle-bar)`.
        */}
        <span
          class="md-accordion-item__chassis-handle"
          part="chassis-handle"
          data-accordion-chassis-drag="true"
          role="presentation"
          aria-hidden="true"
          onClick={this.handleDragHandleClick}
          onKeyDown={this.handleDragHandleKeyDown}
        >
          <span class="md-accordion-item__chassis-handle-bar" part="chassis-handle-bar"></span>
        </span>
        <HeadingTag class="md-accordion-item__heading" part="heading">
          <button
            id={this.headerId}
            class="md-accordion-item__header"
            part="header"
            type="button"
            aria-expanded={String(this.expanded)}
            aria-controls={this.contentId}
            aria-disabled={this.ariaDisabledHeader ? 'true' : undefined}
            disabled={this.disabled}
            onClick={this.handleHeaderClick}
            onKeyDown={this.handleHeaderKeyDown}
            ref={(el) => (this.headerEl = el)}
          >
            <md-ripple disabled={this.disabled}></md-ripple>
            <span class="md-accordion-item__state-layer" part="state-layer" aria-hidden="true"></span>
            <span
              class="md-accordion-item__drag-handle"
              part="drag-handle"
              data-accordion-drag-handle="true"
              aria-hidden="true"
              onClick={this.handleDragHandleClick}
              onKeyDown={this.handleDragHandleKeyDown}
            >
              <span class="material-symbols-outlined md-accordion-item__drag-handle-icon">
                drag_indicator
              </span>
            </span>
            {hasLeading && (
              <span class="md-accordion-item__leading" part="leading-icon" aria-hidden="true">
                <slot name="leading-icon">
                  {this.icon && (
                    <span class="material-symbols-outlined md-accordion-item__icon">
                      {this.icon}
                    </span>
                  )}
                </slot>
              </span>
            )}
            <span class="md-accordion-item__text">
              <span class="md-accordion-item__headline" part="headline">
                <slot name="headline">{this.headline}</slot>
              </span>
              {(this.supportingText || this.hasSlottedHeadline) && this.supportingText && (
                <span class="md-accordion-item__supporting" part="supporting-text">
                  {this.supportingText}
                </span>
              )}
            </span>
            <span class="md-accordion-item__trailing" part="trailing-icon" aria-hidden="true">
              <slot name="trailing-icon">
                <svg
                  class="md-accordion-item__chevron"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                </svg>
              </slot>
            </span>
          </button>
        </HeadingTag>
        <div
          id={this.contentId}
          class="md-accordion-item__panel"
          part="panel"
          role={this.regionRole === 'none' ? undefined : this.regionRole}
          aria-labelledby={this.headerId}
          aria-hidden={this.expanded ? 'false' : 'true'}
          inert={!this.expanded}
        >
          <div class="md-accordion-item__content" part="content">
            <div
              class={{
                'md-accordion-item__content-inner': true,
                'md-accordion-item__content-inner--scroll': scrollable,
              }}
              part="content-inner"
              // When the panel body is capped it becomes a scroll
              // container; `tabindex="0"` makes it keyboard-scrollable
              // (axe scrollable-region-focusable). Its accessible name is
              // provided by the enclosing labelled panel region, so no
              // extra role/label is needed here.
              tabindex={scrollable ? '0' : undefined}
              style={scrollable ? { maxBlockSize: this.contentMaxHeight } : undefined}
            >
              <slot></slot>
            </div>
          </div>
        </div>
      </Host>
    );
  }
}

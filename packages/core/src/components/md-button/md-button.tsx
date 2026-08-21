import { Component, Host, h, Prop, State, Event, EventEmitter, Element, AttachInternals } from '@stencil/core';
import { LazyLoadingIndicator } from '../../utils/lazy-loading-indicator';
import { triggerRipple } from '../../utils/ripple';
import { sanitizeHref, SAFE_WINDOW_FEATURES } from '../../utils/url';

/**
 * Detail payload emitted by `md-button`'s `mdClick` event when the user
 * activates the button (mouse, touch, or keyboard).
 *
 * The event is **cancelable** — calling `event.preventDefault()` from a
 * listener stops the button's default side effects (toggle-state flip
 * and `href` navigation) but does NOT stop the underlying DOM click
 * event. This is the recommended hook for SPA routing and "are you
 * sure?" confirmation flows.
 */
export interface MdButtonClickDetail {
  /** The button's `value` prop (useful when grouped via `md-button-group`). */
  value: string;
  /** Whether toggle mode is enabled. */
  toggle: boolean;
  /**
   * Selected state the button WILL transition to if the click is not
   * cancelled. In non-toggle mode this is identical to `selected`.
   */
  selected: boolean;
  /** Navigation target (empty if the button is not a link). */
  href: string;
  /** Browsing context (`_self`, `_blank`, …). */
  target: string;
  /** The original DOM event that triggered the activation. */
  originalEvent: MouseEvent | KeyboardEvent;
}

/**
 * Detail payload emitted by `md-button`'s `mdChange` event when toggle
 * mode flips the selected state in response to a user activation.
 */
export interface MdButtonChangeDetail {
  /** New selected state. */
  selected: boolean;
  /** The button's `value` prop. */
  value: string;
}

@Component({
  tag: 'md-button',
  styleUrl: 'md-button.css',
  shadow: true,
  formAssociated: true,
})
export class MdButton {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. Used to submit/reset the associated form when
   * `type` is `submit`/`reset` — works across shadow boundaries, unlike a
   * native `<button>` rendered in the shadow root (which can't see the
   * light-DOM `<form>` it lives in).
   */
  @AttachInternals() internals!: ElementInternals;

  /**
   * Activation behavior, mirroring the native `<button type>`:
   * - `button` (default): no implicit form action.
   * - `submit`: submits the associated form (`requestSubmit`, so the form's
   *   `submit` event fires and constraint validation runs).
   * - `reset`: resets the associated form.
   */
  @Prop({ reflect: true }) type: 'button' | 'submit' | 'reset' = 'button';

  @Prop() variant: 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal' = 'filled';
  @Prop() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
  @Prop() shape: 'round' | 'square' = 'round';
  @Prop({ reflect: true }) disabled: boolean = false;
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;
  @Prop() ripple: boolean = true;
  @Prop() loading: boolean = false;
  @Prop() icon: string = '';
  @Prop() trailingIcon: string = '';
  @Prop() href: string = '';
  @Prop() target: string = '_self';

  /** Enable toggle behavior (selected/unselected) */
  @Prop() toggle: boolean = false;

  /** Current selected state (toggle mode) */
  @Prop({ mutable: true }) selected: boolean = false;

  /** Enable M3 Expressive shape morphing on press and toggle */
  @Prop() shapeMorph: boolean = true;

  /**
   * Mirror leading and trailing icons horizontally when the button is
   * rendered in a right-to-left context. Set this on buttons that use
   * **directional** Material Symbols (arrows, chevrons, send, reply…)
   * — non-directional icons (add, search, favorite…) should leave it
   * `false` so the glyph stays semantically correct.
   */
  @Prop({ reflect: true, attribute: 'mirror-icon' }) mirrorIcon: boolean = false;

  /**
   * When true, suppresses the default 180° trailing-icon rotation while
   * `aria-expanded="true"`. Use when the consumer swaps the glyph (e.g.
   * docked `md-date-picker` month/year triggers use `chevron_right`).
   */
  @Prop({ reflect: true, attribute: 'suppress-expand-icon-flip' })
  suppressExpandIconFlip: boolean = false;

  /**
   * Stretch the button to fill its inline-axis container.
   *
   * Switches the host from `inline-flex` to `flex` and sets
   * `inline-size: 100%` so the button consumes the full width of its
   * parent — the standard pattern for primary CTAs in forms, modals,
   * and bottom sheets. The size's `min-block-size` (touch target) is
   * preserved.
   *
   * For arbitrary fixed widths or heights, set the
   * `--md-button-width`, `--md-button-height`, `--md-button-min-width`,
   * `--md-button-min-height`, or `--md-button-max-width` CSS custom
   * properties on the host instead.
   */
  @Prop({ reflect: true, attribute: 'full-width' }) fullWidth: boolean = false;

  /** @internal Set by md-button-group — left side is connected to a neighbor */
  @Prop({ reflect: true }) connectedLeft: boolean = false;

  /** @internal Set by md-button-group — right side is connected to a neighbor */
  @Prop({ reflect: true }) connectedRight: boolean = false;

  /** @internal Value for button-group association */
  @Prop() value: string = '';

  /**
   * @internal Roving-tabindex override set by `md-button-group`. When the
   * button is a child of a group, the group sets this to `0` on the
   * currently-active button and `-1` on the rest, so Tab enters the group
   * once instead of stepping through every button. Outside a group, this
   * stays `null` and the button uses its normal tabindex behavior.
   */
  @Prop({ mutable: true, reflect: false }) groupTabindex: number | null = null;

  /**
   * Override the default `role="button"`. Used by composite widgets such as
   * `md-date-picker` day cells (`role="gridcell"`). Leave empty for `button`.
   */
  @Prop({ attribute: 'role-override' }) roleOverride: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires every time the user activates the button (mouse click, touch,
   * or `Enter`/`Space` while focused). The event is **cancelable** and
   * the detail payload describes what *would* happen: the post-click
   * toggle state, the navigation `href`, and so on.
   *
   * Calling `event.preventDefault()` from a listener suppresses the
   * default side effects (toggle flip + `href` navigation) but lets
   * the underlying DOM click bubble. This is the hook to use for SPA
   * routing, "are you sure?" prompts, async confirmation, etc.
   *
   * The event bubbles and is composed, so listeners outside the
   * shadow tree (the typical case) receive it.
   *
   * ```ts
   * document.querySelector('md-button')!.addEventListener('mdClick', (e) => {
   *   const { href, selected } = (e as CustomEvent).detail;
   *   if (!confirm('Continue?')) e.preventDefault();
   * });
   * ```
   */
  @Event({ cancelable: true, bubbles: true, composed: true })
  mdClick!: EventEmitter<MdButtonClickDetail>;

  /**
   * Fires when toggle mode flips the `selected` state in response to a
   * user activation. Not cancelable — the state change has already
   * happened. Pair with `mdClick` (cancelable) when you need a veto.
   *
   * Bubbles and is composed.
   */
  @Event({ bubbles: true, composed: true })
  mdChange!: EventEmitter<MdButtonChangeDetail>;

  @State() private hasSlottedLeadingIcon = false;
  @State() private hasSlottedTrailingIcon = false;
  @State() private pressed = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled || this.loading;
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const leadingSlot = shadow.querySelector('slot[name="leading-icon"]') as HTMLSlotElement | null;
    const trailingSlot = shadow.querySelector('slot[name="trailing-icon"]') as HTMLSlotElement | null;

    leadingSlot?.addEventListener('slotchange', () => {
      this.hasSlottedLeadingIcon = leadingSlot.assignedElements().length > 0;
    });
    trailingSlot?.addEventListener('slotchange', () => {
      this.hasSlottedTrailingIcon = trailingSlot.assignedElements().length > 0;
    });
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) { e.preventDefault(); return; }

    // Compute the post-click toggle state up front so the detail
    // payload describes what *would* happen — listeners can then
    // call preventDefault on the CustomEvent to veto the change.
    const nextSelected = this.toggle ? !this.selected : this.selected;

    const evt = this.mdClick.emit({
      value: this.value,
      toggle: this.toggle,
      selected: nextSelected,
      href: this.href,
      target: this.target,
      originalEvent: e,
    });

    if (evt.defaultPrevented) {
      // Suppress browser's default link navigation as well so the
      // host stays consistent. We don't flip selected and don't
      // open the href.
      e.preventDefault();
      return;
    }

    if (this.toggle && nextSelected !== this.selected) {
      this.selected = nextSelected;
      this.mdChange.emit({ selected: nextSelected, value: this.value });
    }

    /* Setting `href` makes this a link rather than a form control, so the
       branch is taken on the raw prop — an unsafe URL must not silently fall
       through to submitting the form. Only the navigation itself is refused. */
    if (this.href) {
      const href = sanitizeHref(this.href);
      if (href) window.open(href, this.target, SAFE_WINDOW_FEATURES);
      return;
    }

    // Implicit form action, mirroring a native submit/reset button. Uses
    // ElementInternals so the associated <form> is found across the shadow
    // boundary. requestSubmit() (not submit()) so the form's submit event
    // fires and built-in constraint validation runs.
    if (this.type === 'submit') {
      this.internals.form?.requestSubmit();
    } else if (this.type === 'reset') {
      this.internals.form?.reset();
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        this.pressed = true;
        triggerRipple(this.el);
        this.el.click();
        setTimeout(() => { this.pressed = false; }, 150);
      }
    }
  };

  private handlePointerDown = () => {
    if (!this.isDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  render() {
    const isEffectivelyDisabled = this.isDisabled;
    const hasLeadingIcon = !!this.icon;
    const hasTrailingIcon = !!this.trailingIcon;

    return (
      <Host
        class={{
          'md-button': true,
          [`md-button--${this.variant}`]: true,
          [`md-button--${this.size}`]: true,
          [`md-button--${this.shape}`]: true,
          'md-button--with-leading-icon': hasLeadingIcon || this.hasSlottedLeadingIcon,
          'md-button--with-trailing-icon': hasTrailingIcon || this.hasSlottedTrailingIcon,
          'md-button--disabled': this.disabled || this.softDisabled,
          'md-button--loading': this.loading,
          'md-button--toggle': this.toggle,
          'md-button--selected': this.selected,
          'md-button--shape-morph': this.shapeMorph,
          'md-button--pressed': this.shapeMorph && this.pressed,
          'md-button--connected-left': this.connectedLeft,
          'md-button--connected-right': this.connectedRight,
          'md-button--full-width': this.fullWidth,
        }}
        role={this.roleOverride || 'button'}
        aria-disabled={isEffectivelyDisabled ? 'true' : 'false'}
        aria-pressed={this.toggle ? String(this.selected) : undefined}
        tabindex={
          this.disabled
            ? '-1'
            : (this.groupTabindex !== null ? String(this.groupTabindex) : '0')
        }
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerLeave={this.handlePointerUp}
        onPointerCancel={this.handlePointerUp}
      >
        {this.ripple && <md-ripple disabled={isEffectivelyDisabled}></md-ripple>}
        <span class="md-button__state-layer" part="state-layer" aria-hidden="true"></span>
        <slot name="leading-icon">
          {hasLeadingIcon && <span class="md-button__icon material-symbols-outlined" part="icon">{this.icon}</span>}
        </slot>
        <span class="md-button__label" part="label"><slot /></span>
        <slot name="trailing-icon">
          {hasTrailingIcon && <span class="md-button__trailing-icon material-symbols-outlined" part="trailing-icon">{this.trailingIcon}</span>}
        </slot>
        {this.loading && (
          /* md-loading-indicator, not a hand-rolled ring: never ship a custom
             loading affordance where a library component exists. It is
             md-loading-indicator rather than md-progress-indicator because the
             latter clamps its circular variant to a 24dp M3 minimum, while a
             button spinner runs 10-28px -- every tier but xl would clamp up and
             lose the density taper. Same choice md-select made for its trigger.

             The `loader` slot lets a consumer swap it (e.g. for a circular
             md-progress-indicator). The size hooks sit on this WRAPPER so they
             cascade to whatever ends up inside it, default or slotted. */
          <span class="md-button__loading" part="loading" aria-hidden="true">
            <slot name="loader">
              <LazyLoadingIndicator class="md-button__loading-default" />
            </slot>
          </span>
        )}
      </Host>
    );
  }
}

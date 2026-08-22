import { Component, Host, h, Prop, State, Event, EventEmitter, Element } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

@Component({ tag: 'md-chip', styleUrl: 'md-chip.css', shadow: true })
export class MdChip {
  @Element() el!: HTMLElement;

  /** Chip variant */
  @Prop({ reflect: true }) variant: 'assist' | 'filter' | 'input' | 'suggestion' = 'assist';

  /** Material Symbols icon name for the leading icon */
  @Prop() icon: string = '';

  /** Material Symbols icon name for the trailing icon (filter/input only) */
  @Prop({ attribute: 'trailing-icon' }) trailingIcon: string = '';

  /** Whether the chip is selected (filter/input variants) */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;

  /**
   * Whether clicking the chip body toggles `selected`. Defaults to true for
   * `filter`/`input` variants. Set `selectable="false"` for a token that is only
   * a display of a value (e.g. a multi-select's removable chips) — clicking the
   * body then does nothing and the ✕ remove button is the only action, so the
   * chip doesn't flash a misleading "active" state.
   */
  @Prop() selectable?: boolean;

  /**
   * Surface style of the chip. Distinct from `variant`, which selects the M3
   * chip TYPE (assist / filter / input / suggestion); a chip has both.
   *
   * - `outlined` (default) — transparent container with a 1px outline.
   * - `filled` — tonal container, no outline.
   * - `elevated` — tonal container with elevation and no outline.
   */
  @Prop({ reflect: true }) appearance: 'outlined' | 'filled' | 'elevated' = 'outlined';

  /**
   * Colour role applied to the chip's outline / label / container, depending on
   * `appearance`. Omit for the neutral surface treatment.
   *
   * Any role name the THEME defines is accepted, not just a fixed list — the
   * chip resolves `<name>` to the `--md-sys-color-<name>` /
   * `-<name>-container` / `-on-<name>-container` family at runtime. So
   * `color="brand"` works as soon as a theme ships those tokens, and a name the
   * theme does not define degrades to the neutral treatment rather than
   * rendering broken.
   *
   * `primary` | `secondary` | `tertiary` | `error` are the baseline M3 roles;
   * `success` | `warning` | `info` ship in packages/tokens on the same tonal
   * recipe. The union below is a hint for editor autocomplete only — the `string`
   * arm is what makes custom roles work.
   */
  @Prop({ reflect: true }) color?:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'error'
    | 'success'
    | 'warning'
    | 'info'
    | (string & {});

  /**
   * Whether the chip is elevated (adds shadow instead of outline).
   *
   * @deprecated Use `appearance="elevated"`. Kept as an alias so existing
   * markup keeps working: when true it forces the elevated appearance and wins
   * over `appearance`, since a consumer setting it is being explicit.
   */
  @Prop({ reflect: true }) elevated: boolean = false;

  /** Disables the chip */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled: disabled visuals but remains focusable */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /**
   * When `true`, the chip renders a trailing remove ("✕") button and responds
   * to Delete / Backspace from the chip itself. Works on every variant.
   *
   * `variant="input"` is removable by default (per MD3 spec) — setting
   * `removable="false"` explicitly opts out of that behavior.
   */
  @Prop({ reflect: true }) removable?: boolean;

  /** Label text — alternative to default slot */
  @Prop() label: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when the chip is clicked or activated via keyboard */
  @Event() mdClick: EventEmitter<void>;

  /** Emits when the selected state changes (filter/input) */
  @Event() mdSelect: EventEmitter<{ selected: boolean }>;

  /**
   * Fires when the trailing remove ("✕") button is activated on a removable
   * chip (by click, Enter, Space, Delete, or Backspace).
   *
   * The event is **cancelable**: by default, after `mdRemove` is dispatched
   * the chip removes itself from the DOM. Call `event.preventDefault()` in a
   * handler to keep the chip mounted (e.g. when your state layer owns the
   * list and will re-render with the chip gone).
   */
  @Event({ cancelable: true }) mdRemove: EventEmitter<void>;

  @State() private hasSlottedLeadingIcon = false;
  @State() private hasSlottedTrailingIcon = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  /**
   * Maps `color` onto the four slots every appearance rule is written against.
   * Done here rather than as one CSS block per role so ANY theme-defined role
   * works, not just a list we happen to have enumerated.
   *
   * Each var carries a fallback to the neutral default, so a role the theme has
   * not defined renders as an uncoloured chip instead of collapsing to
   * guaranteed-invalid and losing its container colour entirely.
   */
  private get colorVars(): Record<string, string> | undefined {
    const c = this.color;
    // Guard the interpolation: this value becomes part of a custom-property
    // NAME, so anything outside a plain CSS ident is rejected outright.
    if (!c || !/^[a-z][a-z0-9-]*$/i.test(c)) return undefined;
    return {
      '--_c-main': `var(--md-sys-color-${c}, var(--md-sys-color-primary))`,
      '--_c-on-main': `var(--md-sys-color-on-${c}, var(--md-sys-color-on-primary))`,
      '--_c-container': `var(--md-sys-color-${c}-container, var(--md-sys-color-secondary-container))`,
      '--_c-on-container': `var(--md-sys-color-on-${c}-container, var(--md-sys-color-on-secondary-container))`,
    };
  }

  /**
   * Resolves the deprecated `elevated` boolean against `appearance`. Setting
   * `elevated` is an explicit act, so it wins; `appearance` covers everything
   * else. One accessor means the class map and any future logic can't disagree
   * about which surface style is in effect.
   */
  private get effectiveAppearance(): 'outlined' | 'filled' | 'elevated' {
    return this.elevated ? 'elevated' : this.appearance;
  }

  private get isSelectable() {
    if (this.selectable !== undefined) return this.selectable;
    return this.variant === 'filter' || this.variant === 'input';
  }

  /**
   * Whether the chip BODY is an interactive control. An EXPLICITLY non-selectable
   * (`selectable="false"`) REMOVABLE token — e.g. md-multi-select's display chips —
   * does nothing on body-click and only its ✕ is interactive, so exposing the host
   * as a focusable `button` both misleads AT and nests an interactive control inside
   * another (axe nested-interactive). Such tokens are a labelled `group` whose only
   * tab stop is the remove ✕. Every other chip keeps its default button semantics.
   */
  private get isInteractiveHost() {
    return !(this.selectable === false && this.isRemovable);
  }

  /**
   * A chip is removable when `removable` is explicitly true, or when the chip
   * is an `input` variant and the consumer hasn't explicitly opted out
   * (`removable="false"`). This keeps backward compatibility: pre-existing
   * `<md-chip variant="input">` markup continues to show the ✕ button.
   */
  private get isRemovable() {
    if (this.removable === true) return true;
    if (this.removable === false) return false;
    return this.variant === 'input';
  }

  /** Resolves the chip's accessible label from the label prop or light-DOM text content. */
  private get accessibleLabel(): string {
    return this.label || this.el.textContent?.trim() || '';
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

  /**
   * Dispatches the cancelable `mdRemove` event. When the consumer hasn't
   * called `preventDefault()`, removes the chip from its parent DOM as the
   * default action. Centralises the policy so click/key handlers stay
   * single-purpose and we never forget the default action on one path.
   */
  private dispatchRemove() {
    const ev = this.mdRemove.emit();
    if (!ev.defaultPrevented) {
      this.el.remove();
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) { e.preventDefault(); return; }

    if (this.isSelectable) {
      this.selected = !this.selected;
      this.mdSelect.emit({ selected: this.selected });
    }

    this.mdClick.emit();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerRipple(this.el);
      this.el.click();
      return;
    }

    if (this.isRemovable && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      this.dispatchRemove();
    }
  };

  private handleRemoveClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.isDisabled) return;
    this.dispatchRemove();
  };

  private handleRemoveKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      e.preventDefault();
      this.dispatchRemove();
    }
  };

  render() {
    const hasLeadingIcon = !!this.icon || this.hasSlottedLeadingIcon;
    const hasTrailingIcon = !!this.trailingIcon || this.hasSlottedTrailingIcon;
    const showCheckmark = this.variant === 'filter' && this.selected && !hasLeadingIcon;
    const showRemove = this.isRemovable;
    const isEffectivelyDisabled = this.isDisabled;
    const chipLabel = this.accessibleLabel;

    // A removable chip renders a trailing remove ✕ <button> — itself a
    // focusable control. If the HOST were also a focusable widget
    // (role="button" + tabindex) the two would nest (axe "nested-interactive").
    // So when the body is interactive AND a remove button is present, the host
    // steps down to a labelled `group` container and the primary (body) action
    // becomes its OWN focusable element — a sibling of the remove button, not
    // its ancestor. The host stays a single `button` only when there is no
    // remove button to nest.
    const hostIsButton = this.isInteractiveHost && !showRemove;
    const renderPrimary = this.isInteractiveHost && showRemove;

    return (
      <Host
        style={this.colorVars}
        class={{
          'md-chip': true,
          [`md-chip--${this.variant}`]: true,
          'md-chip--selected': this.selected && this.isSelectable,
          // The deprecated `elevated` boolean resolves into `appearance`, and
          // the legacy `md-chip--elevated` class is still emitted for that case
          // so every existing rule keyed on it (disabled states, selected
          // combinations) keeps applying untouched.
          [`md-chip--appearance-${this.effectiveAppearance}`]: true,
          'md-chip--elevated': this.effectiveAppearance === 'elevated',
          [`md-chip--color-${this.color}`]: !!this.color,
          'md-chip--disabled': isEffectivelyDisabled,
          'md-chip--with-leading-icon': hasLeadingIcon || showCheckmark,
          'md-chip--with-trailing-icon': hasTrailingIcon || showRemove,
        }}
        role={hostIsButton ? 'button' : 'group'}
        aria-roledescription="chip"
        aria-pressed={hostIsButton && this.isSelectable ? String(this.selected) : undefined}
        aria-label={hostIsButton ? undefined : chipLabel || undefined}
        aria-disabled={isEffectivelyDisabled ? 'true' : undefined}
        tabindex={hostIsButton ? (this.disabled ? '-1' : '0') : undefined}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={isEffectivelyDisabled}></md-ripple>
        <span class="md-chip__state-layer" part="state-layer" aria-hidden="true"></span>

        {!this.elevated && <span class="md-chip__outline" part="outline" aria-hidden="true"></span>}

        {renderPrimary && (
          <span
            class="md-chip__primary"
            part="primary"
            role="button"
            tabindex={this.disabled ? '-1' : '0'}
            aria-labelledby="md-chip-label-text"
            aria-pressed={this.isSelectable ? String(this.selected) : undefined}
            aria-disabled={isEffectivelyDisabled ? 'true' : undefined}
          ></span>
        )}

        {showCheckmark && (
          <span class="md-chip__checkmark" part="checkmark" aria-hidden="true">
            <svg viewBox="0 0 18 18" fill="none">
              <path d="M6.75 12.127L3.623 9l-1.06 1.057L6.75 14.25l9-9-1.057-1.057L6.75 12.127z" fill="currentColor" />
            </svg>
          </span>
        )}

        <slot name="leading-icon">
          {hasLeadingIcon && !showCheckmark && (
            <span class="md-chip__icon material-symbols-outlined" part="icon" aria-hidden="true">
              {this.icon}
            </span>
          )}
        </slot>

        <span class="md-chip__label" part="label" id="md-chip-label-text">
          <slot>{this.label}</slot>
        </span>

        {showRemove ? (
          <button
            class="md-chip__remove"
            part="remove"
            type="button"
            tabindex={this.disabled ? '-1' : '0'}
            aria-label={chipLabel ? `Remove ${chipLabel}` : 'Remove'}
            disabled={isEffectivelyDisabled}
            onClick={this.handleRemoveClick}
            onKeyDown={this.handleRemoveKeyDown}
          >
            <slot name="trailing-icon">
              <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M14.25 4.808l-1.058-1.058L9 7.942 4.808 3.75 3.75 4.808 7.942 9 3.75 13.192l1.058 1.058L9 10.058l4.192 4.192 1.058-1.058L10.058 9l4.192-4.192z" fill="currentColor" />
              </svg>
            </slot>
          </button>
        ) : (
          <slot name="trailing-icon">
            {hasTrailingIcon && (
              <span class="md-chip__trailing-icon material-symbols-outlined" part="trailing-icon" aria-hidden="true">
                {this.trailingIcon}
              </span>
            )}
          </slot>
        )}
      </Host>
    );
  }
}

import { Component, Host, h, Prop, State, Watch, Event, EventEmitter, Element } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

@Component({ tag: 'md-fab', styleUrl: 'md-fab.css', shadow: true })
export class MdFab {
  @Element() el!: HTMLElement;

  @Prop() variant: 'surface' | 'primary-container' | 'secondary-container' | 'tertiary-container' | 'primary' | 'secondary' | 'tertiary' = 'primary-container';
  @Prop() size: 'standard' | 'medium' | 'large' = 'standard';
  @Prop({ reflect: true }) disabled: boolean = false;
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;
  @Prop({ reflect: true }) lowered: boolean = false;
  @Prop() ripple: boolean = true;
  @Prop() icon: string = '';
  @Prop() label: string = '';

  /**
   * Whether the FAB shows its label (extended) or collapses to an icon-only
   * circle. Leave unset for the default behaviour (extended whenever a `label`
   * is provided). Set explicitly — e.g. by `<md-navigation-rail>` on
   * collapse — to morph between extended and icon-only: the label width/opacity
   * springs closed and the container shrinks to a 56px circle, while the label
   * stays available as the accessible name.
   */
  @Prop({ reflect: true, mutable: true }) extended?: boolean;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires when the user activates the FAB (mouse click, touch, or
   * `Enter`/`Space` while focused). Not emitted when `disabled` or
   * `soft-disabled`. Bubbles and is composed so a delegated listener
   * on a parent element works.
   *
   * ```ts
   * document.querySelector('md-fab')!.addEventListener('mdClick', (e) => {
   *   const mouseEvent = (e as CustomEvent<MouseEvent>).detail;
   *   console.log('FAB clicked at', mouseEvent.clientX, mouseEvent.clientY);
   * });
   * ```
   */
  @Event({ bubbles: true, composed: true })
  mdClick!: EventEmitter<MouseEvent>;

  @State() private hasSlottedIcon = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  /**
   * Whether the CONSUMER supplied an accessible name, captured before the
   * component ever writes one itself.
   *
   * render() used to read `this.el.hasAttribute('aria-label')` directly, but it
   * also SETS that attribute — so the value was self-referential: the first
   * render wrote aria-label from `label`, and every render after that saw the
   * attribute present, concluded the consumer had supplied it, and removed it
   * again. Any second render silently stripped the accessible name and the WCAG
   * guard then warned about a name the component had just deleted.
   */
  private authoredAccessibleName = false;

  componentWillLoad() {
    this.authoredAccessibleName =
      this.el.hasAttribute('aria-label') || this.el.hasAttribute('aria-labelledby');

    // Seed from the authored light DOM. `slotchange` only fires on later
    // mutations, so a FAB written with its icon in the markup never flipped
    // `--with-icon` and laid out as if it carried no icon — only FABs whose icon
    // arrived at runtime were correct.
    //
    // Done here rather than in componentDidLoad deliberately: setting @State
    // after mount forces a SECOND render, and this component's render is not
    // idempotent — it writes aria-label onto its own host — so an extra pass had
    // side effects. Seeding before the first render sidesteps that entirely.
    this.hasSlottedIcon = Array.from(this.el.children).some(
      (c) => c.getAttribute('slot') === 'icon',
    );
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const iconSlot = shadow.querySelector('slot[name="icon"]') as HTMLSlotElement | null;
    iconSlot?.addEventListener('slotchange', () => {
      this.hasSlottedIcon = iconSlot.assignedElements().length > 0;
    });

    this.measureLabel();
    // Enable transitions only after the first paint so the initial
    // extended/collapsed state is applied without a mount-time morph, and
    // re-measure once layout has flushed (componentDidLoad can run before the
    // label's text has been laid out / fonts applied → scrollWidth 0).
    requestAnimationFrame(() => {
      this.measureLabel();
      this.el.setAttribute('data-ready', '');
    });
    // Web fonts (Roboto) can load after first paint and change the label width.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => this.measureLabel());
    }

    if (
      typeof window !== 'undefined' &&
      window.__STENCIL_DEV_MODE__ !== false
    ) {
      this.warnMissingAccessibleName();
    }
  }

  componentDidRender() {
    this.measureLabel();
  }

  @Watch('label')
  onLabelChange() {
    this.measureLabel();
  }

  /**
   * Record the label's natural width as `--_fab-label-w` so the extended ↔
   * icon-only morph can spring `max-inline-size` between that exact width and
   * `0` (a fixed over-large max-width would make the visible reveal finish far
   * too early). `scrollWidth` reports the full content width even while the
   * label is clipped to 0, so this stays correct in either state.
   */
  private measureLabel() {
    const label = this.el.shadowRoot?.querySelector('.md-fab__label') as HTMLElement | null;
    // Guard against 0 (text not yet laid out): never overwrite a good width
    // with 0, which would collapse the label even while extended.
    if (label && label.scrollWidth > 0) {
      this.el.style.setProperty('--_fab-label-w', `${label.scrollWidth}px`);
    }
  }

  private warnMissingAccessibleName() {
    // Uses the AUTHORED flag, not the live attribute: by the time this runs the
    // component may have written aria-label itself from `label`.
    if (!this.authoredAccessibleName && !this.label) {
      console.warn(
        `[md-fab] WCAG 1.1.1: Icon-only FAB is missing an accessible name. ` +
        `Add aria-label or aria-labelledby to <${this.el.tagName.toLowerCase()}>.`,
        this.el,
      );
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) { e.preventDefault(); return; }
    this.mdClick.emit(e);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        triggerRipple(this.el);
        this.el.click();
      }
    }
  };

  render() {
    const isEffectivelyDisabled = this.isDisabled;
    const hasLabel = !!this.label;
    // Extended unless explicitly collapsed. Default (prop unset) = extended
    // whenever a label is present, preserving the original behaviour.
    const isExtended = this.extended === undefined ? hasLabel : this.extended;
    const hasIcon = !!this.icon;
    const hasExplicitAriaLabel = this.authoredAccessibleName;

    return (
      <Host
        class={{
          'md-fab': true,
          [`md-fab--${this.variant}`]: true,
          // Fixed circular sizes apply only to FABs that never carry a label.
          [`md-fab--${this.size}`]: !hasLabel,
          'md-fab--extended': hasLabel && isExtended,
          'md-fab--collapsed': hasLabel && !isExtended,
          'md-fab--with-icon': hasIcon || this.hasSlottedIcon,
          'md-fab--lowered': this.lowered,
          'md-fab--disabled': this.disabled || this.softDisabled,
        }}
        role="button"
        aria-label={hasLabel && !hasExplicitAriaLabel ? this.label : undefined}
        aria-disabled={isEffectivelyDisabled ? 'true' : 'false'}
        tabindex={this.disabled ? '-1' : '0'}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        {this.ripple && <md-ripple disabled={isEffectivelyDisabled}></md-ripple>}
        <span class="md-fab__state-layer" part="state-layer" aria-hidden="true"></span>
        <slot name="icon">
          {hasIcon && <span class="md-fab__icon material-symbols-outlined" part="icon" aria-hidden="true">{this.icon}</span>}
        </slot>
        {hasLabel && <span class="md-fab__label" part="label" aria-hidden={!isExtended ? 'true' : undefined}>{this.label}</span>}
      </Host>
    );
  }
}

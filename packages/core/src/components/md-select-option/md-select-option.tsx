import {
  Component,
  Host,
  h,
  Prop,
  Element,
  Event,
  EventEmitter,
  Watch,
} from '@stencil/core';

/**
 * `md-select-option` — declarative option for `md-select` / `md-multi-select`.
 *
 * This element is a **data carrier**: it renders nothing visible (the host
 * is `display: none`). The parent picker reads its `value`, label (the
 * `label` prop or slotted text), `disabled`, `icon`, and `supporting-text`
 * and projects them into the `md-menu` dropdown as `md-menu-item`s.
 *
 * Authoring:
 * ```html
 * <md-select label="Colour">
 *   <md-select-option value="red" icon="circle">Red</md-select-option>
 *   <md-select-option value="green" disabled>Green</md-select-option>
 * </md-select>
 * ```
 *
 * Whenever an option is added, removed, or has its data changed, it emits a
 * bubbling `mdSelectOptionChange` event so the parent re-reads its option set.
 */
@Component({
  tag: 'md-select-option',
  styleUrl: 'md-select-option.css',
  shadow: true,
})
export class MdSelectOption {
  @Element() el!: HTMLElement;

  /** Stable identifier emitted by the picker and used for matching. */
  @Prop() value: string = '';

  /** Visible label. Falls back to the slotted text content when empty. */
  @Prop() label: string = '';

  /** Disabled options stay visible in the menu but cannot be selected. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Initial-selected hint (used by the picker only when its value is unset). */
  @Prop({ reflect: true }) selected: boolean = false;

  /** Material Symbols leading-icon glyph rendered in the menu row. */
  @Prop() icon: string = '';

  /** CSS colour for the leading icon (any CSS `<color>` — hex, `rgb()`, or a
   *  theme token such as `var(--md-sys-color-primary)`). Ignored without `icon`. */
  @Prop({ attribute: 'icon-color' }) iconColor: string = '';

  /** Secondary text rendered under the label in the menu row. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Fired when the option mounts, unmounts, or its data changes so the
   *  parent picker can re-read its option set. */
  @Event({ bubbles: true, composed: true })
  mdSelectOptionChange!: EventEmitter<void>;

  @Watch('value')
  @Watch('label')
  @Watch('disabled')
  @Watch('selected')
  @Watch('icon')
  @Watch('iconColor')
  @Watch('supportingText')
  onDataChange() {
    this.mdSelectOptionChange.emit();
  }

  connectedCallback() {
    this.mdSelectOptionChange?.emit();
  }

  disconnectedCallback() {
    this.mdSelectOptionChange?.emit();
  }

  render() {
    // role="option" is kept for AT semantics when authors inspect the DOM,
    // but the element is visually hidden — the picker renders the real,
    // interactive row inside its md-menu. aria-hidden avoids double
    // announcement of the (hidden) carrier alongside the live menu item.
    return (
      <Host
        role="option"
        aria-hidden="true"
        aria-selected={String(this.selected)}
        aria-disabled={this.disabled ? 'true' : 'false'}
      >
        <slot />
      </Host>
    );
  }
}

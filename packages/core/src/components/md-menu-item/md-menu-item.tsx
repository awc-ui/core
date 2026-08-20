import { Component, Host, h, Prop, Event, EventEmitter, Element, State } from '@stencil/core';
import { MenuElement, SelectableElement } from '../../utils/types';
import { triggerRipple } from '../../utils/ripple';

@Component({ tag: 'md-menu-item', styleUrl: 'md-menu-item.css', shadow: true })
export class MdMenuItem {
  @Element() el!: HTMLElement;

  /** Primary label text. */
  @Prop() headline: string = '';
  /** Secondary descriptive text below the headline. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';
  /** Trailing text (e.g. keyboard shortcut). */
  @Prop({ attribute: 'trailing-text' }) trailingText: string = '';
  /** Whether the item is disabled. */
  @Prop({ reflect: true }) disabled: boolean = false;
  /** Whether the item is currently selected. */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;
  /** Mixed/partial state for a `checkbox` item — renders a dash in the check
   *  slot instead of a tick and exposes `aria-checked="mixed"`. Used for a
   *  "select all" affordance where only some children are selected. Ignored for
   *  `button`/`radio` types and when `selected` is true. */
  @Prop({ mutable: true, reflect: true }) indeterminate: boolean = false;
  /** Prevent the parent menu from closing when this item is clicked. */
  @Prop({ attribute: 'keep-open' }) keepOpen: boolean = false;
  /** Render a divider line below this item. */
  @Prop({ reflect: true }) divider: boolean = false;
  /** Render a gap (extra space) below this item — an alternative separator to divider. */
  @Prop({ reflect: true }) gap: boolean = false;
  /** Small badge label (e.g. "New") displayed before the trailing area. */
  @Prop() badge: string = '';
  /** Type of item: 'button' (default action), 'checkbox' (toggle), or 'radio' (single-select within group). */
  @Prop() type: 'button' | 'checkbox' | 'radio' = 'button';
  /** Position of the selection checkmark indicator. */
  @Prop({ attribute: 'check-position', reflect: true }) checkPosition: 'start' | 'end' = 'end';
  /**
   * ARIA presentation. `'menuitem'` (default) exposes the item with the menu
   * role family (`menuitem` / `menuitemradio` / `menuitemcheckbox`, state via
   * `aria-checked`). `'option'` exposes it as a listbox option (`role="option"`,
   * state via `aria-selected`) — used by `md-select` so the popup is a proper
   * WAI-ARIA combobox/listbox rather than a menu.
   */
  @Prop({ reflect: true }) presentation: 'menuitem' | 'option' = 'menuitem';

  /**
   * Override the computed ARIA role. Used when a checkbox/radio item is NOT inside
   * a menu — e.g. a "select all" toggle in a listbox popup, which is semantically a
   * `checkbox` (keeps `aria-checked`, drops the menu-only required-parent). Empty =
   * the default menuitem/option role family.
   */
  @Prop({ attribute: 'role-override' }) roleOverride: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the item is activated. */
  @Event() mdClick: EventEmitter<void>;

  @State() private hasLeadingIcon = false;
  @State() private hasTrailingIcon = false;

  componentWillLoad() {
    this.hasLeadingIcon = !!this.el.querySelector('[slot="leading-icon"]');
    this.hasTrailingIcon = !!this.el.querySelector('[slot="trailing-icon"]');
  }

  private handleClick = (e: MouseEvent) => {
    if (this.disabled) { e.preventDefault(); e.stopPropagation(); return; }

    if (this.type === 'checkbox') {
      this.selected = !this.selected;
    } else if (this.type === 'radio') {
      this.selected = true;
      this.deselectSiblingRadios();
    }

    this.mdClick.emit();

    if (!this.keepOpen) {
      let menu = this.el.closest('md-menu') as HTMLElement | null;
      let root = menu;
      while (menu) {
        const parent = menu.parentElement?.closest('md-menu') as HTMLElement | null;
        if (parent) { root = parent; menu = parent; } else { break; }
      }
      if (root) {
        const rootMenu = root as MenuElement;
        if (rootMenu.anchor) {
          document.getElementById(rootMenu.anchor)?.focus();
        }
        setTimeout(() => rootMenu.close?.(), 150);
      }
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!this.disabled) triggerRipple(this.el);
      this.el.click();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (this.disabled) return;

      triggerRipple(this.el);

      if (this.type === 'checkbox') {
        this.selected = !this.selected;
        this.mdClick.emit();
      } else if (this.type === 'radio') {
        this.selected = true;
        this.deselectSiblingRadios();
        this.mdClick.emit();
      } else {
        this.el.click();
      }
    }
  };

  private deselectSiblingRadios() {
    if (this.type !== 'radio') return;
    const group = this.el.closest('md-menu-item-group') || this.el.closest('md-menu');
    if (!group) return;
    const siblings = Array.from(group.querySelectorAll('md-menu-item')) as unknown as SelectableElement[];
    for (const sibling of siblings) {
      if (sibling !== this.el && sibling.type === 'radio' && sibling.selected) {
        sibling.selected = false;
      }
    }
  }

  private get role(): string {
    if (this.roleOverride) return this.roleOverride;
    if (this.presentation === 'option') return 'option';
    if (this.type === 'checkbox') return 'menuitemcheckbox';
    if (this.type === 'radio') return 'menuitemradio';
    return 'menuitem';
  }

  render() {
    return (
      <Host
        class={{
          'md-menu-item': true,
          'md-menu-item--selected': this.selected,
          'md-menu-item--disabled': this.disabled,
          'md-menu-item--divider': this.divider,
          'md-menu-item--gap': this.gap,
        }}
        role={this.role}
        aria-disabled={this.disabled ? 'true' : 'false'}
        aria-selected={this.presentation === 'option' ? String(this.selected) : undefined}
        aria-checked={
          this.presentation !== 'option' && this.type !== 'button'
            ? this.indeterminate && !this.selected
              ? 'mixed'
              : String(this.selected)
            : undefined
        }
        tabindex="-1"
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={this.disabled}></md-ripple>
        <span class="md-menu-item__state-layer" part="state-layer" aria-hidden="true"></span>

        {this.type !== 'button' && this.checkPosition === 'start' && (
          <span class="md-menu-item__check" aria-hidden="true">
            <span class="material-symbols-outlined">
              {this.selected ? 'check' : this.indeterminate ? 'remove' : ''}
            </span>
          </span>
        )}

        {this.hasLeadingIcon && (
          <span class="md-menu-item__leading" part="leading-icon" aria-hidden="true">
            <slot name="leading-icon"></slot>
          </span>
        )}

        <span class="md-menu-item__content" part="content">
          <span class="md-menu-item__headline" part="headline">{this.headline}</span>
          {this.supportingText && (
            <span class="md-menu-item__supporting" part="supporting-text">{this.supportingText}</span>
          )}
        </span>

        {this.badge && (
          <span class="md-menu-item__badge" part="badge">{this.badge}</span>
        )}

        {(this.hasTrailingIcon || this.trailingText) && (
          <span class="md-menu-item__trailing" part="trailing">
            <slot name="trailing-icon">
              {this.trailingText && (
                <span class="md-menu-item__trailing-text">{this.trailingText}</span>
              )}
            </slot>
          </span>
        )}

        {this.type !== 'button' && this.checkPosition === 'end' && (
          <span class="md-menu-item__check" aria-hidden="true">
            <span class="material-symbols-outlined">
              {this.selected ? 'check' : this.indeterminate ? 'remove' : ''}
            </span>
          </span>
        )}
      </Host>
    );
  }
}

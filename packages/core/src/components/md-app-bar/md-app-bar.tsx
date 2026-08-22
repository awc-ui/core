import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Prop,
  State,
  h,
} from '@stencil/core';

/**
 * `md-app-bar` — Material Design 3 App Bar.
 *
 * Implements the current (M3 Expressive) app-bars specification:
 *   https://m3.material.io/components/app-bars/specs
 *
 * Size variants: `small` (64px), `medium` (112/136px expanded), `large`
 * (120/152px expanded), and `search` (inline search field in the 64px row).
 * Flexible `medium` / `large` bars always render the expanded headline block.
 * Title alignment (`title-alignment`) is configuration, not a variant.
 *
 * Selecting the search field should open an `md-search` view via `mdSearchActivate`.
 *
 */
@Component({
  tag: 'md-app-bar',
  styleUrl: 'md-app-bar.css',
  shadow: true,
})
export class MdAppBar {
  /** Maximum trailing action icons per M3 app bar guidance. */
  private static readonly MAX_TRAILING_ICONS = 3;

  @Element() el!: HTMLElement;

  /**
   * App bar size variant.
   *
   * - `small` — 64px action row with inline title-large headline.
   * - `medium` — flexible 112px (136px with subtitle) expanded headline block.
   * - `large` — flexible 120px (152px with subtitle) expanded headline block.
   * - `search` — 64px row with inline search field (M3 search app bar).
   */
  @Prop({ reflect: true })
  variant: 'small' | 'medium' | 'large' | 'search' = 'small';

  /**
   * Title horizontal alignment — `start` (leading edge, default) or `center`.
   * On search bars it centers the placeholder when empty and unfocused; once
   * focused or when typing, the caret and text align to the inline-start edge.
   */
  @Prop({ reflect: true, attribute: 'title-alignment' })
  titleAlignment: 'start' | 'center' = 'start';

  /**
   * Search variant only: hinted search text shown in the inline search field.
   * Falls back to `placeholder` on the optional `search` slot when empty.
   */
  @Prop({ attribute: 'search-placeholder' }) searchPlaceholder: string = 'Search';

  /** Search variant only: current search field value (two-way bindable). */
  @Prop({ mutable: true, reflect: true, attribute: 'search-value' }) searchValue: string = '';

  /**
   * Search variant only: accessible name for the inline search field. Per M3
   * labeling guidance, falls back to `search-placeholder` when unset.
   */
  @Prop({ attribute: 'search-aria-label' }) searchAriaLabel: string = '';

  /** Search variant only: disable the inline search field. */
  @Prop({ reflect: true, attribute: 'search-disabled' }) searchDisabled: boolean = false;

  /** Inline or expanded headline text. Falls back to the `headline` slot when empty. */
  @Prop({ reflect: true }) headline: string = '';

  /**
   * Optional subtitle. On flexible variants it sits below the expanded headline
   * (and grows the container); on `small` it stacks under the inline title.
   * Falls back to the `subtitle` slot when empty.
   */
  @Prop({ reflect: true }) subtitle: string = '';

  /**
   * When true, applies the scrolled container surface colour per M3 app bar
   * common-colors (`surface` → `surface-container`). Wire from your scroll listener;
   * the component does not observe scroll position itself.
   */
  @Prop({ reflect: true }) scrolled: boolean = false;

  /**
   * Density scale: 0 (default 64px row), -1 (60px), -2 (56px), -3 (52px), -4 (48px).
   * Tightens the action row, icon targets, search field, and expanded heights.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Material Symbols name for the leading navigation icon (slot takes priority). */
  @Prop({ attribute: 'leading-icon' }) leadingIcon: string = '';

  /** Accessible label for the prop-based leading icon button. Required when `leading-icon` is set. */
  @Prop({ attribute: 'leading-icon-label' }) leadingIconLabel: string = '';

  /** Emitted when the prop-based leading icon button is activated. */
  @Event() mdLeadingClick: EventEmitter<MouseEvent>;

  /**
   * Search variant only: emitted when the inline search field is selected
   * (click, focus, Enter, or Space). Wire this to `md-search.show()` to open
   * the full-screen search view per the MD3 spec.
   */
  @Event() mdSearchActivate: EventEmitter<{ value: string }>;

  /** Search variant only: emitted on every inline search field input change. */
  @Event() mdSearchInput: EventEmitter<{ value: string }>;

  @State() private hasSlottedLeading = false;
  @State() private hasSlottedHeadline = false;
  @State() private hasSlottedSubtitle = false;
  @State() private hasSlottedSearch = false;
  @State() private hasSlottedSearchTrailing = false;
  @State() private searchFocused = false;
  @State() private searchKeyboardModality = false;

  private searchInput?: HTMLInputElement;

  connectedCallback() {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', this.trackSearchKeyboardModality, true);
    document.addEventListener('pointerdown', this.trackSearchPointerModality, true);
  }

  disconnectedCallback() {
    if (typeof document === 'undefined') return;
    document.removeEventListener('keydown', this.trackSearchKeyboardModality, true);
    document.removeEventListener('pointerdown', this.trackSearchPointerModality, true);
  }

  componentWillLoad() {
    this.hasSlottedLeading = this.el.querySelector('[slot="leading"]') !== null;
    this.hasSlottedHeadline = this.el.querySelector('[slot="headline"]') !== null;
    this.hasSlottedSubtitle = this.el.querySelector('[slot="subtitle"]') !== null;
    this.hasSlottedSearch = this.el.querySelector('[slot="search"]') !== null;
    this.hasSlottedSearchTrailing =
      this.el.querySelector('[slot="search-trailing"]') !== null;
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const leadingSlot = shadow.querySelector('slot[name="leading"]') as HTMLSlotElement | null;
    const headlineSlot = shadow.querySelector('slot[name="headline"]') as HTMLSlotElement | null;
    const subtitleSlot = shadow.querySelector('slot[name="subtitle"]') as HTMLSlotElement | null;
    const searchSlot = shadow.querySelector('slot[name="search"]') as HTMLSlotElement | null;
    const searchTrailingSlot = shadow.querySelector(
      'slot[name="search-trailing"]',
    ) as HTMLSlotElement | null;
    const trailingSlot = shadow.querySelector('slot[name="trailing"]') as HTMLSlotElement | null;

    const syncLeading = () => {
      this.hasSlottedLeading =
        this.el.querySelector('[slot="leading"]') !== null ||
        (leadingSlot?.assignedElements().length ?? 0) > 0;
    };
    const syncHeadline = () => {
      this.hasSlottedHeadline =
        this.el.querySelector('[slot="headline"]') !== null ||
        (headlineSlot?.assignedElements().length ?? 0) > 0;
    };
    const syncSubtitle = () => {
      this.hasSlottedSubtitle =
        this.el.querySelector('[slot="subtitle"]') !== null ||
        (subtitleSlot?.assignedElements().length ?? 0) > 0;
    };
    const syncSearch = () => {
      this.hasSlottedSearch =
        this.el.querySelector('[slot="search"]') !== null ||
        (searchSlot?.assignedElements().length ?? 0) > 0;
    };
    const syncSearchTrailing = () => {
      this.hasSlottedSearchTrailing =
        this.el.querySelector('[slot="search-trailing"]') !== null ||
        (searchTrailingSlot?.assignedElements().length ?? 0) > 0;
    };
    const syncTrailing = () => this.enforceTrailingSlotLimit(trailingSlot);

    leadingSlot?.addEventListener('slotchange', syncLeading);
    headlineSlot?.addEventListener('slotchange', syncHeadline);
    subtitleSlot?.addEventListener('slotchange', syncSubtitle);
    searchSlot?.addEventListener('slotchange', syncSearch);
    searchTrailingSlot?.addEventListener('slotchange', syncSearchTrailing);
    trailingSlot?.addEventListener('slotchange', syncTrailing);
    syncTrailing();
  }

  /**
   * Hides trailing slot children beyond {@link MdAppBar.MAX_TRAILING_ICONS} and
   * warns in development when consumers assign too many action icons.
   */
  private enforceTrailingSlotLimit(trailingSlot: HTMLSlotElement | null) {
    const assigned = trailingSlot?.assignedElements({ flatten: true }) ?? [];
    if (assigned.length > MdAppBar.MAX_TRAILING_ICONS) {
      console.warn(
        `[md-app-bar] The trailing slot supports at most ${MdAppBar.MAX_TRAILING_ICONS} action icons; ` +
          `${assigned.length} were provided. Icons beyond the limit are hidden.`,
      );
    }
    assigned.forEach((node, index) => {
      const el = node as HTMLElement;
      if (index >= MdAppBar.MAX_TRAILING_ICONS) {
        el.hidden = true;
      } else if (el.hidden) {
        el.hidden = false;
      }
    });
  }

  private trackSearchKeyboardModality = () => {
    this.searchKeyboardModality = true;
  };

  private trackSearchPointerModality = () => {
    this.searchKeyboardModality = false;
  };

  private isFlexible() {
    return this.variant === 'medium' || this.variant === 'large';
  }

  private isSearchVariant() {
    return this.variant === 'search';
  }

  private hasHeadlineContent() {
    return Boolean(this.headline) || this.hasSlottedHeadline;
  }

  private effectiveSearchLabel() {
    return this.searchAriaLabel || this.searchPlaceholder || 'Search';
  }

  private emitSearchActivate() {
    if (this.searchDisabled) return;
    this.mdSearchActivate.emit({ value: this.searchValue });
  }

  private handleSearchContainerClick = () => {
    if (this.searchDisabled) return;
    this.searchInput?.focus();
  };

  private handleSearchInput = (event: Event) => {
    const next = (event.target as HTMLInputElement).value;
    this.searchValue = next;
    this.mdSearchInput.emit({ value: next });
  };

  private handleSearchFocus = () => {
    if (this.searchDisabled) return;
    this.searchFocused = true;
    this.emitSearchActivate();
  };

  private handleSearchBlur = () => {
    this.searchFocused = false;
  };

  private handleSearchKeyDown = (event: KeyboardEvent) => {
    if (this.searchDisabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.emitSearchActivate();
    }
  };

  private hasSubtitleContent() {
    return Boolean(this.subtitle) || this.hasSlottedSubtitle;
  }

  private renderLeadingFallback() {
    const showFallback = Boolean(this.leadingIcon) && !this.hasSlottedLeading;
    if (!showFallback) return null;

    return (
      <md-icon-button
        class="md-app-bar__leading-button"
        exportparts="icon, state-layer"
        part="leading-icon"
        icon={this.leadingIcon}
        variant="standard"
        size="md"
        buttonWidth="narrow"
        aria-label={this.leadingIconLabel || undefined}
        onClick={(event: MouseEvent) => this.mdLeadingClick.emit(event)}
      ></md-icon-button>
    );
  }

  /**
   * Inline title block: the only title for `small`, and a visually hidden
   * collapsed copy on flexible bars (expanded headline is primary).
   */
  private renderInlineHeadline() {
    const flexible = this.isFlexible();

    const titleNode = this.headline ? (
      <span class="md-app-bar__title" part="title">
        {this.headline}
      </span>
    ) : flexible ? null : this.hasSlottedHeadline ? (
      <span class="md-app-bar__title" part="title">
        <slot name="headline" />
      </span>
    ) : null;

    const subtitleNode = !this.hasSubtitleContent()
      ? null
      : this.subtitle
        ? (
          <span class="md-app-bar__subtitle md-app-bar__subtitle--inline" part="subtitle">
            {this.subtitle}
          </span>
        )
        : flexible
          ? null
          : (
            <span class="md-app-bar__subtitle md-app-bar__subtitle--inline" part="subtitle">
              <slot name="subtitle" />
            </span>
          );

    if (!titleNode && !subtitleNode) return null;

    return (
      <span class="md-app-bar__headline-inline" aria-hidden={flexible ? 'true' : null}>
        {titleNode}
        {subtitleNode}
      </span>
    );
  }

  private renderExpandedHeadline() {
    if (this.headline) {
      return (
        <span class="md-app-bar__expanded-headline" part="expanded-headline">
          {this.headline}
        </span>
      );
    }
    return (
      <span class="md-app-bar__expanded-headline" part="expanded-headline">
        <slot name="headline" />
      </span>
    );
  }

  private renderExpandedSubtitle() {
    if (this.subtitle) {
      return (
        <span class="md-app-bar__subtitle" part="subtitle">
          {this.subtitle}
        </span>
      );
    }
    return (
      <span class="md-app-bar__subtitle" part="subtitle">
        <slot name="subtitle" />
      </span>
    );
  }

  private renderSearchField() {
    return (
      <div class="md-app-bar__search-host" part="search-host">
        <div
          class={{
            'md-app-bar__search': true,
            'md-app-bar__search--focused': this.searchFocused,
            'md-app-bar__search--focus-ring':
              this.searchFocused && this.searchKeyboardModality,
          }}
          part="search"
          onClick={this.handleSearchContainerClick}
        >
        {!this.searchDisabled && <md-ripple disabled={this.searchDisabled}></md-ripple>}
        <span class="md-app-bar__search-state-layer" part="search-state-layer" aria-hidden="true"></span>
        {this.hasSlottedSearch ? (
          <span class="md-app-bar__search-field" part="search-field">
            <span class="md-app-bar__search-content" part="search-content">
              <slot name="search" />
            </span>
          </span>
        ) : (
          <span class="md-app-bar__search-field" part="search-field">
            <input
              ref={(el) => (this.searchInput = el as HTMLInputElement)}
              class="md-app-bar__search-input"
              part="search-input"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              role="searchbox"
              value={this.searchValue}
              placeholder={this.searchPlaceholder}
              disabled={this.searchDisabled}
              aria-label={this.effectiveSearchLabel()}
              autocomplete="off"
              spellcheck={false}
              onInput={this.handleSearchInput}
              onFocus={this.handleSearchFocus}
              onBlur={this.handleSearchBlur}
              onKeyDown={this.handleSearchKeyDown}
            />
          </span>
        )}
        <span class="md-app-bar__search-trailing" part="search-trailing">
          <slot name="search-trailing" />
        </span>
        </div>
      </div>
    );
  }

  private renderSearchTop() {
    return (
      <div class="md-app-bar__row md-app-bar__row--search" part="row">
        <span class="md-app-bar__leading" part="leading">
          <slot name="leading"></slot>
          {this.renderLeadingFallback()}
        </span>
        {this.renderSearchField()}
        <span class="md-app-bar__trailing" part="trailing">
          <slot name="trailing" />
        </span>
      </div>
    );
  }

  private renderTop() {
    if (this.isSearchVariant()) {
      return this.renderSearchTop();
    }

    const flexible = this.isFlexible();

    return [
      <div class="md-app-bar__row" part="row">
        <span class="md-app-bar__leading" part="leading">
          <slot name="leading"></slot>
          {this.renderLeadingFallback()}
        </span>
        {this.renderInlineHeadline()}
        <span class="md-app-bar__trailing" part="trailing">
          <slot name="trailing" />
        </span>
      </div>,
      flexible && (
        <div class="md-app-bar__expanded" part="expanded">
          {this.renderExpandedHeadline()}
          {this.hasSubtitleContent() && this.renderExpandedSubtitle()}
        </div>
      ),
    ];
  }

  render() {
    const flexible = this.isFlexible();
    const search = this.isSearchVariant();
    const centered = this.titleAlignment === 'center';

    return (
      <Host
        class={{
          'md-app-bar': true,
          [`md-app-bar--${this.variant}`]: true,
          'md-app-bar--flexible': flexible,
          'md-app-bar--center': centered,
          'md-app-bar--search': search,
          'md-app-bar--with-subtitle': !search && this.hasSubtitleContent(),
          'md-app-bar--search-focused': search && this.searchFocused,
          'md-app-bar--search-disabled': search && this.searchDisabled,
          'md-app-bar--with-search-trailing': search && this.hasSlottedSearchTrailing,
          'md-app-bar--scrolled': this.scrolled,
          [`md-app-bar--density${this.density}`]: this.density !== 0,
        }}
        role="banner"
      >
        {this.renderTop()}
      </Host>
    );
  }
}

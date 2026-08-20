import { AttachInternals, Component, Element, Event, EventEmitter, Host, Listen, Method, Prop, State, Watch, h } from '@stencil/core';
import {
  toIsoDate,
  parseIsoDate,
  parseFlexibleDateInput,
  formatDisplayDate,
  dateFormatPattern,
  isSameDay,
  addMonths,
  addDays,
  daysInMonth,
  clampDate,
  isOutOfRange,
  buildMonthMatrix,
  weekdayNames,
  getFirstDayOfWeek,
  type DayCell,
} from './date-utils';
import { waitForHostRipple } from '../../utils/ripple';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';

let dpUid = 0;

/** Docked selection menu bloom-in — keep in sync with `--_selection-bloom-duration`. */
const DOCKED_SELECTION_BLOOM_IN_MS = 450;

/** Docked selection menu bloom-out — keep in sync with `--_selection-bloom-out-duration`. */
const DOCKED_SELECTION_BLOOM_OUT_MS = 200;

/** Panel bloom-out on dismiss — keep in sync with `--_panel-bloom-out-duration`. */
const PANEL_BLOOM_OUT_MS = 200;

/** Calendar bloom-in after selection — keep in sync with `--_calendar-bloom-duration`. */
const DOCKED_CALENDAR_BLOOM_IN_MS = 300;

/**
 * Bottom tooltip offsets for docked nav — center the ~24px plain popup in the
 * 30px gap below the nav row (`.md-date-picker__docked-nav` padding-block-end).
 * Chevrons fill the 40px row; sm menu buttons are shorter and vertically centered.
 */
const DOCKED_NAV_CHEVRON_TOOLTIP_OFFSET = 3;
const DOCKED_NAV_MENU_TOOLTIP_OFFSET = 5;

/** Detail payload emitted by the `mdChange` event. */
export interface MdDatePickerChangeDetail {
  /** Selected ISO date. */
  value: string;
  /** Selected `Date`. */
  date: Date | null;
}

/** Detail payload emitted by the `mdSelected` event. */
export interface MdDatePickerSelectedDetail {
  /** Selected ISO date. */
  value: string;
  /** Selected `Date`. */
  date: Date;
}

/** How the displayed calendar month/year was changed. */
export type MdDatePickerViewChangeSource =
  | 'chevron-month'
  | 'chevron-year'
  | 'month-menu'
  | 'year-menu';

/** Detail payload emitted by the `mdViewChange` event. */
export interface MdDatePickerViewChangeDetail {
  /** Zero-based month index (`0` = January). */
  month: number;
  year: number;
  source: MdDatePickerViewChangeSource;
}

/** Detail payload emitted by the `mdMenuOpen` event. */
export interface MdDatePickerMenuOpenDetail {
  type: 'month' | 'year';
}

/** Detail payload emitted by the `mdMenuSelect` event. */
export interface MdDatePickerMenuSelectDetail {
  type: 'month' | 'year';
  /** Zero-based month index or four-digit year. */
  value: number;
  /** Locale-aware month name or year string when available. */
  label?: string;
}

/** Modal dialog entry mode — calendar grid or typed text field. */
export type MdDatePickerMode = 'calendar' | 'input';

/** Detail payload emitted by the `mdModeChange` event. */
export interface MdDatePickerModeChangeDetail {
  mode: MdDatePickerMode;
}

/**
 * `md-date-picker` — a Material Design 3 date picker.
 *
 * Variants:
 * - `modal-input` *(default)* — outlined text field + modal calendar dialog.
 * - `modal` — bare modal dialog surfaced via `show()` / `open`.
 * - `docked` — outlined text field + dropdown calendar anchored to the field.
 *
 * The modal dialog can flip to a typed-entry view (date input) via the
 * header toggle, satisfying the MD3 "modal date input" pattern.
 */
@Component({
  tag: 'md-date-picker',
  styleUrl: 'md-date-picker.css',
  shadow: true,
  formAssociated: true,
})
export class MdDatePicker {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. The picker previously declared `name`/`value` but
   * was not form-associated, so the chosen date never reached FormData.
   */
  @AttachInternals() internals!: ElementInternals;


  /**
   * Localized constraint-validation message shown when `required` is unmet.
   *
   * A prop rather than a hardcoded string, matching md-time-picker's
   * `value-missing-label`: components stay i18n-engine-agnostic and the
   * consumer localizes through its own dictionary. Native inputs get their
   * message from the browser's locale for free; a form-associated custom
   * element supplies its own, so leaving this hardcoded would ship an
   * English-only form to every locale.
   */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string =
    'Please choose a date.';


  /**
   * Always occupy the supporting-text line, even when there is no message, so a
   * validation error does not push the content below it down. Forwarded to the
   * embedded md-text-field. See that component for why it is opt-in.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /** `value` at first render, restored on form reset. */
  private defaultValue = '';

  /** Presentation variant. */
  @Prop({ reflect: true }) variant: 'modal' | 'modal-input' | 'docked' =
    'modal-input';

  /** Selected date as ISO `YYYY-MM-DD`. Two-way bindable. */
  @Prop({ mutable: true, reflect: true }) value: string = '';

  /** Floating label / accessible name for the field. */
  @Prop() label: string = 'Date';

  /** Placeholder shown inside the text-field input. */
  @Prop() placeholder: string = '';

  /** Earliest selectable date, inclusive, as ISO `YYYY-MM-DD`. */
  @Prop() min: string = '';

  /** Latest selectable date, inclusive, as ISO `YYYY-MM-DD`. */
  @Prop() max: string = '';

  /** Whether the modal / docked panel is open. Two-way bindable. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Disabled — blocks all interaction and removes from tab order. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Marks the field as required (for form-validation contexts). */
  @Prop({ reflect: true }) required: boolean = false;

  /**
   * Show a clear ("×") button on the field trigger while a date is selected,
   * which resets the value (same as calling `clear()`). Applies to the
   * `modal-input` and `docked` variants.
   */
  @Prop({ reflect: true }) clearable: boolean = false;

  /** Accessible label for the clear button. */
  @Prop({ attribute: 'clear-label' }) clearLabel: string = 'Clear date';

  /** Error state — paints the field with the error color and shows `error-text`. */
  @Prop({ mutable: true, reflect: true }) error: boolean = false;

  /** Error message shown below the field when `error` is true. */
  @Prop({ mutable: true, attribute: 'error-text' }) errorText: string = '';

  /** Helper text shown below the field. Hidden while an error is displayed. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** BCP-47 locale for month/weekday names and date formatting. */
  @Prop() locale: string = '';

  /**
   * Character between day, month, and year in the text field (display and
   * parsing). Leave empty to use the locale default (e.g. `/` for `en-US`,
   * `.` for `de-DE`). The `value` prop and `mdChange` / `mdSelected` events
   * always use ISO `YYYY-MM-DD` regardless of this setting.
   *
   * @example
   * ```html
   * <md-date-picker date-separator="/" value="2025-06-15"></md-date-picker>
   * <!-- displays 06/15/2025 in en-US -->
   * <md-date-picker date-separator="." locale="de-DE"></md-date-picker>
   * <!-- displays and parses DD.MM.YYYY -->
   * ```
   */
  @Prop({ attribute: 'date-separator' }) dateSeparator: string = '';

  /**
   * Visual variant of the trigger `md-text-field` (`modal-input` and `docked`).
   * Use `filled` with `--md-date-picker-field-container-color` for branded fills.
   */
  @Prop({ attribute: 'field-variant' }) fieldVariant: 'outlined' | 'filled' = 'outlined';

  /**
   * First day of the week (0 = Sunday … 6 = Saturday). `-1` derives it from
   * the locale.
   */
  @Prop({ attribute: 'first-day-of-week' }) firstDayOfWeek: number = -1;

  /** Headline / supporting text shown at the top of the modal header. */
  @Prop() headline: string = 'Select date';

  /** Label of the cancel button in the modal action row. */
  @Prop({ attribute: 'cancel-label' }) cancelLabel: string = 'Cancel';

  /** Label of the confirm button in the modal action row. */
  @Prop({ attribute: 'ok-label' }) okLabel: string = 'OK';

  /** Large headline when no date is staged in calendar mode. */
  @Prop({ attribute: 'select-date-label' }) selectDateLabel: string = 'Select date';

  /** Large headline shown in typed-entry (input) mode. */
  @Prop({ attribute: 'enter-dates-label' }) enterDatesLabel: string = 'Enter dates';

  /** Default error when a typed date cannot be parsed or is out of range. */
  @Prop({ attribute: 'invalid-date-label' }) invalidDateLabel: string = 'Invalid date';

  /** Accessible label for the "previous month" nav chevron. */
  @Prop({ attribute: 'previous-month-label' }) previousMonthLabel: string = 'Previous month';

  /** Accessible label for the "next month" nav chevron. */
  @Prop({ attribute: 'next-month-label' }) nextMonthLabel: string = 'Next month';

  /** Accessible label for the "previous year" nav chevron. */
  @Prop({ attribute: 'previous-year-label' }) previousYearLabel: string = 'Previous year';

  /** Accessible label for the "next year" nav chevron. */
  @Prop({ attribute: 'next-year-label' }) nextYearLabel: string = 'Next year';

  /** Accessible label for the docked month menu button. */
  @Prop({ attribute: 'choose-month-label' }) chooseMonthLabel: string = 'Choose month';

  /** Accessible label for the docked year menu button. */
  @Prop({ attribute: 'choose-year-label' }) chooseYearLabel: string = 'Choose year';

  /** Accessible label for the modal month/year toggle button. */
  @Prop({ attribute: 'choose-month-year-label' })
  chooseMonthYearLabel: string = 'Choose a different month and year';

  /** Tooltip suffix on the modal month/year nav button. */
  @Prop({ attribute: 'choose-month-and-year-label' })
  chooseMonthAndYearLabel: string = 'Choose month and year';

  /** Mode-toggle label when in typed-entry mode (switch to calendar). */
  @Prop({ attribute: 'toggle-calendar-label' })
  toggleCalendarLabel: string = 'Switch to calendar input';

  /** Mode-toggle label when in calendar mode (switch to text). */
  @Prop({ attribute: 'toggle-text-label' }) toggleTextLabel: string = 'Switch to text input';

  /** Trigger calendar icon label when the panel is closed. */
  @Prop({ attribute: 'open-calendar-label' }) openCalendarLabel: string = 'Open calendar';

  /** Trigger calendar icon label when the panel is open. */
  @Prop({ attribute: 'close-calendar-label' }) closeCalendarLabel: string = 'Close calendar';

  /**
   * Material Symbols name for the trailing calendar toggle on the field.
   * Ignored when a `calendar-icon` slot is provided.
   */
  @Prop({ attribute: 'calendar-icon' }) calendarIcon: string = 'calendar_today';

  /** Accessible label for the modal year-selection grid. */
  @Prop({ attribute: 'year-grid-label' }) yearGridLabel: string = 'Year';

  /** Clicking the modal scrim closes the picker when true. */
  @Prop({ attribute: 'scrim-dismissible' }) scrimDismissible: boolean = true;

  /**
   * Clicking outside a DOCKED panel dismisses it (like `scrim-dismissible` for
   * the modal, which has a scrim to catch the click and a docked panel does not).
   *
   * Set `false` to keep the panel open until Cancel / OK / Esc — useful when the
   * picker sits inside another popup whose own outside-click handling would
   * otherwise fight it, or when a stray click should not discard staged input.
   *
   * Dismissing this way is a cancel: it emits `mdCancel` and discards staging,
   * exactly as the modal scrim does.
   */
  @Prop({ attribute: 'outside-click-dismissible' }) outsideClickDismissible: boolean = true;

  /**
   * Commit a day the moment it is clicked, instead of staging it behind the
   * Cancel / OK row.
   *
   * By default every variant STAGES a day click (`mdSelected`) and commits only
   * on OK (`mdChange`). With this set the two collapse into one interaction:
   * the click stages and commits together, the panel dismisses, and the built-in
   * action row is not rendered at all — there is nothing left for it to confirm.
   *
   * Suits a low-stakes, reversible field. Keep the default when the choice is
   * expensive to get wrong and the user deserves an explicit confirm step.
   */
  @Prop({ reflect: true, attribute: 'commit-on-select' }) commitOnSelect: boolean = false;

  /** Form-association name attribute. */
  @Prop() name: string = '';

  /** Predicate that disables individual dates (return `true` to disable). */
  @Prop() isDateDisabled?: (date: Date) => boolean;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emitted when the user commits a selection. */
  @Event() mdChange: EventEmitter<MdDatePickerChangeDetail>;

  /** Emitted when the user selects a day in the calendar (click or keyboard). */
  @Event() mdSelected: EventEmitter<MdDatePickerSelectedDetail>;

  /** Emitted on every keystroke in a text-entry field. */
  @Event() mdInput: EventEmitter<{ value: string }>;

  /** Emitted when the picker opens. */
  @Event() mdOpen: EventEmitter<void>;

  /** Emitted when the picker closes for any reason. */
  @Event() mdClose: EventEmitter<void>;

  /** Emitted when the user dismisses without committing (scrim, Cancel, Esc). */
  @Event() mdCancel: EventEmitter<void>;

  /** Emitted when the displayed calendar month/year changes from user navigation. */
  @Event() mdViewChange: EventEmitter<MdDatePickerViewChangeDetail>;

  /** Emitted when the user opens the month or year selection menu / grid. */
  @Event() mdMenuOpen: EventEmitter<MdDatePickerMenuOpenDetail>;

  /** Emitted when the user picks a month or year from a selection menu / grid. */
  @Event() mdMenuSelect: EventEmitter<MdDatePickerMenuSelectDetail>;

  /** Emitted when the user toggles between calendar and typed-entry views. */
  @Event() mdModeChange: EventEmitter<MdDatePickerModeChangeDetail>;

  @State() private focused = false;
  @State() private inputDraft = '';
  @State() private viewYear: number = new Date().getFullYear();
  @State() private viewMonth: number = new Date().getMonth();
  @State() private viewMode: 'calendar' | 'year' = 'calendar';
  @State() private inputMode = false;
  @State() private focusedDate: Date = new Date();
  /** Staged selection awaiting OK. */
  @State() private pendingDate: Date | null = null;
  @State() private hasSlottedHeader = false;
  @State() private hasSlottedActions = false;
  @State() private hasSlottedLeading = false;
  @State() private hasSlottedCalendarIcon = false;
  /** Docked month-selection dropdown open. */
  @State() private monthMenuOpen = false;
  /** Docked year-selection dropdown open. */
  @State() private yearMenuOpen = false;
  /** Docked month/year menu playing exit bloom before unmount. */
  @State() private selectionMenuClosing: 'month' | 'year' | null = null;
  /** Docked day grid playing enter bloom after selection menu closes. */
  @State() private dockedCalendarBloom = false;
  /** Day grid slide direction after chevron or Page Up/Down navigation. */
  @State() private gridSlideDirection: 'forward' | 'backward' | null = null;
  /** Modal year grid playing exit bloom before returning to calendar. */
  @State() private yearViewClosing = false;
  /** Modal day grid playing enter bloom after year grid closes. */
  @State() private modalCalendarBloom = false;
  /** Entire panel playing exit bloom before unmount. */
  @State() private panelClosing = false;
  /** Docked panel horizontal alignment vs the trigger anchor. */
  @State() private dockedPanelAlign: 'start' | 'end' = 'start';
  /** Docked panel vertical placement relative to the trigger anchor. */
  @State() private dockedPanelPlacement: 'below' | 'above' = 'below';
  /** Max block-size when the panel cannot fully fit below or above. */
  @State() private dockedPanelMaxBlockSize: string | null = null;

  private uid = `md-dp-${++dpUid}`;
  private entryTextFieldEl?: HTMLElement;
  private entryInputShouldFocus = false;
  private panelEl?: HTMLElement;
  private triggerEl?: HTMLElement;
  private monthMenuButtonEl?: HTMLElement;
  private yearMenuButtonEl?: HTMLElement;
  private restoreFocusEl: HTMLElement | null = null;
  private gridShouldFocus = false;
  private menuShouldFocus: 'month' | 'year' | null = null;
  private menuRestoreFocus: 'month' | 'year' | null = null;
  /** Modal year grid should scroll the active year into view after paint. */
  private yearGridShouldScroll = false;
  /**
   * Frozen year-list bounds while docked year menu or modal year grid is open.
   * Without min/max props the default range is `viewYear ± 100`; freezing prevents
   * the list from re-centering on every year click or chevron step.
   */
  private yearListMinYear: number | null = null;
  private yearListMaxYear: number | null = null;
  /** True after pointer down on non-interactive panel chrome — keeps shortcuts live when focus stays on `body`. */
  private panelPointerEngaged = false;
  /** Set while `dismissPanel()` sets `open = false` so `@Watch('open')` skips re-entry. */
  private closingFromDismiss = false;
  private dockedAnchorEl?: HTMLElement;
  private dockedPositionCleanup: (() => void) | null = null;
  private dockedPositionRafId = 0;
  private dockedPositionRafAttempts = 0;
  private static readonly DOCKED_POSITION_RAF_MAX = 60;

  private get hasField(): boolean {
    return this.variant !== 'modal';
  }

  private get isDocked(): boolean {
    return this.variant === 'docked';
  }

  /** Whether trigger `aria-expanded` should read as open (false during exit bloom). */
  private get triggerExpanded(): boolean {
    return this.open && !this.panelClosing;
  }

  connectedCallback() {
    this.syncViewToValue();
  }

  componentWillLoad() {
    this.defaultValue = this.value;
    this.syncFormValue();
    // Detect projected content from the light DOM up-front so conditionally
    // rendered slots (header / actions) appear on the very first render.
    this.hasSlottedHeader = !!this.el.querySelector('[slot="header"]');
    this.hasSlottedActions = !!this.el.querySelector('[slot="actions"]');
    this.hasSlottedLeading = !!this.el.querySelector('[slot="leading-icon"]');
    this.hasSlottedCalendarIcon = !!this.el.querySelector('[slot="calendar-icon"]');
    if (this.value) {
      this.seedFieldDraftFromValue();
    }
    if (this.open) {
      this.seedPending();
      this.lockScroll();
      this.gridShouldFocus = true;
    }
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;
    const watch = (name: string, set: (has: boolean) => void) => {
      const slot = shadow.querySelector(
        `slot[name="${name}"]`,
      ) as HTMLSlotElement | null;
      if (!slot) return;
      const update = () => set(slot.assignedElements().length > 0);
      slot.addEventListener('slotchange', update);
      update();
    };
    watch('header', (h) => (this.hasSlottedHeader = h));
    watch('actions', (h) => (this.hasSlottedActions = h));
    watch('leading-icon', (h) => (this.hasSlottedLeading = h));
    watch('calendar-icon', (h) => (this.hasSlottedCalendarIcon = h));
  }

  disconnectedCallback() {
    this.unlockScroll();
    this.unbindDockedPositionListeners();
  }

  // ---- docked panel viewport positioning --------------------------------

  private getDockedViewportMargin(): number {
    return 16;
  }

  private resetDockedPanelPosition() {
    this.dockedPanelAlign = 'start';
    this.dockedPanelPlacement = 'below';
    this.dockedPanelMaxBlockSize = null;
    this.dockedPositionRafAttempts = 0;
    if (this.dockedPositionRafId) {
      cancelAnimationFrame(this.dockedPositionRafId);
      this.dockedPositionRafId = 0;
    }
  }

  /**
   * The panel's UNCONSTRAINED content height for viewport-overflow calculations,
   * measured with any `max-block-size` clamp momentarily lifted.
   *
   * The overflow decision must never depend on the clamp it produces. If it read
   * the clamped height, the sequence clamp → "now it fits" → unclamp → "now it
   * overflows" → clamp repeats every render — an infinite render loop that FREEZES
   * the page. It bit the docked selection menus hardest (the year menu re-renders
   * its whole list each cycle). Lifting the clamp for the measurement makes the
   * input independent of the output, so the decision settles in one pass. The
   * inline value is restored synchronously, so there is no visible flash.
   */
  private resolveDockedPanelBlockSize(panel: HTMLElement): number {
    const prev = panel.style.getPropertyValue('max-block-size');
    const prevPriority = panel.style.getPropertyPriority('max-block-size');
    panel.style.setProperty('max-block-size', 'none', 'important');
    const natural = panel.offsetHeight || panel.getBoundingClientRect().height;
    if (prev) {
      panel.style.setProperty('max-block-size', prev, prevPriority);
    } else {
      panel.style.removeProperty('max-block-size');
    }
    return natural;
  }

  private isRtl(): boolean {
    if (typeof window === 'undefined') return false;
    return getComputedStyle(this.el).direction === 'rtl';
  }

  /** Projected physical left/right for a docked panel width + anchor alignment. */
  private projectedHorizontalRect(
    anchorRect: DOMRect,
    panelW: number,
    align: 'start' | 'end',
  ): { left: number; right: number } {
    const rtl = this.isRtl();
    if (align === 'start') {
      if (rtl) {
        return { left: anchorRect.right - panelW, right: anchorRect.right };
      }
      return { left: anchorRect.left, right: anchorRect.left + panelW };
    }
    if (rtl) {
      return { left: anchorRect.left, right: anchorRect.left + panelW };
    }
    return { left: anchorRect.right - panelW, right: anchorRect.right };
  }

  /** Flip / clamp the docked popup so it stays inside the viewport. */
  private positionDockedPanel() {
    if (!this.isDocked || !this.open || this.panelClosing) return;

    const anchor =
      this.dockedAnchorEl ??
      (this.el.shadowRoot?.querySelector('.md-date-picker__docked-anchor') as
        | HTMLElement
        | null);
    const panel = this.panelEl;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelW = panel.offsetWidth || panel.getBoundingClientRect().width;
    const measuredH = panel.offsetHeight || panel.getBoundingClientRect().height;

    if (panelW === 0 || measuredH === 0) {
      if (
        typeof requestAnimationFrame === 'function' &&
        this.dockedPositionRafAttempts < MdDatePicker.DOCKED_POSITION_RAF_MAX
      ) {
        this.dockedPositionRafAttempts += 1;
        cancelAnimationFrame(this.dockedPositionRafId);
        this.dockedPositionRafId = requestAnimationFrame(() => {
          this.dockedPositionRafId = 0;
          this.positionDockedPanel();
        });
      }
      return;
    }

    this.dockedPositionRafAttempts = 0;
    const panelH = this.resolveDockedPanelBlockSize(panel);

    const margin = this.getDockedViewportMargin();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;

    let align: 'start' | 'end' = 'start';
    let placement: 'below' | 'above' = 'below';
    let maxBlockSize: string | null = null;

    const startRect = this.projectedHorizontalRect(anchorRect, panelW, 'start');
    if (startRect.right > vw - margin) {
      const endRect = this.projectedHorizontalRect(anchorRect, panelW, 'end');
      if (endRect.left >= margin) {
        align = 'end';
      }
    }

    const activeRect = this.projectedHorizontalRect(anchorRect, panelW, align);
    if (activeRect.left < margin) {
      const endRect = this.projectedHorizontalRect(anchorRect, panelW, 'end');
      if (endRect.left >= margin) {
        align = 'end';
      }
    } else if (align === 'end') {
      const endRect = this.projectedHorizontalRect(anchorRect, panelW, 'end');
      if (endRect.left < margin) {
        const startAgain = this.projectedHorizontalRect(anchorRect, panelW, 'start');
        if (startAgain.right <= vw - margin) {
          align = 'start';
        }
      }
    }

    const belowBottom = anchorRect.bottom + gap + panelH;
    if (belowBottom > vh - margin) {
      const aboveTop = anchorRect.top - gap - panelH;
      if (aboveTop >= margin) {
        placement = 'above';
      } else {
        const availableBelow = vh - margin - anchorRect.bottom - gap;
        if (availableBelow > 0) {
          maxBlockSize = `${Math.floor(availableBelow)}px`;
        }
      }
    }

    if (placement === 'above') {
      const availableAbove = anchorRect.top - gap - margin;
      if (availableAbove > 0 && panelH > availableAbove) {
        maxBlockSize = `${Math.floor(availableAbove)}px`;
      }
    }

    const changed =
      this.dockedPanelAlign !== align ||
      this.dockedPanelPlacement !== placement ||
      this.dockedPanelMaxBlockSize !== maxBlockSize;

    if (changed) {
      this.dockedPanelAlign = align;
      this.dockedPanelPlacement = placement;
      this.dockedPanelMaxBlockSize = maxBlockSize;
    }
  }

  private bindDockedPositionListeners() {
    if (this.dockedPositionCleanup || typeof window === 'undefined') return;
    const onReposition = () => this.positionDockedPanel();
    window.addEventListener('resize', onReposition, { passive: true });
    window.addEventListener('scroll', onReposition, { passive: true, capture: true });
    this.dockedPositionCleanup = () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, { capture: true });
    };
  }

  private unbindDockedPositionListeners() {
    this.dockedPositionCleanup?.();
    this.dockedPositionCleanup = null;
  }

  @Watch('value')
  @Watch('min')
  @Watch('max')
  onBoundsChange() {
    if (!this.open) this.syncViewToValue();
  }

  @Watch('dateSeparator')
  onDateSeparatorChange() {
    if (this.value) {
      this.seedFieldDraftFromValue();
    }
  }

  @Watch('open')
  onOpenChange(now: boolean, prev: boolean) {
    if (now === prev) return;
    if (now) {
      this.panelClosing = false;
      this.handleOpen();
    } else if (!this.closingFromDismiss && !this.panelClosing) {
      this.open = true;
      void this.dismissPanel();
    } else {
      this.handleClose();
    }
  }

  /** Open the picker. */
  @Method()
  async show(): Promise<void> {
    if (this.disabled) return;
    this.open = true;
  }

  /** Close the picker without committing. */
  @Method()
  async close(): Promise<void> {
    await this.dismissPanel();
  }

  /** Clear the current selection. */
  @Method()
  async clear(): Promise<void> {
    if (this.disabled) return;
    this.value = '';
    this.inputDraft = '';
    this.error = false;
    this.errorText = '';
    this.emitChange();
  }

  /** Move keyboard focus to the field's text input (if present). */
  @Method()
  async focusInput(): Promise<void> {
    const tfInput = this.el.shadowRoot
      ?.querySelector('md-text-field')
      ?.shadowRoot?.querySelector('.md-text-field__input') as HTMLInputElement | null;
    if (tfInput) {
      tfInput.focus();
      return;
    }
    this.triggerEl?.focus();
  }

  // ---- locale / formatting helpers --------------------------------------

  private get loc(): string | undefined {
    return this.locale || undefined;
  }

  private resolvedFirstDay(): number {
    if (this.firstDayOfWeek >= 0 && this.firstDayOfWeek <= 6) {
      return this.firstDayOfWeek;
    }
    return getFirstDayOfWeek(this.locale);
  }

  private formatHeadline(d: Date | null): string {
    if (!d) return '';
    return new Intl.DateTimeFormat(this.loc, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  private formatField(d: Date | null): string {
    if (!d) return '';
    return formatDisplayDate(d, this.loc, this.dateSeparator || undefined);
  }

  private formatMonthYear(year: number, month: number): string {
    return new Intl.DateTimeFormat(this.loc, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month, 1));
  }

  private formatFullDate(d: Date): string {
    return new Intl.DateTimeFormat(this.loc, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }

  /** Locale-aware date format hint (e.g. `MM/DD/YYYY` or `DD.MM.YYYY`). */
  private dateFormatHint(): string {
    return dateFormatPattern(this.loc, this.dateSeparator || undefined);
  }

  // ---- state sync -------------------------------------------------------

  private syncViewToValue() {
    const anchor =
      parseIsoDate(this.value) ?? parseIsoDate(this.min) ?? new Date();
    this.viewYear = anchor.getFullYear();
    this.viewMonth = anchor.getMonth();
    this.focusedDate = clampDate(anchor, this.min, this.max);
  }

  private seedPending() {
    this.viewMode = 'calendar';
    this.pendingDate = parseIsoDate(this.value);
    this.seedFieldDraftFromValue();
    this.syncViewToValue();
  }

  private handleOpen() {
    this.restoreFocusEl =
      typeof document !== 'undefined'
        ? ((document.activeElement as HTMLElement) ?? null)
        : null;
    this.inputMode = this.variant === 'modal-input' ? false : this.inputMode;
    this.monthMenuOpen = false;
    this.yearMenuOpen = false;
    this.clearYearListRange();
    this.yearViewClosing = false;
    this.clearModalCalendarBloom();
    this.resetDockedPanelPosition();
    this.seedPending();
    this.lockScroll();
    this.mdOpen.emit();
    this.gridShouldFocus = true;
    if (this.isDocked) {
      this.bindDockedPositionListeners();
    }
  }

  private handleClose() {
    this.unlockScroll();
    this.unbindDockedPositionListeners();
    this.resetDockedPanelPosition();
    this.panelPointerEngaged = false;
    this.panelClosing = false;
    this.clearDockedCalendarBloom();
    this.clearModalCalendarBloom();
    this.yearViewClosing = false;
    this.monthMenuOpen = false;
    this.yearMenuOpen = false;
    this.selectionMenuClosing = null;
    this.clearYearListRange();
    this.mdClose.emit();
    const restore = this.restoreFocusEl ?? this.triggerEl ?? null;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => restore?.focus?.());
    } else {
      restore?.focus?.();
    }
  }

  /** Animated panel dismiss — bloom-out then unmount (docked + modal). */
  private async dismissPanel(): Promise<void> {
    if (!this.open || this.panelClosing) return;

    if (
      this.isDocked &&
      (this.monthMenuOpen || this.yearMenuOpen || this.selectionMenuClosing)
    ) {
      await this.closeDockedMenusAnimated(null, false);
    }

    if (this.prefersReducedMotion()) {
      this.closingFromDismiss = true;
      this.open = false;
      this.closingFromDismiss = false;
      return;
    }

    this.panelClosing = true;
    await this.delay(this.panelBloomOutMs());
    this.closingFromDismiss = true;
    this.open = false;
    this.panelClosing = false;
    this.closingFromDismiss = false;
  }

  private lockScroll() {
    if (this.isDocked) return;
    try {
      document.body.style.setProperty('overflow', 'hidden');
    } catch {
      /* SSR / no document */
    }
  }

  private unlockScroll() {
    try {
      document.body.style.removeProperty('overflow');
    } catch {
      /* noop */
    }
  }

  // ---- selection / commit ----------------------------------------------

  private isDisabledDate(d: Date): boolean {
    if (isOutOfRange(d, this.min, this.max)) return true;
    if (this.isDateDisabled && this.isDateDisabled(d)) return true;
    return false;
  }

  private isDisabledYear(year: number): boolean {
    const minDate = parseIsoDate(this.min);
    const maxDate = parseIsoDate(this.max);
    if (minDate && year < minDate.getFullYear()) return true;
    if (maxDate && year > maxDate.getFullYear()) return true;
    return false;
  }

  private lastSelectedEmitValue: string | null = null;

  private emitChange() {
    const date = parseIsoDate(this.value);
    this.mdChange.emit({ value: this.value, date });
  }

  private emitSelected(date: Date) {
    const value = toIsoDate(date);
    if (this.lastSelectedEmitValue === value) return;
    this.lastSelectedEmitValue = value;
    this.mdSelected.emit({ value, date });
    void Promise.resolve().then(() => {
      this.lastSelectedEmitValue = null;
    });
  }

  private emitViewChange(source: MdDatePickerViewChangeSource) {
    this.mdViewChange.emit({
      month: this.viewMonth,
      year: this.viewYear,
      source,
    });
  }

  private emitMenuOpen(type: 'month' | 'year') {
    this.mdMenuOpen.emit({ type });
  }

  private emitMenuSelect(type: 'month' | 'year', value: number, label?: string) {
    this.mdMenuSelect.emit({ type, value, label });
  }

  private emitModeChange(mode: MdDatePickerMode) {
    this.mdModeChange.emit({ mode });
  }

  private monthLabel(month: number): string {
    return new Intl.DateTimeFormat(this.loc, { month: 'long' }).format(
      new Date(2024, month, 1),
    );
  }

  private selectDay(cell: DayCell) {
    const d = cell.date;
    if (this.isDisabledDate(d)) return;
    this.closeMenus(null, false);
    this.focusedDate = d;
    if (cell.outOfMonth) {
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth();
    }
    // All variants — including docked — stage the selection and commit on OK
    // so the Cancel / OK action row is meaningful everywhere.
    this.pendingDate = d;
    this.emitSelected(d);
    // …unless the consumer opted out of the confirm step, in which case the
    // same click commits. mdSelected still fires first, so a listener that
    // treats it as "the user picked something" keeps working either way.
    if (this.commitOnSelect) this.commit();
  }

  private commit() {
    if (this.pendingDate) {
      this.value = toIsoDate(this.pendingDate);
      this.inputDraft = this.formatField(this.pendingDate);
      this.error = false;
      this.errorText = '';
    }
    this.emitChange();
    void this.dismissPanel();
  }

  private cancel() {
    this.mdCancel.emit();
    void this.dismissPanel();
  }

  private requestDismiss() {
    this.cancel();
  }

  // ---- text-entry handling ---------------------------------------------

  private onFieldInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    this.inputDraft = v;
    this.mdInput.emit({ value: v });
  };

  /** Read the live typed value from a trigger-field key target before commit. */
  private syncInputDraftFromField(target: EventTarget | null): void {
    const el = this.asEventElement(target);
    if (!el) return;
    const input = el.closest(
      'input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])',
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) {
      this.inputDraft = input.value;
      return;
    }
    const tf = el.closest('md-text-field') as (HTMLElement & { value?: string }) | null;
    if (tf) {
      this.inputDraft = tf.value ?? this.inputDraft;
    }
  }

  /**
   * Keep the md-text-field input in sync after commit while focus remains.
   * md-text-field skips display sync on external value updates during focus.
   */
  private syncTextFieldDisplay(): void {
    if (this.variant === 'modal') return;
    const tf = this.el.shadowRoot?.querySelector('md-text-field') as
      | (HTMLElement & { value?: string })
      | null;
    if (!tf) return;
    tf.value = this.inputDraft;
    const input = tf.shadowRoot?.querySelector('.md-text-field__input') as
      | HTMLInputElement
      | null;
    if (input) {
      input.value = this.inputDraft;
    }
  }

  /** Keep the modal typed-entry md-text-field in sync after parse/format. */
  private syncEntryTextFieldDisplay(): void {
    if (!this.entryTextFieldEl) return;
    const tf = this.entryTextFieldEl as HTMLElement & { value?: string };
    tf.value = this.inputDraft;
    const input = tf.shadowRoot?.querySelector('.md-text-field__input') as
      | HTMLInputElement
      | null;
    if (input) {
      input.value = this.inputDraft;
    }
  }

  private onFieldCommit = () => {
    const raw = this.inputDraft.trim();
    if (!raw) {
      this.value = '';
      this.inputDraft = '';
      this.error = false;
      this.errorText = '';
      this.emitChange();
      this.syncTextFieldDisplay();
      return;
    }
    const parsed = parseFlexibleDateInput(
      raw,
      this.locale,
      this.dateSeparator || undefined,
    );
    if (!parsed || this.isDisabledDate(parsed)) {
      this.error = true;
      this.errorText = this.errorText || (this.invalidDateLabel ?? 'Invalid date');
      return;
    }
    this.value = toIsoDate(parsed);
    this.inputDraft = this.formatField(parsed);
    this.error = false;
    this.errorText = '';
    this.syncViewToValue();
    this.emitChange();
    this.syncTextFieldDisplay();
  };

  private seedFieldDraftFromValue() {
    const selected = parseIsoDate(this.value);
    this.inputDraft = selected ? this.formatField(selected) : '';
  }

  private commitDialogInput() {
    const raw = this.inputDraft.trim();
    if (!raw) {
      this.error = false;
      this.errorText = '';
      this.pendingDate = null;
      return;
    }
    const parsed = parseFlexibleDateInput(
      raw,
      this.locale,
      this.dateSeparator || undefined,
    );
    if (!parsed || this.isDisabledDate(parsed)) {
      this.error = true;
      this.errorText = this.invalidDateLabel ?? 'Invalid date';
      return;
    }
    this.error = false;
    this.errorText = '';
    this.pendingDate = parsed;
    this.inputDraft = this.formatField(parsed);
    this.syncEntryTextFieldDisplay();
    this.viewYear = parsed.getFullYear();
    this.viewMonth = parsed.getMonth();
    this.focusedDate = parsed;
  }

  // ---- navigation -------------------------------------------------------

  private setGridSlideDirection(delta: number) {
    if (this.prefersReducedMotion()) return;
    if (
      this.monthMenuOpen ||
      this.yearMenuOpen ||
      this.selectionMenuClosing ||
      this.dockedCalendarBloom
    ) {
      return;
    }
    this.gridSlideDirection = delta > 0 ? 'forward' : 'backward';
  }

  private onGridSlideAnimationEnd = (e: AnimationEvent) => {
    if (e.target !== e.currentTarget) return;
    const name = e.animationName ?? '';
    if (!name.includes('md-date-picker-grid-slide')) return;
    this.gridSlideDirection = null;
  };

  private goToMonth(delta: number, fromUser = false) {
    this.setGridSlideDirection(delta);
    const ref = addMonths(new Date(this.viewYear, this.viewMonth, 1), delta);
    this.viewYear = ref.getFullYear();
    this.viewMonth = ref.getMonth();
    if (fromUser) {
      this.emitViewChange('chevron-month');
    }
  }

  private goToYear(delta: number, fromUser = false) {
    this.setGridSlideDirection(delta);
    this.viewYear += delta;
    if (
      this.yearMenuOpen ||
      this.selectionMenuClosing === 'year' ||
      this.viewMode === 'year' ||
      this.yearViewClosing
    ) {
      this.captureYearListRange();
    }
    if (fromUser) {
      this.emitViewChange('chevron-year');
    }
  }

  /** Accessible label for month/year nav chevrons (docked + modal). */
  private navActionLabel(scope: 'month' | 'year', side: 'prev' | 'next'): string {
    if (scope === 'month') {
      return side === 'prev'
        ? (this.previousMonthLabel ?? 'Previous month')
        : (this.nextMonthLabel ?? 'Next month');
    }
    return side === 'prev'
      ? (this.previousYearLabel ?? 'Previous year')
      : (this.nextYearLabel ?? 'Next year');
  }

  /** Keyboard shortcut hint matching the day-grid `onGridKeyDown` handlers. */
  private navShortcutKey(scope: 'month' | 'year', side: 'prev' | 'next'): string {
    if (scope === 'month') {
      return side === 'prev' ? 'Page Up' : 'Page Down';
    }
    return side === 'prev' ? 'Shift+Page Up' : 'Shift+Page Down';
  }

  /** Tooltip + `aria-description` text (via `md-tooltip`) for nav chevrons. */
  private navTooltipText(scope: 'month' | 'year', side: 'prev' | 'next'): string {
    return `${this.navActionLabel(scope, side)} (${this.navShortcutKey(scope, side)})`;
  }

  /** Keyboard shortcut for docked month/year menu buttons (day grid). */
  private menuShortcutKey(kind: 'month' | 'year'): string {
    return kind === 'month' ? 'Shift+M' : 'Shift+Y';
  }

  /** Tooltip + `aria-description` for docked month/year menu triggers. */
  private menuTooltipText(kind: 'month' | 'year'): string {
    if (kind === 'month') {
      const fullMonth = new Intl.DateTimeFormat(this.loc, { month: 'long' }).format(
        new Date(this.viewYear, this.viewMonth, 1),
      );
      return `${fullMonth} · ${this.chooseMonthLabel} (${this.menuShortcutKey(kind)})`;
    }
    return `${this.chooseYearLabel} (${this.menuShortcutKey(kind)})`;
  }

  /** Snapshot year-list bounds for the active year-selection surface. */
  private captureYearListRange() {
    const current = this.viewYear;
    this.yearListMinYear =
      parseIsoDate(this.min)?.getFullYear() ?? current - 100;
    this.yearListMaxYear =
      parseIsoDate(this.max)?.getFullYear() ?? current + 100;
  }

  private clearYearListRange() {
    this.yearListMinYear = null;
    this.yearListMaxYear = null;
  }

  private getYearListBounds(): { minYear: number; maxYear: number } {
    if (this.yearListMinYear != null && this.yearListMaxYear != null) {
      return { minYear: this.yearListMinYear, maxYear: this.yearListMaxYear };
    }
    const current = this.viewYear;
    return {
      minYear: parseIsoDate(this.min)?.getFullYear() ?? current - 100,
      maxYear: parseIsoDate(this.max)?.getFullYear() ?? current + 100,
    };
  }

  // ---- docked month / year dropdown menus -------------------------------

  private closeMenus(keep: 'month' | 'year' | null, restoreFocus: boolean) {
    if (this.isDocked) {
      void this.closeDockedMenusAnimated(keep, restoreFocus);
      return;
    }
    if (keep !== 'month' && this.monthMenuOpen) {
      this.monthMenuOpen = false;
      if (restoreFocus) this.restoreMenuFocus(this.monthMenuButtonEl);
    }
    if (keep !== 'year' && this.yearMenuOpen) {
      this.yearMenuOpen = false;
      this.clearYearListRange();
      if (restoreFocus) this.restoreMenuFocus(this.yearMenuButtonEl);
    }
  }

  /** Animated close for docked month/year menus (toggle, pick, Escape, day select). */
  private async closeDockedSelectionMenu(
    kind: 'month' | 'year',
    options: { bloomCalendar?: boolean; restoreFocus?: boolean } = {},
  ) {
    const { bloomCalendar = true, restoreFocus = true } = options;
    const isOpen = kind === 'month' ? this.monthMenuOpen : this.yearMenuOpen;
    if (!isOpen || this.selectionMenuClosing === kind) return;

    this.selectionMenuClosing = kind;
    await this.delay(this.selectionBloomOutMs());
    this.selectionMenuClosing = null;
    if (kind === 'month') {
      this.monthMenuOpen = false;
    } else {
      this.yearMenuOpen = false;
      this.clearYearListRange();
    }
    if (restoreFocus) {
      this.gridShouldFocus = false;
      this.menuRestoreFocus = kind;
    } else if (bloomCalendar && !this.monthMenuOpen && !this.yearMenuOpen) {
      this.gridShouldFocus = true;
    }
    if (bloomCalendar && !this.monthMenuOpen && !this.yearMenuOpen) {
      this.beginDockedCalendarBloom();
    } else if (this.isDocked && !this.monthMenuOpen && !this.yearMenuOpen) {
      this.positionDockedPanel();
    }
  }

  private async closeDockedMenusAnimated(
    keep: 'month' | 'year' | null,
    restoreFocus: boolean,
  ) {
    const bloomCalendar = keep === null;
    if (keep !== 'month' && this.monthMenuOpen) {
      await this.closeDockedSelectionMenu('month', { bloomCalendar, restoreFocus });
    }
    if (keep !== 'year' && this.yearMenuOpen) {
      await this.closeDockedSelectionMenu('year', { bloomCalendar, restoreFocus });
    }
  }

  private openDockedMonthMenu() {
    this.clearDockedCalendarBloom();
    this.selectionMenuClosing = null;
    this.menuRestoreFocus = null;
    this.yearMenuOpen = false;
    this.monthMenuOpen = true;
    this.menuShouldFocus = 'month';
    this.emitMenuOpen('month');
  }

  private openDockedYearMenu() {
    this.clearDockedCalendarBloom();
    this.selectionMenuClosing = null;
    this.menuRestoreFocus = null;
    this.monthMenuOpen = false;
    this.captureYearListRange();
    this.yearMenuOpen = true;
    this.menuShouldFocus = 'year';
    this.emitMenuOpen('year');
  }

  /** Menu stays visually expanded through bloom-out (`selectionMenuClosing`). */
  private isDockedMonthMenuExpanded(): boolean {
    return this.monthMenuOpen || this.selectionMenuClosing === 'month';
  }

  private isDockedYearMenuExpanded(): boolean {
    return this.yearMenuOpen || this.selectionMenuClosing === 'year';
  }

  /** Which docked selection menu to render (at most one; handles swap transitions). */
  private dockedSelectionMenuToShow(): 'month' | 'year' | null {
    if (this.monthMenuOpen && this.yearMenuOpen) {
      if (this.selectionMenuClosing === 'year') return 'month';
      if (this.selectionMenuClosing === 'month') return 'year';
      return 'year';
    }
    if (this.yearMenuOpen || this.selectionMenuClosing === 'year') return 'year';
    if (this.monthMenuOpen || this.selectionMenuClosing === 'month') return 'month';
    return null;
  }

  /**
   * Trailing caret on docked month/year menu buttons.
   * Collapsed: caret down; active (open or bloom-out): caret up (matches md-select).
   */
  private dockedMenuTrailingIcon(expanded: boolean): string {
    return expanded ? 'arrow_drop_up' : 'arrow_drop_down';
  }

  /** Crossfading trailing carets (down/up) on docked month/year menu triggers. */
  private renderDockedMenuTrailingCaret(expanded: boolean) {
    return (
      <span
        slot="trailing-icon"
        class="md-date-picker__menu-caret"
        part="menu-caret"
        aria-hidden="true"
      >
        <span
          class={{
            'md-date-picker__menu-caret-glyph': true,
            'material-symbols-outlined': true,
            'md-date-picker__menu-caret-glyph--down': true,
            'md-date-picker__menu-caret-glyph--visible': !expanded,
          }}
        >
          arrow_drop_down
        </span>
        <span
          class={{
            'md-date-picker__menu-caret-glyph': true,
            'material-symbols-outlined': true,
            'md-date-picker__menu-caret-glyph--up': true,
            'md-date-picker__menu-caret-glyph--visible': expanded,
          }}
        >
          arrow_drop_up
        </span>
      </span>
    );
  }

  private restoreMenuFocus(el?: HTMLElement) {
    if (!el) return;
    const run = () => el.focus();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }

  /**
   * Scroll container for inline-fill docked menus — the menu's
   * `.md-menu__scroll-shadow` scroll viewport when the menu is capped,
   * otherwise `.md-menu__surface`.
   */
  private getDockedSelectionMenuScrollEl(menuHost: HTMLElement): HTMLElement | null {
    const menuShadow = menuHost.shadowRoot;
    if (!menuShadow) return null;

    // Capped/inline-fill menus scroll inside a `.md-menu__scroll-shadow` viewport
    // div; plain (uncapped) menus scroll on the surface itself.
    return (
      (menuShadow.querySelector('.md-menu__scroll-shadow') as HTMLElement | null) ??
      (menuShadow.querySelector('.md-menu__surface') as HTMLElement | null)
    );
  }

  /**
   * Scroll the selected radio item into view inside the inline-fill menu scroll
   * viewport. Runs after the menu DOM is painted.
   */
  private getDockedSelectionMenuTarget(kind: 'month' | 'year'): HTMLElement | null {
    const part = kind === 'month' ? 'month-menu' : 'year-menu';
    const menu = this.panelEl?.querySelector<HTMLElement>(`[part="${part}"]`);
    if (!menu) return null;
    return (
      menu.querySelector<HTMLElement>('md-menu-item[selected]') ??
      menu.querySelector<HTMLElement>(`md-menu-item[part*="${kind}-option-selected"]`) ??
      menu.querySelector<HTMLElement>('md-menu-item')
    );
  }

  private scrollDockedSelectionMenuIntoView(kind: 'month' | 'year') {
    const part = kind === 'month' ? 'month-menu' : 'year-menu';
    const menuHost = this.panelEl?.querySelector<HTMLElement>(`[part="${part}"]`);
    if (!menuHost) return;

    const selected = this.getDockedSelectionMenuTarget(kind);
    if (!selected) return;

    const scrollEl = this.getDockedSelectionMenuScrollEl(menuHost);
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const itemRect = selected.getBoundingClientRect();
      const itemCenter = itemRect.top + itemRect.height / 2;
      const scrollCenter = scrollRect.top + scrollRect.height / 2;
      scrollEl.scrollTop += itemCenter - scrollCenter;
      return;
    }

    if (typeof selected.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  private afterDockedSelectionMenuPaint(kind: 'month' | 'year') {
    const run = () => {
      this.scrollDockedSelectionMenuIntoView(kind);
      this.getDockedSelectionMenuTarget(kind)?.focus();
    };

    // Defer scroll/focus until the expressive bloom finishes — immediate
    // scrollIntoView on the 201-item year list interrupts the animation.
    const delay = this.selectionBloomInMs();
    if (delay > 0) {
      void this.delay(delay).then(run);
      return;
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }

  /**
   * Approximate scrollTop to center `viewYear` — matches default `--_year-*` CSS tokens so
   * the active year is visible on first paint before layout measurement.
   */
  private calculateModalYearGridScrollTop(): number {
    const columns = 3;
    const blockSize = 36;
    const gap = 12;
    const paddingBlockStart = 8;
    const paddingBlockEnd = 16;
    const viewportBlockSize = 288;

    const { minYear, maxYear } = this.getYearListBounds();
    const yearCount = maxYear - minYear + 1;
    const index = Math.max(0, Math.min(this.viewYear - minYear, yearCount - 1));
    const row = Math.floor(index / columns);
    const rowCount = Math.ceil(yearCount / columns);
    const rowStride = blockSize + gap;
    const contentBlockSize =
      paddingBlockStart + rowCount * blockSize + Math.max(0, rowCount - 1) * gap + paddingBlockEnd;
    const itemBlockStart = paddingBlockStart + row * rowStride;
    const itemCenter = itemBlockStart + blockSize / 2;
    const target = itemCenter - viewportBlockSize / 2;
    const maxScroll = Math.max(0, contentBlockSize - viewportBlockSize);
    return Math.max(0, Math.min(target, maxScroll));
  }

  /**
   * Scroll container for the modal year grid — the plain
   * `.md-date-picker__year-grid-scroll` viewport.
   */
  private getModalYearGridScrollEl(): HTMLElement | null {
    const wrap = this.panelEl?.querySelector<HTMLElement>('[part="year-grid-wrap"]');
    if (!wrap) return null;

    return wrap.querySelector<HTMLElement>('.md-date-picker__year-grid-scroll') ?? null;
  }

  /** Scroll the selected year cell into the center of the modal year grid viewport. */
  private scrollModalYearGridIntoView() {
    const scrollEl = this.getModalYearGridScrollEl();
    if (!scrollEl) return;

    scrollEl.scrollTop = this.calculateModalYearGridScrollTop();

    const selected =
      scrollEl.querySelector<HTMLElement>(`[data-year="${this.viewYear}"]`) ??
      scrollEl.querySelector<HTMLElement>('[part~="year-selected"]');
    if (!selected) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const itemRect = selected.getBoundingClientRect();
    const itemCenter = itemRect.top + itemRect.height / 2;
    const scrollCenter = scrollRect.top + scrollRect.height / 2;
    scrollEl.scrollTop += itemCenter - scrollCenter;
  }

  private afterModalYearGridPaint() {
    const run = () => this.scrollModalYearGridIntoView();

    // Unlike docked menus, scrolling the inner overflow grid does not interrupt the
    // wrap bloom animation — deferring 450ms made the year list jump after open.
    this.scrollModalYearGridIntoView();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }

  private prefersReducedMotion(): boolean {
    // matchMedia is absent from Stencil's SSR mock, so optional-chain it (this
    // method is only reached post-render today, but harden to match the codebase).
    return (
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
    );
  }

  private selectionBloomInMs(): number {
    return this.prefersReducedMotion() ? 0 : DOCKED_SELECTION_BLOOM_IN_MS;
  }

  private selectionBloomOutMs(): number {
    return this.prefersReducedMotion() ? 0 : DOCKED_SELECTION_BLOOM_OUT_MS;
  }

  private calendarBloomInMs(): number {
    return this.prefersReducedMotion() ? 0 : DOCKED_CALENDAR_BLOOM_IN_MS;
  }

  private panelBloomOutMs(): number {
    return this.prefersReducedMotion() ? 0 : PANEL_BLOOM_OUT_MS;
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private beginDockedCalendarBloom() {
    if (this.prefersReducedMotion()) {
      this.dockedCalendarBloom = false;
      return;
    }
    this.dockedCalendarBloom = true;
    void this.delay(this.calendarBloomInMs()).then(() => {
      if (!this.monthMenuOpen && !this.yearMenuOpen && !this.selectionMenuClosing) {
        this.dockedCalendarBloom = false;
        this.positionDockedPanel();
      }
    });
  }

  private clearDockedCalendarBloom() {
    this.dockedCalendarBloom = false;
  }

  private beginModalCalendarBloom() {
    if (this.prefersReducedMotion() || this.isDocked) {
      this.modalCalendarBloom = false;
      return;
    }
    this.modalCalendarBloom = true;
    void this.delay(this.calendarBloomInMs()).then(() => {
      if (this.viewMode === 'calendar' && !this.yearViewClosing) {
        this.modalCalendarBloom = false;
      }
    });
  }

  private clearModalCalendarBloom() {
    this.modalCalendarBloom = false;
  }

  private async waitForSelectionMenuClose(kind: 'month' | 'year') {
    while (this.selectionMenuClosing === kind) {
      await this.delay(16);
    }
  }

  private toggleMonthMenu = () => {
    void this.toggleMonthMenuAsync();
  };

  private async toggleMonthMenuAsync() {
    if (this.monthMenuOpen) {
      await this.closeDockedSelectionMenu('month', { bloomCalendar: true, restoreFocus: true });
      return;
    }
    if (this.yearMenuOpen) {
      this.clearDockedCalendarBloom();
      this.selectionMenuClosing = null;
      this.menuRestoreFocus = null;
      this.monthMenuOpen = true;
      this.menuShouldFocus = 'month';
      this.emitMenuOpen('month');
      await this.closeDockedSelectionMenu('year', {
        bloomCalendar: false,
        restoreFocus: false,
      });
      return;
    }
    if (this.selectionMenuClosing === 'year') {
      await this.waitForSelectionMenuClose('year');
    }
    this.openDockedMonthMenu();
  }

  private toggleYearMenu = () => {
    void this.toggleYearMenuAsync();
  };

  private async toggleYearMenuAsync() {
    if (this.yearMenuOpen) {
      await this.closeDockedSelectionMenu('year', { bloomCalendar: true, restoreFocus: true });
      return;
    }
    if (this.monthMenuOpen) {
      this.captureYearListRange();
      this.clearDockedCalendarBloom();
      this.selectionMenuClosing = null;
      this.menuRestoreFocus = null;
      this.yearMenuOpen = true;
      this.menuShouldFocus = 'year';
      this.emitMenuOpen('year');
      await this.closeDockedSelectionMenu('month', {
        bloomCalendar: false,
        restoreFocus: false,
      });
      return;
    }
    if (this.selectionMenuClosing === 'month') {
      await this.waitForSelectionMenuClose('month');
    }
    this.openDockedYearMenu();
  }

  /**
   * Docked month/year menu: wait for the activated item's ripple to finish,
   * then apply the selection and return to the day grid.
   */
  private async pickDockedSelection(
    kind: 'month' | 'year',
    apply: () => void,
    item?: EventTarget | null,
  ) {
    const host = item instanceof HTMLElement ? item : null;
    if (host) {
      await waitForHostRipple(host);
    }
    apply();
    await this.closeDockedSelectionMenu(kind, { bloomCalendar: true, restoreFocus: false });
  }

  private pickMonth(month: number, item?: EventTarget | null) {
    void this.pickDockedSelection('month', () => {
      this.viewMonth = month;
      this.emitMenuSelect('month', month, this.monthLabel(month));
      this.emitViewChange('month-menu');
    }, item);
  }

  private pickYear(year: number, item?: EventTarget | null) {
    void this.pickDockedSelection('year', () => {
      this.viewYear = year;
      this.emitMenuSelect('year', year, String(year));
      this.emitViewChange('year-menu');
    }, item);
  }

  private onMonthMenuClose = () => {
    if (!this.monthMenuOpen) return;
    void this.closeDockedSelectionMenu('month', { bloomCalendar: true, restoreFocus: true });
  };

  private onYearMenuClose = () => {
    if (!this.yearMenuOpen) return;
    void this.closeDockedSelectionMenu('year', { bloomCalendar: true, restoreFocus: true });
  };

  private selectYear(year: number) {
    if (this.isDisabledYear(year)) return;
    this.viewYear = year;
    this.focusedDate = new Date(year, this.viewMonth, 1);
    this.emitMenuSelect('year', year, String(year));
    this.emitViewChange('year-menu');
    void this.closeYearViewAnimated();
  }

  private openYearView() {
    this.clearModalCalendarBloom();
    this.yearViewClosing = false;
    this.viewMode = 'year';
    this.captureYearListRange();
    this.yearGridShouldScroll = true;
    this.emitMenuOpen('year');
  }

  /** Animated close for modal / range year grid (toggle, pick). */
  private async closeYearViewAnimated() {
    if (this.viewMode !== 'year' || this.yearViewClosing) return;

    if (this.prefersReducedMotion()) {
      this.viewMode = 'calendar';
      this.clearYearListRange();
      return;
    }

    this.yearViewClosing = true;
    await this.delay(this.selectionBloomOutMs());
    this.yearViewClosing = false;
    this.viewMode = 'calendar';
    this.clearYearListRange();
    this.beginModalCalendarBloom();
  }

  private toggleYearView = () => {
    if (this.viewMode === 'year') {
      void this.closeYearViewAnimated();
    } else {
      this.openYearView();
    }
  };

  private toggleInputMode = () => {
    if (this.inputMode) {
      this.commitDialogInput();
      if (this.error) return;
    } else {
      // entering input mode: seed draft from pending selection
      this.inputDraft = this.pendingDate ? this.formatField(this.pendingDate) : '';
    }
    this.inputMode = !this.inputMode;
    this.viewMode = 'calendar';
    this.emitModeChange(this.inputMode ? 'input' : 'calendar');
    if (this.inputMode) {
      this.entryInputShouldFocus = true;
    }
  };

  /** Normalize navigation keys — some Mac / IME layouts report Page Up/Down via `code`. */
  private resolveNavigationKey(e: KeyboardEvent): string {
    if (e.key === 'PageUp' || e.code === 'PageUp') return 'PageUp';
    if (e.key === 'PageDown' || e.code === 'PageDown') return 'PageDown';
    // Mac compact keyboards: Option/Alt+↑/↓ is a common Page Up/Down fallback.
    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === 'ArrowUp' || e.code === 'ArrowUp') return 'PageUp';
      if (e.key === 'ArrowDown' || e.code === 'ArrowDown') return 'PageDown';
    }
    return e.key;
  }

  private asEventElement(target: EventTarget | null): Element | null {
    if (target == null || typeof target !== 'object') return null;
    if (!('closest' in target) || typeof (target as Element).closest !== 'function') {
      return null;
    }
    return target as Element;
  }

  private isEditableKeyTarget(target: EventTarget | null): boolean {
    const el = this.asEventElement(target);
    if (!el) return false;
    const editable = el.closest(
      'input:not([readonly]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]',
    );
    return !!editable;
  }

  private isInsideSelectionMenu(target: EventTarget | null): boolean {
    return (
      !!this.findInPickerTree(target, '[part="month-menu"]') ||
      !!this.findInPickerTree(target, '[part="year-menu"]')
    );
  }

  /** Walk up through shadow boundaries to find a matching ancestor. */
  private findInPickerTree(target: EventTarget | null, selector: string): Element | null {
    const el = this.asEventElement(target);
    if (!el) return null;
    let current: Element | null = el;
    while (current) {
      try {
        if (current.matches(selector)) return current;
      } catch {
        /* invalid selector */
      }
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        current = current.parentElement;
      }
    }
    return null;
  }

  /** True when keyboard target/focus is on a day cell in the calendar grid. */
  private isDayGridKeyTarget(target: EventTarget | null): boolean {
    if (this.findInPickerTree(target, '[data-date]')) return true;
    if (typeof document !== 'undefined') {
      return !!this.findInPickerTree(document.activeElement, '[data-date]');
    }
    return false;
  }

  private isDockedMenuToggleKey(e: KeyboardEvent): boolean {
    if (!this.isDocked || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return false;
    const letter = e.key.toLowerCase();
    return letter === 'm' || letter === 'y';
  }

  private isCalendarNavigationKey(e: KeyboardEvent): boolean {
    const key = this.resolveNavigationKey(e);
    if (
      key === 'ArrowRight' ||
      key === 'ArrowLeft' ||
      key === 'ArrowDown' ||
      key === 'ArrowUp' ||
      key === 'Home' ||
      key === 'End' ||
      key === 'PageUp' ||
      key === 'PageDown' ||
      key === 'Enter' ||
      key === ' '
    ) {
      return true;
    }
    return this.isDockedMenuToggleKey(e);
  }

  private canHandleCalendarKeyDown(e: KeyboardEvent, target?: EventTarget | null): boolean {
    if (!this.open || e.defaultPrevented) return false;
    if (this.viewMode !== 'calendar' || this.inputMode) return false;
    const menuToggle = this.isDockedMenuToggleKey(e);
    if (!menuToggle && (this.monthMenuOpen || this.yearMenuOpen || this.selectionMenuClosing)) {
      return false;
    }
    if (!this.isCalendarNavigationKey(e)) return false;

    const t = target ?? e.target;
    if (this.isEditableKeyTarget(t)) {
      // Route navigation shortcuts from the trigger field while the panel is open
      // so users need not Tab into the day grid first (docked / modal-input).
      if (!(this.hasField && this.isTriggerFieldTarget(t))) return false;
      // Enter commits typed text — the field's own handler formats on Enter.
      if (this.resolveNavigationKey(e) === 'Enter') return false;
    }
    if (!menuToggle && this.isInsideSelectionMenu(t)) return false;

    const key = this.resolveNavigationKey(e);
    if (key === 'Enter' || key === ' ') {
      if (!this.isDayGridKeyTarget(t) && !this.isDayGridKeyTarget(e.target)) {
        return false;
      }
    }

    return true;
  }

  /** Event path (composed), with a parent-walk fallback for older test environments. */
  private getEventPathNodes(e: Event): EventTarget[] {
    if (typeof e.composedPath === 'function') {
      return e.composedPath();
    }
    const nodes: EventTarget[] = [];
    let node: Node | null = e.target as Node | null;
    while (node) {
      nodes.push(node);
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        node = root.host;
      } else {
        node = node.parentNode;
      }
    }
    return nodes;
  }

  /** True when `node` is this picker or any nested shadow descendant. */
  private isNodeInPicker(node: EventTarget | null): boolean {
    if (node == null || typeof node !== 'object' || !('nodeType' in node)) return false;
    let current: Node | null = node as Node;
    while (current) {
      if (current === this.el || current === this.panelEl) return true;
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        current = current.parentNode;
      }
    }
    return false;
  }

  /** Keyboard event originated inside this picker (crosses shadow boundaries). */
  private isEventInPicker(e: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (this.getEventPathNodes(e).includes(this.el)) return true;
    if (typeof document !== 'undefined') {
      if (this.isNodeInPicker(document.activeElement)) return true;
      if (this.panelPointerEngaged) return true;
    }
    return false;
  }

  /** Input inside the trigger field (outside the calendar panel). */
  private isTriggerFieldTarget(target: EventTarget | null): boolean {
    return this.isNodeInPicker(target) && !this.isNodeInPanel(target);
  }

  /** Prefer focused panel control, then event target, then the open panel. */
  private resolveCalendarKeyTarget(e: KeyboardEvent): EventTarget | null {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active && this.isNodeInPanel(active)) return active;
    }
    if (e.target && this.isNodeInPicker(e.target)) return e.target;
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active && this.isNodeInPicker(active)) return active;
    }
    return this.panelEl ?? null;
  }

  /**
   * Non-interactive panel chrome (grid background, weekday row, padding) does not
   * receive focus on click — route subsequent keys via panelPointerEngaged.
   */
  private shouldPanelClaimFocus(target: EventTarget | null): boolean {
    const el = this.asEventElement(target);
    if (!el) return true;
    if (
      el.closest(
        'button, [role="button"], input, textarea, [contenteditable="true"], md-menu-item, a[href]',
      )
    ) {
      return false;
    }
    return true;
  }

  private onPanelMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !this.open || !this.panelEl) return;
    if (!this.shouldPanelClaimFocus(e.target)) return;
    this.panelPointerEngaged = true;
    if (
      this.viewMode === 'calendar' &&
      !this.inputMode &&
      !this.monthMenuOpen &&
      !this.yearMenuOpen
    ) {
      this.gridShouldFocus = true;
    }
  };

  /** True when `node` is inside the open calendar panel (crosses shadow boundaries). */
  private isNodeInPanel(node: EventTarget | null): boolean {
    if (!this.panelEl || node == null || typeof node !== 'object' || !('nodeType' in node)) {
      return false;
    }
    let current: Node | null = node as Node;
    while (current) {
      if (current === this.panelEl) return true;
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        current = current.parentNode;
      }
    }
    return false;
  }

  private handleDayKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    this.handleCalendarKeyDown(e);
  };

  private handleCalendarKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;

    if (this.isDockedMenuToggleKey(e)) {
      const key = e.key.toLowerCase();
      if (key === 'm') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.toggleMonthMenu();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.toggleYearMenu();
        return;
      }
    }

    let next: Date | null = null;
    switch (this.resolveNavigationKey(e)) {
      case 'ArrowRight':
        next = addDays(this.focusedDate, 1);
        break;
      case 'ArrowLeft':
        next = addDays(this.focusedDate, -1);
        break;
      case 'ArrowDown':
        next = addDays(this.focusedDate, 7);
        break;
      case 'ArrowUp':
        next = addDays(this.focusedDate, -7);
        break;
      case 'Home':
        next = new Date(
          this.focusedDate.getFullYear(),
          this.focusedDate.getMonth(),
          1,
        );
        break;
      case 'End':
        next = new Date(
          this.focusedDate.getFullYear(),
          this.focusedDate.getMonth(),
          daysInMonth(this.focusedDate.getFullYear(), this.focusedDate.getMonth()),
        );
        break;
      case 'PageUp':
        next = addMonths(this.focusedDate, e.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(this.focusedDate, e.shiftKey ? 12 : 1);
        break;
      case 'Enter': {
        if (!this.isDayGridKeyTarget(e.target)) return;
        e.preventDefault();
        if (this.isDisabledDate(this.focusedDate)) return;
        this.selectDay({ date: this.focusedDate, outOfMonth: false });
        this.commit();
        return;
      }
      case ' ': {
        if (!this.isDayGridKeyTarget(e.target)) return;
        e.preventDefault();
        this.selectDay({ date: this.focusedDate, outOfMonth: false });
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    const prevViewYear = this.viewYear;
    const prevViewMonth = this.viewMonth;
    this.focusedDate = clampDate(next, this.min, this.max);
    const navKey = this.resolveNavigationKey(e);
    if (
      (navKey === 'PageUp' || navKey === 'PageDown') &&
      (this.focusedDate.getFullYear() !== prevViewYear ||
        this.focusedDate.getMonth() !== prevViewMonth)
    ) {
      this.setGridSlideDirection(navKey === 'PageDown' ? 1 : -1);
    }
    this.viewYear = this.focusedDate.getFullYear();
    this.viewMonth = this.focusedDate.getMonth();
    this.gridShouldFocus = true;
  };

  /**
   * Enter in the trigger text field parses and formats typed input.
   * Handled at host capture so shadow-DOM inputs (docked md-text-field) are covered.
   */
  private tryCommitTriggerFieldOnEnter(e: KeyboardEvent): boolean {
    if (this.disabled || !this.hasField || e.key !== 'Enter') return false;
    const target = e.target;
    if (!target || !this.isNodeInPicker(target)) return false;
    if (!this.isEditableKeyTarget(target) || !this.isTriggerFieldTarget(target)) return false;

    e.preventDefault();
    e.stopPropagation();
    this.syncInputDraftFromField(target);
    this.onFieldCommit();
    return true;
  }

  /**
   * Enter in the modal typed-entry field parses, formats, and commits the selection
   * (same end result as OK). Handled at host capture so md-text-field shadow inputs
   * are covered.
   */
  private tryCommitDialogInputOnEnter(e: KeyboardEvent): boolean {
    if (this.disabled || !this.inputMode || e.key !== 'Enter') return false;
    const target = e.target;
    if (!target || !this.isEditableKeyTarget(target)) return false;
    const el = this.asEventElement(target);
    if (!el?.closest('[part="entry-input"]')) return false;

    e.preventDefault();
    e.stopPropagation();
    this.syncInputDraftFromField(target);
    this.commitDialogInput();
    if (this.error) return true;
    this.commit();
    return true;
  }

  private routePickerKeyDown(e: KeyboardEvent, fromHostCapture = false): void {
    if (e.defaultPrevented || this.panelClosing) return;

    if (this.tryCommitDialogInputOnEnter(e)) return;
    if (this.tryCommitTriggerFieldOnEnter(e)) return;

    if (!this.open) return;
    if (!fromHostCapture && !this.isEventInPicker(e)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.isDocked && (this.monthMenuOpen || this.yearMenuOpen)) {
        this.closeMenus(null, true);
        return;
      }
      this.requestDismiss();
      return;
    }

    if (this.canHandleCalendarKeyDown(e, this.resolveCalendarKeyTarget(e))) {
      this.handleCalendarKeyDown(e);
    }
  }

  @Listen('keydown', { target: 'document', capture: true })
  handleDocumentKeyDown(e: KeyboardEvent) {
    this.routePickerKeyDown(e);
  }

  /**
   * A docked panel has no scrim, so the click that lands outside it arrives here
   * instead. `pointerdown` rather than `click` so the dismiss happens before the
   * pressed element can move or unmount under the pointer.
   *
   * The trigger field is inside the host, so its own click keeps toggling the
   * panel — this only fires for genuinely outside targets.
   */
  @Listen('pointerdown', { target: 'document', capture: true })
  handleDocumentPointerDown(e: Event) {
    if (!this.open || this.panelClosing) return;
    if (!this.isDocked || !this.outsideClickDismissible) return;
    if (this.getEventPathNodes(e).includes(this.el)) return;
    if (this.isNodeInPicker(e.target)) return;
    this.requestDismiss();
  }

  /** Capture keys from nested trigger fields (md-text-field shadow) and child components. */
  @Listen('keydown', { capture: true })
  handleHostKeyDown(e: KeyboardEvent) {
    this.routePickerKeyDown(e, true);
  }

  /**
   * Nested overlays (md-tooltip, md-menu) also emit `mdOpen` / `mdClose`.
   * Swallow those at the picker host so controlled consumers only react to this
   * component's own open/close lifecycle (see `handleOpen` / `handleClose`).
   */
  @Listen('mdOpen')
  swallowNestedMdOpen(e: Event) {
    if ((e.composedPath?.()[0] ?? e.target) !== this.el) {
      e.stopImmediatePropagation();
    }
  }

  @Listen('mdClose')
  swallowNestedMdClose(e: Event) {
    if ((e.composedPath?.()[0] ?? e.target) !== this.el) {
      e.stopImmediatePropagation();
    }
  }

  private onPanelKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.isDocked && (this.monthMenuOpen || this.yearMenuOpen)) {
        this.closeMenus(null, true);
        return;
      }
      this.requestDismiss();
      return;
    }
    if (this.canHandleCalendarKeyDown(e, this.resolveCalendarKeyTarget(e))) {
      this.handleCalendarKeyDown(e);
      return;
    }
    if (e.key === 'Tab' && !this.isDocked) {
      this.trapTab(e);
    }
  };

  /** Move roving tabindex to the focused day after open / keyboard navigation. */
  private focusFocusedDay() {
    const iso = toIsoDate(this.focusedDate);
    const btn = this.panelEl?.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    if (!btn) return;
    const run = () => btn.focus();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      run();
    }
  }

  private trapTab(e: KeyboardEvent) {
    const panel = this.panelEl;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = (this.el.shadowRoot?.activeElement ?? null) as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  componentDidRender() {
    if (
      this.isDocked &&
      this.open &&
      !this.panelClosing &&
      !this.selectionMenuClosing &&
      !this.dockedCalendarBloom
    ) {
      this.positionDockedPanel();
    }
    if (this.menuShouldFocus) {
      const kind = this.menuShouldFocus;
      this.menuShouldFocus = null;
      this.afterDockedSelectionMenuPaint(kind);
      return;
    }
    if (this.yearGridShouldScroll) {
      this.yearGridShouldScroll = false;
      this.afterModalYearGridPaint();
      return;
    }
    if (this.menuRestoreFocus) {
      const kind = this.menuRestoreFocus;
      this.menuRestoreFocus = null;
      const el = kind === 'month' ? this.monthMenuButtonEl : this.yearMenuButtonEl;
      this.restoreMenuFocus(el);
      return;
    }
    if (this.entryInputShouldFocus && this.inputMode) {
      this.entryInputShouldFocus = false;
      const input = this.entryTextFieldEl?.shadowRoot?.querySelector(
        '.md-text-field__input',
      );
      if (input instanceof HTMLElement) {
        input.focus();
      }
      return;
    }
    if (
      this.open &&
      this.gridShouldFocus &&
      this.viewMode === 'calendar' &&
      !this.inputMode &&
      !this.monthMenuOpen &&
      !this.yearMenuOpen
    ) {
      this.focusFocusedDay();
      this.gridShouldFocus = false;
    }
  }

  // ---- render helpers ---------------------------------------------------

  /**
   * Shared trigger for `docked` and `modal-input` — `md-text-field` (outlined)
   * with a trailing `md-icon-button` calendar toggle instead of hand-rolled field
   * markup so both variants inherit design-system field anatomy and icon handling.
   */
  private textFieldKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    // Host capture (`tryCommitTriggerFieldOnEnter`) handles Enter from shadow inputs.
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    this.syncInputDraftFromField(e.target);
    this.onFieldCommit();
  };

  private entryTextFieldKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !this.inputMode) return;
    // Host capture (`tryCommitDialogInputOnEnter`) handles Enter from shadow inputs.
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    this.syncInputDraftFromField(e.target);
    this.commitDialogInput();
    if (this.error) return;
    this.commit();
  };

  private renderTextFieldTrigger() {
        const selected = parseIsoDate(this.value);
    const display = this.focused ? this.inputDraft : this.formatField(selected);
    const supporting =
      this.error && this.errorText ? '' : this.supportingText || this.dateFormatHint();
    return (
      <md-text-field
        class="md-date-picker__textfield"
        part="field"
        variant={this.fieldVariant}
        label={this.label}
        value={display}
        supportingText={supporting}
        error={this.error}
        errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
        disabled={this.disabled}
        required={this.required}
        appearFocused={this.open}
        onFocusin={() => {
          this.focused = true;
          if (!this.error) this.seedFieldDraftFromValue();
        }}
        onFocusout={() => {
          this.focused = false;
        }}
        onKeyDown={this.textFieldKeyDown}
        onMdInput={(e: CustomEvent<string>) => {
          this.inputDraft = e.detail;
          this.mdInput.emit({ value: e.detail });
        }}
        onMdChange={(e: CustomEvent<string>) => {
          this.inputDraft = e.detail;
          this.onFieldCommit();
        }}
      >
        {this.hasSlottedLeading && <slot name="leading-icon" slot="leading-icon" />}
        {this.clearable && !!this.value && !this.disabled && (
          <md-icon-button
            slot="trailing-icon"
            class="md-date-picker__clear-button"
            part="clear-button"
            variant="standard"
            icon="close"
            aria-label={this.clearLabel}
            // Native click so stopPropagation prevents the field toggle from
            // also firing and opening the calendar.
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              void this.clear();
            }}
          ></md-icon-button>
        )}
        <md-icon-button
          slot="trailing-icon"
          class="md-date-picker__calendar-button"
          part="calendar-button"
          variant={this.triggerExpanded ? 'tonal' : 'standard'}
          icon={this.hasSlottedCalendarIcon ? '' : this.calendarIcon}
          aria-label={
            this.triggerExpanded ? this.closeCalendarLabel : this.openCalendarLabel
          }
          aria-haspopup="dialog"
          aria-expanded={this.triggerExpanded ? 'true' : 'false'}
          disabled={this.disabled}
          ref={(el) => (this.triggerEl = el as HTMLElement)}
          onMdClick={() => (this.open ? this.close() : this.show())}
        >
          {this.hasSlottedCalendarIcon && (
            <slot name="calendar-icon" slot="" />
          )}
        </md-icon-button>
      </md-text-field>
    );
  }

  /** Prev/next chevron for modal month nav (md-icon-button + tooltip). */
  private renderModalNavChevron(side: 'prev' | 'next', onStep: () => void) {
    return (
      <md-tooltip
        class="md-date-picker__nav-chevron-tooltip"
        text={this.navTooltipText('month', side)}
        showDelay={0}
        position="bottom"
        offset={DOCKED_NAV_CHEVRON_TOOLTIP_OFFSET}
      >
        <md-icon-button
          class="md-date-picker__directional-icon md-date-picker__nav-chevron"
          part={side === 'prev' ? 'prev-button' : 'next-button'}
          size="sm"
          icon={side === 'prev' ? 'chevron_left' : 'chevron_right'}
          aria-label={this.navActionLabel('month', side)}
          onClick={onStep}
        ></md-icon-button>
      </md-tooltip>
    );
  }

  private modalMonthYearTooltipText(year: number, month: number): string {
    return `${this.formatMonthYear(year, month)} · ${this.chooseMonthAndYearLabel}`;
  }

  private renderNav(secondary = false) {
        const navYear = secondary
      ? addMonths(new Date(this.viewYear, this.viewMonth, 1), 1).getFullYear()
      : this.viewYear;
    const navMonth = secondary
      ? addMonths(new Date(this.viewYear, this.viewMonth, 1), 1).getMonth()
      : this.viewMonth;
    const yearExpanded =
      !secondary && (this.viewMode === 'year' || this.yearViewClosing);
    const monthYearButton = (
      <md-button
        class={{
          'md-date-picker__menu-button': true,
          'md-date-picker__menu-button--expanded': yearExpanded,
        }}
        part="month-toggle"
        variant="text"
        size="sm"
        toggle
        selected={yearExpanded}
        trailingIcon={secondary ? undefined : this.dockedMenuTrailingIcon(yearExpanded)}
        suppressExpandIconFlip
        mirrorIcon={yearExpanded}
        aria-label={this.chooseMonthYearLabel}
        aria-expanded={yearExpanded ? 'true' : 'false'}
        disabled={secondary}
        onMdClick={(e) => {
          e.preventDefault();
          if (!secondary) this.toggleYearView();
        }}
      >
        {this.formatMonthYear(navYear, navMonth)}
        {!secondary && this.renderDockedMenuTrailingCaret(yearExpanded)}
      </md-button>
    );
    return (
      <div class="md-date-picker__nav" part="nav">
        {secondary ? (
          monthYearButton
        ) : (
          <md-tooltip
            class="md-date-picker__menu-button-tooltip"
            text={this.modalMonthYearTooltipText(navYear, navMonth)}
            showDelay={0}
            position="bottom"
            offset={DOCKED_NAV_MENU_TOOLTIP_OFFSET}
          >
            {monthYearButton}
          </md-tooltip>
        )}
        {this.viewMode === 'calendar' && (
          <div class="md-date-picker__nav-buttons">
            {this.renderModalNavChevron('prev', () => this.goToMonth(-1, true))}
            {this.renderModalNavChevron('next', () => this.goToMonth(1, true))}
          </div>
        )}
      </div>
    );
  }

  /**
   * Prev/next chevron for docked month/year nav. Inactive scope (other menu open)
   * renders a same-size spacer so menu triggers do not shift when buttons are absent.
   */
  private renderDockedNavChevron(
    side: 'prev' | 'next',
    scope: 'month' | 'year',
    visible: boolean,
    onStep: () => void,
  ) {
    return (
      <span class="md-date-picker__nav-chevron-slot" part={`${side}-${scope}-chevron-slot`}>
        <md-tooltip
          class={{
            'md-date-picker__nav-chevron-tooltip': true,
            'md-date-picker__nav-chevron--visible': visible,
          }}
          text={this.navTooltipText(scope, side)}
          showDelay={0}
          position="bottom"
          offset={DOCKED_NAV_CHEVRON_TOOLTIP_OFFSET}
        >
          <md-icon-button
            class="md-date-picker__directional-icon md-date-picker__nav-chevron"
            part={`${side}-${scope}-button`}
            size="sm"
            icon={side === 'prev' ? 'chevron_left' : 'chevron_right'}
            aria-label={this.navActionLabel(scope, side)}
            disabled={!visible}
            onClick={visible ? onStep : undefined}
          ></md-icon-button>
        </md-tooltip>
        <span
          class={{
            'md-date-picker__nav-chevron-spacer': true,
            'md-date-picker__nav-chevron--visible': !visible,
          }}
          part={`${side}-${scope}-chevron-spacer`}
          aria-hidden="true"
        ></span>
      </span>
    );
  }

  private renderDockedNav() {
        const monthShort = new Intl.DateTimeFormat(this.loc, { month: 'short' }).format(
      new Date(this.viewYear, this.viewMonth, 1),
    );
    const monthExpanded = this.isDockedMonthMenuExpanded();
    const yearExpanded = this.isDockedYearMenuExpanded();
    return (
      <div class="md-date-picker__docked-nav" part="nav">
        <div
          class={{
            'md-date-picker__nav-group': true,
            'md-date-picker__nav-group--month': true,
            'md-date-picker__nav-group--selection-open': monthExpanded,
          }}
        >
          {this.renderDockedNavChevron('prev', 'month', !yearExpanded, () => this.goToMonth(-1, true))}
          <md-tooltip
            class="md-date-picker__menu-button-tooltip"
            text={this.menuTooltipText('month')}
            showDelay={0}
            position="bottom"
            offset={DOCKED_NAV_MENU_TOOLTIP_OFFSET}
          >
            <md-button
              class={{
                'md-date-picker__menu-button': true,
                'md-date-picker__menu-button--expanded': monthExpanded,
              }}
              part="month-menu-button"
              variant="text"
              size="sm"
              toggle
              selected={monthExpanded}
              trailingIcon={this.dockedMenuTrailingIcon(monthExpanded)}
              suppressExpandIconFlip
              mirrorIcon={monthExpanded}
              aria-label={this.chooseMonthLabel}
              aria-haspopup="menu"
              aria-expanded={monthExpanded ? 'true' : 'false'}
              ref={(el) => (this.monthMenuButtonEl = el as HTMLElement)}
              onMdClick={(e) => {
                e.preventDefault();
                this.toggleMonthMenu();
              }}
            >
              {monthShort}
              {this.renderDockedMenuTrailingCaret(monthExpanded)}
            </md-button>
          </md-tooltip>
          {this.renderDockedNavChevron('next', 'month', !yearExpanded, () => this.goToMonth(1, true))}
        </div>
        <div
          class={{
            'md-date-picker__nav-group': true,
            'md-date-picker__nav-group--year': true,
            'md-date-picker__nav-group--selection-open': yearExpanded,
          }}
        >
          {this.renderDockedNavChevron('prev', 'year', !monthExpanded, () => this.goToYear(-1, true))}
          <md-tooltip
            class="md-date-picker__menu-button-tooltip"
            text={this.menuTooltipText('year')}
            showDelay={0}
            position="bottom"
            offset={DOCKED_NAV_MENU_TOOLTIP_OFFSET}
          >
            <md-button
              class={{
                'md-date-picker__menu-button': true,
                'md-date-picker__menu-button--expanded': yearExpanded,
              }}
              part="year-menu-button"
              variant="text"
              size="sm"
              toggle
              selected={yearExpanded}
              trailingIcon={this.dockedMenuTrailingIcon(yearExpanded)}
              suppressExpandIconFlip
              mirrorIcon={yearExpanded}
              aria-label={this.chooseYearLabel}
              aria-haspopup="menu"
              aria-expanded={yearExpanded ? 'true' : 'false'}
              ref={(el) => (this.yearMenuButtonEl = el as HTMLElement)}
              onMdClick={(e) => {
                e.preventDefault();
                this.toggleYearMenu();
              }}
            >
              {this.viewYear}
              {this.renderDockedMenuTrailingCaret(yearExpanded)}
            </md-button>
          </md-tooltip>
          {this.renderDockedNavChevron('next', 'year', !monthExpanded, () => this.goToYear(1, true))}
        </div>
      </div>
    );
  }

  /** Full-width divider between docked nav and month/year selection list. */
  private renderDockedSelectionDivider() {
    return (
      <div
        class="md-date-picker__selection-divider"
        part="selection-divider"
        role="separator"
        aria-hidden="true"
      />
    );
  }

  /**
   * Inline baseline `md-menu` with leading radio checks — replaces the day grid
   * while month selection is active in the docked panel body.
   */
  private renderDockedMonthMenu(closing: boolean) {
    const months = Array.from({ length: 12 }, (_, m) =>
      new Intl.DateTimeFormat(this.loc, { month: 'long' }).format(new Date(2024, m, 1)),
    );
    return (
      <div
        class={{
          'md-date-picker__selection-menu-wrap': true,
          'md-date-picker__selection-menu-wrap--bloom-out': closing,
        }}
        part="month-menu-wrap"
      >
        <md-menu
          class="md-date-picker__selection-menu md-menu--inline-fill"
          part="month-menu"
          exportparts="menu-viewport:month-menu-viewport"
          variant="baseline"
          open
          quick
          persistent
          autoFocus={false}
          onMdClose={this.onMonthMenuClose}
        >
          {months.map((name, m) => {
            const sel = m === this.viewMonth;
            return (
              <md-menu-item
                part={sel ? 'month-option month-option-selected' : 'month-option'}
                headline={name}
                type="radio"
                check-position="start"
                keep-open
                selected={sel}
                onMdClick={(e) => this.pickMonth(m, e.target)}
              ></md-menu-item>
            );
          })}
        </md-menu>
      </div>
    );
  }

  /**
   * Inline baseline `md-menu` with leading radio checks — replaces the day grid
   * while year selection is active in the docked panel body.
   */
  private renderDockedYearMenu(closing: boolean) {
    const current = this.viewYear;
    const { minYear, maxYear } = this.getYearListBounds();
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return (
      <div
        class={{
          'md-date-picker__selection-menu-wrap': true,
          'md-date-picker__selection-menu-wrap--year': true,
          'md-date-picker__selection-menu-wrap--bloom-out': closing,
        }}
        part="year-menu-wrap"
      >
        <md-menu
          class="md-date-picker__selection-menu md-menu--inline-fill"
          part="year-menu"
          exportparts="menu-viewport:year-menu-viewport"
          variant="baseline"
          open
          quick
          persistent
          autoFocus={false}
          onMdClose={this.onYearMenuClose}
        >
          {years.map((y) => {
            const sel = y === current;
            return (
              <md-menu-item
                part={sel ? 'year-option year-option-selected' : 'year-option'}
                headline={String(y)}
                type="radio"
                check-position="start"
                keep-open
                selected={sel}
                onMdClick={(e) => this.pickYear(y, e.target)}
              ></md-menu-item>
            );
          })}
        </md-menu>
      </div>
    );
  }

  private renderCalendar(
    year: number,
    month: number,
    primary = true,
    contentBloom = false,
  ) {
    const firstDay = this.resolvedFirstDay();
    const names = weekdayNames(this.locale, firstDay, 'narrow');
    const fullNames = weekdayNames(this.locale, firstDay, 'long');
    const cells = buildMonthMatrix(year, month, firstDay);
    const today = new Date();
    const gridLabel = this.formatMonthYear(year, month);
    return (
      <div
        class={{
          'md-date-picker__calendar': true,
          'md-date-picker__calendar--docked-bloom-in': contentBloom && this.isDocked,
          'md-date-picker__calendar--content-bloom-in': contentBloom && !this.isDocked,
        }}
        part="calendar"
        role="grid"
        aria-label={gridLabel}
      >
        <div class="md-date-picker__weekdays" part="weekdays" role="row" aria-hidden="true">
          {names.map((n, i) => (
            <md-tooltip
              class="md-date-picker__weekday-tooltip"
              text={fullNames[i]}
              showDelay={0}
              position="bottom"
              offset={3}
            >
              <span
                class="md-date-picker__weekday"
                part="weekday"
                role="presentation"
              >
                {n}
              </span>
            </md-tooltip>
          ))}
        </div>
        <div
          class={{
            'md-date-picker__grid': true,
            'md-date-picker__grid--slide-forward': this.gridSlideDirection === 'forward',
            'md-date-picker__grid--slide-backward': this.gridSlideDirection === 'backward',
          }}
          part="grid"
          role="rowgroup"
          onAnimationEnd={this.onGridSlideAnimationEnd}
        >
          {Array.from({ length: cells.length / 7 }, (_unused, week) => (
            <div class="md-date-picker__week" part="week" role="row">
              {cells
                .slice(week * 7, week * 7 + 7)
                .map((cell) => this.renderDay(cell, today, primary))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  private renderDay(cell: DayCell, today: Date, primary: boolean) {
    const d = cell.date;
    const iso = toIsoDate(d);
    const disabled = this.isDisabledDate(d);
    const isToday = isSameDay(d, today);
    const isFocusTarget = isSameDay(d, this.focusedDate) && primary;

    const selected = !!this.pendingDate && isSameDay(d, this.pendingDate);
    const unselected =
      !selected && !isToday && !disabled && !cell.outOfMonth;

    const parts = ['day'];
    if (selected) parts.push('day-selected');
    if (isToday) parts.push('day-today');
    if (disabled) parts.push('day-disabled');
    if (cell.outOfMonth) parts.push('day-outside');
    if (unselected) parts.push('day-unselected');

    return (
      <md-button
        class={{
          'md-date-picker__day': true,
          'md-date-picker__day--selected': selected,
          'md-date-picker__day--today': isToday,
          'md-date-picker__day--disabled': disabled,
          'md-date-picker__day--outside': cell.outOfMonth,
          'md-date-picker__day--unselected': unselected,
        }}
        part={parts.join(' ')}
        variant={selected ? 'filled' : 'text'}
        size="sm"
        shape="square"
        selected={selected}
        roleOverride="gridcell"
        groupTabindex={isFocusTarget ? 0 : -1}
        data-date={iso}
        aria-selected={selected ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={this.formatFullDate(d)}
        disabled={disabled}
        onMdClick={() => this.selectDay(cell)}
        onKeyDown={primary ? this.handleDayKeyDown : undefined}
      >
        {d.getDate()}
      </md-button>
    );
  }

  private renderYearGrid(closing = false) {
        const current = this.viewYear;
    const { minYear, maxYear } = this.getYearListBounds();
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return (
      <div
        class={{
          'md-date-picker__year-grid-wrap': true,
          'md-date-picker__year-grid-wrap--bloom-out': closing,
        }}
        part="year-grid-wrap"
      >
        <div
          class="md-date-picker__year-grid-scroll"
          part="year-grid-scroll year-grid-viewport"
        >
          <div class="md-date-picker__year-grid" part="year-grid" role="grid" aria-label={this.yearGridLabel}>
        {Array.from({ length: Math.ceil(years.length / 3) }, (_unused, r) => (
          <div class="md-date-picker__year-row" part="year-row" role="row">
            {years.slice(r * 3, r * 3 + 3).map((y) => {
          const sel = y === current;
          const disabled = this.isDisabledYear(y);
          const unselected = !sel && !disabled;
          const parts = ['year'];
          if (sel) parts.push('year-selected');
          if (disabled) parts.push('year-disabled');
          if (unselected) parts.push('year-unselected');

          return (
            <md-button
              class={{
                'md-date-picker__year': true,
                'md-date-picker__year--selected': sel,
                'md-date-picker__year--disabled': disabled,
                'md-date-picker__year--unselected': unselected,
              }}
              part={parts.join(' ')}
              variant={sel ? 'filled' : 'text'}
              size="sm"
              shape="square"
              selected={sel}
              roleOverride="gridcell"
              data-year={String(y)}
              aria-selected={sel ? 'true' : 'false'}
              aria-disabled={disabled ? 'true' : undefined}
              aria-label={String(y)}
              disabled={disabled}
              onMdClick={() => this.selectYear(y)}
            >
              {y}
            </md-button>
          );
            })}
          </div>
        ))}
          </div>
        </div>
      </div>
    );
  }

  private renderDialogInput() {
        return (
      <div class="md-date-picker__entry" part="entry">
        <md-text-field
          class="md-date-picker__entry-textfield"
          part="entry-input"
          variant="outlined"
          label={this.label}
          placeholder={this.placeholder || this.dateFormatHint()}
          value={this.inputDraft}
          error={this.error}
          errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
          ref={(el) => (this.entryTextFieldEl = el as HTMLElement)}
          onKeyDown={this.entryTextFieldKeyDown}
          onMdInput={(e: CustomEvent<string>) => {
            this.inputDraft = e.detail;
            this.mdInput.emit({ value: e.detail });
          }}
        ></md-text-field>
      </div>
    );
  }

  private renderHeadline() {
    if (this.inputMode) {
      return this.enterDatesLabel;
    }
    return this.pendingDate ? this.formatHeadline(this.pendingDate) : this.selectDateLabel;
  }

  private renderHeader() {
    if (this.hasSlottedHeader) {
      return (
        <div class="md-date-picker__header" part="header">
          <slot name="header" />
        </div>
      );
    }
    const supporting = this.headline;
    const modeToggleLabel = this.inputMode
      ? this.toggleCalendarLabel
      : this.toggleTextLabel;
    return (
      <div class="md-date-picker__header" part="header">
        <div class="md-date-picker__header-supporting" part="supporting">
          {supporting}
        </div>
        <div class="md-date-picker__header-row">
          <div class="md-date-picker__headline" part="headline">
            {this.renderHeadline()}
          </div>
          {this.variant !== 'docked' && (
            <md-tooltip
              class="md-date-picker__mode-toggle-tooltip"
              text={modeToggleLabel}
              showDelay={0}
              position="bottom"
            >
              <md-icon-button
                class="md-date-picker__mode-toggle"
                part="mode-toggle"
                icon={this.inputMode ? 'calendar_today' : 'edit'}
                aria-label={modeToggleLabel}
                onClick={this.toggleInputMode}
              ></md-icon-button>
            </md-tooltip>
          )}
        </div>
      </div>
    );
  }

  /** Whether a Cancel / OK row is rendered at all. The body relies on it for
   *  its bottom inset, so both must agree. */
  private get hasActionRow(): boolean {
    // `commit-on-select` collapses a day CLICK into a commit — text entry has no
    // click to collapse, so input mode keeps its OK button or the typed date
    // could never be committed with the pointer.
    return this.hasSlottedActions || !this.commitOnSelect || this.inputMode;
  }

  private renderActions() {
    // Nothing is staged in commit-on-select mode, so a Cancel / OK row would
    // confirm a decision the user already made. Slotted actions are still
    // honoured — those are the consumer's, and they may hold other controls.
    if (!this.hasActionRow) return null;
    if (this.hasSlottedActions) {
      return (
        <div class="md-date-picker__actions" part="actions">
          <slot name="actions" />
        </div>
      );
    }
        return (
      <div class="md-date-picker__actions" part="actions">
        <md-button
          class="md-date-picker__action-btn"
          variant="text"
          size="sm"
          onMdClick={() => this.cancel()}
          part="cancel-button"
        >
          {this.cancelLabel}
        </md-button>
        <md-button
          class="md-date-picker__action-btn md-date-picker__action-btn--primary"
          variant="text"
          size="sm"
          onMdClick={() => {
            if (this.inputMode) {
              this.commitDialogInput();
              if (this.error) return;
            }
            this.commit();
          }}
          part="ok-button"
        >
          {this.okLabel}
        </md-button>
      </div>
    );
  }

  private renderBody() {
    if (this.inputMode) {
      return (
        <div
          class={{
            'md-date-picker__body': true,
            'md-date-picker__body--input-mode': true,
            'md-date-picker__body--no-actions': !this.hasActionRow,
          }}
          part="body"
        >
          {this.renderDialogInput()}
        </div>
      );
    }
    const showYearGrid = this.viewMode === 'year' || this.yearViewClosing;
    const showModalCalendar =
      this.viewMode === 'calendar' && !this.yearViewClosing;
    const modalCalendarBloom = this.dockedCalendarBloom || this.modalCalendarBloom;

    if (showYearGrid && !this.isDocked) {
      return (
        <div
          class={{
            'md-date-picker__body': true,
            'md-date-picker__body--year-view': true,
            'md-date-picker__body--no-actions': !this.hasActionRow,
          }}
          part="body"
        >
          {this.renderNav()}
          {this.renderYearGrid(this.yearViewClosing)}
        </div>
      );
    }
    if (this.isDocked) {
      const selectionVisible =
        this.monthMenuOpen ||
        this.yearMenuOpen ||
        !!this.selectionMenuClosing;
      const activeSelectionMenu = this.dockedSelectionMenuToShow();
      const showYearMenu = activeSelectionMenu === 'year';
      const showMonthMenu = activeSelectionMenu === 'month';
      return (
        <div
          class={{
            'md-date-picker__body': true,
            'md-date-picker__body--docked': true,
            'md-date-picker__body--docked-selection': selectionVisible,
            'md-date-picker__body--no-actions': !this.hasActionRow,
          }}
          part="body"
        >
          {this.renderDockedNav()}
          {selectionVisible && (
            <div class="md-date-picker__docked-below-nav" part="docked-below-nav">
              {this.renderDockedSelectionDivider()}
            </div>
          )}
          {showMonthMenu &&
            this.renderDockedMonthMenu(this.selectionMenuClosing === 'month')}
          {showYearMenu &&
            this.renderDockedYearMenu(this.selectionMenuClosing === 'year')}
          {!selectionVisible &&
            this.renderCalendar(
              this.viewYear,
              this.viewMonth,
              true,
              this.dockedCalendarBloom,
            )}
        </div>
      );
    }
    return (
      <div
        class={{
          'md-date-picker__body': true,
          'md-date-picker__body--no-actions': !this.hasActionRow,
        }}
        part="body"
      >
        {this.renderNav()}
        {showModalCalendar &&
          this.renderCalendar(this.viewYear, this.viewMonth, true, modalCalendarBloom)}
      </div>
    );
  }

  private renderPanel(docked = false) {
        const dockedMaxBlockStyle =
      docked && this.dockedPanelMaxBlockSize
        ? { maxBlockSize: this.dockedPanelMaxBlockSize }
        : undefined;
    return (
      <div
        class={{
          'md-date-picker__panel': true,
          'md-date-picker__panel--docked': docked,
          'md-date-picker__panel--align-end': docked && this.dockedPanelAlign === 'end',
          'md-date-picker__panel--placement-above':
            docked && this.dockedPanelPlacement === 'above',
          'md-date-picker__panel--input-mode': !docked && this.inputMode,
          'md-date-picker__panel--bloom-in': !this.panelClosing,
          'md-date-picker__panel--bloom-out': this.panelClosing,
        }}
        part="panel"
        role="dialog"
        aria-modal={docked ? undefined : 'true'}
        aria-label={this.label}
        style={dockedMaxBlockStyle}
        ref={(el) => (this.panelEl = el as HTMLElement)}
        tabindex="-1"
        onMouseDown={this.onPanelMouseDown}
        onKeyDown={this.onPanelKeyDown}
      >
        {!docked && this.renderHeader()}
        {this.renderBody()}
        {this.renderActions()}
      </div>
    );
  }

  private renderModal() {
    return (
      <div
        class={{
          'md-date-picker__modal': true,
          'md-date-picker__modal--closing': this.panelClosing,
        }}
        part="modal"
      >
        <div
          class="md-date-picker__scrim"
          part="scrim"
          onClick={() => this.scrimDismissible && this.requestDismiss()}
        />
        {this.renderPanel(false)}
      </div>
    );
  }

  render() {
    const panelVisible = this.open || this.panelClosing;
    const panelOpen = this.open && !this.panelClosing;
    return (
      <Host
        class={{
          'md-date-picker': true,
          [`md-date-picker--${this.variant}`]: true,
          'md-date-picker--open': panelOpen,
          'md-date-picker--panel-closing': this.panelClosing,
          'md-date-picker--disabled': this.disabled,
          'md-date-picker--error': this.error,
        }}
        aria-disabled={this.disabled ? 'true' : null}
      >
        {this.isDocked ? (
          <div
            class="md-date-picker__docked-anchor"
            ref={(el) => (this.dockedAnchorEl = el as HTMLElement)}
          >
            {this.renderTextFieldTrigger()}
            {panelVisible && (
              <div
                class={{
                  'md-date-picker__docked-popup': true,
                  'md-date-picker__docked-popup--above':
                    this.dockedPanelPlacement === 'above',
                }}
              >
                {this.renderPanel(true)}
              </div>
            )}
          </div>
        ) : (
          this.hasField && this.renderTextFieldTrigger()
        )}
        {panelVisible && !this.isDocked && this.renderModal()}
      </Host>
    );
  }

  /** Keep the submitted value and validity in step with the selected date. */
  @Watch('value')
  @Watch('required')
  @Watch('valueMissingLabel')
  syncFormValue() {
    setFormValue(this.internals, this.value || null);
    setValidityState(this.internals, {
      missing: this.required && !this.value,
      missingMessage: this.valueMissingLabel,
      customMessage: this.customValidityMessage,
    });
      this.emitValidityChange();
  }

  /** Restore the initial date when the owning form is reset. */
  formResetCallback() {
    this.value = this.defaultValue;
  }

  /** Current validity: boolean, message and flags. Mirrors md-text-field. */
  @Method()
  async getValidity(): Promise<{
    valid: boolean;
    validationMessage: string;
    flags: Record<string, boolean>;
  }> {
    return getValidityOf(this.internals);
  }

  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
   * never for a re-publish that lands on the same state.
   *
   * `composed: false` is deliberate. Composites like md-select embed an
   * md-text-field, and a composed event escapes that inner shadow root, so a
   * listener on md-select would receive the inner field's event as well as the
   * host's — two events, different payloads, for one logical control. Keeping
   * it uncomposed means each component reports only for itself, while
   * `bubbles: true` still lets a <form> or app root hear every control.
   */
  @Event({ bubbles: true, composed: false }) mdValidityChange: EventEmitter<{
    valid: boolean;
    validationMessage: string;
    flags: Record<string, boolean>;
  }>;

  /** Last emitted validity, so a re-publish that changes nothing stays silent. */
  private lastValidityKey: string | null = null;

  /**
   * Emit mdValidityChange if validity actually moved.
   *
   * The FIRST call only primes the baseline. Initial state is not a change, and
   * emitting on mount would fire once per control on every page load — noise a
   * consumer would have to filter out, and misleading for anything logging
   * "field became invalid".
   */
  private emitValidityChange() {
    const v = getValidityOf(this.internals);
    const key = `${v.valid}|${v.validationMessage}`;
    if (this.lastValidityKey === key) return;
    const primed = this.lastValidityKey !== null;
    this.lastValidityKey = key;
    if (primed) this.mdValidityChange.emit(v);
  }

  /** Constraint-validation API, matching md-text-field and the native contract. */
  @Method()
  async checkValidity(): Promise<boolean> {
    return checkValidityOf(this.internals);
  }

  @Method()
  async reportValidity(): Promise<boolean> {
    return reportValidityOf(this.internals);
  }

  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.syncFormValue();
  }

}

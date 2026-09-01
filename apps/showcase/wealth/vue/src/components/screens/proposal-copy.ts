/**
 * The localizable prop bundles for the proposal builder's pickers.
 *
 * In the React source this file used to be a dictionary SHIM; the keys have all
 * landed in the kit's `en.ts` / `ro.ts` / `ar.ts`, so `useCopy` is now exactly
 * `useT`, kept under its old name so the two proposal screens read the same as
 * their React counterparts.
 *
 * What is left is the two bundles below. `md-date-picker` and `md-time-picker`
 * each ship English defaults for twenty-odd props, and leaving any of them
 * unset ships English into a translated page (§9.2). Bundling them keeps the
 * call site readable and means the set cannot rot out of sync between two
 * pickers.
 *
 * TOKENS. `md-transfer-list`'s `count-template` reads `{checked}` and
 * `{total}`, and `md-table-pagination` reads `%from%` / `%to%` / `%count%`.
 * Those templates are passed to the component with NO params, so the
 * translator's own `{name}` interpolation leaves them alone for the component
 * to substitute itself.
 */

import { useT, type T } from '~/composables/useShowcase';

/**
 * The proposal screens' translator — exactly `useT`, under its old name.
 * Returns a `ComputedRef<T>`; templates auto-unwrap it, scripts read `.value`.
 */
export const useCopy: typeof useT = useT;

/**
 * Every localizable prop of `md-date-picker`, resolved.
 */
export function datePickerLabels(c: T): Record<string, string> {
  return {
    headline: c('wealth.proposal.date.headline'),
    'select-date-label': c('wealth.proposal.date.selectDate'),
    'enter-dates-label': c('wealth.proposal.date.enterDate'),
    'invalid-date-label': c('wealth.proposal.date.invalid'),
    'value-missing-label': c('wealth.proposal.date.missing'),
    'clear-label': c('wealth.proposal.date.clear'),
    'previous-month-label': c('wealth.proposal.date.previousMonth'),
    'next-month-label': c('wealth.proposal.date.nextMonth'),
    'previous-year-label': c('wealth.proposal.date.previousYear'),
    'next-year-label': c('wealth.proposal.date.nextYear'),
    'choose-month-label': c('wealth.proposal.date.chooseMonth'),
    'choose-year-label': c('wealth.proposal.date.chooseYear'),
    'choose-month-year-label': c('wealth.proposal.date.chooseMonthYear'),
    'choose-month-and-year-label': c('wealth.proposal.date.chooseMonthYear'),
    'open-calendar-label': c('wealth.proposal.date.openCalendar'),
    'close-calendar-label': c('wealth.proposal.date.closeCalendar'),
    'toggle-calendar-label': c('wealth.proposal.date.toggleCalendar'),
    'toggle-text-label': c('wealth.proposal.date.toggleText'),
    'year-grid-label': c('wealth.proposal.date.yearGrid'),
    'cancel-label': c('wealth.action.cancel'),
    'ok-label': c('wealth.proposal.ok'),
  };
}

/** The same for `md-time-picker`. `{min}` / `{max}` stay in the range messages. */
export function timePickerLabels(c: T): Record<string, string> {
  return {
    'headline-input-label': c('wealth.proposal.time.headlineInput'),
    'headline-dial-label': c('wealth.proposal.time.headlineDial'),
    'hour-label': c('wealth.proposal.time.hour'),
    'minute-label': c('wealth.proposal.time.minute'),
    'period-label': c('wealth.proposal.time.period'),
    'am-label': c('wealth.proposal.time.am'),
    'pm-label': c('wealth.proposal.time.pm'),
    'toggle-dial-label': c('wealth.proposal.time.toggleDial'),
    'toggle-input-label': c('wealth.proposal.time.toggleInput'),
    'value-missing-label': c('wealth.proposal.time.missing'),
    'range-underflow-label': c('wealth.proposal.time.underflow'),
    'range-overflow-label': c('wealth.proposal.time.overflow'),
    'range-outside-label': c('wealth.proposal.time.outside'),
    'cancel-label': c('wealth.action.cancel'),
    'ok-label': c('wealth.proposal.ok'),
  };
}

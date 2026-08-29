/**
 * The localizable prop bundles for the proposal builder's pickers.
 *
 * This file used to be a dictionary SHIM: the proposal builder's ~144 field
 * labels, step names, validation messages and picker prop values lived here in
 * a `PROPOSAL_COPY` map because six screen agents were editing
 * `packages/showcase-kit/src/i18n/en.ts` in parallel and this one added no keys
 * to it. Every entry was keyed with the exact dictionary key it should become,
 * and `useCopy()` asked the real translator first so that the map would go
 * quiet the moment those keys landed.
 *
 * They have landed, in `en.ts`, `ro.ts` and `ar.ts`. The map is gone and the
 * screens read `useT()` like every other screen in the app — which is the whole
 * point: an English-only shim in the app could never be translated, and the
 * proposal screen was the last place in this vertical still shipping English
 * into a page rendered in Romanian or Arabic.
 *
 * What is left is the two bundles below. `md-date-picker` and
 * `md-time-picker` each ship English defaults for twenty-odd props, and
 * leaving any of them unset ships English into a translated page (§9.2).
 * Bundling them keeps the call site readable and means the set cannot rot out
 * of sync between two pickers.
 *
 * TOKENS. `md-transfer-list`'s `count-template` reads `{checked}` and
 * `{total}`, and `md-table-pagination` reads `%from%` / `%to%` / `%count%`.
 * Those templates are passed to the component with NO params, so the
 * translator's own `{name}` interpolation leaves them alone for the component
 * to substitute itself.
 */

import { useT, type T } from '@/lib/showcase';

/**
 * The proposal screens' translator.
 *
 * Now exactly `useT`, kept under its old name so the two screens that call it
 * did not have to change when the shim behind it went away.
 */
export const useCopy: () => T = useT;

/**
 * Every localizable prop of `md-date-picker`, resolved.
 *
 * The picker ships an English default for twenty-odd props; leaving any of them
 * unset ships English into a translated page (§9.2). Bundling them here keeps
 * the call site readable and means the set cannot rot out of sync between two
 * pickers.
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

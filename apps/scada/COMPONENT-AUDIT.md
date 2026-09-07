# AWC component audit

Reviewed the shell, Overview, Assets, Alarms, Trends, Settings, login, signup, MFA, recovery, asset inspection, acknowledgment/reset dialogs, and component explorer.

| Area | Change |
|---|---|
| All equipment and alarm statuses | Use `md-status-dot inline size="small"`; remove the app’s dot positioning and diameter overrides. Text remains visible alongside each decorative dot. |
| Simulation status | Use the native pulse only while simulation runs; show Paused when stopped. |
| Acknowledged alarms | Use the shared status-dot composition with an explicit success state. |
| Needs attention count | Use `md-badge` with native count/overflow rendering and an external positioning anchor. |
| Alarm preview | Use a named `md-list` and `md-list-item` rows, native leading icons, and trailing tooltip/icon-button actions. |
| Asset table | Use `md-table-toolbar` in the container’s top slot. Keep sorting/filtering/pagination state in the app. |
| No matching assets | Use the table’s `empty` state and `empty` slot. |
| Make it yours | Native modal `md-side-sheet`, `md-color-picker`, `md-select`, lists and switches. Uses `@awc-ui/theme` role generation, five global density levels, RTL, local persistence, and reset. |
| Settings | Use named native lists, static rows, supporting text, and trailing switch controls. |
| Process equipment tiles | Use filled interactive `md-card` surfaces, native `md-divider` and inline statuses. Each entire card opens equipment details through native ripple, focus, and keyboard activation; no nested controls. Stage headings/readings use Material typescale tokens. |
| Information/disclosure boxes | Use filled `md-card` surfaces and ordinary explanatory text. |
| Login, signup, MFA | Use a read-only `md-stepper` with Account and Verification steps. Existing forms own navigation and validation. |
| Signup/MFA/recovery errors | Let the native field show and announce its error; clear that state on input. Reserve the form-level alert for errors that do not belong to a field. |
| Authentication divider and explorer groups | Use `md-divider`. Keep the explorer’s complete component inventory readable. |

The app now emits **45 AWC component types**. Navigation, breadcrumbs, charts, meters, tables, forms, tooltips, dialogs, and side sheets already used the library and were retained.

Ordinary headings and text, the equipment details definition list, KPI values, and the ordered treatment-stage collection remain semantic HTML/CSS. Custom process number circles, connectors, nested outlines, and condensed value styling have been removed. Rich alarm entries remain cards because they contain descriptive content and separate actions. There is no native typography, generic alert, KPI, or SCADA-process component to substitute.

Validation covered 29 rendered screen/state combinations, native component nesting, inline status markers, table filtering/empty state, accessible icon actions, and auth form/progress structure. JavaScript syntax checks and all app tests pass (including persistence, palette application/reset, and initial RTL/density restoration). This sweep did not run a full browser interaction or responsive visual test.


English/Arabic localization covers navigation, monitoring screens, status labels, equipment descriptions, customization, auth/recovery labels and validation, and component exploration. Native locale/label APIs cover dialogs, color picking, charts, select prompts, OTP prompts, pagination controls, and snackbar dismissal. Side sheets use a localized native close action. Technical identifiers and credentials stay unchanged. Some library-internal password and table announcements still use their built-in English wording. An additional 29-state English→Arabic→English DOM check verifies stable actions, values, field drafts, and verification codes without rebuilding controls.


| Loading context | Native implementation |
|---|---|
| First paint, route content, equipment inspection | `md-skeleton` shapes inside the existing layout; each shape is silent beneath one named status region. |
| Asset route | `md-table loading loading-mode="skeleton" loading-rows="5"` preserves column structure while showing native skeleton rows. |
| Chart range/signal changes | `md-line-chart.loading` with its built-in progress indicator; keyboard interaction is suspended while the replacement resolves. |
| Authentication, MFA/recovery, acknowledgment/reset, sign-out, CSV | `md-button.loading` with its native expressive loader; busy/disabled states, an external localized announcement, duplicate protection, and cancellation cleanup. |

Action regression checks cover duplicate submissions, restored control states after success/failure, retry, and cancellation after leaving or dismissing the active view. The showcase uses a documented brief simulated loading phase and no fabricated progress percentages.

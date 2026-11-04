# Time picker native implementation plan (md-time-picker)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-time-picker-source-review.md](md-time-picker-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-time-picker/web-oracle-cloud/`. Recapture it on
  the Mac (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Inputs.swift`, `temporalPicker`,
shared with `md-date-picker`; preview in `PreviewPickers.swift`,
`AWCPreviewTemporalPicker`):

* Trigger: a plain `Button` (clock symbol, `label` or "Choose time", the raw
  `value` or "Select") in a 10pt rounded rectangle, not a field. `hideTrigger`
  hides it.
* Sheet (`awcPreviewSheet`, detents medium / large): headline
  `s("headline", label)`, then a system `DatePicker(displayedComponents:
  .hourAndMinute)` in `.graphical` style (preview: two steppers), Cancel / OK.
* Binding set emits `mdInput` with the full detail on every change;
  `commitOnSelect` (not a time-picker prop) would also commit. OK emits
  `mdChange` (filling "now" when empty) and closes; Cancel and sheet dismissal
  emit `mdCancel`.
* Formatter `en_US_POSIX` `HH:mm`; bounds `low...max(low, high)`, parsed onto
  2000-01-01.
* Detail matches Web: `{value, iso, isoDateTime, date, hours, minutes,
  period}`.
* Unsupported (NativeSupport.json): `variant`, `format`, `minuteStep`, every
  label prop, `periodLayout`, `orientation`, `responsive`, `density`,
  `mdModeChange`, methods.

**Android** (`packages/native-android/.../AWCOverlays.kt`, `PickerComponent`
`"md-time-picker"`; validation in `AWCFormControls.kt`):

* Trigger: `OutlinedButton` (schedule glyph, value or label), supporting text,
  error text below.
* `AlertDialog` titled `headline` ("Select time") with M3 Compose
  `TimePicker(state)`; `is24Hour = !format.startsWith("12")`.
* OK: floors the minute to `minuteStep`, checks min / max (overnight-aware),
  then emits `mdInput` + `mdChange` and closes. **Out of range: nothing
  happens** (no error). Dismiss / Cancel: `mdCancel` + `mdClose`.
* Form validation: overnight-aware, generic message "Time is outside the
  allowed range".

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Trigger | Read-only outlined field, clock icon, label, supporting / error line, density | Plain button | Outlined button + texts |
| Default format | **12h** | System locale | **24h when `format` is unset** (`""` does not start with "12") |
| Variants | `input` (default) / `dial`, user toggle in the dialog | System graphical only | Dial only, no `TimeInput` |
| Dial | 12h ring; 24h inner ring 13–00; live drag; hour → minute hand-over; shortest-way hand | System | M3 `TimePicker` (close) |
| `minute-step` | Rounds to nearest step on the dial; arrow step in MM | Unsupported | **Floors** at OK only |
| Bounds | Validity flags + templated messages; overnight window | **Reversed bounds collapse to one instant** | Silent refusal at OK |
| HH / MM fields | Spinbuttons, arrows wrap, Enter commits | None | None |
| Period | Radiogroup, labels, vertical / horizontal layout | System | M3 built-in |
| Orientation / responsive | Landscape dialog; responsive fallbacks | Sheet | Dialog |
| Events | `mdInput` per distinct value, `mdChange` → `mdClose`; `mdCancel` → `mdClose`; `mdModeChange` | `mdInput` per change; no `mdModeChange` | `mdInput` + `mdChange` only at OK |
| `hide()` / `show()` | Methods; `hide()` = Cancel | None | None |
| Labels | 17 props | Headline, Cancel, OK | Headline, Cancel, OK |
| Motion | Dialog 500ms, scrim 150ms, mode swap 450ms, hand 200ms | System | System |
| Reduced motion | All removed | System | System |
| Density | Trigger and tiles taper; dial fixed | No | No |
| RTL | Dialog mirrors; dial never | System | System |

## Plan

1. **Shared value model** (data-only, headless-testable): canonical `HH:MM`;
   12h display; `minute-step` rounding (1…30) on the dial and as the arrow
   step; overnight bounds with the three validity outcomes and templated
   messages; the detail object; the event order above.
2. **iOS**: a field-style trigger; a custom dialog with the M3 dial (12h /
   24h rings, drag with live `mdInput`, hand-over to minutes, unwrapped hand
   angle), HH / MM fields as adjustable elements, a period segmented control,
   the mode toggle with `mdModeChange`, landscape layout, the label props.
   Default `format` to 12h. Fix the reversed-bounds collapse.
3. **Android**: default `is24Hour` to false when `format` is unset; add
   `TimeInput` and the mode toggle; round (not floor) the minute step and
   apply it during drag; surface the bound error instead of a silent no-op;
   `mdInput` on intermediate changes; label props.
4. **Motion**: dialog enter 500ms emphasized-decelerate, scrim 150ms, mode
   swap 450ms, hand 200ms; all gated on reduce-motion / animator scale.
5. **Verification**: diff against the recaptured Mac oracle (paint per case;
   per-frame hand angle and event sequences in the drag runs; reduced-motion
   runs).

## Open decisions to settle before native work

* Whether `minute-step` governs the MM arrow step (Web does; the readme says
  dial only).
* Hour-field auto-advance (Web: none; Compose `TimeInput`: yes).
* Whether natives emit `mdInput` per drag step (Web dedupes to distinct
  values) or only per settled value.
* Whether the first-open hydration window needs a native analogue (it does
  not exist natively; the Web test now waits for hydration).

# Checkbox native implementation plan (md-checkbox)

Status: implemented and installed — see the [checkpoint](md-checkbox.md) for the results. The
sections below are the plan as written at gate 1. The verified Web contract is in
[md-checkbox-source-review.md](md-checkbox-source-review.md).

## Oracles

* **Paint (canonical):** `outputs/native-parity/md-checkbox/web-oracle/web-paint.json` (Mac,
  Chrome 153; 261 cases, 260 PNGs). Unaffected by the two source fixes.
* **States (provisional):** `outputs/native-parity/md-checkbox/web-oracle-cloud/states.json` and
  `states-reduced-motion.json`, captured in the cloud with the Mac's `web-reference/states.html`
  unchanged. Recapture both on the Mac before `NativeCheckboxStatesIntegration` and the Compose
  interaction test use them as the gate; the cloud files are for building against and diffing.
  The reduced-motion capture is the first one that reflects C2.
* **Supplement (provisional, cloud only):** `keys.json` (held Space), `form.json`,
  `paint-forced-colors.json`.

## Current adapters (installed packages)

* **iOS** (`Actions.swift`, `checkControl`, shared with md-radio): a plain `Button` with an SF Symbol
  (`checkmark.square.fill` / `minus.square.fill` / `square`) and the label. A press on a
  `checked indeterminate` box unchecks it (Web: checked); accessibility value "Selected" / "Not
  selected" (no mixed state); no state layer, squish, glyph entrance, ripple, density, hooks, parts,
  soft-disabled, decorative mode or form reset.
* **Android** (`AWCComponent.kt`, the shared input adapter): the Material 3 `Checkbox`.

Both are replaced by the staged renderers below; only the dispatch lines change when they are
installed.

## Staged renderers and what Gate 1 changes for them

**Swift `AWCNativeCheckbox`** (`work/selection-staging/Sources/AWCUI/NativeCheckbox.swift`,
`CheckboxAppearance.swift`): paint parity 5957/5957 over the 258 non-validation cases.

* **C1 (key repeat) — change required.** `keyboardToggle()` is documented as "key repeat is not
  filtered", copying the old source. The focus bridge's key route must pass the key phase and the
  renderer must ignore repeats (SwiftUI `KeyPress.phase == .repeat`; AppKit `NSEvent.isARepeat`;
  UIKit `UIPress` repeats), so a held Space toggles once and emits one `mdChange`. Add the case to
  `NativeCheckboxStatesIntegration` from `keys.json`.
* **C2 (reduced motion) — already matches.** With `accessibilityReduceMotion` (or the selection
  override) the renderer snaps the squish, the state layer, the colours and the glyph; the ripple
  still runs. The Web now does the same; the reduced states oracle checks it.
* Space acts on keydown with a 150 ms pressed pulse and a centred ripple; Enter is consumed and
  does nothing (Web lets it through to the page — keep it unconsumed so a form's implicit
  submission behaviour stays the host app's).

**Compose `NativeCheckbox`** (`work/selection-android/NativeCheckbox.kt`): compiles; paint run not
yet reported (the emulator stopped answering adb).

* **C1 — change required.** `onKeyEvent` toggles on every `KeyDown` of `Key.Spacebar`, including
  auto-repeats. Ignore `nativeKeyEvent.repeatCount > 0` (keep consuming them so focus does not
  move).
* **C2 — already matches.** Reduced motion (`LocalAWCSelectionReducedMotion` or animator scale 0)
  sets every duration to 0 and skips the glyph entrance.
* Semantics: `Role.Checkbox`, `ToggleableState` On/Off/Indeterminate, soft-disabled stays focusable
  with `disabled()` semantics, decorative hides from accessibility and focus.

## Gap analysis (staged renderers vs. the Web contract)

| Contract | Web | Swift (staged) | Compose (staged) |
|---|---|---|---|
| Paint (261 cases) | Oracle | 5957/5957 | Not yet run |
| Toggle (click, label, indeterminate → checked) | Yes | Yes | Yes |
| Space once per press | Yes (C1) | **Toggles per repeat** | **Toggles per repeat** |
| Enter | Ignored, not consumed | Consumed, no action | Not consumed |
| Reduced motion | Squish, colours, layer, glyph off; ripple on (C2) | Same | Same |
| `mdChange` detail / timing | `{checked, indeterminate}` after the change | Same | Same |
| `aria-checked` mixed | Yes | Checkbox role via the focus bridge; mixed to verify | `ToggleableState.Indeterminate` |
| `aria-invalid` at rest when required | Yes (decision pending) | To verify | To verify |
| Validation (`required`, custom, report, focus) | ElementInternals | Registered form messages shown in the support row | Not in the renderer (support text from props only) |
| Form reset (initial checked + indeterminate) | Yes | Through the node properties (no reset path in the renderer; to verify) | Re-reads the props on `_awcFormReset` (current, not initial, values) |
| Fieldset/form disabled | Inert and unfocusable (Chrome), still painted enabled (decision pending) | n/a | n/a |
| Forced colours / high contrast | No rules | System | System |

## Plan

1. Settle the two pending decisions (`aria-invalid` at rest; form-disabled inertness) — both
   change what the native renderers must expose.
2. Recapture `states.html` (default and `?set=reduced`) on the Mac with the fixed build; diff
   against the cloud capture (expected differences: the reduced-motion glyph and squish records).
3. Swift: route key phases through `AWCNativeButtonFocusBridge`, ignore repeats, run
   `NativeCheckboxStatesIntegration` against the recaptured states and `keys.json`.
4. Compose: ignore key repeats; rerun `NativeCheckboxParityTest` once the emulator is healthy, then
   the interaction test against the recaptured states.
5. Install both renderers (dispatch lines only) after their gates pass; md-radio keeps the shared
   adapter until its own gate.

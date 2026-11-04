# Search native implementation plan (md-search)

Status: Gate 1 plan. No native code has changed. It is based on
`md-search-source-review.md` and the provisional cloud oracle, which must be
recaptured on the Mac (Chrome 153) first.

## Current adapters

* **iOS** (`AWCUI/Overlays.swift` `search`):
  * A capsule `HStack`: leading button (emits `mdLeadingIconClick` and
    toggles `open`), `TextField`, clear button ("Clear search", emits
    `mdClear` + `mdInput ""`) and the `trailing` slot.
  * Under it, while `open`: the default slot, the `results` slot and a "No
    results" caption when there are no children. A `ProgressView` shows
    while `loading`.
  * Every keystroke emits `mdInput` and `mdSearch` and opens the view.
    Return emits `mdSubmit` + `mdChange`.
  * `NativeSupport.json` lists 9 properties, 8 events and 2 slots.
* **Android:** md-search goes through the generic `TextInput`:
  * an M3 text field with `ImeAction.Search` and the label "Search";
  * clear when `showClearButton`;
  * `mdInput` / `mdSearch {value}` per change; the IME Search action emits
    `mdSearch` + `mdSubmit` + `mdChange`.

  There is no open/closed state, no results area, no leading icon and no
  `mdOpen` / `mdClose`. `support.json` lists 4 properties, 5 events and no
  slots.

## Gap analysis

| Contract | Web | iOS | Android |
|---|---|---|---|
| Layouts: docked (anchored popup) / full-screen (modal view) | yes | inline expansion under the bar only | none |
| Variants contained / divided | yes | no | no |
| Triggers: icon, bar, external opener (`trigger-for`) | yes | bar only | bar only |
| Open/close + `mdOpen` / `mdClose`, `show` / `close` / `whenClosed` / `toggle` | yes | `open` only; events listed but only the leading button toggles | no |
| Leading icon swap (search → back) | yes | static `leadingIcon` | no |
| Results slot, arrow navigation into rows | yes | slot rendered, no keyboard navigation | no |
| Full-screen focus trap (incl. results, D4), scroll lock | yes | n/a | n/a |
| Docked keyboard scope (D2), IME Enter (D3) | yes | n/a (`onSubmit` is IME-safe) | IME action |
| Escape / back / outside dismiss | yes | no | no |
| Live-region announcements (results / no results / loading) | yes | no ("No results" text only) | no |
| `debounce` / `throttle`, distinct `mdSearch`, flush on submit/clear | yes | no (`mdSearch` every keystroke) | no |
| `mdChange` on blur | yes | on Return | on IME action |
| Clear: `mdInput ""`, `mdSearch ""`, `mdClear` | yes | `mdClear`, then `mdInput ""` (no `mdSearch`) | `mdInput`, `mdSearch`, `mdClear`, `mdChange` |
| Loading indicator, `loading-label` | yes; results fade while loading | `ProgressView` | no |
| Voice search, `mdVoice` | yes | no | no |
| Density, elevation, `full-width`, `max-block-size`, 25 CSS hooks | yes | no | no |

## Plan

1. **A dedicated native search adapter** on both platforms. Stop routing
   Android through `TextInput`.
   * **Bar:** a 56pt pill, surface-container-high, leading icon, field,
     clear, voice, `trailing` slot and density.
   * **Docked:** an anchored popover under the bar on iPad / large screens
     (`.popover` or a custom overlay; Compose `Popup`). Panel geometry and
     the 300ms emphasized motion come from `search-docked-*`.
   * **Full-screen:** a full-screen cover / dialog, with the back button,
     the results list, the focus trap and Escape / back to close. The motion
     comes from `search-fullscreen-*`; under Reduce Motion it is instant.
   * The `trigger` / `trigger-for` equivalents expose an opener API, and
     focus returns to the opener after close.
2. **Event engine shared with the text-field plan.**
   * `mdInput` per keystroke.
   * `mdSearch` debounced / throttled / distinct, flushed on submit and
     clear.
   * `mdSubmit` on Return / the IME Search action (never mid-composition).
   * `mdChange` on focus loss.
   * `mdOpen` / `mdClose`.
   * `mdClear` emits `mdInput ""` → `mdSearch ""` → `mdClear`.
3. **Results.** Render the `results` slot in the panel. Arrow-key
   (hardware) navigation goes into the rows and back to the field. VoiceOver
   / TalkBack announcements reuse the Web's `results-label` /
   `no-results-label` / `loading-label` templates
   (`UIAccessibility.post(.announcement)`, `LiveRegionMode.Polite`).
4. **Voice.** Map voice to `SFSpeechRecognizer` / `SpeechRecognizer`
   behind `voice-search`, emitting `mdVoice {value, final}`.
5. **Verification** against `search-docked-*` (event order, focus path),
   `search-fullscreen-*` (Tab / focus order) and the reduced-motion runs.

## Open decisions to settle before native work

1. **Docked on phones:** M3 uses full-screen search on compact widths. Should
   native force `full-screen` below a breakpoint, or honour `layout`
   literally?
2. **Composition:** should `mdInput` / `mdSearch` be held during IME
   composition (as md-text-field does)? Native fields deliver marked text
   too.
3. **Focus during the exit motion:** move focus to the opener before the
   close animation (Web today: after).
4. **Results while loading:** hidden (Web today) or kept under the
   indicator?
5. **Value reflection:** the query reflects to the DOM on the Web. There is
   no native equivalent; confirm it is not part of the contract.

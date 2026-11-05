# Selection controls in the Laboratory (gate 3)

Scope: `md-switch`, `md-checkbox`, `md-radio` and `md-chip`. This records the Laboratory integration (gate 3) on top
of the implementation checkpoints in [md-switch.md](md-switch.md), [md-checkbox.md](md-checkbox.md),
[md-radio.md](md-radio.md) and [md-chip.md](md-chip.md). It is not the separate final audit, and it is not an
assistive-technology (VoiceOver/TalkBack) execution claim.

Evidence: `outputs/native-parity/selection-lab/` (`checkpoint.json` hashes the installed sources and summarises every run).
Installers (anchored, idempotent edits; verified first in a private copy of the tree, then applied to the canonical
tree, which was confirmed byte-identical to the verified copy): `work/selection-lab/native-patch.py`,
`native-patch2.py`, `lab-patch.py` and `install.sh`.

## What the Laboratory exposes

- **Appearance** (`selection-appearance.js`): exactly the hooks each stylesheet reads — switch 12, checkbox 14,
  radio 7, chip 12. The test asserts them against the source CSS, the IR and both released policies. Lengths are px
  (points on SwiftUI, dp on Compose), colours `#RRGGBB`/`#RRGGBBAA`, corners as the shared corner shape and the chip
  elevation as a shadow list.
  - The SwiftUI chip lengths are `AWCChipLength` (px, em, rem, ch). The Laboratory sends px, so copied snippets use
    `.points(…)` and the live hosts accept plain points.
  - Compose takes dp; `AWCChipHookAppearanceScope` is the name the copied snippets use and is an alias of
    `AWCChipAppearanceScope`.
- **Styles panels** on Web, SwiftUI and Compose: grouped fields; every field parses and formats round-trip, and
  invalid input keeps the last valid value. The Web preview applies the CSS to the source element.
- **Retained updates** for every source property with its source type: switch 12, checkbox 12, radio 8, chip 14
  (chip variant, appearance and contentAlign enumerations; density 0…−4). Invalid patches are rejected by the
  Studio and by both hosts.
- **Released policies:** every property, event, method and slot, with no unsupported members. The policies also
  release the appearance fields and the visual parts. `cli.mjs check` reports the generated files current.
- **Copyable examples:** 118 SwiftUI and 118 Compose examples are generated from the released policies
  (`laboratory/examples/generate.mjs`). They cover:
  - usage and theme;
  - copied snippets with every hook, also as subtree defaults;
  - every property, variants and densities 0…−4;
  - every event, method, slot and part.

  `swiftc -typecheck` reports 0 errors. `:app:compileDebugAndroidTestKotlin` is BUILD SUCCESSFUL.

## Method transport (new native API)

`AWCSelectionControlController` is a public controller on both platforms. Attach it with
`.awcSelectionControlController(_:for:)` on SwiftUI or `AWCSelectionControlControllerScope(controller, id)` on
Compose; it binds to a node id, or with no id to every descendant selection control. It exposes the source
methods:

| Component | Methods |
| --- | --- |
| md-switch | `setFocus`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` |
| md-checkbox | `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` |
| md-radio | `syncValidityFromGroup`, `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity`, `setFocus`, `setBlur`, `select` |

Semantics follow `utils/form.ts` and the components:

- **Validity.** `getValidity()` returns `{valid, validationMessage, flags}` with the ten `ValidityState` flags. A
  custom message wins as `customError`. Otherwise an empty required control is `valueMissing` with its
  `valueMissingLabel`, or the source's default English message.
  - A radio is missing when any member of its named group is required and none is checked. An unnamed radio is
    missing when it is itself required and unchecked.
  - A hard-disabled control is barred: `checkValidity()` and `reportValidity()` return true.
- **Reporting.** `reportValidity()` on an invalid control shows the message inline, kept in sync while the control
  stays invalid, and focuses it with its programmatic ring.
  - The message hides when the control becomes valid, its name changes, it is disabled, or its native form resets.
    `AWCFormState.resetCount` is new for that last case.
  - `checkValidity()` never reveals the message and never moves focus.
- **mdValidityChange** is now emitted natively when validity changes, never for the first evaluation.
- **Focus methods.**
  - `setFocus()` uses the existing focus bridges.
  - `setBlur()` uses a new `resignFocus` hook on the SwiftUI focus handle; Compose clears focus.
  - Radio `select()` checks an enabled, unchecked radio and emits `mdChange`.
- **Laboratory transport.**
  - `native-methods.js` validates the commands.
  - Synchronous results (booleans, validity records, list indices) now return from both hosts through
    `nativeMethodValue`. The Studio's method panel shows them instead of "Done".

## Renderer fixes found here

- **md-switch supporting line (SwiftUI and Compose).** The validation message is now inside the host, as in the
  source: the host height includes it, the host keeps the track's width, and the text overflows toward the inline
  end. Before, it widened the host; in right-to-left it moved the switch to the far edge. This surfaced as soon as
  the four switch validation cases ran.
- **Compose checkbox.** The validation message now feeds the supporting line and the error colours, as on SwiftUI.
- **The switch paint tests** now clamp a clip that leaves the viewport, as Chrome's capture does (both platforms).
- **md-chip SwiftUI inspection.** The renderer reported its content gap under `gap`, which the Laboratory's inspection schema reserves for a `{row, column}` record. `native-live.mjs` therefore rejected every SwiftUI chip live frame (`INVALID_LIVE_FRAME`), and `test-live-preview` failed. The gap is now `contentGap`.
- **Studio tests.** Three Studio tests used md-chip as their example of a component without an appearance profile; they now use md-breadcrumb-item.
- **End-to-end probe** through the running Laboratory server (`probe-laboratory.mjs`, job 732): each of the four components opens a live session on SwiftUI and on Android with validated frames; `reportValidity`/`getValidity` return through the transport.

## Results

| Check | Result |
| --- | --- |
| Validation paint cases (previously skipped): switch 4, checkbox 2, radio 2 | All pass on macOS, Android and the iOS simulator (mean ≤ 0.123, no pixel over 6) |
| Swift paint fixtures with them (staged tree, jobs 721/722) | radio 3,335/3,335; checkbox 6,019/6,019; switch 10,447/10,447 |
| iOS simulator harness, same fixtures (job 727) | radio 3,335/3,335; checkbox 6,019/6,019; switch 10,447/10,447 |
| Android paint parity with them (jobs A721/A723) | radio 3,177/3,177; checkbox 5,759/5,759; switch 10,447/10,447 |
| Studio focused (17 files incl. `selection-integration.test.mjs`, job 724) | 244/244 |
| Swift live host `test-live-selection.mjs` (job 724) | 38/38 |
| Android `LivePreviewSelectionHostTest` with the selection interaction tests and `LivePreviewHostTest` (job A724) | 28/28 |
| Copied examples (jobs 725/A725) | 118 SwiftUI typecheck clean; 118 Compose compile |

## Full suites after installation

Full suites after installation (canonical tree): Studio 754/754 (job 732; three Studio tests now use md-breadcrumb-item instead of md-chip as their profile-less example); Swift view fixtures 56/57 (failing only NativeChipStatesIntegration, the open display-token case), package scripts 7/8 (failing only the known fab-menu flake), Swift live hosts 21/22 (failing only the pre-existing test-live-stream; test-live-preview passes after the md-chip inspection fix), iOS simulator compile 0 errors (jobs 729/732); Android 67/73 device tests over every Laboratory host test, the selection and chip parity/interaction tests and the shared interaction/presentation tests, failing only the 5 known pre-existing tests and the open md-chip display-token case, plus :native-ui unit tests 195/195 (job A726); end-to-end Laboratory probe 8/8 sessions (job 732).

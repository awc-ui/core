# Radio parity checkpoint

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in production dispatch
(`AWCNativeView`: `md-radio` → `nativeRadio`; `AWCComponent`: `md-radio` → `NativeRadio`), each with a
native radio-group registry. Public appearance and part APIs exist on both platforms. The macOS and
Android runtime checks below pass against trusted-input Chrome oracles captured on the Mac (Chrome 153)
from the private build with the three gate-1 fixes (single tab stop, no re-announcement, reduced-motion
squish). This is an implementation checkpoint (gates 1, 2, 4 and 5), not the final audit; the iOS results come from the iOS fork's simulator harness. Contract and source decisions: [md-radio-source-review.md](md-radio-source-review.md);
plan: [md-radio-native-plan.md](md-radio-native-plan.md).

## Contract and implementation

- Properties: `checked`, `disabled`, `softDisabled`, `required`, `name`, `value`, `density` 0…−4
  (local over inherited), `hidden`, and the validation line from the native form (`error`/`errorText`
  on Android, the registered form's message on Swift).
- **Group registry.** Radios with the same `name` in one native tree form a group: Swift keys the
  registry by the tree's interaction store (`AWCNativeScope` shares one across separate trees),
  Compose by the window or an `AWCRadioGroupScope`. Members are read in document order, which native
  trees do not expose (SwiftUI appearance order is not tree order): the registry uses the reading order
  of the rendered radios — rows top to bottom, leading to trailing within a row (right to left only when
  every member is right-to-left), registration order until all members are laid out.
  - One tab stop per group: the checked radio, else the first radio that is not hard disabled;
    disabled is never a stop; an unnamed radio always is. Swift exposes it through the focus bridge's
    `groupTabindex` (the key-view loop holds exactly the stops); Compose through `canFocus` (only the
    stop takes sequential focus; arrows and presses can focus any member).
  - Arrow Down/Right and Up/Left move focus to the next/previous member that is neither disabled nor
    soft-disabled (wrapping), check it with its own `mdChange` and a centred ripple; arrowing onto the
    already checked radio only moves focus. Arrows never leave the radio (the source prevents the
    default) and do nothing on an unnamed radio.
  - Checking a member unchecks the others silently (no events).
  - `required` on any member makes the whole group required; every member reports `valueMissing`
    until one is checked (exposed to inspection; inside a native form the form's radio rules apply).
- Activation: click and Space check an unchecked radio and emit `mdChange {checked: true, value}`; a
  checked radio ignores activation. Space has the 150 ms pressed pulse and a centred ripple; Enter is
  inert. Hard disabled is inert and unfocusable (pointer events off); soft disabled stays focusable but
  never checks and ignores arrows. Focus changes emit `mdFocus`/`mdBlur`.
- Paint: target, state layer (hover 0.08, pressed 0.12; no focus-visible layer; hidden when disabled),
  md-ripple wave clipped to the state-layer circle, the outer ring (2pt border inside the icon box, its
  fill from `::part(outer-circle)`), the inner dot and the focus ring as a 3pt outline on the
  state-layer circle, clipped by the touch target; the validation line below the target.
- Motion (CSS transition semantics on the frame clock): outer colour and state layer `short2`
  standard; inner dot `scale(0 → 1)` `medium4` emphasized-decelerate; squish `scale(0.82)` with
  `short4` standard in and `medium4` emphasized-decelerate out. Reduced motion removes all of them
  except the ripple, as the source does after the gate-1 fix.

**Hooks and parts.** `AWCRadioAppearance` carries the seven hooks (`iconColor`, `selectedIconColor`,
`iconSize`, `innerCircleSize`, `stateLayerSize` — the density base, `stateLayerColor`,
`selectedStateLayerColor`); `AWCRadioPartAppearance` carries `state-layer` colour and opacity and the
`outer-circle` colour and fill and `inner-circle` colour (the `container` part paints nothing). Swift:
`.awcRadioAppearance(_:)`, `.awcRadioPartAppearance(_:)`; Compose: `AWCRadioAppearanceScope`,
`AWCRadioPartAppearanceScope`, `AWCRadioGroupScope`.

## Verification

| Check | Result |
| --- | --- |
| Source tests (Mac, private build with the three fixes) | switch/checkbox/radio 14 suites, 257 tests |
| macOS paint (`NativeRadioPaintIntegration`, 161 cases: 159 run, 2 validation skipped) | 3123/3123 checks |
| macOS interaction + group (`NativeRadioStatesIntegration`: 10 runs + 2 reduced, 6 group cases, required rule) | 21740/21740 checks (installed; 21950/21950 staged, 21385/21385 inside the full suite — the count follows the rendered frames) |
| iOS simulator paint / interaction + group (parity harness) | 3123/3123 and 11307/11307 checks |
| Android paint (`NativeRadioParityTest`, the same 159 cases) | 2965/2965 checks |
| Android interaction (`NativeRadioInteractionTest.radioInteractionMatchesChrome`, 12 runs) | 16131/16131 checks |
| Android group (`radioGroupKeyboardMatchesChrome`, 6 cases + required rule) | 121/121 checks |

Paint compares host, target, state-layer and icon boxes (±0.6), state-layer/outer/fill/inner colours
(premultiplied ±0.012), state-layer opacity, inner scale and size, focus ring, tab stop and every flat
pixel of the clip. The interaction runs place the tested radio in a three-member group between two
probes and compare every rendered frame's container scale (±0.004), outer colour (±0.012), inner scale
(±0.01), state layer (±0.004) and state-layer colour (±0.012) with Chrome's per-frame samples (±2
frames), every `mdChange` (target and detail), the tested radio's focus/blur sequence, settle values,
and at every phase end the group's checked states, tab indices, focus (and, on Swift, the key-view
loop), plus the phase paint (ripple included). The group cases replay radio/group.html key by key
(Tab, arrows with wrap and skip, Space, a single available member, a lone named radio, unnamed radios)
and compare checked states, tab indices, focus and the md events in order; Tab is real traversal on
Android and the key-view-loop order on Swift.

## Differences and limits

- Document order is the rendered reading order (above). Layouts that reorder visually against the
  authored order (a reversed stack) would arrow in visual order.
- Two radios rendered in separate native trees without an `AWCNativeScope` (Swift) are separate groups,
  as before; on Android the default scope is the window.
- The two inline-validation paint cases run through the native method controller since gate 3 and pass
  ([selection-laboratory.md](selection-laboratory.md)). The `required` group rule is checked natively against the source rule;
  the oracle pages have no `required` group run.
- Phase shots: Chrome's screenshot of a phase completes before the next phase starts. Android captures
  in the first frame at the next phase's start time, the Swift harness when the next step fires (at most
  a few frames later). The difference only matters while a keyboard ripple is fading (Space and arrow
  phases): capturing one frame after the phase's last sample instead (an interim attempt) left the
  native wave visibly stronger than Chrome's shot in 15 such phases, which shows the shot is taken
  late in that window.

## Full suites after installation

Installed with the selection mechanics: `radio-patch.py` (new files; anchored dispatch `md-radio` →
`nativeRadio`, the `.disabled` exemption, fixture-list edits and one behaviour-fixture edit in
`packages/native-ios`) and `radio-android/install.py` (new file plus the anchored dispatch line in
`AWCComponent.kt`; androidTest classes and byte-identical assets).

- Swift: 55 of 57 view fixtures pass (`outputs/native-parity/md-radio/native-swift/full/`), including
  radio 3123/3123 + 21385/21385, switch and checkbox. `NativeBehaviorViewIntegration` clicked the old
  adapter's label row at x = 80; the source radio is the 48pt host only (no label slot), so the click
  moved onto the host centre (an anchored test edit, as for md-checkbox); it passes, including its form
  radio checks (one successful control, nested groups isolated, reset). The two failures contain no
  md-radio: `NativeFabMenuViewIntegration` failed at "Close restores authored anchor glyph" in the suite
  and passes in isolation (133/133); `NativeChipStatesIntegration` fails one md-chip case in isolation
  too (`displayToken-input-outlined-removable-token-light-ltr/clickBody`, mean 1.32), an open md-chip
  issue that the Android suite shows as well.
- Swift scripts: all eight pass (badge, behaviour, button, button-hosts, divider, fab-menu, preview,
  status-dot) after the playground SwiftPM clean.
- iOS: the AWCUI simulator build compiles with no errors; the radio fixtures run on the simulator
  through the iOS fork's parity harness (paint 3123/3123, interaction + group 11307/11307). The states
  test reads the sequential-focus policy through the focus bridge on UIKit (`canBecomeKeyView` on AppKit).
- Android: 272 device tests; the 5 known pre-existing failures remain (same messages) and
  `chipInteractionMatchesChrome` fails on the same md-chip case as in the md-chip run; no other
  failures. Inside the suite: radio 2965/2965 + 16131/16131 + group 121/121, switch and checkbox
  unchanged. Unit tests 195/195.

Evidence: `outputs/native-parity/md-radio/native-{swift,android}/checkpoint.json`.

## Laboratory (gate 3)

Complete 2026-10-26: see [selection-laboratory.md](selection-laboratory.md). The seven hooks, all eight properties as retained updates, the typed parts (the container part paints nothing), and all eight methods through `AWCSelectionControlController`: `setFocus`, `setBlur`, `select`, `syncValidityFromGroup` and the constraint-validation methods with the group's required rule; `mdValidityChange` is native. The two `reportValidity` paint cases now run and pass (macOS and the iOS simulator 3,335/3,335; Android 3,177/3,177), including the supporting line's text, colour and position.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeRadioPaintIntegration` | **3335/3335** | **3335/3335** | **3335/3335** |
| `NativeRadioStatesIntegration` | **11362/11362** | **11382/11382** | **11432/11432** |
| **Total** | **14697/14697** | **14717/14717** | **14767/14767** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->

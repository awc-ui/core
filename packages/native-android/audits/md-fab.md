# Android `md-fab` parity record

Source: `packages/core/src/components/md-fab/md-fab.tsx` and `.css`.
Implementation: `NativeFab.kt`, `AWCFabAppearance.kt`, `AWCComponent.kt`, and the live Android host.

## Implemented contract

- All ten source properties: variant, size, disabled, softDisabled, lowered, ripple, icon, label, optional extended and density. Seven palettes preserve the source surface/lowered distinction; disabled host colors override the container, while authored icon/label colors retain their later inner-part precedence.
- Icon-only sizes follow 56/80/96dp and the five density rungs. Any nonempty label selects standard height/icon/radius regardless of size. Unset extended derives from label presence; explicit collapsed retains the accessible label and 56dp minimum width. Real Roboto text measurement supplies label width, including changes after mount.
- Labelled padding, density token steps, logical direction and gap follow the measured source. Extent, min width and padding use the 500ms spatial curve; label opacity uses the 200ms effects curve. The initial state has no entrance morph. Native reduced-motion disables these animations.
- The named icon slot accepts actual native content or `AWCMaterialSymbol`. An explicit empty Text element suppresses the fallback while retaining its icon-sized box. Literal text inherits host typography and is centered in that box; a Material Symbol inherits resolved icon size instead. Authored slot composition remains mounted while temporarily hidden by a menu icon.
- `AWCFabAppearance` and `AWCFabAppearanceScope` expose the five public hooks: containerColor, iconColor, iconSize, cornerRadius and labelColor. The real root, state-layer, icon and visible label are available to opt-in native inspection.
- `rememberAWCFabController()` / `AWCFabControllerScope(controller)` attach one FAB. `setMenuIcon(String?): Boolean` reports whether an attached target accepted the value. Empty/null clears the temporary icon; whitespace is preserved. Disabled state does not block the method. No authored icon or slot is mutated, and detaching the target returns false.
- Native pointer, keyboard and accessibility activation emit `mdClick` once. The callback/transport detail is null because there is no DOM MouseEvent. Existing scoped `AWCActionEvent.detail` is an empty map; its separate activation field contains the actual input source and pointer-local coordinates when available. Scoped cancellation and propagation remain available; no default action is attached to this notification.
- The live host validates the method name/argument shape, invokes the attached controller, then acknowledges acceptance. A returned frame alone is not considered method completion. The acknowledgment does not promise animation completion.

## Verification evidence

- Android 16 emulator: **11 component/host cases passed**, comprising ten FAB tests and its live-host method/capture test. The [scoped result extract](evidence/md-fab/component-device-results.xml) derives from the retained [raw combined report](evidence/md-fab/device-results.xml); [verification metadata](evidence/md-fab/verification.json) identifies the source and counts.
- The native unit suite passed **69 cases**, including [five FAB contract tests](evidence/md-fab/unit-contract-results.xml), with no failures, errors or skips. All 25 existing button focus/action and icon-button device regressions passed as well.
- The combined device report contains 49 passes and one unrelated Divider fixture failure: the oracle asset was not packaged, so that test stopped before rendering. The original failure remains visible in the [Gradle log](evidence/md-fab/device-run.log); it is not counted as a successful case. Its test asset source set was corrected afterward; both focused Divider device tests then passed, including all 43 oracle fixture subcases.
- All 86 captured native source/build input hashes matched before and after the run: [source-sha256.json](evidence/md-fab/source-sha256.json). The later Divider asset configuration correction does not change the tested FAB implementation.
- Device tests measure all fifteen icon-only size/density combinations and forty-five labelled size/density combinations, live label changes, RTL padding, empty/whitespace slots, inherited literal text typography and centering, oversized glyph overflow, all seven variant/disabled/lowered palettes, five appearance hooks, retained authored slots, controller acceptance/clearing/disposal, pointer/keyboard/accessibility actions, reduced activation under disabled states, extension motion and canceled ripples. Combination counts are subcases, not additional JUnit tests.
- The live-host test verifies real frame geometry, typed appearance and the applied method acknowledgment while disabled; a changed captured image proves the temporary glyph reached the renderer.
- Ten generated production Kotlin Usage/API examples compiled with `:app:compileDebugKotlin`, exit 0. Exact sources and Gradle evidence remain in workspace `outputs/native-parity/md-fab/examples/`; temporary sources were removed after compilation.
- The Web geometry reference is workspace `outputs/native-parity/md-fab/web-geometry.json`, with 56 fixtures and five method states. Native test evidence establishes these tested behaviors, not universal pixel-identical platform rasterization.

## Native boundaries

The standalone component has no DOM objects, document fonts or browser forced-colors media query. Native text shaping, physical-pixel rounding and elevation rasterization can differ from browser paint. Menu-owned anchor choreography, circular shape and glyph transition flags belong to the separate `md-fab-menu` migration and are not claimed by standalone `setMenuIcon`.

# Android `md-icon-button` parity record

Source reviewed: `packages/core/src/components/md-icon-button/md-icon-button.tsx` and `.css`.
Native implementation: `NativeIconButton.kt`, `AWCIconButtonAppearance.kt`, shared native focus/actions/navigation/slots, and the Android live preview host.

## Contract implemented

| Source area | Native behavior and verification |
| --- | --- |
| `variant` | Standard, filled, tonal, outlined; enabled selected palettes apply even when `toggle=false`. Device pixel checks cover all 32 variant/toggle/selected/disabled combinations. Selected outlined uses inverse-surface/inverse-on-surface and a transparent border; disabling it restores the base transparent container unless authored. |
| `size`, `density`, `buttonWidth` | All five sizes, five integer density rungs, and narrow/default/wide widths. Device layout checks cover all 75 combinations, including the 32dp container floor and icon density floors. |
| `shape`, `shapeMorph`, `selected` | Resting, selected and pressed radii follow source precedence. A custom radius changes the resting radius; selected and pressed morph targets can override it. Release uses 400ms, press uses 200ms or 250ms for narrow width; reduced system animation disables tweening. Device pixel checks cover fixed/morphed/pressed states. |
| `disabled`, `softDisabled` | Both block activation and state overlays; only hard-disabled excludes focus. Source disabled palette takes precedence over custom icon color and filled/tonal container color. Standard/outlined retain their custom container. Native focus and pixel checks verify these distinctions. |
| `toggle`, `selected` | Toggle commits before the `mdClick` notification. Non-toggle retains its selected state and palette. Scoped cancellation cannot undo already committed navigation/selection, matching this component's Web implementation. No `mdChange` is fabricated. |
| `ripple` | Pointer-origin native ink uses the icon color and source growth/fade timing; disabling ripple retains the ordinary pressed state layer. A held-pointer image test distinguishes ripple ink from the state layer and verifies cancellation does not activate. |
| `icon`, `selectedIcon` | Bundled Material Symbols, decorative by default. The selected glyph is used only for `toggle && selected`; missing selected replacement retains the default layer. The native host accepts an explicit `aria-label` for the action's accessible name. |
| `href`, `target` | Uses the shared sanitized native navigation request/router. Navigation precedes selection and notification. Unsafe links do not navigate, but still permit the icon button's toggle and notification. Unit tests verify ordering and cancellation semantics. |
| `connectedLeft`, `connectedRight` | Logical corners reverse in RTL and override fixed radius. Device images verify both directions. |
| `value`, `groupTabindex` | Native button groups coordinate values, selected state, injected size/shape/connected corners and roving focus. Explicit `-1` omits sequential focus while retaining native focus requests and accessibility activation. Device tests cover group event order and arrow traversal. |
| `mdClick` | Exact source detail `{ selected }`; native scoped capture/target/bubble and separate activation metadata. Pointer, keyboard and semantics activations produce one event each. The host test verifies pointer coordinates and event draining without duplicate activation. |
| Default and `selected` slots | Native callback slots or `AWCSlotRegistry`; replacement content updates through composition. A direct `md-badge` does not suppress the fallback glyph. Badges escape the host clip, while direct avatars retain their own measured size. Default adornments disappear with the default layer when a selected replacement is active. |
| Source methods | The Web component declares no component methods. Native focus uses the existing `AWCButtonFocusScope`/`AWCButtonFocusState`; no fictitious Web method is added. |
| `state-layer`, `icon`, `selected-icon` parts | Corresponding native render layers and measured inspector nodes; the state layer and ripple are inset inside the outlined border, matching the source padding box; selected and default content expose the active icon part. Native appearance and composable slot content replace CSS selector editing. |

## Appearance API

`AWCIconButtonAppearance` with `AWCIconButtonAppearanceScope` implements the nine source custom properties:

| Native field | Source property |
| --- | --- |
| `containerColor` | `--md-icon-button-container-color` |
| `iconColor` | `--md-icon-button-icon-color` |
| `stateLayerColor` | `--md-icon-button-state-layer-color` |
| `iconSize` | `--md-icon-button-icon-size` |
| `cornerRadius` | `--md-icon-button-container-shape` |
| `outlineColor` | `--md-icon-button-outline-color` |
| `outlineWidth` | `--md-icon-button-outline-width` |
| `width` | `--md-icon-button-container-width` |
| `height` | `--md-icon-button-container-height` |

Colors use `#RRGGBB`; dimensions use dp. Width, height, icon size and radius accept 0–2400; outline width accepts 0–16. Invalid fields inherit instead of being silently clamped. Outlined width/height retain the border-box floor. Appearance defaults and local values merge field by field.

The live host accepts `iconButtonAppearanceDefaults`/`iconButtonAppearance`, plus default/selected text or `{kind:"symbol",value:"favorite"}` slot descriptors. It reports actual Compose root/part bounds and input metadata alongside the captured native frame.

## Evidence

- Native unit suite: **54 passed**, including **6 new icon-button contract tests** for independent metric ladders, palettes, event ordering, URL safety, non-toggle detail and appearance validation.
- Focused Android device run on `AwcNative(AVD)`, Android 16: **12 passed, 0 failed, 0 skipped**, including the real live-host capture/input test. Raw result: [device-results.xml](evidence/md-icon-button/device-results.xml); corresponding source hashes: [source-sha256.json](evidence/md-icon-button/source-sha256.json).
- That run contains **75 measured geometry combinations** and **32 rendered palette combinations**; these are subcases, not extra JUnit test counts.
- Independent review then corrected ripple color inheritance and inset overlay bounds. The updated ripple test and a new outlined border/state-layer test passed in a separate **2-test run, 0 failures or skips**. Raw result: [overlay-results.xml](evidence/md-icon-button/overlay-results.xml); changed-source hashes: [overlay-source-sha256.json](evidence/md-icon-button/overlay-source-sha256.json). The 12-test run is historical evidence, not a claim that the complete suite was rerun after these two changes.
- Initial device run had two assertion failures: the test's generic click API generated pointer input, and clipped semantic bounds were used to assess an overflowing avatar. The tests now invoke the actual semantics action and inspect unclipped layout bounds respectively; the focused run passed after those corrections.
- Eight generated Kotlin Usage/API examples compiled with `:app:compileDebugKotlin`, exit 0. The temporary compilation fixture was removed afterward. Source and verification record were retained in the workspace output `outputs/native-parity/md-icon-button/examples/`.
- Laboratory browser review verified the installed native default 96×96dp and authored 80×56dp sizes, 19 editable properties, both slots, selection propagation back to Web, and light/dark rendering. The final two overlay regressions are verified by the separate device run above.

## Native boundaries

Native composables, explicit event scopes and application navigation contexts replace DOM nodes, Shadow DOM, browser windows and CSS selectors. The action remains a native Button even with a destination, matching the source host's Button role. Browser forced-colors rules are platform-specific; Android uses its native theme and accessibility mechanisms. A native `Text` composable represents an authored element, including empty/whitespace editor text; omitting that element restores the fallback. Font antialiasing and platform rasterization can differ; this record does not claim identical pixels across operating systems.

Badge/avatar internals are separate components. This audit verifies their slot placement and size exemption, not completion of their own independent parity audits.

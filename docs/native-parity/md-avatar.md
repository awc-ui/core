# Avatar parity checkpoint

**Status.** Dedicated SwiftUI and Compose renderers replace the generic adapters in production
dispatch (`AWCNativeView`, `AWCComponent`). Public appearance and part APIs exist on both
platforms, and the macOS and Android runtime checks below pass against trusted-input Chrome
oracles. The Laboratory integration (gate 3) is in place and verified; see
[Laboratory](#laboratory-gate-3). This is not the separate final audit and not an iOS runtime claim: the
UIKit branches are written but were not compiled here, because the Xcode licence has not been
accepted on the build Mac.

Source review: [md-avatar-source-review.md](md-avatar-source-review.md). Plan and oracle design:
[md-avatar-native-plan.md](md-avatar-native-plan.md).

## Contract and implementation

All 11 properties are implemented on both platforms.

**Fallback chain.** image → initials → default slot → Material Symbols `person`.
- A failed `src` stays failed until `src` changes.
- The image is shown with `object-fit: cover`.
- In image mode the container is transparent and there is no palette.

**Identity**, exactly as the source (52 Chrome identity cases pass on both platforms):
- explicit initials: trimmed, first 3 graphemes, locale upper-case;
- otherwise first + last token graphemes;
- a whitespace-only `initials` counts as unset (the source fix).

**Palette.**
- The bucket uses the JavaScript int32 hash over UTF-16 code units, seeded by the first non-blank of initials, name and label.
- Buckets 1–4 use the M3 container pairs. Buckets 5–7 use `color-mix(in srgb, …)` exactly.
- The 14 palette hooks override a bucket's pair.
- As in the source, `containerColor`/`labelColor` only colour neutral avatars.

**Size.**
- Presets with density: small `max(18, 24+1.5s)`, medium `max(28, 40+3s)`, large `max(40, 56+4s)`. A local negative density overrides the inherited one, and zero inherits.
- A custom `size` accepts:
  - a unitless number (px)
  - px, rem, em, vw, vh, vmin, vmax, pt, pc, in, cm, mm and q
  - `calc`/`min`/`max`/`clamp`
- Negative values and 0 give 0. An unparsable value falls back to the host default (medium formula).
- `vw`/`vh` use `awcAvatarViewport` / `AWCAvatarViewportScope`, or the window / configuration by default.
- Precedence: custom size, then the `size` hook, then the preset.

**Typography.**
- Initials: 0.4 × size, title-medium weight, 0.05em letter spacing, `tnum`, line-height 1.
- The icon glyph is 0.6 × size in an icon-size box, top-left with `direction: ltr`.
- Baselines are placed where CSS puts them: half-leading split equally around the primary font's ascent and descent. Both bundled fonts carry the source's hhea metrics, which Android verifies on every case.

**Shape, outline and clip.**
- circle 50%, rounded corner-medium (12), square 0, or the `containerShape` hook (asymmetric/elliptical).
- Corners are physical in RTL.
- The outline is the source's inset ring over the content.
- Everything is clipped to the shape (`overflow: hidden`).

**Events.** `mdLoad`/`mdError` carry `{src}`. They are emitted once per `src` after decoding, and again on a `crossorigin` change while an image is displayed (Chrome re-requests it). The four lifecycle scripts match Chrome's event order step by step.

**Accessibility.**
- `role="img"` with the derived label: Swift `.isImage` with `accessibilityLabel`; Compose `Role.Image` with `contentDescription`.
- Otherwise hidden from assistive technology.

**Slot.**
- Authored children are centred in the icon box, with label colour and Roboto at the icon size.
- A slotted `md-badge` keeps its own size and placement on the host's physical top-right corner, inside the clip.

**Hooks and parts.**
- Hooks: `AWCAvatarAppearance` with all 11 CEM hooks plus the 14 palette hooks. Swift: `.awcAvatarAppearance(_:for:)`. Compose: `AWCAvatarAppearanceScope`.
- Parts: `AWCAvatarPartAppearance`:
  - initials colour, size, weight, spacing
  - icon colour and glyph size
  - image object-position and opacity

  Swift: `.awcAvatarPartAppearance(_:for:)`. Compose: `AWCAvatarPartAppearanceScope`. Part rules win over hooks.

**Inspection.** Swift `awcInspect` nodes `md-avatar`, `image`, `initials`, `icon`, `slot`. Compose `AWCAvatarInspectionScope` reports the host and initials-run geometry and the resolved metrics.

## Evidence

Everything is under `outputs/native-parity/md-avatar/`.

| Gate | Result | Evidence |
|---|---|---|
| Source tests (baseline) | 45/45 | `source-tests/baseline.log` |
| Blank-initials defect: failing test first | 2/2 fail before, pass after (17 suites / 314 tests) | `source-tests/blank-initials-before.log`, `after.log`, `source-changes/` |
| Chrome oracles | 282 paint cases (281 PNG), 52 identity, 4 lifecycle scripts | `web-oracle/`, `web-reference/` |
| Swift `NativeAvatarIntegration` | 2949/2949: job 352 (staged, then installed) and again on the palette-field API (job 400) | `native-swift/results.json`, `laboratory/swift-avatar-results.json` |
| Swift full view suite | 49/49 fixtures after the Laboratory integration (job 402), including Avatar 2949/2949 and Theme 30/30. Before it, modal fork job 309 ran 48/49 on the installed renderer (hashes confirmed): its one failure was a list-states pixel case that renders no avatar | `laboratory/swift-full/fixtures-summary.log`, `fixtures/`; `../md-dialog/laboratory/swift-full/` for 309 |
| Swift related fixtures after install | After install (352): Avatar 2949/2949; icon-button 284; inspection 88; list paint 29418/29418, states 112822/112822 (60 known gaps), methods 28/28, tooltip 8/8 | `native-swift/installed-related.log` |
| Android `NativeAvatarParityTest` | 3121/3121 in the full runs A344 and A403. It also checks host position and the bundled fonts' ascent/descent against the source hhea | `native-android/full-device/…`, `laboratory/android/full-device/accordion/avatar-parity.json` |
| Android device suite + unit tests | 257/262 device tests after the Laboratory integration (job A403); 248/253 before it (A344). Both runs fail only the same 5 pre-existing tests, with messages identical to md-list's `full8` run: NativeInteractionTest ×3 (fab-menu scope, progress semantics, segmented text) and NativePreviewPresentationTest ×2. `:native-ui` unit tests 195/195 | `laboratory/android/full.log`, `full-xml/`, `full-unit-xml/`; `native-android/full.log` |

Checkpoints with source, oracle, implementation and fixture hashes:
`native-swift/checkpoint.json`, `native-android/checkpoint.json`. The Android assets
(`AvatarWebPaint.json`, `AvatarWebPaint/`, `AvatarWebLifecycle.json`) are byte-identical to the
Swift fixtures; `work/avatar-staging/make-fixtures.py` builds both and asserts it.

## Laboratory (gate 3)

Evidence: `outputs/native-parity/md-avatar/laboratory/` (`checkpoint.json` hashes the sources and summarises every
run below). Installers: `work/avatar-lab/lab-patch.py` (idempotent anchored edits and new files),
`work/avatar-staging/avatar-patch.py` (native-ios), `work/avatar-lab/make-lab-checkpoint.py`.

- **Appearance module (`avatar-appearance.js`).** Exactly the 25 hooks the stylesheet reads: the eleven documented
  ones and the fourteen palette hooks. The test asserts them against `md-avatar.css`, against the IR (eleven, plus the
  fourteen recorded as CEM drift) and against both released policies. A shared `weight` kind (1–1000) was added for
  `label-font-weight`. Avatar lengths accept px, em and rem with additive `calc()`; percentages (which would need the
  containing block) and `ch` are rejected.
- **Native API change for one field per hook.** `AWCAvatarAppearance` now takes `palette{1…7}Container` /
  `palette{1…7}Label` as labelled fields on both platforms, so copied examples and policies name the same 25 fields.
  Swift keeps the bucket dictionaries as read-only views; Compose exposes them as computed maps. The avatar parity
  tests were rerun on the new API: Swift 2949/2949, Android 3121/3121.
- **Parts.** `image`, `initials` and `icon` have copyable typed examples (`AWCAvatarPartAppearance`): object-position
  and opacity; initials colour, size and spacing; icon colour and glyph size.
- **Styles panels** on all three platforms: groups for size and shape, neutral colours, initials and the name
  palette. Every field parses and formats round-trip, and invalid input keeps the last valid value. The Web preview
  applies the CSS to the source element.
- **Retained updates** for all eleven source properties with their source types:
  - `size` is a preset, any CSS length or a finite number.
  - `shape`, `loading`, `crossorigin` and `density` are enumerations.
  - `colorFromName` is a boolean.
  - Invalid patches are rejected by the Studio and by both hosts.
- **Events.** `mdLoad`/`mdError` with `{src}` reach the Laboratory event log from both hosts.
- **Slot.** The default slot is released, with a copyable example (`★` fallback content). The Laboratory recipe has
  no slotted content, as in the source recipe, so the person icon is the slot's fallback in the preview. The avatar is
  deliberately not a Studio text slot: a name would mask the edited text exactly as on the Web, and the shared
  preview-presentation test asserts visible edited text.
  - **Compose fix found here.** A content lambda that emits nothing now counts as an empty slot: the person icon shows.
    Before, the Laboratory host's empty sample slot hid the icon.
- **Copyable examples in all seven languages.** HTML, React, Vue, Svelte and Angular snippets are asserted to carry
  every hook. 28 SwiftUI and 28 Compose examples are generated from the released policies
  (`laboratory/examples/generate.mjs`): usage, theme, copied snippets with all 25 hooks and with subtree defaults,
  every property, size/shape/content/density variants, both events, the slot and the three parts.
  `swiftc -typecheck` reports 0 errors and `:app:compileDebugAndroidTestKotlin` is BUILD SUCCESSFUL.
- **Live hosts.** SwiftUI `LiveRenderer` and `SnapshotRenderer` take `avatarAppearance`/`avatarAppearanceDefaults`
  and validate avatar patches. `test-live-avatar.mjs` (27 checks) covers:
  - dispatch and identity (AL, bucket 3, role and label);
  - local palette hooks over inherited ones;
  - the name palette winning over `containerColor`;
  - retained size, density, shape and palette updates;
  - `mdLoad`/`mdError` with `{src}` and the fallback to initials (a failed `src` is not requested again);
  - invalid updates rejected;
  - the person-icon fallback.

  The Android `LivePreviewActivity` uses `LivePreviewAvatar.kt`. `LivePreviewAvatarHostTest` runs five host
  sessions and checks bounds, PNG pixels (palette and neutral fills, the outline ring, the person glyph ink), retained
  updates, both image events and invalid updates.
- **Policies and IR.** md-avatar is released as a dedicated native renderer on both platforms: all properties,
  events and slots, 25 appearance fields and three visual parts. The IR and catalog are regenerated, and
  `cli.mjs check` reports the generated files current.

| Suite | Result |
| --- | --- |
| Studio focused (avatar, card, list, modal, API/usage examples, content slots, recipes; job 400) | 83/84: one avatar test expectation was wrong (a raw colour only fails when normalized, as in the card test); corrected, then passing in the full run |
| Studio full (`node --test *.test.mjs`, job 401) | 746/746 |
| `cli.mjs check` | Generated files are current |
| Swift avatar fixture on the palette-field API (job 400) | 2949/2949 |
| Swift examples (`AvatarParity.swift`, 28 cases) | `swiftc -typecheck` 0 errors |
| Kotlin examples (`AvatarParity.kt`, 28 cases) | `:app:compileDebugAndroidTestKotlin` BUILD SUCCESSFUL |
| Swift live host (`test-live-avatar.mjs`) | 27/27 |
| Android live host (`LivePreviewAvatarHostTest`, job A402) | 1/1 (five host sessions) |
| Android avatar parity on the new API (job A400) | 3121/3121; icon-button 12/12, list paint 1/1; the card, list, modal, preview and inspection live hosts pass |
| Swift full view suite (job 402) | 49/49 fixtures, including Avatar 2949/2949, list states 104372/104372, modal stack 149/149 and Theme 30/30 |
| Swift package scripts (job 402) | 7/8. `test-native-fab-menu` exits 133, a known pre-existing flake also in the modal run |
| Swift live hosts (job 402) | 21/22. `test-live-stream` ("The native stream must make progress") is pre-existing, recorded in md-card.md. `test-live-modal` passed here (63/63); it had failed once under concurrent load in job 400 and passed one of two isolated reruns |
| Android device suite + unit (job A403) | 257/262: only the 5 known failures (NativeInteractionTest ×3, NativePreviewPresentationTest ×2), with messages identical to the md-list baseline. Avatar 3121/3121; unit 195/195 |

## Platform differences and open items

**Not reproducible natively** (recorded, case skipped):
- inline `<svg>` slot content: no SVG DOM; native authors put a view in the slot;
- the `hidden` host attribute.

**Platform fonts.** Glyphs outside the bundled Roboto/Material Symbols come from platform fallback fonts. Chrome/macOS and SwiftUI share them (for example Apple Color Emoji and PingFang), so Swift compares them strictly. Android uses Noto, so for runs needing a fallback font (emoji, CJK, ★):
- only the centring of the run is compared with Chrome;
- an initials run is compared with the same run drawn by the device's own fonts where CSS places it (ink centroid
  within 1 px, extents within 2 px). Android's emoji font is updatable: a system font update put NotoColorEmoji 2.051
  on emulator-5554, while the clone AVDs keep the image's 2.047, whose 👩‍💻 artwork sits 2.6 px further left, so a
  centroid comparison with Chrome measured the installed font revision, not the renderer (fx, 2026-10-29: the
  renderer is 0.16 px from the device-font reference on both). Chrome's centroid is reported, not compared;
- the ★ slot (a system symbol font, not updatable) keeps the Chrome centroid comparison within 2 px;
- for example, the 👩‍💻 run is about 4 px wider on Android.

**Glyph tolerances.**
- Vertical glyph placement allows 1.5 CSS px, because Chrome snaps text baselines to whole pixels at DPR 1.
- Android allows 0.25 more for FreeType light hinting, which snaps horizontal glyph edges to device pixels.
- Exact font size, letter spacing, run box and font metrics are checked separately.

**Letter spacing on Android.** Compose/Minikin spreads letter spacing around glyphs, and may trim it at line edges. The renderer measures the run with and without spacing, rebuilds the CSS run box (advances plus one spacing per grapheme) and places the glyph origin exactly.

**Image loading.**
- `loading="lazy"` has no viewport-deferral natively: images load when shown.
- `crossorigin` has no CORS semantics natively; only the reload-on-change is reproduced.
- Percent sizes need a containing block and are not resolved (no oracle case).

**CEM drift.** `custom-elements.json` lists 11 hooks for md-avatar. It is missing the 14 palette hooks `--md-avatar-palette-{1…7}-container/label`, which the CSS documents and implements. The native APIs expose them as `paletteContainerColors`/`paletteLabelColors`.

**Open source decision (unchanged).** A resolved name palette overrides `--md-avatar-container-color` and `--md-avatar-label-color`. The palette classes take the bucket's palette hooks or tokens, so the two hooks only colour neutral avatars: `color-from-name=false`, or no initials, name or label to seed a bucket. Native mirrors this; Chrome's hook cases record it. Changing it is a source decision (see the source review).

**Pending:** the iOS simulator build and runtime run (Xcode licence) and the final audit.

## Session note (2026-10-24)

- **Gates 1, 2, 4 and 5.**
  - The blank-initials defect was fixed in the source, test first.
  - Chrome oracles: 282 paint cases, 52 identity cases and 4 lifecycle scripts. Three badge-in-slot cases were added
    after the Swift badge was first placed at the logical end instead of the physical top-right.
  - Both dedicated renderers are installed, and the parity tests pass on both platforms.
- **Android findings and fixes in the renderer, each measured:**
  - Compose did not apply a line height smaller than the font's own height. Baselines are now placed explicitly with
    the CSS half-leading of the primary font's ascent and descent, which corrected icon glyphs that sat 0.1 em low.
  - Compose spreads letter spacing around glyphs and may trim it at line edges. The renderer rebuilds the CSS run box
    and places the glyph origin from the run measured with and without spacing.
  - Android snaps glyph baselines and hints edges to device pixels. That accounts for at most 1.51 px against
    Chrome's whole-pixel baselines (macOS: 1.34), hence the documented 1.75 vertical tolerance.
- **Laboratory.**
  - The palette hooks became first-class appearance fields on both platforms (an API change; parity was re-verified).
  - An empty Compose slot lambda now shows the person icon.
  - Everything is installed by idempotent anchored edits (`work/avatar-lab/lab-patch.py`).
- **Not changed.** The CEM drift (14 palette hooks), the open source decision (the palette overrides the container and
  label hooks), `AUDIT.md`, and the iOS SDK run (Xcode licence pending).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeAvatarIntegration` | **2949/2949** | **2949/2949** | **2949/2949** |
| **Total** | **2949/2949** | **2949/2949** | **2949/2949** |

iOS 26.3 counts are with the harness emoji font-path redirect (ios-harness.md, Limits): the 26.3 simulator runtime does not ship the AppleColorEmoji file its own font cache names; without the redirect 2946/2948 (emoji drawn as LastResort boxes). iOS 18.6 needs no redirect.

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->

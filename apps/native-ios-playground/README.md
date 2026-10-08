# AWC native playground

Search the complete component catalog, interact with real SwiftUI previews, switch light/dark tokens, edit the complete component tree as JSON, and inspect emitted event payloads. The preview data comes from `AWCExamples`; adapters accept external properties and children.

## iOS / iPadOS

Requires Xcode 15+ with an iOS 17+ simulator or device SDK.

```sh
pnpm native:build
open apps/native-ios-playground/AWCPlayground.xcodeproj
```

Select the `AWCPlayground` scheme and an iPhone/iPad simulator, then Run. For a physical device, choose your development team in Signing & Capabilities. The project references the local `packages/native-ios` Swift package; it has no third-party dependencies.

A command-line simulator build:

```sh
xcodebuild -project apps/native-ios-playground/AWCPlayground.xcodeproj \
  -scheme AWCPlayground -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/awc-ios-build CODE_SIGNING_ALLOWED=NO build
```

## macOS native preview

The same SwiftUI library and playground compile on macOS 14+. This permits native rendering without an installed iOS simulator.

```sh
swift run --package-path apps/native-ios-playground AWCPlayground
```

To create a local `.app` bundle:

```sh
apps/native-ios-playground/scripts/build-macos-app.sh
```

## Offscreen rendering

`AWCSnapshots` renders every catalog fixture in both appearances using a native `NSHostingView`. It writes PNGs to the supplied directory; these are native macOS renders, not iOS simulator screenshots. This does not test user interaction, accessibility navigation, keyboard focus, or presented sheets.

```sh
swift run --package-path apps/native-ios-playground AWCSnapshots /tmp/awc-native-snapshots
```

## Single-component render API

The snapshot executable also accepts a data-only JSON request. Supplied properties override the root fixture while preserving its example children. No Swift, JavaScript or source strings are evaluated.

```json
{"tag":"md-chip","properties":{"label":"Design system","selected":true},"dark":false,"width":640}
```

```sh
swift run --package-path apps/native-ios-playground AWCSnapshots \
  --request /tmp/awc-request.json --output /tmp/awc-component.png
```

`tag`, `properties` and `dark` are required. `width` is optional (default 640), rounded to whole layout points and clamped to 320–1200. The layout height is clamped to 100–2000 points. Output metadata reports physical pixels, which can be larger on Retina displays. Unknown tags, malformed JSON, invalid field types and invalid native dimensions fail with nonzero status and a diagnostic on stderr. The output directory is created if needed and the PNG is written atomically.

A successful single render writes one JSON object to stdout:

```json
{"height":100,"platform":"macos","renderer":"SwiftUI","tag":"md-chip","width":640}
```

These are native **macOS SwiftUI** renders, not iOS simulator screenshots. No GUI application needs to be opened. Existing directory-based batch rendering remains available.

## Scope and verification

The package and generated wrappers were compiled and linked with the macOS SwiftUI SDK. The iOS project was structurally validated; an iOS SDK was unavailable in the development environment. See `packages/native-ios/NativeSupport.json` for property, event, method and slot support, including platform differences. The Properties panel exposes the source contract, which includes properties not yet handled by the native adapter.

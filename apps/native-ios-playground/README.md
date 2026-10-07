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

## Scope and verification

The package and generated wrappers were compiled and linked with the macOS SwiftUI SDK. The iOS project was structurally validated; an iOS SDK was unavailable in the development environment. See `packages/native-ios/NativeSupport.json` for property, event, method and slot support, including platform differences. The Properties panel exposes the source contract, which includes properties not yet handled by the native adapter.

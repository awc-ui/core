# AWC native compiler

Experimental source-contract compiler with explicit SwiftUI and Jetpack Compose adapters. All 81 current custom elements have generated native APIs and native renderer routes, including nested table, menu, list, and navigation elements. This is **not yet a lossless Stencil-to-native transpiler**. Generated property coverage does not mean every property, event, slot, or method has native behavior parity.

## Run

From the repository root, with the repository's supported Node version and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm native:build
pnpm native:test
pnpm native:check
pnpm native:playground
```

The browser workbench opens at `http://127.0.0.1:4177`. It shows the **web reference**, actual generated Swift/Kotlin code, source contracts, and native support gaps. Build `@awc-ui/core` first if its `dist` directory does not exist. On macOS, run `swift build --package-path apps/native-ios-playground` to enable live SwiftUI previews and snapshots in the iOS tab. Live mode forwards clicks and text input to a persistent native macOS view and displays its frames and events. iOS-specific behavior still requires the native playground and an iOS SDK. See `apps/native-playground/README.md` for setup and preview limitations.

Native playgrounds:

```sh
# Android SDK 36, JDK 17+, Gradle wrapper included
cd apps/native-android-playground
./gradlew :app:assembleDebug :native-ui:testDebugUnitTest
./gradlew :app:connectedDebugAndroidTest  # requires a device or emulator

# iOS: open with a full Xcode installation
open apps/native-ios-playground/AWCPlayground.xcodeproj

# macOS: run the same SwiftUI library and native playground using SwiftPM
swift run --package-path apps/native-ios-playground AWCPlayground
```

Android and Apple have independent build tooling; `native:build` generates sources and does not claim to compile applications. An Android compile and a macOS SwiftUI compile do not establish iOS simulator/device verification.

## Compiler pipeline

1. Parse the actual component `.tsx` files using the TypeScript AST. Extract decorators, property types/defaults, enum choices, events, methods, internal state, and the render tree. Constant initializers are parsed; component code is never executed.
2. Parse component CSS with PostCSS and preserve selectors/declarations in the intermediate representation (IR). Parse shared theme tokens into separate light/dark maps while retaining density and media scopes.
3. Detect browser-dependent APIs such as Shadow DOM, form internals, observers, DOM queries, measurements, and event cancellation.
4. Generate typed property containers, enum types, component wrappers, catalogs, and theme-token maps for SwiftUI and Compose.
5. Native wrappers delegate to hand-written platform adapters. Those adapters implement native rendering and interaction. Arbitrary TypeScript method bodies, JSX expressions, and CSS rules are **not** automatically translated at this stage.

The standard Custom Elements Manifest supplies documentation and slot metadata. Public property types and defaults come from the source AST. This keeps new source properties visible even before an adapter implements them.

## Layout

| Path | Purpose |
| --- | --- |
| `packages/native-compiler/src` | Source analysis, IR, code generation, support audit |
| `packages/native-compiler/generated/catalog.json` | All tags, source API, portability diagnostics, native support matrix |
| `packages/native-compiler/generated/ir` | One full IR document per element, including JSX and CSS |
| `packages/native-compiler/generated/tokens.json` | Original theme token values and scopes |
| `packages/native-ios` | SwiftUI adapters and generated Swift APIs |
| `packages/native-android` | Compose adapters and generated Kotlin APIs |
| `apps/native-ios-playground` | iOS Xcode app, macOS SwiftUI app, native snapshot tool |
| `apps/native-android-playground` | Android app and instrumentation tests |
| `apps/native-playground` | Browser reference, live SwiftUI previews and snapshots, source and support inspector |

Generated files are checked in so Xcode and Gradle consumers do not need Node just to build. Regenerate after changing a component, theme tokens, the compiler, or a native support policy. Native runtime implementations live outside the `Generated`/`generated` directories and are not overwritten.

## Native API examples

```swift
import AWCUI

AWCButton(
    properties: .init(variant: .tonal, disabled: false),
    children: [.text("Continue")],
    onEvent: { event in print(event.name, event.detail) }
)
```

```kotlin
import dev.awc.nativeui.generated.*

AWCButton(
    properties = AWCButtonProperties(variant = AWCButtonVariant.TONAL),
    onEvent = { name, detail -> println("$name: $detail") },
    content = { slot -> if (slot.isEmpty()) Text("Continue") },
)
```

Structured source properties use JSON-shaped values (`AWCValue`) rather than attempting to transpile arbitrary TypeScript types. Properties recognized as string unions become native enums. Unsupported initializer expressions produce diagnostics and optional native defaults instead of executing JavaScript during compilation. DOM objects are not present in native event payloads.

## Coverage and limitations

```sh
pnpm native:audit
node packages/native-compiler/src/cli.mjs check --strict
```

`native:check` verifies deterministic generated-file freshness. `--strict` additionally rejects incomplete API coverage and browser-portability findings. It currently **fails intentionally**: the project is an inspectable native migration baseline, not a completed compatibility layer.

Per-platform policies (`NativeSupport.json` / `support.json`) enumerate implemented source properties, event names, slots, and differences. They are declarations of adapter coverage, not proof of behavioral equivalence. Source imperative DOM methods, HTML forms, cancellation/bubbling semantics, advanced chart modes, web accessibility roles, CSS cascade/layout behavior, and parts of complex component coordination need further work. Native accessibility and dynamic text sizing also require device testing.

Shared tokens currently drive supported native palette, shape, and typography values. Retaining all CSS token strings does not imply that every CSS shadow, easing expression, font family, density scope, or component override is interpreted on each platform.

To extend coverage: implement a behavior in the native adapter, add a meaningful native interaction test, then update its support policy and regenerate. Do not mark a property supported merely because a generated wrapper accepts it.

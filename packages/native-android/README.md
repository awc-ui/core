# AWC native Android adapters

An experimental Jetpack Compose library for all 81 AWC source component tags. It contains native controls and Canvas rendering, with generated source contracts and theme tokens. It does not embed a browser.

## Integration

The Android playground includes this Gradle module as `:native-ui`. Run the native compiler from the repository root before building so `generated/Components.kt`, `ComponentCatalog.kt`, and `Tokens.kt` exist.

```kotlin
AWCTheme {
    AWCComponent(
        tag = "md-button",
        properties = mapOf("variant" to "filled", "toggle" to true),
        onEvent = { name, detail -> println("$name: $detail") },
    ) { slot ->
        if (slot == "") Text("Create project")
    }
}
```

The compiler additionally emits typed property classes and convenience composables for each source component. The adapter API is:

```kotlin
@Composable fun AWCComponent(
    tag: String,
    properties: Map<String, AWCValue> = emptyMap(),
    modifier: Modifier = Modifier,
    onEvent: (String, AWCValue) -> Unit = { _, _ -> },
    content: (@Composable (String) -> Unit)? = null,
)
```

`AWCValue` accepts JSON-compatible scalars, lists, and maps. Props retain source camelCase names. Unchanged external values retain native interaction state; changing a prop resets its corresponding state. To hoist state, receive events and supply updated props. Slot content receives the source slot name; the default slot is `""`. Unknown tags fail immediately.

## Scope and differences

`support.json` is an explicit per-component list of supported source properties, events and slots. The native compiler uses this policy to report the remaining gaps. All source tags have a native adapter and playground entry; that is **not** complete visual or behavioral parity.

- Source properties cover a supported subset. Compose handles native keyboard, accessibility and gestures. DOM nodes, HTML forms, CSS cascade, cancelable DOM events and imperative browser methods are not translated.
- Charts are native Canvas implementations of baseline bars, lines, areas, pie/donut and sparklines. Advanced scales, stacking, curves, zoom, exact hit testing and full chart event payload parity remain unfinished.
- Date/time controls use native Material pickers. Date payloads use ISO strings in place of JavaScript `Date` instances.
- Some composition containers currently provide layout only. Accordion reordering/floating, linked tab panels, table pinning/sorting of arbitrary content and breadcrumb collapse remain gaps. Button groups, segmented sets, lists and accordions coordinate basic selection/expansion natively.
- Complete icon font parity, skeleton animation, fractional ratings, separated OTP cells, HSL color format and complete CSS color parsing require further work. Avatars load HTTP(S) images using native bitmaps.
- Supported theme colors, corner sizes and a subset of typography sizes map from generated source tokens. Native font metrics and shapes may differ. CSS `var()` aliases are resolved with bounded recursion; unresolved values use Material defaults.

Generated files are owned by the compiler. Adapter implementation and support policy are handwritten. Run `python3 packages/native-android/generate-support.py` after intentionally changing the supported subset.

## Validation

Pure property-contract tests live in `src/test`. Android instrumented tests compose all tags and exercise controlled checkbox state and transfer list movement. They require an emulator or device. A successful APK build alone does not verify screen layout, TalkBack, keyboard navigation or interaction parity.

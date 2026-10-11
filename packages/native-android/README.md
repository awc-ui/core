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

- Source properties cover a supported subset. Compose handles native keyboard, accessibility and gestures. `md-button` has explicit native equivalents for forms, cancelable actions, routing and named content, described below. DOM nodes, CSS cascade and imperative browser methods are not translated.
- Charts are native Canvas implementations of baseline bars, lines, areas, pie/donut and sparklines. Advanced scales, stacking, curves, zoom, exact hit testing and full chart event payload parity remain unfinished.
- Date/time controls use native Material pickers. Date payloads use ISO strings in place of JavaScript `Date` instances.
- Some composition containers currently provide layout only. Accordion reordering/floating, linked tab panels, table pinning/sorting of arbitrary content and breadcrumb collapse remain gaps. Button groups, segmented sets, lists and accordions coordinate basic selection/expansion natively.
- Complete icon font parity, skeleton animation, fractional ratings, separated OTP cells, HSL color format and complete CSS color parsing require further work. Avatars load HTTP(S) images using native bitmaps.
- Supported theme colors, corner sizes and a subset of typography sizes map from generated source tokens. Native font metrics and shapes may differ. CSS `var()` aliases are resolved with bounded recursion; unresolved values use Material defaults.

Generated files are owned by the compiler. Adapter implementation and support policy are handwritten. Run `python3 packages/native-android/generate-support.py` after intentionally changing the supported subset.

## Validation

Pure property-contract tests live in `src/test`. Android instrumented tests compose all tags and exercise controlled checkbox state and transfer list movement. They require an emulator or device. A successful APK build alone does not verify screen layout, TalkBack, keyboard navigation or interaction parity.

`md-button` has a dedicated Compose renderer using the source size/density ladder,
variant/toggle palettes, press/release shape timing, and pointer-origin ripple.
Its bundled Roboto and Material Symbols TTFs contain the original web font data;
see `font-licenses/`. The loader interpolates the original 48-vertex polygons.
Compose interaction state drives the visuals and emits `mdClick` before committing
selection, followed by `mdChange` for toggles. Native elevation shadows and font
rasterization remain platform-specific; this does not promise complete CSS or DOM
parity. Metric, palette, shape, and loader regressions are in
`NativeButtonContractTest`; device interaction checks live in the playground.

## Button forms, actions and navigation

`AWCFormScope` supplies the nearest explicit form to `md-button` with `type`
`submit` or `reset`. Register fields with `rememberAWCFormField`, bind their
observable values to native controls, and provide validation rules:

```kotlin
val form = rememberAWCFormState(
    onSubmit = { submission -> save(submission.values) },
    onInvalid = { errors -> showErrors(errors) },
)
AWCFormScope(form) {
    val name = rememberAWCFormField("name", "Ada") {
        if (it.toString().isBlank()) "Name is required" else null
    }
    AWCComponent("md-text-field", mapOf("value" to name.value), onEvent = { event, value ->
        if (event == "mdInput") name.value = value
    })
    AWCComponent("md-button", mapOf("label" to "Save", "type" to "submit"))
    AWCComponent("md-button", mapOf("label" to "Reset", "type" to "reset"))
}
```

Validation stores errors on each field; failed validation calls `onInvalid`
without submitting. Reset restores registered initial values and clears errors
before `onReset`. Nested forms isolate membership. The composable registration
unregisters on disposal; non-Compose callers can retain `form.register(...)`
and later call `form.unregister(field)`. Field initial values are captured when
registered; changing the initial-value argument does not redefine reset state.
These APIs do not discover controls or reproduce HTML constraint validation.

Wrap buttons in `AWCActionScope(onAction = { event -> ... })` to call
`event.preventDefault()` synchronously before selection, navigation or form
effects. Legacy `onEvent("mdClick", detail)` observes the proposed selection
first; then scopes run from inner to outer; accepted toggles emit `mdChange`
after committing. `stopPropagation()` only stops enclosing AWC action scopes
and does not cancel defaults or native OS input. DOM capture, `originalEvent`
and browser event propagation remain outside this API.

`AWCNavigationScope(AWCURLRouter { request -> ...; true })` receives an
allowlisted `request.url` and unchanged `request.target`. The default router
uses Android's URI handler for absolute URLs. Relative routes require an
application router. Unsafe raw links are refused and cannot accidentally submit
or reset a form. Target names are application metadata, not browser windows;
browser origins, modifier-click and browsing-context behavior are not implied.

`AWCSlotsScope(AWCSlotRegistry(mapOf("leading-icon" to { Text("★") })))`
provides explicit native slots. Supported names are `""`, `leading-icon`,
`trailing-icon` and `loader`. Registered content replaces the fallback even if
intentionally empty; removing its name restores fallback on recomposition.
Legacy `content(slotName)` lambdas continue to work. Arbitrary selectors and
DOM element lists are not exposed.

`AWCButtonBehaviorDemo` combines these public APIs in the live playground's
**Form & cancellation** scenario. It uses a real native text field, submit/reset
buttons, a toggle, cancellation switch and an intercepted example.com link.
`NativeButtonBehaviorTest` covers pure contracts and device-level composition,
including cancellation ordering, validation/reset, nested scopes and slots.

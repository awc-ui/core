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

## Shared button appearance

`AWCButtonAppearanceScope` supplies defaults to every native `md-button` in a
Compose subtree. Nest it around one generated `AWCButton` for local overrides;
valid local fields replace inherited fields individually. Omitted or malformed
fields inherit, so an empty appearance keeps the existing source rendering.

```kotlin
import dev.awc.nativeui.AWCButtonAppearance
import dev.awc.nativeui.AWCButtonAppearanceScope
import dev.awc.nativeui.generated.AWCButton

AWCTheme {
    AWCButtonAppearanceScope(AWCButtonAppearance(
        containerColor = "#3355AA", labelColor = "#FFFFFF", fontWeight = 600.0,
    )) {
        AWCButtonAppearanceScope(AWCButtonAppearance(
            iconSize = 24.0, cornerRadius = 12.0, paddingInline = 24.0,
        )) {
            AWCButton { slot -> if (slot == "") Text("Continue") }
        }
    }
}
```

Colors accept `#RRGGBB`: `containerColor`, `labelColor`, `iconColor`,
`trailingIconColor`, `loadingColor`, `stateLayerColor`, `outlineColor`.
All numeric parameters are nullable `Double`; dimensions use dp and typography
uses sp. Accepted ranges are:

| Fields | Range |
| --- | --- |
| `iconSize`, `trailingIconSize`, `loadingSize` | 8–128 |
| `fontSize` / `lineHeight` | 8–96 / 8–160 |
| `fontWeight` | Integer 100–900 |
| `letterSpacing` | −5–20 |
| `cornerRadius` / `outlineWidth` | 0–200 / 0–16 |
| `paddingInline`, `paddingBlock` / `gap` | 0–128 / 0–64 |
| `hoverOpacity`, `focusOpacity`, `pressedOpacity` | 0–1 |

`paddingInline` is the per-side inset measured from the outer border edge;
`paddingBlock` is per-side content padding inside the stroke. Original minimum
button dimensions remain. An explicit corner radius stays fixed during press,
selection and connected-button rendering. An explicit outline width enables a
stroke on any variant; outline color alone retains that variant's source width.
Disabled custom content retains 0.38 alpha, container and outline 0.12.

Trailing icon size/color inherit the corresponding leading icon override unless
provided separately; icon and loading colors otherwise inherit label color.
Loading size remains independent. Named icon/loader slots inherit the part color
and explicit size constraint; explicit styling inside caller content takes
precedence. Label slots inherit the text style and content color. Empty slots do
not acquire an icon merely because an appearance size is set. A line-height
override reserves a minimum line box without clipping taller native glyphs.
State-layer opacities do not change the source ripple opacity.

These are typed native visual equivalents for anchor, state layer, icons, label
and loader. They do not implement CSS selectors, CSS parts or the CSS cascade.
Font synthesis/rasterization and native text metrics remain platform-specific.
The debug live host accepts `buttonAppearanceDefaults` and `buttonAppearance`
objects with these same fields; invalid native inputs are ignored per field.

## Button forms, actions and navigation

`AWCFormScope` automatically registers the 13 source form field families rendered
through `AWCComponent`. Fields need no manual value binding or validation callback:

```kotlin
val form = rememberAWCFormState(
    onSubmit = { submission -> save(submission.entries, submission.encoded) },
    onInvalid = { errors -> showErrors(errors) },
    onSubmitEvent = { event -> if (!canSubmit) event.preventDefault() },
    onResetEvent = { event -> if (!canReset) event.preventDefault() },
)
AWCFormScope(form) {
    AWCComponent("md-text-field", mapOf(
        "name" to "name", "value" to "Ada", "required" to true,
        "minLength" to 2, "maxLength" to 40,
    ))
    AWCComponent("md-button", mapOf("label" to "Save", "type" to "submit"))
    AWCComponent("md-button", mapOf("label" to "Reset", "type" to "reset"))
}
```

Membership covers text fields, checkboxes, radios, switches, select/multi-select,
autocomplete, sliders, number fields, date/time pickers, rating and OTP fields.
The scope tracks their native edits and changed external values. It validates
unnamed controls too, excludes disabled controls from validation/data, and keeps
soft-disabled values. Radio selection coordinates siblings with the same name.
`AWCFormRules` provides required, UTF-16 min/max length, whole-value pattern,
email/absolute-URL and numeric min/max/step validation. Rules are applied to each
source family: number fields clamp on commit; date pickers constrain choices;
time ranges may span midnight. Native patterns use Kotlin/Java regex syntax,
not HTML's JavaScript `v` grammar. Browser-only input types and validation popups
are not emulated. Revealed errors clear as valid values are entered.

`AWCFormSubmission.entries` is authoritative ordered data, including repeated
names and multi-values. Disabled, scalar unnamed and unchecked checkbox/radio
controls are omitted. Composite source controls preserve explicit empty keys
(multi-select/multiple autocomplete and a partially named range slider).
`values` is a convenience grouped map. `encodeAWCForm(entries)` generates UTF-8
URL-encoded data with CRLF line endings and performs no network request.
Source `md-button` has no form name, so its click value is **not** inserted into
form data. Native callers may explicitly pass `submitterEntry` to `form.submit`.

Submit validates before its cancelable `onSubmitEvent`, then calls `onSubmit`.
Reset calls `onResetEvent` before restoring initial values and clearing errors;
it fabricates no input/change events. OTP reset clears its code, matching the
source. Native IME/hardware Enter in eligible single-line fields activates the
first associated submit button through its cancelable action; a blocked first
button is not skipped. With no button it submits the scope directly. Number
fields commit and submit directly, matching their source-specific behavior.
Modifier/repeated Enter and multiline fields do not implicitly submit.

Nested form scopes isolate membership. For external controls, put both branches
under `AWCFormRegistryScope`, declare `AWCFormScope(form, id = "account")`, and
wrap the external controls in `AWCFormOwnerScope("account")`. This is an explicit
native owner registry, not DOM lookup. Data order follows registration order;
re-register reordered retained keyed controls when order matters. Custom controls
can still use `rememberAWCFormField` or `form.register`/`unregister`; their initial
values are retained until unregistration, and manual validation remains optional.

`AWCActionScope(onAction = { event -> ... })` remains the bubble-listener API.
Add `id`, `onCapture` and ordered `AWCActionListener` entries to observe capture
from outer to inner, the target, then bubble from inner to outer. Wrap one
button in `AWCActionTargetScope(id = "save", onAction = { ... })` for target
listeners. Stable `targetID`, target-first `path`, `currentScopeID` and `phase`
identify delivery without exposing DOM nodes. Membership and listener lists
are snapshotted for each synchronous dispatch. After dispatch, phase returns to
`NONE` and current scope is cleared; the stable path remains available.

`preventDefault()` cancels `mdClick` selection, navigation and form defaults.
`stopPropagation()` allows remaining listeners on the same scope or target but
stops subsequent scopes; `stopImmediatePropagation()` also stops remaining
listeners on that scope or target. Neither propagation control cancels defaults.
Legacy `onEvent("mdClick", detail)` always observes after scoped dispatch, even
when capture stopped target delivery. Accepted toggles commit before dispatching
noncancelable `mdChange`; attempts to cancel that notification have no effect.
A native event with `bubbles = false` still captures and reaches its target;
`crossesBoundaries = false` stops its path at the nearest explicit scope boundary.
Activation metadata remains `unknown` unless a caller supplies a known source.
This does not expose a DOM MouseEvent, `isTrusted`, modifier/middle-click browser
behavior, shadow-tree retargeting or cancellation of native OS input.

```kotlin
val navigation = rememberAWCNavigationCoordinator(
    baseURL = "https://awc.local/demo/",
    shouldNavigate = { transition -> canPresent(transition.url) },
    onPresent = { transition -> presentNativeScreen(transition.contextID, transition.url) },
)
AWCNavigationScope(navigation) {
    AWCComponent("md-button", mapOf("label" to "Report", "href" to "reports", "target" to "report"))
}
```

`AWCNavigationCoordinator` resolves allowlisted relative links against the source
context's current URL at activation time. `_self` and empty targets navigate the
source context, `_parent` its parent, `_top` its root, `_blank` a new context,
and named targets reuse a native destination. New navigation contexts are top-level;
only explicit `createContext()` establishes a parent. Reserved target matching ignores
case. Contexts expose observable URL/history/index state, `back()` truncates the
forward branch on subsequent navigation, and `close()` removes a child and its
descendants. `createContext()` defines explicit native parent relationships;
`AWCNavigationScope(navigation, contextID)` pins a source context when needed.
`shouldNavigate` rejects before any context/history mutation. Reentrant mutations
are refused during approval (`createContext` throws if invoked there); `onPresent` runs
after commit. The coordinator never fetches a page or opens an external app.

`AWCNavigationScope(AWCURLRouter { request -> ...; true })` and its existing
request API remain available. The legacy fallback opens absolute Android URIs.
Unsafe raw links cannot accidentally submit/reset a form. Native contexts are
application state, not browser windows, origins or opener relationships. Native
named reuse is deliberate: source `window.open` with `noopener,noreferrer` may
create a fresh browser context even for a name. URLs use native URI parsing;
applications own destination presentation.

`AWCButtonNavigationDemo` provides the **Navigation & events** scenario with
real native buttons in an explicit root → section → editor hierarchy, target
selection, local context/history display, capture/
target/bubble trace, default cancellation, both propagation controls and host
navigation rejection. All routes stay under the local example base and no
external destination opens.

`AWCSlotsScope(AWCSlotRegistry(mapOf("leading-icon" to { Text("★") })))`
provides explicit native slots. Supported names are `""`, `leading-icon`,
`trailing-icon` and `loader`. Registered content replaces the fallback even if
intentionally empty; removing its name restores fallback on recomposition.
Legacy `content(slotName)` lambdas continue to work. Arbitrary selectors and
DOM element lists are not exposed.

`AWCButtonBehaviorDemo` combines these public APIs in the live playground's
**Form & cancellation** scenario. It uses a real native text field, submit/reset
buttons, a toggle, separate action/form cancellation switches, an Enter hint, encoded submitted data and an intercepted example.com link.
`NativeButtonBehaviorTest` covers pure contracts and device-level composition,
including cancellation ordering, validation/reset, nested scopes and slots.


## Native button focus and roles

`md-button.groupTabindex` accepts `null` (normal traversal), `0` (a sequential
entry) and `-1` (skipped by Tab/Shift+Tab). Minus one keeps the click/accessibility
action and can be focused by touch or `AWCButtonFocusState.requestFocus()` through
`AWCButtonFocusScope`. The request first enables the target for programmatic
focus, then requests real Compose focus after recomposition; it is not left
permanently unfocusable. Direct arbitrary `FocusRequester` access to the internal
button target is not exposed. Positive browser tabindex ordering is not emulated.

Pointer presses keep real focus and group ownership without showing keyboard
focus styling. Keyboard navigation and explicit `requestFocus()` show the focus
indicator; `isFocusVisible` reports that distinction. The keyboard ring matches
the source's 3dp width and 2dp gap, including connected corners. Pointer input
clears the ring and focus tint even when the button was already focused.

Enter/Space activation uses the source's 150ms press pulse, so even a quick
keydown/keyup visibly morphs the shape and starts a centered ripple. Activation
runs once on keydown; keyup does not emit another click. The pulse shares the
pointer interaction renderer and Compose frame clock, respects `shapeMorph`
and `ripple`, and is blocked for disabled, soft-disabled and loading controls.

```kotlin
val focus = remember { AWCButtonFocusState() }
AWCButtonFocusScope(focus, onFocusChanged = { focused -> /* observe native focus */ }) {
    AWCComponent("md-button", mapOf("label" to "Secondary", "groupTabindex" to -1))
}
// Later, while attached: focus.requestFocus()
```

`md-button-group` automatically owns one sequential stop across its native
button/icon-button children. Recent focus/activation wins, then the selected
single-select child, then the first eligible child. Left/Right wrap and reverse
in RTL; Home/End jump to endpoints. Focus does not change selection or emit a
click. Enter/Space keep native activation. Only hard `disabled` excludes a child;
`softDisabled` and `loading` remain focusable but block activation. Up/Down are
not group navigation keys; their platform behavior remains native. Removal and
disabling recompute eligibility. Nested groups use nearest native membership;
retained keyed reorder requires re-registration to change traversal order.

`roleOverride` currently maps empty/`button` to `Role.Button`, and `gridcell` to
native collection-item semantics without assigning a misleading Button role.
A cell exposes `Selected` independently of `toggle`, retains click/enabled
semantics and works with `groupTabindex`. Supply its real grid dimensions and
position through `AWCGridScope` and `AWCGridCellScope`:

```kotlin
AWCGridScope(rows = 6, columns = 7) {
    AWCGridCellScope(row = 2, column = 3) {
        AWCComponent("md-button", mapOf("label" to "15", "roleOverride" to "gridcell",
            "selected" to true, "groupTabindex" to -1))
    }
}
```

Unknown role strings safely fall back to Button semantics. Other ARIA roles,
DOM accessibility nodes, browser link-role machinery and full TalkBack speech
parity are not claimed. Collection semantics are tested at the real Compose
accessibility tree; automated tests do not substitute for manual TalkBack review.
The Material date-picker retains its own native calendar navigation; a standalone
`gridcell` does not gain calendar arrow handling from its role.

`AWCButtonAccessibilityDemo` powers **Focus & accessibility**, with real before/
after buttons, a roving group, RTL control and an explicitly focusable grid cell.
Device regressions send real Compose hardware Tab, Shift+Tab, arrows, Home/End
and Enter, and inspect selected, click, role and collection semantics.

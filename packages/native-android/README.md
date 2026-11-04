# AWC native Android adapters

An experimental Jetpack Compose library for all 81 AWC source component tags. It contains native controls and Canvas rendering, with generated source contracts and theme tokens. It does not embed a browser.

## Laboratory presentation

The debug live-preview host wraps its selected component in `AWCPreviewScope`.
Inside this explicit preview-only scope, dialogs, sheets, menus, and date/time/color
pickers render native Compose content in the captured view hierarchy. Pointer,
keyboard, and text commands therefore reach the same content that the browser sees.
Outside the scope, production adapters continue using their normal platform
dialog and popup windows.

The preview canvas expands while a modal is open; the legacy menu adapter is
centered and sheets use a fixed viewport. FAB menus use their authored anchor
and actual viewport through `AWCFabMenuScope`. System-window placement, platform scrims, and sheet dragging
are not reproduced. This scope is for isolated component tooling, not production
modal navigation. Keyboard Escape and existing native actions dismiss previews.

The host's optional `slots` JSON map accepts literal text (including empty strings)
for explicitly supported text slots. It preserves structural fixtures such as tab
items, table rows, menus and action buttons. Limits are 32 entries, 80 characters
per name, 4096 UTF-8 bytes per value, and 32768 bytes in total. The older button
`text` field remains supported; an explicit default-slot override takes priority.
Named button icon slots also accept `{"kind":"symbol","value":"favorite"}`;
the loader additionally accepts `{"kind":"progress"}` for a real 24dp circular
progress indicator. Icon buttons accept text/symbol descriptors for their default
and `selected` slots. Explicit empty Text content replaces the fallback glyph;
omitting the slot restores it. These descriptors create native content, never HTML.

For measurement tools, wrap one `AWCComponent` in `AWCInspectionScope(collector)`.
`AWCInspectionCollector.snapshot()` returns native bounds and available renderer
metrics, with stable part IDs and parent relationships. Layout values use dp;
typography uses sp. Buttons report their surface, content and present label,
icon and loader parts. Icon buttons report their root, state layer and active
icon wrapper/glyph. Other adapters report their root bounds. Custom Text
slots can attach both members of `rememberAWCInspectionText(...)`, supplying
the name of the actual configured font resource. Unreported styles remain
absent. Collection is opt-in and UI-thread-only; capture tools should retain
the immutable snapshot belonging to the frame they render.

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
`trailingIconColor`, `loadingColor`, `stateLayerColor`, `outlineColor`, `focusRingColor`.
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
| `width`, `minWidth`, `maxWidth`, `height`, `minHeight` | 0–2400 |

`paddingInline` is the per-side inset measured from the outer border edge;
`paddingBlock` is per-side content padding inside the stroke. Original minimum
button dimensions remain unless overridden by `minWidth`/`minHeight`. Explicit
width takes precedence over `fullWidth`; minimum dimensions take precedence over
conflicting requested and maximum dimensions. Requested sizes can overflow a
smaller parent, and the rendered content clips at the button surface.
An explicit corner radius stays fixed during press and selection; connected
edges use the source connected-corner rules. An explicit outline width enables a
stroke on any variant; outline color alone retains that variant's source width.
Disabled custom content retains 0.38 alpha, container and outline 0.12.

Trailing icon size/color inherit the corresponding leading icon override unless
provided separately; icon and loading colors otherwise inherit label color.
The default loader uses 70% of the resolved icon size, with a 10dp floor;
`loadingSize` overrides it independently. Named icon slots inherit the part color,
resolved size, RTL mirroring and trailing expansion rotation. A supplied loader
inherits color but retains its authored dimensions. Label slots inherit the text
style and content color. Empty slots do
not acquire an icon merely because an appearance size is set. An explicit
line-height sets the label slot's line box; taller glyphs overflow that box and
clip at the button surface.
State-layer opacities do not change the source ripple opacity.

These are typed native visual equivalents for anchor, state layer, icons, label
and loader. They do not implement CSS selectors, CSS parts or the CSS cascade.
Font synthesis/rasterization and native text metrics remain platform-specific.
The debug live host accepts `buttonAppearanceDefaults` and `buttonAppearance`
objects with these same fields; invalid native inputs are ignored per field.

## Icon button appearance and actions

`AWCIconButtonAppearanceScope` exposes the nine `md-icon-button` style hooks:
`containerColor`, `iconColor`, `stateLayerColor`, `iconSize`, `cornerRadius`,
`outlineColor`, `outlineWidth`, `width`, and `height`. Colors are `#RRGGBB`.
Dimensions use dp, with 0–2400 accepted for icon size, radius, width and height,
and 0–16 for outline width. Invalid fields inherit the surrounding valid values.

```kotlin
AWCIconButtonAppearanceScope(AWCIconButtonAppearance(
    width = 56.0,
    height = 56.0,
    iconSize = 24.0,
)) {
    AWCComponent("md-icon-button", mapOf(
        "variant" to "tonal",
        "toggle" to true,
        "aria-label" to "Save to favorites",
    )) { slot ->
        when (slot) {
            "" -> AWCMaterialSymbol("favorite")
            "selected" -> AWCMaterialSymbol("check")
        }
    }
}
```

The native renderer follows all five source size/density rungs and the three
width modes. A custom radius changes the resting shape; selected and pressed
morphs retain their source targets. Connected corners take precedence. Standard
and outlined disabled variants preserve custom container colors; disabled
filled/tonal containers and all disabled icons use the source muted palette.
The debug host accepts `iconButtonAppearanceDefaults` and `iconButtonAppearance`.

`mdClick` reports `{ selected }` after navigation and selection have committed.
`AWCActionScope` provides native capture/target/bubble notification, but canceling
this notification cannot undo the earlier effects. No `mdChange` is emitted.
`AWCNavigationScope`, `AWCButtonFocusScope` and `AWCSlotsScope` also work with icon
buttons. Supply `aria-label` for the accessible action name; `AWCMaterialSymbol`
is decorative unless explicitly given its own description.

Direct default-slot badges adorn the icon without replacing it. Direct avatars
retain their own dimensions. See [the icon-button audit](audits/md-icon-button.md)
for measured evidence and native boundaries.

## FAB menu lifecycle and authored anchors

Wrap the native viewport in `AWCFabMenuScope`, then author the anchor and menu
separately. Give the anchor an `id` property and set the menu's `anchor` property
to that same ID. The scope tracks actual native coordinates and observes outside
input without blocking the underlying content. It should contain the whole
viewport where outside dismissal is expected, rather than just the anchor.

`rememberAWCFabMenuController()` creates a controller for one
`AWCFabMenuControllerScope(controller)` containing the menu. Its suspending
`show()`, `close()` and `whenClosed()` preserve separate opening acceptance and
completed closing. `close()` returns while the 180ms closing phase may still be
visible; await `whenClosed()` when subsequent work requires it to be gone.
Call these methods from a coroutine. Initially open menus do not announce a new
`mdOpen` event or steal focus. Input on the anchor toggles the menu and suppresses
the anchor's own action, matching the source capture behavior.

Use the structural default slot for `md-fab-menu-item` children. Each item exposes
its `icon` slot and a default label slot. `AWCSlotText` renders and registers actual
text for live typeahead; `AWCSearchableLabelScope` supplies a searchable name for
custom native label compositions. A nonempty label property visually masks its
slot while leaving that composition mounted.

`AWCFabMenuAppearanceScope` exposes itemContainerColor, itemLabelColor and itemGap.
`AWCFabMenuItemAppearanceScope` exposes containerColor, labelColor, iconColor,
iconSize and cornerRadius. Colors use `#RRGGBB`, geometry uses dp. Menu lifecycle
and item action callbacks have null detail; scoped native actions carry actual
input provenance separately. See [the Menu and Item audit](audits/md-fab-menu.md).

## Badge anchors and appearance

`AWCBadgeHost(badge = { ... }) { ... }` keeps the content's native size and overlays
the badge using that measured parent. Its `shape` property selects the rectangular
corner or circular 45-degree rim; placement uses physical top/right in either text
direction, matching the source. A Badge assigned directly to an IconButton uses
the same anchor calculation and does not replace the icon.

`AWCBadgeAppearanceScope` exposes containerColor, labelColor, cornerRadius,
iconColor, iconSize, offsetX, offsetY, largeHeight, largePadding and smallSize.
Offsets use `AWCBadgeOffset(points, fraction)`, combining dp with a fraction of the
badge's own width or height. Padding uses physical
`AWCBadgePadding(top, right, bottom, left)` in dp. Zero remains a valid override;
colors use `#RRGGBB`. The named icon slot accepts real native content, including
an explicit empty replacement. `AWCMaterialSymbol` inherits its resolved size and
color. A nested Badge inherits its IconButton density when its own rung is omitted or
zero; a negative local rung overrides that value. The visible value follows the
source numeric threshold and four UTF-16-unit
slice; CSS-style whitespace collapse affects paint while the accessible name
retains the original displayed value. Native status updates are polite.

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
Button actions report `pointer` with local dp coordinates, `keyboard`, or
`accessibility` from the actual activation path. Implicit submission retains
`unknown`; it does not invent an input event. The live host exposes these values
separately from event detail, alongside final cancellation and scope path.
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

`AWCMaterialSymbol("favorite")` uses the bundled Material Symbols font and
inherits a button icon/loader slot's resolved size and color. Outside a button,
its default size is 20dp. An optional `size` and `modifier` can be supplied.
Symbols are decorative by default; provide `contentDescription` when a symbol
has its own meaning. Arbitrary supplied slot composables retain their own
accessibility semantics.

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

### Button Group

`md-button-group` coordinates native `md-button` and `md-icon-button` children in a retained, non-wrapping row. It supports all seven source properties, density-sensitive gaps, connected selected/pressed corners, standard neighbor press motion, single/multiple selection, required selection and logical keyboard traversal. Keyed reordering updates the actual child order without resetting selection.

Use `AWCButtonGroupAppearanceScope(AWCButtonGroupAppearance(...))` for `gap`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight` and `maxHeight` in dp. Values are optional and merge with inherited defaults. `fullWidth` overrides the authored width, while min/max bounds still apply. Source flex sizing divides the content box before adding button padding; an icon retains its definite height, and a child's minimum height may overflow a smaller group height unless the max-height hook caps it.

`AWCButtonGroupStateScope(state)` observes one group's actual selection through `AWCButtonGroupState.snapshot()`, returning booleans in authored child order. This preserves duplicate and empty values. `mdSelectionChange` separately reports source-shaped `values`, `added` and `removed` after child activation. Like the source's raw click handler, group reconciliation still occurs when a child action is canceled, soft-disabled or loading; required selection may select that child. Native scope membership replaces DOM descendant queries, and no browser `originalEvent` is fabricated.

### FAB appearance and temporary menu icon

`AWCFabAppearanceScope(AWCFabAppearance(...))` maps containerColor, iconColor,
iconSize, cornerRadius and labelColor to the five public FAB hooks. Dimensions are
dp. The `icon` content slot accepts real composables; `AWCMaterialSymbol` inherits
its resolved glyph size, while literal Text inherits the FAB's host typography.

```kotlin
val fab = rememberAWCFabController()
AWCFabControllerScope(fab) {
    AWCComponent("md-fab", mapOf("icon" to "add", "label" to "Create"))
}
// From a native UI callback after attachment:
val applied = fab.setMenuIcon("close")
fab.setMenuIcon(null) // restore the latest authored icon/slot
```

The Boolean result means the attached FAB accepted the update, including when
disabled; it does not wait for animation. `mdClick` callback detail is null in
place of a DOM MouseEvent. In `AWCActionScope`, the existing detail map is empty
and `activation` carries actual native input metadata. See [the FAB audit](audits/md-fab.md)
for measured verification and platform boundaries.

### Segmented buttons and sets

`md-segmented-button` is controlled when used alone: `mdSegmentClick` proposes a
selection without mutating the authored `selected` property. Inside
`md-segmented-button-set`, the parent commits by child identity and emits
`mdChange` as the exact ordered values array, including duplicate and empty values.
Scoped `AWCActionEvent.rawDetail` preserves the array; `segmentedSelectionValues`
provides a typed accessor. The existing map-shaped `detail` remains a compatibility
view. Preventing default does not undo the set's source-defined commit.

`AWCSegmentedButtonSetStateScope(state)` exposes actual ordered Boolean selection
through `AWCSegmentedButtonSetState.snapshot()`. Single-select arrows focus and
activate the next hard-enabled child; multiselect arrows only focus. Right/Down
advance in authored order even in RTL. Soft-disabled segments retain focusability.

Use `AWCSegmentedButtonAppearanceScope(AWCSegmentedButtonAppearance(...))` for
containerColor, selectedContainerColor, labelColor, selectedLabelColor,
outlineColor, cornerRadius and iconSize. The named icon slot is additive to the
property/checkmark graphic. Use `AWCSlotText` for literal slot text,
`AWCMaterialSymbol` for a glyph, or `AWCSearchableLabelScope` to register the actual
text represented by arbitrary custom composition. This preserves the source's
initial authored-text decision without pretending native content has DOM
`textContent`. See [the Segmented audit](audits/md-segmented-button.md) for measured
geometry, event and keyboard evidence.

### Split Button

`md-split-button` renders two independently focusable native actions. The leading
action emits `mdLeadingClick` with null detail. The trailing action commits its
toggle before emitting `mdTrailingClick` with `{ checked }`; canceling the
notification does not reverse that commit. `AWCSplitButtonStateScope(state)`
observes the actual value through `state.snapshot()` without inventing a source
component method. A property label and default slot remain additive.

`AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance(...))` exposes
containerColor, labelColor, iconColor, outlineColor, cornerRadius and iconSize.
The last field affects the leading glyph; the trailing glyph retains its
source-defined size. Outlined ignores the container color hook.

`AWCPopupScope` and `AWCPopupTargetScope("authored-id")` connect the trailing
`controls` value to actual mounted native popup content. The accessibility action
moves focus into that target. Application code still controls opening and
closing; an absent target does not acquire a fake focus action. Popup kind,
expanded state and the custom menu label are exposed on the trailing action.
See [the Split Button audit](audits/md-split-button.md) for verification and the
native equivalents of browser-only objects.

### Loading Indicator

`md-loading-indicator` renders the source's 48-vertex shape morph and rotation,
with a 4.55-second cycle. It is an indeterminate progress indicator with one
accessible label and polite live-region semantics; the label is not visual text.
It has no default tabstop. A caller can explicitly attach a normal Compose
`Modifier.focusRequester(...).focusable()`; actual focus draws the source ring.

`AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(...))` exposes
color, size, shapeSize, containerColor and containerShape. RGB and RGBA colors,
explicit zero and inherited density are preserved. `AWCCornerShape` represents
physical asymmetric/elliptical corners using `AWCCornerLength(points, fraction)`;
fractions resolve against the respective box axis, followed by CSS overlap
normalization. Finite signed coefficients support combinations such as 50% minus
2 dp. The shape part has its own `AWCLoadingIndicatorShapeAppearanceScope` with
width, height and color. Oversized shape width shrinks to the host while height
can overflow and is clipped, matching the source flex layout.

`AWCAccessibilityAppearanceScope` supplies optional native environment overrides.
Reduced motion defaults to Android's animator preference and replaces the morph
with a two-second circular opacity pulse. Android has no public CSS forced-palette
mode: forcedColors defaults to false and is an explicit override using native
surface/on-surface colors. Increased system contrast is not described as forced
colors. These are environment preferences, not additional component properties.
See [the Loading Indicator audit](audits/md-loading-indicator.md) for evidence.

### Meter

`md-meter` is a read-only native range display. All fourteen source properties
are accepted, including the full `formatOptions` object. Omitted options format
the position in the range as a localized percentage; an explicit empty map
formats the clamped reading. `valueText` overrides both visible and accessible
text. Invalid locale/option combinations use the source's raw-number fallback.
Native ICU performs formatting; the Laboratory does not supply preformatted text.

`AWCMeterAppearanceScope(AWCMeterAppearance(...))` exposes indicatorColor,
trackColor, trackShape, height, labelColor, valueColor and size. Track shape uses
`AWCCornerShape`; colors support RGB/RGBA. `AWCTheme(tokenOverrides=...)` also
accepts bounded custom color-role names, preserving case and alpha. Circular
size and linear height remain independent, including explicit zero.

The host owns range semantics and the formatted description, with no default
tabstop, action or activity announcement. `AWCMeterRangeKey` retains the exact
Double minimum/maximum/value alongside Android's Float-based accessibility range.
Native inspection distinguishes circular path bounds from painted stroke bounds.
Reduced motion follows the Android animator preference; the explicit native
forced-colors environment override uses onSurface/outline for fill/track.

The bundled font is Roboto Latin. Arabic falls back to Android's installed
Noto Naskh Arabic, which has different glyph advances from macOS Chrome's Geeza
Pro. Exact Arabic formatting and the CSS line box are verified; cross-platform
Arabic glyph width remains an explicit unresolved typography boundary. See
[the Meter audit](audits/md-meter.md) for precise evidence and runtime limits.

### Progress Indicator

`md-progress-indicator` renders native flat/wavy linear and circular paths with
all fourteen source properties. `AWCProgressIndicatorAppearanceScope` exposes
the thirteen source color, physical corner and spacing hooks. Signed gap and
trailing space, explicit zero thickness, inherited density and RGB/RGBA remain
meaningful. The three source visual parts have actual native measurements.

A mounted false→true `complete` transition runs the source completion sequence
and emits one `mdComplete` with null detail. Initial true is inert; false does
not reset an already completed indicator. Flat circular retains its inactive
track; other modes self-hide while preserving layout. Indeterminate ignores
complete. No component methods or slots are invented.

`AWCProgressRangeKey` retains the exact Double accessible range alongside the
native Float range. There is no default action, tabstop or live region. Android
animator preferences supply reduced motion; `AWCAccessibilityAppearanceScope`
can explicitly override native reduced/forced-color environments. See the
[Progress Indicator audit](audits/md-progress-indicator.md) for source comparisons,
real completion/retained-update checks and native rendering limits.

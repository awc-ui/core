# Native forms, events and routing

`md-button` uses explicit native APIs for the browser-dependent portions of its
source. The renderer and contract tests share these APIs. They implement native
form behavior without DOM/ElementInternals objects or network submission.

```swift
@State private var form = AWCFormState(onSubmit: { submission in
    print(submission.entries)          // ordered, including repeated names
    print(submission.formURLEncoded()) // local UTF-8 application/x-www-form-urlencoded
})

var body: some View {
    AWCFormScope(form: form) {
        AWCEventScope(id: "editor", onEvent: { context in
            if context.event.name == "mdSubmit", shouldCancel {
                context.preventDefault()
            }
        }) {
            VStack {
                AWCNativeView(tag: "md-text-field", properties: [
                    "name": "name", "value": "Ada", "required": true,
                    "minLength": 2, "maxLength": 40
                ], onEvent: observe)
                AWCNativeView(tag: "md-button", properties: ["type": "submit"],
                              children: [.text("Save")], onEvent: observe)
                AWCNativeView(tag: "md-button", properties: ["type": "reset"],
                              children: [.text("Reset")], onEvent: observe)
            }
        }
    }
    .awcURLRouter(AWCURLRouter { request in
        appRouter.open(request.url, target: request.target)
        return true
    })
}
```

Every mounted field has a stable private registration identity, including multiple
generated wrappers with the same public `node.id`. The nearest `AWCFormScope`
owns its controls. Nested forms and same-name radio groups stay independent.
All 13 source field families register automatically: text-field, number-field,
OTP, checkbox, radio, switch, select, multi-select, autocomplete, slider, rating,
date-picker and time-picker. Unnamed controls still validate.

`AWCFormControl` applies source successful-value rules. Disabled controls are
excluded; soft-disabled controls remain participants. Unchecked checkboxes,
radios and switches contribute nothing; checked controls use configured values
(default `on`). Repeated names and multi-values remain ordered entries. Empty
select/date/single-autocomplete/OTP and zero rating are omitted; text and time
keep empty strings. Multi-select and multiple autocomplete preserve the source
FormData empty-name keys. Range sliders use nameStart/nameEnd falling back to
name, with no entries when all three names are empty. `values` groups repeated
names into arrays for convenient native access.

Use `register(id:name:value:rules:disabled:validator:onReset:)` for custom native
values. Optional `control:` applies a source descriptor's serialization rules;
without it the existing native value API remains unchanged. Re-registering an ID
preserves its initial reset snapshot. `setValue(_:for:)` updates current state;
`unregister(id:)` removes a control. Radio selection updates peer native bindings
without emitting synthetic input events. Reset restores registered initial
values and checkbox indeterminate state, clears validation messages, and clears
OTP values as the source does. It emits no input/change events.

`AWCFormRules` supports required values, UTF-16 lengths, common email/absolute-URL
inputs, numeric bounds and step (including fractional tolerance), and anchored
ICU patterns. Optional empty values pass minlength. Invalid regex is ignored.
Text numeric step bases use authored value/min rather than the current edit.
Time-picker validation supports overnight ranges. Required radio validation
belongs to its group; required OTP rejects incomplete codes unless its explicit
incompleteLabel is empty. Custom registration validators provide application
rules. Number-field commits clamp bounds before submission, while its source
validity rules are required/custom only. Native read-only text stays focusable,
blocks edits/clear, and is excluded from constraint validation.

Single-line text Enter calls `requestImplicitSubmit()`: the first registered
submit button activates through its real cancelable mdClick, including when it
is blocked (a later button is not substituted). Without a default, the form
submits directly. Source number-field commits and submits directly. Multiline
text inserts newlines; modified/repeated AppKit key events do not submit.

`submit()` validates, emits cancelable native `mdSubmit`, then constructs current
successful entries and calls `onSubmit`. `reset()` emits cancelable `mdReset`
before mutations or callbacks. Failed validation produces `mdInvalid` and
`onInvalid`. Form `onEvent` can synchronously veto; `observe` receives final
`defaultPrevented`. Component actions also propagate these events through
`AWCEventScope` and their legacy observation callback. These native form events
have the `native-form` tag. Source md-button calls requestSubmit with no submitter,
so its value is not added to submitted data. The optional native `submitter:`
argument carries explicit host metadata only.

For controls outside their nearest form, inject a shared local registry:

```swift
let registry = AWCFormRegistry(["profile": profileForm])
AWCFormRegistryScope(registry: registry) {
    AWCNativeView(tag: "md-text-field", properties: ["name": "email"])
        .awcFormOwner("profile")
}
```

Registry IDs are explicit native host IDs. Unknown owners do not silently fall
back to another form. The registry does not search windows, applications or DOM.
`AWCFormEncoding.urlEncoded(entries)` preserves order, encodes UTF-8 bytes,
normalizes line breaks to CRLF and uses `+` for spaces. It never sends a request.

`AWCEventScope` supplies native ancestor capture and bubble listeners.
`AWCEventTargetScope` supplies handlers at the actual component target. Dispatch
snapshots the target-first path, captures outer-to-inner, visits the target, and
bubbles inner-to-outer. Existing `onEvent` scope handlers remain bubble handlers.

```swift
AWCEventScope(id: "outer", onCapture: { context in
    print(context.phase, context.targetID, context.currentScopeID, context.path)
    if shouldCancel { context.preventDefault() }
}, onEvent: { context in
    print("bubble", context.event.name)
}) {
    AWCEventTargetScope(onEvent: { context in
        // stopPropagation retains other listeners at this target.
        // stopImmediatePropagation also suppresses remaining target listeners.
    }) {
        AWCNativeView(tag: "md-button", properties: ["toggle": true],
                      children: [.text("Toggle")], onEvent: observe)
    }
}
```

`AWCEventListener` arrays preserve same-phase listener order. `preventDefault`
vetoes cancelable mdClick before toggle, navigation and form effects; it does not
stop propagation. `stopPropagation` prevents travel to later nodes while allowing
remaining listeners at the current node. `stopImmediatePropagation` also stops
those listeners. Noncancelable mdChange follows committed toggle state.
`bubbles: false` still permits ancestor capture and target listeners.
An explicit `isBoundary` scope limits the path when `crossesBoundaries: false`.
Native target identity remains stable; there is no DOM shadow retargeting.

The legacy observation callback still runs after dispatch, even when propagation
stops. `AWCEvent.defaultPrevented`, `propagationPath` and optional `activation`
provide its final native metadata. Activation distinguishes nativeControl,
implicitSubmit and programmatic entry, with an action UUID shared by mdClick and
mdChange. It is not a raw OS event, DOM MouseEvent or browser isTrusted assertion.
Finished contexts retain target/path but clear phase/current scope and reject
late cancellation. Nested dispatch owns a separate transaction.

`AWCURLRouter` permits HTTP(S), mailto, tel, sms and ftp by default. Relative URLs
require an explicit base; a base provider can resolve against current native
state on every call. Executable/file/data URLs and control characters are rejected.
Any raw href makes the button a link, so rejected links never submit/reset.
Injected routing receives target; default SwiftUI openURL delegates to the host.

`AWCNavigationCoordinator` supplies an observable local presentation model:

```swift
let navigation = AWCNavigationCoordinator(
    baseURL: URL(string: "https://awc.local/demo/")!
)
_ = navigation.createContext(id: "editor", parentID: navigation.rootID)
navigation.shouldNavigate = { request in appPolicy.allows(request.url) }
navigation.onPresent = { transition in
    // State/history is committed here; present your own native destination.
    presentNativeScreen(contextID: transition.destinationID)
}
AWCNativeView(tag: "md-button", properties: ["href": "next", "target": "details"],
              children: [.text("Open details")])
    .awcURLRouter(navigation.router(from: "editor"))
```

Use a safe absolute base URL as host configuration. Each route is validated
before selecting or creating a destination. Relative URLs use the current source
context, including retained routers and relative child-context initial URLs.
Empty or case-insensitive `_self` uses the source; `_parent` uses its native owner
or itself; `_top` follows native owners; `_blank` always creates a distinct native
top-level context. Ordinary named targets reuse a local named context. Other
underscore-prefixed targets and invalid native names are rejected.

`shouldNavigate` can veto before context/history mutation. `onPresent` observes
committed state; synchronous reentrant navigation during these callbacks is
rejected. `back(in:)` visits local history with the same approval contract, and a
new route after Back discards the forward branch. The coordinator never loads
HTTP content or opens an external application. Native named reuse intentionally
differs from the source browser's noopener/noreferrer route, which can create a
fresh browsing context for a named target. Native contexts do not implement
browser origin isolation, opener/referrer relationships or window/document.

`AWCButtonNavigationDemo` displays capture/target/bubble trace, click cancellation,
both propagation stops, host rejection, native contexts, target routing and Back.
Its base is https://awc.local/demo/ and every route stays local. Demo observations
`mdPropagation` and `mdNavigate` use explicit native-event/native-navigation tags;
they are not additional source md-button events.

`AWCNode.children(inSlot:fallback:)`, `firstDescendant(id:)` and `descendants(tag:)`
provide explicit native content lookup. Current declarative children control slot
fallback; no CSS selectors or imperative HTMLElement references are involved.

`AWCButtonBehaviorDemo` shows name editing, validation, Enter, submit/reset,
button toggling, independent click/form-event cancellation, local encoded data,
and an intercepted link. The toggle resets with the form but is not a form entry.

The equivalence is scoped to native forms. Browser validation bubbles,
ValidityState flags, HTML dirty-value timing, JS regex v-mode, browser URL parser,
autofill, composition/deferred autocomplete submission, DOM tree ordering,
ElementInternals, form attribute processing and HTTP navigation are not emulated.

## Verification

With Xcode's XCTest SDK, run `swift test --package-path packages/native-ios`.
On Command Line Tools only, the shared contract checks run with:

```sh
packages/native-ios/scripts/test-native-behavior.sh
```

`Tests/NativeBehaviorViewIntegration.swift` hosts actual SwiftUI controls in its
own private offscreen AppKit window. It checks all 13 automatic families,
duplicate wrapper IDs, native text edits and checkbox/radio clicks, reset,
external/nested owners, stable numeric step validation, and real field-editor
Enter through default button activation, validation and form-event cancellation.
It also clicks actual native buttons to verify capture/target/bubble, both
propagation stops, final activation metadata, cancellation, injected navigation,
blank/named contexts and host routing veto.
Run `packages/native-ios/scripts/test-native-views.sh` from a macOS WindowServer
session. It operates on no other windows. These are macOS checks; iOS SDK and
simulator validation require full Xcode.

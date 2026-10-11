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

`AWCEventScope` propagates synchronously from the closest scope outward.
Cancelable mdClick precedes toggle, URL routing and form actions.
`stopPropagation()` does not cancel default actions. Legacy `onEvent` observes
final cancellation; mdChange follows accepted toggles. Loading/disabled buttons
dispatch no activation. Browser capture, original events, composed paths and
shadow retargeting are not implemented.

`AWCURLRouter` permits HTTP(S), mailto and tel by default. Relative URLs require
an explicit base. Executable/file/data URLs and control characters are rejected.
Any raw href makes the button a link, so rejected links never submit/reset.
Injected routing receives target; default SwiftUI openURL does not create browser
browsing contexts.

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
Run `packages/native-ios/scripts/test-native-views.sh` from a macOS WindowServer
session. It operates on no other windows. These are macOS checks; iOS SDK and
simulator validation require full Xcode.

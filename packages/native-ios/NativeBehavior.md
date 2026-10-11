# Native forms, events and routing

`md-button` uses explicit native APIs for the browser-dependent portions of its
source. These APIs are shared by the renderer and the contract tests; they are
not a DOM or HTML form implementation.

```swift
@State private var form = AWCFormState(onSubmit: { submission in
    print(submission.values)
})

var body: some View {
    AWCFormScope(form: form) {
        AWCEventScope(id: "editor", onEvent: { context in
            if context.event.name == "mdClick", shouldCancel {
                context.preventDefault()
            }
        }) {
            VStack {
                AWCNativeView(tag: "md-text-field", properties: [
                    "name": "name", "value": "Ada", "required": true
                ])
                AWCNativeView(tag: "md-button", properties: ["type": "submit"],
                              children: [.text("Save")], onEvent: observe)
                AWCNativeView(tag: "md-button", properties: ["type": "reset"],
                              children: [.text("Reset")], onEvent: observe)
            }
        }
    }
    .awcURLRouter(AWCURLRouter { request in
        // request.target is a host routing hint, not a browser window name.
        appRouter.open(request.url, target: request.target)
        return true
    })
}
```

Each mounted field has a stable private registration identity. Multiple generated
wrappers of the same tag therefore remain separate even though their public
`node.id` values may be equal. The nearest `AWCFormScope` owns a field; nested
forms stay independent. Names determine submitted values, and duplicate names
become arrays in registration order. Disabled registrations are excluded.

Named text, number, OTP, select, multi-select, autocomplete, checkbox and switch
controls register automatically. Register other host-owned values with
`form.register(id:name:value:rules:disabled:validator:onReset:)`, update them with
`setValue(_:for:)`, and unregister on removal. Re-registering an ID retains its
first value as the reset value. `reset()` updates registered bindings, clears
validation messages and calls `onReset`; `submit(submitter:)` validates before
calling `onSubmit`, otherwise calls `onInvalid`.

`AWCFormRules` provides required, length, numeric bounds and anchored ICU regular
expressions. A registration can add a synchronous custom validator. Swift string
length, ICU patterns and boolean checkbox/switch values are native conventions;
they are not HTML constraint validation or FormData serialization. Implicit Enter
submission, ElementInternals, form owner attributes, HTTP encoding and browser
validation UI are not provided.

`AWCEventScope` calls handlers synchronously from the closest scope outward.
`preventDefault()` on cancelable `mdClick` suppresses toggle, navigation and form
effects. `stopPropagation()` only stops outer native handlers. The legacy
`onEvent` callback observes the click after dispatch, including
`event.defaultPrevented`; `mdChange` follows an accepted toggle. These scopes do
not implement browser capture, composed paths, original events or shadow
retargeting. Loading and disabled buttons dispatch no activation.

`AWCURLRouter` validates schemes before passing `AWCURLRequest` to the host.
HTTP(S), mailto and tel are allowed by default; relative links require a base URL.
Executable/file/data URLs and control characters are refused. The raw presence
of `href` always makes the button a link, so an invalid link never submits or
resets a form. The default SwiftUI `openURL` fallback does not interpret target;
an injected router receives it explicitly and decides the native destination.

`AWCNode.children(inSlot:fallback:)`, `firstDescendant(id:)` and
`descendants(tag:)` replace native child/slot lookup. They return declarative
nodes and do not execute CSS selectors. The button consults current children on
each render, restoring fallback content after assigned children are removed.

`AWCButtonBehaviorDemo` is a reusable native demo: edit Ada, submit or reset,
toggle a button, cancel actions before effects, and route a link into an event
without opening external applications. Its `mdSubmit`, `mdReset`, `mdInvalid`
and `mdNavigate` observations have the explicit `native-form` tag; they are demo
form/router events, not additional source md-button events.

## Verification

With Xcode's XCTest SDK, run `swift test --package-path packages/native-ios`.
The same 55 behavior checks can run with Command Line Tools only:

```sh
packages/native-ios/scripts/test-native-behavior.sh
```

`Tests/NativeBehaviorViewIntegration.swift` additionally hosts real SwiftUI text
fields in a private offscreen AppKit window and verifies duplicate-tag field
registration, native text editing, reset bindings, removal and nested scope
isolation. Run `packages/native-ios/scripts/test-native-views.sh` from a macOS session with WindowServer access; it only operates on its own offscreen window. This is a macOS integration check, not iOS simulator verification.

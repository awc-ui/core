import SwiftUI

/// md-switch focus surface for the generic switch adapter: Chrome focuses md-switch on pointerdown and it is a
/// tab stop; the AppKit/UIKit switch takes no focus on click, so a focus bridge carries focus, the keyboard
/// toggle and the accessibility element (a checkbox with the switch's state, as NSSwitch reports itself).
extension AWCNativeView {
    var switchFocusConfiguration: AWCNativeFocusConfiguration {
        let props: [String: AWCValue] = ["disabled": .bool(b("disabled")), "softDisabled": .bool(b("softDisabled")), "roleOverride": "checkbox", "selected": .bool(b("selected"))]
        let name = label.isEmpty ? ([node.properties["aria-label"]?.string, node.properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "") : label
        return AWCNativeFocusConfiguration(id: node.id, label: name, policy: AWCButtonAccessibilityPolicy(properties: props), group: nil, cell: nil,
                                           handle: iconFocusHandle, focusChanged: { _ in }, activate: {
            let value = !b("selected")
            set("selected", .bool(value)); emit("mdInput", ["selected": .bool(value)]); emit("mdChange", ["selected": .bool(value)])
            if b("required") { validate(value) }
        })
    }
}

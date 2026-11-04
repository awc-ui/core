import Foundation
@testable import AWCUI

enum NativeIconButtonCases {
    static func run(_ check: (Bool, String) -> Void) {
        let sizes = ["xs", "sm", "md", "lg", "xl"]
        let base = [32.0, 40, 56, 96, 136]
        let widths = ["narrow": [28.0, 32, 48, 64, 104], "default": base, "wide": [40.0, 52, 72, 128, 184]]
        for (index, size) in sizes.enumerated() { for density in 0...4 { for (width, bases) in widths {
            let metrics = AWCNativeIconButtonMetrics(size: size, buttonWidth: width, density: Double(-density), variant: "outlined")
            check(metrics.width == max(32, bases[index] - Double(density * 4)), "Source \(size)/\(width)/\(-density) width")
            check(metrics.height == max(32, base[index] - Double(density * 4)), "Source \(size)/\(width)/\(-density) height")
            check(metrics.iconSize == max([16.0,18,18,24,28][index], [20.0,24,24,32,40][index] - Double(density) * [1.0,1,1,2,3][index]), "Independent icon taper \(size)/\(-density)")
        } } }
        check(AWCNativeIconButtonMetrics(size: "sm", buttonWidth: "default", density: -1.5, variant: "standard").height == 40, "Non-rung density cannot select a reflected CSS rung")
        let inherited = AWCIconButtonAppearance(containerColor: "#aabbcc", iconSize: 36, width: 80)
        let merged = inherited.merging(.init(iconColor: "#123456", iconSize: -1, width: 0))
        check(merged.containerColor == "#AABBCC" && merged.iconColor == "#123456" && merged.iconSize == 36 && merged.width == 0, "Fieldwise inheritance retains valid ancestor values and preserves zero")
        check(AWCIconButtonAppearance(values: ["width": true, "height": "40", "outlineWidth": 17, "iconSize": .number(.infinity)]).width == nil, "Strict JSON appearance numeric types")
        let empty = AWCNativeIconButtonMetrics(size: "sm", buttonWidth: "wide", density: 0, variant: "outlined", appearance: .init(outlineWidth: 4, width: 0, height: 0))
        check(empty.width == 8 && empty.height == 8, "Border-box cannot shrink below the two outline edges")
        let standard = AWCNativeIconButtonMetrics(size: "sm", buttonWidth: "wide", density: 0, variant: "standard", appearance: .init(outlineWidth: 4, width: 0, height: 0))
        check(standard.width == 0 && standard.height == 0 && standard.outlineWidth == 0, "Outline hook affects only outlined variant; zero dimensions remain valid")
        let metric = AWCNativeIconButtonMetrics(size: "md", buttonWidth: "default", density: 0, variant: "standard", appearance: .init(cornerRadius: 3))
        func corner(_ shape: String = "round", _ morph: Bool = true, _ selected: Bool = false, _ pressed: Bool = false, _ left: Bool = false, _ right: Bool = false) -> AWCNativeIconButtonCorners { metric.corners(shape: shape, morph: morph, selected: selected, pressed: pressed, left: left, right: right) }
        check(corner().start == 3 && corner("round", true, true).start == 16 && corner("square", true, true).start == 28, "Radius hook changes resting shape but selected still morphs to the source target")
        check(corner("round", true, true, true).start == 12 && corner("round", false, true, true).start == 3, "Pressed target wins; disabled morph preserves resting override")
        check(corner("round", true, true, true, false, true) == .init(start: 28, end: 8), "Connected logical corners override all morph and radius overrides")
        check(corner("square", true, true, true, false, true) == .init(start: 8, end: 8), "Square connected corners are all inner")
        let noMorph = AWCNativeIconButtonMetrics(size: "md", buttonWidth: "default", density: 0, variant: "standard", tokens: ["--md-sys-shape-morph-enabled":"0"])
        check(noMorph.corners(shape: "round", morph: true, selected: true, pressed: true, left: false, right: false).start == 28, "Global shape morph token freezes local morph")
        for variant in ["standard", "filled", "tonal", "outlined"] { for selected in [false, true] { for toggle in [false, true] {
            let p = AWCNativeIconButtonPalette(variant: variant, toggle: toggle, selected: selected, disabled: false)
            let expectedIcon = variant == "standard" ? (selected ? "primary" : "on-surface-variant") : variant == "outlined" ? (selected ? "inverse-on-surface" : "on-surface-variant") : variant == "filled" ? (toggle && !selected ? "primary" : "on-primary") : (toggle && !selected ? "on-surface-variant" : "on-secondary-container")
            check(p.icon == expectedIcon, "\(variant) selected=\(selected) toggle=\(toggle) exact semantic ink")
            let disabled = AWCNativeIconButtonPalette(variant: variant, toggle: toggle, selected: selected, disabled: true)
            check(disabled.icon == "on-surface" && disabled.allowsCustomContainer == ["standard","outlined"].contains(variant) && !disabled.allowsCustomOutline, "\(variant) disabled cascade ignores custom ink/outline and only filled/tonal custom background")
        } } }
        var node = AWCNode(id: "icon", tag: "md-icon-button", properties: ["icon":"favorite", "selectedIcon":"close", "toggle":true])
        node.children = [.text(" \n "), .init(id:"badge", tag:"md-badge", properties:["value":"5"])]
        var slots = AWCNativeIconButtonSlots(node: node, properties: node.properties)
        check(slots.fallback == "favorite" && slots.hasBadge && !slots.selectedLayer, "Whitespace and badge do not suppress the glyph")
        node.children.append(.symbol("add")); slots = .init(node: node, properties: node.properties)
        check(slots.fallback.isEmpty, "Meaningful custom default content supersedes the icon prop")
        node.properties["selected"] = true; slots = .init(node: node, properties: node.properties)
        check(slots.selectedLayer && slots.fallback == "close" && slots.visibleChildren.isEmpty, "Selected prop replaces default and its badge")
        node.children.append(.symbol("check", slot:"selected")); slots = .init(node: node, properties: node.properties)
        check(slots.selectedLayer && slots.fallback.isEmpty && slots.visibleChildren.count == 1, "Selected custom slot supersedes selectedIcon")
        node.properties["toggle"] = false; slots = .init(node: node, properties: node.properties)
        check(!slots.selectedLayer, "selected without toggle never swaps glyph layers")
        node.properties["toggle"] = true; node.properties["selectedIcon"] = ""; node.children.removeAll { $0.slot == "selected" }; slots = .init(node: node, properties: node.properties)
        check(!slots.selectedLayer, "Absent selected content retains default even in selected toggle")
        let edited = try! AWCPreviewSlots.applyingValues(["": ["kind":"symbol", "value":"add"], "selected":["kind":"symbol", "value":"check"]], to: node)
        check(edited.children(inSlot: "").map(\.tag) == ["#symbol"] && edited.children(inSlot: "selected").map(\.tag) == ["#symbol"], "Both public preview icon slots construct real Material Symbol nodes")

        let explicitEmpty = try! AWCPreviewSlots.applyingValues(["": "", "selected": " "], to: node)
        let authored = AWCNativeIconButtonSlots(node: explicitEmpty, properties: explicitEmpty.properties)
        check(authored.selectedLayer && authored.fallback.isEmpty, "Authored empty slot wrapper suppresses fallback unlike incidental whitespace")
        check(explicitEmpty.children(inSlot: "").first?.tag == "#slot-text", "Preview text creates the same meaningful wrapper as Web span")
        var trace: [String] = [], events: [AWCEvent] = [], routedTarget = ""
        let router = AWCURLRouter { request in trace.append("navigate"); routedTarget = request.target; return true }
        node = AWCNode(id:"action", tag:"md-icon-button", properties:["href":"https://example.com", "target":"details", "toggle":true, "selected":false, "value":"ignored"])
        let source = AWCActivationMetadata(kind: .nativeControl, source: .keyboard)
        let result = AWCIconButtonAction.perform(node: node, router: router, targetListeners: [.init { context in trace.append("event"); context.preventDefault() }], activation: source, observe: { events.append($0) }, commitSelected: { trace.append("selected:\($0)") })
        check(result == .navigated && routedTarget == "details" && trace == ["navigate", "selected:true", "event"], "Navigation then toggle then event; cancel cannot undo committed actions")
        check(events.count == 1 && events[0].name == "mdClick" && events[0].detail == ["selected":true] && events[0].defaultPrevented && events[0].activation == source, "Only exact selected payload and truthful native activation metadata")
        node.properties["href"] = "javascript:alert(1)"; trace = []; events = []
        check(AWCIconButtonAction.perform(node: node, router: router, observe: { events.append($0) }, commitSelected: { trace.append("selected:\($0)") }) == .navigationRejected && trace == ["selected:true"] && events.count == 1, "Rejected URL still toggles and emits like Web")
        for disabled in ["disabled", "softDisabled"] {
            node.properties[disabled] = true; trace = []; events = []
            check(AWCIconButtonAction.perform(node: node, router: router, observe: { events.append($0) }, commitSelected: { _ in trace.append("commit") }) == .blocked && trace.isEmpty && events.isEmpty, "\(disabled) blocks every action")
            node.properties[disabled] = false
        }
    }
}

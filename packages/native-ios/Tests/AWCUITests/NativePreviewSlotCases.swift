import AWCUI

enum NativePreviewSlotCases {
    static func run(_ check: (Bool, String) -> Void) throws {
        func rejects(_ body: () throws -> Void) -> Bool { do { try body(); return false } catch { return true } }
        let action = AWCNode(id: "action", tag: "md-button", children: [.text("Keep action")], slot: "actions")
        let node = AWCNode(id: "dialog", tag: "md-dialog", children: [.text("Original"), action])
        let result = try AWCPreviewSlots.applying(["": "", "headline": "Custom title", "actions": "Inert replacement"], to: node)
        check(result.children(inSlot: nil).count == 1, "Default override replaces only default children")
        check(result.children(inSlot: nil).first?.properties["text"] == .string(""), "Explicit empty text survives")
        check(result.children(inSlot: "headline").first?.properties["text"] == .string("Custom title"), "Named prose is applied")
        check(result.children(inSlot: "actions").first?.id == "action", "Actions remain interactive fixture nodes")
        let tab = AWCNode(id: "tab", tag: "md-tab", properties: ["label": "First"])
        let tabs = try AWCPreviewSlots.applying(["": "Replacement"], to: AWCNode(tag: "md-tabs", children: [tab]))
        check(tabs.children.first?.id == "tab", "Structural defaults remain intact")
        let missing = try AWCPreviewSlots.applying(["": "Unsupported"], to: AWCNode(tag: "md-not-a-component"))
        check(missing.children.isEmpty, "Unknown component slots are ignored")
        let chip = try AWCPreviewSlots.applying(["": "Edited chip"], to: AWCNode(tag: "md-chip", properties: ["label": "Old fixture"]))
        check(chip.properties["label"] == .string(""), "Fixture labels cannot mask default text")
        check(chip.children.first?.properties["text"] == .string("Edited chip"), "Chip renders edited text")
        let snackbar = try AWCPreviewSlots.applying(["": ""], to: AWCNode(tag: "md-snackbar", properties: ["message": "Old fixture"]))
        check(snackbar.properties["message"] == .string(""), "Explicit snackbar default text clears fixture message")
        let button = try AWCPreviewSlots.applyingValues([
            "": "Continue", "leading-icon": ["kind": "symbol", "value": "favorite"],
            "trailing-icon": "", "loader": ["kind": "progress"],
        ], to: .init(id: "button", tag: "md-button", properties: ["icon": "add"], children: [.text("Original")]))
        check(button.children(inSlot: "leading-icon").first?.tag == "#symbol" && button.children(inSlot: "leading-icon").first?.properties["name"] == "favorite", "Typed symbols create the public native symbol node")
        check(button.children(inSlot: "trailing-icon").first?.properties["text"] == "", "Empty named text remains an explicit slot override")
        let progress = button.children(inSlot: "loader").first!
        check(progress.tag == "md-progress-indicator" && progress.properties["size"] == 24 && progress.properties["indeterminate"] == true && progress.properties["variant"] == "circular", "Typed progress is the real independently sized circular component")
        check(AWCNode.symbol("add", slot: "leading-icon").slot == "leading-icon", "Copyable public symbol convenience API preserves the named slot")
        let badge = AWCNode(id:"badge",tag:"md-badge",properties:["icon":"star"])
        for text in ["", "   "] {
            let edited = try AWCPreviewSlots.applying(["icon":text],to:badge)
            check(edited.children(inSlot:"icon").first?.tag == "#slot-text" && edited.children(inSlot:"icon").first?.properties["text"] == .string(text), "Badge explicit blank icon preserves authored element presence")
        }
        let badgeSymbol = try AWCPreviewSlots.applyingValues(["icon":["kind":"symbol","value":"favorite"]],to:badge)
        check(badgeSymbol.children(inSlot:"icon").first?.tag == "#symbol", "Badge typed icon uses the public Material Symbol child")
        check(try AWCPreviewSlots.applyingValues([:],to:badge).children.isEmpty, "Omitted Badge icon keeps the authored fallback")
        let segment=AWCNode(id:"segment-day",tag:"md-segmented-button",properties:["label":"Day","icon":"add"])
        let segmentSlots=try AWCPreviewSlots.applyingValues(["":"Edited","icon":""],to:segment)
        check(segmentSlots.properties["label"]=="" && segmentSlots.properties["icon"]=="add", "Edited segment label yields to default text while additive named icon keeps prop")
        check(segmentSlots.children(inSlot:"icon").first?.tag=="#slot-text", "Explicit blank segment icon remains an authored box")
        let context=AWCPreviewSegmentedContext(mode:"set",multiselect:true,density:-3,selection:[false,true,true])
        try context.validate(tag:"md-segmented-button")
        let composed=context.tree(segmentSlots)
        check(composed.children.map{$0.properties["selected"]?.bool==true}==[false,true,true] && composed.children.first?.id=="segment-day", "Preview context preserves actual authored selection identity")
        check(composed.properties["density"] == -3 && composed.properties["multiselect"]==true, "Preview parent context controls the real set")
        check(rejects{try AWCPreviewSegmentedContext(mode:"standalone",selection:[]).validate(tag:"md-segmented-button-set")}, "Set cannot use standalone context")
        check(rejects{try AWCPreviewSegmentedContext(selection:[true]).validate(tag:"md-segmented-button")}, "Preview selection must match authored three children")
        for slots: [String: AWCValue] in [
            ["unknown": ["kind": "symbol", "value": "add"]], ["leading-icon": ["kind": "progress"]],
            ["loader": ["kind": "symbol", "value": "<script>"]], ["loader": ["kind": "progress", "size": 24]], ["loader": 12],
        ] { check(rejects { try AWCPreviewSlots.validateValues(slots) }, "Malformed typed slot content is rejected") }
        try AWCPreviewSlots.validate([String(repeating: "😀", count: 40): String(repeating: "😀", count: 1024)])
        check(rejects { try AWCPreviewSlots.validate([String(repeating: "😀", count: 41): ""]) }, "Names count UTF-16 code units")
        check(rejects { try AWCPreviewSlots.validate(["": String(repeating: "😀", count: 1025)]) }, "Values count UTF-8 bytes")
        check(rejects { try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<33).map { (String($0), "") })) }, "At most 32 keys")
        try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<8).map { (String($0), String(repeating: "x", count: 4096)) }))
        check(rejects { try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<9).map { (String($0), String(repeating: "x", count: 4096)) })) }, "At most 32768 total bytes")
        check(rejects { _ = try AWCPreviewSlots.applying(["unsupported": String(repeating: "x", count: 4097)], to: AWCNode(tag: "md-button")) }, "Unknown slots are validated before filtering")
    }
}

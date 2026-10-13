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
        try AWCPreviewSlots.validate([String(repeating: "😀", count: 40): String(repeating: "😀", count: 1024)])
        check(rejects { try AWCPreviewSlots.validate([String(repeating: "😀", count: 41): ""]) }, "Names count UTF-16 code units")
        check(rejects { try AWCPreviewSlots.validate(["": String(repeating: "😀", count: 1025)]) }, "Values count UTF-8 bytes")
        check(rejects { try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<33).map { (String($0), "") })) }, "At most 32 keys")
        try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<8).map { (String($0), String(repeating: "x", count: 4096)) }))
        check(rejects { try AWCPreviewSlots.validate(Dictionary(uniqueKeysWithValues: (0..<9).map { (String($0), String(repeating: "x", count: 4096)) })) }, "At most 32768 total bytes")
        check(rejects { _ = try AWCPreviewSlots.applying(["unsupported": String(repeating: "x", count: 4097)], to: AWCNode(tag: "md-button")) }, "Unknown slots are validated before filtering")
    }
}

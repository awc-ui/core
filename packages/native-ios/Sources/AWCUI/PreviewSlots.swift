import Foundation

/// Bounded preview overrides. Button named slots can contain text, a Material
/// symbol, or a real progress component; other structural/action slots retain
/// their fixture children. Production callers still supply arbitrary AWCNode trees.
public enum AWCPreviewSlots {
    // NativeSupport.json slots intersected with Studio's editableTextSlot policy.
    private static let textSlots: [String: Set<String>] = [
        "md-button": ["", "leading-icon", "trailing-icon", "loader"], "md-icon-button": ["", "selected"], "md-fab": ["icon"], "md-fab-menu-item": ["","icon"], "md-badge": ["icon"], "md-segmented-button": ["","icon"],
        "md-split-button": [""], "md-chip": [""], "md-select-option": [""], "md-card": [""],
        "md-accordion-item": ["", "headline"],
        "md-list-item": ["", "overline", "headline", "supporting-text", "trailing-supporting-text", "expanded-content"],
        "md-app-bar": ["headline", "subtitle"], "md-tab-panel": [""],
        "md-breadcrumb-item": [""], "md-step": [""],
        "md-dialog": ["", "headline"], "md-bottom-sheet": ["", "headline"], "md-side-sheet": ["", "headline"],
        "md-snackbar": ["", "action", "close"], "md-tooltip": ["subhead", "content"],
        "md-table": ["empty"], "md-table-row": ["expanded"], "md-table-cell": [""], "md-table-sort-label": [""],
        "md-organization-chart": ["empty"],
        "md-line-chart": ["header", "empty", "footer"], "md-area-chart": ["header", "empty", "footer"],
        "md-bar-chart": ["header", "empty", "footer"], "md-pie-chart": ["header", "empty", "footer"]
    ]
    private struct InvalidSlots: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }
    public static func validate(_ slots: [String: String]) throws {
        try validateValues(slots.mapValues(AWCValue.string))
    }
    public static func validateValues(_ slots: [String: AWCValue]) throws {
        guard slots.count <= 32 else { throw InvalidSlots(message: "Preview slots must contain at most 32 entries.") }
        var total = 0
        for (name, value) in slots {
            guard name.utf16.count <= 80 else { throw InvalidSlots(message: "Preview slot names must contain at most 80 characters.") }
            let text: String
            switch value {
            case .string(let content): text = content
            case .object(let content):
                guard ["", "selected", "icon", "leading-icon", "trailing-icon", "loader"].contains(name) else { throw InvalidSlots(message: "Typed slot values require a supported button icon or loader slot.") }
                if content["kind"] == "symbol", Set(content.keys) == ["kind", "value"],
                   case .string(let symbol) = content["value"],
                   symbol.range(of: "^[a-z][a-z0-9_]{0,127}$", options: .regularExpression) != nil { text = symbol }
                else if content["kind"] == "progress", name == "loader", Set(content.keys) == ["kind"] { text = "" }
                else { throw InvalidSlots(message: "Invalid typed button slot.") }
            default: throw InvalidSlots(message: "Preview slot values must be text or a supported typed button slot.")
            }
            let bytes = text.utf8.count
            guard bytes <= 4096 else { throw InvalidSlots(message: "Preview slot text exceeds 4096 UTF-8 bytes.") }
            total += bytes
            guard total <= 32768 else { throw InvalidSlots(message: "Preview slots exceed 32768 UTF-8 bytes.") }
        }
    }
    public static func applying(_ slots: [String: String], to original: AWCNode) throws -> AWCNode {
        try applyingValues(slots.mapValues(AWCValue.string), to: original)
    }
    public static func applyingValues(_ slots: [String: AWCValue], to original: AWCNode) throws -> AWCNode {
        try validateValues(slots)
        var node = original
        for (name, value) in slots.sorted(by: { $0.key < $1.key }) where textSlots[node.tag]?.contains(name) == true {
            if case .object = value {
                guard ["md-button", "md-icon-button", "md-fab","md-fab-menu-item","md-badge","md-segmented-button"].contains(node.tag), !(["md-button","md-fab-menu-item","md-segmented-button"].contains(node.tag) && name.isEmpty) else { continue }
            }
            node.children.removeAll { ($0.slot ?? "") == name }
            var child: AWCNode
            if case .string(let text) = value { child = ["md-icon-button","md-fab","md-badge"].contains(node.tag) || (["md-fab-menu-item","md-segmented-button"].contains(node.tag) && name=="icon") ? .slotText(text, slot: name.isEmpty ? nil : name) : .text(text, slot: name.isEmpty ? nil : name) }
            else if value["kind"] == "symbol" { child = .symbol(value["value"].string, slot: name) }
            else { child = AWCNode(tag: "md-progress-indicator", properties: ["variant": "circular", "indeterminate": true, "size": 24], slot: name) }
            child.id = "\(node.id)-preview-slot-\(name)"
            node.children.append(child)
            // Only the property for this prose region yields to edited default text.
            // Region titles (dialog, sheet, accordion, step) remain unchanged.
            let maskingProperty = ["md-chip": "label", "md-fab-menu-item": "label", "md-segmented-button": "label", "md-select-option": "label", "md-list-item": "headline", "md-snackbar": "message"]
            if name.isEmpty, let property = maskingProperty[node.tag] { node.properties[property] = "" }
        }
        return node
    }
}

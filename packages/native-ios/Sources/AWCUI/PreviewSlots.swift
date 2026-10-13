import Foundation

/// Bounded plain-text overrides for preview hosts. Structural/action slots retain
/// their fixture children. This does not change the native component slot API.
public enum AWCPreviewSlots {
    // NativeSupport.json slots intersected with Studio's editableTextSlot policy.
    private static let textSlots: [String: Set<String>] = [
        "md-button": [""], "md-fab-menu-item": [""], "md-segmented-button": [""],
        "md-chip": [""], "md-select-option": [""], "md-card": [""],
        "md-accordion-item": ["", "headline"],
        "md-list-item": ["", "overline", "headline", "supporting-text", "trailing-supporting-text", "expanded-content"],
        "md-app-bar": ["headline", "subtitle"], "md-tab-panel": [""],
        "md-breadcrumb-item": [""], "md-step": [""],
        "md-dialog": ["", "headline"], "md-bottom-sheet": ["", "headline"], "md-side-sheet": ["", "headline"],
        "md-snackbar": [""], "md-tooltip": ["subhead", "content"],
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
        guard slots.count <= 32 else { throw InvalidSlots(message: "Preview slots must contain at most 32 text entries.") }
        var total = 0
        for (name, text) in slots {
            guard name.utf16.count <= 80 else { throw InvalidSlots(message: "Preview slot names must contain at most 80 characters.") }
            let bytes = text.utf8.count
            guard bytes <= 4096 else { throw InvalidSlots(message: "Preview slot text exceeds 4096 UTF-8 bytes.") }
            total += bytes
            guard total <= 32768 else { throw InvalidSlots(message: "Preview slots exceed 32768 UTF-8 bytes.") }
        }
    }
    public static func applying(_ slots: [String: String], to original: AWCNode) throws -> AWCNode {
        try validate(slots)
        var node = original
        for (name, text) in slots.sorted(by: { $0.key < $1.key }) where textSlots[node.tag]?.contains(name) == true {
            node.children.removeAll { ($0.slot ?? "") == name }
            node.children.append(AWCNode(id: "\(node.id)-preview-slot-\(name)", tag: "#text", properties: ["text": .string(text)], slot: name.isEmpty ? nil : name))
            // Only the property for this prose region yields to edited default text.
            // Region titles (dialog, sheet, accordion, step) remain unchanged.
            let maskingProperty = ["md-chip": "label", "md-fab-menu-item": "label", "md-segmented-button": "label", "md-select-option": "label", "md-list-item": "headline", "md-snackbar": "message"]
            if name.isEmpty, let property = maskingProperty[node.tag] { node.properties[property] = "" }
        }
        return node
    }
}

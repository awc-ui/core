import Foundation

/// CSS nowrap collapses only ASCII whitespace; NBSP remains a visible advance.
func awcCollapsedInlineText(_ text: String) -> String {
    text.replacingOccurrences(of: "[\\t\\n\\r\u{000C} ]+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: " "))
}

extension AWCNode {
    /// Light-tree text only. Component label/icon properties render in their
    /// own implementation and do not contribute to authored textContent.
    var authoredTextContent: String {
        if tag == "#text" || tag == "#slot-text" { return properties["text"]?.string ?? "" }
        if tag == "#symbol" { return properties["name"]?.string ?? "" }
        return children.map(\.authoredTextContent).joined()
    }
}

func awcFabMenuTypeaheadLabel(_ item: AWCNode) -> String {
    let authored = (item.properties["label"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    return authored.isEmpty ? item.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines) : authored
}

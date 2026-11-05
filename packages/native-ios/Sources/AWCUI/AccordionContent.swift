import SwiftUI

/// CSS lengths shared with the existing native sizing contract, plus the
/// bounded comparison functions used by content caps. Invalid declarations
/// remain unbounded. Additional valid CSS length grammars still require an
/// explicit native mapping before this internal renderer can be released.
indirect enum AWCAccordionContentLimit {
    case length(AWCSkeletonLength), minimum([Self]), maximum([Self]), clamp(Self, Self, Self)

    init?(css: String, depth: Int = 0) {
        let source = css.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard depth < 16, source.utf8.count <= 4096 else { return nil }
        if let length = AWCSkeletonLength(css: source) { self = .length(length); return }
        guard let opening = source.firstIndex(of: "("), source.hasSuffix(")") else { return nil }
        let function = String(source[..<opening])
        guard ["min", "max", "clamp"].contains(function) else { return nil }
        let body = source[source.index(after: opening)..<source.index(before: source.endIndex)]
        var nesting = 0, terms: [String] = [], current = ""
        for character in body {
            if character == "(" { nesting += 1 }
            if character == ")" { nesting -= 1; if nesting < 0 { return nil } }
            if character == "," && nesting == 0 { terms.append(current); current = "" }
            else { current.append(character) }
        }
        guard nesting == 0 else { return nil }; terms.append(current)
        let values = terms.compactMap { Self(css: $0, depth: depth + 1) }
        guard values.count == terms.count, !values.isEmpty else { return nil }
        switch function {
        case "min": self = .minimum(values)
        case "max": self = .maximum(values)
        default: guard values.count == 3 else { return nil }; self = .clamp(values[0], values[1], values[2])
        }
    }
    func resolve(parent: Double?, context: AWCSkeletonSizingContext) -> Double? {
        switch self {
        case .length(let value): return value.resolve(parent: parent, context: context)
        case .minimum(let values), .maximum(let values):
            let resolved = values.compactMap { $0.resolve(parent: parent, context: context) }
            guard resolved.count == values.count else { return nil }
            if case .minimum = self { return resolved.min() }; return resolved.max()
        case .clamp(let low, let value, let high):
            guard let low = low.resolve(parent: parent, context: context),
                  let value = value.resolve(parent: parent, context: context),
                  let high = high.resolve(parent: parent, context: context) else { return nil }
            return max(low, min(value, high))
        }
    }
}

/// One stable ScrollView supplies both its intrinsic height and its constrained
/// viewport. No branch replaces or separately hosts the authored native body.
/// Percentage max sizes do not constrain the intrinsic grid contribution on
/// Web; after layout they resolve against that contribution for scrolling.
struct AWCAccordionContentLayout: Layout {
    let limit: AWCAccordionContentLimit?
    let padding: Double
    let context: AWCSkeletonSizingContext
    var authoredHeight: Double? = nil
    var minimumHeight: Double? = nil
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let natural = subviews.first?.sizeThatFits(.init(width: proposal.width, height: nil)) ?? .zero
        var height = authoredHeight.map{$0+padding} ?? natural.height
        if let cap = limit?.resolve(parent: nil, context: context) { height = min(height, cap + padding) }
        if let minimumHeight {height=max(height,minimumHeight+padding)}
        return .init(width: proposal.width ?? natural.width, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let child = subviews.first else { return }
        var height = bounds.height
        if let cap = limit?.resolve(parent: bounds.height, context: context) { height = min(height, cap + padding) }
        if let minimumHeight {height=max(height,minimumHeight+padding)}
        child.place(at: bounds.origin, anchor: .topLeading, proposal: .init(width: bounds.width, height: height))
    }
}

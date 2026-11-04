import SwiftUI

private struct AWCMaterialSymbolSizeKey: EnvironmentKey { static let defaultValue: CGFloat = 24 }
extension EnvironmentValues {
    var awcMaterialSymbolSize: CGFloat {
        get { self[AWCMaterialSymbolSizeKey.self] }
        set { self[AWCMaterialSymbolSizeKey.self] = newValue }
    }
}

/// A decorative glyph from the bundled Material Symbols font. Button slots
/// provide its size and color; an explicit size remains available elsewhere.
public struct AWCMaterialSymbol: View {
    public let name: String
    public let size: CGFloat?
    @Environment(\.awcMaterialSymbolSize) private var inheritedSize
    public init(_ name: String, size: CGFloat? = nil) { self.name = name; self.size = size }
    public var body: some View {
        let dimension = size ?? inheritedSize
        Text(name).font(AWCNativeFonts.symbol(size: dimension)).tracking(0)
            .fixedSize().frame(width: dimension, height: dimension)
            .environment(\.layoutDirection, .leftToRight)
            .accessibilityHidden(true)
    }
}

public extension AWCNode {
    /// Element-like authored slot content, including an explicit empty wrapper.
    /// Unlike raw whitespace text, this intentionally suppresses icon fallback.
    static func slotText(_ text: String, slot: String? = nil) -> AWCNode {
        AWCNode(tag: "#slot-text", properties: ["text": .string(text)], slot: slot)
    }
    /// Use real Material glyphs in named button slots without SF Symbol mapping.
    static func symbol(_ name: String, slot: String? = nil) -> AWCNode {
        AWCNode(tag: "#symbol", properties: ["name": .string(name)], slot: slot)
    }
}

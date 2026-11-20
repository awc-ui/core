import SwiftUI

// CSS stacking across containers (gate-7 r3-19).
//
// The source's floating md-accordion (`position: fixed; z-index: 1000`, raised by bring-to-front) and its dragged
// md-card (`transform` + `z-index: 1000`) stack against the whole document. SwiftUI's `zIndex` orders a view among
// the children of one layout container only, so the later siblings of any ancestor painted over them.
//
// Lift chain: a lifted component publishes its z-index upward; every AWC host on the way to the root takes the
// largest value of its subtree as its own order among its siblings. The lifted content then paints, and is hit,
// above the later siblings of each ancestor. No view changes position in the tree, so component state, the keyboard
// order (document-order tokens) and the accessibility tree are those of the document.

struct AWCStackingLiftKey: PreferenceKey {
    static var defaultValue: Double { 0 }
    static func reduce(value: inout Double, nextValue: () -> Double) { value = max(value, nextValue()) }
}
private struct AWCStackingNestedKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    /// True below an AWC host. Nested hosts join the lift chain; a root host leaves its `zIndex` to the application.
    var awcStackingNested: Bool {
        get { self[AWCStackingNestedKey.self] }
        set { self[AWCStackingNestedKey.self] = newValue }
    }
}

/// One link of the chain. SwiftUI resolves stacked `zIndex` modifiers innermost-first, so a single modifier carries
/// the view's own order (`own`) and the lift of its subtree. `publish` marks `own` as a document-level z-index
/// (the lifted component itself); otherwise `own` stays local to the siblings.
struct AWCStackingLift: ViewModifier {
    var own: Double = 0
    var publish = false
    @State private var lift = 0.0
    func body(content: Content) -> some View {
        content
            .transformPreference(AWCStackingLiftKey.self) { if publish { $0 = max($0, own) } }
            .onPreferenceChange(AWCStackingLiftKey.self) { if lift != $0 { lift = $0 } }
            .zIndex(max(own, lift))
    }
}

/// The host-level link (AWCNativeView). Text and symbol nodes hold no components; table members are ordered by
/// their table (sticky head and foot).
struct AWCStackingHost: ViewModifier {
    let tag: String
    @Environment(\.awcStackingNested) private var nested
    func body(content: Content) -> some View {
        let inner = content.environment(\.awcStackingNested, true)
        if nested && !tag.hasPrefix("#") && !tag.hasPrefix("md-table") { inner.modifier(AWCStackingLift()) } else { inner }
    }
}

public extension View {
    /// Joins the document stacking of AWC components. Apply it to an application container that sits between AWC
    /// components and the siblings they should rise above (and to root-level AWC views that share a stack): while a
    /// floating `md-accordion` or a dragged `md-card` inside it is lifted, the view paints above its later siblings.
    /// `zIndex` is the view's own order; pass it here instead of a separate `.zIndex`, which SwiftUI would resolve
    /// innermost-first.
    func awcStackingLift(zIndex: Double = 0) -> some View { modifier(AWCStackingLift(own: zIndex)) }
}

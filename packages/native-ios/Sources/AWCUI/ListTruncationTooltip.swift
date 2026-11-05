import SwiftUI

extension View {
    /// The source wraps the headline and supporting text in a stable md-tooltip that is enabled only while the
    /// text is clipped (`md-list-item__headline-tooltip` / `__supporting-tooltip`); the shared md-tooltip renderer
    /// supplies the popup, delays, focus and accessibility description.
    func awcListTruncationTooltip(id: String, text: String, enabled: Bool, theme: AWCTheme) -> some View {
        let props: [String: AWCValue] = ["text": .string(text), "disabled": .bool(!enabled)]
        return AWCNativeTooltip(node: AWCNode(id: id, tag: "md-tooltip", properties: props), properties: props, theme: theme, onEvent: { _ in }, onOpenChanged: { _ in })
            .awcTooltipSlot(.anchor) { self }
    }
}

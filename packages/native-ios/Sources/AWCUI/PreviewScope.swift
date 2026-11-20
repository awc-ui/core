import SwiftUI

private struct AWCPreviewEnabledKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcPreviewEnabled: Bool {
        get { self[AWCPreviewEnabledKey.self] }
        set { self[AWCPreviewEnabledKey.self] = newValue }
    }
}

enum AWCPreviewPlacement { case center, bottom, trailing }
private struct AWCPreviewPresentation: Identifiable {
    let id: UUID
    let placement: AWCPreviewPlacement
    let content: AnyView
    let dismiss: () -> Void
    let scrimDismissible: Bool
}
private struct AWCPreviewPresentationsKey: PreferenceKey {
    static var defaultValue: [AWCPreviewPresentation] = []
    static func reduce(value: inout [AWCPreviewPresentation], nextValue: () -> [AWCPreviewPresentation]) { value += nextValue() }
}
private struct AWCPreviewPresentedKey: PreferenceKey {
    static var defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) { value = nextValue() || value }
}

/// Embeds transient AWC controls in one renderable surface for remote previews.
/// Applications that omit this scope retain platform sheet and picker presentation.
/// The embedded preview does not reproduce platform sheet dragging or window placement.
public struct AWCPreviewScope<Content: View>: View {
    private let overlayHeight: CGFloat
    private let content: Content
    @State private var presented = false
    @Environment(\.colorScheme) private var colorScheme

    public init(overlayHeight: CGFloat = 640, @ViewBuilder content: () -> Content) {
        self.overlayHeight = max(320, overlayHeight.isFinite ? overlayHeight : 640)
        self.content = content()
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, minHeight: presented ? overlayHeight : 0)
            .onPreferenceChange(AWCPreviewPresentedKey.self) { presented = $0 }
            .overlayPreferenceValue(AWCPreviewPresentationsKey.self) { presentations in
                if let presentation = presentations.last {
                    GeometryReader { geometry in
                        let panelWidth = max(1, min(geometry.size.width - 32, presentation.placement == .trailing ? 360 : 540))
                        ZStack(alignment: presentation.placement == .bottom ? .bottom : presentation.placement == .trailing ? .trailing : .center) {
                            Color.black.opacity(0.28)
                                .contentShape(Rectangle())
                                .onTapGesture { if presentation.scrimDismissible { presentation.dismiss() } }
                                .accessibilityLabel("Dismiss preview overlay")
                            presentation.content
                                .frame(width: panelWidth, height: max(1, min(600, geometry.size.height - 32)))
                                .background(colorScheme == .dark ? Color(white: 0.13) : .white, in: RoundedRectangle(cornerRadius: 20))
                                .clipShape(RoundedRectangle(cornerRadius: 20))
                                .shadow(color: .black.opacity(0.2), radius: 16, y: 6)
                                .padding(16)
                        }
                        .onKeyPress(.escape) {
                            guard presentation.scrimDismissible else { return .ignored }
                            presentation.dismiss(); return .handled
                        }
                    }
                }
            }
            .environment(\.awcPreviewEnabled, true)
    }
}

private struct AWCPreviewSheetModifier<Sheet: View>: ViewModifier {
    @Environment(\.awcPreviewEnabled) private var preview
    @State private var id = UUID()
    @Binding var presented: Bool
    /// Called with the new value when the presentation itself changes it (scrim, Escape, system sheet dismissal).
    let onChange: ((Bool) -> Void)?
    let placement: AWCPreviewPlacement
    let scrimDismissible: Bool
    let sheet: () -> Sheet
    @ViewBuilder func body(content: Content) -> some View {
        if preview {
            content
                .preference(key: AWCPreviewPresentedKey.self, value: presented)
                .preference(key: AWCPreviewPresentationsKey.self, value: presented ? [
                    AWCPreviewPresentation(id: id, placement: placement, content: AnyView(sheet()), dismiss: { presented = false; onChange?(false) }, scrimDismissible: scrimDismissible)
                ] : [])
        } else {
            content.sheet(isPresented: Binding(get: { presented }, set: { presented = $0; onChange?($0) }), content: sheet)
        }
    }
}

extension View {
    func awcPreviewSheet<Sheet: View>(isPresented: Binding<Bool>, onChange: ((Bool) -> Void)? = nil, placement: AWCPreviewPlacement = .center, scrimDismissible: Bool = true, @ViewBuilder content: @escaping () -> Sheet) -> some View {
        modifier(AWCPreviewSheetModifier(presented: isPresented, onChange: onChange, placement: placement, scrimDismissible: scrimDismissible, sheet: content))
    }
}

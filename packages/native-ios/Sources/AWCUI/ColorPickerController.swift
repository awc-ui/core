import SwiftUI

/// md-color-picker's methods for a mounted picker (`show()` / `close()`, the source's popover methods).
///
/// Attach with `.awcColorPickerController(controller)` (every picker below) or `.awcColorPickerController(controller, for: id)`
/// (the picker whose node has that id). As in the source, both act on a popover picker only and `show()` does nothing while
/// it is disabled; each emits `mdOpenChange` through the picker's `open` property, and `close()` returns focus that was
/// inside the popover to the trigger.
@MainActor public final class AWCColorPickerController {
    weak var runtime: AWCColorPickerRuntime?
    var showAction: () -> Void = {}
    var closeAction: () -> Void = {}
    public init() {}
    /// A picker is mounted and attached.
    public var isConnected: Bool { runtime != nil }
    /// The popover is open (the picker's `open` as last rendered).
    public var isOpen: Bool { runtime?.snapshot.open ?? false }
    /// `show()`: opens the popover.
    public func show() { showAction() }
    /// `close()`: closes the popover.
    public func close() { closeAction() }
}

private struct AWCColorPickerControllersKey: EnvironmentKey { static let defaultValue: [String: AWCColorPickerController] = [:] }
extension EnvironmentValues {
    var awcColorPickerControllers: [String: AWCColorPickerController] {
        get { self[AWCColorPickerControllersKey.self] } set { self[AWCColorPickerControllersKey.self] = newValue }
    }
}
private struct AWCColorPickerControllerModifier: ViewModifier {
    let id: String, controller: AWCColorPickerController
    @Environment(\.awcColorPickerControllers) private var inherited
    func body(content: Content) -> some View { var c = inherited; c[id] = controller; return content.environment(\.awcColorPickerControllers, c) }
}
public extension View {
    /// Binds `controller` to the md-color-picker with node id `id`, or to every picker below when `id` is nil.
    func awcColorPickerController(_ controller: AWCColorPickerController, for id: String? = nil) -> some View {
        modifier(AWCColorPickerControllerModifier(id: id ?? "", controller: controller))
    }
}

public extension AWCColorPickerAppearance {
    /// Typed hooks from plain data (the Laboratory transport, picker-appearance.js): lengths as numbers (points), colours and
    /// the popover's box-shadow as text; other value types are ignored.
    init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { if case .string(let v)? = values[k] { return v }; return nil }
        self.init(width: n("width"), plateHeight: n("plateHeight"), radius: n("radius"), surfaceColor: s("surfaceColor"), onSurface: s("onSurface"),
                  outlineColor: s("outlineColor"), outlineStrong: s("outlineStrong"), thumbSize: n("thumbSize"), thumbBorder: s("thumbBorder"),
                  presetSize: n("presetSize"), popoverElevation: s("popoverElevation"))
    }
}

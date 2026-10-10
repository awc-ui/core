import Observation
import SwiftUI

/// Coordinates supplied by an embedding native host, in the named
/// "awc-native-preview" coordinate space. This carries pointer geometry only;
/// native ButtonStyle.isPressed remains the source of activation/press state.
@Observable
public final class AWCNativePointerState {
    public enum Phase: String, Sendable { case down, move, up, cancel, leave }
    public private(set) var location: CGPoint?
    public private(set) var pressLocation: CGPoint?
    public private(set) var pressSequence = 0
    public private(set) var isPointerDown = false

    public init() {}

    /// Call on the native UI thread alongside the actual scoped native event.
    public func update(phase: Phase, location: CGPoint? = nil) {
        switch phase {
        case .down:
            self.location = location
            pressLocation = location
            pressSequence &+= 1
            isPointerDown = true
        case .move: self.location = location
        case .up: self.location = location; isPointerDown = false
        case .cancel: self.location = nil; isPointerDown = false
        case .leave: self.location = nil
        }
    }
}

private struct AWCNativePointerStateKey: EnvironmentKey {
    static let defaultValue: AWCNativePointerState? = nil
}

public extension EnvironmentValues {
    var awcNativePointerState: AWCNativePointerState? {
        get { self[AWCNativePointerStateKey.self] }
        set { self[AWCNativePointerStateKey.self] = newValue }
    }
}

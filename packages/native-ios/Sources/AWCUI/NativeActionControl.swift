import SwiftUI

/// A native responder supplies roving keyboard focus and accessibility while
/// SwiftUI's actual Button remains the pointer/press animation authority.
struct AWCNativeActionControl<Style: ButtonStyle, Label: View>: View {
    let style: (Bool, Bool, Int, @escaping () -> Void) -> Style
    let policy: AWCButtonAccessibilityPolicy
    let id: String
    let accessibleLabel: String
    let action: (AWCActivationMetadata.Source) -> Void
    let direction: String
    var popup:AWCNativePopupRelationship?=nil
    @ViewBuilder let label: () -> Label
    @State private var focusHandle = AWCButtonFocusHandle()
    @State private var nativePressed = false
    @State private var nativeActivation = 0
    @State private var nativePressCompletion: Task<Void, Never>?
    @State private var touchPress = AWCTouchPressState()
    @Environment(\.layoutDirection) private var inheritedDirection
    @Environment(\.awcButtonFocusGroup) private var group
    @Environment(\.awcGridCellContext) private var cell
    @Environment(\.awcNativeFocusChanged) private var focusChanged
    @Environment(\.awcNativeGroupContext) private var rawGroup
    @Environment(\.awcFabMenuRegistry) private var menuRegistry
    @Environment(\.awcMenuRegistry) private var mdMenuRegistry
    @Environment(\.awcSnackbarRegistry) private var snackbarRegistry
    @Environment(\.awcTooltipRegistry) private var tooltipRegistry
    @Environment(\.awcTooltipDescription) private var tooltipDescription
    @Environment(\.awcFabMenuSession) private var menuSession
    @Environment(\.awcPopupTarget) private var popupTarget
    @Environment(\.awcNativeSegmentedContext) private var segmentedContext
    @Environment(\.awcCompositeKeyRouter) private var compositeKeys
    private var isSegment: Bool { policy.role == .radio || policy.role == .checkbox }
    private var keyRouter: ((String,Bool,Bool)->Bool)? {
        guard menuRegistry != nil || snackbarRegistry != nil || tooltipRegistry != nil || popupTarget?.escape != nil || isSegment else { return nil }
        return { key,shift,modified in
            if menuRegistry?.key(id,key,shift:shift,modified:modified) == true { return true }
            if key=="Escape",snackbarRegistry?.escape()==true{return true}
            if key=="Escape",tooltipRegistry?.escape()==true{return true}
            if key=="Escape",popupTarget?.escape?()==true{return true}
            if isSegment && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].contains(key) {
                _ = segmentedContext?.move(key,from:id,multiple:policy.role == .checkbox)
                return true
            }
            return false
        }
    }
    private func registerSegment() {
        guard isSegment else { return }
        // These callbacks are deliberately non-observed. Replacing them during
        // rendering keeps value/selection captures current without another pass.
        segmentedContext?.state.handles[id] = focusHandle
        segmentedContext?.state.actions[id] = { action(.keyboard) }
    }
    private func activate(source: AWCActivationMetadata.Source) {
        guard !policy.activationBlocked else { return }
        _ = focusHandle.requestFocus?()
        nativeActivation &+= 1
        nativePressed = true
        nativePressCompletion?.cancel()
        nativePressCompletion = Task { @MainActor in
            // Match md-button's Enter/Space pulse, independently of keyUp.
            try? await Task.sleep(for: .milliseconds(150))
            guard !Task.isCancelled else { return }
            nativePressed = false; nativePressCompletion = nil
        }
        if menuRegistry?.activateAnchor(id,source:source) != true {action(source)}
    }
    /// SwiftUI's Button action. On iOS it is skipped for a touch `AWCTouchPressRouter` already completed.
    private func pointerActivate() {
        guard !touchPress.consumeCompletedTouch() else { return }
        performPointerActivation()
    }
    /// iOS raw touch (see `AWCTouchPressRouter`): press on touch down, click on touch up inside, as Chrome's pointer.
    private var touchHandler: AWCTouchPressHandler {
        .init(began: { point in
            guard !policy.hardDisabled else { return false }
            touchPress.begin(at: point); pointerPress(); return true
        }, ended: { inside in
            touchPress.end(completed: true)
            if inside { performPointerActivation() }
        }, cancelled: { touchPress.end(completed: false) })
    }
    /// Chrome's pointerdown: the menu anchor state, then focus (no ring). Once per press: the styles' SwiftUI-press callback
    /// is skipped while the router owns the touch.
    private func pointerPress() { menuRegistry?.pointerDown(id); _ = focusHandle.requestPointerFocus?() }
    private func performPointerActivation() {
        guard !policy.hardDisabled else { return }
        let handled = menuRegistry?.activateAnchor(id, source: .pointer) == true
        _ = focusHandle.requestPointerFocus?()
        if !handled { action(.pointer) }
    }
    var body: some View {
        let _ = registerSegment()
        let _ = popupTarget?.register(id,focusHandle)
        Button(action: pointerActivate, label: label)
            .buttonStyle(style(focusHandle.isFocusVisible, nativePressed, nativeActivation, { if !touchPress.ownsTouch { pointerPress() } }))
            .environment(\.awcTouchPress, touchPress)
            .focusable(false)
            .disabled(policy.hardDisabled)
            .accessibilityHidden(true)
            .awcFocusBridgeLayer {
                AWCNativeButtonFocusBridge(configuration: .init(id: id, label: accessibleLabel, policy: policy,
                    group: isSegment ? nil:group, cell: cell, handle: focusHandle, focusChanged: { if $0 {menuSession?.focused(id)};focusChanged?(id, $0) }, activate: { activate(source: .unknown) },
                    activateFrom: { activate(source: $0) }, keyPress: { rawGroup?.press(id) },
                    routeKey:keyRouter,
                    menuExpanded:menuRegistry?.presentations[id]?.open ?? mdMenuRegistry?.anchorExpanded(id),popup:popup,tooltipDescription:tooltipDescription,touchPress:touchHandler,compositeKey:compositeKeys.map { route in { route(id, $0) } }))
                    .accessibilityHidden(false)
            }
            .accessibilityElement(children: .contain)
            .zIndex(focusHandle.isFocusVisible ? 1 : 0)
            .environment(\.layoutDirection, direction == "rtl" ? .rightToLeft : direction == "ltr" ? .leftToRight : inheritedDirection)
            .background {
                if let menuRegistry {
                    GeometryReader {geometry in Color.clear.preference(key:AWCFabMenuFrames.self,value:[id:geometry.frame(in:.named(menuRegistry.coordinateSpace))])}
                }
            }
            .onAppear {menuRegistry?.handles[id]=focusHandle;popupTarget?.register(id,focusHandle)}
            .onChange(of: policy.activationBlocked) { _, blocked in
                if blocked { nativePressCompletion?.cancel(); nativePressed = false }
            }
            .onDisappear { popupTarget?.unregister(id);nativePressCompletion?.cancel(); nativePressed = false;menuRegistry?.handles[id]=nil;if isSegment {segmentedContext?.state.handles[id]=nil;segmentedContext?.state.actions[id]=nil} }
    }
}

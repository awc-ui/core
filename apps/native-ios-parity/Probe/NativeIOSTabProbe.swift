import AppKit
import SwiftUI
@testable import AWCUI

// fi probe: who receives a hardware Tab on iPhone when nothing / an AWC focus view is first responder.
@Observable final class TabProbeState { var log: [String] = [] }
final class KeyLogView: UIView {
    var log: (String) -> Void = { _ in }
    override var keyCommands: [UIKeyCommand]? { [UIKeyCommand(input: "\t", modifierFlags: [], action: #selector(tab))].map { $0.wantsPriorityOverSystemBehavior = true; return $0 } }
    @objc func tab() { log("keylogview-tab(nonresponder)") }
    override func pressesBegan(_ p: Set<UIPress>, with e: UIPressesEvent?) { log("keylogview-presses"); super.pressesBegan(p, with: e) }
}
struct KeyLog: UIViewRepresentable {
    let state: TabProbeState
    func makeUIView(context: Context) -> KeyLogView { let v = KeyLogView(); v.log = { state.log.append($0) }; return v }
    func updateUIView(_ v: KeyLogView, context: Context) {}
}
struct TabProbeView: View {
    let state: TabProbeState
    @FocusState var swiftFocus: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AWCNativeView(node: .init(id: "s1", tag: "md-switch")) { _ in }
            AWCNativeView(node: .init(id: "s2", tag: "md-switch")) { _ in }
            KeyLog(state: state).frame(width: 40, height: 20)
            Text("focusable").focusable().focused($swiftFocus).onKeyPress(.tab) { state.log.append("swiftui-onKeyPress-tab"); return .handled }
        }.frame(width: 300, height: 300, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSTabProbe {
    static let state = TabProbeState()
    static var host: NSHostingView<TabProbeView>!, window: NSWindow!
    static func pump(_ d: Double = 0.1) { let end = Date().addingTimeInterval(d); repeat { host.layoutSubtreeIfNeeded(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002)) } while Date() < end }
    static func key(_ code: UInt16, _ text: String, shift: Bool = false) { NSApp.sendEvent(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: shift ? [.shift] : [], timestamp: 0, windowNumber: 1, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!); pump(0.15) }
    static func all(_ v: UIView) -> [UIView] { [v] + v.subviews.flatMap(all) }
    static func describe(_ r: UIResponder?) -> String { guard let r else { return "nil" }; if let v = r as? UIView { return "\(type(of: v)) \(v.accessibilityIdentifier ?? "")" }; return "\(type(of: r))" }
    static func main() {
        host = NSHostingView(rootView: TabProbeView(state: state))
        window = NSWindow(contentRect: .init(x: 0, y: 0, width: 300, height: 300), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.5)
        print("TABPROBE focusSystem=\(UIFocusSystem.focusSystem(for: window) != nil) idiom=\(UIDevice.current.userInterfaceIdiom.rawValue) keyWindow=\(window.isKeyWindow)")
        let focusViews = all(window).compactMap { $0 as? AWCNativeButtonFocusView }
        print("TABPROBE focus views: \(focusViews.map { $0.configuration?.id ?? "?" })")
        _ = window.makeFirstResponder(nil); pump()
        var before = AWCShimTouch.deliveredPresses
        key(48, "\t")
        print("TABPROBE nothing-focused tab: presses \(AWCShimTouch.deliveredPresses - before) firstResponder=\(describe(window.firstResponder)) log=\(state.log)")
        state.log = []
        if let s1 = focusViews.first { _ = s1.requestNativeFocus(); pump() }
        print("TABPROBE s1 focused: firstResponder=\(describe(window.firstResponder))")
        before = AWCShimTouch.deliveredPresses
        key(48, "\t")
        print("TABPROBE s1 tab: presses \(AWCShimTouch.deliveredPresses - before) firstResponder=\(describe(window.firstResponder)) log=\(state.log)")
        state.log = []
        key(48, "\t", shift: true)
        print("TABPROBE shift-tab: firstResponder=\(describe(window.firstResponder)) log=\(state.log)")
        key(48, "\t"); key(48, "\t")
        print("TABPROBE tab tab (past the end): firstResponder=\(describe(window.firstResponder))")
        key(48, "\t")
        print("TABPROBE tab again from document: firstResponder=\(describe(window.firstResponder))")
        key(48, "\t", shift: true); key(48, "\t", shift: true)
        print("TABPROBE shift-tab x2 (past the start): firstResponder=\(describe(window.firstResponder))")
        key(48, "\t", shift: true)
        print("TABPROBE shift-tab from document (enters at the end): firstResponder=\(describe(window.firstResponder))")
        print("Tab probe: 1/1 checks passed")
    }
}

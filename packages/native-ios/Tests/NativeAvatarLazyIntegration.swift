import AppKit
import SwiftUI
import Observation
import AWCUI

// d3 r3-05: loading="lazy" (default) defers the request and mdLoad until the avatar nears the viewport; "eager" loads at once.
// Chrome 153 (web2/lazy-web.json, 400×600 viewport, avatars 3000 px below): before scrolling mdLoad near + far-eager only;
// after scrolling the far avatars into view, far-lazy loads too.
@Observable final class AvatarLazyState { var loads: [String] = []; var scroll = false }
struct AvatarLazyFixture: View {
    let state: AvatarLazyState
    static let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    func avatar(_ id: String, _ loading: String?) -> some View {
        var props: [String: AWCValue] = ["name": .string(id), "src": .string(Self.png)]
        if let loading { props["loading"] = .string(loading) }
        return AWCNativeView(node: .init(id: id, tag: "md-avatar", properties: props)) { e in if e.name == "mdLoad" { state.loads.append(e.nodeID) } }
    }
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    avatar("near", nil)
                    Color.clear.frame(height: 3000)
                    avatar("far-lazy", nil).id("far")
                    avatar("far-eager", "eager")
                    Color.clear.frame(height: 800)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: state.scroll) { _, go in if go { proxy.scrollTo("far", anchor: .center) } }
        }
        .frame(width: 400, height: 600)
    }
}
@main @MainActor enum NativeAvatarLazyIntegration {
    static func pump(_ t: Double) { let end = Date().addingTimeInterval(t); while Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let state = AvatarLazyState(), host = NSHostingView(rootView: AvatarLazyFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 400, height: 600), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless()
        var checks = 0, failures: [String] = []
        func check(_ ok: Bool, _ m: String) { checks += 1; if !ok { failures.append(m) } }
        pump(1.5)
        check(Set(state.loads) == ["near", "far-eager"], "before scrolling, mdLoad near + far-eager only (Chrome): \(state.loads)")
        state.scroll = true; pump(1.5)
        check(Set(state.loads) == ["near", "far-eager", "far-lazy"], "after scrolling near, far-lazy loads (Chrome): \(state.loads)")
        check(state.loads.filter { $0 == "far-lazy" }.count == 1, "one mdLoad for the deferred avatar: \(state.loads)")
        print("Avatar lazy loading: \(checks - failures.count)/\(checks) checks passed"); failures.forEach { print("FAIL: " + $0) }
        window.close(); if !failures.isEmpty { exit(1) }
    }
}

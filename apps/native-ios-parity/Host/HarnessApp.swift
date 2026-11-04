// Simulator host for the iOS parity harness: starts one transformed macOS fixture (AWCParityFixture)
// from a run-loop timer (not a GCD block, so the fixture's nested run loops still drain the main
// queue exactly as they do in the macOS executables) and exits with the fixture.
#if os(iOS)
import UIKit
import SwiftUI
@testable import AWCUI

@main final class AWCParityAppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        setvbuf(stdout, nil, _IOLBF, 0)
        let w = UIWindow(frame: UIScreen.main.bounds); w.rootViewController = UIViewController(); w.rootViewController?.view.backgroundColor = .black
        w.makeKeyAndVisible(); window = w
        // The host's own full-screen window sits below the fixture windows (NSWindow, level normal): at the same level
        // the iPad focus system treats it as occluding every fixture view ("visually occluded by <UIView>") and Tab
        // finds only the first focusable item. A real app has no such backdrop window.
        w.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue - 1)
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { _ in MainActor.assumeIsolated { AWCParityHarness.start() } }
        return true
    }
}

@MainActor enum AWCParityHarness {
    static func start() {
        let screen = UIScreen.main
        var info = utsname(); uname(&info)
        print("AWC-IOS-START fixture=\(AWCParityFixture.name) ios=\(UIDevice.current.systemVersion) device=\(ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? "?") scale=\(screen.scale) screen=\(Int(screen.bounds.width))x\(Int(screen.bounds.height)) capture=\(AWCShim.captureMode)")
        // Warm the HID paths once (the first hardware key event pays ~90 ms of keyboard set-up in UIKit,
        // which would otherwise skew the first timed key step of a fixture).
        if let w = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first?.windows.first, AWCTouchSynth.keyAvailable {
            for usage: UInt32 in [225, 104] { AWCTouchSynth.key(usage: usage, down: true, window: w); AWCShim.pumpFrames(0.05); AWCTouchSynth.key(usage: usage, down: false, window: w); AWCShim.pumpFrames(0.25) }
        }
        // Warm AWCUI's first render once (SwiftUI type metadata, fonts, hosted platform views): on iOS 18 the first
        // hosted platform views of a process mount a few frames later than every later one, which only a fixture's
        // first case would otherwise see (AppKit hosts them synchronously).
        if let scene = AWCShim.activeScene {
            let warm = UIWindow(windowScene: scene); warm.frame = CGRect(x: 0, y: 0, width: 420, height: 600)
            warm.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue - 1)
            warm.rootViewController = UIHostingController(rootView: AWCParityWarmUp()); warm.isHidden = false
            AWCShim.pumpFrames(0.8); warm.isHidden = true; warm.rootViewController = nil
        }
        // Fixture arguments name oracle files by their bundle path (`@BUNDLE@/Tests/Fixtures/…`).
        CommandLine.arguments = CommandLine.arguments.map { $0.replacingOccurrences(of: "@BUNDLE@", with: Bundle.main.bundlePath) }
        let start = Date()
        AWCParityFixture.run()
        print("AWC-IOS-END seconds=\(String(format: "%.1f", Date().timeIntervalSince(start))) unsupported=\(AWCShim.unsupported.joined(separator: "; "))")
        fflush(stdout); exit(0)
    }
}
/// A small AWCUI tree that touches the hosted platform views the fixtures look for (focus bridges, reorder grip,
/// scroll container) and the bundled fonts.
struct AWCParityWarmUp: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AWCNativeView(node: .init(id: "warm-button", tag: "md-button", children: [.text("Warm")])) { _ in }
            AWCNativeView(node: .init(id: "warm-accordion", tag: "md-accordion", properties: ["reorderable": true], children: [
                .init(id: "warm-a", tag: "md-accordion-item", properties: ["headline": "A", "expanded": true], children: [.text("Body")]),
                .init(id: "warm-b", tag: "md-accordion-item", properties: ["headline": "B"], children: [.text("Body")])])) { _ in }
            AWCNativeView(node: .init(id: "warm-switch", tag: "md-switch")) { _ in }
        }.frame(width: 400, alignment: .topLeading)
    }
}
#endif

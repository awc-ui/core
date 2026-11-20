// Shared macOS test-harness input guard (story 6-5; KNOWN-CAUSES row 9). Debug builds only: product code never uses it.
//
// Other processes take active / key status from a states test process mid-run (mostly other lanes' states suites: each one
// activates itself when it starts). NSWindow.sendEvent then hands a synthesized press only to a hit view that accepts first
// mouse; every other press is swallowed, so a pointer pick is lost with no trace. Synthesized key events still reach the
// window (they carry its window number). The harness therefore
//   - hosts the fixture in AWCHarnessHost, which accepts first mouse, so SwiftUI content gets every press whether or not the
//     test process is active (no re-activation, so suites in other lanes are not disturbed in turn), and
//   - uses AWCHarnessWindow, which detects any press AppKit would still swallow (window not key and the hit view does not
//     accept first mouse) and records it by name with the step and the application that took activation. Suites turn the
//     records into failed checks (`AWCHarnessInput.takeLostInputs()`); nothing is retried.
#if DEBUG && canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
import SwiftUI

@MainActor public enum AWCHarnessInput {
    /// The suite's current step ("<run> <phase>"), used in reports.
    public static var step = ""
    /// Presses AppKit swallowed since the last `takeLostInputs()`.
    public private(set) static var lostInputs: [String] = []
    /// Times the watched window lost key status, and the applications that took activation.
    public private(set) static var keyLosses = 0
    public private(set) static var thieves: [String: Int] = [:]
    /// Presses delivered while the window was not key (each one reached its view because the hit view accepts first mouse).
    public private(set) static var pressesWhileNotKey = 0
    /// Prints one "[key-window] ..." line per loss (on by default; AWC_KEY_WINDOW_LOG=0 turns it off).
    public static var log = ProcessInfo.processInfo.environment["AWC_KEY_WINDOW_LOG"] != "0"
    private static var observers: [NSObjectProtocol] = []

    public static func takeLostInputs() -> [String] { defer { lostInputs = [] }; return lostInputs }

    static func frontmost() -> String {
        guard let a = NSWorkspace.shared.frontmostApplication else { return "none" }
        return "\(a.localizedName ?? a.executableURL?.lastPathComponent ?? "?")[\(a.processIdentifier)]"
    }

    static func recordLostInput(_ e: NSEvent, hit: NSView?, window: NSWindow) {
        let p = e.locationInWindow
        let s = "[key-window] input lost: \(e.type) at (\(Int(p.x)),\(Int(p.y))) on \(hit.map { "\(type(of: $0))" } ?? "no view") during '\(step)': window not key (app active \(NSApp.isActive), frontmost \(frontmost()))"
        lostInputs.append(s)
        if log { print(s); fflush(stdout) }
    }

    static func notePressWhileNotKey() { pressesWhileNotKey += 1 }

    /// Logs every key-status loss of `window` with the application that took activation.
    public static func watch(_ window: NSWindow) {
        for o in observers { NotificationCenter.default.removeObserver(o); NSWorkspace.shared.notificationCenter.removeObserver(o) }
        observers = [
            NotificationCenter.default.addObserver(forName: NSWindow.didResignKeyNotification, object: window, queue: .main) { _ in
                MainActor.assumeIsolated {
                    keyLosses += 1
                    if log { print("[key-window] resign during '\(step)': app active \(NSApp.isActive), key window \(NSApp.keyWindow.map { "\(type(of: $0))" } ?? "none"), frontmost \(frontmost())"); fflush(stdout) }
                }
            },
            NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { n in
                MainActor.assumeIsolated {
                    guard let a = n.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                          a.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
                    let name = a.executableURL?.lastPathComponent ?? a.localizedName ?? "?"
                    thieves[name, default: 0] += 1
                    if log { print("[key-window] activated during '\(step)': \(name)[\(a.processIdentifier)] policy \(a.activationPolicy.rawValue)"); fflush(stdout) }
                }
            },
        ]
    }

    /// One summary line: losses and who took activation.
    public static func summary() -> String {
        "[key-window] summary: key losses \(keyLosses), presses delivered while not key \(pressesWhileNotKey), activated by " + (thieves.isEmpty ? "none" : thieves.sorted { $0.value > $1.value }.map { "\($0.key) x\($0.value)" }.joined(separator: ", "))
    }
}

/// A borderless, key-capable test window that reports every press AppKit would swallow because the window is not key.
open class AWCHarnessWindow: NSWindow {
    open override var canBecomeKey: Bool { true }
    open override var canBecomeMain: Bool { true }
    open override func sendEvent(_ event: NSEvent) {
        if [.leftMouseDown, .rightMouseDown, .otherMouseDown].contains(event.type), !isKeyWindow, let content = contentView {
            let hit = content.hitTest(content.superview?.convert(event.locationInWindow, from: nil) ?? event.locationInWindow)
            if !(hit?.acceptsFirstMouse(for: event) ?? false) { MainActor.assumeIsolated { AWCHarnessInput.recordLostInput(event, hit: hit, window: self) } }
            else { MainActor.assumeIsolated { AWCHarnessInput.notePressWhileNotKey() } }
        }
        super.sendEvent(event)
    }
}

/// The fixture host: accepts first mouse, so a press reaches SwiftUI content while the test process is not active.
open class AWCHarnessHost<Content: View>: NSHostingView<Content> {
    open override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
#endif

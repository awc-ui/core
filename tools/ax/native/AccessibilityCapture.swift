import AppKit
import ApplicationServices
import AWCUI

/// Accessibility capture for the Laboratory's SwiftUI host (tools/ax). The tree is read through the macOS
/// Accessibility API (AXUIElement on this process) — the remote interface VoiceOver and other assistive clients use —
/// so it reflects what they receive rather than in-process view properties. The query runs on a background thread
/// while the main thread keeps servicing the accessibility requests.
enum AWCAccessibilityCapture {
    // Announcements (NSAccessibility announcement requests, e.g. SwiftUI AccessibilityNotification.Announcement) observed
    // through an AXObserver on this process since the host started; each snapshot returns and clears them.
    private final class Announcements: @unchecked Sendable { let lock = NSLock(); var items: [AWCValue] = [] }
    private static let announcements = Announcements()
    static func startAnnouncementObserver() {
        Thread.detachNewThread {
            var observer: AXObserver?
            let callback: AXObserverCallbackWithInfo = { _, _, _, info, _ in
                let dictionary = info as NSDictionary as? [String: Any] ?? [:]
                let text = (dictionary[kAXAnnouncementKey as String] as? String) ?? (dictionary[kAXAnnouncementKey as String] as? NSAttributedString)?.string ?? ""
                let priority = (dictionary["AXPriorityKey"] as? NSNumber)?.doubleValue ?? -1
                AWCAccessibilityCapture.announcements.lock.lock()
                AWCAccessibilityCapture.announcements.items.append(.object(["text": .string(text), "priority": .number(priority)]))
                AWCAccessibilityCapture.announcements.lock.unlock()
            }
            guard AXObserverCreateWithInfoCallback(getpid(), callback, &observer) == .success, let observer else { return }
            AXObserverAddNotification(observer, AXUIElementCreateApplication(getpid()), kAXAnnouncementRequestedNotification as CFString, nil)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), AXObserverGetRunLoopSource(observer), .defaultMode)
            CFRunLoopRun()
        }
    }
    private static func drainAnnouncements() -> [AWCValue] {
        announcements.lock.lock(); defer { announcements.lock.unlock() }
        let items = announcements.items; announcements.items = []; return items
    }
    private static let names: [(String, String)] = [
        ("role", kAXRoleAttribute), ("subrole", kAXSubroleAttribute), ("roleDescription", kAXRoleDescriptionAttribute),
        ("title", kAXTitleAttribute), ("description", kAXDescriptionAttribute), ("value", kAXValueAttribute),
        ("valueDescription", "AXValueDescription"), ("help", kAXHelpAttribute), ("placeholder", kAXPlaceholderValueAttribute),
        ("enabled", kAXEnabledAttribute), ("focused", kAXFocusedAttribute), ("selected", kAXSelectedAttribute),
        ("expanded", kAXExpandedAttribute), ("required", "AXRequired"), ("invalid", "AXInvalid"), ("identifier", kAXIdentifierAttribute),
        ("minValue", kAXMinValueAttribute), ("maxValue", kAXMaxValueAttribute), ("orientation", kAXOrientationAttribute),
        ("modal", kAXModalAttribute), ("disclosing", kAXDisclosingAttribute), ("disclosureLevel", kAXDisclosureLevelAttribute),
        ("headingLevel", "AXHeadingLevel"), ("hasPopup", "AXHasPopup"), ("popupValue", "AXPopupValue"), ("live", "AXARIALive"),
        ("selectedChildren", kAXSelectedChildrenAttribute), ("index", kAXIndexAttribute),
    ]

    /// AX numbers can be non-finite (NaN/∞), which JSON cannot carry: they are reported as null.
    private static func num(_ d: Double) -> AWCValue { d.isFinite ? .number(d) : .null }
    private static func num(_ d: CGFloat) -> AWCValue { num(Double(d)) }

    private static func value(_ raw: CFTypeRef) -> AWCValue? {
        let type = CFGetTypeID(raw)
        if type == CFStringGetTypeID() { return .string(raw as! String) }
        if type == CFBooleanGetTypeID() { return .bool(CFBooleanGetValue((raw as! CFBoolean))) }
        if type == CFNumberGetTypeID() { return num((raw as! NSNumber).doubleValue) }
        if type == CFAttributedStringGetTypeID() { return .string((raw as! NSAttributedString).string) }
        if type == CFArrayGetTypeID() { return .number(Double((raw as! [Any]).count)) }
        if type == AXUIElementGetTypeID() { return .string("<element>") }
        if type == AXValueGetTypeID() {
            let v = raw as! AXValue
            var point = CGPoint.zero, size = CGSize.zero, range = CFRange()
            if AXValueGetValue(v, .cgPoint, &point) { return .array([num(point.x), num(point.y)]) }
            if AXValueGetValue(v, .cgSize, &size) { return .array([num(size.width), num(size.height)]) }
            if AXValueGetValue(v, .cfRange, &range) { return .array([.number(Double(range.location)), .number(Double(range.length))]) }
        }
        return .string(String(describing: raw))
    }

    private static func attribute(_ e: AXUIElement, _ name: String) -> CFTypeRef? {
        var raw: CFTypeRef?
        return AXUIElementCopyAttributeValue(e, name as CFString, &raw) == .success ? raw : nil
    }

    private static func frame(_ e: AXUIElement, origin: CGPoint) -> AWCValue? {
        guard let p = attribute(e, kAXPositionAttribute), let s = attribute(e, kAXSizeAttribute) else { return nil }
        var point = CGPoint.zero, size = CGSize.zero
        guard AXValueGetValue(p as! AXValue, .cgPoint, &point), AXValueGetValue(s as! AXValue, .cgSize, &size) else { return nil }
        return .array([num(point.x - origin.x), num(point.y - origin.y), num(size.width), num(size.height)])
    }

    private static func node(_ e: AXUIElement, origin: CGPoint, depth: Int) -> AWCValue {
        var out: [String: AWCValue] = [:]
        for (key, name) in names { if let raw = attribute(e, name), let v = value(raw) { out[key] = v } }
        if let f = frame(e, origin: origin) { out["frame"] = f }
        var actions: CFArray?
        if AXUIElementCopyActionNames(e, &actions) == .success, let list = actions as? [String], !list.isEmpty { out["actions"] = .array(list.map(AWCValue.string)) }
        if let custom = attribute(e, "AXCustomActions") as? [Any], !custom.isEmpty {
            out["customActions"] = .array(custom.map { item -> AWCValue in
                if let action = item as? NSAccessibilityCustomAction { return .string(action.name) }
                if CFGetTypeID(item as CFTypeRef) == AXUIElementGetTypeID(), let n = attribute(item as! AXUIElement, "AXName") as? String { return .string(n) }
                return .string(String(describing: item)) })
        }
        if let linked = attribute(e, kAXLinkedUIElementsAttribute) as? [AXUIElement], !linked.isEmpty {
            out["linkedCount"] = .number(Double(linked.count))
            out["linked"] = .array(linked.map { .string((attribute($0, kAXDescriptionAttribute) as? String) ?? (attribute($0, kAXTitleAttribute) as? String) ?? "") })
        }
        if let titleElement = attribute(e, kAXTitleUIElementAttribute), CFGetTypeID(titleElement) == AXUIElementGetTypeID(),
           let t = attribute(titleElement as! AXUIElement, kAXValueAttribute) ?? attribute(titleElement as! AXUIElement, kAXTitleAttribute), let v = value(t) { out["titleElement"] = v }
        if depth < 40, let children = attribute(e, kAXChildrenAttribute) as? [AXUIElement], !children.isEmpty {
            out["children"] = .array(children.map { node($0, origin: origin, depth: depth + 1) })
        }
        return .object(out)
    }

    /// Captures every window of this process (popups and panels included) through the Accessibility API.
    @MainActor static func capture(window: NSWindow?) -> [String: AWCValue] {
        final class Box: @unchecked Sendable { var value: [String: AWCValue] = [:] }
        let box = Box()
        let done = DispatchSemaphore(value: 0)
        let pid = getpid()
        // AX frames are global and top-left based: element frames are reported relative to the preview's content.
        var origin = CGPoint.zero
        if let window, let screen = NSScreen.screens.first {
            let content = window.contentRect(forFrameRect: window.frame)
            origin = CGPoint(x: content.minX, y: screen.frame.maxY - content.maxY)
        }
        let o = origin
        Thread.detachNewThread {
            let app = AXUIElementCreateApplication(pid)
            AXUIElementSetMessagingTimeout(app, 3)
            var out: [String: AWCValue] = [:]
            let windows = (attribute(app, kAXWindowsAttribute) as? [AXUIElement]) ?? []
            out["windows"] = .array(windows.map { node($0, origin: o, depth: 0) })
            if let focused = attribute(app, kAXFocusedUIElementAttribute), CFGetTypeID(focused) == AXUIElementGetTypeID() {
                var f: [String: AWCValue] = [:]
                for (key, name) in names.prefix(6) { if let raw = attribute(focused as! AXUIElement, name), let v = value(raw) { f[key] = v } }
                if let fr = frame(focused as! AXUIElement, origin: o) { f["frame"] = fr }
                out["axFocused"] = .object(f)
            }
            out["axTrusted"] = .bool(AXIsProcessTrusted())
            box.value = out
            done.signal()
        }
        let deadline = Date().addingTimeInterval(20)
        while done.wait(timeout: .now()) == .timedOut && Date() < deadline {
            while let event = NSApp.nextEvent(matching: .any, until: Date(), inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002))
        }
        var result = box.value
        if result.isEmpty { result["error"] = "Accessibility query timed out." }
        result["announcements"] = .array(drainAnnouncements())
        // Keyboard focus as AppKit sees it (the preview window is never key, so AX focus may be absent).
        if let window, var responder = window.firstResponder as? NSView, responder !== window.contentView {
            // While a text field is edited, AppKit's first responder is the window's shared field editor: report the field.
            if let editor = responder as? NSTextView, editor.isFieldEditor {
                var view: NSView? = editor.superview; while let v = view, !(v is NSTextField) { view = v.superview }
                if let field = view ?? (editor.delegate as? NSView) { responder = field }
            }
            var f: [String: AWCValue] = ["class": .string(String(describing: type(of: responder)))]
            // An NSTextField answers no role through NSView's accessibilityRole(); its element is a text field (AXTextField).
            if let role = responder.accessibilityRole(), role != .unknown { f["role"] = .string(role.rawValue) }
            else if responder is NSTextField { f["role"] = .string(NSAccessibility.Role.textField.rawValue) }
            if let subrole = responder.accessibilitySubrole() { f["subrole"] = .string(subrole.rawValue) }
            if let label = responder.accessibilityLabel() { f["description"] = .string(label) }
            let id = responder.accessibilityIdentifier(); if !id.isEmpty { f["identifier"] = .string(id) }
            let r = responder.convert(responder.bounds, to: nil)
            let content = window.contentRect(forFrameRect: window.frame)
            f["frame"] = .array([.number(r.minX), .number(content.height - r.maxY), .number(r.width), .number(r.height)])
            result["keyboardFocus"] = .object(f)
        } else { result["keyboardFocus"] = .null }
        // Pixels for the contrast check (tools/ax contrast.mjs): the window content, top-left origin like the frames above.
        if let view = window?.contentView, view.bounds.width > 0, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
            view.cacheDisplay(in: view.bounds, to: rep)
            if let data = rep.representation(using: .png, properties: [:]) {
                result["image"] = .object(["png": .string(data.base64EncodedString()), "scale": .number(Double(rep.pixelsWide) / Double(view.bounds.width))])
            }
        }
        return result
    }
}

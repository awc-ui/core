import Foundation
import AppKit
import SwiftUI
import Darwin
import AWCUI

private struct PreviewRequest: Decodable {
    let id: AWCValue?
    let command: String
    let tag: String?
    let properties: [String: AWCValue]?
    let dark: Bool?
    let width: Double?
    let scenario: String?
    let themeTokens: [String: String]?
    let direction: String?
    let x: Double?
    let y: Double?
    let phase: String?
    let enabled: Bool?
    let text: String?
    let key: String?
    let modifiers: [String]?
}

private struct PreviewFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
    init(_ message: String) { self.message = message }
}

/// A bounded input queue keeps blocking pipe reads off AppKit's main thread.
private final class InputQueue: @unchecked Sendable {
    enum Entry { case line(Data), tooLarge, end }
    private let lock = NSCondition()
    private var entries: [Entry] = []
    func append(_ entry: Entry) {
        lock.lock()
        while entries.count >= 16 { lock.wait() }
        entries.append(entry); lock.unlock()
    }
    func take() -> Entry? {
        lock.lock(); defer { lock.unlock() }
        guard !entries.isEmpty else { return nil }
        let result = entries.removeFirst(); lock.signal(); return result
    }
    func read() {
        let limit = 2 * 1024 * 1024
        var pending = Data()
        var discarding = false
        var buffer = [UInt8](repeating: 0, count: 4096)
        while true {
            // POSIX read returns currently available pipe bytes; Foundation read(upToCount:)
            // can wait for the requested count and stall a request/response protocol.
            let count = Darwin.read(STDIN_FILENO, &buffer, buffer.count)
            if count < 0 && errno == EINTR { continue }
            if count <= 0 { break }
            for byte in buffer.prefix(count) {
                if byte == 10 {
                    if discarding { append(.tooLarge) }
                    else if !pending.isEmpty { append(.line(pending)) }
                    pending.removeAll(keepingCapacity: true); discarding = false
                } else if !discarding {
                    if pending.count == limit { pending.removeAll(keepingCapacity: true); discarding = true }
                    else { pending.append(byte) }
                }
            }
        }
        if discarding { append(.tooLarge) }
        else if !pending.isEmpty { append(.line(pending)) }
        append(.end)
    }
}

/// Stdout can back up when a browser stops consuming frames. Keep pipe writes
/// off AppKit's main thread and retain only the newest unsent picture.
private final class OutputQueue: @unchecked Sendable {
    private let lock = NSCondition()
    private var responses: [[String: AWCValue]] = []
    private var latestFrame: [String: AWCValue]?
    private var ended = false
    private let completed = DispatchSemaphore(value: 0)
    var isClosed: Bool { lock.lock(); defer { lock.unlock() }; return ended }

    @discardableResult func append(_ response: [String: AWCValue], streaming: Bool = false) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard !ended else { return false }
        if streaming {
            var frame = response
            if let previous = latestFrame {
                // Coalescing an old picture must not discard its asynchronous events.
                frame["events"] = .array(Array(((previous["events"]?.array ?? []) + (frame["events"]?.array ?? [])).suffix(256)))
            }
            latestFrame = frame
        } else {
            guard responses.count < 16 else { ended = true; lock.broadcast(); return false }
            responses.append(response)
        }
        lock.signal()
        return true
    }

    func close() { lock.lock(); ended = true; responses.removeAll(); latestFrame = nil; lock.broadcast(); lock.unlock() }
    func finish() {
        lock.lock(); ended = true; lock.broadcast(); lock.unlock()
        // EOF should still flush its final response. Never wait indefinitely for a dead reader.
        _ = completed.wait(timeout: .now() + 1)
    }

    func write() {
        defer { completed.signal() }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        while true {
            lock.lock()
            while !ended && responses.isEmpty && latestFrame == nil { lock.wait() }
            if ended && responses.isEmpty && latestFrame == nil { lock.unlock(); return }
            let response: [String: AWCValue]
            if !responses.isEmpty { response = responses.removeFirst() }
            else { response = latestFrame!; latestFrame = nil }
            lock.unlock()
            do { try FileHandle.standardOutput.write(contentsOf: encoder.encode(response) + Data([10])) }
            catch { close(); return }
        }
    }
}

@MainActor
private final class EventBuffer {
    var events: [[String: AWCValue]] = []
    func append(_ event: AWCEvent) {
        // Keep long-running animated previews from accumulating unbounded event history.
        if events.count == 256 { events.removeFirst() }
        var record: [String: AWCValue] = ["id": .string(event.id.uuidString), "name": .string(event.name),
                       "tag": .string(event.tag), "nodeID": .string(event.nodeID), "detail": event.detail,
                       "defaultPrevented": .bool(event.defaultPrevented),
                       "propagationPath": .array(event.propagationPath.map(AWCValue.string))]
        if let activation = event.activation {
            record["activation"] = .object(["id": .string(activation.id.uuidString), "kind": .string(activation.kind.rawValue)])
        }
        events.append(record)
    }
    func drain() -> AWCValue {
        defer { events.removeAll(keepingCapacity: true) }
        return .array(events.map(AWCValue.object))
    }
}

private struct PreviewRoot: View {
    let node: AWCNode
    let width: Double
    let dark: Bool
    let onEvent: (AWCEvent) -> Void
    let pointerState: AWCNativePointerState
    let scenario: String?
    let themeTokens: [String: String]
    let direction: String
    private var theme: AWCTheme { .generated(dark: dark, tokens: themeTokens) }
    @ViewBuilder private var example: some View {
        if scenario == "button-behavior" { AWCButtonBehaviorDemo(properties: node.properties, onEvent: onEvent) }
        else if scenario == "navigation-events" { AWCButtonNavigationDemo(properties: node.properties, onEvent: onEvent) }
        else if scenario == "focus-accessibility" { AWCButtonAccessibilityDemo(properties: node.properties, onEvent: onEvent) }
        else { AWCNativeView(node: node, onEvent: onEvent) }
    }
    var body: some View {
        example
            .padding(24)
            .frame(width: width, alignment: .center)
            .frame(minHeight: 100, alignment: .center)
            .background(themeTokens.isEmpty ? (dark ? Color(white: 0.08) : .white) : theme.background)
            .environment(\.colorScheme, dark ? .dark : .light)
            .environment(\.layoutDirection, direction == "rtl" ? .rightToLeft : .leftToRight)
            .environment(\.openURL, OpenURLAction { _ in .discarded })
            .awcTheme(theme)
            .environment(\.awcNativePointerState, pointerState)
            .coordinateSpace(name: "awc-native-preview")
    }
}

@MainActor
private final class NativeSession {
    private var host: NSHostingView<PreviewRoot>?
    private var window: NSWindow?
    private var logicalWidth: Double = 640
    private var tag = ""
    private let events = EventBuffer()
    private var eventNumber = 0
    private var pointerHeld = false
    private let pointerState = AWCNativePointerState()
    private var streaming = false
    private var nextStreamFrame: Double = 0
    private let streamInterval: Double = 1 / 60
    private var inputNotice: String?
    private var activity: NSObjectProtocol?

    func close() {
        streaming = false
        try? cancelPointer()
        window?.close(); window = nil; host = nil
        if let activity { ProcessInfo.processInfo.endActivity(activity); self.activity = nil }
    }

    func handle(_ request: PreviewRequest) throws -> [String: AWCValue] {
        inputNotice = nil
        switch request.command {
        case "configure": try configure(request)
        case "click": try click(request)
        case "pointer": try pointer(request)
        case "text": try insert(request)
        case "key": try key(request)
        case "frame": try requireConfigured()
        case "stream":
            try requireConfigured()
            guard let enabled = request.enabled else { throw PreviewFailure("Stream requires an enabled boolean.") }
            streaming = enabled
            nextStreamFrame = ProcessInfo.processInfo.systemUptime
        default: throw PreviewFailure("Unsupported command: \(request.command)")
        }
        if request.command == "stream" || (streaming && request.command != "configure" && request.command != "frame") {
            var response: [String: AWCValue] = ["id": request.id ?? .null, "ack": true, "events": events.drain()]
            if let inputNotice { response["inputIgnored"] = .string(inputNotice) }
            return response
        }
        // Keep legacy input settling, but a plain frame never adds an artificial wait.
        if request.command != "frame" { Self.pump(request.command == "pointer" ? 0.008 : 0.04) }
        var response = try frame()
        response["id"] = request.id ?? .null
        response["events"] = events.drain()
        if let inputNotice { response["inputIgnored"] = .string(inputNotice) }
        return response
    }

    func streamFrameIfDue() throws -> [String: AWCValue]? {
        guard streaming else { return nil }
        let now = ProcessInfo.processInfo.systemUptime
        guard now >= nextStreamFrame else { return nil }
        // Advance a monotonic deadline and skip missed intervals rather than queuing frames.
        nextStreamFrame += max(1, floor((now - nextStreamFrame) / streamInterval) + 1) * streamInterval
        var response = try frame()
        response["id"] = .null
        response["kind"] = "frame"
        response["events"] = events.drain()
        return response
    }

    func failure(_ error: Error, id: AWCValue?) -> [String: AWCValue] {
        ["id": id ?? .null, "error": .string(error.localizedDescription), "events": events.drain()]
    }

    private func configure(_ request: PreviewRequest) throws {
        guard host == nil else { throw PreviewFailure("This session is already configured. Start a new process to change root properties.") }
        guard let requestedTag = request.tag, AWCComponentCatalog.tags.contains(requestedTag) else {
            throw PreviewFailure("Configure requires a known AWC component tag.")
        }
        let width = request.width ?? 640
        guard width.isFinite else { throw PreviewFailure("Width must be finite.") }
        guard !NSScreen.screens.isEmpty else {
            throw PreviewFailure("Native interaction requires access to the macOS WindowServer. Run the preview server in a desktop session outside a restricted process sandbox.")
        }
        logicalWidth = min(1200, max(320, width)).rounded()
        guard request.scenario == nil || (["button-behavior", "navigation-events", "focus-accessibility"].contains(request.scenario ?? "") && requestedTag == "md-button") else { throw PreviewFailure("Unknown native example.") }
        guard request.direction == nil || ["ltr", "rtl"].contains(request.direction ?? "") else { throw PreviewFailure("Direction must be ltr or rtl.") }
        var node = AWCExamples.node(for: requestedTag)
        node.properties.merge(request.properties ?? [:]) { _, supplied in supplied }
        tag = requestedTag
        let newHost = NSHostingView(rootView: PreviewRoot(node: node, width: logicalWidth, dark: request.dark ?? false, onEvent: events.append, pointerState: pointerState, scenario: request.scenario, themeTokens: request.themeTokens ?? [:], direction: request.direction ?? "ltr"))
        // The window is realized outside every display, never activated, and never made key.
        let left = NSScreen.screens.map { $0.frame.minX }.min() ?? 0
        let bottom = NSScreen.screens.map { $0.frame.minY }.min() ?? 0
        let newWindow = NSWindow(contentRect: NSRect(x: left - 10000, y: bottom - 10000, width: logicalWidth, height: 100),
                                 styleMask: .borderless, backing: .buffered, defer: false)
        newWindow.isReleasedWhenClosed = false
        newWindow.colorSpace = .sRGB
        newWindow.acceptsMouseMovedEvents = true
        newWindow.isExcludedFromWindowsMenu = true
        newWindow.collectionBehavior = [.transient, .ignoresCycle]
        newWindow.contentView = newHost
        newHost.frame = NSRect(x: 0, y: 0, width: logicalWidth, height: 100)
        newWindow.orderBack(nil)
        guard newWindow.windowNumber > 0 else {
            newWindow.close()
            throw PreviewFailure("WindowServer did not realize the private native preview window.")
        }
        host = newHost; window = newWindow
        // A visible browser preview is user-initiated work even though its native host
        // stays offscreen. Prevent App Nap for this session without preventing system sleep.
        activity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep,
                                                        reason: "Rendering an active interactive SwiftUI preview")
        Self.pump(0.10)
    }

    private func requireConfigured() throws {
        guard host != nil, window != nil else { throw PreviewFailure("Configure the native session first.") }
    }

    private func click(_ request: PreviewRequest) throws {
        try requireConfigured()
        try cancelPointer()
        guard let host, let window, let x = request.x, let y = request.y,
              x.isFinite, y.isFinite, x >= 0, y >= 0, x < host.bounds.width, y < host.bounds.height else {
            throw PreviewFailure("Click coordinates must be finite and inside the logical preview bounds.")
        }
        let point = NSPoint(x: x, y: host.isFlipped ? y : host.bounds.height - y)
        let location = host.convert(point, to: nil)
        pointerState.update(phase: .down, location: CGPoint(x: x, y: y))
        // Native menus/color panels create separate windows outside this single-surface protocol.
        var target = host.hitTest(location)
        while let view = target {
            if view is NSPopUpButton || view is NSColorWell || view is NSDatePicker {
                throw PreviewFailure("Native popup controls are not supported by the single-window live preview yet.")
            }
            target = view.superview
        }
        eventNumber += 2
        let now = ProcessInfo.processInfo.systemUptime
        guard let down = NSEvent.mouseEvent(with: .leftMouseDown, location: location, modifierFlags: [], timestamp: now,
                                            windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber - 1, clickCount: 1, pressure: 1),
              let up = NSEvent.mouseEvent(with: .leftMouseUp, location: location, modifierFlags: [], timestamp: now + 0.01,
                                          windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber, clickCount: 1, pressure: 0) else {
            throw PreviewFailure("Could not construct a native pointer event.")
        }
        // Queue the release before synchronous mouseDown: AppKit controls can enter a tracking loop.
        // postEvent targets only this process's NSApplication queue, never the system event stream.
        NSApp.postEvent(up, atStart: false)
        window.sendEvent(down)
        DispatchQueue.main.async { [weak self] in self?.pointerState.update(phase: .up, location: CGPoint(x: x, y: y)) }
    }

    private func pointer(_ request: PreviewRequest) throws {
        try requireConfigured()
        guard tag == "md-button" else { throw PreviewFailure("Held pointer input is supported only for md-button previews.") }
        guard let host, let window, let phase = request.phase, ["down", "up", "cancel", "move", "leave"].contains(phase),
              let x = request.x, let y = request.y, x.isFinite, y.isFinite else {
            throw PreviewFailure("Pointer input requires a supported phase and finite coordinates.")
        }
        let inside = x >= 0 && y >= 0 && x < host.bounds.width && y < host.bounds.height
        if phase == "move" || phase == "leave" {
            pointerState.update(phase: phase == "leave" || !inside ? .leave : .move, location: inside ? CGPoint(x: x, y: y) : nil)
            let point = phase == "leave" || !inside ? NSPoint(x: -1000, y: -1000)
                : host.convert(NSPoint(x: x, y: host.isFlipped ? y : host.bounds.height - y), to: nil)
            window.sendEvent(try pointerEvent(pointerHeld ? .leftMouseDragged : .mouseMoved, at: point))
            return
        }
        if phase == "cancel" || (phase == "up" && !inside) { try cancelPointer(); return }
        guard inside else { throw PreviewFailure("Pointer down must be inside the logical preview bounds.") }
        if phase == "down" && pointerHeld { inputNotice = "A native pointer press is already held."; return }
        if phase == "up" && !pointerHeld { inputNotice = "No native pointer press is held."; return }
        let point = NSPoint(x: x, y: host.isFlipped ? y : host.bounds.height - y)
        let location = host.convert(point, to: nil)
        let event = try pointerEvent(phase == "down" ? .leftMouseDown : .leftMouseUp, at: location)
        pointerState.update(phase: phase == "down" ? .down : .up, location: CGPoint(x: x, y: y))
        pointerHeld = phase == "down"
        // SwiftUI's Button gesture accepts down without entering AppKit's blocking tracking loop.
        // Separate commands preserve its real ButtonStyle.isPressed state until the matching up.
        // Dispatch stays inside this process's private offscreen window; no global event is posted.
        window.sendEvent(event)
    }

    private func pointerEvent(_ type: NSEvent.EventType, at location: NSPoint) throws -> NSEvent {
        guard let window else { throw PreviewFailure("Native window unavailable.") }
        eventNumber += 1
        guard let event = NSEvent.mouseEvent(with: type, location: location, modifierFlags: [],
                                             timestamp: ProcessInfo.processInfo.systemUptime,
                                             windowNumber: window.windowNumber, context: nil,
                                             eventNumber: eventNumber, clickCount: type == .mouseMoved ? 0 : 1,
                                             pressure: type == .leftMouseDown || type == .leftMouseDragged ? 1 : 0) else {
            throw PreviewFailure("Could not construct a native pointer event.")
        }
        return event
    }

    private func cancelPointer() throws {
        pointerState.update(phase: .cancel)
        guard pointerHeld, let window else { return }
        pointerHeld = false
        // A release outside our own window cancels the SwiftUI gesture without activating it.
        // Cancel coordinates intentionally ignore the last in-bounds position from the browser.
        window.sendEvent(try pointerEvent(.leftMouseUp, at: NSPoint(x: -1000, y: -1000)))
    }

    private func insert(_ request: PreviewRequest) throws {
        try requireConfigured()
        guard let text = request.text, text.utf8.count <= 4096 else {
            throw PreviewFailure("Text requires a UTF-8 string of at most 4096 bytes.")
        }
        guard let client = window?.firstResponder as? NSTextInputClient else {
            inputNotice = "No native text input has focus."; return
        }
        if let editor = window?.firstResponder as? NSTextView, !editor.isEditable {
            inputNotice = "The focused native text input is not editable."; return
        }
        client.insertText(text, replacementRange: NSRange(location: NSNotFound, length: 0))
    }

    private func key(_ request: PreviewRequest) throws {
        try requireConfigured()
        guard let key = request.key else { throw PreviewFailure("Key name is required.") }
        let modifiers = Set(request.modifiers ?? [])
        guard modifiers.isSubset(of: ["shift", "control", "alt", "meta"]) else {
            throw PreviewFailure("Unknown key modifier.")
        }
        if key == "Tab" {
            guard modifiers.isSubset(of: ["shift"]) else { inputNotice = "Tab supports only the shift modifier."; return }
            if modifiers.contains("shift") { window?.selectPreviousKeyView(nil) }
            else { window?.selectNextKeyView(nil) }
            return
        }
        guard let client = window?.firstResponder as? NSTextInputClient else {
            try sendControlKey(key, modifiers: modifiers); return
        }
        if modifiers.contains("control") {
            inputNotice = "Control chords are not supported in native text inputs."; return
        }
        if let editor = window?.firstResponder as? NSTextView, !editor.isEditable {
            inputNotice = "The focused native text input is not editable."; return
        }
        // doCommand does not carry keyboard modifiers. Preserve the source
        // form rule: modified Enter must not become an unmodified submission.
        if key == "Enter", !modifiers.isEmpty,
           let editor = window?.firstResponder as? NSTextView, editor.isFieldEditor {
            inputNotice = "Modified Enter does not submit a native single-line field."; return
        }
        if key == "Space" {
            guard modifiers.isEmpty || modifiers == ["shift"] else { inputNotice = "Space supports only the shift modifier."; return }
            client.insertText(" ", replacementRange: NSRange(location: NSNotFound, length: 0)); return
        }
        let shift = modifiers.contains("shift"), word = modifiers.contains("alt"), meta = modifiers.contains("meta")
        let command: String
        switch key {
        case "Enter": command = "insertNewline:"
        case "Escape": command = "cancelOperation:"
        case "Backspace": command = meta ? "deleteToBeginningOfLine:" : word ? "deleteWordBackward:" : "deleteBackward:"
        case "Delete": command = meta ? "deleteToEndOfLine:" : word ? "deleteWordForward:" : "deleteForward:"
        case "ArrowLeft": command = meta ? "moveToBeginningOfLine:" : word ? "moveWordLeft:" : "moveLeft:"
        case "ArrowRight": command = meta ? "moveToEndOfLine:" : word ? "moveWordRight:" : "moveRight:"
        case "ArrowUp": command = meta ? "moveToBeginningOfDocument:" : word ? "moveToBeginningOfParagraph:" : "moveUp:"
        case "ArrowDown": command = meta ? "moveToEndOfDocument:" : word ? "moveToEndOfParagraph:" : "moveDown:"
        case "Home": command = "moveToBeginningOfDocument:"
        case "End": command = "moveToEndOfDocument:"
        case "PageUp": command = "pageUp:"
        case "PageDown": command = "pageDown:"
        default: throw PreviewFailure("Unsupported native key: \(key)")
        }
        let selector = shift && (command.hasPrefix("move") || command.hasPrefix("page"))
            ? String(command.dropLast()) + "AndModifySelection:" : command
        // Every selector comes from the fixed table above; input never supplies a selector or source code.
        client.doCommand(by: NSSelectorFromString(selector))
    }

    /// Dispatch only fixed named keys to this session's private native window.
    /// Button responders need keyDown/keyUp, rather than text-editor commands.
    private func sendControlKey(_ key: String, modifiers: Set<String>) throws {
        guard let window else { throw PreviewFailure("Native window unavailable.") }
        let keys: [String: (UInt16, String)] = [
            "Enter": (0x24, "\r"), "Space": (0x31, " "), "Escape": (0x35, "\u{1b}"),
            "Backspace": (0x33, "\u{7f}"), "Delete": (0x75, "\u{f728}"),
            "ArrowLeft": (0x7b, "\u{f702}"), "ArrowRight": (0x7c, "\u{f703}"),
            "ArrowUp": (0x7e, "\u{f700}"), "ArrowDown": (0x7d, "\u{f701}"),
            "Home": (0x73, "\u{f729}"), "End": (0x77, "\u{f72b}"),
            "PageUp": (0x74, "\u{f72c}"), "PageDown": (0x79, "\u{f72d}")
        ]
        guard let (code, characters) = keys[key] else { throw PreviewFailure("Unsupported native key: \(key)") }
        var flags: NSEvent.ModifierFlags = []
        if modifiers.contains("shift") { flags.insert(.shift) }
        if modifiers.contains("control") { flags.insert(.control) }
        if modifiers.contains("alt") { flags.insert(.option) }
        if modifiers.contains("meta") { flags.insert(.command) }
        if characters.unicodeScalars.contains(where: { $0.value >= 0xf700 }) { flags.insert(.function) }
        for type in [NSEvent.EventType.keyDown, .keyUp] {
            guard let event = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: flags,
                timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                context: nil, characters: characters, charactersIgnoringModifiers: characters,
                isARepeat: false, keyCode: code) else { throw PreviewFailure("Could not construct a native key event.") }
            window.sendEvent(event)
        }
    }

    private func frame() throws -> [String: AWCValue] {
        try requireConfigured()
        guard let host, let window else { throw PreviewFailure("Native window unavailable.") }
        let profiling = ProcessInfo.processInfo.environment["AWC_NATIVE_PROFILE"] == "1"
        let start = ProcessInfo.processInfo.systemUptime
        host.layoutSubtreeIfNeeded()
        let fitting = host.fittingSize.height
        guard fitting.isFinite, fitting > 0 else { throw PreviewFailure("Component produced invalid native layout dimensions.") }
        let height = min(2000, max(100, fitting.rounded(.up)))
        if host.bounds.size != NSSize(width: logicalWidth, height: height) {
            window.setContentSize(NSSize(width: logicalWidth, height: height))
            host.frame = NSRect(x: 0, y: 0, width: logicalWidth, height: height)
            host.layoutSubtreeIfNeeded()
        }
        let layoutDone = ProcessInfo.processInfo.systemUptime
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { throw PreviewFailure("Native bitmap allocation failed.") }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let captureDone = ProcessInfo.processInfo.systemUptime
        guard let output = bitmap.colorSpace == .sRGB ? bitmap : bitmap.converting(to: .sRGB, renderingIntent: .default),
              let png = output.representation(using: .png, properties: [:]) else { throw PreviewFailure("Native sRGB PNG encoding failed.") }
        if profiling {
            let end = ProcessInfo.processInfo.systemUptime
            let profile: [String: Double] = ["layoutMs": (layoutDone - start) * 1000, "captureMs": (captureDone - layoutDone) * 1000,
                                            "encodeMs": (end - captureDone) * 1000, "totalMs": (end - start) * 1000, "bytes": Double(png.count)]
            if let json = try? JSONSerialization.data(withJSONObject: ["nativeFrameProfile": profile], options: [.sortedKeys]) {
                FileHandle.standardError.write(json + Data([10]))
            }
        }
        return ["platform": "macos", "renderer": "SwiftUI", "tag": .string(tag), "png": .string(png.base64EncodedString()),
                "width": .number(Double(bitmap.pixelsWide)), "height": .number(Double(bitmap.pixelsHigh)),
                "logicalWidth": .number(logicalWidth), "logicalHeight": .number(height)]
    }

    static func pump(_ seconds: Double) {
        let end = Date().addingTimeInterval(seconds)
        repeat {
            while let event = NSApp.nextEvent(matching: .any, until: Date(), inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: min(end, Date().addingTimeInterval(0.001)))
        } while Date() < end
    }
}

@main
private struct LiveRenderer {
    @MainActor static func main() {
        guard Array(CommandLine.arguments.dropFirst()) == ["--stdio"] else {
            FileHandle.standardError.write(Data("Usage: AWCLivePreview --stdio\n".utf8)); exit(EXIT_FAILURE)
        }
        signal(SIGPIPE, SIG_IGN)
        NSApplication.shared.setActivationPolicy(.accessory)
        NSApplication.shared.finishLaunching()
        let queue = InputQueue()
        let output = OutputQueue()
        DispatchQueue.global(qos: .userInitiated).async { queue.read() }
        DispatchQueue.global(qos: .userInitiated).async { output.write() }
        let session = NativeSession()
        var finished = false
        while !finished && !output.isClosed {
            if let entry = queue.take() {
                var id: AWCValue?
                do {
                    let response: [String: AWCValue]
                    switch entry {
                    case .end: finished = true; continue
                    case .tooLarge: throw PreviewFailure("Request exceeds the 2 MiB input limit.")
                    case .line(let data):
                        let request = try JSONDecoder().decode(PreviewRequest.self, from: data)
                        id = request.id
                        response = try session.handle(request)
                    }
                    if !output.append(response) { finished = true }
                } catch {
                    if !output.append(session.failure(error, id: id)) { finished = true }
                }
            }
            do {
                if let frame = try session.streamFrameIfDue() { output.append(frame, streaming: true) }
            } catch {
                output.append(session.failure(error, id: nil))
                finished = true
            }
            NativeSession.pump(0.001)
        }
        session.close()
        output.finish()
    }
}

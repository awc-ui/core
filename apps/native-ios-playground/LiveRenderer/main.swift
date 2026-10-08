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
    let x: Double?
    let y: Double?
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

@MainActor
private final class EventBuffer {
    var events: [[String: AWCValue]] = []
    func append(_ event: AWCEvent) {
        // Keep long-running animated previews from accumulating unbounded event history.
        if events.count == 256 { events.removeFirst() }
        events.append(["id": .string(event.id.uuidString), "name": .string(event.name),
                       "tag": .string(event.tag), "nodeID": .string(event.nodeID), "detail": event.detail])
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
    var body: some View {
        AWCNativeView(node: node, onEvent: onEvent)
            .padding(24)
            .frame(width: width, alignment: .leading)
            .frame(minHeight: 100, alignment: .topLeading)
            .background(dark ? Color(white: 0.08) : .white)
            .environment(\.colorScheme, dark ? .dark : .light)
            .environment(\.openURL, OpenURLAction { _ in .discarded })
            .awcTheme(.generated(dark: dark))
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
    private var inputNotice: String?
    private var activity: NSObjectProtocol?

    func close() {
        window?.close(); window = nil; host = nil
        if let activity { ProcessInfo.processInfo.endActivity(activity); self.activity = nil }
    }

    func handle(_ request: PreviewRequest) throws -> [String: AWCValue] {
        inputNotice = nil
        switch request.command {
        case "configure": try configure(request)
        case "click": try click(request)
        case "text": try insert(request)
        case "key": try key(request)
        case "frame": try requireConfigured()
        default: throw PreviewFailure("Unsupported command: \(request.command)")
        }
        Self.pump(0.04)
        var response = try frame()
        response["id"] = request.id ?? .null
        response["events"] = events.drain()
        if let inputNotice { response["inputIgnored"] = .string(inputNotice) }
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
        var node = AWCExamples.node(for: requestedTag)
        node.properties.merge(request.properties ?? [:]) { _, supplied in supplied }
        tag = requestedTag
        let newHost = NSHostingView(rootView: PreviewRoot(node: node, width: logicalWidth, dark: request.dark ?? false, onEvent: events.append))
        // The window is realized outside every display, never activated, and never made key.
        let left = NSScreen.screens.map { $0.frame.minX }.min() ?? 0
        let bottom = NSScreen.screens.map { $0.frame.minY }.min() ?? 0
        let newWindow = NSWindow(contentRect: NSRect(x: left - 10000, y: bottom - 10000, width: logicalWidth, height: 100),
                                 styleMask: .borderless, backing: .buffered, defer: false)
        newWindow.isReleasedWhenClosed = false
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
        guard let host, let window, let x = request.x, let y = request.y,
              x.isFinite, y.isFinite, x >= 0, y >= 0, x < host.bounds.width, y < host.bounds.height else {
            throw PreviewFailure("Click coordinates must be finite and inside the logical preview bounds.")
        }
        let point = NSPoint(x: x, y: host.isFlipped ? y : host.bounds.height - y)
        let location = host.convert(point, to: nil)
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
                                            windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber, clickCount: 1, pressure: 1),
              let up = NSEvent.mouseEvent(with: .leftMouseUp, location: location, modifierFlags: [], timestamp: now + 0.01,
                                          windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber + 1, clickCount: 1, pressure: 0) else {
            throw PreviewFailure("Could not construct a native pointer event.")
        }
        // Queue the release before synchronous mouseDown: AppKit controls can enter a tracking loop.
        // postEvent targets only this process's NSApplication queue, never the system event stream.
        NSApp.postEvent(up, atStart: false)
        window.sendEvent(down)
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
        if modifiers.contains("control") {
            inputNotice = "Control chords are not supported by this native preview."; return
        }
        if key == "Tab" {
            guard modifiers.isSubset(of: ["shift"]) else { inputNotice = "Tab supports only the shift modifier."; return }
            if modifiers.contains("shift") { window?.selectPreviousKeyView(nil) }
            else { window?.selectNextKeyView(nil) }
            return
        }
        guard let client = window?.firstResponder as? NSTextInputClient else {
            inputNotice = "This key requires focus in a native text input."; return
        }
        if let editor = window?.firstResponder as? NSTextView, !editor.isEditable {
            inputNotice = "The focused native text input is not editable."; return
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

    private func frame() throws -> [String: AWCValue] {
        try requireConfigured()
        guard let host, let window else { throw PreviewFailure("Native window unavailable.") }
        host.layoutSubtreeIfNeeded()
        let fitting = host.fittingSize.height
        guard fitting.isFinite, fitting > 0 else { throw PreviewFailure("Component produced invalid native layout dimensions.") }
        let height = min(2000, max(100, fitting.rounded(.up)))
        if host.bounds.size != NSSize(width: logicalWidth, height: height) {
            window.setContentSize(NSSize(width: logicalWidth, height: height))
            host.frame = NSRect(x: 0, y: 0, width: logicalWidth, height: height)
            host.layoutSubtreeIfNeeded()
        }
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { throw PreviewFailure("Native bitmap allocation failed.") }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        guard let png = bitmap.representation(using: .png, properties: [:]) else { throw PreviewFailure("Native PNG encoding failed.") }
        return ["platform": "macos", "renderer": "SwiftUI", "tag": .string(tag), "png": .string(png.base64EncodedString()),
                "width": .number(Double(bitmap.pixelsWide)), "height": .number(Double(bitmap.pixelsHigh)),
                "logicalWidth": .number(logicalWidth), "logicalHeight": .number(height)]
    }

    static func pump(_ seconds: Double) {
        let end = Date().addingTimeInterval(seconds)
        repeat {
            while let event = NSApp.nextEvent(matching: .any, until: Date(), inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004))
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
        DispatchQueue.global(qos: .userInitiated).async { queue.read() }
        let session = NativeSession()
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        var finished = false
        while !finished {
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
                    try FileHandle.standardOutput.write(contentsOf: encoder.encode(response) + Data([10]))
                } catch {
                    do { try FileHandle.standardOutput.write(contentsOf: encoder.encode(session.failure(error, id: id)) + Data([10])) }
                    catch { finished = true }
                }
            } else { NativeSession.pump(0.008) }
        }
        session.close()
    }
}

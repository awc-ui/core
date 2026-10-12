import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class FocusFixtureState {
    var rtl = false
    var selectionMode = "single-select"
    var disableLast = false
    var events: [AWCEvent] = []
}
struct FocusFixture: View {
    let state: FocusFixtureState
    func node(_ id: String, _ values: [String: AWCValue] = [:]) -> AWCNode {
        .init(id: id, tag: "md-button", properties: ["size": "xs"].merging(values) { _, new in new }, children: [.text(id)])
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AWCNativeView(node: node("before"), onEvent: { state.events.append($0) })
            AWCNativeView(node: .init(id: "group", tag: "md-button-group", properties: ["dir": .string(state.rtl ? "rtl" : "ltr"), "selectionMode": .string(state.selectionMode)], children: [
                .init(id: "a", tag: "md-icon-button", properties: ["icon": "add", "size": "xs"]), node("disabled", ["disabled": true]), node("soft", ["softDisabled": true]),
                node("loading", ["loading": true]), node("z", ["selected": true, "disabled": .bool(state.disableLast)])
            ]), onEvent: { state.events.append($0) })
            AWCNativeView(node: node("after"), onEvent: { state.events.append($0) })
            AWCNativeView(node: node("cell", ["roleOverride": "gridcell", "selected": true, "groupTabindex": -1]), onEvent: { state.events.append($0) })
                .environment(\.awcGridCellContext, .init(row: 1, column: 2))
            AWCNativeView(node: node("unknown", ["roleOverride": "custom-role"]), onEvent: { state.events.append($0) })
        }.padding(20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
@main @MainActor enum NativeFocusViewIntegration {
    static var count = 0
    static func check(_ value: Bool, _ text: String) { count += 1; guard value else { fatalError(text) } }
    static func pump(_ duration: TimeInterval = 0.15) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005))
        }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    /// Capture actual native view pixels with a fixed color space/format. No
    /// implementation state is read: the assertions cover the rendered result.
    static func pixels(_ host: NSView) -> [UInt8] {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { fatalError("Native bitmap allocation failed") }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        guard let image = bitmap.cgImage, let space = CGColorSpace(name: CGColorSpace.sRGB) else { fatalError("Native bitmap capture failed") }
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("Native RGBA conversion failed") }
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return bytes
    }
    static func checkPointerFocusModality() {
        let state = FocusModalityFixtureState()
        let host = NSHostingView(rootView: FocusModalityFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 320, height: 140), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB
        window.contentView = host; window.orderFrontRegardless(); host.layoutSubtreeIfNeeded(); pump(0.35)
        guard let target = descendants(host).first(where: {
            String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") && $0.accessibilityIdentifier() == "modality-target"
        }) else { fatalError("Missing real pointer-focus target") }
        var eventNumber = 100
        func pointerClick() {
            let local = NSPoint(x: target.bounds.midX, y: target.bounds.midY)
            let windowPoint = target.convert(local, to: nil)
            let hostPoint = target.convert(local, to: host)
            let logical = CGPoint(x: hostPoint.x, y: host.isFlipped ? hostPoint.y : host.bounds.height - hostPoint.y)
            let time = ProcessInfo.processInfo.systemUptime
            let down = NSEvent.mouseEvent(with: .leftMouseDown, location: windowPoint, modifierFlags: [], timestamp: time,
                windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber, clickCount: 1, pressure: 1)!
            let up = NSEvent.mouseEvent(with: .leftMouseUp, location: windowPoint, modifierFlags: [], timestamp: time + 0.01,
                windowNumber: window.windowNumber, context: nil, eventNumber: eventNumber + 1, clickCount: 1, pressure: 0)!
            eventNumber += 2
            // Geometry accompanies real scoped events, exactly as in the native
            // preview host; it never activates the button or mutates its focus.
            state.pointer.update(phase: .down, location: logical)
            window.sendEvent(down); pump(0.03); window.sendEvent(up)
            state.pointer.update(phase: .up, location: logical)
            state.pointer.update(phase: .leave); pump(0.65)
        }
        _ = window.makeFirstResponder(nil); state.pointer.update(phase: .leave); pump()
        let baseline = pixels(host)
        pointerClick()
        check(state.clicks == 1, "A real pointer down/up activates the visual SwiftUI button once")
        check(window.firstResponder === target, "Pointer activation retains the actual native first responder")
        check(pixels(host) == baseline, "After pointer release/leave the button pixels return to baseline without retained focus ring or tint")
        _ = window.makeFirstResponder(nil); _ = window.makeFirstResponder(target); pump()
        let programmatic = pixels(host)
        let programmaticDifference = zip(programmatic, baseline).filter { $0 != $1 }.count
        check(window.firstResponder === target && programmaticDifference > 100, "Programmatic native focus visibly restores the ring/state layer")
        pointerClick()
        check(state.clicks == 2 && window.firstResponder === target, "Pointer activation of an already focused button preserves focus and fires once")
        check(pixels(host) == baseline, "Pointer activation clears previous keyboard/programmatic focus visuals even when first responder is unchanged")
        _ = window.makeFirstResponder(nil); window.selectNextKeyView(nil); pump()
        check(window.firstResponder === target && pixels(host) != baseline, "Actual native Tab traversal restores visible keyboard focus")
        pointerClick()
        let enter = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber, context: nil, characters: "\r", charactersIgnoringModifiers: "\r", isARepeat: false, keyCode: 36)!
        window.sendEvent(enter); pump()
        check(state.clicks == 4 && window.firstResponder === target, "Native Enter activates after pointer focus without losing the responder")
        check(pixels(host) != baseline, "Keyboard use on a pointer-focused button restores visible focus")
        window.close(); pump()
    }
    static func checkNativeKeyboardRipple() {
        func runCase(_ name: String, properties: [String: AWCValue], expectAction: Bool, expectWave: Bool, keyCode: UInt16 = 36, characters: String = "\r", presses: Int = 1) {
            let keyName = keyCode == 49 ? "Space" : "Enter"
            let state = FocusModalityFixtureState()
            let host = NSHostingView(rootView: KeyboardRippleFixture(state: state, properties: properties))
            let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 320, height: 140), styleMask: [.borderless], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false; window.colorSpace = .sRGB
            window.contentView = host; window.orderFrontRegardless(); host.layoutSubtreeIfNeeded(); pump(0.25)
            guard let target = descendants(host).first(where: {
                String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") && $0.accessibilityIdentifier() == "keyboard-ripple-target"
            }) else { fatalError("Missing native keyboard-ripple target") }
            _ = window.makeFirstResponder(target)
            // Focus is already visible and settled before Enter; shapeMorph is
            // false in the fixture. Neither can make the ripple assertion pass.
            pump(0.3)
            let baseline = pixels(host)
            check(window.firstResponder === target, "\(name): baseline has real settled native keyboard focus")
            for press in 0..<presses {
                let time = ProcessInfo.processInfo.systemUptime
                let down = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: time,
                    windowNumber: window.windowNumber, context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: keyCode)!
                let up = NSEvent.keyEvent(with: .keyUp, location: .zero, modifierFlags: [], timestamp: time + 0.01,
                    windowNumber: window.windowNumber, context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: keyCode)!
                window.sendEvent(down); window.sendEvent(up)
                if press + 1 < presses { pump(0.06) }
            }
            var frames: [[UInt8]] = []
            for _ in 0..<8 { pump(0.045); frames.append(pixels(host)) }
            check(state.clicks == (expectAction ? presses : 0), "\(name): \(keyName) dispatches exactly the allowed action count")
            if expectWave {
                let largestDifference = frames.map { zip($0, baseline).filter { $0 != $1 }.count }.max() ?? 0
                check(largestDifference > 100, "\(name): \(keyName) produces actual transient native ripple pixels with shape morph and focus changes excluded")
                check(Set(frames.map { Data($0) }).count > 1, "\(name): multiple sampled native frames show the ripple progressing")
            } else {
                check(frames.allSatisfy { $0 == baseline }, "\(name): disabled ripple or blocked activation produces no native wave")
            }
            pump(0.4)
            check(pixels(host) == baseline && window.firstResponder === target, "\(name): ripple settles exactly to the focused baseline without losing focus")
            check(state.clicks == (expectAction ? presses : 0), "\(name): completing native animation never dispatches another action")
            window.close(); pump()
        }
        runCase("Enabled keyboard ripple", properties: ["ripple": true], expectAction: true, expectWave: true)
        runCase("Space keyboard ripple", properties: ["ripple": true], expectAction: true, expectWave: true, keyCode: 49, characters: " ")
        runCase("Repeated Enter ripple", properties: ["ripple": true], expectAction: true, expectWave: true, presses: 2)
        runCase("Ripple disabled", properties: ["ripple": false], expectAction: true, expectWave: false)
        runCase("Soft-disabled activation", properties: ["ripple": true, "softDisabled": true], expectAction: false, expectWave: false)
    }
    static func main() {
        setbuf(stdout, nil)
        let app = NSApplication.shared; app.setActivationPolicy(.accessory)
        let state = FocusFixtureState()
        let host = NSHostingView(rootView: FocusFixture(state: state))
        let window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 900, height: 450), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); host.layoutSubtreeIfNeeded(); pump(0.5)
        let surfaces = descendants(host).filter { String(describing: type(of: $0)).contains("AWCNativeButtonFocusView") }
        func view(_ id: String) -> NSView { guard let result = surfaces.first(where: { $0.accessibilityIdentifier() == id }) else { fatalError("Missing native button surface \(id)") }; return result }
        func focused() -> String { (window.firstResponder as? NSView)?.accessibilityIdentifier() ?? "none" }
        func key(_ code: UInt16, _ characters: String, flags: NSEvent.ModifierFlags = []) {
            let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime,
                windowNumber: window.windowNumber, context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: code)!
            window.sendEvent(event); pump()
        }
        // Offscreen NSHostingView.accessibilityChildren() is empty on this host
        // even for standard SwiftUI sentinels. These checks exercise the actual
        // native AX surfaces; they do not certify VoiceOver tree traversal.
        check(surfaces.count == 9, "All actual md-button views install native focus/accessibility surfaces")
        check(view("z").canBecomeKeyView && !view("a").canBecomeKeyView, "Selected child is actual sole group Tab entry")
        state.selectionMode = "multi-select"; pump()
        check(view("a").canBecomeKeyView && !view("z").canBecomeKeyView, "Mounted selection-mode changes recompute untouched group entry")
        state.selectionMode = "single-select"; pump()
        check(view("z").canBecomeKeyView, "Mounted single-select restores selected entry")
        check(!view("disabled").acceptsFirstResponder && !view("disabled").canBecomeKeyView, "Hard disabled excludes native focus")
        check(view("soft").acceptsFirstResponder && view("loading").acceptsFirstResponder, "Soft disabled and loading remain native focusable")
        check(!view("cell").canBecomeKeyView && view("cell").acceptsFirstResponder, "Standalone minus-one cell skips Tab but retains native focus")
        _ = window.makeFirstResponder(view("before")); window.selectNextKeyView(nil); pump()
        check(focused() == "z", "Real native Tab enters only selected group button")
        key(124, "\u{F703}")
        check(focused() == "a", "Real native Right wraps group focus")
        key(124, "\u{F703}")
        check(focused() == "soft", "Real native Right skips hard disabled")
        key(36, "\r"); key(49, " ")
        check(state.events.isEmpty, "Soft-disabled native keyboard activation stays blocked")
        key(124, "\u{F703}"); key(36, "\r")
        check(focused() == "loading" && state.events.isEmpty, "Loading retains keyboard focus with blocked activation")
        key(119, "\u{F72B}"); check(focused() == "z", "Real native End focuses last eligible")
        key(115, "\u{F729}"); check(focused() == "a", "Real native Home focuses first eligible")
        check(state.events.isEmpty, "Native focus changes emit no source click/selection events")
        state.rtl = true; pump(); key(123, "\u{F702}")
        check(focused() == "soft", "Mounted RTL reverses native arrow direction")
        state.rtl = false; pump()
        window.selectNextKeyView(nil); pump()
        check(focused() == "after", "Real Tab exits group instead of visiting roving minus-one siblings")
        window.selectPreviousKeyView(nil); pump()
        check(focused() == "soft", "Shift-Tab returns to most recently focused group entry")
        key(115, "\u{F729}"); key(36, "\r")
        check(state.events.filter { $0.name == "mdClick" }.count == 1 && state.events.contains { $0.name == "mdSelectionChange" }, "Native Enter activates through real action and selection dispatcher once")
        check(view("cell").isAccessibilityElement() && view("cell").accessibilityRole() == .cell && view("cell").isAccessibilitySelected(), "Actual AX gridcell is exposed and selected without toggle")
        check(view("cell").accessibilityRowIndexRange() == NSRange(location: 1, length: 1) && view("cell").accessibilityColumnIndexRange() == NSRange(location: 2, length: 1), "Actual native AX cell exposes explicit collection coordinates")
        check(view("unknown").accessibilityRole() == .button, "Unknown role safely exposes actual button role")
        check(!view("soft").isAccessibilityEnabled() && !view("soft").accessibilityPerformPress(), "Blocked AX action remains inert")
        check(view("cell").accessibilityPerformPress() && state.events.contains { $0.nodeID == "cell" && $0.name == "mdClick" }, "Minus-one gridcell retains actual accessibility activation")
        _ = window.makeFirstResponder(view("z")); pump(); state.disableLast = true; pump()
        check(!view("z").canBecomeKeyView && view("a").canBecomeKeyView, "Mounted hard-disable recomputes group entry")
        window.close(); pump()
        checkPointerFocusModality()
        checkNativeKeyboardRipple()
        print("Passed \(count) real native keyboard, focus-visual and accessibility integration checks.")
    }
}

@Observable final class FocusModalityFixtureState {
    let pointer = AWCNativePointerState()
    var clicks = 0
}
struct FocusModalityFixture: View {
    let state: FocusModalityFixtureState
    var body: some View {
        AWCNativeView(node: .init(id: "modality-target", tag: "md-button",
            properties: ["variant": "filled", "size": "md", "ripple": false], children: [.text("Continue")]), onEvent: { event in
                if event.name == "mdClick" { state.clicks += 1 }
            })
            .padding(24).frame(width: 320, height: 140, alignment: .topLeading).background(Color.white)
            .environment(\.awcNativePointerState, state.pointer)
            .environment(\.colorScheme, .light)
            .coordinateSpace(name: "awc-native-preview")
    }
}

struct KeyboardRippleFixture: View {
    let state: FocusModalityFixtureState
    let properties: [String: AWCValue]
    var body: some View {
        AWCNativeView(node: .init(id: "keyboard-ripple-target", tag: "md-button",
            properties: ["variant": "filled", "size": "md", "shapeMorph": false].merging(properties) { _, value in value },
            children: [.text("Continue")]), onEvent: { event in
                if event.name == "mdClick" { state.clicks += 1 }
            })
            .padding(24).frame(width: 320, height: 140, alignment: .topLeading).background(Color.white)
            .environment(\.awcNativePointerState, state.pointer)
            .environment(\.colorScheme, .light)
            .coordinateSpace(name: "awc-native-preview")
    }
}

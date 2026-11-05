import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class AccordionRendererFixtureState {
    var node = AWCNode(id: "accordion", tag: "md-accordion")
    var epoch = 0
    var dark = false
    var rtl = false
    var reduced = true
    var density = 0.0
    var measurements: [AWCNativeInspectionNode] = []
    var events: [AWCEvent] = []
    var first = AWCAccordionItemController()
    var second = AWCAccordionItemController()
    var third = AWCAccordionItemController()
    var useProbe = false
    var mounts = 0
    var unmounts = 0
    var prevent = false
    var stop = false
    var phases: [String] = []
    @ObservationIgnored var captureMotion = false
    @ObservationIgnored var motionSamples: [(Date, Double)] = []
}
struct AccordionRetainedProbe: View {
    let state: AccordionRendererFixtureState
    @State private var counter = 0
    var body: some View {
        VStack {
            AWCNativeView(node: .init(id: "inside", tag: "md-button", children: [.text("Retained \(counter)")])) { event in if event.name == "mdClick" { counter += 1 } }
        }.onAppear { state.mounts += 1 }.onDisappear { state.unmounts += 1 }
    }
}
struct AccordionRendererFixture: View {
    let state: AccordionRendererFixtureState
    var theme: AWCTheme { .generated(dark: state.dark) }
    var body: some View {
        let outer = AWCEventDispatcher(id: "outer") { context in state.phases.append("outer:" + context.event.name) }
        AWCNativeAccordionGroup(node: state.node, theme: theme, onEvent: { state.events.append($0) })
            .modifier(AccordionProbeModifier(state: state))
            .awcAccordionItemController(state.first, for: "first")
            .awcAccordionItemController(state.second, for: "second")
            .awcAccordionItemController(state.third, for: "third")
            .environment(\.awcEventDispatcher, outer)
            .environment(\.awcEventTargetListeners, [AWCEventListener { context in
                state.phases.append("target:" + context.event.name)
                if context.event.name == "mdItemToggle" {
                    if state.prevent { context.preventDefault() }
                    if state.stop { context.stopPropagation() }
                }
            }])
            .environment(\.awcAccordionReducedMotion, state.reduced)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .awcDensity(state.density).awcTheme(theme)
            .frame(width: 400)
            .awcNativeInspection(rootID: "accordion", coordinateSpace: "capture") { values in
                state.measurements = values
                if state.captureMotion, let root = values.first(where: { $0.id == "component" }) { state.motionSamples.append((Date(), root.bounds.height)) }
            }
            .id(state.epoch)
            .padding(20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(theme.background).coordinateSpace(name: "capture")
    }
}
struct AccordionProbeModifier: ViewModifier {
    let state: AccordionRendererFixtureState
    @ViewBuilder func body(content: Content) -> some View {
        if state.useProbe { content.awcAccordionItemSlot(.content, for: "first") { AccordionRetainedProbe(state: state) } }
        else { content }
    }
}
@main @MainActor enum NativeAccordionRendererIntegration {
    static let state = AccordionRendererFixtureState()
    static var host: NSHostingView<AccordionRendererFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static func check(_ value: Bool, _ label: String) { checks += 1; if !value { failures.append(label); print("FAIL: " + label); fflush(stdout) } }
    static func pump(_ duration: Double = 0.08) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002))
        }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    static func responder(_ id: String) -> AWCNativeButtonFocusView? {
        descendants(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == id }
    }
    static func rect(_ view: NSView) -> CGRect {
        let rect = view.convert(view.bounds, to: host)
        return host.isFlipped ? rect : .init(x: rect.minX, y: host.bounds.height - rect.maxY, width: rect.width, height: rect.height)
    }
    static func near(_ a: Double, _ b: Double, _ label: String) { check(abs(a-b) <= 0.6, "\(label): native \(a), Web \(b)") }
    static func bitmap() -> NSBitmapImageRep {
        let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap); return bitmap
    }
    static func rgb(_ css: String) -> [Double] {
        let expression = try! NSRegularExpression(pattern: "[0-9]+(?:\\.[0-9]+)?")
        let values = expression.matches(in: css, range: NSRange(css.startIndex..., in: css)).compactMap { Range($0.range, in: css).flatMap { Double(css[$0]) } }
        return values.count == 3 ? values + [1] : values
    }
    static func composite(_ color: [Double], over: [Double]) -> [Double] { (0..<3).map { color[$0]*color[3]+over[$0]*(1-color[3]) } }
    static func hits(_ image: NSBitmapImageRep, rect: CGRect, color: [Double]) -> Int {
        let sx = Double(image.pixelsWide)/host.bounds.width, sy = Double(image.pixelsHigh)/host.bounds.height
        let source = image.cgImage!
        var bytes = [UInt8](repeating: 0, count: source.width*source.height*4)
        bytes.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: source.width, height: source.height, bitsPerComponent: 8,
                bytesPerRow: source.width*4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(source, in: .init(x: 0,y: 0,width: source.width,height: source.height))
        }
        var count = 0
        for y in max(0,Int(rect.minY*sy))..<min(image.pixelsHigh,Int(rect.maxY*sy)) {
            for x in max(0,Int(rect.minX*sx))..<min(image.pixelsWide,Int(rect.maxX*sx)) {
                let index = (y*source.width+x)*4
                if (0..<3).allSatisfy({ abs(Double(bytes[index+$0])-color[$0]) < 3 }) { count += 1 }
            }
        }
        return count
    }
    static func paint(_ entry: AWCValue) {
        let id = entry["config"]["id"].string
        guard id.contains("-d0-"), let first = responder("first.header"), let root = state.measurements.first(where: { $0.id == "component" }) else { return }
        let image = bitmap(), mode = entry["theme"].string
        let hex = AWCTheme.generated(dark: state.dark).tokens["--md-sys-color-surface"]!.dropFirst()
        let background = stride(from: 0, to: 6, by: 2).map { Double(Int(hex.dropFirst($0).prefix(2),radix: 16)!) }
        let hostColor = composite(rgb(entry["paint"]["host"].string), over: background)
        let headerColor = composite(rgb(entry["paint"]["header"].string), over: hostColor)
        let headlineColor = composite(rgb(entry["paint"]["headline"].string), over: headerColor)
        check(hits(image, rect: rect(first), color: headerColor) > 100, "\(mode)/\(id) actual header background RGB")
        check(hits(image, rect: rect(first), color: headlineColor) > 2, "\(mode)/\(id) actual headline foreground RGB")
        if entry["config"]["item"]["expanded"].bool == true {
            let body = CGRect(x: rect(first).minX, y: rect(first).maxY, width: rect(first).width, height: 60)
            check(hits(image, rect: body, color: hostColor) > 100, "\(mode)/\(id) actual expanded body RGB")
        }
        if let directory = ProcessInfo.processInfo.environment["AWC_ACCORDION_CAPTURE_DIRECTORY"] {
            let url = URL(fileURLWithPath: directory); try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            try! image.representation(using: .png, properties: [:])!.write(to: url.appendingPathComponent("swift-\(mode)-\(id).png"))
        }
        check(root.bounds.height > 0, "\(mode)/\(id) rendered paint has a finite layout surface")
    }
    static func item(_ id: String, _ properties: [String: AWCValue] = [:]) -> AWCNode {
        .init(id: id, tag: "md-accordion-item", properties: ["headline": .string(id == "first" ? "Account settings" : "Secondary details")].merging(properties) { _, next in next }, children: [.text("Expanded content with useful details.")])
    }
    static func reset(_ properties: [String: AWCValue] = [:], children: [AWCNode]? = nil, probe: Bool = false) {
        state.useProbe = probe; state.prevent = false; state.stop = false; state.density = 0; state.rtl = false; state.reduced = true
        state.node = .init(id: "accordion", tag: "md-accordion", properties: properties, children: children ?? [item("first"), item("second")])
        state.epoch += 1; pump(); state.events.removeAll(); state.phases.removeAll()
    }
    static func keyboard(_ id: String, keyCode: UInt16, text: String = "", flags: NSEvent.ModifierFlags = []) {
        guard let target = responder(id) else { check(false, "missing responder \(id)"); return }
        _ = window.makeFirstResponder(target)
        let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime,
                                    windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: keyCode)!
        window.sendEvent(event); pump()
    }
    static func geometry() {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-renderer-web-baseline.json")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: url))
        for entry in oracle["fixtures"].array {
            let config = entry["config"], id = config["id"].string
            state.dark = entry["theme"].string == "dark"
            state.node = .init(id: "accordion", tag: "md-accordion", properties: config["parent"].object.merging(["transition": "none"]) { _, next in next }, children: [item("first", config["item"].object), item("second", config["item"].object)])
            state.density = config["parent"]["density"].number ?? 0; state.epoch += 1; pump()
            guard let measured = state.measurements.first(where: { $0.id == "component" }) else { check(false, id + " root measurement"); continue }
            near(measured.bounds.width, entry["root"]["width"].number!, id + " width")
            near(measured.bounds.height, entry["root"]["height"].number!, id + " height")
            for (index, childID) in ["first", "second"].enumerated() {
                guard let header = responder(childID + ".header") else { check(false, id + " header responder"); continue }
                let expected = entry["headers"].array[index], actual = rect(header)
                near(actual.width, expected["width"].number!, id + " header width")
                near(actual.height, expected["height"].number!, id + " header height")
                near(actual.minY - measured.bounds.minY, expected["y"].number!, id + " header offset")
            }
            paint(entry)
        }
    }
    static func interactions() {
        reset()
        if let target = responder("first.header") {
            let point = target.convert(.init(x: target.bounds.midX, y: target.bounds.midY), to: nil)
            let start = ProcessInfo.processInfo.systemUptime
            let down = NSEvent.mouseEvent(with: .leftMouseDown, location: point, modifierFlags: [], timestamp: start,
                windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!
            let up = NSEvent.mouseEvent(with: .leftMouseUp, location: point, modifierFlags: [], timestamp: start+0.01,
                windowNumber: window.windowNumber, context: nil, eventNumber: 2, clickCount: 1, pressure: 0)!
            window.sendEvent(down); pump(0.02); window.sendEvent(up); pump()
            check(state.first.isExpanded, "real native pointer down/up opens the header")
            check(state.events.filter { $0.name == "mdItemToggle" }.count == 1 && state.events.filter { $0.name == "mdToggle" }.count == 1, "pointer activation emits item and parent exactly once")
            check(window.firstResponder === target && !target.configuration!.handle.isFocusVisible, "pointer activation retains responder without a keyboard focus ring")
        } else { check(false, "native pointer header target") }
        reset(["exclusive": true, "keepOneExpanded": true], children: [item("first"), item("second", ["disabled": true]), item("third")])
        check(state.first.isExpanded && !state.third.isExpanded, "keep-one opens first enabled item before painting")
        check(responder("first.header")?.acceptsFirstResponder == true, "locked-open header remains focusable")
        check(responder("first.header")?.isAccessibilityEnabled() == false, "locked-open header advertises blocked activation")
        check(responder("second.header")?.acceptsFirstResponder == false, "disabled header leaves native keyboard navigation")
        state.first.toggle(); pump(); check(state.first.isExpanded && state.events.isEmpty, "controller cannot close locked-open item")
        keyboard("first.header", keyCode: 125)
        check(window.firstResponder === responder("third.header"), "native ArrowDown skips disabled header")
        keyboard("third.header", keyCode: 36, text: "\r")
        check(state.third.isExpanded && !state.first.isExpanded, "native Enter coordinates exclusive selection")
        check(state.events.filter { $0.name == "mdToggle" }.count == 2, "exclusive handoff emits both actual parent changes")
        check(responder("third.header")?.isAccessibilityExpanded() == true, "native disclosure reports current expansion")
        keyboard("third.header", keyCode: 125)
        check(window.firstResponder === responder("first.header"), "native ArrowDown wraps")
        keyboard("first.header", keyCode: 119)
        check(window.firstResponder === responder("third.header"), "native End reaches last enabled header")
        state.first.focusHeader(); pump(); check(window.firstResponder === responder("first.header"), "public focusHeader reaches actual responder")

        reset(["reorderable": true])
        keyboard("first.header", keyCode: 125, flags: .option)
        check(state.events.contains { $0.name == "mdReorder" && $0.detail["order"] == [1,0] }, "actual Option+ArrowDown reorders and reports original identities")
        check(rect(responder("first.header")!).minY > rect(responder("second.header")!).minY, "keyboard reorder moves rendered items")
        check(window.firstResponder === responder("first.header"), "keyboard reorder preserves focus on retained item")

        reset(["exclusive": true])
        state.prevent = true; state.first.toggle(); pump()
        check(state.first.isExpanded && state.events.contains { $0.name == "mdToggle" }, "preventDefault does not undo local mutation or suppress parent coordination")
        check(state.events.first { $0.name == "mdItemToggle" }?.defaultPrevented == true, "item event exposes cancellation")
        let parentPosition = state.phases.firstIndex(of: "outer:mdToggle"), itemPosition = state.phases.firstIndex(of: "outer:mdItemToggle")
        check(parentPosition != nil && itemPosition != nil && parentPosition! < itemPosition!, "parent nested event reaches outer scope before original item bubble")
        state.events.removeAll(); state.stop = true; state.second.toggle(); pump()
        check(state.first.isExpanded && state.second.isExpanded, "target stopPropagation prevents exclusive owner coordination")
        check(!state.events.contains { $0.name == "mdToggle" }, "stopped target event emits no parent toggle")
        state.stop = false; state.prevent = false
        state.node.children[1].properties["headline"] = "Changed label"; pump()
        check(state.second.isExpanded, "unrelated property edit preserves local expansion")
        state.node.children[1].properties["expanded"] = true; pump()
        state.node.children[1].properties["expanded"] = false; pump()
        check(!state.second.isExpanded, "authored expanded update reaches retained item")
    }
    static func retained() {
        reset(probe: true)
        let mounts = state.mounts, unmounts = state.unmounts
        check(mounts > 0, "body is mounted even while collapsed")
        // SwiftUI may defer allocating the NSView until its first nonzero
        // layout, while the authored View and its State already remain mounted.
        check(responder("inside")?.acceptsFirstResponder != true, "collapsed retained child cannot receive native focus")
        state.first.toggle(); pump()
        guard let inside = responder("inside") else { check(false, "retained body focus bridge"); return }
        check(inside.acceptsFirstResponder, "expanded child regains native focus")
        check(inside.accessibilityPerformPress(), "authored content remains interactive")
        pump(); check(responder("inside")?.accessibilityLabel() == "Retained 1", "authored content state updates")
        _ = window.makeFirstResponder(inside); state.first.toggle(); pump()
        check(!inside.acceptsFirstResponder && window.firstResponder !== inside, "collapse removes existing native focus from inert body")
        check(!inside.accessibilityPerformPress() && !inside.isAccessibilityElement(), "inert body rejects assistive activation and leaves accessibility tree")
        state.first.toggle(); pump()
        check(responder("inside") === inside, "collapse/reopen retains the actual native view instance")
        check(inside.accessibilityLabel() == "Retained 1", "collapse/reopen retains authored component state")
        check(state.mounts == mounts && state.unmounts == unmounts, "collapse/reopen never unmounts authored content")
    }
    static func renderedMotion() {
        for preset in ["expressive", "standard", "fade", "collapse", "none"] {
            reset(["transition": .string(preset)]); state.reduced = false; pump()
            for open in [true, false] {
                state.motionSamples.removeAll(); state.captureMotion = true
                // Observe through the middle of the shortest animated preset.
                // A 90ms offscreen window can contain only the initial frame
                // when the display link is coalesced; every collected sample
                // must still agree with the source curve below.
                let start = Date(); state.first.toggle(); pump(0.18)
                let samples = state.motionSamples; state.captureMotion = false
                let model = AWCNativeAccordionMotion(preset: preset, opening: open)
                check(!samples.isEmpty, "\(preset)/\(open) publishes real animated layout samples")
                if preset == "none" {
                    near(state.measurements.first { $0.id == "component" }!.bounds.height, open ? 196 : 136, "none snaps actual layout")
                } else {
                    check(samples.contains { $0.1 > 137 && $0.1 < 195 }, "\(preset)/\(open) actually reveals content between endpoint heights; samples=\(samples.map { [ $0.0.timeIntervalSince(start)*1000, $0.1 ] })")
                    for (date, height) in samples where date.timeIntervalSince(start) >= 0.025 {
                        let elapsed = date.timeIntervalSince(start)*1000
                        let early = model.frame(elapsedMilliseconds: max(0,elapsed-30)).height, late = model.frame(elapsedMilliseconds: elapsed+10).height
                        let actual = (height-136)/60
                        check(actual >= min(early,late)-0.025 && actual <= max(early,late)+0.025,
                              "\(preset)/\(open) rendered height follows actual source timing (t=\(elapsed), fraction=\(actual))")
                    }
                }
                pump(0.4)
                near(state.measurements.first { $0.id == "component" }!.bounds.height, open ? 196 : 136, "\(preset) settles to source endpoint")
            }
        }
        reset(["transition": "expressive"]); state.first.toggle(); pump(0.02)
        near(state.measurements.first { $0.id == "component" }!.bounds.height, 196, "reduced motion snaps actual disclosure")
    }
    static func initialPresentation() {
        state.motionSamples.removeAll(); state.captureMotion = true
        reset(["defaultExpanded": "0", "exclusive": true])
        state.captureMotion = false
        check(!state.motionSamples.isEmpty, "initial native presentation has actual measured frames")
        check(state.motionSamples.allSatisfy { abs($0.1-196) <= 0.6 }, "initially selected accordion never lays out a transient closed-height frame")
        check(state.first.isExpanded && !state.second.isExpanded, "initial presentation commits real selection before interaction")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: AccordionRendererFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000,y: -20000,width: 800,height: 700), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        geometry(); initialPresentation(); interactions(); retained(); renderedMotion()
        print("Accordion native renderer checkpoint: \(checks-failures.count)/\(checks) checks passed")
        if !failures.isEmpty { exit(1) }
        window.close()
    }
}

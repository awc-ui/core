import AppKit
import SwiftUI
import Observation
@testable import AWCUI

@Observable final class AccordionScrollingState {
    var node = AWCNode(id: "accordion", tag: "md-accordion")
    var density = 0.0
    var height = 240.0
    var epoch = 0
    var mounts = 0
    var unmounts = 0
    var probe = false
    var outer = false
    var measurements: [AWCNativeInspectionNode] = []
    let controller = AWCAccordionItemController()
}
struct AccordionScrollingProbe: View {
    let state: AccordionScrollingState
    @State private var counter = 0
    var body: some View {
        Color.clear.frame(height: state.height).overlay(alignment: .topLeading) {
            if state.probe {
                AWCNativeView(node: .init(id: "inside", tag: "md-button", children: [.text("Retained \(counter)")])) { event in
                    if event.name == "mdClick" { counter += 1 }
                }
            }
        }.onAppear { state.mounts += 1 }.onDisappear { state.unmounts += 1 }
    }
}
struct AccordionScrollRootProbe: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { let view = NSView(); view.setAccessibilityIdentifier("fixture.group"); return view }
    func updateNSView(_ view: NSView, context: Context) {}
}
struct AccordionScrollingFixture: View {
    let state: AccordionScrollingState
    var content: some View {
        let epoch = state.epoch
        return AWCNativeAccordionGroup(node: state.node, theme: .generated(), onEvent: { _ in })
            .awcAccordionItemSlot(.content, for: "first") { AccordionScrollingProbe(state: state) }
            .awcAccordionItemController(state.controller, for: "first")
            .awcDensity(state.density).environment(\.awcAccordionReducedMotion, true)
            .frame(width: 400).background { AccordionScrollRootProbe() }
            .awcNativeInspection(rootID: "accordion", coordinateSpace: "scroll-capture") { if state.epoch == epoch { state.measurements = $0 } }
            .id(state.epoch).padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .coordinateSpace(name: "scroll-capture")
    }
    @ViewBuilder var body: some View {
        if state.outer { ScrollView(.vertical) { VStack(spacing: 0) { content; Color.clear.frame(height: 900) } } }
        else { content }
    }
}
@main @MainActor enum NativeAccordionScrollingIntegration {
    static let state = AccordionScrollingState()
    static var host: NSHostingView<AccordionScrollingFixture>!, window: NSWindow!
    static var checks = 0, failures: [String] = []
    static var evidence: [[String: Any]] = []
    static func check(_ value: Bool, _ label: String) { checks += 1; if !value { failures.append(label); print("FAIL: " + label); fflush(stdout) } }
    static func near(_ value: Double, _ expected: Double, _ label: String) { check(abs(value-expected) <= 0.6, "\(label): native \(value), Web \(expected)") }
    static func pump(_ duration: Double = 0.08) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.002))
        }
    }
    static func all(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(all) }
    static func scroll() -> NSScrollView? { all(host).compactMap { $0 as? NSScrollView }.first }
    static func button() -> AWCNativeButtonFocusView? { all(host).compactMap { $0 as? AWCNativeButtonFocusView }.first { $0.accessibilityIdentifier() == "inside" } }
    static func rootHeight() -> Double { Double(all(host).first { $0.accessibilityIdentifier() == "fixture.group" }?.frame.height ?? -1) }
    static func node(_ cap: String) -> AWCNode {
        .init(id: "accordion", tag: "md-accordion", properties: ["transition": "none"], children: [
            .init(id: "first", tag: "md-accordion-item", properties: ["headline": "Scroll region", "expanded": true, "contentMaxHeight": .string(cap)])
        ])
    }
    static func geometry(_ oracle: AWCValue) {
        for value in oracle["cases"].array {
            let cap = value["cap"].string
            state.height = value["height"].number!; state.density = value["density"].number!
            state.node = node(cap); state.epoch += 1; pump()
            let id = "\(cap)/\(state.height)/\(state.density)"
            guard let scroll = scroll() else { check(false, id + " has an actual native scroll container"); continue }
            
            near(rootHeight(), value["rootHeight"].number!, id + " root height")
            near(Double(state.measurements.first { $0.id == "component" }?.bounds.height ?? -1), rootHeight(), id + " inspector agrees with the actual native root")
            near(scroll.contentView.bounds.height, value["bodyHeight"].number!, id + " viewport height")
            near(scroll.documentView!.frame.height, value["scrollHeight"].number!, id + " retained document height")
            let bodyFocus = all(host).compactMap { $0 as? AWCAccordionScrollFocusView }.first
            check(bodyFocus?.acceptsFirstResponder == !cap.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, id + " keyboard tab stop matches Web")
            check(scroll.contentView.bounds.width <= 400 && !scroll.hasHorizontalScroller, id + " does not expose horizontal scrolling")
            evidence.append(["cap": cap, "contentHeight": state.height, "density": state.density, "rootHeight": rootHeight(), "viewportHeight": scroll.contentView.bounds.height, "documentHeight": scroll.documentView!.frame.height])
        }
    }
    static func lifecycle() {
        state.height = 240; state.density = 0; state.probe = true; state.node = node("70px"); state.epoch += 1; pump()
        guard let scroll = scroll(), let inside = button() else { check(false, "scrolling lifecycle has retained native body"); return }
        let mounts = state.mounts, unmounts = state.unmounts

        check(inside.accessibilityPerformPress(), "authored button activates before scrolling"); pump()
        check(inside.accessibilityLabel() == "Retained 1", "authored counter advances")
        scroll.contentView.scroll(to: .init(x: 0, y: 100)); scroll.reflectScrolledClipView(scroll.contentView); pump()
        near(scroll.contentView.bounds.minY, 100, "native content really scrolls"); capture("swift-scroll-retained-content")
        for open in [false, true] {
            state.controller.toggle(); pump()
            check(state.controller.isExpanded == open, "native disclosure toggles during scroll lifecycle")
            near(rootHeight(), open ? 174 : 64, "scrolling disclosure endpoint")
            near(scroll.contentView.bounds.minY, 100, "close/reopen retains offset")
            check((!open && button() == nil || button() === inside) && inside.accessibilityLabel() == "Retained 1", "close/reopen retains native instance and authored state (an inert zero-height native subtree may be detached)")
            check(inside.acceptsFirstResponder == open, "inert disclosure gates descendant focus")
        }
        for (cap, height) in [("120px",160.0),("",280.0),("70px",110.0)] {
            state.node = node(cap); pump()
            check(self.scroll() === scroll, "editing cap retains native scroll instance")
            near(scroll.contentView.bounds.height, height, "editing cap updates actual viewport")
            check(button() === inside && inside.accessibilityLabel() == "Retained 1", "editing cap retains authored instance and state")
            near(scroll.contentView.bounds.minY, cap.isEmpty ? 0 : 100, "cap edit [\(cap)] preserves the Web offset semantics")
        }
        check(state.mounts == mounts && state.unmounts == unmounts, "cap changes and disclosure never unmount authored content")
    }
    static func capture(_ name: String) {
        guard let path = ProcessInfo.processInfo.environment["AWC_ACCORDION_SCROLL_CAPTURE_DIRECTORY"] else { return }
        let directory = URL(fileURLWithPath: path); try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap)
        try! bitmap.representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent(name + ".png"))
    }
    static func delayedViewportRestoration() {
        // Force the ordering that SwiftUI may produce: configure the new cap
        // while the old viewport still fills the document, then resize only
        // the native clip view. No child layout/update is needed for recovery.
        let scroll = NSScrollView(frame: .init(x: 0, y: 0, width: 400, height: 280))
        let document = NSView(frame: .init(x: 0, y: 0, width: 400, height: 280))
        let bridge = AWCAccordionScrollFocusView(frame: .init(x: 0, y: 0, width: 400, height: 280))
        let saved = AWCAccordionScrollState(); saved.offset = 100
        document.addSubview(bridge); scroll.documentView = document
        bridge.configure(scrollable: false, inert: false, state: saved)
        pump()
        bridge.configure(scrollable: true, inert: false, state: saved)
        pump()
        near(scroll.contentView.bounds.minY, 0, "pending restoration does not scroll the old uncapped viewport")
        near(saved.offset, 100, "pending restoration keeps the retained offset")
        scroll.contentView.setBoundsSize(.init(width: 400, height: 110))
        // SwiftUI can finish its resize by applying the old zero offset after
        // the bounds notification. Restoration must run after that transaction.
        scroll.contentView.scroll(to: .zero); scroll.reflectScrolledClipView(scroll.contentView)
        pump()
        near(scroll.contentView.bounds.minY, 100, "clip resize restores after the framework's final offset write")
        scroll.contentView.scroll(to: .zero); scroll.reflectScrolledClipView(scroll.contentView)
        pump()
        near(saved.offset, 0, "user scrolling resumes after delayed restoration")
        bridge.disconnect()
    }
    static func key(_ target: NSView, code: UInt16, text: String = "", flags: NSEvent.ModifierFlags = []) {
        check(window.makeFirstResponder(target), "native scroll region takes keyboard focus")
        let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: flags, timestamp: ProcessInfo.processInfo.systemUptime,
                                    windowNumber: window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: code)!
        window.sendEvent(event); pump()
    }
    static func keyboard() {
        state.probe = false; state.node = node("70px"); state.epoch += 1; pump()
        guard let region = all(host).compactMap({ $0 as? AWCAccordionScrollFocusView }).first, let inner = region.enclosingScrollView else { check(false,"scroll region has a native keyboard responder"); return }
        key(region,code:125); near(inner.contentView.bounds.minY,40,"ArrowDown scrolls the body")
        check(region.scrollState?.focused == true,"keyboard focus drives the visible inset focus ring"); capture("swift-scroll-keyboard-focus")
        key(region,code:119); near(inner.contentView.bounds.minY,170,"End reaches last content")
        key(region,code:115); near(inner.contentView.bounds.minY,0,"Home reaches first content")
        key(region,code:121); check(inner.contentView.bounds.minY > 40,"PageDown advances by a viewport page")
        key(region,code:49,text:" ",flags:.shift); near(inner.contentView.bounds.minY,0,"Shift+Space scrolls back")
        state.controller.toggle(); pump()
        check(!region.acceptsFirstResponder && window.firstResponder !== region,"collapse removes the body tab stop and its current focus")
        state.controller.toggle(); pump()
        state.node = node(""); pump()
        check(!region.acceptsFirstResponder,"removing the cap removes the extra tab stop")
        state.outer = true; state.node = node("70px"); state.epoch += 1; pump()
        guard let nested = all(host).compactMap({ $0 as? AWCAccordionScrollFocusView }).first,
              let nestedInner = nested.enclosingScrollView, let outer = nestedInner.enclosingScrollView else { check(false,"nested scroll fixture is an actual pair of native scroll containers"); return }
        key(nested,code:119); near(nestedInner.contentView.bounds.minY,170,"inner keyboard scrolling reaches the bottom")
        key(nested,code:125); check(outer.contentView.bounds.minY > 0,"ArrowDown at the inner boundary continues in the outer scroll container")
        key(nested,code:115); key(nested,code:126); near(outer.contentView.bounds.minY,0,"ArrowUp at the inner top continues in the outer scroll container")
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        host = NSHostingView(rootView: AccordionScrollingFixture(state: state))
        window = NSWindow(contentRect: .init(x: -20000,y: -20000,width: 600,height: 800), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/accordion-web-scrolling.json")
        let oracle = try! JSONDecoder().decode(AWCValue.self, from: Data(contentsOf: url))
        geometry(oracle); lifecycle(); delayedViewportRestoration(); keyboard()
        if let path = ProcessInfo.processInfo.environment["AWC_ACCORDION_SCROLL_OUTPUT"] {
            try! JSONSerialization.data(withJSONObject: ["cases": evidence, "checks": checks, "failures": failures], options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: path))
        }
        print("Accordion native scrolling: \(checks-failures.count)/\(checks) checks passed")
        window.close(); if !failures.isEmpty { exit(1) }
    }
}

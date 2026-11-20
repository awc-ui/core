import AppKit
import SwiftUI
@testable import AWCUI
#if canImport(UIKit)
import UIKit
import Accessibility

// tools/ax iOS probe, run inside the native-ios-parity simulator harness (apps/native-ios-parity/scripts/run-fixture.sh).
// It renders the exact effective nodes the macOS Laboratory host rendered (AWC_AX_CASES_FILE) with the Laboratory's
// presentation (PreviewRoot), and reads the UIAccessibility tree VoiceOver consumes: UIKit's accessibility runtime is
// switched on in-process (libAccessibility _AXSSetAutomationEnabled, as XCTest and accessibility inspectors do) so SwiftUI
// vends its accessibility nodes; the walk follows accessibilityElements / accessibilityElement(at:) like the AX runtime.
// Keyboard focus order is read after real HID Tab key presses. Output: AWC_AX_OUTPUT (JSON).

@Observable final class AXProbeState { var node = AWCNode(tag: "md-button"); var width: Double = 640; var height: Double = 240; var dark = false; var rtl = false; var epoch = 0 }

struct AXProbeRoot: View {
    let state: AXProbeState
    let snackbar: AWCSnackbarController; let tooltip: AWCTooltipController; let fabMenu: AWCFabMenuController
    @State private var menus = AWCMenuScopeState()
    private var node: AWCNode { state.node }
    private var anchorButton: some View {
        AWCNativeView(node: .init(id: "demo-anchor", tag: "md-icon-button", properties: ["icon": "notifications", "size": "md", "aria-label": "Notifications"]))
            .awcIconButtonAppearance(.init(width: 48, height: 48)).frame(width: 48, height: 48)
    }
    @ViewBuilder private var example: some View {
        if node.tag == "md-ripple" { AWCRippleExampleSurface(node: node) }
        else if node.tag == "md-divider" { AWCNativeView(node: node).frame(width: 300, height: 96) }
        else if node.tag == "md-snackbar" { AWCSnackbarScope { AWCNativeView(node: node).awcSnackbarController(snackbar) }.frame(width: state.width, height: state.height) }
        else if node.tag == "md-tooltip" { AWCTooltipScope { AWCNativeView(node: node).awcTooltipController(tooltip) }.frame(width: state.width, height: state.height) }
        else if ["md-dialog", "md-bottom-sheet", "md-side-sheet"].contains(node.tag) {
            // The Laboratory host's presentation (LiveModalLauncher in the SwiftUI host, LivePreviewModalHost on Android) in the
            // recipe's page order: an "Open …" tonal launcher, then the component (a standard side sheet inline below it; R4-25).
            AWCModalScope { VStack(alignment: .leading, spacing: 0) {
                AWCNativeView(node: AWCNode(id: "modal-launcher", tag: "md-button", properties: ["variant": "tonal"], children: [.text("Open " + node.tag.dropFirst(3).replacingOccurrences(of: "-", with: " "))]))
                    .fixedSize().padding(24)
                AWCNativeView(node: node).padding(.leading, 24)
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }.frame(width: state.width, height: state.height)
        }
        else if node.tag == "md-date-picker" { AWCModalScope { AWCNativeView(node: node).padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }.frame(width: state.width, height: state.height) }
        else if node.tag == "md-time-picker" { AWCModalScope { AWCNativeView(node: node).padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }.frame(width: state.width, height: state.height) }
        else if node.tag == "md-color-picker" { AWCNativeView(node: node).padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).frame(width: state.width, height: state.height) }
        else if node.tag == "md-skeleton" { AWCNativeView(node: node).awcSkeletonSizingContext(.init(parentHeight: 160)).frame(width: 260, height: 160, alignment: .topLeading) }
        else if ["md-meter", "md-progress-indicator"].contains(node.tag) { AWCNativeView(node: node).frame(width: 300) }
        else if node.tag == "md-status-dot" {
            if node.properties["inline"]?.bool == true { HStack(alignment: .center, spacing: 12) { anchorButton; AWCNativeView(node: node) } }
            else { anchorButton.awcStatusDotOverlay { AWCNativeView(node: node) } }
        }
        else if node.tag == "md-badge" { anchorButton.awcBadgeOverlay { AWCNativeView(node: node) } }
        else if ["md-segmented-button", "md-segmented-button-set"].contains(node.tag) { AWCPreviewSegmented(node: node) }
        // md-autocomplete: the suggestions in a menu scope, as the Swift live host presents them.
        else if node.tag == "md-autocomplete" { AXAutocompleteHost(node: node) }
        else if AWCPreviewMenu.tags.contains(node.tag) { AWCPreviewMenu(node: node, state: menus) }
        else if ["md-fab-menu", "md-fab-menu-item"].contains(node.tag) { AWCPreviewFabMenu(node: node, controller: fabMenu) }
        else if node.tag == "md-accordion" {
            AWCNativeView(node: node).frame(maxWidth: .infinity, minHeight: node.properties["floating"]?.bool == true ? 320 : nil, alignment: .topLeading).awcAccordionViewport()
        }
        else { AWCNativeView(node: node) }
    }
    var body: some View {
        let overlay = ["md-snackbar", "md-tooltip", "md-dialog", "md-bottom-sheet", "md-side-sheet", "md-time-picker", "md-color-picker", "md-date-picker"].contains(node.tag)
        AWCPreviewScope { example }
            .id(state.epoch)
            .padding(overlay ? 0 : 32)
            .frame(width: state.width, alignment: .center)
            .frame(minHeight: overlay ? state.height : 100, alignment: .center)
            .background(state.dark ? Color(white: 0.08) : .white)
            .environment(\.colorScheme, state.dark ? .dark : .light)
            .environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .awcTheme(.generated(dark: state.dark, tokens: [:]))
    }
}

/// md-autocomplete with its own menu scope per case (the probe content is re-created per case through `.id(epoch)`).
struct AXAutocompleteHost: View {
    let node: AWCNode
    @State private var menus = AWCMenuScopeState()
    var body: some View {
        AWCMenuScope(state: menus) { AWCNativeView(node: node).padding(.top, 12).frame(maxWidth: .infinity, alignment: .top) }
            .frame(minWidth: 320, maxWidth: .infinity, minHeight: 320, alignment: .top)
    }
}

enum AXWalk {
    static let traitList: [(UIAccessibilityTraits, String)] = [(.button, "button"), (.link, "link"), (.header, "header"), (.searchField, "searchField"), (.image, "image"),
        (.selected, "selected"), (.playsSound, "playsSound"), (.keyboardKey, "keyboardKey"), (.staticText, "staticText"), (.summaryElement, "summaryElement"),
        (.notEnabled, "notEnabled"), (.updatesFrequently, "updatesFrequently"), (.startsMediaSession, "startsMediaSession"), (.adjustable, "adjustable"),
        (.allowsDirectInteraction, "allowsDirectInteraction"), (.causesPageTurn, "causesPageTurn"), (.tabBar, "tabBar"), (.toggleButton, "toggleButton"), (.supportsZoom, "supportsZoom")]
    static func traits(_ t: UIAccessibilityTraits) -> [String] { traitList.filter { t.contains($0.0) }.map(\.1) }
    static func children(_ o: NSObject) -> [NSObject] {
        if let e = o.accessibilityElements as? [NSObject] { return e }
        let c = o.accessibilityElementCount()
        if c != NSNotFound && c > 0 { return (0..<c).compactMap { o.accessibilityElement(at: $0) as? NSObject } }
        if let v = o as? UIView { return v.subviews }
        return []
    }
    static func describe(_ o: NSObject, origin: CGPoint) -> [String: Any] {
        var out: [String: Any] = ["class": String(describing: type(of: o)), "label": o.accessibilityLabel ?? "", "traits": traits(o.accessibilityTraits)]
        if let v = o.accessibilityValue, !v.isEmpty { out["value"] = v }
        if let h = o.accessibilityHint, !h.isEmpty { out["hint"] = h }
        if let id = (o as? UIAccessibilityIdentification)?.accessibilityIdentifier, !id.isEmpty { out["identifier"] = id }
        let f = o.accessibilityFrame; out["frame"] = [f.minX - origin.x, f.minY - origin.y, f.width, f.height]
        if let actions = o.accessibilityCustomActions, !actions.isEmpty { out["customActions"] = actions.map(\.name) }
        if o.accessibilityViewIsModal { out["modal"] = true }
        if let cell = o as? UIAccessibilityContainerDataTableCell { let r = cell.accessibilityRowRange(); if r.location != NSNotFound { out["rowRange"] = [r.location, r.length] } }
        switch o.accessibilityContainerType { case .semanticGroup: out["containerType"] = "semanticGroup"; case .landmark: out["containerType"] = "landmark"; case .list: out["containerType"] = "list"; case .dataTable: out["containerType"] = "dataTable"; default: break }
        if let labels = o.accessibilityUserInputLabels, !labels.isEmpty { out["inputLabels"] = labels }
        if o.accessibilityRespondsToUserInteraction { out["interactive"] = true }
        // A keyboard-editable element (UIKit gives text fields no trait; VoiceOver identifies them by text input). An empty
        // field's value is its placeholder; the text itself is reported separately.
        // A secure text entry's characters never reach assistive technologies: VoiceOver reads its value, one bullet each.
        if let field = o as? UITextField { out["textInput"] = true; out["text"] = field.isSecureTextEntry ? String(repeating: "\u{2022}", count: (field.text ?? "").count) : field.text ?? ""; if let p = field.placeholder { out["placeholder"] = p } }
        else if let view = o as? UITextView { out["textInput"] = view.isEditable; out["text"] = view.text ?? "" }
        else if o is UITextInput { out["textInput"] = true }
        // A chart plot's data: the descriptor VoiceOver reads as chart details / Audio Graph (AXChart; built from this content)
        // — the x axis title and categories, each series' name and values, a pie's share axis and shares: the Web's
        // screen-reader table counterpart.
        if let d = (o as? AWCChartPlotFocusView)?.configuration?.descriptor {
            var words = [d.xTitle] + d.categories
            for s in d.series { words.append(s.name); words += s.values.compactMap { $0.map(awcJSNumberString) } }
            if let shares = d.shares { words.append(d.shareTitle); words += shares.compactMap { $0.map(awcChartAXPercent) } }
            out["chartData"] = words.filter { !$0.isEmpty }
        } else if let chart = (o as? AXChart)?.accessibilityChartDescriptor ?? ((o as? NSObject).flatMap { n in n.responds(to: NSSelectorFromString("accessibilityChartDescriptor")) ? n.value(forKey: "accessibilityChartDescriptor") as? AXChartDescriptor : nil }) {
            // A descriptor on another element (SwiftUI accessibilityChartDescriptor: an empty chart's message lists its categories).
            var words: [String] = [chart.xAxis.title]
            if let x = chart.xAxis as? AXCategoricalDataAxisDescriptor { words += x.categoryOrder }
            // AXDataPointValue: the number case / property, read by reflection (its Swift shape differs between SDKs).
            func number(_ v: Any?) -> Double? { guard let v else { return nil }; return v as? Double ?? Mirror(reflecting: v).children.first { $0.label == "number" }?.value as? Double }
            for s in chart.series { words.append(s.name ?? ""); for p in s.dataPoints { if let y = number(p.yValue) { words.append(chart.yAxis?.valueDescriptionProvider(y) ?? awcJSNumberString(y)) } } }
            out["chartData"] = words.filter { !$0.isEmpty }
        }
        return out
    }
    /// Exposed elements in VoiceOver navigation order with their container context. A modal container hides its
    /// siblings from VoiceOver: when one is present only its subtree is reported (as the AX runtime does).
    static func walk(_ root: NSObject, origin: CGPoint) -> [[String: Any]] {
        var out: [[String: Any]] = []; var seen = Set<ObjectIdentifier>(); var modalRoots: [NSObject] = []
        func findModal(_ o: NSObject, _ depth: Int) {
            guard depth < 60, !o.accessibilityElementsHidden else { return }
            if o.accessibilityViewIsModal, !(o is UIWindow) { modalRoots.append(o) }
            if !o.isAccessibilityElement { for c in children(o) { findModal(c, depth + 1) } }
        }
        func visit(_ o: NSObject, _ depth: Int, _ containers: [String]) {
            guard seen.insert(ObjectIdentifier(o)).inserted, depth < 60 else { return }
            if o.accessibilityElementsHidden { return }
            if let v = o as? UIView, v.isHidden || v.alpha < 0.01 { return }
            if o.isAccessibilityElement { var d = describe(o, origin: origin); d["depth"] = depth; if !containers.isEmpty { d["containers"] = containers }; out.append(d); return }
            var next = containers
            let kind = o.accessibilityContainerType
            if kind != .none { next.append(["none", "dataTable", "list", "landmark", "semanticGroup"][min(4, kind.rawValue)] + ((o.accessibilityLabel).map { ":" + $0 } ?? "")) }
            if o.accessibilityViewIsModal { next.append("modal") }
            for c in children(o) { visit(c, depth + 1, next) }
        }
        findModal(root, 0)
        if let modal = modalRoots.last { visit(modal, 0, ["modal"]) } else { visit(root, 0, []) }
        return out
    }
}

final class AXFirstResponderFinder: NSObject { nonisolated(unsafe) static weak var found: UIResponder? }
extension UIResponder { @objc func awcAXCaptureFirstResponder(_ sender: Any?) { AXFirstResponderFinder.found = self } }

@main @MainActor enum AccessibilityProbe {
    static let state = AXProbeState()
    static func pump(_ s: Double) { let end = Date().addingTimeInterval(s); repeat { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) } while Date() < end }
    static func main() {
        _ = NSApplication.shared
        let env = ProcessInfo.processInfo.environment
        guard let input = env["AWC_AX_CASES_FILE"], let data = FileManager.default.contents(atPath: input),
              let cases = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { print("FAIL AX probe: no AWC_AX_CASES_FILE"); return }
        guard let h = dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW), let sym = dlsym(h, "_AXSSetAutomationEnabled") else { print("FAIL AX probe: libAccessibility unavailable"); return }
        typealias SetEnabled = @convention(c) (Int32) -> Void
        unsafeBitCast(sym, to: SetEnabled.self)(1)
        let host = NSHostingView(rootView: AXProbeRoot(state: state, snackbar: AWCSnackbarController(), tooltip: AWCTooltipController(), fabMenu: AWCFabMenuController()))
        let window = NSWindow(contentRect: .init(x: 0, y: 0, width: 640, height: 800), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); pump(0.5)
        var results: [[String: Any]] = []
        for c in cases {
            guard let id = c["id"] as? String, let nodeObject = c["node"], let nodeData = try? JSONSerialization.data(withJSONObject: nodeObject),
                  let node = try? JSONDecoder().decode(AWCNode.self, from: nodeData) else { results.append(["id": c["id"] ?? "?", "error": "bad case"]); continue }
            // Each case starts without keyboard focus: the previous case's first responder must not steer its first Tab.
            AXFirstResponderFinder.found = nil
            UIApplication.shared.sendAction(#selector(UIResponder.awcAXCaptureFirstResponder(_:)), to: nil, from: nil, for: nil)
            if let r = AXFirstResponderFinder.found, !(r is UIWindow) { _ = r.resignFirstResponder() }
            state.node = node; state.width = c["width"] as? Double ?? 640; state.height = c["height"] as? Double ?? 240
            state.dark = c["dark"] as? Bool ?? false; state.rtl = (c["direction"] as? String) == "rtl"; state.epoch += 1
            pump(c["settle"] as? Double ?? 0.6)
            let uiWindow = host.window ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first?.windows.first
            let origin = host.convert(CGPoint(x: 0, y: 0), to: nil)
            var entry: [String: Any] = ["id": id, "platform": "ios", "ios": UIDevice.current.systemVersion]
            entry["elements"] = AXWalk.walk(uiWindow ?? host, origin: origin)
            // Pixels for the contrast check (tools/ax contrast.mjs), before any focus ring: the host view, whose origin the frames use.
            if let output = env["AWC_AX_OUTPUT"] {
                let format = UIGraphicsImageRendererFormat(); format.scale = uiWindow?.screen.scale ?? 3
                let data = UIGraphicsImageRenderer(bounds: host.bounds, format: format).pngData { _ in _ = host.drawHierarchy(in: host.bounds, afterScreenUpdates: true) }
                let path = (output as NSString).deletingLastPathComponent + "/ax-shot-" + id.replacingOccurrences(of: "/", with: "__") + ".png"
                if FileManager.default.createFile(atPath: path, contents: data) { entry["image"] = ["file": path, "scale": Double(format.scale)] }
            }
            var focus: [[String: Any]] = []
            let tabs = c["tabs"] as? Int ?? 0
            if tabs > 0, let w = uiWindow, AWCTouchSynth.keyAvailable {
                for _ in 0..<tabs {
                    AWCTouchSynth.key(usage: 43, down: true, window: w); pump(0.05); AWCTouchSynth.key(usage: 43, down: false, window: w); pump(0.25)
                    var f: [String: Any] = [:]
                    AXFirstResponderFinder.found = nil
                    UIApplication.shared.sendAction(#selector(UIResponder.awcAXCaptureFirstResponder(_:)), to: nil, from: nil, for: nil)
                    if let r = AXFirstResponderFinder.found, !(r is UIWindow) { f["firstResponder"] = AXWalk.describe(r, origin: origin) }
                    if let item = UIFocusSystem.focusSystem(for: w)?.focusedItem as? NSObject { f["focusSystem"] = AXWalk.describe(item, origin: origin) }
                    focus.append(f)
                }
            }
            entry["focus"] = focus
            results.append(entry)
            print("AX-CASE \(id) elements=\((entry["elements"] as? [Any])?.count ?? 0)")
        }
        let out = env["AWC_AX_OUTPUT"] ?? "/tmp/awc-ax-ios.json"
        // Non-finite numbers (an unbounded frame or value) cannot be written as JSON: they are reported as null.
        func finite(_ v: Any) -> Any {
            if let d = v as? [String: Any] { return d.mapValues(finite) }
            if let a = v as? [Any] { return a.map(finite) }
            if let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), !n.doubleValue.isFinite { return NSNull() }
            return v
        }
        if let json = try? JSONSerialization.data(withJSONObject: finite(["platform": "ios", "results": results]), options: [.prettyPrinted, .sortedKeys]) {
            FileManager.default.createFile(atPath: out, contents: json); print("PASS AX probe wrote \(results.count) cases to \(out)")
        } else { print("FAIL AX probe: could not encode results") }
    }
}
#endif

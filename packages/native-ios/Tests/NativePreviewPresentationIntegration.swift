import AppKit
import SwiftUI
import AWCUI

/// Checks the preview/production boundary against real macOS SwiftUI views.
@main @MainActor enum NativePreviewPresentationIntegration {
    static var checks = 0
    static func check(_ valid: Bool, _ message: String) { checks += 1; precondition(valid, message) }
    static func pump() {
        let end = Date().addingTimeInterval(0.2)
        while Date() < end {
            while let event = NSApp.nextEvent(matching: .any, until: .distantPast, inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    static func mount<V: View>(_ view: V) -> (NSWindow, NSHostingView<V>) {
        let host = NSHostingView(rootView: view)
        let window = NSWindow(contentRect: NSRect(x: -20000, y: -20000, width: 640, height: 688), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = host; window.orderBack(nil)
        pump(); host.layoutSubtreeIfNeeded()
        return (window, host)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        for tag in ["md-dialog", "md-bottom-sheet", "md-side-sheet", "md-select", "md-autocomplete", "md-multi-select", "md-date-picker", "md-time-picker"] {
            var node = AWCExamples.node(for: tag); node.properties["open"] = true
            let (window, host) = mount(AWCPreviewScope { AWCNativeView(node: node) }.frame(width: 640))
            check(window.sheets.isEmpty, "\(tag): preview must not create a platform sheet")
            check(host.fittingSize.height >= 640, "\(tag): embedded content must size the capture surface")
            check(!descendants(host).contains { $0 is NSDatePicker || $0 is NSPopUpButton }, "\(tag): preview controls must not require an uncaptured picker panel")
            window.close(); pump()
        }
        let (colorWindow, colorHost) = mount(AWCPreviewScope { AWCNativeView(tag: "md-color-picker", properties: ["value": "#6750A4"]) }.frame(width: 640))
        check(!descendants(colorHost).contains { $0 is NSColorWell }, "Color preview must not launch the global color panel")
        colorWindow.close(); pump()
        let (productionColorWindow, productionColorHost) = mount(AWCNativeView(tag: "md-color-picker", properties: ["value": "#6750A4"]).frame(width: 640))
        check(descendants(productionColorHost).contains { $0 is NSColorWell }, "Production keeps the platform ColorPicker")
        productionColorWindow.close(); pump()
        let (productionWindow, _) = mount(AWCNativeView(tag: "md-dialog", properties: ["open": true, "label": "Production sheet"]).frame(width: 640))
        check(!productionWindow.sheets.isEmpty, "Production keeps native sheet presentation outside AWCPreviewScope")
        if let sheet = productionWindow.attachedSheet { productionWindow.endSheet(sheet) }
        productionWindow.close()
        print("Passed \(checks) native preview/production view checks.")
    }
}

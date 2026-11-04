import Foundation
import SwiftUI
import AppKit
import Darwin
import AWCUI

private struct StatusDotPreview: View {
    let node: AWCNode
    var onEvent: (AWCEvent) -> Void = { _ in }
    private var anchor: some View {
        AWCNativeView(node: .init(id: "demo-status-dot-anchor", tag: "md-icon-button",
            properties: ["icon": "notifications", "size": "md", "aria-label": "Notifications"]), onEvent: onEvent)
            .awcIconButtonAppearance(.init(width: 48, height: 48))
            .frame(width: 48, height: 48)
    }
    @ViewBuilder var body: some View {
        if node.properties["inline"]?.bool == true {
            HStack(alignment: .center, spacing: 12) { anchor; AWCNativeView(node: node, onEvent: onEvent) }
        } else {
            anchor.awcStatusDotOverlay { AWCNativeView(node: node, onEvent: onEvent) }
        }
    }
}


@main
struct SnapshotRenderer {
    private static func png(_ bitmap: NSBitmapImageRep) -> Data? {
        // Draw the captured CGImage into an explicit sRGB bitmap. AppKit's
        // NSBitmapImageRep.converting applies a second display-profile transform
        // to some SwiftUI captures, visibly shifting saturated appearance colors.
        guard let image = bitmap.cgImage, let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: image.width, height: image.height,
                  bitsPerComponent: 8, bytesPerRow: image.width * 4, space: space,
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        guard let converted = context.makeImage() else { return nil }
        return NSBitmapImageRep(cgImage: converted).representation(using: .png, properties: [:])
    }
    private struct RenderRequest: Decodable {
        let tag: String
        let properties: [String: AWCValue]
        let dark: Bool
        let width: Double?
        let height: Double?
        let direction: String?
        let themeTokens: [String: String]?
        let text: String?
        let slots: [String: AWCValue]?
        let buttonAppearanceDefaults: [String: AWCValue]?
        let buttonAppearance: [String: AWCValue]?
    let iconButtonAppearanceDefaults: [String: AWCValue]?
    let iconButtonAppearance: [String: AWCValue]?
    let buttonGroupAppearanceDefaults: [String: AWCValue]?
    let buttonGroupAppearance: [String: AWCValue]?
    let buttonGroupSelection: [Bool]?
    let segmentedContext: AWCPreviewSegmentedContext?
    let progressIndicatorAppearanceDefaults:[String:AWCValue]?
    let progressIndicatorAppearance:[String:AWCValue]?
    let skeletonAppearanceDefaults:[String:AWCValue]?
    let skeletonAppearance:[String:AWCValue]?
    let snackbarAppearanceDefaults:[String:AWCValue]?
    let snackbarAppearance:[String:AWCValue]?
    let tooltipAppearanceDefaults:[String:AWCValue]?
    let tooltipAppearance:[String:AWCValue]?
    let accordionAppearanceDefaults:[String:AWCValue]?
    let accordionAppearance:[String:AWCValue]?
    let accordionItemAppearanceDefaults:[String:AWCValue]?
    let accordionItemAppearance:[String:AWCValue]?
    let cardAppearanceDefaults:[String:AWCValue]?
    let cardAppearance:[String:AWCValue]?
    let avatarAppearanceDefaults:[String:AWCValue]?
    let avatarAppearance:[String:AWCValue]?
    let switchAppearanceDefaults:[String:AWCValue]?
    let switchAppearance:[String:AWCValue]?
    let checkboxAppearanceDefaults:[String:AWCValue]?
    let checkboxAppearance:[String:AWCValue]?
    let radioAppearanceDefaults:[String:AWCValue]?
    let radioAppearance:[String:AWCValue]?
    let chipAppearanceDefaults:[String:AWCValue]?
    let chipAppearance:[String:AWCValue]?
    let orgChartAppearanceDefaults:[String:AWCValue]?
    let orgChartAppearance:[String:AWCValue]?
    let rippleAppearanceDefaults:[String:AWCValue]?
    let rippleAppearance:[String:AWCValue]?
    let breadcrumbsAppearanceDefaults:[String:AWCValue]?
    let breadcrumbsAppearance:[String:AWCValue]?
    let breadcrumbItemAppearanceDefaults:[String:AWCValue]?
    let breadcrumbItemAppearance:[String:AWCValue]?
    let tabsAppearanceDefaults:[String:AWCValue]?
    let tabsAppearance:[String:AWCValue]?
    let tabAppearanceDefaults:[String:AWCValue]?
    let tabAppearance:[String:AWCValue]?
    let navigationBarAppearanceDefaults:[String:AWCValue]?
    let navigationBarAppearance:[String:AWCValue]?
    let navigationTabAppearanceDefaults:[String:AWCValue]?
    let navigationTabAppearance:[String:AWCValue]?
    let textFieldAppearanceDefaults:[String:AWCValue]?
    let textFieldAppearance:[String:AWCValue]?
    let numberFieldAppearanceDefaults:[String:AWCValue]?
    let numberFieldAppearance:[String:AWCValue]?
    let otpFieldAppearanceDefaults:[String:AWCValue]?
    let otpFieldAppearance:[String:AWCValue]?
    let meterAppearanceDefaults:[String:AWCValue]?
    let meterAppearance:[String:AWCValue]?
    let loadingIndicatorAppearanceDefaults:[String:AWCValue]?
    let loadingIndicatorAppearance:[String:AWCValue]?
    let splitButtonAppearanceDefaults:[String:AWCValue]?
    let splitButtonAppearance:[String:AWCValue]?
    let segmentedButtonAppearanceDefaults: [String:AWCValue]?
    let segmentedButtonAppearance: [String:AWCValue]?
    let dividerAppearanceDefaults: [String:AWCValue]?
    let dividerAppearance: [String:AWCValue]?
    let badgeAppearanceDefaults: [String:AWCValue]?
    let badgeAppearance: [String:AWCValue]?
    let statusDotAppearanceDefaults: [String:AWCValue]?
    let statusDotAppearance: [String:AWCValue]?
    let fabAppearanceDefaults: [String:AWCValue]?
    let fabAppearance: [String:AWCValue]?
    let fabMenuAppearanceDefaults: [String:AWCValue]?
    let fabMenuAppearance: [String:AWCValue]?
    let fabMenuItemAppearanceDefaults: [String:AWCValue]?
    let fabMenuItemAppearance: [String:AWCValue]?
    let menuAppearanceDefaults: [String:AWCValue]?
    let menuAppearance: [String:AWCValue]?
    }
    private struct RenderMetadata: Encodable {
        let platform = "macos"
        let renderer = "SwiftUI"
        let tag: String
        let width: Int
        let height: Int
    }
    private struct RenderFailure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    @MainActor static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        do {
            let arguments = Array(CommandLine.arguments.dropFirst())
            if arguments.first == "--request" {
                guard arguments.count == 4, arguments[2] == "--output",
                      !arguments[1].isEmpty, !arguments[3].isEmpty else {
                    throw RenderFailure(message: "Usage: AWCSnapshots --request INPUT_JSON --output OUTPUT_PNG")
                }
                try renderRequest(input: URL(fileURLWithPath: arguments[1]), output: URL(fileURLWithPath: arguments[3]))
            } else {
                guard arguments.count <= 1, arguments.first?.hasPrefix("--") != true else {
                    throw RenderFailure(message: "Usage: AWCSnapshots [OUTPUT_DIRECTORY] or AWCSnapshots --request INPUT_JSON --output OUTPUT_PNG")
                }
                try renderBatch(output: URL(fileURLWithPath: arguments.first ?? "/tmp/awc-native-snapshots", isDirectory: true))
            }
        } catch {
            FileHandle.standardError.write(Data(("AWCSnapshots: " + error.localizedDescription + "\n").utf8))
            exit(EXIT_FAILURE)
        }
    }

    @MainActor private static func mount(_ host: NSView, width: Double) throws -> NSWindow {
        guard !NSScreen.screens.isEmpty else { throw RenderFailure(message: "Native snapshots require desktop WindowServer access.") }
        let left = NSScreen.screens.map { $0.frame.minX }.min() ?? 0
        let bottom = NSScreen.screens.map { $0.frame.minY }.min() ?? 0
        let window = NSWindow(contentRect: NSRect(x: left - 10000, y: bottom - 10000, width: width, height: 100),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB
        window.isExcludedFromWindowsMenu = true; window.collectionBehavior = [.transient, .ignoresCycle]
        window.contentView = host; window.orderBack(nil)
        return window
    }

    @MainActor private static func renderRequest(input: URL, output: URL) throws {
        guard input.standardizedFileURL != output.standardizedFileURL else {
            throw RenderFailure(message: "Request and output must use different file paths.")
        }
        let request = try JSONDecoder().decode(RenderRequest.self, from: Data(contentsOf: input))
        let stepperRequest = (try? JSONDecoder().decode(AWCStepperSnapshotRequest.self, from: Data(contentsOf: input))) ?? AWCStepperSnapshotRequest()
        let srRequest = (try? JSONDecoder().decode(AWCSRSnapshotRequest.self, from: Data(contentsOf: input))) ?? AWCSRSnapshotRequest()
        let chartRequest = (try? JSONDecoder().decode(AWCChartSnapshotRequest.self, from: Data(contentsOf: input))) ?? AWCChartSnapshotRequest()
        let navRequest = (try? JSONDecoder().decode(AWCNavSnapshotRequest.self, from: Data(contentsOf: input))) ?? AWCNavSnapshotRequest()
        guard AWCComponentCatalog.tags.contains(request.tag) else {
            throw RenderFailure(message: "Unknown native component tag: \(request.tag)")
        }
        let requestedWidth = request.width ?? 640
        guard requestedWidth.isFinite else { throw RenderFailure(message: "Width must be a finite number.") }
        let width = min(1200, max(320, requestedWidth)).rounded()
        if let height=request.height{guard ["md-snackbar","md-tooltip"].contains(request.tag),height.isFinite,height>0 else{throw RenderFailure(message:"height requires a positive finite overlay viewport.")}}
        let snackbarHeight=min(min(2000,floor(2_000_000/width)),max(1,request.height ?? 240)).rounded()
        guard request.direction == nil || ["ltr", "rtl"].contains(request.direction ?? "") else { throw RenderFailure(message: "Direction must be ltr or rtl.") }
        let theme = AWCTheme.generated(dark: request.dark, tokens: request.themeTokens ?? [:])
        var node = AWCExamples.node(for: request.tag)
        if ["md-fab-menu","md-fab-menu-item","md-segmented-button-set"].contains(request.tag) {node.id="component"}
        if request.tag=="md-segmented-button" {node.id="segment-day"}
        if let context=request.segmentedContext {try context.validate(tag:request.tag)}
        node.properties.merge(request.properties) { _, supplied in supplied }
        if let text = request.text {
            guard request.tag == "md-button", text.utf8.count <= 4096 else { throw RenderFailure(message: "Button text must be at most 4096 UTF-8 bytes.") }
            node.children.removeAll { ($0.slot ?? "").isEmpty }
            node.children.append(.text(text))
        }
        node = try AWCPreviewSlots.applyingValues(request.slots ?? [:], to: node)
        if let selection = request.buttonGroupSelection { node = try AWCPreviewButtonGroupSelection.applying(selection,to:node) }
        let view = AWCPreviewScope {
            if node.tag == "md-divider" { AWCNativeView(node:node).frame(width:300,height:96) }
            else if node.tag == "md-snackbar" { AWCSnackbarScope{AWCNativeView(node:node)}.frame(width:width,height:snackbarHeight) }
            else if node.tag == "md-tooltip" { AWCTooltipScope{AWCNativeView(node:node)}.frame(width:width,height:snackbarHeight) }
            else if node.tag == "md-skeleton" { AWCNativeView(node:node).awcSkeletonSizingContext(.init(parentHeight:160)).frame(width:260,height:160,alignment:.topLeading) }
            else if ["md-meter","md-progress-indicator"].contains(node.tag) { AWCNativeView(node:node).frame(width:300) }
            else if node.tag == "md-status-dot" { StatusDotPreview(node: node) }
            else if node.tag == "md-badge" {
                AWCNativeView(node:.init(id:"demo-badge-anchor",tag:"md-icon-button",properties:["icon":"notifications","size":"md","aria-label":"Notifications"]))
                    .awcIconButtonAppearance(.init(width:48,height:48))
                    .frame(width:48,height:48)
                    .awcBadgeOverlay {AWCNativeView(node:node)}
            }
            else if ["md-segmented-button","md-segmented-button-set"].contains(node.tag) {AWCPreviewSegmented(node:node,context:request.segmentedContext ?? .defaults(for:node))}
            else if AWCPreviewMenu.tags.contains(node.tag) {AWCPreviewMenu(node:node,state:AWCMenuScopeState())}
            else if ["md-fab-menu","md-fab-menu-item"].contains(node.tag) {AWCPreviewFabMenu(node:node,controller:AWCFabMenuController())}
            else if node.tag == "md-accordion" { AWCNativeView(node:node).frame(maxWidth:.infinity,minHeight:node.properties["floating"]?.bool == true ? 320:nil,alignment:.topLeading).awcAccordionViewport() }
            else { AWCNativeView(node:node) }
        }
            .padding(["md-snackbar","md-tooltip"].contains(request.tag) ? 0:request.tag == "md-status-dot" ? 32 : 24).frame(width: width, alignment: request.tag == "md-status-dot" ? .center : .leading)
            .frame(minHeight: ["md-snackbar","md-tooltip"].contains(request.tag) ? snackbarHeight:100, alignment: .topLeading)
            .background((request.themeTokens ?? [:]).isEmpty ? (request.dark ? Color(white: 0.08) : .white) : theme.background)
            .environment(\.colorScheme, request.dark ? .dark : .light)
            .environment(\.layoutDirection, request.direction == "rtl" ? .rightToLeft : .leftToRight)
            .awcTheme(theme)
            .awcButtonAppearance(AWCButtonAppearance(values: request.buttonAppearanceDefaults ?? [:]).merging(.init(values: request.buttonAppearance ?? [:])))
            .awcIconButtonAppearance(AWCIconButtonAppearance(values: request.iconButtonAppearanceDefaults ?? [:]).merging(.init(values: request.iconButtonAppearance ?? [:])))
            .awcButtonGroupAppearance(AWCButtonGroupAppearance(values: request.buttonGroupAppearanceDefaults ?? [:]).merging(.init(values: request.buttonGroupAppearance ?? [:])))
            .awcProgressIndicatorAppearance(AWCProgressIndicatorAppearance(values:request.progressIndicatorAppearanceDefaults ?? [:]).merging(.init(values:request.progressIndicatorAppearance ?? [:])))
            .awcSkeletonAppearance(AWCSkeletonAppearance(values:request.skeletonAppearanceDefaults ?? [:]).merging(.init(values:request.skeletonAppearance ?? [:])))
            .awcSnackbarAppearance(AWCSnackbarAppearance(values:request.snackbarAppearanceDefaults ?? [:]).merging(.init(values:request.snackbarAppearance ?? [:])))
            .awcTooltipAppearance(AWCTooltipAppearance(values:request.tooltipAppearanceDefaults ?? [:]).merging(.init(values:request.tooltipAppearance ?? [:])))
            .awcAccordionAppearance(AWCAccordionAppearance(values:request.accordionAppearanceDefaults ?? [:]).merging(.init(values:request.accordionAppearance ?? [:])))
            .awcAccordionItemAppearance(AWCAccordionItemAppearance(values:request.accordionItemAppearanceDefaults ?? [:]).merging(.init(values:request.accordionItemAppearance ?? [:])))
            .awcCardAppearance(AWCCardAppearance(values:request.cardAppearanceDefaults ?? [:]).merging(.init(values:request.cardAppearance ?? [:])))
            .awcAvatarAppearance(AWCAvatarAppearance(values:request.avatarAppearanceDefaults ?? [:]).merging(.init(values:request.avatarAppearance ?? [:])))
            .awcSwitchAppearance(AWCSwitchAppearance(values:request.switchAppearanceDefaults ?? [:]).merging(.init(values:request.switchAppearance ?? [:])))
            .awcCheckboxAppearance(AWCCheckboxAppearance(values:request.checkboxAppearanceDefaults ?? [:]).merging(.init(values:request.checkboxAppearance ?? [:])))
            .awcRadioAppearance(AWCRadioAppearance(values:request.radioAppearanceDefaults ?? [:]).merging(.init(values:request.radioAppearance ?? [:])))
            .awcChipAppearance(AWCChipHookAppearance(values:request.chipAppearanceDefaults ?? [:]).merging(.init(values:request.chipAppearance ?? [:])))
            .awcOrgChartAppearance(AWCOrgChartAppearance(values:request.orgChartAppearanceDefaults ?? [:]).merging(.init(values:request.orgChartAppearance ?? [:])))
            .awcRippleAppearance(AWCRippleAppearance(values:request.rippleAppearanceDefaults ?? [:]).merging(.init(values:request.rippleAppearance ?? [:])))
            .awcStepperSnapshot(stepperRequest)
            .awcSRSnapshot(srRequest)
            .awcNavigationBarAppearance(AWCNavigationBarAppearance(values:request.navigationBarAppearanceDefaults ?? [:]).merging(.init(values:request.navigationBarAppearance ?? [:])))
            .awcNavigationTabAppearance(AWCNavigationTabAppearance(values:request.navigationTabAppearanceDefaults ?? [:]).merging(.init(values:request.navigationTabAppearance ?? [:])))
            .awcTabsAppearance(AWCTabsAppearance(values:request.tabsAppearanceDefaults ?? [:]).merging(.init(values:request.tabsAppearance ?? [:])))
            .awcTabAppearance(AWCTabAppearance(values:request.tabAppearanceDefaults ?? [:]).merging(.init(values:request.tabAppearance ?? [:])))
            .awcBreadcrumbsAppearance(AWCBreadcrumbsAppearance(values:request.breadcrumbsAppearanceDefaults ?? [:]).merging(.init(values:request.breadcrumbsAppearance ?? [:])).merging(.init(values:request.breadcrumbItemAppearanceDefaults ?? [:])).merging(.init(values:request.breadcrumbItemAppearance ?? [:])))
            .awcTextFieldAppearance(AWCTextFieldAppearance(values:request.textFieldAppearanceDefaults ?? [:]).merging(.init(values:request.textFieldAppearance ?? [:])))
            .awcNumberFieldAppearance(AWCNumberFieldAppearance(values:request.numberFieldAppearanceDefaults ?? [:]).merging(.init(values:request.numberFieldAppearance ?? [:])))
            .awcOTPFieldAppearance(AWCOTPFieldAppearance(values:request.otpFieldAppearanceDefaults ?? [:]).merging(.init(values:request.otpFieldAppearance ?? [:])))
            .awcChartSnapshot(chartRequest, tag: request.tag)
            .awcNavSnapshot(navRequest)
            .awcMeterAppearance(AWCMeterAppearance(values:request.meterAppearanceDefaults ?? [:]).merging(.init(values:request.meterAppearance ?? [:])))
            .awcLoadingIndicatorAppearance(AWCLoadingIndicatorAppearance(values:request.loadingIndicatorAppearanceDefaults ?? [:]).merging(.init(values:request.loadingIndicatorAppearance ?? [:])))
            .awcSplitButtonAppearance(AWCSplitButtonAppearance(values:request.splitButtonAppearanceDefaults ?? [:]).merging(.init(values:request.splitButtonAppearance ?? [:])))
            .awcSegmentedButtonAppearance(AWCSegmentedButtonAppearance(values:request.segmentedButtonAppearanceDefaults ?? [:]))
            .awcSegmentedButtonAppearance(AWCSegmentedButtonAppearance(values:request.segmentedButtonAppearance ?? [:]),nodeID:node.id)
            .awcDividerAppearance(AWCDividerAppearance(values:request.dividerAppearanceDefaults ?? [:]).merging(.init(values:request.dividerAppearance ?? [:])))
            .awcBadgeAppearance(AWCBadgeAppearance(values:request.badgeAppearanceDefaults ?? [:]).merging(.init(values:request.badgeAppearance ?? [:])))
            .awcStatusDotAppearance(AWCStatusDotAppearance(values:request.statusDotAppearanceDefaults ?? [:]).merging(.init(values:request.statusDotAppearance ?? [:])))
            .awcFabAppearance(AWCFabAppearance(values:request.fabAppearanceDefaults ?? [:]).merging(.init(values:request.fabAppearance ?? [:])))
            .awcFabMenuAppearance(AWCFabMenuAppearance(values:request.fabMenuAppearanceDefaults ?? [:]).merging(.init(values:request.fabMenuAppearance ?? [:])))
            .awcFabMenuItemAppearance(AWCFabMenuItemAppearance(values:request.fabMenuItemAppearanceDefaults ?? [:]))
            .awcFabMenuItemAppearance(AWCFabMenuItemAppearance(values:request.fabMenuItemAppearance ?? [:]),nodeID:node.id)
            .awcMenuAppearance(AWCMenuAppearance(values:request.menuAppearance ?? [:]) ?? AWCMenuAppearance()).awcMenuAppearance(AWCMenuAppearance(values:request.menuAppearanceDefaults ?? [:]) ?? AWCMenuAppearance())
        let host = NSHostingView(rootView: view)
        let window = try mount(host, width: width)
        defer { window.close() }
        RunLoop.current.run(until: Date().addingTimeInterval(0.10))
        let measuredHeight = host.fittingSize.height
        guard measuredHeight.isFinite, measuredHeight > 0 else {
            throw RenderFailure(message: "Component produced invalid native layout dimensions.")
        }
        let height = ["md-snackbar","md-tooltip"].contains(request.tag) ? snackbarHeight:min(2000, max(100, measuredHeight.rounded(.up)))
        window.setContentSize(NSSize(width: width, height: height))
        host.frame = NSRect(x: 0, y: 0, width: width, height: height)
        host.layoutSubtreeIfNeeded()
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else {
            throw RenderFailure(message: "Native bitmap allocation failed.")
        }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        guard let png = png(bitmap) else {
            throw RenderFailure(message: "Native PNG encoding failed.")
        }
        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
        try png.write(to: output, options: .atomic)
        let metadata = RenderMetadata(tag: request.tag, width: bitmap.pixelsWide, height: bitmap.pixelsHigh)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let json = try encoder.encode(metadata)
        FileHandle.standardOutput.write(json + Data("\n".utf8))
    }

    @MainActor private static func renderBatch(output: URL) throws {
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        var failed: [String] = []
        for dark in [false, true] {
            for tag in AWCComponentCatalog.tags {
                let view = VStack(alignment: .leading, spacing: 18) {
                    Text(tag).font(.title2.bold())
                    AWCPreviewScope {
                        let node=AWCExamples.node(for:tag)
                        if tag=="md-divider" {AWCNativeView(node:node).frame(width:300,height:96)}
                        else if ["md-meter","md-progress-indicator"].contains(tag) {AWCNativeView(node:node).frame(width:300)}
                        else if tag=="md-status-dot" {StatusDotPreview(node:node)}
                        else if tag=="md-badge" {
                            AWCNativeView(node:.init(id:"demo-badge-anchor",tag:"md-icon-button",properties:["icon":"notifications","size":"md","aria-label":"Notifications"]))
                                .awcIconButtonAppearance(.init(width:48,height:48))
                                .frame(width:48,height:48).awcBadgeOverlay {AWCNativeView(node:node)}
                        }
                        else if ["md-segmented-button","md-segmented-button-set"].contains(tag) {AWCPreviewSegmented(node:node)}
                        else if ["md-fab-menu","md-fab-menu-item"].contains(tag) {AWCPreviewFabMenu(node:node,controller:AWCFabMenuController())}
                        else {AWCNativeView(node:node)}
                    }
                }.padding(24).frame(width: 640).background(dark ? Color(white: 0.08) : .white)
                    .environment(\.colorScheme, dark ? .dark : .light).awcTheme(.generated(dark: dark))
                let host = NSHostingView(rootView: view)
                let window = try mount(host, width: 640)
                defer { window.close() }
                window.setContentSize(NSSize(width: 640, height: max(100, host.fittingSize.height)))
                host.frame = NSRect(x: 0, y: 0, width: 640, height: max(100, host.fittingSize.height))
                host.layoutSubtreeIfNeeded()
                guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { failed.append(tag); continue }
                host.cacheDisplay(in: host.bounds, to: bitmap)
                guard let png = png(bitmap) else { failed.append(tag); continue }
                try png.write(to: output.appendingPathComponent("\(tag)-\(dark ? "dark" : "light").png"))
            }
        }
        if !failed.isEmpty { throw NSError(domain: "AWCSnapshots", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed renders: \(failed.joined(separator: ", "))"]) }
        let selected = ["md-button-light", "md-text-field-light", "md-checkbox-light", "md-switch-dark", "md-select-light", "md-transfer-list-dark", "md-line-chart-light", "md-pie-chart-dark", "md-table-light", "md-organization-chart-dark", "md-accordion-light", "md-navigation-bar-dark"]
        if let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1920, pixelsHigh: 1440, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0), let context = NSGraphicsContext(bitmapImageRep: bitmap) {
            NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = context
            NSColor(white: 0.92, alpha: 1).setFill(); NSRect(x: 0, y: 0, width: 1920, height: 1440).fill()
            for (index, name) in selected.enumerated() {
                if let image = NSImage(contentsOf: output.appendingPathComponent(name + ".png")) {
                    let scale = min(620 / image.size.width, 340 / image.size.height)
                    let x = CGFloat((index % 3) * 640 + 10)
                    let y = CGFloat(1440 - (index / 3 + 1) * 360 + 10)
                    let rect = NSRect(x: x, y: y, width: image.size.width * scale, height: image.size.height * scale)
                    image.draw(in: rect)
                }
            }
            NSGraphicsContext.restoreGraphicsState()
            if let png = png(bitmap) { try png.write(to: output.appendingPathComponent("overview.png")) }
        }
        print("Rendered \(AWCComponentCatalog.tags.count * 2) native SwiftUI snapshots to \(output.path)")
    }
}

// ---- begin chart snapshot hooks (chart lab patch: SnapshotCharts.swift) ----
// Typed chart hooks for snapshot renders (defaults first, local values win).
struct AWCChartSnapshotRequest: Decodable {
    var lineChartAppearanceDefaults: [String: AWCValue]? = nil; var lineChartAppearance: [String: AWCValue]? = nil
    var areaChartAppearanceDefaults: [String: AWCValue]? = nil; var areaChartAppearance: [String: AWCValue]? = nil
    var barChartAppearanceDefaults: [String: AWCValue]? = nil; var barChartAppearance: [String: AWCValue]? = nil
    var pieChartAppearanceDefaults: [String: AWCValue]? = nil; var pieChartAppearance: [String: AWCValue]? = nil
    var sparklineAppearanceDefaults: [String: AWCValue]? = nil; var sparklineAppearance: [String: AWCValue]? = nil
}
extension View {
    func awcChartSnapshot(_ r: AWCChartSnapshotRequest, tag: String) -> some View {
        let pair: ([String: AWCValue]?, [String: AWCValue]?) = switch tag {
        case "md-line-chart": (r.lineChartAppearanceDefaults, r.lineChartAppearance)
        case "md-area-chart": (r.areaChartAppearanceDefaults, r.areaChartAppearance)
        case "md-bar-chart": (r.barChartAppearanceDefaults, r.barChartAppearance)
        case "md-pie-chart": (r.pieChartAppearanceDefaults, r.pieChartAppearance)
        case "md-sparkline": (r.sparklineAppearanceDefaults, r.sparklineAppearance)
        default: (nil, nil)
        }
        return awcChartAppearance(AWCChartAppearance(values: pair.0 ?? [:]).merging(.init(values: pair.1 ?? [:])))
    }
}
// ---- end chart snapshot hooks ----

// ---- begin sr snapshot hooks (fa lab patch: SnapshotSR.swift) ----
// Typed md-slider / md-rating hooks for snapshot renders (defaults first, local values win).
struct AWCSRSnapshotRequest: Decodable {
    var sliderAppearanceDefaults: [String: AWCValue]? = nil; var sliderAppearance: [String: AWCValue]? = nil
    var ratingAppearanceDefaults: [String: AWCValue]? = nil; var ratingAppearance: [String: AWCValue]? = nil
}
extension View {
    func awcSRSnapshot(_ r: AWCSRSnapshotRequest) -> some View {
        awcSliderAppearance(AWCSliderAppearance(values: r.sliderAppearanceDefaults ?? [:]).merging(.init(values: r.sliderAppearance ?? [:])))
            .awcRatingAppearance(AWCRatingAppearance(values: r.ratingAppearanceDefaults ?? [:]).merging(.init(values: r.ratingAppearance ?? [:])))
    }
}
// ---- end sr snapshot hooks ----

// ---- begin stepper snapshot hooks (fa lab patch: SnapshotStepper.swift) ----
// Typed md-stepper / md-step hooks for snapshot renders (defaults first, local values win); steppers render settled (every
// transition and keyframe animation at its end).
struct AWCStepperSnapshotRequest: Decodable {
    var stepperAppearanceDefaults: [String: AWCValue]? = nil; var stepperAppearance: [String: AWCValue]? = nil
    var stepAppearanceDefaults: [String: AWCValue]? = nil; var stepAppearance: [String: AWCValue]? = nil
}
extension View {
    func awcStepperSnapshot(_ r: AWCStepperSnapshotRequest) -> some View {
        awcStepperAppearance(AWCStepperAppearance(values: r.stepperAppearanceDefaults ?? [:]).merging(.init(values: r.stepperAppearance ?? [:]))
                                .merging(AWCStepperAppearance(values: r.stepAppearanceDefaults ?? [:])).merging(.init(values: r.stepAppearance ?? [:])))
            .environment(\.awcStepperSettled, true)
    }
}
// ---- end stepper snapshot hooks ----

// ---- begin navigation snapshot hooks (nav lab patch: SnapshotNav.swift) ----
// n5's navigation components in the snapshot renderer: the typed hooks of the request.
struct AWCNavSnapshotRequest: Decodable {
    var toolbarAppearanceDefaults: [String: AWCValue]? = nil; var toolbarAppearance: [String: AWCValue]? = nil
}
extension View {
    func awcNavSnapshot(_ r: AWCNavSnapshotRequest) -> some View {
        awcToolbarAppearance(AWCToolbarAppearance(values: r.toolbarAppearanceDefaults ?? [:]).merging(.init(values: r.toolbarAppearance ?? [:])))
    }
}
// ---- end navigation snapshot hooks ----

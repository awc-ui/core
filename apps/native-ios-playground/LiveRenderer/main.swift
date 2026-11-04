import Foundation
import AppKit
import ApplicationServices
import SwiftUI
import Darwin
import AWCUI
import Observation

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


private struct PreviewRequest: Decodable {
    let id: AWCValue?
    let command: String
    let tag: String?
    let properties: [String: AWCValue]?
    let dark: Bool?
    let width: Double?
    let height: Double?
    let scenario: String?
    let buttonAppearanceDefaults: [String: AWCValue]?
    let buttonAppearance: [String: AWCValue]?
    let iconButtonAppearanceDefaults: [String: AWCValue]?
    let iconButtonAppearance: [String: AWCValue]?
    let buttonGroupAppearanceDefaults: [String: AWCValue]?
    let buttonGroupAppearance: [String: AWCValue]?
    let buttonGroupSelection: [Bool]?
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
    let orgChartAppearanceDefaults:[String:AWCValue]?
    let orgChartAppearance:[String:AWCValue]?
    let switchAppearanceDefaults:[String:AWCValue]?
    let switchAppearance:[String:AWCValue]?
    let checkboxAppearanceDefaults:[String:AWCValue]?
    let checkboxAppearance:[String:AWCValue]?
    let radioAppearanceDefaults:[String:AWCValue]?
    let radioAppearance:[String:AWCValue]?
    let chipAppearanceDefaults:[String:AWCValue]?
    let chipAppearance:[String:AWCValue]?
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
    let listAppearanceDefaults:[String:AWCValue]?
    let listAppearance:[String:AWCValue]?
    let listItemAppearanceDefaults:[String:AWCValue]?
    let listItemAppearance:[String:AWCValue]?
    let meterAppearanceDefaults:[String:AWCValue]?
    let meterAppearance:[String:AWCValue]?
    let loadingIndicatorAppearanceDefaults:[String:AWCValue]?
    let loadingIndicatorAppearance:[String:AWCValue]?
    let splitButtonAppearanceDefaults:[String:AWCValue]?
    let splitButtonAppearance:[String:AWCValue]?
    let segmentedContext: AWCPreviewSegmentedContext?
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
    let dialogAppearanceDefaults:[String:AWCValue]?
    let dialogAppearance:[String:AWCValue]?
    let bottomSheetAppearanceDefaults:[String:AWCValue]?
    let bottomSheetAppearance:[String:AWCValue]?
    let sideSheetAppearanceDefaults:[String:AWCValue]?
    let sideSheetAppearance:[String:AWCValue]?
    let method: String?
    let arguments: [AWCValue]?
    let target:String?
    let callId:String?
    let callIds:[String]?
    let acknowledged:[String]?
    let themeTokens: [String: String]?
    let direction: String?
    let x: Double?
    let y: Double?
    let phase: String?
    let enabled: Bool?
    let text: String?
    let slots: [String: AWCValue]?
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
            // A response the encoder rejects (a non-finite number) is answered with an error, not a silent end of the session.
            let encoded: Data
            if let data = try? encoder.encode(response) { encoded = data }
            else if let data = try? encoder.encode(["id": response["id"] ?? .null, "error": .string("The response could not be encoded as JSON (a non-finite number).")]) { encoded = data }
            else { close(); return }
            do { try FileHandle.standardOutput.write(contentsOf: encoded + Data([10])) }
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
            record["activation"] = .object(["id": .string(activation.id.uuidString), "kind": .string(activation.kind.rawValue), "source": .string(activation.source.rawValue)])
        }
        events.append(record)
    }
    func drain() -> AWCValue {
        defer { events.removeAll(keepingCapacity: true) }
        return .array(events.map(AWCValue.object))
    }
}

private struct ComponentBoundsPreference: PreferenceKey {
    static var defaultValue: CGRect? { nil }
    static func reduce(value: inout CGRect?, nextValue: () -> CGRect?) {
        value = nextValue() ?? value
    }
}

/// Owned by one native session, with coordinates supplied by SwiftUI layout.
/// This is deliberately not ObservableObject: recording geometry must not
/// invalidate the view and create a measurement/render feedback loop.
/// The Laboratory recipe's page content for a modal tag: a tonal `md-button` that calls show() (the source
/// `data-awc-action="open"`). Its own events stay local; the component's events reach the host.
private struct LiveModalLauncher: View {
    let tag: String
    let show: () -> Void
    var body: some View {
        AWCNativeView(node: AWCNode(id: "modal-launcher", tag: "md-button", properties: ["variant": "tonal"],
                                    children: [.text("Open " + tag.dropFirst(3).replacingOccurrences(of: "-", with: " "))]),
                      onEvent: { event in if event.name == "mdClick" { show() } })
            .fixedSize().padding(24)
    }
}

@MainActor
private final class PreviewInspection {
    var bounds: CGRect?
    var nodes: [AWCNativeInspectionNode] = []
    var buttonGroupSelection: [Bool]?
    var segmentedSelection: [Bool]?
    var splitButtonChecked:Bool?

    func metadata(name: String) -> AWCValue? {
        let measuredLeaf = ["md-status-dot","md-loading-indicator","md-meter","md-progress-indicator"].contains(name)
        guard let bounds,
              [bounds.minX, bounds.minY, bounds.width, bounds.height].allSatisfy({ $0.isFinite }),
              (measuredLeaf ? bounds.width >= 0 && bounds.height >= 0:bounds.width > 0 && bounds.height > 0) else { return nil }
        func rectangle(_ value: CGRect) -> AWCValue {
            .object(["x": .number(Double(value.minX)), "y": .number(Double(value.minY)),
                     "width": .number(Double(value.width)), "height": .number(Double(value.height))])
        }
        let valid = nodes.filter { node in
            [node.bounds.minX, node.bounds.minY, node.bounds.width, node.bounds.height].allSatisfy { $0.isFinite }
                && (measuredLeaf ? node.bounds.width >= 0 && node.bounds.height >= 0 :
                    node.bounds.width > 0 && node.bounds.height > 0)
        }
        // A measured leaf may intentionally be zero-sized or absent when hidden.
        // Its enclosing preview/notification context is never a substitute measurement.
        // A closed/hidden FAB Menu likewise cannot use its recipe viewport.
        // A closed menu (or a row of one) has no surface: its recipe viewport is not a substitute measurement either.
        if (measuredLeaf || ["md-fab-menu","md-menu","md-menu-item","md-menu-item-group","md-sub-menu-item"].contains(name)) && !valid.contains(where: { $0.id == "component" }) { return nil }
        let ids = Set(valid.map(\.id)).union(["component"])
        var measured = valid.filter { $0.parentId.map(ids.contains) ?? true }.map { node -> AWCValue in
            var value: [String: AWCValue] = ["id": .string(node.id), "name": .string(node.name), "bounds": rectangle(node.bounds)]
            if let parent = node.parentId { value["parentId"] = .string(parent) }
            if !node.metrics.isEmpty { value["metrics"] = .object(node.metrics) }
            return .object(value)
        }
        if !valid.contains(where: { $0.id == "component" }) {
            measured.insert(.object(["id": "component", "name": .string(name), "bounds": rectangle(bounds)]), at: 0)
        }
        return .object(["version": 1, "unit": "pt", "source": "SwiftUI layout", "nodes": .array(measured)])
    }
}

@Observable private final class PreviewNodeState {
    var node:AWCNode
    var width:Double
    var height:Double
    init(_ node:AWCNode,width:Double,height:Double){self.node=node;self.width=width;self.height=height}
}

private struct PreviewRoot: View {
    let nodeState:PreviewNodeState
    private var node:AWCNode{nodeState.node}
    private var width:Double{nodeState.width}
    private var height:Double{nodeState.height}
    let dark: Bool
    let onEvent: (AWCEvent) -> Void
    let pointerState: AWCNativePointerState
    let scenario: String?
    let themeTokens: [String: String]
    let direction: String
    let buttonAppearance: AWCButtonAppearance
    let iconButtonAppearance: AWCIconButtonAppearance
    let buttonGroupAppearance: AWCButtonGroupAppearance
    let progressIndicatorAppearance:AWCProgressIndicatorAppearance
    let skeletonAppearance:AWCSkeletonAppearance
    let snackbarAppearance:AWCSnackbarAppearance
    let snackbarController:AWCSnackbarController
    let tooltipAppearance:AWCTooltipAppearance
    let tooltipController:AWCTooltipController
    let meterAppearance:AWCMeterAppearance
    let loadingIndicatorAppearance:AWCLoadingIndicatorAppearance
    let splitButtonAppearance:AWCSplitButtonAppearance
    let segmentedContext: AWCPreviewSegmentedContext
    let segmentedButtonAppearanceDefaults: AWCSegmentedButtonAppearance
    let segmentedButtonAppearance: AWCSegmentedButtonAppearance
    let dividerAppearance: AWCDividerAppearance
    let badgeAppearance: AWCBadgeAppearance
    let statusDotAppearance: AWCStatusDotAppearance
    let fabAppearance: AWCFabAppearance
    let fabController: AWCFabController
    let fabMenuAppearance:AWCFabMenuAppearance
    let fabMenuItemAppearanceDefaults:AWCFabMenuItemAppearance
    let fabMenuItemAppearance:AWCFabMenuItemAppearance
    let fabMenuController:AWCFabMenuController
    let menuAppearanceDefaults:AWCMenuAppearance
    let menuAppearance:AWCMenuAppearance
    let menuState:AWCMenuScopeState
    let accordionAppearance:AWCAccordionAppearance
    let accordionItemAppearance:AWCAccordionItemAppearance
    let accordionItemController:AWCAccordionItemController
    let cardAppearance:AWCCardAppearance
    let avatarAppearance:AWCAvatarAppearance
    var orgChartAppearance:AWCOrgChartAppearance = .init()
    let switchAppearance:AWCSwitchAppearance
    let checkboxAppearance:AWCCheckboxAppearance
    let radioAppearance:AWCRadioAppearance
    let chipAppearance:AWCChipHookAppearance
    let selectionController:AWCSelectionControlController
    let rippleAppearance:AWCRippleAppearance
    let rippleController:AWCRippleController
    let breadcrumbsAppearance:AWCBreadcrumbsAppearance
    let breadcrumbsController:AWCBreadcrumbsController
    let tabsAppearance:AWCTabsAppearance
    let tabAppearance:AWCTabAppearance
    let tabsController:AWCTabsController
    let navigationBarAppearance:AWCNavigationBarAppearance
    let navigationTabAppearance:AWCNavigationTabAppearance
    let navigationBarController:AWCNavigationBarController
    let navigationTabController:AWCNavigationTabController
    let textFieldAppearance:AWCTextFieldAppearance
    let textFieldController:AWCTextFieldController
    let numberFieldAppearance:AWCNumberFieldAppearance
    let numberFieldController:AWCNumberFieldController
    let otpFieldAppearance:AWCOTPFieldAppearance
    let otpFieldController:AWCOTPFieldController
    let listAppearance:AWCListAppearance
    let listItemAppearance:AWCListItemAppearance
    let listController:AWCListController
    let listItemController:AWCListItemController
    let dialogAppearance:AWCDialogAppearance
    let bottomSheetAppearance:AWCBottomSheetAppearance
    let sideSheetAppearance:AWCSideSheetAppearance
    let dialogController:AWCDialogController
    let bottomSheetController:AWCBottomSheetController
    let sideSheetController:AWCSideSheetController
    let inspection: PreviewInspection
    let chartPreview: AWCChartPreviewOptions
    let navPreview: AWCNavPreviewOptions
    private var theme: AWCTheme { .generated(dark: dark, tokens: themeTokens) }
    private func showModal() { switch node.tag { case "md-dialog": dialogController.show(); case "md-bottom-sheet": bottomSheetController.show(); default: sideSheetController.show() } }
    @ViewBuilder private var example: some View {
        if scenario == "button-behavior" { AWCButtonBehaviorDemo(properties: node.properties, onEvent: onEvent) }
        else if scenario == "navigation-events" { AWCButtonNavigationDemo(properties: node.properties, onEvent: onEvent) }
        else if scenario == "focus-accessibility" { AWCButtonAccessibilityDemo(properties: node.properties, onEvent: onEvent) }
        else if node.tag == "md-divider" { AWCNativeView(node:node,onEvent:onEvent).frame(width:300,height:96) }
        else if node.tag == "md-snackbar" { AWCSnackbarScope{AWCNativeView(node:node,onEvent:onEvent).awcSnackbarController(snackbarController)}.frame(width:width,height:height) }
        else if node.tag == "md-tooltip" { AWCTooltipScope{AWCNativeView(node:node,onEvent:onEvent).awcTooltipController(tooltipController)}.frame(width:width,height:height) }
        // Dialogs and sheets present in the preview's own viewport through the shared modal layer.
        else if ["md-dialog","md-bottom-sheet","md-side-sheet"].contains(node.tag) { AWCModalScope{ZStack(alignment:.topLeading){AWCNativeView(node:node,onEvent:onEvent).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading);LiveModalLauncher(tag:node.tag){showModal()}}}.frame(width:width,height:height) }
        // Dialogs and sheets present in the preview's own viewport through the shared modal layer.
        else if ["md-dialog","md-bottom-sheet","md-side-sheet"].contains(node.tag) { AWCModalScope{AWCNativeView(node:node,onEvent:onEvent).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading)}.frame(width:width,height:height) }
        else if node.tag == "md-skeleton" { AWCNativeView(node:node,onEvent:onEvent).awcSkeletonSizingContext(.init(parentHeight:160)).frame(width:260,height:160,alignment:.topLeading) }
        else if ["md-meter","md-progress-indicator"].contains(node.tag) { AWCNativeView(node:node,onEvent:onEvent).frame(width:300) }
        // md-ripple decorates the recipe's token-styled button surface (the Web recipe renders the same button).
        else if node.tag == "md-ripple" { AWCRippleExampleSurface(node: node) }
        else if node.tag == "md-status-dot" { StatusDotPreview(node: node, onEvent: onEvent) }
        else if node.tag == "md-badge" {
            AWCNativeView(node:.init(id:"demo-badge-anchor",tag:"md-icon-button",properties:["icon":"notifications","size":"md","aria-label":"Notifications"]),onEvent:onEvent)
                .awcIconButtonAppearance(.init(width:48,height:48))
                .frame(width:48,height:48)
                .awcBadgeOverlay { AWCNativeView(node:node,onEvent:onEvent) }
        }
        else if ["md-segmented-button","md-segmented-button-set"].contains(node.tag) {AWCPreviewSegmented(node:node,context:segmentedContext.retaining(node),onEvent:onEvent)}
        else if AWCPreviewMenu.tags.contains(node.tag) {AWCPreviewMenu(node:node,state:menuState,onEvent:onEvent)}
        else if ["md-fab-menu","md-fab-menu-item"].contains(node.tag) {AWCPreviewFabMenu(node:node,controller:fabMenuController,onEvent:onEvent)}
        // A floating accordion leaves the flow: the padded preview area is its viewport.
        else if node.tag == "md-accordion" { AWCNativeView(node:node,onEvent:onEvent).frame(maxWidth:.infinity,minHeight:node.properties["floating"]?.bool == true ? 320:nil,alignment:.topLeading).awcAccordionViewport() }
        else { AWCNativeView(node: node, onEvent: onEvent) }
    }
    var body: some View {
        AWCPreviewScope {
            example.background {
                GeometryReader { geometry in
                    Color.clear.preference(key: ComponentBoundsPreference.self,
                        value: geometry.frame(in: .named("awc-native-preview")))
                }.allowsHitTesting(false)
            }
        }
            .padding(["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(node.tag) ? 0:32)
            .frame(width: width, alignment: .center)
            .frame(minHeight: ["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(node.tag) ? height:100, alignment: .center)
            .background {
                ZStack {
                    themeTokens.isEmpty ? (dark ? Color(white: 0.08) : .white) : theme.background
                    // Match Laboratory's centered 24px CSS tile at 1pt per CSS px.
                    // This stays in the live host: production and snapshots stay plain.
                    Canvas { context, size in
                        let spacing: CGFloat = 24, radius: CGFloat = 1
                        let originX = (size.width / 2).truncatingRemainder(dividingBy: spacing)
                        let originY = (size.height / 2).truncatingRemainder(dividingBy: spacing)
                        let dotColor = theme.primary.opacity(0.18)
                        let gradient = Gradient(colors: [dotColor, theme.primary.opacity(0)])
                        for y in stride(from: originY, through: size.height, by: spacing) {
                            for x in stride(from: originX, through: size.width, by: spacing) {
                                let dot = Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                                // CSS keeps the center solid through .8px, then
                                // fades to transparent at 1px without changing tint.
                                context.fill(dot, with: .radialGradient(gradient, center: CGPoint(x: x, y: y), startRadius: 0.8, endRadius: radius))
                            }
                        }
                    }.allowsHitTesting(false).accessibilityHidden(true)
                }
            }
            .environment(\.colorScheme, dark ? .dark : .light)
            .environment(\.layoutDirection, direction == "rtl" ? .rightToLeft : .leftToRight)
            .environment(\.openURL, OpenURLAction { _ in .discarded })
            .awcTheme(theme)
            .awcButtonAppearance(buttonAppearance)
            .awcIconButtonAppearance(iconButtonAppearance)
            .awcButtonGroupAppearance(buttonGroupAppearance)
            .awcProgressIndicatorAppearance(progressIndicatorAppearance)
            .awcSkeletonAppearance(skeletonAppearance)
            .awcSnackbarAppearance(snackbarAppearance)
            .awcTooltipAppearance(tooltipAppearance)
            .awcMeterAppearance(meterAppearance)
            .awcLoadingIndicatorAppearance(loadingIndicatorAppearance)
            .awcSplitButtonAppearance(splitButtonAppearance)
            .awcSplitButtonChecked(rootID:node.id){inspection.splitButtonChecked=$0}
            .awcSegmentedButtonAppearance(segmentedButtonAppearanceDefaults)
            .awcSegmentedButtonAppearance(segmentedButtonAppearance,nodeID:node.id)
            .awcSegmentedSelection(rootID:AWCPreviewSegmentedContext.selectionRootID(for:node)){inspection.segmentedSelection=$0}
            .awcDividerAppearance(dividerAppearance)
            .awcBadgeAppearance(badgeAppearance)
            .awcStatusDotAppearance(statusDotAppearance)
            .awcFabAppearance(fabAppearance).awcFabController(fabController)
            .awcFabMenuAppearance(fabMenuAppearance)
            .awcFabMenuItemAppearance(fabMenuItemAppearanceDefaults)
            .awcFabMenuItemAppearance(fabMenuItemAppearance,nodeID:node.id)
            .awcMenuAppearance(menuAppearance).awcMenuAppearance(menuAppearanceDefaults)
            .awcAccordionAppearance(accordionAppearance)
            .awcAccordionItemAppearance(accordionItemAppearance)
            .awcAccordionItemController(accordionItemController,for:node.id)
            .awcCardAppearance(cardAppearance)
            .awcAvatarAppearance(avatarAppearance)
            .awcOrgChartAppearance(orgChartAppearance)
            .awcSwitchAppearance(switchAppearance).awcCheckboxAppearance(checkboxAppearance).awcRadioAppearance(radioAppearance).awcChipAppearance(chipAppearance)
            .awcSelectionControlController(selectionController,for:node.id)
            .awcRippleAppearance(rippleAppearance).awcRippleController(rippleController)
            .awcBreadcrumbsAppearance(breadcrumbsAppearance).awcBreadcrumbsController(breadcrumbsController)
            .awcTabsAppearance(tabsAppearance).awcTabAppearance(tabAppearance).awcTabsController(tabsController)
            .awcNavigationBarAppearance(navigationBarAppearance).awcNavigationTabAppearance(navigationTabAppearance).awcNavigationBarController(navigationBarController).awcNavigationTabController(navigationTabController)
            .awcTextFieldAppearance(textFieldAppearance).awcTextFieldController(textFieldController,for:node.id)
            .awcNumberFieldAppearance(numberFieldAppearance).awcNumberFieldController(numberFieldController,for:node.id)
            .awcOTPFieldAppearance(otpFieldAppearance).awcOTPFieldController(otpFieldController,for:node.id)
            .awcListAppearance(listAppearance)
            .awcListItemAppearance(listItemAppearance)
            .awcListController(listController,for:node.id)
            .awcListItemController(listItemController,for:node.id)
            .awcDialogAppearance(dialogAppearance)
            .awcBottomSheetAppearance(bottomSheetAppearance)
            .awcSideSheetAppearance(sideSheetAppearance)
            .awcDialogController(dialogController,for:node.id)
            .awcBottomSheetController(bottomSheetController,for:node.id)
            .awcSideSheetController(sideSheetController,for:node.id)
            .awcStepperPreview(AWCStepperPreview.appearance(tag: node.tag), AWCStepperPreview.controller)
            .awcSRPreview(AWCSRPreview.options(tag: node.tag))
            .awcTablePreview(AWCTablePreview.current, id: node.id)
            .awcChartPreview(chartPreview)
            .awcNavPreview(navPreview)
            .awcButtonGroupSelection(rootID: node.id) { inspection.buttonGroupSelection = $0 }
            .environment(\.awcNativePointerState, pointerState)
            .coordinateSpace(name: "awc-native-preview")
            .onPreferenceChange(ComponentBoundsPreference.self) { inspection.bounds = $0 }
            .awcNativeInspection(rootID: scenario == nil ? node.id : "", coordinateSpace: "awc-native-preview") { inspection.nodes = $0 }
    }
}

@MainActor
private final class NativeSession {
    private var host: NSHostingView<PreviewRoot>?
    private var rootState:PreviewNodeState?
    private var window: NSWindow?
    private var logicalWidth: Double = 640
    private var logicalHeight: Double = 240
    private var tag = ""
    private let events = EventBuffer()
    private var eventNumber = 0
    private var pointerHeld = false
    private let pointerState = AWCNativePointerState()
    private let inspection = PreviewInspection()
    private let fabController = AWCFabController()
    private let fabMenuController=AWCFabMenuController()
    private let menuState=AWCMenuScopeState()
    private let snackbarController=AWCSnackbarController()
    private let tooltipController=AWCTooltipController()
    private let accordionItemController=AWCAccordionItemController()
    private let listController=AWCListController()
    private let listItemController=AWCListItemController()
    private let selectionController=AWCSelectionControlController()
    private let rippleController=AWCRippleController()
    private let breadcrumbsController=AWCBreadcrumbsController()
    private let tabsController=AWCTabsController()
    private let navigationBarController=AWCNavigationBarController()
    private let navigationTabController=AWCNavigationTabController()
    private let textFieldController=AWCTextFieldController()
    private let numberFieldController=AWCNumberFieldController()
    private let otpFieldController=AWCOTPFieldController()
    private let chartController=AWCChartController()
    private let toolbarController=AWCToolbarController()
    private let dialogController=AWCDialogController()
    private let bottomSheetController=AWCBottomSheetController()
    private let sideSheetController=AWCSideSheetController()
    private func modalShow(){switch tag{case "md-dialog":dialogController.show();case "md-bottom-sheet":bottomSheetController.show();default:sideSheetController.show()}}
    private func modalClose(){switch tag{case "md-dialog":dialogController.close();case "md-bottom-sheet":bottomSheetController.close();default:sideSheetController.close()}}
    /// Resolves after the open cycle and the exit motion (md-dialog and md-side-sheet; the source bottom sheet has none).
    private func modalWhenClosed() async {if tag=="md-dialog"{await dialogController.whenClosed()}else{await sideSheetController.whenClosed()}}
    /// The value a list method returns (getSelectedIndices), sent with that command's frame.
    private var methodResult:AWCValue?
    private struct MethodCall {let method:String;let arguments:[AWCValue];var status="pending";var task:Task<Void,Never>?}
    private var methodCalls:[String:MethodCall]=[:]
    private var inspectionName = ""
    private var streaming = false
    private var nextStreamFrame: Double = 0
    private let streamInterval: Double = 1 / 60
    private var inputNotice: String?
    private var activity: NSObjectProtocol?

    func close() {
        streaming = false
        try? cancelPointer()
        window?.close(); window = nil; host = nil; rootState = nil
        methodCalls.values.forEach{$0.task?.cancel()};methodCalls=[:]
        inspection.bounds = nil
        inspection.nodes = []
        inspection.buttonGroupSelection = nil
        inspection.segmentedSelection = nil
        inspection.splitButtonChecked = nil
        if let activity { ProcessInfo.processInfo.endActivity(activity); self.activity = nil }
    }

    func handle(_ request: PreviewRequest) throws -> [String: AWCValue] {
        inputNotice = nil
        if request.command=="method-results" {return try queryMethods(request)}
        if request.command=="method",tag=="md-menu",request.callId != nil {return try acceptMethod(request)}
        if request.command=="accessibility" {return try accessibilitySnapshot(request)}
        if request.command=="method",["md-fab-menu","md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag) {return try acceptMethod(request)}
        switch request.command {
        case "configure": try configure(request)
        case "update": try updateProperties(request)
        case "resize": try resize(request)
        case "click": try click(request)
        case "pointer": try pointer(request)
        case "text": try insert(request)
        case "key": try key(request)
        case "method": try invoke(request)
        case "frame": try requireConfigured()
        case "stream":
            try requireConfigured()
            guard let enabled = request.enabled else { throw PreviewFailure("Stream requires an enabled boolean.") }
            streaming = enabled
            nextStreamFrame = ProcessInfo.processInfo.systemUptime
        default: throw PreviewFailure("Unsupported command: \(request.command)")
        }
        if request.command == "update" || request.command == "stream" || (streaming && request.command != "configure" && request.command != "frame" && request.command != "resize") {
            var response: [String: AWCValue] = ["id": request.id ?? .null, "ack": true, "events": events.drain()]
            if let inputNotice { response["inputIgnored"] = .string(inputNotice) }
            return response
        }
        // Keep legacy input settling, but a plain frame never adds an artificial wait.
        if request.command != "frame" { Self.pump(request.command == "pointer" ? 0.008 : 0.04) }
        var response = try frame()
        response["id"] = request.id ?? .null
        if request.command=="resize"{response["ack"]=true}
        if let methodResult { response["result"] = methodResult; self.methodResult = nil }
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

    private func invoke(_ request:PreviewRequest) throws {
        try requireConfigured()
        if AWCStepperPreview.methodTags.contains(tag),let method=request.method {
            methodResult = try AWCStepperPreview.invoke(tag: tag, method: method, arguments: request.arguments ?? [])
            Self.pump(0.05);host?.layoutSubtreeIfNeeded();return
        }
        if AWCSRPreview.methodTags.contains(tag),let method=request.method {
            methodResult = try AWCSRPreview.invoke(tag: tag, method: method, arguments: request.arguments ?? [])
            Self.pump(0.05);host?.layoutSubtreeIfNeeded();return
        }
        if AWCTablePreview.methodTags.contains(tag),let method=request.method {
            methodResult = try AWCTablePreview.invoke(tag: tag, method: method, arguments: request.arguments ?? [], rootID: rootState?.node.id ?? "", table: AWCTablePreview.tableController, pagination: AWCTablePreview.paginationController)
            Self.pump(0.05);host?.layoutSubtreeIfNeeded();return
        }
        if AWCPreviewMenu.tags.contains(tag),let method=request.method,(tag=="md-menu" && method=="reposition") || (tag=="md-sub-menu-item" && method=="collapse") {
            guard (request.arguments ?? []).isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            let node=rootState?.node
            let handle=menuState.menu(node.map { AWCPreviewMenu.menuID(for:$0) } ?? "demo-menu")
            if method=="reposition" {handle.reposition()} else {handle.collapse(row:node?.id ?? "")}
            Self.pump(0.03);return
        }
        if AWCNavPreview.methodTags.contains(tag),let method=request.method {
            methodResult = try AWCNavPreview.invoke(tag: tag, method: method, arguments: request.arguments ?? [], toolbar: toolbarController)
            Self.pump(0.05);host?.layoutSubtreeIfNeeded();return
        }
        if AWCChartPreview.methodTags.contains(tag),let method=request.method {
            methodResult = try AWCChartPreview.invoke(tag: tag, method: method, arguments: request.arguments ?? [], chart: chartController)
            Self.pump(0.05);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-list",let method=request.method,["activateNext","activatePrevious","selectItem","getSelectedIndices"].contains(method) {
            let arguments=request.arguments ?? []
            switch method {
            case "selectItem":
                guard arguments.count==1,case .number(let n)=arguments[0],n>=0,n==n.rounded() else {throw PreviewFailure("selectItem requires one row index.")}
                listController.selectItem(Int(n))
            case "getSelectedIndices": guard arguments.isEmpty else {throw PreviewFailure("getSelectedIndices requires no arguments.")}
                methodResult = .array(listController.getSelectedIndices().map { .number(Double($0)) })
            default: guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
                if method=="activateNext" {listController.activateNext()} else {listController.activatePrevious()}
            }
            Self.pump(0.02);return
        }
        if tag=="md-list-item",let method=request.method,["setFocus","focusItem","toggle","expand","collapse"].contains(method) {
            let arguments=request.arguments ?? []
            switch method {
            case "setFocus":
                var visible=false
                if let first=arguments.first { guard arguments.count==1,case .object(let options)=first,options.keys.allSatisfy({ $0=="focusVisible" }) else {throw PreviewFailure("setFocus accepts { focusVisible }.")}
                    if let v=options["focusVisible"] { guard case .bool(let b)=v else {throw PreviewFailure("focusVisible requires a boolean.")}; visible=b } }
                listItemController.setFocus(focusVisible:visible)
            default: guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
                switch method { case "focusItem": listItemController.focusItem(); case "toggle": listItemController.toggle(); case "expand": listItemController.expand(); default: listItemController.collapse() }
            }
            Self.pump(0.02);return
        }
        let selectionMethods:[String:Set<String>]=["md-switch":["setFocus","getValidity","checkValidity","reportValidity","setCustomValidity"],"md-checkbox":["getValidity","checkValidity","reportValidity","setCustomValidity"],
            "md-radio":["syncValidityFromGroup","getValidity","checkValidity","reportValidity","setCustomValidity","setFocus","setBlur","select"]]
        if let method=request.method,selectionMethods[tag]?.contains(method)==true {
            let arguments=request.arguments ?? []
            guard selectionController.isConnected else {throw PreviewFailure("The \(tag) is not mounted.")}
            if method=="setCustomValidity" {
                guard arguments.count==1,case .string(let message)=arguments[0],message.utf8.count<=4096 else {throw PreviewFailure("setCustomValidity requires one string of at most 4096 UTF-8 bytes.")}
                selectionController.setCustomValidity(message);Self.pump(0.02);return
            }
            guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            switch method {
            case "setFocus": selectionController.setFocus()
            case "setBlur": selectionController.setBlur()
            case "select": selectionController.select()
            case "syncValidityFromGroup": selectionController.syncValidityFromGroup()
            case "checkValidity": methodResult = .bool(selectionController.checkValidity())
            case "reportValidity": methodResult = .bool(selectionController.reportValidity())
            default: methodResult = selectionController.getValidity().value
            }
            Self.pump(0.02);return
        }
        if tag=="md-otp-field",let method=request.method,["setFocus","clear","getValidity","setCustomValidity","checkValidity","reportValidity"].contains(method) {
            let arguments=request.arguments ?? []
            guard otpFieldController.isConnected else {throw PreviewFailure("The md-otp-field is not mounted.")}
            if method=="setCustomValidity" {
                guard arguments.count==1,case .string(let message)=arguments[0],message.utf8.count<=4096 else {throw PreviewFailure("setCustomValidity requires one string of at most 4096 UTF-8 bytes.")}
                otpFieldController.setCustomValidity(message);Self.pump(0.02);return
            }
            guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            switch method {
            case "setFocus": otpFieldController.setFocus()
            case "clear": otpFieldController.clear()
            case "checkValidity": methodResult = .bool(otpFieldController.checkValidity())
            case "reportValidity": methodResult = .bool(otpFieldController.reportValidity())
            default: methodResult = otpFieldController.getValidity().value
            }
            Self.pump(0.03);return
        }
        if tag=="md-number-field",let method=request.method,["setFocus","select","stepUp","stepDown","getValidity","checkValidity","reportValidity","setCustomValidity"].contains(method) {
            let arguments=request.arguments ?? []
            guard numberFieldController.isConnected else {throw PreviewFailure("The md-number-field is not mounted.")}
            if method=="setCustomValidity" {
                guard arguments.count==1,case .string(let message)=arguments[0],message.utf8.count<=4096 else {throw PreviewFailure("setCustomValidity requires one string of at most 4096 UTF-8 bytes.")}
                numberFieldController.setCustomValidity(message);Self.pump(0.02);return
            }
            if method=="stepUp"||method=="stepDown" {
                var times=1.0
                if arguments.count==1,case .number(let n)=arguments[0],n.isFinite { times=n } else if !arguments.isEmpty {throw PreviewFailure("\(method) accepts no arguments or one finite repeat count.")}
                if method=="stepUp" { numberFieldController.stepUp(times) } else { numberFieldController.stepDown(times) }
                Self.pump(0.03);return
            }
            guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            switch method {
            case "setFocus": numberFieldController.setFocus()
            case "select": numberFieldController.select()
            case "checkValidity": methodResult = .bool(numberFieldController.checkValidity())
            case "reportValidity": methodResult = .bool(numberFieldController.reportValidity())
            default: methodResult = numberFieldController.getValidity().value
            }
            Self.pump(0.03);return
        }
        if tag=="md-text-field",let method=request.method,["setFocus","select","getValidity","checkValidity","reportValidity","setCustomValidity"].contains(method) {
            let arguments=request.arguments ?? []
            guard textFieldController.isConnected else {throw PreviewFailure("The md-text-field is not mounted.")}
            if method=="setCustomValidity" {
                guard arguments.count==1,case .string(let message)=arguments[0],message.utf8.count<=4096 else {throw PreviewFailure("setCustomValidity requires one string of at most 4096 UTF-8 bytes.")}
                textFieldController.setCustomValidity(message);Self.pump(0.02);return
            }
            guard arguments.isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            switch method {
            case "setFocus": textFieldController.setFocus()
            case "select": textFieldController.select()
            case "checkValidity": methodResult = .bool(textFieldController.checkValidity())
            case "reportValidity": methodResult = .bool(textFieldController.reportValidity())
            default: methodResult = textFieldController.getValidity().value
            }
            Self.pump(0.03);return
        }
        if tag=="md-navigation-bar",let method=request.method,["select","focusTab"].contains(method) {
            guard let arguments=request.arguments,arguments.count==1,case .number(let n)=arguments[0],n.rounded()==n,abs(n)<1e9 else {throw PreviewFailure("\(method) requires one integer destination index.")}
            if method=="select" { navigationBarController.select(Int(n)) } else { navigationBarController.focusTab(Int(n)) }
            Self.pump(0.03); return
        }
        if tag=="md-navigation-tab",request.method=="focusEl" {
            guard (request.arguments ?? []).isEmpty else {throw PreviewFailure("focusEl requires no arguments.")}
            navigationTabController.focusEl(); Self.pump(0.03); return
        }
        if tag=="md-tabs",let method=request.method,method=="selectTab" {
            guard let arguments=request.arguments,arguments.count==1,case .number(let n)=arguments[0],n.rounded()==n,abs(n)<1e9 else {throw PreviewFailure("selectTab requires one integer tab index.")}
            tabsController.selectTab(Int(n)); Self.pump(0.03); return
        }
        if tag=="md-breadcrumbs",let method=request.method,["expand","collapse"].contains(method) {
            guard (request.arguments ?? []).isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            if method=="expand" { breadcrumbsController.expand() } else { breadcrumbsController.collapse() }
            Self.pump(0.03); return
        }
        if tag=="md-ripple",let method=request.method,["trigger","whenSettled"].contains(method) {
            guard (request.arguments ?? []).isEmpty else {throw PreviewFailure("\(method) requires no arguments.")}
            if method=="trigger" { rippleController.trigger(); Self.pump(0.03); return }
            let flag=RippleSettleFlag()
            Task { @MainActor in await rippleController.whenSettled(); flag.done=true }
            let end=Date().addingTimeInterval(1); while !flag.done && Date()<end { Self.pump(0.01) }
            return
        }
        if tag=="md-accordion-item",let method=request.method,["toggle","focusHeader"].contains(method) {
            guard request.arguments?.isEmpty ?? true else {throw PreviewFailure("\(method) requires no arguments.")}
            guard accordionItemController.isConnected else {throw PreviewFailure("The accordion item is not mounted.")}
            if method=="toggle" {accordionItemController.toggle()} else {accordionItemController.focusHeader()}
            Self.pump(0.02);return
        }
        guard tag == "md-fab", request.method == "setMenuIcon", let arguments=request.arguments, arguments.count == 1 else {throw PreviewFailure("Unsupported native method or arguments.")}
        let value:String?
        switch arguments[0] {case .null:value=nil;case .string(let text):value=text;default:throw PreviewFailure("setMenuIcon requires one string or null argument.")}
        var invoked=false
        let operation=Task { @MainActor in await fabController.setMenuIcon(value); invoked=true }
        let deadline=Date().addingTimeInterval(2)
        while !invoked && Date()<deadline {Self.pump(0.002)}
        guard invoked else {operation.cancel();throw PreviewFailure("Native method invocation did not complete.")}
    }
    private func validCallID(_ id:String)->Bool {id.range(of:"^[A-Za-z0-9_-]{1,80}$",options:.regularExpression) != nil}
    private func methodError(_ id:String,_ code:String,_ message:String)->AWCValue {
        ["callId":.string(id),"status":"rejected","error":["code":.string(code),"message":.string(message)]]
    }
    private func acceptMethod(_ request:PreviewRequest) throws -> [String:AWCValue] {
        try requireConfigured()
        guard request.target=="component",let id=request.callId,validCallID(id),let method=request.method,let arguments=request.arguments else {throw PreviewFailure("Invalid native lifecycle method request.")}
        let snackbar=tag=="md-snackbar",modal=["md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag)
        if tag=="md-tooltip"{guard ["show","hide"].contains(method),arguments.isEmpty else{throw PreviewFailure("Tooltip accepts show() or hide() with no arguments.")}}
        else if snackbar {
            guard (method=="show" && arguments.isEmpty) || (method=="hide" && (arguments.isEmpty || (arguments.count==1 && [AWCValue.string("auto"),.string("action"),.string("close")].contains(arguments[0])))) else{throw PreviewFailure("Snackbar accepts show() or hide(auto|action|close).")}
        }else if modal {guard (tag=="md-bottom-sheet" ? ["show","close"]:["show","close","whenClosed"]).contains(method),arguments.isEmpty else{throw PreviewFailure("Invalid \(tag) lifecycle method request.")}
        }else if tag=="md-menu"{guard ["show","close","whenClosed"].contains(method),arguments.isEmpty || (method=="show" && arguments.count==1 && Self.menuShowOptions(arguments[0]).0) else{throw PreviewFailure("md-menu accepts show([{ autoFocus }]), close() or whenClosed().")}
        }else{guard tag=="md-fab-menu",["show","close","whenClosed"].contains(method),arguments.isEmpty else{throw PreviewFailure("Invalid FAB Menu lifecycle method request.")}}
        let result:AWCValue
        if let previous=methodCalls[id] {
            result=previous.method==method && previous.arguments==arguments ? ["callId":.string(id),"status":"accepted"]:methodError(id,"METHOD_CALL_ID_MISMATCH","This call ID already belongs to another request.")
        } else if methodCalls.count>=32 {result=methodError(id,"METHOD_CALLS_BUSY","Acknowledge completed methods before starting another call.")}
        else {
            methodCalls[id]=MethodCall(method:method,arguments:arguments)
            let task=Task { @MainActor [weak self] in
                guard let self else{return}
                if self.tag=="md-tooltip"{if method=="show"{await self.tooltipController.show()}else{await self.tooltipController.hide()}}
                else if snackbar {
                    if method=="show"{await self.snackbarController.show()}
                    else{await self.snackbarController.hide(reason:AWCSnackbarCloseReason(rawValue:arguments.first?.string ?? "close") ?? .close)}
                }else if modal {switch method {case "show":self.modalShow();case "close":self.modalClose();default:await self.modalWhenClosed()}
                }else if self.tag=="md-menu" {let handle=self.menuState.menu(self.rootState.map { AWCPreviewMenu.menuID(for:$0.node) } ?? "demo-menu");switch method {
                case "show":handle.show(autoFocus:arguments.first.flatMap { Self.menuShowOptions($0).1 })
                case "close":handle.close()
                default:await handle.whenClosed()
                }
                }else{switch method {
                case "show":await self.fabMenuController.show()
                case "close":await self.fabMenuController.close()
                default:await self.fabMenuController.whenClosed()
                }}
                guard !Task.isCancelled,self.methodCalls[id] != nil else{return}
                self.methodCalls[id]?.status="fulfilled";self.methodCalls[id]?.task=nil
            }
            methodCalls[id]?.task=task
            result=["callId":.string(id),"status":"accepted"]
        }
        return ["id":request.id ?? .null,"ack":true,"methodCall":result,"events":events.drain()]
    }
    private func queryMethods(_ request:PreviewRequest) throws -> [String:AWCValue] {
        try requireConfigured()
        guard ["md-fab-menu","md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag) || tag=="md-menu",let ids=request.callIds,let acknowledged=request.acknowledged,
              ids.count<=32,acknowledged.count<=32,Set(ids).count==ids.count,Set(acknowledged).count==acknowledged.count,
              Set(ids).isDisjoint(with:acknowledged),ids.allSatisfy(validCallID),acknowledged.allSatisfy(validCallID) else {throw PreviewFailure("Invalid native method result query.")}
        for id in acknowledged where methodCalls[id]?.status != "pending" {methodCalls[id]=nil}
        let results=ids.map{id -> AWCValue in
            guard let call=methodCalls[id] else{return methodError(id,"UNKNOWN_METHOD_CALL","No retained method has this call ID.")}
            return ["callId":.string(id),"status":.string(call.status)]
        }
        return ["id":request.id ?? .null,"ack":true,"methodResults":.array(results),"events":events.drain()]
    }
    /// Source property types of the md-menu family (retained preview updates).
    private func validateMenuPatch(_ patch:[String:AWCValue]) throws {
        let declared:[String:Set<String>]=["md-menu":["open","anchor","placement","quick","variant","layout","useGap","emptyText","matchAnchorWidth","responsive","persistent","autoFocus","maxHeight","listLabel","listbox","density"],
            "md-menu-item":["headline","supportingText","trailingText","disabled","selected","indeterminate","keepOpen","divider","gap","badge","type","checkPosition","presentation","roleOverride","density"],
            "md-sub-menu-item":["headline","supportingText","disabled","divider","gap","badge","openDelay","closeDelay","density"],"md-menu-item-group":["label","density"]]
        let booleans:Set<String>=["open","quick","useGap","matchAnchorWidth","responsive","persistent","autoFocus","listbox","disabled","selected","indeterminate","keepOpen","divider","gap"]
        let enums:[String:[String]]=["placement":["bottom-start","bottom-end","top-start","top-end"],"variant":["baseline","standard","vibrant"],"layout":["standard","grouped"],"type":["button","checkbox","radio"],"checkPosition":["start","end"],"presentation":["menuitem","option"]]
        for (key,value) in patch {
            guard declared[tag]?.contains(key)==true else {throw PreviewFailure("Unknown property for \(tag): \(key)")}
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if let options=enums[key]{guard case .string(let s)=value,options.contains(s) else{throw PreviewFailure("\(key) requires one of \(options.joined(separator:", ")).")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("density requires 0 to -4.")}}
            else if ["openDelay","closeDelay"].contains(key){guard case .number(let n)=value,n.isFinite,n>=0 else{throw PreviewFailure("\(key) requires a finite number of milliseconds.")}}
            else if key=="maxHeight"{
                switch value {
                case .number(let n): guard n.isFinite,n>=0 else{throw PreviewFailure("maxHeight requires a non-negative number or a CSS length.")}
                case .string(let s): guard s.utf8.count<=4096 else{throw PreviewFailure("maxHeight is too long.")}
                default: throw PreviewFailure("maxHeight requires a number or a CSS length.")
                }
            }
            else{guard case .string(let s)=value,s.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
        }
    }
    /// md-menu show(options): (valid, autoFocus) of `{ autoFocus?: boolean }`.
    private static func menuShowOptions(_ value:AWCValue)->(Bool,Bool?) {
        guard case .object(let options)=value,options.keys.allSatisfy({ $0=="autoFocus" }) else {return (false,nil)}
        guard let flag=options["autoFocus"] else {return (true,nil)}
        guard case .bool(let b)=flag else {return (false,nil)}
        return (true,b)
    }
    /// Source property types of md-accordion / md-accordion-item (retained preview updates).
    private func validateAccordionPatch(_ patch:[String:AWCValue]) throws {
        let group=tag=="md-accordion"
        let booleans:Set<String>=group ? ["reorderable","floating","bringToFront","exclusive","keepOneExpanded"]:["expanded","disabled","collapsible"]
        let strings:Set<String>=group ? ["defaultExpanded"]:["headline","supportingText","icon","contentMaxHeight"]
        let enums:[String:[String]]=group ? ["variant":["filled","outlined"],"region":["auto","always","never"],"transition":["expressive","standard","fade","collapse","none"]]:["regionRole":["region","group","none"]]
        let integers:[String:[Double]]=group ? ["density":[0,-1,-2,-3,-4],"elevation":[0,1,2,3,4,5],"headingLevel":[1,2,3,4,5,6]]:["density":[0,-1,-2,-3,-4],"headingLevel":[1,2,3,4,5,6]]
        let numbers:Set<String>=group ? ["initialX","initialY","regionThreshold"]:[]
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings.contains(key){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if let options=enums[key]{guard case .string(let text)=value,options.contains(text) else{throw PreviewFailure("\(key) requires one of \(options.joined(separator:", ")).")}}
            else if let options=integers[key]{guard case .number(let n)=value,options.contains(n) else{throw PreviewFailure("Invalid \(key).")}}
            else if numbers.contains(key){guard case .number(let n)=value,n.isFinite else{throw PreviewFailure("\(key) requires a finite number.")}}
            else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
        }
    }
    /// Source property types of md-dialog / md-bottom-sheet / md-side-sheet (retained preview updates).
    private func validateModalPatch(_ patch:[String:AWCValue]) throws {
        let booleans:Set<String>, strings:Set<String>, enums:[String:[String]]
        switch tag {
        case "md-dialog":
            booleans=["open","fullscreen","scrimDismissible","divider","headerDivider"]
            strings=["headline","dialogAriaLabel","icon","locale","closeLabel","cancelLabel","okLabel"]; enums=[:]
        case "md-bottom-sheet":
            booleans=["open","showDragHandle","closeable","scrimDismissible","topDivider","bottomDivider","scrollShadow"]
            strings=["headline","sheetAriaLabel"]; enums=["variant":["standard","detached"],"headlineAlign":["start","center","end"],"contentAlign":["start","center","end"]]
        default:
            booleans=["open","closeable","showBack","scrimDismissible","topDivider","bottomDivider","detached"]
            strings=["headline","sheetAriaLabel"]; enums=["variant":["standard","modal"],"side":["start","end"]]
        }
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings.contains(key){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if let options=enums[key]{guard case .string(let text)=value,options.contains(text) else{throw PreviewFailure("\(key) requires one of \(options.joined(separator:", ")).")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
        }
    }
    /// Source property types of md-list / md-list-item (retained preview updates).
    private func validateListPatch(_ patch:[String:AWCValue]) throws {
        let list=tag=="md-list"
        let booleans:Set<String>=list ? ["reorderable"]:["disabled","softDisabled","selected","expandable","expanded","tabbable","rovingFocusVisible","reorderable"]
        let strings:Set<String>=list ? ["label","labelledby","roleOverride"]:["headline","overline","supportingText","trailingSupportingText","leadingIcon","trailingIcon","leadingAvatar","leadingAvatarAlt","leadingAvatarName","leadingAvatarLabel","leadingImage","leadingImageAlt","href","target","containerRole"]
        let enums:[String:[String]]=list ? ["listStyle":["standard","segmented"],"selectionMode":["none","single-select","multi-select"],"interactionMode":["single-action","multi-action"]]
            :["type":["text","button","link"],"selectionMode":["none","single-select","multi-select"],"interactionMode":["single-action","multi-action"]]
        let integers:[String:[Double]]=list ? ["density":[0,-1,-2,-3,-4]]:["density":[0,-1,-2,-3,-4],"lines":[1,2,3]]
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings.contains(key){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if let options=enums[key]{guard case .string(let text)=value,options.contains(text) else{throw PreviewFailure("\(key) requires one of \(options.joined(separator:", ")).")}}
            else if let options=integers[key]{guard case .number(let n)=value,options.contains(n) else{throw PreviewFailure("Invalid \(key).")}}
            else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
        }
    }
    /// Source property types of md-switch, md-checkbox, md-radio and md-chip (retained preview updates).
    private func validateSelectionPatch(_ tag:String,_ patch:[String:AWCValue]) throws {
        let booleans:[String:Set<String>]=["md-switch":["selected","disabled","softDisabled","required","icons","showOnlySelectedIcon"],"md-checkbox":["checked","indeterminate","disabled","softDisabled","required","error"],
            "md-radio":["checked","disabled","softDisabled","required"],"md-chip":["selected","selectable","elevated","disabled","softDisabled","removable"]]
        let strings:[String:Set<String>]=["md-switch":["name","value","selectedIcon","unselectedIcon","valueMissingLabel"],"md-checkbox":["name","value","errorText","supportingText","valueMissingLabel"],
            "md-radio":["name","value","valueMissingLabel"],"md-chip":["icon","trailingIcon","label","color"]]
        let enums:[String:Set<String>]=tag=="md-chip" ? ["variant":["assist","filter","input","suggestion"],"appearance":["outlined","filled","elevated"],"contentAlign":["start","center","end"]] : [:]
        for (key,value) in patch {
            if booleans[tag]?.contains(key)==true {guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings[tag]?.contains(key)==true {guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if let allowed=enums[key] {guard case .string(let text)=value,allowed.contains(text) else{throw PreviewFailure("Invalid \(key).")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
        }
    }
    /// Source property types of md-otp-field (retained preview updates).
    private func validateOTPFieldPatch(_ patch:[String:AWCValue]) throws {
        let booleans:Set<String>=["mask","autoSubmit","disabled","readOnly","required","error","reserveSupportingSpace"]
        let strings:Set<String>=["value","inputMode","name","errorText","supportingText","label","cellLabelTemplate","valueMissingLabel","incompleteLabel"]
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings.contains(key){guard case .string(let s)=value,s.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if key=="length"{guard case .number(let n)=value,n>=1,n<=64,n==n.rounded() else{throw PreviewFailure("length requires an integer from 1 to 64.")}}
            else if key=="groupSize"{guard case .number(let n)=value,n>=0,n<=64,n==n.rounded() else{throw PreviewFailure("groupSize requires an integer from 0 to 64.")}}
            else if key=="validationType"{guard case .string(let s)=value,["numeric","alpha","alphanumeric","none"].contains(s) else{throw PreviewFailure("Invalid validationType.")}}
            else if key=="transform"{guard case .string(let s)=value,["none","uppercase"].contains(s) else{throw PreviewFailure("transform requires none or uppercase.")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else{throw PreviewFailure("Unknown property for md-otp-field: \(key)")}
        }
    }
    /// Source property types of md-number-field (retained preview updates; formatOptions is Intl.NumberFormat options data).
    private func validateNumberFieldPatch(_ patch:[String:AWCValue]) throws {
        let booleans:Set<String>=["error","disabled","readOnly","required","snapOnStep","allowOutOfRange","allowWheelScrub","reserveSupportingSpace"]
        let strings:Set<String>=["label","placeholder","supportingText","errorText","name","locale","incrementLabel","decrementLabel","valueMissingLabel"]
        func text(_ v:AWCValue)->Bool { if case .string(let s)=v { return s.utf8.count<=4096 }; return false }
        func finite(_ v:AWCValue)->Bool { if case .number(let n)=v { return n.isFinite }; return false }
        func flag(_ v:AWCValue)->Bool { if case .bool=v { return true }; return false }
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if strings.contains(key){guard text(value) else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if ["value","min","max"].contains(key){ if case .null=value {} else { guard finite(value) else{throw PreviewFailure("\(key) requires a finite number or null.")} } }
            else if ["step","smallStep","largeStep"].contains(key){guard finite(value) else{throw PreviewFailure("\(key) requires a finite number.")}}
            else if key=="variant"{guard case .string(let s)=value,["filled","outlined"].contains(s) else{throw PreviewFailure("Invalid variant.")}}
            else if key=="steppers"{guard case .string(let s)=value,["inline","split","none"].contains(s) else{throw PreviewFailure("steppers requires inline, split or none.")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else if key=="formatOptions"{
                switch value {
                case .null: break
                case .string: guard text(value) else{throw PreviewFailure("formatOptions requires Intl.NumberFormat options.")}
                case .object(let o):
                    let ok=o.count<=32 && o.allSatisfy({ entry in entry.key.count<=40 && entry.key.allSatisfy({ $0.isASCII && $0.isLetter }) && (text(entry.value) || finite(entry.value) || flag(entry.value)) })
                    guard ok else{throw PreviewFailure("formatOptions requires Intl.NumberFormat options.")}
                default: throw PreviewFailure("formatOptions requires Intl.NumberFormat options.")
                }
            }
            else{throw PreviewFailure("Unknown property for md-number-field: \(key)")}
        }
    }
    /// Source property types of md-text-field (retained preview updates; formatter/parser are closures, native API only).
    private func validateTextFieldPatch(_ patch:[String:AWCValue]) throws {
        let booleans:Set<String>=["reserveSupportingSpace","spellcheck","disabled","readOnly","required","error","appearFocused","chipsWrap","inputExpanded"]
        let modes:Set<String>=["clearable","passwordToggle","speechToText"]
        let counts:Set<String>=["minLength","maxLength","rows","debounce","throttle"]
        let strings:Set<String>=["label","value","placeholder","type","name","pattern","autocomplete","inputMode","enterKeyHint","autoCapitalize","errorText",
            "supportingText","prefixText","suffixText","showPasswordLabel","hidePasswordLabel","speechLang","restrict"]
        let enums:[String:Set<String>]=["variant":["filled","outlined"],"formatOn":["blur","input"],"inputRole":["","combobox"],"inputAriaAutocomplete":["","none","inline","list","both"]]
        func text(_ v:AWCValue)->Bool { if case .string(let s)=v { return s.utf8.count<=4096 }; return false }
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if modes.contains(key){ if case .bool=value {} else { guard case .string(let s)=value,["internal","external"].contains(s) else{throw PreviewFailure("\(key) requires a boolean, internal or external.")} } }
            else if counts.contains(key){ if case .null=value {} else { guard case .number(let n)=value,n>=0,n<=1e6,n==n.rounded() else{throw PreviewFailure("\(key) requires a nonnegative integer.")} } }
            else if strings.contains(key){guard text(value) else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if ["min","max","step"].contains(key){ switch value { case .null: break; case .number(let n): guard n.isFinite else{throw PreviewFailure("Invalid \(key).")}; default: guard text(value) else{throw PreviewFailure("Invalid \(key).")} } }
            else if let allowed=enums[key]{guard case .string(let s)=value,allowed.contains(s) else{throw PreviewFailure("Invalid \(key).")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else if key=="multiline"{ if case .bool(false)=value {} else { guard case .string(let s)=value,["auto-grow","fixed"].contains(s) else{throw PreviewFailure("multiline requires false, auto-grow or fixed.")} } }
            else if key=="focusBorderWidth"{guard case .number(let n)=value,n.isFinite,n>=0,n<=64 else{throw PreviewFailure("Invalid focusBorderWidth.")}}
            else{throw PreviewFailure("Unknown property for md-text-field: \(key)")}
        }
    }
    /// Source property types of md-avatar (retained preview updates).
    private func validateAvatarPatch(_ patch:[String:AWCValue]) throws {
        let strings:Set<String>=["src","alt","name","initials","label"]
        for (key,value) in patch {
            if strings.contains(key){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}}
            else if key=="size"{
                switch value { case .string(let text) where text.utf8.count<=4096: break; case .number(let n) where n.isFinite: break
                default: throw PreviewFailure("size requires a preset, a CSS length or a finite number.") }
            }
            else if key=="shape"{guard case .string(let text)=value,["circle","rounded","square"].contains(text) else{throw PreviewFailure("shape requires circle, rounded or square.")}}
            else if key=="colorFromName"{guard case .bool=value else{throw PreviewFailure("colorFromName requires a boolean.")}}
            else if key=="loading"{guard case .string(let text)=value,["eager","lazy"].contains(text) else{throw PreviewFailure("loading requires eager or lazy.")}}
            else if key=="crossorigin"{guard case .string(let text)=value,["","anonymous","use-credentials"].contains(text) else{throw PreviewFailure("crossorigin requires an empty string, anonymous or use-credentials.")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else{throw PreviewFailure("Unknown property for md-avatar: \(key)")}
        }
    }
    /// Source property types of md-organization-chart (retained preview updates).
    private func validateOrgChartPatch(_ patch:[String:AWCValue]) throws {
        for (key,value) in patch {
            switch key {
            case "nodes":
                switch value { case .array, .object: break; case .string(let text) where text.utf8.count<=262_144: break
                default: throw PreviewFailure("nodes requires an array or object of nodes, or their JSON string.") }
            case "selectedIds":
                guard case .array(let ids)=value,ids.count<=4096,ids.allSatisfy({ if case .string(let t)=$0 { return t.utf8.count<=4096 }; return false }) else{throw PreviewFailure("selectedIds requires an array of strings.")}
            case "collapsible": guard case .bool=value else{throw PreviewFailure("collapsible requires a boolean.")}
            case "selectionMode": guard case .string(let text)=value,["none","single","multiple"].contains(text) else{throw PreviewFailure("selectionMode requires none, single or multiple.")}
            case "orientation": guard case .string(let text)=value,["vertical","horizontal"].contains(text) else{throw PreviewFailure("orientation requires vertical or horizontal.")}
            case "label","expandLabel","collapseLabel": guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string of at most 4096 UTF-8 bytes.")}
            case "density": guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}
            default: throw PreviewFailure("Unknown property for md-organization-chart: \(key)")
            }
        }
    }
    /// Source property types of md-card (retained preview updates).
    private func validateCardPatch(_ patch:[String:AWCValue]) throws {
        let booleans:Set<String>=["interactive","dragEnabled","disabled","softDisabled","ripple","fullWidth","fullHeight"]
        for (key,value) in patch {
            if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if key=="variant"{guard case .string(let text)=value,["elevated","filled","outlined"].contains(text) else{throw PreviewFailure("variant requires elevated, filled or outlined.")}}
            else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density.")}}
            else{throw PreviewFailure("Unknown property for md-card: \(key)")}
        }
    }
    private func updateProperties(_ request:PreviewRequest) throws {
        try requireConfigured()
        // Gate-7 R1-04: the button family updates its mounted root in place (contract generated from the source: the block at the end of this file).
        if AWCButtonFamilyPreviewUpdate.tags.contains(tag),let rootState,let patch=request.properties,!patch.isEmpty,request.target==nil,request.tag==nil {
            try AWCButtonFamilyPreviewUpdate.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCStepperPreview.updateTags.contains(tag),let rootState,let patch=request.properties,!patch.isEmpty,request.target==nil,request.tag==nil {
            try AWCStepperPreview.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCSRPreview.updateTags.contains(tag),let rootState,let patch=request.properties,!patch.isEmpty,request.target==nil,request.tag==nil {
            try AWCSRPreview.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCTablePreview.updateTags.contains(tag) {
            guard let rootState,let patch=request.properties,!patch.isEmpty,request.target==nil,request.tag==nil else{throw PreviewFailure("Update requires a nonempty property patch for a supported mounted root.")}
            try AWCTablePreview.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCPreviewMenu.tags.contains(tag) {
            guard let rootState,let patch=request.properties,!patch.isEmpty,request.target==nil,request.tag==nil else{throw PreviewFailure("Update requires a nonempty property patch for a supported mounted root.")}
            try validateMenuPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        guard ["md-otp-field","md-number-field","md-toolbar","md-line-chart","md-area-chart","md-bar-chart","md-pie-chart","md-sparkline","md-text-field","md-navigation-bar","md-navigation-tab","md-tabs","md-tab","md-tab-panels","md-tab-panel","md-breadcrumbs","md-breadcrumb-item","md-ripple","md-progress-indicator","md-skeleton","md-snackbar","md-tooltip","md-badge","md-loading-indicator","md-meter","md-status-dot","md-accordion","md-accordion-item","md-card","md-avatar","md-organization-chart","md-switch","md-checkbox","md-radio","md-chip","md-list","md-list-item","md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag),let rootState,let patch=request.properties,!patch.isEmpty,
              request.target==nil,request.tag==nil else{throw PreviewFailure("Update requires a nonempty property patch for a supported mounted root.")}
        if ["md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag){
            try validateModalPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-list","md-list-item"].contains(tag){
            try validateListPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCNavPreview.updateTags.contains(tag){
            try AWCNavPreview.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if AWCChartPreview.updateTags.contains(tag){
            try AWCChartPreview.validate(tag: tag, patch: patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-otp-field"{
            try validateOTPFieldPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-number-field"{
            try validateNumberFieldPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-text-field"{
            try validateTextFieldPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-navigation-bar","md-navigation-tab"].contains(tag){
            let declared:Set<String>=tag=="md-navigation-bar" ? ["activeIndex","labelBehavior","manualActivation","density"]:["active","disabled","softDisabled","label","icon","activeIcon","badge","badgeValue","badgeMax","href","target","labelBehavior","density"]
            for (key,value) in patch {
                guard declared.contains(key) else {throw PreviewFailure("Unknown property for \(tag): \(key)")}
                switch key {
                case "manualActivation","active","disabled","softDisabled","badge": guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}
                case "activeIndex","badgeMax": guard case .number(let n)=value,n.isFinite else{throw PreviewFailure("\(key) requires a number.")}
                case "labelBehavior": guard case .string(let s)=value,["always","selected","none"].contains(s) else{throw PreviewFailure("labelBehavior requires always, selected or none.")}
                case "density": guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("density requires 0 to -4.")}
                default: guard case .string(let s)=value,s.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string.")}
                }
            }
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-tabs","md-tab","md-tab-panels","md-tab-panel"].contains(tag){
            let declared:[String:Set<String>]=["md-tabs":["activeTabIndex","variant","divider","ariaLabelProp","tabWidth","width"],"md-tab":["label","icon","active","disabled","inlineIcon","variant","badge","controls","density"],"md-tab-panels":["for","sizing"],"md-tab-panel":["active"]]
            for (key,value) in patch {
                guard declared[tag]?.contains(key)==true else {throw PreviewFailure("Unknown property for \(tag): \(key)")}
                switch key {
                case "active","disabled","inlineIcon": guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}
                case "activeTabIndex": guard case .number(let n)=value,n.isFinite else{throw PreviewFailure("activeTabIndex requires a number.")}
                case "variant": guard case .string(let s)=value,["primary","secondary"].contains(s) else{throw PreviewFailure("variant requires primary or secondary.")}
                case "divider": guard case .string(let s)=value,["auto","full"].contains(s) else{throw PreviewFailure("divider requires auto or full.")}
                case "sizing": guard case .string(let s)=value,["stable","active"].contains(s) else{throw PreviewFailure("sizing requires stable or active.")}
                case "density": guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("density requires 0 to -4.")}
                default: guard case .string(let s)=value,s.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string.")}
                }
            }
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-breadcrumbs","md-breadcrumb-item"].contains(tag){
            let trail=tag=="md-breadcrumbs"
            let strings:Set<String>=trail ? ["label","expandLabel","separator"]:["href","target","rel","icon"],integers:Set<String>=trail ? ["maxItems","itemsBeforeCollapse","itemsAfterCollapse"]:[],booleans:Set<String>=trail ? []:["current","disabled"]
            for (key,value) in patch {
                if strings.contains(key){guard case .string(let s)=value,s.utf8.count<=4096 else{throw PreviewFailure("\(key) requires a string.")}}
                else if integers.contains(key){guard case .number(let n)=value,n>=0,n.rounded()==n else{throw PreviewFailure("\(key) requires a nonnegative integer.")}}
                else if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
                else if key=="density"{guard case .number(let n)=value,[0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("density requires 0 to -4.")}}
                else {throw PreviewFailure("Unknown property for \(tag): \(key)")}
            }
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-ripple"{
            for (key,value) in patch { guard key=="disabled" else {throw PreviewFailure("Unknown property for md-ripple: \(key)")}; guard case .bool=value else {throw PreviewFailure("disabled requires a boolean.")} }
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-switch","md-checkbox","md-radio","md-chip"].contains(tag){
            try validateSelectionPatch(tag,patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-avatar"{
            try validateAvatarPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-organization-chart"{
            try validateOrgChartPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-card"{
            try validateCardPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-accordion","md-accordion-item"].contains(tag){
            try validateAccordionPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if ["md-badge","md-loading-indicator","md-meter","md-status-dot"].contains(tag){ // R2-D6
            try validateCommunicationPatch(tag,patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        if tag=="md-tooltip"{
            try validateTooltipPatch(patch)
            rootState.node.properties.merge(patch){_,new in new}
            Self.pump(0.012);host?.layoutSubtreeIfNeeded();return
        }
        let skeleton=tag=="md-skeleton",snackbar=tag=="md-snackbar"
        let numbers:Set<String>=snackbar ? ["autoHideDuration"]:skeleton ? ["lines"]:["value","max","thickness","waveAmplitude","waveLength","waveSpeed","size"]
        let booleans:Set<String>=snackbar ? ["open","closeable","autoHide","stacked"]:skeleton ? ["fullWidth","fullHeight","announce"]:["indeterminate","wave","fourColor","complete"]
        for (key,value) in patch {
            if numbers.contains(key){guard case .number(let n)=value,n.isFinite else{throw PreviewFailure("\(key) requires a finite number.")}}
            else if booleans.contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if !snackbar && key=="variant"{guard case .string(let text)=value,(skeleton ? ["text","rectangular","rounded","circular"]:["linear","circular"]).contains(text) else{throw PreviewFailure("Unsupported variant for the mounted root.")}}
            else if skeleton && key=="animation"{guard case .string(let text)=value,["pulse","wave","none"].contains(text) else{throw PreviewFailure("animation requires pulse, wave or none.")}}
            else if (snackbar && ["message","action","dismissLabel"].contains(key)) || (skeleton && ["width","height","ariaLabelProp"].contains(key)) || (!snackbar && !skeleton && key=="label"){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires at most 4096 UTF-8 bytes.")}}
            else if snackbar && key=="position"{guard case .string(let text)=value,["bottom","bottom-start","bottom-end","top","top-start","top-end","start","end","center"].contains(text) else{throw PreviewFailure("Invalid Snackbar position.")}}
            else if snackbar && key=="politeness"{guard case .string(let text)=value,["polite","assertive"].contains(text) else{throw PreviewFailure("politeness requires polite or assertive.")}}
            else if key=="density"{guard case .number(let n)=value,[0.0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("density requires 0, -1, -2, -3 or -4.")}}
            else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
        }
        rootState.node.properties.merge(patch){_,new in new}
        // Drain SwiftUI's property observer before accepting the next queued
        // patch, so false→true remains two watcher changes on the same root.
        Self.pump(0.012)
        host?.layoutSubtreeIfNeeded()
    }
    /// R2-D6: the source property set and value domains of the four communication leaves. formatOptions null = absent.
    private func validateCommunicationPatch(_ tag:String,_ patch:[String:AWCValue]) throws{
        let declared:[String:Set<String>]=["md-badge":["variant","value","max","icon","shape","density"],"md-loading-indicator":["variant","label","density"],
            "md-meter":["value","min","max","label","showLabel","showValue","valueText","locale","formatOptions","color","variant","size","thickness","density"],
            "md-status-dot":["state","size","inline","shape","live","label","density"]]
        func text(_ v:AWCValue)->Bool{if case .string(let s)=v{return s.utf8.count<=4096};return false}
        func one(_ v:AWCValue,_ allowed:[String])->Bool{if case .string(let s)=v{return allowed.contains(s)};return false}
        func finite(_ v:AWCValue)->Bool{if case .number(let n)=v{return n.isFinite};return false}
        func flag(_ v:AWCValue)->Bool{if case .bool=v{return true};return false}
        for (key,value) in patch{
            guard declared[tag]?.contains(key)==true else{throw PreviewFailure("Unknown property for \(tag): \(key)")}
            let ok:Bool
            switch (tag,key){
            case (_,"density"): if case .number(let n)=value{ok=[0.0,-1,-2,-3,-4].contains(n)}else{ok=false}
            case ("md-badge","variant"): ok=one(value,["small","large"])
            case ("md-badge","shape"),("md-status-dot","shape"): ok=one(value,["rect","circle"])
            case ("md-loading-indicator","variant"): ok=one(value,["uncontained","contained"])
            case ("md-meter","variant"): ok=one(value,["linear","circular"])
            case ("md-status-dot","state"): ok=one(value,["online","away","busy","offline","invisible","neutral"])
            case ("md-status-dot","size"): ok=one(value,["small","medium","large"])
            case ("md-status-dot","inline"),("md-status-dot","live"),("md-meter","showLabel"),("md-meter","showValue"): ok=flag(value)
            case ("md-badge","max"),("md-meter","value"),("md-meter","min"),("md-meter","max"),("md-meter","size"),("md-meter","thickness"): ok=finite(value)
            case ("md-meter","formatOptions"): if case .object=value{ok=true}else if case .null=value{ok=true}else{ok=false}
            default: ok=text(value)
            }
            guard ok else{throw PreviewFailure("Invalid \(tag) \(key).")}
        }
    }
    private func validateTooltipPatch(_ patch:[String:AWCValue]) throws{
        for (key,value) in patch{
            if ["offset","crossOffset","showDelay","hideDelay"].contains(key){guard case .number(let n)=value,n.isFinite else{throw PreviewFailure("\(key) requires a finite number.")}}
            else if ["open","autoPosition","disabled"].contains(key){guard case .bool=value else{throw PreviewFailure("\(key) requires a boolean.")}}
            else if ["text","subhead"].contains(key){guard case .string(let text)=value,text.utf8.count<=4096 else{throw PreviewFailure("\(key) requires at most 4096 UTF-8 bytes.")}}
            else if key=="variant"{guard case .string(let text)=value,["plain","rich"].contains(text) else{throw PreviewFailure("Invalid Tooltip variant.")}}
            else if key=="position"{guard case .string(let text)=value,["top","bottom","left","right"].flatMap({side in [side,side+"-start",side+"-end"]}).contains(text) else{throw PreviewFailure("Invalid Tooltip position.")}}
            else if key=="density"{guard case .number(let n)=value,[0.0,-1,-2,-3,-4].contains(n) else{throw PreviewFailure("Invalid density rung.")}}
            else{throw PreviewFailure("Unknown Tooltip property: \(key)")}
        }
    }
    private func resize(_ request:PreviewRequest) throws {
        try requireConfigured()
        guard ["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag),let state=rootState,let width=request.width,let height=request.height,
              width.isFinite,height.isFinite,width>0,height>0 else{throw PreviewFailure("Resize requires positive finite width and height for a mounted overlay.")}
        let appliedWidth=min(1200,max(320,width)).rounded()
        let appliedHeight=min(min(2000,floor(2_000_000/appliedWidth)),max(1,height)).rounded()
        logicalWidth=appliedWidth;logicalHeight=appliedHeight
        state.width=appliedWidth;state.height=appliedHeight
        Self.pump(0.012)
        host?.layoutSubtreeIfNeeded()
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
        if let height=request.height{guard ["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(requestedTag),height.isFinite,height>0 else{throw PreviewFailure("height requires a positive finite overlay viewport.")}}
        logicalHeight=min(min(2000,floor(2_000_000/logicalWidth)),max(1,request.height ?? 240)).rounded()
        guard request.scenario == nil || (["button-behavior", "navigation-events", "focus-accessibility"].contains(request.scenario ?? "") && requestedTag == "md-button") else { throw PreviewFailure("Unknown native example.") }
        guard request.direction == nil || ["ltr", "rtl"].contains(request.direction ?? "") else { throw PreviewFailure("Direction must be ltr or rtl.") }
        for values in [request.menuAppearanceDefaults,request.menuAppearance] { if let values,AWCMenuAppearance(values:values)==nil { throw PreviewFailure("Invalid menu appearance.") } }
        var node = AWCExamples.node(for: requestedTag)
        if ["md-fab-menu","md-fab-menu-item","md-segmented-button-set"].contains(requestedTag) {node.id="component"}
        if requestedTag=="md-segmented-button" {node.id="segment-day"}
        // The Laboratory modal fixture: the sheet/dialog content of the Studio recipe, presented in the preview viewport.
        if ["md-dialog","md-bottom-sheet","md-side-sheet"].contains(requestedTag) {node.id="component";node.children=[.text("Every great project starts with a shared workspace.")]}
        if let context=request.segmentedContext {try context.validate(tag:requestedTag)}
        node.properties.merge(request.properties ?? [:]) { _, supplied in supplied }
        if let text = request.text {
            guard requestedTag == "md-button", text.utf8.count <= 4096 else { throw PreviewFailure("Button text must be at most 4096 UTF-8 bytes.") }
            if request.scenario == nil {
                node.children.removeAll { ($0.slot ?? "").isEmpty }
                node.children.append(.text(text))
            }
        }
        try AWCPreviewSlots.validateValues(request.slots ?? [:])
        if request.scenario == nil { node = try AWCPreviewSlots.applyingValues(request.slots ?? [:], to: node) }
        if let selection = request.buttonGroupSelection { node = try AWCPreviewButtonGroupSelection.applying(selection,to:node) }
        tag = requestedTag
        inspection.bounds = nil
        inspection.nodes = []
        inspection.buttonGroupSelection = nil
        inspection.segmentedSelection = nil
        inspection.splitButtonChecked = nil
        inspectionName = request.scenario.map { "\(requestedTag) · \($0) demo" } ?? requestedTag
        let retained=PreviewNodeState(node,width:logicalWidth,height:logicalHeight);rootState=retained
        let newHost = NSHostingView(rootView: PreviewRoot(nodeState: retained, dark: request.dark ?? false, onEvent: { [weak self] event in
            if ["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(event.tag),["mdOpen","mdClose"].contains(event.name){retained.node.properties["open"] = .bool(event.name=="mdOpen")}
            self?.events.append(event)
        }, pointerState: pointerState, scenario: request.scenario, themeTokens: request.themeTokens ?? [:], direction: request.direction ?? "ltr", buttonAppearance: AWCButtonAppearance(values: request.buttonAppearanceDefaults ?? [:]).merging(.init(values: request.buttonAppearance ?? [:])), iconButtonAppearance: AWCIconButtonAppearance(values: request.iconButtonAppearanceDefaults ?? [:]).merging(.init(values: request.iconButtonAppearance ?? [:])), buttonGroupAppearance: AWCButtonGroupAppearance(values: request.buttonGroupAppearanceDefaults ?? [:]).merging(.init(values: request.buttonGroupAppearance ?? [:])), progressIndicatorAppearance:AWCProgressIndicatorAppearance(values:request.progressIndicatorAppearanceDefaults ?? [:]).merging(.init(values:request.progressIndicatorAppearance ?? [:])), skeletonAppearance:AWCSkeletonAppearance(values:request.skeletonAppearanceDefaults ?? [:]).merging(.init(values:request.skeletonAppearance ?? [:])), snackbarAppearance:AWCSnackbarAppearance(values:request.snackbarAppearanceDefaults ?? [:]).merging(.init(values:request.snackbarAppearance ?? [:])), snackbarController:snackbarController, tooltipAppearance:AWCTooltipAppearance(values:request.tooltipAppearanceDefaults ?? [:]).merging(.init(values:request.tooltipAppearance ?? [:])), tooltipController:tooltipController, meterAppearance:AWCMeterAppearance(values:request.meterAppearanceDefaults ?? [:]).merging(.init(values:request.meterAppearance ?? [:])), loadingIndicatorAppearance:AWCLoadingIndicatorAppearance(values:request.loadingIndicatorAppearanceDefaults ?? [:]).merging(.init(values:request.loadingIndicatorAppearance ?? [:])), splitButtonAppearance:AWCSplitButtonAppearance(values:request.splitButtonAppearanceDefaults ?? [:]).merging(.init(values:request.splitButtonAppearance ?? [:])), segmentedContext:request.segmentedContext ?? .defaults(for:node), segmentedButtonAppearanceDefaults:AWCSegmentedButtonAppearance(values:request.segmentedButtonAppearanceDefaults ?? [:]), segmentedButtonAppearance:AWCSegmentedButtonAppearance(values:request.segmentedButtonAppearance ?? [:]), dividerAppearance: AWCDividerAppearance(values:request.dividerAppearanceDefaults ?? [:]).merging(.init(values:request.dividerAppearance ?? [:])), badgeAppearance: AWCBadgeAppearance(values:request.badgeAppearanceDefaults ?? [:]).merging(.init(values:request.badgeAppearance ?? [:])), statusDotAppearance: AWCStatusDotAppearance(values:request.statusDotAppearanceDefaults ?? [:]).merging(.init(values:request.statusDotAppearance ?? [:])), fabAppearance: AWCFabAppearance(values:request.fabAppearanceDefaults ?? [:]).merging(.init(values:request.fabAppearance ?? [:])), fabController:fabController, fabMenuAppearance:AWCFabMenuAppearance(values:request.fabMenuAppearanceDefaults ?? [:]).merging(.init(values:request.fabMenuAppearance ?? [:])), fabMenuItemAppearanceDefaults:AWCFabMenuItemAppearance(values:request.fabMenuItemAppearanceDefaults ?? [:]), fabMenuItemAppearance:AWCFabMenuItemAppearance(values:request.fabMenuItemAppearance ?? [:]), fabMenuController:fabMenuController, menuAppearanceDefaults:AWCMenuAppearance(values:request.menuAppearanceDefaults ?? [:]) ?? AWCMenuAppearance(), menuAppearance:AWCMenuAppearance(values:request.menuAppearance ?? [:]) ?? AWCMenuAppearance(), menuState:menuState, accordionAppearance:AWCAccordionAppearance(values:request.accordionAppearanceDefaults ?? [:]).merging(.init(values:request.accordionAppearance ?? [:])), accordionItemAppearance:AWCAccordionItemAppearance(values:request.accordionItemAppearanceDefaults ?? [:]).merging(.init(values:request.accordionItemAppearance ?? [:])), accordionItemController:accordionItemController, cardAppearance: AWCCardAppearance(values: request.cardAppearanceDefaults ?? [:]).merging(.init(values: request.cardAppearance ?? [:])), avatarAppearance: AWCAvatarAppearance(values: request.avatarAppearanceDefaults ?? [:]).merging(.init(values: request.avatarAppearance ?? [:])), orgChartAppearance: AWCOrgChartAppearance(values: request.orgChartAppearanceDefaults ?? [:]).merging(.init(values: request.orgChartAppearance ?? [:])), switchAppearance: AWCSwitchAppearance(values: request.switchAppearanceDefaults ?? [:]).merging(.init(values: request.switchAppearance ?? [:])), checkboxAppearance: AWCCheckboxAppearance(values: request.checkboxAppearanceDefaults ?? [:]).merging(.init(values: request.checkboxAppearance ?? [:])), radioAppearance: AWCRadioAppearance(values: request.radioAppearanceDefaults ?? [:]).merging(.init(values: request.radioAppearance ?? [:])), chipAppearance: AWCChipHookAppearance(values: request.chipAppearanceDefaults ?? [:]).merging(.init(values: request.chipAppearance ?? [:])), selectionController: selectionController, rippleAppearance: AWCRippleAppearance(values: request.rippleAppearanceDefaults ?? [:]).merging(.init(values: request.rippleAppearance ?? [:])), rippleController: rippleController, breadcrumbsAppearance: requestedTag == "md-breadcrumb-item" ? AWCBreadcrumbsAppearance(values: request.breadcrumbItemAppearanceDefaults ?? [:]).merging(.init(values: request.breadcrumbItemAppearance ?? [:])) : AWCBreadcrumbsAppearance(values: request.breadcrumbsAppearanceDefaults ?? [:]).merging(.init(values: request.breadcrumbsAppearance ?? [:])), breadcrumbsController: breadcrumbsController, tabsAppearance: AWCTabsAppearance(values: request.tabsAppearanceDefaults ?? [:]).merging(.init(values: request.tabsAppearance ?? [:])), tabAppearance: AWCTabAppearance(values: request.tabAppearanceDefaults ?? [:]).merging(.init(values: request.tabAppearance ?? [:])), tabsController: tabsController, navigationBarAppearance: AWCNavigationBarAppearance(values: request.navigationBarAppearanceDefaults ?? [:]).merging(.init(values: request.navigationBarAppearance ?? [:])), navigationTabAppearance: AWCNavigationTabAppearance(values: request.navigationTabAppearanceDefaults ?? [:]).merging(.init(values: request.navigationTabAppearance ?? [:])), navigationBarController: navigationBarController, navigationTabController: navigationTabController, textFieldAppearance: AWCTextFieldAppearance(values: request.textFieldAppearanceDefaults ?? [:]).merging(.init(values: request.textFieldAppearance ?? [:])), textFieldController: textFieldController, numberFieldAppearance: AWCNumberFieldAppearance(values: request.numberFieldAppearanceDefaults ?? [:]).merging(.init(values: request.numberFieldAppearance ?? [:])), numberFieldController: numberFieldController, otpFieldAppearance: AWCOTPFieldAppearance(values: request.otpFieldAppearanceDefaults ?? [:]).merging(.init(values: request.otpFieldAppearance ?? [:])), otpFieldController: otpFieldController, listAppearance: AWCListAppearance(values: request.listAppearanceDefaults ?? [:]).merging(.init(values: request.listAppearance ?? [:])), listItemAppearance: AWCListItemAppearance(values: request.listItemAppearanceDefaults ?? [:]).merging(.init(values: request.listItemAppearance ?? [:])), listController: listController, listItemController: listItemController, dialogAppearance: AWCDialogAppearance(values: request.dialogAppearanceDefaults ?? [:]).merging(.init(values: request.dialogAppearance ?? [:])), bottomSheetAppearance: AWCBottomSheetAppearance(values: request.bottomSheetAppearanceDefaults ?? [:]).merging(.init(values: request.bottomSheetAppearance ?? [:])), sideSheetAppearance: AWCSideSheetAppearance(values: request.sideSheetAppearanceDefaults ?? [:]).merging(.init(values: request.sideSheetAppearance ?? [:])), dialogController: dialogController, bottomSheetController: bottomSheetController, sideSheetController: sideSheetController, inspection: inspection, chartPreview: AWCChartPreview.options(tag: requestedTag, chart: chartController), navPreview: AWCNavPreview.options(tag: requestedTag, toolbar: toolbarController)))
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

    /// tools/ax: the accessibility tree assistive technologies receive for the current preview, AppKit keyboard focus and the effective node.
    private func accessibilitySnapshot(_ request: PreviewRequest) throws -> [String: AWCValue] {
        try requireConfigured()
        Self.pump(0.05)
        var response = AWCAccessibilityCapture.capture(window: window)
        response["id"] = request.id ?? .null
        response["platform"] = "macos"; response["tag"] = .string(tag)
        if let node = rootState?.node, let data = try? JSONEncoder().encode(node), let value = try? JSONDecoder().decode(AWCValue.self, from: data) { response["node"] = value }
        response["events"] = events.drain()
        return response
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
        guard ["md-button", "md-icon-button", "md-button-group", "md-fab","md-fab-menu","md-fab-menu-item","md-segmented-button","md-segmented-button-set","md-split-button","md-snackbar","md-tooltip","md-accordion","md-accordion-item","md-card","md-list","md-list-item","md-dialog","md-bottom-sheet","md-side-sheet","md-organization-chart"].contains(tag) || AWCTablePreview.pointerTags.contains(tag) else { throw PreviewFailure("Held pointer input is unsupported for this preview.") }
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
        if phase=="up" {NSApp.postEvent(event,atStart:false)} else {window.sendEvent(event)}
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
            if ["md-fab-menu","md-fab-menu-item","md-menu","md-menu-item","md-menu-item-group","md-sub-menu-item"].contains(tag),window?.firstResponder is NSView {try sendControlKey(key,modifiers:modifiers);return}
            // An open modal traps Tab in its surface: route it through the application like a keyboard.
            // A standard side sheet is not modal: its Tab is the window's key-view loop like any inline content.
            if tag=="md-otp-field",(window?.firstResponder as? NSTextView)?.isFieldEditor==true {try sendControlKey(key,modifiers:modifiers);return}
            if ["md-dialog","md-bottom-sheet"].contains(tag) || (tag=="md-side-sheet" && rootState?.node.properties["variant"]?.string=="modal") {try sendControlKey(key,modifiers:modifiers);return}
            if modifiers.contains("shift") { window?.selectPreviousKeyView(nil) }
            else { window?.selectNextKeyView(nil) }
            return
        }
        // Escape is a window-level overlay command even when a text editor owns
        // focus. Deliver it through AppKit so the library's scoped event monitors
        // receive the same event path as a physical keyboard.
        if key == "Escape" { try sendControlKey(key, modifiers: modifiers); return }
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

    /// Dispatch named keys and bounded printable characters to this private window.
    /// Button responders need keyDown/keyUp, rather than text-editor commands.
    private func sendControlKey(_ key: String, modifiers: Set<String>) throws {
        guard let window else { throw PreviewFailure("Native window unavailable.") }
        let keys: [String: (UInt16, String)] = [
            "Enter": (0x24, "\r"), "Space": (0x31, " "), "Escape": (0x35, "\u{1b}"),"Tab":(0x30,"\t"),
            "Backspace": (0x33, "\u{7f}"), "Delete": (0x75, "\u{f728}"),
            "ArrowLeft": (0x7b, "\u{f702}"), "ArrowRight": (0x7c, "\u{f703}"),
            "ArrowUp": (0x7e, "\u{f700}"), "ArrowDown": (0x7d, "\u{f701}"),
            "Home": (0x73, "\u{f729}"), "End": (0x77, "\u{f72b}"),
            "PageUp": (0x74, "\u{f72c}"), "PageDown": (0x79, "\u{f72d}")
        ]
        let printable=key.unicodeScalars.count==1 && key.unicodeScalars.allSatisfy{(0x21...0xFFFD).contains($0.value) && !CharacterSet.controlCharacters.contains($0)}
        guard let (code, characters) = keys[key] ?? (printable ? (0,key):nil) else { throw PreviewFailure("Unsupported native key: \(key)") }
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
            // NSApplication routes key events to its key window. This borderless, off-screen preview
            // window is not key while the renderer runs in the background, so Enter/Space would be
            // dropped; deliver them to the preview window directly in that case (as the view fixtures do).
            if NSApp.keyWindow === window || key == "Escape" || key == "Tab" && ["md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag) { NSApp.sendEvent(event) } else if !(type == .keyDown && AWCTablePreview.pointerTags.contains(tag) && AWCTableScrollController.routeKeyDown(event)) { window.sendEvent(event) }
        }
    }

    private func png(_ bitmap: NSBitmapImageRep) -> Data? {
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

    private func frame() throws -> [String: AWCValue] {
        try requireConfigured()
        guard let host, let window else { throw PreviewFailure("Native window unavailable.") }
        let profiling = ProcessInfo.processInfo.environment["AWC_NATIVE_PROFILE"] == "1"
        let start = ProcessInfo.processInfo.systemUptime
        host.layoutSubtreeIfNeeded()
        let fitting = host.fittingSize.height
        guard fitting.isFinite, fitting > 0 else { throw PreviewFailure("Component produced invalid native layout dimensions.") }
        let height = ["md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet"].contains(tag) ? logicalHeight:min(2000, max(100, fitting.rounded(.up)))
        if host.bounds.size != NSSize(width: logicalWidth, height: height) {
            window.setContentSize(NSSize(width: logicalWidth, height: height))
            host.frame = NSRect(x: 0, y: 0, width: logicalWidth, height: height)
            host.layoutSubtreeIfNeeded()
        }
        let layoutDone = ProcessInfo.processInfo.systemUptime
        guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { throw PreviewFailure("Native bitmap allocation failed.") }
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let captureDone = ProcessInfo.processInfo.systemUptime
        guard let png = png(bitmap) else { throw PreviewFailure("Native sRGB PNG encoding failed.") }
        if profiling {
            let end = ProcessInfo.processInfo.systemUptime
            let profile: [String: Double] = ["layoutMs": (layoutDone - start) * 1000, "captureMs": (captureDone - layoutDone) * 1000,
                                            "encodeMs": (end - captureDone) * 1000, "totalMs": (end - start) * 1000, "bytes": Double(png.count)]
            if let json = try? JSONSerialization.data(withJSONObject: ["nativeFrameProfile": profile], options: [.sortedKeys]) {
                FileHandle.standardError.write(json + Data([10]))
            }
        }
        var response: [String: AWCValue] = ["platform": "macos", "renderer": "SwiftUI", "tag": .string(tag), "png": .string(png.base64EncodedString()),
                "width": .number(Double(bitmap.pixelsWide)), "height": .number(Double(bitmap.pixelsHigh)),
                "logicalWidth": .number(logicalWidth), "logicalHeight": .number(height)]
        if tag == "md-button-group", let selection = inspection.buttonGroupSelection { response["buttonGroupSelection"] = .array(selection.map(AWCValue.bool)) }
        if ["md-segmented-button","md-segmented-button-set"].contains(tag),let selection=inspection.segmentedSelection {response["segmentedSelection"] = .array(selection.map(AWCValue.bool))}
        if tag=="md-split-button",let checked=inspection.splitButtonChecked {response["splitButtonChecked"] = .bool(checked)}
        if let measurement = inspection.metadata(name: inspectionName) { response["inspection"] = measurement }
        return response
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
        AWCAccessibilityCapture.startAnnouncementObserver()   // tools/ax: announcements made by the preview
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
                        AWCStepperPreview.capture(data)
                        AWCSRPreview.capture(data)
                        AWCTablePreview.capture(data)
                        AWCChartPreview.capture(data)
                        AWCNavPreview.capture(data)
                        id = request.id
                        if ["update","resize"].contains(request.command),let object=try JSONSerialization.jsonObject(with:data) as? [String:Any],
                           !Set(object.keys).isSubset(of:request.command=="resize" ? ["id","command","width","height"]:["id","command","properties"]){
                            throw PreviewFailure("Update accepts only id, command and properties.")
                        }
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

// BEGIN tools/ax accessibility capture (generated by tools/ax install; edit tools/ax/native/AccessibilityCapture.swift)
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
// END tools/ax accessibility capture

/// whenSettled() completion observed while the request loop pumps the run loop.
@MainActor final class RippleSettleFlag { var done = false }

// ---- begin chart live host (chart lab patch: LiveCharts.swift) ----
// md-line/area/bar/pie-chart and md-sparkline in the SwiftUI live host: typed hook defaults + local values, retained property
// updates with the source property types, and the methods with results (AWCChartController).

struct AWCChartPreviewError: LocalizedError { let message: String; var errorDescription: String? { message }; init(_ m: String) { message = m } }

/// The chart fields of a Laboratory request (`<key>Defaults` first, the local `<key>` wins — the nearer custom property).
struct AWCChartPreviewRequest: Decodable {
    var lineChartAppearanceDefaults: [String: AWCValue]? = nil; var lineChartAppearance: [String: AWCValue]? = nil
    var areaChartAppearanceDefaults: [String: AWCValue]? = nil; var areaChartAppearance: [String: AWCValue]? = nil
    var barChartAppearanceDefaults: [String: AWCValue]? = nil; var barChartAppearance: [String: AWCValue]? = nil
    var pieChartAppearanceDefaults: [String: AWCValue]? = nil; var pieChartAppearance: [String: AWCValue]? = nil
    var sparklineAppearanceDefaults: [String: AWCValue]? = nil; var sparklineAppearance: [String: AWCValue]? = nil
}

struct AWCChartPreviewOptions {
    var chart = AWCChartAppearance()
    let chartController: AWCChartController
}

extension View {
    func awcChartPreview(_ o: AWCChartPreviewOptions) -> some View {
        awcChartAppearance(o.chart).awcChartController(o.chartController)
    }
}

@MainActor enum AWCChartPreview {
    static var request = AWCChartPreviewRequest()
    /// Called with every request line; `configure` reads the fields of its own line.
    static func capture(_ data: Data) { request = (try? JSONDecoder().decode(AWCChartPreviewRequest.self, from: data)) ?? AWCChartPreviewRequest() }

    static func options(tag: String, chart: AWCChartController) -> AWCChartPreviewOptions {
        let r = request
        var o = AWCChartPreviewOptions(chartController: chart)
        let pair: ([String: AWCValue]?, [String: AWCValue]?) = switch tag {
        case "md-line-chart": (r.lineChartAppearanceDefaults, r.lineChartAppearance)
        case "md-area-chart": (r.areaChartAppearanceDefaults, r.areaChartAppearance)
        case "md-bar-chart": (r.barChartAppearanceDefaults, r.barChartAppearance)
        case "md-pie-chart": (r.pieChartAppearanceDefaults, r.pieChartAppearance)
        case "md-sparkline": (r.sparklineAppearanceDefaults, r.sparklineAppearance)
        default: (nil, nil)
        }
        o.chart = AWCChartAppearance(values: pair.0 ?? [:]).merging(.init(values: pair.1 ?? [:]))
        return o
    }

    // ---- retained updates (source property types; closures are native API only) ----
    private static let chartCommon = "label:s subtitle:os titleAlign:e=start|center|end legend:e=top|bottom|left|right|top-start|top-end|bottom-start|bottom-end|none tooltip:e=axis|item|none locale:s heightProp:s noAnimation:b animation:e=expressive|grow|fade|draw|stagger|none animationDuration:n density:d"
    private static let curve = "e=linear|smooth|monotone|step|step-before|step-middle", stack = "e=none|normal|percent|stream", grid = "e=none|horizontal|vertical|both", zoom = "e=none|inside|slider|both"
    private static let spec: [String: String] = [
        "md-line-chart": chartCommon + " markLines:j series:j xAxis:j yAxis:j yAxes:j curve:\(curve) stack:\(stack) connectNulls:b showMarks:b lineWidth:n markSize:n area:b showLine:b grid:\(grid) axisTicks:b inverted:b showLabels:b seriesLabels:b zoom:\(zoom) labelEmpty:s labelPlot:s labelPoint:s labelZoomStart:s labelZoomEnd:s summary:s tableLabels:j loading:b loadingLabel:s",
        "md-area-chart": chartCommon + " series:j xAxis:j yAxis:j curve:\(curve) stack:\(stack) connectNulls:b showMarks:b lineWidth:n markSize:n zoom:\(zoom) fillOpacity:n showLine:b grid:\(grid) inverted:b seriesLabels:b summary:s tableLabels:j labelEmpty:s loading:b loadingLabel:s labelZoomStart:s labelZoomEnd:s axisTicks:b showLabels:b labelPlot:s labelPoint:s",
        "md-bar-chart": chartCommon + " series:j xAxis:j yAxis:j yAxis2:j layout:e=vertical|horizontal stack:\(stack) categoryGap:sn barGap:sn barWidth:n cornerRadius:n zoom:\(zoom) showLabels:b showTotals:b chevron:b polar:b polarHole:n polarSweep:n axisTicks:b clickable:b labelZoomStart:s labelZoomEnd:s labelPlot:s labelPoint:s loading:b loadingLabel:s",
        "md-pie-chart": chartCommon + " data:j innerRadius:sn outerRadius:sn startAngle:n endAngle:n paddingAngle:n cornerRadius:n showLabels:b labelMode:e=value|name|both monochrome:s gradient:b highlight:e=slice|series|none summary:s tableLabels:j labelEmpty:s loading:b loadingLabel:s labelPlot:s labelPoint:s ringWidths:j",
        "md-sparkline": "data:j labels:j variant:e=line|bar|area color:s curve:\(curve) showTooltip:b showMarks:e=none|extremes|edges|all referenceAreas:j heightProp:s noAnimation:b cornerRadius:n min:n max:n lineWidth:n markSize:n barWidth:n",
    ]
    static let updateTags = Set(spec.keys)
    private static func types(_ tag: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (spec[tag] ?? "").split(separator: " ").map { item in let p = item.split(separator: ":", maxSplits: 1); return (String(p[0]), String(p[1])) })
    }
    private static func text(_ v: AWCValue, _ limit: Int = 4096) -> Bool { if case .string(let s) = v { return s.utf8.count <= limit }; return false }
    private static func json(_ v: AWCValue, _ depth: Int = 0) -> Bool {
        guard depth <= 16 else { return false }
        switch v {
        case .number(let n): return n.isFinite
        case .array(let a): return a.count <= 10000 && a.allSatisfy { json($0, depth + 1) }
        case .object(let o): return o.values.allSatisfy { json($0, depth + 1) }
        default: return true
        }
    }
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        let t = types(tag)
        for (key, value) in patch {
            guard let type = t[key] else { throw AWCChartPreviewError("Unknown \(tag) property: \(key)") }
            let ok: Bool
            switch type {
            case "b": if case .bool = value { ok = true } else { ok = false }
            case "n": if case .number(let n) = value { ok = n.isFinite } else { ok = false }
            case "s": ok = text(value)
            case "os": ok = value == .null || text(value)
            case "sn": if case .number(let n) = value { ok = n.isFinite } else { ok = text(value, 64) }
            case "d": if case .number(let n) = value { ok = [0, -1, -2, -3, -4].contains(n) } else { ok = false }
            case "j":
                switch value { case .null: ok = true
                case .array, .object: ok = json(value) && ((try? JSONEncoder().encode(value))?.count ?? .max) <= 262_144
                default: ok = false }
            default:
                if type.hasPrefix("e="), case .string(let s) = value { ok = type.dropFirst(2).split(separator: "|").contains { $0 == s } } else { ok = false }
            }
            guard ok else { throw AWCChartPreviewError("Invalid \(tag) \(key).") }
        }
    }

    // ---- methods with results ----
    private static let methods: [String: Set<String>] = [
        "md-line-chart": ["refreshTheme", "resize", "replay", "toDataURL", "setZoom", "resetZoom"], "md-area-chart": ["refreshTheme", "resize", "replay", "toDataURL", "setZoom", "resetZoom"],
        "md-bar-chart": ["refreshTheme", "resize", "replay", "drill", "toDataURL", "setZoom", "resetZoom"], "md-pie-chart": ["refreshTheme", "resize", "replay", "drill", "toDataURL"],
        "md-sparkline": ["refreshTheme", "resize"],
    ]
    static let methodTags = Set(methods.keys)
    static func invoke(tag: String, method: String, arguments: [AWCValue], chart: AWCChartController) throws -> AWCValue? {
        guard methods[tag]?.contains(method) == true else { throw AWCChartPreviewError("Unsupported native method or arguments.") }
        guard chart.isConnected else { throw AWCChartPreviewError("The \(tag) is not mounted.") }
        switch method {
        case "setZoom":
            guard arguments.count == 2, case .number(let a) = arguments[0], case .number(let b) = arguments[1], a.isFinite, b.isFinite else { throw AWCChartPreviewError("setZoom requires two numbers: startIndex and endIndex.") }
            chart.setZoom(startIndex: a, endIndex: b)
        case "drill":
            guard (1...2).contains(arguments.count), case .number(let i) = arguments[0], i >= 0, i == i.rounded(), i < 1e9 else { throw AWCChartPreviewError("drill requires an index (an integer from 0) and optionally down or up.") }
            var direction = "down"
            if arguments.count == 2 { guard case .string(let d) = arguments[1], ["down", "up"].contains(d) else { throw AWCChartPreviewError("drill direction must be down or up.") }; direction = d }
            chart.drill(index: Int(i), direction: direction)
        default:
            guard arguments.isEmpty else { throw AWCChartPreviewError("\(method) requires no arguments.") }
            switch method {
            case "replay": chart.replay()
            case "resetZoom": chart.resetZoom()
            case "refreshTheme": chart.refreshTheme()
            case "resize": chart.resize()
            case "toDataURL": return .string(chart.toDataURL())
            default: break
            }
        }
        return nil
    }
}
// ---- end chart live host ----

// ---- begin md-table live host (n4 lab patch: LiveTable.swift) ----
// The md-table family in the SwiftUI live host: typed hook defaults + local values (eight appearance types), retained
// property updates with the source property types (eleven tags) and the methods with results (md-table, md-table-row,
// md-table-pagination).

struct AWCTablePreviewError: LocalizedError { let message: String; var errorDescription: String? { message }; init(_ m: String) { message = m } }

/// The table fields of a Laboratory request (`<key>Defaults` first, the local `<key>` wins — the nearer custom property).
struct AWCTablePreviewRequest: Decodable {
    var command: String? = nil; var tag: String? = nil
    var tableAppearanceDefaults: [String: AWCValue]? = nil; var tableAppearance: [String: AWCValue]? = nil
    var tableCellAppearanceDefaults: [String: AWCValue]? = nil; var tableCellAppearance: [String: AWCValue]? = nil
    var tableContainerAppearanceDefaults: [String: AWCValue]? = nil; var tableContainerAppearance: [String: AWCValue]? = nil
    var tableExpandToggleAppearanceDefaults: [String: AWCValue]? = nil; var tableExpandToggleAppearance: [String: AWCValue]? = nil
    var tablePaginationAppearanceDefaults: [String: AWCValue]? = nil; var tablePaginationAppearance: [String: AWCValue]? = nil
    var tableRowAppearanceDefaults: [String: AWCValue]? = nil; var tableRowAppearance: [String: AWCValue]? = nil
    var tableSortLabelAppearanceDefaults: [String: AWCValue]? = nil; var tableSortLabelAppearance: [String: AWCValue]? = nil
    var tableToolbarAppearanceDefaults: [String: AWCValue]? = nil; var tableToolbarAppearance: [String: AWCValue]? = nil
}

struct AWCTablePreviewOptions {
    var table = AWCTableAppearance(), cell = AWCTableCellAppearance(), container = AWCTableContainerAppearance(), expandToggle = AWCTableExpandToggleAppearance()
    var pagination = AWCTablePaginationAppearance(), row = AWCTableRowAppearance(), sortLabel = AWCTableSortLabelAppearance(), toolbar = AWCTableToolbarAppearance()
    let tableController: AWCTableController, paginationController: AWCTablePaginationController
}

extension View {
    /// Hooks for the selected family member, and the controllers: the table under the root id, the wrapper a sub-tag shown
    /// alone gets (`<id>-table`) and the shared example's inner table; the pagination under the root id.
    func awcTablePreview(_ o: AWCTablePreviewOptions, id: String) -> some View {
        awcTableAppearance(o.table).awcTableCellAppearance(o.cell).awcTableContainerAppearance(o.container).awcTableExpandToggleAppearance(o.expandToggle)
            .awcTablePaginationAppearance(o.pagination).awcTableRowAppearance(o.row).awcTableSortLabelAppearance(o.sortLabel).awcTableToolbarAppearance(o.toolbar)
            .awcTableController(o.tableController, for: id).awcTableController(o.tableController, for: id + "-table")
            .awcTableController(o.tableController, for: "example-md-table").awcTablePaginationController(o.paginationController, for: id)
    }
}

@MainActor enum AWCTablePreview {
    /// One session per process (configure once): the controllers and the selected member's hooks live here.
    static let tableController = AWCTableController(), paginationController = AWCTablePaginationController()
    static var current = AWCTablePreviewOptions(tableController: tableController, paginationController: paginationController)
    static var request = AWCTablePreviewRequest()
    /// Called with every request line; a `configure` line sets the options for its tag.
    static func capture(_ data: Data) {
        request = (try? JSONDecoder().decode(AWCTablePreviewRequest.self, from: data)) ?? AWCTablePreviewRequest()
        if request.command == "configure", let tag = request.tag { current = options(tag: tag, table: tableController, pagination: paginationController) }
    }

    static func options(tag: String, table: AWCTableController, pagination: AWCTablePaginationController) -> AWCTablePreviewOptions {
        let r = request
        var o = AWCTablePreviewOptions(tableController: table, paginationController: pagination)
        func merged(_ d: [String: AWCValue]?, _ l: [String: AWCValue]?) -> ([String: AWCValue], [String: AWCValue]) { (d ?? [:], l ?? [:]) }
        switch tag {
        case "md-table": let (d, l) = merged(r.tableAppearanceDefaults, r.tableAppearance); o.table = AWCTableAppearance(values: d).merging(.init(values: l))
        case "md-table-cell": let (d, l) = merged(r.tableCellAppearanceDefaults, r.tableCellAppearance); o.cell = AWCTableCellAppearance(values: d).merging(.init(values: l))
        case "md-table-container": let (d, l) = merged(r.tableContainerAppearanceDefaults, r.tableContainerAppearance); o.container = AWCTableContainerAppearance(values: d).merging(.init(values: l))
        case "md-table-expand-toggle": let (d, l) = merged(r.tableExpandToggleAppearanceDefaults, r.tableExpandToggleAppearance); o.expandToggle = AWCTableExpandToggleAppearance(values: d).merging(.init(values: l))
        case "md-table-pagination": let (d, l) = merged(r.tablePaginationAppearanceDefaults, r.tablePaginationAppearance); o.pagination = AWCTablePaginationAppearance(values: d).merging(.init(values: l))
        case "md-table-row": let (d, l) = merged(r.tableRowAppearanceDefaults, r.tableRowAppearance); o.row = AWCTableRowAppearance(values: d).merging(.init(values: l))
        case "md-table-sort-label": let (d, l) = merged(r.tableSortLabelAppearanceDefaults, r.tableSortLabelAppearance); o.sortLabel = AWCTableSortLabelAppearance(values: d).merging(.init(values: l))
        case "md-table-toolbar": let (d, l) = merged(r.tableToolbarAppearanceDefaults, r.tableToolbarAppearance); o.toolbar = AWCTableToolbarAppearance(values: d).merging(.init(values: l))
        default: break
        }
        return o
    }

    // ---- retained updates (source property types) ----
    private static let density = "d", sortOrder = "e=asc|desc|none"
    private static let spec: [String: String] = [
        "md-table": "density:td columnTemplate:s columns:n minWidth:s stickyHeader:b frozenHeader:b keepHeight:b scrollbar:e=overlay|gutter pinMode:e=stack|static pinIcon:s stickyFooter:b striped:b noDividers:b hoverable:b motion:e=expressive|none selection:e=none|single|multiple sortBy:s sortOrder:\(sortOrder) loading:b loadingMode:e=overlay|skeleton loadingRows:n empty:b label:s caption:s summary:s rowOffset:n rowCount:n",
        "md-table-body": "presentational:b", "md-table-foot": "presentational:b",
        "md-table-cell": "align:e=start|center|end|justify numeric:b padding:e=default|none|checkbox head:b scope:e=col|row|colgroup|rowgroup| sticky:e=start|end| colSpan:n rowSpan:n ellipsis:b variant:e=body|meta noPinIndicator:b pinIcon:s density:\(density)",
        "md-table-container": "variant:e=elevated|outlined|filled|flat shape:e=extra-large|large|medium|small|none maxHeight:s minHeight:s vibrant:b elevation:el",
        "md-table-expand-toggle": "buttonLabel:s icon:s",
        "md-table-pagination": "count:n page:n rowsPerPage:n rowsPerPageOptions:s showFirstLast:b labelDisplayedRows:s labelRowsPerPage:s labelFirstPage:s labelPreviousPage:s labelNextPage:s labelLastPage:s labelAll:s label:s compact:b disabled:b density:\(density)",
        "md-table-row": "rowgroup:e=head|body|foot selected:b disabled:b selectable:b clickable:b value:s expandable:b expanded:b highlight:b",
        "md-table-sort-label": "column:s disabled:b defaultOrder:e=asc|desc iconPosition:e=start|end icon:s inactiveIcon:e=always|hover active:b order:\(sortOrder) sortedAscendingLabel:s sortedDescendingLabel:s density:\(density)",
        "md-table-toolbar": "headline:s supportingText:s numSelected:n autoBind:b labelSelected:s compact:b density:\(density)",
    ]
    static let updateTags = Set(spec.keys)
    /// Pointer input (hover, press, held press) reaches every family member.
    static let pointerTags: Set<String> = ["md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell",
                                           "md-table-toolbar", "md-table-sort-label", "md-table-pagination", "md-table-expand-toggle"]
    private static func types(_ tag: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (spec[tag] ?? "").split(separator: " ").map { item in let p = item.split(separator: ":", maxSplits: 1); return (String(p[0]), String(p[1])) })
    }
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        let t = types(tag)
        for (key, value) in patch {
            guard let type = t[key] else { throw AWCTablePreviewError("Unknown \(tag) property: \(key)") }
            let ok: Bool
            switch (type, value) {
            case ("b", .bool): ok = true
            case ("n", .number(let n)): ok = n.isFinite
            case ("s", .string(let s)): ok = s.utf8.count <= 4096
            case ("d", .number(let n)): ok = [0, -1, -2, -3, -4].contains(n)
            case ("td", .number(let n)): ok = [0, -1, -2, -3, -4].contains(n)
            case ("td", .string(let s)): ok = ["compact", "standard", "comfortable"].contains(s)
            case ("el", .number(let n)): ok = [0, 1, 2, 3, 4, 5].contains(n)
            case (_, .string(let s)) where type.hasPrefix("e="):
                ok = type.dropFirst(2).split(separator: "|", omittingEmptySubsequences: false).contains { $0 == s }
            default: ok = false
            }
            guard ok else { throw AWCTablePreviewError("Invalid \(tag) \(key).") }
        }
    }

    // ---- methods with results ----
    private static let methods: [String: Set<String>] = [
        "md-table": ["getSelection", "selectAll", "deselectAll", "toggleSelectAll", "setSort", "pinColumn", "setColumnVisibility", "animateNextChange"],
        "md-table-row": ["toggle"], "md-table-pagination": ["goToPage", "setRowsPerPage"],
    ]
    static let methodTags = Set(methods.keys)
    private static func index(_ v: AWCValue) -> Int? { if case .number(let n) = v, n >= 0, n == n.rounded(), n < 1e9 { return Int(n) }; return nil }
    /// A table method's result travels as {"awcTableResult": value} (null is a valid pinColumn result; the generic
    /// method-result contract rejects a bare null).
    static func invoke(tag: String, method: String, arguments a: [AWCValue], rootID: String, table: AWCTableController, pagination: AWCTablePaginationController) throws -> AWCValue? {
        try result(tag: tag, method: method, arguments: a, rootID: rootID, table: table, pagination: pagination).map { .object(["awcTableResult": $0]) }
    }
    private static func result(tag: String, method: String, arguments a: [AWCValue], rootID: String, table: AWCTableController, pagination: AWCTablePaginationController) throws -> AWCValue? {
        guard methods[tag]?.contains(method) == true else { throw AWCTablePreviewError("Unsupported native method or arguments.") }
        if tag == "md-table-pagination" {
            guard pagination.isConnected else { throw AWCTablePreviewError("The md-table-pagination is not mounted.") }
            guard a.count == 1, case .number(let n) = a[0], n == n.rounded(), abs(n) < 1e9 else { throw AWCTablePreviewError("\(method) requires one integer.") }
            if method == "goToPage" { pagination.goToPage(Int(n)) } else { guard n >= 1 else { throw AWCTablePreviewError("setRowsPerPage requires a positive integer.") }; pagination.setRowsPerPage(Int(n)) }
            return nil
        }
        guard table.isConnected else { throw AWCTablePreviewError("The \(tag) is not mounted.") }
        if tag == "md-table-row" {
            guard a.isEmpty else { throw AWCTablePreviewError("toggle requires no arguments.") }
            table.toggleRow(rootID); return nil
        }
        switch method {
        case "setSort":
            guard a.count == 2, case .string(let column) = a[0], column.utf8.count <= 4096, case .string(let order) = a[1], ["asc", "desc", "none"].contains(order) else { throw AWCTablePreviewError("setSort requires a column id and asc, desc or none.") }
            table.setSort(column, order); return nil
        case "pinColumn":
            guard a.count == 2, let column = index(a[0]), case .string(let side) = a[1], ["start", "end", "none"].contains(side) else { throw AWCTablePreviewError("pinColumn requires a column index and start, end or none.") }
            return table.pinColumn(column, side).map { .string($0) } ?? .null
        case "setColumnVisibility":
            guard a.count == 2, let column = index(a[0]), case .bool(let visible) = a[1] else { throw AWCTablePreviewError("setColumnVisibility requires a column index and a boolean.") }
            return .bool(table.setColumnVisibility(column, visible))
        default:
            guard a.isEmpty else { throw AWCTablePreviewError("\(method) requires no arguments.") }
            switch method {
            case "getSelection": return table.getSelection()
            case "selectAll": table.selectAll()
            case "deselectAll": table.deselectAll()
            case "toggleSelectAll": table.toggleSelectAll()
            default: table.animateNextChange()
            }
            return nil
        }
    }
}
// ---- end md-table live host ----

// ---- begin sr live host (fa lab patch: LiveSR.swift) ----
// md-slider and md-rating in the SwiftUI live host: typed hook defaults + local values, retained property updates with
// the source property types, and focusRating() through AWCRatingController.

struct AWCSRPreviewError: LocalizedError { let message: String; var errorDescription: String? { message }; init(_ m: String) { message = m } }

/// The slider / rating fields of the configure request (`<key>Defaults` first, the local `<key>` wins — the nearer custom property).
struct AWCSRPreviewRequest: Decodable {
    var command: String? = nil
    var sliderAppearanceDefaults: [String: AWCValue]? = nil; var sliderAppearance: [String: AWCValue]? = nil
    var ratingAppearanceDefaults: [String: AWCValue]? = nil; var ratingAppearance: [String: AWCValue]? = nil
}

struct AWCSRPreviewOptions {
    var slider = AWCSliderAppearance(), rating = AWCRatingAppearance()
    let ratingController: AWCRatingController
}

extension View {
    func awcSRPreview(_ o: AWCSRPreviewOptions) -> some View {
        awcSliderAppearance(o.slider).awcRatingAppearance(o.rating).awcRatingController(o.ratingController)
    }
}

@MainActor enum AWCSRPreview {
    static var request = AWCSRPreviewRequest()
    /// The session's md-rating controller (one configured root per host session).
    static let ratingController = AWCRatingController()
    /// Called with every request line; only the configure line carries the hooks.
    static func capture(_ data: Data) {
        guard let r = try? JSONDecoder().decode(AWCSRPreviewRequest.self, from: data), r.command == "configure" else { return }
        request = r
    }

    static func options(tag: String) -> AWCSRPreviewOptions {
        let r = request
        var o = AWCSRPreviewOptions(ratingController: ratingController)
        if tag == "md-slider" { o.slider = AWCSliderAppearance(values: r.sliderAppearanceDefaults ?? [:]).merging(.init(values: r.sliderAppearance ?? [:])) }
        if tag == "md-rating" { o.rating = AWCRatingAppearance(values: r.ratingAppearanceDefaults ?? [:]).merging(.init(values: r.ratingAppearance ?? [:])) }
        return o
    }

    // ---- retained updates (source property types; getLabel is a closure, native API only) ----
    private static let spec: [String: String] = [
        "md-slider": "min:n max:n value:n step:n disabled:b name:s nameStart:s nameEnd:s variant:e=standard|centered range:b stops:b valueStart:n valueEnd:n size:e=xs|sm|md|lg|xl orientation:e=horizontal|vertical fullHeight:b valueIndicator:b labeled:b insetIcon:b icon:s sliderAriaLabel:s ariaLabelStart:s ariaLabelEnd:s valueText:s valueStartText:s valueEndText:s controlled:b density:d",
        "md-rating": "value:n defaultValue:n max:n precision:p size:e=xs|sm|md|lg|xl readonly:b disabled:b softDisabled:b icon:s emptyIcon:s outlineEmpty:b showValueLabel:b ratingLabel:s name:s hover:e=preview|off density:d",
    ]
    static let updateTags = Set(spec.keys)
    private static func types(_ tag: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (spec[tag] ?? "").split(separator: " ").map { item in let p = item.split(separator: ":", maxSplits: 1); return (String(p[0]), String(p[1])) })
    }
    private static func text(_ v: AWCValue, _ limit: Int = 4096) -> Bool { if case .string(let s) = v { return s.utf8.count <= limit }; return false }
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        let t = types(tag)
        for (key, value) in patch {
            guard let type = t[key] else { throw AWCSRPreviewError("Unknown \(tag) property: \(key)") }
            let ok: Bool
            switch type {
            case "b": if case .bool = value { ok = true } else { ok = false }
            case "n": if case .number(let n) = value { ok = n.isFinite } else { ok = false }
            case "s": ok = text(value)
            case "d": if case .number(let n) = value { ok = [0, -1, -2, -3, -4].contains(n) } else { ok = false }
            case "p": if case .number(let n) = value { ok = n == 1 || n == 0.5 } else { ok = false }
            default:
                if type.hasPrefix("e="), case .string(let s) = value { ok = type.dropFirst(2).split(separator: "|").contains { $0 == s } } else { ok = false }
            }
            guard ok else { throw AWCSRPreviewError("Invalid \(tag) \(key).") }
        }
    }

    // ---- methods with results ----
    static let methodTags: Set<String> = ["md-rating"]
    static func invoke(tag: String, method: String, arguments: [AWCValue]) throws -> AWCValue? {
        let rating = ratingController
        guard tag == "md-rating", method == "focusRating" else { throw AWCSRPreviewError("Unsupported native method or arguments.") }
        guard arguments.isEmpty else { throw AWCSRPreviewError("focusRating requires no arguments.") }
        guard rating.isConnected else { throw AWCSRPreviewError("The md-rating is not mounted.") }
        rating.focusRating(); return nil
    }
}
// ---- end sr live host ----

// ---- begin stepper live host (fa lab patch: LiveStepper.swift) ----
// md-stepper and md-step in the SwiftUI live host: typed hook defaults + local values, retained property updates with the
// source property types, and next() / prev() / goTo(index) / reset() through AWCStepperController.

struct AWCStepperPreviewError: LocalizedError { let message: String; var errorDescription: String? { message }; init(_ m: String) { message = m } }

/// The stepper / step fields of the configure request (`<key>Defaults` first, the local `<key>` wins — the nearer custom property).
struct AWCStepperPreviewRequest: Decodable {
    var command: String? = nil
    var stepperAppearanceDefaults: [String: AWCValue]? = nil; var stepperAppearance: [String: AWCValue]? = nil
    var stepAppearanceDefaults: [String: AWCValue]? = nil; var stepAppearance: [String: AWCValue]? = nil
}

extension View {
    func awcStepperPreview(_ appearance: AWCStepperAppearance, _ controller: AWCStepperController) -> some View {
        awcStepperAppearance(appearance).awcStepperController(controller)
    }
}

@MainActor enum AWCStepperPreview {
    static var request = AWCStepperPreviewRequest()
    /// The session's md-stepper controller (one configured root per host session).
    static let controller = AWCStepperController()
    /// Called with every request line; only the configure line carries the hooks.
    static func capture(_ data: Data) {
        guard let r = try? JSONDecoder().decode(AWCStepperPreviewRequest.self, from: data), r.command == "configure" else { return }
        request = r
    }
    static func appearance(tag: String) -> AWCStepperAppearance {
        let r = request
        if tag == "md-stepper" { return AWCStepperAppearance(values: r.stepperAppearanceDefaults ?? [:]).merging(.init(values: r.stepperAppearance ?? [:])) }
        if tag == "md-step" { return AWCStepperAppearance(values: r.stepAppearanceDefaults ?? [:]).merging(.init(values: r.stepAppearance ?? [:])) }
        return AWCStepperAppearance()
    }

    // ---- retained updates (source property types) ----
    private static let spec: [String: String] = [
        "md-stepper": "orientation:e=horizontal|vertical indicator:e=numbered|dot variant:e=default|mobile mode:e=linear|non-linear active:i autoComplete:b nav:b readonly:b nextDisabled:b loading:b lazy:b label:s stepWord:s ofWord:s completedWord:s currentWord:s errorWord:s optionalWord:s nextLabel:s backLabel:s finishLabel:s density:d",
        "md-step": "label:s description:s completed:b active:b error:b errorText:s disabled:b optional:b editable:b icon:s completedIcon:s errorIcon:s accessibleName:s hideActions:b density:d",
    ]
    static let updateTags = Set(spec.keys)
    private static func types(_ tag: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (spec[tag] ?? "").split(separator: " ").map { item in let p = item.split(separator: ":", maxSplits: 1); return (String(p[0]), String(p[1])) })
    }
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        let t = types(tag)
        for (key, value) in patch {
            guard let type = t[key] else { throw AWCStepperPreviewError("Unknown \(tag) property: \(key)") }
            let ok: Bool
            switch type {
            case "b": if case .bool = value { ok = true } else { ok = false }
            case "i": if case .number(let n) = value { ok = n >= 0 && n <= 1000 && n == n.rounded() } else { ok = false }
            case "s": if case .string(let s) = value { ok = s.utf8.count <= 4096 } else { ok = false }
            case "d": if case .number(let n) = value { ok = [0, -1, -2, -3, -4].contains(n) } else { ok = false }
            default:
                if type.hasPrefix("e="), case .string(let s) = value { ok = type.dropFirst(2).split(separator: "|").contains { $0 == s } } else { ok = false }
            }
            guard ok else { throw AWCStepperPreviewError("Invalid \(tag) \(key).") }
        }
    }

    // ---- methods with results ----
    static let methodTags: Set<String> = ["md-stepper"]
    static func invoke(tag: String, method: String, arguments: [AWCValue]) throws -> AWCValue? {
        guard tag == "md-stepper", ["next", "prev", "goTo", "reset"].contains(method) else { throw AWCStepperPreviewError("Unsupported native method or arguments.") }
        guard controller.isConnected else { throw AWCStepperPreviewError("The md-stepper is not mounted.") }
        if method == "goTo" {
            guard arguments.count == 1, case .number(let n) = arguments[0], n >= 0, n <= 1000, n == n.rounded() else { throw AWCStepperPreviewError("goTo requires one step index (an integer from 0).") }
            controller.goTo(Int(n)); return nil
        }
        guard arguments.isEmpty else { throw AWCStepperPreviewError("\(method) requires no arguments.") }
        switch method { case "next": controller.next(); case "prev": controller.prev(); default: controller.reset() }
        return nil
    }
}
// ---- end stepper live host ----

// ---- begin navigation live host (nav lab patch: LiveNav.swift) ----
// n5's navigation components in the SwiftUI live host (md-toolbar): typed hook defaults + local values, retained property
// updates with the source property types, and the methods through their controllers.

struct AWCNavPreviewError: LocalizedError { let message: String; var errorDescription: String? { message }; init(_ m: String) { message = m } }

/// The navigation fields of a Laboratory request (`<key>Defaults` first, the local `<key>` wins — the nearer custom property).
struct AWCNavPreviewRequest: Decodable {
    var toolbarAppearanceDefaults: [String: AWCValue]? = nil; var toolbarAppearance: [String: AWCValue]? = nil
}

struct AWCNavPreviewOptions {
    var toolbar = AWCToolbarAppearance()
    let toolbarController: AWCToolbarController
}

extension View {
    func awcNavPreview(_ o: AWCNavPreviewOptions) -> some View {
        awcToolbarAppearance(o.toolbar).awcToolbarController(o.toolbarController)
    }
}

@MainActor enum AWCNavPreview {
    static var request = AWCNavPreviewRequest()
    /// Called with every request line; `configure` reads the fields of its own line.
    static func capture(_ data: Data) { request = (try? JSONDecoder().decode(AWCNavPreviewRequest.self, from: data)) ?? AWCNavPreviewRequest() }

    static func options(tag: String, toolbar: AWCToolbarController) -> AWCNavPreviewOptions {
        var o = AWCNavPreviewOptions(toolbarController: toolbar)
        if tag == "md-toolbar" { o.toolbar = AWCToolbarAppearance(values: request.toolbarAppearanceDefaults ?? [:]).merging(.init(values: request.toolbarAppearance ?? [:])) }
        return o
    }

    // ---- retained updates (the source property types) ----
    private static let spec: [String: String] = [
        "md-toolbar": "variant:e=docked|floating color:e=standard|vibrant layout:e=horizontal|vertical alignment:e=start|center|end|space-between containerSemantics:e=toolbar|generic ariaLabelProp:s ariaLabelledby:s density:d",
    ]
    static let updateTags = Set(spec.keys)
    private static func types(_ tag: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (spec[tag] ?? "").split(separator: " ").map { item in let p = item.split(separator: ":", maxSplits: 1); return (String(p[0]), String(p[1])) })
    }
    private static func text(_ v: AWCValue, _ limit: Int = 4096) -> Bool { if case .string(let s) = v { return s.utf8.count <= limit }; return false }
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        let t = types(tag)
        for (key, value) in patch {
            guard let type = t[key] else { throw AWCNavPreviewError("Unknown \(tag) property: \(key)") }
            let ok: Bool
            switch type {
            case "b": if case .bool = value { ok = true } else { ok = false }
            case "n": if case .number(let n) = value { ok = n.isFinite } else { ok = false }
            case "s": ok = text(value)
            case "d": if case .number(let n) = value { ok = [0, -1, -2, -3, -4].contains(n) } else { ok = false }
            default:
                if type.hasPrefix("e="), case .string(let s) = value { ok = type.dropFirst(2).split(separator: "|").contains { $0 == s } } else { ok = false }
            }
            guard ok else { throw AWCNavPreviewError("Invalid \(tag) \(key).") }
        }
    }

    // ---- methods ----
    static let methodTags: Set<String> = ["md-toolbar"]
    /// setFocus() resolves void on the Web: no result.
    static func invoke(tag: String, method: String, arguments: [AWCValue], toolbar: AWCToolbarController) throws -> AWCValue? {
        switch (tag, method) {
        case ("md-toolbar", "setFocus"):
            guard arguments.isEmpty else { throw AWCNavPreviewError("setFocus requires no arguments.") }
            toolbar.setFocus()
        default: throw AWCNavPreviewError("Unsupported native method or arguments.")
        }
        return nil
    }
}
// ---- end navigation live host ----

// BEGIN generated button-family contract (gate-7 R1-04)
// Generated by work/d4-lab/r104/gen.py from packages/core/custom-elements.json (types) and the native support policy in
// packages/native-compiler/generated/catalog.json (declared set) — gate-7 R1-04. Do not edit by hand; rerun the generator.
/// Retained preview updates of the button family (Laboratory `update` command): types and declared set from the source contract.
enum AWCButtonFamilyPreviewUpdate {
    enum Kind { case boolean, string(nullable: Bool), number(options: Set<Double>?, nullable: Bool), choice(Set<String>) }
    static let contract: [String: [String: Kind]] = [
        "md-button": ["connectedLeft": .boolean, "connectedRight": .boolean, "density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "fullWidth": .boolean, "groupTabindex": .number(options: nil, nullable: true), "href": .string(nullable: false), "icon": .string(nullable: false), "loading": .boolean, "mirrorIcon": .boolean, "ripple": .boolean, "roleOverride": .string(nullable: false), "selected": .boolean, "shape": .choice(["round", "square"]), "shapeMorph": .boolean, "size": .choice(["xs", "sm", "md", "lg", "xl"]), "softDisabled": .boolean, "suppressExpandIconFlip": .boolean, "target": .string(nullable: false), "toggle": .boolean, "trailingIcon": .string(nullable: false), "type": .choice(["button", "submit", "reset"]), "value": .string(nullable: false), "variant": .choice(["filled", "outlined", "text", "elevated", "tonal"])],
        "md-button-group": ["density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "fullWidth": .boolean, "required": .boolean, "selectionMode": .choice(["single-select", "multi-select"]), "shape": .choice(["round", "square"]), "size": .choice(["xs", "sm", "md", "lg", "xl"]), "variant": .choice(["standard", "connected"])],
        "md-fab": ["density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "extended": .boolean, "icon": .string(nullable: false), "label": .string(nullable: false), "lowered": .boolean, "ripple": .boolean, "size": .choice(["standard", "medium", "large"]), "softDisabled": .boolean, "variant": .choice(["surface", "primary-container", "secondary-container", "tertiary-container", "primary", "secondary", "tertiary"])],
        "md-fab-menu": ["anchor": .string(nullable: false), "density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "menuLabel": .string(nullable: false), "open": .boolean, "placement": .choice(["up", "down", "auto"]), "quick": .boolean, "variant": .choice(["primary", "secondary", "tertiary"])],
        "md-fab-menu-item": ["density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "icon": .string(nullable: false), "label": .string(nullable: false), "rovingFocusVisible": .boolean, "softDisabled": .boolean],
        "md-icon-button": ["buttonWidth": .choice(["narrow", "default", "wide"]), "connectedLeft": .boolean, "connectedRight": .boolean, "density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "groupTabindex": .number(options: nil, nullable: true), "href": .string(nullable: false), "icon": .string(nullable: false), "ripple": .boolean, "selected": .boolean, "selectedIcon": .string(nullable: false), "shape": .choice(["round", "square"]), "shapeMorph": .boolean, "size": .choice(["xs", "sm", "md", "lg", "xl"]), "softDisabled": .boolean, "target": .string(nullable: false), "toggle": .boolean, "value": .string(nullable: false), "variant": .choice(["standard", "filled", "outlined", "tonal"])],
        "md-segmented-button": ["density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "icon": .string(nullable: false), "label": .string(nullable: false), "noCheckmark": .boolean, "ripple": .boolean, "segmentDensity": .number(options: nil, nullable: false), "segmentIndex": .number(options: nil, nullable: false), "segmentMultiselect": .boolean, "segmentTotal": .number(options: nil, nullable: false), "selected": .boolean, "softDisabled": .boolean, "value": .string(nullable: false)],
        "md-segmented-button-set": ["density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "multiselect": .boolean],
        "md-split-button": ["controls": .string(nullable: false), "density": .number(options: [0.0, -1.0, -2.0, -3.0, -4.0], nullable: false), "disabled": .boolean, "fullWidth": .boolean, "haspopup": .choice(["menu", "listbox", "dialog", "grid", "tree", "true", "false"]), "icon": .string(nullable: false), "label": .string(nullable: false), "menuLabel": .string(nullable: false), "ripple": .boolean, "size": .choice(["xs", "sm", "md", "lg", "xl"]), "softDisabled": .boolean, "trailingChecked": .boolean, "trailingIcon": .string(nullable: false), "variant": .choice(["elevated", "filled", "tonal", "outlined"])]
    ]
    static let tags = Set(contract.keys)
    static func validate(tag: String, patch: [String: AWCValue]) throws {
        guard let declared = contract[tag] else { throw PreviewFailure("Retained updates are not supported for \(tag).") }
        for (key, value) in patch {
            guard let kind = declared[key] else { throw PreviewFailure("Unknown property for \(tag): \(key)") }
            switch (kind, value) {
            case (.boolean, .bool): continue
            case (.string, .string(let text)) where text.utf8.count <= 4096: continue
            case (.string(nullable: true), .null): continue
            case (.number(let options, _), .number(let n)) where n.isFinite && (options?.contains(n) ?? true): continue
            case (.number(_, nullable: true), .null): continue
            case (.choice(let options), .string(let text)) where options.contains(text): continue
            default: throw PreviewFailure("Invalid \(key) for \(tag).")
            }
        }
    }
}
// END generated button-family contract

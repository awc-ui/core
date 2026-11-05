// iOS stand-ins for the narrow AppKit surface used by the macOS parity fixtures in
// packages/native-ios/Tests. The fixtures are compiled unchanged (after scripts/transform.py)
// into a simulator host app, so the comparison logic, tolerances and oracles stay identical.
// Rendering goes through UIHostingController inside a UIWindow; captures are taken at the
// device scale (2x/3x) and box-averaged by the fixtures' own grid code to CSS pixels.
#if os(iOS)
import UIKit
import SwiftUI
@testable import AWCUI

typealias NSView = UIView
typealias NSColor = UIColor
typealias NSRect = CGRect
typealias NSPoint = CGPoint
typealias NSSize = CGSize

func awcShimPrecondition(_ condition: @autoclosure () -> Bool, _ message: @autoclosure () -> String = "", file: StaticString = #fileID, line: UInt = #line) {
    if !condition() { let m = message(); print("FAIL: precondition: \(m) (\(file):\(line))"); fflush(stdout); Swift.preconditionFailure(m, file: file, line: line) }
}
func awcShimPreconditionFailure(_ message: @autoclosure () -> String = "", file: StaticString = #fileID, line: UInt = #line) -> Never {
    let m = message(); print("FAIL: preconditionFailure: \(m) (\(file):\(line))"); fflush(stdout); Swift.preconditionFailure(m, file: file, line: line)
}

enum AWCShim {
    static let env = ProcessInfo.processInfo.environment
    /// hierarchy: UIView.drawHierarchy (render-server snapshot); layer: CALayer.render(in:);
    /// tile: drawHierarchy of the on-screen window region, translating the stage so every tile is on screen.
    /// The probe (Probe/NativeIOSCaptureProbe.swift) measured hierarchy and tile byte-identical over a
    /// 1200x900 @3x capture, so the faster hierarchy snapshot is the default.
    static var captureMode = env["AWC_IOS_CAPTURE"] ?? "hierarchy"
    static var scale: CGFloat { activeScene?.screen.scale ?? 3 }
    static var activeScene: UIWindowScene? { UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first }
    static var unsupported: [String] = []
    static weak var accessibilityFocused: UIView?
    static func note(_ s: String) { if !unsupported.contains(s) { unsupported.append(s); print("AWC-IOS-UNSUPPORTED: " + s); fflush(stdout) } }
    static func pumpFrames(_ seconds: Double = 0.05) {
        let end = Date().addingTimeInterval(seconds)
        repeat { CATransaction.flush(); _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004)) } while Date() < end
    }
    static func renderer(_ size: CGSize) -> UIGraphicsImageRenderer {
        let f = UIGraphicsImageRendererFormat(); f.scale = scale; f.opaque = true; f.preferredRange = .standard
        return UIGraphicsImageRenderer(size: size, format: f)
    }
    /// Captures `rect` (in `view` coordinates) at device scale.
    /// A time series of captures (a fixture sampling Chrome's capture window every few milliseconds) takes one shot per
    /// display frame and snapshots the committed screen (`afterScreenUpdates: false`). Waiting for a fresh screen update
    /// on every shot blocked the main thread ~20 ms at 3x, so SwiftUI's frame-driven content (TimelineView, animations)
    /// skipped frames and consecutive shots repeated a stale frame 30–50 ms behind its clock (md-button ripple fade,
    /// timelines d54/d60). A shot that follows the previous one within 30 ms with no input event in between is part of a
    /// series: when no display frame has passed since that shot it waits for the next one (and SwiftUI's update for it),
    /// so every frame of the window is rendered and captured once. Any other shot waits for the screen update; if no
    /// display frame has passed since the last input event it first waits for the next frame (SwiftUI applies state an
    /// input set at its next frame update, and Chrome's screenshot after an input includes it: md-card `dragClick
    /// clickPress` at 3x). Waiting before every single shot moved animated content one frame ahead of Chrome (md-button
    /// click2, md-checkbox glyph scale; matrix fi-661). `AWC_IOS_CAPTURE_SERIES=off` restores the update wait on every
    /// shot; `AWC_IOS_CAPTURE_FRESH=0` never waits for a frame, `=1` waits before every single shot.
    nonisolated(unsafe) static var lastCaptureEnd: CFTimeInterval = 0
    nonisolated(unsafe) static var lastCaptureFrame = -1
    nonisolated(unsafe) static var inputSinceCapture = true
    static let seriesCapture = env["AWC_IOS_CAPTURE_SERIES"] != "off"
    static let freshCapture = env["AWC_IOS_CAPTURE_FRESH"] ?? "input"
    nonisolated(unsafe) static var lastInputFrame = -1
    static func capture(_ view: UIView, _ rect: CGRect) -> CGImage? {
        AWCShimFrameClock.start()
        let series = seriesCapture && !inputSinceCapture && CACurrentMediaTime() - lastCaptureEnd < 0.03
        if series && AWCShimFrameClock.frames == lastCaptureFrame { AWCShimFrameClock.waitForFrame() }
        if !series && (freshCapture == "1" || freshCapture == "input" && AWCShimFrameClock.frames == lastInputFrame) { AWCShimFrameClock.waitForFrame() }
        view.layoutIfNeeded(); CATransaction.flush()
        defer { lastCaptureEnd = CACurrentMediaTime(); lastCaptureFrame = AWCShimFrameClock.frames; inputSinceCapture = false }
        switch captureMode {
        case "layer":
            return renderer(rect.size).image { ctx in ctx.cgContext.translateBy(x: -rect.minX, y: -rect.minY); view.layer.render(in: ctx.cgContext) }.cgImage
        case "hierarchy":
            return renderer(rect.size).image { _ in _ = view.drawHierarchy(in: CGRect(x: -rect.minX, y: -rect.minY, width: view.bounds.width, height: view.bounds.height), afterScreenUpdates: !series) }.cgImage
        default:
            return tiled(view, rect)
        }
    }
    /// Translates the window's stage (a pure transform: no layout pass) so each tile of `rect` lies inside
    /// the visible screen, snapshots the window there, and stitches the tiles.
    static func tiled(_ view: UIView, _ rect: CGRect) -> CGImage? {
        guard let window = view.window, let stage = window.rootViewController?.view else { return nil }
        let screen = window.screen.bounds, inWindow = view.convert(rect, to: window)
        let tw = max(1, floor(screen.width) - 2), th = max(1, floor(screen.height) - 2)
        let saved = stage.transform
        let image = renderer(rect.size).image { ctx in
            var y = 0.0
            while y < rect.height {
                var x = 0.0
                while x < rect.width {
                    let piece = CGRect(x: inWindow.minX + x, y: inWindow.minY + y, width: min(tw, rect.width - x), height: min(th, rect.height - y))
                    stage.transform = CGAffineTransform(translationX: -piece.minX + 1, y: -piece.minY + 1)
                    pumpFrames(0.03)
                    let shot = renderer(piece.size).image { _ in _ = window.drawHierarchy(in: CGRect(x: -1, y: -1, width: window.bounds.width, height: window.bounds.height), afterScreenUpdates: true) }
                    shot.draw(in: CGRect(x: x, y: y, width: piece.width, height: piece.height))
                    x += piece.width
                }
                y += min(th, rect.height - y)
            }
            _ = ctx
        }
        stage.transform = saved; pumpFrames(0.03)
        return image.cgImage
    }
}

/// Display-frame counter for series captures (see `AWCShim.capture`).
final class AWCShimFrameClock: NSObject {
    nonisolated(unsafe) static let shared = AWCShimFrameClock()
    nonisolated(unsafe) static var frames = 0
    nonisolated(unsafe) private var link: CADisplayLink?
    @objc private func tick(_ link: CADisplayLink) { AWCShimFrameClock.frames += 1 }
    static func start() {
        guard shared.link == nil else { return }
        MainActor.assumeIsolated { let l = CADisplayLink(target: shared, selector: #selector(tick(_:))); l.add(to: .main, forMode: .common); shared.link = l }
    }
    /// Runs the main loop until the next display frame and SwiftUI's update for it (at most 50 ms).
    static func waitForFrame() {
        let start = frames, limit = CACurrentMediaTime() + 0.05
        while frames == start && CACurrentMediaTime() < limit { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.0005)) }
        _ = RunLoop.current.run(mode: .default, before: Date())
    }
}

/// AppKit's field editor: the UIKit text input that has focus (UITextField / UITextView).
typealias NSTextView = UIResponder & UITextInput

// MARK: - Accessibility
// The macOS fixtures assert AppKit roles. AWCUI's UIKit branch expresses the same ARIA roles as traits
// plus a role hint (radio/checkbox/menu item) — see AWCNativeButtonFocusBridge — so the assertions
// are evaluated against that UIKit mapping.
enum NSAccessibility {
    struct Role: RawRepresentable, Equatable, Hashable { let rawValue: String; init(rawValue: String) { self.rawValue = rawValue }
        static let button = Role(rawValue: "AXButton"), link = Role(rawValue: "AXLink"), checkBox = Role(rawValue: "AXCheckBox"), radioButton = Role(rawValue: "AXRadioButton")
        static let menuItem = Role(rawValue: "AXMenuItem"), group = Role(rawValue: "AXGroup"), staticText = Role(rawValue: "AXStaticText"), image = Role(rawValue: "AXImage"), cell = Role(rawValue: "AXCell"), row = Role(rawValue: "AXRow"), list = Role(rawValue: "AXList")
        static let progressIndicator = Role(rawValue: "AXProgressIndicator"), busyIndicator = Role(rawValue: "AXBusyIndicator"), levelIndicator = Role(rawValue: "AXLevelIndicator"), slider = Role(rawValue: "AXSlider"), scrollArea = Role(rawValue: "AXScrollArea") }
}
extension UIView {
    func accessibilityRole() -> NSAccessibility.Role? {
        // UIKit controls that carry the role themselves (VoiceOver: "progress", "in progress"); a meter has no UIKit role:
        // AWCUI exposes it as a value element (label + formatted value), the way iOS Safari presents a meter.
        if self is UIProgressView { return .progressIndicator }
        if self is UIActivityIndicatorView { return .busyIndicator }
        if self is AWCNativeMeterView { return .levelIndicator }
        if self is UIScrollView { return .scrollArea }
        // UIKit has no help-tag role: AWCUI exposes the visible tooltip popup as a static-text region (and the anchor's hint).
        if self is AWCTooltipRegionView && accessibilityTraits.contains(.staticText) { return NSAccessibility.Role(rawValue: "AXHelpTag") }
        if accessibilityTraits.contains(.adjustable) { return .slider }
        let hint = accessibilityHint ?? ""
        if hint.hasPrefix("Grid cell") { return .cell }
        if hint.hasPrefix("Radio button") { return .radioButton }
        if hint.hasPrefix("Checkbox") { return .checkBox }
        if hint.hasPrefix("Menu item") { return .menuItem }
        if accessibilityTraits.contains(.link) { return .link }
        if accessibilityTraits.contains(.button) { return .button }
        if accessibilityTraits.contains(.image) { return .image }
        if accessibilityTraits.contains(.staticText) { return .staticText }
        return nil
    }
    /// AppKit hitTest takes a point in the superview's coordinates.
    func hitTest(_ p: CGPoint) -> UIView? { hitTest(superview.map { convert(p, from: $0) } ?? p, with: nil) }
    func setAccessibilityIdentifier(_ id: String?) { accessibilityIdentifier = id }
    func setAccessibilityLabel(_ label: String?) { accessibilityLabel = label }
    func isAccessibilitySelected() -> Bool { accessibilityTraits.contains(.selected) }
    func awcShimAccessibilityLabel() -> String? { accessibilityLabel }
    /// UIKit's accessibilityValue is the spoken value (AppKit's value description). For progress roles AppKit's raw value is
    /// the number it states (nil when indeterminate).
    func awcShimAccessibilityValue() -> Any? { self is UIProgressView || self is UIActivityIndicatorView ? accessibilityValue.flatMap { Double($0) } : accessibilityValue }
    func awcShimAccessibilityHelp() -> String? { accessibilityHint }
    /// AWC's UIKit branch carries the AppKit role description in the hint (e.g. "Menu button", "Checkbox").
    func awcShimAccessibilityRoleDescription() -> String? { accessibilityHint }
    func awcShimAccessibilityCustomActions() -> [UIAccessibilityCustomAction]? { accessibilityCustomActions }
    func awcShimIsAccessibilityElement() -> Bool { isAccessibilityElement }
    func accessibilityPerformPress() -> Bool { accessibilityActivate() }
    func isAccessibilityExpanded() -> Bool { accessibilityValue == "Expanded" }
    func isAccessibilityFocused() -> Bool { isFirstResponder || AWCShim.accessibilityFocused === self }
    /// Assistive-technology focus: UIKit tells the element through `accessibilityElementDidBecomeFocused` (VoiceOver cursor).
    func setAccessibilityFocused(_ value: Bool) {
        if value { AWCShim.accessibilityFocused?.accessibilityElementDidLoseFocus(); AWCShim.accessibilityFocused = self; accessibilityElementDidBecomeFocused() }
        else if AWCShim.accessibilityFocused === self { AWCShim.accessibilityFocused = nil; accessibilityElementDidLoseFocus() }
    }
    func accessibilityValueDescription() -> String? { accessibilityValue }
    func accessibilityColumnIndexRange() -> NSRange { (self as? UIAccessibilityContainerDataTableCell)?.accessibilityColumnRange() ?? NSRange(location: NSNotFound, length: 0) }
    func accessibilityChildren() -> [Any]? { accessibilityElements }
    /// AppKit linked elements (aria-controls): AWCUI's UIKit branch exposes the controlled, mounted target as a VoiceOver
    /// custom action that moves focus to it (`AWCNativeButtonFocusBridge`), so the linked elements are those actions.
    func accessibilityLinkedUIElements() -> [Any]? { accessibilityCustomActions.flatMap { $0.isEmpty ? nil : $0 } }
    func isAccessibilityEnabled() -> Bool { !accessibilityTraits.contains(.notEnabled) }
    func accessibilityRowIndexRange() -> NSRange { (self as? UIAccessibilityContainerDataTableCell)?.accessibilityRowRange() ?? NSRange(location: NSNotFound, length: 0) }
}

// MARK: - Key-view loop
// AppKit `acceptsFirstResponder` / `canBecomeKeyView` / `selectNextKeyView` map to AWCUI's UIKit key-view surface
// (`AWCKeyView`, `AWCKeyViewLoop` in NativeKeyViewLoop.swift) — the same code a hardware Tab runs through the key commands.
extension UIView {
    var acceptsFirstResponder: Bool { (self as? any AWCKeyView)?.awcAcceptsFirstResponder ?? canBecomeFirstResponder }
    var canBecomeKeyView: Bool { (self as? any AWCKeyView)?.awcCanBecomeKeyView ?? false }
}
extension UIWindow {
    func selectNextKeyView(_ sender: Any?) { awcShimKeyDebug("next"); AWCKeyViewLoop.select(from: firstResponder as? UIView, in: self, backward: false) }
    func selectPreviousKeyView(_ sender: Any?) { awcShimKeyDebug("previous"); AWCKeyViewLoop.select(from: firstResponder as? UIView, in: self, backward: true) }
    func awcShimKeyDebug(_ what: String) {
        guard AWCShim.env["AWC_IOS_KEY_DEBUG"] == "1" else { return }
        let order = AWCKeyViewLoop.views(in: self).map { "\($0.accessibilityIdentifier ?? "?")\($0.awcCanBecomeKeyView ? "+" : "-")\($0.isFirstResponder ? "*" : "")" }
        print("KEYDBG \(what) from \((firstResponder as? UIView)?.accessibilityIdentifier ?? "nil"): \(order.joined(separator: " "))"); fflush(stdout)
    }
}

extension UIColor {
    /// UIKit colors are extended sRGB; the fixtures read components in sRGB.
    func usingColorSpace(_ space: NSColorSpace) -> UIColor? { self }
    private var awcShimComponents: (CGFloat, CGFloat, CGFloat, CGFloat) { var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0; resolvedColor(with: UITraitCollection(userInterfaceStyle: .light)).getRed(&r, green: &g, blue: &b, alpha: &a); return (r, g, b, a) }
    var redComponent: CGFloat { awcShimComponents.0 }
    var greenComponent: CGFloat { awcShimComponents.1 }
    var blueComponent: CGFloat { awcShimComponents.2 }
    var alphaComponent: CGFloat { awcShimComponents.3 }
    static var labelColor: UIColor { .label }
    static var textColor: UIColor { .label }
    static var secondaryLabelColor: UIColor { .secondaryLabel }
    static var windowBackgroundColor: UIColor { .systemBackground }
}
/// AppKit appearances map to the UIKit traits SwiftUI reads (colorScheme, colorSchemeContrast).
final class NSAppearance {
    struct Name: Equatable { let raw: String; static let aqua = Name(raw: "aqua"), darkAqua = Name(raw: "darkAqua"), accessibilityHighContrastAqua = Name(raw: "hcAqua"), accessibilityHighContrastDarkAqua = Name(raw: "hcDarkAqua") }
    let name: Name
    init?(named name: Name) { self.name = name }
    var style: UIUserInterfaceStyle { name == .darkAqua || name == .accessibilityHighContrastDarkAqua ? .dark : .light }
    var contrast: UIAccessibilityContrast { name == .accessibilityHighContrastAqua || name == .accessibilityHighContrastDarkAqua ? .high : .normal }
}
let NSUpArrowFunctionKey = 0xF700, NSDownArrowFunctionKey = 0xF701, NSLeftArrowFunctionKey = 0xF702, NSRightArrowFunctionKey = 0xF703
let NSDeleteFunctionKey = 0xF728, NSHomeFunctionKey = 0xF729, NSEndFunctionKey = 0xF72B, NSPageUpFunctionKey = 0xF72C, NSPageDownFunctionKey = 0xF72D

// MARK: - Text input
// AppKit field editing maps to the UIKit field SwiftUI renders: a text change is a UITextField edit (editingChanged +
// textDidChange, what typing produces), and the field editor's insertNewline: is a real Return key press.
typealias NSTextField = UITextField
typealias NSTextInputClient = UITextInput
enum NSControl { static let textDidChangeNotification = UITextField.textDidChangeNotification }
extension UITextField {
    var stringValue: String { get { text ?? "" } set { text = newValue } }
    func selectText(_ sender: Any?) { _ = becomeFirstResponder(); selectedTextRange = textRange(from: beginningOfDocument, to: endOfDocument); AWCShim.pumpFrames(0.02) }
}
extension UITextFieldDelegate {
    var controlTextDidChange: ((Notification) -> Void)? {
        { note in guard let field = note.object as? UITextField else { return }
            field.sendActions(for: .editingChanged); NotificationCenter.default.post(name: UITextField.textDidChangeNotification, object: field) }
    }
}
extension UITextInput {
    func doCommand(by selector: Selector) {
        guard selector == NSSelectorFromString("insertNewline:") else { AWCShim.note("text command \(selector)"); return }
        AWCShimTouch.dispatch(NSEvent(type: .keyDown, location: .zero, flags: [], timestamp: 0, characters: "\r", ignoring: "\r", keyCode: 36))
    }
}

// MARK: - Scroll views
typealias NSScrollView = UIScrollView
/// AppKit's clip view is the scroll view's visible rect: bounds origin = content offset.
final class NSClipView {
    unowned let scroll: UIScrollView
    init(_ scroll: UIScrollView) { self.scroll = scroll }
    var bounds: CGRect { CGRect(origin: scroll.contentOffset, size: scroll.bounds.size) }
    func scroll(to p: CGPoint) { scroll.contentOffset = p }
    func setBoundsSize(_ s: CGSize) { scroll.bounds = CGRect(origin: scroll.contentOffset, size: s) }
}
extension UIScrollView {
    var contentView: NSClipView { NSClipView(self) }
    func reflectScrolledClipView(_ clip: NSClipView) {}
    /// The document is the scroll view's content: SwiftUI's hosted content view, or the view a fixture installs.
    var documentView: UIView? {
        get { subviews.filter { !($0 is AWCShimScrollIndicatorMarker) && $0.bounds.height > 0 && String(describing: type(of: $0)) != "_UIScrollViewScrollIndicator" }.max { $0.frame.height < $1.frame.height } }
        set { if let v = newValue { addSubview(v); contentSize = v.frame.size } }
    }
    var hasHorizontalScroller: Bool { contentSize.width > bounds.width + 0.5 }
}
private final class AWCShimScrollIndicatorMarker: UIView {}
extension UIView {
    var enclosingScrollView: UIScrollView? { var v = superview; while let s = v { if let scroll = s as? UIScrollView { return scroll }; v = s.superview }; return nil }
}
extension AWCAccordionScrollFocusView {
    /// AppKit detaches its clip-view observer explicitly; UIKit's KVO observations end with the view.
    func disconnect() {}
}

final class NSColorSpace { static let sRGB = NSColorSpace(); static let displayP3 = NSColorSpace(); static let deviceRGB = NSColorSpace(); static let genericRGB = NSColorSpace() }

extension UIView {
    var isFlipped: Bool { true }
    func layoutSubtreeIfNeeded() { layoutIfNeeded(); for v in subviews { v.layoutIfNeeded() } }
    func displayIfNeeded() { layer.displayIfNeeded(); CATransaction.flush() }
    @objc func awcShimAccessibilityIdentifier() -> String { accessibilityIdentifier ?? "" }
    func bitmapImageRepForCachingDisplay(in rect: CGRect) -> NSBitmapImageRep? { NSBitmapImageRep(pendingRect: rect) }
    func cacheDisplay(in rect: CGRect, to rep: NSBitmapImageRep) { rep.cgImage = AWCShim.capture(self, rect) }
}

protocol AWCShimHosting: UIView { var shimController: UIViewController { get } }

/// Host-level environment the fixtures' content gets on iOS:
/// - AWCUI's document-level Tab entry (`AWCKeyViewEntryModifier`), exactly as the public `AWCNativeView` installs it,
///   because fixtures also host internal component views directly (AppKit windows provide that entry themselves);
/// - AppKit text-input behaviour for authored text fields: no auto-capitalization or auto-correction (UIKit applies both
///   to hardware-keyboard input by default; NSTextField never does), since fixtures compare exact typed text.
struct AWCShimHostModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.modifier(AWCKeyViewEntryModifier()).textInputAutocapitalization(.never).autocorrectionDisabled(true)
    }
}
final class NSHostingView<Content: View>: UIView, AWCShimHosting {
    let controller: UIHostingController<ModifiedContent<Content, AWCShimHostModifier>>
    var shimController: UIViewController { controller }
    var rootView: Content { get { controller.rootView.content } set { controller.rootView = newValue.modifier(AWCShimHostModifier()) } }
    required init(rootView: Content) {
        controller = UIHostingController(rootView: rootView.modifier(AWCShimHostModifier()))
        super.init(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        controller.safeAreaRegions = []
        controller.view.backgroundColor = .clear
        controller.view.frame = bounds; controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(controller.view)
    }
    required init?(coder: NSCoder) { fatalError("unused") }
    var fittingSize: CGSize { controller.sizeThatFits(in: CGSize(width: CGFloat.infinity, height: .infinity)) }
    var appearance: NSAppearance? {
        didSet {
            controller.traitOverrides.userInterfaceStyle = appearance?.style ?? .light
            controller.traitOverrides.accessibilityContrast = appearance?.contrast ?? .normal
        }
    }
}

final class NSBitmapImageRep {
    enum FileType { case png, jpeg, tiff }
    struct PropertyKey: Hashable { let raw: String }
    var cgImage: CGImage? { didSet { cachedBytes = nil } }
    let rect: CGRect
    private var cachedBytes: [UInt8]?
    init(cgImage: CGImage) { self.cgImage = cgImage; rect = CGRect(x: 0, y: 0, width: cgImage.width, height: cgImage.height) }
    init(pendingRect: CGRect) { rect = pendingRect }
    /// Like AppKit's `bitmapImageRepForCachingDisplay`, a pending rep already has its pixel dimensions (rect × backing scale).
    var pixelsWide: Int { cgImage?.width ?? Int((rect.width * AWCShim.scale).rounded()) }
    var pixelsHigh: Int { cgImage?.height ?? Int((rect.height * AWCShim.scale).rounded()) }
    var size: CGSize { rect.size }
    var bytesPerRow: Int { pixelsWide * 4 }
    var samplesPerPixel: Int { 4 }
    var bitsPerPixel: Int { 32 }
    /// RGBA8 premultiplied, sRGB (the layout NSBitmapImageRep produces for cacheDisplay).
    var bitmapData: UnsafeMutablePointer<UInt8>? {
        if cachedBytes == nil, let cg = cgImage {
            var b = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
            b.withUnsafeMutableBytes { raw in
                let ctx = CGContext(data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                ctx.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
            }
            cachedBytes = b
        }
        return cachedBytes?.withUnsafeMutableBufferPointer { $0.baseAddress }
    }
    func representation(using type: FileType, properties: [PropertyKey: Any]) -> Data? { cgImage.flatMap { UIImage(cgImage: $0).pngData() } }
    func colorAt(x: Int, y: Int) -> NSColor? {
        guard let p = bitmapData, x >= 0, y >= 0, x < pixelsWide, y < pixelsHigh else { return nil }
        let i = (y * pixelsWide + x) * 4, a = Double(p[i + 3]) / 255
        func c(_ v: UInt8) -> CGFloat { a > 0 ? CGFloat(Double(v) / 255 / a) : 0 }
        return UIColor(red: c(p[i]), green: c(p[i + 1]), blue: c(p[i + 2]), alpha: CGFloat(a))
    }
}

final class NSImage {
    let image: UIImage
    init?(contentsOf url: URL) { guard let i = UIImage(contentsOfFile: url.path) else { return nil }; image = i }
    init?(contentsOfFile path: String) { guard let i = UIImage(contentsOfFile: path) else { return nil }; image = i }
    init(cgImage: CGImage, size: CGSize) { image = UIImage(cgImage: cgImage) }
    var size: CGSize { image.size }
    func cgImage(forProposedRect rect: UnsafeMutablePointer<CGRect>?, context: Any?, hints: [AnyHashable: Any]?) -> CGImage? { image.cgImage }
}

final class NSApplication {
    static let shared = NSApplication()
    enum ActivationPolicy { case regular, accessory, prohibited }
    @discardableResult func setActivationPolicy(_ p: ActivationPolicy) -> Bool { true }
    func activate(ignoringOtherApps: Bool) {}
    func activate() {}
    /// AppKit's event queue: posted events wait until the fixture's pump dequeues them (`nextEvent`), as on macOS — fixtures
    /// post a mouse-up and then send the matching mouse-down synchronously, so delivering on post would invert the click.
    var queued: [NSEvent] = []
    func nextEvent(matching mask: NSEvent.EventTypeMask, until date: Date?, inMode mode: RunLoop.Mode, dequeue: Bool) -> NSEvent? {
        guard !queued.isEmpty else { return nil }
        return dequeue ? queued.removeFirst() : queued.first
    }
    func sendEvent(_ event: NSEvent) { AWCShimTouch.dispatch(event) }
    func postEvent(_ event: NSEvent, atStart: Bool) { if atStart { queued.insert(event, at: 0) } else { queued.append(event) } }
    var keyWindow: NSWindow? { AWCShimTouch.window }
    var windows: [UIWindow] { AWCShim.activeScene?.windows ?? [] }
    func run() {}
    func finishLaunching() {}
    func terminate(_ sender: Any?) { exit(0) }
}
let NSApp = NSApplication.shared

extension RunLoop.Mode { static let eventTracking = RunLoop.Mode("NSEventTrackingRunLoopMode"); static let modalPanel = RunLoop.Mode("NSModalPanelRunLoopMode") }

class NSWindow: UIWindow {
    struct StyleMask: OptionSet { let rawValue: UInt; static let borderless = StyleMask([]); static let titled = StyleMask(rawValue: 1); static let closable = StyleMask(rawValue: 2); static let miniaturizable = StyleMask(rawValue: 4); static let resizable = StyleMask(rawValue: 8); static let fullSizeContentView = StyleMask(rawValue: 1 << 15) }
    enum BackingStoreType { case buffered, retained, nonretained }
    var isReleasedWhenClosed = false
    var colorSpace: NSColorSpace?
    var acceptsMouseMovedEvents = false
    var title = ""
    let shimRoot = UIViewController()
    var contentView: UIView? {
        didSet {
            if let old = oldValue, old !== contentView {
                // UIHostingController can still deliver a last preference update after removal; flush it first so a stale
                // report from the outgoing content cannot land after the incoming content's (AppKit removal is synchronous).
                old.layoutIfNeeded(); AWCShim.pumpFrames(0.02)
                (old as? AWCShimHosting)?.shimController.removeFromParent(); old.removeFromSuperview(); AWCShim.pumpFrames(0.02)
            }
            guard let v = contentView else { return }
            if let h = v as? AWCShimHosting { shimRoot.addChild(h.shimController) }
            v.frame = shimRoot.view.bounds; v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            shimRoot.view.addSubview(v)
            (v as? AWCShimHosting)?.shimController.didMove(toParent: shimRoot)
        }
    }
    convenience init(contentRect: CGRect, styleMask: StyleMask, backing: BackingStoreType, defer flag: Bool) {
        if let scene = AWCShim.activeScene { self.init(windowScene: scene) } else { self.init(frame: .zero) }
        frame = CGRect(origin: .zero, size: contentRect.size)
        shimRoot.view.backgroundColor = .white
        rootViewController = shimRoot
        shimRoot.view.frame = bounds
        overrideUserInterfaceStyle = .light
        AWCShimTouch.window = self
    }
    /// AppKit displays an ordered-front window synchronously; UIKit presents it at a later scene update, and on iOS 18
    /// the hosted platform views of a window's first content mount frames later. The first order-front waits longer.
    private var awcShimPresented = false
    func orderFrontRegardless() { makeKeyAndVisible(); AWCShim.pumpFrames(awcShimPresented ? 0.05 : 0.3); awcShimPresented = true }
    func makeKeyAndOrderFront(_ sender: Any?) { orderFrontRegardless() }
    /// AppKit key/main eligibility (fixtures subclass NSWindow to allow a borderless key window); UIKit has no main window.
    var canBecomeMain: Bool { true }
    func orderOut(_ sender: Any?) { isHidden = true }
    /// AppKit can order a window behind others; UIKit renders and delivers keys only to the key window.
    func orderBack(_ sender: Any?) { orderFrontRegardless() }
    /// The fixtures park windows off screen; the simulator window always sits at the screen origin.
    func setFrameOrigin(_ p: CGPoint) {}
    func close() { isHidden = true }
    func setContentSize(_ size: CGSize) { frame.size = size; shimRoot.view.frame = bounds }
    func setFrame(_ r: CGRect, display: Bool) { frame = CGRect(origin: .zero, size: r.size); shimRoot.view.frame = bounds }
    var contentLayoutRect: CGRect { bounds }
    /// Counts the touch / press events UIKit delivers, so a synthesized event can be awaited like AppKit's
    /// synchronous sendEvent (otherwise UIKit coalesces consecutive moves into one).
    override func sendEvent(_ event: UIEvent) {
        if event.type == .touches { AWCShimTouch.deliveredTouches += 1 } else if event.type == .presses { AWCShimTouch.deliveredPresses += 1 }
        super.sendEvent(event)
    }
    var windowNumber: Int { 1 }
    var backingScaleFactor: CGFloat { screen.scale }
}

extension UIWindow {
    private static var firstResponderBox: UIResponder?
    var firstResponder: UIResponder? {
        UIWindow.firstResponderBox = nil
        UIApplication.shared.sendAction(#selector(UIResponder.awcShimCaptureFirstResponder), to: nil, from: nil, for: nil)
        return UIWindow.firstResponderBox
    }
    static func setFirstResponderBox(_ r: UIResponder) { firstResponderBox = r }
    @discardableResult func makeFirstResponder(_ r: UIResponder?) -> Bool {
        guard let r else { if let f = firstResponder { _ = f.resignFirstResponder() }; endEditing(true); return true }
        return r.becomeFirstResponder()
    }
}
extension UIResponder { @objc func awcShimCaptureFirstResponder() { UIWindow.setFirstResponderBox(self) } }
#endif

#if os(iOS)
// MARK: - Events
// UIKit has no public API to inject touches or key presses into the running app. Mouse events the
// fixtures synthesize are forwarded to the XCUITest touch bus (UITests/TouchBusUITests.swift) when the
// app was launched by it (AWC_IOS_TOUCH_BUS set); otherwise they are recorded as unsupported and dropped.
final class NSEvent {
    enum EventType { case leftMouseDown, leftMouseUp, leftMouseDragged, mouseMoved, rightMouseDown, rightMouseUp, rightMouseDragged, otherMouseDown, otherMouseUp, otherMouseDragged, mouseEntered, mouseExited, keyDown, keyUp, flagsChanged, scrollWheel, applicationDefined }
    struct EventTypeMask: OptionSet { let rawValue: UInt64; static let any = EventTypeMask(rawValue: .max); static let leftMouseDown = EventTypeMask(rawValue: 2); static let leftMouseUp = EventTypeMask(rawValue: 4); static let leftMouseDragged = EventTypeMask(rawValue: 1 << 6); static let keyDown = EventTypeMask(rawValue: 1 << 10) }
    struct ModifierFlags: OptionSet, Hashable { let rawValue: UInt; static let capsLock = ModifierFlags(rawValue: 1 << 16); static let shift = ModifierFlags(rawValue: 1 << 17); static let control = ModifierFlags(rawValue: 1 << 18); static let option = ModifierFlags(rawValue: 1 << 19); static let command = ModifierFlags(rawValue: 1 << 20); static let numericPad = ModifierFlags(rawValue: 1 << 21); static let function = ModifierFlags(rawValue: 1 << 23) }
    let type: EventType, locationInWindow: CGPoint, modifierFlags: ModifierFlags, timestamp: TimeInterval
    let characters: String?, charactersIgnoringModifiers: String?, keyCode: UInt16, clickCount: Int, pressure: Float, isARepeat: Bool
    var deltaX: CGFloat = 0, deltaY: CGFloat = 0, scrollingDeltaX: CGFloat = 0, scrollingDeltaY: CGFloat = 0
    var window: NSWindow? { AWCShimTouch.window }
    init(type: EventType, location: CGPoint, flags: ModifierFlags, timestamp: TimeInterval, characters: String? = nil, ignoring: String? = nil, keyCode: UInt16 = 0, clickCount: Int = 0, pressure: Float = 0, isARepeat: Bool = false) {
        self.type = type; locationInWindow = location; modifierFlags = flags; self.timestamp = timestamp; self.characters = characters; charactersIgnoringModifiers = ignoring; self.keyCode = keyCode; self.clickCount = clickCount; self.pressure = pressure; self.isARepeat = isARepeat
    }
    static func mouseEvent(with type: EventType, location: CGPoint, modifierFlags: ModifierFlags, timestamp: TimeInterval, windowNumber: Int, context: Any?, eventNumber: Int, clickCount: Int, pressure: Float) -> NSEvent? {
        NSEvent(type: type, location: location, flags: modifierFlags, timestamp: timestamp, clickCount: clickCount, pressure: pressure)
    }
    static func keyEvent(with type: EventType, location: CGPoint, modifierFlags: ModifierFlags, timestamp: TimeInterval, windowNumber: Int, context: Any?, characters: String, charactersIgnoringModifiers: String, isARepeat: Bool, keyCode: UInt16) -> NSEvent? {
        NSEvent(type: type, location: location, flags: modifierFlags, timestamp: timestamp, characters: characters, ignoring: charactersIgnoringModifiers, keyCode: keyCode, isARepeat: isARepeat)
    }
    static var modifierFlags: ModifierFlags { [] }
    static var pressedMouseButtons: Int { AWCShimTouch.down ? 1 : 0 }
    static var mouseLocation: CGPoint { AWCShimTouch.last }
}

enum AWCShimTouch {
    static weak var window: NSWindow?
    static var down = false, last = CGPoint.zero
    static var deliveredTouches = 0, deliveredPresses = 0
    static var lastTouchPoint: CGPoint?
    static var zeroMoveSign: CGFloat = -1
    static var pressStart: Double?
    static var movedSinceBegan = false
    static func awaitDelivery(_ counter: () -> Int, from start: Int, timeout: Double = 0.1) {
        let end = Date().addingTimeInterval(timeout)
        while counter() == start && Date() < end { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.001)) }
    }
    static var bus: String? { AWCShim.env["AWC_IOS_TOUCH_BUS"] }
    static var sequence = 0
    /// Window-space (y-down) point → screen points for XCUITest.
    static func screenPoint(_ p: CGPoint) -> CGPoint { guard let w = window else { return p }; return w.convert(p, to: w.screen.coordinateSpace) }
    static func dispatch(_ e: NSEvent) {
        AWCShim.inputSinceCapture = true; AWCShim.lastInputFrame = AWCShimFrameClock.frames
        switch e.type {
        case .leftMouseDown: down = true; last = e.locationInWindow; send("down", e.locationInWindow)
        case .leftMouseDragged: last = e.locationInWindow; send("move", e.locationInWindow)
        case .leftMouseUp: down = false; last = e.locationInWindow; send("up", e.locationInWindow)
        case .mouseMoved, .mouseEntered, .mouseExited: last = e.locationInWindow; AWCShim.note("pointer hover (no hover on touch devices)")
        case .keyDown, .keyUp: key(e)
        case .flagsChanged: break
        default: AWCShim.note("event \(e.type)")
        }
    }
    static var heldKeys: Set<UInt32> = []
    /// Hardware keys go through the HID queue. A keyDown the fixture never releases is released before the
    /// next key or touch (AppKit delivers a lone keyDown without holding the key; a held HID key would repeat).
    static func key(_ e: NSEvent) {
        guard let w = window, AWCTouchSynth.keyAvailable, let usage = AWCTouchSynth.usageForMacKeyCode[e.keyCode] else { AWCShim.note("key \(e.keyCode) (no HID mapping)"); return }
        let mods: [(NSEvent.ModifierFlags, UInt32)] = [(.shift, 225), (.control, 224), (.option, 226), (.command, 227)]
        if e.type == .keyDown {
            if e.keyCode == 48 { w.awcShimKeyDebug(e.modifierFlags.contains(.shift) ? "shift-tab-key" : "tab-key") }
            releaseKeys()
            for (flag, u) in mods where e.modifierFlags.contains(flag) { AWCTouchSynth.key(usage: u, down: true, window: w); heldKeys.insert(u) }
            let before = deliveredPresses
            AWCTouchSynth.key(usage: usage, down: true, window: w); heldKeys.insert(usage)
            awaitDelivery({ deliveredPresses }, from: before, timeout: 0.03)
            if e.keyCode == 48, AWCShim.env["AWC_IOS_KEY_DEBUG"] == "1" { AWCShim.pumpFrames(0.02); print("KEYDBG after: \((w.firstResponder as? UIView).map { "\(type(of: $0)) \($0.accessibilityIdentifier ?? "")" } ?? "nil")"); fflush(stdout) }
            if AWCShim.env["AWC_IOS_KEY_HOLD"] != "1" { releaseKeys() }
        } else if heldKeys.contains(usage) { AWCTouchSynth.key(usage: usage, down: false, window: w); heldKeys.remove(usage); releaseKeys() }
    }
    static func releaseKeys() { guard let w = window else { return }; for u in heldKeys.sorted(by: >) { AWCTouchSynth.key(usage: u, down: false, window: w) }; heldKeys = [] }
    /// The HID path clips touches to the display. When a gesture starts off screen the window itself is moved (its
    /// origin only: no layout, and window coordinates — SwiftUI's global space — stay exactly what the fixture uses) so
    /// the touch lands on screen; the window returns at touch up. (Translating the content instead moved the content
    /// away from its own global geometry, which components compare touch locations with.)
    static var shifted = false
    static var savedOrigin = CGPoint.zero
    static func onScreen(_ phase: String, _ p: CGPoint) -> CGPoint {
        guard let w = window else { return p }
        let screen = w.screen.bounds.insetBy(dx: 2, dy: 2)
        if phase == "down" {
            let s = w.convert(p, to: w.screen.coordinateSpace)
            if !screen.contains(s) {
                let target = CGPoint(x: min(max(s.x, screen.minX + screen.width / 2), screen.maxX - 40), y: min(max(s.y, screen.minY), screen.maxY - 40))
                if !shifted { savedOrigin = w.frame.origin }
                w.frame.origin = CGPoint(x: w.frame.origin.x + target.x - s.x, y: w.frame.origin.y + target.y - s.y)
                shifted = true; AWCShim.note("touch outside the screen: window moved for the gesture"); AWCShim.pumpFrames(0.02)
            }
        }
        return p
    }
    /// Touch bus protocol (files in AWC_IOS_TOUCH_BUS): the app appends `<seq> <phase> <x> <y>` to
    /// request.txt; the XCUITest runner performs the phase and appends `<seq>` to ack.txt.
    static func send(_ phase: String, _ p: CGPoint) {
        if bus == nil, AWCShim.env["AWC_IOS_TOUCH"] != "off", let w = window {
            releaseKeys()
            let ph: UITouch.Phase = phase == "down" ? .began : phase == "up" ? .ended : .moved
            var q = AWCTouchSynth.mode == "hid" ? onScreen(phase, p) : p
            if AWCShim.env["AWC_IOS_TOUCH_DEBUG"] == "1" {
                let hit = w.hitTest(q, with: nil), sp = w.convert(q, to: w.screen.coordinateSpace)
                print("TOUCHDBG \(phase) window \(p) -> \(q) screen \(sp) hit \(hit.map { "\(type(of: $0)) \($0.accessibilityIdentifier ?? "")" } ?? "nil") stage \(w.rootViewController?.view.transform ?? .identity)"); fflush(stdout)
            }
            // UIKit delivers no touch-moved without a location change (AppKit delivers every mouseDragged, Chrome a
            // pointermove): the closest realizable touch is a sub-pixel move (digitizer jitter) of 0.009 pt (the smallest delivered move measured with Probe/NativeIOSMoveProbe is below 0.01 pt), alternating in
            // direction so repeats do not drift; the tightest fixture tolerance (event and panel coordinates) is 0.01.
            if ph == .moved, let previous = lastTouchPoint, abs(previous.x - q.x) < 0.0005 && abs(previous.y - q.y) < 0.0005 {
                // A touch that has not moved since it began (a click's mouseDragged at the press point) gains nothing from
                // the nudge — AppKit's same-point mouseDragged changes no gesture value — but UIKit dispatches one phase of a
                // touch per frame, so the extra move would delay the release (and the click) by a frame.
                guard movedSinceBegan else { AWCShim.note("zero-distance touch move of a stationary press skipped (no-op; UIKit would spend a frame on it)"); return }
                zeroMoveSign = -zeroMoveSign; q = CGPoint(x: previous.x + 0.009 * zeroMoveSign, y: previous.y)
                AWCShim.note("zero-distance touch move delivered as a 0.009 pt move (UIKit drops unchanged locations)")
            } else if ph == .moved { movedSinceBegan = true }
            if ph == .began { movedSinceBegan = false }
            lastTouchPoint = ph == .ended ? nil : q
            let before = deliveredTouches
            if AWCTouchSynth.send(ph, at: q, in: w) {
                // Moves are awaited so UIKit cannot coalesce consecutive moves (AppKit delivers each). A press is not:
                // a press and its release sent together (a click) reach UIKit in the same frame and land in one
                // UIKit/SwiftUI update, as Chrome and AppKit process a click (no :active frame). Every release is
                // awaited like AppKit's synchronous sendEvent, so its effects (click, selection) precede whatever the
                // fixture does or samples next; otherwise the fixture's own pointer model (hover, "up"), which changes
                // at once, was rendered and sampled a frame ahead of the click (md-list single select: the previous
                // row unhovered but still selected for one frame).
                if ph == .began { pressStart = CACurrentMediaTime() }
                if ph == .moved || ph == .ended { awaitDelivery({ deliveredTouches }, from: before, timeout: 0.03) }
                if ph == .ended { pressStart = nil }
                if phase == "up" && shifted { AWCShim.pumpFrames(0.02); w.frame.origin = savedOrigin; shifted = false }
                return
            }
        }
        guard let bus else { AWCShim.note("touch \(phase) (in-process synthesis unavailable and no XCUITest touch bus)"); return }
        sequence += 1
        let s = screenPoint(p), line = "\(sequence) \(phase) \(s.x) \(s.y)\n"
        let req = URL(fileURLWithPath: bus).appendingPathComponent("request.txt")
        if let h = try? FileHandle(forWritingTo: req) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); try? h.close() } else { try? line.write(to: req, atomically: false, encoding: .utf8) }
        let ack = URL(fileURLWithPath: bus).appendingPathComponent("ack.txt"), deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            if let text = try? String(contentsOf: ack, encoding: .utf8), text.split(separator: "\n").contains(where: { $0 == "\(sequence)" }) { break }
            _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.004))
        }
    }
}

extension UIWindow {
    func sendEvent(_ event: NSEvent) { AWCShimTouch.dispatch(event) }
    func postEvent(_ event: NSEvent, atStart: Bool) { NSApp.postEvent(event, atStart: atStart) }
}
extension UIView {
    func mouseDown(with e: NSEvent) { AWCShimTouch.dispatch(e) }
    func mouseDragged(with e: NSEvent) { AWCShimTouch.dispatch(e) }
    func mouseUp(with e: NSEvent) { AWCShimTouch.dispatch(e) }
    func mouseMoved(with e: NSEvent) { AWCShimTouch.dispatch(e) }
    func keyDown(with e: NSEvent) { AWCShimTouch.dispatch(e) }
}
#endif

// In-process touch injection for the simulator harness (KIF technique): a UITouch with private
// state plus an IOHIDEvent digitizer record is attached to the application's touches event and sent
// through UIApplication.sendEvent, so UIKit gesture recognizers, SwiftUI gestures and touchesBegan/
// Moved/Ended overrides all receive it. Private SPI: harness-only, never linked into AWCUI.
#if os(iOS)
import UIKit
import Darwin

enum AWCTouchSynth {
    private static let iokit = dlopen("/System/Library/Frameworks/IOKit.framework/IOKit", RTLD_NOW)
    private typealias HandFn = @convention(c) (CFAllocator?, UInt64, UInt32, UInt32, UInt32, UInt32, UInt32, Double, Double, Double, Double, Double, Bool, Bool, UInt32) -> Unmanaged<AnyObject>?
    private typealias FingerFn = @convention(c) (CFAllocator?, UInt64, UInt32, UInt32, UInt32, Double, Double, Double, Double, Double, Bool, Bool, UInt32) -> Unmanaged<AnyObject>?
    private typealias SetIntFn = @convention(c) (AnyObject, UInt32, Int, UInt32) -> Void
    private typealias AppendFn = @convention(c) (AnyObject, AnyObject, UInt32) -> Void
    private static func sym<T>(_ name: String, _ t: T.Type) -> T? { dlsym(iokit, name).map { unsafeBitCast($0, to: t) } }
    private static let hand = sym("IOHIDEventCreateDigitizerEvent", HandFn.self)
    private static let finger = sym("IOHIDEventCreateDigitizerFingerEvent", FingerFn.self)
    private static let setInt = sym("IOHIDEventSetIntegerValueWithOptions", SetIntFn.self)
    private static let append = sym("IOHIDEventAppendEvent", AppendFn.self)
    static var available: Bool { hand != nil && finger != nil && setInt != nil && append != nil }
    private static let displayIntegrated: UInt32 = (11 << 16) + 25   // kIOHIDEventFieldDigitizerIsDisplayIntegrated

    private static func hidEvent(_ p: CGPoint, _ phase: UITouch.Phase) -> AnyObject? {
        guard let hand, let finger, let setInt, let append else { return nil }
        let t = mach_absolute_time(), touching = phase != .ended && phase != .cancelled
        guard let h = hand(kCFAllocatorDefault, t, 3, 0, 0, 2, 0, 0, 0, 0, 0, 0, false, touching, 0)?.takeRetainedValue() else { return nil }
        setInt(h, displayIntegrated, 1, 0xF000_0000)
        let mask: UInt32 = phase == .moved ? 4 : 3   // Position | (Range|Touch)
        guard let f = finger(kCFAllocatorDefault, t, 1, 2, mask, Double(p.x), Double(p.y), 0, touching ? 1 : 0, 0, touching, touching, 0)?.takeRetainedValue() else { return nil }
        setInt(f, displayIntegrated, 1, 0xF000_0000)
        append(h, f, 0)
        return h
    }
    private static func call(_ o: AnyObject, _ name: String, _ arg: AnyObject?) { typealias F = @convention(c) (AnyObject, Selector, AnyObject?) -> Void; let s = NSSelectorFromString(name); guard o.responds(to: s) else { return }; unsafeBitCast(o.method(for: s), to: F.self)(o, s, arg) }
    private static func callInt(_ o: AnyObject, _ name: String, _ v: Int) { typealias F = @convention(c) (AnyObject, Selector, Int) -> Void; let s = NSSelectorFromString(name); guard o.responds(to: s) else { return }; unsafeBitCast(o.method(for: s), to: F.self)(o, s, v) }
    private static func callBool(_ o: AnyObject, _ name: String, _ v: Bool) { typealias F = @convention(c) (AnyObject, Selector, Bool) -> Void; let s = NSSelectorFromString(name); guard o.responds(to: s) else { return }; unsafeBitCast(o.method(for: s), to: F.self)(o, s, v) }
    private static func callDouble(_ o: AnyObject, _ name: String, _ v: Double) { typealias F = @convention(c) (AnyObject, Selector, Double) -> Void; let s = NSSelectorFromString(name); guard o.responds(to: s) else { return }; unsafeBitCast(o.method(for: s), to: F.self)(o, s, v) }
    private static func setLocation(_ o: AnyObject, _ p: CGPoint, reset: Bool) { typealias F = @convention(c) (AnyObject, Selector, CGPoint, Bool) -> Void; let s = NSSelectorFromString("_setLocationInWindow:resetPrevious:"); unsafeBitCast(o.method(for: s), to: F.self)(o, s, p, reset) }

    // MARK: HID path (Hammer technique): a digitizer IOHIDEvent addressed to the window's CAContext is
    // enqueued on UIApplication's HID queue, so UIKit builds the UITouch/UIEvent itself exactly as for
    // backboardd input — gesture recognizers (including SwiftUI's) see a real touch sequence.
    private typealias SenderFn = @convention(c) (AnyObject, UInt64) -> Void
    private typealias SetFloatFn = @convention(c) (AnyObject, UInt32, Double) -> Void
    private typealias DigitizerInfoFn = @convention(c) (AnyObject, UInt32, UInt8, UInt8, CFString?, Double, Float) -> Void
    private static let setSender = sym("IOHIDEventSetSenderID", SenderFn.self)
    private static let setFloat = sym("IOHIDEventSetFloatValue", SetFloatFn.self)
    private static let bks = dlopen("/System/Library/PrivateFrameworks/BackBoardServices.framework/BackBoardServices", RTLD_NOW)
    private static let digitizerInfo: DigitizerInfoFn? = dlsym(bks, "BKSHIDEventSetDigitizerInfo").map { unsafeBitCast($0, to: DigitizerInfoFn.self) }
    static var mode = AWCShim.env["AWC_IOS_TOUCH_MODE"] ?? "hid"
    static var hidAvailable: Bool { available && setSender != nil && digitizerInfo != nil && UIApplication.shared.responds(to: NSSelectorFromString("_enqueueHIDEvent:")) }
    private static var hidDown = false
    @discardableResult static func enqueue(_ phase: UITouch.Phase, at p: CGPoint, in window: UIWindow) -> Bool {
        guard hidAvailable, let hand, let finger, let setInt, let append, let setSender, let digitizerInfo else { return false }
        typealias CtxF = @convention(c) (AnyObject, Selector) -> UInt32
        let ctxSel = NSSelectorFromString("_contextId"); guard window.responds(to: ctxSel) else { return false }
        let context = unsafeBitCast(window.method(for: ctxSel), to: CtxF.self)(window, ctxSel)
        let screenPoint = window.convert(p, to: window.screen.coordinateSpace)
        let t = mach_absolute_time(), touching = phase != .ended && phase != .cancelled
        let mask: UInt32 = phase == .moved ? 4 : 3
        guard let h = hand(kCFAllocatorDefault, t, 3, 0, 0, mask, 0, 0, 0, 0, 0, 0, touching, touching, 0)?.takeRetainedValue(),
              let f = finger(kCFAllocatorDefault, t, 1, 2, mask, Double(screenPoint.x), Double(screenPoint.y), 0, touching ? 1 : 0, 0, touching, touching, 0)?.takeRetainedValue() else { return false }
        setInt(h, displayIntegrated, 1, 0); setInt(f, displayIntegrated, 1, 0)
        setFloat?(f, (11 << 16) + 20, 5); setFloat?(f, (11 << 16) + 21, 5)   // major/minor radius
        append(h, f, 0)
        setSender(h, 0x0000_0001_2345_6789)
        digitizerInfo(h, context, 0, 0, nil, 0, 0)
        typealias EnqF = @convention(c) (AnyObject, Selector, AnyObject) -> Void
        let enq = NSSelectorFromString("_enqueueHIDEvent:")
        unsafeBitCast(UIApplication.shared.method(for: enq), to: EnqF.self)(UIApplication.shared, enq, h)
        hidDown = touching
        return true
    }

    // MARK: Hardware keyboard (HID usage page 7), same enqueue path.
    private typealias KeyFn = @convention(c) (CFAllocator?, UInt64, UInt32, UInt32, Bool, UInt32) -> Unmanaged<AnyObject>?
    private static let keyboard = sym("IOHIDEventCreateKeyboardEvent", KeyFn.self)
    static var keyAvailable: Bool { keyboard != nil && hidAvailable }
    @discardableResult static func key(usage: UInt32, down: Bool, window: UIWindow) -> Bool {
        guard let keyboard, let setSender, let digitizerInfo, hidAvailable else { return false }
        guard let e = keyboard(kCFAllocatorDefault, mach_absolute_time(), 7, usage, down, 0)?.takeRetainedValue() else { return false }
        setSender(e, 0x0000_0001_2345_6789)
        typealias CtxF = @convention(c) (AnyObject, Selector) -> UInt32
        let ctxSel = NSSelectorFromString("_contextId")
        if window.responds(to: ctxSel) { digitizerInfo(e, unsafeBitCast(window.method(for: ctxSel), to: CtxF.self)(window, ctxSel), 0, 0, nil, 0, 0) }
        typealias EnqF = @convention(c) (AnyObject, Selector, AnyObject) -> Void
        let enq = NSSelectorFromString("_enqueueHIDEvent:")
        unsafeBitCast(UIApplication.shared.method(for: enq), to: EnqF.self)(UIApplication.shared, enq, e)
        return true
    }
    /// macOS virtual key code → USB HID keyboard usage.
    static let usageForMacKeyCode: [UInt16: UInt32] = [
        49: 44, 36: 40, 76: 88, 48: 43, 53: 41, 51: 42, 117: 76, 123: 80, 124: 79, 125: 81, 126: 82, 115: 74, 119: 77, 116: 75, 121: 78,
        0: 4, 11: 5, 8: 6, 2: 7, 14: 8, 3: 9, 5: 10, 4: 11, 34: 12, 38: 13, 40: 14, 37: 15, 46: 16, 45: 17, 31: 18, 35: 19, 12: 20, 15: 21, 1: 22,
        17: 23, 32: 24, 9: 25, 13: 26, 7: 27, 16: 28, 6: 29, 18: 30, 19: 31, 20: 32, 21: 33, 23: 34, 22: 35, 26: 36, 28: 37, 25: 38, 29: 39,
        27: 45, 24: 46, 33: 47, 30: 48, 42: 49, 41: 51, 39: 52, 50: 53, 43: 54, 47: 55, 44: 56, 56: 225, 60: 229, 59: 224, 58: 226, 55: 227]

    private static var touch: UITouch?
    /// Sends one touch phase at `p` (window coordinates). Returns false when the SPI is unavailable.
    @discardableResult static func send(_ phase: UITouch.Phase, at p: CGPoint, in window: UIWindow) -> Bool {
        if mode == "hid" { return enqueue(phase, at: p, in: window) }
        guard available else { return false }
        let now = ProcessInfo.processInfo.systemUptime
        if phase == .began || touch == nil {
            let t = UITouch(), view = window.hitTest(p, with: nil)
            call(t, "setWindow:", window); call(t, "setView:", view); callInt(t, "setTapCount:", 1)
            setLocation(t, p, reset: true); callBool(t, "_setIsFirstTouchForView:", true); callBool(t, "setIsTap:", false)
            call(t, "setGestureView:", view)
            touch = t
        } else { setLocation(touch!, p, reset: false) }
        guard let t = touch else { return false }
        callDouble(t, "setTimestamp:", now); callInt(t, "setPhase:", phase.rawValue)
        if let hid = hidEvent(p, phase) { call(t, "_setHidEvent:", hid) }
        typealias GetF = @convention(c) (AnyObject, Selector) -> UIEvent?
        let app = UIApplication.shared, sel = NSSelectorFromString("_touchesEvent")
        guard let event = unsafeBitCast(app.method(for: sel), to: GetF.self)(app, sel) else { return false }
        typealias VoidF = @convention(c) (AnyObject, Selector) -> Void
        let clear = NSSelectorFromString("_clearTouches"); unsafeBitCast(event.method(for: clear), to: VoidF.self)(event, clear)
        if let hid = hidEvent(p, phase) { call(event, "_setHIDEvent:", hid) }
        typealias AddF = @convention(c) (AnyObject, Selector, UITouch, Bool) -> Void
        let add = NSSelectorFromString("_addTouch:forDelayedDelivery:"); unsafeBitCast(event.method(for: add), to: AddF.self)(event, add, t, false)
        app.sendEvent(event)
        if phase == .ended || phase == .cancelled { touch = nil }
        return true
    }
}
#endif

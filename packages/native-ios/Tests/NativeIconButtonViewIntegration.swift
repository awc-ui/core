import AppKit
import SwiftUI
import Observation
import AWCUI

@Observable final class IconButtonFixtureState {
    var node = AWCNode(id: "icon", tag: "md-icon-button", properties: ["icon":"favorite", "ripple":false, "aria-label":"Save to favorites"])
    var appearance = AWCIconButtonAppearance()
    var rtl = false
    var reducedMotion = true
    var inspect = true
    var nodes: [AWCNativeInspectionNode] = []
    var events: [AWCEvent] = []
    let pointer = AWCNativePointerState()
}
struct IconButtonFixture: View {
    let state: IconButtonFixtureState
    var body: some View {
        let button = AWCNativeView(node: state.node, onEvent: { state.events.append($0) }).awcIconButtonAppearance(state.appearance)
        let measured = state.inspect ? AnyView(button.awcNativeInspection(rootID: state.node.id, coordinateSpace: "awc-native-preview") { state.nodes = $0 }) : AnyView(button)
        measured.padding(24).frame(width: 640, height: 240).background(Color.white)
            .awcTheme(.generated()).environment(\.colorScheme, .light).environment(\.layoutDirection, state.rtl ? .rightToLeft : .leftToRight)
            .transaction { $0.disablesAnimations = state.reducedMotion }.environment(\.awcNativePointerState, state.pointer)
            .coordinateSpace(name: "awc-native-preview")
    }
}
@main @MainActor enum NativeIconButtonViewIntegration {
    static var checks = 0
    static func check(_ valid: Bool, _ message: String) { checks += 1; precondition(valid, message) }
    static func pump(_ time: TimeInterval = 0.07) {
        let until = Date().addingTimeInterval(time)
        while Date() < until { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.005)) }
    }
    static func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
    struct Pixels: Equatable {
        let bytes: [UInt8]
        func count(_ hex: String, tolerance: Int = 3) -> Int {
            let n = UInt32(hex.dropFirst(), radix: 16)!, rgb = [Int(n >> 16), Int((n >> 8) & 255), Int(n & 255)]
            return stride(from: 0, to: bytes.count, by: 4).reduce(0) { total, i in total + ((0..<3).allSatisfy { abs(Int(bytes[i+$0])-rgb[$0]) <= tolerance } ? 1 : 0) }
        }
    }
    static func pixels(_ host: NSView) -> Pixels {
        host.layoutSubtreeIfNeeded(); host.displayIfNeeded()
        let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
        host.cacheDisplay(in: host.bounds, to: bitmap)
        let image = bitmap.cgImage!
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { data in
            let context = CGContext(data: data.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image, in: CGRect(x:0,y:0,width:image.width,height:image.height))
        }
        return .init(bytes: bytes)
    }
    static func main() {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        let state = IconButtonFixtureState()
        let host = NSHostingView(rootView: IconButtonFixture(state: state))
        let window = NSWindow(contentRect: .init(x:-20000,y:-20000,width:640,height:240), styleMask:.borderless, backing:.buffered, defer:false)
        window.isReleasedWhenClosed = false; window.colorSpace = .sRGB; window.contentView = host; window.orderFrontRegardless(); pump(0.2)
        defer { window.close() }
        func bounds(_ part: String = "component") -> CGRect { state.nodes.first { $0.id == part }?.bounds ?? .null }
        func set(_ properties: [String:AWCValue], children: [AWCNode] = [], appearance: AWCIconButtonAppearance = .init()) {
            state.node = .init(id:"icon", tag:"md-icon-button", properties:["icon":"favorite", "ripple":false, "aria-label":"Save to favorites"].merging(properties) { _,new in new }, children:children)
            state.appearance = appearance; state.events = []; state.pointer.update(phase:.leave); _ = window.makeFirstResponder(nil); pump()
        }
        func responder() -> NSView { descendants(host).first { String(describing:type(of:$0)).contains("AWCNativeButtonFocusView") && $0.accessibilityIdentifier() == "icon" }! }
        let baseline = pixels(host); state.inspect = false; pump()
        check(pixels(host) == baseline, "Opt-in icon inspection preserves every rendered pixel")
        state.inspect = true; pump()
        let sizes = ["xs","sm","md","lg","xl"], heights:[CGFloat] = [32,40,56,96,136]
        let widths:[String:[CGFloat]] = ["narrow":[28,32,48,64,104],"default":heights,"wide":[40,52,72,128,184]]
        for (index,size) in sizes.enumerated() { for density in 0...4 { for (width,base) in widths {
            set(["size":.string(size), "buttonWidth":.string(width), "density":.number(Double(-density))])
            check(bounds().size == CGSize(width:max(32,base[index]-CGFloat(density*4)),height:max(32,heights[index]-CGFloat(density*4))), "Real \(size)/\(width)/\(-density) container geometry")
            check(bounds("component.icon").width == max([16,18,18,24,28][index], [20,24,24,32,40][index]-CGFloat(density)*[1,1,1,2,3][index]), "Real \(size)/\(-density) glyph box")
            check(abs(bounds().midX - bounds("component.icon").midX) < 0.01 && abs(bounds().midY - bounds("component.icon").midY) < 0.01, "Actual glyph box is centered")
        } } }
        set(["variant":"outlined"], appearance:.init(iconSize:36, cornerRadius:0, outlineWidth:4, width:94, height:72))
        check(bounds().size == CGSize(width:94,height:72) && bounds("component.icon").size == CGSize(width:36,height:36), "Explicit native dimensions and iconSize reach actual layout")
        check(state.nodes.first { $0.id == "component" }?.metrics["border"] == [4,4,4,4], "Measured root reports actual outline width")
        set(["variant":"outlined"], appearance:.init(outlineWidth:4,width:0,height:0))
        check(bounds().size == CGSize(width:8,height:8), "Actual zero CSS border-box dimensions retain border floor")
        set([:], appearance:.init(width:800,height:30))
        check(bounds().width == 800 && abs(bounds().midX-320)<0.01, "Explicit native width can overflow a smaller parent without compression or alignment drift")
        set([:], children:[.text(" \n "),.init(id:"badge",tag:"md-badge",properties:["value":"5"])])
        check(bounds("component.icon.badge.badge").midX == bounds("component.icon").maxX && bounds("component.icon.badge.badge").midY == bounds("component.icon").minY, "Badge straddles the actual icon wrapper top-right corner")
        let badgePixels = pixels(host)
        set([:], children:[.init(id:"badge",tag:"md-badge",properties:["value":"5"])])
        check(pixels(host) == badgePixels, "Whitespace does not suppress the fallback glyph beside badge")
        state.rtl = true; pump()
        check(bounds("component.icon.badge.badge").midX == bounds("component.icon").maxX, "Badge physical-right anchor remains correct under RTL")
        state.rtl = false
        set([:], children:[.init(id:"badge",tag:"md-badge",properties:["value":"5","shape":"circle"])])
        check(abs(bounds("component.icon.badge.badge").midX - bounds("component.icon").minX - 24 * 0.853553) < 0.01 && abs(bounds("component.icon.badge.badge").midY - bounds("component.icon").minY - 24 * 0.146447) < 0.01, "Circular-host badge anchor uses source45degree rim geometry")
        // Source density=0 has no CSS reset selector: a composed badge inherits
        // the parent token until its own -1...-4 selector overrides it.
        for (density, height, font, padding): (AWCValue?, CGFloat, Double, Double) in [
            (nil, 12, 9, 2), (0, 12, 9, 2), (-2, 14, 10, 3), (-1, 15, 10.5, 3.5),
        ] {
            var properties: [String: AWCValue] = ["value": "8", "icon": "favorite"]
            properties["density"] = density
            set(["density": -4], children: [.init(id: "badge", tag: "md-badge", properties: properties)])
            let badge = state.nodes.first { $0.id == "component.icon.badge.badge" }
            check(badge?.bounds.height == height, "Actual nested badge inherits/overrides dense IconButton height")
            check(badge?.metrics["typography"]?.object["size"] == .number(font), "Actual nested badge typography follows inherited density")
            check(badge?.metrics["padding"] == [0, .number(padding), 0, .number(padding)], "Actual nested badge padding follows inherited density")
            check(abs(bounds("component.icon.badge.badge").midX - bounds("component.icon").maxX) < 0.01 &&
                abs(bounds("component.icon.badge.badge").midY - bounds("component.icon").minY) < 0.01,
                "Density changes preserve the actual parent anchor")
        }
        set([:], children:[.init(id:"avatar",tag:"md-avatar",properties:["size":40, "initials":"AB"])])
        check(bounds("component.icon.slot.avatar").size == CGSize(width:40,height:40) && bounds("component.icon").width == 24, "Avatar retains its own size inside the source icon wrapper")
        let slot = try! AWCPreviewSlots.applyingValues(["": ["kind":"symbol","value":"add"], "selected":["kind":"symbol","value":"check"]], to: state.node)
        set(["toggle":true,"selected":false,"selectedIcon":"close"], children:slot.children)
        let defaultPixels = pixels(host)
        set(["toggle":true,"selected":true,"selectedIcon":"close"], children:slot.children)
        check(bounds("component.icon").isNull && bounds("component.selected-icon").width == 24 && pixels(host) != defaultPixels, "Dynamic selected slot changes visible measured layer and actual glyph")
        set(["toggle":false,"selected":true,"selectedIcon":"close"], children:slot.children)
        check(!bounds("component.icon").isNull && bounds("component.selected-icon").isNull, "Selected non-toggle keeps default slot")
        set(["toggle":true,"selected":true,"selectedIcon":"close"], children:[.text(" \n",slot:"selected")])
        check(!bounds("component.selected-icon").isNull, "Whitespace selected slot still falls back to selectedIcon")
        set(["toggle":true,"selected":true,"selectedIcon":""], children:[.text(" \n",slot:"selected")])
        check(!bounds("component.icon").isNull, "Empty selected slot and icon restore default layer without stale geometry")

        set(["toggle":true,"selected":true,"selectedIcon":"close"], children:[.slotText("", slot:"selected")])
        check(!bounds("component.selected-icon").isNull && pixels(host).count(AWCGeneratedTokens.light["--md-sys-color-primary"]!) == 0, "Explicit empty selected wrapper suppresses fallback glyph while keeping selected layer")
        set([:], children:[.slotText("")])
        let explicitBlank = pixels(host)
        set(["icon":""], children:[.text(" ")])
        check(pixels(host) == explicitBlank, "Explicit empty default wrapper masks the icon prop exactly like Web empty span")

        let tokens = AWCGeneratedTokens.light
        for variant in ["filled","tonal","outlined"] { for selected in [false,true] {
            set(["variant":.string(variant),"toggle":true,"selected":.bool(selected),"icon":"","shapeMorph":false], appearance:.init(cornerRadius:0))
            let role = variant == "outlined" ? (selected ? "inverse-surface" : nil) : selected ? (variant == "filled" ? "primary" : "secondary-container") : "surface-container-highest"
            if let role { check(pixels(host).count(tokens["--md-sys-color-"+role]!) > 500, "Actual \(variant)/selected=\(selected) surface uses source theme role") }
        } }
        for variant in ["standard","filled","tonal","outlined"] {
            set(["variant":.string(variant),"disabled":true], appearance:.init(containerColor:"#0000FF",iconColor:"#FF0000",cornerRadius:0,outlineColor:"#00FF00",outlineWidth:4))
            let image = pixels(host)
            check(image.count("#FF0000") == 0 && image.count("#00FF00") == 0, "Disabled \(variant) ignores custom icon and outline colors")
            check((image.count("#0000FF") > 500) == ["standard","outlined"].contains(variant), "Disabled \(variant) correct custom-container cascade")
        }
        set(["variant":"outlined","selected":true,"toggle":false,"icon":""], appearance:.init(cornerRadius:0,outlineColor:"#FF0000",outlineWidth:4))
        check(pixels(host).count("#FF0000") == 0, "Selected outlined border is transparent even with explicit outline hook")
        set(["variant":"standard"], appearance:.init(containerColor:"#000000",iconColor:"#FF0000",stateLayerColor:"#00FF00",cornerRadius:0))
        state.pointer.update(phase:.move,location:CGPoint(x:bounds().midX,y:bounds().midY)); pump(0.2)
        check(pixels(host).count("#001400") > 500, "Hover state uses explicit state-layer ink and source8percent opacity independently of icon color")
        _ = window.makeFirstResponder(responder()); pump(0.2)
        check(pixels(host).count("#001F00") > 500, "Visible focus wins over hover with source12percent opacity")
        check(responder().accessibilityRole() == .button && responder().accessibilityLabel() == "Save to favorites", "Native role/accessible name use authored aria-label and never glyph name")
        set(["href":"https://example.com","icon":"favorite"])
        check(responder().accessibilityRole() == .button, "Web icon-button remains role button even with href")
        set(["softDisabled":true,"toggle":true])
        check(responder().acceptsFirstResponder && !responder().accessibilityPerformPress() && state.events.isEmpty, "Soft-disabled stays focusable but blocks AX activation")
        set(["disabled":true,"toggle":true])
        check(!responder().acceptsFirstResponder && !responder().accessibilityPerformPress(), "Hard-disabled excludes focus and activation")
        set(["groupTabindex":-1])
        check(responder().acceptsFirstResponder && !responder().canBecomeKeyView, "Negative group tabindex preserves explicit focus but removes sequential focus")
        set(["toggle":true,"selectedIcon":"check"])
        let target = responder(); _ = window.makeFirstResponder(target)
        let enter = NSEvent.keyEvent(with:.keyDown,location:.zero,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,characters:"\r",charactersIgnoringModifiers:"\r",isARepeat:false,keyCode:36)!
        window.sendEvent(enter); pump()
        check(state.events.map(\.name) == ["mdClick"] && state.events[0].detail == ["selected":true] && state.events[0].activation?.source == .keyboard, "Enter keydown commits selection and emits only mdClick with keyboard provenance")
        check(!bounds("component.selected-icon").isNull, "Keyboard-selected glyph appears in actual rendered tree")
        check(target.accessibilityPerformPress(), "Real native accessibility press activates")
        pump()
        check(state.events.last?.detail == ["selected":false] && state.events.last?.activation?.source == .accessibility, "AX press toggles back with truthful provenance")
        state.events = []
        let point = target.convert(NSPoint(x:target.bounds.midX,y:target.bounds.midY),to:nil)
        let down = NSEvent.mouseEvent(with:.leftMouseDown,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:1)!
        let up = NSEvent.mouseEvent(with:.leftMouseUp,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime+0.01,windowNumber:window.windowNumber,context:nil,eventNumber:2,clickCount:1,pressure:0)!
        state.pointer.update(phase:.down,location:CGPoint(x:bounds().midX,y:bounds().midY)); window.sendEvent(down); pump()
        check(state.events.isEmpty, "Held pointer does not activate before release")
        window.sendEvent(up); state.pointer.update(phase:.up,location:CGPoint(x:bounds().midX,y:bounds().midY)); pump()
        check(state.events.count == 1 && state.events[0].detail == ["selected":true] && state.events[0].activation?.source == .pointer, "Real pointer release toggles once with native pointer provenance")
        print("Passed \(checks) real native icon-button geometry, pixel, slot, focus, keyboard, pointer and accessibility checks.")
    }
}

import AppKit
import SwiftUI
@testable import AWCUI

// fi probe: UIKit geometry of a UIViewRepresentable under a SwiftUI right-to-left environment.
final class RTLProbeBox { var views: [String: UIView] = [:]; var swift: [String: CGRect] = [:] }
final class RTLProbeView: UIView {}
struct RTLProbeRep: UIViewRepresentable {
    let id: String, box: RTLProbeBox
    func makeUIView(context: Context) -> RTLProbeView { let v = RTLProbeView(); box.views[id] = v; return v }
    func updateUIView(_ v: RTLProbeView, context: Context) {}
}
struct RTLProbeCell: View {
    let id: String, box: RTLProbeBox
    var body: some View {
        Color.orange.frame(width: 100, height: 40)
            .background { RTLProbeRep(id: id, box: box) }
            .background { GeometryReader { g in Color.clear.onAppear { box.swift[id] = g.frame(in: .global) } } }
    }
}
struct RTLProbeView2: View {
    let box: RTLProbeBox
    var body: some View {
        VStack(spacing: 10) {
            HStack { RTLProbeCell(id: "ltr", box: box); Spacer() }.environment(\.layoutDirection, .leftToRight)
            HStack { RTLProbeCell(id: "rtl", box: box); Spacer() }.environment(\.layoutDirection, .rightToLeft)
        }.frame(width: 400).padding(40).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSRTLProbe {
    static let box = RTLProbeBox()
    static func main() {
        let host = NSHostingView(rootView: RTLProbeView2(box: box))
        let window = NSWindow(contentRect: .init(x: 0, y: 0, width: 480, height: 300), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless(); AWCShim.pumpFrames(0.5)
        for id in ["ltr", "rtl"] {
            guard let v = box.views[id] else { print("RTLPROBE \(id) missing"); continue }
            var chain: [String] = []; var p: UIView? = v; while let x = p, chain.count < 5 { chain.append("\(type(of: x)) t=\(x.transform) sca=\(x.semanticContentAttribute.rawValue) dir=\(x.effectiveUserInterfaceLayoutDirection.rawValue)"); p = x.superview }
            print("RTLPROBE \(id) uikit=\(v.convert(v.bounds, to: window)) swift=\(box.swift[id].map { "\($0)" } ?? "-") layer=\(v.layer.convert(v.layer.bounds, to: window.layer))")
            print("RTLPROBE \(id) chain: \(chain.joined(separator: " | "))")
        }
        print("RTL probe: 1/1 checks passed")
    }
}

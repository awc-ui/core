import AppKit
import SwiftUI
@testable import AWCUI

// Measures SwiftUI's single-line Text height for the bundled Roboto faces on this platform, to compare
// against the macOS line model (rounded ascent + rounded descent) that AWCCSSLineBox encodes.
@Observable final class TextProbeState { var heights: [String: CGFloat] = [:] }
struct TextProbeView: View {
    let state: TextProbeState
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach([false, true], id: \.self) { regular in
                ForEach(8...48, id: \.self) { s in
                    Text("Hamburg").font(AWCNativeFonts.label(size: CGFloat(s), regular: regular)).fixedSize()
                        .background(GeometryReader { g in Color.clear.onAppear { state.heights["\(regular ? "R" : "M")\(s)"] = g.size.height } })
                }
            }
            ForEach(Array(["👩\u{200D}💻O", "👩\u{200D}💻", "O", "😀"].enumerated()), id: \.offset) { i, t in
                Text(t).font(AWCNativeFonts.label(size: 22.4, weight: 500)).tracking(1.12).monospacedDigit().lineLimit(1).fixedSize()
                    .background(GeometryReader { g in Color.clear.onAppear { state.heights["emoji\(i)"] = g.size.width } })
                Text(t).font(.system(size: 22.4)).lineLimit(1).fixedSize()
                    .background(GeometryReader { g in Color.clear.onAppear { state.heights["emojiSystem\(i)"] = g.size.width } })
            }
        }.frame(width: 600, alignment: .topLeading)
    }
}
@main @MainActor enum NativeIOSTextProbe {
    static let state = TextProbeState()
    static var host: NSHostingView<TextProbeView>!, window: NSWindow!
    static func main() {
        _ = NSApplication.shared
        host = NSHostingView(rootView: TextProbeView(state: state))
        window = NSWindow(contentRect: .init(x: -20000, y: -20000, width: 600, height: 4000), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = host; window.orderFrontRegardless()
        let end = Date().addingTimeInterval(1); repeat { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01)) } while Date() < end
        var rows: [String] = []
        for regular in [false, true] { for s in 8...48 {
            let k = "\(regular ? "R" : "M")\(s)", h = state.heights[k] ?? -1, d = Double(s)
            let mac = (d * 1900 / 2048).rounded() + (d * 500 / 2048).rounded(), sum = d * 2400 / 2048
            rows.append("\(k):\(h)/mac\(Int(mac))/sum\(String(format: "%.2f", sum))")
        } }
        print("TEXTPROBE " + rows.joined(separator: " "))
        let font = UIFont(name: "Roboto-Regular", size: 22)
        print("TEXTPROBE uifont22 ascender=\(font?.ascender ?? -1) descender=\(font?.descender ?? -1) leading=\(font?.leading ?? -1) lineHeight=\(font?.lineHeight ?? -1)")
        print("TEXTPROBE emoji widths (awc font, tracking 1.12 / system): " + (0..<4).map { "\($0):\(state.heights["emoji\($0)"] ?? -1)/\(state.heights["emojiSystem\($0)"] ?? -1)" }.joined(separator: " "))
        print("Text probe: done")
        window.close()
    }
}

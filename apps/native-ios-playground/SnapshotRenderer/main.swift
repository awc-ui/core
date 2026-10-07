import Foundation
import SwiftUI
import AppKit
import AWCUI

@main
struct SnapshotRenderer {
    @MainActor static func main() throws {
        let output = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "/tmp/awc-native-snapshots", isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        var failed: [String] = []
        for dark in [false, true] {
            for tag in AWCComponentCatalog.tags {
                let view = VStack(alignment: .leading, spacing: 18) {
                    Text(tag).font(.title2.bold())
                    AWCNativeView(node: AWCExamples.node(for: tag))
                }.padding(24).frame(width: 640).background(dark ? Color(white: 0.08) : .white)
                    .environment(\.colorScheme, dark ? .dark : .light).awcTheme(.generated(dark: dark))
                let host = NSHostingView(rootView: view)
                host.frame = NSRect(x: 0, y: 0, width: 640, height: max(100, host.fittingSize.height))
                host.layoutSubtreeIfNeeded()
                guard let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { failed.append(tag); continue }
                host.cacheDisplay(in: host.bounds, to: bitmap)
                guard let png = bitmap.representation(using: .png, properties: [:]) else { failed.append(tag); continue }
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
            if let png = bitmap.representation(using: .png, properties: [:]) { try png.write(to: output.appendingPathComponent("overview.png")) }
        }
        print("Rendered \(AWCComponentCatalog.tags.count * 2) native SwiftUI snapshots to \(output.path)")
    }
}

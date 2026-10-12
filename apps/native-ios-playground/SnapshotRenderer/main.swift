import Foundation
import SwiftUI
import AppKit
import Darwin
import AWCUI

@main
struct SnapshotRenderer {
    private static func png(_ bitmap: NSBitmapImageRep) -> Data? {
        // A monitor's Color LCD profile is neither portable nor comparable to CSS sRGB.
        // Convert pixels, rather than merely changing the profile tag, before exporting.
        guard let output = bitmap.colorSpace == .sRGB ? bitmap : bitmap.converting(to: .sRGB, renderingIntent: .default) else { return nil }
        return output.representation(using: .png, properties: [:])
    }
    private struct RenderRequest: Decodable {
        let tag: String
        let properties: [String: AWCValue]
        let dark: Bool
        let width: Double?
        let text: String?
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

    @MainActor private static func renderRequest(input: URL, output: URL) throws {
        guard input.standardizedFileURL != output.standardizedFileURL else {
            throw RenderFailure(message: "Request and output must use different file paths.")
        }
        let request = try JSONDecoder().decode(RenderRequest.self, from: Data(contentsOf: input))
        guard AWCComponentCatalog.tags.contains(request.tag) else {
            throw RenderFailure(message: "Unknown native component tag: \(request.tag)")
        }
        let requestedWidth = request.width ?? 640
        guard requestedWidth.isFinite else { throw RenderFailure(message: "Width must be a finite number.") }
        let width = min(1200, max(320, requestedWidth)).rounded()
        var node = AWCExamples.node(for: request.tag)
        node.properties.merge(request.properties) { _, supplied in supplied }
        if let text = request.text {
            guard request.tag == "md-button", text.utf8.count <= 4096 else { throw RenderFailure(message: "Button text must be at most 4096 UTF-8 bytes.") }
            node.children.removeAll { ($0.slot ?? "").isEmpty }
            node.children.append(.text(text))
        }
        let view = AWCNativeView(node: node)
            .padding(24).frame(width: width, alignment: .leading)
            .frame(minHeight: 100, alignment: .topLeading)
            .background(request.dark ? Color(white: 0.08) : .white)
            .environment(\.colorScheme, request.dark ? .dark : .light)
            .awcTheme(.generated(dark: request.dark))
        let host = NSHostingView(rootView: view)
        let measuredHeight = host.fittingSize.height
        guard measuredHeight.isFinite, measuredHeight > 0 else {
            throw RenderFailure(message: "Component produced invalid native layout dimensions.")
        }
        let height = min(2000, max(100, measuredHeight.rounded(.up)))
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
                    AWCNativeView(node: AWCExamples.node(for: tag))
                }.padding(24).frame(width: 640).background(dark ? Color(white: 0.08) : .white)
                    .environment(\.colorScheme, dark ? .dark : .light).awcTheme(.generated(dark: dark))
                let host = NSHostingView(rootView: view)
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

import AppKit
import Foundation

/// Exercises each production request decoder and PNG exporter, including saturated
/// colors that expose an accidental display-profile conversion in the capture path.
@main enum NativeButtonAppearanceHostIntegration {
    static func run(_ executable: URL, _ arguments: [String], input: Data? = nil) throws -> Data {
        let task = Process(), output = Pipe(), error = Pipe(), standardInput = Pipe()
        task.executableURL = executable; task.arguments = arguments
        task.standardOutput = output; task.standardError = error; task.standardInput = standardInput
        try task.run()
        if let input { try standardInput.fileHandleForWriting.write(contentsOf: input) }
        try standardInput.fileHandleForWriting.close()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        precondition(task.terminationStatus == 0, String(data: error.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "Native renderer failed")
        return data
    }
    static func verify(_ data: Data, name: String) {
        guard let bitmap = NSBitmapImageRep(data: data) else { preconditionFailure("Missing \(name) PNG") }
        guard let image = bitmap.cgImage, let space = CGColorSpace(name: CGColorSpace.sRGB) else { preconditionFailure("Invalid PNG colorspace") }
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { data in
            let context = CGContext(data: data.baseAddress, width: image.width, height: image.height,
                bitsPerComponent: 8, bytesPerRow: image.width * 4, space: space,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        var blue = 0, green = 0, inheritedRed = 0
        for i in stride(from: 0, to: bytes.count, by: 4) {
            let rgb = (bytes[i], bytes[i + 1], bytes[i + 2])
            if rgb == (0,0,255) { blue += 1 }
            if rgb == (0,255,0) { green += 1 }
            if rgb == (255,0,0) { inheritedRed += 1 }
        }
        precondition(blue > 1000 && green > 15 && inheritedRed == 0, "\(name): appearance merge or exact sRGB export failed (blue \(blue), green \(green), inherited red \(inheritedRed))")
        print("\(name): exact local blue \(blue) px, inherited green \(green) px; \(bitmap.pixelsWide)×\(bitmap.pixelsHigh)")
    }
    static func main() throws {
        precondition(CommandLine.arguments.count == 2, "Pass the playground executable directory")
        let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("awc-appearance-host-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temporary) }
        var request: [String: Any] = ["tag": "md-button", "properties": [:], "dark": false, "width": 640, "text": "Continue",
            "buttonAppearanceDefaults": ["containerColor": "#FF0000", "labelColor": "#00FF00"],
            "buttonAppearance": ["containerColor": "#0000FF", "cornerRadius": 0, "fontWeight": 700]]
        let input = temporary.appendingPathComponent("request.json"), output = temporary.appendingPathComponent("snapshot.png")
        try JSONSerialization.data(withJSONObject: request).write(to: input)
        _ = try run(directory.appendingPathComponent("AWCSnapshots"), ["--request", input.path, "--output", output.path])
        verify(try Data(contentsOf: output), name: "Snapshot")
        request["id"] = 1; request["command"] = "configure"
        var lines = try JSONSerialization.data(withJSONObject: request); lines.append(10)
        lines.append(try JSONSerialization.data(withJSONObject: ["id": 2, "command": "close"])); lines.append(10)
        let response = try run(directory.appendingPathComponent("AWCLivePreview"), ["--stdio"], input: lines)
        let frame = try JSONSerialization.jsonObject(with: Data(response.prefix(while: { $0 != 10 }))) as! [String: Any]
        precondition(frame["platform"] as? String == "macos" && frame["renderer"] as? String == "SwiftUI", "Live returned an error instead of a native frame")
        verify(Data(base64Encoded: frame["png"] as! String)!, name: "Live")
        print("Passed both native host appearance request/PNG checks.")
    }
}

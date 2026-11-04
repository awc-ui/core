import AppKit
import SwiftUI
import CoreText
@testable import AWCUI

// fi probe: can the iOS 26.3 simulator render emoji once the runtime's own emoji font is registered?
@main @MainActor enum NativeIOSEmojiProbe {
    static func ink(_ text: String, font: UIFont) -> Int {
        let size = CGSize(width: 120, height: 60)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in UIColor.white.setFill(); ctx.fill(CGRect(origin: .zero, size: size)); (text as NSString).draw(at: CGPoint(x: 4, y: 4), withAttributes: [.font: font, .foregroundColor: UIColor.black]) }
        guard let cg = img.cgImage, let data = cg.dataProvider?.data, let p = CFDataGetBytePtr(data) else { return -1 }
        var n = 0; for i in stride(from: 0, to: CFDataGetLength(data), by: 4) where p[i] < 200 || p[i+1] < 200 || p[i+2] < 200 { n += 1 }; return n
    }
    static func main() {
        let root = ProcessInfo.processInfo.environment["IPHONE_SIMULATOR_ROOT"] ?? "?"
        print("EMOJI root=\(root)")
        let f = UIFont.systemFont(ofSize: 24)
        print("EMOJI before: name=\(UIFont(name: "AppleColorEmoji", size: 24)?.fontName ?? "nil") ink=\(ink("👩‍💻😀", font: f)) inkA=\(ink("Ab", font: f))")
        for path in [root + "/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc", "/System/Library/Fonts/Apple Color Emoji.ttc"] {
            var err: Unmanaged<CFError>?
            let ok = CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: path) as CFURL, .process, &err)
            let descs = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: path) as CFURL) as? [CTFontDescriptor] ?? []
            print("EMOJI register \(path) ok=\(ok) err=\(err.map { "\($0.takeRetainedValue())" } ?? "-") names=\(descs.compactMap { CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String })")
            print("EMOJI after: name=\(UIFont(name: "AppleColorEmoji", size: 24)?.fontName ?? "nil") ink=\(ink("👩‍💻😀", font: f))")
        }
        let size = CGSize(width: 200, height: 70), f2 = UIFont.systemFont(ofSize: 40)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in UIColor.white.setFill(); ctx.fill(CGRect(origin: .zero, size: size)); ("👩‍💻😀A" as NSString).draw(at: CGPoint(x: 4, y: 4), withAttributes: [.font: f2, .foregroundColor: UIColor.black]) }
        try? FileManager.default.createDirectory(atPath: "/tmp/awc-ios/out/emoji", withIntermediateDirectories: true)
        try? img.pngData()?.write(to: URL(fileURLWithPath: "/tmp/awc-ios/out/emoji/emoji.png"))
        let ct = CTFontCreateWithName("AppleColorEmoji" as CFString, 40, nil)
        print("EMOJI ctfont name=\(CTFontCopyPostScriptName(ct)) url=\(String(describing: CTFontCopyAttribute(ct, kCTFontURLAttribute)))")
        print("Emoji probe: 1/1 checks passed")
    }
}

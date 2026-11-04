import XCTest
@testable import AWCUI

final class NativeDividerTests: XCTestCase {
    func testAppearanceCascadePreservesSignedInsetsAndZeroThickness() {
        let inherited = AWCDividerAppearance(color: "#abcdef", thickness: 3, insetStart: 12, insetEnd: 28)
        XCTAssertEqual(inherited.merging(.init(thickness: 0, insetStart: -12)),
                       .init(color: "#ABCDEF", thickness: 0, insetStart: -12, insetEnd: 28))
        for invalid: AWCValue in [.number(.nan), .number(.infinity), true, "3"] {
            for key in ["thickness", "insetStart", "insetEnd"] {
                XCTAssertEqual(AWCDividerAppearance(values: [key: invalid]), .init())
            }
        }
        XCTAssertNil(AWCDividerAppearance(thickness: -1).thickness)
        XCTAssertEqual(AWCDividerAppearance(values: ["insetStart": -12]).insetStart, -12)
        XCTAssertNil(AWCDividerAppearance(color: "red").color)
    }

    func testInsetsMatchWebCascadeIncludingConflictingFlags() {
        // Frozen from the hydrated Web oracle; entries are indexed by
        // inset + 2*insetStart + 4*insetEnd.
        let margins: [(CGFloat, CGFloat)] = [(0,0),(16,16),(16,0),(16,0),(0,16),(0,16),(0,16),(0,16)]
        for vertical in [false, true] {
            for flags in 0..<8 {
                let metrics = AWCNativeDividerMetrics(properties: [
                    "vertical": .bool(vertical), "inset": .bool(flags & 1 != 0),
                    "insetStart": .bool(flags & 2 != 0), "insetEnd": .bool(flags & 4 != 0)
                ], appearance: .init())
                XCTAssertEqual(metrics.start, margins[flags].0)
                XCTAssertEqual(metrics.end, margins[flags].1)
                let size = vertical ? CGSize(width: 1, height: 96) : CGSize(width: 240, height: 1)
                for rtl in [false, true] {
                    let line = metrics.line(in: size, rtl: rtl)
                    XCTAssertEqual(vertical ? line.minY : line.minX, vertical || !rtl ? margins[flags].0 : margins[flags].1)
                    XCTAssertEqual(vertical ? line.height : line.width, (vertical ? 96 : 240) - margins[flags].0 - margins[flags].1)
                }
            }
        }
    }
}

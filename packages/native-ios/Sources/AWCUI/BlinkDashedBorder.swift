import SwiftUI

/// Blink's rounded `dashed` border (r3-20): one stroke along the closed border centerline — inset by half the width, corner
/// radii shrunk by half the width — starting where the top-left corner meets the top side and running clockwise (physical,
/// also in RTL); dash 3w and gap 2w below 3 px, 2w / w from 3 px, the gap adjusted to whole dashes over the perimeter
/// (`StrokeData::SelectBestDashGap`), phase 0. The Compose renderer paints the same centerline.
struct AWCBlinkDashedBorder: View {
    let corners: AWCCornerShape, width: Double, color: Color
    static func intervals(_ w: Double) -> (dash: Double, gap: Double) { w < 3 ? (3 * w, 2 * w) : (2 * w, w) }
    static func bestGap(length: Double, dash: Double, gap: Double) -> Double {
        let minDashes = (length / (dash + gap)).rounded(.down), maxDashes = minDashes + 1
        guard minDashes > 0 else { return gap }
        let minGap = (length - minDashes * dash) / minDashes, maxGap = (length - maxDashes * dash) / maxDashes
        return maxGap <= 0 || abs(minGap - gap) < abs(maxGap - gap) ? minGap : maxGap
    }
    static func centerline(_ corners: AWCCornerShape, _ size: CGSize, _ stroke: Double) -> (path: Path, length: Double) {
        let h = stroke / 2, w = Double(size.width), ht = Double(size.height)
        let r = corners.radii(in: size).map { (max(0, Double($0.width) - h), max(0, Double($0.height) - h)) }
        var p = Path()
        func arc(_ cx: Double, _ cy: Double, _ rx: Double, _ ry: Double, _ from: Double) {
            guard rx > 0 && ry > 0 else { return }
            for i in 1...16 { let a = (from + 90 * Double(i) / 16) * .pi / 180; p.addLine(to: CGPoint(x: cx + rx * cos(a), y: cy + ry * sin(a))) }
        }
        p.move(to: CGPoint(x: h + r[0].0, y: h))
        p.addLine(to: CGPoint(x: w - h - r[1].0, y: h)); arc(w - h - r[1].0, h + r[1].1, r[1].0, r[1].1, -90)
        p.addLine(to: CGPoint(x: w - h, y: ht - h - r[2].1)); arc(w - h - r[2].0, ht - h - r[2].1, r[2].0, r[2].1, 0)
        p.addLine(to: CGPoint(x: h + r[3].0, y: ht - h)); arc(h + r[3].0, ht - h - r[3].1, r[3].0, r[3].1, 90)
        p.addLine(to: CGPoint(x: h, y: h + r[0].1)); arc(h + r[0].0, h + r[0].1, r[0].0, r[0].1, 180)
        p.closeSubpath()
        // Quarter-ellipse perimeter (Ramanujan), exact for circles.
        func quarter(_ a: Double, _ b: Double) -> Double { guard a > 0 && b > 0 else { return 0 }; let q = (a - b) * (a - b) / ((a + b) * (a + b)); return .pi * (a + b) * (1 + 3 * q / (10 + (4 - 3 * q).squareRoot())) / 4 }
        let straight = (w - 2 * h - r[0].0 - r[1].0) + (ht - 2 * h - r[1].1 - r[2].1) + (w - 2 * h - r[2].0 - r[3].0) + (ht - 2 * h - r[3].1 - r[0].1)
        return (p, straight + r.map { quarter($0.0, $0.1) }.reduce(0, +))
    }
    var body: some View {
        Canvas { context, size in
            guard width > 0 else { return }
            let (path, length) = Self.centerline(corners, size, width)
            let (dash, gap) = Self.intervals(width)
            let style = length <= dash * 2 ? StrokeStyle(lineWidth: width) : StrokeStyle(lineWidth: width, dash: [dash, Self.bestGap(length: length, dash: dash, gap: gap)], dashPhase: 0)
            context.stroke(path, with: .color(color), style: style)
        }
        .allowsHitTesting(false)
    }
}

import SwiftUI

/// Rounded path with explicit, already-resolved corner radii in
/// top-left, top-right, bottom-right, bottom-left order.
func awcAccordionRoundedPath(_ box: CGRect, _ r: [CGSize]) -> Path {
    let k: CGFloat = 0.5522847498307936, l = box.minX, t = box.minY, right = box.maxX, b = box.maxY
    var path = Path(); path.move(to: .init(x: l + r[0].width, y: t)); path.addLine(to: .init(x: right - r[1].width, y: t))
    path.addCurve(to: .init(x: right, y: t + r[1].height), control1: .init(x: right - r[1].width * (1 - k), y: t), control2: .init(x: right, y: t + r[1].height * (1 - k)))
    path.addLine(to: .init(x: right, y: b - r[2].height))
    path.addCurve(to: .init(x: right - r[2].width, y: b), control1: .init(x: right, y: b - r[2].height * (1 - k)), control2: .init(x: right - r[2].width * (1 - k), y: b))
    path.addLine(to: .init(x: l + r[3].width, y: b))
    path.addCurve(to: .init(x: l, y: b - r[3].height), control1: .init(x: l + r[3].width * (1 - k), y: b), control2: .init(x: l, y: b - r[3].height * (1 - k)))
    path.addLine(to: .init(x: l, y: t + r[0].height))
    path.addCurve(to: .init(x: l + r[0].width, y: t), control1: .init(x: l, y: t + r[0].height * (1 - k)), control2: .init(x: l + r[0].width * (1 - k), y: t))
    path.closeSubpath(); return path
}

/// Padding box of an item whose only border is the outlined separator
/// (`border-block-end`). As in CSS, each inner corner radius loses the adjacent
/// border width, so only the bottom corners shrink vertically.
func awcAccordionPaddingBox(_ corners: AWCCornerShape, in rect: CGRect, bottomBorder: CGFloat) -> Path {
    let outer = corners.radii(in: rect.size)
    let box = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: max(0, rect.height - bottomBorder))
    return awcAccordionRoundedPath(box, [outer[0], outer[1],
        CGSize(width: outer[2].width, height: max(0, outer[2].height - bottomBorder)),
        CGSize(width: outer[3].width, height: max(0, outer[3].height - bottomBorder))])
}

/// Source `overflow: hidden` on `.md-accordion-item--dragging`: while lifted,
/// header tint, state layer and panel surfaces are clipped to the dragging
/// radius. The modifier is always installed and only its geometry changes, so
/// lifting never replaces the item's subtree or remounts authored content.
struct AWCAccordionLiftClip: Shape {
    var corners: AWCCornerShape, active: Bool, bottomBorder: CGFloat
    func path(in rect: CGRect) -> Path {
        active ? awcAccordionPaddingBox(corners, in: rect, bottomBorder: bottomBorder) : Path(rect.insetBy(dx: -1_000, dy: -1_000))  // "no clip" (see AWCAccordionFloatingShape)
    }
}

/// Outlined separator as the source paints it: the item's `border-block-end`.
/// Square resting items produce the same 1px strip as before; a lifted item
/// with a dragging radius curves and tapers the border into its corners.
struct AWCAccordionSeparatorShape: Shape {
    var corners: AWCCornerShape, width: CGFloat = 1
    func path(in rect: CGRect) -> Path {
        var path = AWCNativeCornerShape(corners: corners).path(in: rect)
        path.addPath(awcAccordionPaddingBox(corners, in: rect, bottomBorder: width))
        return path
    }
}


/// Blink's `border-style: dashed` intervals for a rounded box: the centerline
/// rounded rect is dashed as one closed path from the end of the top-left corner,
/// clockwise, phase 0, without gap fitting (measured on Chrome captures). Dash and
/// gap follow StyledStrokeData: 3w/2w below 3px and 2w/w from 3px, w rounded.
func awcDashedBorderPattern(_ width: Double) -> [CGFloat] {
    let w = max(1, width.rounded())
    return w >= 3 ? [w * 2, w] : [w * 3, w * 2]
}

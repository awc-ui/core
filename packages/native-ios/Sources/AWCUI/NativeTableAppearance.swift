import SwiftUI

// md-table family appearance: the source's 52 public custom properties (md-table 18, md-table-cell 10, md-table-container 5,
// md-table-expand-toggle 1, md-table-pagination 5, md-table-row 1, md-table-sort-label 5, md-table-toolbar 7).
//
// Like CSS custom properties they inherit down the family: authored `style` declarations on any family node,
// `.awcTableHooks("--md-table-…: …")` and the typed appearance modifiers all feed one variable map in the environment, and
// each part reads the variables it uses (a cell reads its own declarations over its row's over the table's).

/// The family's custom properties as CSS values, inherited down the family.
struct AWCTableVars: Equatable {
    var values: [String: String] = [:]
    init() {}
    init(_ values: [String: String]) { self.values = values }
    /// `style="--md-table-…: value; …"` (other declarations are ignored).
    init(style: String?) {
        guard let style else { return }
        var depth = 0, current = "", decls: [String] = []
        for c in style {
            if c == "(" { depth += 1 } else if c == ")" { depth = Swift.max(0, depth - 1) }
            if c == ";" && depth == 0 { decls.append(current); current = "" } else { current.append(c) }
        }
        decls.append(current)
        for decl in decls {
            guard let colon = decl.firstIndex(of: ":") else { continue }
            let k = decl[..<colon].trimmingCharacters(in: .whitespaces), v = decl[decl.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            if k.hasPrefix("--md-table") && !v.isEmpty { values[k] = v }
        }
    }
    func merging(_ o: AWCTableVars) -> AWCTableVars { o.values.isEmpty ? self : AWCTableVars(values.merging(o.values) { _, new in new }) }
    func merging(style: String?) -> AWCTableVars { merging(AWCTableVars(style: style)) }
    subscript(_ name: String) -> String? { values[name] }
    func length(_ name: String) -> Double? { values[name].flatMap(AWCTableTemplate.length) }
    func color(_ name: String) -> String? { values[name].flatMap { AWCTableColor.parse($0) == nil ? nil : $0 } }
    func number(_ name: String) -> Double? { values[name].flatMap { Double($0.trimmingCharacters(in: .whitespaces)) } }
    /// `<angle>` in deg, rad, grad or turn.
    func angle(_ name: String) -> Double? {
        guard let v = values[name]?.trimmingCharacters(in: .whitespaces).lowercased() else { return nil }
        for (unit, scale) in [("deg", 1.0), ("grad", 0.9), ("rad", 180 / Double.pi), ("turn", 360.0)] where v.hasSuffix(unit) {
            return Double(v.dropLast(unit.count)).map { $0 * scale }
        }
        return Double(v) == 0 ? 0 : nil
    }
    /// A `transition` value's first time (ms); `none` / `0s` → 0.
    func duration(_ name: String) -> Double? {
        guard let v = values[name]?.trimmingCharacters(in: .whitespaces).lowercased() else { return nil }
        if v == "none" { return 0 }
        for token in v.split(separator: " ") {
            if token.hasSuffix("ms"), let n = Double(token.dropLast(2)) { return n }
            if token.hasSuffix("s"), let n = Double(token.dropLast()) { return n * 1000 }
        }
        return nil
    }
    func shadow(_ name: String) -> [AWCBoxShadow]? { values[name].flatMap { AWCBoxShadow.source($0) } }
}
private struct AWCTableVarsKey: EnvironmentKey { static let defaultValue = AWCTableVars() }
extension EnvironmentValues {
    var awcTableVars: AWCTableVars { get { self[AWCTableVarsKey.self] } set { self[AWCTableVarsKey.self] = newValue } }
}
private struct AWCTableVarsModifier: ViewModifier {
    let vars: AWCTableVars
    @Environment(\.awcTableVars) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcTableVars, inherited.merging(vars)) }
}
extension View {
    func awcTableVars(_ vars: AWCTableVars) -> some View { modifier(AWCTableVarsModifier(vars: vars)) }
}
public extension View {
    /// Applies the family's public CSS hooks as a `--md-table-*` declaration list (e.g. `"--md-table-head-bg: #fde7f3"`).
    func awcTableHooks(_ declarations: String) -> some View { awcTableVars(AWCTableVars(style: declarations)) }
    func awcTableAppearance(_ appearance: AWCTableAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableCellAppearance(_ appearance: AWCTableCellAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableContainerAppearance(_ appearance: AWCTableContainerAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableExpandToggleAppearance(_ appearance: AWCTableExpandToggleAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTablePaginationAppearance(_ appearance: AWCTablePaginationAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableRowAppearance(_ appearance: AWCTableRowAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableSortLabelAppearance(_ appearance: AWCTableSortLabelAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
    func awcTableToolbarAppearance(_ appearance: AWCTableToolbarAppearance) -> some View { awcTableVars(AWCTableVars(appearance.declarations)) }
}

// MARK: Typed values → CSS declarations

/// One typed hook value; invalid values are dropped (like an invalid CSS declaration).
enum AWCTableHookValue {
    case color(String?), length(Double?), opacity(Double?), duration(Double?), angle(Double?), text(String?), display(String?)
    case shadow([AWCBoxShadow]?), corners(AWCCornerShape?)
    var css: String? {
        func n(_ v: Double) -> String { v == v.rounded() && abs(v) < 1e15 ? String(Int(v)) : String(v) }
        switch self {
        case .color(let v):
            guard let v, v.range(of: "^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$", options: .regularExpression) != nil else { return nil }
            return v.uppercased()
        case .length(let v): guard let v, v.isFinite, v >= 0 else { return nil }; return n(v) + "px"
        case .opacity(let v): guard let v, v.isFinite, v >= 0, v <= 1 else { return nil }; return n(v)
        case .duration(let v): guard let v, v.isFinite, v >= 0 else { return nil }; return n(v) + "ms"
        case .angle(let v): guard let v, v.isFinite else { return nil }; return n(v) + "deg"
        case .text(let v):
            guard let v = v?.trimmingCharacters(in: .whitespaces), !v.isEmpty, v.count <= 512, v.rangeOfCharacter(from: CharacterSet(charactersIn: ";{}<>\\")) == nil else { return nil }
            return v
        case .display(let v): guard let v, ["inline-flex", "none"].contains(v) else { return nil }; return v
        case .shadow(let v):
            guard let v, v.allSatisfy(\.valid) else { return nil }
            if v.isEmpty { return "none" }
            return v.map { "\($0.inset ? "inset " : "")\(n($0.x))px \(n($0.y))px \(n($0.blur))px \(n($0.spread))px \($0.color)" }.joined(separator: ", ")
        case .corners(let v):
            guard let v, v.valid else { return nil }
            func l(_ c: AWCCornerLength) -> String { c.fraction == 0 ? n(c.points) + "px" : c.points == 0 ? n(c.fraction * 100) + "%" : "calc(\(n(c.fraction * 100))% + \(n(c.points))px)" }
            let corners = [v.topLeft, v.topRight, v.bottomRight, v.bottomLeft]
            let h = corners.map { l($0.x) }.joined(separator: " "), w = corners.map { l($0.y) }.joined(separator: " ")
            return h == w ? h : h + " / " + w
        }
    }
}
private func awcTableDeclarations(_ prefix: String, _ fields: [(String, AWCTableHookValue)]) -> [String: String] {
    var out: [String: String] = [:]
    for (suffix, value) in fields { if let css = value.css { out["--md-\(prefix)-\(suffix)"] = css } }
    return out
}
private extension Dictionary where Key == String, Value == AWCValue {
    func text(_ k: String) -> String? { self[k]?.string.isEmpty == false ? self[k]?.string : nil }
    func number(_ k: String) -> Double? { self[k]?.number }
    func shadow(_ k: String) -> [AWCBoxShadow]? {
        guard case .array(let a) = self[k] else { return nil }
        let r = a.compactMap { v -> AWCBoxShadow? in guard case .object(let f) = v else { return nil }; return .init(values: f) }
        return r.count == a.count ? r : nil
    }
    func corners(_ k: String) -> AWCCornerShape? { guard case .object(let v) = self[k] else { return nil }; return AWCCornerShape(values: v) }
}

/// md-table's eighteen hooks.
public struct AWCTableAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(rowHeightCompact: Double? = nil, rowHeightStandard: Double? = nil, rowHeightComfortable: Double? = nil, headerHeight: Double? = nil,
                cellPaddingInline: Double? = nil, cellPaddingBlock: Double? = nil, dividerColor: String? = nil, stripeColor: String? = nil,
                headBackground: String? = nil, headColor: String? = nil, footBackground: String? = nil, rowHoverColor: String? = nil,
                rowSelectedBackground: String? = nil, rowSelectedColor: String? = nil, columnsTemplate: String? = nil, minWidth: Double? = nil,
                bodyMaxHeight: Double? = nil, emptyMinHeight: Double? = nil) {
        declarations = awcTableDeclarations("table", [
            ("row-height-compact", .length(rowHeightCompact)), ("row-height-standard", .length(rowHeightStandard)), ("row-height-comfortable", .length(rowHeightComfortable)),
            ("header-height", .length(headerHeight)), ("cell-padding-inline", .length(cellPaddingInline)), ("cell-padding-block", .length(cellPaddingBlock)),
            ("divider-color", .color(dividerColor)), ("stripe-color", .color(stripeColor)), ("head-bg", .color(headBackground)), ("head-color", .color(headColor)),
            ("foot-bg", .color(footBackground)), ("row-hover-color", .color(rowHoverColor)), ("row-selected-bg", .color(rowSelectedBackground)),
            ("row-selected-color", .color(rowSelectedColor)), ("columns-template", .text(columnsTemplate)), ("min-width", .length(minWidth)),
            ("body-max-h", .length(bodyMaxHeight)), ("empty-min-height", .length(emptyMinHeight))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(rowHeightCompact: v.number("rowHeightCompact"), rowHeightStandard: v.number("rowHeightStandard"), rowHeightComfortable: v.number("rowHeightComfortable"),
                  headerHeight: v.number("headerHeight"), cellPaddingInline: v.number("cellPaddingInline"), cellPaddingBlock: v.number("cellPaddingBlock"),
                  dividerColor: v.text("dividerColor"), stripeColor: v.text("stripeColor"), headBackground: v.text("headBackground"), headColor: v.text("headColor"),
                  footBackground: v.text("footBackground"), rowHoverColor: v.text("rowHoverColor"), rowSelectedBackground: v.text("rowSelectedBackground"),
                  rowSelectedColor: v.text("rowSelectedColor"), columnsTemplate: v.text("columnsTemplate"), minWidth: v.number("minWidth"),
                  bodyMaxHeight: v.number("bodyMaxHeight"), emptyMinHeight: v.number("emptyMinHeight"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-cell's ten hooks.
public struct AWCTableCellAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(color: String? = nil, background: String? = nil, paddingInline: Double? = nil, paddingBlock: Double? = nil, minHeight: Double? = nil,
                stickyBackground: String? = nil, stickyTransition: Double? = nil, pinDisplay: String? = nil, pinColor: String? = nil, pinSize: Double? = nil) {
        declarations = awcTableDeclarations("table-cell", [
            ("color", .color(color)), ("background", .color(background)), ("padding-inline", .length(paddingInline)), ("padding-block", .length(paddingBlock)),
            ("min-height", .length(minHeight)), ("sticky-bg", .color(stickyBackground)), ("sticky-transition", .duration(stickyTransition)),
            ("pin-display", .display(pinDisplay)), ("pin-color", .color(pinColor)), ("pin-size", .length(pinSize))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(color: v.text("color"), background: v.text("background"), paddingInline: v.number("paddingInline"), paddingBlock: v.number("paddingBlock"),
                  minHeight: v.number("minHeight"), stickyBackground: v.text("stickyBackground"), stickyTransition: v.number("stickyTransition"),
                  pinDisplay: v.text("pinDisplay"), pinColor: v.text("pinColor"), pinSize: v.number("pinSize"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-container's five hooks.
public struct AWCTableContainerAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(color: String? = nil, shape: AWCCornerShape? = nil, elevation: [AWCBoxShadow]? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil) {
        declarations = awcTableDeclarations("table-container", [("color", .color(color)), ("shape", .corners(shape)), ("elevation", .shadow(elevation)),
                                                                ("outline-color", .color(outlineColor)), ("outline-width", .length(outlineWidth))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(color: v.text("color"), shape: v.corners("shape"), elevation: v.shadow("elevation"), outlineColor: v.text("outlineColor"), outlineWidth: v.number("outlineWidth"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-expand-toggle's hook.
public struct AWCTableExpandToggleAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    /// The caret's rotation while its row is expanded, in degrees.
    public init(rotation: Double? = nil) { declarations = awcTableDeclarations("table-expand-toggle", [("rotation", .angle(rotation))]) }
    public init(values v: [String: AWCValue]) { self.init(rotation: v.number("rotation")) }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-pagination's five hooks.
public struct AWCTablePaginationAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(color: String? = nil, background: String? = nil, paddingBlock: Double? = nil, paddingInline: Double? = nil, selectWidth: Double? = nil) {
        declarations = awcTableDeclarations("table-pagination", [("color", .color(color)), ("bg", .color(background)), ("padding-block", .length(paddingBlock)),
                                                                 ("padding-inline", .length(paddingInline)), ("select-width", .length(selectWidth))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(color: v.text("color"), background: v.text("background"), paddingBlock: v.number("paddingBlock"), paddingInline: v.number("paddingInline"), selectWidth: v.number("selectWidth"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-row's hook.
public struct AWCTableRowAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(hoverColor: String? = nil) { declarations = awcTableDeclarations("table-row", [("hover-color", .color(hoverColor))]) }
    public init(values v: [String: AWCValue]) { self.init(hoverColor: v.text("hoverColor")) }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-sort-label's five hooks.
public struct AWCTableSortLabelAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(color: String? = nil, activeColor: String? = nil, iconSize: Double? = nil, gap: Double? = nil, restOpacity: Double? = nil) {
        declarations = awcTableDeclarations("table-sort-label", [("color", .color(color)), ("active-color", .color(activeColor)), ("icon-size", .length(iconSize)),
                                                                 ("gap", .length(gap)), ("rest-opacity", .opacity(restOpacity))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(color: v.text("color"), activeColor: v.text("activeColor"), iconSize: v.number("iconSize"), gap: v.number("gap"), restOpacity: v.number("restOpacity"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}
/// md-table-toolbar's seven hooks.
public struct AWCTableToolbarAppearance: Equatable, Sendable {
    let declarations: [String: String]
    private init(declarations: [String: String]) { self.declarations = declarations }
    public init(color: String? = nil, background: String? = nil, selectionBackground: String? = nil, selectionColor: String? = nil,
                paddingBlock: Double? = nil, paddingInline: Double? = nil, minHeight: Double? = nil) {
        declarations = awcTableDeclarations("table-toolbar", [("color", .color(color)), ("bg", .color(background)), ("selection-bg", .color(selectionBackground)),
                                                              ("selection-color", .color(selectionColor)), ("padding-block", .length(paddingBlock)),
                                                              ("padding-inline", .length(paddingInline)), ("min-height", .length(minHeight))])
    }
    public init(values v: [String: AWCValue]) {
        self.init(color: v.text("color"), background: v.text("background"), selectionBackground: v.text("selectionBackground"), selectionColor: v.text("selectionColor"),
                  paddingBlock: v.number("paddingBlock"), paddingInline: v.number("paddingInline"), minHeight: v.number("minHeight"))
    }
    public func merging(_ o: Self) -> Self { .init(declarations: declarations.merging(o.declarations) { _, new in new }) }
}

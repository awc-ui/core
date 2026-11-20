import SwiftUI

public enum AWCAccordionItemPart: String, CaseIterable, Sendable, Hashable {
    case heading, header
    case stateLayer = "state-layer", dragHandle = "drag-handle"
    case chassisHandle = "chassis-handle", chassisHandleBar = "chassis-handle-bar"
    case leadingIcon = "leading-icon", trailingIcon = "trailing-icon"
    case headline, supportingText = "supporting-text"
    case panel, content, contentInner = "content-inner"
}

/// Sparse native declarations for an exported accordion surface. Physical
/// edges follow the source CSS box, including when layout direction is RTL.
/// Typography inherits only where the source part inherits it.
public struct AWCAccordionPartAppearance: Equatable, Sendable {
    public let color: String?, backgroundColor: String?, borderColor: String?
    public let borderWidth: Double?, cornerShape: AWCCornerShape?
    public let padding: AWCAccordionInsets?, margin: AWCAccordionInsets?
    public let width: Double?, height: Double?, minHeight: Double?
    public let opacity: Double?, gap: Double?
    public let fontSize: Double?, lineHeight: Double?, fontWeight: Double?, letterSpacing: Double?

    public init(color: String? = nil, backgroundColor: String? = nil, borderColor: String? = nil,
                borderWidth: Double? = nil, cornerShape: AWCCornerShape? = nil,
                padding: AWCAccordionInsets? = nil, margin: AWCAccordionInsets? = nil,
                width: Double? = nil, height: Double? = nil, minHeight: Double? = nil,
                opacity: Double? = nil, gap: Double? = nil, fontSize: Double? = nil,
                lineHeight: Double? = nil, fontWeight: Double? = nil, letterSpacing: Double? = nil) {
        func rgba(_ v: String?) -> String? { v.flatMap { $0.range(of:"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",options:.regularExpression) != nil ? $0.uppercased():nil } }
        func positive(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0>=0 ? $0:nil } }
        self.color=rgba(color); self.backgroundColor=rgba(backgroundColor); self.borderColor=rgba(borderColor)
        self.borderWidth=positive(borderWidth); self.cornerShape=cornerShape.flatMap { $0.valid ? $0:nil }
        self.padding=padding.flatMap { $0.valid ? $0:nil }
        self.margin=margin.flatMap { [$0.top,$0.right,$0.bottom,$0.left].allSatisfy(\.isFinite) ? $0:nil }
        self.width=positive(width); self.height=positive(height); self.minHeight=positive(minHeight)
        self.opacity=opacity.flatMap { $0.isFinite ? min(1,max(0,$0)):nil }; self.gap=positive(gap)
        self.fontSize=positive(fontSize); self.lineHeight=positive(lineHeight)
        self.fontWeight=fontWeight.flatMap { $0.isFinite && (1...1000).contains($0) ? $0:nil }
        self.letterSpacing=letterSpacing.flatMap { $0.isFinite ? $0:nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { guard case .string(let v)=values[k] else {return nil}; return v }
        func number(_ k: String) -> Double? { guard case .number(let v)=values[k] else {return nil}; return v }
        func edges(_ k: String) -> AWCAccordionInsets? {
            guard case .object(let v)=values[k], Set(v.keys).isSubset(of:["top","right","bottom","left"]),
                  case .number(let top)=v["top"], case .number(let right)=v["right"],
                  case .number(let bottom)=v["bottom"], case .number(let left)=v["left"] else {return nil}
            return .init(top:top,right:right,bottom:bottom,left:left)
        }
        let shape: AWCCornerShape?
        if case .object(let v)=values["cornerShape"] {shape = .init(values:v)} else {shape=nil}
        self.init(color:text("color"),backgroundColor:text("backgroundColor"),borderColor:text("borderColor"),
                  borderWidth:number("borderWidth"),cornerShape:shape,padding:edges("padding"),margin:edges("margin"),
                  width:number("width"),height:number("height"),minHeight:number("minHeight"),opacity:number("opacity"),
                  gap:number("gap"),fontSize:number("fontSize"),lineHeight:number("lineHeight"),fontWeight:number("fontWeight"),letterSpacing:number("letterSpacing"))
    }
    public func merging(_ local: Self) -> Self {
        .init(color:local.color ?? color,backgroundColor:local.backgroundColor ?? backgroundColor,
              borderColor:local.borderColor ?? borderColor,borderWidth:local.borderWidth ?? borderWidth,
              cornerShape:local.cornerShape ?? cornerShape,padding:local.padding ?? padding,margin:local.margin ?? margin,
              width:local.width ?? width,height:local.height ?? height,minHeight:local.minHeight ?? minHeight,
              opacity:local.opacity ?? opacity,gap:local.gap ?? gap,fontSize:local.fontSize ?? fontSize,
              lineHeight:local.lineHeight ?? lineHeight,fontWeight:local.fontWeight ?? fontWeight,letterSpacing:local.letterSpacing ?? letterSpacing)
    }
    var verticalEdges: Double { (padding?.top ?? 0)+(padding?.bottom ?? 0)+2*(borderWidth ?? 0) }
    var horizontalEdges: Double { (padding?.left ?? 0)+(padding?.right ?? 0)+2*(borderWidth ?? 0) }
}
private struct AWCAccordionPartsKey: EnvironmentKey {
    static let defaultValue: [AWCAccordionItemPart:AWCAccordionPartAppearance]=[:]
}
private struct AWCAccordionPartTargetsKey: EnvironmentKey {
    static let defaultValue: [String:[AWCAccordionItemPart:AWCAccordionPartAppearance]]=[:]
}
extension EnvironmentValues {
    var awcAccordionItemParts: [AWCAccordionItemPart:AWCAccordionPartAppearance] { get {self[AWCAccordionPartsKey.self]} set {self[AWCAccordionPartsKey.self]=newValue} }
    var awcAccordionItemPartTargets: [String:[AWCAccordionItemPart:AWCAccordionPartAppearance]] { get {self[AWCAccordionPartTargetsKey.self]} set {self[AWCAccordionPartTargetsKey.self]=newValue} }
}
private struct AWCAccordionPartModifier: ViewModifier {
    let part: AWCAccordionItemPart, value: AWCAccordionPartAppearance, id: String?
    @Environment(\.awcAccordionItemParts) private var inherited
    @Environment(\.awcAccordionItemPartTargets) private var targets
    @ViewBuilder func body(content: Content) -> some View {
        if let id {
            let updated: [String:[AWCAccordionItemPart:AWCAccordionPartAppearance]] = {
                var updated=targets
                updated[id,default:[:]][part]=(targets[id]?[part] ?? .init()).merging(value)
                return updated
            }()
            content.environment(\.awcAccordionItemPartTargets,updated)
        } else {
            let updated=inherited.merging([part:(inherited[part] ?? .init()).merging(value)]) {_,local in local}
            content.environment(\.awcAccordionItemParts,updated)
        }
    }
}
public extension View {
    func awcAccordionItemPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCAccordionItemPart, for id: String? = nil) -> some View {
        modifier(AWCAccordionPartModifier(part:part,value:value,id:id))
    }
}

/// Paint and size a CSS-equivalent content box. Header uses border-box sizing;
/// other parts use content-box sizing. Margin belongs outside inspection bounds.
struct AWCAccordionPartBox: ViewModifier {
    let value: AWCAccordionPartAppearance
    var defaultPadding=AWCAccordionInsets(block:0,inline:0)
    var defaultShape=AWCCornerShape.points(0)
    var background=Color.clear, borderInk=Color.black
    var borderBox=false, stretch=false, minimumHeight: Double? = nil
    var clip=false, applyOpacity=true
    @Environment(\.layoutDirection) private var direction
    func body(content: Content) -> some View {
        let padding=value.padding ?? defaultPadding, border=value.borderWidth ?? 0
        let shape=AWCNativeCornerShape(corners:value.cornerShape ?? defaultShape)
        let extraX=borderBox ? 0:padding.left+padding.right+2*border
        let extraY=borderBox ? 0:padding.top+padding.bottom+2*border
        let surface=content.padding(padding.edges(rtl:direction == .rightToLeft)).padding(border)
            .frame(width:value.width.map{$0+extraX},height:value.height.map{$0+extraY})
            .frame(maxWidth:stretch && value.width==nil ? .infinity:nil,
                   minHeight:(value.minHeight ?? minimumHeight).map{$0+extraY},alignment:.leading)
            .background { shape.fill(value.backgroundColor.map{Color(awcHex:$0)} ?? background) }
            .overlay { if border>0 {shape.strokeBorder(value.borderColor.map{Color(awcHex:$0)} ?? borderInk,lineWidth:border)} }
            .opacity(applyOpacity ? value.opacity ?? 1:1)
        if clip { surface.clipShape(shape) } else {surface}
    }
}
struct AWCAccordionPartMargin: ViewModifier {
    let value: AWCAccordionPartAppearance
    @Environment(\.layoutDirection) private var direction
    func body(content: Content) -> some View { content.padding((value.margin ?? .init(block:0,inline:0)).edges(rtl:direction == .rightToLeft)) }
}

func awcAccordionCollapsedMargin(_ margins:Double...)->Double {
    max(0,margins.max() ?? 0)+min(0,margins.min() ?? 0)
}

/// The header declares width:100%; its margins therefore overflow that width
/// instead of shrinking it. The physical over-constraint follows direction.
private struct AWCAccordionHeaderMarginLayout: Layout {
    let margins:AWCAccordionInsets, rtl:Bool
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let child=subviews.first?.sizeThatFits(.init(width:proposal.width,height:nil)) ?? .zero
        return .init(width:proposal.width ?? child.width+margins.left+margins.right,height:max(0,child.height+margins.top+margins.bottom))
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        guard let child=subviews.first else{return}
        let natural=child.sizeThatFits(.init(width:bounds.width,height:nil))
        let x=rtl ? bounds.maxX-natural.width-margins.right:bounds.minX+margins.left
        child.place(at:.init(x:x,y:bounds.minY+margins.top),anchor:.topLeading,proposal:.init(width:bounds.width,height:natural.height))
    }
}
struct AWCAccordionHeaderMargin: ViewModifier {
    let margins:AWCAccordionInsets
    @Environment(\.layoutDirection) private var direction
    func body(content:Content)->some View {
        AWCAccordionHeaderMarginLayout(margins:margins,rtl:direction == .rightToLeft) {
            content.environment(\.layoutDirection,direction)
        }.environment(\.layoutDirection,.leftToRight)
    }
}

/// In-flow heading/panel margins collapse with each other, but remain inside
/// the custom element's shadow-root boundary. Grid content margins do not.
struct AWCAccordionBlockStack: Layout {
    let top:Double, between:Double, bottom:Double
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize {
        let sizes=subviews.map{$0.sizeThatFits(.init(width:proposal.width,height:nil))}
        return .init(width:proposal.width ?? sizes.map(\.width).max() ?? 0,height:max(0,sizes.reduce(0){$0+$1.height}+top+between+bottom))
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()) {
        var y=bounds.minY+top
        for (index,child) in subviews.enumerated() {
            let natural=child.sizeThatFits(.init(width:bounds.width,height:nil))
            child.place(at:.init(x:bounds.minX,y:y),anchor:.topLeading,proposal:.init(width:bounds.width,height:natural.height))
            y+=natural.height+(index==0 ? between:0)
        }
    }
}

/// md-accordion's own exported part (`::part(drop-placeholder)`).
public enum AWCAccordionPart: String, CaseIterable, Sendable, Hashable { case dropPlaceholder = "drop-placeholder" }
private struct AWCAccordionGroupPartsKey: EnvironmentKey { static let defaultValue: [AWCAccordionPart: AWCAccordionPartAppearance] = [:] }
private struct AWCAccordionGroupPartTargetsKey: EnvironmentKey { static let defaultValue: [String: [AWCAccordionPart: AWCAccordionPartAppearance]] = [:] }
extension EnvironmentValues {
    var awcAccordionParts: [AWCAccordionPart: AWCAccordionPartAppearance] { get { self[AWCAccordionGroupPartsKey.self] } set { self[AWCAccordionGroupPartsKey.self] = newValue } }
    var awcAccordionPartTargets: [String: [AWCAccordionPart: AWCAccordionPartAppearance]] { get { self[AWCAccordionGroupPartTargetsKey.self] } set { self[AWCAccordionGroupPartTargetsKey.self] = newValue } }
}
private struct AWCAccordionGroupPartModifier: ViewModifier {
    let part: AWCAccordionPart, value: AWCAccordionPartAppearance, id: String?
    @Environment(\.awcAccordionParts) private var inherited
    @Environment(\.awcAccordionPartTargets) private var targets
    @ViewBuilder func body(content: Content) -> some View {
        if let id {
            let updated: [String: [AWCAccordionPart: AWCAccordionPartAppearance]] = { var u = targets; u[id, default: [:]][part] = (targets[id]?[part] ?? .init()).merging(value); return u }()
            content.environment(\.awcAccordionPartTargets, updated)
        } else {
            let updated: [AWCAccordionPart: AWCAccordionPartAppearance] = { var u = inherited; u[part] = (inherited[part] ?? .init()).merging(value); return u }()
            content.environment(\.awcAccordionParts, updated)
        }
    }
}
public extension View {
    /// `md-accordion::part(drop-placeholder)`: fill (backgroundColor), dashed outline (borderColor, borderWidth), cornerShape, opacity.
    func awcAccordionPartAppearance(_ value: AWCAccordionPartAppearance, part: AWCAccordionPart, for id: String? = nil) -> some View {
        modifier(AWCAccordionGroupPartModifier(part: part, value: value, id: id))
    }
}
/// A part's border box: its declared corner shape, else the source's pill (border-radius: 999px).
struct AWCAccordionPartShape: Shape {
    let corners: AWCCornerShape?
    func path(in rect: CGRect) -> Path { corners.map { AWCNativeCornerShape(corners: $0).path(in: rect) } ?? Capsule().path(in: rect) }
}

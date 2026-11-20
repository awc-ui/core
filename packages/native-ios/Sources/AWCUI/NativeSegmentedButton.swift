import SwiftUI

struct AWCNativeSegmentedMetrics {
    let density: Double
    let height: CGFloat, icon: CGFloat, font: CGFloat, line: CGFloat, tracking: CGFloat, padding: CGFloat, gap: CGFloat, radius: CGFloat
    let weight: Double
    let first: Bool, last: Bool
    var margin: CGFloat { last && !first ? -1 : 0 }
    init(properties: [String: AWCValue], inheritedDensity: Double, denseInset: Bool, appearance: AWCSegmentedButtonAppearance, tokens: [String: String]) {
        let raw = abs(properties["segmentDensity"]?.number ?? 0)
        let classDensity = [1.0,2,3,4].contains(raw) ? -raw : inheritedDensity
        density = AWCNativeDensity.resolve(properties["density"]?.number, inherited: classDensity)
        height = CGFloat(40 + density * 4); icon = CGFloat(appearance.iconSize ?? max(14,18+density))
        font = CGFloat(max(12,14+density*0.5)); line = CGFloat(max(16,20+density))
        tracking = CGFloat(awcFabMenuToken(tokens,"--md-sys-typescale-label-large-letter-spacing",0.1))
        weight = awcFabMenuToken(tokens,"--md-sys-typescale-label-large-font-weight",500)
        let compressed = denseInset || [-2.0,-3,-4].contains(properties["density"]?.number ?? 0)
        padding = CGFloat(compressed ? 8 : awcFabMenuToken(tokens,"--md-sys-spacing-inset-md",12))
        gap = CGFloat(max(4,8+density))
        radius = CGFloat(appearance.cornerRadius ?? awcFabMenuToken(tokens,"--md-sys-shape-corner-full",9999))
        let index = properties["segmentIndex"]?.number ?? 0
        first = index == 0; last = index == (properties["segmentTotal"]?.number ?? 1)-1
    }
}
/// Reports a text run's exact (fractional) advance as its width, so containers size like CSS; the Text keeps its pixel-rounded
/// ideal size from the start edge (overflowing by less than one device pixel). nil keeps the natural width.
struct AWCExactTextWidth: Layout {
    let width: CGFloat?
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let natural = subviews.first?.sizeThatFits(.unspecified) ?? .zero
        return .init(width: width ?? natural.width, height: natural.height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let text = subviews.first else { return }
        text.place(at: .init(x: bounds.minX, y: bounds.midY), anchor: .leading, proposal: .init(text.sizeThatFits(.unspecified)))
    }
}
struct AWCNativeSegmentedLayout: Layout {
    let metrics: AWCNativeSegmentedMetrics
    let stretch: Bool
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let content = subviews.first?.sizeThatFits(.unspecified) ?? .zero
        let natural = content.width + metrics.padding * 2
        return .init(width: max(metrics.padding * 2, stretch ? proposal.width ?? natural : min(natural,proposal.width ?? natural)),
                     height: max(metrics.height,content.height,stretch ? proposal.height ?? 0:0))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let content = subviews.first else { return }
        let natural = content.sizeThatFits(.unspecified)
        content.place(at: .init(x:bounds.midX-natural.width/2,y:bounds.midY-natural.height/2),anchor:.topLeading,proposal:.init(natural))
    }
}
struct AWCSegmentedShape: InsettableShape {
    let start: CGFloat, end: CGFloat, rtl: Bool
    var inset: CGFloat = 0
    // start/end are mapped to physical corners through rtl; SwiftUI must not mirror the path again.
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }
    func path(in rect: CGRect) -> Path {
        let box=rect.insetBy(dx:inset,dy:inset)
        let desiredLeft=max(0,(rtl ? end:start)-inset),desiredRight=max(0,(rtl ? start:end)-inset)
        // CSS scales all radii together when adjacent radii exceed an edge.
        // A single rounded end may use the whole width, not only width/2.
        let horizontal=desiredLeft+desiredRight
        let scale=min(1,horizontal>0 ? max(0,box.width)/horizontal:1,
                      desiredLeft>0 ? max(0,box.height)/(2*desiredLeft):1,
                      desiredRight>0 ? max(0,box.height)/(2*desiredRight):1)
        let left=desiredLeft*scale,right=desiredRight*scale
        return UnevenRoundedRectangle(topLeadingRadius:left,bottomLeadingRadius:left,bottomTrailingRadius:right,topTrailingRadius:right,style:.circular).path(in:box)
    }
    func inset(by amount: CGFloat) -> Self { var result=self;result.inset += amount;return result }
}
private struct AWCSegmentedStyle: ButtonStyle {
    let id:String, metrics:AWCNativeSegmentedMetrics, appearance:AWCSegmentedButtonAppearance, theme:AWCTheme
    let selected:Bool, disabled:Bool, focused:Bool, nativePressed:Bool, activation:Int, ripple:Bool, stretch:Bool
    let pointerPressed:()->Void
    func makeBody(configuration:Configuration)->some View { AWCSegmentedSurface(style:self,configuration:configuration) }
}
private struct AWCSegmentedSurface: View {
    let style:AWCSegmentedStyle, configuration:ButtonStyleConfiguration
    @State private var hovered=false
    @State private var frame=CGRect.zero
    @State private var localOrigin:CGPoint?
    @State private var localDown=false
    @Environment(\.awcNativePointerState) private var pointer
    @Environment(\.awcTouchPress) private var touchPress
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcReducedMotion) private var reducedOverride
    private var reduceMotion: Bool { reducedOverride ?? systemReduceMotion }
    private var tokens:[String:String] { style.theme.tokens.isEmpty ? AWCGeneratedTokens.light:style.theme.tokens }
    private func color(_ role:String)->Color { Color(awcHex:tokens["--md-sys-color-"+role] ?? "#000000") }
    private var m:AWCNativeSegmentedMetrics {style.metrics}
    private var rtl:Bool {direction == .rightToLeft}
    private var pressed:Bool {configuration.awcPressed(touchPress) && !style.disabled}
    private var hover:Bool {pointer.map{$0.location.map(frame.contains) ?? false} ?? hovered}
    private var ink:Color {
        if style.disabled {return color("on-surface").opacity(awcFabMenuToken(tokens,"--md-sys-state-disabled-content-opacity",0.38))}
        let custom=style.selected ? style.appearance.selectedLabelColor:style.appearance.labelColor
        return custom.map{Color(awcHex:$0)} ?? color(style.selected ? "on-secondary-container":"on-surface")
    }
    private var fill:Color {
        if !style.selected {return style.appearance.containerColor.map{Color(awcHex:$0)} ?? .clear}
        if style.disabled {return color("on-surface").opacity(awcFabMenuToken(tokens,"--md-sys-state-disabled-container-opacity",0.12))}
        return style.appearance.selectedContainerColor.map{Color(awcHex:$0)} ?? color("secondary-container")
    }
    private var outline:Color {
        if style.disabled {return color("on-surface").opacity(awcFabMenuToken(tokens,"--md-sys-state-disabled-container-opacity",0.12))}
        return style.appearance.outlineColor.map{Color(awcHex:$0)} ?? color("outline")
    }
    private var layer:Color {color(style.selected ? "on-secondary-container":"on-surface")}
    private var alpha:Double {
        if style.disabled {return 0}
        if pressed {return awcFabMenuToken(tokens,"--md-sys-state-pressed-state-layer-opacity",0.10)}
        if style.focused {return awcFabMenuToken(tokens,"--md-sys-state-focus-state-layer-opacity",0.10)}
        return hover ? awcFabMenuToken(tokens,"--md-sys-state-hover-state-layer-opacity",0.08):0
    }
    private var shape:AWCSegmentedShape {.init(start:m.first ? m.radius:0,end:m.last ? m.radius:0,rtl:rtl)}
    private var origin:CGPoint? {
        if let pointer,pointer.isPointerDown,let point=pointer.pressLocation {return .init(x:point.x-frame.minX,y:point.y-frame.minY)}
        return localDown ? localOrigin:nil
    }
    private var inspection:[String:AWCValue] {
        let typography:AWCValue=["size":.number(Double(m.font)),"lineHeight":.number(Double(m.line)),"weight":.number(AWCNativeFonts.resolvedLabelWeight(m.weight)),"spacing":.number(Double(m.tracking)),"family":.string(AWCNativeFonts.labelFamily(regular:m.weight<500)),"unit":"pt"]
        return ["padding":[0,.number(Double(m.padding)),0,.number(Double(m.padding))],"border":[0,0,0,0],
            "margin":[0,.number(Double(rtl ? m.margin:0)),0,.number(Double(rtl ? 0:m.margin))],"gap":["row":0,"column":.number(Double(m.gap))],
            "typography":typography,"direction":.string(rtl ? "rtl":"ltr"),"display":"SwiftUI segment"]
    }
    var body:some View {
        AWCNativeSegmentedLayout(metrics:m,stretch:style.stretch) { configuration.label }
            .foregroundStyle(ink)
            .background {
                shape.fill(fill).animation(reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.1),value:fill)
                    .overlay {shape.fill(layer).opacity(alpha).animation(reduceMotion ? nil:.timingCurve(0.2,0,0,1,duration:0.1),value:alpha).awcInspect(nodeID:style.id,part:"state-layer",name:"md-segmented-button ::part(state-layer)")}
                    .overlay {if style.ripple {AWCNativeButtonRipple(pressed:pressed,nativePressed:style.nativePressed && !style.disabled,nativeActivation:style.activation,color:layer,origin:origin).opacity(style.disabled ? 0:1)}}
            }.clipShape(shape).contentShape(shape)
            .overlay {
                if m.first || m.last {shape.strokeBorder(outline,lineWidth:1)}
                else {
                    GeometryReader {geometry in
                        Path {path in
                            let w=geometry.size.width,h=geometry.size.height
                            path.move(to:.init(x:0,y:0.5));path.addLine(to:.init(x:w,y:0.5))
                            path.move(to:.init(x:0,y:h-0.5));path.addLine(to:.init(x:w,y:h-0.5))
                            path.move(to:.init(x:rtl ? 0.5:w-0.5,y:0));path.addLine(to:.init(x:rtl ? 0.5:w-0.5,y:h))
                        }.stroke(outline,lineWidth:1)
                    }
                }
            }
            .overlay {if style.focused {shape.strokeBorder(color("secondary"),lineWidth:3)}}
            .background {GeometryReader {geometry in Color.clear.onChange(of:geometry.frame(in:.named("awc-native-preview")),initial:true){_,value in frame=value}}}
            .awcObservePointerOrigin(enabled:pointer == nil){origin,down in localOrigin=origin;localDown=down}
            .onHover{hovered=$0}.onChange(of:pressed){_,down in if down {style.pointerPressed()}}
            .awcInspect(nodeID:style.id,name:"md-segmented-button"){_ in inspection}
    }
}
extension AWCNativeView {
    /// The plain label's exact advance (label property or text-only default slot); nil for composed slot content.
    private func segmentedLabelWidth(_ m:AWCNativeSegmentedMetrics)->CGFloat? {
        let text:String? = !s("label").isEmpty ? awcCollapsedInlineText(s("label")) : node.children(inSlot:nil).allSatisfy({["#text","#slot-text"].contains($0.tag)}) ? awcCollapsedInlineText(node.children(inSlot:nil).map(\.authoredTextContent).joined()) : nil
        return text.map {CGFloat(AWCNativeFonts.tabTextWidth($0,size:m.font,weight:m.weight,tracking:Double(m.tracking)))}
    }
    @ViewBuilder private var segmentedLabelContent:some View {
        if !s("label").isEmpty {Text(awcCollapsedInlineText(s("label")))}
        else if node.children(inSlot:nil).allSatisfy({["#text","#slot-text"].contains($0.tag)}) {
            Text(awcCollapsedInlineText(node.children(inSlot:nil).map(\.authoredTextContent).joined()))
        } else {
            HStack(spacing:0) {
                ForEach(node.children(inSlot:nil)) { item in
                    if item.tag=="#slot-text" {Text(item.properties["text"]?.string ?? "")} else {child(item)}
                }
            }
        }
    }
    @ViewBuilder var nativeSegmentedButton:some View {
        if !b("hidden") {
            let properties=local.merging(segmentedContext?.state.injected[node.id] ?? [:]){_,new in new}
            let selected=segmentedContext?.state.selected[node.id] ?? properties["selected"]?.bool ?? false
            let appearance=segmentedAppearance.merging(segmentedOverrides[node.id] ?? .init())
            let metrics=AWCNativeSegmentedMetrics(properties:properties,inheritedDensity:inheritedDensity,denseInset:inheritedDenseInset,appearance:appearance,tokens:theme.tokens)
            let hasIcon = !s("icon").isEmpty, noCheckmark=b("noCheckmark"), multiple=properties["segmentMultiselect"]?.bool == true
            let hasLabel = !s("label").isEmpty || initialSegmentedLabel
            let icons=node.children(inSlot:"icon").filter{$0.tag != "#text"}
            let policy=properties.merging(["roleOverride":.string(multiple ? "checkbox":"radio"),"selected":.bool(selected),"groupTabindex":.number(b("disabled") ? -1:0)]){_,new in new}
            AWCNativeActionControl(style:{focused,pressed,activation,pointer in
                AWCSegmentedStyle(id:node.id,metrics:metrics,appearance:appearance,theme:theme,selected:selected,disabled:disabled,focused:focused,nativePressed:pressed,activation:activation,ripple:b("ripple",true),stretch:segmentedContext != nil,pointerPressed:pointer)
            },policy:.init(properties:policy),id:node.id,accessibleLabel:local["aria-label"]?.string ?? (s("label").isEmpty ? node.children(inSlot:nil).map(\.authoredTextContent).joined():s("label")),action:{source in
                guard !disabled else{return}
                var event=AWCEvent(name:"mdSegmentClick",tag:node.tag,nodeID:node.id,detail:["value":.string(s("value")),"selected":.bool(multiple ? !selected:true)])
                event.activation = .init(kind:.nativeControl,source:source)
                onEvent(AWCEventDispatcher.dispatch(event,through:eventDispatcher,cancelable:true,targetListeners:eventTargetListeners).observedEvent)
            },direction:s("dir")) {
                HStack(spacing:metrics.gap) {
                    if hasIcon || !noCheckmark {
                        let check=selected && !noCheckmark
                        AWCMaterialSymbol(check ? "check":s("icon"),size:metrics.icon)
                            .opacity(hasIcon || selected ? 1:0)
                            .awcInspect(nodeID:node.id,part:check ? "checkmark":hasIcon ? "icon":"graphic-reservation",parentPart:"content",name:check ? "md-segmented-button ::part(checkmark)":hasIcon ? "md-segmented-button ::part(icon)":"Hidden checkmark reservation")
                    }
                    ForEach(icons) { icon in
                        Group {
                            if icon.tag=="#symbol" {AWCMaterialSymbol(icon.properties["name"]?.string ?? "",size:metrics.icon)}
                            else if icon.tag=="#slot-text" {Text(icon.properties["text"]?.string ?? "")}
                            else {child(icon)}
                        }.frame(width:metrics.icon,height:metrics.icon).environment(\.awcMaterialSymbolSize,metrics.icon)
                    }
                    if hasLabel {
                        AWCExactTextWidth(width:segmentedLabelWidth(metrics)) {segmentedLabelContent.fixedSize()}.frame(minHeight:metrics.line)
                            .awcInspect(nodeID:node.id,part:"label",parentPart:"content",name:"md-segmented-button ::part(label)")
                    } else {
                        ForEach(node.children(inSlot:nil).filter{$0.tag != "#text" || !$0.authoredTextContent.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}) { item in
                            if item.tag=="#slot-text" {Text(item.properties["text"]?.string ?? "")}
                            else {child(item)}
                        }
                    }
                    if !hasIcon && !noCheckmark {Color.clear.frame(width:metrics.icon,height:0)}
                }.font(AWCNativeFonts.label(size:metrics.font,weight:metrics.weight)).tracking(metrics.tracking).fixedSize()
                    .awcInspect(nodeID:node.id,part:"content",name:"md-segmented-button content")
            }
        }
    }
}

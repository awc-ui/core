import SwiftUI

struct AWCNativeTooltipMetrics{
    let rich:Bool,density:Double,top:Double,bottom:Double,start:Double,headingGap:Double,actionsTop:Double,actionsGap:Double,minHeight:Double
    init(properties:[String:AWCValue],density:Double){
        rich=properties["variant"]?.string=="rich";self.density=density
        let rung=properties["density"]?.number ?? 0
        let small=[-3.0,-4].contains(rung) ? 4.0:8.0
        let medium=[-2.0,-3,-4].contains(rung) ? 8.0:12.0
        let large=rung == -4 ? 8.0:[-2.0,-3].contains(rung) ? 12.0:16.0
        top=rich ? medium:4;bottom=rich ? small:4;start=rich ? large:small
        headingGap=rung == -4 ? 2:4;actionsTop=rung == -4 ? 4:[-2.0,-3].contains(rung) ? 8:12
        actionsGap=[-3.0,-4].contains(rung) ? 4:8;minHeight=rich ? 0:max(20,24+density)
    }
    func text(_ value:String,heading:Bool=false,part:AWCTooltipPartAppearance = .init())->AWCNativeMeterText{
        .init(text:value,size:part.fontSize ?? (rich ? max(11,14+density*0.5):max(10,12+density*0.5)),lineHeight:part.lineHeight ?? (rich ? max(16,20+density):max(14,16+density*0.5)),weight:part.fontWeight ?? (heading ? 500:400),spacing:part.letterSpacing ?? (rich ? heading ? 0.1:0.25:0.4),tabular:false,wrapAnywhere:!rich)
    }
}
struct AWCNativeTooltipPosition{
    let origin:CGPoint,placement:String
    var animationAnchor:UnitPoint{placement.hasPrefix("top") ? .bottom:placement.hasPrefix("bottom") ? .top:placement.hasPrefix("left") ? .trailing:.leading}
    static func resolve(anchor:CGRect,popup:CGSize,viewport:CGSize,properties:[String:AWCValue],rtl:Bool)->Self{
        let raw=properties["position"]?.string ?? "top",parts=raw.split(separator:"-").map(String.init)
        var axis=parts.first ?? "top",align=parts.count>1 ? parts[1]:""
        if !["top","bottom","left","right"].contains(axis){axis="top"}
        if rtl{if axis=="left"{axis="right"}else if axis=="right"{axis="left"}else{align=align=="start" ? "end":align=="end" ? "start":align}}
        let preferred=axis+(align.isEmpty ? "":"-"+align),w=floor(Double(popup.width)+0.5),h=floor(Double(popup.height)+0.5)
        let offset=properties["offset"]?.number ?? 8,cross=properties["crossOffset"]?.number ?? 0,auto=properties["autoPosition"]?.bool ?? true
        func coords(_ p:String)->CGPoint{
            let side=p.split(separator:"-").first.map(String.init) ?? "top",suffix=p.split(separator:"-").last.map(String.init) ?? ""
            let vertical=side=="top" || side=="bottom"
            if vertical{return .init(x:suffix=="start" ? anchor.minX:suffix=="end" ? anchor.maxX-w:anchor.minX+(anchor.width-w)/2,y:side=="top" ? anchor.minY-h-offset:anchor.maxY+offset)}
            return .init(x:side=="left" ? anchor.minX-w-offset:anchor.maxX+offset,y:suffix=="start" ? anchor.minY:suffix=="end" ? anchor.maxY-h:anchor.minY+(anchor.height-h)/2)
        }
        func fits(_ p:String)->Bool{let point=coords(p);return p.hasPrefix("top") || p.hasPrefix("bottom") ? point.y>=0 && point.y+h<=viewport.height:point.x>=0 && point.x+w<=viewport.width}
        var resolved=preferred
        if auto && !fits(preferred){
            let opposite=["top":"bottom","bottom":"top","left":"right","right":"left"][axis]!
            let candidates=([opposite]+["top","bottom","right","left"]).map{$0+(align.isEmpty ? "":"-"+align)}
            resolved=candidates.first(where:fits) ?? preferred
        }
        var point=coords(resolved)
        if resolved.hasPrefix("top") || resolved.hasPrefix("bottom"){
            point.x += cross;if auto{point.x=min(max(point.x,8),max(8,viewport.width-w-8))}
        }else{point.y += cross;if auto{point.y=min(max(point.y,8),max(8,viewport.height-h-8))}}
        return .init(origin:point,placement:resolved)
    }
}
struct AWCNativeTooltipLayout:Layout{
    let metrics:AWCNativeTooltipMetrics,appearance:AWCTooltipAppearance,context:AWCTooltipSizingContext,viewport:CGSize,hasHeading:Bool,hasActions:Bool,rtl:Bool,part:AWCTooltipPartAppearance
    var minimumTextWidth=0.0
    func plan(_ views:Subviews)->(CGSize,[CGRect]){
        let m=metrics,border=part.borderWidth ?? 0,start=(part.paddingInlineStart ?? m.start)+border,end=m.start+border,pad=start+end
        let natural=views.map{$0.sizeThatFits(.unspecified)},minWidth=m.rich ? appearance.richMinWidth?.resolve(parent:Double(viewport.width),context:context) ?? 120:0
        let maxWidth=(m.rich ? appearance.richMaxWidth:appearance.plainMaxWidth)?.resolve(parent:Double(viewport.width),context:context) ?? (m.rich ? 320:280)
        let width=max(pad,minWidth,min((natural.map(\.width).max() ?? 0)+pad,maxWidth,viewport.width-16)),available=max(0,width-pad)
        let contentWidth=m.rich ? available:max(available,minimumTextWidth)
        let sizes=views.map{$0.sizeThatFits(.init(width:contentWidth,height:nil))}
        var frames=[CGRect](),y=m.top+border
        for (index,size) in sizes.enumerated(){
            let action=m.rich && hasActions && index==sizes.count-1
            if action{y += m.actionsTop}
            let x=start
            frames.append(.init(x:x,y:y,width:contentWidth,height:size.height));y += size.height
            if hasHeading && index==0{y += m.headingGap}
        }
        let height=max(m.minHeight,y+m.bottom+border)
        if !m.rich,let first=frames.first{frames[0] = .init(x:first.minX,y:(height-first.height)/2,width:first.width,height:first.height)}
        if rtl{frames=frames.map{.init(x:width-$0.maxX,y:$0.minY,width:$0.width,height:$0.height)}}
        return(.init(width:width,height:height),frames)
    }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{plan(subviews).0}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){let result=plan(subviews);for(index,view) in subviews.enumerated(){let f=result.1[index];view.place(at:.init(x:bounds.minX+f.minX,y:bounds.minY+f.minY),proposal:.init(f.size))}}
}

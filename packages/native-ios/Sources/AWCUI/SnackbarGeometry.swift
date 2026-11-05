import SwiftUI

struct AWCNativeSnackbarMetrics {
    let density:Double,stacked:Bool,hasAction:Bool,hasClose:Bool,position:String
    let insetSmall:Double,insetMedium:Double,insetLarge:Double,insetXL:Double,columnGap:Double
    let start:Double,end:Double,messageTop:Double,messageBottom:Double,fontSize:Double,lineHeight:Double,minHeight:Double
    init(properties:[String:AWCValue],density:Double,hasAction:Bool,hasClose:Bool){
        self.density=density;stacked=properties["stacked"]?.bool ?? false;self.hasAction=hasAction;self.hasClose=hasClose
        let p=properties["position"]?.string ?? "bottom"
        position=["bottom","bottom-start","bottom-end","top","top-start","top-end","start","end","center"].contains(p) ? p:"bottom"
        // Local density also matches the public token stylesheet. A raw
        // inherited scale changes calculations without replacing spacing tokens.
        let rung=properties["density"]?.number ?? 0
        insetSmall=rung<=(-3) && rung>=(-4) ? 4:8
        insetMedium=[-2.0,-3,-4].contains(rung) ? 8:12
        insetLarge=rung == -4 ? 8:[-2.0,-3].contains(rung) ? 12:16
        insetXL=[-3.0,-4].contains(rung) ? 16:rung == -2 ? 20:24
        columnGap=rung == -4 ? 4:[-2.0,-3].contains(rung) ? 8:12
        start=max(8,16+2*density);end=hasClose ? insetMedium:hasAction ? insetSmall:start
        messageTop=max(6,14+2*density);messageBottom=stacked ? 4:messageTop
        fontSize=max(12,14+0.5*density);lineHeight=max(16,20+density)
        minHeight=stacked ? 68:max(36,48+3*density)
    }
    func text(_ value:String)->AWCNativeMeterText{.init(text:value,size:fontSize,lineHeight:lineHeight,weight:400,spacing:0.25,tabular:false)}
    func inset(_ viewport:Double)->Double{viewport<600 ? insetLarge:insetXL}
    func origin(surface:CGSize,viewport:CGSize,rtl:Bool,margin:Double=0)->CGPoint{
        let edge=inset(Double(viewport.width)),available=Double(viewport.width)-2*edge
        let logical=position.hasSuffix("-start") || position=="start" ? margin:position.hasSuffix("-end") || position=="end" ? available-Double(surface.width):(available-Double(surface.width)+margin)/2
        let x=rtl ? Double(viewport.width)-edge-logical-Double(surface.width):edge+logical
        let y=position.hasPrefix("top") ? edge:position.hasPrefix("bottom") ? Double(viewport.height)-edge-Double(surface.height):(Double(viewport.height)-Double(surface.height))/2
        return .init(x:x,y:y)
    }
}
struct AWCNativeSnackbarPlan {let size:CGSize,frames:[CGRect]}
struct AWCNativeSnackbarLayout:Layout {
    let metrics:AWCNativeSnackbarMetrics,appearance:AWCSnackbarAppearance,context:AWCSnackbarSizingContext
    let viewport:CGSize,rtl:Bool,messageMinimum:Double
    var surfacePart=AWCSnackbarPartAppearance()
    func plan(_ subviews:Subviews)->AWCNativeSnackbarPlan {
        let m=metrics,edge=m.inset(Double(viewport.width)),available=max(0,Double(viewport.width)-2*edge)
        let actionIndex=m.hasAction ? 1:nil,closeIndex=m.hasClose ? (m.hasAction ? 2:1):nil
        let action=actionIndex.map{subviews[$0].sizeThatFits(.unspecified)} ?? .zero
        let close=closeIndex.map{subviews[$0].sizeThatFits(.unspecified)} ?? .zero
        let intrinsic=subviews[0].sizeThatFits(.unspecified)
        let border=surfacePart.borderWidth ?? 0,start=(surfacePart.paddingInlineStart ?? m.start)+border,end=m.end+border
        let pad=start+end,compact=viewport.width<600
        let minW=compact ? 0:appearance.minWidth?.resolve(parent:available,context:context) ?? 288
        let maxW=compact ? available:appearance.maxWidth?.resolve(parent:available,context:context) ?? 568
        let natural=m.stacked ? max(Double(intrinsic.width)+Double(close.width)+m.columnGap,Double(action.width))+pad:Double(intrinsic.width+action.width+close.width)+pad
        let width=max(pad,minW,min(compact ? available:natural,maxW,available))
        let content=max(0,width-pad)
        let messageWidth=max(messageMinimum,content-Double(close.width)-(m.stacked ? m.columnGap:Double(action.width)))
        let message=subviews[0].sizeThatFits(.init(width:messageWidth,height:nil))
        var frames=[CGRect](),height:Double
        if m.stacked {
            let row1=max(Double(message.height),Double(close.height)+(m.hasClose ? 4:0))
            height=max(m.minHeight,2*m.insetSmall+row1+6+Double(action.height))+2*border
            frames.append(.init(x:start,y:m.insetSmall+border,width:messageWidth,height:message.height))
            if m.hasAction{frames.append(.init(x:width-end-Double(action.width),y:m.insetSmall+border+row1+6,width:action.width,height:action.height))}
            if m.hasClose{frames.append(.init(x:width-end-Double(close.width),y:m.insetSmall+border+4,width:close.width,height:close.height))}
        }else{
            height=max(m.minHeight,Double(message.height),Double(action.height),Double(close.height))+2*border
            frames.append(.init(x:start,y:(height-Double(message.height))/2,width:messageWidth,height:message.height))
            if m.hasAction{frames.append(.init(x:start+messageWidth,y:(height-Double(action.height))/2,width:action.width,height:action.height))}
            if m.hasClose{frames.append(.init(x:start+messageWidth+Double(action.width),y:(height-Double(close.height))/2,width:close.width,height:close.height))}
        }
        if rtl{frames=frames.map{.init(x:width-$0.maxX,y:$0.minY,width:$0.width,height:$0.height)}}
        return .init(size:.init(width:width,height:height),frames:frames)
    }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{plan(subviews).size}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        let p=plan(subviews);for(index,view) in subviews.enumerated(){let f=p.frames[index];view.place(at:.init(x:bounds.minX+f.minX,y:bounds.minY+f.minY),proposal:.init(f.size))}
    }
}
struct AWCNativeSnackbarPlacement:Layout {
    let metrics:AWCNativeSnackbarMetrics,viewport:CGSize,rtl:Bool
    var margin=0.0
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{viewport}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){
        guard let view=subviews.first else{return};let size=view.sizeThatFits(.unspecified),origin=metrics.origin(surface:size,viewport:viewport,rtl:rtl,margin:margin)
        view.place(at:.init(x:bounds.minX+origin.x,y:bounds.minY+origin.y),proposal:.init(size))
    }
}

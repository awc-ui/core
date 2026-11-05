import SwiftUI

struct AWCNativeSkeletonMetrics {
    let variant:String,animation:String,label:String
    let count:Int,announce:Bool,hidden:Bool,fullWidth:Bool,fullHeight:Bool
    let width:AWCSkeletonLength,height:AWCSkeletonLength,gap:AWCSkeletonLength
    let color:String,highlight:String,baseAlpha:Double
    let corners:AWCCornerShape
    let pulseDuration:Double,waveDuration:Double,bloomDuration:Double
    let pulseCurve:[Double],waveCurve:[Double],bloomCurve:[Double]
    init(properties p:[String:AWCValue],appearance a:AWCSkeletonAppearance,density:Double,tokens:[String:String]){
        variant=p["variant"]?.string ?? "text";animation=p["animation"]?.string ?? "pulse"
        label=p["ariaLabelProp"]?.string ?? p["aria-label"]?.string ?? "Loading";announce=p["announce"]?.bool ?? true
        hidden=p["hidden"]?.bool==true;fullWidth=p["fullWidth"]?.bool==true;fullHeight=p["fullHeight"]?.bool==true
        let raw=p["lines"]?.number ?? 1,wrapped=raw.isFinite ? raw.rounded(.towardZero).truncatingRemainder(dividingBy:4_294_967_296):0
        let positive=wrapped<0 ? wrapped+4_294_967_296:wrapped,signed=positive>=2_147_483_648 ? positive-4_294_967_296:positive
        count=variant=="text" ? min(4096,max(1,Int(signed))):1
        let d=AWCNativeDensity.resolve(p["density"]?.number,inherited:density)
        let size=a.size ?? .points(max(28,40+3*d))
        width=p["width"].flatMap{AWCSkeletonLength(css:$0.string)} ?? a.width ?? (variant=="circular" ? size:.fraction(1))
        height=p["height"].flatMap{AWCSkeletonLength(css:$0.string)} ?? a.height ?? (variant=="text" ? .init(em:max(0.75,1+0.05*d)):variant=="circular" ? size:.points(max(80,120+8*d)))
        gap=a.lineGap ?? .points(max(4,8+d))
        color=a.color ?? tokens["--md-sys-color-on-surface"] ?? "#1C1B1F";baseAlpha=a.color==nil ? 0.16:1
        highlight=a.highlight ?? tokens["--md-sys-color-surface-bright"] ?? "#1C1B1F0D"
        let extra=Double((tokens["--md-sys-shape-corner-extra-small"] ?? "4px").replacingOccurrences(of:"px",with:"")) ?? 4
        corners=variant=="circular" ? .fraction(0.5):variant=="rounded" ? a.roundedRadius ?? .points(max(8,12+d)):a.radius ?? .points(extra)
        func duration(_ key:String,_ fallback:Double)->Double{
            guard let raw=tokens[key] else{return fallback}
            let isMilliseconds=raw.hasSuffix("ms"),isSeconds=raw.hasSuffix("s")
            guard isSeconds,let n=Double(raw.dropLast(isMilliseconds ? 2:1)),n.isFinite else{return fallback}
            return max(0,isMilliseconds ? n/1000:n)
        }
        func curve(_ key:String,_ fallback:[Double])->[Double]{
            guard let raw=tokens[key],raw.hasPrefix("cubic-bezier(") else{return fallback}
            let values=raw.dropFirst(13).dropLast().split(separator:",").compactMap{Double($0.trimmingCharacters(in:.whitespaces))}
            return values.count==4 && values.allSatisfy(\.isFinite) ? values:fallback
        }
        pulseDuration=a.pulseDuration ?? duration("--md-sys-motion-duration-extra-long2",1.8)
        waveDuration=a.waveDuration ?? duration("--md-sys-motion-duration-extra-long2",1.8)
        bloomDuration=a.bloomDuration ?? duration("--md-sys-motion-spring-spatial-default-duration",0.5)
        pulseCurve=curve("--md-sys-motion-easing-standard",[0.2,0,0,1])
        waveCurve=curve("--md-sys-motion-easing-emphasized",[0.2,0,0,1])
        bloomCurve=curve("--md-sys-motion-spring-spatial-default-easing",[0.38,1.21,0.22,1])
    }
}
struct AWCNativeSkeletonPlan {
    let size:CGSize,rows:[CGRect]
}
struct AWCNativeSkeletonLayout:Layout {
    let metrics:AWCNativeSkeletonMetrics,context:AWCSkeletonSizingContext,parts:[AWCSkeletonPart:AWCSkeletonPartAppearance],rtl:Bool
    struct Cache{var plan:AWCNativeSkeletonPlan?}
    func makeCache(subviews:Subviews)->Cache{.init()}
    func plan(_ proposedWidth:Double?)->AWCNativeSkeletonPlan {
        let m=metrics,c=context,parent=min(AWCSkeletonLength.maximumUsedLength,max(0,proposedWidth ?? 240))
        func q(_ value:Double)->Double{floor(min(AWCSkeletonLength.maximumUsedLength,max(0,value))*64)/64}
        var width=q(m.fullWidth ? parent:m.width.resolve(parent:parent,context:c) ?? parent)
        let definite=m.fullHeight ? c.parentHeight:nil
        let minimum=m.height.resolve(parent:c.parentHeight,context:c) ?? 0
        var hostHeight:Double?
        if m.fullHeight {
            if m.variant=="circular"{
                if let definite{width=q(max(definite,minimum));hostHeight=width}
                else{width=q(parent);hostHeight=q(max(parent,minimum))}
            }else if let definite{hostHeight=q(max(definite,minimum))}
        }
        let gap=q(m.gap.resolve(parent:hostHeight,context:c) ?? 0)
        var rows:[CGRect]=[]
        for index in 0..<m.count{
            let base:AWCSkeletonPart=m.variant=="text" ? .line:.shape
            var part=parts[base] ?? .init()
            let last=m.variant=="text" && m.count>1 && index==m.count-1
            if last{part=part.merging(parts[.lineLast] ?? .init())}
            let w=q(part.width?.resolve(parent:width,context:c) ?? width*(last ? 0.6:1))
            let fallback=m.variant=="circular" ? w:0
            var h=q(part.height?.resolve(parent:hostHeight,context:c) ?? m.height.resolve(parent:hostHeight,context:c) ?? fallback)
            if m.fullHeight && m.variant != "text"{
                h=q(part.height?.resolve(parent:hostHeight,context:c) ?? max(hostHeight ?? minimum,minimum))
            }
            rows.append(.init(x:rtl ? width-w:0,y:0,width:w,height:h))
        }
        let natural=rows.reduce(0){$0+$1.height}+gap*Double(max(0,rows.count-1))
        if hostHeight==nil{hostHeight=q(max(natural,m.fullHeight ? minimum:0))}
        if m.variant=="text",m.fullHeight,c.parentHeight != nil,natural>hostHeight!{
            let available=max(0,hostHeight!-gap*Double(max(0,rows.count-1))),total=rows.reduce(0){$0+$1.height}
            if total>0{for i in rows.indices{rows[i].size.height=q(rows[i].height*available/total)}}
        }
        var y=0.0
        for i in rows.indices{rows[i].origin.y=y;y += rows[i].height+gap}
        return .init(size:.init(width:width,height:hostHeight!),rows:rows)
    }
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout Cache)->CGSize{
        let result=plan(proposal.width.map(Double.init));cache.plan=result;return result.size
    }
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout Cache){
        let result=cache.plan ?? plan(proposal.width.map(Double.init))
        for (index,view) in subviews.enumerated() where index<result.rows.count{
            let rect=result.rows[index]
            view.place(at:.init(x:bounds.minX+rect.minX,y:bounds.minY+rect.minY),anchor:.topLeading,proposal:.init(width:rect.width,height:rect.height))
        }
    }
}

enum AWCNativeSkeletonMotion {
    struct Sample{let opacity:Double,scale:Double,pulse:Double,wave:Double}
    static func sample(_ m:AWCNativeSkeletonMetrics,entrance:Double,recurring:Double,reduced:Bool,rtl:Bool)->Sample{
        func ease(_ t:Double,_ c:[Double])->Double{AWCNativeLoadingMotion.cubic(min(1,max(0,t)),c[0],c[1],c[2],c[3])}
        guard !reduced else{return .init(opacity:1,scale:1,pulse:1,wave:0)}
        let bloom=m.bloomDuration>0 && entrance<m.bloomDuration ? ease(max(0,entrance)/m.bloomDuration,m.bloomCurve):1
        let p=m.pulseDuration>0 ? max(0,recurring).truncatingRemainder(dividingBy:m.pulseDuration)/m.pulseDuration:0
        let pulse=m.animation=="pulse" ? (p<0.5 ? 1-0.45*ease(p*2,m.pulseCurve):0.55+0.45*ease((p-0.5)*2,m.pulseCurve)):1
        let w=m.waveDuration>0 ? max(0,recurring).truncatingRemainder(dividingBy:m.waveDuration)/m.waveDuration:0
        return .init(opacity:min(1,max(0,bloom)),scale:0.96+0.04*bloom,pulse:pulse,wave:ease(rtl ? 1-w:w,m.waveCurve))
    }
}

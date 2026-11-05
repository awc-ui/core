import SwiftUI

struct AWCNativeProgressMetrics:Equatable {
    // Match the independently measured browser used-length saturation before
    // SwiftUI's internal Float conversion, while preserving authored inputs.
    static let maximumUsedLength=16_777_214.0
    let circular:Bool,wave:Bool,indeterminate:Bool,fourColor:Bool,complete:Bool,hidden:Bool
    let label:String,maximum:Double,value:Double?,fraction:Double
    let thickness:Double,size:Double,amplitude:Double,wavelength:Double,speed:Double,height:Double,radius:Double
    let gap:Double,stopSize:Double,stopTrailingSpace:Double
    let activeColor:String,trackColor:String,stopColor:String,fourColors:[String]
    let activeShape:AWCCornerShape,trackShape:AWCCornerShape,stopShape:AWCCornerShape
    init(properties p:[String:AWCValue],appearance a:AWCProgressIndicatorAppearance,density:Double,tokens:[String:String]){
        func number(_ key:String,_ fallback:Double)->Double{let v=p[key]?.number ?? fallback;return v.isFinite ? v:fallback}
        circular=p["variant"]?.string=="circular";wave=p["wave"]?.bool==true;indeterminate=p["indeterminate"]?.bool==true;fourColor=p["fourColor"]?.bool==true;complete=p["complete"]?.bool==true;hidden=p["hidden"]?.bool==true
        label=p["label"]?.string ?? "Progress"
        let rawValue=number("value",0),rawMax=number("max",100),d=AWCNativeDensity.resolve(p["density"]?.number,inherited:density)
        maximum=rawMax>0 ? rawMax:0;value=indeterminate ? nil:min(maximum,max(0,rawValue))
        fraction=rawMax==0 ? 0:min(1,max(0,rawValue/rawMax))
        let requestedThickness=number("thickness",4),requestedSize=number("size",0),requestedAmplitude=number("waveAmplitude",0),requestedLength=number("waveLength",0),requestedSpeed=number("waveSpeed",0)
        thickness=min(Self.maximumUsedLength,max(-Self.maximumUsedLength,requestedThickness==4 ? max(2,4+0.5*d):requestedThickness))
        size=min(240,max(24,requestedSize>0 ? requestedSize:(wave ? 48:40)+3*d))
        amplitude=min(Self.maximumUsedLength/2,requestedAmplitude>0 ? requestedAmplitude:circular ? 1.6:3)
        wavelength=requestedLength>0 ? requestedLength:circular ? 15:40
        speed=requestedSpeed>0 ? requestedSpeed:wavelength
        height=min(Self.maximumUsedLength,wave ? 2*amplitude+thickness:thickness)
        radius=max(0.5,(size-thickness)/2-(wave ? amplitude:0))
        gap=min(Self.maximumUsedLength,max(-Self.maximumUsedLength,a.trackActiveIndicatorSpace ?? max(2,4+0.5*d)))
        stopSize=min(a.stopIndicatorSize ?? max(2,4+0.5*d),thickness)
        stopTrailingSpace=min(Self.maximumUsedLength,max(-Self.maximumUsedLength,a.stopIndicatorTrailingSpace ?? 0))
        activeColor=a.activeIndicatorColor ?? tokens["--md-sys-color-primary"] ?? "#6750A4"
        trackColor=a.trackColor ?? tokens["--md-sys-color-secondary-container"] ?? "#E8DEF8"
        stopColor=a.stopIndicatorColor ?? tokens["--md-sys-color-primary"] ?? "#6750A4"
        fourColors=[a.fourColor1 ?? tokens["--md-sys-color-primary"] ?? "#6750A4",a.fourColor2 ?? tokens["--md-sys-color-primary-container"] ?? "#EADDFF",a.fourColor3 ?? tokens["--md-sys-color-tertiary"] ?? "#7D5260",a.fourColor4 ?? tokens["--md-sys-color-tertiary-container"] ?? "#FFD8E4"]
        let token=tokens["--md-sys-shape-corner-full"] ?? "9999px",n=Double(token.replacingOccurrences(of:"px",with:"").replacingOccurrences(of:"%",with:"")) ?? 9999
        let full:AWCCornerShape=token.hasSuffix("%") ? .fraction(n/100):.points(n)
        trackShape=a.trackShape ?? full;activeShape=a.activeIndicatorShape ?? trackShape;stopShape=a.stopIndicatorShape ?? full
    }
}

/// Source SVG path generation, including its two-decimal serialization. Keeping
/// the Catmull-Rom control points makes both paint and path-bound inspection
/// comparable to the actual browser geometry.
enum AWCNativeProgressGeometry {
    static func rounded(_ value:Double,_ digits:Double=100)->Double{(value*digits).rounded()/digits}
    static func point(_ x:Double,_ y:Double)->CGPoint{.init(x:rounded(x),y:rounded(y))}
    static func catmull(_ points:[CGPoint],into path:inout Path,move:Bool=true){
        guard points.count>1 else{return}
        if move{path.move(to:point(points[0].x,points[0].y))}
        for i in 0..<(points.count-1){
            let p0=points[max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[min(points.count-1,i+2)]
            let c1=point(p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6)
            let c2=point(p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6)
            path.addCurve(to:point(p2.x,p2.y),control1:c1,control2:c2)
        }
    }
    static func linearWave(_ m:AWCNativeProgressMetrics,start:Double,end:Double,amplitude:Double,phase:Double,inset:Bool)->Path{
        guard end>start,m.height.isFinite else{return Path()}
        let cy=m.height/2,r=m.thickness/2,bodyStart=inset ? start+r:start,bodyEnd=inset ? end-r:end
        if inset && bodyEnd<=bodyStart{return Path(ellipseIn:.init(x:start,y:cy-(end-start)/2,width:end-start,height:end-start))}
        let length=max(0,bodyEnd-bodyStart),a=amplitude*m.amplitude*min(1,length/m.wavelength)
        // A bounded native tessellation prevents malicious finite wavelengths
        // from allocating an unbounded sample array; normal source ranges retain
        // all eight samples per wavelength.
        let rawSteps=(length/m.wavelength*8).rounded(),steps=Int(min(32768,max(8,rawSteps.isFinite ? rawSteps:32768)))
        var bottom:[CGPoint]=[],top:[CGPoint]=[]
        for i in 0...steps{
            let x=bodyStart+length*Double(i)/Double(steps),y=cy-a*sin(2 * .pi*(x.truncatingRemainder(dividingBy:m.wavelength)/m.wavelength)+phase)
            bottom.append(.init(x:x,y:y+r));top.append(.init(x:x,y:y-r))
        }
        let leftY=cy-a*sin(2 * .pi*(bodyStart.truncatingRemainder(dividingBy:m.wavelength)/m.wavelength)+phase),rightY=cy-a*sin(2 * .pi*(bodyEnd.truncatingRemainder(dividingBy:m.wavelength)/m.wavelength)+phase)
        var path=Path();path.move(to:point(bodyStart,leftY-r))
        if r>0{path.addArc(center:point(bodyStart,leftY),radius:rounded(r),startAngle:.degrees(-90),endAngle:.degrees(-270),clockwise:true)}
        else{path.addLine(to:point(bodyStart,leftY+r))}
        catmull(bottom,into:&path,move:false)
        if r>0{path.addArc(center:point(bodyEnd,rightY),radius:rounded(r),startAngle:.degrees(90),endAngle:.degrees(-90),clockwise:true)}
        else{path.addLine(to:point(bodyEnd,rightY-r))}
        catmull(Array(top.reversed()),into:&path,move:false);path.closeSubpath()
        return path
    }
    static func wavyArc(_ m:AWCNativeProgressMetrics,start:Double,end:Double,amplitude:Double,phase:Double)->Path{
        let n=min(4096,max(5,(2 * .pi*m.radius/m.wavelength).rounded())),span=end-start
        let count=abs(span)/(2 * .pi)*n*8,steps=Int(min(32768,max(8,count.isFinite ? ceil(count):32768)))
        var points:[CGPoint]=[]
        for i in 0...steps{
            let angle=start+span*Double(i)/Double(steps),radius=m.radius+amplitude*m.amplitude*cos(n*angle-phase)
            points.append(.init(x:m.size/2+radius*cos(angle),y:m.size/2+radius*sin(angle)))
        }
        var path=Path();catmull(points,into:&path);return path
    }
    static func arc(_ m:AWCNativeProgressMetrics,start:Double,end:Double)->Path{
        var path=Path();path.addArc(center:.init(x:m.size/2,y:m.size/2),radius:m.radius,startAngle:.radians(start),endAngle:.radians(end),clockwise:end<start);return path
    }
    static func circularWave(_ m:AWCNativeProgressMetrics,fraction:Double,amplitude:Double,phase:Double,rotation:Double=0)->(active:Path,track:Path){
        let start = -Double.pi/2,end=start+fraction*2 * .pi
        // The source rotates the active path's containing group, retaining its
        // measured element box. The track is recomputed in screen coordinates.
        let active=end-start<1e-4 ? Path():wavyArc(m,start:start,end:end,amplitude:amplitude,phase:phase)
        let gap=(4+m.thickness+amplitude*m.amplitude)/m.radius
        if m.indeterminate || (fraction>0 && fraction<1){
            let a=end+rotation+gap,b=start+rotation+2 * .pi-gap
            return(active,b>a ? arc(m,start:a,end:b):Path())
        }
        return(active,arc(m,start:start,end:start+2 * .pi-1e-3))
    }
    struct CircularFlat {
        let activeStart:Double,activeLength:Double,trackStart:Double,trackLength:Double,trackOpacity:Double
    }
    static func circularFlat(_ m:AWCNativeProgressMetrics,fraction:Double)->CircularFlat{
        let circumference=2 * .pi*m.radius,gap=(4+m.thickness)/circumference,fade=m.thickness/circumference,remaining=1-fraction-2*gap
        if fraction<=1e-4{return .init(activeStart:0,activeLength:rounded(fraction,10000),trackStart:0,trackLength:1,trackOpacity:1)}
        if fraction>=1-1e-4{return .init(activeStart:0,activeLength:1,trackStart:0,trackLength:1,trackOpacity:0)}
        if remaining<=1e-4{return .init(activeStart:0,activeLength:rounded(fraction,10000),trackStart:0,trackLength:1,trackOpacity:0)}
        if remaining<fade{return .init(activeStart:0,activeLength:rounded(fraction,10000),trackStart:rounded(1-gap-fade,10000),trackLength:rounded(fade,10000),trackOpacity:rounded(max(0,remaining/fade),1000))}
        return .init(activeStart:0,activeLength:rounded(fraction,10000),trackStart:rounded(fraction+gap,10000),trackLength:rounded(remaining,10000),trackOpacity:1)
    }
}

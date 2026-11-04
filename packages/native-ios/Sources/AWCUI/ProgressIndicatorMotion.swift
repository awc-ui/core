import Foundation

/// Retained source lifecycle. `complete` is a watcher input: an initially true
/// value is inert, and clearing it never resurrects an already completed view.
struct AWCNativeProgressMotion {
    enum Stage { case normal, linearFill, waveFill, waveFlatten, collapse, circleFill, circleFlatten, circleErase, circleTrack, terminal }
    private(set) var stage:Stage = .normal
    private(set) var fraction:Double,amplitude:Double,phase=0.0,erase=0.0,trackOpacity=1.0,scale=1.0
    private(set) var completionCount=0
    private(set) var reduced:Bool
    private var metrics:AWCNativeProgressMetrics
    private var lastTime:Double?,stageStart:Double?,ampStart:Double?,indeterminateStart:Double?
    private var fromFraction:Double,ampFrom:Double,ampTarget:Double
    init(_ metrics:AWCNativeProgressMetrics,reduced:Bool) {
        self.metrics=metrics;self.reduced=reduced;fraction=metrics.fraction;fromFraction=fraction
        amplitude=Self.targetAmplitude(metrics,reduced);ampFrom=amplitude;ampTarget=amplitude
    }
    static func targetAmplitude(_ m:AWCNativeProgressMetrics,_ reduced:Bool)->Double {m.wave && !reduced && (m.indeterminate || m.fraction>0) ? 1:0}
    static func ease(_ x:Double)->Double {cubic(x,0.2,0,0,1)}
    static func decrease(_ x:Double)->Double {cubic(x,0.3,0,0.8,0.15)}
    static func cubic(_ x:Double,_ x1:Double,_ y1:Double,_ x2:Double,_ y2:Double)->Double {
        x<=0 ? 0:x>=1 ? 1:AWCNativeLoadingMotion.cubic(x,x1,y1,x2,y2)
    }
    var completed:Bool{stage == .terminal}
    var hidden:Bool{completed && !(metrics.circular && !metrics.wave)}
    var completing:Bool{stage != .normal && stage != .terminal}
    var completionArc:Bool{metrics.circular && completing}
    var animates:Bool {
        if completed{return false}
        if completing{return true}
        if metrics.indeterminate{return true}
        return (!reduced && metrics.wave && (amplitude>0 || amplitude != ampTarget)) || abs(fraction-metrics.fraction)>0.001
    }
    mutating func update(_ next:AWCNativeProgressMetrics,reduced nextReduced:Bool) {
        let completeChanged=next.complete != metrics.complete,reducedChanged=nextReduced != reduced
        metrics=next;reduced=nextReduced
        // A CSS collapse has no active source rAF phase and keeps its 300ms
        // duration when the preference changes during that final animation.
        if reducedChanged && reduced && completing && stage != .collapse {finish();return}
        if stage == .normal {
            let target=Self.targetAmplitude(next,reduced)
            if target != ampTarget{ampFrom=amplitude;ampTarget=target;ampStart=nil}
            if reduced{amplitude=target;fraction=next.fraction}
        }
        guard completeChanged,next.complete,!next.indeterminate,stage == .normal else{return}
        fromFraction=next.fraction;stageStart=nil
        if next.circular {
            if reduced{finish();return}
            fraction=next.fraction;erase=0;trackOpacity=0
            if next.wave{amplitude=1;ampFrom=1;ampTarget=1}
            stage=fraction>=0.999 ? (next.wave ? .circleFlatten:.circleErase):.circleFill
        } else if next.wave {
            if reduced{finish();return}
            amplitude=1;ampFrom=1;ampTarget=1;fraction=next.fraction;stage = .waveFill
        } else if reduced {
            fraction=1;stage = .collapse
        } else {stage = .linearFill}
    }
    private mutating func advance(to next:Stage,at time:Double){stage=next;stageStart=time}
    private mutating func finish(){stage = .terminal;fraction=1;amplitude=0;erase=1;scale=1;trackOpacity=metrics.circular && !metrics.wave ? 1:0;completionCount += 1;lastTime=nil}
    mutating func suspend(){lastTime=nil;indeterminateStart=nil}
    mutating func tick(_ time:Double) {
        guard time.isFinite,!completed else{return}
        let dt=min(0.064,max(0,time-(lastTime ?? time)));lastTime=time
        if indeterminateStart==nil{indeterminateStart=time}
        if completing && stageStart==nil{stageStart=time}
        let elapsed=max(0,time-(stageStart ?? time))
        if metrics.wave && !reduced && stage != .collapse && stage != .circleTrack {
            // Divide first, then reduce whole cycles to keep finite accepted
            // speed/wavelength inputs away from an overflowing phase accumulator.
            let cycles=(metrics.speed*dt).truncatingRemainder(dividingBy:metrics.wavelength)/metrics.wavelength
            if cycles.isFinite{phase += 2 * .pi*cycles}
            if phase>1e6{phase.formTruncatingRemainder(dividingBy:2 * .pi)}
        }
        switch stage {
        case .terminal: break
        case .normal:
            if amplitude != ampTarget {
                if ampStart==nil{ampStart=time}
                let t=min(1,max(0,(time-(ampStart ?? time))/0.5))
                let eased=ampTarget>ampFrom ? Self.ease(t):Self.decrease(t)
                amplitude=ampFrom+(ampTarget-ampFrom)*eased
                if t>=1{amplitude=ampTarget}
            }
            if !metrics.indeterminate {
                if reduced{fraction=metrics.fraction}
                else{fraction += (metrics.fraction-fraction)*(1-exp(-dt/(metrics.circular ? 0.160:0.080)))}
                if abs(fraction-metrics.fraction)<0.001{fraction=metrics.fraction}
            }
        case .linearFill:
            fraction += (1-fraction)*(1-exp(-dt/0.080))
            if abs(1-fraction)<0.001{fraction=1;advance(to:.collapse,at:time)}
        case .waveFill:
            let t=min(1,elapsed/0.3);fraction=fromFraction+(1-fromFraction)*Self.ease(t)
            if t>=1{fraction=1;advance(to:.waveFlatten,at:time)}
        case .waveFlatten:
            let t=min(1,elapsed/0.3);amplitude=1-Self.ease(t)
            if t>=1{amplitude=0;advance(to:.collapse,at:time)}
        case .collapse:
            let t=min(1,elapsed/0.3)
            // CSS easing applies independently between its 0/60/100% keys.
            scale=t<0.6 ? 1-0.9*Self.cubic(t/0.6,0.2,0,1,0.8):0.1*(1-Self.cubic((t-0.6)/0.4,0.2,0,1,0.8))
            if t>=1{finish()}
        case .circleFill:
            let t=min(1,elapsed/0.5);fraction=fromFraction+(1-fromFraction)*Self.ease(t)
            if t>=1{fraction=1;advance(to:metrics.wave ? .circleFlatten:.circleErase,at:time)}
        case .circleFlatten:
            let t=min(1,elapsed/0.3);amplitude=1-Self.ease(t)
            if t>=1{amplitude=0;advance(to:.circleErase,at:time)}
        case .circleErase:
            let t=min(1,max(0,(elapsed-0.15)/0.55));erase=Self.ease(t)
            if t>=1{if metrics.wave{finish()}else{advance(to:.circleTrack,at:time)}}
        case .circleTrack:
            let t=min(1,elapsed/0.3);trackOpacity=Self.ease(t)
            if t>=1{finish()}
        }
    }
    func circularIndeterminate(at time:Double)->(fraction:Double,rotation:Double) {
        let elapsed=max(0,time-(indeterminateStart ?? time)),cycle=elapsed.truncatingRemainder(dividingBy:6)/6
        let sweep=cycle<0.5 ? 0.1+0.77*Self.ease(cycle*2):0.87-0.77*Self.ease((cycle-0.5)*2)
        return (sweep,elapsed/6*8 * .pi)
    }
}

enum AWCNativeProgressChoreography {
    static func interpolate(_ time:Double,_ values:[(Double,Double)],_ curves:[(Double,Double,Double,Double)])->Double {
        let index=(0..<(values.count-1)).first{time<values[$0+1].0} ?? values.count-2
        let (a,x)=values[index],(b,y)=values[index+1],c=curves[index]
        return x+(y-x)*AWCNativeProgressMotion.cubic((time-a)/(b-a),c.0,c.1,c.2,c.3)
    }
    static func linearBars(_ time:Double,width:Double,reduced:Bool)->[(start:Double,end:Double)] {
        let duration=reduced ? 6.0:2.0,delay=reduced ? 4.998:1.666
        let primary=(max(0,time)+delay).truncatingRemainder(dividingBy:duration)/duration
        let secondary=max(0,time).truncatingRemainder(dividingBy:duration)/duration
        let pt=interpolate(primary,[(0,0),(0.2,0),(0.5915,0.836714),(1,2.5)],[(0,0,1,1),(0.5,0,0.7017,0.4958),(0.3024,0.3814,0.55,0.9564)])
        let ps=interpolate(primary,[(0,0.08),(0.3665,0.08),(0.6915,0.58),(1,0.62)],[(0,0,1,1),(0.3347,0.1248,0.7858,1),(0.06,0.11,0.6,1)])
        let st=interpolate(secondary,[(0,0),(0.25,0.376519),(0.4835,0.843862),(1,1.60278)],[(0.15,0,0.5151,0.4097),(0.3103,0.2841,0.8,0.7337),(0.4,0.627,0.6,0.902)])
        let ss=interpolate(secondary,[(0,0.08),(0.1915,0.4571),(0.4415,0.58),(1,0.62)],[(0.205,0.0571,0.5766,0.454),(0.1523,0.1964,0.6484,1.0043),(0.2578,-0.0032,0.2118,1.3818)])
        return [(-1.45+pt+(1-ps)/2,-1.45+pt+(1+ps)/2),(-0.55+st+(1-ss)/2,-0.55+st+(1+ss)/2)].map{($0.0*width,$0.1*width)}
    }
    struct Circle {let rotation:Double,length:Double,offset:Double,trackLength:Double,trackOffset:Double}
    static func circle(_ time:Double,metrics m:AWCNativeProgressMetrics,reduced:Bool)->Circle {
        let t=max(0,time).truncatingRemainder(dividingBy:reduced ? 3:1.333)/(reduced ? 3:1.333)
        let half=t<0.5 ? 0:1,e=AWCNativeProgressMotion.cubic(t<0.5 ? t*2:(t-0.5)*2,0.4,0,0.2,1)
        let lengths=[0.05,0.70,0.05],offsets=[0.0,-0.18,-0.92],gap=(4+m.thickness)/(2 * .pi*m.radius)
        let tracks=lengths.map{min(1,max(0.0001,1-$0-2*gap))}
        let trackOffsets=zip(offsets,lengths).map{AWCNativeProgressGeometry.rounded($0.0-$0.1-gap,10000)}
        func mix(_ values:[Double])->Double{values[half]+(values[half+1]-values[half])*e}
        return .init(rotation:max(0,time)/(reduced ? 4:1.568)*2 * .pi,length:mix(lengths),offset:mix(offsets),trackLength:mix(tracks.map{AWCNativeProgressGeometry.rounded($0,10000)}),trackOffset:mix(trackOffsets))
    }
}

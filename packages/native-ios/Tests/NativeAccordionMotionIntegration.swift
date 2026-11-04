// Actual hydrated Web transition snapshots; each transition is sampled at
// its own duration fraction, not a common elapsed time.
// web-motion.json SHA-256: 0768e26c83cde35e4b39035bf0867ec1ec6bd8fe7ca4563de71eacf91679478c

import Foundation
@testable import AWCUI
@main enum NativeAccordionMotionIntegration {
    struct Sample {let preset:String, opening:Bool, outlined:Bool;let fraction:Double,height:Double,clip:Double,opacity:Double,shape:Double,scale:Double,cosine:Double,sine:Double}
    static var checks=0,failures=0
    static func near(_ actual:Double,_ expected:Double,_ tolerance:Double,_ label:String) {checks += 1;if abs(actual-expected)>tolerance {failures += 1;print("FAIL \(label): \(actual) != \(expected)")}}
    static func main() {
        for s in samples {
            let motion=AWCNativeAccordionMotion(preset:s.preset,opening:s.opening,expandDuration:4000,collapseDuration:3000)
            let f=motion.fractions(disclosure:s.fraction,effects:s.fraction),label="\(s.preset)/\(s.opening)/\(s.outlined)/\(s.fraction)"
            near(60*f.height,s.height,0.025,label+" height");near(60*f.contentClip,s.clip,0.025,label+" clip")
            near(f.opacity,s.opacity,0.00001,label+" opacity");near(s.outlined ? 0 : 12+4*f.shape,s.shape,0.0001,label+" shape")
            near(f.leadingScale,s.scale,0.00001,label+" leading scale");near(cos(f.chevronRadians),s.cosine,0.00001,label+" rotation cosine");near(sin(f.chevronRadians),s.sine,0.00001,label+" rotation sine")
        }
        for (preset,open,close) in [("expressive",350.0,250.0),("standard",300.0,300.0),("fade",300.0,200.0),("collapse",300.0,300.0),("none",0.0,0.0)] {
            near(AWCNativeAccordionMotion(preset:preset,opening:true).duration,open,0,preset+" open duration");near(AWCNativeAccordionMotion(preset:preset,opening:false).duration,close,0,preset+" close duration")
        }
        let slow=AWCNativeAccordionMotion(opening:true,expandDuration:4000),fast=AWCNativeAccordionMotion(opening:true,expandDuration:80)
        near(slow.effectsDuration,200,0,"bounded effects");near(fast.effectsDuration,80,0,"short disclosure bounds effects")
        near(slow.frame(elapsedMilliseconds:200).opacity,1,0,"opacity finishes while disclosure continues")
        near(AWCNativeAccordionMotion(opening:true,expandDuration:0).frame(elapsedMilliseconds:0).height,1,0,"zero duration snaps")
        near(AWCNativeAccordionMotion(opening:false,reduced:true).frame(elapsedMilliseconds:0).height,0,0,"reduced motion closes instantly")
        near(AWCNativeAccordionMotion(opening:true,expandDuration:-1).duration,350,0,"invalid duration falls back")
        print("Accordion source motion: \(checks-failures)/\(checks) checks passed.");if failures>0 {exit(1)}
    }
    static let samples:[Sample]=[
        .init(preset:"expressive",opening:true,outlined:false,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"expressive",opening:true,outlined:false,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:14.4289,scale:1.03926,cosine:-0.780948,sine:0.624596),
        .init(preset:"expressive",opening:true,outlined:false,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:15.5113,scale:1.05059,cosine:-0.999306,sine:-0.0372623),
        .init(preset:"expressive",opening:true,outlined:false,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:15.9019,scale:1.05033,cosine:-0.999785,sine:-0.0207237),
        .init(preset:"expressive",opening:true,outlined:false,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"expressive",opening:false,outlined:false,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"expressive",opening:false,outlined:false,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:13.5711,scale:1.01074,cosine:0.780948,sine:0.624596),
        .init(preset:"expressive",opening:false,outlined:false,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:12.4887,scale:0.999407,cosine:0.999306,sine:-0.0372623),
        .init(preset:"expressive",opening:false,outlined:false,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:12.0981,scale:0.99967,cosine:0.999785,sine:-0.0207237),
        .init(preset:"expressive",opening:false,outlined:false,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"standard",opening:true,outlined:false,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"standard",opening:true,outlined:false,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:14.4289,scale:1.03036,cosine:-0.330509,sine:0.943803),
        .init(preset:"standard",opening:true,outlined:false,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:15.5113,scale:1.04389,cosine:-0.92725,sine:0.374444),
        .init(preset:"standard",opening:true,outlined:false,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:15.9019,scale:1.04877,cosine:-0.997035,sine:0.0769555),
        .init(preset:"standard",opening:true,outlined:false,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"standard",opening:false,outlined:false,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"standard",opening:false,outlined:false,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:13.5711,scale:1.01964,cosine:0.330509,sine:0.943803),
        .init(preset:"standard",opening:false,outlined:false,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:12.4887,scale:1.00611,cosine:0.92725,sine:0.374444),
        .init(preset:"standard",opening:false,outlined:false,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:12.0981,scale:1.00123,cosine:0.997035,sine:0.0769555),
        .init(preset:"standard",opening:false,outlined:false,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"fade",opening:true,outlined:false,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"fade",opening:true,outlined:false,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:14.4289,scale:1.03036,cosine:-0.330509,sine:0.943803),
        .init(preset:"fade",opening:true,outlined:false,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:15.5113,scale:1.04389,cosine:-0.92725,sine:0.374444),
        .init(preset:"fade",opening:true,outlined:false,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:15.9019,scale:1.04877,cosine:-0.997035,sine:0.0769555),
        .init(preset:"fade",opening:true,outlined:false,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"fade",opening:false,outlined:false,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"fade",opening:false,outlined:false,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:13.5711,scale:1.01964,cosine:0.330509,sine:0.943803),
        .init(preset:"fade",opening:false,outlined:false,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:12.4887,scale:1.00611,cosine:0.92725,sine:0.374444),
        .init(preset:"fade",opening:false,outlined:false,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:12.0981,scale:1.00123,cosine:0.997035,sine:0.0769555),
        .init(preset:"fade",opening:false,outlined:false,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"collapse",opening:true,outlined:false,fraction:0.0,height:0.0,clip:0.0,opacity:1.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"collapse",opening:true,outlined:false,fraction:0.25,height:34.6484375,clip:20.0078125,opacity:1.0,shape:14.3103,scale:1.02888,cosine:-0.241297,sine:0.970451),
        .init(preset:"collapse",opening:true,outlined:false,fraction:0.5,height:50.3515625,clip:42.25,opacity:1.0,shape:15.357,scale:1.04196,cosine:-0.875162,sine:0.483831),
        .init(preset:"collapse",opening:true,outlined:false,fraction:0.75,height:57.8515625,clip:55.78125,opacity:1.0,shape:15.8569,scale:1.04821,cosine:-0.993688,sine:0.112181),
        .init(preset:"collapse",opening:true,outlined:false,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"collapse",opening:false,outlined:false,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"collapse",opening:false,outlined:false,fraction:0.25,height:54.078125,clip:48.7421875,opacity:1.0,shape:15.6055,scale:1.02112,cosine:0.241297,sine:0.970451),
        .init(preset:"collapse",opening:false,outlined:false,fraction:0.5,height:40.5078125,clip:27.34375,opacity:1.0,shape:14.7007,scale:1.00804,cosine:0.875162,sine:0.483831),
        .init(preset:"collapse",opening:false,outlined:false,fraction:0.75,height:22.1875,clip:8.203125,opacity:1.0,shape:13.4797,scale:1.00179,cosine:0.993688,sine:0.112181),
        .init(preset:"collapse",opening:false,outlined:false,fraction:1.0,height:0.0,clip:0.0,opacity:1.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:false,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:false,fraction:0.25,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:false,fraction:0.5,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:false,fraction:0.75,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:false,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:16.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:false,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:false,fraction:0.25,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:false,fraction:0.5,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:false,fraction:0.75,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:false,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:12.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"expressive",opening:true,outlined:true,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"expressive",opening:true,outlined:true,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:0.0,scale:1.03926,cosine:-0.780948,sine:0.624596),
        .init(preset:"expressive",opening:true,outlined:true,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:0.0,scale:1.05059,cosine:-0.999306,sine:-0.0372623),
        .init(preset:"expressive",opening:true,outlined:true,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:0.0,scale:1.05033,cosine:-0.999785,sine:-0.0207237),
        .init(preset:"expressive",opening:true,outlined:true,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"expressive",opening:false,outlined:true,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"expressive",opening:false,outlined:true,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:0.0,scale:1.01074,cosine:0.780948,sine:0.624596),
        .init(preset:"expressive",opening:false,outlined:true,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:0.0,scale:0.999407,cosine:0.999306,sine:-0.0372623),
        .init(preset:"expressive",opening:false,outlined:true,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:0.0,scale:0.99967,cosine:0.999785,sine:-0.0207237),
        .init(preset:"expressive",opening:false,outlined:true,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"standard",opening:true,outlined:true,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"standard",opening:true,outlined:true,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:0.0,scale:1.03036,cosine:-0.330509,sine:0.943803),
        .init(preset:"standard",opening:true,outlined:true,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:0.0,scale:1.04389,cosine:-0.92725,sine:0.374444),
        .init(preset:"standard",opening:true,outlined:true,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:0.0,scale:1.04877,cosine:-0.997035,sine:0.0769555),
        .init(preset:"standard",opening:true,outlined:true,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"standard",opening:false,outlined:true,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"standard",opening:false,outlined:true,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:0.0,scale:1.01964,cosine:0.330509,sine:0.943803),
        .init(preset:"standard",opening:false,outlined:true,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:0.0,scale:1.00611,cosine:0.92725,sine:0.374444),
        .init(preset:"standard",opening:false,outlined:true,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:0.0,scale:1.00123,cosine:0.997035,sine:0.0769555),
        .init(preset:"standard",opening:false,outlined:true,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"fade",opening:true,outlined:true,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"fade",opening:true,outlined:true,fraction:0.25,height:36.4296875,clip:22.1171875,opacity:0.58713,shape:0.0,scale:1.03036,cosine:-0.330509,sine:0.943803),
        .init(preset:"fade",opening:true,outlined:true,fraction:0.5,height:52.6640625,clip:46.2265625,opacity:0.905337,shape:0.0,scale:1.04389,cosine:-0.92725,sine:0.374444),
        .init(preset:"fade",opening:true,outlined:true,fraction:0.75,height:58.5234375,clip:57.0859375,opacity:0.985964,shape:0.0,scale:1.04877,cosine:-0.997035,sine:0.0769555),
        .init(preset:"fade",opening:true,outlined:true,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"fade",opening:false,outlined:true,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"fade",opening:false,outlined:true,fraction:0.25,height:23.5625,clip:9.25,opacity:0.41287,shape:0.0,scale:1.01964,cosine:0.330509,sine:0.943803),
        .init(preset:"fade",opening:false,outlined:true,fraction:0.5,height:7.328125,clip:0.890625,opacity:0.0946628,shape:0.0,scale:1.00611,cosine:0.92725,sine:0.374444),
        .init(preset:"fade",opening:false,outlined:true,fraction:0.75,height:1.46875,clip:0.03125,opacity:0.0140363,shape:0.0,scale:1.00123,cosine:0.997035,sine:0.0769555),
        .init(preset:"fade",opening:false,outlined:true,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"collapse",opening:true,outlined:true,fraction:0.0,height:0.0,clip:0.0,opacity:1.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"collapse",opening:true,outlined:true,fraction:0.25,height:34.6484375,clip:20.0078125,opacity:1.0,shape:0.0,scale:1.02888,cosine:-0.241297,sine:0.970451),
        .init(preset:"collapse",opening:true,outlined:true,fraction:0.5,height:50.3515625,clip:42.25,opacity:1.0,shape:0.0,scale:1.04196,cosine:-0.875162,sine:0.483831),
        .init(preset:"collapse",opening:true,outlined:true,fraction:0.75,height:57.8515625,clip:55.78125,opacity:1.0,shape:0.0,scale:1.04821,cosine:-0.993688,sine:0.112181),
        .init(preset:"collapse",opening:true,outlined:true,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"collapse",opening:false,outlined:true,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"collapse",opening:false,outlined:true,fraction:0.25,height:54.078125,clip:48.7421875,opacity:1.0,shape:0.0,scale:1.02112,cosine:0.241297,sine:0.970451),
        .init(preset:"collapse",opening:false,outlined:true,fraction:0.5,height:40.5078125,clip:27.34375,opacity:1.0,shape:0.0,scale:1.00804,cosine:0.875162,sine:0.483831),
        .init(preset:"collapse",opening:false,outlined:true,fraction:0.75,height:22.1875,clip:8.203125,opacity:1.0,shape:0.0,scale:1.00179,cosine:0.993688,sine:0.112181),
        .init(preset:"collapse",opening:false,outlined:true,fraction:1.0,height:0.0,clip:0.0,opacity:1.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:true,fraction:0.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:true,fraction:0.25,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:true,fraction:0.5,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:true,fraction:0.75,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:true,outlined:true,fraction:1.0,height:60.0,clip:60.0,opacity:1.0,shape:0.0,scale:1.05,cosine:-1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:true,fraction:0.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:true,fraction:0.25,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:true,fraction:0.5,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:true,fraction:0.75,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
        .init(preset:"none",opening:false,outlined:true,fraction:1.0,height:0.0,clip:0.0,opacity:0.0,shape:0.0,scale:1.0,cosine:1.0,sine:0.0),
    ]
}

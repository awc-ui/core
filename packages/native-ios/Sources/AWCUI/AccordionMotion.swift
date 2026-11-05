import Foundation

/// Independent clocks are intentional: disclosure/shape and spatial motion use
/// the selected duration; color, font axes and opacity stop after at most 200 ms.
struct AWCNativeAccordionMotion {
    let preset: String
    let opening: Bool
    let duration: Double
    let effectsDuration: Double
    let reduced: Bool
    let geometryCurve: [Double]
    let spatialCurve: [Double]
    let effectsCurve: [Double]
    struct Frame {
        let height: Double, contentClip: Double, opacity: Double, shape: Double, spatial: Double, effects: Double
        var chevronRadians: Double { .pi * spatial }
        var leadingScale: Double { 1 + 0.05 * spatial }
    }
    init(preset: String = "expressive", opening: Bool, expandDuration: Double? = nil, collapseDuration: Double? = nil,
         reduced: Bool = false, emphasized: [Double] = [0.2,0,0,1], standard: [Double] = [0.2,0,0,1],
         spatial: [Double] = [0.38,1.21,0.22,1], effects: [Double] = [0.34,0.8,0.34,1], effectsLimit: Double = 200) {
        self.preset = preset; self.opening = opening; self.reduced = reduced || preset == "none"
        let fallback = preset == "standard" || preset == "collapse" ? 300.0 : preset == "fade" ? (opening ? 300.0 : 200.0) : (opening ? 350.0 : 250.0)
        let override = opening ? expandDuration : collapseDuration
        duration = self.reduced ? 0 : override.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } ?? fallback
        effectsDuration = min(duration, effectsLimit.isFinite && effectsLimit >= 0 ? effectsLimit : 200)
        func curve(_ candidate: [Double], _ fallback: [Double]) -> [Double] {
            candidate.count == 4 && candidate.allSatisfy(\.isFinite) && (0...1).contains(candidate[0]) && (0...1).contains(candidate[2]) ? candidate : fallback
        }
        let emphasized = curve(emphasized,[0.2,0,0,1]), standard = curve(standard,[0.2,0,0,1])
        geometryCurve = preset == "collapse" ? (opening ? [0,0,0.2,1] : [0.4,0,1,1]) : preset == "fade" ? standard : emphasized
        spatialCurve = preset == "collapse" ? [0,0,0.2,1] : preset == "standard" ? emphasized : preset == "fade" ? standard : curve(spatial,[0.38,1.21,0.22,1])
        effectsCurve = curve(effects,[0.34,0.8,0.34,1])
    }
    func frame(elapsedMilliseconds: Double) -> Frame {
        fractions(disclosure: duration == 0 ? 1 : elapsedMilliseconds / duration,
                  effects: effectsDuration == 0 ? 1 : elapsedMilliseconds / effectsDuration)
    }
    /// Also used to compare Web's independent per-transition sampling oracle.
    func fractions(disclosure: Double, effects: Double) -> Frame {
        func progress(_ fraction: Double, _ curve: [Double]) -> Double {
            let t = reduced || duration == 0 ? 1 : min(1,max(0,fraction.isFinite ? fraction : 0))
            let e = t == 0 ? 0 : t == 1 ? 1 : AWCNativeLoadingMotion.cubic(t,curve[0],curve[1],curve[2],curve[3])
            return opening ? e : 1-e
        }
        let height = min(1,max(0,progress(disclosure,geometryCurve)))
        let effect = min(1,max(0,progress(effectsDuration == 0 ? 1 : effects,effectsCurve)))
        // A sub-unit CSS fr track first reduces the auto-height grid, then its
        // own allocated track. The inner clip therefore follows height² while
        // the content itself remains mounted at its full natural size.
        return .init(height:height,contentClip:height*height,opacity:preset == "collapse" ? 1 : effect,
                     shape:height,spatial:progress(disclosure,spatialCurve),effects:effect)
    }
}

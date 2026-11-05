import Foundation
import Observation
import QuartzCore

/// One running CSS transition of a numeric property (CSS Transitions Level 1,
/// "Starting of transitions"): retargets start from the current value, and a
/// return to the reversing-adjusted start value is shortened by the reversing
/// shortening factor.
struct AWCCSSTransition: Equatable {
    var from: Double, to: Double, start: Double, duration: Double, curve: [Double]
    var reversingAdjustedStart: Double, shortening: Double
    var end: Double { start + duration }
    func outputProgress(_ now: Double) -> Double {
        guard duration > 0 else { return 1 }
        let t = min(1, max(0, (now - start) / duration))
        return t == 0 ? 0 : t == 1 ? 1 : AWCNativeLoadingMotion.cubic(t, curve[0], curve[1], curve[2], curve[3])
    }
    func value(_ now: Double) -> Double { from + (to - from) * outputProgress(now) }
    /// A style change without a transition (zero duration), kept in track history.
    static func instant(_ from: Double, _ to: Double, _ now: Double) -> Self {
        .init(from: from, to: to, start: now, duration: 0, curve: [0,0,1,1], reversingAdjustedStart: to, shortening: 1)
    }
    var animated: Bool { duration > 0 }
}

/// The after-change value of one property plus its running transition, if any.
/// Times are milliseconds on a single monotonic clock.
struct AWCCSSTransitionTrack: Equatable {
    private(set) var value = 0.0
    private(set) var running: AWCCSSTransition?
    /// Every style change on this track in order: started transitions and
    /// zero-duration snaps (inspection and tests).
    private(set) var history: [AWCCSSTransition] = []
    init(initial: Double = 0) { value = initial }
    func presented(_ now: Double) -> Double {
        guard let running, now < running.end else { return value }
        return running.value(now)
    }
    func isRunning(_ now: Double) -> Bool { running.map { now < $0.end } ?? false }
    mutating func set(_ target: Double, now: Double, duration: Double, curve: [Double]) {
        if let old = running, now < old.end {
            if old.to == target { return }
            let current = old.value(now)
            running = nil; value = target
            guard current != target, duration > 0 else { history.append(.instant(current, target, now)); return }
            if old.reversingAdjustedStart == target {
                let factor = min(1, max(0, abs(old.outputProgress(now) * old.shortening + 1 - old.shortening)))
                begin(.init(from: current, to: target, start: now, duration: duration * factor, curve: curve, reversingAdjustedStart: old.to, shortening: factor))
            } else {
                begin(.init(from: current, to: target, start: now, duration: duration, curve: curve, reversingAdjustedStart: current, shortening: 1))
            }
            return
        }
        running = nil
        let current = value; value = target
        guard current != target else { return }
        guard duration > 0 else { history.append(.instant(current, target, now)); return }
        begin(.init(from: current, to: target, start: now, duration: duration, curve: curve, reversingAdjustedStart: current, shortening: 1))
    }
    mutating func snap(_ target: Double) { running = nil; value = target }
    private mutating func begin(_ transition: AWCCSSTransition) { running = transition; history.append(transition) }
}

/// Source reorder motion. While an item is lifted its siblings carry
/// `.md-accordion-item--shifting` (`transform var(--md-sys-motion-duration-short3)
/// var(--_state-easing)`) and the drop placeholder glides with
/// `transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard)`.
/// `transition="none"` and reduced motion remove both transitions. Drop and
/// cancellation clear transforms and classes in the same tick, so they snap.
@Observable final class AWCAccordionReorderMotion {
    private(set) var siblings: [String: AWCCSSTransitionTrack] = [:]
    private(set) var placeholder: AWCCSSTransitionTrack?
    @ObservationIgnored var clock: () -> Double = { CACurrentMediaTime() * 1000 }
    struct Timing: Equatable { var duration: Double; var curve: [Double] }
    static func timing(preset: String, reduced: Bool, tokens: [String: String]) -> (shift: Timing, glide: Timing) {
        if reduced || preset == "none" { return (.init(duration: 0, curve: [0.2,0,0,1]), .init(duration: 0, curve: [0.2,0,0,1])) }
        let emphasized = awcCSSCubicBezier(tokens["--md-sys-motion-easing-emphasized"]) ?? [0.2,0,0,1]
        let standard = awcCSSCubicBezier(tokens["--md-sys-motion-easing-standard"]) ?? [0.2,0,0,1]
        let state = preset == "collapse" ? [0.4,0,0.2,1] : preset == "fade" ? standard : emphasized
        return (.init(duration: awcCSSDuration(tokens["--md-sys-motion-duration-short3"]) ?? 200, curve: state),
                .init(duration: awcCSSDuration(tokens["--md-sys-motion-duration-short4"]) ?? 200, curve: standard))
    }
    func update(dragged: String?, ids: [String], offsets: [String: Double], placeholderTop: Double?, shift: Timing, glide: Timing) {
        guard let dragged else { siblings = [:]; placeholder = nil; return }
        let now = clock()
        var next = siblings
        for id in ids where id != dragged {
            var track = next[id] ?? .init()
            track.set(offsets[id] ?? 0, now: now, duration: shift.duration, curve: shift.curve)
            next[id] = track
        }
        siblings = next
        if let top = placeholderTop {
            if var track = placeholder { track.set(top, now: now, duration: glide.duration, curve: glide.curve); placeholder = track }
            else { var track = AWCCSSTransitionTrack(); track.snap(top); placeholder = track }
        } else { placeholder = nil }
    }
    func offset(_ id: String, now: Double) -> Double { siblings[id]?.presented(now) ?? 0 }
    func placeholderTop(now: Double) -> Double? { placeholder?.presented(now) }
}

/// CSS `<time>` (ms or s) to milliseconds.
func awcCSSDuration(_ raw: String?) -> Double? {
    guard let raw = raw?.trimmingCharacters(in: .whitespaces) else { return nil }
    let ms = raw.hasSuffix("ms"), s = !ms && raw.hasSuffix("s")
    guard ms || s, let n = Double(raw.dropLast(ms ? 2 : 1)), n.isFinite, n >= 0 else { return nil }
    return ms ? n : n * 1000
}
/// `cubic-bezier(x1, y1, x2, y2)` with x in [0, 1].
func awcCSSCubicBezier(_ raw: String?) -> [Double]? {
    guard let raw = raw?.trimmingCharacters(in: .whitespaces), raw.hasPrefix("cubic-bezier("), raw.hasSuffix(")") else { return nil }
    let values = raw.dropFirst(13).dropLast().split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    guard values.count == 4, values.allSatisfy(\.isFinite), (0...1).contains(values[0]), (0...1).contains(values[2]) else { return nil }
    return values
}

import SwiftUI

struct AWCAccordionShiftTargets: Equatable {
    let dragged: String?
    let offsets: [String: Double]
    let placeholder: Double?
    let ids: [String]
}
/// The lifted item follows the pointer without a transition; siblings render
/// their CSS-transition track. With no lifted item every transform is cleared.
struct AWCAccordionShiftOffset: ViewModifier {
    let motion: AWCAccordionReorderMotion, id: String, dragged: String?, draggedOffset: Double
    func body(content: Content) -> some View {
        TimelineView(.animation(paused: dragged == nil || dragged == id)) { context in
            let now = CACurrentMediaTime() * 1000
            let _ = context.date
            content.offset(y: dragged == nil ? 0 : dragged == id ? draggedOffset : motion.offset(id, now: now))
        }
    }
}
struct AWCAccordionGlideOffset: ViewModifier {
    let motion: AWCAccordionReorderMotion, target: Double, inset: Double
    func body(content: Content) -> some View {
        TimelineView(.animation(paused: !(motion.placeholder?.isRunning(CACurrentMediaTime() * 1000) ?? false))) { context in
            let now = CACurrentMediaTime() * 1000
            let _ = context.date
            content.offset(y: (motion.placeholderTop(now: now) ?? target) + inset)
        }
    }
}

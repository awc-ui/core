import Foundation

// Port of packages/core/src/utils/charts/engine/scale.ts (axis scales, breaks and ticks).
// Pure numeric code: the same IEEE-754 operations in the same order as the Web engine so that
// the native RenderScene matches the Web one to 0.01 px.

public enum AWCChartScaleType: String { case category, time, value, log }

/// An axis value: the Web `string | number | Date` (dates arrive as epoch ms or ISO strings).
public enum AWCChartAxisValue: Equatable {
    case number(Double)
    case string(String)
    /// A JS `Date` (epoch ms) — what the engine hands a time-axis formatter.
    case date(Double)
    var numberValue: Double? { if case .number(let n) = self { return n }; return nil }
    var stringValue: String? { if case .string(let s) = self { return s }; return nil }
}

typealias AWCChartDomain = (Double, Double)

struct AWCChartScale {
    let type: AWCChartScaleType
    let size: Double
    let domain: AWCChartDomain
    let bandwidth: Double
    let scale: (Double) -> Double
    let invert: (Double) -> Double
    var breaks: [AWCChartScaleBreak] = []
}

struct AWCChartBreakRange { var from: Double; var to: Double; var gap: Double }
struct AWCChartScaleBreak { var from: Double; var to: Double; var gap: Double; var px: Double }

enum AWCChartBreakSizing: String { case equal, proportional }

/// JS `Number(string)`: trims, empty → 0, decimal/exponent/hex/Infinity, otherwise NaN.
func awcJSNumber(_ raw: String) -> Double {
    let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.isEmpty { return 0 }
    if s == "Infinity" || s == "+Infinity" { return .infinity }
    if s == "-Infinity" { return -.infinity }
    let lower = s.lowercased()
    if lower.hasPrefix("0x"), let v = UInt64(s.dropFirst(2), radix: 16) { return Double(v) }
    if lower.hasPrefix("0b"), let v = UInt64(s.dropFirst(2), radix: 2) { return Double(v) }
    if lower.hasPrefix("0o"), let v = UInt64(s.dropFirst(2), radix: 8) { return Double(v) }
    if lower.contains("inf") || lower.contains("nan") || lower.hasPrefix("0x") { return .nan }
    guard s.allSatisfy({ "0123456789+-.eE".contains($0) }) else { return .nan }
    return Double(s) ?? .nan
}

/// JS `Date.parse` for the ISO forms charts use: date-only strings are UTC, date-times without an
/// offset are local time (ECMAScript rules). Returns NaN for anything else.
func awcJSDateParse(_ raw: String) -> Double {
    let s = raw.trimmingCharacters(in: .whitespaces)
    let pattern = #"^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?(Z|[+-]\d{2}:?\d{2})?$"#
    guard let re = try? NSRegularExpression(pattern: pattern),
          let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return awcJSDateParseLoose(s) }
    func g(_ i: Int) -> String? { let r = m.range(at: i); guard r.location != NSNotFound, let rr = Range(r, in: s) else { return nil }; return String(s[rr]) }
    guard let year = Int(g(1)!) else { return .nan }
    let month = Int(g(2) ?? "1") ?? 1, day = Int(g(3) ?? "1") ?? 1
    let hasTime = g(4) != nil
    let hour = Int(g(4) ?? "0") ?? 0, minute = Int(g(5) ?? "0") ?? 0, second = Int(g(6) ?? "0") ?? 0
    var ms = 0.0
    if let frac = g(7) { ms = (Double("0." + frac) ?? 0) * 1000; ms = ms.rounded(.down) }
    var comps = DateComponents(); comps.year = year; comps.month = month; comps.day = day; comps.hour = hour; comps.minute = minute; comps.second = second
    var cal = Calendar(identifier: .gregorian)
    if let tz = g(8) {
        if tz == "Z" { cal.timeZone = TimeZone(secondsFromGMT: 0)! }
        else {
            let sign = tz.hasPrefix("-") ? -1 : 1
            let digits = tz.dropFirst().replacingOccurrences(of: ":", with: "")
            let hh = Int(digits.prefix(2)) ?? 0, mm = Int(digits.suffix(2)) ?? 0
            cal.timeZone = TimeZone(secondsFromGMT: sign * (hh * 3600 + mm * 60))!
        }
    } else if !hasTime { cal.timeZone = TimeZone(secondsFromGMT: 0)! }
    else { cal.timeZone = TimeZone.current }
    guard (1...12).contains(month), (1...31).contains(day), let date = cal.date(from: comps) else { return .nan }
    return (date.timeIntervalSince1970 * 1000).rounded() + ms
}

/// Fallback for the non-ISO strings V8 also accepts ("Jan 5, 2024", "2024/01/05"): local time.
private func awcJSDateParseLoose(_ s: String) -> Double {
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone.current
    for fmt in ["yyyy/MM/dd", "yyyy/M/d", "MMM d, yyyy", "MMMM d, yyyy", "d MMM yyyy", "MM/dd/yyyy", "M/d/yyyy", "yyyy/MM/dd HH:mm", "yyyy/MM/dd HH:mm:ss", "MMM d, yyyy HH:mm"] {
        f.dateFormat = fmt
        if let d = f.date(from: s) { return (d.timeIntervalSince1970 * 1000).rounded() }
    }
    return .nan
}

func awcChartToNumeric(_ value: AWCChartAxisValue, _ scale: AWCChartScaleType) -> Double {
    if scale == .category { return value.numberValue ?? 0 }
    switch value {
    case .number(let n): return n
    case .date(let ms): return ms
    case .string(let s):
        let asNum = awcJSNumber(s)
        if !asNum.isNaN && scale != .time { return asNum }
        let d = awcJSDateParse(s)
        return d.isNaN ? 0 : d
    }
}

func awcMakeLinearScale(_ domain: AWCChartDomain, _ size: Double, _ type: AWCChartScaleType = .value) -> AWCChartScale {
    var (minV, maxV) = domain
    if minV == maxV { minV -= 1; maxV += 1 }
    let span = maxV - minV
    let lo = minV
    return AWCChartScale(type: type, size: size, domain: (minV, maxV), bandwidth: 0,
                         scale: { v in ((v - lo) / span) * size }, invert: { px in lo + (px / size) * span })
}

func awcMakeLogScale(_ domain: AWCChartDomain, _ size: Double) -> AWCChartScale {
    let positiveMax = domain.1 > 0 ? domain.1 : 1
    let safeMin = domain.0 > 0 ? domain.0 : Swift.max(positiveMax / 1e6, 5e-324)
    let lo = log10(safeMin)
    let hi = log10(Swift.max(positiveMax, safeMin * 10))
    let s = hi - lo
    let span = s == 0 || s.isNaN ? 1 : s
    return AWCChartScale(type: .log, size: size, domain: (safeMin, pow(10, hi)), bandwidth: 0,
                         scale: { v in ((log10(v <= 0 ? safeMin : v) - lo) / span) * size },
                         invert: { px in pow(10, lo + (px / size) * span) })
}

func awcMakeCategoryScale(_ count: Int, _ size: Double, _ alignWithLabel: Bool = true) -> AWCChartScale {
    let n = Double(Swift.max(count, 1))
    let bandwidth = size / n
    let offset = alignWithLabel ? bandwidth / 2 : 0
    return AWCChartScale(type: .category, size: size, domain: (0, n - 1), bandwidth: bandwidth,
                         scale: { i in offset + i * bandwidth }, invert: { px in awcJSRound((px - offset) / bandwidth) })
}

/// JS Math.round: halves round toward +∞.
@inline(__always) func awcJSRound(_ v: Double) -> Double { let r = v.rounded(.down); return v - r >= 0.5 ? r + 1 : r }

let AWC_DEFAULT_BREAK_GAP: Double = 14

func awcNormalizeBreaks(_ breaks: [AWCChartBreakRange], _ domain: AWCChartDomain) -> [AWCChartBreakRange] {
    let (lo, hi) = domain.0 <= domain.1 ? domain : (domain.1, domain.0)
    let clipped = breaks.map { b in AWCChartBreakRange(from: Swift.max(lo, Swift.min(b.from, b.to)), to: Swift.min(hi, Swift.max(b.from, b.to)), gap: b.gap) }
        .filter { $0.to > $0.from && $0.from > lo && $0.to <= hi }
        .awcStableSorted { $0.from < $1.from }
    var merged: [AWCChartBreakRange] = []
    for b in clipped {
        if var last = merged.last, b.from <= last.to {
            last.to = Swift.max(last.to, b.to); last.gap = Swift.max(last.gap, b.gap); merged[merged.count - 1] = last
        } else { merged.append(b) }
    }
    return merged
}

func awcOpenTopSection(_ ranges: [AWCChartBreakRange], _ domain: AWCChartDomain, _ scale: AWCChartScaleType) -> [AWCChartBreakRange] {
    var out = ranges
    if out.isEmpty || scale == .log { return out }
    let last = out[out.count - 1]
    if domain.1 - last.to > 1e-9 { return out }
    let belowFrom = out.count > 1 ? out[out.count - 2].to : domain.0
    let belowRange = last.from - belowFrom
    if !(belowRange > 0) { return out }
    let t = awcNiceLinearTicks(0, domain.1, 6)
    let outlierStep = t.count > 1 ? t[1] - t[0] : 0
    let range = Swift.max(belowRange, outlierStep)
    let newTo = domain.1 - range
    if newTo > last.from + 1e-9 { out[out.count - 1].to = newTo }
    return out
}

func awcAutoBreaks(_ values: [Double], minGap: Double? = nil, maxBreaks: Int? = nil, gap: Double? = nil) -> [AWCChartBreakRange] {
    let mg = minGap ?? 8, mb = maxBreaks ?? 2
    var seen = Set<Double>(); var uniq: [Double] = []
    for v in values where v.isFinite { if seen.insert(v).inserted { uniq.append(v) } }
    let sorted = uniq.sorted()
    if sorted.count < 4 { return [] }
    var gaps: [(from: Double, to: Double, size: Double)] = []
    for i in 1..<sorted.count { gaps.append((sorted[i - 1], sorted[i], sorted[i] - sorted[i - 1])) }
    let sizes = gaps.map(\.size).sorted()
    let median = sizes[sizes.count / 2]
    if median <= 0 { return [] }
    let chosen = gaps.filter { $0.size >= median * mg }.awcStableSorted { $0.size > $1.size }.prefix(mb)
    return chosen.map { AWCChartBreakRange(from: $0.from, to: $0.to, gap: gap ?? AWC_DEFAULT_BREAK_GAP) }.awcStableSorted { $0.from < $1.from }
}

func awcMakeBrokenScale(_ domain: AWCChartDomain, _ size: Double, _ type: AWCChartScaleType, _ breaks: [AWCChartBreakRange], _ sizing: AWCChartBreakSizing = .equal) -> AWCChartScale {
    let base = type == .log ? awcMakeLogScale(domain, size) : awcMakeLinearScale(domain, size, type)
    let ranges = awcNormalizeBreaks(breaks, base.domain)
    if ranges.isEmpty { return base }
    struct Cut { var from, to, gap, fromPx, toPx: Double }
    let cuts = ranges.map { Cut(from: $0.from, to: $0.to, gap: $0.gap, fromPx: base.scale($0.from), toPx: base.scale($0.to)) }
    let gaps = cuts.reduce(0) { $0 + $1.gap }
    var spans: [(from: Double, to: Double)] = []
    var cursor = 0.0
    for c in cuts { spans.append((cursor, c.fromPx)); cursor = c.toPx }
    spans.append((cursor, size))
    let usable = Swift.max(0, size - gaps)
    let totalSpan = spans.reduce(0) { $0 + Swift.max(0, $1.to - $1.from) }
    struct Sec { var from, to, width, out, outStart: Double }
    var placed: [Sec] = []
    var outCursor = 0.0
    for (i, s) in spans.enumerated() {
        let width = Swift.max(0, s.to - s.from)
        let out = sizing == .equal ? usable / Double(spans.count) : (totalSpan > 0 ? (width / totalSpan) * usable : usable / Double(spans.count))
        let start = outCursor
        outCursor += out + (i < cuts.count ? cuts[i].gap : 0)
        placed.append(Sec(from: s.from, to: s.to, width: width, out: out, outStart: start))
    }
    let scaleBreaks = cuts.enumerated().map { i, c in AWCChartScaleBreak(from: c.from, to: c.to, gap: c.gap, px: placed[i].outStart + placed[i].out) }
    let p = placed
    return AWCChartScale(type: type, size: size, domain: base.domain, bandwidth: 0, scale: { v in
        let px = base.scale(v)
        for i in 0..<p.count {
            let sec = p[i]
            if px <= sec.to || i == p.count - 1 {
                if px < sec.from { return i > 0 ? p[i - 1].outStart + p[i - 1].out : sec.outStart }
                let t = sec.width > 0 ? (px - sec.from) / sec.width : 1
                return sec.outStart + t * sec.out
            }
        }
        return size
    }, invert: { px in
        for i in 0..<p.count {
            let sec = p[i]
            let end = sec.outStart + sec.out
            if px <= end || i == p.count - 1 {
                let t = sec.out > 0 ? (Swift.max(px, sec.outStart) - sec.outStart) / sec.out : 0
                return base.invert(sec.from + t * sec.width)
            }
        }
        return base.domain.1
    }, breaks: scaleBreaks)
}

/// `MdChartAxisBreaks`: an array of ranges, the string "auto", or an options object.
struct AWCChartAxisBreaks {
    var ranges: [(from: AWCChartAxisValue, to: AWCChartAxisValue, gap: Double?)] = []
    var auto = false
    var minGap: Double?
    var maxBreaks: Int?
    var gap: Double?
    var sizing: AWCChartBreakSizing?
}

func awcResolveAxisBreaks(_ breaks: AWCChartAxisBreaks?, _ values: [Double], _ scale: AWCChartScaleType) -> (ranges: [AWCChartBreakRange], sizing: AWCChartBreakSizing) {
    guard let opts = breaks else { return ([], .equal) }
    let gap = opts.gap ?? AWC_DEFAULT_BREAK_GAP
    let explicit = opts.ranges.map { AWCChartBreakRange(from: awcChartToNumeric($0.from, scale), to: awcChartToNumeric($0.to, scale), gap: $0.gap ?? gap) }
    let found = opts.auto ? awcAutoBreaks(values, minGap: opts.minGap, maxBreaks: opts.maxBreaks, gap: gap) : []
    return (explicit + found, opts.sizing ?? .equal)
}

func awcSectionedTicks(_ domain: AWCChartDomain, _ breaks: [AWCChartBreakRange], _ scale: AWCChartScaleType, _ target: Int = 6) -> [Double] {
    func ticksFor(_ lo: Double, _ hi: Double, _ n: Int) -> [Double] {
        scale == .log ? awcLogTicks(lo, hi) : scale == .time ? awcTimeTicks(lo, hi, n) : awcNiceLinearTicks(lo, hi, n)
    }
    let ranges = awcNormalizeBreaks(breaks, domain)
    if ranges.isEmpty { return ticksFor(domain.0, domain.1, target) }
    var sections: [(Double, Double)] = []
    var cursor = domain.0
    for b in ranges { sections.append((cursor, b.from)); cursor = b.to }
    sections.append((cursor, domain.1))
    let per = Swift.max(3, Int(awcJSRound(Double(target) / Double(sections.count))))
    func sectionTicks(_ lo: Double, _ hi: Double) -> [Double] {
        var ticks: [Double] = []
        for n in [per, per * 2, per * 4] {
            ticks = ticksFor(lo, hi, n).filter { $0 >= lo - 1e-9 && $0 <= hi + 1e-9 }
            if ticks.count >= 3 || scale == .log { break }
        }
        return ticks
    }
    var out: [Double] = []
    for (lo, hi) in sections where hi > lo { out.append(contentsOf: sectionTicks(lo, hi)) }
    var seen = Set<Double>(); var uniq: [Double] = []
    for v in out where seen.insert(v).inserted { uniq.append(v) }
    return uniq.sorted()
}

func awcInBreak(_ breaks: [AWCChartBreakRange], _ v: Double) -> Bool { breaks.contains { v > $0.from && v < $0.to } }
func awcInBreak(_ breaks: [AWCChartScaleBreak], _ v: Double) -> Bool { breaks.contains { v > $0.from && v < $0.to } }

func awcNiceLinearTicks(_ minV: Double, _ maxV: Double, _ target: Int = 6) -> [Double] {
    let lo = Swift.min(minV, maxV), hi = Swift.max(minV, maxV)
    if lo == hi { return [lo] }
    let step = awcNiceNum((hi - lo) / Double(Swift.max(target - 1, 1)), true)
    let niceMin = (lo / step).rounded(.down) * step
    let niceMax = (hi / step).rounded(.up) * step
    var ticks: [Double] = []
    let maxTicks = Int(awcJSRound((niceMax - niceMin) / step)) + 1
    if maxTicks > 0 { for i in 0..<maxTicks { let v = niceMin + Double(i) * step; ticks.append(abs(v) < step / 1e6 ? 0 : v) } }
    return ticks.filter { $0 >= lo - step / 1e6 && $0 <= hi + step / 1e6 }
}

private func awcNiceNum(_ range: Double, _ round: Bool) -> Double {
    let exp = log10(range).rounded(.down)
    let frac = range / pow(10, exp)
    let nice: Double
    if round { nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10 }
    else { nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10 }
    return nice * pow(10, exp)
}

func awcLogTicks(_ minV: Double, _ maxV: Double) -> [Double] {
    let lo = Int(log10(minV > 0 ? minV : maxV / 1e6).rounded(.down))
    let hi = Int(log10(maxV).rounded(.up))
    var ticks: [Double] = []
    if lo <= hi { for e in lo...hi { ticks.append(pow(10, Double(e))) } }
    return ticks.filter { $0 >= minV && $0 <= maxV }
}

func awcTimeTicks(_ minMs: Double, _ maxMs: Double, _ target: Int = 6) -> [Double] {
    let span = maxMs - minMs
    if span <= 0 { return [minMs] }
    let S = 1000.0, M = 60 * S, H = 60 * M, D = 24 * H
    let steps = [S, 5 * S, 15 * S, 30 * S, M, 5 * M, 15 * M, 30 * M, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 7 * D, 14 * D, 30 * D, 90 * D, 180 * D, 365 * D]
    let ideal = span / Double(Swift.max(target - 1, 1))
    let idx = steps.firstIndex { $0 >= ideal }
    var step = idx == nil ? steps[steps.count - 1] : steps[idx!]
    if let i = idx, i > 0 { let finer = steps[i - 1]; if span / finer <= Double(Swift.max(target - 1, 1)) * 1.4 { step = finer } }
    let start = (minMs / step).rounded(.up) * step
    var ticks: [Double] = []
    var t = start
    while t <= maxMs { ticks.append(t); t += step }
    return ticks
}

func awcComputeDomain(_ values: [Double], min: Double? = nil, max: Double? = nil, scale: AWCChartScaleType = .value, includeZero: Bool = false) -> AWCChartDomain {
    let isLog = scale == .log
    var dataLo = Double.infinity, dataHi = -Double.infinity, hasFinite = false
    for v in values {
        if !v.isFinite { continue }
        if isLog && v <= 0 { continue }
        hasFinite = true
        if v < dataLo { dataLo = v }
        if v > dataHi { dataHi = v }
    }
    if !hasFinite { dataLo = isLog ? 1 : 0; dataHi = isLog ? 10 : 1 }
    let loExplicit = min != nil && min!.isFinite
    let hiExplicit = max != nil && max!.isFinite
    var lo = loExplicit ? min! : dataLo
    var hi = hiExplicit ? max! : dataHi
    if isLog {
        if !loExplicit && lo > 0 { lo = pow(10, log10(lo).rounded(.down)) }
        if !hiExplicit && hi > 0 { hi = pow(10, log10(hi).rounded(.up)) }
        if lo == hi { lo /= 10; hi *= 10 }
        return (lo, hi)
    }
    if includeZero {
        if !loExplicit && lo > 0 { lo = 0 }
        if !hiExplicit && hi < 0 { hi = 0 }
    }
    if lo == hi { lo -= 1; hi += 1 }
    return (lo, hi)
}

extension Array {
    /// JS Array.prototype.sort is stable (ES2019); Swift's sort is not guaranteed stable.
    func awcStableSorted(by less: (Element, Element) -> Bool) -> [Element] {
        enumerated().sorted { a, b in less(a.element, b.element) || (!less(b.element, a.element) && a.offset < b.offset) }.map(\.element)
    }
}

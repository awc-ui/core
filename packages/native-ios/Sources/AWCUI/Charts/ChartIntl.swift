import Foundation
import JavaScriptCore

/// `Number.prototype.toLocaleString` / `Date.prototype.toLocaleString` with the Web defaults.
/// Like AWCMeterFormatter, Apple platforms run the system ICU-backed Intl of JavaScriptCore so
/// grouping, decimal and date patterns follow the same CLDR rules as the browser; only numbers,
/// dates and locale tags cross the bridge (author strings are never evaluated).
enum AWCChartIntl {
    private static let engine = Engine()

    static func number(_ value: Double, _ locale: String) -> String { engine.number(value, locale) }
    static func date(_ ms: Double, _ locale: String) -> String { engine.date(ms, locale) }
    /// Intl.NumberFormat with explicit options (percent axes, compact ticks).
    static func number(_ value: Double, _ locale: String, options: [String: Any]) -> String { engine.number(value, locale, options) }

    private final class Engine {
        private let lock = NSRecursiveLock()
        private let context = JSContext()!
        private let numberFn: JSValue, dateFn: JSValue, optionsFn: JSValue
        private var cache: [String: String] = [:], order: [String] = []
        init() {
            numberFn = context.evaluateScript("(function(v, l){ try { return v.toLocaleString(l || undefined); } catch (_) { return v.toLocaleString(); } })")!
            dateFn = context.evaluateScript("(function(ms, l){ try { return new Date(ms).toLocaleString(l || undefined); } catch (_) { return new Date(ms).toLocaleString(); } })")!
            optionsFn = context.evaluateScript("(function(v, l, o){ try { return new Intl.NumberFormat(l || undefined, o).format(v); } catch (_) { return String(v); } })")!
        }
        private func cached(_ key: String, _ make: () -> String) -> String {
            lock.lock(); defer { lock.unlock() }
            if let hit = cache[key] { return hit }
            let out = make()
            if order.count >= 512 { cache[order.removeFirst()] = nil }
            order.append(key); cache[key] = out
            return out
        }
        func number(_ v: Double, _ l: String) -> String {
            cached("n\(v.bitPattern)|\(l)") { numberFn.call(withArguments: [v, l])?.toString() ?? awcJSNumberString(v) }
        }
        func date(_ ms: Double, _ l: String) -> String {
            cached("d\(ms.bitPattern)|\(l)") { dateFn.call(withArguments: [ms, l])?.toString() ?? "" }
        }
        func number(_ v: Double, _ l: String, _ o: [String: Any]) -> String {
            let key = "o\(v.bitPattern)|\(l)|\(o.keys.sorted().map { "\($0)=\(o[$0]!)" }.joined(separator: ","))"
            return cached(key) { optionsFn.call(withArguments: [v, l, o])?.toString() ?? awcJSNumberString(v) }
        }
    }
}

/// options.ts `defaultValueFormatter`.
func awcChartDefaultValueFormatter(_ v: AWCChartAxisValue?, _ locale: String) -> String {
    guard let v else { return "" }
    switch v {
    case .date(let ms): return AWCChartIntl.date(ms, locale)
    case .number(let n): return AWCChartIntl.number(n, locale)
    case .string(let s): return s
    }
}

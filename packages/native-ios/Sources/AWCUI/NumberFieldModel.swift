import Foundation
import JavaScriptCore
import SwiftUI

/// md-number-field properties (source defaults).
struct AWCNumberFieldModel: Equatable {
    var variant = "filled", label = "", placeholder = "", supportingText = "", errorText = ""
    var error = false, disabled = false, readOnly = false, required = false, reserveSupportingSpace = false, hidden = false
    var name = "", density: Double? = nil, value: Double? = nil, locale = ""
    /// `format-options`: the JSON text of the options object (property object or attribute string; "" = none).
    var formatJSON = ""
    var min: Double? = nil, max: Double? = nil, step = 1.0, smallStep = 0.1, largeStep = 10.0
    var snapOnStep = false, allowOutOfRange = false, allowWheelScrub = false
    var steppers = "inline", incrementLabel = "Increment", decrementLabel = "Decrement", valueMissingLabel = "Please enter a number."
    var ariaLabel = ""

    init(properties p: [String: AWCValue]) {
        func s(_ k: String, _ d: String = "") -> String { p[k]?.string ?? d }
        func b(_ k: String) -> Bool { p[k]?.bool ?? false }
        func n(_ k: String) -> Double? { Self.number(p[k]) }
        variant = s("variant") == "outlined" ? "outlined" : "filled"
        label = s("label"); placeholder = s("placeholder"); supportingText = s("supportingText"); errorText = s("errorText")
        error = b("error"); disabled = b("disabled"); readOnly = b("readOnly") || b("readonly"); required = b("required")
        reserveSupportingSpace = b("reserveSupportingSpace"); hidden = b("hidden"); name = s("name")
        density = n("density").flatMap { [0, -1, -2, -3, -4].contains($0) ? $0 : nil }
        value = n("value"); locale = s("locale")
        switch p["formatOptions"] { case .some(.string(let t)): formatJSON = t; case .some(.object(let o)): formatJSON = AWCValue.object(o).json; default: formatJSON = "" }
        min = n("min"); max = n("max")
        step = n("step") ?? 1; smallStep = n("smallStep") ?? 0.1; largeStep = n("largeStep") ?? 10
        snapOnStep = b("snapOnStep"); allowOutOfRange = b("allowOutOfRange"); allowWheelScrub = b("allowWheelScrub")
        steppers = s("steppers", "inline")
        incrementLabel = s("incrementLabel", "Increment"); decrementLabel = s("decrementLabel", "Decrement")
        valueMissingLabel = s("valueMissingLabel", "Please enter a number.")
        ariaLabel = [s("aria-label"), s("ariaLabel")].first { !$0.isEmpty } ?? ""
    }
    /// `Number(x)` of a framework-written value: numbers, numeric strings; everything else (and non-finite) is null.
    static func number(_ v: AWCValue?) -> Double? {
        switch v {
        case .some(.number(let d)): return d.isFinite ? d : nil
        case .some(.string(let t)):
            let trimmed = t.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, let d = Double(trimmed) else { return nil }
            return d.isFinite ? d : nil
        default: return nil
        }
    }
    var stepAmount: Double { step.isFinite && step > 0 ? step : 1 }
    var inline: Bool { steppers == "inline" }
    var split: Bool { steppers == "split" }
}

/// The source's Intl.NumberFormat machinery, run by JavaScriptCore so display, the format-aware parser and the key filter
/// are Chrome's (ICU) for every locale and option: `buildFormatInfo`, `parseNumber` and `hasOnlyAllowedChars` verbatim.
@MainActor final class AWCNumberIntl {
    static let shared = AWCNumberIntl()
    private let context = JSContext()!
    private let api: JSValue
    private var formatCache: [String: String] = [:]
    private init() {
        api = context.evaluateScript(#"""
        (function () {
          const BIDI = /[؜​‎‏‪-‮⁦-⁩]/g, SPACE = /[\s   ]/, SPACE_G = /[\s   ]/g;
          const cache = new Map();
          function options(json) { if (!json || !json.trim()) return undefined; try { const p = JSON.parse(json); return p && typeof p === 'object' && !Array.isArray(p) ? p : undefined; } catch (_) { return undefined; } }
          function build(locale, opts) {
            const resolved = locale || undefined; let formatter;
            try { formatter = new Intl.NumberFormat(resolved, opts); } catch (_) { formatter = new Intl.NumberFormat(resolved); }
            let group = '', decimal = '', minus = '-', plus = '+', percent = '', symbolChars = '';
            const plain = new Intl.NumberFormat(resolved);
            for (const part of plain.formatToParts(-12345678.9)) { if (part.type === 'group') group = part.value; else if (part.type === 'decimal') decimal = part.value; else if (part.type === 'minusSign') minus = part.value; }
            for (const part of formatter.formatToParts(-12345678.9)) {
              switch (part.type) { case 'group': group = part.value; break; case 'decimal': decimal = part.value; break; case 'minusSign': minus = part.value; break;
                case 'plusSign': plus = part.value; break; case 'percentSign': percent = part.value; break; case 'currency': case 'unit': case 'literal': symbolChars += part.value; break; }
            }
            const digitMap = new Map(); const digits = new Intl.NumberFormat(resolved, { useGrouping: false });
            for (let d = 0; d <= 9; d++) { const g = digits.format(d); if (g !== String(d)) digitMap.set(g, String(d)); }
            let isPercent = false; try { isPercent = formatter.resolvedOptions().style === 'percent'; } catch (_) {}
            const allowed = new Set(); for (let d = 0; d <= 9; d++) allowed.add(String(d));
            for (const g of digitMap.keys()) allowed.add(g);
            for (const ch of group + decimal + minus + plus + symbolChars) allowed.add(ch);
            allowed.add('-'); allowed.add('+');
            if (isPercent) { allowed.add('%'); if (percent) allowed.add(percent); }
            if (SPACE.test(group + symbolChars)) allowed.add(' ');
            return { formatter, group, decimal, minus, plus, percent, symbolChars, digitMap, isPercent, allowed };
          }
          function info(locale, json) { const key = locale + '|' + json; let i = cache.get(key); if (!i) { i = build(locale, options(json)); cache.set(key, i); } return i; }
          return {
            format(locale, json, v) { const i = info(locale, json); try { return i.formatter.format(v); } catch (_) { return String(v); } },
            parse(locale, json, raw) {
              if (!raw) return null; const info_ = info(locale, json); let s = raw.replace(BIDI, '');
              if (info_.digitMap.size > 0) { let m = ''; for (const ch of s) m += info_.digitMap.get(ch) ?? ch; s = m; }
              for (const ch of new Set(info_.symbolChars)) s = s.split(ch).join('');
              s = s.replace(SPACE_G, ''); if (info_.percent) s = s.split(info_.percent).join(''); s = s.split('%').join('');
              if (info_.group) s = s.split(info_.group).join('');
              if (info_.decimal && info_.decimal !== '.') s = s.split(info_.decimal).join('.');
              if (info_.minus && info_.minus !== '-') s = s.split(info_.minus).join('-');
              if (info_.plus && info_.plus !== '+') s = s.split(info_.plus).join('+');
              s = s.replace(/[‒–−]/g, '-');
              if (s === '' || s === '-' || s === '+') return null;
              const n = Number(s); if (!Number.isFinite(n)) return null;
              return info_.isPercent ? n / 100 : n;
            },
            allowedText(locale, json, raw) { const i = info(locale, json); for (const ch of raw.replace(BIDI, '')) { if (i.allowed.has(ch) || SPACE.test(ch)) continue; return false; } return true; },
            allowedKey(locale, json, ch) { return info(locale, json).allowed.has(ch); },
            fractional(json) { const fo = options(json); return fo != null && (((fo.maximumFractionDigits ?? 0) > 0) || ((fo.minimumFractionDigits ?? 0) > 0) || fo.style === 'currency' || fo.style === 'percent'); },
            cleanFloat(n) { if (!Number.isFinite(n)) return n; const p = parseFloat(n.toPrecision(15)); return Math.abs(p - n) < 1e-10 ? p : n; },
          };
        })()
        """#)!
    }
    func format(_ v: Double?, _ m: AWCNumberFieldModel) -> String {
        guard let v else { return "" }
        let key = "\(m.locale)|\(m.formatJSON)|\(v.bitPattern)"
        if let hit = formatCache[key] { return hit }
        let out = api.invokeMethod("format", withArguments: [m.locale, m.formatJSON, v])?.toString() ?? String(v)
        if formatCache.count > 512 { formatCache.removeAll() }
        formatCache[key] = out; return out
    }
    func parse(_ raw: String, _ m: AWCNumberFieldModel) -> Double? {
        guard let r = api.invokeMethod("parse", withArguments: [m.locale, m.formatJSON, raw]), r.isNumber else { return nil }
        return r.toDouble()
    }
    func allowedText(_ raw: String, _ m: AWCNumberFieldModel) -> Bool { api.invokeMethod("allowedText", withArguments: [m.locale, m.formatJSON, raw])?.toBool() ?? true }
    func allowedKey(_ ch: String, _ m: AWCNumberFieldModel) -> Bool { api.invokeMethod("allowedKey", withArguments: [m.locale, m.formatJSON, ch])?.toBool() ?? true }
    func fractionalFormat(_ m: AWCNumberFieldModel) -> Bool { api.invokeMethod("fractional", withArguments: [m.formatJSON])?.toBool() ?? false }
    /// `toPrecision(15)` float clean-up with the 1e-10 cap (stepping only; typed values stay verbatim).
    func cleanFloat(_ n: Double) -> Double { api.invokeMethod("cleanFloat", withArguments: [n])?.toDouble() ?? n }
}

/// Constraint validity of md-number-field: a custom message wins (customError), else an empty required field is
/// valueMissing with `errorText || valueMissingLabel`.
struct AWCNumberFieldValidity: Equatable {
    let valid: Bool, message: String, flags: [String: Bool], flag: String?
    init(custom: String, required: Bool, empty: Bool, missingMessage: String) {
        var f = Dictionary(uniqueKeysWithValues: AWCConstraintValidity.flagNames.map { ($0, false) })
        if !custom.isEmpty { f["customError"] = true; valid = false; message = custom; flag = "customError" }
        else if required && empty { f["valueMissing"] = true; valid = false; message = missingMessage; flag = "valueMissing" }
        else { valid = true; message = ""; flag = nil }
        flags = f
    }
    var key: String { "\(valid)|\(message)" }
    var value: AWCValue { .object(["valid": .bool(valid), "validationMessage": .string(message), "flags": .object(flags.mapValues(AWCValue.bool))]) }
    var constraint: AWCConstraintValidity { AWCConstraintValidity(flag: flag, message: message) }
}

import Foundation

// md-date-picker model: a port of the source's date-utils.ts (pure calendar-day helpers). Days are civil dates (no time zone):
// ISO `YYYY-MM-DD` values, the 6-row month matrix with outside days, locale field order / separator / week start, typed-entry
// parsing (ISO, compact digits, separated fields) and the min / max range. Locale data comes from the platform's ICU (CLDR),
// the same source Chrome's Intl reads.

/// A calendar day (proleptic Gregorian, no time zone).
public struct AWCDay: Hashable, Comparable, Sendable, CustomStringConvertible {
    public let year: Int, month: Int, day: Int   // month 1…12
    public init(year: Int, month: Int, day: Int) { self.year = year; self.month = month; self.day = day }
    /// A real calendar day, else nil (`buildValidatedDate`).
    public static func valid(_ year: Int, _ month: Int, _ day: Int) -> AWCDay? {
        guard (1...12).contains(month), day >= 1, day <= AWCDay.daysIn(year, month) else { return nil }
        return AWCDay(year: year, month: month, day: day)
    }
    public static func daysIn(_ year: Int, _ month: Int) -> Int {
        switch month { case 2: return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 ? 29 : 28
        case 4, 6, 9, 11: return 30
        default: return 31 }
    }
    /// ISO `YYYY-MM-DD` (strict: a real day, four-digit year).
    public static func iso(_ text: String) -> AWCDay? {
        let t = text.trimmingCharacters(in: .whitespaces), p = t.split(separator: "-", omittingEmptySubsequences: false)
        guard p.count == 3, p[0].count == 4, p[1].count == 2, p[2].count == 2, p.allSatisfy({ $0.allSatisfy(\.isASCII) && $0.allSatisfy(\.isNumber) }),
              let y = Int(p[0]), let m = Int(p[1]), let d = Int(p[2]) else { return nil }
        return valid(y, m, d)
    }
    public var iso: String { String(format: "%04d-%02d-%02d", year, month, day) }
    public var description: String { iso }
    public static func < (a: AWCDay, b: AWCDay) -> Bool { (a.year, a.month, a.day) < (b.year, b.month, b.day) }
    /// Days since 1970-01-01 (civil-from-days inverse; exact for the Gregorian calendar).
    public var ordinal: Int {
        let y = month <= 2 ? year - 1 : year, era = (y >= 0 ? y : y - 399) / 400, yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1, doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }
    public init(ordinal z0: Int) {
        let z = z0 + 719468, era = (z >= 0 ? z : z - 146096) / 146097, doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365, doy = doe - (365 * yoe + yoe / 4 - yoe / 100), mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1, m = mp < 10 ? mp + 3 : mp - 9
        self.init(year: yoe + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d)
    }
    /// 0 = Sunday … 6 = Saturday (`Date.getDay`).
    public var weekday: Int { ((ordinal % 7) + 11) % 7 }
    public func adding(days n: Int) -> AWCDay { AWCDay(ordinal: ordinal + n) }
    /// `addMonths`: the same day clamped to the target month's length.
    public func adding(months n: Int) -> AWCDay {
        let total = year * 12 + (month - 1) + n, y = Int((Double(total) / 12).rounded(.down)), m = total - y * 12 + 1
        return AWCDay(year: y, month: m, day: Swift.min(day, AWCDay.daysIn(y, m)))
    }
    /// Today in the given time zone (the source uses the browser's local date).
    public static func today(_ zone: TimeZone = .current, now: Date = Date()) -> AWCDay {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = zone
        let c = cal.dateComponents([.year, .month, .day], from: now)
        return AWCDay(year: c.year ?? 1970, month: c.month ?? 1, day: c.day ?? 1)
    }
    /// A Foundation date at noon UTC of this day (formatting only; noon keeps every zone on the same civil day).
    var noonUTC: Date { Date(timeIntervalSince1970: Double(ordinal) * 86400 + 43200) }
}

/// One cell of the 6 × 7 month matrix.
public struct AWCDayCell: Hashable, Sendable { public let day: AWCDay; public let outOfMonth: Bool }

/// Locale-dependent formatting (Intl.DateTimeFormat equivalents over the platform's ICU / CLDR data).
public struct AWCDateLocale: Sendable {
    public let identifier: String
    let locale: Locale
    /// Empty `locale` = `fallback` (the view's environment locale: the platform's current locale, as the browser default).
    public init(_ identifier: String, fallback: Locale = .current) {
        let id = identifier.trimmingCharacters(in: .whitespaces)
        self.identifier = id.isEmpty ? fallback.identifier : id
        self.locale = id.isEmpty ? fallback : Locale(identifier: id.replacingOccurrences(of: "_", with: "-"))
    }
    func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter(); f.locale = locale; f.calendar = Calendar(identifier: .gregorian); f.timeZone = TimeZone(identifier: "UTC")
        f.setLocalizedDateFormatFromTemplate(template); return f
    }
    /// The numeric date pattern's field order and literal (`{year:'numeric', month:'2-digit', day:'2-digit'}` formatToParts).
    var numericParts: [(kind: Character, literal: String)] {
        let pattern = formatter("yyyyMMdd").dateFormat ?? "MM/dd/yyyy"
        var out: [(Character, String)] = [], literal = "", quoted = false, last: Character? = nil
        for ch in pattern {
            if ch == "'" { quoted.toggle(); continue }
            if !quoted, "yMd".contains(ch) {
                if !literal.isEmpty { out.append(("l", literal)); literal = "" }
                if last != ch { out.append((ch, "")) }
                last = ch
            } else { literal.append(ch); last = nil }
        }
        if !literal.isEmpty { out.append(("l", literal)) }
        return out
    }
    /// `resolveDateSeparator`: the explicit separator, else the locale's first literal ("/" when none).
    public func separator(_ explicit: String = "") -> String {
        if !explicit.isEmpty { return explicit }
        return numericParts.first { $0.kind == "l" }?.literal ?? "/"
    }
    /// `formatDisplayDate`: two-digit day / month and the full year (ASCII digits) in locale order, joined by the separator.
    public func display(_ d: AWCDay, separator explicit: String = "") -> String {
        let sep = separator(explicit)
        return numericParts.map { p -> String in
            switch p.kind { case "d": return String(format: "%02d", d.day); case "M": return String(format: "%02d", d.month); case "y": return String(d.year); default: return sep }
        }.joined()
    }
    /// `dateFormatPattern`: e.g. MM/DD/YYYY, DD.MM.YYYY.
    public func pattern(separator explicit: String = "") -> String {
        let sep = separator(explicit)
        return numericParts.map { p -> String in switch p.kind { case "d": return "DD"; case "M": return "MM"; case "y": return "YYYY"; default: return sep } }.joined()
    }
    /// `prefersDayFirst`: the day field precedes the month field.
    public var dayFirst: Bool {
        let kinds = numericParts.map(\.kind)
        guard let d = kinds.firstIndex(of: "d"), let m = kinds.firstIndex(of: "M") else { return false }
        return d < m
    }
    /// `getFirstDayOfWeek` (0 = Sunday): CLDR's first day for the locale's region.
    public var firstDayOfWeek: Int { var c = Calendar(identifier: .gregorian); c.locale = locale; return (c.firstWeekday - 1 + 7) % 7 }
    /// `weekdayNames(locale, first, format)`: narrow / short / long format-context names from `first`.
    public func weekdays(first: Int, style: String = "narrow") -> [String] {
        let f = DateFormatter(); f.locale = locale; f.calendar = Calendar(identifier: .gregorian)
        let all = (style == "long" ? f.weekdaySymbols : style == "short" ? f.shortWeekdaySymbols : f.veryShortWeekdaySymbols) ?? []
        guard all.count == 7 else { return [] }
        return (0..<7).map { all[(first + $0) % 7] }
    }
    /// Patterns Chrome 153's ICU produces for a skeleton where the platform's ICU (CLDR version) differs, by language — measured
    /// against the Mac oracle; every other locale / skeleton uses the platform's pattern (decision 8).
    static let chromePatterns: [String: [String: String]] = [
        "de": ["MMMEd": "EEE, d. MMM"],
        "ja": ["yMMMMEEEEd": "y年M月d日EEEE"],
        "ar": ["MMMEd": "EEEE، d MMM", "yMMMMEEEEd": "EEEE، d MMMM y"],
    ]
    /// A day formatted with an ICU skeleton ("MMMEd" headline, "yMMMM" month header, "yMMMMEEEEd" a cell's full name).
    public func format(_ d: AWCDay, skeleton: String) -> String {
        let f = formatter(skeleton)
        if let lang = locale.language.languageCode?.identifier, let p = Self.chromePatterns[lang]?[skeleton] { f.dateFormat = p }
        return f.string(from: d.noonUTC)
    }
}

/// md-date-picker's calendar arithmetic (date-utils.ts).
public enum AWCDatePickerModel {
    /// `buildMonthMatrix`: 42 days starting on the week containing the 1st (`firstDayOfWeek` 0 = Sunday).
    public static func monthMatrix(year: Int, month: Int, firstDayOfWeek: Int) -> [AWCDayCell] {
        let first = AWCDay(year: year, month: month, day: 1), lead = (first.weekday - firstDayOfWeek + 7) % 7, start = first.adding(days: -lead)
        return (0..<42).map { i in let d = start.adding(days: i); return AWCDayCell(day: d, outOfMonth: d.month != month) }
    }
    /// `isOutOfRange` against ISO bounds ("" = unbounded; invalid bounds are ignored like the source's string compare).
    public static func outOfRange(_ d: AWCDay, min: String, max: String) -> Bool {
        (!min.isEmpty && min > d.iso) || (!max.isEmpty && d.iso > max)
    }
    /// `clampDate`.
    public static func clamp(_ d: AWCDay, min: String, max: String) -> AWCDay {
        if !min.isEmpty && min > d.iso { return AWCDay.iso(min) ?? d }
        if !max.isEmpty && d.iso > max { return AWCDay.iso(max) ?? d }
        return d
    }
    /// `parseFlexibleDateInput`: ISO, compact digits (7 / 8), or three separated fields in year-first / locale order.
    public static func parse(_ value: String, locale: AWCDateLocale, separator: String = "") -> AWCDay? {
        let t = value.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return nil }
        if let d = AWCDay.iso(t) { return d }
        if t.allSatisfy({ $0.isASCII && $0.isNumber }) { return compact(t, dayFirst: locale.dayFirst) }
        let parts: [String]
        if !separator.isEmpty { parts = t.components(separatedBy: separator).filter { !$0.isEmpty } }
        else { parts = t.split(whereSeparator: { "/-.".contains($0) || $0.isWhitespace }).map(String.init) }
        guard parts.count == 3 else { return nil }
        // Number.parseInt: leading ASCII digits (a field like "12abc" reads 12; none → NaN).
        let nums = parts.map { p -> Int? in let digits = p.drop(while: { $0.isWhitespace }).drop(while: { $0 == "+" }).prefix(while: { $0.isASCII && $0.isNumber }); return digits.isEmpty ? nil : Int(digits) }
        guard nums.allSatisfy({ $0 != nil }) else { return nil }
        let n = nums.map { $0! }
        if parts[0].count == 4 || n[0] > 31 { return AWCDay.valid(n[0], n[1], n[2]) }
        guard parts[2].count == 4 || n[2] > 31 else { return nil }
        if n[0] > 12 && n[1] <= 12 { return AWCDay.valid(n[2], n[1], n[0]) }
        if n[1] > 12 && n[0] <= 12 { return AWCDay.valid(n[2], n[0], n[1]) }
        return locale.dayFirst ? AWCDay.valid(n[2], n[1], n[0]) : AWCDay.valid(n[2], n[0], n[1])
    }
    /// `parseCompactDateInput`: 8 digits (two two-digit fields + year) or 7 (MDD / DDM / MMD + year).
    static func compact(_ s: String, dayFirst: Bool) -> AWCDay? {
        let d = s.map { Int(String($0)) ?? 0 }
        func num(_ a: Int, _ b: Int) -> Int { d[a..<b].reduce(0) { $0 * 10 + $1 } }
        if d.count == 8 {
            let a = num(0, 2), b = num(2, 4), year = num(4, 8)
            if a > 12 && b <= 12 { return AWCDay.valid(year, b, a) }
            if b > 12 && a <= 12 { return AWCDay.valid(year, a, b) }
            if a > 12 && b > 12 { return nil }
            return dayFirst ? AWCDay.valid(year, b, a) : AWCDay.valid(year, a, b)
        }
        guard d.count == 7 else { return nil }
        let year = num(3, 7)
        let candidates: [(pattern: String, day: AWCDay?)] = [("MDD", AWCDay.valid(year, num(0, 1), num(1, 3))), ("DDM", AWCDay.valid(year, num(2, 3), num(0, 2))),
                                                              ("MMD", AWCDay.valid(year, num(0, 2), num(2, 3)))]
        let ok = candidates.filter { $0.day != nil }
        if ok.isEmpty { return nil }
        if ok.count == 1 { return ok[0].day }
        if (1...9).contains(num(0, 1)) && num(1, 3) >= 10, let c = ok.first(where: { $0.pattern == "MDD" }) { return c.day }
        if num(0, 2) > 12, let c = ok.first(where: { $0.pattern == "DDM" }) { return c.day }
        if num(0, 2) > 12, let c = ok.first(where: { $0.pattern == "MMD" }) { return c.day }
        let preferred = dayFirst ? "DDM" : "MMD"
        return (ok.first { $0.pattern == preferred } ?? ok[0]).day
    }
}

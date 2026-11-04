import SwiftUI

func awcModalColor(_ value: String?) -> String? {
    guard let value, value.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil else { return nil }
    return value.uppercased()
}

/// The ten public md-dialog hooks (`--md-dialog-*`). The z-index hooks become the modal scope's paint keys.
public struct AWCDialogAppearance: Equatable, Sendable {
    public let containerColor: String?, containerShape: AWCCornerShape?, headlineColor: String?, contentColor: String?
    public let iconColor: String?, iconSize: Double?, scrimColor: String?, dividerColor: String?
    public let zIndex: Double?, scrimZIndex: Double?
    public init(containerColor: String? = nil, containerShape: AWCCornerShape? = nil, headlineColor: String? = nil, contentColor: String? = nil,
                iconColor: String? = nil, iconSize: Double? = nil, scrimColor: String? = nil, dividerColor: String? = nil,
                zIndex: Double? = nil, scrimZIndex: Double? = nil) {
        self.containerColor = awcModalColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.headlineColor = awcModalColor(headlineColor); self.contentColor = awcModalColor(contentColor)
        self.iconColor = awcModalColor(iconColor); self.iconSize = iconSize.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.scrimColor = awcModalColor(scrimColor); self.dividerColor = awcModalColor(dividerColor)
        self.zIndex = zIndex.flatMap { $0.isFinite ? $0.rounded() : nil }; self.scrimZIndex = scrimZIndex.flatMap { $0.isFinite ? $0.rounded() : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), headlineColor: text("headlineColor"),
                  contentColor: text("contentColor"), iconColor: text("iconColor"), iconSize: values["iconSize"]?.number,
                  scrimColor: text("scrimColor"), dividerColor: text("dividerColor"), zIndex: values["zIndex"]?.number, scrimZIndex: values["scrimZIndex"]?.number)
    }
    public func merging(_ local: Self) -> Self {
        .init(containerColor: local.containerColor ?? containerColor, containerShape: local.containerShape ?? containerShape,
              headlineColor: local.headlineColor ?? headlineColor, contentColor: local.contentColor ?? contentColor,
              iconColor: local.iconColor ?? iconColor, iconSize: local.iconSize ?? iconSize, scrimColor: local.scrimColor ?? scrimColor,
              dividerColor: local.dividerColor ?? dividerColor, zIndex: local.zIndex ?? zIndex, scrimZIndex: local.scrimZIndex ?? scrimZIndex)
    }
}

/// The eleven md-dialog parts (`::part(...)`).
public enum AWCDialogPart: String, CaseIterable, Sendable {
    case scrim, container, header, icon, headline, content, divider, actions
    case cancelButton = "cancel-button", okButton = "ok-button", closeButton = "close-button"
}
/// Author styling of one modal part: the `::part()` declarations that have native meaning.
public struct AWCModalPartAppearance: Equatable, Sendable {
    public let background: String?, color: String?, outlineColor: String?, outlineWidth: Double?
    public let letterSpacing: Double?, underline: Bool?, height: Double?, opacity: Double?
    public init(background: String? = nil, color: String? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil,
                letterSpacing: Double? = nil, underline: Bool? = nil, height: Double? = nil, opacity: Double? = nil) {
        self.opacity = opacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.background = awcModalColor(background); self.color = awcModalColor(color); self.outlineColor = awcModalColor(outlineColor)
        self.outlineWidth = outlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.letterSpacing = letterSpacing.flatMap { $0.isFinite ? $0 : nil }; self.underline = underline
        self.height = height.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        self.init(background: text("background"), color: text("color"), outlineColor: text("outlineColor"), outlineWidth: values["outlineWidth"]?.number,
                  letterSpacing: values["letterSpacing"]?.number, underline: values["underline"]?.bool, height: values["height"]?.number, opacity: values["opacity"]?.number)
    }
    public func merging(_ local: Self) -> Self {
        .init(background: local.background ?? background, color: local.color ?? color, outlineColor: local.outlineColor ?? outlineColor,
              outlineWidth: local.outlineWidth ?? outlineWidth, letterSpacing: local.letterSpacing ?? letterSpacing,
              underline: local.underline ?? underline, height: local.height ?? height, opacity: local.opacity ?? opacity)
    }
}

private struct AWCDialogAppearanceKey: EnvironmentKey { static let defaultValue = AWCDialogAppearance() }
private struct AWCDialogAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCDialogAppearance] = [:] }
private struct AWCDialogPartsKey: EnvironmentKey { static let defaultValue: [String: AWCModalPartAppearance] = [:] }
extension EnvironmentValues {
    var awcDialogAppearance: AWCDialogAppearance { get { self[AWCDialogAppearanceKey.self] } set { self[AWCDialogAppearanceKey.self] = newValue } }
    var awcDialogAppearanceTargets: [String: AWCDialogAppearance] { get { self[AWCDialogAppearanceTargetsKey.self] } set { self[AWCDialogAppearanceTargetsKey.self] = newValue } }
    /// Keys: "part" (all dialogs) or "id|part" (one dialog).
    var awcDialogParts: [String: AWCModalPartAppearance] { get { self[AWCDialogPartsKey.self] } set { self[AWCDialogPartsKey.self] = newValue } }
}
private struct AWCDialogAppearanceModifier: ViewModifier {
    let value: AWCDialogAppearance, id: String?
    @Environment(\.awcDialogAppearance) private var inherited
    @Environment(\.awcDialogAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcDialogAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcDialogAppearance, inherited.merging(value)))
    }
}
private struct AWCDialogPartModifier: ViewModifier {
    let value: AWCModalPartAppearance, key: String
    @Environment(\.awcDialogParts) private var parts
    func body(content: Content) -> some View { var p = parts; p[key] = (p[key] ?? .init()).merging(value); return content.environment(\.awcDialogParts, p) }
}
public extension View {
    /// Apply md-dialog hooks to every dialog below, or only to `id`.
    func awcDialogAppearance(_ value: AWCDialogAppearance, for id: String? = nil) -> some View { modifier(AWCDialogAppearanceModifier(value: value, id: id)) }
    /// Style one md-dialog part (`::part(name)`), for every dialog below or only `id`.
    func awcDialogPartAppearance(_ value: AWCModalPartAppearance, part: AWCDialogPart, for id: String? = nil) -> some View {
        modifier(AWCDialogPartModifier(value: value, key: id.map { $0 + "|" + part.rawValue } ?? part.rawValue))
    }
}

/// Built-in dialog labels (source `dialog-utils.ts`): 14 languages, English fallback; explicit labels win.
enum AWCDialogLabels {
    static let english = ["close": "Close", "cancel": "Cancel", "ok": "OK"]
    static let table: [String: [String: String]] = [
        "ar": ["close": "إغلاق", "cancel": "إلغاء", "ok": "موافق"], "de": ["close": "Schließen", "cancel": "Abbrechen", "ok": "OK"],
        "es": ["close": "Cerrar", "cancel": "Cancelar", "ok": "Aceptar"], "fr": ["close": "Fermer", "cancel": "Annuler", "ok": "OK"],
        "hi": ["close": "बंद करें", "cancel": "रद्द करें", "ok": "ठीक"], "it": ["close": "Chiudi", "cancel": "Annulla", "ok": "OK"],
        "ja": ["close": "閉じる", "cancel": "キャンセル", "ok": "OK"], "ko": ["close": "닫기", "cancel": "취소", "ok": "확인"],
        "nl": ["close": "Sluiten", "cancel": "Annuleren", "ok": "OK"], "pl": ["close": "Zamknij", "cancel": "Anuluj", "ok": "OK"],
        "pt": ["close": "Fechar", "cancel": "Cancelar", "ok": "OK"], "ro": ["close": "Închide", "cancel": "Anulează", "ok": "OK"],
        "ru": ["close": "Закрыть", "cancel": "Отмена", "ok": "ОК"], "zh": ["close": "关闭", "cancel": "取消", "ok": "确定"],
    ]
    static func language(_ locale: String) -> String {
        let tag = locale.trimmingCharacters(in: .whitespaces)
        if tag.isEmpty { return "en" }
        return String(tag.split(whereSeparator: { $0 == "-" || $0 == "_" }).first ?? "").lowercased()
    }
    static func resolve(_ locale: String, _ key: String) -> String { table[language(locale.isEmpty ? "en-US" : locale)]?[key] ?? english[key] ?? key }
}

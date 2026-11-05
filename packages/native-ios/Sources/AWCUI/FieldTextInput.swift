import SwiftUI
#if canImport(AppKit)
import AppKit
typealias AWCPlatformFont = NSFont
typealias AWCPlatformColor = NSColor
#else
import UIKit
typealias AWCPlatformFont = UIFont
typealias AWCPlatformColor = UIColor
#endif

/// What the native text input draws: the displayed text and the input's CSS typography.
struct AWCFieldInputConfig: Equatable {
    var text = ""
    var secure = false
    var multiline = false, autoGrow = false
    var fontSize = 16.0, lineHeight = 24.0, tracking = 0.5, weight = 400.0
    var color = "#1C1B1F", caret = "#6750A4", placeholder = "", placeholderColor = "#49454F"
    var rtl = false, editable = true, enabled = true, centered = false
    var type = "text", inputMode = "", autocapitalize = "", autocomplete = "", enterKeyHint = "", spellcheck = true
    var accessibilityLabel = "", accessibilityHint = "", accessibilityValue: String? = nil, role = "textbox"
    var invalid = false, required = false, expanded: Bool? = nil
    /// System monospaced face (CSS `ui-monospace`), e.g. md-color-picker's hex field.
    var monospaced = false
    /// Report ArrowUp/ArrowDown/Home/End (with Shift/Alt) through `command` before the text system moves the caret.
    var navigationKeys = false
    /// Report Backspace / Delete / ArrowLeft / ArrowRight / Home / End through `command` before the text system edits or
    /// moves (md-otp-field's cells handle them as a group).
    var editingKeys = false
    /// macOS: the accessibility frame grown by this much on each side (md-otp-field reports the bordered cell, as Chrome does).
    var axOutset = CGSize.zero
    /// A read-only input reports Space and printable characters through `command` (the character itself), as Chrome still
    /// dispatches keydown in a readonly input (md-select / md-multi-select open on Space).
    var readOnlyKeys = false
}

/// ArrowUp/ArrowDown/Home/End of the current hardware key event, with Shift/Alt, in Web key terms (nil: other keys,
/// or Control/Command shortcuts, which keep their text-system meaning).
func awcFieldNavigationKey(code: UInt16, shift: Bool, alt: Bool, control: Bool, command: Bool) -> String? {
    guard !control, !command, let k = [126: "ArrowUp", 125: "ArrowDown", 115: "Home", 119: "End"][Int(code)] else { return nil }
    return (shift ? "Shift+" : "") + (alt ? "Alt+" : "") + k
}

/// Backspace / Delete / ArrowLeft / ArrowRight / Home / End of a key event or text-system command, in Web key terms.
func awcFieldEditingKey(code: UInt16, control: Bool, command: Bool) -> String? {
    guard !control else { return nil }
    return [51: "Backspace", 117: "Delete", 123: "ArrowLeft", 124: "ArrowRight", 115: "Home", 119: "End"][Int(code)]
}

/// Native editing events, in Web terms.
struct AWCFieldInputEvents {
    /// The user changed the text (`input`), with the caret (UTF-16 offset) and whether marked (IME) text is active.
    /// Returns the shaped text and caret to write back, or nil to keep what the user typed.
    var edited: (_ text: String, _ caret: Int, _ composing: Bool) -> (String, Int)? = { _, _, _ in nil }
    var focusChanged: (Bool) -> Void = { _ in }
    /// UIKit is about to move focus (before its input-system set-up / tear-down blocks the main thread).
    var focusMark: () -> Void = {}
    /// Return / Escape / Tab: return true when handled (default action suppressed).
    var command: (_ key: String, _ composing: Bool) -> Bool = { _, _ in false }
    var selectionChanged: (Int, Int) -> Void = { _, _ in }
    var contentHeight: (Double) -> Void = { _ in }
    /// A paste into the input (the clipboard text): return true when handled (the text system inserts nothing).
    var paste: ((String) -> Bool)? = nil
    /// Enter / Space on a read-only field, before the text system (a picker trigger opens on its keydown); true = handled.
    var activate: ((String) -> Bool)? = nil
}

private struct AWCFieldActivationKey: EnvironmentKey { static var defaultValue: ((String) -> Bool)? { nil } }
extension EnvironmentValues {
    /// Enter / Space on a read-only md-text-field below this view report here first (md-time-picker's trigger).
    var awcFieldActivation: ((String) -> Bool)? { get { self[AWCFieldActivationKey.self] } set { self[AWCFieldActivationKey.self] = newValue } }
}
/// Focus of an md-text-field rendered by another component (md-time-picker's trigger): the field binds it when it renders.
@MainActor final class AWCFieldFocusTarget {
    var focus: () -> Bool = { false }
    var isFocused: () -> Bool = { false }
    init() {}
}
private struct AWCFieldFocusTargetKey: EnvironmentKey { static var defaultValue: AWCFieldFocusTarget? { nil } }
extension EnvironmentValues {
    var awcFieldFocusTarget: AWCFieldFocusTarget? { get { self[AWCFieldFocusTargetKey.self] } set { self[AWCFieldFocusTargetKey.self] = newValue } }
}


/// Imperative access the methods need (`setFocus`, `select`, selection, composition state).
@MainActor final class AWCFieldInputHandle {
    var focus: () -> Bool = { false }
    var blur: () -> Void = {}
    var selectAll: () -> Void = {}
    var setSelection: (Int, Int) -> Void = { _, _ in }
    var selection: () -> (Int, Int) = { (0, 0) }
    var isFocused: () -> Bool = { false }
    var isComposing: () -> Bool = { false }
    var caretRect: () -> CGRect? = { nil }
}

/// Roboto metrics (hhea 1900/-500 per 2048) place the CSS line box: half-leading above the ascent.
enum AWCFieldMetrics {
    static let ascent = 1900.0 / 2048.0, descent = 500.0 / 2048.0
    static func halfLeading(font: Double, line: Double) -> Double { (line - (ascent + descent) * font) / 2 }
    static func monospacedFont(_ size: Double) -> AWCPlatformFont {
        #if canImport(AppKit)
        return .monospacedSystemFont(ofSize: size, weight: .regular)
        #else
        return .monospacedSystemFont(ofSize: size, weight: .regular)
        #endif
    }
    static func platformFont(_ size: Double, weight: Double = 400) -> AWCPlatformFont {
        _ = AWCNativeFonts.labelFamily(regular: true)
        let name = weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular"
        #if canImport(AppKit)
        return NSFont(name: name, size: size) ?? .systemFont(ofSize: size)
        #else
        return UIFont(name: name, size: size) ?? .systemFont(ofSize: size)
        #endif
    }
    static func attributes(_ c: AWCFieldInputConfig, color: String? = nil) -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.minimumLineHeight = c.lineHeight; paragraph.maximumLineHeight = c.lineHeight
        paragraph.alignment = c.centered ? .center : (c.rtl ? .right : .left)
        paragraph.baseWritingDirection = c.rtl ? .rightToLeft : .leftToRight
        paragraph.lineBreakMode = c.multiline ? .byWordWrapping : .byClipping
        let font = c.monospaced ? monospacedFont(c.fontSize) : platformFont(c.fontSize, weight: c.weight)
        // TextKit bottom-aligns glyphs in a taller fixed line; CSS centres them (half-leading above and below).
        let natural = (ascent + descent) * c.fontSize
        return [.font: font, .kern: c.tracking, .paragraphStyle: paragraph,
                .foregroundColor: AWCPlatformColor(Color(awcHex: color ?? c.color)),
                .baselineOffset: max(0, (c.lineHeight - natural) / 2)]
    }
    /// UIKit single-line input: UITextField centres its one line by the font's own metrics in the text rect, which is the CSS
    /// placement (half-leading above and below); a fixed line height would bottom-align the glyphs and UITextField does not
    /// apply the baseline offset (the text sat ~3 px low against Chrome).
    static func lineAttributes(_ c: AWCFieldInputConfig, color: String? = nil) -> [NSAttributedString.Key: Any] {
        var a = attributes(c, color: color)
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = c.centered ? .center : (c.rtl ? .right : .left)
        paragraph.baseWritingDirection = c.rtl ? .rightToLeft : .leftToRight
        paragraph.lineBreakMode = .byClipping
        a[.paragraphStyle] = paragraph; a.removeValue(forKey: .baselineOffset)
        return a
    }
}

#if canImport(AppKit)
/// A cell whose text box is exactly the CSS input line box (no bezel inset, no line-fragment padding).
/// The field editor of an input with a paste handler: the handler sees the clipboard text before the insertion.
final class AWCFieldPasteEditor: NSTextView {
    var onPaste: ((String) -> Bool)?
    /// Typing into a read-only input (`readOnlyKeys`): the text the key would insert; true when handled.
    var onReadOnlyText: ((String) -> Bool)?
    override func insertText(_ string: Any, replacementRange: NSRange) {
        if !isEditable, let text = (string as? String) ?? (string as? NSAttributedString)?.string, onReadOnlyText?(text) == true { return }
        super.insertText(string, replacementRange: replacementRange)
    }
    override func paste(_ sender: Any?) {
        if let text = NSPasteboard.general.string(forType: .string), onPaste?(text) == true { return }
        super.paste(sender)
    }
}
/// Draws a single-line input's text as the field editor lays it out (TextKit: no line-fragment padding, the line box's origin at
/// the frame): NSCell's own string drawing places a fixed-height line's glyphs higher (fi, 2026-10-30: ~6 px at 16 px).
func awcFieldDrawLine(_ text: NSAttributedString, in rect: NSRect, flipped: Bool) {
    guard text.length > 0, rect.width > 0, rect.height > 0, let current = NSGraphicsContext.current else { return }
    let storage = NSTextStorage(attributedString: text), layout = NSLayoutManager()
    let container = NSTextContainer(size: NSSize(width: rect.width, height: CGFloat.greatestFiniteMagnitude))
    container.lineFragmentPadding = 0; container.maximumNumberOfLines = 1
    layout.addTextContainer(container); storage.addLayoutManager(layout)
    let cg = current.cgContext
    cg.saveGState(); cg.clip(to: rect)
    // TextKit draws top-down: a non-flipped host gets a context flipped within the line box.
    if !flipped { cg.translateBy(x: 0, y: rect.maxY + rect.minY); cg.scaleBy(x: 1, y: -1) }
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
    layout.drawGlyphs(forGlyphRange: layout.glyphRange(for: container), at: rect.origin)
    NSGraphicsContext.restoreGraphicsState(); cg.restoreGState()
}
/// The text a single-line cell draws itself: the value when not being edited (the field editor draws it then), the placeholder
/// when empty; nil leaves the drawing to NSCell (a cell outside an NSTextField).
func awcFieldCellText(_ cell: NSTextFieldCell, _ controlView: NSView, value: () -> NSAttributedString) -> NSAttributedString? {
    guard let field = controlView as? NSTextField else { return nil }
    let editor = field.currentEditor() as? NSTextView
    let empty = editor.map { $0.string.isEmpty } ?? cell.stringValue.isEmpty
    if empty { return cell.placeholderAttributedString ?? NSAttributedString() }
    return editor == nil ? value() : NSAttributedString()
}
final class AWCFieldTextCell: NSTextFieldCell {
    override func drawInterior(withFrame cellFrame: NSRect, in controlView: NSView) {
        guard let text = awcFieldCellText(self, controlView, value: { attributedStringValue }) else { return super.drawInterior(withFrame: cellFrame, in: controlView) }
        awcFieldDrawLine(text, in: titleRect(forBounds: cellFrame), flipped: controlView.isFlipped)
    }
    var lineHeight = 24.0, fontSize = 16.0
    var awcInvalid = false
    var awcAXOutset = CGSize.zero
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        if attribute.rawValue == "AXInvalid" { return awcInvalid ? "true" : "false" }
        if let v = awcFieldAXFrame(attribute, awcAXOutset, { super.accessibilityAttributeValue($0) }) { return v }
        return super.accessibilityAttributeValue(attribute)
    }
    var onPaste: ((String) -> Bool)?
    var onReadOnlyText: ((String) -> Bool)?
    private var pasteEditor: AWCFieldPasteEditor?
    /// A read-only field with an activation handler edits in its own field editor, which sees Enter / Space first.
    var activationEditor: AWCFieldActivationEditor?
    override func fieldEditor(for controlView: NSView) -> NSTextView? {
        if let activationEditor { return activationEditor }
        guard onPaste != nil || onReadOnlyText != nil else { return super.fieldEditor(for: controlView) }
        let editor = pasteEditor ?? { let e = AWCFieldPasteEditor(); e.isFieldEditor = true; return e }()
        editor.onPaste = onPaste; editor.onReadOnlyText = onReadOnlyText; pasteEditor = editor; return editor
    }
    override func drawingRect(forBounds rect: NSRect) -> NSRect { rect }
    override func titleRect(forBounds rect: NSRect) -> NSRect { rect }
    override func edit(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, event: NSEvent?) {
        configure(textObj); super.edit(withFrame: rect, in: controlView, editor: textObj, delegate: delegate, event: event)
    }
    override func select(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        configure(textObj); super.select(withFrame: rect, in: controlView, editor: textObj, delegate: delegate, start: selStart, length: selLength)
    }
    private func configure(_ editor: NSText) {
        guard let tv = editor as? NSTextView else { return }
        tv.textContainer?.lineFragmentPadding = 0; tv.textContainerInset = .zero
    }
}
final class AWCFieldSecureTextCell: NSSecureTextFieldCell {
    /// Masked text as Chrome draws it: one bullet per character in the input's own font and line box.
    override func drawInterior(withFrame cellFrame: NSRect, in controlView: NSView) {
        let value = { () -> NSAttributedString in
            let attrs = self.attributedStringValue.length > 0 ? self.attributedStringValue.attributes(at: 0, effectiveRange: nil) : [:]
            return NSAttributedString(string: String(repeating: "\u{2022}", count: self.stringValue.count), attributes: attrs)
        }
        guard let text = awcFieldCellText(self, controlView, value: value) else { return super.drawInterior(withFrame: cellFrame, in: controlView) }
        awcFieldDrawLine(text, in: titleRect(forBounds: cellFrame), flipped: controlView.isFlipped)
    }
    var awcInvalid = false
    var awcAXOutset = CGSize.zero
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        if attribute.rawValue == "AXInvalid" { return awcInvalid ? "true" : "false" }
        // Chrome (and UIKit) expose a masked input's value as one bullet per character, never the characters; AppKit exposes none.
        if attribute == .value { return String(repeating: "\u{2022}", count: (stringValue).count) }
        if let v = awcFieldAXFrame(attribute, awcAXOutset, { super.accessibilityAttributeValue($0) }) { return v }
        return super.accessibilityAttributeValue(attribute)
    }
    override func drawingRect(forBounds rect: NSRect) -> NSRect { rect }
    override func titleRect(forBounds rect: NSRect) -> NSRect { rect }
    override func edit(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, event: NSEvent?) {
        (textObj as? NSTextView)?.textContainer?.lineFragmentPadding = 0; (textObj as? NSTextView)?.textContainerInset = .zero
        super.edit(withFrame: rect, in: controlView, editor: textObj, delegate: delegate, event: event)
    }
    override func select(withFrame rect: NSRect, in controlView: NSView, editor textObj: NSText, delegate: Any?, start selStart: Int, length selLength: Int) {
        (textObj as? NSTextView)?.textContainer?.lineFragmentPadding = 0; (textObj as? NSTextView)?.textContainerInset = .zero
        super.select(withFrame: rect, in: controlView, editor: textObj, delegate: delegate, start: selStart, length: selLength)
    }
}

/// The field editor of a read-only field that reports Enter / Space (Web: keydown on the input, before any default action).
final class AWCFieldActivationEditor: NSTextView {
    var onActivate: (String) -> Bool = { _ in false }
    override func keyDown(with event: NSEvent) {
        let modifiers = event.modifierFlags.intersection([.command, .option, .control])
        if modifiers.isEmpty, let key = [36: "Enter", 76: "Enter", 49: "Space"][event.keyCode], onActivate(key) { return }
        super.keyDown(with: event)
    }
    /// A press on the read-only field (or on this editor once it is focused): focus, then a release inside the field is its
    /// click (Web: `click` on the input opens a picker trigger). The release is taken from the queue as AppKit's own tracking does.
    func click(in field: NSView) {
        guard let window = field.window else { return }
        if window.firstResponder !== self { _ = window.makeFirstResponder(field) }
        guard let up = window.nextEvent(matching: [.leftMouseUp], until: .distantFuture, inMode: .eventTracking, dequeue: true) else { return }
        if field.bounds.contains(field.convert(up.locationInWindow, from: nil)) { _ = onActivate("Click") }
    }
    override func mouseDown(with event: NSEvent) { if let field = delegate as? NSView { click(in: field) } else { super.mouseDown(with: event) } }
}
/// The single-line input: NSTextField (or NSSecureTextField for a masked password) with the field editor.
/// Accessibility state AppKit has no typed accessor for (WebKit/Chrome expose the same attribute names), and the role the
/// input keeps whatever its editable / enabled state (a read-only or disabled input is still a text field, as on the Web).
protocol AWCFieldAXState: AnyObject { var awcInvalid: Bool { get set }; var awcRole: NSAccessibility.Role { get set }; var awcAXOutset: CGSize { get set } }
/// AXPosition / AXSize grown by `outset` on every side (md-otp-field: the cell box, which is Chrome's input box), or nil.
func awcFieldAXFrame(_ attribute: NSAccessibility.Attribute, _ outset: CGSize, _ base: (NSAccessibility.Attribute) -> Any?) -> Any? {
    guard outset != .zero else { return nil }
    if attribute == .position, let p = (base(.position) as? NSValue)?.pointValue { return NSValue(point: NSPoint(x: p.x - outset.width, y: p.y - outset.height)) }
    if attribute == .size, let z = (base(.size) as? NSValue)?.sizeValue { return NSValue(size: NSSize(width: z.width + 2 * outset.width, height: z.height + 2 * outset.height)) }
    return nil
}
final class AWCFieldNSTextField: NSTextField, AWCFieldAXState {
    var onFirstResponder: () -> Void = {}
    /// A read-only field with an activation handler (a picker trigger) opens on its click instead of starting a text selection.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { (cell as? AWCFieldTextCell)?.activationEditor != nil || super.acceptsFirstMouse(for: event) }
    override func mouseDown(with event: NSEvent) {
        if let editor = (cell as? AWCFieldTextCell)?.activationEditor { editor.click(in: self) } else { super.mouseDown(with: event) }
    }
    var awcInvalid = false, awcRole: NSAccessibility.Role = .textField
    override var acceptsFirstResponder: Bool { isEnabled }
    override func becomeFirstResponder() -> Bool { let ok = super.becomeFirstResponder(); if ok { onFirstResponder() }; return ok }
    override func accessibilityRole() -> NSAccessibility.Role? { awcRole }
    var awcAXOutset = CGSize.zero
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        if attribute.rawValue == "AXInvalid" { return awcInvalid ? "true" : "false" }
        if let v = awcFieldAXFrame(attribute, awcAXOutset, { super.accessibilityAttributeValue($0) }) { return v }
        return super.accessibilityAttributeValue(attribute)
    }
}
final class AWCFieldNSSecureTextField: NSSecureTextField, AWCFieldAXState {
    var onFirstResponder: () -> Void = {}
    var awcInvalid = false, awcRole: NSAccessibility.Role = .textField
    override func becomeFirstResponder() -> Bool { let ok = super.becomeFirstResponder(); if ok { onFirstResponder() }; return ok }
    var awcAXOutset = CGSize.zero
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        if attribute.rawValue == "AXInvalid" { return awcInvalid ? "true" : "false" }
        // Chrome (and UIKit) expose a masked input's value as one bullet per character, never the characters; AppKit exposes none.
        if attribute == .value { return String(repeating: "\u{2022}", count: (currentEditor()?.string ?? stringValue).count) }
        if let v = awcFieldAXFrame(attribute, awcAXOutset, { super.accessibilityAttributeValue($0) }) { return v }
        return super.accessibilityAttributeValue(attribute)
    }
}

/// The multiline input (textarea): an NSTextView, scrolling only for `multiline="fixed"`.
final class AWCFieldNSTextView: NSTextView {
    /// The TextKit 1 stack's root (the text storage owns the layout manager and container; nothing else retains it).
    var ownedStorage: NSTextStorage?
    var awcInvalid = false
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        attribute.rawValue == "AXInvalid" ? (awcInvalid ? "true" : "false") : super.accessibilityAttributeValue(attribute)
    }
    var onFocus: (Bool) -> Void = { _ in }
    var onCommand: (String) -> Bool = { _ in false }
    override func becomeFirstResponder() -> Bool { let ok = super.becomeFirstResponder(); if ok { onFocus(true) }; return ok }
    override func resignFirstResponder() -> Bool { let ok = super.resignFirstResponder(); if ok { onFocus(false) }; return ok }
    override func doCommand(by selector: Selector) {
        let key = selector == #selector(cancelOperation(_:)) ? "Escape" : selector == #selector(insertTab(_:)) ? "Tab" : selector == #selector(insertBacktab(_:)) ? "Shift+Tab" : ""
        if key == "Tab" || key == "Shift+Tab" { if !onCommand(key) { key == "Tab" ? window?.selectNextKeyView(self) : window?.selectPreviousKeyView(self) }; return }
        if !key.isEmpty, onCommand(key) { return }
        super.doCommand(by: selector)
    }
}

struct AWCFieldTextInput: NSViewRepresentable {
    let config: AWCFieldInputConfig
    let events: AWCFieldInputEvents
    let handle: AWCFieldInputHandle

    final class Coordinator: NSObject, NSTextFieldDelegate, NSTextViewDelegate {
        var parent: AWCFieldTextInput
        var applying = false
        var focused = false
        var observation: NSKeyValueObservation?
        /// The keystroke the navigation keys last handled, and whether they took it.
        var navigationEvent: (NSEvent, Bool)?
        weak var field: NSTextField?
        weak var textView: AWCFieldNSTextView?
        init(_ p: AWCFieldTextInput) { parent = p }
        var editor: NSTextView? { textView ?? (field?.currentEditor() as? NSTextView) }
        func setFocused(_ value: Bool) { guard value != focused else { return }; focused = value; parent.events.focusChanged(value) }
        func watch(_ window: NSWindow?) {
            observation = window?.observe(\.firstResponder, options: [.new]) { [weak self] w, _ in
                DispatchQueue.main.async { self?.refreshFocus(w) }
            }
        }
        func refreshFocus(_ w: NSWindow?) {
            guard let w else { setFocused(false); return }
            let r = w.firstResponder
            if let tv = textView { setFocused(r === tv); return }
            if let f = field { setFocused(r === f || ((r as? NSTextView)?.delegate as AnyObject?) === f) }
        }
        func restyle() {
            guard let tv = editor else { return }
            let attrs = AWCFieldMetrics.attributes(parent.config)
            tv.typingAttributes = attrs
            if let storage = tv.textStorage, storage.length > 0, !tv.hasMarkedText() {
                storage.beginEditing(); storage.setAttributes(attrs, range: NSRange(location: 0, length: storage.length)); storage.endEditing()
            }
            tv.insertionPointColor = AWCPlatformColor(Color(awcHex: parent.config.caret))
            tv.textContainer?.lineFragmentPadding = 0; tv.textContainerInset = .zero
            // A Web input performs no automatic capitalisation, substitution, correction or completion.
            tv.isAutomaticSpellingCorrectionEnabled = false; tv.isAutomaticTextReplacementEnabled = false; tv.isAutomaticQuoteSubstitutionEnabled = false
            tv.isAutomaticDashSubstitutionEnabled = false; tv.isAutomaticTextCompletionEnabled = false; tv.smartInsertDeleteEnabled = false
            tv.isAutomaticLinkDetectionEnabled = false; tv.isAutomaticDataDetectionEnabled = false; tv.isContinuousSpellCheckingEnabled = parent.config.spellcheck
        }
        func edited() {
            guard !applying else { return }
            guard let tv = editor else {
                // A change without a field editor (a value written to the control, an assistive technology's AXValue): the
                // control's own text is the edit, the caret at its end.
                if let f = field {
                    let text = f.stringValue
                    if let (shaped, _) = parent.events.edited(text, (text as NSString).length, false), shaped != text {
                        applying = true; f.attributedStringValue = NSAttributedString(string: shaped, attributes: AWCFieldMetrics.attributes(parent.config)); applying = false
                    }
                }
                return
            }
            let composing = tv.hasMarkedText()
            let text = tv.string, caret = tv.selectedRange().location
            if let (shaped, pos) = parent.events.edited(text, caret, composing), shaped != text {
                applying = true
                tv.string = shaped; restyle()
                let p = min(pos, (shaped as NSString).length); tv.setSelectedRange(NSRange(location: p, length: 0))
                applying = false
            } else if !composing { restyle() }
            if let tv = textView { parent.events.contentHeight(Double(tv.layoutManager?.usedRect(for: tv.textContainer!).height ?? 0)) }
        }
        func controlTextDidChange(_ obj: Notification) { edited() }
        func controlTextDidBeginEditing(_ obj: Notification) { restyle() }
        func textDidChange(_ notification: Notification) { edited() }
        func textViewDidChangeSelection(_ notification: Notification) {
            guard let tv = editor else { return }
            let r = tv.selectedRange(); parent.events.selectionChanged(r.location, r.location + r.length)
        }
        /// Text-system commands of the Backspace / Delete / ←→ / Home / End keys (any modifier but Control), in Web key terms.
        static let editingSelectors: [Selector: String] = [
            #selector(NSResponder.deleteBackward(_:)): "Backspace", #selector(NSResponder.deleteBackwardByDecomposingPreviousCharacter(_:)): "Backspace",
            #selector(NSResponder.deleteWordBackward(_:)): "Backspace", #selector(NSResponder.deleteToBeginningOfLine(_:)): "Backspace",
            #selector(NSResponder.deleteForward(_:)): "Delete", #selector(NSResponder.deleteWordForward(_:)): "Delete",
            #selector(NSResponder.moveLeft(_:)): "ArrowLeft", #selector(NSResponder.moveLeftAndModifySelection(_:)): "ArrowLeft", #selector(NSResponder.moveWordLeft(_:)): "ArrowLeft",
            #selector(NSResponder.moveWordLeftAndModifySelection(_:)): "ArrowLeft", #selector(NSResponder.moveToLeftEndOfLine(_:)): "ArrowLeft",
            #selector(NSResponder.moveRight(_:)): "ArrowRight", #selector(NSResponder.moveRightAndModifySelection(_:)): "ArrowRight", #selector(NSResponder.moveWordRight(_:)): "ArrowRight",
            #selector(NSResponder.moveWordRightAndModifySelection(_:)): "ArrowRight", #selector(NSResponder.moveToRightEndOfLine(_:)): "ArrowRight",
            #selector(NSResponder.scrollToBeginningOfDocument(_:)): "Home", #selector(NSResponder.moveToBeginningOfDocument(_:)): "Home",
            #selector(NSResponder.scrollToEndOfDocument(_:)): "End", #selector(NSResponder.moveToEndOfDocument(_:)): "End"]
        func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            let composing = textView.hasMarkedText()
            if parent.config.editingKeys, let key = Self.editingSelectors[selector] { return parent.events.command(key, composing) }
            switch selector {
            case #selector(NSResponder.insertNewline(_:)): return parent.events.command("Enter", composing)
            case #selector(NSResponder.cancelOperation(_:)): return parent.events.command("Escape", composing)
            // Esc is bound to `complete:` in the text system; the Web key is Escape.
            case #selector(NSResponder.complete(_:)) where NSApp.currentEvent?.keyCode == 53: return parent.events.command("Escape", composing)
            case #selector(NSResponder.insertTab(_:)): return parent.events.command("Tab", composing)
            case #selector(NSResponder.insertBacktab(_:)): return parent.events.command("Shift+Tab", composing)
            default:
                if parent.config.navigationKeys, let e = NSApp.currentEvent, e.type == .keyDown,
                   let key = awcFieldNavigationKey(code: e.keyCode, shift: e.modifierFlags.contains(.shift), alt: e.modifierFlags.contains(.option),
                                                   control: e.modifierFlags.contains(.control), command: e.modifierFlags.contains(.command)) {
                    // One keystroke can bind several selectors (⌥↓: moveForward: then moveToEndOfParagraph:): it is one key.
                    if let (last, handled) = navigationEvent, last === e { return handled }
                    let handled = parent.events.command(key, composing)
                    navigationEvent = (e, handled)
                    return handled
                }
                return false
            }
        }
    }
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSView {
        let c = context.coordinator
        let host = AWCFieldInputHost()
        if config.multiline {
            let scroll = NSScrollView()
            scroll.drawsBackground = false; scroll.borderType = .noBorder
            scroll.hasVerticalScroller = !config.autoGrow; scroll.autohidesScrollers = true; scroll.scrollerStyle = .overlay
            // TextKit 1, as the single-line cell draws: a fixed 24 px line with the CSS half-leading offset keeps a 24 px pitch on
            // every line (TextKit 2 shortened the pitch by the baseline offset from the second line on).
            let storage = NSTextStorage(), layout = NSLayoutManager(), container = NSTextContainer(size: NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude))
            storage.addLayoutManager(layout); layout.addTextContainer(container)
            let tv = AWCFieldNSTextView(frame: .zero, textContainer: container); tv.ownedStorage = storage
            tv.drawsBackground = false; tv.isRichText = false; tv.allowsUndo = true
            tv.isVerticallyResizable = true; tv.isHorizontallyResizable = false; tv.autoresizingMask = [.width]
            tv.textContainer?.widthTracksTextView = true; tv.textContainer?.lineFragmentPadding = 0; tv.textContainerInset = .zero
            tv.delegate = c; tv.onFocus = { [weak c] v in DispatchQueue.main.async { c?.setFocused(v) } }
            tv.onCommand = { [weak c] key in c?.parent.events.command(key, false) ?? false }
            scroll.documentView = tv; c.textView = tv
            host.content = scroll
        } else {
            let field: NSTextField
            if config.secure {
                let f = AWCFieldNSSecureTextField(); f.cell = AWCFieldSecureTextCell(textCell: ""); field = f
                f.onFirstResponder = { [weak c] in DispatchQueue.main.async { c?.restyle() } }
            } else {
                let f = AWCFieldNSTextField(); f.cell = AWCFieldTextCell(textCell: ""); field = f
                f.onFirstResponder = { [weak c] in DispatchQueue.main.async { c?.restyle() } }
            }
            field.isBezeled = false; field.isBordered = false; field.drawsBackground = false; field.focusRingType = .none
            field.allowsEditingTextAttributes = true; field.importsGraphics = false
            field.cell?.isScrollable = true; field.cell?.wraps = false; field.cell?.usesSingleLineMode = true
            field.delegate = c; c.field = field
            host.content = field
        }
        host.onWindow = { [weak c] w in c?.watch(w); c?.refreshFocus(w) }
        update(host, context: context, initial: true)
        return host
    }
    func updateNSView(_ view: NSView, context: Context) { context.coordinator.parent = self; update(view as! AWCFieldInputHost, context: context, initial: false) }

    private func update(_ host: AWCFieldInputHost, context: Context, initial: Bool) {
        let c = context.coordinator, cfg = config
        let attrs = AWCFieldMetrics.attributes(cfg)
        host.setAccessibilityLabel(cfg.accessibilityLabel)
        if let tv = c.textView {
            if tv.string != cfg.text && !tv.hasMarkedText() {
                c.applying = true; let sel = tv.selectedRange(); tv.string = cfg.text
                tv.setSelectedRange(NSRange(location: min(sel.location, (cfg.text as NSString).length), length: 0)); c.applying = false
            }
            tv.isEditable = cfg.editable && cfg.enabled; tv.isSelectable = cfg.enabled
            tv.baseWritingDirection = cfg.rtl ? .rightToLeft : .leftToRight
            tv.setAccessibilityLabel(cfg.accessibilityLabel); tv.setAccessibilityHelp(cfg.accessibilityHint)
            tv.setAccessibilityRequired(cfg.required); tv.awcInvalid = cfg.invalid
            c.restyle()
            tv.textStorage.map { s in if s.length > 0 && !tv.hasMarkedText() { s.setAttributes(attrs, range: NSRange(location: 0, length: s.length)) } }
        } else if let f = c.field {
            let editing = f.currentEditor() as? NSTextView
            if editing == nil {
                f.attributedStringValue = NSAttributedString(string: cfg.text, attributes: attrs)
            } else if editing!.string != cfg.text && !editing!.hasMarkedText() {
                c.applying = true; let sel = editing!.selectedRange(); editing!.string = cfg.text; c.restyle()
                editing!.setSelectedRange(NSRange(location: min(sel.location, (cfg.text as NSString).length), length: 0)); c.applying = false
            } else { c.restyle() }
            var placeholder = attrs; placeholder[.foregroundColor] = AWCPlatformColor(Color(awcHex: cfg.placeholderColor))
            f.placeholderAttributedString = cfg.placeholder.isEmpty ? nil : NSAttributedString(string: cfg.placeholder, attributes: placeholder)
            f.isEditable = cfg.editable; f.isSelectable = true; f.isEnabled = cfg.enabled
            if let cell = f.cell as? AWCFieldTextCell {
                if events.activate != nil && !cfg.editable {
                    if cell.activationEditor == nil { let editor = AWCFieldActivationEditor(); editor.isFieldEditor = true; cell.activationEditor = editor }
                    cell.activationEditor?.onActivate = { [weak c] key in c?.parent.events.activate?(key) ?? false }
                } else if cell.activationEditor != nil && f.currentEditor() == nil { cell.activationEditor = nil }
            }
            f.alignment = cfg.centered ? .center : (cfg.rtl ? .right : .left); f.baseWritingDirection = cfg.rtl ? .rightToLeft : .leftToRight
            f.setAccessibilityLabel(cfg.accessibilityLabel); f.setAccessibilityHelp(cfg.accessibilityHint); f.setAccessibilityRequired(cfg.required)
            if let ax = f as? AWCFieldAXState { ax.awcInvalid = cfg.invalid; ax.awcRole = cfg.role == "combobox" ? .comboBox : .textField; ax.awcAXOutset = cfg.axOutset }
            (f.cell as? AWCFieldTextCell)?.awcInvalid = cfg.invalid; (f.cell as? AWCFieldSecureTextCell)?.awcInvalid = cfg.invalid
            (f.cell as? AWCFieldTextCell)?.awcAXOutset = cfg.axOutset; (f.cell as? AWCFieldSecureTextCell)?.awcAXOutset = cfg.axOutset
            if cfg.role == "combobox" { f.setAccessibilityExpanded(cfg.expanded ?? false) }
            if let cell = f.cell as? AWCFieldTextCell {
                cell.onPaste = events.paste == nil ? nil : { [weak c] text in c?.parent.events.paste?(text) ?? false }
                cell.onReadOnlyText = cfg.readOnlyKeys ? { [weak c] text in c?.parent.events.command(text, false) ?? false } : nil
            }
            f.contentType = cfg.autocomplete == "one-time-code" ? .oneTimeCode : cfg.autocomplete == "username" ? .username : cfg.autocomplete.contains("password") ? .password : nil
            if let editor = f.currentEditor() as? NSTextView { editor.isContinuousSpellCheckingEnabled = cfg.spellcheck }
        }
        // Imperative handle.
        handle.focus = { [weak host, weak c] in
            guard let host, let c, let w = host.window else { return false }
            if let tv = c.textView { return w.makeFirstResponder(tv) }
            if let f = c.field { let ok = w.makeFirstResponder(f); if ok, let e = f.currentEditor() { e.selectedRange = NSRange(location: (e.string as NSString).length, length: 0) }; return ok }
            return false
        }
        handle.blur = { [weak host, weak c] in
            guard let w = host?.window, c?.focused == true else { return }
            w.makeFirstResponder(nil)
        }
        handle.selectAll = { [weak c] in c?.editor?.selectAll(nil) }
        handle.setSelection = { [weak c] a, b in c?.editor?.setSelectedRange(NSRange(location: a, length: max(0, b - a))) }
        handle.selection = { [weak c] in let r = c?.editor?.selectedRange() ?? NSRange(location: 0, length: 0); return (r.location, r.location + r.length) }
        handle.isFocused = { [weak c] in c?.focused ?? false }
        handle.isComposing = { [weak c] in c?.editor?.hasMarkedText() ?? false }
        handle.caretRect = { [weak c, weak host] in
            guard let tv = c?.editor, let host, let lm = tv.layoutManager, let tc = tv.textContainer else { return nil }
            let r = tv.selectedRange(); let g = lm.glyphIndexForCharacter(at: min(r.location, max(0, lm.numberOfGlyphs - 1)))
            var rect = lm.boundingRect(forGlyphRange: NSRange(location: g, length: lm.numberOfGlyphs == 0 ? 0 : 1), in: tc)
            if r.location >= (tv.string as NSString).length { rect.origin.x = rect.maxX; rect.size.width = 0 }
            return tv.convert(rect, to: host)
        }
    }
}

/// Hosts the AppKit input and reports its window (focus tracking observes the window's first responder).
final class AWCFieldInputHost: NSView {
    var onWindow: (NSWindow?) -> Void = { _ in }
    var content: NSView? { didSet { oldValue?.removeFromSuperview(); if let content { addSubview(content); needsLayout = true } } }
    override var isFlipped: Bool { true }
    override func layout() { super.layout(); content?.frame = bounds; if let s = content as? NSScrollView, let tv = s.documentView as? NSTextView { tv.minSize = .init(width: 0, height: bounds.height); tv.maxSize = .init(width: bounds.width, height: .greatestFiniteMagnitude); tv.frame = NSRect(x: 0, y: 0, width: bounds.width, height: max(bounds.height, tv.frame.height)) } }
    override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); onWindow(window) }
    /// A textarea takes every press inside its box (also below the last line, where only the clip view lies).
    override func hitTest(_ point: NSPoint) -> NSView? {
        let hit = super.hitTest(point)
        if let s = content as? NSScrollView, let tv = s.documentView as? NSTextView, hit != nil, !(hit is NSScroller) { return tv }
        return hit
    }
}
#else
/// UITextField with the CSS line box as its text rect (no inset).
/// The single-line input. A Tab stop in AWCUI's key-view loop: Tab / Shift+Tab move focus as Chrome's sequential
/// navigation does (never inserting a tab), past the last stop focus leaves the content.
final class AWCFieldUITextField: UITextField, AWCKeyView {
    var onCommand: (String) -> Bool = { _ in false }
    override func textRect(forBounds bounds: CGRect) -> CGRect { bounds }
    override func editingRect(forBounds bounds: CGRect) -> CGRect { bounds }
    override func placeholderRect(forBounds bounds: CGRect) -> CGRect { bounds }
    var awcAcceptsFirstResponder: Bool { isEnabled }
    var awcCanBecomeKeyView: Bool { isEnabled && !isHidden && alpha > 0 }
    func awcBecomeKeyView() -> Bool { becomeFirstResponder() }
    /// Report arrows / Home / End to the composite (md-number-field) before the text system moves the caret.
    var navigationKeys = false
    private static let navigation: [(String, String)] = [(UIKeyCommand.inputUpArrow, "ArrowUp"), (UIKeyCommand.inputDownArrow, "ArrowDown")]
    override var keyCommands: [UIKeyCommand]? {
        var list = [UIKeyCommand(input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(escape))] + AWCKeyViewLoop.tabCommands(#selector(tabKey(_:))) + editingCommands
        if navigationKeys {
            for (input, _) in Self.navigation { for mods: UIKeyModifierFlags in [[], .shift, .alternate] {
                let c = UIKeyCommand(input: input, modifierFlags: mods, action: #selector(navigationKey(_:))); c.wantsPriorityOverSystemBehavior = true; list.append(c)
            } }
        }
        return list
    }
    @objc func navigationKey(_ command: UIKeyCommand) {
        guard let name = Self.navigation.first(where: { $0.0 == command.input })?.1 else { return }
        let key = (command.modifierFlags.contains(.shift) ? "Shift+" : "") + (command.modifierFlags.contains(.alternate) ? "Alt+" : "") + name
        if onCommand(key) { return }
        // Not handled: the single-line input's own caret move (Up/Home → start, Down/End → end).
        let p = name == "ArrowUp" || name == "Home" ? beginningOfDocument : endOfDocument
        selectedTextRange = textRange(from: p, to: p)
    }
    @objc func escape() { _ = onCommand("Escape") }
    @objc func tabKey(_ command: UIKeyCommand) {
        let back = command.modifierFlags.contains(.shift)
        if onCommand(back ? "Shift+Tab" : "Tab") { return }
        if let window { AWCKeyViewLoop.select(from: self, in: window, backward: back) }
    }
    /// md-otp-field: Backspace / Delete / ←→ / Home / End go to the group (the hardware key or the software keyboard's delete).
    var editingKeys = false
    /// Backspace ("\u{8}") is a key command too: a hardware Backspace in an empty cell reaches no deleteBackward.
    private static let editing: [(String, String)] = [("\u{8}", "Backspace"), (UIKeyCommand.inputDelete, "Delete"), (UIKeyCommand.inputLeftArrow, "ArrowLeft"), (UIKeyCommand.inputRightArrow, "ArrowRight")]
    var editingCommands: [UIKeyCommand] {
        guard editingKeys else { return [] }
        return Self.editing.flatMap { input, _ in [UIKeyModifierFlags](arrayLiteral: [], .shift).map { mods in
            let c = UIKeyCommand(input: input, modifierFlags: mods, action: #selector(editingKey(_:))); c.wantsPriorityOverSystemBehavior = true; return c } }
    }
    @objc func editingKey(_ command: UIKeyCommand) {
        guard let name = Self.editing.first(where: { $0.0 == command.input })?.1 else { return }
        if onCommand(name) { return }
        // Not taken by the composite: the key's own editing / caret move.
        guard let r = selectedTextRange else { return }
        switch name {
        case "Backspace": super.deleteBackward()
        case "Delete":
            if !r.isEmpty { replace(r, withText: "") }
            else if let e = position(from: r.start, offset: 1), let next = textRange(from: r.start, to: e) { replace(next, withText: "") }
        default:
            let forward = (name == "ArrowRight") != (effectiveUserInterfaceLayoutDirection == .rightToLeft)
            let shift = command.modifierFlags.contains(.shift)
            if !shift && !r.isEmpty { let p = forward ? r.end : r.start; selectedTextRange = textRange(from: p, to: p); return }
            guard let p = position(from: forward ? r.end : r.start, offset: forward ? 1 : -1) else { return }
            selectedTextRange = shift ? (forward ? textRange(from: r.start, to: p) : textRange(from: p, to: r.end)) : textRange(from: p, to: p)
        }
    }
    /// A read-only input reports Space / printable characters (`readOnlyKeys`).
    var readOnlyKeys = false, editable = true
    override func deleteBackward() { if editingKeys, onCommand("Backspace") { return }; super.deleteBackward() }
    /// Home / End reach the text input before key commands: they are taken here (md-number-field, md-otp-field).
    private var takenPresses: Set<UIKeyboardHIDUsage> = []
    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if let key = presses.first?.key, navigationKeys || editingKeys, [.keyboardHome, .keyboardEnd].contains(key.keyCode),
           !key.modifierFlags.contains(.command), !key.modifierFlags.contains(.control) {
            let name = key.keyCode == .keyboardHome ? "Home" : "End", mods = key.modifierFlags
            let full = navigationKeys ? (mods.contains(.shift) ? "Shift+" : "") + (mods.contains(.alternate) ? "Alt+" : "") + name : name
            takenPresses.insert(key.keyCode)
            if !onCommand(full) { let p = name == "Home" ? beginningOfDocument : endOfDocument; selectedTextRange = textRange(from: p, to: p) }
            return
        }
        if readOnlyKeys, !editable, let key = presses.first?.key, !key.modifierFlags.contains(.command), !key.modifierFlags.contains(.control),
           let ch = key.characters.unicodeScalars.first, ch.value >= 0x20, ch.value != 0x7F, !(0xF700...0xF8FF).contains(ch.value) {
            takenPresses.insert(key.keyCode); _ = onCommand(key.characters); return
        }
        super.pressesBegan(presses, with: event)
    }
    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if let code = presses.first?.key?.keyCode, takenPresses.remove(code) != nil { return }
        super.pressesEnded(presses, with: event)
    }
    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if let code = presses.first?.key?.keyCode, takenPresses.remove(code) != nil { return }
        super.pressesCancelled(presses, with: event)
    }
    var onPaste: ((String) -> Bool)?
    override func paste(_ sender: Any?) {
        if let text = UIPasteboard.general.string, onPaste?(text) == true { return }
        super.paste(sender)
    }
}
final class AWCFieldUITextView: UITextView, AWCKeyView {
    var onCommand: (String) -> Bool = { _ in false }
    var awcAcceptsFirstResponder: Bool { isEditable || isSelectable }
    var awcCanBecomeKeyView: Bool { (isEditable || isSelectable) && !isHidden && alpha > 0 }
    func awcBecomeKeyView() -> Bool { becomeFirstResponder() }
    override var keyCommands: [UIKeyCommand]? { [UIKeyCommand(input: UIKeyCommand.inputEscape, modifierFlags: [], action: #selector(escape))] + AWCKeyViewLoop.tabCommands(#selector(tabKey(_:))) }
    @objc func escape() { _ = onCommand("Escape") }
    @objc func tabKey(_ command: UIKeyCommand) {
        let back = command.modifierFlags.contains(.shift)
        if onCommand(back ? "Shift+Tab" : "Tab") { return }
        if let window { AWCKeyViewLoop.select(from: self, in: window, backward: back) }
    }
}

struct AWCFieldTextInput: UIViewRepresentable {
    let config: AWCFieldInputConfig
    let events: AWCFieldInputEvents
    let handle: AWCFieldInputHandle

    final class Coordinator: NSObject, UITextFieldDelegate, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: AWCFieldTextInput
        var applying = false
        weak var field: AWCFieldUITextField?
        weak var textView: AWCFieldUITextView?
        init(_ p: AWCFieldTextInput) { parent = p }
        var input: (UIView & UITextInput)? { textView ?? field }
        func caret() -> Int {
            guard let i = input, let r = i.selectedTextRange else { return 0 }
            return i.offset(from: i.beginningOfDocument, to: r.start)
        }
        func setCaret(_ p: Int) {
            guard let i = input, let pos = i.position(from: i.beginningOfDocument, offset: p) else { return }
            i.selectedTextRange = i.textRange(from: pos, to: pos)
        }
        func composing() -> Bool { input?.markedTextRange != nil }
        func restyle() {
            let attrs = AWCFieldMetrics.attributes(parent.config)
            if let f = field { let line = AWCFieldMetrics.lineAttributes(parent.config); f.defaultTextAttributes = line; f.typingAttributes = line }
            if let t = textView { t.typingAttributes = attrs; if !composing() { let c = caret(); t.attributedText = NSAttributedString(string: t.text, attributes: attrs); setCaret(c) } }
            input?.tintColor = AWCPlatformColor(Color(awcHex: parent.config.caret))
        }
        func edited(_ text: String) {
            guard !applying else { return }
            let comp = composing()
            if let (shaped, pos) = parent.events.edited(text, caret(), comp), shaped != text {
                applying = true
                if let f = field { f.text = shaped } else { textView?.attributedText = NSAttributedString(string: shaped, attributes: AWCFieldMetrics.attributes(parent.config)) }
                setCaret(pos); applying = false
            }
            if let t = textView { parent.events.contentHeight(Double(t.contentSize.height)) }
        }
        @objc func fieldChanged(_ f: UITextField) { edited(f.text ?? "") }
        func textViewDidChange(_ t: UITextView) { edited(t.text) }
        func textFieldDidBeginEditing(_ f: UITextField) { parent.events.focusChanged(true) }
        func textFieldDidEndEditing(_ f: UITextField) { parent.events.focusChanged(false) }
        func textViewDidBeginEditing(_ t: UITextView) { parent.events.focusChanged(true) }
        func textViewDidEndEditing(_ t: UITextView) { parent.events.focusChanged(false) }
        func textFieldShouldReturn(_ f: UITextField) -> Bool {
            if !parent.config.editable, parent.events.activate?("Enter") == true { return false }
            return !parent.events.command("Enter", composing())
        }
        func textFieldShouldBeginEditing(_ f: UITextField) -> Bool { parent.events.focusMark(); return true }
        func textFieldShouldEndEditing(_ f: UITextField) -> Bool { parent.events.focusMark(); return true }
        func textViewShouldBeginEditing(_ t: UITextView) -> Bool { parent.events.focusMark(); return true }
        func textViewShouldEndEditing(_ t: UITextView) -> Bool { parent.events.focusMark(); return true }
        /// `readonly`: focusable and selectable, never edited.
        func textField(_ f: UITextField, shouldChangeCharactersIn range: NSRange, replacementString s: String) -> Bool {
            // A read-only field's typed Space is its activation key (Web keydown); nothing is inserted either way.
            if !parent.config.editable, s == " ", parent.events.activate?("Space") == true { return false }
            return parent.config.editable
        }
        /// Focus as soon as the tap ends (simultaneous with UIKit's own text interaction, which still places the caret).
        @objc func tapFocus(_ g: UITapGestureRecognizer) {
            guard g.state == .ended else { return }
            if let i = input, !i.isFirstResponder { _ = i.becomeFirstResponder() }
            // A read-only field's tap is its click (Web `click`: a picker trigger opens).
            if !parent.config.editable { _ = parent.events.activate?("Click") }
        }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        func textFieldDidChangeSelection(_ f: UITextField) { let s = caret(); parent.events.selectionChanged(s, s) }
    }
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> UIView {
        let c = context.coordinator
        if config.multiline {
            // TextKit 1 (as on macOS): the fixed line height keeps a 24 px pitch on every line (TextKit 2 shortened it).
            let t = AWCFieldUITextView(usingTextLayoutManager: false); t.backgroundColor = .clear; t.textContainerInset = .zero; t.textContainer.lineFragmentPadding = 0
            t.isScrollEnabled = !config.autoGrow; t.delegate = c; c.textView = t
            t.onCommand = { [weak c] k in c?.parent.events.command(k, false) ?? false }
            Self.addFocusTap(t, c); update(t, context: context); return t
        }
        let f = AWCFieldUITextField(); f.borderStyle = .none; f.backgroundColor = .clear
        f.delegate = c; f.addTarget(c, action: #selector(Coordinator.fieldChanged(_:)), for: .editingChanged); c.field = f
        f.onCommand = { [weak c] k in c?.parent.events.command(k, false) ?? false }
        Self.addFocusTap(f, c); update(f, context: context); return f
    }
    func updateUIView(_ view: UIView, context: Context) { context.coordinator.parent = self; update(view, context: context) }
    private func update(_ view: UIView, context: Context) {
        let c = context.coordinator, cfg = config, attrs = AWCFieldMetrics.attributes(cfg)
        if let f = c.field {
            if f.text != cfg.text && !c.composing() { c.applying = true; f.text = cfg.text; c.applying = false }
            f.isSecureTextEntry = cfg.secure; f.isEnabled = cfg.enabled; f.navigationKeys = cfg.navigationKeys; f.editingKeys = cfg.editingKeys; f.readOnlyKeys = cfg.readOnlyKeys; f.editable = cfg.editable
            f.onPaste = events.paste == nil ? nil : { [weak c] text in c?.parent.events.paste?(text) ?? false }
            f.textAlignment = cfg.centered ? .center : (cfg.rtl ? .right : .left)
            var ph = AWCFieldMetrics.lineAttributes(cfg); ph[.foregroundColor] = AWCPlatformColor(Color(awcHex: cfg.placeholderColor))
            f.attributedPlaceholder = cfg.placeholder.isEmpty ? nil : NSAttributedString(string: cfg.placeholder, attributes: ph)
            f.keyboardType = Self.keyboard(cfg); f.autocapitalizationType = Self.capitalization(cfg.autocapitalize)
            f.spellCheckingType = cfg.spellcheck ? .default : .no; f.returnKeyType = Self.returnKey(cfg.enterKeyHint); Self.plainTyping(f)
            f.textContentType = Self.contentType(cfg)
            f.accessibilityLabel = cfg.accessibilityLabel; f.accessibilityHint = cfg.accessibilityHint
        }
        if let t = c.textView {
            if t.text != cfg.text && !c.composing() { c.applying = true; t.attributedText = NSAttributedString(string: cfg.text, attributes: attrs); c.applying = false }
            t.isEditable = cfg.editable && cfg.enabled; t.isSelectable = cfg.enabled; t.isScrollEnabled = !cfg.autoGrow
            t.keyboardType = Self.keyboard(cfg); t.autocapitalizationType = Self.capitalization(cfg.autocapitalize)
            t.spellCheckingType = cfg.spellcheck ? .default : .no; t.returnKeyType = Self.returnKey(cfg.enterKeyHint); Self.plainTyping(t)
            t.accessibilityLabel = cfg.accessibilityLabel; t.accessibilityHint = cfg.accessibilityHint
        }
        c.restyle()
        handle.focus = { [weak c] in c?.input?.becomeFirstResponder() ?? false }
        handle.blur = { [weak c] in _ = c?.input?.resignFirstResponder() }
        handle.selectAll = { [weak c] in if let i = c?.input { i.selectedTextRange = i.textRange(from: i.beginningOfDocument, to: i.endOfDocument) } }
        handle.setSelection = { [weak c] a, b in
            guard let i = c?.input, let s = i.position(from: i.beginningOfDocument, offset: a), let e = i.position(from: i.beginningOfDocument, offset: b) else { return }
            i.selectedTextRange = i.textRange(from: s, to: e)
        }
        handle.selection = { [weak c] in
            guard let i = c?.input, let r = i.selectedTextRange else { return (0, 0) }
            return (i.offset(from: i.beginningOfDocument, to: r.start), i.offset(from: i.beginningOfDocument, to: r.end))
        }
        handle.isFocused = { [weak c] in c?.input?.isFirstResponder ?? false }
        handle.isComposing = { [weak c] in c?.composing() ?? false }
        handle.caretRect = { [weak c] in guard let i = c?.input, let r = i.selectedTextRange else { return nil }; return i.caretRect(for: r.end) }
    }
    static func addFocusTap(_ v: UIView, _ c: Coordinator) {
        let g = UITapGestureRecognizer(target: c, action: #selector(Coordinator.tapFocus(_:)))
        g.cancelsTouchesInView = false; g.delaysTouchesEnded = false; g.delegate = c; v.addGestureRecognizer(g)
    }
    /// Chrome inserts exactly the keys pressed: no auto-correction or smart punctuation unless the page opts in
    /// (`autocapitalize`); `spellcheck` only underlines.
    static func plainTyping(_ v: UITextField) {
        v.autocorrectionType = .no; v.smartQuotesType = .no; v.smartDashesType = .no; v.smartInsertDeleteType = .no
        if #available(iOS 17.0, *) { v.inlinePredictionType = .no }
    }
    static func plainTyping(_ v: UITextView) {
        v.autocorrectionType = .no; v.smartQuotesType = .no; v.smartDashesType = .no; v.smartInsertDeleteType = .no
        if #available(iOS 17.0, *) { v.inlinePredictionType = .no }
    }
    static func keyboard(_ c: AWCFieldInputConfig) -> UIKeyboardType {
        switch c.inputMode.isEmpty ? c.type : c.inputMode {
        case "numeric", "number": return .numberPad
        case "decimal": return .decimalPad
        case "tel": return .phonePad
        case "email": return .emailAddress
        case "url": return .URL
        case "search": return .webSearch
        default: return .default
        }
    }
    static func capitalization(_ v: String) -> UITextAutocapitalizationType {
        ["none": .none, "off": .none, "words": .words, "characters": .allCharacters, "sentences": .sentences, "on": .sentences][v] ?? .none
    }
    static func returnKey(_ v: String) -> UIReturnKeyType {
        ["enter": .default, "done": .done, "go": .go, "next": .next, "previous": .default, "search": .search, "send": .send][v] ?? .default
    }
    static func contentType(_ c: AWCFieldInputConfig) -> UITextContentType? {
        switch c.autocomplete {
        case "one-time-code": return .oneTimeCode
        case "username": return .username
        case "current-password": return .password
        case "new-password": return .newPassword
        case "email": return .emailAddress
        case "tel": return .telephoneNumber
        case "url": return .URL
        default: return nil
        }
    }
}
#endif

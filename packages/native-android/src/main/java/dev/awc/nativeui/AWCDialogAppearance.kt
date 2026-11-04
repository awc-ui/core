package dev.awc.nativeui

import androidx.compose.runtime.*
import kotlinx.coroutines.delay

private val ModalHex = Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
internal fun awcModalColor(value: String?) = value?.takeIf { it.matches(ModalHex) }?.uppercase(java.util.Locale.ROOT)

/** The ten public md-dialog hooks (`--md-dialog-*`). Colours are #RRGGBB[AA]; the z-index hooks become paint keys. */
@Immutable data class AWCDialogAppearance(
    val containerColor: String? = null, val containerShape: AWCCornerShape? = null, val headlineColor: String? = null,
    val contentColor: String? = null, val iconColor: String? = null, val iconSize: Double? = null, val scrimColor: String? = null,
    val dividerColor: String? = null, val zIndex: Double? = null, val scrimZIndex: Double? = null,
) {
    internal fun normalized() = AWCDialogAppearance(awcModalColor(containerColor), containerShape, awcModalColor(headlineColor), awcModalColor(contentColor),
        awcModalColor(iconColor), iconSize?.takeIf { it.isFinite() && it >= 0 }, awcModalColor(scrimColor), awcModalColor(dividerColor),
        zIndex?.takeIf { it.isFinite() }?.let { Math.round(it).toDouble() }, scrimZIndex?.takeIf { it.isFinite() }?.let { Math.round(it).toDouble() })
    fun merge(o: AWCDialogAppearance) = AWCDialogAppearance(o.containerColor ?: containerColor, o.containerShape ?: containerShape,
        o.headlineColor ?: headlineColor, o.contentColor ?: contentColor, o.iconColor ?: iconColor, o.iconSize ?: iconSize,
        o.scrimColor ?: scrimColor, o.dividerColor ?: dividerColor, o.zIndex ?: zIndex, o.scrimZIndex ?: scrimZIndex)
    companion object {
        /** From plain data (Laboratory/IR): hook names in camelCase; shape as [AWCCornerShape.fromValues]. */
        fun fromValues(values: Map<String, Any?>): AWCDialogAppearance {
            fun s(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            return AWCDialogAppearance(s("containerColor"), AWCCornerShape.fromValues(values["containerShape"]), s("headlineColor"), s("contentColor"),
                s("iconColor"), n("iconSize"), s("scrimColor"), s("dividerColor"), n("zIndex"), n("scrimZIndex")).normalized()
        }
    }
}

/** The eleven md-dialog parts (`::part(...)`). */
enum class AWCDialogPart(val source: String) {
    Scrim("scrim"), Container("container"), Header("header"), Icon("icon"), Headline("headline"), Content("content"), Divider("divider"),
    Actions("actions"), CancelButton("cancel-button"), OkButton("ok-button"), CloseButton("close-button")
}

/** Author styling of one modal part: the `::part()` declarations with native meaning (colours #RRGGBB[AA], lengths dp). */
@Immutable data class AWCModalPartAppearance(
    val background: String? = null, val color: String? = null, val outlineColor: String? = null, val outlineWidth: Double? = null,
    val letterSpacing: Double? = null, val underline: Boolean? = null, val height: Double? = null, val opacity: Double? = null,
) {
    internal fun normalized() = AWCModalPartAppearance(awcModalColor(background), awcModalColor(color), awcModalColor(outlineColor),
        outlineWidth?.takeIf { it.isFinite() && it >= 0 }, letterSpacing?.takeIf { it.isFinite() }, underline, height?.takeIf { it.isFinite() && it >= 0 },
        opacity?.takeIf { it.isFinite() }?.coerceIn(0.0, 1.0))
    fun merge(o: AWCModalPartAppearance) = AWCModalPartAppearance(o.background ?: background, o.color ?: color, o.outlineColor ?: outlineColor,
        o.outlineWidth ?: outlineWidth, o.letterSpacing ?: letterSpacing, o.underline ?: underline, o.height ?: height, o.opacity ?: opacity)
}

internal val LocalAWCDialogAppearance = staticCompositionLocalOf { AWCDialogAppearance() }
internal val LocalAWCDialogAppearanceTargets = staticCompositionLocalOf<Map<String, AWCDialogAppearance>> { emptyMap() }
/** Keys: "part" (every dialog below) or "id|part" (one dialog). */
internal val LocalAWCDialogParts = staticCompositionLocalOf<Map<String, AWCModalPartAppearance>> { emptyMap() }

/** md-dialog hooks for every dialog below, or only the dialog whose `id` property is [id]. */
@Composable fun AWCDialogAppearanceScope(appearance: AWCDialogAppearance, id: String? = null, content: @Composable () -> Unit) {
    val value = appearance.normalized()
    if (id == null) CompositionLocalProvider(LocalAWCDialogAppearance provides LocalAWCDialogAppearance.current.merge(value), content = content)
    else { val t = LocalAWCDialogAppearanceTargets.current
        CompositionLocalProvider(LocalAWCDialogAppearanceTargets provides t + (id to (t[id] ?: AWCDialogAppearance()).merge(value)), content = content) }
}
/** Style one md-dialog part (`::part(name)`) for every dialog below, or only [id]. */
@Composable fun AWCDialogPartAppearanceScope(part: AWCDialogPart, appearance: AWCModalPartAppearance, id: String? = null, content: @Composable () -> Unit) {
    val key = if (id == null) part.source else "$id|${part.source}"
    val parts = LocalAWCDialogParts.current
    CompositionLocalProvider(LocalAWCDialogParts provides parts + (key to (parts[key] ?: AWCModalPartAppearance()).merge(appearance.normalized())), content = content)
}

/**
 * Source methods of one md-dialog: `show()`, `close()` and `whenClosed()` (resumes once the open cycle and the
 * shell exit motion have finished; immediately under reduced motion). Bind it with [AWCDialogControllerScope].
 */
@Stable class AWCDialogController {
    internal var showAction: () -> Unit = {}
    internal var closeAction: () -> Unit = {}
    internal var openState: () -> Boolean = { false }
    internal var exiting: () -> Boolean = { false }
    val isOpen get() = openState()
    fun show() = showAction()
    fun close() = closeAction()
    suspend fun whenClosed() { while (openState() || exiting()) delay(4) }
}
internal val LocalAWCDialogController = staticCompositionLocalOf<AWCDialogController?> { null }
/** Binds [controller] to the md-dialog rendered directly below (nested dialogs do not inherit it). */
@Composable fun AWCDialogControllerScope(controller: AWCDialogController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCDialogController provides controller, content = content)

/** Rendered modal values per frame (tests, Laboratory inspector). Times are frame-clock milliseconds. */
class AWCModalInspection internal constructor(internal val read: () -> Map<String, Any?>) { val values get() = read() }
internal val LocalAWCModalInspector = staticCompositionLocalOf<((String, AWCModalInspection) -> Unit)?> { null }
/** Receive each modal's live inspection (keyed by component `id`, or "" when it has none). */
@Composable fun AWCModalInspectionScope(onInspection: (String, AWCModalInspection) -> Unit, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCModalInspector provides onInspection, content = content)

/** Built-in dialog labels (source `dialog-utils.ts`): 14 languages, English fallback; explicit labels win. */
internal object AWCDialogLabels {
    val english = mapOf("close" to "Close", "cancel" to "Cancel", "ok" to "OK")
    val table = mapOf(
        "ar" to mapOf("close" to "إغلاق", "cancel" to "إلغاء", "ok" to "موافق"), "de" to mapOf("close" to "Schließen", "cancel" to "Abbrechen", "ok" to "OK"),
        "es" to mapOf("close" to "Cerrar", "cancel" to "Cancelar", "ok" to "Aceptar"), "fr" to mapOf("close" to "Fermer", "cancel" to "Annuler", "ok" to "OK"),
        "hi" to mapOf("close" to "बंद करें", "cancel" to "रद्द करें", "ok" to "ठीक"), "it" to mapOf("close" to "Chiudi", "cancel" to "Annulla", "ok" to "OK"),
        "ja" to mapOf("close" to "閉じる", "cancel" to "キャンセル", "ok" to "OK"), "ko" to mapOf("close" to "닫기", "cancel" to "취소", "ok" to "확인"),
        "nl" to mapOf("close" to "Sluiten", "cancel" to "Annuleren", "ok" to "OK"), "pl" to mapOf("close" to "Zamknij", "cancel" to "Anuluj", "ok" to "OK"),
        "pt" to mapOf("close" to "Fechar", "cancel" to "Cancelar", "ok" to "OK"), "ro" to mapOf("close" to "Închide", "cancel" to "Anulează", "ok" to "OK"),
        "ru" to mapOf("close" to "Закрыть", "cancel" to "Отмена", "ok" to "ОК"), "zh" to mapOf("close" to "关闭", "cancel" to "取消", "ok" to "确定"),
    )
    fun language(locale: String): String { val tag = locale.trim(); if (tag.isEmpty()) return "en"; return tag.split('-', '_').first().lowercase(java.util.Locale.ROOT) }
    fun resolve(locale: String, key: String) = table[language(locale.ifEmpty { "en-US" })]?.get(key) ?: english[key] ?: key
}

/** Spacing rungs set by `[density]` / `[data-density]` (md3.css): inset-xl and gap-sm come from the nearest rung that defines them. */
internal object AWCModalSpacing {
    private fun rung(local: Double?, inherited: Double, defines: Set<Double>): Double = if (local != null && local in defines) local else if (inherited in defines) inherited else 0.0
    fun insetXL(local: Double?, inherited: Double): Double { val d = rung(local, inherited, setOf(-2.0, -3.0, -4.0)); return if (d <= -3) 16.0 else if (d <= -2) 20.0 else 24.0 }
    fun gapSM(local: Double?, inherited: Double): Double = if (rung(local, inherited, setOf(-3.0, -4.0)) <= -3) 4.0 else 8.0
}

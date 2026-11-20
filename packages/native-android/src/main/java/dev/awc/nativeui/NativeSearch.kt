@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.Window
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.zIndex
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogWindowProvider
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-search (Compose): the resting bar (or the icon trigger), the docked panel under the bar and the full-screen view in
// the application's modal viewport (AWCModalScope), with the source's value pipeline (mdInput per keystroke, mdSearch
// debounced / maxWait-throttled, trimmed and distinct, flushed on Enter and clear; mdChange on blur), open / close with
// mdOpen / mdClose and the two-stage close motion, result-row keyboard navigation, the full-screen focus trap, the polite
// results announcement, the loading ↔ clear morph and voice search (android.speech).

// ── Hooks ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The md-search hooks (`--md-search-*`), one field each; lengths and durations are dp / ms (CSS px / ms), colours
 *  `#RRGGBB[AA]`, easings cubic-bezier control points, the elevation a box-shadow layer list. Nested scopes merge field by field. */
@Immutable data class AWCSearchAppearance(
    /** `--md-search-container-color` */ val containerColor:String?=null,
    /** `--md-search-container-elevation` */ val containerElevation:List<AWCBoxShadow>?=null,
    /** `--md-search-leading-icon-color` */ val leadingIconColor:String?=null,
    /** `--md-search-trailing-icon-color` */ val trailingIconColor:String?=null,
    /** `--md-search-icon-color` */ val iconColor:String?=null,
    /** `--md-search-loading-color` */ val loadingColor:String?=null,
    /** `--md-search-container-shape` */ val containerShape:Double?=null,
    /** `--md-search-container-height` */ val containerHeight:Double?=null,
    /** `--md-search-icon-button-size` */ val iconButtonSize:Double?=null,
    /** `--md-search-leading-icon-label-gap` */ val leadingIconLabelGap:Double?=null,
    /** `--md-search-trailing-icon-label-gap` */ val trailingIconLabelGap:Double?=null,
    /** `--md-search-container-padding-inline` */ val containerPaddingInline:Double?=null,
    /** `--md-search-container-padding-inline-focused` */ val containerPaddingInlineFocused:Double?=null,
    /** `--md-search-leading-padding-inline` */ val leadingPaddingInline:Double?=null,
    /** `--md-search-trailing-padding-inline` */ val trailingPaddingInline:Double?=null,
    /** `--md-search-input-color` */ val inputColor:String?=null,
    /** `--md-search-input-font-family` */ val inputFontFamily:String?=null,
    /** `--md-search-input-font-size` */ val inputFontSize:Double?=null,
    /** `--md-search-input-line-height` */ val inputLineHeight:Double?=null,
    /** `--md-search-input-font-weight` */ val inputFontWeight:Double?=null,
    /** `--md-search-input-letter-spacing` */ val inputLetterSpacing:Double?=null,
    /** `--md-search-placeholder-color` */ val placeholderColor:String?=null,
    /** `--md-search-state-layer-color` */ val stateLayerColor:String?=null,
    /** `--md-search-focus-indicator-color` */ val focusIndicatorColor:String?=null,
    /** `--md-search-focus-indicator-offset` */ val focusIndicatorOffset:Double?=null,
    /** `--md-search-avatar-size` */ val avatarSize:Double?=null,
    /** `--md-search-panel-min-block-size` */ val panelMinBlockSize:Double?=null,
    /** `--md-search-panel-max-block-size` */ val panelMaxBlockSize:Double?=null,
    /** `--md-search-max-block-size` */ val maxBlockSize:Double?=null,
    /** `--md-search-docked-panel-shape` */ val dockedPanelShape:Double?=null,
    /** `--md-search-panel-offset` */ val panelOffset:Double?=null,
    /** `--md-search-bar-fullscreen-color` */ val barFullscreenColor:String?=null,
    /** `--md-search-fullscreen-results-color` */ val fullscreenResultsColor:String?=null,
    /** `--md-search-divider-color` */ val dividerColor:String?=null,
    /** `--md-search-divider-thickness` */ val dividerThickness:Double?=null,
    /** `--md-search-fullscreen-bar-panel-gap` */ val fullscreenBarPanelGap:Double?=null,
    /** `--md-search-empty-color` */ val emptyColor:String?=null,
    /** `--md-search-empty-padding-block` */ val emptyPaddingBlock:Double?=null,
    /** `--md-search-empty-padding-inline` */ val emptyPaddingInline:Double?=null,
    /** `--md-search-expand-inset` */ val expandInset:Double?=null,
    /** `--md-search-expand-focused-inset` */ val expandFocusedInset:Double?=null,
    /** `--md-search-expand-duration` */ val expandDuration:Double?=null,
    /** `--md-search-expand-easing` */ val expandEasing:List<Double>?=null,
    /** `--md-search-panel-motion-duration` */ val panelMotionDuration:Double?=null,
    /** `--md-search-fullscreen-expand-duration` */ val fullscreenExpandDuration:Double?=null,
    /** `--md-search-fullscreen-expand-easing` */ val fullscreenExpandEasing:List<Double>?=null,
    /** `--md-search-fullscreen-collapse-easing` */ val fullscreenCollapseEasing:List<Double>?=null,
    /** `--md-search-divided-fullscreen-bar-height` */ val dividedFullscreenBarHeight:Double?=null,
    /** `--md-search-container-min-inline-size` */ val containerMinInlineSize:Double?=null,
    /** `--md-search-container-max-inline-size` */ val containerMaxInlineSize:Double?=null,
    /** `--md-search-icon-size` */ val iconSize:Double?=null,
    /** `--md-search-focus-indicator-thickness` */ val focusIndicatorThickness:Double?=null,
    /** `--md-search-panel-padding-block-start` */ val panelPaddingBlockStart:Double?=null,
    /** `--md-search-contained-background-color` */ val containedBackgroundColor:String?=null,
    /** `--md-search-contained-docked-panel-offset` */ val containedDockedPanelOffset:Double?=null,
    /** `--md-search-fullscreen-bar-offset-block-start` */ val fullscreenBarOffsetBlockStart:Double?=null,
    /** `--md-search-fullscreen-bar-offset-inline` */ val fullscreenBarOffsetInline:Double?=null,
    /** `--md-search-fullscreen-collapse-duration` */ val fullscreenCollapseDuration:Double?=null,
    /** `--md-search-hover-state-layer-opacity` */ val hoverStateLayerOpacity:Double?=null,
    /** `--md-search-pressed-state-layer-opacity` */ val pressedStateLayerOpacity:Double?=null,
) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    private fun f(v:Double?)=v?.takeIf { it.isFinite() }
    internal fun normalized()=AWCSearchAppearance(switchColorHex(containerColor),containerElevation?.takeIf { it.isNotEmpty() },switchColorHex(leadingIconColor),switchColorHex(trailingIconColor),switchColorHex(iconColor),switchColorHex(loadingColor),l(containerShape),l(containerHeight),l(iconButtonSize),l(leadingIconLabelGap),l(trailingIconLabelGap),l(containerPaddingInline),l(containerPaddingInlineFocused),l(leadingPaddingInline),l(trailingPaddingInline),switchColorHex(inputColor),inputFontFamily?.trim()?.takeIf { it.isNotEmpty() },l(inputFontSize),l(inputLineHeight),f(inputFontWeight),l(inputLetterSpacing),switchColorHex(placeholderColor),switchColorHex(stateLayerColor),switchColorHex(focusIndicatorColor),l(focusIndicatorOffset),l(avatarSize),l(panelMinBlockSize),l(panelMaxBlockSize),l(maxBlockSize),l(dockedPanelShape),l(panelOffset),switchColorHex(barFullscreenColor),switchColorHex(fullscreenResultsColor),switchColorHex(dividerColor),l(dividerThickness),l(fullscreenBarPanelGap),switchColorHex(emptyColor),l(emptyPaddingBlock),l(emptyPaddingInline),l(expandInset),l(expandFocusedInset),l(expandDuration),expandEasing?.takeIf { c-> c.size==4 && c.all { it.isFinite() } },l(panelMotionDuration),l(fullscreenExpandDuration),fullscreenExpandEasing?.takeIf { c-> c.size==4 && c.all { it.isFinite() } },fullscreenCollapseEasing?.takeIf { c-> c.size==4 && c.all { it.isFinite() } },l(dividedFullscreenBarHeight),l(containerMinInlineSize),l(containerMaxInlineSize),l(iconSize),l(focusIndicatorThickness),l(panelPaddingBlockStart),switchColorHex(containedBackgroundColor),l(containedDockedPanelOffset),l(fullscreenBarOffsetBlockStart),l(fullscreenBarOffsetInline),l(fullscreenCollapseDuration),f(hoverStateLayerOpacity),f(pressedStateLayerOpacity))
    fun merged(o:AWCSearchAppearance)=AWCSearchAppearance(o.containerColor ?: containerColor,o.containerElevation ?: containerElevation,o.leadingIconColor ?: leadingIconColor,o.trailingIconColor ?: trailingIconColor,o.iconColor ?: iconColor,o.loadingColor ?: loadingColor,o.containerShape ?: containerShape,o.containerHeight ?: containerHeight,o.iconButtonSize ?: iconButtonSize,o.leadingIconLabelGap ?: leadingIconLabelGap,o.trailingIconLabelGap ?: trailingIconLabelGap,o.containerPaddingInline ?: containerPaddingInline,o.containerPaddingInlineFocused ?: containerPaddingInlineFocused,o.leadingPaddingInline ?: leadingPaddingInline,o.trailingPaddingInline ?: trailingPaddingInline,o.inputColor ?: inputColor,o.inputFontFamily ?: inputFontFamily,o.inputFontSize ?: inputFontSize,o.inputLineHeight ?: inputLineHeight,o.inputFontWeight ?: inputFontWeight,o.inputLetterSpacing ?: inputLetterSpacing,o.placeholderColor ?: placeholderColor,o.stateLayerColor ?: stateLayerColor,o.focusIndicatorColor ?: focusIndicatorColor,o.focusIndicatorOffset ?: focusIndicatorOffset,o.avatarSize ?: avatarSize,o.panelMinBlockSize ?: panelMinBlockSize,o.panelMaxBlockSize ?: panelMaxBlockSize,o.maxBlockSize ?: maxBlockSize,o.dockedPanelShape ?: dockedPanelShape,o.panelOffset ?: panelOffset,o.barFullscreenColor ?: barFullscreenColor,o.fullscreenResultsColor ?: fullscreenResultsColor,o.dividerColor ?: dividerColor,o.dividerThickness ?: dividerThickness,o.fullscreenBarPanelGap ?: fullscreenBarPanelGap,o.emptyColor ?: emptyColor,o.emptyPaddingBlock ?: emptyPaddingBlock,o.emptyPaddingInline ?: emptyPaddingInline,o.expandInset ?: expandInset,o.expandFocusedInset ?: expandFocusedInset,o.expandDuration ?: expandDuration,o.expandEasing ?: expandEasing,o.panelMotionDuration ?: panelMotionDuration,o.fullscreenExpandDuration ?: fullscreenExpandDuration,o.fullscreenExpandEasing ?: fullscreenExpandEasing,o.fullscreenCollapseEasing ?: fullscreenCollapseEasing,o.dividedFullscreenBarHeight ?: dividedFullscreenBarHeight,o.containerMinInlineSize ?: containerMinInlineSize,o.containerMaxInlineSize ?: containerMaxInlineSize,o.iconSize ?: iconSize,o.focusIndicatorThickness ?: focusIndicatorThickness,o.panelPaddingBlockStart ?: panelPaddingBlockStart,o.containedBackgroundColor ?: containedBackgroundColor,o.containedDockedPanelOffset ?: containedDockedPanelOffset,o.fullscreenBarOffsetBlockStart ?: fullscreenBarOffsetBlockStart,o.fullscreenBarOffsetInline ?: fullscreenBarOffsetInline,o.fullscreenCollapseDuration ?: fullscreenCollapseDuration,o.hoverStateLayerOpacity ?: hoverStateLayerOpacity,o.pressedStateLayerOpacity ?: pressedStateLayerOpacity)
    companion object {
        /** From the Laboratory / host value map (lengths px, durations ms, easings as four numbers or CSS text, the elevation as CSS box-shadow text or layers). */
        fun fromValues(v:Map<String,Any?>):AWCSearchAppearance {
            fun s(k:String)=(v[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k:String)=(v[k] as? Number)?.toDouble() ?: (v[k] as? String)?.replace("px","")?.replace("ms","")?.trim()?.toDoubleOrNull()
            fun e(k:String)=(v[k] as? List<*>)?.mapNotNull { (it as? Number)?.toDouble() }?.takeIf { it.size==4 } ?: accordionCubicBezierCurve(s(k))
            fun sh(k:String)=AWCBoxShadow.list(v[k]) ?: s(k)?.let { css-> NativeShadowLayer.parse(css).takeIf { it.isNotEmpty() || css.trim()=="none" }?.map { AWCBoxShadow(it.x,it.y,it.blur,it.spread,searchShadowHex(it.color),it.inset) } }
            return AWCSearchAppearance(s("containerColor"),sh("containerElevation"),s("leadingIconColor"),s("trailingIconColor"),s("iconColor"),s("loadingColor"),n("containerShape"),n("containerHeight"),n("iconButtonSize"),n("leadingIconLabelGap"),n("trailingIconLabelGap"),n("containerPaddingInline"),n("containerPaddingInlineFocused"),n("leadingPaddingInline"),n("trailingPaddingInline"),s("inputColor"),s("inputFontFamily"),n("inputFontSize"),n("inputLineHeight"),n("inputFontWeight"),n("inputLetterSpacing"),s("placeholderColor"),s("stateLayerColor"),s("focusIndicatorColor"),n("focusIndicatorOffset"),n("avatarSize"),n("panelMinBlockSize"),n("panelMaxBlockSize"),n("maxBlockSize"),n("dockedPanelShape"),n("panelOffset"),s("barFullscreenColor"),s("fullscreenResultsColor"),s("dividerColor"),n("dividerThickness"),n("fullscreenBarPanelGap"),s("emptyColor"),n("emptyPaddingBlock"),n("emptyPaddingInline"),n("expandInset"),n("expandFocusedInset"),n("expandDuration"),e("expandEasing"),n("panelMotionDuration"),n("fullscreenExpandDuration"),e("fullscreenExpandEasing"),e("fullscreenCollapseEasing"),n("dividedFullscreenBarHeight"),n("containerMinInlineSize"),n("containerMaxInlineSize"),n("iconSize"),n("focusIndicatorThickness"),n("panelPaddingBlockStart"),s("containedBackgroundColor"),n("containedDockedPanelOffset"),n("fullscreenBarOffsetBlockStart"),n("fullscreenBarOffsetInline"),n("fullscreenCollapseDuration"),n("hoverStateLayerOpacity"),n("pressedStateLayerOpacity")).normalized()
        }
    }
}

internal fun searchShadowHex(c:Color)="#%02X%02X%02X%02X".format((c.red*255).roundToInt(),(c.green*255).roundToInt(),(c.blue*255).roundToInt(),(c.alpha*255).roundToInt())

internal data class AWCSearchAppearanceContext(val all:AWCSearchAppearance=AWCSearchAppearance(),val targets:Map<String,AWCSearchAppearance> = emptyMap()) {
    fun resolve(id:String)=targets[id]?.let { all.merged(it) } ?: all
}
internal val LocalAWCSearchAppearance=staticCompositionLocalOf { AWCSearchAppearanceContext() }
/** md-search hook values for descendant searches, or (with [id]) for the search whose `id` property matches. */
@Composable fun AWCSearchAppearanceScope(appearance:AWCSearchAppearance,id:String?=null,content:@Composable ()->Unit) {
    val cur=LocalAWCSearchAppearance.current;val a=appearance.normalized()
    val next=if(id==null) cur.copy(all=cur.all.merged(a)) else cur.copy(targets=cur.targets+(id to (cur.targets[id] ?: AWCSearchAppearance()).merged(a)))
    CompositionLocalProvider(LocalAWCSearchAppearance provides next,content=content)
}
/**
 * Typed counterparts of md-search's `::part()` rules — the declarations that paint in Chrome. Part values come from the outer
 * tree, so they win over the hooks and every internal state rule (a state-layer opacity shows at rest), as `::part()` rules do.
 * Colours are #RRGGBB or #RRGGBBAA, opacities 0…1. Not typed: status (a visually hidden live region), trigger, panel-body and
 * results-host (layout wrappers whose boxes are the trigger button's, the panel's and the viewport's), loading / loading-shape
 * (the loading indicator keeps its own appearance; the loader slot replaces it) and the glyph colours (use the hooks).
 */
data class AWCSearchPartAppearance(
    /** `::part(bar) { background-color }` */ val barBackgroundColor:String?=null,
    /** `::part(state-layer) { background-color; opacity }` */ val stateLayerColor:String?=null,val stateLayerOpacity:Double?=null,
    /** `::part(leading) { background-color }` (the leading box, padding included) */ val leadingBackgroundColor:String?=null,
    /** `::part(leading-state-layer) { background-color; opacity }` */ val leadingStateLayerColor:String?=null,val leadingStateLayerOpacity:Double?=null,
    /** `::part(input) { color; caret-color }` (the caret follows the colour unless set) */ val inputColor:String?=null,val caretColor:String?=null,
    /** `::part(trailing) { background-color }` */ val trailingBackgroundColor:String?=null,
    /** `::part(clear-button | voice-button | trigger-button) { background-color }` (round boxes) */
    val clearButtonBackgroundColor:String?=null,val voiceButtonBackgroundColor:String?=null,val triggerButtonBackgroundColor:String?=null,
    /** `::part(divider) { background-color }`, `::part(panel) { background-color }`, `::part(empty) { color }`, `::part(results-viewport) { background-color }` */
    val dividerColor:String?=null,val panelBackgroundColor:String?=null,val emptyColor:String?=null,val resultsViewportBackgroundColor:String?=null,
    /** parts2: `::part(trigger)` (display: contents: no box, stored, not painted), `::part(panel-body | results-host | loading | loading-shape) { background-color }`, `::part(status)` (visually hidden: stored, not painted) */
    val triggerBackgroundColor:String?=null,val panelBodyBackgroundColor:String?=null,val resultsHostBackgroundColor:String?=null,val loadingBackgroundColor:String?=null,val loadingShapeBackgroundColor:String?=null,val statusBackgroundColor:String?=null) {
    private fun u(v:Double?)=v?.takeIf { it.isFinite() }?.coerceIn(0.0,1.0)
    internal fun normalized()=AWCSearchPartAppearance(switchColorHex(barBackgroundColor),switchColorHex(stateLayerColor),u(stateLayerOpacity),switchColorHex(leadingBackgroundColor),
        switchColorHex(leadingStateLayerColor),u(leadingStateLayerOpacity),switchColorHex(inputColor),switchColorHex(caretColor),switchColorHex(trailingBackgroundColor),
        switchColorHex(clearButtonBackgroundColor),switchColorHex(voiceButtonBackgroundColor),switchColorHex(triggerButtonBackgroundColor),switchColorHex(dividerColor),
        switchColorHex(panelBackgroundColor),switchColorHex(emptyColor),switchColorHex(resultsViewportBackgroundColor),
        switchColorHex(triggerBackgroundColor),switchColorHex(panelBodyBackgroundColor),switchColorHex(resultsHostBackgroundColor),switchColorHex(loadingBackgroundColor),switchColorHex(loadingShapeBackgroundColor),switchColorHex(statusBackgroundColor))
    fun merged(o:AWCSearchPartAppearance)=AWCSearchPartAppearance(o.barBackgroundColor ?: barBackgroundColor,o.stateLayerColor ?: stateLayerColor,o.stateLayerOpacity ?: stateLayerOpacity,
        o.leadingBackgroundColor ?: leadingBackgroundColor,o.leadingStateLayerColor ?: leadingStateLayerColor,o.leadingStateLayerOpacity ?: leadingStateLayerOpacity,
        o.inputColor ?: inputColor,o.caretColor ?: caretColor,o.trailingBackgroundColor ?: trailingBackgroundColor,o.clearButtonBackgroundColor ?: clearButtonBackgroundColor,
        o.voiceButtonBackgroundColor ?: voiceButtonBackgroundColor,o.triggerButtonBackgroundColor ?: triggerButtonBackgroundColor,o.dividerColor ?: dividerColor,
        o.panelBackgroundColor ?: panelBackgroundColor,o.emptyColor ?: emptyColor,o.resultsViewportBackgroundColor ?: resultsViewportBackgroundColor,
        o.triggerBackgroundColor ?: triggerBackgroundColor,o.panelBodyBackgroundColor ?: panelBodyBackgroundColor,o.resultsHostBackgroundColor ?: resultsHostBackgroundColor,o.loadingBackgroundColor ?: loadingBackgroundColor,o.loadingShapeBackgroundColor ?: loadingShapeBackgroundColor,o.statusBackgroundColor ?: statusBackgroundColor)
}
internal data class AWCSearchPartContext(val all:AWCSearchPartAppearance=AWCSearchPartAppearance(),val targets:Map<String,AWCSearchPartAppearance> = emptyMap()) {
    fun resolve(id:String)=targets[id]?.let { all.merged(it) } ?: all
}
internal val LocalAWCSearchParts=staticCompositionLocalOf { AWCSearchPartContext() }
/** md-search `::part()` values for descendant searches, or (with [id]) for the search whose `id` property matches. */
@Composable fun AWCSearchPartAppearanceScope(parts:AWCSearchPartAppearance,id:String?=null,content:@Composable ()->Unit) {
    val cur=LocalAWCSearchParts.current;val v=parts.normalized()
    val next=if(id==null) cur.copy(all=cur.all.merged(v)) else cur.copy(targets=cur.targets+(id to (cur.targets[id] ?: AWCSearchPartAppearance()).merged(v)))
    CompositionLocalProvider(LocalAWCSearchParts provides next,content=content)
}
internal val LocalAWCSearchReducedMotion=staticCompositionLocalOf<Boolean?> { null }
/** Forces (or, with null, releases) reduced motion for descendant searches (the system animator scale otherwise). */
@Composable fun AWCSearchReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCSearchReducedMotion provides reduced,content=content)

// ── Methods ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** md-search's methods: show, close, whenClosed, toggle, focusInput, startVoice, stopVoice. */
class AWCSearchController {
    internal var runtime:SearchRuntime?=null
    val isConnected get()=runtime!=null
    /** Opens the view (mdOpen once the change applies). */
    fun show() { runtime?.let { it.requestOpen(true) } }
    fun close() { runtime?.let { it.requestOpen(false) } }
    fun toggle() { runtime?.let { it.requestOpen(!it.open) } }
    /** Calls [done] once the current close (both motion stages and focus restoration) has finished, or at once when closed. */
    fun whenClosed(done:()->Unit) { val r=runtime;if(r==null || !(r.open || r.barExpanded)) done() else r.closedWaiters+=done }
    suspend fun whenClosed() { kotlinx.coroutines.suspendCancellableCoroutine<Unit> { c-> whenClosed { if(c.isActive) c.resumeWith(Result.success(Unit)) } } }
    fun focusInput() { runtime?.focusInput?.invoke() }
    fun startVoice() { runtime?.startVoice?.invoke() }
    fun stopVoice() { runtime?.stopVoice?.invoke() }
    /** The open state, the current value and whether voice recognition is listening (inspection and examples). */
    val isOpen get()=runtime?.open ?: false
    val value get()=runtime?.value ?: ""
    val isListening get()=runtime?.listening ?: false
}
internal val LocalAWCSearchControllers=staticCompositionLocalOf<Map<String,AWCSearchController>> { emptyMap() }
/** Attaches [controller] to the search whose `id` property is [id] (every descendant search without one when null). */
@Composable fun AWCSearchControllerScope(controller:AWCSearchController,id:String?=null,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSearchControllers provides LocalAWCSearchControllers.current+((id ?: "") to controller),content=content)

/** Parity / inspection values of every measured part (keyed by part, "" = the host), published after each composition. */
internal val LocalAWCSearchInspector=staticCompositionLocalOf<((Map<String,Map<String,Any?>>)->Unit)?> { null }
@Composable fun AWCSearchInspectionScope(onSearch:(Map<String,Map<String,Any?>>)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSearchInspector provides onSearch,content=content)

// ── Results (the `results` slot's rows, as the source counts them for the announcement) ────────────────────────────

/** Rows of the results slot: md-list-item, role option / menuitem, data-search-result, li; containers count when there are none. */
internal class AWCSearchResults { val roots=mutableStateListOf<Any>();val items=mutableStateListOf<Any>()
    /** The result row that has focus (md-list's roving focus moves it; ArrowUp on the first row returns to the input). */
    var focusedItem:Any?=null
    val count get()=if(items.isNotEmpty()) items.size else roots.size }
internal data class AWCSearchResultsContext(val registry:AWCSearchResults,val root:Boolean,val self:Any?=null)
/** A result row reports its focus to the search (AWCComponent). */
internal fun Modifier.awcSearchResultFocus(ctx:AWCSearchResultsContext?):Modifier = ctx?.self?.let { id->
    this.onFocusChanged { f-> if(f.hasFocus) ctx.registry.focusedItem=id else if(ctx.registry.focusedItem===id) ctx.registry.focusedItem=null } } ?: this
internal val LocalAWCSearchResults=staticCompositionLocalOf<AWCSearchResultsContext?> { null }
/** Called by AWCComponent: a component rendered in a search's results slot registers as a root and/or result row; returns
 *  the context for its own descendants (no longer roots). */
@Composable internal fun awcSearchResultMembership(tag:String,p:Props):AWCSearchResultsContext? {
    val ctx=LocalAWCSearchResults.current ?: return null
    val id=remember { Any() }
    val item=tag=="md-list-item" || p.str("role") in setOf("option","menuitem") || p.containsKey("dataSearchResult") || p.containsKey("data-search-result") || tag=="li"
    DisposableEffect(ctx.registry,id,item,ctx.root) {
        if(ctx.root) ctx.registry.roots.add(id);if(item) ctx.registry.items.add(id)
        onDispose { ctx.registry.roots.remove(id);ctx.registry.items.remove(id) }
    }
    return ctx.copy(root=false,self=if(item) id else null)
}

// ── Model ──────────────────────────────────────────────────────────────────────────────────────────────────────────

internal data class SearchModel(val variant:String,val layout:String,val trigger:String?,val triggerIcon:String,val triggerFor:String,val fullWidth:Boolean,
    val placeholder:String,val disabled:Boolean,val elevation:Int,val leadingIcon:String,val openLeadingIcon:String?,val showClearButton:Boolean,
    val voiceSearch:Boolean,val escapeCloses:Boolean,val dismissOnOutsideClick:Boolean,val maxBlockSize:String,val inputAriaLabel:String,
    val initialFocus:String,val announceResults:Boolean,val resultsLabel:String,val noResultsLabel:String,val loadingLabel:String,val debounce:Double,
    val throttle:Double,val density:Double?,val hidden:Boolean,val id:String,val lang:String) {
    val fullScreen get()=layout=="full-screen"
    /** Explicit `trigger` wins; full-screen opens from the icon button, docked keeps the bar; an external opener owns the resting affordance. */
    val effectiveTrigger get()=if(triggerFor.isNotEmpty()) "icon" else trigger ?: if(fullScreen) "icon" else "bar"
    val usesIconTrigger get()=effectiveTrigger=="icon"
    val openGlyph get()=openLeadingIcon ?: if(variant=="contained") "chevron_left" else "arrow_back"
    val effectiveLabel get()=inputAriaLabel.ifEmpty { placeholder.ifEmpty { "Search" } }
    companion object {
        fun of(p:Props):SearchModel {
            fun s(k:String,d:String)=(p[k] as? String) ?: p[k]?.takeIf { it !is Boolean }?.toString() ?: d
            fun b(k:String,d:Boolean)=if(p.containsKey(k)) p.bool(k,d) else d
            fun n(k:String)=(p[k] as? Number)?.toDouble() ?: (p[k] as? String)?.trim()?.toDoubleOrNull()
            val trigger=(p["trigger"] as? String)?.takeIf { it=="bar" || it=="icon" }
            val init=s("initialFocus","auto").let { if(it=="input" || it=="leading") it else "auto" }
            return SearchModel(if(s("variant","contained")=="divided") "divided" else "contained",if(s("layout","full-screen")=="docked") "docked" else "full-screen",
                trigger,s("triggerIcon","search"),s("triggerFor",""),b("fullWidth",false),s("placeholder","Search"),b("disabled",false),
                (n("elevation") ?: 0.0).roundToInt().coerceIn(0,5),s("leadingIcon","search"),(p["openLeadingIcon"] as? String)?.takeIf { it.isNotEmpty() },
                b("showClearButton",true),b("voiceSearch",false),b("escapeCloses",true),b("dismissOnOutsideClick",true),s("maxBlockSize",""),
                s("inputAriaLabel",""),init,b("announceResults",true),s("resultsLabel","{count} results available"),s("noResultsLabel","No results available"),
                s("loadingLabel","Searching"),max(0.0,n("debounce") ?: 0.0),max(0.0,n("throttle") ?: 0.0),n("density")?.takeIf { it in listOf(0.0,-1.0,-2.0,-3.0,-4.0) },
                b("hidden",false),s("id",""),s("lang",""))
        }
    }
}

// ── Runtime ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Focus of one of the search's own icon buttons (leading back, clear, voice, trigger). */
internal class SearchButtonFocus {
    val requester=FocusRequester()
    var focused by mutableStateOf(false)
    var ring by mutableStateOf(false)
    var pointer=false
    fun focus(visible:Boolean):Boolean=runCatching { ring=visible;pointer=!visible;requester.requestFocus();true }.getOrDefault(false)
}

internal class SearchRuntime {
    var value by mutableStateOf("")
    var field by mutableStateOf(TextFieldValue(""))
    var open by mutableStateOf(false)
    /** Bar expansion and the icon morph: lags `open` on close so the panel fades first. */
    var barExpanded by mutableStateOf(false)
    /** Results panel reveal: follows `open` at once on close (full-screen reveals one frame after the overlay commits). */
    var panelVisible by mutableStateOf(false)
    var focused by mutableStateOf(false)
    var showFocusRing by mutableStateOf(false)
    var listening by mutableStateOf(false)
    var loadingMounted by mutableStateOf(false)
    var loadingIn by mutableStateOf(false)
    var hoverBar by mutableStateOf(false)
    var pressedBar by mutableStateOf(false)
    var hoverLeading by mutableStateOf(false)
    var pressedLeading by mutableStateOf(false)
    var hoverClear by mutableStateOf(false)
    var hoverVoice by mutableStateOf(false)
    var hostHasFocus by mutableStateOf(false)
    var hasLeadingSlot=false
    var started=false
    var valueOnFocus=""
    var keyboardModality=false
    var lastEmittedSearch:String?=null
    var pendingSearch:String?=null
    val handler=Handler(Looper.getMainLooper())
    var debounceTask:Runnable?=null
    var maxWaitTask:Runnable?=null
    var morphTask:Runnable?=null
    var closeRevision=0
    val closedWaiters=mutableListOf<()->Unit>()
    val input=FocusRequester()
    val results=FocusRequester()
    val leading=SearchButtonFocus();val clear=SearchButtonFocus();val voice=SearchButtonFocus();val trigger=SearchButtonFocus()
    var resultsHasFocus=false
    var hostBounds:Rect?=null
    var panelBounds:Rect?=null
    /** Focus was in the search when it opened: closing returns it to the resting target. */
    var focusedAtOpen=false
    /** Focus was inside the full-screen view when it closed: it returns to the trigger when the close completes. */
    var carryAtClose=false
    var requestOpen:(Boolean)->Unit={}
    var focusInput:()->Unit={}
    var startVoice:()->Unit={}
    var stopVoice:()->Unit={}
    var announced=""
    var speech:android.speech.SpeechRecognizer?=null
    /** The composition's scope: timers run as coroutines (delay follows the composition's clock — the test clock in parity tests). */
    var scope:kotlinx.coroutines.CoroutineScope?=null
    private val jobs=HashMap<Runnable,kotlinx.coroutines.Job>()
    var inputDown=false
    /** A press started on an icon button (leading / clear / voice / trailing slot): not a click on the bar. */
    var iconDown=false
    /** Initial-focus attempts (parity debugging). */
    val focusLog=mutableListOf<String>()
    fun later(ms:Double,r:Runnable) { val s=scope
        if(s==null) { handler.postDelayed(r,max(0.0,ms).toLong());return }
        jobs.remove(r)?.cancel()
        jobs[r]=s.launch { if(ms>0) kotlinx.coroutines.delay(ms.toLong()) else kotlinx.coroutines.yield();jobs.remove(r);runCatching { r.run() } } }
    fun cancel(r:Runnable?) { if(r==null) return;jobs.remove(r)?.cancel();handler.removeCallbacks(r) }
    fun cancelTimers() { cancel(debounceTask);cancel(maxWaitTask);debounceTask=null;maxWaitTask=null }
    fun settleClosed() { val w=closedWaiters.toList();closedWaiters.clear();w.forEach { it() } }
}

private val SearchRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium))

@Composable private fun SearchGlyph(name:String,size:Double,color:Color,modifier:Modifier=Modifier) {
    val family=remember { FontFamily(Font(R.font.awc_material_symbols,FontWeight.Normal,variationSettings=FontVariation.Settings(FontVariation.Setting("FILL",0f),FontVariation.Setting("opsz",24f)))) }
    val fs=with(LocalDensity.current) { size.dp.toSp() }
    Box(modifier.size(size.dp).clearAndSetSemantics { },contentAlignment=Alignment.Center) {
        androidx.compose.material3.Text(name,Modifier.wrapContentSize(unbounded=true),color=color,fontFamily=family,fontSize=fs,lineHeight=fs,
            style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"))
    }
}

/** The search's corner shape: equal top corners and equal bottom corners (the divided docked card splits them). */
internal data class SearchShape(val top:Double,val bottom:Double) {
    val shape get()=RoundedCornerShape(topStart=top.dp,topEnd=top.dp,bottomEnd=bottom.dp,bottomStart=bottom.dp)
    val corners get()=AWCCornerShape(AWCCornerRadius(AWCCornerLength(top),AWCCornerLength(top)),AWCCornerRadius(AWCCornerLength(top),AWCCornerLength(top)),
        AWCCornerRadius(AWCCornerLength(bottom),AWCCornerLength(bottom)),AWCCornerRadius(AWCCornerLength(bottom),AWCCornerLength(bottom)))
}

/** md-search's icon buttons: a circle with the hover layer, keyboard focus (Enter / Space activate), the inset focus ring. */
@Composable private fun SearchIconButton(label:String,glyph:String?,box:Double,glyphSize:Double,color:Color,layer:Color,layerOpacity:Double,ring:Color,ringWidth:Double,
    disabled:Boolean,pressed:Boolean?,focus:SearchButtonFocus,onHover:(Boolean)->Unit,onKey:(String,Boolean)->Boolean,action:()->Unit,
    modifier:Modifier=Modifier,pulse:Color?=null,passive:Boolean=false,content:(@Composable ()->Unit)?=null) {
    val act by rememberUpdatedState(action);val hov by rememberUpdatedState(onHover);val key by rememberUpdatedState(onKey)
    // Leaving the composition while focused (the clear button once the value is cleared): no longer the focused control.
    DisposableEffect(focus) { onDispose { focus.focused=false;focus.ring=false;focus.pointer=false } }
    Box(modifier.size(box.dp)
        .focusRequester(focus.requester)
        .onFocusChanged { f-> if(f.isFocused!=focus.focused) { focus.focused=f.isFocused;if(f.isFocused && !focus.pointer) focus.ring=true;if(!f.isFocused) focus.pointer=false } }
        .focusProperties { canFocus=!disabled }
        .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) false else { focus.ring=true
            when(e.key) { Key.Enter,Key.NumPadEnter,Key.Spacebar -> { if(!disabled) act();true }
                else -> searchKeyName(e)?.let { key(it,e.isShiftPressed) } ?: false } } }
        .focusTarget()
        .then(if(passive) Modifier else Modifier.pointerInput(disabled) {
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial)
                if(!disabled) focus.focus(false)
                val up=waitForUpOrCancellation()
                if(up!=null && !disabled && up.position.x in 0f..size.width.toFloat() && up.position.y in 0f..size.height.toFloat()) act()
            }
        })
        .pointerInput(Unit) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
            when(e.type) { PointerEventType.Enter -> hov(true);PointerEventType.Exit -> hov(false) } } } }
        .semantics { role=Role.Button;contentDescription=label;if(disabled) disabled();if(pressed!=null) selected=pressed;onClick { if(!disabled) act();true } },
        contentAlignment=Alignment.Center) {
        Box(Modifier.matchParentSize().clip(CircleShape).background(layer.copy(alpha=(layer.alpha*layerOpacity).toFloat().coerceIn(0f,1f))))
        if(pulse!=null) SearchPulse(pulse)
        if(glyph!=null) SearchGlyph(glyph,glyphSize,color) else content?.invoke()
        if(focus.focused && focus.ring && !disabled) Box(Modifier.matchParentSize().border(ringWidth.dp,ring,CircleShape))
    }
}

/** The listening mic's pulse (md-search-voice-pulse: 1.4 s, scale .82 ↔ 1.12, opacity .55 ↔ .2, standard easing). */
@Composable private fun SearchPulse(color:Color) {
    var t by remember { mutableDoubleStateOf(0.0) }
    LaunchedEffect(Unit) { val start=androidx.compose.runtime.withFrameMillis { it };while(isActive) { val ft=androidx.compose.runtime.withFrameMillis { it };t=(ft-start)/1000.0 } }
    val phase=(t%1.4)/1.4;val half=if(phase<0.5) phase*2 else (1-phase)*2;val e=accordionCubicBezier(half,listOf(0.2,0.0,0.0,1.0))
    Box(Modifier.fillMaxSize().graphicsLayer { scaleX=(0.82+0.30*e).toFloat();scaleY=scaleX;alpha=(0.55-0.35*e).toFloat() }.clip(CircleShape).background(color.copy(alpha=0.16f)))
}

internal fun searchKeyName(e:KeyEvent):String?=when(e.key) {
    Key.Escape -> "Escape";Key.DirectionDown -> "ArrowDown";Key.DirectionUp -> "ArrowUp";Key.Tab -> "Tab";Key.Enter,Key.NumPadEnter -> "Enter";else -> null }

/** Window-level touch observer (Chrome's capture mousedown for the outside-press dismissal): reports every ACTION_DOWN. */
@Composable private fun SearchWindowPresses(active:Boolean,handler:(Offset)->Unit) {
    val view=LocalView.current;val latest=rememberUpdatedState(handler)
    DisposableEffect(view,active) {
        if(!active) return@DisposableEffect onDispose { }
        val window=searchWindow(view) ?: return@DisposableEffect onDispose { }
        val delegate=window.callback
        val cb=object:Window.Callback by delegate {
            override fun dispatchTouchEvent(event:MotionEvent):Boolean {
                if(event.actionMasked==MotionEvent.ACTION_DOWN) { val loc=IntArray(2);view.getLocationInWindow(loc);latest.value(Offset(event.x-loc[0],event.y-loc[1])) }
                return delegate.dispatchTouchEvent(event)
            }
        }
        window.callback=cb
        onDispose { if(window.callback===cb) window.callback=delegate }
    }
}
private fun searchWindow(view:View):Window? {
    var parent=view.parent;while(parent!=null) { if(parent is DialogWindowProvider) return parent.window;parent=parent.parent }
    var c:android.content.Context?=view.context
    while(c!=null) { if(c is android.app.Activity) return c.window;c=(c as? android.content.ContextWrapper)?.baseContext?.takeUnless { it===c } }
    return null
}

/** A slot whose authored content may be absent: reports whether it laid out anything. */
@Composable private fun SearchSlot(slot:Slot?,name:String,onPresence:(Boolean)->Unit,modifier:Modifier=Modifier) {
    if(slot==null) { SideEffect { onPresence(false) };return }
    Layout(content={ slot(name) },modifier=modifier) { ms,c-> val ps=ms.map { it.measure(c.copy(minWidth=0,minHeight=0)) }
        val w=ps.maxOfOrNull { it.width } ?: 0;val h=ps.maxOfOrNull { it.height } ?: 0
        onPresence(w>0 || h>0)
        layout(w,h) { ps.forEach { it.place(0,(h-it.height)/2) } } }
}

private fun searchMs(tokens:Map<String,String>,name:String,f:Double)=tokens[name]?.trim()?.let { if(it.endsWith("ms")) it.dropLast(2).toDoubleOrNull() else if(it.endsWith("s")) it.dropLast(1).toDoubleOrNull()?.times(1000) else null } ?: f

/** FieldTrack with Chrome's start: a transition starts at the first frame after the change (the frame clock is idle, and its
 *  last time stale, while nothing runs). */
internal class SearchTrack(initial:Double) {
    private var from=initial;var to=initial;private set;private var start=Double.NaN;private var duration=0.0;private var curve=listOf(0.0,0.0,1.0,1.0)
    private var reversingStart=initial;private var shortening=1.0
    /** How far before the first tick the transition began (a change made on the frame that the clock had not ticked yet). */
    private var lead=0.0
    fun tick(ft:Double) { if(start.isNaN() && duration>0) start=ft-lead }
    private fun progress(now:Double):Double { if(duration<=0) return 1.0;if(start.isNaN()) return 0.0;if(now.isNaN()) return 1.0
        return ((now-start)/duration).coerceIn(0.0,1.0).let { if(it<=0.0) 0.0 else if(it>=1.0) 1.0 else accordionCubicBezier(it,curve) } }
    fun value(now:Double)=from+(to-from)*progress(now)
    fun running(now:Double)=duration>0 && (start.isNaN() || now.isNaN() || now<start+duration)
    fun snap(v:Double) { from=v;to=v;duration=0.0;start=Double.NaN;reversingStart=v;shortening=1.0;lead=0.0 }
    fun set(target:Double,now:Double,dur:Double,c:List<Double>,lead:Double=0.0) {
        if(target==to) return
        this.lead=lead
        val cur=value(now);val wasRunning=running(now)
        if(dur<=0 || cur==target) { snap(target);return }
        if(wasRunning && reversingStart==target) { val f=kotlin.math.abs(progress(now)*shortening+1-shortening).coerceIn(0.0,1.0)
            reversingStart=to;from=cur;to=target;start=Double.NaN;duration=dur*f;curve=c;shortening=f
        } else { reversingStart=cur;from=cur;to=target;start=Double.NaN;duration=dur;curve=c;shortening=1.0 }
    }
}

// ── Renderer ───────────────────────────────────────────────────────────────────────────────────────────────────────

@Composable
internal fun NativeSearch(p:Props,onEvent:EventSink,slot:Slot?) {
    val m=SearchModel.of(p)
    if(m.hidden) return
    val rt=remember { SearchRuntime() }
    rt.scope=rememberCoroutineScope()
    val tokens=LocalAWCThemeTokens.current
    val a=LocalAWCSearchAppearance.current.resolve(m.id);val pa=LocalAWCSearchParts.current.resolve(m.id)
    val controller=LocalAWCSearchControllers.current.let { it[m.id] ?: it[""] }
    val scale=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current)
    val reduced=LocalAWCSearchReducedMotion.current ?: !android.animation.ValueAnimator.areAnimatorsEnabled()
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val session=LocalAWCModalSession.current
    val owner=remember { AWCModalOwner("search#"+java.util.UUID.randomUUID().toString()) }
    val inspection=LocalAWCInspection.current
    val values=remember { mutableMapOf<String,Map<String,Any?>>() };val partOwners=remember { mutableMapOf<String,Any>() }
    val inspector=LocalAWCSearchInspector.current
    val focusManager=LocalFocusManager.current
    val context=androidx.compose.ui.platform.LocalContext.current
    val emitNow by rememberUpdatedState(onEvent)
    fun emit(name:String,detail:AWCValue) = emitNow(name,detail)
    val loading=p.bool("loading")
    val disabled=m.disabled
    val results=remember { AWCSearchResults() }

    // Tokens (md-search.css :host).
    fun tok(name:String,f:String)=switchColorHex(tokens["--md-sys-color-$name"]) ?: f
    fun col(hex:String)=awcColor(hex,Color.Transparent)
    fun alphaHex(hex:String,al:Double):String { val c=col(hex);return searchShadowHex(c.copy(alpha=(c.alpha*al).toFloat().coerceIn(0f,1f))) }
    val onSurface=tok("on-surface","#1D1B20");val onSurfaceVariant=tok("on-surface-variant","#49454F")
    val disabledContent=alphaHex(onSurface,0.38)
    val containerColor=a.containerColor ?: tok("surface-container-high","#ECE6F0")
    val inputColor=if(disabled) disabledContent else a.inputColor ?: onSurface
    val placeholderColor=if(disabled) disabledContent else a.placeholderColor ?: onSurfaceVariant
    val leadingIconColor=if(disabled) disabledContent else a.leadingIconColor ?: onSurface
    val trailingIconColor=if(disabled) disabledContent else a.trailingIconColor ?: a.iconColor ?: onSurfaceVariant
    val loadingColor=a.loadingColor ?: tok("primary","#6750A4")
    val stateLayerColor=a.stateLayerColor ?: onSurface
    val focusColor=a.focusIndicatorColor ?: tok("secondary","#625B71")
    val barFullscreenColor=a.barFullscreenColor ?: tok("surface-container-low","#F7F2FA")
    val fullscreenResultsColor=a.fullscreenResultsColor ?: tok("surface-container-low","#F7F2FA")
    val dividerColor=a.dividerColor ?: tok("outline","#79747E")
    val emptyColor=a.emptyColor ?: onSurfaceVariant
    val hoverOpacity=a.hoverStateLayerOpacity ?: tokens["--md-sys-state-hover-state-layer-opacity"]?.trim()?.toDoubleOrNull() ?: 0.08
    val pressedOpacity=a.pressedStateLayerOpacity ?: 0.1
    val containerHeight=a.containerHeight ?: max(40.0,56+scale*4)
    val dividedFullscreenBarHeight=a.dividedFullscreenBarHeight ?: max(48.0,72+scale*4)
    val iconButton=a.iconButtonSize ?: max(32.0,48+scale*4)
    val iconSize=a.iconSize ?: max(18.0,24+scale)
    val leadingPad=a.leadingPaddingInline ?: 4.0;val trailingPad=a.trailingPaddingInline ?: 8.0
    val leadingGap=a.leadingIconLabelGap ?: 4.0;val trailingGap=a.trailingIconLabelGap ?: 4.0
    val padInline=a.containerPaddingInline ?: 0.0;val padInlineFocused=a.containerPaddingInlineFocused ?: padInline
    val minInline=a.containerMinInlineSize ?: 360.0;val maxInline=a.containerMaxInlineSize ?: 720.0
    // Full-screen and full-width zero both insets (the hooks included), as the source's :host rules do.
    val zeroInsets=m.fullScreen || m.fullWidth
    val expandInset=if(zeroInsets) 0.0 else a.expandInset ?: 24.0
    val expandFocusedInset=if(zeroInsets) 0.0 else a.expandFocusedInset ?: 12.0
    val focusOffset=a.focusIndicatorOffset ?: 2.0;val focusThickness=a.focusIndicatorThickness ?: 3.0
    val defaultPanelOffset=focusOffset+focusThickness+3
    val panelOffset=if(m.variant=="divided") 0.0 else if(m.layout=="docked") a.containedDockedPanelOffset ?: defaultPanelOffset else a.panelOffset ?: defaultPanelOffset
    val containerShape=a.containerShape ?: tokens["--md-sys-shape-corner-full"]?.replace("px","")?.trim()?.toDoubleOrNull() ?: 9999.0
    val restingCorner=min(containerShape,containerHeight/2)
    val dockedPanelShape=a.dockedPanelShape ?: tokens["--md-sys-shape-corner-large"]?.replace("px","")?.trim()?.toDoubleOrNull() ?: 16.0
    val dividerThickness=a.dividerThickness ?: 1.0
    val viewportW=session?.viewportWidth?.takeIf { it>0 } ?: 1200.0;val viewportH=session?.viewportHeight?.takeIf { it>0 } ?: 800.0
    val maxBlockProp=m.maxBlockSize.trim().let { raw-> when { raw.endsWith("px") -> raw.dropLast(2).trim().toDoubleOrNull()
        raw.endsWith("dvh") -> raw.dropLast(3).trim().toDoubleOrNull()?.let { it/100*viewportH }; raw.endsWith("vh") -> raw.dropLast(2).trim().toDoubleOrNull()?.let { it/100*viewportH }
        else -> raw.toDoubleOrNull() } }
    val maxBlockSize=maxBlockProp ?: a.maxBlockSize
    val panelMax=maxBlockSize ?: a.panelMaxBlockSize ?: 250.0;val panelMin=a.panelMinBlockSize ?: 0.0
    val fullscreenBarHeight=if(m.variant=="divided") dividedFullscreenBarHeight else containerHeight
    val fullscreenOffsetTop=if(m.variant=="divided") 0.0 else a.fullscreenBarOffsetBlockStart ?: 16.0
    val fullscreenOffsetInline=if(m.variant=="divided") 0.0 else a.fullscreenBarOffsetInline ?: 8.0
    val fullscreenGap=a.fullscreenBarPanelGap ?: if(m.variant=="divided") 0.0 else defaultPanelOffset
    val panelPaddingTop=a.panelPaddingBlockStart ?: 0.0
    val emptyPadBlock=a.emptyPaddingBlock ?: 24.0;val emptyPadInline=a.emptyPaddingInline ?: 16.0
    val inputFont=a.inputFontSize ?: max(13.0,16+scale*0.5);val inputLine=a.inputLineHeight ?: 24.0
    val inputTracking=a.inputLetterSpacing ?: 0.5;val inputWeight=a.inputFontWeight ?: 400.0
    val avatarSize=a.avatarSize ?: 40.0
    fun dur(name:String,f:Double)=if(reduced) 0.0 else searchMs(tokens,name,f)
    fun ease(name:String,f:List<Double>)=accordionCubicBezierCurve(tokens[name]) ?: f
    val motion=(if(reduced) 0.0 else a.panelMotionDuration ?: dur("--md-sys-motion-duration-medium2",250.0)) to ease("--md-sys-motion-easing-emphasized",listOf(.2,0.0,0.0,1.0))
    val expandMotion=(if(reduced) 0.0 else a.expandDuration ?: dur("--md-sys-motion-duration-medium4",400.0)) to (a.expandEasing ?: listOf(.34,1.56,.64,1.0))
    val fullscreenExpand=(if(reduced) 0.0 else a.fullscreenExpandDuration ?: dur("--md-sys-motion-duration-medium2",300.0)) to (a.fullscreenExpandEasing ?: ease("--md-sys-motion-easing-standard",listOf(.2,0.0,0.0,1.0)))
    val fullscreenCollapse=(if(reduced) 0.0 else a.fullscreenCollapseDuration ?: dur("--md-sys-motion-duration-medium2",300.0)) to (a.fullscreenCollapseEasing ?: ease("--md-sys-motion-easing-standard",listOf(.2,0.0,0.0,1.0)))
    val morphMotion=dur("--md-sys-motion-duration-medium1",250.0) to ease("--md-sys-motion-easing-emphasized",listOf(.2,0.0,0.0,1.0))
    val layerMotion=dur("--md-sys-motion-duration-short2",100.0) to ease("--md-sys-motion-easing-standard",listOf(.2,0.0,0.0,1.0))

    // Derived state (render helpers of the source).
    val count=results.count
    val showBar=!m.usesIconTrigger || rt.barExpanded
    val fullScreenOpen=m.fullScreen && rt.barExpanded
    val showEmptyState=rt.panelVisible && !loading && count==0 && rt.value.isNotBlank()
    val showResultsChrome=rt.panelVisible && !loading && (count>0 || showEmptyState)
    val panelRevealed=if(m.fullScreen) rt.panelVisible && rt.barExpanded else showResultsChrome
    val panelContent=if(m.fullScreen) panelRevealed else showResultsChrome
    val showClear=m.showClearButton && rt.value.isNotEmpty()
    val voiceSupported=remember { android.speech.SpeechRecognizer.isRecognitionAvailable(context) }
    val showVoice=m.voiceSearch && voiceSupported
    val statusText=if(!m.announceResults || !rt.open) "" else if(loading) m.loadingLabel else if(count>0) m.resultsLabel.replace("{count}",count.toString())
        else if(showEmptyState) "" else if(rt.value.isBlank()) "" else m.noResultsLabel

    // ── Value pipeline (handleInput / scheduleSearch / flushSearch) ──
    fun flushSearch() {
        rt.cancelTimers()
        val v=rt.pendingSearch ?: return
        rt.pendingSearch=null
        val normalized=v.trim()
        if(normalized==rt.lastEmittedSearch) return     // distinctUntilChanged
        rt.lastEmittedSearch=normalized
        emit("mdSearch",mapOf("value" to normalized))
    }
    fun scheduleSearch(v:String) {
        rt.pendingSearch=v
        if(m.debounce==0.0 && m.throttle==0.0) { flushSearch();return }
        rt.cancel(rt.debounceTask)
        val d=Runnable { flushSearch() };rt.debounceTask=d;rt.later(m.debounce,d)
        if(m.throttle>0 && rt.maxWaitTask==null) { val t=Runnable { flushSearch() };rt.maxWaitTask=t;rt.later(m.throttle,t) }
    }
    fun setValue(v:String) { rt.value=v;if(rt.field.text!=v) rt.field=TextFieldValue(v,TextRange(v.length)) }

    // ── Open / close (@Watch('open')) ──
    fun installedFocusTarget():Boolean = if(m.initialFocus=="leading" && !hasLeadingSlot(rt)) rt.leading.focus(true) || focusInputNow(rt) else focusInputNow(rt)
    fun focusInitial(attempts:Int) {
        if(!rt.open) return
        // Full-screen: enter the modal surface first (the scope's trap only lets focus into the top owner's surface group).
        if(m.fullScreen && session!=null && !rt.focused) runCatching { owner.surface.requestFocus() }
        val ok=installedFocusTarget() && (!m.fullScreen || session==null || owner.surfaceHasFocus)
        rt.focusLog+="init a=$attempts ok=$ok f=${rt.focused} surf=${owner.surfaceHasFocus}"
        if(!ok && attempts>0) rt.later(16.0,Runnable { focusInitial(attempts-1) })
    }
    fun restore(target:()->Boolean,attempts:Int) { if(target() || attempts<=0) return;rt.later(16.0,Runnable { restore(target,attempts-1) }) }
    fun stopVoice() { rt.listening=false;rt.speech?.let { runCatching { it.stopListening();it.destroy() } };rt.speech=null }
    fun finishClose() {
        if(m.fullScreen && session!=null && session.index(owner.id)>=0) session.release(owner.id)
        val iconTrigger=m.usesIconTrigger && m.triggerFor.isEmpty()
        val target:()->Boolean=if(iconTrigger) { { rt.trigger.focus(false) && rt.trigger.focused } } else { { focusInputNow(rt) } }
        // Icon trigger: only an instant close that carried focus returns it (Chrome restores before the trigger is back otherwise).
        val back=if(iconTrigger) rt.carryAtClose else rt.focusedAtOpen
        // Full-screen: after the scope's own opener restoration, which release() posts to the next frame.
        if(back) { if(m.fullScreen && session!=null) rt.later(34.0,Runnable { restore(target,8) }) else restore(target,8) }
        rt.carryAtClose=false
        rt.settleClosed()
    }
    fun openSideEffects() {
        rt.focusedAtOpen=rt.focused || rt.trigger.focused || rt.leading.focused || rt.clear.focused || rt.hostHasFocus
        if(m.fullScreen && session!=null) { if(session.index(owner.id)<0) session.acquire(owner) ; rt.later(0.0,Runnable { focusInitial(10) }) }
        else rt.later(0.0,Runnable { if(rt.open) focusInitial(10) })
    }
    fun applyOpen(o:Boolean,emitEvents:Boolean) {
        if(o==rt.open) return
        rt.open=o;rt.closeRevision++
        val revision=rt.closeRevision
        if(o) {
            rt.barExpanded=true
            // The overlay commits first; its surface reveals two frames later (componentDidRender → rAF → the next render).
            if(m.fullScreen) rt.later(33.0,Runnable { if(rt.open) rt.panelVisible=true }) else rt.panelVisible=true
            openSideEffects()
            if(emitEvents) emit("mdOpen",null)
        } else {
            val carry=m.fullScreen && (rt.focused || rt.leading.focused || rt.clear.focused || rt.voice.focused)
            // Icon trigger (Chrome): focus stays on the view's control while the view closes and falls to the window when it
            // leaves; an instant (reduced-motion) close returns it to the trigger instead.
            rt.carryAtClose=carry && m.usesIconTrigger && m.triggerFor.isEmpty()
            rt.panelVisible=false
            stopVoice()
            if(emitEvents) emit("mdClose",null)
            // Panel motion first, then the bar contracts; the completion waits for both stages.
            val first=if(m.fullScreen) fullscreenCollapse.first else motion.first
            // Each stage is the source's finishShellMotion: two frames, then the shell's transitions (none under reduced motion:
            // the bar leaves the open state three frames after the close, the completion two frames later).
            rt.later(max(first+17,50.0),Runnable {
                if(revision!=rt.closeRevision || rt.open) return@Runnable
                rt.barExpanded=false
                if(carry && !m.usesIconTrigger) restore({ focusInputNow(rt) },8)
                if(rt.carryAtClose && first>0) { rt.carryAtClose=false;focusManager.clearFocus(true) }
                val second=if(m.fullScreen) fullscreenCollapse.first else max(expandMotion.first,motion.first)
                rt.later(max(second+17,33.0),Runnable { if(revision==rt.closeRevision && !rt.open) finishClose() })
            })
        }
    }
    fun requestOpen(o:Boolean) { if(o!=rt.open) applyOpen(o,true) }

    fun announce(s:String) { if(s==rt.announced) return;rt.announced=s }

    // ── Keys (the window keydown listener while open) ──
    fun moveResultFocus(delta:Int):Boolean {
        if(count==0 || !panelContent) return false
        if(!rt.resultsHasFocus) { if(delta<0) return false;return runCatching { rt.results.requestFocus();true }.getOrDefault(false) }
        if(delta>0) { val moved=focusManager.moveFocus(FocusDirection.Next);if(moved && !rt.resultsHasFocus) focusManager.moveFocus(FocusDirection.Previous);return true }
        val moved=focusManager.moveFocus(FocusDirection.Previous)
        if(!moved || !rt.resultsHasFocus) focusInputNow(rt)
        return true
    }
    fun windowKey(key:String,shift:Boolean):Boolean {
        if(!rt.open) return false
        rt.keyboardModality=true
        return when(key) {
            "Escape" -> if(m.escapeCloses) { requestOpen(false);true } else false
            "ArrowDown","ArrowUp" -> moveResultFocus(if(key=="ArrowDown") 1 else -1)
            "Tab" -> if(fullScreenOpen && session!=null) session.tab(shift) else false
            else -> false
        }
    }
    fun inputKey(key:String,shift:Boolean):Boolean {
        if(disabled || rt.field.composition!=null) return false
        if(!rt.open) { if(key=="Enter") { requestOpen(true);return true };return false }
        return when(key) {
            "Enter" -> { rt.pendingSearch=rt.value;flushSearch();emit("mdSubmit",mapOf("value" to rt.value));true }
            "Escape","ArrowDown","ArrowUp","Tab" -> windowKey(key,shift)
            else -> false
        }
    }

    // ── Pointer ──
    fun barClick() { if(disabled) return;rt.keyboardModality=false;if(!rt.open) requestOpen(true)
        // Full-screen: the view's own input takes focus (focusInitial); the docked bar it replaces must not.
        if(!(m.fullScreen && session!=null)) rt.later(0.0,Runnable { focusInputNow(rt) }) }
    fun leadingClick() { if(disabled || !rt.open) return;emit("mdLeadingIconClick",mapOf("value" to rt.value,"open" to rt.open));requestOpen(false) }
    fun clearClick() {
        if(disabled) return
        // Chrome: the press moves focus to the clear button first, so the input's blur reports its pending change.
        if(rt.focused && rt.value!=rt.valueOnFocus) emit("mdChange",mapOf("value" to rt.value))
        setValue("");focusInputNow(rt);rt.valueOnFocus=""
        emit("mdInput",mapOf("value" to ""))
        rt.pendingSearch="";flushSearch()          // clearing drops results at once: flush past any pending debounce
        emit("mdClear",null)
    }

    // ── Voice (android.speech; the source streams the transcript into the input) ──
    fun voiceResult(raw:String,final:Boolean) {
        val transcript=raw.trimStart()
        setValue(transcript)
        if(!rt.open) requestOpen(true)
        emit("mdInput",mapOf("value" to transcript));scheduleSearch(transcript)
        emit("mdVoice",mapOf("value" to transcript,"final" to final))
        if(final) { rt.pendingSearch=transcript;flushSearch();stopVoice() }
    }
    fun startVoice() {
        if(!showVoice || disabled || rt.listening) return
        if(!rt.open) requestOpen(true)
        focusInputNow(rt)
        val rec=runCatching { android.speech.SpeechRecognizer.createSpeechRecognizer(context) }.getOrNull() ?: return
        rec.setRecognitionListener(object:android.speech.RecognitionListener {
            override fun onPartialResults(b:android.os.Bundle?) { if(rt.speech!==rec) return
                b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { voiceResult(it,false) } }
            override fun onResults(b:android.os.Bundle?) { if(rt.speech!==rec) return
                voiceResult(b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: rt.value,true) }
            override fun onError(error:Int) { if(rt.speech===rec) stopVoice() }
            override fun onReadyForSpeech(p:android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v:Float) {}
            override fun onBufferReceived(b:ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t:Int,p:android.os.Bundle?) {}
        })
        rt.speech=rec;rt.listening=true
        rec.startListening(android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL,android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS,true).apply { if(m.lang.isNotEmpty()) putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE,m.lang) })
    }

    // ── Lifecycle ──
    if(!rt.started) {
        rt.started=true
        val v=p["value"] as? String ?: ""
        rt.value=v;rt.field=TextFieldValue(v,TextRange(v.length))
        rt.lastEmittedSearch=v.trim()                 // a programmatic initial value counts as already searched
        rt.loadingMounted=loading;rt.loadingIn=loading
        val o=p.bool("open");rt.open=o;rt.barExpanded=o;rt.panelVisible=o
    }
    SideEffect {
        controller?.runtime=rt
        rt.requestOpen={ requestOpen(it) };rt.focusInput={ focusInputNow(rt) };rt.startVoice={ startVoice() };rt.stopVoice={ stopVoice() }
        owner.escape={ if(rt.open && m.escapeCloses) { requestOpen(false);true } else false }
        owner.focusContainer={ focusInputNow(rt) }
    }
    DisposableEffect(Unit) {
        if(rt.open) openSideEffects()
        onDispose { rt.cancelTimers();stopVoice();if(session!=null && session.index(owner.id)>=0) session.release(owner.id);rt.settleClosed()
            if(controller?.runtime===rt) controller.runtime=null }
    }
    LaunchedEffect(p["value"]) { val v=p["value"] as? String ?: "";if(v!=rt.value) setValue(v) }
    LaunchedEffect(p["open"]) { val o=p.bool("open");if(o!=rt.open) applyOpen(o,true) }
    LaunchedEffect(loading) {
        rt.cancel(rt.morphTask);rt.morphTask=null
        if(loading) { rt.loadingMounted=true;withFrameMillisOnce();if(p.bool("loading")) rt.loadingIn=true }
        else { rt.loadingIn=false;val r=Runnable { rt.loadingMounted=false };rt.morphTask=r;rt.later(300.0,r) }
    }
    LaunchedEffect(statusText) { announce(statusText) }

    // ── Motion tracks (CSS transitions on the frame clock) ──
    val frame=remember { mutableDoubleStateOf(-1.0) }
    val now=frame.doubleValue.let { if(it<0) Double.NaN else it }
    val insetT=remember { SearchTrack(if(rt.open) 1.0 else 0.0) };val iconT=remember { SearchTrack(if(rt.open) 1.0 else 0.0) }
    val panelT=remember { SearchTrack(if(rt.open && panelRevealed) 1.0 else 0.0) };val barT=remember { SearchTrack(1.0) }
    val morphT=remember { SearchTrack(if(loading) 1.0 else 0.0) };val layerT=remember { SearchTrack(0.0) }
    val leadLayerT=remember { SearchTrack(0.0) };val clearLayerT=remember { SearchTrack(0.0) };val voiceLayerT=remember { SearchTrack(0.0) }
    fun set(t:SearchTrack,v:Double,mo:Pair<Double,List<Double>>) = t.set(v,now,mo.first,mo.second)
    set(insetT,if(rt.focused || rt.barExpanded) 1.0 else 0.0,expandMotion)
    set(iconT,if(rt.barExpanded) 1.0 else 0.0,motion)
    set(morphT,if(rt.loadingIn) 1.0 else 0.0,morphMotion)
    val reveal=if(panelRevealed) 1.0 else 0.0
    if(m.fullScreen) {
        set(panelT,reveal,if(reveal>0) fullscreenExpand else fullscreenCollapse)
        // The same bar element: visible at rest; `--open` without panel content fades it out from the open's own frame (one frame
        // before the clock's first tick), the content fades it back in. Icon trigger: no bar until the view opens.
        if(m.usesIconTrigger && !rt.barExpanded) barT.snap(0.0)
        else { val shown=(!rt.barExpanded && !m.usesIconTrigger) || panelContent;val mo=if(shown) fullscreenExpand else fullscreenCollapse
            barT.set(if(shown) 1.0 else 0.0,now,mo.first,mo.second,if(shown) 0.0 else 16.67) }
    } else set(panelT,reveal,motion)
    set(layerT,if(rt.showFocusRing) 0.0 else if(rt.pressedBar) pressedOpacity else if(rt.hoverBar) hoverOpacity else 0.0,layerMotion)
    set(leadLayerT,if(rt.pressedLeading) tokens["--md-sys-state-pressed-state-layer-opacity"]?.trim()?.toDoubleOrNull() ?: 0.12 else if(rt.hoverLeading) hoverOpacity else 0.0,layerMotion)
    set(clearLayerT,if(rt.hoverClear) 0.08 else 0.0,layerMotion);set(voiceLayerT,if(rt.hoverVoice) 0.08 else 0.0,layerMotion)
    val tracks=listOf(insetT,iconT,panelT,barT,morphT,layerT,leadLayerT,clearLayerT,voiceLayerT)
    val anyRunning=tracks.any { it.running(now) }
    // One long-lived frame loop woken by a conflated signal (a loop keyed on anyRunning relaunched a frame late).
    val wake=remember { kotlinx.coroutines.channels.Channel<Unit>(kotlinx.coroutines.channels.Channel.CONFLATED) }
    if(anyRunning) SideEffect { wake.trySend(Unit) }
    LaunchedEffect(Unit) { while(true) { wake.receive()
        do { val ft=androidx.compose.runtime.withFrameMillis { it.toDouble() }
            tracks.forEach { it.tick(ft) };frame.doubleValue=ft } while(tracks.any { it.running(ft) }) } }
    val t=frame.doubleValue.let { if(it<0) 0.0 else it }

    // ── Parts ──
    @Composable fun part(name:String,v:Map<String,Any?>,allowZero:Boolean=false):Modifier { values[name]=v
        // A part that leaves the composition (the cleared clear button, the closed view's back button) leaves the report.
        val token=remember { Any() };partOwners[name]=token
        DisposableEffect(name) { onDispose { if(partOwners[name]===token) { partOwners.remove(name);values.remove(name) } } }
        return Modifier.inspectAWCNode(inspection,name,if(name.isEmpty()) "md-search" else name,allowZeroSize=allowZero) }
    fun elevationLayers():List<NativeShadowLayer> = a.containerElevation?.map { it.resolved() }
        ?: if(m.elevation>0) awcElevationTokenLayers(tokens)[m.elevation] else emptyList()
    fun barShape(overlay:Boolean):SearchShape = when {
        overlay -> if(m.variant=="divided") SearchShape(0.0,0.0) else min(containerShape,fullscreenBarHeight/2).let { SearchShape(it,it) }
        m.variant=="divided" && m.layout=="docked" && rt.barExpanded && panelContent -> SearchShape(restingCorner,0.0)
        else -> SearchShape(restingCorner,restingCorner)
    }
    val rootMetrics=mapOf("focusLog" to rt.focusLog.takeLast(4).joinToString("|"),"open" to rt.open,"value" to rt.value,"focused" to rt.focused,"barExpanded" to rt.barExpanded,"panelVisible" to rt.panelVisible,
        "panelContent" to panelContent,"status" to statusText,"count" to count,"listening" to rt.listening,"focusRing" to rt.showFocusRing,"loading" to loading)

    @Composable fun Leading() {
        var authored by remember { mutableStateOf(false) }
        Box(part("leading",mapOf("background" to (pa.leadingBackgroundColor ?: ""))).then(pa.leadingBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier).pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial);rt.iconDown=true } }
            .padding(start=leadingPad.dp,end=leadingGap.dp)) {
            // Slotted content keeps its own size (Chrome: ::slotted(*) is only inline-flex — an md-icon stays 24px) and takes the colour.
            CompositionLocalProvider(LocalAWCButtonSlotSize provides 24.dp,androidx.compose.material3.LocalContentColor provides col(leadingIconColor)) {
            SearchSlot(slot,"leading",{ if(authored!=it) authored=it;rt.hasLeadingSlot=it },Modifier.pointerInput(disabled) {
                awaitEachGesture { awaitFirstDown(requireUnconsumed=false);val up=waitForUpOrCancellation();if(up!=null && !disabled) emit("mdLeadingIconClick",mapOf("value" to rt.value,"open" to rt.open)) } })
            }
            if(!authored) {
                val mo=iconT.value(t);val open=rt.barExpanded
                val leadLayer=pa.leadingStateLayerOpacity ?: (if(open && !disabled) leadLayerT.value(t) else 0.0);val leadLayerColor=pa.leadingStateLayerColor ?: leadingIconColor
                SearchIconButton(if(open) "Close search" else "Search",null,iconButton,iconSize,col(leadingIconColor),col(leadLayerColor),
                    leadLayer,col(focusColor),focusThickness,disabled || !open,null,rt.leading,{ rt.hoverLeading=it },
                    { k,s-> windowKey(k,s) },{ leadingClick() },passive=!open || disabled,modifier=part("leading-button",mapOf("label" to (if(open) "Close search" else "Search"),"morph" to mo,
                        "glyph" to (if(mo>=0.5) m.openGlyph else m.leadingIcon),"color" to leadingIconColor,"focused" to rt.leading.focused,"layer" to leadLayerColor,"layerOpacity" to leadLayer))) {
                    Box(contentAlignment=Alignment.Center) {
                        SearchGlyph(m.leadingIcon,iconSize,col(leadingIconColor),Modifier.graphicsLayer { alpha=(1-mo).toFloat();rotationZ=(-90*mo).toFloat();scaleX=(1-0.4*mo).toFloat();scaleY=scaleX })
                        SearchGlyph(m.openGlyph,iconSize,col(leadingIconColor),Modifier.graphicsLayer { alpha=mo.toFloat();rotationZ=(90*(1-mo)).toFloat()
                            scaleX=((0.6+0.4*mo)*(if(rtl) -1 else 1)).toFloat();scaleY=(0.6+0.4*mo).toFloat() })
                    }
                }
            }
        }
    }

    @Composable fun Input(overlay:Boolean,modifier:Modifier) {
        val style=TextStyle(fontFamily=a.inputFontFamily?.let { FontFamily.Default } ?: SearchRoboto,fontWeight=FontWeight(inputWeight.roundToInt().coerceIn(1,1000)),
            fontSize=inputFont.sp,lineHeight=inputLine.sp,letterSpacing=inputTracking.sp,color=col(pa.inputColor ?: inputColor),
            lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),platformStyle=PlatformTextStyle(includeFontPadding=false))
        BasicTextField(value=rt.field,onValueChange={ next->
                if(disabled) return@BasicTextField
                if(next.composition!=null || next.text==rt.field.text) { rt.field=next;return@BasicTextField }
                rt.field=next;rt.value=next.text
                if(!rt.open) requestOpen(true)              // typing activates the view (focus alone does not)
                emit("mdInput",mapOf("value" to next.text));scheduleSearch(next.text)
            },enabled=!disabled,singleLine=true,textStyle=style,cursorBrush=SolidColor(col(pa.caretColor ?: pa.inputColor ?: inputColor)),
            keyboardOptions=KeyboardOptions(capitalization=KeyboardCapitalization.None,autoCorrectEnabled=false,imeAction=ImeAction.Search),
            keyboardActions=KeyboardActions(onSearch={ inputKey("Enter",false) },onDone={ inputKey("Enter",false) }),
            modifier=modifier.then(part("input",mapOf("value" to rt.value,"placeholder" to m.placeholder,"color" to (pa.inputColor ?: inputColor),"caret" to (pa.caretColor ?: pa.inputColor ?: inputColor),"placeholderColor" to placeholderColor,
                    "fontSize" to inputFont,"lineHeight" to inputLine,"label" to m.effectiveLabel,"expanded" to rt.open,"focused" to rt.focused)))
                .padding(vertical=1.dp).height(inputLine.dp).focusRequester(rt.input)
                // A press on the input is a click on the bar (BasicTextField consumes its up).
                .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial);rt.inputDown=true } }
                .onFocusChanged { f-> if(f.isFocused==rt.focused) return@onFocusChanged
                    if(f.isFocused) { rt.focused=true;rt.showFocusRing=rt.keyboardModality;rt.valueOnFocus=rt.value }
                    else { rt.focused=false;rt.showFocusRing=false;if(rt.value!=rt.valueOnFocus) emit("mdChange",mapOf("value" to rt.value)) } }
                .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    rt.keyboardModality=true
                    // Closed, Space activates the field (opens the view) instead of typing a space.
                    if(e.key==Key.Spacebar && !rt.open && !disabled && rt.field.composition==null) { requestOpen(true);true }
                    else searchKeyName(e)?.let { inputKey(it,e.isShiftPressed) } ?: false }
                .semantics { contentDescription=m.effectiveLabel;stateDescription=if(rt.open) "expanded" else "collapsed"
                    // ax2: the combobox's popup state as actions (md-text-field's combobox role does the same).
                    if(!disabled) { if(rt.open) collapse { requestOpen(false);true } else expand { requestOpen(true);true } } },
            decorationBox={ inner-> Box(contentAlignment=Alignment.CenterStart) {
                if(rt.field.text.isEmpty() && m.placeholder.isNotEmpty()) androidx.compose.material3.Text(m.placeholder,style=style.copy(color=col(placeholderColor)),maxLines=1,overflow=TextOverflow.Clip)
                inner() } })
    }

    @Composable fun Trailing() {
        val mo=morphT.value(t)
        var trailingAuthored by remember { mutableStateOf(false) }
        val before=showClear || rt.loadingMounted
        Row(part("trailing",mapOf("background" to (pa.trailingBackgroundColor ?: "")),allowZero=true).then(pa.trailingBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier).pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial);rt.iconDown=true } }.padding(start=trailingGap.dp,end=trailingPad.dp),verticalAlignment=Alignment.CenterVertically) {
            if(showClear || rt.loadingMounted) Box(Modifier.size(iconButton.dp),contentAlignment=Alignment.Center) {
                if(rt.loadingMounted) Box(Modifier.graphicsLayer { alpha=mo.toFloat();scaleX=(0.6+0.4*mo).toFloat();scaleY=scaleX;rotationZ=(-90*(1-mo)).toFloat() }.then(if(pa.loadingBackgroundColor!=null) Modifier.background(col(pa.loadingBackgroundColor)) else Modifier)
                    .then(part("loading",mapOf("opacity" to mo,"label" to m.loadingLabel,"background" to (pa.loadingBackgroundColor ?: "")))),contentAlignment=Alignment.Center) {
                    var authored by remember { mutableStateOf(false) }
                    SearchSlot(slot,"loader",{ authored=it })
                    if(!authored) AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(color=loadingColor,size=iconButton,shapeSize=iconSize,containerColor=pa.loadingBackgroundColor)) {
                        AWCLoadingIndicatorShapeAppearanceScope(AWCLoadingIndicatorShapeAppearance(color=pa.loadingShapeBackgroundColor)) {
                            AWCComponent("md-loading-indicator",mapOf("label" to m.loadingLabel)) } }
                }
                if(showClear) SearchIconButton("Clear search","close",iconButton,iconSize,col(trailingIconColor),col(trailingIconColor),if(disabled) 0.0 else clearLayerT.value(t),
                    col(focusColor),focusThickness,disabled,null,rt.clear,{ rt.hoverClear=it },{ k,s-> windowKey(k,s) },{ clearClick() },passive=rt.loadingIn,
                    modifier=Modifier.graphicsLayer { alpha=(1-mo).toFloat();scaleX=(1-0.4*mo).toFloat();scaleY=scaleX;rotationZ=(90*mo).toFloat() }
                        .then(part("clear-button",mapOf("opacity" to 1-mo,"label" to "Clear search","color" to trailingIconColor,"focused" to rt.clear.focused,"background" to (pa.clearButtonBackgroundColor ?: ""))))
                        .then(pa.clearButtonBackgroundColor?.let { Modifier.background(col(it),CircleShape) } ?: Modifier))
            }
            if(showVoice) Box(Modifier.padding(start=if(before) 4.dp else 0.dp)) { SearchIconButton(if(rt.listening) "Stop voice search" else "Search by voice","mic",iconButton,iconSize,
                col(if(rt.listening) tok("primary","#6750A4") else trailingIconColor),col(trailingIconColor),if(disabled) 0.0 else voiceLayerT.value(t),col(focusColor),focusThickness,
                disabled,rt.listening,rt.voice,{ rt.hoverVoice=it },{ k,s-> windowKey(k,s) },{ if(!disabled) { if(rt.listening) stopVoice() else startVoice() } },
                pulse=if(rt.listening && !reduced) col(tok("primary","#6750A4")) else null,
                modifier=part("voice-button",mapOf("label" to (if(rt.listening) "Stop voice search" else "Search by voice"),"pressed" to rt.listening,"background" to (pa.voiceButtonBackgroundColor ?: "")))
                    .then(pa.voiceButtonBackgroundColor?.let { Modifier.background(col(it),CircleShape) } ?: Modifier)) }
            AWCAvatarAppearanceScope(AWCAvatarAppearance(size=AWCSkeletonLength(points=avatarSize))) {
                CompositionLocalProvider(LocalAWCButtonSlotSize provides 24.dp,androidx.compose.material3.LocalContentColor provides col(trailingIconColor)) {
                SearchSlot(slot,"trailing",{ if(trailingAuthored!=it) trailingAuthored=it },Modifier.padding(start=if(trailingAuthored && (before || showVoice)) 4.dp else 0.dp).pointerInput(disabled) {
                    awaitEachGesture { awaitFirstDown(requireUnconsumed=false);val up=waitForUpOrCancellation();if(up!=null && !disabled) emit("mdTrailingIconClick",mapOf("value" to rt.value,"open" to rt.open)) } })
                }
            }
        }
    }

    @Composable fun Bar(overlay:Boolean,presented:Double=1.0,modifier:Modifier=Modifier) {
        val shape=barShape(overlay);val height=if(overlay) fullscreenBarHeight else containerHeight
        val fill=pa.barBackgroundColor ?: (if(overlay && m.variant=="divided") barFullscreenColor else containerColor)
        val layerColor=pa.stateLayerColor ?: stateLayerColor
        val ring=rt.showFocusRing && !overlay
        val layers=elevationLayers()+(if(ring) listOf(NativeShadowLayer(0.0,0.0,0.0,focusOffset,col(containerColor),false),NativeShadowLayer(0.0,0.0,0.0,focusOffset+focusThickness,col(focusColor),false)) else emptyList())
        val layer=pa.stateLayerOpacity ?: (if(disabled) 0.0 else layerT.value(t))
        Row(modifier
            .alpha(if(disabled) 0.38f else 1f)
            .accordionShadow(shape.corners,layers,false)
            .clip(shape.shape)
            .background(col(fill))
            // Chrome's stacking: the state layer paints over the bar, under the leading and trailing boxes (z-index 1); a part
            // opacity shows in every state.
            .drawBehind { if(layer>0) drawRect(col(layerColor).copy(alpha=(col(layerColor).alpha*layer).toFloat())) }
            .awcRipple(disabled=disabled,cornerRadius=shape.top.dp,appearance=AWCRippleAppearance(extendInline=max(0.0,expandInset-expandFocusedInset),
                growDuration=expandMotion.first,growEasing="cubic-bezier(${expandMotion.second.joinToString(",")})"))
            .pointerInput(disabled) { awaitEachGesture {
                awaitFirstDown(requireUnconsumed=false);rt.pressedBar=true
                val up=waitForUpOrCancellation();rt.pressedBar=false
                val viaInput=rt.inputDown;rt.inputDown=false;val viaIcon=rt.iconDown;rt.iconDown=false
                if((up!=null || viaInput) && !viaIcon) barClick() } }
            .pointerInput(Unit) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
                when(e.type) { PointerEventType.Enter -> rt.hoverBar=true;PointerEventType.Exit -> rt.hoverBar=false } } } }
            .height(height.dp)
            // barPartBeforePadding: the bar part is the bar's own box (the padding hook insets its content only).
            .then(part("bar",mapOf("background" to fill,"radiusTop" to shape.top,"radiusBottom" to shape.bottom,"focusRing" to ring,"stateLayer" to layer,"stateLayerColor" to layerColor,
                "opacity" to (if(disabled) 0.38 else 1.0),"elevation" to elevationLayers().size,"barOpacity" to presented)))
            .padding(horizontal=(if(rt.focused || rt.barExpanded) padInlineFocused else padInline).dp),
            verticalAlignment=Alignment.CenterVertically) {
            Leading()
            Input(overlay,Modifier.weight(1f))
            Trailing()
        }
    }

    @Composable fun PanelBody(fill:Boolean,maxBody:Double?) {
        Column(if(fill) Modifier.fillMaxSize() else Modifier.fillMaxWidth()) {
            if(m.variant=="divided" && panelRevealed) Box(Modifier.fillMaxWidth().height(dividerThickness.dp).background(col(pa.dividerColor ?: dividerColor)).then(part("divider",mapOf("color" to (pa.dividerColor ?: dividerColor)))))
            if(showEmptyState) androidx.compose.material3.Text(m.noResultsLabel,Modifier.fillMaxWidth().then(part("empty",mapOf("text" to m.noResultsLabel,"color" to (pa.emptyColor ?: emptyColor))))
                    .then(pa.panelBodyBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier).then(part("panel-body",mapOf("background" to (pa.panelBodyBackgroundColor ?: ""))))
                    .padding(vertical=emptyPadBlock.dp,horizontal=emptyPadInline.dp).height(20.dp).semantics { liveRegion=LiveRegionMode.Polite },
                style=TextStyle(fontFamily=SearchRoboto,fontSize=14.sp,lineHeight=20.sp,letterSpacing=0.25.sp,color=col(pa.emptyColor ?: emptyColor),textAlign=TextAlign.Center,
                    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),platformStyle=PlatformTextStyle(includeFontPadding=false)))
            // Slotted lists sit flush on the search surface (transparent list / item containers, no list padding).
            Column((if(fill) Modifier.weight(1f) else Modifier.heightIn(max=(maxBody ?: 1e5).coerceAtLeast(0.0).dp)).fillMaxWidth()
                .then(if(showEmptyState) Modifier.height(0.dp) else Modifier)
                .then(if(showEmptyState) Modifier else Modifier.then(pa.panelBodyBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier).then(part("panel-body",mapOf("background" to (pa.panelBodyBackgroundColor ?: "")),allowZero=true))
                    .then(pa.resultsHostBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier).then(part("results-host",mapOf("background" to (pa.resultsHostBackgroundColor ?: "")),allowZero=true)))
                .verticalScroll(rememberScrollState())
                .focusRequester(rt.results).onFocusChanged { rt.resultsHasFocus=it.hasFocus }.focusGroup()
                .then(pa.resultsViewportBackgroundColor?.let { Modifier.background(col(it)) } ?: Modifier)
                .then(part("results-viewport",mapOf("background" to (pa.resultsViewportBackgroundColor ?: "")),allowZero=true))) {
                AWCListAppearanceScope(AWCListAppearance(containerColor="#00000000",paddingBlock=0.0)) {
                    AWCListItemAppearanceScope(AWCListItemAppearance(containerColor="#00000000")) {
                        CompositionLocalProvider(LocalAWCSearchResults provides AWCSearchResultsContext(results,true)) {
                            // Always composed: the rows register (and decide the empty state) even before the panel is revealed.
                            slot?.invoke("results")   // ax2: the source has no default slot
                        }
                    }
                }
            }
        }
    }

    @Composable fun DockedPanel() {
        val pr=panelT.value(t)
        val corners=if(m.variant=="divided") SearchShape(0.0,restingCorner) else SearchShape(dockedPanelShape,dockedPanelShape)
        val divider=if(m.variant=="divided" && panelRevealed) dividerThickness else 0.0
        // CSS: a min-block-size above the max-block-size wins.
        val maxH=max(panelMin,panelMax)
        Box(Modifier.fillMaxWidth().heightIn(min=panelMin.dp,max=maxH.dp)
            .graphicsLayer { alpha=pr.toFloat();translationY=(-4*(1-pr)*density).toFloat() }
            .clip(corners.shape).background(col(pa.panelBackgroundColor ?: containerColor))
            .onGloballyPositioned { rt.panelBounds=it.boundsInWindow() }
            .then(if(!panelRevealed) Modifier.clearAndSetSemantics { } else Modifier.semantics { paneTitle=m.effectiveLabel;isTraversalGroup=true })
            .then(part("panel",mapOf("opacity" to pr,"background" to (pa.panelBackgroundColor ?: containerColor),"radiusTop" to corners.top,"radiusBottom" to corners.bottom,"revealed" to panelRevealed,"translateY" to -4*(1-pr))))) {
            PanelBody(false,maxH-divider)
        }
    }

    @Composable fun FullScreenView() {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val vw=maxWidth.value.toDouble();val vh=maxHeight.value.toDouble()
            val pr=panelT.value(t);val b=barT.value(t)
            val panelTop=fullscreenOffsetTop+fullscreenBarHeight+fullscreenGap+panelPaddingTop
            val maxH=maxBlockSize ?: vh
            // The bar first: traversal leading → input → clear → results (drawn above the panel).
            Bar(true,b,Modifier.zIndex(1f).offset(x=fullscreenOffsetInline.dp,y=fullscreenOffsetTop.dp).width(max(0.0,vw-2*fullscreenOffsetInline).dp)
                .graphicsLayer { alpha=b.toFloat();translationY=(30*(1-b)*density).toFloat() })
            Box(Modifier.width(vw.dp).height(min(vh,maxH).dp).graphicsLayer { alpha=pr.toFloat();translationY=(30*(1-pr)*density).toFloat() }
                .background(col(pa.panelBackgroundColor ?: fullscreenResultsColor))
                .then(if(!panelRevealed) Modifier.clearAndSetSemantics { } else Modifier.semantics { paneTitle=m.effectiveLabel;isTraversalGroup=true })
                .then(part("panel",mapOf("opacity" to pr,"background" to (pa.panelBackgroundColor ?: fullscreenResultsColor),"revealed" to panelRevealed,"translateY" to 30*(1-pr))))) {
                Box(Modifier.fillMaxSize().padding(top=panelTop.dp)) { PanelBody(true,null) }
            }
        }
    }

    // ── Window routing while open: Escape anywhere (docked: focus owned), outside presses ──
    NativeWindowKeys { e-> if(!rt.open || m.fullScreen || e.action!=android.view.KeyEvent.ACTION_DOWN) false
        else if(e.keyCode==android.view.KeyEvent.KEYCODE_ESCAPE && m.escapeCloses && (rt.hostHasFocus || !rt.focused)) { requestOpen(false);true } else false }
    val anyFocus=rt.focused || rt.hostHasFocus || rt.clear.focused || rt.voice.focused || rt.leading.focused || rt.trigger.focused
    val dismissible=rt.open && m.dismissOnOutsideClick && !(m.fullScreen && session!=null)
    // Chrome: a press outside blurs whatever part of the search had focus; an open docked view also closes.
    SearchWindowPresses(dismissible || anyFocus) { pt->
        val inside=listOfNotNull(rt.hostBounds,rt.panelBounds).any { it.contains(pt) }
        if(!inside) rt.later(0.0,Runnable { if(rt.hostHasFocus || rt.focused || rt.clear.focused || rt.voice.focused || rt.leading.focused || rt.trigger.focused) focusManager.clearFocus(true)
            if(rt.open && m.dismissOnOutsideClick && !(m.fullScreen && session!=null)) requestOpen(false) })
    }

    SideEffect { inspector?.invoke(values.toMap()) }
    val hostModifier=Modifier.onFocusChanged { rt.hostHasFocus=it.hasFocus }
        .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || !rt.open) false else when(e.key) {
            Key.Escape -> windowKey("Escape",false)
            // The source's key capture: ArrowUp on the first result returns to the input (md-list would wrap).
            Key.DirectionUp -> if(rt.resultsHasFocus && results.items.isNotEmpty() && results.focusedItem===results.items.first()) { rt.keyboardModality=true;focusInputNow(rt);true } else false
            else -> false } }
        // In the results md-list moves between its items (roving focus); an ArrowUp it leaves (first item) returns to the input.
        .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || !rt.open || !rt.resultsHasFocus) false else when(e.key) {
            Key.DirectionUp -> { rt.keyboardModality=true;focusInputNow(rt);true }
            Key.DirectionDown -> true
            else -> false } }
        .semantics { if(statusText.isNotEmpty()) { liveRegion=LiveRegionMode.Polite } }
    AWCModalImplicitScope(fullScreenOpen) {
        val entrySession=LocalAWCModalSession.current
        // The entry composes in the scope's layer: it keeps this call site's locals (theme, appearance scopes, slots), as md-dialog does.
        val callerLocals=currentCompositionLocalContext
        // Registered for as long as the search is full-screen; the view renders while expanded (the entry content reads the
        // runtime state itself, so opening paints it in the same frame as the open).
        if(m.fullScreen) AWCModalEntryEffect(entrySession,owner.id,true,1300.0) {
            if(rt.barExpanded) CompositionLocalProvider(callerLocals) { Box(Modifier.fillMaxSize().awcModalSurface(entrySession,owner).then(hostModifier)) { FullScreenView() } }
        }
        when {
            m.usesIconTrigger && !rt.barExpanded -> Box(hostModifier.then(part("",rootMetrics))) {
                if(m.triggerFor.isEmpty()) {
                    var authored by remember { mutableStateOf(false) }
                    SearchSlot(slot,"trigger",{ authored=it },part("trigger",emptyMap(),allowZero=true))
                    if(!authored) SearchIconButton(m.effectiveLabel,m.triggerIcon,iconButton,iconSize,col(if(disabled) disabledContent else a.leadingIconColor ?: onSurface),
                        col(onSurface),0.0,col(focusColor),focusThickness,disabled,null,rt.trigger,{ },{ _,_-> false },{ if(!disabled && !rt.open) requestOpen(true) },
                        modifier=part("trigger-button",mapOf("label" to m.effectiveLabel,"glyph" to m.triggerIcon,"focused" to rt.trigger.focused,"background" to (pa.triggerButtonBackgroundColor ?: "")))
                            .then(pa.triggerButtonBackgroundColor?.let { Modifier.background(col(it),CircleShape) } ?: Modifier))
                }
            }
            fullScreenOpen -> Box(Modifier.size(0.dp).then(part("",rootMetrics,allowZero=true)))
            else -> {
                // hostCentred: a max-inline-size below the available inline size centres the host (:host margin-inline: auto).
                Box(Modifier.fillMaxWidth(),contentAlignment=Alignment.TopCenter) {
                val inset=expandInset+(expandFocusedInset-expandInset)*insetT.value(t)
                    Layout(content={
                        // Full-screen: the same bar element returns from the closed view at opacity 0 and fades in (the bar track).
                        val resting=if(m.fullScreen) barT.value(t) else 1.0
                        Bar(false,resting,Modifier.fillMaxWidth().then(if(resting<1.0) Modifier.graphicsLayer { alpha=resting.toFloat() } else Modifier))
                        if(m.layout=="docked") DockedPanel()
                    },modifier=hostModifier.widthIn(min=minInline.dp,max=maxInline.dp).fillMaxWidth()
                        .onGloballyPositioned { rt.hostBounds=it.boundsInWindow() }.then(part("",rootMetrics))) { ms,c->
                        val w=c.maxWidth.takeIf { it!=Constraints.Infinity } ?: c.minWidth
                        val px={ v:Double-> (v*density).roundToInt() }
                        val barW=max(0,w-2*px(max(0.0,inset)))
                        val bar=ms[0].measure(Constraints.fixed(barW,px(containerHeight)))
                        val panel=ms.getOrNull(1)?.measure(Constraints(minWidth=max(0,w-2*px(expandFocusedInset)),maxWidth=max(0,w-2*px(expandFocusedInset))))
                        layout(w,px(containerHeight)) {
                            bar.placeRelative(px(max(0.0,inset)),0)
                            panel?.placeRelative(px(expandFocusedInset),px(containerHeight+panelOffset))
                        }
                    }
                }
            }
        }
    }
}

private fun focusInputNow(rt:SearchRuntime):Boolean=runCatching { rt.input.requestFocus();rt.focused }.getOrDefault(false)
private fun hasLeadingSlot(rt:SearchRuntime)=rt.hasLeadingSlot
private suspend fun withFrameMillisOnce() { androidx.compose.runtime.withFrameMillis { } }

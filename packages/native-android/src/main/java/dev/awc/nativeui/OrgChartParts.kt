package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/**
 * md-organization-chart's exported `::part()` targets (14), styled with the shared sparse part vocabulary (AWCTablePartStyle).
 * Part rules come from the outer tree, so they win over the hooks and the parts' own state rules. What each part shows:
 * viewport (background-color, border-radius, opacity, padding); tree, group, branch, branch-on-path (background-color,
 * border-radius, opacity); node, node-selected — a selected card takes both, node-selected last (background-color,
 * border-radius, opacity, padding); state-layer (background-color, opacity — it replaces the hover / pressed / selected
 * opacities); avatar, avatar-image (opacity); name, title (color, font-size, font-weight, letter-spacing, opacity); toggle,
 * the md-icon-button host (background-color, border-radius, opacity); empty (color, background-color, border-radius,
 * opacity, padding, font-size, font-weight, letter-spacing).
 */
enum class AWCOrgChartPart(val part: String) {
    VIEWPORT("viewport"), TREE("tree"), GROUP("group"), BRANCH("branch"), BRANCH_ON_PATH("branch-on-path"), NODE("node"), NODE_SELECTED("node-selected"),
    STATE_LAYER("state-layer"), AVATAR("avatar"), AVATAR_IMAGE("avatar-image"), NAME("name"), TITLE("title"), TOGGLE("toggle"), EMPTY("empty");
    companion object { fun of(part: String): AWCOrgChartPart? = entries.firstOrNull { it.part == part } }
}
/** md-organization-chart's name for the shared part vocabulary. */
typealias AWCOrgChartPartAppearance = AWCTablePartStyle

/** The resolved part declarations of one chart. */
@Immutable data class OrgChartParts(val styles: Map<AWCOrgChartPart, AWCTablePartStyle> = emptyMap()) {
    operator fun get(p: AWCOrgChartPart): AWCTablePartStyle = styles[p] ?: AWCTablePartStyle()
    /** A card's declarations: ::part(node), then ::part(node-selected) on a selected card. */
    fun node(selected: Boolean) = if(selected) this[AWCOrgChartPart.NODE].merging(this[AWCOrgChartPart.NODE_SELECTED]) else this[AWCOrgChartPart.NODE]
    /** A branch's declarations: ::part(branch), then ::part(branch-on-path) on the selection path. */
    fun branch(onPath: Boolean) = if(onPath) this[AWCOrgChartPart.BRANCH].merging(this[AWCOrgChartPart.BRANCH_ON_PATH]) else this[AWCOrgChartPart.BRANCH]
    /** Any part opacity around the tree items (branch, branch-on-path, group, tree). */
    val fades: Boolean get() = listOf(AWCOrgChartPart.BRANCH, AWCOrgChartPart.BRANCH_ON_PATH, AWCOrgChartPart.GROUP, AWCOrgChartPart.TREE).any { this[it].opacity != null }
}

internal val LocalAWCOrgChartParts = staticCompositionLocalOf { emptyMap<AWCOrgChartPart, AWCTablePartStyle>() }
internal val LocalAWCOrgChartPartTargets = staticCompositionLocalOf { emptyMap<String, Map<AWCOrgChartPart, AWCTablePartStyle>>() }
/** `::part()` styling for the organization charts inside [content] (`id`: only the chart with that node id). */
@Composable fun AWCOrgChartPartAppearanceScope(styles: Map<AWCOrgChartPart, AWCOrgChartPartAppearance>, id: String? = null, content: @Composable () -> Unit) {
    if(id != null) {
        val t = LocalAWCOrgChartPartTargets.current; val own = (t[id] ?: emptyMap()).toMutableMap()
        for((p, st) in styles) own[p] = (own[p] ?: AWCTablePartStyle()).merging(st)
        CompositionLocalProvider(LocalAWCOrgChartPartTargets provides t + (id to own), content = content)
    } else {
        val all = LocalAWCOrgChartParts.current.toMutableMap(); for((p, st) in styles) all[p] = (all[p] ?: AWCTablePartStyle()).merging(st)
        CompositionLocalProvider(LocalAWCOrgChartParts provides all, content = content)
    }
}
@Composable fun AWCOrgChartPartAppearanceScope(part: AWCOrgChartPart, style: AWCOrgChartPartAppearance, id: String? = null, content: @Composable () -> Unit) =
    AWCOrgChartPartAppearanceScope(mapOf(part to style), id, content)
/** The part declarations of the chart with node id [id] (the shared rules under its own). */
@Composable @ReadOnlyComposable internal fun orgChartParts(id: String): OrgChartParts {
    val out = LocalAWCOrgChartParts.current.toMutableMap()
    LocalAWCOrgChartPartTargets.current[id]?.forEach { (p, st) -> out[p] = (out[p] ?: AWCTablePartStyle()).merging(st) }
    return OrgChartParts(out)
}

/** The bundled Roboto faces by CSS weight (600 and up resolve to the 700 face, 500 to Medium). */
internal val OrgPartRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))
internal fun orgFaceWeight(weight: Double): FontWeight = if(weight >= 600) FontWeight.Bold else if(weight >= 500) FontWeight.Medium else FontWeight.Normal
/** `line-height: normal` of Roboto at [size] (Blink: rounded ascent + rounded descent, no line gap). */
internal fun orgNormalLine(size: Double): Double = Math.round(0.927734375 * size).toDouble() + Math.round(0.244140625 * size).toDouble()

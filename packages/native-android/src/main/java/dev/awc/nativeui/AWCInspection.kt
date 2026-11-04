package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult

/** Native inspection coordinates and box-model measurements are density-independent pixels. */
data class AWCInspectionBounds(val x: Double, val y: Double, val width: Double, val height: Double)
data class AWCInspectionInsets(val top: Double = 0.0, val right: Double = 0.0, val bottom: Double = 0.0, val left: Double = 0.0)
data class AWCInspectionGap(val row: Double, val column: Double)
/** Typography retains Compose's sp units, including when fontScale differs from one. */
data class AWCInspectionTypography(val size: Double, val lineHeight: Double, val weight: Int, val spacing: Double, val family: String)
data class AWCInspectionMetrics(
    val padding: AWCInspectionInsets? = null,
    val margin: AWCInspectionInsets? = null,
    val border: AWCInspectionInsets? = null,
    val gap: AWCInspectionGap? = null,
    val typography: AWCInspectionTypography? = null,
    val display: String? = null,
    val direction: String? = null,
)
data class AWCInspectionNode(val id: String, val name: String, val bounds: AWCInspectionBounds, val parentId: String? = null, val metrics: AWCInspectionMetrics? = null)
data class AWCInspectionSnapshot(val nodes: List<AWCInspectionNode>)

/**
 * Opt-in, UI-thread-only native layout evidence. Snapshot identity changes whenever
 * bounds or applied metrics change, allowing a pixel-capture host to reject stale
 * metadata. No state is collected outside AWCInspectionScope.
 */
class AWCInspectionCollector {
    private data class Entry(val owner: Any, val node: AWCInspectionNode)
    private val entries = linkedMapOf<String, Entry>()
    private var current = AWCInspectionSnapshot(emptyList())

    fun snapshot(): AWCInspectionSnapshot {
        // A graphicsLayer transform can change without layout or placement.
        // Refresh the live coordinates when a host captures its rendered frame.
        entries.values.mapNotNull { it.owner as? InspectionRecord }.forEach { it.publish() }
        return current
    }
    fun clear() { entries.clear(); current = AWCInspectionSnapshot(emptyList()) }
    internal fun record(owner: Any, node: AWCInspectionNode) {
        val prior = entries[node.id]
        if (prior?.owner === owner && prior.node == node) return
        entries[node.id] = Entry(owner, node)
        publish()
    }
    internal fun remove(owner: Any, id: String) {
        if (entries[id]?.owner !== owner) return
        entries.remove(id)
        publish()
    }
    private fun publish() {
        // Subcomposed/caller-authored slots may have no measured wrapper. Do not
        // export orphan descendants or transient partial trees during disposal.
        fun connected(node: AWCInspectionNode): Boolean = node.parentId?.let { parent ->
            entries[parent]?.node?.let(::connected) ?: false
        } ?: true
        val nodes = entries.values.map { it.node }.filter(::connected)
            .sortedWith(compareBy({ it.id.count { char -> char == '.' } }, { it.id }))
        if (current.nodes != nodes) current = AWCInspectionSnapshot(nodes)
    }
}

internal data class AWCInspectionContext(val collector: AWCInspectionCollector, val id: String, val entered: Boolean = false, val parentId: String? = null)
internal val LocalAWCInspection = staticCompositionLocalOf<AWCInspectionContext?> { null }
/** A containing component can export an actual nested icon part under its own
 * source part name without inventing another measured root. */
internal val LocalAWCForwardedIconInspection = staticCompositionLocalOf<Pair<AWCInspectionContext,String>?> { null }

/** Inspect one directly nested AWCComponent; nested components do not reuse its IDs. */
@Composable
fun AWCInspectionScope(collector: AWCInspectionCollector, id: String = "component", content: @Composable () -> Unit) {
    val context = remember(collector, id) { AWCInspectionContext(collector, id) }
    CompositionLocalProvider(LocalAWCInspection provides context, content = content)
}

private class InspectionRecord(
    val context: AWCInspectionContext, val id: String, val name: String, val parentId: String?, val density: Double,
    val allowZeroSize: Boolean,
) {
    var coordinates: LayoutCoordinates? = null
    var metrics: AWCInspectionMetrics? = null
    fun publish() {
        val coordinates = coordinates ?: return
        if (!coordinates.isAttached || !allowZeroSize && (coordinates.size.width <= 0 || coordinates.size.height <= 0)) {
            context.collector.remove(this, id)
            return
        }
        val root = coordinates.findRootCoordinates()
        val bounds = if (allowZeroSize && (coordinates.size.width == 0 || coordinates.size.height == 0)) {
            val position = root.localPositionOf(coordinates, androidx.compose.ui.geometry.Offset.Zero)
            androidx.compose.ui.geometry.Rect(position, androidx.compose.ui.geometry.Size(
                coordinates.size.width.toFloat(), coordinates.size.height.toFloat()))
        } else root.localBoundingBoxOf(coordinates, clipBounds = false)
        context.collector.record(this, AWCInspectionNode(id, name,
            AWCInspectionBounds(bounds.left / density, bounds.top / density, bounds.width / density, bounds.height / density),
            parentId, metrics))
    }
}

@Composable
private fun rememberInspectionRecord(context: AWCInspectionContext?, part: String, name: String, allowZeroSize: Boolean = false): InspectionRecord? {
    if (context == null) return null
    val id = if (part.isEmpty()) context.id else "${context.id}.$part"
    val parentId = if (part.isEmpty()) context.parentId else if (part.contains('.')) "${context.id}.${part.substringBeforeLast('.')}" else context.id
    val density = LocalDensity.current.density.toDouble()
    val record = remember(context.collector, id, name, parentId, density, allowZeroSize) { InspectionRecord(context, id, name, parentId, density, allowZeroSize) }
    DisposableEffect(record) { onDispose { context.collector.remove(record, id) } }
    return record
}

@Composable
internal fun Modifier.inspectAWCNode(context: AWCInspectionContext?, part: String, name: String, metrics: AWCInspectionMetrics? = null,
                                   allowZeroSize: Boolean = false): Modifier {
    val record = rememberInspectionRecord(context, part, name, allowZeroSize) ?: return this
    // A metric can change without requiring remeasurement (e.g. border or direction).
    SideEffect { record.metrics = metrics; record.publish() }
    return onSizeChanged {
        // Empty slots are measured but intentionally never placed by their row,
        // so onGloballyPositioned alone cannot remove their previous bounds.
        if (!allowZeroSize && (it.width <= 0 || it.height <= 0)) {
            record.coordinates = null
            record.context.collector.remove(record, record.id)
        }
    }.onGloballyPositioned { record.coordinates = it; record.metrics = metrics; record.publish() }
}

/** Attach both members to a native Text to report its actual resolved layout style. */
class AWCInspectionTextObserver internal constructor(val modifier: Modifier, val onTextLayout: (TextLayoutResult) -> Unit)

/**
 * Optional instrumentation for caller-provided Text slots. Family is the name of
 * the actual configured font resource, not a web CSS font or a platform guess.
 */
@Composable
fun rememberAWCInspectionText(part: String, name: String = "Text", family: String): AWCInspectionTextObserver {
    val record = rememberInspectionRecord(LocalAWCInspection.current?.takeIf { it.entered }, part, name)
    return if (record == null) remember { AWCInspectionTextObserver(Modifier, {}) }
    else AWCInspectionTextObserver(Modifier.onGloballyPositioned { record.coordinates = it; record.publish() }) { layout ->
        val style = layout.layoutInput.style
        val typography = if (style.fontSize.isSp && style.lineHeight.isSp && style.letterSpacing.isSp && style.fontWeight != null) {
            AWCInspectionTypography(style.fontSize.value.toDouble(), style.lineHeight.value.toDouble(), style.fontWeight!!.weight,
                style.letterSpacing.value.toDouble(), family)
        } else null
        record.metrics = AWCInspectionMetrics(typography = typography, display = "Text",
            direction = if (layout.layoutInput.layoutDirection == androidx.compose.ui.unit.LayoutDirection.Rtl) "rtl" else "ltr")
        record.publish()
    }
}

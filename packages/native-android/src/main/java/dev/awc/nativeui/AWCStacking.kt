package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout

// CSS stacking across containers (gate-7 r3-19).
//
// The source's floating md-accordion (`position: fixed; z-index: 1000`, raised by bring-to-front) and its dragged
// md-card (`transform` + `z-index: 1000`) stack against the whole document. `Modifier.zIndex` orders a layout node
// among the children of one parent only, so the later siblings of any ancestor painted over them.
//
// Lift chain: a lifted component sets its z-index on its stacking node; every AWC host places itself with the
// largest value of its subtree, so the lifted content draws, and is hit, above the later siblings of each ancestor.
// No node moves: remembered state, focus order and the semantics tree are those of the document.

internal class AWCStackingNode {
    /** Document-level z-index of the component of this node (0: not lifted). */
    var own by mutableFloatStateOf(0f)
    private val children = mutableStateListOf<AWCStackingNode>()
    /** The largest z-index of the subtree; read in the placement block, so a change re-places without recomposing. */
    val lift: Float by derivedStateOf { var z = own; for (c in children) z = maxOf(z, c.lift); z }
    fun add(child: AWCStackingNode) { children.add(child) }
    fun remove(child: AWCStackingNode) { children.remove(child) }
}
internal val LocalAWCStackingNode = compositionLocalOf<AWCStackingNode?> { null }

/** A node linked to the nearest enclosing one for as long as it is composed. */
@Composable internal fun rememberAWCStackingNode(): AWCStackingNode {
    val parent = LocalAWCStackingNode.current
    val node = remember { AWCStackingNode() }
    DisposableEffect(parent, node) { parent?.add(node); onDispose { parent?.remove(node) } }
    return node
}
/** Places the content with the subtree's lift as z-index (adds to an authored `Modifier.zIndex`). */
internal fun Modifier.awcStackingLift(node: AWCStackingNode): Modifier =
    layout { measurable, constraints -> val p = measurable.measure(constraints); layout(p.width, p.height) { p.place(0, 0, zIndex = node.lift) } }

/**
 * Joins the document stacking of AWC components: wrap an application container that sits between AWC components and
 * the siblings they should rise above. While a floating `md-accordion` or a dragged `md-card` inside it is lifted,
 * the container draws above its later siblings. AWC components link themselves.
 */
@Composable fun AWCStackingLift(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val node = rememberAWCStackingNode()
    Box(modifier.awcStackingLift(node)) { CompositionLocalProvider(LocalAWCStackingNode provides node, content = content) }
}

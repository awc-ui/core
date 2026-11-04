package dev.awc.nativeui

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.TraversableNode
import androidx.compose.ui.node.traverseAncestors
import androidx.compose.ui.node.traverseDescendants

private object ButtonGroupTreeKey

/** Read actual authored layout-tree order, including retained children inside
 * arbitrary wrappers. Visual coordinates/RTL/z-order do not define membership. */
private class ButtonGroupTreeNode(var scope: SelectionScope?, var child: Any?) : Modifier.Node(),
    TraversableNode, GlobalPositionAwareModifierNode {
    override val traverseKey: Any = ButtonGroupTreeKey
    fun refreshOrder() {
        val group=scope ?: return
        val order=mutableListOf<Any>()
        traverseDescendants(ButtonGroupTreeKey) { node ->
            (node as? ButtonGroupTreeNode)?.child?.let { if(it in group.indices && it !in order) order+=it }
            TraversableNode.Companion.TraverseDescendantsAction.ContinueTraversal
        }
        if(order.toSet()==group.indices.toSet()) group.reorder(order)
    }
    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        refreshOrder()
        traverseAncestors(ButtonGroupTreeKey) { node ->
            (node as? ButtonGroupTreeNode)?.refreshOrder()
            true
        }
    }
}
private data class ButtonGroupTreeElement(val scope: SelectionScope?, val child: Any?) : ModifierNodeElement<ButtonGroupTreeNode>() {
    override fun create() = ButtonGroupTreeNode(scope,child)
    override fun update(node: ButtonGroupTreeNode) { node.scope=scope;node.child=child }
}
internal fun Modifier.buttonGroupTree(scope: SelectionScope?=null,child: Any?=null): Modifier = then(ButtonGroupTreeElement(scope,child))

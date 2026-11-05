package dev.awc.nativeui

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.*

private object FabMenuTreeKey
private class FabMenuTreeNode(var menu: NativeFabMenuState?,var item: Any?): Modifier.Node(),
    TraversableNode,GlobalPositionAwareModifierNode {
    override val traverseKey: Any=FabMenuTreeKey
    private fun refresh() {
        val current=menu ?: return
        val order=mutableListOf<Any>()
        traverseDescendants(FabMenuTreeKey) { node ->
            (node as? FabMenuTreeNode)?.item?.let { id->if(current.items.any { it.id===id }) order+=id }
            TraversableNode.Companion.TraverseDescendantsAction.ContinueTraversal
        }
        current.reorder(order)
    }
    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        refresh()
        traverseAncestors(FabMenuTreeKey) { node->(node as? FabMenuTreeNode)?.refresh();true }
    }
}
private data class FabMenuTreeElement(val menu: NativeFabMenuState?,val item: Any?): ModifierNodeElement<FabMenuTreeNode>() {
    override fun create()=FabMenuTreeNode(menu,item)
    override fun update(node: FabMenuTreeNode) { node.menu=menu;node.item=item }
}
internal fun Modifier.fabMenuTree(menu: NativeFabMenuState?=null,item: Any?=null): Modifier =
    then(FabMenuTreeElement(menu,item))

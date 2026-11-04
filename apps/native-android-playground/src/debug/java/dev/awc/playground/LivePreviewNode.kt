package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCSlotText
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/**
 * The shared example a client may send with `configure` (`children`: AWC node JSON as the SwiftUI host's effective node,
 * text runs as `#text` nodes). When present, the root component renders exactly those children instead of this host's
 * own sample content, so every host shows the same fixture (tools/ax relies on it). One session, one root.
 */
internal object LivePreviewNodeOverride {
    @Volatile private var tag: String? = null
    @Volatile private var children: JSONArray? = null
    fun set(tag: String, children: JSONArray?) { this.tag = tag; this.children = children }
    fun clear() { tag = null; children = null }
    fun children(tag: String): JSONArray? = children?.takeIf { this.tag == tag }
}

private fun nodeValue(value: Any?): AWCValue = when (value) {
    JSONObject.NULL, null -> null
    is JSONObject -> value.keys().asSequence().associateWith { nodeValue(value.opt(it)) }
    is JSONArray -> (0 until value.length()).map { nodeValue(value.opt(it)) }
    else -> value
}

@Composable
internal fun LivePreviewNodeChildren(children: JSONArray, slot: String, onEvent: (String, AWCValue) -> Unit) {
    for (i in 0 until children.length()) {
        val child = children.optJSONObject(i) ?: continue
        val props = child.optJSONObject("properties") ?: JSONObject()
        val childSlot = child.optString("slot", props.optString("slot", ""))
        if (childSlot != slot) continue
        if (child.optString("tag") == "#text") { AWCSlotText(props.optString("text")); continue }
        @Suppress("UNCHECKED_CAST")
        val properties = (nodeValue(props) as Map<String, AWCValue>) - "slot"
        val grandchildren = child.optJSONArray("children") ?: JSONArray()
        AWCComponent(child.getString("tag"), properties, onEvent = onEvent) { s -> LivePreviewNodeChildren(grandchildren, s, onEvent) }
    }
}

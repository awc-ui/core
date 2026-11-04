package dev.awc.playground

import androidx.compose.ui.graphics.Color
import dev.awc.nativeui.AWCCornerShape
import dev.awc.nativeui.AWCSwitchAppearance
import dev.awc.nativeui.AWCSwitchPartAppearance
import org.json.JSONObject
import kotlin.math.abs

/** Shared helpers for the Chrome md-switch oracles (switch/paint.html, switch/states.html). */
internal object SwitchWeb {
    fun rgba(c:Color)=listOf(c.red.toDouble(),c.green.toDouble(),c.blue.toDouble(),c.alpha.toDouble())
    fun close(native:Any?,web:String,tol:Double=.012):Boolean { val c=native as? Color ?: return false
        val a=CardWeb.pre(rgba(c));val b=CardWeb.pre(CardWeb.color(web));return a.indices.all { abs(a[it]-b[it])<=tol } }
    fun px(s:String)=s.removeSuffix("px").toDouble()
    fun hooks(h:JSONObject?):AWCSwitchAppearance { if(h==null) return AWCSwitchAppearance()
        fun n(k:String)=if(h.has(k)) px(h.getString(k)) else null
        fun c(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCSwitchAppearance(n("track-width"),n("track-height"),n("handle-size"),c("track-color"),c("track-outline-color"),c("handle-color"),
            c("selected-track-color"),c("selected-handle-color"),c("icon-color"),c("selected-icon-color"),c("state-layer-color"),c("focus-ring-color")) }
    /** The oracle's part rules (paint.html parts cases). */
    val parts=AWCSwitchPartAppearance("#FFF59D","#F57F17",AWCCornerShape.uniform(6.0),"#33691E",AWCCornerShape.uniform(3.0),.8,"#FFEB3B","#C2185B")
    fun props(c:JSONObject):MutableMap<String,Any?> {
        val p=mutableMapOf<String,Any?>("selected" to c.optBoolean("selected"))
        if(c.has("density") && !c.isNull("density") && c.getDouble("density")!=0.0) p["density"]=c.getDouble("density")
        when(c.optString("icons")) { "icons"->p["icons"]=true;"selectedOnly"->p["showOnlySelectedIcon"]=true }
        when(c.optString("state")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        if(c.optBoolean("hidden")) p["hidden"]=true
        if(c.optBoolean("required")) p["required"]=true
        return p
    }
}

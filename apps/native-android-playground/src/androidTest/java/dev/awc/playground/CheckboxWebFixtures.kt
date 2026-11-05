package dev.awc.playground

import dev.awc.nativeui.AWCCheckboxAppearance
import dev.awc.nativeui.AWCCornerShape
import org.json.JSONObject

/** Shared helpers for the Chrome md-checkbox oracles (checkbox/paint.html, checkbox/states.html). */
internal object CheckboxWeb {
    fun hooks(h:JSONObject?):AWCCheckboxAppearance { if(h==null) return AWCCheckboxAppearance()
        fun n(k:String)=if(h.has(k)) SwitchWeb.px(h.getString(k)) else null
        fun c(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCCheckboxAppearance(c("container-color"),n("container-shape")?.let { AWCCornerShape.uniform(it) },n("container-size"),c("selected-container-color"),c("outline-color"),
            n("outline-width"),c("icon-color"),n("icon-size"),c("state-layer-color"),c("selected-state-layer-color"),n("state-layer-size"),n("touch-target-size"),c("supporting-text-color"),c("error-text-color")) }
    /** Source properties of one oracle configuration (value unchecked/checked/indeterminate, state, error, density). */
    fun props(c:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>("checked" to (c.optString("value")=="checked"),"indeterminate" to (c.optString("value")=="indeterminate"))
        if(c.has("density") && !c.isNull("density") && c.getDouble("density")!=0.0) p["density"]=c.getDouble("density")
        when(c.optString("state")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        if(c.optBoolean("error")) p["error"]=true
        return p }
}

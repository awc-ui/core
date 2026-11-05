package dev.awc.playground

import dev.awc.nativeui.AWCRadioAppearance
import org.json.JSONObject

/** Shared helpers for the Chrome md-radio oracles (radio/paint.html, radio/states.html, radio/group.html). */
internal object RadioWeb {
    fun hooks(h:JSONObject?):AWCRadioAppearance { if(h==null) return AWCRadioAppearance()
        fun n(k:String)=if(h.has(k)) SwitchWeb.px(h.getString(k)) else null
        fun c(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCRadioAppearance(c("icon-color"),c("selected-icon-color"),n("icon-size"),n("inner-circle-size"),n("state-layer-size"),c("state-layer-color"),c("selected-state-layer-color")) }
    /** `matrix(a, …)` → a (the uniform scale of the oracle's transforms); `none` → 1. */
    fun scale(t:String)=if(t=="none" || t.isEmpty()) 1.0 else t.substringAfter("(").substringBefore(",").trim().toDouble()
}

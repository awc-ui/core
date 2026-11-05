package dev.awc.playground

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCMenuAppearance
import dev.awc.nativeui.AWCMenuAppearanceScope
import dev.awc.nativeui.AWCMenuScope
import dev.awc.nativeui.AWCMenuScopeState
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/**
 * md-menu / md-menu-item / md-menu-item-group / md-sub-menu-item in the Laboratory: the recipe (recipes.js) — a tonal
 * "Open menu" button anchoring the menu `demo-menu` with a Workspace group (New project, Duplicate ⌘D, an Export submenu
 * with SwiftUI and Compose) — typed hooks, retained property updates, show/close/whenClosed, reposition and collapse.
 */
internal val livePreviewMenuTags=setOf("md-menu","md-menu-item","md-menu-item-group","md-sub-menu-item")
internal const val LIVE_MENU_ID="demo-menu"
internal const val LIVE_MENU_TRIGGER="demo-menu-trigger"
/** The recipe values of the previewed element (they replace the gallery fixture). */
internal fun livePreviewMenuRecipe(tag:String):Map<String,AWCValue>?=when(tag) {
    "md-menu"->mapOf("anchor" to LIVE_MENU_TRIGGER,"open" to false)
    "md-menu-item"->mapOf("headline" to "New project","supportingText" to "Start something new")
    "md-sub-menu-item"->mapOf("headline" to "Export","supportingText" to "")
    "md-menu-item-group"->mapOf("label" to "Workspace")
    else->null
}
private fun menuValues(request:JSONObject,field:String):Map<String,Any?> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { k-> obj.opt(k).let { v-> if(v==JSONObject.NULL) null else v } }
}
/** Defaults then local values (the host nests the two scopes, local innermost). Null when a field or value is invalid. */
internal fun parseLivePreviewMenuAppearance(request:JSONObject,field:String):AWCMenuAppearance =
    AWCMenuAppearance.fromValues(menuValues(request,field)) ?: throw IllegalArgumentException("Invalid menu appearance.")
private val menuUpdates=mapOf(
    "md-menu" to setOf("open","anchor","placement","quick","variant","layout","useGap","emptyText","matchAnchorWidth","responsive","persistent","autoFocus","maxHeight","listLabel","listbox","density"),
    "md-menu-item" to setOf("headline","supportingText","trailingText","disabled","selected","indeterminate","keepOpen","divider","gap","badge","type","checkPosition","presentation","roleOverride","density"),
    "md-sub-menu-item" to setOf("headline","supportingText","disabled","divider","gap","badge","openDelay","closeDelay","density"),
    "md-menu-item-group" to setOf("label","density"))
private val menuBooleans=setOf("open","quick","useGap","matchAnchorWidth","responsive","persistent","autoFocus","listbox","disabled","selected","indeterminate","keepOpen","divider","gap")
private val menuEnums=mapOf("placement" to setOf("bottom-start","bottom-end","top-start","top-end"),"variant" to setOf("baseline","standard","vibrant"),
    "layout" to setOf("standard","grouped"),"type" to setOf("button","checkbox","radio"),"checkPosition" to setOf("start","end"),"presentation" to setOf("menuitem","option"))
internal fun parseLivePreviewMenuUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=menuUpdates.getValue(tag)
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        require(name in declared) { "Unknown $tag property: $name" }
        when {
            name in menuBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in menuEnums->require(value in menuEnums.getValue(name)) { "$name must be one of ${menuEnums.getValue(name).joinToString()}." }
            name=="density"->require(value is Number && value.toDouble() in listOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "density must be 0 to -4." }
            name in setOf("openDelay","closeDelay")->require(value is Number && value.toDouble().isFinite() && value.toDouble()>=0) { "$name must be a finite number of milliseconds." }
            name=="maxHeight"->require((value is Number && value.toDouble().isFinite() && value.toDouble()>=0) || (value is String && value.toByteArray(Charsets.UTF_8).size<=4096)) { "maxHeight must be a number or a CSS length." }
            else->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "$name must be a string." }
        }
        if(value is Number) value.toDouble() else value
    }
}
/** show([{autoFocus}]) / close() / whenClosed(): the arguments list carries autoFocus as "true" / "false". */
internal fun validateLivePreviewMenuMethod(method:String,args:JSONArray):List<String> {
    require(method in setOf("show","close","whenClosed")) { "md-menu accepts show, close or whenClosed." }
    if(args.length()==0) return emptyList()
    require(method=="show" && args.length()==1) { "$method accepts no arguments." }
    val options=args.opt(0)
    require(options is JSONObject && options.keys().asSequence().all { it=="autoFocus" }) { "show accepts { autoFocus: boolean }." }
    if(!options.has("autoFocus")) return emptyList()
    val value=options.get("autoFocus")
    require(value is Boolean) { "autoFocus must be Boolean." }
    return listOf(value.toString())
}
/** reposition() on the menu; collapse() on the previewed submenu row (its flyout closes without the exit). */
internal fun invokeLivePreviewMenuMethod(tag:String,request:JSONObject,state:AWCMenuScopeState):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(args.length()==0) { "$method requires no arguments." }
    when {
        tag=="md-menu" && method=="reposition"->state.menu(LIVE_MENU_ID).reposition()
        tag=="md-sub-menu-item" && method=="collapse"->state.menu(LIVE_MENU_ID).collapse(LIVE_MENU_EXPORT)
        else->throw IllegalArgumentException("Unsupported native method.")
    }
    return null
}
internal const val LIVE_MENU_EXPORT="demo-menu-export"

/**
 * The recipe tree with the previewed element in place ([selected] wraps it in the host's inspection and action scopes).
 * The trigger toggles the menu as `data-awc-action="toggle"` does (`open = !open`); its own events stay local.
 */
@Composable internal fun LivePreviewMenuHost(tag:String,properties:Map<String,AWCValue>,state:AWCMenuScopeState,defaults:AWCMenuAppearance,appearance:AWCMenuAppearance,
                                             onEvent:(String,AWCValue)->Unit,selected:@Composable (@Composable ()->Unit)->Unit) {
    fun item(id:String,vararg p:Pair<String,AWCValue>):@Composable ()->Unit={ AWCComponent("md-menu-item",mapOf("id" to id,*p),onEvent=onEvent) }
    fun element(own:String,id:String,recipe:Map<String,AWCValue>,content:(@Composable (String)->Unit)?):@Composable ()->Unit={
        if(tag==own) selected { AWCComponent(own,properties+("id" to id),onEvent=onEvent,content=content) }
        else AWCComponent(own,recipe+("id" to id),onEvent=onEvent,content=content)
    }
    val first=element("md-menu-item","demo-menu-new",mapOf("headline" to "New project","supportingText" to "Start something new"),null)
    val export=element("md-sub-menu-item",LIVE_MENU_EXPORT,mapOf("headline" to "Export")) { slot->
        if(slot=="submenu") AWCComponent("md-menu",mapOf("id" to "demo-menu-export-menu"),onEvent=onEvent) { s->
            if(s.isEmpty()) { item("demo-menu-swiftui","headline" to "SwiftUI")(); item("demo-menu-compose","headline" to "Compose")() }
        }
    }
    val group=element("md-menu-item-group","demo-menu-group",mapOf("label" to "Workspace")) { slot->
        if(slot.isEmpty()) { first(); item("demo-menu-duplicate","headline" to "Duplicate","trailingText" to "⌘D")(); export() }
    }
    val menu=element("md-menu",LIVE_MENU_ID,mapOf("anchor" to LIVE_MENU_TRIGGER)) { slot-> if(slot.isEmpty()) group() }
    AWCMenuScope(state,Modifier.fillMaxWidth().heightIn(min=320.dp)) {
        AWCMenuAppearanceScope(defaults) { AWCMenuAppearanceScope(appearance) {
            Column(Modifier.fillMaxWidth().padding(top=12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)) {
                AWCComponent("md-button",mapOf("id" to LIVE_MENU_TRIGGER,"label" to "Open menu","variant" to "tonal"),onEvent={ name,_->
                    if(name=="mdClick") { val handle=state.menu(LIVE_MENU_ID);if(handle.isOpen) handle.close() else handle.show() }
                })
                Box { menu() }
            }
        } }
    }
}

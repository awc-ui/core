package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * r3-24: md-list roving focus over an expandable row in each selection mode against Chrome 153 trusted keys
 * (list-roving-web.json, d3-lab/web2/roving.mjs): Tab in and out, ArrowUp/Down, Home/End, activateNext,
 * Enter/Space/ArrowRight/ArrowLeft on the expandable row and on its caret, Tab to the caret. Per step: focus, d's expansion
 * and every list/item event.
 */
class NativeListRovingTest {
    @get:Rule val compose=createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("list-roving-web.json").bufferedReader().readText()) }
    private var mode by mutableStateOf("single-select")
    private var epoch by mutableIntStateOf(0)
    private val list=AWCListController()
    private val inspection=AWCListInspection()
    private val events=mutableListOf<String>()
    private var view:android.view.View?=null
    private var checks=0;private val failures=mutableListOf<String>()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun record(n:String,d:Any?,target:String) { val i=((d as? Map<*,*>)?.get("index") as? Number)?.toInt();events+="$n@$target"+(if(i!=null) ":$i" else "") }
    @Composable private fun Item(id:String,p:Map<String,Any?>,content:(@Composable (String)->Unit)?=null) =
        AWCComponent("md-list-item",p+("id" to id),onEvent={ n,d-> record(n,d,id) },content=content)
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        view=LocalView.current
        AWCTheme(false) { Box(Modifier.fillMaxSize()) { key(epoch) {
            Box(Modifier.absoluteOffset(10.dp,4.dp)) { AWCComponent("md-button",mapOf("variant" to "text","label" to "before","id" to "before")) }
            Box(Modifier.absoluteOffset(10.dp,60.dp).width(360.dp)) { AWCListInspectionScope(inspection) { AWCListControllerScope(list,"list") {
                AWCComponent("md-list",mapOf("selectionMode" to mode,"label" to "L","id" to "list"),onEvent={ n,d-> record(n,d,"list") }) { slot-> if(slot=="") {
                    Item("a",mapOf("headline" to "Alpha"))
                    Item("d",mapOf("headline" to "Delta","expandable" to true)) { s-> if(s=="expanded-content") Item("d0",mapOf("headline" to "Child")) }
                    Item("c",mapOf("headline" to "Charlie")) } }
            } } }
            Box(Modifier.absoluteOffset(10.dp,520.dp)) { AWCComponent("md-button",mapOf("variant" to "text","label" to "after","id" to "after")) }
        } } }
    } } }
    private fun key(code:Int,meta:Int=0) { compose.runOnUiThread { val v=view!!;val t=android.os.SystemClock.uptimeMillis()
        v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_DOWN,code,0,meta));v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_UP,code,0,meta)) }
        compose.waitForIdle() }
    private fun focused():String {
        fun any(m:SemanticsMatcher,unmerged:Boolean=false)=compose.onAllNodes(isFocused() and m,useUnmergedTree=unmerged).fetchSemanticsNodes().isNotEmpty()
        return when {
            // The caret's own node (a button row merges its caret's semantics into the row).
            any(hasContentDescription("Expand") or hasContentDescription("Collapse"),true)->"d.expand-button"
            any(hasText("before"))->"before";any(hasText("after"))->"after"
            // Rows: the list's own record of the focused row (row semantics merge only for focusable rows).
            else->inspection.rows.entries.firstOrNull { it.value["focused"]==true }?.key ?: "body"
        }
    }
    @Test fun rovingOverExpandableRowsMatchesChrome() {
        content();compose.waitForIdle()
        val results=oracle.getJSONObject("results")
        for(m in listOf("single-select","multi-select","none")) {
            mode=m;epoch++;compose.waitForIdle();compose.runOnUiThread { view?.clearFocus() };compose.waitForIdle()
            val steps=results.getJSONArray(m)
            for(i in 0 until steps.length()) { val step=JSONObject(steps.getJSONObject(i).toString());val label=step.getString("label")
                // Leaving the page (Chrome: body) is outside the native window.
                if(label=="Tab again" && step.getString("focus")=="body") continue
                // The oracle is Chrome on the fixed source (gate-7 r3-25, r3-26; md-list-source-review.md): one row stop per list, so
                // Tab from a goes on to d's caret, whose focus makes d the active row; the next Tab leaves the list.
                if(label=="Tab from before") { key(KeyEvent.KEYCODE_TAB);check(focused()=="before","$m: Tab from the document focuses before (${focused()})") }
                events.clear()
                when(label) {
                    "Tab from before","Tab","Tab from d","Tab from a","Tab again"->key(KeyEvent.KEYCODE_TAB)
                    "Shift+Tab","Shift+Tab back"->key(KeyEvent.KEYCODE_TAB,KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON)
                    "ArrowDown"->key(KeyEvent.KEYCODE_DPAD_DOWN);"ArrowUp","ArrowUp (to d)"->key(KeyEvent.KEYCODE_DPAD_UP)
                    "ArrowRight on d"->key(KeyEvent.KEYCODE_DPAD_RIGHT);"ArrowLeft on d"->key(KeyEvent.KEYCODE_DPAD_LEFT)
                    "Home","Home (after d)"->key(KeyEvent.KEYCODE_MOVE_HOME);"End"->key(KeyEvent.KEYCODE_MOVE_END)
                    "Enter","Enter on d"->key(KeyEvent.KEYCODE_ENTER);"Space on d"->key(KeyEvent.KEYCODE_SPACE)
                    "activateNext"->{ compose.runOnUiThread { list.activateNext() };compose.waitForIdle() }
                    else->check(false,"$m: unknown step $label")
                }
                val web=step.getString("focus").replace(">expand-button",".expand-button")
                check(focused()==web,"$m/$label: focus ${focused()} vs Chrome ${step.getString("focus")}")
                check(inspection.rows["d"]?.get("expanded")==step.getBoolean("expanded"),"$m/$label: d expanded ${inspection.rows["d"]?.get("expanded")} vs Chrome ${step.getBoolean("expanded")}")
                val webEvents=(0 until step.getJSONArray("events").length()).map { step.getJSONArray("events").getString(it) }
                check(events==webEvents,"$m/$label: events $events vs Chrome $webEvents")
            }
        }
        android.util.Log.i("AWCListRoving","NativeListRovingTest ${checks-failures.size}/$checks checks passed")
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
}

package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.test.performKeyInput
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-transfer-list against Chrome 153 (md-transfer-list/web-oracle paint.json, 105 cases at DPR 1; rendered at 1 px per dp):
 * light/dark × LTR/RTL × the source states, densities, the ≤ 640 px stacked layout, host dir, focus, row hover, locales,
 * custom icons, long labels, a scrolling list, full width/height and every hook. Checks: every part box (columns, headers,
 * title cluster, count, search, list or empty state, rows, movers) and every flat pixel of the clip. The harness steps are
 * replayed at Chrome's own times from the oracle's input timeline.
 */
@OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
class NativeTransferListPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null)
    private var epoch by mutableIntStateOf(0)
    @Volatile private var probe:TransferListProbe?=null
    private var checks=0;private val failures=mutableListOf<String>();private val pending=mutableListOf<String>();private val exceptions=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private var shotDir="TransferListWebPaint"
    private val platformFonts=mutableListOf<String>()
    private val bodyFocus=androidx.compose.ui.focus.FocusRequester()
    private fun pageBlur() { compose.runOnIdle { runCatching { bodyFocus.requestFocus() } } }

    private fun attr(html:String,name:String):String? {
        val i=html.indexOf("<md-transfer-list");if(i<0) return null
        val tag=html.substring(i,html.indexOf('>',i).let { if(it<0) html.length else it })
        for(q in listOf("'","\"")) { val k=tag.indexOf(" $name=$q");if(k>=0) { val s=k+name.length+3;val e=tag.indexOf(q,s);if(e>=s) return tag.substring(s,e) } }
        return if(Regex(" $name( |$)").containsMatchIn(tag)) "" else null
    }
    private fun px(s:String)=s.removeSuffix("px").trim().toDoubleOrNull()
    private fun hooks(html:String):AWCTransferListAppearance {
        val h=HashMap<String,String>()
        for(d in (attr(html,"style") ?: "").split(';')) { val kv=d.split(':',limit=2);if(kv.size==2) h[kv[0].trim()]=kv[1].trim() }
        fun c(k:String)=h["--md-transfer-list-$k"]
        fun n(k:String)=c(k)?.let { px(it) }
        val pad=c("item-padding")?.split(' ')?.mapNotNull { px(it) } ?: emptyList()
        return AWCTransferListAppearance(n("width"),n("min-width"),n("max-width"),n("height"),n("min-height"),n("max-height"),n("column-min-width"),n("column-max-block"),n("container-shape"),
            c("container-color"),c("header-color"),c("header-text-color"),n("item-inset"),when(pad.size) { 0 -> null; 1 -> AWCTransferListInsets(pad[0]); 2 -> AWCTransferListInsets(pad[0],pad[1]); 3 -> AWCTransferListInsets(pad[0],pad[1],pad[2],pad[1]); else -> AWCTransferListInsets(pad[0],pad[1],pad[2],pad[3]) },n("item-gap"),c("divider-color"),n("controls-gap"),
            n("empty-icon-size"),n("control-size"),n("control-icon-size")).validated()
    }
    /** The case's ::part() rules (a <style> before the element) as the typed part appearance. */
    private fun partStyles(html:String):AWCTransferListPartAppearance {
        val v=HashMap<String,Any?>()
        for(m in Regex("::part\\(([a-z-]+)\\)\\s*\\{([^}]*)\\}").findAll(html)) { val f=HashMap<String,Any?>()
            for(d in m.groupValues[2].split(';')) { val kv=d.split(':',limit=2).map { it.trim() };if(kv.size!=2) continue
                when(kv[0]) { "background-color" -> f["backgroundColor"]=kv[1]; "color" -> f["color"]=kv[1]; "border-color","border-block-end-color" -> f["borderColor"]=kv[1]
                    "border-radius" -> px(kv[1])?.let { f["shape"]=it }; "font-size" -> px(kv[1])?.let { f["size"]=it }; "opacity" -> kv[1].toDoubleOrNull()?.let { f["opacity"]=it } } }
            v[m.groupValues[1]]=f }
        return AWCTransferListPartAppearance.of(v)
    }
    private fun value(name:String)=when { name.startsWith("tl-part") && (name.contains("empty") || name.startsWith("tl-parts-all")) -> emptyList()
        name.contains("hooks-all") || name.contains("target-empty") || name.contains("long-labels") || name.contains("many-items") || name.endsWith("ro-empty") -> emptyList()
        name.startsWith("tl-hook-") -> listOf("e"); name=="tl-custom-icons" -> listOf("a","b","c","e","f"); else -> listOf("e","f") }
    private fun props(c:JSONObject):Map<String,Any?> {
        val html=c.getString("html");val p=HashMap<String,Any?>()
        attr(html,"items")?.let { p["items"]=it.replace("&#39;","'").replace("&quot;","\"") }
        p["value"]=value(c.getString("name"))
        for((a,k) in listOf("source-title" to "sourceTitle","target-title" to "targetTitle","source-search-placeholder" to "sourceSearchPlaceholder","target-search-placeholder" to "targetSearchPlaceholder",
            "empty-text" to "emptyText","empty-icon" to "emptyIcon","count-template" to "countTemplate","select-all-label" to "selectAllLabel","search-icon" to "searchIcon","move-right-icon" to "moveRightIcon",
            "move-left-icon" to "moveLeftIcon","move-all-right-icon" to "moveAllRightIcon","move-all-left-icon" to "moveAllLeftIcon")) attr(html,a)?.let { p[k]=it }
        attr(html,"density")?.toDoubleOrNull()?.let { p["density"]=it }
        if(attr(html,"disabled")!=null) p["disabled"]=true
        if(attr(html,"searchable")=="false") p["searchable"]=false
        if(attr(html,"show-select-all")=="false") p["showSelectAll"]=false
        if(attr(html,"single-step-only")!=null) p["singleStepOnly"]=true
        if(attr(html,"full-width")!=null) p["fullWidth"]=true
        if(attr(html,"full-height")!=null) p["fullHeight"]=true
        return p
    }
    private fun rtl(c:JSONObject)=c.optString("dir")=="rtl" || c.getString("html").contains("dir=\"rtl\"")

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) {
        val c=case ?: return@CompositionLocalProvider
        AWCTheme(c.optString("theme")=="dark") { AWCTooltipScope { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
            Box(Modifier.size(1.dp).focusRequester(bodyFocus).focusable())
            key(epoch) {
            val host=c.getJSONObject("tree").getJSONObject("rect");val html=c.getString("html")
            val fixedHeight=attr(html,"full-height")!=null || html.contains("-height:")
            Box(Modifier.absoluteOffset(host.getDouble("x").dp,host.getDouble("y").dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft,unbounded=true).width(host.getDouble("width").dp)
                .then(if(fixedHeight) Modifier.height(host.getDouble("height").dp) else Modifier)) {
                CompositionLocalProvider(LocalLayoutDirection provides if(rtl(c)) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCTransferListViewportScope(if(c.getString("name").contains("stacked-500")) 500.0 else 1200.0) { AWCTransferListAppearanceScope(hooks(html)) { AWCTransferListPartAppearanceScope(partStyles(html)) { AWCTransferListInspectionScope({ probe=it }) {
                        AWCComponent("md-transfer-list",props(c))
                    } } } }
                }
            }
        } } } }
    } } }

    @org.junit.After fun restoreTouchMode() { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) }

    @Test fun transferListMatchesChromePaint() {
        // Out of touch mode, as after a mouse press or a key (the injected events bypass ViewRootImpl's touch-mode stage).
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(false)
        content()
        val oracle=CardWeb.document("TransferListWebPaint.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcCase")
        for(c in oracle.getJSONArray("cases").objects()) if(!c.getString("name").startsWith("tl-fc-") && (only==null || c.getString("name").contains(only))) paint(c)
        // The typed ::part() cases (web-oracle/parts.json, slimmed like paint.json).
        shotDir="TransferListWebParts"
        val parts=runCatching { CardWeb.document("TransferListWebParts.json") }.getOrNull()
        if(parts==null) check(false,"parts fixture TransferListWebParts.json missing")
        else for(c in parts.getJSONArray("cases").objects()) if(only==null || c.getString("name").contains(only)) paint(c)
        AccordionEvidence.log("transferlist-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("pending",JSONArray(pending)).put("proposedExceptions",JSONArray(exceptions)).put("platformFonts",JSONArray(platformFonts)).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }

    private fun paint(c:JSONObject) {
        val name=c.getString("name");probe=null
        compose.onRoot().performMouseInput { moveTo(Offset(1060f,1180f)) }
        compose.runOnIdle { case=c;epoch++ }
        compose.waitForIdle();pageBlur();compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
        val p=props(c);val items=AWCTransferItem.parse(p["items"]);val value=(p["value"] as List<*>).map { it.toString() }.toSet()
        val source=items.filter { it.value !in value };val target=items.filter { it.value in value }
        // The harness steps at Chrome's own times: the oracle's input timeline (trusted pointer and key events, performance.now()
        // ms) replayed on the test clock up to the frame the shot paints. Presses on rows go in as mouse input (md-ripple waves
        // at Chrome's phase), moves as moves (hover), a press outside the list blurs (the page body takes it), typed keys set
        // the query at the last key, and the harness's Tabs end on the row the case names (keyboard focus).
        val tl=c.optJSONArray("timeline")?.objects()?.toList() ?: emptyList()
        val shotT=c.optDouble("shotFrame").takeIf { !it.isNaN() } ?: c.optDouble("shotAt")
        val away=Offset(1060f,1180f);val hostRect=c.getJSONObject("tree").getJSONObject("rect")
        compose.mainClock.autoAdvance=false
        val start=compose.mainClock.currentTime;val t0=tl.firstOrNull()?.getDouble("t") ?: shotT
        fun until(ms:Double) { var g=0;while(compose.mainClock.currentTime-start<ms-8 && g++<600) compose.mainClock.advanceTimeByFrame() }
        fun inRow(q:Offset)=probe?.parts?.invoke()?.any { (k,r)-> k.startsWith("item-") && r.contains(q) } == true
        fun inHost(q:Offset)=q.x>=hostRect.getDouble("x") && q.y>=hostRect.getDouble("y") && q.x<hostRect.getDouble("x")+hostRect.getDouble("width") && q.y<hostRect.getDouble("y")+hostRect.getDouble("height")
        val lastTab=tl.lastOrNull { it.optString("key")=="Tab" };val lastTyped=tl.lastOrNull { it.getString("type")=="keydown" && it.optString("key").length==1 }
        var typed="";var held=false;var fromPageEnd=false
        if(tl.isNotEmpty() && !shotT.isNaN()) {
            // check() then moves the pointer to (1190, 600): outside the 500 px viewport of the stacked cases Chrome dispatches no
            // event but the pointer has left (no :hover); a release with no move after it is that move.
            val stackedCase=name.contains("stacked-500")
            for((ei,e) in tl.withIndex()) { until(e.getDouble("t")-t0)
                val q=Offset(e.optDouble("x",0.0).toFloat(),e.optDouble("y",0.0).toFloat())
                when(e.getString("type")) {
                    "pointermove" -> compose.onRoot().performMouseInput { moveTo(if(q.x<1080 && q.y<2400) q else away,delayMillis=0) }
                    "pointerdown" -> if(inRow(q)) { compose.onRoot().performMouseInput { moveTo(q,delayMillis=0);press() };held=true } else if(!inHost(q)) { pageBlur();fromPageEnd=q.y>hostRect.getDouble("y")+hostRect.getDouble("height") }
                    "pointerup" -> { if(held) { compose.onRoot().performMouseInput { release() };held=false }
                        if(stackedCase && tl.getOrNull(ei+1)?.getString("type")!="pointermove") { until(e.getDouble("t")-t0+1.5);compose.onRoot().performMouseInput { moveTo(away,delayMillis=0) } } }
                    "keydown" -> { val k=e.optString("key");if(k.length==1) typed+=k
                        if(e===lastTyped) compose.runOnIdle { probe?.search?.invoke(false,typed) }
                        // Tab: the window's focus order. A press on the page's end puts Chrome's sequential focus starting point after the
                        // list, so its first Tab leaves the page (browser UI) and the next one enters at the top: nothing in-page.
                        if(k=="Tab") { if(fromPageEnd) fromPageEnd=false else compose.onRoot().performKeyInput { keyDown(androidx.compose.ui.input.key.Key.Tab);keyUp(androidx.compose.ui.input.key.Key.Tab) } } }
                } }
            until(shotT-t0)
        } else { compose.mainClock.autoAdvance=true;compose.waitForIdle();compose.mainClock.advanceTimeBy(450);compose.mainClock.autoAdvance=false }
        // Geometry: the oracle's parts keyed like the renderer's.
        val mine=probe?.parts?.invoke() ?: emptyMap()
        var side="source";val idx=HashMap<String,Int>()
        val q=if(name.endsWith("-filtered")) source.filter { it.label.lowercase().contains("al") || it.description.lowercase().contains("al") } else source
        for(part in c.getJSONObject("tree").getJSONArray("parts").objects()) {
            val pn=part.optString("part");val r=part.getJSONObject("rect")
            if(pn.contains("column-target")) side="target"
            val key=when { pn.startsWith("column") -> "column-$side"; pn=="controls" -> "controls"
                pn=="item" -> { val s=if(side=="target") "t" else "s";val n=idx[s] ?: 0;idx[s]=n+1;val list=if(side=="target") target else q
                    list.getOrNull(n)?.let { "item-$s:${it.value}" } ?: "item-$s#extra$n" }
                pn in setOf("header","header-title","count","search","list","empty") -> "$pn-$side"; else -> null } ?: continue
            val m=mine[key]
            if(m==null) { check(false,"$name part $key missing");continue }
            val fits=abs(m.left-r.getDouble("x"))<=1 && abs(m.top-r.getDouble("y"))<=1 && abs(m.width-r.getDouble("width"))<=1 && abs(m.height-r.getDouble("height"))<=1
            // Platform fonts (md-avatar.md's method): the Arabic count run has no Roboto glyphs, so its advances come from the platform's
            // fallback font (Chrome: macOS; Android: Noto). The pill is compared with the same run measured by the device's own fonts
            // where CSS places it: the inline-start (right) edge, top and height as Chrome's, the width = the run + the 16px padding.
            if(name=="tl-locale-ar-rtl" && key.startsWith("count-")) {
                val ctx=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
                val text=compose.runOnIdle { (if(key.endsWith("target")) probe?.snapshot?.invoke()?.target else probe?.snapshot?.invoke()?.source)?.count } ?: ""
                val paint=android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { textSize=11f;typeface=ctx.resources.getFont(dev.awc.nativeui.R.font.awc_roboto_medium) }
                // CSS letter-spacing (0.4px) follows every character, cursive scripts included (Chrome spaces Arabic; Paint.letterSpacing
                // skips cursive runs): the device-font advances plus the spacing per code point, as the stylesheet lays the run out.
                val run=android.text.Layout.getDesiredWidth("\u200F"+text,paint).toDouble()+0.4*text.codePointCount(0,text.length)
                check(abs(m.right-(r.getDouble("x")+r.getDouble("width")))<=1 && abs(m.top-r.getDouble("y"))<=1 && abs(m.height-r.getDouble("height"))<=1 && abs(m.width-(run+16))<=1,
                    "$name $key (${m.left},${m.top},${m.width},${m.height}) vs the device-font run with CSS letter-spacing ${"%.2f".format(run)} + 16 at Chrome's inline-start edge $r")
                platformFonts+="$name $key: width ${m.width} = device-font run with CSS letter-spacing ${"%.2f".format(run)} + 16 (Chrome/macOS ${r.getDouble("width")})"
            } else check(fits,"$name $key (${m.left},${m.top},${m.width},${m.height}) vs $r")
        }
        val clip=c.getJSONObject("clip")
        val nat=CardWeb.Grid(clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"),compose.onRoot().captureToImage().toPixelMap().let { map->
            val x=clip.getInt("x");val y=clip.getInt("y");val w=clip.getInt("width");val h=clip.getInt("height");val v=DoubleArray(w*h*3)
            for(py in 0 until h) for(pxx in 0 until w) { val X=x+pxx;val Y=y+py
                if(X<map.width && Y<map.height) { val cc=map[X,Y];v[(py*w+pxx)*3]=cc.red*255.0;v[(py*w+pxx)*3+1]=cc.green*255.0;v[(py*w+pxx)*3+2]=cc.blue*255.0 } else for(k in 0..2) v[(py*w+pxx)*3+k]=-999.0 }
            v })
        val web=CardWeb.webGrid("$shotDir/$name.png",clip)
        val r=CardWeb.compare(web,nat)
        check(CardWeb.ok(r),"$name flat pixels $r")
        if(!CardWeb.ok(r)) AccordionEvidence.png("transferlist-$name",compose.onRoot().captureToImage())
        report.put(r.put("case",name))
        compose.mainClock.autoAdvance=true
    }
}

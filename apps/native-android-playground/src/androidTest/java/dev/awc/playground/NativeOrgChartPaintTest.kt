package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
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
 * md-organization-chart against Chrome 153 (md-organization-chart/web-oracle paint.json, 97 cases at DPR 1; rendered here
 * at 1 px per dp too, so the 936 px clips fit the 1080 px emulator display): light/dark × LTR/RTL × vertical/horizontal × selection modes, densities incl. an ancestor density,
 * seeded folds with a hidden selection, collapsible="false", empty states, multiple roots and only-child chains, accents,
 * unselectable ids, trail geometry, hover on cards and on the toggler (with its tooltip), keyboard focus, every hook alone
 * and together, a 320px viewport (scrolling) and localised labels. Checks: every card and toggler box against the
 * oracle (the model's Roboto advances), the host height, and every flat pixel of the clip; the harness's own "before"
 * focus probe is masked.
 */
class NativeOrgChartPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null)
    private var epoch by mutableIntStateOf(0)
    @Volatile private var probe:OrgChartProbe?=null
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }

    private fun attr(html:String,name:String):String? {
        val i=html.indexOf("<md-organization-chart");if(i<0) return null
        val tag=html.substring(i,html.indexOf('>',i).let { if(it<0) html.length else it })
        for(q in listOf("\"","'")) { val k=tag.indexOf(" $name=$q");if(k>=0) { val s=k+name.length+3;val e=tag.indexOf(q,s);if(e>s-1) return tag.substring(s,e) } }
        return null
    }
    private fun px(s:String)=s.removeSuffix("px").removeSuffix("ms").trim().toDoubleOrNull()
    private fun hooks(html:String):AWCOrgChartAppearance {
        val h=HashMap<String,String>()
        for(d in (attr(html,"style") ?: "").split(';')) { val kv=d.split(':',limit=2);if(kv.size==2) h[kv[0].trim()]=kv[1].trim() }
        fun c(k:String):String?=h["--md-org-chart-$k"]
        fun n(k:String):Double?=c(k)?.let { px(it) }
        return AWCOrgChartAppearance(c("connector-color"),n("connector-width"),c("node-color"),c("node-outline-color"),n("node-outline-width"),n("node-shape"),
            n("node-min-width"),n("node-max-width"),c("selected-color"),c("focus-ring-color"),c("state-layer-color"),n("toggle-size"),n("level-gap"),n("sibling-gap"),n("duration")).validated()
    }
    private fun props(c:JSONObject):Map<String,Any?> {
        val html=c.getString("html");val p=HashMap<String,Any?>()
        p["nodes"]=if(c.has("nodes") && !c.isNull("nodes")) c.get("nodes") else attr(html,"nodes")?.replace("&quot;","\"")
        for((a,k) in listOf("selection-mode" to "selectionMode","orientation" to "orientation","label" to "label","expand-label" to "expandLabel","collapse-label" to "collapseLabel"))
            attr(html,a)?.let { p[k]=it }
        attr(html,"density")?.let { p["density"]=it.toDoubleOrNull() ?: 0.0 }
        if(attr(html,"collapsible")=="false") p["collapsible"]=false
        c.optJSONObject("props")?.optJSONArray("selectedIds")?.let { a-> p["selectedIds"]=List(a.length()) { a.getString(it) } }
        return p
    }
    private fun ancestorDensity(html:String)=Regex("data-density=\"(-?[\\d.]+)\"").find(html)?.groupValues?.get(1)?.toDoubleOrNull()

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) {
        val c=case ?: return@CompositionLocalProvider
        AWCTheme(c.optString("theme")=="dark") { AWCTooltipScope { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val host=c.getJSONObject("tree").getJSONObject("rect");val html=c.getString("html")
            Box(Modifier.absoluteOffset(host.getDouble("x").dp,host.getDouble("y").dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft,unbounded=true).width(host.getDouble("width").dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCDensityScope(ancestorDensity(html) ?: 0.0) { AWCOrgChartAppearanceScope(hooks(html)) { AWCOrgChartInspectionScope({ probe=it }) {
                        val emptyText=if(html.contains("slot=\"empty\"")) Regex("slot=\"empty\">([^<]*)<").find(html)?.groupValues?.get(1) ?: "" else null
                        val slot:(@Composable (String)->Unit)?=if(emptyText==null) null else ({ name:String-> if(name=="empty") AWCSlotText(emptyText) })
                        AWCComponent("md-organization-chart",props(c),content=slot)
                    } } }
                }
            }
        } } } }
    } } }

    private fun grid1x(map:androidx.compose.ui.graphics.PixelMap,x:Int,y:Int,w:Int,h:Int):CardWeb.Grid { val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val X=x+px;val Y=y+py
            if(X<map.width && Y<map.height) { val c=map[X,Y];v[(py*w+px)*3]=c.red*255.0;v[(py*w+px)*3+1]=c.green*255.0;v[(py*w+px)*3+2]=c.blue*255.0 } else for(k in 0..2) v[(py*w+px)*3+k]=-999.0 }
        return CardWeb.Grid(x,y,w,h,v) }

    @Test fun organizationChartMatchesChromePaint() {
        content()
        val oracle=CardWeb.document("OrgChartWebPaint.json")
        for(c in oracle.getJSONArray("cases").objects()) paint(c)
        AccordionEvidence.log("orgchart-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }

    private fun paint(c:JSONObject) {
        val name=c.getString("name");probe=null
        // The previous case's hover must not carry over: the pointer rests away from every chart.
        compose.onRoot().performMouseInput { moveTo(Offset(1060f,1180f)) }
        compose.runOnIdle { case=c;epoch++ }
        compose.waitForIdle();compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
        val host=c.getJSONObject("tree").getJSONObject("rect");val hx=host.getDouble("x");val hy=host.getDouble("y")
        // Hover cases: the source harness moved the mouse to card "eng" (or its toggler) and waited 1.5 s.
        if(name.contains("hover") || name.endsWith("state-layer-color")) {
            val eng=c.getJSONArray("items").objects().firstOrNull { it.getString("id")=="eng" }
            val r=(if(name.contains("toggle")) eng?.optJSONObject("toggle")?.optJSONObject("rect") else eng?.optJSONObject("nodeRect"))
            if(r!=null) { compose.onRoot().performMouseInput { moveTo(Offset((r.getDouble("x")+r.getDouble("width")/2).toFloat(),(r.getDouble("y")+r.getDouble("height")/2).toFloat())) }
                compose.waitForIdle();compose.mainClock.advanceTimeBy(1600);compose.waitForIdle() }
        }
        // Keyboard-focus cases: the source harness tabbed in (and pressed arrows); the focused tree item shows its ring.
        c.getJSONArray("items").objects().firstOrNull { it.optBoolean("focused") }?.let { f-> compose.runOnIdle { probe?.focus?.invoke(f.getString("id")) }
            compose.waitForIdle();compose.mainClock.advanceTimeBy(450);compose.waitForIdle() }
        val snap=probe?.snapshot?.invoke()
        val items=c.getJSONArray("items").objects()
        if(snap==null) check(items.isEmpty(),"$name probe") else {
            check(abs(snap.hostHeight-host.getDouble("height"))<=.6,"$name host height ${snap.hostHeight} vs ${host.getDouble("height")}")
            check(snap.nodes.size==items.size,"$name visible items ${snap.nodes.size} vs ${items.size}")
            for((mine,web) in snap.nodes.zip(items)) {
                val w=web.getJSONObject("nodeRect");val m=mine.card
                check(mine.id==web.getString("id") && abs(m.x+hx-w.getDouble("x"))<=.6 && abs(m.y+hy-w.getDouble("y"))<=.6 && abs(m.w-w.getDouble("width"))<=.6 && abs(m.h-w.getDouble("height"))<=.6,
                    "$name card ${web.getString("id")} (${m.x+hx},${m.y+hy},${m.w},${m.h}) vs $w")
                val wt=web.optJSONObject("toggle")?.optJSONObject("rect")
                if(wt!=null && mine.toggle!=null) { val t=mine.toggle!!
                    check(abs(t.x+hx-wt.getDouble("x"))<=.6 && abs(t.y+hy-wt.getDouble("y"))<=.6 && abs(t.w-wt.getDouble("width"))<=.6,"$name toggle ${web.getString("id")} (${t.x+hx},${t.y+hy},${t.w}) vs $wt") }
                else check((wt==null)==(mine.toggle==null),"$name toggle presence ${web.getString("id")}")
            }
        }
        val clip=c.getJSONObject("clip")
        val nat=grid1x(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val web=CardWeb.webGrid("OrgChartWebPaint/$name.png",clip)
        // The harness's own "before" probe (60×24 button, margin-block-end 8) at the start edge above the chart.
        val probeRect=if(c.getString("html").contains("class=\"probe\"")) listOf(Rect((if(c.optString("dir")=="rtl") hx+host.getDouble("width")-60 else hx).toFloat(),(hy-32).toFloat(),
            (if(c.optString("dir")=="rtl") hx+host.getDouble("width") else hx+60).toFloat(),(hy-8).toFloat())) else emptyList()
        val r=CardWeb.compare(web,nat,probeRect)
        check(CardWeb.ok(r),"$name flat pixels $r")
        if(!CardWeb.ok(r)) AccordionEvidence.png("orgchart-$name",compose.onRoot().captureToImage())
        report.put(r.put("case",name))
    }
}

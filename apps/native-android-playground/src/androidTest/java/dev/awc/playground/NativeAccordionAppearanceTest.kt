package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.css
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.over
import dev.awc.playground.AccordionWebFixtures.toMap
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.*

/**
 * The 76 actual-Web appearance cases (accordion-web-appearance.json): 14 parent and 24 item
 * hook values (as native appearance values), elevation levels 0-5, custom/zero/disabled styles,
 * inset/mixed shadows and the variable icon glyph. Geometry, surface paint, ink colours and
 * box-shadow pixels (analytic CSS Gaussian profile from the Web's computed box-shadow) are compared.
 */
class NativeAccordionAppearanceTest {
    @get:Rule val compose=createComposeRule()
    private class Layer(val x:Double,val y:Double,val blur:Double,val spread:Double,val color:List<Double>,val inset:Boolean)
    private fun shadows(css:String):List<Layer> = if(css=="none") emptyList() else css.split(Regex(",(?![^(]*\\))")).map { l->
        val text=l.trim();val color=Regex("rgba?\\([^)]*\\)").find(text)!!.value
        val n=text.replace(color,"").replace("inset","").trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDouble() }
        Layer(n[0],n[1],n.getOrElse(2) { 0.0 },n.getOrElse(3) { 0.0 },AccordionWebFixtures.css(color),text.contains("inset")) }
    private fun phi(z:Double):Double { // standard normal CDF (Abramowitz-Stegun erf)
        val x=abs(z)/sqrt(2.0);val t=1/(1+.3275911*x)
        val erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x)
        return .5*(1+sign(z)*erf) }
    /** Coverage of a blurred rectangle [x1,x2]x[y1,y2] at (px,py); sigma = blur/2. */
    private fun coverage(px:Double,py:Double,x1:Double,x2:Double,y1:Double,y2:Double,blur:Double):Double {
        if(blur<=0) return if(px in x1..x2 && py in y1..y2) 1.0 else 0.0
        val s=blur/2;return (phi((x2-px)/s)-phi((x1-px)/s))*(phi((y2-py)/s)-phi((y1-py)/s)) }
    /** Outer shadow composite at a point outside the box (layers painted last-to-first). */
    private fun outer(layers:List<Layer>,box:JSONObject,px:Double,py:Double,base:List<Double>):List<Double> {
        var c=base
        for(l in layers.filter { !it.inset }.asReversed()) {
            val x=box.getDouble("x");val y=box.getDouble("y");val w=box.getDouble("width");val h=box.getDouble("height")
            val a=l.color[3]*coverage(px,py,x+l.x-l.spread,x+w+l.x+l.spread,y+l.y-l.spread,y+h+l.y+l.spread,l.blur)
            c=over(listOf(l.color[0],l.color[1],l.color[2],a),c) }
        return c }

    @Test fun seventySixWebAppearanceCasesMatchGeometryPaintAndShadowPixels() {
        val reference=AccordionWebFixtures.document("AccordionWebAppearance.json").getJSONArray("cases").objects()
        var case by mutableStateOf<JSONObject?>(null);var epoch by mutableIntStateOf(0)
        val collector=AWCInspectionCollector()
        var page=listOf(1.0,1.0,1.0,1.0)
        compose.setContent {
            val c=case ?: return@setContent
            val spec=c.getJSONObject("spec")
            CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(c.getString("theme")=="dark") { run {
                page=MaterialTheme.colorScheme.surface.channels()
                Box(Modifier.testTag("canvas").background(MaterialTheme.colorScheme.surface).padding(24.dp)) { Box(Modifier.requiredWidth(400.dp)) {
                    AWCAccordionAppearanceScope(AWCAccordionAppearance.fromValues(spec.optJSONObject("group")?.toMap() ?: emptyMap())) {
                    AWCAccordionItemAppearanceScope(AWCAccordionItemAppearance.fromValues(spec.optJSONObject("item")?.toMap() ?: emptyMap())) {
                        AWCInspectionScope(collector) { key(epoch) {
                            AWCComponent("md-accordion",mapOf<String,AWCValue>("transition" to "none")+spec.getJSONObject("parent").toMap()) { slot-> if(slot=="")
                                listOf("Account settings","Secondary details").forEach { h-> AWCComponent("md-accordion-item",mapOf<String,AWCValue>("headline" to h,"supportingText" to "Supporting caption",
                                    "expanded" to c.getBoolean("expanded"))+(spec.optJSONObject("props")?.toMap() ?: emptyMap())) { if(it=="") AWCSlotText("Expanded content with useful details.") } }
                            }
                        } }
                    } }
                } }
            } } }
        }
        val failures=mutableListOf<String>();var checks=0
        for(c in reference) {
            val id=c.getString("id")
            compose.runOnIdle { case=c;epoch++ };compose.waitForIdle()
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            val root=nodes["component"]!!.bounds
            fun near(label:String,web:Double,native:Double?,tol:Double=.51) { checks++;if(native==null || abs(web-native)>tol) failures+="$id $label Web=$web Android=$native" }
            fun rect(label:String,web:JSONObject,nodeID:String) { val n=nodes[nodeID]?.bounds
                near("$label.x",web.getDouble("x"),n?.let { it.x-root.x });near("$label.y",web.getDouble("y"),n?.let { it.y-root.y })
                near("$label.width",web.getDouble("width"),n?.width);near("$label.height",web.getDouble("height"),n?.height) }
            rect("root",c.getJSONObject("root").getJSONObject("rect"),"component")
            rect("item",c.getJSONObject("item").getJSONObject("rect"),"component.item-0")
            val parts=c.getJSONObject("parts")
            for(name in parts.keys()) { if(name.startsWith("chassis")) continue
                val p=parts.getJSONObject(name);val r=p.getJSONObject("rect")
                if(r.getDouble("width")==0.0 && r.getDouble("height")==0.0) { checks++;if(nodes["component.item-0.$name"]!=null) failures+="$id $name must be absent";continue }
                rect(name,r,"component.item-0.$name") }
            // ---- pixels (canvas origin = root - 24dp) ----
            val image=compose.onNodeWithTag("canvas").captureToImage();val pixels=image.toPixelMap()
            val ox=root.x-24;val oy=root.y-24
            fun at(x:Double,y:Double)=pixels[((x+24)*2).toInt().coerceIn(0,pixels.width-1),((y+24)*2).toInt().coerceIn(0,pixels.height-1)].channels()
            fun same(label:String,expected:List<Double>,actual:List<Double>,limit:Double=.03) { checks++
                if((0..2).any { abs(expected[it]-actual[it])>limit }) failures+="$id $label expected=${expected.take(3).map { "%.3f".format(it) }} actual=${actual.take(3).map { "%.3f".format(it) }}" }
            val item=c.getJSONObject("item");val ir=item.getJSONObject("rect");val ist=item.getJSONObject("style")
            val itemLayers=shadows(ist.getString("boxShadow"))
            val rootStyle=c.getJSONObject("root").getJSONObject("style")
            val chassisLayers=shadows(rootStyle.getString("boxShadow"))
            val outlined=c.getJSONObject("spec").getJSONObject("parent").optString("variant")=="outlined"
            val behind=if(outlined) over(css(rootStyle.getString("backgroundColor")),page) else page
            val hostColor=over(css(ist.getString("backgroundColor")),behind)
            val header=parts.getJSONObject("header");val hr=header.getJSONObject("rect")
            val headerBackground=css(header.getJSONObject("style").getString("backgroundColor"))
            // Inset layers paint above the item surface and below its children (blur 0 here);
            // `edge` is the sample's distance to the nearest item edge.
            fun insetAt(base:List<Double>,edge:Double):List<Double> { var col=base
                for(l in itemLayers.filter { it.inset }.asReversed()) if(edge<l.spread) col=over(listOf(l.color[0],l.color[1],l.color[2],l.color[3]),col);return col }
            val headerColor=over(headerBackground,insetAt(hostColor,30.0))
            val midY=if(c.getBoolean("expanded")) ir.getDouble("y")+hr.getDouble("height")+(ir.getDouble("height")-hr.getDouble("height"))/2 else hr.getDouble("y")+hr.getDouble("height")/2
            val surfaceExpected=if(c.getBoolean("expanded")) insetAt(hostColor,4.0) else over(headerBackground,insetAt(hostColor,4.0))
            same("surface",surfaceExpected,at(ir.getDouble("x")+40,if(c.getBoolean("expanded")) ir.getDouble("y")+ir.getDouble("height")-4 else hr.getDouble("y")+hr.getDouble("height")-4))
            if(itemLayers.any { it.inset }) same("inset band",over(if(c.getBoolean("expanded")) listOf(0.0,0.0,0.0,0.0) else headerBackground,insetAt(hostColor,3.0)),at(ir.getDouble("x")+3.25,midY))
            same("header",over(headerBackground,insetAt(hostColor,3.25)),at(hr.getDouble("x")+hr.getDouble("width")/2,hr.getDouble("y")+3.25))
            fun ink(label:String,part:String,color:String,background:List<Double>) { val r=parts.optJSONObject(part)?.getJSONObject("rect") ?: return
                if(r.getDouble("width")==0.0) return
                val target=over(css(color),background);var nearest=1.0
                for(y in ((r.getDouble("y")+24)*2).toInt() until ((r.getDouble("y")+r.getDouble("height")+24)*2).toInt()) for(x in ((r.getDouble("x")+24)*2).toInt() until ((r.getDouble("x")+r.getDouble("width")+24)*2).toInt()) {
                    val v=pixels[x.coerceIn(0,pixels.width-1),y.coerceIn(0,pixels.height-1)].channels();nearest=min(nearest,(0..2).maxOf { abs(v[it]-target[it]) }) }
                checks++;if(nearest>.08) failures+="$id $label ink absent (nearest ${"%.3f".format(nearest)})" }
            ink("headline","headline",parts.getJSONObject("headline").getJSONObject("style").getString("color"),headerColor)
            ink("supporting","supporting-text",parts.getJSONObject("supporting-text").getJSONObject("style").getString("color"),headerColor)
            ink("trailing","trailing-icon",parts.getJSONObject("trailing-icon").getJSONObject("style").getString("color"),headerColor)
            if(c.getBoolean("expanded")) ink("body","content-inner",parts.getJSONObject("content-inner").getJSONObject("style").getString("color"),insetAt(hostColor,20.0))
            // Leading glyph FILL axis: the heart's centre is ink only when filled (expanded).
            c.optJSONObject("glyph")?.let { g-> val r=g.getJSONObject("rect")
                val center=at(r.getDouble("x")+r.getDouble("width")/2,r.getDouble("y")+r.getDouble("height")*.45)
                val icon=over(css(g.getJSONObject("style").getString("color")),headerColor)
                val filled=g.getJSONObject("style").getString("fontVariationSettings").contains("\"FILL\" 1")
                checks++;val d=(0..2).maxOf { abs(center[it]-icon[it]) };val e=(0..2).maxOf { abs(center[it]-headerColor[it]) }
                if(filled && d>.08 || !filled && e>.08) failures+="$id glyph FILL=${if(filled) 1 else 0} centre pixel ${center.take(3)} icon=${icon.take(3)} header=${headerColor.take(3)}" }
            // Outer shadows: analytic CSS Gaussian profile at the item's (or chassis') right edge.
            fun profile(label:String,layers:List<Layer>,box:JSONObject) {
                if(layers.none { !it.inset }) { same("$label no shadow",page,at(box.getDouble("x")+box.getDouble("width")+3.25,box.getDouble("y")+box.getDouble("height")/2),.012);return }
                for(d in listOf(.75,2.25,4.75,8.25)) {
                    val px=box.getDouble("x")+box.getDouble("width")+d;val py=box.getDouble("y")+box.getDouble("height")/2
                    if(px>=box.getDouble("x")+box.getDouble("width")+23) continue
                    same("$label shadow +${d}",outer(layers,box,px,py,page),at(px,py),.035) } }
            if(outlined) profile("chassis",chassisLayers,c.getJSONObject("root").getJSONObject("rect")) else profile("item",itemLayers,ir)
            if(id.matches(Regex("light-(filled|outlined)-(e0|e3|custom)-(true|false)|light-(inset|mixed)-shadow-true|dark-filled-e5-true|light-icon-default-(true|false)"))) AccordionEvidence.png("appearance-$id",image)
        }
        AccordionEvidence.log("appearance",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size))
        assertEquals(76,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(200).joinToString("\n"),failures.isEmpty())
    }
}

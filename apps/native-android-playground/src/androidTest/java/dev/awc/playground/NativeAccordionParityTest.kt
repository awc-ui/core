package dev.awc.playground

import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.css
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.over
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * The dedicated Compose renderer against the actual Chrome capture of the source
 * reference matrix (outputs/native-parity/md-accordion/web-{light,dark}.json).
 * Floating fixtures are excluded: floating mode is outside this renderer checkpoint.
 */
class NativeAccordionParityTest {
    @get:Rule val compose=createComposeRule()
    private val tolerance=.51
    private fun fixtures(theme:String)=AccordionWebFixtures.document("AccordionWeb-$theme.json").getJSONArray("fixtures").objects()
        .filter { it.getJSONObject("config").optJSONObject("parent")?.optBoolean("floating")!=true }

    @Test fun webGeometry124ConfigurationsMatchRootItemsAndEveryRenderedPart() {
        val host=AccordionFixtureHost(2f)
        compose.setContent { host.Content() }
        val failures=mutableListOf<String>();var configurations=0;var checks=0
        for(theme in listOf("light","dark")) for(f in fixtures(theme)) {
            val config=f.getJSONObject("config");val id="$theme/${config.getString("id")}"
            compose.runOnIdle { host.load(config,theme) };compose.waitForIdle()
            configurations++
            fun near(label:String,web:Double,native:Double) { checks++;if(abs(web-native)>tolerance) failures+="$id $label Web=$web Android=${"%.3f".format(native)}" }
            fun rect(label:String,web:JSONObject,id2:String,allowMissing:Boolean=false) {
                val n=host.node(id2)
                if(n==null) { if(!allowMissing) failures+="$id missing $label";return }
                near("$label.x",web.getDouble("x"),n.bounds.x-host.originX);near("$label.y",web.getDouble("y"),n.bounds.y-host.originY)
                near("$label.width",web.getDouble("width"),n.bounds.width);near("$label.height",web.getDouble("height"),n.bounds.height)
            }
            rect("root",f.getJSONObject("root").getJSONObject("rect"),"component")
            f.getJSONArray("items").objects().forEachIndexed { i,item->
                rect("item$i",item.getJSONObject("rect"),"component.item-$i")
                for(part in item.getJSONArray("parts").objects()) {
                    val name=part.getString("name")
                    if(name.startsWith("chassis-handle")) continue
                    val hidden=part.getJSONObject("style").getString("display")=="none"
                    val nodeID="component.item-$i.$name"
                    if(hidden) { checks++;if(host.node(nodeID)!=null) failures+="$id $name must be absent (display:none)";continue }
                    rect("item$i.$name",part.getJSONObject("rect"),nodeID)
                }
            }
        }
        AccordionEvidence.log("geometry",JSONObject().put("configurations",configurations).put("checks",checks).put("failures",failures.size).put("tolerance",tolerance))
        assertEquals(124,configurations)
        assertTrue("${failures.size} of $checks geometry checks failed:\n"+failures.take(150).joinToString("\n"),failures.isEmpty())
    }

    @Test fun webPaint124ConfigurationsSampleHostHeaderAndHeadlinePixels() {
        val host=AccordionFixtureHost(2f)
        compose.setContent { host.Content() }
        val failures=mutableListOf<String>();var configurations=0;var checks=0
        for(theme in listOf("light","dark")) for(f in fixtures(theme)) {
            val config=f.getJSONObject("config");val id="$theme/${config.getString("id")}"
            compose.runOnIdle { host.load(config,theme) };compose.waitForIdle()
            configurations++
            val image=compose.onNodeWithTag("canvas").captureToImage()
            val pixels=image.toPixelMap()
            if(config.getString("id").matches(Regex("(filled|outlined)-d0-(open|closed)|icons-(ltr|rtl)|disabled-ltr|reorder-rtl|shapes-colors|outlined-overrides"))) AccordionEvidence.png("paint-$theme-${config.getString("id")}",image)
            val page=host.surface.channels()
            fun sample(x:Double,y:Double)=pixels[(x*2).toInt().coerceIn(0,pixels.width-1),(y*2).toInt().coerceIn(0,pixels.height-1)].channels()
            fun same(label:String,expected:List<Double>,actual:List<Double>,limit:Double=.025) { checks++
                val delta=(0..2).maxOf { abs(expected[it]-actual[it]) }
                if(delta>limit) failures+="$id $label expected=${expected.take(3).map { "%.3f".format(it) }} actual=${actual.take(3).map { "%.3f".format(it) }}" }
            f.getJSONArray("items").objects().forEachIndexed { i,item->
                val r=item.getJSONObject("rect")
                val parts=item.getJSONArray("parts").objects().associateBy { it.getString("name") }
                val hostColor=over(css(item.getJSONObject("style").getString("backgroundColor")),page)
                same("item$i.host",hostColor,sample(r.getDouble("x")+12,r.getDouble("y")+r.getDouble("height")-6))
                val header=parts.getValue("header");val hr=header.getJSONObject("rect")
                val headerColor=over(css(header.getJSONObject("style").getString("backgroundColor")),hostColor)
                same("item$i.header",headerColor,sample(hr.getDouble("x")+hr.getDouble("width")/2,hr.getDouble("y")+4))
                val headline=parts.getValue("headline");val b=headline.getJSONObject("rect")
                val ink=over(css(headline.getJSONObject("style").getString("color")),headerColor)
                var nearest=1.0
                for(y in (b.getDouble("y")*2).toInt() until ((b.getDouble("y")+b.getDouble("height"))*2).toInt().coerceAtMost(pixels.height))
                    for(x in (b.getDouble("x")*2).toInt() until ((b.getDouble("x")+b.getDouble("width"))*2).toInt().coerceAtMost(pixels.width)) {
                        val v=pixels[x,y].channels();nearest=minOf(nearest,(0..2).maxOf { abs(v[it]-ink[it]) }) }
                checks++;if(nearest>.07) failures+="$id item$i headline ink absent nearest=${"%.3f".format(nearest)}"
            }
        }
        AccordionEvidence.log("paint",JSONObject().put("configurations",configurations).put("checks",checks).put("failures",failures.size))
        assertEquals(124,configurations)
        assertTrue("${failures.size} of $checks paint checks failed:\n"+failures.take(150).joinToString("\n"),failures.isEmpty())
    }
}

package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** Shared harness for the actual Chrome captures of the md-accordion reference matrix. */
internal object AccordionWebFixtures {
    fun document(name:String)=InstrumentationRegistry.getInstrumentation().context.assets.open(name).bufferedReader().use { JSONObject(it.readText()) }
    /** Independent CSS cubic-bezier evaluation (x solved by bisection). */
    fun cubic(x:Double,curve:List<Double>):Double {
        if(x<=0) return 0.0
        if(x>=1) return 1.0
        fun b(t:Double,p1:Double,p2:Double)=3*(1-t)*(1-t)*t*p1+3*(1-t)*t*t*p2+t*t*t
        var lo=0.0;var hi=1.0
        repeat(80) { val t=(lo+hi)/2;if(b(t,curve[0],curve[2])<x) lo=t else hi=t }
        return b((lo+hi)/2,curve[1],curve[3])
    }
    fun JSONArray.objects()=(0 until length()).map { getJSONObject(it) }
    /** Structural JSON equality (Android's org.json has no similar()); numbers compare as Double. */
    fun normalize(value:Any?):Any? = when(value) {
        is JSONObject->value.keys().asSequence().associateWith { normalize(value.get(it)) }
        is JSONArray->(0 until value.length()).map { normalize(value.get(it)) }
        is Number->value.toDouble();JSONObject.NULL->null;else->value
    }
    fun JSONObject.toMap():Map<String,AWCValue> = keys().asSequence().associateWith { k -> native(get(k)) }
    /** JSON to native AWCValue: objects to maps and arrays to lists, recursively. */
    fun native(v:Any?):AWCValue = when(v) { is JSONObject->v.toMap();is JSONArray->(0 until v.length()).map { native(v.get(it)) };JSONObject.NULL->null;else->v }
    /** CSS computed colors: rgb(), rgba() and color(srgb r g b / a). Channels 0..1. */
    fun css(value:String):List<Double> {
        val n=Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(value).map { it.value.toDouble() }.toList()
        return if(value.startsWith("color(srgb")) listOf(n[0],n[1],n[2],n.getOrElse(3) { 1.0 }) else listOf(n[0]/255,n[1]/255,n[2]/255,n.getOrElse(3) { 1.0 })
    }
    /** Composite of a computed CSS box-shadow list at a point outside the box (analytic Gaussian, sigma=blur/2). */
    fun outerShadow(css:String,x:Double,y:Double,w:Double,h:Double,px:Double,py:Double,base:List<Double>):List<Double> {
        if(css=="none") return base
        fun phi(z:Double):Double { val a=kotlin.math.abs(z)/kotlin.math.sqrt(2.0);val t=1/(1+.3275911*a)
            val erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*kotlin.math.exp(-a*a);return .5*(1+kotlin.math.sign(z)*erf) }
        var c=base
        for(layer in css.split(Regex(",(?![^(]*\\))")).asReversed()) {
            val text=layer.trim();if(text.contains("inset")) continue
            val color=Regex("rgba?\\([^)]*\\)").find(text)!!.value;val rgba=css(color)
            val n=text.replace(color,"").trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDouble() }
            val dx=n[0];val dy=n[1];val blur=n.getOrElse(2) { 0.0 };val spread=n.getOrElse(3) { 0.0 }
            val x1=x+dx-spread;val x2=x+w+dx+spread;val y1=y+dy-spread;val y2=y+h+dy+spread
            val cov=if(blur<=0) (if(px in x1..x2 && py in y1..y2) 1.0 else 0.0) else { val s=blur/2;(phi((x2-px)/s)-phi((x1-px)/s))*(phi((y2-py)/s)-phi((y1-py)/s)) }
            c=over(listOf(rgba[0],rgba[1],rgba[2],rgba[3]*cov),c)
        }
        return c
    }
    fun over(top:List<Double>,bottom:List<Double>)=listOf(top[0]*top[3]+bottom[0]*(1-top[3]),top[1]*top[3]+bottom[1]*(1-top[3]),top[2]*top[3]+bottom[2]*(1-top[3]),1.0)
    fun Color.channels()=listOf(red.toDouble(),green.toDouble(),blue.toDouble(),alpha.toDouble())
    fun px(css:String?)=css?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun insets(css:String?):AWCAccordionInsets? {
        val v=css?.trim()?.split(Regex("\\s+"))?.map { px(it) ?: return null } ?: return null
        return when(v.size) { 1->AWCAccordionInsets(v[0],v[0]);2->AWCAccordionInsets(v[0],v[1]);3->AWCAccordionInsets(v[0],v[1],v[2],v[1]);4->AWCAccordionInsets(v[0],v[1],v[2],v[3]);else->null }
    }
    private fun shadows(css:String?):List<AWCBoxShadow>? = css?.split(Regex(",(?![^(]*\\))"))?.map { layer ->
        val t=layer.trim().split(Regex("\\s+"));val inset=t.firstOrNull()=="inset";val values=if(inset) t.drop(1) else t
        val color=values.last();val n=values.dropLast(1).map { px(it)!! }
        AWCBoxShadow(n[0],n[1],n.getOrElse(2) { 0.0 },n.getOrElse(3) { 0.0 },color,inset)
    }
    /** Maps the source custom properties used by the matrix onto native hooks. */
    fun groupAppearance(styles:JSONObject?):AWCAccordionAppearance {
        val s=styles ?: return AWCAccordionAppearance()
        fun v(k:String)=s.optString(k).takeIf { it.isNotEmpty() }
        return AWCAccordionAppearance(gap=px(v("--md-accordion-gap")),outlineColor=v("--md-accordion-outline-color"),
            containerShape=px(v("--md-accordion-container-shape"))?.let { AWCCornerShape.uniform(it) },elevation=shadows(v("--md-accordion-elevation")))
    }
    fun itemAppearance(styles:JSONObject?):AWCAccordionItemAppearance {
        val s=styles ?: return AWCAccordionItemAppearance()
        fun v(k:String)=s.optString("--md-accordion-item-$k").takeIf { it.isNotEmpty() }
        return AWCAccordionItemAppearance(containerColor=v("container-color"),containerColorExpanded=v("container-color-expanded"),
            headerColor=v("header-color"),headerColorExpanded=v("header-color-expanded"),headlineColor=v("headline-color"),headlineColorExpanded=v("headline-color-expanded"),
            supportingColor=v("supporting-color"),iconColor=v("icon-color"),iconColorExpanded=v("icon-color-expanded"),
            containerShape=px(v("container-shape"))?.let { AWCCornerShape.uniform(it) },containerShapeExpanded=px(v("container-shape-expanded"))?.let { AWCCornerShape.uniform(it) },
            headerPadding=insets(v("header-padding")),contentPadding=insets(v("content-padding")),headerMinHeight=px(v("header-min-height")))
    }
    fun groupProps(config:JSONObject):Map<String,AWCValue> = mapOf<String,AWCValue>("transition" to "none")+(config.optJSONObject("parent")?.toMap() ?: emptyMap())
    fun itemProps(config:JSONObject,index:Int):Map<String,AWCValue> = mapOf<String,AWCValue>("headline" to if(index==1) "Secondary details" else "Account settings",
        "supportingText" to if(config.optBoolean("supporting")) "Supporting caption" else "")+(config.optJSONObject("item")?.toMap() ?: emptyMap())
    fun body(config:JSONObject)=if(config.optBoolean("long")) "Content line. ".repeat(70) else "Expanded content with useful details."
}

/** Evidence written by the device tests: logcat (tag AWCAccordion) plus files pulled by the job runner. */
internal object AccordionEvidence {
    private val dir get()=java.io.File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"accordion").apply { mkdirs() }
    fun log(name:String,json:JSONObject) { android.util.Log.i("AWCAccordion","$name ${json}");java.io.File(dir,"$name.json").writeText(json.toString(1)) }
    fun png(name:String,image:androidx.compose.ui.graphics.ImageBitmap) {
        val folder=java.io.File(dir,"png").apply { mkdirs() }
        java.io.FileOutputStream(java.io.File(folder,"$name.png")).use { image.asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
    }
}

/** A mutable two-item reference group, recreated for each fixture. */
internal class AccordionFixtureHost(val density:Float) {
    var config by mutableStateOf(JSONObject("{\"id\":\"init\",\"parent\":{},\"item\":{}}"))
    var dark by mutableStateOf(false)
    var reduced by mutableStateOf<Boolean?>(false)
    var epoch by mutableIntStateOf(0)
    var groupOverride by mutableStateOf<Map<String,AWCValue>>(emptyMap())
    var itemOverride by mutableStateOf<List<Map<String,AWCValue>>>(listOf(emptyMap(),emptyMap()))
    var groupHooks by mutableStateOf<AWCAccordionAppearance?>(null)
    var itemHooks by mutableStateOf<AWCAccordionItemAppearance?>(null)
    var bodyOverride by mutableStateOf<String?>(null)
    val collector=AWCInspectionCollector()
    val events=mutableListOf<Pair<String,AWCValue>>()
    var originX=0.0;var originY=0.0
    var surface=Color.White
    fun load(next:JSONObject,theme:String) { config=next;dark=theme=="dark";groupOverride=emptyMap();itemOverride=listOf(emptyMap(),emptyMap());groupHooks=null;itemHooks=null;bodyOverride=null;events.clear();epoch++ }
    @Composable fun Content() {
        val c=config
        val width=c.optDouble("width",400.0)
        CompositionLocalProvider(LocalDensity provides Density(density,1f),LocalLayoutDirection provides if(c.optString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme(dark) { AWCAccessibilityAppearanceScope(reducedMotion=reduced) {
                surface=MaterialTheme.colorScheme.surface
                Box(Modifier.requiredWidth(width.dp).background(MaterialTheme.colorScheme.surface).testTag("canvas")
                    .onGloballyPositioned { originX=it.positionInRoot().x/density.toDouble();originY=it.positionInRoot().y/density.toDouble() }) {
                    run { AWCDensityScope(c.optDouble("inheritedDensity",0.0)) {
                        AWCAccordionAppearanceScope(groupHooks ?: AccordionWebFixtures.groupAppearance(c.optJSONObject("styles"))) {
                        AWCAccordionItemAppearanceScope(itemHooks ?: AccordionWebFixtures.itemAppearance(c.optJSONObject("styles"))) {
                            AWCInspectionScope(collector) { key(epoch) {
                                AWCComponent("md-accordion",AccordionWebFixtures.groupProps(c)+groupOverride,onEvent={ n,v->events+=n to v }) { slot->
                                    if(slot=="") for(i in 0..1) AWCComponent("md-accordion-item",AccordionWebFixtures.itemProps(c,i)+itemOverride[i],onEvent={ n,v->events+="item$i:$n" to v }) { name->
                                        when(name) {
                                            ""->AWCSlotText(bodyOverride ?: AccordionWebFixtures.body(c))
                                            "headline"->if(c.optBoolean("slots")) AWCSlotText("Authored headline")
                                            "leading-icon"->if(c.optBoolean("slots")) AWCSlotText("★")
                                            "trailing-icon"->if(c.optBoolean("slots")) AWCSlotText("+")
                                        }
                                    }
                                }
                            } }
                        } }
                    } }
                }
            } }
        }
    }
    fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
}

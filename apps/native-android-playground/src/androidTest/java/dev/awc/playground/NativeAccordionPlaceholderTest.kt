package dev.awc.playground

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.*

/**
 * Drop-placeholder paint against the 24 actual Chrome captures of placeholder.html (DPR 1,
 * trusted CDP mouse input): default, custom (all five hooks) and solid styles × light/dark ×
 * LTR/RTL × filled/outlined, the last item carried 330 px above the group so the top-slot
 * placeholder is unobstructed. Geometry, interior fill, corner ears, the dashed border (per-side
 * dash count, dash length, period, top-side phase and every full dash centre), the borderless
 * edge and all flat pixels of the clip are compared with the source PNGs.
 */
@OptIn(ExperimentalTestApi::class)
class NativeAccordionPlaceholderTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private val outside=Offset(1000f,1500f)
    private fun hooks(style:String)=when(style) {
        "custom"->AWCAccordionAppearance(dropPlaceholderColor="#FFE08280",dropPlaceholderOutlineColor="#C62828",dropPlaceholderOutlineWidth=3.0,dropPlaceholderShape=AWCCornerShape.uniform(20.0),dropPlaceholderOpacity=.7)
        "solid"->AWCAccordionAppearance(dropPlaceholderColor="#80CBC4",dropPlaceholderOutlineWidth=0.0,dropPlaceholderShape=AWCCornerShape.uniform(0.0))
        else->AWCAccordionAppearance()
    }
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }?.bounds

    private class Grid(val w:Int,val h:Int,val v:DoubleArray) {
        fun at(px:Int,py:Int):List<Double> { val i=(py*w+px)*3;return listOf(v[i],v[i+1],v[i+2]) }
        fun flat(px:Int,py:Int,limit:Double):Boolean {
            if(px<1 || py<1 || px+1>=w || py+1>=h) return false
            for(c in 0..2) { var lo=999.0;var hi=-1.0
                for(dy in -1..1) for(dx in -1..1) { val q=v[((py+dy)*w+px+dx)*3+c];lo=min(lo,q);hi=max(hi,q) }
                if(hi-lo>limit) return false }
            return true
        }
    }
    /** The clip as a CSS-pixel grid: each CSS pixel averages its 2×2 device pixels. */
    private fun nativeGrid(map:PixelMap,x:Int,y:Int,w:Int,h:Int):Grid { val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val s=DoubleArray(3);var n=0
            for(yy in 0..1) for(xx in 0..1) { val X=(x+px)*2+xx;val Y=(y+py)*2+yy
                if(X in 0 until map.width && Y in 0 until map.height) { val c=map[X,Y];s[0]+=c.red*255.0;s[1]+=c.green*255.0;s[2]+=c.blue*255.0;n++ } }
            for(c in 0..2) v[(py*w+px)*3+c]=if(n==0) -999.0 else s[c]/n }
        return Grid(w,h,v) }
    private fun webGrid(name:String,w:Int,h:Int):Grid {
        val bmp=InstrumentationRegistry.getInstrumentation().context.assets.open("AccordionWebPlaceholder/$name.png").use { BitmapFactory.decodeStream(it) }
        val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val p=if(px<bmp.width && py<bmp.height) bmp.getPixel(px,py) else 0
            v[(py*w+px)*3]=(p shr 16 and 255).toDouble();v[(py*w+px)*3+1]=(p shr 8 and 255).toDouble();v[(py*w+px)*3+2]=(p and 255).toDouble() }
        return Grid(w,h,v) }
    private fun diff(a:List<Double>,b:List<Double>)=(0..2).maxOf { abs(a[it]-b[it]) }
    /** Dash runs along a line of pixels: where the coverage between fill and ink crosses one half. */
    private fun runs(values:List<List<Double>>,fill:List<Double>,ink:List<Double>):List<Pair<Double,Double>> {
        val den=(0..2).map { fill[it]-ink[it] }
        fun coverage(v:List<Double>):Double { var b=0.0;var w=0.0
            for(c in 0..2) if(abs(den[c])>8) { b+=(fill[c]-v[c])/den[c]*abs(den[c]);w+=abs(den[c]) }
            return if(w==0.0) 0.0 else b/w }
        val out=mutableListOf<Pair<Double,Double>>();var start:Double?=null;var prev=coverage(values[0])
        for(i in values.indices) { val c=coverage(values[i])
            if(prev<.5 && c>=.5) start=i-.5+(.5-prev)/max(1e-9,c-prev)
            if(prev>=.5 && c<.5 && start!=null) { out+=start to i-.5+(prev-.5)/max(1e-9,prev-c);start=null }
            prev=c }
        return out
    }
    private fun slope(centers:List<Double>):Double { val n=centers.size;val mk=(n-1)/2.0;val mc=centers.average()
        return centers.indices.sumOf { (it-mk)*(centers[it]-mc) }/centers.indices.sumOf { (it-mk)*(it-mk) } }

    @Test fun twentyFourChromePlaceholderCapturesMatchFillCornersDashesAndEdges() {
        val reference=AccordionWebFixtures.document("AccordionWebPlaceholder.json").getJSONArray("cases").objects()
        compose.setContent {
            val c=case ?: return@setContent
            CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(c.getString("theme")=="dark") {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                    // The source page: body margin 40 px, main margin-top 420 px, 400 px wide.
                    Box(Modifier.absoluteOffset(40.dp,420.dp).requiredWidth(400.dp)) {
                        AWCAccordionAppearanceScope(hooks(c.getString("style"))) { AWCInspectionScope(collector) { key(epoch) {
                            CompositionLocalProvider(LocalLayoutDirection provides if(c.getString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                AWCComponent("md-accordion",mapOf("reorderable" to true,"transition" to "none","variant" to c.getString("variant"))) { slot-> if(slot=="")
                                    listOf("a","b","c").forEach { id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id)) { if(it=="") Text("Body") } } } }
                            }
                        } } }
                    }
                }
            } }
        }
        var checks=0;val failures=mutableListOf<String>();val report=JSONArray()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        for(c in reference) {
            val name=c.getString("name")
            compose.mainClock.autoAdvance=true
            compose.onRoot().performMouseInput { moveTo(outside) }
            compose.runOnIdle { case=c;epoch++ };compose.waitForIdle()
            // Lift the last item by its grip and carry it 330 px up (trusted mouse input, as the source).
            val grip=node("component.item-2.drag-handle")!!;val p=Offset(((grip.x+grip.width/2)*2).toFloat(),((grip.y+grip.height/2)*2).toFloat())
            compose.onRoot().performMouseInput { moveTo(p);advanceEventTime(100);press();advanceEventTime(100);moveTo(p+Offset(0f,-660f)) }
            compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
            val root=node("component")!!;val ph=node("component.drop-placeholder")
            val clip=c.getJSONObject("clip");val webRoot=c.getJSONObject("root");val w=c.getJSONObject("placeholder")
            val cw=clip.getInt("width");val chh=clip.getInt("height")
            // Clip origin in the native root (CSS px): the root sits where the source root sits in the clip.
            val ox=root.x-webRoot.getDouble("x");val oy=root.y-webRoot.getDouble("y")
            check(abs(root.width-webRoot.getDouble("width"))<=.6 && abs(root.height-webRoot.getDouble("height"))<=.6,"$name root ${root.width}x${root.height} vs $webRoot")
            check(abs(ox-ox.roundToInt())<.01 && abs(oy-oy.roundToInt())<.01,"$name group at whole CSS pixels ($ox,$oy)")
            fun rel(b:AWCInspectionBounds?,web:JSONObject,label:String)=check(b!=null && abs(b.x-ox-web.getDouble("x"))<=.6 && abs(b.y-oy-web.getDouble("y"))<=.6 &&
                abs(b.width-web.getDouble("width"))<=.6 && abs(b.height-web.getDouble("height"))<=.6,"$name $label ${b?.let { "(${it.x-ox},${it.y-oy},${it.width},${it.height})" }} vs $web")
            rel(ph,w.getJSONObject("rect"),"placeholder")
            c.getJSONArray("items").objects().forEachIndexed { i,item-> rel(node("component.item-$i"),item.getJSONObject("rect"),"item ${item.getString("id")}") }
            val nat=nativeGrid(compose.onRoot().captureToImage().toPixelMap(),ox.roundToInt(),oy.roundToInt(),cw,chh);val web=webGrid(name,cw,chh)
            compose.onRoot().performMouseInput { release();moveTo(outside) };compose.waitForIdle()
            val r=w.getJSONObject("rect");val px=r.getDouble("x");val py=r.getDouble("y");val pw=r.getDouble("width");val phh=r.getDouble("height")
            val bw=w.getString("borderWidth").removeSuffix("px").toDouble();val radius=w.getString("radius").removeSuffix("px").toDouble()
            val one=JSONObject().put("case",name)
            // Interior fill: inside the shape, clear of the border by 2 px.
            fun inside(x:Double,y:Double,inset:Double):Boolean {
                val x0=px+inset;val y0=py+inset;val x1=px+pw-inset;val y1=py+phh-inset;val rr=max(0.0,radius-inset)
                if(x<x0 || y<y0 || x>x1 || y>y1) return false
                val cx=if(x<x0+rr) x0+rr else if(x>x1-rr) x1-rr else x;val cy=if(y<y0+rr) y0+rr else if(y>y1-rr) y1-rr else y
                return hypot(x-cx,y-cy)<=rr
            }
            // The outlined chassis clips its content to its own rounded corners (both renderers): those
            // corner squares belong to the chassis, not to the placeholder paint.
            val rx=webRoot.getDouble("x");val ry=webRoot.getDouble("y");val rw0=webRoot.getDouble("width");val rh0=webRoot.getDouble("height")
            fun chassisCorner(x:Int,y:Int)=c.getString("variant")=="outlined" && (x<rx+16 || x>=rx+rw0-16) && (y<ry+16 || y>=ry+rh0-16)
            var n=0;var sum=0.0;var worst=0.0
            for(y in py.toInt() until (py+phh).toInt()) for(x in px.toInt() until (px+pw).toInt()) if(inside(x+.5,y+.5,bw+2) && !chassisCorner(x,y)) {
                val d=diff(web.at(x,y),nat.at(x,y));n++;sum+=d;worst=max(worst,d) }
            check(n>1000 && sum/n<=2.5 && worst<=6,"$name interior fill (mean ${sum/max(n,1)}, max $worst over $n)");one.put("fill",JSONObject().put("n",n).put("mean",sum/max(n,1)).put("max",worst))
            // Corner ears: outside the radius the page (and nothing of the placeholder) shows.
            if(radius>=4) { var e=0;var es=0.0;var em=0.0
                for((sx,sy) in listOf(0 to 0,1 to 0,0 to 1,1 to 1)) for(v in 0 until radius.toInt()) for(u in 0 until radius.toInt()) {
                    val d=hypot(radius-(u+.5),radius-(v+.5));if(d<=radius+1.25) continue
                    val x=if(sx==0) px.toInt()+u else (px+pw).toInt()-1-u;val y=if(sy==0) py.toInt()+v else (py+phh).toInt()-1-v
                    val dd=diff(web.at(x,y),nat.at(x,y));e++;es+=dd;em=max(em,dd) }
                check(e>0 && es/e<=4,"$name corner ears match the source (mean ${es/max(e,1)}, max $em over $e)");one.put("ears",JSONObject().put("n",e).put("mean",es/max(e,1)).put("max",em)) }
            val fillWeb=web.at((px+pw/2).toInt(),(py+phh/2).toInt());val fillNative=nat.at((px+pw/2).toInt(),(py+phh/2).toInt())
            if(bw>0) {
                val mid=floor(bw/2).toInt();val sides=JSONObject();var residualWorst=0.0
                for(side in listOf("top","right","bottom","left")) {
                    fun line(g:Grid)=when(side) {
                        "top"->(px.toInt() until (px+pw).toInt()).map { g.at(it,py.toInt()+mid) }
                        "bottom"->(px.toInt() until (px+pw).toInt()).map { g.at(it,(py+phh).toInt()-1-mid) }
                        "left"->(py.toInt() until (py+phh).toInt()).map { g.at(px.toInt()+mid,it) }
                        else->(py.toInt() until (py+phh).toInt()).map { g.at((px+pw).toInt()-1-mid,it) } }
                    val lw=line(web);val ln=line(nat)
                    val length=if(side=="top" || side=="bottom") pw else phh
                    // Ink: the stroke colour on the straight part of the side (the corner ends show page).
                    val straight=(radius+1).toInt() until (length-radius-1).toInt()
                    val inkW=straight.map { lw[it] }.maxBy { diff(it,fillWeb) };val inkN=straight.map { ln[it] }.maxBy { diff(it,fillNative) }
                    val rw=runs(lw,fillWeb,inkW);val rn=runs(ln,fillNative,inkN)
                    // Dashes on the straight part (by centre) and full dashes clear of the corner arcs.
                    fun onSide(rr:List<Pair<Double,Double>>)=rr.filter { (it.first+it.second)/2 in radius..(length-radius) }
                    fun full(rr:List<Pair<Double,Double>>)=rr.filter { it.first>radius+1 && it.second<length-radius-1 }
                    val sw=onSide(rw);val sn=onSide(rn);val fw=full(rw);val fn=full(rn)
                    check(abs(sw.size-sn.size)<=1,"$name $side dash count ${sn.size} vs ${sw.size} (all runs ${rn.size} vs ${rw.size})")
                    check(fw.isNotEmpty() && fn.isNotEmpty(),"$name $side full dashes (${fn.size} vs ${fw.size})")
                    val side0=JSONObject().put("runsSource",JSONArray(rw.map { JSONArray(listOf(it.first,it.second)) })).put("runsNative",JSONArray(rn.map { JSONArray(listOf(it.first,it.second)) }))
                    sides.put(side,side0)
                    if(fw.isNotEmpty() && fn.isNotEmpty()) {
                        val lenW=fw.map { it.second-it.first }.average();val lenN=fn.map { it.second-it.first }.average()
                        check(abs(lenW-lenN)<=.6,"$name $side dash length $lenN vs $lenW")
                        val cW=fw.map { (it.first+it.second)/2 };val cN=fn.map { (it.first+it.second)/2 }
                        val perW=if(cW.size>=3) slope(cW) else Double.NaN;val perN=if(cN.size>=3) slope(cN) else Double.NaN
                        if(cW.size>=3 && cN.size>=3) check(abs(perW-perN)<=.15,"$name $side dash period $perN vs $perW")
                        if(side=="top") check(abs(cW.first()-cN.minBy { abs(it-cW.first()) })<=.75,"$name top dash phase: first centre ${cN.first()} vs ${cW.first()}")
                        val residual=cW.maxOf { cw0-> cN.minOf { abs(it-cw0) } };residualWorst=max(residualWorst,residual)
                        check(residual<=1.25,"$name $side every source dash centre has a native dash within 1.25 px (worst $residual)")
                        // Dash ink: the stroke colour at full-dash centres.
                        val inkAtW=cW.map { lw[it.roundToInt().coerceIn(0,lw.size-1)] };val inkAtN=cW.map { ln[it.roundToInt().coerceIn(0,ln.size-1)] }
                        val inkDiff=inkAtW.indices.map { diff(inkAtW[it],inkAtN[it]) }.average()
                        check(inkDiff<=6,"$name $side dash ink at source dash centres (mean diff $inkDiff)")
                        side0.put("count",JSONArray(listOf(sn.size,sw.size))).put("full",JSONArray(listOf(fn.size,fw.size))).put("length",JSONArray(listOf(lenN,lenW)))
                            .put("period",JSONArray(listOf(if(perN.isNaN()) JSONObject.NULL else perN,if(perW.isNaN()) JSONObject.NULL else perW)))
                            .put("first",JSONArray(listOf(cN.first(),cW.first()))).put("residual",residual).put("ink",inkDiff)
                    }
                }
                one.put("dashes",sides).put("residualWorst",residualWorst)
            } else {
                // Borderless: the edge row and column are the fill, as in the source.
                var e=0;var es=0.0;var selfW=0.0;var selfN=0.0
                for(x in (px+radius+2).toInt() until (px+pw-radius-2).toInt()) for(y in listOf(py.toInt(),(py+phh).toInt()-1)) if(!chassisCorner(x,y)) {
                    es+=diff(web.at(x,y),nat.at(x,y));selfW=max(selfW,diff(web.at(x,y),fillWeb));selfN=max(selfN,diff(nat.at(x,y),fillNative));e++ }
                check(e>0 && es/e<=2.5 && selfN<=3 && selfW<=3,"$name borderless edge is the fill (mean vs source ${es/max(e,1)}, native edge vs fill $selfN, source $selfW)")
                one.put("edge",JSONObject().put("n",e).put("mean",es/max(e,1)).put("nativeVsFill",selfN).put("sourceVsFill",selfW))
            }
            // Every flat pixel of the clip.
            var fn=0;var bad=0;var fsum=0.0;var fworst=0.0;var at=""
            for(y in 1 until chh-1) for(x in 1 until cw-1) {
                if(!web.flat(x,y,6.0) || !nat.flat(x,y,6.0)) continue
                val d=diff(web.at(x,y),nat.at(x,y));fn++;fsum+=d;if(d>6) bad++
                if(d>fworst) { fworst=d;at="($x,$y) web ${web.at(x,y).map { it.roundToInt() }} native ${nat.at(x,y).map { it.roundToInt() }}" } }
            val coverage=fn.toDouble()/((cw-2)*(chh-2))
            check(coverage>.6,"$name flat pixels cover $coverage of the clip")
            check(bad.toDouble()/max(fn,1)<=.005 && fsum/max(fn,1)<=1.0,"$name flat pixels match the source (mean ${fsum/max(fn,1)}, >6: $bad/$fn, worst $fworst at $at)")
            one.put("flat",JSONObject().put("compared",fn).put("coverage",coverage).put("mean",fsum/max(fn,1)).put("over6",bad).put("worst",fworst).put("worstAt",at))
            report.put(one)
        }
        AccordionEvidence.log("placeholder",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size).put("report",report))
        assertEquals(24,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
}

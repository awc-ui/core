package dev.awc.playground

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
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
 * Floating panel against the actual Chrome captures of floating.html (1200×900 viewport, DPR 1,
 * trusted CDP input): physical viewport placement with zero in-flow footprint, panel surface,
 * radius, clip and elevation, flush items, the chassis grip (default and custom hooks, light/dark,
 * LTR/RTL, filled/outlined, closed/open); 16 chassis drags with real mouse input frame by frame
 * (hover, press, three moves, release, leave) against Chrome's per-frame samples, rendered phase
 * paint and mdDrag* payloads; bring-to-front stacking; narrow viewports; leaving floating mode.
 */
@OptIn(ExperimentalTestApi::class)
class NativeAccordionFloatingTest {
    @get:Rule val compose=createComposeRule()
    private data class Panel(val id:String,val variant:String,val transition:String="none",val x:Double=60.0,val y:Double=80.0,
                             val ids:List<String> = listOf("a","b"),val expanded:Boolean=false,val bring:Boolean=true,val floating:Boolean=true,val tint:String?=null)
    private var panels by mutableStateOf(listOf<Panel>())
    private var style by mutableStateOf("default");private var dark by mutableStateOf(false);private var rtl by mutableStateOf(false)
    private var viewportWidth by mutableStateOf<Double?>(null);private var reduced by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private val collectors=mutableMapOf<String,AWCInspectionCollector>()
    private val groups=mutableMapOf<String,AWCAccordionReorderInspection>()
    private val styles=mutableMapOf<String,AWCAccordionItemStyleInspection>()
    private val events=mutableListOf<Pair<String,Map<*,*>>>()
    private var before=androidx.compose.ui.geometry.Rect.Zero;private var after=androidx.compose.ui.geometry.Rect.Zero
    private val custom=AWCAccordionAppearance(floatingWidth=320.0,floatingBackground="#E3F2FD",floatingElevation=listOf(AWCBoxShadow(0.0,2.0,6.0,0.0,"#0000004D")),
        floatingElevationActive=listOf(AWCBoxShadow(0.0,12.0,24.0,0.0,"#00000059")),floatingRadius=AWCCornerShape.uniform(24.0))
    private val outside=Offset(1000f,1500f)
    private val customItem=AWCAccordionItemAppearance(chassisHandleColor="#D81B60",chassisHandleBackgroundHover="#FFCDD2")

    private fun collector(id:String)=collectors.getOrPut(id) { AWCInspectionCollector() }
    private fun node(panel:String,id:String)=collector(panel).snapshot().nodes.singleOrNull { it.id==id }?.bounds
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(dark) {
        AWCAccessibilityAppearanceScope(reducedMotion=reduced) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                AWCAccordionViewport(if(viewportWidth!=null) Modifier.size(viewportWidth!!.dp,400.dp) else Modifier.fillMaxSize()) {
                    AWCAccordionItemAppearanceScope(if(style=="custom") customItem else AWCAccordionItemAppearance()) {
                        AWCAccordionStyleInspectionScope({ n,i-> styles[n]=i }) { key(epoch) {
                            Column {
                                Box(Modifier.size(24.dp,10.dp).onGloballyPositioned { before=it.boundsInRoot() })
                                for(panel in panels) key(panel.id) {
                                    AWCAccordionAppearanceScope(panel.tint?.let { AWCAccordionAppearance(floatingBackground=it) } ?: if(style=="custom") custom else AWCAccordionAppearance()) {
                                    AWCAccordionReorderInspectionScope({ groups[panel.id]=it }) { AWCInspectionScope(collector(panel.id)) {
                                        CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                            AWCComponent("md-accordion",mapOf("floating" to panel.floating,"variant" to panel.variant,"transition" to panel.transition,
                                                "initialX" to panel.x,"initialY" to panel.y,"bringToFront" to panel.bring),onEvent={ n,v-> if(n.startsWith("mdDrag")) events+=n to (v as Map<*,*>) }) { slot-> if(slot=="")
                                                panel.ids.forEachIndexed { i,id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id,"expanded" to (panel.expanded && i==0))) { if(it=="") Text("Body") } } }
                                            }
                                        }
                                    } } }
                                }
                                Box(Modifier.size(24.dp,10.dp).onGloballyPositioned { after=it.boundsInRoot() })
                            }
                        } }
                    }
                }
            }
        }
    } } } }

    // ---- CSS values ----
    private fun numbers(s:String)=Regex("-?[0-9.]+(?:e-?[0-9]+)?").findAll(s).map { it.value.toDouble() }.toList()
    private fun gamma(c:Double)=if(c<=0.0031308) 12.92*c else 1.055*c.pow(1/2.4)-0.055
    /** rgb()/rgba()/color(srgb …)/oklab(…) → sRGB r,g,b,a in 0…1. */
    private fun color(s:String):List<Double> {
        val n=numbers(s.substringAfter("("))
        return when {
            s.startsWith("rgba")->listOf(n[0]/255,n[1]/255,n[2]/255,n[3])
            s.startsWith("rgb")->listOf(n[0]/255,n[1]/255,n[2]/255,1.0)
            s.startsWith("color(srgb")->listOf(n[0],n[1],n[2],n.getOrElse(3) { 1.0 })
            s.startsWith("oklab")->{ val (L,a,b)=Triple(n[0],n[1],n[2])
                val l=(L+0.3963377774*a+0.2158037573*b).pow(3);val m=(L-0.1055613458*a-0.0638541728*b).pow(3);val q=(L-0.0894841775*a-1.2914855480*b).pow(3)
                listOf(gamma(4.0767416621*l-3.3077115913*m+0.2309699292*q),gamma(-1.2684380046*l+2.6097574011*m-0.3413193965*q),gamma(-0.0041960863*l-0.7034186147*m+1.7076147010*q),n.getOrElse(3) { 1.0 }) }
            else->listOf(0.0,0.0,0.0,0.0)
        }
    }
    private fun Color.c()=listOf(red.toDouble(),green.toDouble(),blue.toDouble(),alpha.toDouble())
    private fun premultiplied(c:List<Double>)=listOf(c[0]*c[3],c[1]*c[3],c[2]*c[3],c[3])
    // ---- pixels: a CSS-pixel grid (each CSS pixel averages its 2×2 device pixels) ----
    private class Grid(val x:Int,val y:Int,val w:Int,val h:Int,val v:DoubleArray) {
        fun at(px:Int,py:Int):List<Double> { val i=((py-y)*w+(px-x))*3;return listOf(v[i],v[i+1],v[i+2]) }
        fun flat(px:Int,py:Int,limit:Double):Boolean {
            if(px-1<x || py-1<y || px+1>=x+w || py+1>=y+h) return false
            for(c in 0..2) { var lo=999.0;var hi=-1.0
                for(dy in -1..1) for(dx in -1..1) { val q=v[((py+dy-y)*w+(px+dx-x))*3+c];lo=min(lo,q);hi=max(hi,q) }
                if(hi-lo>limit) return false }
            return true
        }
    }
    private fun nativeGrid(map:PixelMap,x:Int,y:Int,w:Int,h:Int):Grid { val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val s=DoubleArray(3);var n=0
            for(yy in 0..1) for(xx in 0..1) { val X=(x+px)*2+xx;val Y=(y+py)*2+yy
                if(X in 0 until map.width && Y in 0 until map.height) { val c=map[X,Y];s[0]+=c.red*255.0;s[1]+=c.green*255.0;s[2]+=c.blue*255.0;n++ } }
            for(c in 0..2) v[(py*w+px)*3+c]=if(n==0) -999.0 else s[c]/n }
        return Grid(x,y,w,h,v) }
    private fun webGrid(name:String,clip:JSONObject):Grid {
        val bmp=InstrumentationRegistry.getInstrumentation().context.assets.open("AccordionWebFloating/$name.png").use { BitmapFactory.decodeStream(it) }
        val x=clip.getInt("x");val y=clip.getInt("y");val w=clip.getInt("width");val h=clip.getInt("height");val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val p=if(px<bmp.width && py<bmp.height) bmp.getPixel(px,py) else 0
            v[(py*w+px)*3]=(p shr 16 and 255).toDouble();v[(py*w+px)*3+1]=(p shr 8 and 255).toDouble();v[(py*w+px)*3+2]=(p and 255).toDouble() }
        return Grid(x,y,w,h,v) }
    private fun diff(a:List<Double>,b:List<Double>)=(0..2).maxOf { abs(a[it]-b[it]) }

    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun near(r:androidx.compose.ui.geometry.Rect?,w:JSONObject,label:String,tol:Double=.6)=check(r!=null && abs(r.left-w.getDouble("x"))<=tol && abs(r.top-w.getDouble("y"))<=tol &&
        abs(r.width-w.getDouble("width"))<=tol && abs(r.height-w.getDouble("height"))<=tol,"$label $r vs $w")
    private val dpRect:(dev.awc.nativeui.AWCInspectionBounds?)->androidx.compose.ui.geometry.Rect?={ b-> b?.let { androidx.compose.ui.geometry.Rect(it.x.toFloat(),it.y.toFloat(),(it.x+it.width).toFloat(),(it.y+it.height).toFloat()) } }
    /** Every flat CSS pixel of the source clip against the native pixel at the same viewport position. */
    private fun comparePaint(label:String,web:Grid,nat:Grid):JSONObject {
        var n=0;var bad=0;var sum=0.0;var worst=0.0;var worstAt=""
        for(py in web.y+1 until web.y+web.h-1) for(px in web.x+1 until web.x+web.w-1) {
            if(!web.flat(px,py,6.0) || !nat.flat(px,py,6.0)) continue
            val d=diff(web.at(px,py),nat.at(px,py));n++;sum+=d;if(d>6) bad++
            if(d>worst) { worst=d;worstAt="($px,$py) web ${web.at(px,py).map { it.roundToInt() }} native ${nat.at(px,py).map { it.roundToInt() }}" }
        }
        val coverage=n.toDouble()/max(1,(web.w-2)*(web.h-2));val ratio=bad.toDouble()/max(n,1)
        check(coverage>.6,"$label compared flat pixels cover $coverage of the clip")
        check(ratio<=.005 && sum/max(n,1)<=1.0,"$label flat pixels match the source (mean ${sum/max(n,1)}, >6: $bad/$n, worst $worst at $worstAt)")
        return JSONObject().put("case",label).put("compared",n).put("coverage",coverage).put("mean",sum/max(n,1)).put("over6",bad).put("worst",worst).put("worstAt",worstAt)
    }
    private fun load(list:List<Panel>,s:String="default",theme:Boolean=false,direction:Boolean=false,width:Double?=null) {
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(outside) }
        compose.runOnIdle { style=s;dark=theme;rtl=direction;viewportWidth=width;panels=list;groups.clear();styles.clear();collectors.values.forEach { it.clear() };events.clear();epoch++ }
        compose.waitForIdle()
    }
    private fun chassisValues(ins:AWCAccordionItemStyleInspection,t:Double)=listOf(ins.chassisBarWidth(t)!!,ins.chassisBarOpacity(t)!!)

    // ---- box-shadow blur: σ fitted from the shadow profile below the panel ----
    private data class Layer(val y:Double,val blur:Double,val spread:Double,val alpha:Double)
    private fun layers(css:String)=css.split(Regex(",(?![^(]*\\))")).map { l-> val c=Regex("(rgba?|color)\\([^)]*\\)").find(l)!!.value;val n=numbers(l.replace(c,""))
        Layer(n[1],n[2],n[3],color(c)[3]) }
    private fun phi(z:Double):Double { val a=abs(z)/sqrt(2.0);val t=1/(1+.3275911*a)
        val erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-a*a);return .5*(1+sign(z)*erf) }
    /** Shadow coverage below the bottom edge (rows 0 until 22, centre ±40 columns) against the page at the clip corner. */
    private fun profile(g:Grid,box:JSONObject):List<Double> {
        val page=g.at(g.x+1,g.y+1);val bottom=(box.getDouble("y")+box.getDouble("height")).roundToInt();val cx=(box.getDouble("x")+box.getDouble("width")/2).toInt()
        return (0 until 22).map { k-> var s=0.0;var n=0
            for(x in cx-40..cx+40) { val p=g.at(x,bottom+k);for(ch in 0..2) { s+=1-p[ch]/page[ch];n++ } };s/n }
    }
    /** Least-squares scale k of σ = k·blur/2 for the computed shadow list; 1 means σ = blur/2. */
    private fun fitScale(alpha:List<Double>,list:List<Layer>):Double {
        fun model(k:Double,d:Double)=1-list.fold(1.0) { acc,l-> acc*(1-l.alpha*(if(l.blur<=0) (if(d<l.y+l.spread) 1.0 else 0.0) else phi((l.y+l.spread-d)/(k*l.blur/2)))) }
        var best=1.0;var err=Double.MAX_VALUE;var k=.4
        while(k<=1.8) { val e=alpha.indices.sumOf { (alpha[it]-model(k,it+.5)).pow(2) };if(e<err) { err=e;best=k };k+=.001 }
        return best
    }
    private fun sigma(label:String,web:Grid,nat:Grid,box:JSONObject,shadow:String) {
        val list=layers(shadow);val a=profile(web,box);val b=profile(nat,box)
        val kw=fitScale(a,list);val kn=fitScale(b,list);val worst=a.indices.maxOf { abs(a[it]-b[it]) }
        check(abs(kw-1)<=.1,"$label source shadow profile fits σ = blur/2 (scale $kw)")
        check(abs(kn-1)<=.1 && abs(kn-kw)<=.06,"$label native shadow σ scale $kn vs source $kw")
        check(worst<=.02,"$label shadow coverage profile below the panel (worst ${"%.4f".format(worst)})")
        sigmaReport.put(JSONObject().put("case",label).put("shadow",shadow).put("scaleSource",kw).put("scaleNative",kn).put("worst",worst)
            .put("source",JSONArray(a.map { (it*1e4).roundToInt()/1e4 })).put("native",JSONArray(b.map { (it*1e4).roundToInt()/1e4 })))
    }
    private val sigmaReport=JSONArray()

    @Test fun floatingPanelMatchesChromePaintDragsStackingNarrowAndToggle() {
        content()
        val oracle=AccordionWebFixtures.document("AccordionWebFloating.json")
        var lastZ:Int?=null;var lastWebZ:Int?=null
        // ---- paint ----
        for(c in oracle.getJSONArray("paint").objects()) {
            val name=c.getString("name")
            load(listOf(Panel("accordion",c.getString("variant"),expanded=c.getBoolean("expanded"))),c.getString("style"),c.getString("theme")=="dark",c.getString("direction")=="rtl")
            val g=groups.getValue("accordion");val ins=styles.getValue("a")
            near(dpRect(node("accordion","component.floating-panel")),c.getJSONObject("root"),"$name panel at viewport")
            c.getJSONArray("items").objects().forEachIndexed { i,item-> near(dpRect(node("accordion","component.item-$i")),item.getJSONObject("rect"),"$name item ${item.getString("id")}") }
            near(dpRect(node("accordion","component.item-0.chassis-handle")),c.getJSONObject("handle").getJSONObject("rect"),"$name chassis handle")
            near(dpRect(node("accordion","component.item-0.chassis-handle-bar")),c.getJSONObject("bar").getJSONObject("rect"),"$name chassis bar")
            val now=ins.chassisFrameMillis
            check(abs(ins.chassisBarOpacity(now)!!-c.getJSONObject("bar").getDouble("opacity"))<.004,"$name bar opacity ${ins.chassisBarOpacity(now)}")
            val ink=ins.chassisBarColor(now)!!.c();val want=color(c.getJSONObject("bar").getString("background"))
            check((0..2).all { abs(ink[it]-want[it])<.012 },"$name bar colour $ink vs $want")
            val fill=premultiplied(ins.chassisHandleBackground(now)!!.c());val wantFill=premultiplied(color(c.getJSONObject("handle").getString("background")))
            check((0..3).all { abs(fill[it]-wantFill[it])<.012 },"$name handle background $fill vs $wantFill")
            // Bring-to-front on load: one counter step per loaded panel, as the source.
            val z=g.zIndex;val webZ=c.getJSONObject("panel").getString("zIndex").toInt()
            check(z!=null && z>1000 && webZ>1000,"$name raised on load ($z, source $webZ)")
            if(lastZ!=null && z!=null) check(z-lastZ==webZ-lastWebZ!!,"$name load raise step ${z-lastZ} vs ${webZ-lastWebZ!!}")
            lastZ=z;lastWebZ=webZ
            check(abs(after.top-before.bottom)<.5,"$name floating panel leaves the flow (footprint ${after.top-before.bottom})")
            val clip=c.getJSONObject("clip")
            val shot=compose.onRoot().captureToImage().toPixelMap()
            val nat=nativeGrid(shot,clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"));val web=webGrid(name,clip)
            // Rounded overflow clip: outside the radius only blurred shadow and page show, inside the panel.
            val r=c.getJSONObject("panel").getString("radius").removeSuffix("px").toDouble();val box=c.getJSONObject("root")
            val x0=box.getDouble("x");val y0=box.getDouble("y");val x1=x0+box.getDouble("width")-1;val y1=y0+box.getDouble("height")-1
            val corners=JSONArray()
            for((sx,sy) in listOf(1.0 to 1.0,-1.0 to 1.0,1.0 to -1.0,-1.0 to -1.0)) for(f in listOf(.15,.45)) {
                val px=floor(if(sx>0) x0+r*f else x1-r*f).toInt();val py=floor(if(sy>0) y0+r*f else y1-r*f).toInt()
                val a=web.at(px,py);val b=nat.at(px,py);corners.put(JSONArray(listOf(px,py,a.toString(),b.toString())))
                check(diff(a,b)<=(if(f<.3) 8.0 else 6.0),"$name corner ${if(f<.3) "outside" else "inside"} radius at ($px,$py) web $a native $b")
            }
            val bar=c.getJSONObject("bar").getJSONObject("rect");val bx=floor(bar.getDouble("x")+bar.getDouble("width")/2).toInt();val by=(bar.getDouble("y")+1).toInt()
            check(diff(web.at(bx,by),nat.at(bx,by))<=6,"$name grip pill pixel web ${web.at(bx,by)} native ${nat.at(bx,by)}")
            report.put(comparePaint(name,web,nat).put("corners",corners))
            // Shadow σ: on the light page the coverage profile resolves the blur.
            if(c.getString("theme")=="light") sigma(name,web,nat,box,c.getJSONObject("panel").getString("shadow"))
        }
        // ---- drags ----
        for(c in oracle.getJSONArray("drags").objects()) drag(c)
        // ---- stacking, narrow, toggle ----
        for(c in oracle.getJSONArray("stacking").objects()) stacking(c)
        for(c in oracle.getJSONArray("narrow").objects()) {
            val width=c.getDouble("viewport")
            load(listOf(Panel("accordion","filled",x=8.0,y=8.0)),width=width)
            near(dpRect(node("accordion","component.floating-panel")),c.getJSONObject("root"),"viewport $width: panel limited to calc(100vw - 16px)")
        }
        toggle()
        AccordionEvidence.log("floating",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures)).put("report",report).put("sigma",sigmaReport))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }

    private fun drag(c:JSONObject) {
        val name=c.getString("name");val preset=c.getString("transition")
        load(listOf(Panel("accordion",c.getString("variant"),transition=preset)),c.getString("style"),false,c.getString("direction")=="rtl")
        val g=groups.getValue("accordion");val ins=styles.getValue("a")
        val phases=c.getJSONArray("phases").objects();val ev=c.getJSONArray("events").objects()
        check(phases.size==5 && ev.size==6 && ev.map { it.getString("name") }==listOf("mdDragStart","mdDragMove","mdDragMove","mdDragMove","mdDragMove","mdDragEnd"),"$name source record shape")
        val hp=c.getJSONArray("handlePoint");val handle=dpRect(node("accordion","component.item-0.chassis-handle")) ?: error("no chassis handle; nodes ${collector("accordion").snapshot().nodes.map { it.id }}")
        check(abs(handle.center.x-hp.getDouble(0))<=.5 && abs(handle.center.y-hp.getDouble(1))<=.5,"$name handle centre ${handle.center} at source point $hp")
        fun px(x:Double,y:Double)=Offset((x*2).toFloat(),(y*2).toFloat())
        fun point(i:Int)=px(ev[i].getJSONObject("detail").getDouble("clientX"),ev[i].getJSONObject("detail").getDouble("clientY"))
        val hover=px(hp.getDouble(0),hp.getDouble(1))
        data class Step(val label:String,val web:Double,val act:()->Unit)
        // Input at the source's dispatch times (events where recorded, else the phase start).
        val steps=listOf(
            Step("hover",phases[0].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(hover,delayMillis=0) } },
            Step("down",ev[0].getDouble("t")) { compose.onRoot().performMouseInput { press() } },
            Step("move1",ev[1].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(point(1),delayMillis=0) } },
            Step("move2",ev[2].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(point(2),delayMillis=0) } },
            Step("move3",ev[3].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(point(3),delayMillis=0) } },
            // The source harness moves to the release point before releasing (a zero-distance mouseMoved
            // that Chrome delivers as pointermove); Android input drops zero-distance moves, so the
            // same move is injected 0.0005 CSS px away (payload tolerance stays 0.01).
            Step("upmove",ev[4].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(point(4)+Offset(.001f,0f),delayMillis=0) } },
            Step("up",ev[5].getDouble("t")) { compose.onRoot().performMouseInput { release() } },
            Step("leave",phases[4].getDouble("t")) { compose.onRoot().performMouseInput { moveTo(outside,delayMillis=0) } })
        // The source snaps and screenshots each phase after its last sampled frame.
        val snapAt=phases.map { it.getJSONArray("samples").objects().last().getDouble("t") }
        val webT0=steps[0].web
        compose.mainClock.autoAdvance=false
        val clock0=compose.mainClock.currentTime
        data class Frame(val web:Double,val width:Double,val opacity:Double,val color:List<Double>,val tint:List<Double>,val fraction:Double,val x:Double,val y:Double)
        val frames=mutableListOf<Frame>();val shots=mutableListOf<Pair<Int,Grid>>()
        val snapZ=mutableMapOf<Int,Int?>()
        fun snapshot(i:Int) {
            compose.waitForIdle()
            val p=phases[i];val label=p.getString("label");val s=p.getJSONObject("snap")
            near(dpRect(node("accordion","component.floating-panel")),s.getJSONObject("root"),"$name/$label panel")
            s.getJSONArray("items").objects().forEachIndexed { k,item-> near(dpRect(node("accordion","component.item-$k")),item.getJSONObject("rect"),"$name/$label item ${item.getString("id")}") }
            near(dpRect(node("accordion","component.item-0.chassis-handle")),s.getJSONObject("handle").getJSONObject("rect"),"$name/$label handle")
            val b=dpRect(node("accordion","component.item-0.chassis-handle-bar"));val w=s.getJSONObject("bar").getJSONObject("rect")
            check(b!=null && abs(b.center.x-(w.getDouble("x")+w.getDouble("width")/2))<=.5 && abs(b.top-w.getDouble("y"))<=.5 && abs(b.height-w.getDouble("height"))<=.5 && abs(b.width-w.getDouble("width"))<=.6,"$name/$label bar like source $b vs $w")
            check(g.chassisDragging==s.getBoolean("dragging"),"$name/$label panel dragging ${g.chassisDragging} vs ${s.getBoolean("dragging")}")
            if(label=="hover") {
                // Pointing at the grip hovers only the grip: the header shows no hover state layer.
                check(ins.chassisHovered && !ins.hovered && ins.stateOpacity(ins.frameMillis)==0.0,"$name/hover grip hovered (${ins.chassisHovered}) without header hover (${ins.hovered}, state layer ${ins.stateOpacity(ins.frameMillis)})")
            }
            snapZ[i]=g.zIndex
            val clip=p.getJSONObject("clip")
            shots+=i to nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        }
        var nextStep=0;var nextSnap=0;var f=0
        while(nextSnap<5) {
            val elapsed=(compose.mainClock.currentTime-clock0).toDouble()
            while(nextStep<steps.size && elapsed>=steps[nextStep].web-webT0 && steps[nextStep].web<snapAt[nextSnap]) { steps[nextStep].act();nextStep++ }
            if(elapsed>=snapAt[nextSnap]-webT0) { snapshot(nextSnap);nextSnap++;continue }
            compose.mainClock.advanceTimeByFrame();f++
            val web=webT0+(compose.mainClock.currentTime-clock0)
            // Each value as rendered: the chassis tracks at the grip's frame, the elevation at the panel's.
            val tc=ins.chassisFrameMillis;val tp=g.frameMillis
            frames+=Frame(web,ins.chassisBarWidth(tc)!!,ins.chassisBarOpacity(tc)!!,ins.chassisBarColor(tc)!!.c().take(3),premultiplied(ins.chassisHandleBackground(tc)!!.c()),
                g.panelElevation(tp),g.floatingX,g.floatingY)
        }
        for((i,nat) in shots) {
            val p=phases[i];val clip=p.getJSONObject("clip")
            val webShot=webGrid("$name-${p.getString("label")}",clip)
            report.put(comparePaint("$name/${p.getString("label")}",webShot,nat))
            // Resting (hover) and fully lifted (move) panel shadows.
            if(p.getString("label") in setOf("hover","move")) sigma("$name/${p.getString("label")}",webShot,nat,p.getJSONObject("snap").getJSONObject("root"),p.getJSONObject("snap").getJSONObject("panel").getString("shadow"))
        }
        // Bring-to-front raises the panel by one step at drag start and keeps it.
        val webZ={ i:Int-> phases[i].getJSONObject("snap").getJSONObject("panel").getString("zIndex").toInt() }
        check(snapZ[0]!=null && snapZ[1]!=null && (snapZ[1]!!-snapZ[0]!!)==(webZ(1)-webZ(0)),"$name drag start raise ${snapZ[0]}→${snapZ[1]} vs ${webZ(0)}→${webZ(1)}")
        for(i in 2..4) check(snapZ[i]==snapZ[1] && webZ(i)==webZ(1),"$name z-index stays raised in phase $i")
        // mdDrag* payloads: physical viewport client point, panel origin and delta.
        check(events.map { it.first }==ev.map { it.getString("name") },"$name drag events ${events.map { it.first }}")
        for((e,w) in events.zip(ev)) for(k in listOf("clientX","clientY","x","y","dx","dy")) {
            val a=(e.second[k] as Number).toDouble();val b=w.getJSONObject("detail").getDouble(k)
            check(abs(a-b)<.01,"$name ${e.first} $k $a vs $b")
        }
        // Source timings.
        val anims=c.getJSONArray("anims").objects()
        for(a in anims.filter { it.getString("property")=="width" }) {
            val k=numbers(a.getString("easing").substringAfter("("))
            check(abs(ins.chassisSpringDuration-a.getDouble("duration"))<.01 && ins.chassisSpringCurve.size==4 && ins.chassisSpringCurve.zip(k).all { (x,y)-> abs(x-y)<1e-9 },
                "$name grip width timing ${ins.chassisSpringDuration} ${ins.chassisSpringCurve} vs ${a.getDouble("duration")} ${a.getString("easing")}")
        }
        if(preset=="none") check(ins.chassisSpringDuration==0.0 && ins.chassisEffectsDuration==0.0 && g.panelDuration==0.0 && anims.isEmpty(),"$name transition none is instant like source")
        else check(anims.any { it.getString("property")=="width" } && g.panelDuration==200.0 && g.panelCurve==listOf(.34,.8,.34,1.0) && ins.chassisEffectsDuration==200.0 && ins.chassisEffectsCurve==listOf(.34,.8,.34,1.0),
            "$name spring-effects 200 ms (.34,.8,.34,1) for panel elevation and grip effects (${g.panelDuration} ${g.panelCurve}, ${ins.chassisEffectsDuration} ${ins.chassisEffectsCurve})")
        // Per frame: each native value at its frame against Chrome's samples over ±2 frames of scheduling.
        val web=phases.flatMap { it.getJSONArray("samples").objects() }.toMutableList()
        val rest=phases[4].getJSONArray("samples").objects().last();val first=phases[0].getJSONArray("samples").objects().first()
        web.add(0,JSONObject().put("t",webT0).put("barWidth",32.0).put("barOpacity",.45).put("barBackground",rest.getString("barBackground"))
            .put("handleBackground",rest.getString("handleBackground")).put("shadow",first.getString("shadow")).put("x",first.getDouble("x")).put("y",first.getDouble("y")))
        val restShadow=numbers(first.getString("shadow"));val liftShadow=numbers(phases[2].getJSONObject("snap").getJSONObject("panel").getString("shadow"))
        val key=restShadow.indices.maxBy { abs(liftShadow[it]-restShadow[it]) }
        fun fraction(s:JSONObject):List<Double> { val v=numbers(s.getString("shadow"));return listOf(if(v.size==restShadow.size) (v[key]-restShadow[key])/(liftShadow[key]-restShadow[key]) else Double.NaN) }
        fun webValue(read:(JSONObject)->List<Double>,t:Double):Pair<List<Double>,List<Double>> {
            val after=web.indexOfFirst { it.getDouble("t")>=t }
            if(after<0) { val v=read(web.last());return v to v }
            if(after==0) { val v=read(web[0]);return v to v }
            val a=web[after-1];val b=web[after];val ta=a.getDouble("t");val tb=b.getDouble("t");val va=read(a);val vb=read(b)
            // Where Chrome recorded no frame for more than two frames only the monotone envelope is known.
            if(tb-ta>34) return va.zip(vb).map { (x,y)-> min(x,y) } to va.zip(vb).map { (x,y)-> max(x,y) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0
            val v=va.zip(vb).map { (p,q)-> p+(q-p)*x };return v to v
        }
        val props:List<Triple<String,Double,Pair<(JSONObject)->List<Double>,(Frame)->List<Double>>>> = listOf(
            Triple("grip width",.1,Pair({ s-> listOf(s.getDouble("barWidth")) },{ fr-> listOf(fr.width) })),
            Triple("grip opacity",.004,Pair({ s-> listOf(s.getDouble("barOpacity")) },{ fr-> listOf(fr.opacity) })),
            Triple("grip colour",.012,Pair({ s-> color(s.getString("barBackground")).take(3) },{ fr-> fr.color })),
            Triple("handle tint",.012,Pair({ s-> premultiplied(color(s.getString("handleBackground"))) },{ fr-> fr.tint })),
            Triple("panel elevation",.01,Pair(::fraction,{ fr-> listOf(fr.fraction) })),
            Triple("panel position",.01,Pair({ s-> listOf(s.getDouble("x"),s.getDouble("y")) },{ fr-> listOf(fr.x,fr.y) })))
        val compared=JSONObject()
        for((prop,tol,io) in props) {
            val (readWeb,read)=io;var n=0;var worst=0.0;var bad=0
            for(fr in frames) {
                val v=read(fr);val lo=MutableList(v.size) { Double.POSITIVE_INFINITY };val hi=MutableList(v.size) { Double.NEGATIVE_INFINITY }
                var x=fr.web-34
                while(x<=fr.web+34) { val (l,h)=webValue(readWeb,x);for(i in v.indices) { lo[i]=min(lo[i],l[i]);hi[i]=max(hi[i],h[i]) };x+=2.0 }
                val ok=v.indices.all { v[it]>=lo[it]-tol && v[it]<=hi[it]+tol }
                v.indices.forEach { worst=max(worst,max(lo[it]-v[it],v[it]-hi[it])) }
                if(!ok && bad<4) check(false,"$name $prop native $v at web ${"%.1f".format(fr.web)} outside Chrome samples [$lo,$hi]") else checks++
                if(!ok) bad++
                n++
            }
            if(bad>4) check(false,"$name $prop ${bad-4} further frames outside the Chrome envelope")
            val final=read(frames.last());val want=readWeb(web.last())
            check(final.zip(want).all { (a,b)-> abs(a-b)<max(tol,.012) },"$name $prop settles to the source $final vs $want")
            check(n>100,"$name $prop frames compared ($n)");compared.put(prop,JSONObject().put("frames",n).put("worstOutside",worst).put("outside",bad))
        }
        report.put(JSONObject().put("case",name).put("frames",frames.size).put("compared",compared)
            .put("chassisHistory",JSONArray(ins.chassisHistory().map { "${it.property} ${it.start} ${it.duration} ${it.to}" })).put("panelHistory",JSONArray(g.panelHistory().map { "${it.start} ${it.duration} ${it.to}" })))
        compose.mainClock.autoAdvance=true
    }

    private fun stacking(c:JSONObject) {
        // The emulator window is 540 dp wide: the third panel (no bring-to-front, overlapping
        // nothing in the source) is placed at a translated position and compared translated.
        val shift=Offset(-480f,220f)
        load(listOf(Panel("f1","filled",x=40.0,y=40.0,ids=listOf("p","q"),tint="#FF0000"),Panel("f2","outlined",x=140.0,y=90.0,ids=listOf("r","s"),tint="#0000FF"),
            Panel("f3","filled",x=520.0+shift.x,y=40.0+shift.y,ids=listOf("u","v"),bring=false,tint="#00C000")))
        fun z()=listOf("f1","f2","f3").map { groups.getValue(it).zIndex }
        fun webZ(key:String)=c.getJSONArray(key).let { a-> (0 until a.length()).map { a.getString(it).toInt() } }
        fun relative(native:List<Int?>,source:List<Int>,label:String) {
            // A fixed panel without bring-to-front keeps the stylesheet z-index 1000.
            val n=native.map { it ?: 1000 }
            check(native[0]!=null && native[1]!=null && n[1]-n[0]==source[1]-source[0] && n[0]>1000 && source[0]>1000 && (native[2]==null)==(source[2]==1000),"stacking $label z $native relative order like source $source")
        }
        fun probe():List<Double> { compose.waitForIdle();val map=compose.onRoot().captureToImage().toPixelMap();val p=map[500,260];return listOf(p.red*255.0,p.green*255.0,p.blue*255.0) }
        relative(z(),webZ("initial"),"on load")
        val p0=probe();check(diff(p0,listOf(0.0,0.0,255.0))<=3,"stacking on load: the later raised panel paints on top $p0")
        fun drag(id:String) {
            val h=dpRect(node(id,"component.item-0.chassis-handle"))!!;val p=Offset(h.center.x*2,h.center.y*2)
            compose.onRoot().performMouseInput { moveTo(p);press();moveTo(p+Offset(20f,10f));release() };compose.waitForIdle()
        }
        drag("f1");relative(z(),webZ("afterFirst"),"after dragging the first panel")
        val p1=probe();check(diff(p1,listOf(255.0,0.0,0.0))<=3,"stacking: the dragged panel is brought to front $p1")
        drag("f3");relative(z(),webZ("afterNoBring"),"after dragging bring-to-front=false")
        val p2=probe();check(diff(p2,listOf(255.0,0.0,0.0))<=3,"stacking: dragging a panel without bring-to-front does not change the order $p2")
        val rects=c.getJSONArray("rects").objects()
        listOf("f1","f2","f3").forEachIndexed { i,id-> val w=JSONObject(rects[i].toString());if(id=="f3") { w.put("x",w.getDouble("x")+shift.x);w.put("y",w.getDouble("y")+shift.y) }
            near(dpRect(node(id,"component.floating-panel")),w,"stacking $id rect") }
        report.put(JSONObject().put("case","stacking").put("z",JSONArray(z())).put("probe",JSONArray(listOf(p0,p1,p2).map { JSONArray(it) })))
    }

    /** Toggling floating: in flow the panel occupies its slot without z-index; back in, it is re-seeded at initial-x/initial-y without a raise. */
    private fun toggle() {
        load(listOf(Panel("accordion","filled",x=200.0,y=300.0)))
        val g=groups.getValue("accordion");val z0=g.zIndex
        compose.runOnIdle { panels=listOf(panels[0].copy(floating=false)) };compose.waitForIdle()
        val inflow=dpRect(node("accordion","component.item-0"))
        check(node("accordion","component.item-0.chassis-handle")==null,"in-flow accordion has no chassis handle")
        // before/after are root px; inspection bounds are dp.
        check(inflow!=null && abs(inflow.top-before.bottom/2)<.5 && after.top/2>=inflow.top+128,"in-flow accordion occupies its layout slot $inflow between $before and $after (px)")
        check(g.zIndex==null,"in-flow accordion drops its z-index (${g.zIndex})")
        compose.runOnIdle { panels=listOf(panels[0].copy(floating=true)) };compose.waitForIdle()
        val back=dpRect(node("accordion","component.floating-panel"))
        check(back!=null && abs(back.left-200)<.5 && abs(back.top-300)<.5 && abs(back.width-360)<.5,"re-floated panel is re-seeded at initial-x/initial-y $back")
        check(abs(after.top-before.bottom)<.5,"re-floated panel leaves the flow again")
        check(g.zIndex==null && z0!=null && z0>1000,"re-floating does not raise (stylesheet z-index; was $z0, now ${g.zIndex})")
        // Reduced motion: the panel elevation and the grip transitions are instant, as with transition none.
        load(listOf(Panel("accordion","filled",transition="expressive")))
        compose.runOnIdle { reduced=true };compose.waitForIdle()
        val r=groups.getValue("accordion");val ri=styles.getValue("a")
        check(r.panelDuration==0.0 && ri.chassisSpringDuration==0.0 && ri.chassisEffectsDuration==0.0,"reduced motion: instant panel elevation and grip (${r.panelDuration}, ${ri.chassisSpringDuration}, ${ri.chassisEffectsDuration})")
        compose.runOnIdle { reduced=false };compose.waitForIdle()
        check(r.panelDuration==200.0 && ri.chassisSpringDuration==500.0 && ri.chassisEffectsDuration==200.0,"expressive again without reduced motion (${r.panelDuration}, ${ri.chassisSpringDuration}, ${ri.chassisEffectsDuration})")
    }
}

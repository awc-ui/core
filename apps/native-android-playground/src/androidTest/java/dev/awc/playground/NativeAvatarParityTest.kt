package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * md-avatar against Chrome (md-avatar/web-oracle: paint.html, lifecycle.html; DPR 1, 1200×900),
 * through the AWCComponent dispatch: 282 paint cases (size × shape × content × theme × direction,
 * density incl. inherited, custom CSS sizes, every hook together and alone, palette hooks, parts,
 * slots incl. a badge on the host's physical corner), 52 identity cases (initials, palette, role,
 * label) and 4 image lifecycle scripts (load/error/recover, mdLoad/mdError order and payloads).
 */
class NativeAvatarParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"theme\":\"light\",\"direction\":\"ltr\"}"))
    private var props by mutableStateOf<Map<String,Any?>>(emptyMap())
    private var epoch by mutableIntStateOf(0)
    @Volatile private var inspection:Map<String,Any?>?=null
    private val events=mutableListOf<Triple<String,Int,String>>()
    private var step=-1
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun opt(c:JSONObject,k:String)=if(c.has(k) && !c.isNull(k)) c.get(k) else null
    private fun s(c:JSONObject,k:String)=(opt(c,k) as? String).orEmpty()
    private fun px(v:String)=v.removeSuffix("px").toDoubleOrNull()

    private fun length(css:String?)=css?.let { runCatching { AWCSkeletonLength.parse(it) }.getOrNull() }
    private fun appearance(h:JSONObject?):AWCAvatarAppearance { if(h==null) return AWCAvatarAppearance()
        fun v(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCAvatarAppearance(length(v("size")),v("container-color"),v("container-shape")?.let(CardWeb::corners),v("label-color"),v("label-font-family"),length(v("label-font-size")),
            v("label-font-weight")?.toDouble(),length(v("label-letter-spacing")),length(v("icon-size")),v("outline-color"),length(v("outline-width")),
            v("palette-1-container"),v("palette-1-label"),v("palette-2-container"),v("palette-2-label"),v("palette-3-container"),v("palette-3-label"),v("palette-4-container"),v("palette-4-label"),v("palette-5-container"),v("palette-5-label"),v("palette-6-container"),v("palette-6-label"),v("palette-7-container"),v("palette-7-label")) }
    private fun parts(css:String)=when {
        css.contains("part(initials)")->AWCAvatarPartAppearance(initialsColor="#1B5E20",initialsFontSize=AWCSkeletonLength(points=18.0),initialsLetterSpacing=AWCSkeletonLength())
        css.contains("part(icon)")->AWCAvatarPartAppearance(iconColor="#E65100",iconFontSize=AWCSkeletonLength(points=20.0))
        css.contains("part(image)")->AWCAvatarPartAppearance(imagePositionX=0.0,imagePositionY=0.0,imageOpacity=.5)
        else->AWCAvatarPartAppearance() }
    private fun slot(html:String):(@Composable (String)->Unit)? = when {
        html.contains("md-badge")->{ name-> if(name=="") AWCComponent("md-badge",if(html.contains("value=")) mapOf("value" to "3") else emptyMap()) }
        html.contains("★")->{ name-> if(name=="") AWCSlotText("★") }
        else->null }

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val dark=opt(c,"theme")=="dark"
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val r=c.optJSONObject("rect");val x=r?.optDouble("x",40.0) ?: 40.0;val y=r?.optDouble("y",40.0) ?: 40.0
            CompositionLocalProvider(LocalLayoutDirection provides if(opt(c,"direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(x.dp,y.dp)) {
                    AWCAvatarViewportScope(DpSize(1200.dp,900.dp)) { AWCDensityScope((opt(c,"inherit") as? Number)?.toDouble() ?: 0.0) {
                        AWCAvatarAppearanceScope(appearance(c.optJSONObject("hooks"))) { AWCAvatarPartAppearanceScope(parts(s(c,"parts"))) {
                            AWCAvatarInspectionScope({ inspection=it }) {
                                AWCComponent("md-avatar",props,onEvent={ n,d-> events+=Triple(n,step,((d as? Map<*,*>)?.get("src") as? String).orEmpty().take(40)) },content=slot(s(c,"slot")))
                            } } } } }
                }
            }
        } } }
    } } }

    private fun settle() {
        compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        runCatching { compose.waitUntil(5000) { val i=inspection;i!=null && (i["mode"]!="image" || i["image"]!=null) } }
        Thread.sleep(150);compose.waitForIdle()
    }
    /** Text that needs a platform fallback font: anything beyond the Latin ranges of the bundled Roboto. */
    private fun fallback(text:String)=text.codePoints().anyMatch { it>0x24F && it !in 0x2000..0x206F }
    private fun propsOf(c:JSONObject):Map<String,Any?> { val o=c.optJSONObject("props") ?: return emptyMap();return o.keys().asSequence().associateWith { o.get(it) } }
    private fun css(v:String)=CardWeb.color(v)
    private fun rgba(c:Any?)=(c as? Color)?.let { listOf(it.red.toDouble(),it.green.toDouble(),it.blue.toDouble(),it.alpha.toDouble()) } ?: emptyList()
    private fun premultipliedClose(n:List<Double>,w:List<Double>)=n.size==4 && w.size==4 && (0..3).all { i-> abs((if(i<3) n[i]*n[3] else n[3])-(if(i<3) w[i]*w[3] else w[3]))<=.006 }

    /** Glyph ink inside the centred 70 % square (inside every shape, around the initials/icon box). */
    private class Ink(val cx:Double,val cy:Double,val minX:Double,val maxX:Double,val minY:Double,val maxY:Double)
    private fun ink(g:CardWeb.Grid,rect:Rect,fill:List<Double>):Ink? {
        var sx=0.0;var sy=0.0;var n=0.0;var x0=1e9;var x1=-1e9;var y0=1e9;var y1=-1e9
        val half=rect.width*.35;val xa=ceil(rect.center.x-half).toInt();val xb=floor(rect.center.x+half).toInt();val ya=ceil(rect.center.y-half).toInt();val yb=floor(rect.center.y+half).toInt()
        for(py in ya until max(ya,yb)) for(px in xa until max(xa,xb)) { if(px<g.x || py<g.y || px>=g.x+g.w || py>=g.y+g.h) continue
            val v=g.at(px,py);val d=(0..2).maxOf { abs(v[it]-fill[it]) }/255
            if(d>.08) { val w=min(1.0,d*2);sx+=px*w;sy+=py*w;n+=w;x0=min(x0,px.toDouble());x1=max(x1,px.toDouble());y0=min(y0,py.toDouble());y1=max(y1,py.toDouble()) } }
        return if(n<2) null else Ink(sx/n,sy/n,x0,x1,y0,y1)
    }

    /**
     * The run drawn with the device's own fonts where CSS places it: a line box of the label's line height
     * centred in the avatar; a CSS run box (each grapheme's advance plus one letter spacing) centred in it,
     * glyphs from its start edge; the baseline at the primary font's half-leading position. The bundled
     * Roboto face of the label weight (CSS matching: ≤400 Regular, ≤500 Medium, else Bold) falls back to
     * the system fonts exactly as the renderer's does, so fallback glyphs are the device's artwork.
     */
    private fun deviceRun(text:String,a:Map<String,Any?>,box:Rect,clip:JSONObject,fill:List<Double>,line:Double):CardWeb.Grid {
        val cx=clip.getInt("x");val cy=clip.getInt("y");val cw=clip.getInt("width");val ch=clip.getInt("height")
        val fs=a["fontSize"] as Double;val ls=a["letterSpacing"] as Double;val weight=(a["fontWeight"] as Number).toDouble()
        val face=InstrumentationRegistry.getInstrumentation().targetContext.resources.getFont(when {
            weight<=400->dev.awc.nativeui.R.font.awc_roboto_regular;weight<=500->dev.awc.nativeui.R.font.awc_roboto_medium;else->dev.awc.nativeui.R.font.awc_roboto_bold })
        val ink=rgba(a["color"]);fun c8(v:Double)=(v*255).roundToInt().coerceIn(0,255)
        val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { typeface=face;textSize=(fs*2).toFloat();fontFeatureSettings="tnum"
            color=android.graphics.Color.argb(c8(ink[3]),c8(ink[0]),c8(ink[1]),c8(ink[2])) }
        val bmp=android.graphics.Bitmap.createBitmap((cx+cw)*2,(cy+ch)*2,android.graphics.Bitmap.Config.ARGB_8888);val canvas=android.graphics.Canvas(bmp)
        canvas.drawColor(android.graphics.Color.rgb(fill[0].roundToInt(),fill[1].roundToInt(),fill[2].roundToInt()))
        val graphemes=mutableListOf<String>();val bi=android.icu.text.BreakIterator.getCharacterInstance();bi.setText(text)
        var s=bi.first();var e=bi.next();while(e!=android.icu.text.BreakIterator.DONE) { graphemes+=text.substring(s,e);s=e;e=bi.next() }
        val adv=graphemes.map { paint.measureText(it)/2.0 }
        val m=a["labelMetrics"] as List<*>;val asc=(m[0] as Float).toDouble();val desc=(m[1] as Float).toDouble()
        val baseline=box.center.y-line/2+(line-(asc+desc)*fs)/2+asc*fs
        var x=box.center.x-(adv.sum()+graphemes.size*ls)/2
        for((i,g) in graphemes.withIndex()) { canvas.drawText(g,(x*2).toFloat(),(baseline*2).toFloat(),paint);x+=adv[i]+ls }
        return CardWeb.nativeGrid(bmp.asImageBitmap().toPixelMap(),cx,cy,cw,ch)
    }
    /** EmojiCompat as the app has it (Compose uses it when loaded; it replaces only emoji the system font lacks). */
    private fun emojiState():JSONObject = runCatching {
        val k=Class.forName("androidx.emoji2.text.EmojiCompat");val configured=k.getMethod("isConfigured").invoke(null) as Boolean
        val state=if(configured) k.getMethod("getLoadState").invoke(k.getMethod("get").invoke(null)) as Int else -1
        JSONObject().put("present",true).put("configured",configured).put("loadState",state)
    }.getOrElse { JSONObject().put("present",false).put("error",it.javaClass.simpleName) }

    @Test fun avatarMatchesChromePaintIdentityAndLifecycle() {
        content()
        val oracle=CardWeb.document("AvatarWebPaint.json")
        identity(oracle.getJSONArray("identity").objects())
        for(c in oracle.getJSONArray("paint").objects()) paint(c)
        val life=CardWeb.document("AvatarWebLifecycle.json")
        lifecycle(life.getJSONArray("runs").objects(),life.getJSONObject("images"))
        AccordionEvidence.log("avatar-parity",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }

    private fun identity(cases:List<JSONObject>) {
        for(c in cases) { val i=c.getJSONObject("input");val ini=s(i,"initials");val name=s(i,"name");val label=s(i,"label");val alt=s(i,"alt")
            val cfn=(opt(i,"colorFromName") as? Boolean) ?: true
            val text=AWCAvatarIdentity.initials(ini,name,Locale.US);val mode=if(text.isEmpty()) "slot" else "initials"
            check(mode==c.getString("mode"),"identity $i mode $mode vs ${c.getString("mode")}")
            if(mode=="initials") check(text==c.getString("initials"),"identity $i initials $text vs ${c.getString("initials")}")
            val p=AWCAvatarIdentity.palette(ini,name,label,cfn)
            check(p==c.getInt("palette"),"identity $i palette $p vs ${c.getInt("palette")}")
            val l=AWCAvatarIdentity.accessibleLabel(label,alt,name)
            check((if(l==null) "presentation" else "img")==c.getString("role") && (l ?: "")==s(c,"ariaLabel"),"identity $i role/label $l") }
    }

    private fun paint(c:JSONObject) {
        val name=c.getString("name")
        if(c.optBoolean("hidden")) {
            // `:host([hidden]) { display: none }`: the host renders nothing (Chrome: display none, 0x0 box).
            inspection=null;props=propsOf(c)+("hidden" to true);case=c;epoch++;settle()
            check(inspection==null && c.getJSONObject("style").getString("display")=="none","${c.getString("name")} hidden host renders nothing");return }
        if(s(c,"slot").contains("<svg")) return
        inspection=null;props=propsOf(c);case=c;epoch++;settle()
        val a=inspection;if(a==null) { check(false,"$name dispatched to the dedicated renderer");return }
        val r=c.getJSONObject("rect");val wr=Rect(r.getDouble("x").toFloat(),r.getDouble("y").toFloat(),(r.getDouble("x")+r.getDouble("width")).toFloat(),(r.getDouble("y")+r.getDouble("height")).toFloat())
        val b=a["bounds"] as Rect
        check(abs(b.width-wr.width)<=.5 && abs(b.height-wr.height)<=.5 && (wr.width==0f || abs(b.left-wr.left)<=.6 && abs(b.top-wr.top)<=.6),"$name rect $b vs $wr")
        val classes=c.getString("classes").split(" ")
        val mode=classes.firstOrNull { it.startsWith("md-avatar--mode-") }?.removePrefix("md-avatar--mode-") ?: ""
        check(a["mode"]==mode,"$name mode ${a["mode"]} vs $mode")
        val palette=classes.firstOrNull { it.startsWith("md-avatar--palette-") }?.removePrefix("md-avatar--palette-")?.toInt() ?: 0
        check(a["palette"]==palette,"$name palette ${a["palette"]} vs $palette")
        check(a["role"]==c.getString("role") && (a["label"] ?: "")==s(c,"ariaLabel"),"$name role/label ${a["role"]} ${a["label"]}")
        // The bundled fonts carry the source's vertical metrics (hhea), which place the CSS baselines.
        fun metrics(l:Any?,asc:Double,desc:Double)=(l as? List<*>)?.let { abs((it[0] as Float)-asc)<=.002 && abs((it[1] as Float)-desc)<=.002 } ?: false
        if(mode=="initials" && (c.optJSONObject("hooks")?.optString("label-font-family") ?: "").let { it=="" || it=="Roboto" })
            check(metrics(a["labelMetrics"],1900/2048.0,500/2048.0),"$name Roboto ascent/descent ${a["labelMetrics"]}")
        if(mode=="slot") check(metrics(a["iconMetrics"],1056/960.0,96/960.0) && metrics(a["slotMetrics"],1900/2048.0,500/2048.0),"$name symbol/slot font metrics ${a["iconMetrics"]} ${a["slotMetrics"]}")
        val style=c.getJSONObject("style")
        check(premultipliedClose(rgba(a["background"]),css(style.getString("background"))),"$name container ${rgba(a["background"])} vs ${style.getString("background")}")
        if(mode!="image") { val n=rgba(a["color"]);val w=css(style.getString("color"))
            check(n.size==4 && w.size==4 && (0..2).all { abs(n[it]-w[it])<=.006 },"$name label colour $n vs ${style.getString("color")}") }
        val wi=c.optJSONObject("initials")
        if(mode=="initials" && wi!=null) {
            check(a["initials"]==wi.getString("text"),"$name initials ${a["initials"]} vs ${wi.getString("text")}")
            val fs=px(wi.getString("fontSize")) ?: -1.0;val ls=px(wi.getString("letterSpacing")) ?: 0.0
            check(abs((a["fontSize"] as Double)-fs)<=.01 && abs((a["letterSpacing"] as Double)-ls)<=.01,"$name label font ${a["fontSize"]}/${a["letterSpacing"]} vs $fs/$ls")
            val ib=a["initialsBounds"] as Rect;val wrr=wi.getJSONObject("rect");val ww=wrr.getDouble("width")
            val ascii=wi.getString("text").all { it.code<128 }
            if(ww==0.0) check(ib.width<=.5 || (a["fontSize"] as Double)==0.0,"$name zero-size typography paints nothing")
            // Glyphs outside the bundled Roboto come from the platform's fallback fonts (Chrome/macOS:
            // Apple Color Emoji, PingFang…; Android: Noto): their advances are platform data, so only
            // the centring of the run is compared for such runs.
            else if(fallback(wi.getString("text"))) check(abs(ib.center.x-(wrr.getDouble("x")+ww/2))<=.6,"$name initials run centre $ib vs $wrr")
            else check(abs(ib.width-ww)<=(if(ascii) 1.0 else 2.0) && abs(ib.center.x-(wrr.getDouble("x")+ww/2))<=.6,"$name initials run $ib vs $wrr")
        }
        val wIcon=c.optJSONObject("icon")
        if(mode=="slot" && wIcon!=null && wIcon.optString("fontSize")!="") check(abs((a["glyph"] as Double)-(px(wIcon.getString("fontSize")) ?: -1.0))<=.01,"$name icon size ${a["glyph"]} vs ${wIcon.getString("fontSize")}")
        if(wr.width<=0f) return
        val clip=c.getJSONObject("clip");val cx=clip.getInt("x");val cy=clip.getInt("y");val cw=clip.getInt("width");val ch=clip.getInt("height")
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),cx,cy,cw,ch)
        val web=CardWeb.webGrid("AvatarWebPaint/$name.png",clip)
        var n=0;var bad=0;var sum=0.0;var worst=0.0;var at=""
        for(py in cy+1 until cy+ch-1) for(px in cx+1 until cx+cw-1) { if(!web.flat(px,py,6.0) || !nat.flat(px,py,6.0)) continue
            val w=web.at(px,py);val v=nat.at(px,py);val d=(0..2).maxOf { abs(w[it]-v[it]) };n++;sum+=d;if(d>6) bad++
            if(d>worst) { worst=d;at="($px,$py) web ${w.map { it.toInt() }} native ${v.map { Math.round(it) }}" } }
        val mean=sum/max(n,1)
        check(n>20 && bad.toDouble()/n<=.005 && mean<=1.0,"$name flat pixels (mean $mean, >6: $bad/$n, worst $worst at $at)")
        val entry=JSONObject().put("case",name).put("compared",n).put("mean",mean).put("over6",bad).put("worst",worst)
        val slotted=c.optJSONArray("slotted")?.length() ?: 0
        if(mode=="initials" || mode=="slot") {
            val square=s(c.getJSONObject("props"),"shape")=="square"
            val fy=wr.top.toInt()+1+(if(square) 0 else (wr.height*.15).toInt())
            val w=ink(web,wr,web.at(wr.center.x.toInt(),fy));val v=ink(nat,wr,nat.at(wr.center.x.toInt(),fy))
            val platformGlyphs=fallback(if(mode=="initials") wi?.optString("text").orEmpty() else s(c,"slot"))
            if(w!=null && v!=null && platformGlyphs) {
                val family=c.optJSONObject("hooks")?.optString("label-font-family").orEmpty()
                val fill=nat.at(wr.center.x.toInt(),fy)
                val ref=if(mode=="initials" && wi!=null && (family=="" || family=="Roboto"))
                    deviceRun(wi.getString("text"),a,wr,clip,fill,px(wi.optString("lineHeight")) ?: (a["fontSize"] as Double)) else null
                val e=ref?.let { ink(it,wr,it.at(wr.center.x.toInt(),fy)) }
                if(ref!=null) {
                    // Fallback glyphs (emoji, CJK) are the device's font artwork, and Android's emoji font is
                    // updatable (a system font update put NotoColorEmoji 2.051 on emulator-5554; the clones
                    // keep the image's 2.047), so Chrome's centroid (Apple Color Emoji artwork) is reported,
                    // not compared. The reference is the run drawn with the device's own fonts where CSS
                    // places it, so placement is compared strictly whatever revision is installed.
                    check(e!=null && abs(e.cx-v.cx)<=1 && abs(e.cy-v.cy)<=1,"$name fallback-glyph ink centroid (${v.cx},${v.cy}) vs device-font reference (${e?.cx},${e?.cy})")
                    check(e!=null && abs(e.minX-v.minX)<=2 && abs(e.maxX-v.maxX)<=2 && abs(e.minY-v.minY)<=2 && abs(e.maxY-v.maxY)<=2,
                        "$name fallback-glyph ink extent x ${v.minX}…${v.maxX} vs device-font reference ${e?.minX}…${e?.maxX}, y ${v.minY}…${v.maxY} vs ${e?.minY}…${e?.maxY}")
                }
                // The ★ slot's symbol font is a system (not updatable) font: placement against Chrome, within 2.
                else check(abs(w.cx-v.cx)<=2 && abs(w.cy-v.cy)<=2,"$name fallback-glyph ink centroid (${v.cx},${v.cy}) vs (${w.cx},${w.cy})")
                entry.put("ink",JSONObject().put("fallback",true).put("web",JSONArray(listOf(w.cx,w.cy,w.minX,w.maxX,w.minY,w.maxY))).put("native",JSONArray(listOf(v.cx,v.cy,v.minX,v.maxX,v.minY,v.maxY)))
                    .put("reference",e?.let { JSONArray(listOf(it.cx,it.cy,it.minX,it.maxX,it.minY,it.maxY)) }).put("emoji",emojiState()))
            } else if(w!=null && v!=null) {
                // Glyph placement, not glyph shapes: horizontally within one CSS pixel; vertically within 1.5
                // (Chrome snaps text baselines to whole pixels at DPR 1; native renders at 2x) plus 0.25:
                // Android rasterises with FreeType light hinting, which snaps horizontal glyph edges to the
                // device-pixel grid (half a device pixel = 0.25 CSS px at 2x); CoreText and Chrome/macOS do not hint.
                val tol=if(c.optJSONObject("hooks")?.optString("label-font-family")=="monospace") 1.5 else 1.0
                check(abs(w.cx-v.cx)<=tol && abs(w.cy-v.cy)<=1.75,"$name glyph ink centroid (${v.cx},${v.cy}) vs (${w.cx},${w.cy})")
                check(abs(w.minX-v.minX)<=2 && abs(w.maxX-v.maxX)<=2 && abs(w.minY-v.minY)<=2 && abs(w.maxY-v.maxY)<=2,
                    "$name glyph ink extent x ${v.minX}…${v.maxX} vs ${w.minX}…${w.maxX}, y ${v.minY}…${v.maxY} vs ${w.minY}…${w.maxY}")
                entry.put("ink",JSONObject().put("web",JSONArray(listOf(w.cx,w.cy,w.minX,w.maxX,w.minY,w.maxY))).put("native",JSONArray(listOf(v.cx,v.cy,v.minX,v.maxX,v.minY,v.maxY))))
            } else if(wr.width>=16) check((w==null)==(v==null),"$name glyph ink presence agrees (web ${w!=null}, native ${v!=null}, slotted $slotted)")
        }
        report.put(entry)
    }

    private fun lifecycle(runs:List<JSONObject>,images:JSONObject) {
        for(r in runs) {
            val name=r.getString("name");val script=r.getJSONArray("script");val trace=r.getJSONArray("trace")
            inspection=null;events.clear();step=-1;case=JSONObject("{\"name\":\"$name\",\"theme\":\"light\",\"direction\":\"ltr\"}");props=mapOf("size" to "large");epoch++;settle()
            check(script.length()==trace.length()-1,"$name script matches the Chrome trace")
            for(i in 0 until script.length()) {
                val set=script.getJSONArray(i);val key=set.getString(0);val raw=set.get(1)
                val value:Any?=if(key=="src") (raw as String).let { if(it.isEmpty()) "" else images.getString(it) } else raw
                val t=trace.getJSONObject(i+1)
                check(t.getJSONArray("set").getString(0)==key,"$name step $i sets $key")
                step=i;props=props+(key to value);Thread.sleep(50);settle();Thread.sleep(250);compose.waitForIdle()
                val a=inspection;if(a==null) { check(false,"$name step $i measured");continue }
                val w=t.getJSONObject("settled")
                check(a["mode"]==w.getString("mode"),"$name step $i mode ${a["mode"]} vs ${w.getString("mode")}")
                check(a["palette"]==w.getInt("palette"),"$name step $i palette ${a["palette"]} vs ${w.getInt("palette")}")
                check((a["initials"] ?: "")==s(w,"initials"),"$name step $i initials ${a["initials"]}")
                check(a["role"]==w.getString("role") && (a["label"] ?: "")==s(w,"ariaLabel"),"$name step $i role/label")
                check(premultipliedClose(rgba(a["background"]),css(w.getString("background"))),"$name step $i background ${rgba(a["background"])} vs ${w.getString("background")}")
            }
            val web=r.getJSONArray("events").objects().map { Triple(it.getString("name"),it.getInt("step"),it.getJSONObject("detail").getString("src").take(40)) }
            check(events.map { "${it.first}@${it.second}" }==web.map { "${it.first}@${it.second}" },"$name events ${events.map { "${it.first}@${it.second}" }} vs ${web.map { "${it.first}@${it.second}" }}")
            check(events.zip(web).all { (x,y)-> x.third==y.third },"$name event src payloads")
            report.put(JSONObject().put("lifecycle",name).put("events",events.size))
        }
    }
}

package dev.awc.playground

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import dev.awc.nativeui.AWCCornerShape
import dev.awc.nativeui.AWCCornerRadius
import dev.awc.nativeui.AWCCornerLength
import androidx.compose.ui.graphics.vector.PathParser
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.AWCProgressIndicatorAppearance
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.*

/** Compare native path construction with paths captured from the real Web
 * component at paused nonzero phases, not a duplicate of its implementation. */
class NativeProgressPathOracleTest {
    private fun doc(name:String)=InstrumentationRegistry.getInstrumentation().context.assets.open("ProgressWeb-$name.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun map(input:JSONObject):Map<String,Any?> =input.keys().asSequence().associateWith { key->input.get(key).let { if(it===JSONObject.NULL) null else it } }
    @Test fun nativeCurvesMatchEveryPausedWebWavePath() {
        val metricsClass=Class.forName("dev.awc.nativeui.ProgressMetrics")
        val companion=metricsClass.getField("Companion").get(null)
        val from=companion.javaClass.getMethod("from",Map::class.java,AWCProgressIndicatorAppearance::class.java,Double::class.javaPrimitiveType)
        val geometryClass=Class.forName("dev.awc.nativeui.ProgressGeometry");val geometry=geometryClass.getField("INSTANCE").get(null)
        fun call(name:String,vararg values:Any?):Any?=geometryClass.methods.single { it.name==name && it.parameterCount==values.size }.invoke(geometry,*values)
        fun number(metrics:Any,name:String)=(metricsClass.getMethod("get$name").invoke(metrics) as Number).toDouble()
        val failures=mutableListOf<String>();var checked=0
        fun compare(id:String,expected:String,actual:String) {
            if(expected.isEmpty() || actual.isEmpty()) { if(expected.isNotEmpty() || actual.isNotEmpty()) failures+="$id empty path mismatch";return }
            val expectedMeasure=PathMeasure().apply { setPath(PathParser().parsePathString(expected).toPath(),false) }
            val actualMeasure=PathMeasure().apply { setPath(PathParser().parsePathString(actual).toPath(),false) }
            // Both outputs use the same native rasterizer here, isolating source
            // control-point/phase discrepancies from platform antialiasing.
            var error=abs(expectedMeasure.length-actualMeasure.length).toDouble()
            for(i in 0..100) {
                val e=expectedMeasure.getPosition(expectedMeasure.length*i/100);val a=actualMeasure.getPosition(actualMeasure.length*i/100)
                error=max(error,hypot((a.x-e.x).toDouble(),(a.y-e.y).toDouble()))
            }
            if(error>.12) failures+="$id maximum contour/length deviation $error dp"
            checked++
        }
        for(name in listOf("light","edges")) {
            val samples=doc(name).getJSONArray("samples")
            for(si in 0 until samples.length()) {
                val sample=samples.getJSONObject(si);val time=sample.getDouble("time");val entries=sample.getJSONArray("results")
                for(i in 0 until entries.length()) {
                    val entry=entries.getJSONObject(i);val f=entry.getJSONObject("fixture")
                    if(!f.optBoolean("wave") || f.optBoolean("hidden")) continue
                    val m=from.invoke(companion,map(f),AWCProgressIndicatorAppearance(),f.optDouble("inheritedDensity",0.0))
                    val phase=2*PI*number(m,"Speed")/number(m,"Wavelength")*time/1000
                    val fraction=number(m,"Fraction");val amplitude=if(!f.optBoolean("indeterminate") && fraction<=0) 0.0 else 1.0
                    val paths=entry.getJSONArray("paths");val id="$name/${f.getString("id")}/$time"
                    if(f.optString("variant")=="circular") {
                        val spin=call("waveSpin",time)!!
                        val sweep=(spin.javaClass.getMethod("getSweep").invoke(spin) as Number).toDouble()
                        val rotation=if(f.optBoolean("indeterminate")) (spin.javaClass.getMethod("getRotation").invoke(spin) as Number).toDouble() else 0.0
                        val native=call("circular",m,fraction,amplitude,phase,sweep,rotation)!!
                        for(pi in 0 until paths.length()) {
                            val source=paths.getJSONObject(pi).getJSONObject("attributes")
                            val key=when(source.optString("part")) { "active-indicator"->"Active";"track"->"Track";else->continue }
                            compare("$id/$key",source.optString("d"),native.javaClass.getMethod("get$key").invoke(native) as String)
                        }
                    } else if(!f.optBoolean("indeterminate")) {
                        val width=f.optDouble("width",240.0);val fill=fraction*width
                        val rtl=entry.getJSONObject("host").optString("direction")=="rtl"
                        val native=if(fill<=0) "" else call("linear",m,if(rtl) width-fill else 0.0,if(rtl) width else fill,amplitude,phase,true) as String
                        val source=paths.getJSONObject(0).getJSONObject("attributes").optString("d")
                        compare(id,source,native)
                    } else {
                        @Suppress("UNCHECKED_CAST") val bars=call("bars",time,false) as List<Pair<Double,Double>>
                        val width=f.optDouble("width",240.0)
                        for(pi in 0 until min(paths.length(),bars.size)) {
                            val (left,right)=bars[pi];val native=if((right-left)*width<1) "" else call("linear",m,left*width,right*width,amplitude,phase,false) as String
                            compare("$id/bar$pi",paths.getJSONObject(pi).getJSONObject("attributes").optString("d"),native)
                        }
                    }
                }
            }
        }
        assertTrue("Must exercise the full saved nonzero-phase matrix",checked>600)
        assertTrue("$checked native contours checked\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    @Test fun flatCircularSweepRotationAndFourColorsMatchPausedCssFrames() {
        val klass=Class.forName("dev.awc.nativeui.ProgressGeometry");val geometry=klass.getField("INSTANCE").get(null)
        val source=doc("light");val samples=source.getJSONArray("samples");val tokens=source.getJSONObject("tokens")
        val colors=listOf("primary","primary-container","tertiary","tertiary-container").map { android.graphics.Color.parseColor(tokens.getString("--md-sys-color-$it")) }
        val numbers=Regex("[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?")
        for(si in 0 until samples.length()) {
            val sample=samples.getJSONObject(si);val time=sample.getDouble("time");val entries=sample.getJSONArray("results")
            val entry=(0 until entries.length()).map { entries.getJSONObject(it) }.single { it.getJSONObject("fixture").getString("id")=="circular-four-color" }
            val parts=entry.getJSONArray("parts");val active=(0 until parts.length()).map { parts.getJSONObject(it) }.single { it.getString("part")=="active-indicator" }
            val spin=klass.getMethod("flatSpin",Double::class.javaPrimitiveType,Boolean::class.javaPrimitiveType).invoke(geometry,time,false)
            fun scalar(key:String)=(spin.javaClass.getMethod("get$key").invoke(spin) as Number).toDouble()
            assertEquals("Sweep at $time",numbers.find(active.getString("strokeDasharray"))!!.value.toDouble(),scalar("Sweep"),.00002)
            assertEquals("Offset at $time",active.getString("strokeDashoffset").removeSuffix("px").toDouble(),scalar("Offset"),.00002)
            val matrix=numbers.findAll(entry.getJSONArray("svgs").getJSONObject(0).getString("transform")).map { it.value.toDouble() }.toList()
            if(matrix.size==6) {
                assertEquals(cos(scalar("Rotation")*PI/180),matrix[0],.000002)
                assertEquals(sin(scalar("Rotation")*PI/180),matrix[1],.000002)
            }
            @Suppress("UNCHECKED_CAST") val mix=klass.getMethod("color",Double::class.javaPrimitiveType,Boolean::class.javaPrimitiveType).invoke(geometry,time,false) as Pair<Int,Double>
            val rgb=numbers.findAll(active.getString("stroke")).map { it.value.toDouble() }.toList()
            val a=colors[mix.first];val b=colors[(mix.first+1)%4]
            for(channel in 0..2) {
                val shift=16-8*channel;val av=(a ushr shift) and 255;val bv=(b ushr shift) and 255
                assertEquals("Color channel $channel at $time",rgb[channel],av+(bv-av)*mix.second,.51)
            }
        }
    }

    @Test fun actualIndeterminatePaintContoursMirrorPreciselyIncludingPhysicalCorners() {
        val metricsClass=Class.forName("dev.awc.nativeui.ProgressMetrics");val companion=metricsClass.getField("Companion").get(null)
        val from=companion.javaClass.getMethod("from",Map::class.java,AWCProgressIndicatorAppearance::class.java,Double::class.javaPrimitiveType)
        val motionClass=Class.forName("dev.awc.nativeui.ProgressMotion")
        val paints=Class.forName("dev.awc.nativeui.NativeProgressIndicatorKt").declaredMethods.single { it.name.startsWith("progressPaints-") && it.parameterCount==15 }.also { it.isAccessible=true }
        val corner=AWCCornerShape(topLeft=AWCCornerRadius(AWCCornerLength(points=9.0),AWCCornerLength(points=8.0)),bottomRight=AWCCornerRadius(AWCCornerLength(points=2.0),AWCCornerLength(points=3.0)))
        val a=AWCProgressIndicatorAppearance(trackShape=corner,activeIndicatorShape=corner)
        for(wave in listOf(false,true)) {
            val metrics=from.invoke(companion,mapOf("indeterminate" to true,"wave" to wave,"thickness" to 10,"waveAmplitude" to 5),a,0.0)
            val motion=motionClass.constructors.single().newInstance(metrics,false)
            val step=motionClass.getMethod("step",Double::class.javaPrimitiveType);step.invoke(motion,0.0)
            for(time in 16..1600 step 16) {
                step.invoke(motion,time.toDouble())
                if(time !in listOf(256,1008,1600)) continue
                fun read(item:Any,name:String):Any?=item.javaClass.getMethod("get$name").also { it.isAccessible=true }.invoke(item)
                fun contours(rtl:Boolean):List<Path> {
                    @Suppress("UNCHECKED_CAST") val list=paints.invoke(null,metrics,motion,a,240.0,if(wave) 20.0 else 10.0,rtl,false,false,
                        Color.Blue.value.toLong(),Color.Gray.value.toLong(),Color.Blue.value.toLong(),listOf(Color.Blue,Color.Red,Color.Green,Color.Yellow),corner,corner,corner) as List<Any>
                    return list.map { item ->
                        val native=read(item,"Path") as? Path
                        if(native!=null) native else {
                            val box=read(item,"Box") as Rect;val shape=read(item,"Shape") as Shape
                            Path().apply {
                                addOutline(shape.createOutline(Size(box.width,box.height),LayoutDirection.Ltr,Density(1f)))
                                transform(Matrix().apply { translate(box.left,box.top) })
                            }
                        }
                    }
                }
                val l=contours(false);val r=contours(true);assertEquals(l.size,r.size)
                for(i in l.indices) {
                    val lm=PathMeasure().apply { setPath(l[i],false) };val rm=PathMeasure().apply { setPath(r[i],false) }
                    assertEquals(lm.length,rm.length,.001f)
                    for(point in 0..100) {
                        val lp=lm.getPosition(lm.length*point/100);val rp=rm.getPosition(rm.length*point/100)
                        assertEquals("$wave/$time/$i x",240-lp.x,rp.x,.001f)
                        assertEquals("$wave/$time/$i y",lp.y,rp.y,.001f)
                    }
                }
            }
        }
    }

    @Test fun rotatedCircularInspectionPartsMatchActualWebElementRectangles() {
        val metricsClass=Class.forName("dev.awc.nativeui.ProgressMetrics")
        val companion=metricsClass.getField("Companion").get(null)
        val from=companion.javaClass.getMethod("from",Map::class.java,AWCProgressIndicatorAppearance::class.java,Double::class.javaPrimitiveType)
        val motionClass=Class.forName("dev.awc.nativeui.ProgressMotion")
        val paints=Class.forName("dev.awc.nativeui.NativeProgressIndicatorKt").declaredMethods
            .single { it.name.startsWith("progressPaints-") && it.parameterCount==15 }.also { it.isAccessible=true }
        val a=AWCProgressIndicatorAppearance();val corner=AWCCornerShape.uniform(points=9999.0)
        val samples=doc("light").getJSONArray("samples")
        var checked=0
        for(si in 0 until samples.length()) {
            val sample=samples.getJSONObject(si);val time=sample.getDouble("time")
            val entries=sample.getJSONArray("results")
            for(i in 0 until entries.length()) {
                val entry=entries.getJSONObject(i);val f=entry.getJSONObject("fixture")
                if(f.optString("variant")!="circular" || !f.optBoolean("indeterminate")) continue
                val metrics=from.invoke(companion,map(f),a,f.optDouble("inheritedDensity",0.0))
                val motion=motionClass.constructors.single().newInstance(metrics,false)
                val step=motionClass.getMethod("step",Double::class.javaPrimitiveType)
                step.invoke(motion,0.0)
                var tick=16.0
                while(tick<time) { step.invoke(motion,tick);tick+=16 }
                if(time>0) step.invoke(motion,time)
                val size=(metricsClass.getMethod("getSize").invoke(metrics) as Number).toDouble()
                @Suppress("UNCHECKED_CAST") val items=paints.invoke(null,metrics,motion,a,size,size,false,false,false,
                    Color.Blue.value.toLong(),Color.Gray.value.toLong(),Color.Blue.value.toLong(),
                    listOf(Color.Blue,Color.Red,Color.Green,Color.Yellow),corner,corner,corner) as List<Any>
                fun read(item:Any,name:String)=item.javaClass.getMethod("get$name").also { it.isAccessible=true }.invoke(item)
                val parts=entry.getJSONArray("parts")
                for(pi in 0 until parts.length()) {
                    val expected=parts.getJSONObject(pi);val id=expected.getString("part")
                    val native=items.single { read(it,"Id")==id }
                    val box=read(native,"Box") as Rect
                    val label="${f.getString("id")} at${time}ms/$id"
                    assertEquals("$label x",expected.getDouble("x"),box.left.toDouble(),.04)
                    assertEquals("$label y",expected.getDouble("y"),box.top.toDouble(),.04)
                    assertEquals("$label width",expected.getDouble("width"),box.width.toDouble(),.04)
                    assertEquals("$label height",expected.getDouble("height"),box.height.toDouble(),.04)
                    checked++
                }
            }
        }
        assertTrue("Compare all paused flat and wavy circular part rectangles",checked>=36)
    }

}

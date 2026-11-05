package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.*

class NativeSnackbarMotionTest {
    @get:Rule val compose=createComposeRule()
    @Test fun actualOpenCloseMotionMatchesAll32SourceSamplesAndReducedMotionSettles() {
        val data=InstrumentationRegistry.getInstrumentation().context.assets.open("SnackbarWeb-motion.json").bufferedReader().use { JSONObject(it.readText()) }.getJSONArray("results")
        var position by mutableStateOf("bottom");var epoch by mutableIntStateOf(0);var reduced by mutableStateOf(false)
        val controller=AWCSnackbarController();val collector=AWCInspectionCollector();var parentY=0.0;var committedFrame=0L
        compose.mainClock.autoAdvance=false
        compose.setContent { LaunchedEffect(Unit) { while(true) withFrameNanos { committedFrame=it/1_000_000 } }; CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=reduced) {
                AWCSnackbarScope(Modifier.requiredSize(800.dp,240.dp).background(Color.White).testTag("canvas").onGloballyPositioned { parentY=it.positionInRoot().y.toDouble() }) {
                    Box(Modifier.fillMaxSize())
                    key(epoch) { AWCSnackbarControllerScope(controller) {
                        AWCSnackbarAppearanceScope(AWCSnackbarAppearance(containerColor="#000000")) {
                            AWCInspectionScope(collector) { AWCComponent("md-snackbar",mapOf("open" to false,"autoHide" to false,"position" to position,"message" to "Your changes are saved","action" to "Undo","closeable" to true)) }
                        }
                    } }
                }
            }
        } } }
        compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val failures=mutableListOf<String>();var checked=0
        for(i in 0 until data.length()) {
            val row=data.getJSONObject(i)
            compose.runOnIdle { controller.hide();position=row.getJSONObject("fixture").getString("position");epoch++ }
            compose.mainClock.advanceTimeBy(300);compose.waitForIdle()
            val phases=row.getJSONArray("phases")
            for(j in 0 until phases.length()) {
                val phase=phases.getJSONObject(j);val opening=phase.getString("phase")=="open"
                compose.runOnIdle { if(opening) controller.show() else controller.hide() }
                compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
                val origin=committedFrame
                val frames=phase.getJSONArray("frames");var elapsed=0L
                for(k in 0 until frames.length()) {
                    val f=frames.getJSONObject(k);val time=f.getLong("time")
                    if(time>elapsed) { compose.mainClock.advanceTimeBy(time-elapsed,ignoreFrameDuration=true);compose.waitForIdle();elapsed=time }
                    val nodes=compose.runOnIdle { collector.snapshot().nodes }
                    val source=f.getJSONObject("host")
                    // The Android clock commits 16 ms frames. A request for 50 ms
                    // can leave the actual 48 ms frame on screen. Compare real
                    // committed timestamps against the source cubic, while also
                    // checking the recorded browser samples against that curve.
                    val duration=if(opening) 250.0 else 200.0
                    val curve=if(opening) doubleArrayOf(.05,.7,.1,1.0) else doubleArrayOf(.3,0.0,.8,.15)
                    fun progress(t:Double)=bezier((t/duration).coerceIn(0.0,1.0),curve).let { if(opening) it else 1-it }
                    val sourceAlpha=source.getJSONObject("style").getDouble("opacity")
                    assertEquals("Recorded browser cubic at $time",progress(time.toDouble()),sourceAlpha,.00002)
                    val actualTime=(committedFrame-origin).coerceAtLeast(0).toDouble()
                    val alpha=progress(actualTime)
                    val translation=when { position.startsWith("top")->-240.0;position.startsWith("bottom")->240.0;else->0.0 }
                    val expectedY=(1-alpha)*translation
                    val root=nodes.singleOrNull { it.id=="component" }
                    if(root!=null) {
                        val actualY=root.bounds.y-parentY
                        if(abs(actualY-expectedY)>2.0) failures+="$position/${phase.getString("phase")}/$time sourceY=$expectedY nativeY=$actualY"
                    } else if(opening || k!=frames.length()-1) failures+="$position/${phase.getString("phase")}/$time missing visible root"
                    val surface=nodes.singleOrNull { it.id=="component.surface" }
                    if(surface!=null) {
                        val y=surface.bounds.y-parentY+5
                        if(y in 0.0..239.0) {
                            val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                            val c=image[400,y.toInt()]
                                                        if(abs((1-c.red)-alpha)>.04) failures+="$position/${phase.getString("phase")}/$time sourceAlpha=$alpha nativeAlpha=${1-c.red}"
                        }
                    }
                    checked++
                }
                compose.mainClock.advanceTimeBy(300);compose.waitForIdle()
            }
        }
        assertEquals(32,checked)
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
        compose.runOnIdle { reduced=true;position="top";controller.show() }
        compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        assertEquals(parentY,compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component" }.bounds.y },.01)
        compose.runOnIdle { controller.hide() };compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        assertTrue(compose.runOnIdle { collector.snapshot().nodes.isEmpty() })
    }
    private fun bezier(x:Double,c:DoubleArray):Double {
        fun value(t:Double,a:Double,b:Double)=3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t
        var lo=0.0;var hi=1.0
        repeat(60) { val t=(lo+hi)/2;if(value(t,c[0],c[2])<x) lo=t else hi=t }
        return value((lo+hi)/2,c[1],c[3])
    }
}

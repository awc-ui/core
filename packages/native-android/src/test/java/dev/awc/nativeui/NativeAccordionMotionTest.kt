// Actual hydrated Web transition snapshots; each transition is sampled at
// its own duration fraction, not a common elapsed time.
// web-motion.json SHA-256: 0768e26c83cde35e4b39035bf0867ec1ec6bd8fe7ca4563de71eacf91679478c

package dev.awc.nativeui
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin
class NativeAccordionMotionTest {
    private data class Sample(val preset:String,val opening:Boolean,val outlined:Boolean,val fraction:Double,val height:Double,val clip:Double,val opacity:Double,val shape:Double,val scale:Double,val cosine:Double,val sine:Double)
    @Test fun all100WebTransitionSnapshotsMatchNativeFrameValues() {
        assertEquals(100,samples.size)
        for(s in samples) {
            val motion=NativeAccordionMotion(s.preset,s.opening,expandDuration=4000.0,collapseDuration=3000.0)
            val f=motion.fractions(s.fraction,s.fraction);val label="${s.preset}/${s.opening}/${s.outlined}/${s.fraction}"
            assertEquals("$label height",s.height,60*f.height,.025);assertEquals("$label clip",s.clip,60*f.contentClip,.025)
            assertEquals("$label opacity",s.opacity,f.opacity,.00001);assertEquals("$label shape",s.shape,if(s.outlined) 0.0 else 12+4*f.shape,.0001)
            assertEquals("$label leading scale",s.scale,f.leadingScale,.00001);assertEquals("$label rotation cosine",s.cosine,cos(f.chevronRadians),.00001);assertEquals("$label rotation sine",s.sine,sin(f.chevronRadians),.00001)
        }
    }
    @Test fun durationsOverridesAndReducedMotionUseIndependentClocks() {
        for((preset,durations) in mapOf("expressive" to (350.0 to 250.0),"standard" to (300.0 to 300.0),"fade" to (300.0 to 200.0),"collapse" to (300.0 to 300.0),"none" to (0.0 to 0.0))) {
            assertEquals(durations.first,NativeAccordionMotion(preset,true).duration,0.0);assertEquals(durations.second,NativeAccordionMotion(preset,false).duration,0.0)
        }
        val slow=NativeAccordionMotion(opening=true,expandDuration=4000.0);val fast=NativeAccordionMotion(opening=true,expandDuration=80.0)
        assertEquals(200.0,slow.effectsDuration,0.0);assertEquals(80.0,fast.effectsDuration,0.0)
        assertEquals(1.0,slow.frame(200.0).opacity,0.0);assertEquals(1.0,NativeAccordionMotion(opening=true,expandDuration=0.0).frame(0.0).height,0.0)
        assertEquals(0.0,NativeAccordionMotion(opening=false,reduced=true).frame(0.0).height,0.0)
        assertEquals(350.0,NativeAccordionMotion(opening=true,expandDuration=-1.0).duration,0.0)
    }
    private val samples=listOf(
        Sample("expressive",true,false,0.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("expressive",true,false,0.25,36.4296875,22.1171875,0.58713,14.4289,1.03926,-0.780948,0.624596),
        Sample("expressive",true,false,0.5,52.6640625,46.2265625,0.905337,15.5113,1.05059,-0.999306,-0.0372623),
        Sample("expressive",true,false,0.75,58.5234375,57.0859375,0.985964,15.9019,1.05033,-0.999785,-0.0207237),
        Sample("expressive",true,false,1.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("expressive",false,false,0.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("expressive",false,false,0.25,23.5625,9.25,0.41287,13.5711,1.01074,0.780948,0.624596),
        Sample("expressive",false,false,0.5,7.328125,0.890625,0.0946628,12.4887,0.999407,0.999306,-0.0372623),
        Sample("expressive",false,false,0.75,1.46875,0.03125,0.0140363,12.0981,0.99967,0.999785,-0.0207237),
        Sample("expressive",false,false,1.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("standard",true,false,0.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("standard",true,false,0.25,36.4296875,22.1171875,0.58713,14.4289,1.03036,-0.330509,0.943803),
        Sample("standard",true,false,0.5,52.6640625,46.2265625,0.905337,15.5113,1.04389,-0.92725,0.374444),
        Sample("standard",true,false,0.75,58.5234375,57.0859375,0.985964,15.9019,1.04877,-0.997035,0.0769555),
        Sample("standard",true,false,1.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("standard",false,false,0.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("standard",false,false,0.25,23.5625,9.25,0.41287,13.5711,1.01964,0.330509,0.943803),
        Sample("standard",false,false,0.5,7.328125,0.890625,0.0946628,12.4887,1.00611,0.92725,0.374444),
        Sample("standard",false,false,0.75,1.46875,0.03125,0.0140363,12.0981,1.00123,0.997035,0.0769555),
        Sample("standard",false,false,1.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("fade",true,false,0.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("fade",true,false,0.25,36.4296875,22.1171875,0.58713,14.4289,1.03036,-0.330509,0.943803),
        Sample("fade",true,false,0.5,52.6640625,46.2265625,0.905337,15.5113,1.04389,-0.92725,0.374444),
        Sample("fade",true,false,0.75,58.5234375,57.0859375,0.985964,15.9019,1.04877,-0.997035,0.0769555),
        Sample("fade",true,false,1.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("fade",false,false,0.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("fade",false,false,0.25,23.5625,9.25,0.41287,13.5711,1.01964,0.330509,0.943803),
        Sample("fade",false,false,0.5,7.328125,0.890625,0.0946628,12.4887,1.00611,0.92725,0.374444),
        Sample("fade",false,false,0.75,1.46875,0.03125,0.0140363,12.0981,1.00123,0.997035,0.0769555),
        Sample("fade",false,false,1.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("collapse",true,false,0.0,0.0,0.0,1.0,12.0,1.0,1.0,0.0),
        Sample("collapse",true,false,0.25,34.6484375,20.0078125,1.0,14.3103,1.02888,-0.241297,0.970451),
        Sample("collapse",true,false,0.5,50.3515625,42.25,1.0,15.357,1.04196,-0.875162,0.483831),
        Sample("collapse",true,false,0.75,57.8515625,55.78125,1.0,15.8569,1.04821,-0.993688,0.112181),
        Sample("collapse",true,false,1.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("collapse",false,false,0.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("collapse",false,false,0.25,54.078125,48.7421875,1.0,15.6055,1.02112,0.241297,0.970451),
        Sample("collapse",false,false,0.5,40.5078125,27.34375,1.0,14.7007,1.00804,0.875162,0.483831),
        Sample("collapse",false,false,0.75,22.1875,8.203125,1.0,13.4797,1.00179,0.993688,0.112181),
        Sample("collapse",false,false,1.0,0.0,0.0,1.0,12.0,1.0,1.0,0.0),
        Sample("none",true,false,0.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("none",true,false,0.25,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("none",true,false,0.5,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("none",true,false,0.75,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("none",true,false,1.0,60.0,60.0,1.0,16.0,1.05,-1.0,0.0),
        Sample("none",false,false,0.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("none",false,false,0.25,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("none",false,false,0.5,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("none",false,false,0.75,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("none",false,false,1.0,0.0,0.0,0.0,12.0,1.0,1.0,0.0),
        Sample("expressive",true,true,0.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("expressive",true,true,0.25,36.4296875,22.1171875,0.58713,0.0,1.03926,-0.780948,0.624596),
        Sample("expressive",true,true,0.5,52.6640625,46.2265625,0.905337,0.0,1.05059,-0.999306,-0.0372623),
        Sample("expressive",true,true,0.75,58.5234375,57.0859375,0.985964,0.0,1.05033,-0.999785,-0.0207237),
        Sample("expressive",true,true,1.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("expressive",false,true,0.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("expressive",false,true,0.25,23.5625,9.25,0.41287,0.0,1.01074,0.780948,0.624596),
        Sample("expressive",false,true,0.5,7.328125,0.890625,0.0946628,0.0,0.999407,0.999306,-0.0372623),
        Sample("expressive",false,true,0.75,1.46875,0.03125,0.0140363,0.0,0.99967,0.999785,-0.0207237),
        Sample("expressive",false,true,1.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("standard",true,true,0.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("standard",true,true,0.25,36.4296875,22.1171875,0.58713,0.0,1.03036,-0.330509,0.943803),
        Sample("standard",true,true,0.5,52.6640625,46.2265625,0.905337,0.0,1.04389,-0.92725,0.374444),
        Sample("standard",true,true,0.75,58.5234375,57.0859375,0.985964,0.0,1.04877,-0.997035,0.0769555),
        Sample("standard",true,true,1.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("standard",false,true,0.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("standard",false,true,0.25,23.5625,9.25,0.41287,0.0,1.01964,0.330509,0.943803),
        Sample("standard",false,true,0.5,7.328125,0.890625,0.0946628,0.0,1.00611,0.92725,0.374444),
        Sample("standard",false,true,0.75,1.46875,0.03125,0.0140363,0.0,1.00123,0.997035,0.0769555),
        Sample("standard",false,true,1.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("fade",true,true,0.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("fade",true,true,0.25,36.4296875,22.1171875,0.58713,0.0,1.03036,-0.330509,0.943803),
        Sample("fade",true,true,0.5,52.6640625,46.2265625,0.905337,0.0,1.04389,-0.92725,0.374444),
        Sample("fade",true,true,0.75,58.5234375,57.0859375,0.985964,0.0,1.04877,-0.997035,0.0769555),
        Sample("fade",true,true,1.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("fade",false,true,0.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("fade",false,true,0.25,23.5625,9.25,0.41287,0.0,1.01964,0.330509,0.943803),
        Sample("fade",false,true,0.5,7.328125,0.890625,0.0946628,0.0,1.00611,0.92725,0.374444),
        Sample("fade",false,true,0.75,1.46875,0.03125,0.0140363,0.0,1.00123,0.997035,0.0769555),
        Sample("fade",false,true,1.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("collapse",true,true,0.0,0.0,0.0,1.0,0.0,1.0,1.0,0.0),
        Sample("collapse",true,true,0.25,34.6484375,20.0078125,1.0,0.0,1.02888,-0.241297,0.970451),
        Sample("collapse",true,true,0.5,50.3515625,42.25,1.0,0.0,1.04196,-0.875162,0.483831),
        Sample("collapse",true,true,0.75,57.8515625,55.78125,1.0,0.0,1.04821,-0.993688,0.112181),
        Sample("collapse",true,true,1.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("collapse",false,true,0.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("collapse",false,true,0.25,54.078125,48.7421875,1.0,0.0,1.02112,0.241297,0.970451),
        Sample("collapse",false,true,0.5,40.5078125,27.34375,1.0,0.0,1.00804,0.875162,0.483831),
        Sample("collapse",false,true,0.75,22.1875,8.203125,1.0,0.0,1.00179,0.993688,0.112181),
        Sample("collapse",false,true,1.0,0.0,0.0,1.0,0.0,1.0,1.0,0.0),
        Sample("none",true,true,0.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("none",true,true,0.25,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("none",true,true,0.5,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("none",true,true,0.75,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("none",true,true,1.0,60.0,60.0,1.0,0.0,1.05,-1.0,0.0),
        Sample("none",false,true,0.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("none",false,true,0.25,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("none",false,true,0.5,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("none",false,true,0.75,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
        Sample("none",false,true,1.0,0.0,0.0,0.0,0.0,1.0,1.0,0.0),
    )
}

package dev.awc.nativeui
import org.junit.Assert.*
import org.junit.Test

class NativeMeterContractTest {
    private fun metrics(p:Props=emptyMap(),a:AWCMeterAppearance=AWCMeterAppearance(),d:Double=0.0)=NativeMeterMetrics.from(p,a,d)
    @Test fun finiteClampingAndExtremeRangesNeverInventInvalidProgress() {
        assertEquals(0.0,metrics(mapOf("min" to 5,"max" to 5,"value" to 9)).fraction,0.0)
        assertEquals(20.0,metrics(mapOf("min" to 20,"max" to 10,"value" to 15)).value,0.0)
        assertEquals(.3125,metrics(mapOf("min" to -100,"max" to -20,"value" to -75)).fraction,0.0)
        for((value,fraction) in listOf(-Double.MAX_VALUE to 0.0,-Double.MAX_VALUE/2 to .25,0.0 to .5,Double.MAX_VALUE/2 to .75,Double.MAX_VALUE to 1.0))
            assertEquals(fraction,metrics(mapOf("min" to -Double.MAX_VALUE,"max" to Double.MAX_VALUE,"value" to value)).fraction,0.0)
        val invalid=metrics(mapOf("value" to Double.NaN,"min" to Double.NEGATIVE_INFINITY,"max" to Double.POSITIVE_INFINITY))
        assertEquals(0.0,invalid.minimum,0.0);assertEquals(100.0,invalid.maximum,0.0);assertEquals(0.0,invalid.value,0.0)
    }
    @Test fun densityAndRingUnitsKeepIndependentSizeAndThicknessContracts() {
        for(d in 0 downTo -4) { val m=metrics(mapOf("density" to d));assertEquals(4+d*.5,m.height,0.0);assertEquals(48+2*d.toDouble(),m.size,0.0);assertEquals(22.0,m.radius,0.0) }
        assertEquals(3.25,metrics(d=-1.5).height,0.0)
        assertEquals(40.0,metrics(mapOf("density" to 0),d=-4.0).size,0.0)
        assertEquals(46.0,metrics(mapOf("density" to -1),d=-4.0).size,0.0)
        assertEquals(48.0,metrics(mapOf("size" to 0)).size,0.0);assertEquals(240.0,metrics(mapOf("size" to 300)).size,0.0)
        assertEquals(4.0,metrics(mapOf("thickness" to -2)).stroke,0.0);assertEquals(2.0,metrics(mapOf("thickness" to -2)).height,0.0)
        assertEquals(.5,metrics(mapOf("thickness" to 80)).radius,0.0)
        val zero=metrics(a=AWCMeterAppearance(size=0.0,height=0.0));assertEquals(0.0,zero.size,0.0);assertEquals(0.0,zero.height,0.0)
    }
    @Test fun sevenHooksCascadeAndPreserveAlphaZeroAndEllipticalShapes() {
        val base=AWCMeterAppearance(indicatorColor="#12345680",height=9.0,size=80.0,trackShape=AWCCornerShape.uniform(fraction=.25))
        val a=base.merged(AWCMeterAppearance(height=0.0,labelColor="#abcdef"))
        assertEquals(0.0,a.height);assertEquals(80.0,a.size);assertEquals("#12345680",a.indicatorColor);assertEquals("#ABCDEF",a.labelColor);assertEquals(base.trackShape,a.trackShape)
        for(key in listOf("height","size")) for(value in listOf(-1,true,"4",Double.NaN,Double.POSITIVE_INFINITY))
            assertEquals(AWCMeterAppearance(),AWCMeterAppearance.fromValues(mapOf(key to value)))
        assertEquals("5e-324",MeterNumberFormat.raw(Double.MIN_VALUE));assertEquals("1e+23",MeterNumberFormat.raw(1e23));assertEquals("0",MeterNumberFormat.raw(-0.0));assertEquals("1e+21",MeterNumberFormat.raw(1e21));assertEquals("0.000001",MeterNumberFormat.raw(.000001))
    }
}

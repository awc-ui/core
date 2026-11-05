package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeSkeletonContractTest {
    private fun geometry(p:Props=emptyMap(),a:AWCSkeletonAppearance=AWCSkeletonAppearance(),parts:Map<AWCSkeletonPart,AWCSkeletonPartAppearance> = emptyMap(),height:Double?=null,density:Double=0.0,rtl:Boolean=false)=
        NativeSkeletonGeometry.resolve(p,a,parts,AWCSkeletonSizingContext(parentHeight=height),240.0,16.0,16.0,8.984375,density,rtl)
    @Test fun relativeLengthsKeepTheirContextAndRejectUnsupportedGrammar() {
        val x=AWCSkeletonLength.parse("calc(100% - 32px + 2em - 1rem + 3ch)")
        assertEquals(AWCSkeletonLength(-32.0,1.0,2.0,-1.0,3.0),x)
        assertEquals(250.0,x.resolve(240.0,16.0,17.0,9.0)!!,.0)
        assertNull(x.resolve(null,16.0,17.0,9.0))
        assertEquals(0.0,AWCSkeletonLength.parse("calc(2px - 8px)").resolve(null,16.0,16.0,9.0)!!,.0)
        for(value in listOf("var(--size)","min(1px, 2px)","-1px","calc(10px-1px)","calc(2px * 3)","auto","4vw","2","calc(0 + 1px)","1e999px"))
            assertThrows(value,IllegalArgumentException::class.java) { AWCSkeletonLength.parse(value) }
        assertEquals(AWCSkeletonLength(),AWCSkeletonLength.parse("0"))
    }
    @Test fun finiteLengthOverflowCancelsExactlyAndMalformedTransportDoesNotLoseUnits() {
        assertEquals(0.0,AWCSkeletonLength(points=Double.MAX_VALUE,fraction=Double.MAX_VALUE,em=-Double.MAX_VALUE).resolve(2.0,3.0,16.0,9.0)!!,.0)
        assertEquals(Double.MAX_VALUE,AWCSkeletonLength(points=Double.MAX_VALUE,fraction=Double.MAX_VALUE).resolve(2.0,16.0,16.0,9.0)!!,.0)
        assertNull(AWCSkeletonLength.fromValues(mapOf("fraction" to Double.NaN)))
        assertNull(AWCSkeletonLength.fromValues(mapOf("px" to 2)))
        assertEquals(AWCSkeletonLength(fraction=.5),AWCSkeletonLength.fromValues(mapOf("fraction" to .5)))
    }
    @Test fun extremeFiniteInheritedDensityDoesNotCreateInvalidLengthCoefficients() {
        for(variant in listOf("circular","rounded","rectangular","text")) for(density in listOf(Double.MAX_VALUE,-Double.MAX_VALUE)) {
            val g=geometry(mapOf("variant" to variant),density=density)
            assertTrue(g.width.isFinite());assertTrue(g.parts.single().height.isFinite())
        }
    }
    @Test fun rowCountFollowsSourceInt32BeforeNativeAllocationBoundary() {
        for((input,want) in listOf(0.0 to 1,-2.0 to 1,2.7 to 2,4294967299.0 to 3,2147483648.0 to 1,Double.NaN to 1,10000.0 to 8192))
            assertEquals(want,NativeSkeletonGeometry.count(input))
    }
    @Test fun eachVariantAndDensityKeepSourceDefaults() {
        for(d in listOf(0.0,-1.0,-2.0,-3.0,-4.0,-1.5)) {
            val text=geometry(mapOf("lines" to 3),density=d)
            assertEquals(3,text.parts.size);assertEquals(16*(1+.05*d),text.parts[0].height,1e-10)
            assertEquals(8+d,text.gap,.0);assertEquals(144.0,text.parts.last().width,.0)
            for(variant in listOf("rectangular","rounded")) assertEquals(120+8*d,geometry(mapOf("variant" to variant),density=d).height,.0)
            val circle=geometry(mapOf("variant" to "circular"),density=d)
            assertEquals(40+3*d,circle.width,.0);assertEquals(circle.width,circle.height,.0)
        }
    }
    @Test fun propertyDimensionsOverrideHooksAndFullWidthOverridesPropertyWidth() {
        val appearance=AWCSkeletonAppearance(width=AWCSkeletonLength(points=80.0),height=AWCSkeletonLength(points=10.0))
        val g=geometry(mapOf("width" to "150px","height" to "22px","lines" to 3),appearance)
        assertEquals(150.0,g.width,.0);assertEquals(82.0,g.height,.0)
        assertEquals(240.0,geometry(mapOf("width" to "80px","fullWidth" to true),appearance).width,.0)
    }
    @Test fun percentageHeightIsIndefiniteWithoutFullHeightEvenInsideDefiniteParent() {
        for(variant in listOf("rectangular","rounded","text")) {
            val g=geometry(mapOf("variant" to variant,"width" to "50%","height" to "50%","lines" to 3),height=160.0)
            assertEquals(120.0,g.width,.0);assertEquals(if(variant=="text") 16.0 else 0.0,g.height,.0)
        }
        val circle=geometry(mapOf("variant" to "circular","width" to "50%","height" to "50%"),height=160.0)
        assertEquals(120.0,circle.height,.0)
    }
    @Test fun fullHeightAutoFallbackAndCirclePrecedenceMatchSource() {
        for(variant in listOf("rectangular","rounded")) {
            val g=geometry(mapOf("variant" to variant,"fullHeight" to true))
            assertEquals(120.0,g.height,.0);assertEquals(120.0,g.parts.single().height,.0)
        }
        val g=geometry(mapOf("variant" to "circular","fullHeight" to true,"fullWidth" to true,"width" to "80px"),height=160.0)
        assertEquals(160.0,g.width,.0);assertEquals(160.0,g.height,.0)
        assertEquals(240.0,geometry(mapOf("variant" to "circular","fullHeight" to true)).width,.0)
    }
    @Test fun definiteTextHostShrinksRowsButKeepsGapAndLogicalStartTaper() {
        val g=geometry(mapOf("fullHeight" to true,"lines" to 3,"height" to "32px"),height=64.0,rtl=true)
        assertEquals(64.0,g.height,.0);assertEquals(16.0,g.parts.first().height,.0)
        assertEquals(96.0,g.parts.last().x,.0);assertEquals(48.0,g.parts.last().y,.0)
    }
    @Test fun partCascadeTargetsActualFinalRowAndPreservesEllipticalCorners() {
        val g=geometry(mapOf("lines" to 3),parts=mapOf(AWCSkeletonPart.Line to AWCSkeletonPartAppearance(color="#00FF0080",height=AWCSkeletonLength(points=12.0)),
            AWCSkeletonPart.LineLast to AWCSkeletonPartAppearance(width=AWCSkeletonLength(fraction=.4),cornerShape=AWCCornerShape.uniform())))
        assertEquals(52.0,g.height,.0);assertEquals(96.0,g.parts.last().width,.0)
        assertEquals("#00FF0080",g.parts.last().color);assertEquals(0.0,g.parts.last().corners.radii(96.0,12.0).first().first,.0)
    }
    @Test fun elevenAppearanceHooksMergeZeroDurationsAndRejectMalformedValues() {
        val a=AWCSkeletonAppearance("#12345680","#FEDCBA80",AWCCornerShape.uniform(points=2.0),AWCCornerShape.uniform(points=4.0),
            AWCSkeletonLength(points=180.0),AWCSkeletonLength(points=20.0),AWCSkeletonLength(points=64.0),AWCSkeletonLength(points=11.0),1.3,1.7,.8)
        assertEquals(11,a.values.size)
        val merged=a.merged(AWCSkeletonAppearance(pulseDuration=0.0,width=AWCSkeletonLength()))
        assertEquals(0.0,merged.pulseDuration);assertEquals(AWCSkeletonLength(),merged.width);assertEquals(a.height,merged.height)
        assertEquals(AWCSkeletonAppearance(),AWCSkeletonAppearance.fromValues(mapOf("color" to "red","waveDuration" to -1,"bloomDuration" to Double.NaN)))
    }
    @Test fun motionRetainsEntranceWithoutRecurringAnimationAndReducedMotionSettles() {
        val start=SkeletonMotion.frame(0.0,"none",false,false,500.0,800.0,800.0)
        assertEquals(0.0,start.opacity,.0);assertEquals(.96,start.scale,.0)
        val middle=SkeletonMotion.frame(250.0,"none",false,false,500.0,800.0,800.0)
        assertTrue(middle.scale>1.0);assertEquals(1.0,middle.pulseOpacity,.0)
        assertEquals(SkeletonMotionFrame(1.0,1.0,1.0,0.0),SkeletonMotion.frame(250.0,"wave",true,true,500.0,800.0,800.0))
        assertEquals(.55,SkeletonMotion.frame(400.0,"pulse",false,false,500.0,800.0,800.0).pulseOpacity,1e-10)
    }
    @Test fun rtlReversesTimelineBeforeEasingRatherThanMirroringEasedPosition() {
        val forward=SkeletonMotion.frame(100.0,"wave",false,false,500.0,800.0,800.0)
        val reverse=SkeletonMotion.frame(700.0,"wave",false,true,500.0,800.0,800.0)
        assertEquals(forward.waveFraction,reverse.waveFraction,1e-10)
        assertNotEquals(1-forward.waveFraction,SkeletonMotion.frame(100.0,"wave",false,true,500.0,800.0,800.0).waveFraction,1e-3)
    }
}

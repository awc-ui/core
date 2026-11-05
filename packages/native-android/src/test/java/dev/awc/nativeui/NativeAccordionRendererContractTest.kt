package dev.awc.nativeui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.*
import org.junit.Test

/** JVM contract checks for the Compose renderer's source value models (no device). */
class NativeAccordionRendererContractTest {
    @Test fun elevationTokensParseIntoOrderedSourceLayers() {
        val layers=NativeShadowLayer.parse("0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)")
        assertEquals(2,layers.size)
        assertEquals(listOf(0.0,1.0,2.0,0.0),layers[0].let { listOf(it.x,it.y,it.blur,it.spread) })
        assertEquals(listOf(0.0,1.0,3.0,1.0),layers[1].let { listOf(it.x,it.y,it.blur,it.spread) })
        assertEquals(.3f,layers[0].color.alpha,.002f);assertEquals(.15f,layers[1].color.alpha,.002f)
        assertTrue(NativeShadowLayer.parse("none").isEmpty());assertTrue(NativeShadowLayer.parse(null).isEmpty())
        val inset=NativeShadowLayer.parse("inset 0px 0px 0px 6px #11AA6688").single()
        assertTrue(inset.inset);assertEquals(6.0,inset.spread,0.0);assertEquals(0x88/255f,inset.color.alpha,.002f)
    }
    @Test fun shadowListsInterpolateLikeCssWithPaddingAndDiscreteInsetMismatch() {
        val a=NativeShadowLayer.parse("0px 2px 4px rgba(0, 0, 0, 0.4)")
        val b=NativeShadowLayer.parse("0px 6px 8px rgba(0, 0, 0, 0.2), 0px 1px 1px rgba(0, 0, 0, 0.2)")
        val mid=NativeShadowLayer.interpolate(a,b,.5)
        assertEquals(2,mid.size);assertEquals(4.0,mid[0].y,1e-9);assertEquals(6.0,mid[0].blur,1e-9);assertEquals(.3f,mid[0].color.alpha,.003f)
        assertEquals(.5,mid[1].y,1e-9);assertEquals(.1f,mid[1].color.alpha,.003f) // padded from a transparent zero layer
        val i=NativeShadowLayer.parse("inset 0px 0px 0px 6px #11AA6688")
        assertSame(a,NativeShadowLayer.interpolate(a,i,.49));assertSame(i,NativeShadowLayer.interpolate(a,i,.5))
    }
    @Test fun premultipliedColourMixMatchesCssTransparentInterpolation() {
        val c=accordionMix(Color.Transparent,Color(0xFF4A4458),.59f)
        // Compose stores sRGB channels with 8-bit precision.
        assertEquals(.59f,c.alpha,1/255f);assertEquals(0x4A/255f,c.red,1/255f)
        assertEquals(Color.Red,accordionMix(Color.Blue,Color.Red,1f))
    }
    @Test fun contentCapGrammarFollowsTheWebScrollingMatrix() {
        fun cap(css:String,base:Double=280.0)=accordionContentCap(css,14.0,7.8681640625)?.evaluate(base)
        assertEquals(70.0,cap("70px")!!,1e-9);assertEquals(70.0,cap(" 70px ")!!,1e-9);assertEquals(0.0,cap("0")!!,1e-9)
        assertEquals(70.0,cap("5em")!!,1e-9);assertEquals(70.0,cap("4.375rem")!!,1e-9);assertEquals(78.681640625,cap("10ch")!!,1e-9)
        assertEquals(70.0,cap("calc(100px - 30px)")!!,1e-9);assertEquals(140.0,cap("50%")!!,1e-9);assertEquals(210.0,cap("calc(50% + 70px)")!!,1e-9)
        assertEquals(70.0,cap("min(70px, 100px)")!!,1e-9);assertEquals(100.0,cap("max(70px, 100px)")!!,1e-9);assertEquals(90.0,cap("clamp(20px, 90px, 120px)")!!,1e-9)
        assertTrue(accordionContentCap("50%",14.0)!!.usesPercent);assertFalse(accordionContentCap("70px",14.0)!!.usesPercent)
        for(invalid in listOf("none","auto","invalid","-10px","70","calc(100px-30px)","calc(70px * 2px)","")) assertNull(invalid,accordionContentCap(invalid,14.0))
        assertEquals(0.0,cap("calc(10px - 30px)")!!,1e-9) // valid calc clamps at zero
    }
    @Test fun appearanceHooksValidateAndMergeLocalOverInherited() {
        val group=AWCAccordionAppearance.fromValues(mapOf("gap" to 17,"outlineColor" to "#cc5577","containerShape" to mapOf("topLeft" to mapOf("x" to mapOf("points" to 24))),
            "elevation" to listOf(mapOf("x" to 0,"y" to 2,"blur" to 5,"spread" to 1,"color" to "#00000044")),"dropPlaceholderOpacity" to 3.0,"outlineBogus" to 1))
        assertEquals(17.0,group.gap!!,0.0);assertEquals("#CC5577",group.outlineColor);assertEquals(1.0,group.dropPlaceholderOpacity!!,0.0)
        assertEquals(24.0,group.containerShape!!.topLeft.x.points,0.0);assertEquals(1,group.elevation!!.size)
        assertNull(AWCAccordionAppearance.fromValues(mapOf("gap" to -1,"outlineColor" to "red")).let { it.gap ?: it.outlineColor })
        val item=AWCAccordionItemAppearance(containerColor="#22557788",headerPadding=AWCAccordionInsets(7.0,13.0,11.0,19.0),expandDuration=4000.0)
            .merged(AWCAccordionItemAppearance(containerColor="#11223344",expandDuration=-5.0,collapseDuration=3000.0))
        assertEquals("#11223344",item.containerColor);assertEquals(4000.0,item.expandDuration!!,0.0);assertEquals(3000.0,item.collapseDuration!!,0.0)
        assertEquals(19.0,item.headerPadding!!.start(false),0.0);assertEquals(13.0,item.headerPadding!!.start(true),0.0)
        assertNull(AWCAccordionItemAppearance(headerPadding=AWCAccordionInsets(-1.0,2.0)).normalized().headerPadding)
        val values=AWCAccordionItemAppearance.fromValues(mapOf("headerMinHeight" to 72,"elevationExpanded" to listOf(mapOf("x" to -3,"y" to 4,"spread" to 2,"color" to "#11664488","inset" to false))))
        assertEquals(72.0,values.headerMinHeight!!,0.0);assertEquals(-3.0,values.elevationExpanded!!.single().x,0.0)
    }
    @Test fun cornerShapesInterpolatePerCorner() {
        val a=AWCCornerShape.uniform(12.0);val b=AWCCornerShape(AWCCornerRadius(AWCCornerLength(16.0),AWCCornerLength(16.0)),AWCCornerRadius(AWCCornerLength(16.0),AWCCornerLength(16.0)))
        val mid=a.lerp(b,.5)
        assertEquals(14.0,mid.topLeft.x.points,1e-9);assertEquals(6.0,mid.bottomLeft.x.points,1e-9)
        assertSame(a,a.lerp(b,0.0));assertSame(b,a.lerp(b,1.0))
    }
    @Test fun runningDisclosureStartsFromInterruptedValuesAndEndsAtTarget() {
        val opening=NativeAccordionMotion("expressive",true)
        val mid=NativeAccordionRunning(accordionSteadyFrame("expressive",false),opening).frame(120.0)
        assertTrue(mid.height>0 && mid.height<1)
        val closing=NativeAccordionRunning(mid,NativeAccordionMotion("expressive",false))
        assertEquals(mid.height,closing.frame(0.0).height,1e-9);assertEquals(mid.effects,closing.frame(0.0).effects,1e-9)
        assertEquals(0.0,closing.frame(250.0).height,1e-9);assertEquals(0.0,closing.frame(250.0).contentClip,1e-9)
        val collapse=NativeAccordionRunning(accordionSteadyFrame("collapse",false),NativeAccordionMotion("collapse",true)).frame(50.0)
        assertEquals("collapse preset never fades",1.0,collapse.opacity,0.0)
        assertEquals(1.0,accordionSteadyFrame("fade",true).height,0.0);assertEquals(0.0,accordionSteadyFrame("fade",false).opacity,0.0)
    }
    @Test fun configurationNormalizesSourceProperties() {
        val c=accordionConfiguration(mapOf("variant" to "bogus","elevation" to 3.0,"headingLevel" to 2,"defaultExpanded" to "0,1","regionThreshold" to 1))
        assertEquals("filled",c.variant);assertEquals(3,c.elevation);assertEquals(2,c.headingLevel);assertEquals("0,1",c.defaultExpanded);assertEquals(1.0,c.regionThreshold,0.0)
        assertEquals("outlined",accordionConfiguration(mapOf("variant" to "outlined")).variant)
        assertTrue(accordionConfiguration(emptyMap()).bringToFront)
    }

    @Test fun partStylesValidateMergeAndCollapseMarginsLikeCss() {
        val parsed=AWCAccordionPartAppearance.fromValues(mapOf("backgroundColor" to "#226688","borderWidth" to 2,"margin" to mapOf("top" to -2,"right" to 3,"bottom" to -4,"left" to 5),
            "padding" to mapOf("top" to 3,"right" to 5,"bottom" to 7,"left" to 9),"fontWeight" to 700,"opacity" to 4))
        assertEquals("#226688",parsed.backgroundColor);assertEquals(-2.0,parsed.margin!!.top,0.0);assertEquals(9.0,parsed.padding!!.left,0.0)
        assertEquals(700.0,parsed.fontWeight!!,0.0);assertEquals(1.0,parsed.opacity!!,0.0)
        assertNull(AWCAccordionPartAppearance.fromValues(mapOf("padding" to mapOf("top" to -1,"right" to 0,"bottom" to 0,"left" to 0),"color" to "blue","fontWeight" to 0)).let { it.padding ?: it.color ?: it.fontWeight })
        val merged=AWCAccordionPartAppearance(minHeight=96.0,backgroundColor="#335577").merged(AWCAccordionPartAppearance(minHeight=112.0))
        assertEquals(112.0,merged.minHeight!!,0.0);assertEquals("#335577",merged.backgroundColor)
        assertEquals(10.0,accordionCollapsedMargin(4.0,10.0,3.0),0.0);assertEquals(6.0,accordionCollapsedMargin(10.0,-4.0),0.0)
        assertEquals(-2.0,accordionCollapsedMargin(-10.0,4.0,8.0),0.0);assertEquals(-8.0,accordionCollapsedMargin(-2.0,-8.0),0.0)
        assertEquals(AWCAccordionItemPart.ContentInner,AWCAccordionItemPart.fromSource("content-inner"));assertEquals(13,AWCAccordionItemPart.entries.size)
    }
}

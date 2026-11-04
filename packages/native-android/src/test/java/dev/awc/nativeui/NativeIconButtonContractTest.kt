package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeIconButtonContractTest {
    @Test fun sizeWidthAndDensityLaddersMatchSource() {
        val sizes=listOf("xs","sm","md","lg","xl")
        assertEquals(listOf(32f,40f,56f,96f,136f),sizes.map { NativeIconButtonMetrics(it,0f,"default").height })
        assertEquals(listOf(32f,32f,48f,64f,104f),sizes.map { NativeIconButtonMetrics(it,0f,"narrow").width })
        assertEquals(listOf(40f,52f,72f,128f,184f),sizes.map { NativeIconButtonMetrics(it,0f,"wide").width })
        assertEquals(listOf(16f,20f,20f,24f,28f),sizes.map { NativeIconButtonMetrics(it,-4f,"default").icon })
        assertEquals(listOf(32f,32f,40f,80f,120f),sizes.map { NativeIconButtonMetrics(it,-4f,"default").height })
        assertEquals(56f,NativeIconButtonMetrics("md",-1.5f,"default").height,0f)
    }
    @Test fun paletteUsesSelectedEvenWithoutToggleAndSourceInverseOutlinedColors() {
        assertEquals(NativeIconButtonPalette("inverse-surface","inverse-on-surface",null),
            NativeIconButtonPalette.resolve("outlined",false,true))
        assertEquals("primary",NativeIconButtonPalette.resolve("standard",false,true).icon)
        assertEquals("surface-container-highest",NativeIconButtonPalette.resolve("filled",true,false).container)
        assertEquals("primary",NativeIconButtonPalette.resolve("filled",false,false).container)
        assertEquals("on-surface-variant",NativeIconButtonPalette.resolve("tonal",true,false).icon)
    }
    @Test fun navigationThenSelectionThenNotificationCannotBeUndoneByEventCancellation() {
        val order=mutableListOf<String>()
        var state=false
        var event:AWCActionEvent?=null
        val dispatcher=AWCActionDispatcher(null,"root") { event=it;order+="event:${it.detail["selected"]}";it.preventDefault() }
        assertTrue(performNativeIconButtonAction(mapOf("toggle" to true,"href" to "/next","target" to "_blank"),false,
            { name,detail -> order+="$name:${(detail as Map<*,*>)["selected"]}" },dispatcher,
            AWCURLRouter { order+="navigate:${it.url}:${it.target}";true },"target",emptyList(),AWCActivationMetadata("keyboard")) {
            state=it;order+="commit:$it"
        })
        assertEquals(listOf("navigate:/next:_blank","commit:true","event:true","mdClick:true"),order)
        assertTrue(state);assertTrue(event!!.defaultPrevented)
        assertEquals(listOf("target","root"),event!!.path)
        assertEquals("keyboard",event!!.activation.source)
    }
    @Test fun unsafeUrlsStillPermitToggleWhileDisabledAndSoftDisabledAreInert() {
        val events=mutableListOf<String>()
        val router=AWCURLRouter { fail("Unsafe URL must not reach router");false }
        for(key in listOf("disabled","softDisabled")) {
            assertFalse(performNativeIconButtonAction(mapOf(key to true,"toggle" to true),false,
                {name,_->events+=name},null,router,"id",emptyList(),AWCActivationMetadata()) { fail("Disabled selection committed") })
        }
        var selected=false
        assertTrue(performNativeIconButtonAction(mapOf("href" to "javascript:alert(1)","toggle" to true),false,
            {name,_->events+=name},null,router,"id",emptyList(),AWCActivationMetadata()) { selected=it })
        assertEquals(listOf("mdClick"),events);assertTrue(selected)
    }
    @Test fun nonToggleRetainsSelectedAndReportsExactSourcePayload() {
        var detail:AWCValue=null
        performNativeIconButtonAction(emptyMap(),true,{_,value->detail=value},null,AWCURLRouter { false },"id",
            emptyList(),AWCActivationMetadata()) { fail("Non-toggle control must not update selection") }
        assertEquals(mapOf("selected" to true),detail)
    }
    @Test fun appearanceMergesNineFieldsAndRejectsInvalidValuesWithoutClamping() {
        val base=AWCIconButtonAppearance(iconSize=24.0,width=56.0,iconColor="#aabbcc")
        val local=AWCIconButtonAppearance(width=0.0,height=2400.0,iconSize=Double.NaN,outlineWidth=17.0)
        val result=base.merged(local)
        assertEquals(24.0,result.iconSize!!,0.0);assertEquals(0.0,result.width!!,0.0)
        assertEquals(2400.0,result.height!!,0.0);assertNull(result.outlineWidth);assertEquals("#AABBCC",result.iconColor)
        assertNull(AWCIconButtonAppearance.fromValues(mapOf("cornerRadius" to -1,"containerColor" to "red")).containerColor)
        assertEquals("#12345680",AWCIconButtonAppearance(iconColor="#12345680").normalized().iconColor)
    }
}

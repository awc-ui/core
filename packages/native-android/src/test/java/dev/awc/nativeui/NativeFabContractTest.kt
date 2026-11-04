package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeFabContractTest {
    @Test fun labelledMetricsIgnoreIconOnlySizeAndPreserveDensityTokenSteps() {
        for(size in listOf("standard","medium","large")) for(d in 0 downTo -4) {
            val m=NativeFabMetrics(size,d.toFloat(),true)
            assertEquals(56f+4*d,m.height,0f);assertEquals(24f+d,m.icon,0f)
            assertEquals(16f,m.radius,0f);assertEquals(14f+.5f*d,m.font,0f)
            assertEquals(listOf(16f,16f,12f,12f,8f)[-d],m.inset,0f)
            assertEquals(listOf(12f,12f,8f,8f,8f)[-d],m.gap,0f)
        }
        assertEquals(listOf(40f,64f,80f),listOf("standard","medium","large").map { NativeFabMetrics(it,-4f,false).height })
        assertEquals(listOf(20f,24f,32f),listOf("standard","medium","large").map { NativeFabMetrics(it,-4f,false).icon })
        assertEquals(56f,NativeFabMetrics("standard",Float.NaN,false).height,0f)
    }
    @Test fun loweringOnlyChangesTheSurfacePalette() {
        assertEquals(NativeFabPalette("surface-container-low","primary"),NativeFabPalette.resolve("surface",true))
        assertEquals(NativeFabPalette("surface-container-high","primary"),NativeFabPalette.resolve("surface",false))
        for(name in listOf("primary","secondary","tertiary","primary-container","secondary-container","tertiary-container")) {
            assertEquals(NativeFabPalette(name,"on-$name"),NativeFabPalette.resolve(name,true))
            assertEquals(NativeFabPalette.resolve(name,false),NativeFabPalette.resolve(name,true))
        }
    }
    @Test fun controllerReportsAttachmentPreservesWhitespaceAndClearsEmptyWithoutChangingAuthoredState() {
        val controller=AWCFabController();val owner=Any();val values=mutableListOf<String?>()
        assertFalse(controller.setMenuIcon("close"))
        controller.attach(owner) { values+=it }
        assertTrue(controller.setMenuIcon("close"));assertTrue(controller.setMenuIcon(" "))
        assertTrue(controller.setMenuIcon(""));assertTrue(controller.setMenuIcon(null))
        assertEquals(listOf("close"," ",null,null),values)
        controller.detach(Any());assertTrue(controller.setMenuIcon("add"))
        controller.detach(owner);assertFalse(controller.setMenuIcon("close"))
    }
    @Test fun clickNotificationCarriesNativeActivationWithoutInventedMouseEventFields() {
        var event:AWCActionEvent?=null;val callbacks=mutableListOf<Pair<String,AWCValue>>()
        val action=AWCActionDispatcher(null,"scope") { event=it;it.preventDefault() }
        assertTrue(performNativeFabAction(emptyMap(),{n,v->callbacks+=n to v},action,"fab",emptyList(),AWCActivationMetadata("pointer",12f,18f)))
        assertEquals(listOf("mdClick" to null),callbacks)
        assertTrue(event!!.detail.isEmpty());assertEquals(AWCActivationMetadata("pointer",12f,18f),event!!.activation)
        assertTrue(event!!.defaultPrevented);assertEquals(listOf("fab","scope"),event!!.path)
        for(key in listOf("disabled","softDisabled")) assertFalse(performNativeFabAction(mapOf(key to true),{_,_->fail()},action,"fab",emptyList(),AWCActivationMetadata("keyboard")))
        assertEquals(1,callbacks.size)
    }
    @Test fun allFiveAppearanceFieldsNormalizeAndInvalidOverridesInherit() {
        val base=AWCFabAppearance(containerColor="#aabbcc",iconColor="#112233",iconSize=24.0,cornerRadius=16.0,labelColor="#ddeeff")
        assertEquals(5,base.values.size)
        val merged=base.merged(AWCFabAppearance(iconColor="red",iconSize=Double.NaN,cornerRadius=0.0))
        assertEquals("#AABBCC",merged.containerColor);assertEquals("#112233",merged.iconColor)
        assertEquals(24.0,merged.iconSize!!,0.0);assertEquals(0.0,merged.cornerRadius!!,0.0)
        assertNull(AWCFabAppearance.fromValues(mapOf("iconSize" to 2401,"cornerRadius" to -1)).iconSize)
    }
}

package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeSplitButtonContractTest {
    @Test fun sixHooksValidateCascadeAndPreserveExplicitZero() {
        val base=AWCSplitButtonAppearance("#aabbcc","#112233","#abcdef","#fedcba",0.0,2400.0).normalized()
        assertEquals(6,base.values.size);assertEquals("#AABBCC",base.containerColor)
        assertEquals(base,base.merged(AWCSplitButtonAppearance(containerColor="red",iconSize=Double.NaN,cornerRadius=-1.0)))
        assertEquals(0.0,base.merged(AWCSplitButtonAppearance(iconSize=0.0)).iconSize!!,0.0)
    }
    @Test fun allSizeDensityRungsPreserveFixedGlyphsBaseOuterRadiusAndTrimmedPads() {
        val sizes=listOf("xs","sm","md","lg","xl")
        sizes.forEachIndexed { index,size -> for(density in 0 downTo -4) {
            val m=SplitButtonMetrics(size,density.toDouble(),true)
            assertEquals(maxOf(24f,listOf(32f,40f,56f,96f,136f)[index]+density*4),m.height,0f)
            assertEquals(listOf(16f,20f,28f,48f,68f)[index],m.outerRadius,0f)
            assertEquals(listOf(16f,18f,24f,36f,48f)[index],m.icon,0f)
            assertEquals(listOf(22f,22f,26f,38f,50f)[index],m.trailingIcon,0f)
            assertEquals(maxOf(4f,8f+density),m.gap,0f)
            assertTrue(m.leadingStart>=4);assertTrue(m.leadingEnd>=4)
        } }
        val compact=SplitButtonMetrics("sm",-4.0,true)
        assertEquals(32f,compact.trailingStart+compact.trailingIcon+compact.trailingEnd,0f)
        assertEquals(28f,SplitButtonMetrics("xs",-1.0,false).height,0f)
        assertEquals(34f,SplitButtonMetrics("sm",-1.5,false).height,0f)
    }
    @Test fun leadingHasVoidPayloadAndTrailingCommitsBeforeCancelableNotification() {
        val order=mutableListOf<String>();var checked=false
        val action=AWCActionDispatcher(null,listener={ event ->
            assertEquals(checked,event.detail["checked"] ?: checked)
            if(event.name=="mdLeadingClick") assertNull(event.rawDetail)
            event.preventDefault();order+="scope:${event.name}"
        })
        val emit:EventSink={name,detail -> order+="callback:$name";if(name=="mdLeadingClick") assertNull(detail) else assertEquals(mapOf("checked" to checked),detail) }
        performNativeSplitButtonAction(emptyMap(),false,checked,{checked=it;order+="commit"},emit,action,"split",emptyList(),AWCActivationMetadata("keyboard"))
        assertFalse(checked)
        performNativeSplitButtonAction(emptyMap(),true,checked,{checked=it;order+="commit"},emit,action,"split",emptyList(),AWCActivationMetadata("pointer",2f,3f))
        assertTrue(checked)
        assertEquals(listOf("scope:mdLeadingClick","callback:mdLeadingClick","commit","scope:mdTrailingClick","callback:mdTrailingClick"),order)
    }
    @Test fun hardAndSoftDisabledBlockBothActionsWithoutCommitting() {
        for(prop in listOf("disabled","softDisabled")) for(trailing in listOf(false,true)) {
            assertFalse(performNativeSplitButtonAction(mapOf(prop to true),trailing,false,{fail("Disabled commit")},{_,_->fail("Disabled event")},null,"split",emptyList(),AWCActivationMetadata()))
        }
    }
    @Test fun popupRelationshipResolvesActualMountedIdentityAndNeverOpensAnything() {
        val registry=AWCPopupRegistry();val first=Any();val next=Any();var visits=0
        assertFalse(registry.focus("menu"))
        registry.register("menu",first) { visits++;true };assertTrue(registry.contains("menu"));assertTrue(registry.focus("menu"))
        registry.register("menu",next) { visits+=10;true };registry.unregister("menu",first)
        assertTrue(registry.focus("menu"));assertEquals(11,visits)
        registry.unregister("menu",next);assertFalse(registry.contains("menu"));assertFalse(registry.focus("menu"))
    }
    @Test fun publicSnapshotTracksCommittedReaderAndClearsOnlyItsOwner() {
        val state=AWCSplitButtonState();val owner=Any();var checked=false
        assertNull(state.snapshot());state.bind(owner) { checked };assertEquals(false,state.snapshot())
        checked=true;assertEquals(true,state.snapshot());state.unbind(Any());assertEquals(true,state.snapshot())
        state.unbind(owner);assertNull(state.snapshot())
    }
}

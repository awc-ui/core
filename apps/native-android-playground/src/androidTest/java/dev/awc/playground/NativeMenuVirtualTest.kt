@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import kotlinx.coroutines.delay
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * md-menu setVirtualProvider() / setComboboxElement() natively (gate-7 r4 R4-13): a 10,000-row virtual list of which only an
 * 8-row window is composed as md-menu-item nodes, a search field in the menu's header as the combobox. Observable effects
 * checked against the source (md-menu.tsx handleKeyDownVirtual / focusVirtual / handleTypeaheadVirtual): listbox role, the active
 * option (aria-activedescendant) without moving focus, wrapping past disabled rows, Home/End across the window (ensureVisible
 * first), typeahead via findPrefix, Enter activating the active option, the header field's own keys routed to the menu, roving
 * focus without a combobox, and null restoring the menu.
 */
class NativeMenuVirtualTest {
    @get:Rule val compose=createComposeRule()
    class Fruit:AWCMenuVirtualProvider {
        val names=listOf("Apple","Banana","Cherry","Date","Elder","Fig","Grape")
        var start by mutableIntStateOf(0)
        val ensured=mutableListOf<Int>();val size=10_000;val window=8
        override fun count()=size
        override fun labelAt(index:Int)="${names[index%7]} $index"
        override fun isDisabledAt(index:Int)=index%7==5
        override suspend fun ensureVisible(index:Int) { ensured+=index
            if(index<start || index>=start+window) { start=maxOf(0,minOf(size-window,index-3));delay(60) } }
        override fun rowIdForIndex(index:Int)=if(index>=start && index<start+window) "row-$index" else null
        override fun findPrefix(buffer:String,from:Int):Int { for(k in 0 until size) { val i=(from+k)%size;if(labelAt(i).lowercase().startsWith(buffer)) return i };return -1 }
    }
    @Test fun virtualProviderAndComboboxFollowTheSource() {
        val p=Fruit();val menus=AWCMenuScopeState();val events=mutableListOf<Pair<String,String>>()
        var query by mutableStateOf("")
        compose.setContent { AWCTheme { AWCMenuScope(menus,Modifier.requiredSize(480.dp,600.dp)) {
            Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                AWCComponent("md-button",mapOf("id" to "trigger","label" to "Fruit","variant" to "tonal"))
                AWCComponent("md-menu",mapOf("id" to "vm","anchor" to "trigger","listLabel" to "Fruit","quick" to true)) { slot->
                    if(slot=="header") BasicTextField(query,{ query=it },Modifier.fillMaxWidth().padding(8.dp).testTag("search"))
                    if(slot=="") for(i in p.start until p.start+p.window) AWCComponent("md-menu-item",mapOf("id" to "row-$i","headline" to p.labelAt(i),"disabled" to p.isDisabledAt(i)),
                        onEvent={ n,_-> events+=n to "row-$i" })
                }
            }
        } } }
        val m=menus.menu("vm")
        fun waitFor(what:String,ok:()->Boolean) { try { compose.waitUntil(3000) { ok() } } catch(e:Throwable) { throw AssertionError("$what (index ${m.virtualIndex}, active ${m.activeDescendant}, start ${p.start})") } }
        // 1. Provider + combobox, opened like the filterable select (focus stays in the search field).
        compose.runOnIdle { m.setVirtualProvider(p);m.setComboboxElement("search") }
        assertTrue("a registered provider makes the surface a listbox",m.isListbox)
        compose.runOnIdle { m.show(false,true) };compose.waitForIdle()
        compose.onNodeWithTag("search").performClick();compose.waitForIdle()
        waitFor("show(): the first enabled index is active") { m.activeDescendant=="row-0" && m.virtualIndex==0 }
        // 2. ArrowDown past the disabled "Fig 5": 0 → 6 in five presses.
        compose.runOnIdle { repeat(5) { m.handleKey("ArrowDown") } }
        waitFor("ArrowDown wraps past disabled rows") { m.activeDescendant=="row-6" && m.virtualIndex==6 }
        compose.onNodeWithTag("search").assertIsFocused()
        // 3. End / Home across the composed window (ensureVisible first), wrapping both ways.
        compose.runOnIdle { m.handleKey("End") };waitFor("End: the last index is windowed and active") { m.activeDescendant=="row-9999" && p.start==9992 }
        assertTrue("End awaits ensureVisible(9999)",9999 in p.ensured)
        compose.runOnIdle { m.handleKey("ArrowDown") };waitFor("ArrowDown from the last index wraps to the first") { m.activeDescendant=="row-0" }
        compose.runOnIdle { m.handleKey("ArrowUp") };waitFor("ArrowUp from the first index wraps to the last") { m.activeDescendant=="row-9999" }
        compose.runOnIdle { m.handleKey("Home") };waitFor("Home: back to the first index and window") { m.activeDescendant=="row-0" && p.start==0 }
        // 4. Typeahead outside the input: "c" → Cherry 2, "ch" stays, after the 500 ms timeout "e" → Elder 4.
        compose.runOnIdle { m.handleKey("c") };waitFor("typeahead 'c' finds Cherry 2") { m.virtualIndex==2 && m.activeDescendant=="row-2" }
        compose.runOnIdle { m.handleKey("h") };compose.waitForIdle();assertEquals("typeahead 'ch' stays on Cherry 2",2,m.virtualIndex)
        Thread.sleep(600);compose.runOnIdle { m.handleKey("e") };waitFor("after the buffer timeout 'e' finds Elder 4") { m.virtualIndex==4 }
        // 5. The header field's own keys reach the menu; characters stay in the field.
        compose.onNodeWithTag("search").performKeyInput { pressKey(Key.DirectionDown) }
        waitFor("ArrowDown typed in the header field moves the active option") { m.virtualIndex==6 && m.activeDescendant=="row-6" }
        compose.onNodeWithTag("search").performTextInput("h");compose.waitForIdle()
        assertEquals("characters typed in the header field stay in the field","h",query);assertEquals(6,m.virtualIndex)
        // 6. Enter activates the active option (mdClick from its row) and the menu closes.
        compose.runOnIdle { events.clear();m.handleKey("Enter") }
        waitFor("activation closes the menu") { !m.isOpen }
        assertTrue("Enter clicks the active option $events",events.contains("mdClick" to "row-6"))
        assertNull("closing clears the active option",m.activeDescendant)
        // 7. Without a combobox the windowed row takes focus (roving focus).
        compose.runOnIdle { m.setComboboxElement(null);m.show(true,true) };compose.waitForIdle()
        compose.runOnIdle { m.handleKey("ArrowDown") };compose.waitForIdle()
        waitFor("without a combobox the active row takes focus") { menus.menu("vm").focusedRow=="row-1" }
        assertNull(m.activeDescendant)
        compose.runOnIdle { m.close() };compose.waitForIdle()
        // 8. null restores the menu's own rows.
        compose.runOnIdle { m.setVirtualProvider(null) }
        assertFalse("setVirtualProvider(null): the surface is a menu again",m.isListbox)
    }
}

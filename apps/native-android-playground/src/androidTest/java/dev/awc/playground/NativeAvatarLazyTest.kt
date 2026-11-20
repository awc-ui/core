package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** d3 r3-05: loading="lazy" (default) defers the request and mdLoad until the avatar nears the viewport; "eager" loads at once
 * (Chrome 153: avatars 3000 px below a 600 px viewport load only after scrolling to them; the eager one loads at once). */
class NativeAvatarLazyTest {
    @get:Rule val compose = createComposeRule()
    private val png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    @Test fun lazyAvatarsLoadNearTheViewport() {
        val loads = mutableListOf<String>()
        fun props(id: String, loading: String?) = buildMap<String, Any?> { put("name", id); put("src", png); if (loading != null) put("loading", loading) }
        compose.setContent {
            AWCTheme {
                Box(Modifier.requiredSize(400.dp, 600.dp)) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        AWCComponent("md-avatar", props("near", null), onEvent = { n, _ -> if (n == "mdLoad") loads += "near" })
                        Spacer(Modifier.height(3000.dp))
                        Box(Modifier.testTag("far")) { AWCComponent("md-avatar", props("far-lazy", null), onEvent = { n, _ -> if (n == "mdLoad") loads += "far-lazy" }) }
                        AWCComponent("md-avatar", props("far-eager", "eager"), onEvent = { n, _ -> if (n == "mdLoad") loads += "far-eager" })
                        Spacer(Modifier.height(800.dp))
                    }
                }
            }
        }
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(1500); compose.waitForIdle(); Thread.sleep(500); compose.waitForIdle()
        assertEquals("before scrolling (Chrome: near + far-eager)", setOf("near", "far-eager"), loads.toSet())
        compose.onNodeWithTag("far").performScrollTo(); compose.waitForIdle(); compose.mainClock.advanceTimeBy(1500); compose.waitForIdle(); Thread.sleep(500); compose.waitForIdle()
        assertEquals("after scrolling (Chrome: far-lazy loads)", setOf("near", "far-eager", "far-lazy"), loads.toSet())
        assertEquals(1, loads.count { it == "far-lazy" })
    }
}

package dev.awc.playground

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.abs

/** Laboratory host: the md-table family — typed hooks of the selected member (defaults first, local values win), retained
 *  property updates with the source types, and the table / row / pagination methods with results. */
class LivePreviewTableHostTest {
    private fun configure(tag: String, properties: JSONObject = JSONObject(), extra: JSONObject.() -> Unit = {}) =
        JSONObject().put("command", "configure").put("tag", tag).put("width", 640).put("dark", false).put("properties", properties).apply(extra)
    private fun method(name: String, vararg args: Any) = JSONObject().put("command", "method").put("method", name).put("arguments", JSONArray(args.toList()))
    private fun update(properties: JSONObject) = JSONObject().put("command", "update").put("properties", properties)
    private val frameCommand get() = JSONObject().put("command", "frame")
    private fun events(vararg frames: JSONObject): List<JSONObject> = frames.flatMap { f -> f.optJSONArray("events")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList() }

    @Test fun tableHooksMethodsAndUpdates() { withHost { token, command ->
        command(configure("md-table", JSONObject().put("selection", "multiple").put("label", "Project table")) {
            put("tableAppearanceDefaults", JSONObject().put("headBackground", "#C8E6C9").put("rowHeightStandard", 64))
            put("tableAppearance", JSONObject().put("headBackground", "#FDE7F3")) }); Thread.sleep(300)
        var f = command(frameCommand)
        assertTrue("local head background wins (${count(f, 0xFDE7F3)} px)", count(f, 0xFDE7F3) > 3000)
        assertEquals("defaults overridden", 0, count(f, 0xC8E6C9))
        val box = bounds(f, "md-table"); assertTrue("row height hook from the defaults: table ${box.h}", box.h >= 56 + 3 * 64 - 2)
        var s = command(method("getSelection")).getJSONObject("result").getJSONObject("awcTableResult")
        assertEquals(s.toString(), 0, s.getInt("count")); assertEquals(3, s.getInt("total")); assertFalse(s.getBoolean("all"))
        val all = command(method("selectAll")); assertTrue("selectAll emits mdSelectionChange", events(all, command(frameCommand)).any { it.getString("name") == "mdSelectionChange" })
        s = command(method("getSelection")).getJSONObject("result").getJSONObject("awcTableResult")
        assertEquals(s.toString(), 3, s.getInt("count")); assertEquals("project-0,project-1,project-2", (0 until 3).joinToString(",") { s.getJSONArray("values").getString(it) })
        command(method("deselectAll")); assertEquals(0, command(method("getSelection")).getJSONObject("result").getJSONObject("awcTableResult").getInt("count"))
        command(method("toggleSelectAll")); assertEquals(3, command(method("getSelection")).getJSONObject("result").getJSONObject("awcTableResult").getInt("count"))
        val sort = events(command(method("setSort", "name", "desc")), command(frameCommand)).firstOrNull { it.getString("name") == "mdSortChange" }
        assertTrue("setSort emits mdSortChange: $sort", sort?.getJSONObject("detail")?.let { it.getString("column") == "name" && it.getString("order") == "desc" } == true)
        var m = command(method("pinColumn", 0, "start")); assertTrue("pinColumn without an explicit template returns null: $m", m.getJSONObject("result").isNull("awcTableResult"))
        command(update(JSONObject().put("columnTemplate", "2fr 1fr 1fr").put("striped", true))); Thread.sleep(150)
        m = command(method("pinColumn", 0, "start")); assertEquals("start", m.getJSONObject("result").getString("awcTableResult"))
        assertTrue("mdPinChange", events(m, command(frameCommand)).any { it.getString("name") == "mdPinChange" })
        assertFalse(command(method("setColumnVisibility", 2, false)).getJSONObject("result").getBoolean("awcTableResult"))
        assertTrue(command(method("setColumnVisibility", 2, true)).getJSONObject("result").getBoolean("awcTableResult"))
        command(method("animateNextChange"))
        command(update(JSONObject().put("density", "compact").put("selection", "single").put("loading", true).put("loadingMode", "skeleton")))
        for (bad in listOf(JSONObject().put("density", "tiny"), JSONObject().put("selection", "all"), JSONObject().put("columns", "3"), JSONObject().put("bogus", 1), JSONObject().put("sortOrder", "up")))
            assertRejected(token, update(bad))
        assertRejected(token, method("setSort", "name")); assertRejected(token, method("pinColumn", -1, "start")); assertRejected(token, method("pinColumn", 0, "left"))
        assertRejected(token, method("setColumnVisibility", 0, "no")); assertRejected(token, method("getSelection", 1)); assertRejected(token, method("goToPage", 1))
    } }

    @Test fun rowPaginationAndSortLabel() {
        withHost { token, command ->
            command(configure("md-table-row")); Thread.sleep(250)
            var e = events(command(method("toggle")), command(frameCommand)).firstOrNull { it.getString("name") == "mdRowExpandedChange" }
            assertTrue("toggle() expands: $e", e?.getJSONObject("detail")?.getBoolean("expanded") == true)
            e = events(command(method("toggle")), command(frameCommand)).firstOrNull { it.getString("name") == "mdRowExpandedChange" }
            assertTrue("toggle() collapses: $e", e?.getJSONObject("detail")?.getBoolean("expanded") == false)
            command(update(JSONObject().put("expanded", true).put("highlight", true)))
            for (bad in listOf(JSONObject().put("rowgroup", "side"), JSONObject().put("selected", "yes"))) assertRejected(token, update(bad))
            assertRejected(token, method("toggle", 1)); assertRejected(token, method("getSelection"))
        }
        withHost { token, command ->
            command(configure("md-table-pagination", JSONObject().put("count", 87).put("page", 0).put("rowsPerPage", 10).put("rowsPerPageOptions", "5,10,25,50").put("showFirstLast", true)) {
                put("tablePaginationAppearance", JSONObject().put("background", "#E0F7FA")) }); Thread.sleep(250)
            assertTrue("pagination background hook", count(command(frameCommand), 0xE0F7FA) > 3000)
            var ev = events(command(method("goToPage", 3)), command(frameCommand))
            assertTrue("goToPage(3): $ev", ev.any { it.getString("name") == "mdPageChange" && it.getJSONObject("detail").getInt("page") == 3 })
            ev = events(command(method("setRowsPerPage", 25)), command(frameCommand))
            assertEquals("setRowsPerPage(25): $ev", listOf("mdRowsPerPageChange", "mdPageChange"), ev.map { it.getString("name") })
            command(update(JSONObject().put("page", 2)))
            for (bad in listOf(JSONObject().put("density", 3), JSONObject().put("compact", "yes"))) assertRejected(token, update(bad))
            assertRejected(token, method("goToPage", "2")); assertRejected(token, method("setRowsPerPage", 0)); assertRejected(token, method("selectAll"))
        }
        withHost { token, command ->
            command(configure("md-table-sort-label", JSONObject().put("column", "name")) { put("tableSortLabelAppearance", JSONObject().put("activeColor", "#00897B")) }); Thread.sleep(250)
            val before = count(command(frameCommand), 0x00897B, 40)
            command(update(JSONObject().put("active", true).put("order", "desc"))); Thread.sleep(400)
            val after = count(command(frameCommand), 0x00897B, 40); assertTrue("active label in the active colour hook ($before → $after px)", after > before + 20)
            for (bad in listOf(JSONObject().put("order", "up"), JSONObject().put("column", 1))) assertRejected(token, update(bad))
            assertRejected(token, method("setSort", "name", "asc"))
        }
    }

    @Test fun cellToolbarContainerToggleAndGroups() {
        withHost { token, command ->
            command(configure("md-table-cell") { put("tableCellAppearance", JSONObject().put("background", "#FFF3E0").put("minHeight", 80)) }); Thread.sleep(250)
            assertTrue("cell background hook", count(command(frameCommand), 0xFFF3E0) > 3000)
            command(update(JSONObject().put("align", "end").put("numeric", true).put("scope", "").put("sticky", "").put("density", -2)))
            assertRejected(token, update(JSONObject().put("align", "left")))
        }
        withHost { token, command ->
            command(configure("md-table-toolbar", JSONObject().put("headline", "Projects")) {
                put("tableToolbarAppearanceDefaults", JSONObject().put("selectionBackground", "#B2EBF2")); put("tableToolbarAppearance", JSONObject().put("background", "#EDE7F6").put("minHeight", 96)) })
            Thread.sleep(250); var f = command(frameCommand)
            assertTrue("toolbar background hook", count(f, 0xEDE7F6) > 5000); assertTrue("toolbar min height hook ${bounds(f, "md-table-toolbar").h}", bounds(f, "md-table-toolbar").h >= 95)
            command(update(JSONObject().put("numSelected", 2))); Thread.sleep(400); f = command(frameCommand)
            assertTrue("selection band in the hook colour (${count(f, 0xB2EBF2)} px)", count(f, 0xB2EBF2) > 5000)
            assertRejected(token, update(JSONObject().put("numSelected", "2")))
        }
        withHost { token, command ->
            command(configure("md-table-container", JSONObject().put("variant", "outlined")) { put("tableContainerAppearance", JSONObject().put("outlineColor", "#D32F2F").put("outlineWidth", 3)) })
            Thread.sleep(250); assertTrue("container outline hooks", count(command(frameCommand), 0xD32F2F, 40) > 1500)
            command(update(JSONObject().put("variant", "filled").put("shape", "small").put("vibrant", true).put("elevation", 2)))
            for (bad in listOf(JSONObject().put("variant", "raised"), JSONObject().put("elevation", 6))) assertRejected(token, update(bad))
        }
        withHost { token, command ->
            command(configure("md-table-expand-toggle") { put("tableExpandToggleAppearance", JSONObject().put("rotation", 180)) }); Thread.sleep(200)
            command(update(JSONObject().put("buttonLabel", "Show details").put("icon", "expand_more"))); assertRejected(token, update(JSONObject().put("expanded", true)))
        }
        for (tag in listOf("md-table-body", "md-table-foot")) withHost { token, command ->
            command(configure(tag)); Thread.sleep(200); command(update(JSONObject().put("presentational", true))); assertRejected(token, update(JSONObject().put("presentational", 1)))
        }
        withHost { token, command -> command(configure("md-table-head")); Thread.sleep(200); assertRejected(token, update(JSONObject().put("presentational", true))) }
    }

    private data class Box(val x: Double, val y: Double, val w: Double, val h: Double)
    private fun bounds(frame: JSONObject, name: String): Box {
        val matches = nodes(frame).filter { it.optString("name") == name }
        assertTrue("$name in ${nodes(frame).map { it.getString("id") + "/" + it.optString("name") }}", matches.isNotEmpty())
        val b = matches.first().getJSONObject("bounds"); return Box(b.getDouble("x"), b.getDouble("y"), b.getDouble("width"), b.getDouble("height"))
    }
    private fun assertRejected(token: String, body: JSONObject) { val response = request("POST", "/command", token, body); assertTrue("$body rejected: $response", response.first >= 400 || response.second.has("error")) }
    private fun nodes(frame: JSONObject) = frame.getJSONObject("inspection").getJSONArray("nodes").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    private fun bitmap(frame: JSONObject): Bitmap { val bytes = Base64.decode(frame.getString("png"), Base64.DEFAULT); return BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }
    private fun near(a: Int, b: Int, tol: Int) = listOf(16, 8, 0).all { abs((a shr it and 255) - (b shr it and 255)) <= tol }
    /** Pixels (in dp²) within ±tol of [color] anywhere in the frame. */
    private fun count(frame: JSONObject, color: Int, tol: Int = 6): Int {
        val b = bitmap(frame); val s = b.width / 640.0; var n = 0
        val px = IntArray(b.width * b.height); b.getPixels(px, 0, b.width, 0, 0, b.width, b.height)
        for (p in px) if (near(p, color, tol)) n++
        return (n / (s * s)).toInt()
    }
    private fun withHost(block: (String, (JSONObject) -> JSONObject) -> Unit) {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token).putExtra("profile", true)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false)
                if (!ready) Thread.sleep(25)
            }
            assertTrue("Debug host did not become ready", ready)
            block(token) { value ->
                val response = request("POST", "/command", token, value)
                assertEquals(response.second.toString(), 200, response.first)
                assertFalse(response.second.toString(), response.second.has("error"))
                response.second
            }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 6000; setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            if (body != null) {
                val bytes = body.toString().toByteArray()
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            val stream = if (status < 400) connection.inputStream else connection.errorStream
            return status to JSONObject(stream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}

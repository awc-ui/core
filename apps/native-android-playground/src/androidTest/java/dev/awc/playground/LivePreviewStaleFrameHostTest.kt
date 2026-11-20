package dev.awc.playground

import android.content.Intent
import android.util.Log
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Laboratory host robustness (d2): no frame pairs new pixels with an old inspection, on any update, method or input path.
 * For each scenario: fresh host, configure, preparation, stable frames; then one retained update, method or input. The frame
 * that answers it (or, after an acknowledged update, the next frame) and the frames polled until the preview is stable
 * again are classified against the pre-action and the final frame:
 *  - discrete: pixels changed from the pre-action frame while the inspection is still the pre-action one (new pixels paired
 *    with an old inspection: the SwiftUI host's R4-26 class);
 *  - visible (reported): pixels equal the final pixels while a bounds edge of a node in both inspections differs by ≥ 1
 *    device pixel. The Compose host snapshots the inspection at the pre-draw of the very draw it copies, so these are layout
 *    boxes whose change draws nothing (the text field's label box while its font animates), not pairing errors.
 *  - late: the action's own frame (its reply, or the frame after an acknowledged update) still shows the pre-action
 *    pixels and inspection although the action changes them (gate-7 R1-15: md-fab label, md-icon-button variant).
 * The test fails on discrete frames and on late replies.
 */
class LivePreviewStaleFrameHostTest {
    private class Scenario(val name: String, val config: JSONObject, val prep: List<JSONObject>, val act: (JSONObject) -> JSONObject)
    private fun configure(tag: String, properties: JSONObject) = JSONObject().put("command", "configure").put("tag", tag).put("width", 640).put("dark", false).put("properties", properties)
    private fun method(name: String, vararg args: Any) = JSONObject().put("command", "method").put("method", name).put("arguments", JSONArray(args.toList()))
    private fun update(properties: JSONObject) = JSONObject().put("command", "update").put("properties", properties)
    private val frameCommand get() = JSONObject().put("command", "frame")
    private fun props(vararg pairs: Pair<String, Any>) = JSONObject().apply { pairs.forEach { put(it.first, it.second) } }
    private fun center(frame: JSONObject): JSONObject {
        val nodes = frame.optJSONObject("inspection")?.optJSONArray("nodes")
        val all = nodes?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
        val b = (all.firstOrNull { it.optString("id") == "component" } ?: all.firstOrNull())?.optJSONObject("bounds")
        return if (b == null) JSONObject().put("x", 40).put("y", 30)
        else JSONObject().put("x", b.getDouble("x") + b.getDouble("width") / 2).put("y", b.getDouble("y") + b.getDouble("height") / 2)
    }
    private fun click(frame: JSONObject) = center(frame).put("command", "click")

    private val accordion = props("headline" to "A shared design language", "supportingText" to "Built for every surface", "expanded" to true)
    private val scenarios = listOf(
        Scenario("text-field.update.error", configure("md-text-field", props("label" to "Email", "value" to "ab", "supportingText" to "Work email")), emptyList()) { update(props("error" to true, "errorText" to "Enter a valid address in the company domain")) },
        Scenario("text-field.update.value", configure("md-text-field", props("label" to "Email", "value" to "", "maxLength" to 40, "supportingText" to "Work email")), emptyList()) { update(props("value" to "someone@example.com")) },
        Scenario("number-field.update.error", configure("md-number-field", props("label" to "Guests", "value" to 2, "min" to 0, "max" to 8, "step" to 1, "supportingText" to "Up to 8")), emptyList()) { update(props("error" to true, "errorText" to "Too many guests for this room")) },
        Scenario("badge.update.value", configure("md-badge", props("variant" to "large", "value" to "3")), emptyList()) { update(props("value" to "1234")) },
        Scenario("skeleton.update.lines", configure("md-skeleton", props("animation" to "none", "lines" to 2)), emptyList()) { update(props("lines" to 4)) },
        Scenario("tabs.update.active", configure("md-tabs", JSONObject()), emptyList()) { update(props("activeTabIndex" to 2)) },
        Scenario("navbar.update.active", configure("md-navigation-bar", JSONObject()), emptyList()) { update(props("activeIndex" to 2)) },
        Scenario("breadcrumbs.update.max", configure("md-breadcrumbs", JSONObject()), emptyList()) { update(props("maxItems" to 2)) },
        Scenario("divider.update.inset", configure("md-divider", JSONObject()), emptyList()) { update(props("inset" to true)) },
        Scenario("accordion-item.update.collapse", configure("md-accordion-item", accordion), emptyList()) { update(props("expanded" to false)) },
        Scenario("text-field.update.valid-again", configure("md-text-field", props("label" to "Email", "value" to "", "required" to true)), listOf(method("reportValidity"))) { update(props("value" to "someone@example.com")) },
        Scenario("number-field.update.valid-again", configure("md-number-field", props("label" to "Guests", "min" to 0, "max" to 8, "step" to 1, "required" to true)), listOf(method("reportValidity"))) { update(props("value" to 3)) },
        Scenario("snackbar.update.message", configure("md-snackbar", props("open" to true, "message" to "Saved", "autoHide" to false)), emptyList()) { update(props("message" to "The draft was saved to your workspace and shared with the review group")) },
        Scenario("checkbox.update.checked", configure("md-checkbox", props("required" to true)), listOf(method("reportValidity"))) { update(props("checked" to true)) },
        Scenario("fab.update.label (R1-15)", configure("md-fab", JSONObject()), emptyList()) { update(props("label" to "Compose")) },
        Scenario("icon-button.update.variant (R1-15)", configure("md-icon-button", JSONObject()), emptyList()) { update(props("variant" to "filled", "toggle" to true)) },
        Scenario("button.update.disabled", configure("md-button", props("variant" to "filled")), emptyList()) { update(props("disabled" to true)) },
        Scenario("breadcrumb-item.update.disabled (R6-22)", configure("md-breadcrumb-item", JSONObject()), emptyList()) { update(props("disabled" to true)) },
        Scenario("tabs.method.selectTab", configure("md-tabs", JSONObject()), emptyList()) { method("selectTab", 2) },
        Scenario("navbar.method.select", configure("md-navigation-bar", JSONObject()), emptyList()) { method("select", 2) },
        Scenario("list.method.selectItem", configure("md-list", JSONObject()), emptyList()) { method("selectItem", 1) },
        Scenario("accordion-item.method.toggle", configure("md-accordion-item", accordion), emptyList()) { method("toggle") },
        Scenario("number-field.method.stepUp", configure("md-number-field", props("label" to "Guests", "value" to 2, "min" to 0, "max" to 8, "step" to 1)), emptyList()) { method("stepUp") },
        Scenario("text-field.method.reportValidity", configure("md-text-field", props("label" to "Email", "value" to "", "required" to true)), emptyList()) { method("reportValidity") },
        Scenario("switch.method.reportValidity", configure("md-switch", props("required" to true)), emptyList()) { method("reportValidity") },
        Scenario("switch.input.click", configure("md-switch", JSONObject()), emptyList()) { click(it) },
        Scenario("checkbox.input.click", configure("md-checkbox", props("required" to true)), listOf(method("reportValidity"))) { click(it) },
        Scenario("text-field.input.text", configure("md-text-field", props("label" to "Email", "value" to "", "maxLength" to 40, "supportingText" to "Work email")), listOf(method("setFocus"))) { JSONObject().put("command", "text").put("text", "someone@example.com") },
        Scenario("number-field.input.ArrowUp", configure("md-number-field", props("label" to "Guests", "value" to 2, "min" to 0, "max" to 8, "step" to 1)), listOf(method("setFocus"))) { JSONObject().put("command", "key").put("key", "ArrowUp") },
    )

    private fun inspection(frame: JSONObject) = frame.optJSONObject("inspection")?.toString() ?: "null"
    private fun nodes(frame: JSONObject): Map<String, JSONObject> = frame.optJSONObject("inspection")?.optJSONArray("nodes")
        ?.let { a -> (0 until a.length()).map { a.getJSONObject(it) }.associateBy { it.optString("id") } } ?: emptyMap()
    /** Largest bounds-edge difference (device pixels) between nodes present in both frames. */
    private fun edgeDelta(a: JSONObject, b: JSONObject): Double {
        val scale = a.optDouble("width", 0.0) / a.optDouble("logicalWidth", 1.0)
        val other = nodes(b); var d = 0.0
        for ((id, n) in nodes(a)) {
            val x = n.optJSONObject("bounds") ?: continue; val y = other[id]?.optJSONObject("bounds") ?: continue
            val (x0, y0, x1, y1) = listOf(x.getDouble("x"), x.getDouble("y"), x.getDouble("x") + x.getDouble("width"), x.getDouble("y") + x.getDouble("height"))
            val (u0, v0, u1, v1) = listOf(y.getDouble("x"), y.getDouble("y"), y.getDouble("x") + y.getDouble("width"), y.getDouble("y") + y.getDouble("height"))
            d = maxOf(d, kotlin.math.abs(x0 - u0), kotlin.math.abs(y0 - v0), kotlin.math.abs(x1 - u1), kotlin.math.abs(y1 - v1))
        }
        return d * scale
    }
    /** Which node bounds or metrics differ (first four). */
    private fun diff(a: JSONObject, b: JSONObject): String {
        val x = nodes(a); val y = nodes(b); val out = mutableListOf<String>()
        for (id in (x.keys + y.keys).toSortedSet()) {
            val p = x[id]; val q = y[id]
            if (p == null || q == null) { out += "$id:${if (p == null) "new" else "gone"}"; continue }
            if (p.optJSONObject("bounds")?.toString() != q.optJSONObject("bounds")?.toString()) out += "$id.bounds ${p.optJSONObject("bounds")}→${q.optJSONObject("bounds")}"
            val pm = p.optJSONObject("metrics"); val qm = q.optJSONObject("metrics")
            for (k in ((pm?.keys()?.asSequence()?.toList() ?: emptyList()) + (qm?.keys()?.asSequence()?.toList() ?: emptyList())).toSortedSet())
                if (pm?.opt(k)?.toString() != qm?.opt(k)?.toString()) out += "$id.$k ${pm?.opt(k)?.toString()?.take(40)}→${qm?.opt(k)?.toString()?.take(40)}"
        }
        return out.take(4).joinToString("; ")
    }
    private fun same(a: JSONObject, b: JSONObject) = a.optString("png") == b.optString("png") && inspection(a) == inspection(b)

    /** Polls frames 40 ms apart until two consecutive ones agree (at most [limit] ms). */
    private fun stable(command: (JSONObject) -> JSONObject, first: JSONObject?, limit: Long = 1500): Pair<JSONObject, List<JSONObject>> {
        var previous = first ?: command(frameCommand)
        val frames = mutableListOf<JSONObject>()
        val end = System.currentTimeMillis() + limit
        while (System.currentTimeMillis() < end) {
            Thread.sleep(40)
            val f = command(frameCommand)
            check(!f.has("error")) { "frame: ${f.optString("error")}" }
            frames += f
            if (same(f, previous)) return f to frames
            previous = f
        }
        return previous to frames
    }

    @Test fun noFramePairsNewPixelsWithAnOldInspection() {
        val n = InstrumentationArgs.int("staleFrameIterations", 2)
        val report = StringBuilder()
        var judged = 0; var staleTotal = 0; var ran = 0
        val failures = mutableListOf<String>(); val residues = mutableListOf<String>()
        for (scenario in scenarios) {
            var iterations = 0; var discrete = 0; var late = 0; var visible = 0; var residue = 0; var animating = 0; var unchanged = 0; val errors = linkedSetOf<String>()
            repeat(n) {
                withHost { command ->
                    val configured = command(scenario.config)
                    if (configured.has("error")) { errors += "configure: ${configured.optString("error")}"; return@withHost }
                    for (p in scenario.prep) { val r = command(p); if (r.has("error")) { errors += "prep: ${r.optString("error")}"; return@withHost } }
                    val (base, _) = stable(command, null)
                    val reply = command(scenario.act(base))
                    if (reply.has("error")) { errors += "act: ${reply.optString("error")}"; return@withHost }
                    val first = if (reply.has("png")) reply else command(frameCommand)
                    val (final, frames) = stable(command, first)
                    iterations++
                    val sequence = listOf(first) + frames
                    val inspectionChanged = inspection(base) != inspection(final)
                    fun isDiscrete(f: JSONObject) = inspectionChanged && f.optString("png") != base.optString("png") && inspection(f) == inspection(base)
                    fun isVisible(f: JSONObject) = f.optString("png") == final.optString("png") && edgeDelta(f, final) >= 1.0
                    fun isResidue(f: JSONObject) = f.optString("png") == final.optString("png") && inspection(f) != inspection(final)
                    sequence.firstOrNull(::isDiscrete)?.let { discrete++; if (failures.size < 6) failures += "${scenario.name} discrete: ${diff(it, final)}" }
                    sequence.firstOrNull(::isVisible)?.let { visible++; if (residues.size < 6) residues += "${scenario.name} visible: ${diff(it, final)}" }
                    sequence.firstOrNull(::isResidue)?.let { residue++; if (residues.size < 6) residues += "${scenario.name}: ${diff(it, final)}" }
                    if (same(first, base) && !same(base, final)) { late++; if (failures.size < 6) failures += "${scenario.name} late: the reply still shows the pre-action frame (${diff(first, final)})" }
                    if (first.optString("png") != final.optString("png") && inspection(first) != inspection(final)) animating++
                    if (same(base, final)) unchanged++
                }
            }
            if (iterations > 0) ran++
            judged += iterations; staleTotal += discrete + late
            val line = "${scenario.name} n=$iterations discrete=$discrete late=$late visible=$visible residue=$residue animating=$animating unchanged=$unchanged${if (errors.isEmpty()) "" else " ERR ${errors.joinToString(" | ").take(200)}"}"
            Log.i("AWCStaleFrame", line); report.appendLine(line)
        }
        Log.i("AWCStaleFrame", "TOTAL iterations $judged discrete+late $staleTotal scenarios $ran/${scenarios.size}")
        residues.forEach { Log.i("AWCStaleFrame", "residue $it") }; failures.forEach { Log.i("AWCStaleFrame", "FAIL $it") }
        assertTrue("most scenarios ran on the Compose host:\n$report", ran >= scenarios.size - 3)
        assertEquals("frames pairing new pixels with the pre-action inspection (discrete) or replies that predate their action (late):\n$report\n${failures.joinToString("\n")}", 0, staleTotal)
    }

    private fun withHost(block: ((JSONObject) -> JSONObject) -> Unit) {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false)
                if (!ready) Thread.sleep(25)
            }
            assertTrue("Debug host did not become ready", ready)
            block { value -> request("POST", "/command", token, value).second }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 8000; setRequestProperty("Authorization", "Bearer $token")
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
            val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            return status to runCatching { JSONObject(text) }.getOrElse { JSONObject().put("error", text.take(200)) }
        } finally { connection.disconnect() }
    }
}

private object InstrumentationArgs {
    fun int(name: String, default: Int) = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString(name)?.toIntOrNull() ?: default
}

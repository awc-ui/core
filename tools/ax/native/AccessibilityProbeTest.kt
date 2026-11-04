package dev.awc.playground

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.UiAutomation
import android.content.Intent
import android.graphics.Rect
import android.os.Build
import android.view.Display
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeProvider
import android.view.inspector.WindowInspector
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckPreset
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityHierarchyCheck
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckResult.AccessibilityCheckResultType
import com.google.android.apps.common.testing.accessibility.framework.Parameters
import com.google.android.apps.common.testing.accessibility.framework.uielement.AccessibilityHierarchyAndroid
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.UUID

/**
 * tools/ax Android probe. Renders each case through the Laboratory's Compose live host (the same `configure` request
 * the Laboratory sends). The host draws into a Presentation on a private virtual display, which the system
 * accessibility service does not track, so the tree is read in process from each preview window's views and their
 * AccessibilityNodeProvider: the AccessibilityNodeInfo objects Compose serves TalkBack for the same content in an
 * ordinary window. Runs the Accessibility Test Framework (LATEST preset, View hierarchy; no screenshot, so contrast is
 * out of scope here) and records accessibility events the preview windows send (announcements, live-region and pane
 * changes) plus input focus after Tab key presses delivered by the host's `key` command.
 * Cases: androidTest asset ax/cases.json (or the `axCases` argument); output: files/ax/out.json.
 */
class AccessibilityProbeTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val automation: UiAutomation by lazy {
        instrumentation.getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES).also { a ->
            a.serviceInfo = a.serviceInfo.apply {
                flags = flags or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            }
        }
    }
    private val dir get() = File(instrumentation.targetContext.getExternalFilesDir(null), "ax").apply { mkdirs() }
    private val events = mutableListOf<JSONObject>()

    private fun rel(r: Rect, o: Rect) = JSONArray(listOf(r.left - o.left, r.top - o.top, r.width(), r.height()))
    private fun describe(n: AccessibilityNodeInfo, origin: Rect): JSONObject {
        val c = AccessibilityNodeInfoCompat.wrap(n)
        val o = JSONObject().put("class", n.className?.toString() ?: "")
        n.text?.let { o.put("text", it.toString()) }
        n.contentDescription?.let { o.put("contentDescription", it.toString()) }
        if (Build.VERSION.SDK_INT >= 30) n.stateDescription?.let { o.put("stateDescription", it.toString()) }
        n.hintText?.let { o.put("hint", it.toString()) }
        if (Build.VERSION.SDK_INT >= 28) {
            n.tooltipText?.let { o.put("tooltip", it.toString()) }; n.paneTitle?.let { o.put("paneTitle", it.toString()) }
            if (n.isHeading) o.put("heading", true); if (n.isScreenReaderFocusable) o.put("screenReaderFocusable", true)
        }
        c.roleDescription?.let { o.put("roleDescription", it.toString()) }
        n.error?.let { o.put("error", it.toString()) }
        if (n.isCheckable) o.put("checkable", true); if (n.isChecked) o.put("checked", true)
        if (!n.isEnabled) o.put("enabled", false); if (n.isFocusable) o.put("focusable", true); if (n.isFocused) o.put("focused", true)
        if (n.isSelected) o.put("selected", true); if (n.isClickable) o.put("clickable", true); if (n.isLongClickable) o.put("longClickable", true)
        if (n.isEditable) o.put("editable", true); if (n.isPassword) o.put("password", true); if (n.isScrollable) o.put("scrollable", true)
        if (n.isContentInvalid) o.put("invalid", true); if (!n.isImportantForAccessibility) o.put("important", false); if (!n.isVisibleToUser) o.put("visible", false)
        if (n.liveRegion != 0) o.put("liveRegion", if (n.liveRegion == 1) "polite" else "assertive")
        n.viewIdResourceName?.let { o.put("viewId", it) }
        n.rangeInfo?.let { o.put("range", JSONObject().put("type", it.type).put("min", it.min.toDouble()).put("max", it.max.toDouble()).put("current", it.current.toDouble())) }
        n.collectionInfo?.let { o.put("collection", JSONObject().put("rows", it.rowCount).put("columns", it.columnCount).put("selectionMode", it.selectionMode)) }
        n.collectionItemInfo?.let { o.put("collectionItem", JSONObject().put("row", it.rowIndex).put("column", it.columnIndex).put("selected", it.isSelected).put("heading", it.isHeading)) }
        val skip = setOf(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS, AccessibilityNodeInfo.ACTION_SELECT, AccessibilityNodeInfo.ACTION_CLEAR_SELECTION)
        val actions = n.actionList.filter { it.id !in skip }.map { a -> JSONObject().put("id", a.id).put("name", actionName(a.id)).also { j -> a.label?.let { j.put("label", it.toString()) } } }
        if (actions.isNotEmpty()) o.put("actions", JSONArray(actions))
        val r = Rect(); n.getBoundsInScreen(r); o.put("frame", rel(r, origin))
        return o
    }
    private fun actionName(id: Int) = when (id) {
        AccessibilityNodeInfo.ACTION_CLICK -> "click"; AccessibilityNodeInfo.ACTION_LONG_CLICK -> "longClick"; AccessibilityNodeInfo.ACTION_FOCUS -> "focus"; AccessibilityNodeInfo.ACTION_CLEAR_FOCUS -> "clearFocus"
        AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> "scrollForward"; AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> "scrollBackward"; AccessibilityNodeInfo.ACTION_EXPAND -> "expand"; AccessibilityNodeInfo.ACTION_COLLAPSE -> "collapse"
        AccessibilityNodeInfo.ACTION_DISMISS -> "dismiss"; AccessibilityNodeInfo.ACTION_SET_TEXT -> "setText"; AccessibilityNodeInfo.ACTION_SET_SELECTION -> "setSelection"
        AccessibilityNodeInfo.ACTION_COPY -> "copy"; AccessibilityNodeInfo.ACTION_PASTE -> "paste"; AccessibilityNodeInfo.ACTION_CUT -> "cut"
        AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY -> "nextGranularity"; AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY -> "previousGranularity"
        android.R.id.accessibilityActionSetProgress -> "setProgress"; android.R.id.accessibilityActionShowOnScreen -> "showOnScreen"; android.R.id.accessibilityActionScrollToPosition -> "scrollToPosition"
        android.R.id.accessibilityActionShowTooltip -> "showTooltip"; android.R.id.accessibilityActionHideTooltip -> "hideTooltip"; android.R.id.accessibilityActionPageUp -> "pageUp"; android.R.id.accessibilityActionPageDown -> "pageDown"
        else -> if (id > 0x01000000) "custom" else "action$id"
    }
    // Main-thread round trip (never waitForIdleSync: indeterminate animations keep the main looper busy indefinitely).
    private fun <T> onMain(block: () -> T): T { var value: Result<T>? = null; instrumentation.runOnMainSync { value = runCatching(block) }; return value!!.getOrThrow() }
    /** Window root views of the preview (the Presentation and any dialog or popup windows it opens), on the host's private display. */
    private fun previewRoots(): List<View> = WindowInspector.getGlobalWindowViews().filter { it.isAttachedToWindow && it.isShown && (it.display?.displayId ?: Display.DEFAULT_DISPLAY) != Display.DEFAULT_DISPLAY }
        // The Presentation (the preview itself) first, then the windows it opens (dialogs, sheets, popups), as they stack.
        .sortedBy { r -> (r.layoutParams as? android.view.WindowManager.LayoutParams)?.type?.let { it == 2037 /* TYPE_PRESENTATION */ || it == 2030 /* TYPE_PRIVATE_PRESENTATION */ } != true }
    // Pixels for the contrast check: every preview window copied from its surface (PixelCopy, as Compose's captureToImage does
    // through DialogWindowProvider) and composed at its position on the preview display — the coordinate space of the frames.
    private fun windowOf(v: View): android.view.Window? = (v as? androidx.compose.ui.window.DialogWindowProvider)?.window
        ?: (v as? ViewGroup)?.let { g -> (0 until g.childCount).firstNotNullOfOrNull { windowOf(g.getChildAt(it)) } }
    private fun screenshot(): android.graphics.Bitmap? {
        val shots = onMain { previewRoots().mapNotNull { r -> windowOf(r)?.let { w -> val p = IntArray(2); r.getLocationOnScreen(p); Triple(w, p, intArrayOf(r.width, r.height)) } } }
        if (shots.isEmpty()) return null
        val out = android.graphics.Bitmap.createBitmap(shots.maxOf { it.second[0] + it.third[0] }.coerceAtLeast(1), shots.maxOf { it.second[1] + it.third[1] }.coerceAtLeast(1), android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(out); canvas.drawColor(android.graphics.Color.WHITE)
        val thread = android.os.HandlerThread("ax-pixelcopy").apply { start() }
        try {
            for ((w, p, size) in shots) {
                val b = android.graphics.Bitmap.createBitmap(size[0].coerceAtLeast(1), size[1].coerceAtLeast(1), android.graphics.Bitmap.Config.ARGB_8888)
                val latch = java.util.concurrent.CountDownLatch(1); var ok = false
                android.view.PixelCopy.request(w, b, { code -> ok = code == android.view.PixelCopy.SUCCESS; latch.countDown() }, android.os.Handler(thread.looper))
                if (latch.await(3, java.util.concurrent.TimeUnit.SECONDS) && ok) canvas.drawBitmap(b, p[0].toFloat(), p[1].toFloat(), null)
            }
        } finally { thread.quitSafely() }
        return out
    }
    private fun composeHost(v: View): View? = if (v is androidx.compose.ui.platform.ComposeView) v else (v as? ViewGroup)?.let { g -> (0 until g.childCount).firstNotNullOfOrNull { composeHost(g.getChildAt(it)) } }
    private fun composeRoot(v: View): View? = if (v is RootForTest) v else (v as? ViewGroup)?.let { g -> (0 until g.childCount).firstNotNullOfOrNull { composeRoot(g.getChildAt(it)) } }
    private fun originOf(v: View): Rect { val p = IntArray(2); v.getLocationOnScreen(p); return Rect(p[0], p[1], p[0] + v.width, p[1] + v.height) }
    // Virtual child ids as the provider reports them (AccessibilityNodeInfo#getChildId is not public API); Compose semantics children otherwise.
    private val childIdMethod by lazy { runCatching { AccessibilityNodeInfo::class.java.getMethod("getChildId", Int::class.javaPrimitiveType).also { it.isAccessible = true } }.getOrNull() }
    private var childOrder = "accessibility"
    // The accessibility delegate's children: SemanticsNode.replacedChildren, which includes the "fake" nodes Compose emits to carry
    // the role and content description of a merging node that has children (internal API, read reflectively; public `children` otherwise).
    private val replacedChildrenMethod by lazy { runCatching { SemanticsNode::class.java.getMethod("getReplacedChildren\$ui_release") }.getOrNull() }
    private val isFakeMethod by lazy { runCatching { SemanticsNode::class.java.getMethod("isFake\$ui_release") }.getOrNull() }
    @Suppress("UNCHECKED_CAST")
    private fun a11yChildren(n: SemanticsNode): List<SemanticsNode> = replacedChildrenMethod?.let { m -> runCatching { m.invoke(n) as List<SemanticsNode> }.getOrNull() } ?: n.children
    private fun isFake(n: SemanticsNode?) = n != null && isFakeMethod?.let { m -> runCatching { m.invoke(n) as Boolean }.getOrNull() } == true
    private fun semanticsById(v: View): Map<Int, SemanticsNode> {
        val root = (v as? RootForTest)?.semanticsOwner?.unmergedRootSemanticsNode ?: return emptyMap()
        val all = HashMap<Int, SemanticsNode>(); fun walk(n: SemanticsNode) { all[n.id] = n; a11yChildren(n).forEach(::walk) }; walk(root); all[-1] = root; return all
    }
    private fun childIds(info: AccessibilityNodeInfo, id: Int, semantics: Lazy<Map<Int, SemanticsNode>>): List<Int> {
        childIdMethod?.let { m -> runCatching { return (0 until info.childCount).map { ((m.invoke(info, it) as Long) ushr 32).toInt() } } }
        childOrder = if (replacedChildrenMethod != null) "semantics (replacedChildren)" else "semantics (children)"; return semantics.value[id]?.let { a11yChildren(it) }?.map { it.id } ?: emptyList()
    }
    private fun describeVirtual(provider: AccessibilityNodeProvider, id: Int, origin: Rect, semantics: Lazy<Map<Int, SemanticsNode>>, depth: Int): JSONObject? {
        val info = (if (depth > 80) null else provider.createAccessibilityNodeInfo(id)) ?: return null
        val o = describe(info, origin).put("virtualId", id); val kids = JSONArray()
        if (isFake(semantics.value[id])) o.put("fake", true)
        for (c in childIds(info, id, semantics)) if (c != id && c != Int.MAX_VALUE && c != -1) describeVirtual(provider, c, origin, semantics, depth + 1)?.let { kids.put(it) }
        if (kids.length() > 0) o.put("children", kids)
        return o
    }
    private fun describeView(v: View, origin: Rect): JSONObject? {
        if (!v.isShown) return null
        val provider = v.accessibilityNodeProvider
        val info = v.createAccessibilityNodeInfo()
        val o = describe(info, origin); val kids = JSONArray()
        if (provider != null) { val semantics = lazy { semanticsById(v) }
            for (c in childIds(info, -1, semantics)) if (c != Int.MAX_VALUE && c != -1) describeVirtual(provider, c, origin, semantics, 1)?.let { kids.put(it) } }
        else if (v is ViewGroup) for (i in 0 until v.childCount) describeView(v.getChildAt(i), origin)?.let { kids.put(it) }
        if (kids.length() > 0) o.put("children", kids)
        return o
    }
    /** The input-focused element: the focused Compose semantics node (lifted to the node that merges it), else the focused view. */
    private fun focused(): JSONObject? = onMain {
        for (root in previewRoots().asReversed()) {
            val view = root.findFocus() ?: continue
            val origin = Rect(); val provider = view.accessibilityNodeProvider   // frames in preview-display coordinates (see screenshot())
            val semanticsRoot = (view as? RootForTest)?.semanticsOwner?.unmergedRootSemanticsNode
            if (provider != null && semanticsRoot != null) {
                var path: List<SemanticsNode>? = null
                fun walk(n: SemanticsNode, trail: List<SemanticsNode>) { val t = trail + n; if (n.config.getOrNull(SemanticsProperties.Focused) == true) path = t; n.children.forEach { walk(it, t) } }
                walk(semanticsRoot, emptyList())
                // The focused node itself when it is a named control (a chip's remove button), else the node that merges it.
                val chosen = path?.let { p -> p.last().takeIf { it.config.contains(SemanticsProperties.Role) || it.config.contains(SemanticsProperties.ContentDescription) }
                    ?: p.lastOrNull { it.config.isMergingSemanticsOfDescendants } ?: p.last() }
                if (chosen != null && chosen.id != semanticsRoot.id) provider.createAccessibilityNodeInfo(chosen.id)?.let { return@onMain describe(it, origin).put("virtualId", chosen.id) }
                provider.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.let { return@onMain describe(it, origin) }
            }
            return@onMain describe(view.createAccessibilityNodeInfo(), origin)
        }
        null
    }
    private val hooked = java.util.Collections.newSetFromMap(java.util.WeakHashMap<View, Boolean>())
    /** Records the accessibility events each preview window sends (every descendant event passes its root's onRequestSendAccessibilityEvent). */
    private fun hook(roots: List<View>) { for (r in roots) if (r is ViewGroup && r.accessibilityDelegate == null && hooked.add(r)) r.accessibilityDelegate = object : View.AccessibilityDelegate() {
        override fun onRequestSendAccessibilityEvent(host: ViewGroup, child: View, event: AccessibilityEvent): Boolean { record(event, "window"); return super.onRequestSendAccessibilityEvent(host, child, event) }
    } }
    private fun record(e: AccessibilityEvent, via: String) {
        val live = e.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED && (e.contentChangeTypes and AccessibilityEvent.CONTENT_CHANGE_TYPE_PANE_TITLE != 0 || runCatching { e.source?.liveRegion?.let { it != 0 } }.getOrNull() == true)
        if (live || e.eventType in setOf(AccessibilityEvent.TYPE_ANNOUNCEMENT, AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, AccessibilityEvent.TYPE_VIEW_FOCUSED) || (via == "window" && e.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED))
            synchronized(events) { events += JSONObject().put("type", AccessibilityEvent.eventTypeToString(e.eventType)).put("via", via).put("text", JSONArray(e.text.map { it.toString() }))
                .put("contentDescription", e.contentDescription?.toString() ?: "").put("changes", e.contentChangeTypes).put("class", e.className?.toString() ?: "") }
    }
    private fun atf(root: View): JSONObject {
        val out = JSONArray()
        // View-hierarchy ATF (with AccessibilityNodeProvider support for Compose). Built reflectively, like the preset below.
        val builder = onMain { AccessibilityHierarchyAndroid::class.java.getMethod("newBuilder", View::class.java).invoke(null, root)!!.let { b -> b.javaClass.getMethod("build").also { it.isAccessible = true }.invoke(b) } }
        val hierarchy = builder as AccessibilityHierarchyAndroid
        val size = runCatching { val w = hierarchy.javaClass.getMethod("getActiveWindow").invoke(hierarchy)!!; (w.javaClass.getMethod("getAllViews").also { it.isAccessible = true }.invoke(w) as Collection<*>).size }.getOrDefault(-1)
        val params = Parameters()
        // Called reflectively: the preset returns a Guava ImmutableSet, which ATF does not expose on the compile classpath.
        val checks = AccessibilityCheckPreset::class.java.getMethod("getAccessibilityHierarchyChecksForPreset", AccessibilityCheckPreset::class.java)
            .invoke(null, AccessibilityCheckPreset.LATEST) as Iterable<*>
        for (item in checks) {
            val check = item as AccessibilityHierarchyCheck
            val results = runCatching { check.runCheckOnHierarchy(hierarchy, null, params) }
                .getOrElse { e -> out.put(JSONObject().put("check", check.javaClass.simpleName).put("type", "CRASH").put("message", e.toString())); emptyList() }
            for (r in results) if (r.type == AccessibilityCheckResultType.ERROR || r.type == AccessibilityCheckResultType.WARNING) {
                val e = r.element
                out.put(JSONObject().put("check", check.javaClass.simpleName).put("type", r.type.name).put("message", r.getMessage(Locale.ENGLISH).toString())
                    .put("element", if (e == null) JSONObject.NULL else JSONObject().put("class", e.className?.toString() ?: "").put("text", e.text?.toString() ?: "")
                        .put("contentDescription", e.contentDescription?.toString() ?: "").put("bounds", e.boundsInScreen?.toString() ?: "")))
            }
        }
        return JSONObject().put("elements", size).put("results", out)
    }
    private fun cases(): JSONArray {
        val named = InstrumentationRegistry.getArguments().getString("axCases")?.let { File(dir, it) }
        return JSONArray(if (named != null && named.exists()) named.readText() else instrumentation.context.assets.open("ax/cases.json").bufferedReader().use { it.readText() })
    }

    @Test fun probe() {
        val cases = cases()
        val output = JSONArray()
        // Events the system service still receives from the app (the activity window); the preview windows are hooked per case.
        automation.setOnAccessibilityEventListener { e -> if (e.packageName?.toString() == "dev.awc.playground") record(e, "system") }
        // The full-screen host would otherwise raise the system's immersive-mode hint, which takes focus.
        runCatching { automation.executeShellCommand("settings put secure immersive_mode_confirmations confirmed").close() }
        // The Laboratory host configures one root per session (like the SwiftUI host): one host launch per case.
        for (i in 0 until cases.length()) withHost { command ->
                val c = cases.getJSONObject(i); val id = c.getString("id")
                val result = JSONObject().put("id", id).put("platform", "android").put("sdk", Build.VERSION.SDK_INT)
                try {
                    synchronized(events) { events.clear() }
                    val request = JSONObject(c.getJSONObject("request").toString()).put("command", "configure")
                    if (!request.has("width")) request.put("width", 640); if (!request.has("dark")) request.put("dark", false)
                    command(request)
                    onMain { hook(previewRoots()) }
                    Thread.sleep(c.optLong("settleMs", 700)); onMain { hook(previewRoots()) }; onMain { }
                    val windows = onMain { JSONArray(previewRoots().mapNotNull { r -> describeView(r, Rect())?.let { tree ->
                        JSONObject().put("type", 1).put("display", r.display?.displayId ?: -1).put("title", (r.layoutParams as? android.view.WindowManager.LayoutParams)?.title?.toString() ?: "").put("root", tree) } }) }
                    result.put("windows", windows).put("childOrder", childOrder).put("source", "in-process AccessibilityNodeProvider")
                    val density = onMain { previewRoots().firstOrNull()?.resources?.displayMetrics?.density?.toDouble() } ?: 1.0
                    result.put("density", density)
                    // Pixels for the contrast check: the host's own committed-surface capture (the Laboratory's `frame`), placed by the
                    // preview's position on the preview display; PixelCopy of the windows only as a fallback.
                    val name = "case-$i.png"; val shot = File(File(dir, "img").apply { mkdirs() }, name)
                    val framePng = runCatching { command(JSONObject().put("command", "frame")).optString("png") }.getOrNull()?.takeIf { it.isNotEmpty() }
                    if (framePng != null) {
                        shot.writeBytes(android.util.Base64.decode(framePng, android.util.Base64.DEFAULT))
                        val pos = onMain { previewRoots().firstNotNullOfOrNull { composeHost(it) }?.let { v -> IntArray(2).also { p -> v.getLocationOnScreen(p) } } } ?: intArrayOf(0, 0)
                        result.put("image", JSONObject().put("name", name).put("density", density).put("offset", JSONArray(listOf(-pos[0], -pos[1]))).put("source", "frame"))
                    } else runCatching { screenshot() }.getOrNull()?.let { b ->
                        shot.outputStream().use { b.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
                        result.put("image", JSONObject().put("name", name).put("density", density).put("source", "pixelcopy"))
                    }
                    onMain { previewRoots().lastOrNull() }?.let { root -> result.put("atf", runCatching { atf(root) }.getOrElse { e -> JSONObject().put("error", e.toString()) }) }
                    val focus = JSONArray()
                    // Keyboard focus enters the preview like Web's Tab from the element before it: focus the Compose root forward (the
                    // first focusable in traversal order is the first stop), then Tab.
                    val tabs = c.optInt("tabs", 0)
                    // A component that moves focus when it opens (a modal dialog focuses its first control, as the source does) already
                    // holds keyboard focus: as on Web, where Tab from that control is the first step, only the Tab presses are recorded.
                    val holding = tabs > 0 && focused()?.has("virtualId") == true
                    if (tabs > 0 && !holding) { onMain { previewRoots().firstNotNullOfOrNull { composeRoot(it) }?.requestFocus(View.FOCUS_FORWARD) }; Thread.sleep(200); onMain { } }
                    val entered = if (tabs > 0 && !holding) focused()?.takeIf { it.has("virtualId") } else null
                    if (entered != null) focus.put(entered)
                    repeat(if (entered != null) tabs - 1 else tabs) {
                        command(JSONObject().put("command", "key").put("key", "Tab")); Thread.sleep(250); onMain { }
                        focus.put(focused() ?: JSONObject.NULL)
                    }
                    result.put("focus", focus)
                    c.optJSONObject("update")?.let {
                        val before = synchronized(events) { events.size }
                        command(JSONObject().put("command", "update").put("properties", it)); onMain { hook(previewRoots()) }; Thread.sleep(900); onMain { }
                        synchronized(events) { result.put("afterUpdate", JSONObject().put("events", JSONArray(events.drop(before)))) }
                    }
                    synchronized(events) { result.put("events", JSONArray(events.toList())) }
                } catch (e: Throwable) { result.put("error", e.toString()) }
                output.put(result)
                // Written after every case so a timeout keeps the cases already captured.
                File(dir, "out.json").writeText(JSONObject().put("platform", "android").put("results", output).toString(1))
        }
        automation.setOnAccessibilityEventListener(null)
        File(dir, "out.json").writeText(JSONObject().put("platform", "android").put("results", output).toString(1))
    }

    private fun withHost(block: ((JSONObject) -> JSONObject) -> Unit) {
        val token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        val intent = Intent(ApplicationProvider.getApplicationContext(), LivePreviewActivity::class.java).putExtra("token", token)
        ActivityScenario.launch<LivePreviewActivity>(intent).use {
            val deadline = System.currentTimeMillis() + 5000; var ready = false
            while (!ready && System.currentTimeMillis() < deadline) { ready = runCatching { request("GET", "/health", token).first == 200 }.getOrDefault(false); if (!ready) Thread.sleep(25) }
            assertTrue("Debug host did not become ready", ready)
            try { block { value -> val response = request("POST", "/command", token, value); if (response.first != 200 || response.second.has("error")) throw IllegalStateException(response.second.toString()); response.second } }
            // End the session like the Laboratory does: the singleTask host keeps its configuration until `close`.
            finally { runCatching { request("POST", "/command", token, JSONObject().put("command", "close")) }; Thread.sleep(400) }
        }
    }
    private fun request(method: String, path: String, token: String, body: JSONObject? = null): Pair<Int, JSONObject> {
        val connection = (URL("http://127.0.0.1:39091$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 3000; readTimeout = 15000; setRequestProperty("Authorization", "Bearer $token") }
        try {
            if (body != null) { val bytes = body.toString().toByteArray(); connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json"); connection.setFixedLengthStreamingMode(bytes.size); connection.outputStream.use { it.write(bytes) } }
            val status = connection.responseCode
            val stream = if (status < 400) connection.inputStream else connection.errorStream
            return status to JSONObject(stream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}

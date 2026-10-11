package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeButtonBehaviorTest {
    @Test fun cancellationStillObservesActionButSuppressesEveryDefault() {
        val calls = mutableListOf<String>()
        val form = AWCFormState(onSubmit = { calls += "submit" }, onReset = { calls += "reset" })
        val action = AWCActionDispatcher(null) { calls += "cancel"; it.preventDefault() }
        for (properties in listOf(mapOf("type" to "submit"), mapOf("type" to "reset"), mapOf("href" to "https://example.com"))) {
            calls.clear()
            performNativeButtonAction(properties + mapOf("toggle" to true), false, { event, detail ->
                calls += event; assertEquals(true, (detail as Map<*, *>)["selected"])
            }, action, form, AWCURLRouter { calls += "navigate"; true }) { calls += "commit"; it }
            assertEquals(listOf("cancel", "mdClick"), calls)
        }
    }

    @Test fun nativePropagationAndDefaultsHaveSeparateControls() {
        val calls = mutableListOf<String>()
        val outer = AWCActionDispatcher(null) { calls += "outer" }
        val inner = AWCActionDispatcher(outer) { calls += "inner"; it.stopPropagation() }
        performNativeButtonAction(mapOf("toggle" to true, "href" to "https://example.com", "target" to "report"), false,
            { event, _ -> calls += event }, inner, null, AWCURLRouter { calls += "navigate:${it.target}"; true }) { calls += "commit"; it }
        assertEquals(listOf("inner", "mdClick", "commit", "inner", "mdChange", "navigate:report"), calls)
        calls.clear()
        AWCActionDispatcher(outer) { calls += "inner"; it.preventDefault() }.dispatch(AWCActionEvent("mdClick", "md-button", emptyMap()))
        assertEquals(listOf("inner", "outer"), calls)
    }

    @Test fun invalidRawLinkNeverFallsThroughToFormAndSafeTargetIsForwarded() {
        var submits = 0
        val routes = mutableListOf<AWCNavigationRequest>()
        val form = AWCFormState(onSubmit = { submits++ })
        val router = AWCURLRouter { routes += it; true }
        for (href in listOf("javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,a", "   ", "https://")) {
            performNativeButtonAction(mapOf("type" to "submit", "href" to href), false, { _, _ -> }, null, form, router) { it }
        }
        assertEquals(0, submits); assertTrue(routes.isEmpty())
        performNativeButtonAction(mapOf("type" to "submit", "href" to "/account", "target" to "_parent"), false, { _, _ -> }, null, form, router) { it }
        assertEquals(AWCNavigationRequest.from("/account", "_parent"), routes.single()); assertEquals(0, submits)
        performNativeButtonAction(mapOf("type" to "submit", "href" to ""), false, { _, _ -> }, null, form, router) { it }
        assertEquals(1, submits)
    }

    @Test fun validationAndResetOperateOnRegisteredValuesAndOriginalSnapshots() {
        var submitted: AWCFormSubmission? = null
        var invalid: Map<String, String>? = null
        var resets: Map<String, AWCValue>? = null
        val form = AWCFormState({ submitted = it }, { resets = it }, { invalid = it })
        val field = form.register("name", "Ada") { if (it.toString().isBlank()) "Required" else null }
        val source = mutableListOf("initial")
        val list = form.register("items", source)
        source += "later"
        field.value = ""
        assertFalse(form.submit()); assertNull(submitted); assertEquals(mapOf("name" to "Required"), invalid)
        field.value = "Grace"
        assertTrue(form.submit(mapOf("value" to "save")))
        assertEquals("Grace", submitted!!.values["name"]); assertEquals("save", submitted!!.submitter["value"])
        list.value = listOf("changed")
        form.reset()
        assertEquals("Ada", field.value); assertEquals(listOf("initial"), list.value)
        assertTrue(form.errors.isEmpty()); assertEquals(form.values, resets)
        form.unregister(field); assertFalse(form.values.containsKey("name"))
    }

    @Test fun explicitFormsAreIsolatedAndDuplicateNamesFail() {
        val outer = AWCFormState(); val inner = AWCFormState()
        val first = outer.register("name", "Outer"); val second = inner.register("name", "Inner")
        first.value = "Changed outer"; second.value = "Changed inner"; inner.reset()
        assertEquals("Changed outer", first.value); assertEquals("Inner", second.value)
        assertThrows(IllegalArgumentException::class.java) { inner.register("name", "Duplicate") }
        inner.unregister(first); assertEquals(mapOf("name" to "Inner"), inner.values)
    }

    @Test fun disabledAndLoadingButtonsEmitNothingAndPerformNoEffects() {
        for (property in listOf("disabled", "softDisabled", "loading")) {
            val result = performNativeButtonAction(mapOf(property to true, "toggle" to true), false,
                { _, _ -> fail("No disabled action") }, null, null, AWCURLRouter { fail("No disabled route"); false }) { fail("No disabled commit"); it }
            assertFalse(result)
        }
    }
}

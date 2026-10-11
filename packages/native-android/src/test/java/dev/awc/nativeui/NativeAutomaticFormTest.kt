package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeAutomaticFormTest {
    private fun control(form: AWCFormState, tag: String, p: Props): AWCFormField {
        val initial = formInitialValue(tag, p)
        return AWCFormField(p.str("name"), initial) { validateNativeControl(tag, p, it, initial) }.also {
            it.tag = tag; it.properties = p; form.attach(it)
        }
    }
    @Test fun declarativeRulesCoverUtf16PatternNumberEmailAndURL() {
        assertNull(AWCFormRules(minLength = 2, maxLength = 2).validate("😀"))
        assertNotNull(AWCFormRules(maxLength = 1).validate("😀"))
        assertNull(AWCFormRules(minLength = 5).validate(""))
        assertNotNull(AWCFormRules(required = true).validate(""))
        assertNull(AWCFormRules(pattern = "[A-Z]{2}").validate("AB"))
        assertNotNull(AWCFormRules(pattern = "[A-Z]{2}").validate("abc"))
        assertNull(AWCFormRules(pattern = "[").validate("ignored invalid regex"))
        assertNull(AWCFormRules(type = "email").validate("ada@example.com"))
        assertNotNull(AWCFormRules(type = "email").validate("bad@@example.com"))
        assertNull(AWCFormRules(type = "url").validate("https://example.com/path"))
        assertNotNull(AWCFormRules(type = "url").validate("/relative"))
        val number = AWCFormRules(type = "number", min = 0.2, max = 2.2, step = 0.5)
        assertNull(number.validate(0.7)); assertNotNull(number.validate(0.8)); assertNotNull(number.validate(3)); assertNotNull(number.validate(Double.NaN))
        assertNotNull(AWCFormRules(type = "number", step = 1e-308).validate(1e308))
        assertNull(validateNativeControl("md-text-field", mapOf("type" to "number", "step" to "any"), 0.7, 0))
        assertNotNull(validateNativeControl("md-text-field", mapOf("type" to "number"), 0.7, 0))
    }
    @Test fun orderedSuccessfulControlsKeepDuplicatesMultiValuesAndEndpointNames() {
        val form = AWCFormState()
        control(form, "md-text-field", mapOf("name" to "same", "value" to "one"))
        control(form, "md-checkbox", mapOf("name" to "same", "checked" to true, "value" to "two"))
        control(form, "md-checkbox", mapOf("name" to "absent", "checked" to false))
        control(form, "md-text-field", mapOf("name" to "disabled", "value" to "secret", "disabled" to true))
        control(form, "md-text-field", mapOf("value" to "unnamed"))
        control(form, "md-text-field", mapOf("name" to "soft", "value" to "included", "softDisabled" to true))
        control(form, "md-multi-select", mapOf("name" to "choice", "value" to listOf("a", "b")))
        control(form, "md-slider", mapOf("range" to true, "nameStart" to "low", "nameEnd" to "high", "valueStart" to 2, "valueEnd" to 8))
        assertEquals(listOf("same=one", "same=two", "soft=included", "choice=a", "choice=b", "low=2", "high=8"), form.entries.map { "${it.name}=${it.value}" })
    }
    @Test fun submitAndResetCanBeVetoedAndNativeSubmitterIsExplicit() {
        val accepted = mutableListOf<AWCFormSubmission>(); val order = mutableListOf<String>(); var cancel = true
        val form = AWCFormState(onSubmit = { order += "submit"; accepted += it }, onReset = { order += "reset" },
            onInvalid = { order += "invalid" }, onSubmitEvent = { order += "beforeSubmit"; if (cancel) it.preventDefault() },
            onResetEvent = { order += "beforeReset"; if (cancel) it.preventDefault() })
        val name = control(form, "md-text-field", mapOf("name" to "name", "value" to "Ada", "required" to true))
        name.value = ""
        assertFalse(form.submit()); assertEquals(listOf("invalid"), order)
        name.value = "Grace"; assertFalse(form.submit()); assertFalse(form.reset()); assertEquals("Grace", name.value)
        cancel = false; form.reset(); assertEquals("Ada", name.value); assertTrue(form.errors.isEmpty())
        form.submit(mapOf("value" to "must-not-serialize"))
        assertEquals(listOf(AWCFormEntry("name", "Ada")), accepted.last().entries)
        form.submit(submitterEntry = AWCFormEntry("action", "save"))
        assertEquals("name=Ada&action=save", accepted.last().encoded)
    }
    @Test fun radioGroupRequiredAndResetMatchRegisteredControls() {
        val form = AWCFormState()
        val first = control(form, "md-radio", mapOf("name" to "team", "checked" to true, "value" to "a", "required" to true))
        val second = control(form, "md-radio", mapOf("name" to "team", "checked" to false, "value" to "b"))
        assertTrue(form.validate()); second.value = true; form.selectRadio(second)
        assertEquals(false, first.value); assertEquals(listOf(AWCFormEntry("team", "b")), form.entries)
        form.reset(); assertEquals(true, first.value); assertEquals(false, second.value)
        first.value = false; assertFalse(form.validate())
        val unnamed = AWCFormState()
        control(unnamed, "md-radio", mapOf("required" to true, "checked" to false))
        control(unnamed, "md-radio", mapOf("checked" to true))
        assertFalse(unnamed.validate())
        val disabledChoice = AWCFormState()
        control(disabledChoice, "md-radio", mapOf("name" to "group", "required" to true, "checked" to false))
        control(disabledChoice, "md-radio", mapOf("name" to "group", "disabled" to true, "checked" to true))
        assertTrue(disabledChoice.validate()); assertTrue(disabledChoice.entries.isEmpty())
    }
    @Test fun sourceSpecificEmptyAndResetRulesAndDisabledValidation() {
        val form = AWCFormState()
        control(form, "md-select", mapOf("name" to "select", "value" to ""))
        control(form, "md-rating", mapOf("name" to "rating", "value" to 0))
        control(form, "md-time-picker", mapOf("name" to "time", "value" to ""))
        val otp = control(form, "md-otp-field", mapOf("name" to "otp", "value" to "1234", "length" to 4))
        control(form, "md-text-field", mapOf("name" to "disabled", "value" to "", "required" to true, "disabled" to true))
        assertTrue(form.validate()); form.reset(); assertEquals("", otp.value)
        assertEquals(listOf(AWCFormEntry("time", "")), form.entries)
        assertNull(validateNativeControl("md-time-picker", mapOf("min" to "22:00", "max" to "06:00"), "23:00", ""))
        assertNotNull(validateNativeControl("md-time-picker", mapOf("min" to "22:00", "max" to "06:00"), "12:00", ""))
    }
    @Test fun readOnlyTextFieldsSkipConstraintsButRemainSuccessfulControls() {
        val submissions = mutableListOf<AWCFormSubmission>()
        val form = AWCFormState(onSubmit = { submissions += it })
        control(form, "md-text-field", mapOf("name" to "empty", "value" to "", "required" to true, "readOnly" to true))
        control(form, "md-text-field", mapOf("name" to "invalid", "value" to "not-an-email", "type" to "email", "pattern" to "[A-Z]+", "minLength" to 40, "readOnly" to true))
        assertTrue(form.submit())
        assertEquals(listOf(AWCFormEntry("empty", ""), AWCFormEntry("invalid", "not-an-email")), submissions.single().entries)
        assertNotNull(validateNativeControl("md-text-field", mapOf("required" to true, "readOnly" to false), "", ""))
    }
    @Test fun serializationIsOrderedUTF8AndNormalizesLineEndingsWithoutNetworking() {
        assertEquals("x=a+b&x=%F0%9F%98%80&line=a%0D%0Ab", encodeAWCForm(listOf(AWCFormEntry("x", "a b"), AWCFormEntry("x", "😀"), AWCFormEntry("line", "a\nb"))))
        val form = AWCFormState()
        control(form, "md-number-field", mapOf("name" to "large", "value" to 1e30))
        assertEquals(listOf(AWCFormEntry("large", "1e+30")), form.entries)
        assertEquals("large=1e%2B30", encodeAWCForm(form.entries))
        assertEquals("100000000000000000000", formNumberString(1e20))
    }
    @Test fun compositeSourceControlsCanUseEmptyFormDataKeys() {
        val form = AWCFormState()
        control(form, "md-multi-select", mapOf("value" to listOf("a", "b")))
        control(form, "md-autocomplete", mapOf("multiple" to true, "value" to listOf("c")))
        control(form, "md-slider", mapOf("range" to true, "nameStart" to "low", "valueStart" to 1, "valueEnd" to 2))
        assertEquals(listOf(AWCFormEntry("", "a"), AWCFormEntry("", "b"), AWCFormEntry("", "c"), AWCFormEntry("low", "1"), AWCFormEntry("", "2")), form.entries)
    }
    @Test fun defaultButtonIsNotSkippedAndNamedOwnersAreExplicit() {
        var submits = 0; var first = 0; var second = 0
        val form = AWCFormState(onSubmit = { submits++ }); val firstId = Any(); val secondId = Any()
        form.registerSubmitButton(firstId) { first++ }; form.registerSubmitButton(secondId) { second++ }
        form.requestSubmit(); assertEquals(1, first); assertEquals(0, second); assertEquals(0, submits)
        form.unregisterSubmitButton(firstId); form.requestSubmit(); assertEquals(1, second)
        form.unregisterSubmitButton(secondId); form.requestSubmit(); assertEquals(1, submits)
        val registry = AWCFormRegistry(); registry.attach("owner", form); assertSame(form, registry.find("owner")); registry.detach("owner", form); assertNull(registry.find("owner"))
    }
}

package dev.awc.playground

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeMeterFormatTest {
    private fun value(v:Any?):Any?=when(v) {
        is JSONObject -> v.keys().asSequence().associateWith { value(v.get(it)) }
        JSONObject.NULL -> null
        else -> v
    }
    @Test fun nativeIcuCompatibilityBranchesMatch75IndependentIntlCases() {
        val doc=InstrumentationRegistry.getInstrumentation().context.assets.open("MeterIntlOracle.json").bufferedReader().use { JSONObject(it.readText()) }
        // Exercise the private native formatter on the device's real ICU. No
        // production testing switch, preformatted text, or JavaScript is used.
        val type=Class.forName("dev.awc.nativeui.MeterNumberFormat")
        val formatter=type.getField("INSTANCE").get(null)
        val method=type.declaredMethods.single { it.name=="format" }
        val failures=mutableListOf<String>()
        for(api in listOf(26,28,30,33,34,36)) for(i in 0 until doc.getJSONArray("cases").length()) {
            val c=doc.getJSONArray("cases").getJSONObject(i)
            val reading=if(c.optBoolean("negativeZero")) -0.0 else c.getDouble("value")
            val options=if(c.getBoolean("optionsPresent")) value(c.get("options")) else null
            val actual=method.invoke(formatter,reading,c.getDouble("fraction"),c.getString("valueText"),c.getString("locale"),options,false,api) as String
            val expected=c.getString("expected")
            if(actual!=expected) failures+="API$api/${c.getString("id")}: expected=<$expected> actual=<$actual>"
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }
    @Test fun recordNativeFontMetricsAndFallbackEvidence() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val face=androidx.core.content.res.ResourcesCompat.getFont(context,dev.awc.nativeui.R.font.awc_roboto_regular)!!
        val results=org.json.JSONArray()
        for(spacing in listOf(0f,.25f)) for(features in listOf("", "'kern' 1", "kern=1")) for(linear in listOf(false,true)) {
            val paint=android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG)
            paint.typeface=face;paint.textSize=28f;paint.letterSpacing=spacing/14;paint.fontFeatureSettings=features;paint.isLinearText=linear
            results.put(JSONObject().put("spacing",spacing).put("features",features).put("linear",linear).put("storage",paint.measureText("Storage")/2).put("storageAdvances",paint.getTextRunAdvances("Storage".toCharArray(),0,7,0,7,false,null,0)/2).put("storageBounds",paint.getRunAdvance("Storage",0,7,0,7,false,7)/2).put("seats",paint.measureText("Seats")/2))
        }
        val medium=androidx.core.content.res.ResourcesCompat.getFont(context,dev.awc.nativeui.R.font.awc_roboto_medium)!!
        val paint=android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply { typeface=medium;textSize=24f;isLinearText=true }
        val arabic="٣٨٪؜"
        for(spacing in listOf(0f,.5f)) { paint.letterSpacing=spacing/12;results.put(JSONObject().put("arabic",arabic).put("spacing",spacing).put("width",paint.measureText(arabic)/2)) }
        if(android.os.Build.VERSION.SDK_INT>=31) {
            val glyphs=android.graphics.text.TextRunShaper.shapeTextRun(arabic,0,arabic.length,0,arabic.length,0f,0f,false,paint)
            val fonts=(0 until glyphs.glyphCount()).map { glyphs.getFont(it).file?.absolutePath ?: glyphs.getFont(it).toString() }.distinct()
            results.put(JSONObject().put("arabicNativeFonts",org.json.JSONArray(fonts)).put("arabicUnroundedAdvance",glyphs.advance/2))
        }
        println("METER_FONT_EVIDENCE="+results.toString())
        assertTrue(results.length()>0)
    }

}

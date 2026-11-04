package dev.awc.nativeui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import dev.awc.nativeui.generated.AWCGeneratedTokens
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Deterministic model replay of the header interaction states against actual Chrome
 * trusted-input records (accordion-web-states.json: light/dark × expressive/none ×
 * hover/press/grip-hover/grip-drag/focus/disabled, normal and reduced motion). Each
 * step's inputs are applied to the native state machine at Chrome's own style-change
 * time; the native tracks must start the same transitions (duration, easing, from/to)
 * and reproduce every per-frame sample (state layer, grip, ripple waves, flags).
 */
class NativeAccordionStatesModelTest {
    // ---- minimal JSON reader (no JSON library on the JVM test classpath) ----
    private class Json(private val s:String) {
        var i=0
        fun value():Any? { ws();return when(s[i]) { '{'->obj();'['->arr();'"'->str();'t'->{ i+=4;true };'f'->{ i+=5;false };'n'->{ i+=4;null };else->num() } }
        private fun ws() { while(i<s.length && s[i].isWhitespace()) i++ }
        private fun obj():Map<String,Any?> { i++;val m=LinkedHashMap<String,Any?>();ws();if(s[i]=='}') { i++;return m }
            while(true) { ws();val k=str();ws();i++;m[k]=value();ws();if(s[i]==',') i++ else { i++;return m } } }
        private fun arr():List<Any?> { i++;val l=ArrayList<Any?>();ws();if(s[i]==']') { i++;return l }
            while(true) { l+=value();ws();if(s[i]==',') i++ else { i++;return l } } }
        private fun str():String { i++;val b=StringBuilder();while(s[i]!='"') { if(s[i]=='\\') { i++;b.append(when(s[i]) { 'n'->'\n';'t'->'\t';'u'->{ val c=s.substring(i+1,i+5).toInt(16).toChar();i+=4;c };else->s[i] }) } else b.append(s[i]);i++ };i++;return b.toString() }
        private fun num():Double { val st=i;while(i<s.length && (s[i].isDigit() || s[i] in "+-.eE")) i++;return s.substring(st,i).toDouble() }
    }
    @Suppress("UNCHECKED_CAST") private fun Any?.o()=this as Map<String,Any?>
    @Suppress("UNCHECKED_CAST") private fun Any?.a()=this as List<Any?>
    private fun Any?.d()=(this as Number).toDouble()
    private fun hex(v:String):Color { val h=v.removePrefix("#");return Color(h.substring(0,2).toInt(16),h.substring(2,4).toInt(16),h.substring(4,6).toInt(16)) }
    private fun rgb(c:Color)=listOf((c.red*255).roundToInt(),(c.green*255).roundToInt(),(c.blue*255).roundToInt())
    private fun css(v:String):List<Double> {
        val n=Regex("[-0-9.]+").findAll(v.substringAfter("(")).map { it.value.toDouble() }.toList()
        return if(v.startsWith("rgba")) n else n.take(3)+1.0
    }
    private fun g(x:Double)=if(x==Math.floor(x)) x.toLong().toString() else x.toString()
    private fun easing(c:List<Double>)="cubic-bezier(${c.joinToString(", ") { g(it) }})"

    @Test fun fiftySixChromeInteractionCasesReplayThroughTheNativeStateMachine() {
        val text=javaClass.classLoader!!.getResource("AccordionWebStates.json")!!.readText()
        val cases=Json(text).value().o()["cases"].a().map { it.o() }
        assertEquals(56,cases.size)
        var checks=0;val failures=mutableListOf<String>()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        fun near(a:Double,b:Double,tol:Double,label:String)=check(abs(a-b)<=tol,"$label: native $a vs web $b")
        val counts=mutableMapOf<String,Int>()
        for(c in cases) {
            val theme=c["theme"] as String;val preset=c["preset"] as String;val scenario=c["scenario"] as String;val reduced=c["reduced"]==true
            val label="$theme/$preset${if(reduced) "-reduced" else ""}/$scenario"
            val tokens=if(theme=="dark") AWCGeneratedTokens.dark else AWCGeneratedTokens.light
            fun token(k:String)=hex(tokens.getValue("--md-sys-color-$k"))
            val onSurface=token("on-surface");val onSurfaceVariant=token("on-surface-variant");val onSecondaryContainer=token("on-secondary-container")
            val secondary=token("secondary");val secondaryContainer=token("secondary-container")
            val target=c["target"] as String
            var expanded=target=="a"
            val disabled=scenario=="disabled"
            val steps=c["steps"].a().map { it.o() }
            val anims=c["anims"].a().map { it.o() }
            val samples=c["samples"].a().map { it.o() }
            val points=c["points"].o()
            val headerPoint=points["header"].a().map { it.d() };val gripPoint=points["grip"].a().map { it.d() }
            // Header box of the target in the group's coordinates (400 wide, 64 high, centred on the points).
            val headerTop=headerPoint[1]-32
            // ---- native state machine ----
            val style=NativeAccordionItemStyle()
            var pointer=AccordionInteraction();var focusVisible=false;var dragging=false
            style.live={ pointer.copy(focusVisible=focusVisible,dragging=dragging) }
            style.targets={ accordionStyleTargets(style.live(),onSurfaceVariant,onSecondaryContainer,onSecondaryContainer) }
            fun timing():AccordionStyleTiming { val m=NativeAccordionMotion(preset,expanded,reduced=reduced);return AccordionStyleTiming.of(preset,reduced,m.effectsDuration,m.effectsCurve,tokens,disabled) }
            style.timing=timing();style.initialize()
            // Disclosure (state-layer colour, header background) starts with the release that expands.
            var disclosureStart:Double?=null
            // A snapped change (no source record) is dated by the first sample in the step's window
            // that differs from its predecessor; a change already visible in the first sample is
            // dated by the step itself.
            // Sample times are frame times rounded to 0.1 ms: a sample taken in the frame that starts a
            // recorded transition is dated by that record's exact start time.
            fun frameTime(raw:Double)=anims.map { it["startTime"].d() }.firstOrNull { abs(it-raw)<=.1 } ?: raw
            fun sampleChanged(from:Double,to:Double):Double? {
                for(k in 1 until samples.size) { val t=samples[k]["t"].d()
                    if(t<from || t>=to) continue
                    val a=samples[k].filterKeys { it!="t" && it!="waves" };val b=samples[k-1].filterKeys { it!="t" && it!="waves" }
                    if(a!=b) return frameTime(t) }
                return null
            }
            fun changeTime(step:Int):Double {
                val from=steps[step]["t"].d()-20;val to=steps.getOrNull(step+1)?.get("t")?.d()?.minus(20) ?: Double.MAX_VALUE
                // Earliest evidence: a style record of the step, or the first sample showing the change.
                val own=anims.filter { it["part"]!="wave" }.map { it["startTime"].d() }.filter { it>=from && it<to }
                return own.minOrNull() ?: sampleChanged(steps[step]["t"].d(),to+20) ?: steps[step]["t"].d()
            }
            val growRecords=anims.filter { it["part"]=="wave" && it["to"].o()["transform"]!=null }
            val fadeRecords=anims.filter { it["part"]=="wave" && it["to"].o()["transform"]==null }
            for((k,step) in steps.withIndex()) {
                val name=step["label"] as String
                val now=changeTime(k)
                when(scenario to name) {
                    "grip-hover" to "enter","grip-drag" to "enter"->pointer=pointer.copy(hovered=true,gripHovered=true)
                    "hover-closed" to "enter","hover-expanded" to "enter","disabled" to "enter","press" to "enter"->pointer=pointer.copy(hovered=true)
                    "press" to "down","grip-drag" to "down"->{
                        pointer=pointer.copy(pressed=true);if(scenario=="grip-drag") dragging=true
                        val origin=if(scenario=="press") Offset(headerPoint[0].toFloat(),32f) else Offset(gripPoint[0].toFloat(),32f)
                        style.press(origin,400.0,64.0)
                    }
                    "grip-drag" to "move"->Unit
                    "press" to "up"->{ pointer=pointer.copy(pressed=false) }
                    "grip-drag" to "up"->{ pointer=pointer.copy(pressed=false,gripHovered=false);dragging=false }
                    "focus" to "tab"->Unit
                    "focus" to "tab2"->focusVisible=true
                    else->pointer=pointer.copy(hovered=false,gripHovered=false)
                }
                if(scenario=="press" && name=="up") {
                    // The release toggles the item (the disclosure starts with the same style change).
                    expanded=true;disclosureStart=now
                }
                style.timing=timing()
                // Waves begin at Chrome's own grow start (the press frame or the next one: Web Animations
                // start pending animations on the following frame); a release is replayed at Chrome's fade start.
                val grow=growRecords.firstOrNull { it["startTime"].d()-now in -.1..17.5 }
                if(name=="down") check(grow!=null,"$label wave starts at the press style change or the next frame")
                style.apply(now)
                if(grow!=null) style.waveHistory.lastOrNull()?.let { w-> if(w.began==now) { style.waves.remove(w);style.waveHistory.remove(w)
                    val replay=AccordionRippleWave(w.origin,w.radius);replay.begin(grow["startTime"].d());style.waveHistory+=replay;style.waves+=replay } }
                if(name=="up") {
                    val fade=fadeRecords.singleOrNull()
                    check(fade!=null,"$label one fade record")
                    if(fade!=null) {
                        val w=style.waveHistory.last()
                        // Source rule: the fade follows growth end and release (Chrome resolves it within two frames).
                        val rule=maxOf(w.began!!+AccordionRippleWave.GROW,now)
                        check(fade["startTime"].d()-rule in -.1..34.0,"$label fade start ${fade["startTime"]} follows max(growth end, release) $rule")
                        style.release();w.releasePending=false;w.release(fade["startTime"].d())
                    }
                }
            }
            // ---- transitions versus the source records ----
            val hist=AWCAccordionItemStyleInspection(style) { disabled }.history().filter { it.animated }
            fun records(part:String,prop:String)=anims.filter { it["part"]==part && it["property"]==prop }.sortedBy { it["startTime"].d() }
            fun compare(part:String,prop:String,native:String,value:(Any?)->Any,nativeValue:(Any)->Any,tol:(Any,Any)->Boolean) {
                val web=records(part,prop);val own=hist.filter { it.property==native }
                check(web.size==own.size,"$label $native transitions ${own.size} vs source ${web.size}")
                for((n,w) in own.zip(web)) {
                    near(n.start,w["startTime"].d(),.01,"$label $native start");near(n.duration,w["duration"].d(),.01,"$label $native duration")
                    check(easing(n.curve)==w["easing"],"$label $native easing ${easing(n.curve)} vs ${w["easing"]}")
                    check(tol(nativeValue(n.from),value(w["from"])),"$label $native from ${nativeValue(n.from)} vs ${w["from"]}")
                    check(tol(nativeValue(n.to),value(w["to"])),"$label $native to ${nativeValue(n.to)} vs ${w["to"]}")
                }
                counts[native]=(counts[native] ?: 0)+own.size
            }
            val num={ a:Any,b:Any-> abs((a as Double)-(b as Double))<=.0005 }
            val col={ a:Any,b:Any-> (a as List<*>)==(b as List<*>) }
            compare("state-layer","opacity","state-layer.opacity",{ (it.o()["opacity"] as String).toDouble() },{ it },num)
            compare("drag-handle","opacity","drag-handle.opacity",{ (it.o()["opacity"] as String).toDouble() },{ it },num)
            compare("drag-handle","color","drag-handle.color",{ css(it.o()["color"] as String).take(3).map { x-> x.roundToInt() } },{ rgb(it as Color) },col)
            compare("drag-handle","transform","drag-handle.transform",{ val t=it.o()["transform"] as String;if(t=="none") 1.0 else t.removePrefix("scale(").removeSuffix(")").toDouble() },{ it },num)
            // Ripple waves: one 450 ms standard grow at opacity 0.12, one 150 ms standard fade.
            check(growRecords.size==style.waveHistory.size,"$label waves ${style.waveHistory.size} vs ${growRecords.size}")
            for(w in growRecords) { near(w["duration"].d(),AccordionRippleWave.GROW,.01,"$label grow");check(w["easing"]==easing(AccordionRippleWave.STANDARD),"$label grow easing")
                check(w["from"].o()["opacity"]=="0.12" && w["to"].o()["opacity"]=="0.12","$label grow opacity") }
            for(w in fadeRecords) { near(w["duration"].d(),AccordionRippleWave.FADE,.01,"$label fade");check(w["easing"]==easing(AccordionRippleWave.STANDARD),"$label fade easing") }
            // Disclosure records (release of a header press): state-layer colour on the effects clock.
            records("state-layer","background-color").forEach { w->
                val m=NativeAccordionMotion(preset,true,reduced=reduced)
                near(w["duration"].d(),m.effectsDuration,.01,"$label state colour duration");check(w["easing"]==easing(m.effectsCurve),"$label state colour easing")
                check(css(w["to"].o()["backgroundColor"] as String).take(3).map { it.roundToInt() }==rgb(onSecondaryContainer),"$label state colour expanded")
                check(disclosureStart!=null && abs(w["startTime"].d()-disclosureStart!!)<.01,"$label disclosure starts with the release style change")
            }
            // ---- every per-frame sample ----
            for(s in samples) {
                val t=frameTime(s["t"].d())
                val st=s["state"].o();val grip=s["grip"].o();val header=s["header"].o()
                near(style.stateOpacity.valueAt(t,0.0),st["opacity"].d(),.0015,"$label t=$t state-layer opacity")
                val effects=disclosureStart?.let { start-> if(t<start) 0.0 else NativeAccordionMotion(preset,true,reduced=reduced).frame(t-start).effects } ?: if(expanded) 1.0 else 0.0
                val stateColor=accordionMix(onSurface,onSecondaryContainer,effects.toFloat())
                check(css(st["color"] as String).take(3).zip(rgb(stateColor)).all { (a,b)-> abs(a-b)<=1.01 },"$label t=$t state colour ${st["color"]} vs ${rgb(stateColor)}")
                val headerBg=accordionMix(Color.Transparent,secondaryContainer,effects.toFloat())
                val webBg=css(header["background"] as String)
                check(abs(webBg[3]-headerBg.alpha)<=.01 && (headerBg.alpha<.01 || webBg.take(3).zip(rgb(headerBg)).all { (a,b)-> abs(a-b)<=1.01 }),"$label t=$t header background ${header["background"]} vs $headerBg")
                if(!disabled) {
                    near(style.gripOpacity.valueAt(t,.55),grip["opacity"].d(),.0015,"$label t=$t grip opacity")
                    check(css(grip["color"] as String).take(3).zip(rgb(style.gripColor.valueAt(t,onSurfaceVariant))).all { (a,b)-> abs(a-b)<=1.01 },"$label t=$t grip colour ${grip["color"]} vs ${rgb(style.gripColor.valueAt(t,onSurfaceVariant))}")
                    near(style.gripScale.valueAt(t,1.0),grip["scale"].d(),.0005,"$label t=$t grip scale")
                }
                // A finished fade leaves an invisible wave until the next frame removes it: compare visible waves.
                val waves=s["waves"].a().map { it.o() }.filter { it["opacity"].d()>=.0005 }
                val native=style.waveHistory.filter { w-> w.began!=null && w.began!!<=t && !w.done(t) && w.opacity(t)>=.0005 }
                check(waves.size==native.size,"$label t=$t waves ${native.size} vs ${waves.size}")
                for((n,w) in native.zip(waves)) {
                    near(n.opacity(t),w["opacity"].d(),.0015,"$label t=$t wave opacity")
                    near(n.scale(t),w["scale"].d(),.002,"$label t=$t wave scale")
                    near(2*n.radius*n.scale(t),w["width"].d(),.6,"$label t=$t wave width")
                }
                // Flags: dragging header has pointer-events:none; focus-visible draws the 3px secondary outline.
                val draggingNow=scenario=="grip-drag" && t>=changeTime(steps.indexOfFirst { it["label"]=="down" }) && t<changeTime(steps.indexOfFirst { it["label"]=="up" })
                check(s["dragging"]==draggingNow,"$label t=$t dragging flag")
                check((header["pointerEvents"]=="none")==draggingNow,"$label t=$t pointer-events")
                val outline=header["outline"] as String
                val focusNow=scenario=="focus" && t>=changeTime(1)
                check(outline.startsWith(if(focusNow) "solid 3px" else "none 3px"),"$label t=$t outline $outline")
                if(focusNow) check(css(outline.substringAfter("3px ")).take(3).map { it.roundToInt() }==rgb(secondary),"$label focus ring is secondary")
                // The expanded property flips in the click handler, up to a frame before its style change.
                val up=steps.firstOrNull { it["label"]=="up" }?.get("t")?.d()
                val expandedNow=target=="a" || (scenario=="press" && t>=(disclosureStart ?: Double.MAX_VALUE))
                val settling=scenario=="press" && up!=null && t>=up && t<(disclosureStart ?: Double.MAX_VALUE)
                check(s["expanded"]==expandedNow || settling,"$label t=$t expanded flag")
            }
            // Painted state layer of a disabled item: computed 0.08 but not displayed.
            if(disabled) check(AWCAccordionItemStyleInspection(style) { true }.stateOpacity(Double.MAX_VALUE)==0.0,"$label disabled paints no state layer")
        }
        println("AWCAccordionStatesModel checks=$checks failures=${failures.size} transitions=$counts")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
        assertTrue(checks>10000)
    }

    @Test fun sourceCascadeAndTimingRules() {
        val rest=Color(0xFF49454F);val hover=Color(0xFF1D192B);val drag=Color(0xFF1E192B)
        fun t(i:AccordionInteraction)=accordionStyleTargets(i,rest,hover,drag)
        assertEquals(AccordionStyleTargets(0.0,.55,rest,1.0),t(AccordionInteraction()))
        assertEquals(.08,t(AccordionInteraction(hovered=true)).stateOpacity,0.0)
        assertEquals(.12,t(AccordionInteraction(focusVisible=true)).stateOpacity,0.0)
        assertEquals(.12,t(AccordionInteraction(hovered=true,pressed=true)).stateOpacity,0.0)
        assertEquals(AccordionStyleTargets(.08,1.0,hover,1.08),t(AccordionInteraction(hovered=true,gripHovered=true)))
        // Dragging: pointer-events:none drops :hover (grip scale returns) but :active persists.
        assertEquals(AccordionStyleTargets(.12,1.0,drag,1.0),t(AccordionInteraction(hovered=true,gripHovered=true,pressed=true,dragging=true)))
        assertEquals(AccordionStyleTargets(0.0,1.0,drag,1.0),t(AccordionInteraction(hovered=true,dragging=true)))
        // The later cascade rule wins with custom tokens.
        assertEquals(.05,accordionStyleTargets(AccordionInteraction(hovered=true,pressed=true),rest,hover,drag,.3,.2,.05).stateOpacity,0.0)
        val tok=AWCGeneratedTokens.light
        val e=AccordionStyleTiming.of("expressive",false,200.0,listOf(.34,.8,.34,1.0),tok)
        assertEquals(500.0,e.springDuration,0.0);assertEquals(listOf(.38,1.21,.22,1.0),e.springCurve)
        assertEquals(300.0,AccordionStyleTiming.of("standard",false,200.0,listOf(.34,.8,.34,1.0),tok).springDuration,0.0)
        assertEquals(150.0,AccordionStyleTiming.of("fade",false,200.0,listOf(.34,.8,.34,1.0),tok).springDuration,0.0)
        assertEquals(listOf(0.0,0.0,.2,1.0),AccordionStyleTiming.of("collapse",false,200.0,listOf(.34,.8,.34,1.0),tok).springCurve)
        val none=AccordionStyleTiming.of("none",false,200.0,listOf(.34,.8,.34,1.0),tok);assertEquals(0.0,none.effectsDuration+none.springDuration,0.0)
        val red=AccordionStyleTiming.of("expressive",true,200.0,listOf(.34,.8,.34,1.0),tok);assertEquals(0.0,red.effectsDuration+red.springDuration,0.0)
        // Effects duration is min(motion duration, 200 ms): a short custom collapse shortens it.
        assertEquals(120.0,NativeAccordionMotion("expressive",false,collapseDuration=120.0).effectsDuration,0.0)
        // Ripple: farthest corner, growth then fade after both growth end and release.
        val w=AccordionRippleWave(Offset(36f,32f),AccordionRippleWave.radius(Offset(36f,32f),400.0,64.0))
        assertEquals(Math.hypot(364.0,32.0),w.radius,1e-9)
        w.begin(0.0);w.release(100.0);assertEquals(450.0,w.fadeStart!!,0.0);assertEquals(.12,w.opacity(449.0),0.0);assertTrue(w.done(600.0))
        val late=AccordionRippleWave(Offset(0f,0f),10.0);late.begin(0.0);late.release(900.0);assertEquals(900.0,late.fadeStart!!,0.0)
        // Generic CSS value track follows the same starting rules for colours.
        val c=AWCCSSValueTrack(rest,accordionColorLerp);c.set(hover,0.0,200.0,listOf(.34,.8,.34,1.0))
        val p=c.history[0].outputProgress(50.0);c.set(rest,50.0,200.0,listOf(.34,.8,.34,1.0))
        assertEquals(200.0*p,c.history.last().duration,1e-9)
    }
}

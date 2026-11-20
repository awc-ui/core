package dev.awc.nativeui

import androidx.compose.runtime.*
import dev.awc.nativeui.stepper.SRect
import dev.awc.nativeui.stepper.StepBox
import dev.awc.nativeui.stepper.StepperPaint
import dev.awc.nativeui.stepper.stepperColor
import kotlin.math.min

/**
 * md-stepper's exported shadow parts (see `AWCStepperPart` in StepperParts.swift): list / nav / mobile-nav background
 * colour, nav / mobile-nav padding, content background colour and padding (a top padding keeps the slotted child's top
 * margin inside the content box); mobile-progress carries nothing visible (the caption and the dots set their own colours).
 */
enum class AWCStepperPart(val source: String) {
    List("list"), Content("content"), Nav("nav"), MobileNav("mobile-nav"), MobileProgress("mobile-progress");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}

/**
 * md-step's exported shadow parts: bubble (background, text colour, uniform corner radius) / dot (background, radius) win
 * over the state colours; label / optional / description (colour, font size / weight / line height, letter spacing — the
 * text boxes are measured with them); connector and connector-trailing (track colour; the fill is the ::after);
 * content (background colour, padding: the panel box grows by it even while collapsed); actions (gap); state-layer
 * (background colour); inner / indicator / text are layout boxes only; connector-leading is display: none.
 */
enum class AWCStepPart(val source: String) {
    Inner("inner"), Indicator("indicator"), StateLayer("state-layer"), Bubble("bubble"), Dot("dot"), Text("text"), Label("label"),
    Optional("optional"), Description("description"), Connector("connector"), ConnectorLeading("connector-leading"),
    ConnectorTrailing("connector-trailing"), Content("content"), Actions("actions");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}

internal val LocalAWCStepperParts = staticCompositionLocalOf { emptyMap<AWCStepperPart, AWCAccordionPartAppearance>() }
internal val LocalAWCStepParts = staticCompositionLocalOf { emptyMap<AWCStepPart, AWCAccordionPartAppearance>() }

/** `md-stepper::part(<part>)` styling for descendant steppers (nearer values win). */
@Composable fun AWCStepperPartAppearanceScope(part: AWCStepperPart, appearance: AWCAccordionPartAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCStepperParts.current
    val resolved = remember(inherited, part, appearance) { inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)) }
    CompositionLocalProvider(LocalAWCStepperParts provides resolved, content = content)
}

/** `md-step::part(<part>)` styling for the steps of descendant steppers and standalone steps (nearer values win). */
@Composable fun AWCStepPartAppearanceScope(part: AWCStepPart, appearance: AWCAccordionPartAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCStepParts.current
    val resolved = remember(inherited, part, appearance) { inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)) }
    CompositionLocalProvider(LocalAWCStepParts provides resolved, content = content)
}

object StepperParts {
    /** A uniform CSS border-radius on a `size` box (the top-left corner's length + percentage). */
    fun radius(s: AWCCornerShape?, size: Double): Double? = s?.topLeft?.x?.let { maxOf(0.0, it.points + it.fraction * size) }

    /** The painted parts after the part rules that do not move a box (the layout already applied the metric ones). */
    fun applied(paint: StepperPaint, step: Map<AWCStepPart, AWCAccordionPartAppearance>, stepper: Map<AWCStepperPart, AWCAccordionPartAppearance>): StepperPaint {
        if (step.isEmpty() && stepper.isEmpty()) return paint
        fun rgba(hex: String?) = hex?.let(::stepperColor)
        paint.listBackground = rgba(stepper[AWCStepperPart.List]?.backgroundColor)
        paint.contentBackground = rgba(stepper[AWCStepperPart.Content]?.backgroundColor)
        paint.navBackground = rgba(stepper[AWCStepperPart.Nav]?.backgroundColor)
        paint.mobileNavBackground = rgba(stepper[AWCStepperPart.MobileNav]?.backgroundColor)
        fun box(a: AWCAccordionPartAppearance?, r: SRect?): StepBox? {
            if (a == null || r == null || r.isEmpty || (a.backgroundColor == null && (a.borderWidth ?: 0.0) <= 0.0)) return null
            return StepBox(rgba(a.backgroundColor), a.borderWidth ?: 0.0, rgba(a.borderColor), radius(a.cornerShape, min(r.width, r.height)) ?: 0.0)
        }
        paint.mobileProgressBox = box(stepper[AWCStepperPart.MobileProgress], paint.mobileProgress)
        val connector = (step[AWCStepPart.Connector] ?: AWCAccordionPartAppearance()).merged(step[AWCStepPart.ConnectorTrailing] ?: AWCAccordionPartAppearance())
        for (s in paint.steps) {
            s.innerBox = box(step[AWCStepPart.Inner], s.inner); s.indicatorBox = box(step[AWCStepPart.Indicator], s.indicator); s.textBox = box(step[AWCStepPart.Text], s.text)
            step[if (s.dot) AWCStepPart.Dot else AWCStepPart.Bubble]?.let { a ->
                rgba(a.backgroundColor)?.let { s.bubbleColor = it }
                if (s.bubbleText != null) rgba(a.color)?.let { s.bubbleText = it }
                radius(a.cornerShape, s.bubbleSize)?.let { s.bubbleRadius = it }
            }
            rgba(step[AWCStepPart.StateLayer]?.backgroundColor)?.let { s.stateColor = it }
            s.lines = s.lines.map { l -> AWCStepPart.fromSource(l.part)?.let { rgba(step[it]?.color) }?.let { l.copy(color = it) } ?: l }
            val cn = s.connector
            if (cn != null) rgba(connector.backgroundColor)?.let { s.connector = cn.copy(color = it) }
            if (s.panel != null) rgba(step[AWCStepPart.Content]?.backgroundColor)?.let { s.panelBackground = it }
        }
        return paint
    }
}

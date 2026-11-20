package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.Job
import kotlin.math.*
import dev.awc.nativeui.generated.AWCGeneratedTokens

internal data class SplitButtonMetrics(val size: String, val density: Double, val hasIcon: Boolean) {
    val index = listOf("xs","sm","md","lg","xl").indexOf(size).takeIf { it >= 0 } ?: 1
    val baseHeight = listOf(32f,40f,56f,96f,136f)[index]
    val height = max(24f,baseHeight+density.toFloat()*4)
    val icon = listOf(16f,18f,24f,36f,48f)[index]
    val trailingIcon = listOf(22f,22f,26f,38f,50f)[index]
    val outerRadius = baseHeight/2
    val innerRadius = listOf(4f,4f,8f,12f,16f)[index]
    val activeRadius = listOf(8f,8f,12f,20f,28f)[index]
    private fun trim(value: Float) = max(4f,value+density.toFloat()*2)
    val leadingStart = trim(listOf(12f,16f,24f,36f,48f)[index] - if(hasIcon) 4 else 0)
    val leadingEnd = trim(listOf(10f,14f,20f,28f,36f)[index])
    val trailingStart = trim(listOf(12f,12f,13f,26f,37f)[index])
    val trailingEnd = trim(listOf(14f,14f,17f,32f,49f)[index])
    val checkedInset = trim(listOf(13f,13f,15f,29f,43f)[index])
    val gap = max(4f,8f+density.toFloat())
    val font = max(listOf(10f,12f,13f,18f,22f)[index],
        listOf(12f,14f,16f,24f,28f)[index]+density.toFloat()*(if(index>=3) 1f else .5f))
    val line = max(if(index==4) 28f else if(index==3) 24f else 16f,
        (if(index==4) 36f else if(index==3) 32f else 20f)+density.toFloat()*(if(index>=3) 2f else 1f))
    val weight = if(index>=3) 400 else 500
}

internal fun performNativeSplitButtonAction(p: Props, trailing: Boolean, checked: Boolean,
    commit: (Boolean)->Unit, emit: EventSink, actions: AWCActionDispatcher?, targetID: String,
    listeners: List<(AWCActionEvent)->Unit>, activation: AWCActivationMetadata): Boolean {
    if(!p.enabled()) return false
    val name = if(trailing) "mdTrailingClick" else "mdLeadingClick"
    val detail: Map<String,AWCValue> = if(trailing) mapOf("checked" to !checked) else emptyMap()
    if(trailing) commit(!checked)
    dispatchNativeAction(AWCActionEvent(name,"md-split-button",detail,targetID=targetID,activation=activation,
        rawDetail=if(trailing) detail else null),actions,listeners)
    emit(name,if(trailing) detail else null)
    return true
}

private fun splitToken(name:String,fallback:Float)=AWCGeneratedTokens.light[name]?.toFloatOrNull() ?: fallback

private val SplitEasing = CubicBezierEasing(.2f,0f,0f,1f)
private val SplitFont = FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium))

@Composable internal fun NativeSplitButton(p: Props, emit: EventSink, slot: Slot?) {
    if(p.bool("hidden")) return
    var checked by awcState(p["trailingChecked"]) { p.bool("trailingChecked") }
    val state = LocalAWCSplitButtonState.current
    val identity = remember { Any() }
    val current = rememberUpdatedState(checked)
    DisposableEffect(state,identity) {
        state?.bind(identity) { current.value }
        onDispose { state?.unbind(identity) }
    }
    val appearance = LocalAWCSplitButtonAppearance.current
    val metrics = SplitButtonMetrics(p.str("size","sm"),LocalAWCNativeDensity.current,p.str("icon").isNotEmpty())
    val inspection = LocalAWCInspection.current
    val rtl = LocalLayoutDirection.current==LayoutDirection.Rtl
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=target?.id ?: remember { java.util.UUID.randomUUID().toString() }
    val leadingFocus=remember { AWCButtonFocusState() };val trailingFocus=remember { AWCButtonFocusState() }
    fun activate(trailing:Boolean,metadata:AWCActivationMetadata) {
        performNativeSplitButtonAction(p,trailing,checked,{ checked=it },emit,actions,targetID,
            target?.listeners?.invoke().orEmpty(),metadata)
    }
    Layout(content={
        AWCButtonFocusScope(leadingFocus) {
            SplitHalf(p,metrics,appearance,false,checked,slot) { activate(false,it) }
        }
        AWCButtonFocusScope(trailingFocus) {
            SplitHalf(p,metrics,appearance,true,checked,null) { activate(true,it) }
        }
    }, modifier=Modifier.inspectAWCNode(inspection,"","md-split-button",
        AWCInspectionMetrics(gap=AWCInspectionGap(2.0,2.0),display="Flex",direction=if(rtl) "rtl" else "ltr"))) { measurables,constraints ->
        val gap=2.dp.roundToPx()
        val trailing=measurables[1].measure(Constraints())
        val full=p.bool("fullWidth") && constraints.hasBoundedWidth
        val leadingWidth=max(0,constraints.maxWidth-trailing.width-gap)
        val leading=measurables[0].measure(if(full) Constraints.fixedWidth(leadingWidth) else Constraints())
        val naturalWidth=leading.width+trailing.width+gap
        val width=if(full) constraints.maxWidth else constraints.constrainWidth(naturalWidth)
        layout(width,constraints.constrainHeight(max(leading.height,trailing.height))) {
            leading.placeRelative(0,0);trailing.placeRelative(leading.width+gap,0)
        }
    }
}

@Composable private fun SplitHalf(p: Props,m: SplitButtonMetrics,a: AWCSplitButtonAppearance,trailing:Boolean,
    checked:Boolean,slot:Slot?,activate:(AWCActivationMetadata)->Unit) {
    val identity=remember { Any() }
    val enabled=p.enabled();val focus=nativeButtonFocusModifier(p,identity,null,false)
    val interactions=remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState();val hovered by interactions.collectIsHoveredAsState()
    val active=hovered || focus.isFocusVisible || pressed
    val reduced=LocalAWCButtonReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val morph=LocalAWCSplitButtonShapeMorph.current
    val topInner by animateFloatAsState(if(trailing && checked) a.cornerRadius?.toFloat() ?: m.outerRadius
        else if(active && (!trailing || morph)) m.activeRadius else m.innerRadius,
        tween(if(reduced) 0 else 200,easing=SplitEasing),label="Split top inner corner")
    val bottomInner by animateFloatAsState(if(trailing && checked) a.cornerRadius?.toFloat() ?: m.outerRadius
        else if(active && (trailing || morph)) m.activeRadius else m.innerRadius,
        tween(if(reduced) 0 else 200,easing=SplitEasing),label="Split bottom inner corner")
    val outer by animateFloatAsState(a.cornerRadius?.toFloat() ?: m.outerRadius,
        tween(if(reduced) 0 else 200,easing=SplitEasing),label="Split outer corners")
    val shape=RoundedCornerShape(topStart=(if(trailing) topInner else outer).dp,
        bottomStart=(if(trailing) bottomInner else outer).dp,
        topEnd=(if(trailing) outer else topInner).dp,bottomEnd=(if(trailing) outer else bottomInner).dp)
    val rotate by animateFloatAsState(if(checked) 180f else 0f,tween(if(reduced) 0 else 200,easing=SplitEasing),label="Split checked glyph")
    val opacity by animateFloatAsState(if(!enabled) 0f else if(pressed) splitToken("--md-sys-state-pressed-state-layer-opacity",.12f) else if(focus.isFocusVisible) splitToken("--md-sys-state-focus-state-layer-opacity",.12f) else if(hovered) splitToken("--md-sys-state-hover-state-layer-opacity",.08f) else 0f,
        tween(if(reduced) 0 else 100,easing=SplitEasing),label="Split state layer")
    val colors=MaterialTheme.colorScheme
    fun color(value:String?,fallback:Color)=value?.let { Color(0xff000000L or it.drop(1).toLong(16)) } ?: fallback
    val variant=p.str("variant","filled");val outlined=variant=="outlined"
    val baseInk=when(variant) { "tonal"->colors.onSecondaryContainer;"outlined","elevated"->colors.primary;else->colors.onPrimary }
    val container=if(!enabled) { if(outlined) Color.Transparent else colors.onSurface.copy(alpha=.12f) }
        else if(outlined) Color.Transparent else color(a.containerColor,when(variant) { "tonal"->colors.secondaryContainer;"elevated"->colors.surfaceContainerLow;else->colors.primary })
    val ink=if(enabled) color(a.labelColor,baseInk) else colors.onSurface.copy(alpha=.38f)
    val iconInk=if(enabled) color(a.iconColor,ink) else ink
    val outline=if(enabled) color(a.outlineColor,if(focus.isFocusVisible) colors.primary else colors.outline) else colors.onSurface.copy(alpha=.12f)
    val elevation=if(!enabled) 0f else when(variant) { "elevated"->if(hovered && !pressed && !focus.isFocusVisible) 3f else 1f;"tonal"->if(hovered) 1f else 0f;else->0f }
    val border=if(outlined) 1f else 0f
    val start=if(!trailing) m.leadingStart else if(checked) m.checkedInset else m.trailingStart
    val end=if(!trailing) m.leadingEnd else if(checked) m.checkedInset else m.trailingEnd
    val part=if(trailing) "trailing" else "leading"
    val inspection=LocalAWCInspection.current
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val direction=if(rtl) "rtl" else "ltr"
    val density=LocalDensity.current
    val typo=AWCInspectionTypography(m.font.toDouble(),m.line.toDouble(),m.weight,.1,"Roboto")
    val style=TextStyle(fontFamily=SplitFont,fontSize=m.font.sp,lineHeight=m.line.sp,fontWeight=FontWeight(m.weight),
        letterSpacing=.1.sp,textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false),
        lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    var pointer by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val coroutine=rememberCoroutineScope();var keyRipple by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) { onDispose { keyRipple?.cancel() } }
    val ripple=nativeSourceRipple(interactions,ink,enabled && p.bool("ripple",true))
    val popup=LocalAWCPopupRegistry.current;val control=p.str("controls")
    val popupKind=p.str("haspopup","menu").takeUnless { it=="false" }
    val popupActionLabel=LocalAWCPopupFocusLabel.current
    val hasTarget=trailing && control.isNotEmpty() && popup?.contains(control)==true
    val label=p.str("label")
    val registry=LocalAWCSlots.current
    SubcomposeLayout(Modifier.zIndex(if(focus.isFocusVisible) 1f else 0f)
        .drawWithContent {
            val clipShadow=variant=="elevated" && enabled
            if(clipShadow && !focus.isFocusVisible) {
                val innerLeft=trailing != rtl
                clipRect(left=-(if(innerLeft) 1 else 6).dp.toPx(),right=size.width+(if(innerLeft) 6 else 1).dp.toPx(),
                    top=-6.dp.toPx(),bottom=size.height+6.dp.toPx()) { this@drawWithContent.drawContent() }
            } else drawContent()
            if(focus.isFocusVisible) {
                val outset=3.5.dp.toPx()
                translate(-outset,-outset) { drawOutline(shape.createOutline(Size(size.width+outset*2,size.height+outset*2),layoutDirection,this),colors.secondary,style=Stroke(3.dp.toPx())) }
            }
        }.shadow(elevation.dp,shape,clip=false).clip(shape).background(container)
        .drawWithContent {
            val inset=border.dp.roundToPx().toFloat()
            translate(inset,inset) {
                drawOutline(shape.createOutline(Size(max(0f,size.width-inset*2),max(0f,size.height-inset*2)),layoutDirection,this),baseInk.copy(alpha=baseInk.alpha*opacity))
            }
            drawContent()
            if(outlined) translate(inset/2,inset/2) {
                drawOutline(shape.createOutline(Size(max(0f,size.width-inset),max(0f,size.height-inset)),layoutDirection,this),outline,style=Stroke(inset))
            }
        }.then(ripple).then(focus.modifier).hoverable(interactions,enabled=enabled || p.bool("softDisabled"))
        .pointerInput(density.density) {
            awaitEachGesture {
                val down=awaitFirstDown(false,PointerEventPass.Initial)
                pointer=AWCActivationMetadata("pointer",down.position.x/density.density,down.position.y/density.density)
                do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                pointer=null
            }
        }.onPreviewKeyEvent { event ->
            if(event.key !in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)) false
            else {
                if(event.type==KeyEventType.KeyDown && enabled) {
                    keyRipple?.cancel();keyRipple=coroutine.nativeKeyboardRipple(interactions);activate(AWCActivationMetadata("keyboard"))
                }
                true
            }
        }.clickable(interactionSource=interactions,indication=null,enabled=!p.bool("disabled"),role=Role.Button) {
            activate(pointer ?: AWCActivationMetadata("accessibility"))
        }.semantics {
            if(!enabled) disabled()
            if(trailing) {
                contentDescription=p.str("menuLabel","Toggle menu")
                stateDescription=(if(checked) "Expanded" else "Collapsed") + (popupKind?.let { ", ${if(it=="true") "popup" else it}" } ?: "")
                if(popupKind!=null) awcPopupKind=popupKind
                if(control.isNotEmpty()) awcControlledPopup=control
                if(hasTarget && enabled) customActions=listOf(CustomAccessibilityAction(popupActionLabel) { popup?.focus(control)==true })
            } else if(label.isEmpty() && p.containsKey("aria-label")) contentDescription=p.str("aria-label")
        }
    ) { constraints ->
        fun px(value:Float)=value.dp.roundToPx().coerceIn(0,32766)
        val borderPx=px(border);val startPx=px(start);val endPx=px(end);val gapPx=if(trailing) 0 else px(m.gap)
        val height=px(m.height)
        val iconSize=if(trailing) m.trailingIcon else a.iconSize?.toFloat() ?: m.icon
        val glyph=subcompose("glyph") {
            if(trailing || p.str("icon").isNotEmpty()) {
                val glyphPart=if(trailing) "trailing-icon" else "icon"
                Box(Modifier.inspectAWCNode(inspection,glyphPart,if(trailing) "Trailing icon" else "Icon",
                    AWCInspectionMetrics(display="Glyph",direction="ltr"))) {
                    CompositionLocalProvider(LocalContentColor provides if(trailing) ink else iconInk,
                        LocalAWCButtonSlotSize provides iconSize.dp,LocalAWCButtonSlotPart provides glyphPart) {
                        AWCMaterialSymbol(if(trailing) p.str("trailingIcon","keyboard_arrow_down") else p.str("icon"),
                            modifier=if(trailing) Modifier.rotate(rotate) else Modifier)
                    }
                }
            }
        }.map { it.measure(Constraints.fixed(px(iconSize),px(iconSize))) }
        val authored=subcompose("authored") {
            if(!trailing) CompositionLocalProvider(LocalContentColor provides ink,LocalAWCInspection provides null,
                LocalAWCSlotTextNoWrap provides true) {
                ProvideTextStyle(style) { if(registry?.contains("")==true) registry.Render("") else slot?.invoke("") }
            }
        }.map { it.measure(Constraints()) }
        val labelPresent=!trailing && label.isNotEmpty()
        val count=glyph.size+authored.size+(if(labelPresent) 1 else 0)
        val fixed=glyph.sumOf { it.width }+authored.sumOf { it.width }+max(0,count-1)*gapPx
        val padding=startPx+endPx+borderPx*2
        val full=!trailing && p.bool("fullWidth") && constraints.hasBoundedWidth
        val labelMax=if(full) max(0,constraints.maxWidth-padding-fixed) else Constraints.Infinity
        val labels=subcompose("label") {
            if(labelPresent) {
                val text=awcCollapsedWhitespace(label)
                Text(text,color=ink,style=style,softWrap=false,maxLines=1,
                    overflow=if(full) TextOverflow.Ellipsis else TextOverflow.Clip,
                    modifier=Modifier.inspectAWCNode(inspection,"label","Label",AWCInspectionMetrics(typography=typo,display="Text",direction=direction)).awcExactTextWidth(text,style))
            }
        }.map { it.measure(Constraints(maxWidth=labelMax)) }
        val children=glyph+labels+authored
        val contentWidth=fixed+labels.sumOf { it.width }
        val width=if(full) max(padding,constraints.maxWidth) else padding+contentWidth
        val applied=AWCInspectionInsets(0.0,(if(rtl) startPx else endPx)/density.density.toDouble(),0.0,(if(rtl) endPx else startPx)/density.density.toDouble())
        val appliedBorder=borderPx/density.density.toDouble()
        val markers=subcompose("measurement") {
            Box(Modifier.inspectAWCNode(inspection,part,if(trailing) "Trailing button" else "Leading button",
                AWCInspectionMetrics(padding=applied,border=AWCInspectionInsets(appliedBorder,appliedBorder,appliedBorder,appliedBorder),
                    gap=AWCInspectionGap(0.0,if(trailing) 0.0 else gapPx/density.density.toDouble()),typography=if(trailing) null else typo,
                    display="Flex",direction=direction)))
        }.map { it.measure(Constraints.fixed(width,height)) }
        val layer=subcompose("state-layer") {
            Box(Modifier.inspectAWCNode(inspection,"$part-state-layer","${if(trailing) "Trailing" else "Leading"} state layer",
                AWCInspectionMetrics(display="Overlay",direction=direction)))
        }.map { it.measure(Constraints.fixed(max(0,width-borderPx*2),max(0,height-borderPx*2))) }
        layout(width,height) {
            markers.forEach { it.place(0,0) };layer.forEach { it.place(borderPx,borderPx) }
            var x=borderPx+startPx+(width-padding-contentWidth)/2
            children.forEach { child -> child.placeRelative(x,(height-child.height)/2);x+=child.width+gapPx }
        }
    }
}

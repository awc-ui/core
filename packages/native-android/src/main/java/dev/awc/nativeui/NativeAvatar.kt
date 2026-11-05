package dev.awc.nativeui

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.AlignmentLine
import androidx.compose.ui.layout.FirstBaseline
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val AvatarHex=Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
private fun avatarColorHex(value:String?)=value?.takeIf { it.matches(AvatarHex) }?.uppercase(Locale.ROOT)
private val AvatarRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium),Font(R.font.awc_roboto_bold,FontWeight.Bold))
private val AvatarSymbols=FontFamily(Font(R.font.awc_material_symbols))

/**
 * The public md-avatar hooks (`--md-avatar-*`): one field per source hook, the eleven hooks and the
 * fourteen tonal palette hooks `--md-avatar-palette-{1…7}-container/label`. As in the source, a
 * resolved name palette wins over [containerColor]/[labelColor], which apply to neutral avatars.
 */
@Immutable data class AWCAvatarAppearance(
    val size:AWCSkeletonLength?=null,val containerColor:String?=null,val containerShape:AWCCornerShape?=null,val labelColor:String?=null,
    val labelFontFamily:String?=null,val labelFontSize:AWCSkeletonLength?=null,val labelFontWeight:Double?=null,val labelLetterSpacing:AWCSkeletonLength?=null,
    val iconSize:AWCSkeletonLength?=null,val outlineColor:String?=null,val outlineWidth:AWCSkeletonLength?=null,
    val palette1Container:String?=null,val palette1Label:String?=null,val palette2Container:String?=null,val palette2Label:String?=null,val palette3Container:String?=null,val palette3Label:String?=null,val palette4Container:String?=null,val palette4Label:String?=null,val palette5Container:String?=null,val palette5Label:String?=null,val palette6Container:String?=null,val palette6Label:String?=null,val palette7Container:String?=null,val palette7Label:String?=null,
) {
    /** The palette hooks by bucket (1…7). */
    val paletteContainerColors:Map<Int,String> get()=listOf(palette1Container,palette2Container,palette3Container,palette4Container,palette5Container,palette6Container,palette7Container).mapIndexedNotNull { i,c-> c?.let { i+1 to it } }.toMap()
    val paletteLabelColors:Map<Int,String> get()=listOf(palette1Label,palette2Label,palette3Label,palette4Label,palette5Label,palette6Label,palette7Label).mapIndexedNotNull { i,c-> c?.let { i+1 to it } }.toMap()
    internal fun normalized()=copy(containerColor=avatarColorHex(containerColor),labelColor=avatarColorHex(labelColor),outlineColor=avatarColorHex(outlineColor),
        labelFontFamily=labelFontFamily?.trim()?.takeIf { it.isNotEmpty() },labelFontWeight=labelFontWeight?.takeIf { it.isFinite() && it in 1.0..1000.0 },
        palette1Container=avatarColorHex(palette1Container),palette1Label=avatarColorHex(palette1Label),palette2Container=avatarColorHex(palette2Container),palette2Label=avatarColorHex(palette2Label),palette3Container=avatarColorHex(palette3Container),palette3Label=avatarColorHex(palette3Label),palette4Container=avatarColorHex(palette4Container),palette4Label=avatarColorHex(palette4Label),palette5Container=avatarColorHex(palette5Container),palette5Label=avatarColorHex(palette5Label),palette6Container=avatarColorHex(palette6Container),palette6Label=avatarColorHex(palette6Label),palette7Container=avatarColorHex(palette7Container),palette7Label=avatarColorHex(palette7Label))
    fun merge(o:AWCAvatarAppearance)=AWCAvatarAppearance(o.size ?: size,o.containerColor ?: containerColor,o.containerShape ?: containerShape,o.labelColor ?: labelColor,
        o.labelFontFamily ?: labelFontFamily,o.labelFontSize ?: labelFontSize,o.labelFontWeight ?: labelFontWeight,o.labelLetterSpacing ?: labelLetterSpacing,
        o.iconSize ?: iconSize,o.outlineColor ?: outlineColor,o.outlineWidth ?: outlineWidth,
        o.palette1Container ?: palette1Container,o.palette1Label ?: palette1Label,o.palette2Container ?: palette2Container,o.palette2Label ?: palette2Label,o.palette3Container ?: palette3Container,o.palette3Label ?: palette3Label,o.palette4Container ?: palette4Container,o.palette4Label ?: palette4Label,o.palette5Container ?: palette5Container,o.palette5Label ?: palette5Label,o.palette6Container ?: palette6Container,o.palette6Label ?: palette6Label,o.palette7Container ?: palette7Container,o.palette7Label ?: palette7Label)
    companion object {
        /** Typed hooks from plain data; keys are the field names. */
        fun fromValues(values:Map<String,AWCValue>):AWCAvatarAppearance {
            fun s(k:String)=values[k] as? String
            fun l(k:String)=AWCSkeletonLength.fromValues(values[k])
            return AWCAvatarAppearance(l("size"),s("containerColor"),AWCCornerShape.fromValues(values["containerShape"]),s("labelColor"),s("labelFontFamily"),l("labelFontSize"),
                (values["labelFontWeight"] as? Number)?.toDouble(),l("labelLetterSpacing"),l("iconSize"),s("outlineColor"),l("outlineWidth"),
                s("palette1Container"),s("palette1Label"),s("palette2Container"),s("palette2Label"),s("palette3Container"),s("palette3Label"),s("palette4Container"),s("palette4Label"),s("palette5Container"),s("palette5Label"),s("palette6Container"),s("palette6Label"),s("palette7Container"),s("palette7Label")).normalized()
        }
    }
}
/** `::part(image|initials|icon)` styling; part rules win over hooks. The icon part's font size changes the glyph, not its box. */
@Immutable data class AWCAvatarPartAppearance(
    val initialsColor:String?=null,val initialsFontSize:AWCSkeletonLength?=null,val initialsFontWeight:Double?=null,val initialsLetterSpacing:AWCSkeletonLength?=null,
    val iconColor:String?=null,val iconFontSize:AWCSkeletonLength?=null,val imagePositionX:Double?=null,val imagePositionY:Double?=null,val imageOpacity:Double?=null,
) {
    fun merge(o:AWCAvatarPartAppearance)=AWCAvatarPartAppearance(o.initialsColor ?: initialsColor,o.initialsFontSize ?: initialsFontSize,o.initialsFontWeight ?: initialsFontWeight,
        o.initialsLetterSpacing ?: initialsLetterSpacing,o.iconColor ?: iconColor,o.iconFontSize ?: iconFontSize,o.imagePositionX ?: imagePositionX,o.imagePositionY ?: imagePositionY,o.imageOpacity ?: imageOpacity)
}
internal val LocalAWCAvatarAppearance=staticCompositionLocalOf { AWCAvatarAppearance() }
internal val LocalAWCAvatarPartAppearance=staticCompositionLocalOf { AWCAvatarPartAppearance() }
internal val LocalAWCAvatarViewport=staticCompositionLocalOf<DpSize?> { null }
internal val LocalAWCAvatarInspector=staticCompositionLocalOf<((Map<String,Any?>)->Unit)?> { null }
@Composable fun AWCAvatarAppearanceScope(appearance:AWCAvatarAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAvatarAppearance provides LocalAWCAvatarAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCAvatarPartAppearanceScope(appearance:AWCAvatarPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAvatarPartAppearance provides LocalAWCAvatarPartAppearance.current.merge(appearance),content=content)
/** Viewport for `vw`/`vh` avatar sizes; by default the window. */
@Composable fun AWCAvatarViewportScope(size:DpSize?,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCAvatarViewport provides size,content=content)
@Composable fun AWCAvatarInspectionScope(onAvatar:(Map<String,Any?>)->Unit,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCAvatarInspector provides onAvatar,content=content)

/** Source identity logic (md-avatar.tsx): initials, palette bucket and accessible label. */
object AWCAvatarIdentity {
    private fun graphemes(text:String):List<String> { val it=java.text.BreakIterator.getCharacterInstance();it.setText(text);val out=mutableListOf<String>();var s=it.first();var e=it.next()
        while(e!=java.text.BreakIterator.DONE) { out+=text.substring(s,e);s=e;e=it.next() };return out }
    fun initials(initials:String,name:String,locale:Locale=Locale.getDefault()):String {
        val explicit=initials.trim()
        if(explicit.isNotEmpty()) return graphemes(explicit).take(3).joinToString("").uppercase(locale)
        val tokens=name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if(tokens.isEmpty()) return ""
        val first=graphemes(tokens.first()).first()
        return if(tokens.size==1) first.uppercase(locale) else (first+graphemes(tokens.last()).first()).uppercase(locale)
    }
    /** 1…7 or 0; UTF-16 code units hashed with JavaScript int32 arithmetic, then Math.abs. */
    fun palette(initials:String,name:String,label:String,colorFromName:Boolean):Int {
        if(!colorFromName) return 0
        val seed=listOf(initials.trim(),name.trim(),label.trim()).firstOrNull { it.isNotEmpty() } ?: return 0
        var h=0;for(c in seed) h=(h shl 5)-h+c.code
        return (abs(h.toLong())%7).toInt()+1
    }
    /** Grapheme clusters: the units CSS letter-spacing follows. */
    internal fun clusterCount(text:String)=graphemes(text).size
    fun accessibleLabel(label:String,alt:String,name:String):String? = listOf(label,alt,name).firstOrNull { it.isNotEmpty() }.orEmpty().trim().takeIf { it.isNotEmpty() }
}

/** `size`: presets, unitless px, or a CSS length (px, rem, em, vw, vh, vmin, vmax, pt, in, cm, mm; calc/min/max/clamp). null = preset. */
internal object AvatarSize {
    fun parse(raw:String,vw:Double,vh:Double,em:Double=16.0):Double? {
        val v=raw.trim();if(v.isEmpty() || v in setOf("small","medium","large")) return null
        if(Regex("^-?\\d*\\.?\\d+$").matches(v)) return max(0.0,v.toDouble())
        val p=P(v.lowercase(Locale.ROOT),vw,vh,em);val r=p.factor() ?: return null;p.skip()
        return if(p.i==p.t.length && r.second) max(0.0,r.first) else null
    }
    private class P(val t:String,val vw:Double,val vh:Double,val em:Double) { var i=0
        fun skip() { while(i<t.length && t[i].isWhitespace()) i++ }
        fun eat(c:Char):Boolean { skip();return if(i<t.length && t[i]==c) { i++;true } else false }
        fun sum():Pair<Double,Boolean>? { var a=product() ?: return null
            while(true) { skip();if(i>=t.length || (t[i]!='+' && t[i]!='-')) return a;val op=t[i++];val b=product() ?: return null;if(a.second!=b.second) return null
                a=(if(op=='+') a.first+b.first else a.first-b.first) to a.second } }
        fun product():Pair<Double,Boolean>? { var a=factor() ?: return null
            while(true) { skip();if(i>=t.length || (t[i]!='*' && t[i]!='/')) return a;val op=t[i++];val b=factor() ?: return null
                a=if(op=='*') { if(a.second && b.second) return null;(a.first*b.first) to (a.second || b.second) } else { if(b.second || b.first==0.0) return null;(a.first/b.first) to a.second } } }
        fun factor():Pair<Double,Boolean>? { skip();if(i>=t.length) return null
            if(t[i]=='(') { i++;val v=sum();return if(eat(')')) v else null }
            val start=i;while(i<t.length && t[i].isLetter()) i++
            val name=t.substring(start,i)
            if(name.isNotEmpty()) { if(!eat('(')) return null;val args=mutableListOf<Pair<Double,Boolean>>()
                do { args+=sum() ?: return null } while(eat(','))
                if(!eat(')') || args.any { it.second!=args[0].second }) return null
                return when(name) { "calc"->if(args.size==1) args[0] else null;"min"->args.minOf { it.first } to args[0].second;"max"->args.maxOf { it.first } to args[0].second
                    "clamp"->if(args.size==3) max(args[0].first,min(args[1].first,args[2].first)) to args[0].second else null;else->null } }
            val ns=i;if(i<t.length && (t[i]=='+' || t[i]=='-')) i++;while(i<t.length && (t[i].isDigit() || t[i]=='.')) i++
            if(i<t.length && t[i]=='e' && i+1<t.length && (t[i+1].isDigit() || t[i+1]=='-' || t[i+1]=='+')) { i+=2;while(i<t.length && t[i].isDigit()) i++ }
            val n=t.substring(ns,i).toDoubleOrNull() ?: return null
            val us=i;while(i<t.length && (t[i].isLetter() || t[i]=='%')) i++
            val unit=t.substring(us,i);if(unit.isEmpty()) return n to false
            val s=mapOf("px" to 1.0,"rem" to 16.0,"em" to em,"vw" to vw/100,"vh" to vh/100,"vmin" to min(vw,vh)/100,"vmax" to max(vw,vh)/100,"pt" to 4.0/3,"pc" to 16.0,"in" to 96.0,"cm" to 96/2.54,"mm" to 96/25.4)[unit] ?: return null
            return n*s to true }
    }
}

private class AvatarLoader { var source by mutableStateOf<String?>(null);var cors="";var phase by mutableStateOf("loading");var image by mutableStateOf<ImageBitmap?>(null) }
/** data: (base64 or percent-encoded), http(s) and file: sources; anything else fails like a broken image. */
private suspend fun avatarBytes(src:String):ByteArray? = withContext(Dispatchers.IO) { runCatching {
    when {
        src.startsWith("data:")->{ val comma=src.indexOf(',');if(comma<0) null else { val header=src.substring(5,comma);val body=android.net.Uri.decode(src.substring(comma+1))
            if(header.endsWith(";base64")) Base64.decode(body,Base64.DEFAULT) else body.toByteArray() } }
        src.startsWith("http://") || src.startsWith("https://")->{ val c=java.net.URL(src).openConnection() as java.net.HttpURLConnection;c.connectTimeout=8000;c.readTimeout=8000
            try { if(c.responseCode !in 200..299) null else c.inputStream.use { it.readBytes() } } finally { c.disconnect() } }
        src.startsWith("file:")->java.io.File(java.net.URI(src)).readBytes()
        else->null
    } }.getOrNull() }
private fun avatarFamily(name:String?):FontFamily = when(val n=name?.lowercase(Locale.ROOT)?.substringBefore(',')?.trim(' ','"','\'')) {
    null,"","roboto","system-ui","sans-serif"->AvatarRoboto
    "monospace"->FontFamily.Monospace
    "serif"->FontFamily.Serif
    "cursive"->FontFamily.Cursive
    else->FontFamily(android.graphics.Typeface.create(n,android.graphics.Typeface.NORMAL))
}
/** Right-to-left when the run's first letter is Hebrew/Arabic-script (the bidi run Chrome lays out). */
private fun avatarRtlRun(text:String):Boolean { var i=0
    while(i<text.length) { val cp=text.codePointAt(i)
        if(Character.isLetter(cp)) { val d=Character.getDirectionality(cp);return d==Character.DIRECTIONALITY_RIGHT_TO_LEFT || d==Character.DIRECTIONALITY_RIGHT_TO_LEFT_ARABIC }
        i+=Character.charCount(cp) }
    return false }
private fun avatarLength(l:AWCSkeletonLength,em:Double)=l.points+l.em*em+l.rem*16+l.fraction*em+l.ch*em*.5

/**
 * md-avatar: image → initials → slot → person icon, with the source tonal palette, sizes
 * (presets, density, custom CSS lengths), hooks, parts, outline, physical corner shapes,
 * mdLoad/mdError and role="img" with the derived label (hidden from accessibility otherwise).
 */
@Composable
internal fun NativeAvatar(p:Props,emit:EventSink,content:Slot?) {
    val tokens=LocalAWCThemeTokens.current;val a=LocalAWCAvatarAppearance.current;val part=LocalAWCAvatarPartAppearance.current
    val density=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current);val dir=LocalLayoutDirection.current
    val src=p.str("src");val name=p.str("name");val label=p.str("label");val alt=p.str("alt");val initialsProp=p.str("initials");val cors=p.str("crossorigin")
    val loader=remember { AvatarLoader() };val emitter by rememberUpdatedState(emit)
    val failed=src.isNotEmpty() && loader.source==src && loader.phase=="failed"
    val initials=AWCAvatarIdentity.initials(initialsProp,name)
    val mode=if(src.isNotEmpty() && !failed) "image" else if(initials.isNotEmpty()) "initials" else "slot"
    val palette=if(mode=="image") 0 else AWCAvatarIdentity.palette(initialsProp,name,label,p.bool("colorFromName",true))
    val a11y=AWCAvatarIdentity.accessibleLabel(label,alt,name)
    val cfg=LocalConfiguration.current;val vp=LocalAWCAvatarViewport.current
    val vw=vp?.width?.value?.toDouble() ?: cfg.screenWidthDp.toDouble();val vh=vp?.height?.value?.toDouble() ?: cfg.screenHeightDp.toDouble()
    // A custom `size` (inline --md-avatar-size) wins over the hook, which wins over the preset.
    val side=AvatarSize.parse(p.str("size","medium"),vw,vh) ?: a.size?.let { max(0.0,avatarLength(it,16.0)) } ?: when(p.str("size","medium")) {
        "small"->max(18.0,24+density*1.5);"large"->max(40.0,56+density*4);else->max(28.0,40+density*3) }
    fun token(n:String,f:String)=tokens["--md-sys-color-$n"] ?: f
    fun rgb(hex:String)=statusDotColor(hex)
    /** color-mix(in srgb, x pct, y) for opaque inputs. */
    fun mix(x:String,pct:Double,y:String):Color { val c1=rgb(x);val c2=rgb(y);val q=pct.toFloat()
        return Color(c1.red*q+c2.red*(1-q),c1.green*q+c2.green*(1-q),c1.blue*q+c2.blue*(1-q),1f) }
    val colors:Pair<Color,Color> = if(palette in 1..4) {
        val pair=listOf(listOf("primary-container","#EADDFF","on-primary-container","#21005D"),listOf("secondary-container","#E8DEF8","on-secondary-container","#1D192B"),
            listOf("tertiary-container","#FFD8E4","on-tertiary-container","#31111D"),listOf("error-container","#F9DEDC","on-error-container","#410E0B"))[palette-1]
        (a.paletteContainerColors[palette]?.let(::rgb) ?: rgb(token(pair[0],pair[1]))) to (a.paletteLabelColors[palette]?.let(::rgb) ?: rgb(token(pair[2],pair[3])))
    } else if(palette in 5..7) {
        val accent=listOf("primary" to "#6750A4","tertiary" to "#7D5260","secondary" to "#625B71")[palette-5];val tone=token(accent.first,accent.second)
        (a.paletteContainerColors[palette]?.let(::rgb) ?: mix(tone,.22,token("surface","#FEF7FF"))) to (a.paletteLabelColors[palette]?.let(::rgb) ?: mix(tone,.72,token("on-surface","#1C1B1F")))
    } else (a.containerColor?.let(::rgb) ?: rgb(token("surface-container-highest","#E6E0E9"))) to (a.labelColor?.let(::rgb) ?: rgb(token("on-surface-variant","#49454F")))
    val container=if(mode=="image") Color.Transparent else colors.first;val ink=colors.second
    val shape=a.containerShape ?: when(p.str("shape","circle")) { "rounded"->AWCCornerShape.uniform(points=tokens["--md-sys-shape-corner-medium"]?.removeSuffix("px")?.toDoubleOrNull() ?: 12.0)
        "square"->AWCCornerShape.uniform();else->AWCCornerShape.uniform(fraction=.5) }
    val labelSize=a.labelFontSize?.let { avatarLength(it,16.0) } ?: side*.4
    val iconSize=a.iconSize?.let { avatarLength(it,16.0) } ?: side*.6
    val outline=a.outlineWidth?.let { max(0.0,avatarLength(it,16.0)) } ?: 0.0
    LaunchedEffect(if(failed) src else src+"\u0000"+cors) {
        // A displayed image is requested again when its CORS mode changes (as Chrome does);
        // a failed source stays failed until `src` itself changes.
        if(src.isEmpty()) { loader.source=null;loader.image=null;loader.phase="loading";return@LaunchedEffect }
        if(loader.source==src && (loader.phase=="failed" || loader.cors==cors)) return@LaunchedEffect
        val keep=if(loader.source==src) loader.image else null
        loader.source=src;loader.cors=cors;loader.image=keep;loader.phase=if(keep==null) "loading" else "loaded"
        val bytes=avatarBytes(src);val bmp=bytes?.let { withContext(Dispatchers.Default) { runCatching { BitmapFactory.decodeByteArray(it,0,it.size) }.getOrNull() ?: AWCSvgRaster.decode(it) } }
        if(loader.source!=src) return@LaunchedEffect
        loader.image=bmp?.asImageBitmap();loader.phase=if(bmp==null) "failed" else "loaded"
        emitter(if(bmp==null) "mdError" else "mdLoad",mapOf("src" to src))
    }
    val inspector=LocalAWCAvatarInspector.current
    var bounds by remember { mutableStateOf(Rect.Zero) };var initialsBounds by remember { mutableStateOf(Rect.Zero) }
    val labelFont=part.initialsFontSize?.let { avatarLength(it,labelSize) } ?: labelSize
    val tracking=part.initialsLetterSpacing?.let { avatarLength(it,labelFont) } ?: a.labelLetterSpacing?.let { avatarLength(it,labelFont) } ?: labelFont*.05
    val weight=part.initialsFontWeight ?: a.labelFontWeight ?: tokens["--md-sys-typescale-title-medium-font-weight"]?.toDoubleOrNull() ?: 500.0
    val glyph=part.iconFontSize?.let { avatarLength(it,iconSize) } ?: iconSize
    val image=loader.image?.takeIf { loader.source==src && mode=="image" }
    val labelFamily=avatarFamily(a.labelFontFamily);val labelWeight=FontWeight(min(1000,max(1,weight.roundToInt())))
    val labelMetrics=avatarFontMetrics(labelFamily,labelWeight);val iconMetrics=avatarFontMetrics(AvatarSymbols,FontWeight.Normal);val slotMetrics=avatarFontMetrics(AvatarRoboto,FontWeight.Normal)
    // Built during composition so the reported geometry follows layout (bounds are state).
    val info=mapOf("mode" to mode,"palette" to palette,"role" to (if(a11y==null) "presentation" else "img"),"label" to a11y,"size" to side,"outline" to outline,
        "initials" to (if(mode=="initials") initials else null),"background" to container,"color" to ink,"fontSize" to labelFont,"letterSpacing" to tracking,"fontWeight" to weight,
        "iconSize" to iconSize,"glyph" to glyph,"bounds" to bounds,"initialsBounds" to initialsBounds,"image" to image?.let { listOf(it.width,it.height) },
        "labelMetrics" to labelMetrics.toList(),"iconMetrics" to iconMetrics.toList(),"slotMetrics" to slotMetrics.toList())
    if(inspector!=null) SideEffect { inspector(info) }
    val ld=LocalDensity.current;val dens=ld.density
    fun sp(v:Double)=with(ld) { v.toFloat().dp.toSp() }
    val semantics=if(a11y!=null) Modifier.clearAndSetSemantics { contentDescription=a11y;role=Role.Image } else Modifier.clearAndSetSemantics { hideFromAccessibility() }
    // CSS corners are physical: AWCCornerShape does not mirror under RTL; the outline is the
    // source's inset ring (outline-offset: -width) drawn over the content, inside the clip.
    Box(semantics.size(side.dp).onGloballyPositioned { val o=it.positionInRoot();bounds=Rect(o.x/dens,o.y/dens,(o.x+it.size.width)/dens,(o.y+it.size.height)/dens) }
        .clip(shape).background(container,shape).then(if(outline>0) Modifier.border(outline.dp,a.outlineColor?.let(::rgb) ?: Color.Transparent,shape) else Modifier),
        contentAlignment=Alignment.Center) {
        when(mode) {
            "image"->if(image!=null) {
                // object-fit: cover with the part's object-position (physical) and opacity.
                val px0=(part.imagePositionX ?: .5).toFloat();val py0=(part.imagePositionY ?: .5).toFloat();val opacity=(part.imageOpacity ?: 1.0).toFloat()
                Spacer(Modifier.fillMaxSize().drawBehind {
                    val w=image.width.toFloat();val h=image.height.toFloat();val s=max(size.width/max(w,1f),size.height/max(h,1f));val dw=w*s;val dh=h*s
                    drawImage(image,IntOffset.Zero,IntSize(image.width,image.height),IntOffset(((size.width-dw)*px0).roundToInt(),((size.height-dh)*py0).roundToInt()),
                        IntSize(dw.roundToInt(),dh.roundToInt()),alpha=opacity,filterQuality=FilterQuality.High) })
            }
            "initials"->if(labelFont>0) {
                val rtl=avatarRtlRun(initials)
                CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AvatarInitialsRun(initials,TextStyle(color=part.initialsColor?.let(::rgb) ?: ink,fontSize=sp(labelFont),fontFamily=labelFamily,fontWeight=labelWeight,letterSpacing=sp(tracking),
                        fontFeatureSettings="tnum",platformStyle=PlatformTextStyle(includeFontPadding=false)),tracking,labelFont*dens,labelMetrics,rtl) { initialsBounds=it }
                } }
            else->{
                // Default slot: each authored child is centred in the icon box (`::slotted(*:not(md-badge))`,
                // font-size = icon size, line-height 1, so slotted text sits on that line box's baseline);
                // a slotted md-badge sizes itself and is anchored on the host's physical top-right corner by
                // its own placement, inside the host's overflow clip. The person icon is the slot's fallback
                // content: it shows only while nothing is slotted (a content lambda that emits nothing counts
                // as an empty slot).
                val slotSize=sp(iconSize)
                CompositionLocalProvider(LocalAWCBadgeHost provides true,androidx.compose.material3.LocalContentColor provides ink,
                    androidx.compose.material3.LocalTextStyle provides TextStyle(color=ink,fontSize=slotSize,fontFamily=AvatarRoboto,fontWeight=FontWeight.Normal,
                        platformStyle=PlatformTextStyle(includeFontPadding=false))) {
                    Layout(content={
                        content?.invoke("")
                        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                            // The person glyph box is the icon size; the glyph (part font-size) is a line-height-1
                            // line at its top-left (direction: ltr), on the symbol font's CSS baseline.
                            Box(Modifier.layoutId(AvatarIconFallback)) {
                                AvatarBaselineBox(glyph*dens,iconMetrics,centered=false) {
                                    BasicText("person",style=TextStyle(color=part.iconColor?.let(::rgb) ?: ink,fontSize=sp(glyph),fontFamily=AvatarSymbols,fontWeight=FontWeight.Normal,
                                        letterSpacing=0.sp,fontFeatureSettings="liga",platformStyle=PlatformTextStyle(includeFontPadding=false)),maxLines=1,softWrap=false)
                                }
                            }
                        }
                    },modifier=Modifier.fillMaxSize()) { ms,c->
                        val iconPx=(iconSize*dens).toFloat();val box=iconPx.roundToInt().coerceAtLeast(0)
                        val bx=(c.maxWidth-iconPx)/2f;val by=(c.maxHeight-iconPx)/2f
                        val base=avatarLineBaseline(iconSize*dens,slotMetrics)
                        val slotted=ms.filter { it.layoutId!==AvatarIconFallback }
                        val placed=slotted.map { m-> val badge=m.layoutId as? NativeBadgePlacement;badge to m.measure(if(badge!=null) Constraints() else Constraints(maxWidth=box,maxHeight=box)) }
                        val icon=if(slotted.isEmpty()) ms.first { it.layoutId===AvatarIconFallback }.measure(Constraints.fixed(box,box)) else null
                        layout(c.maxWidth,c.maxHeight) {
                            icon?.let { avatarPlace(it,bx,by) }
                            placed.forEach { (badge,pl)->
                                if(badge!=null) { val o=badge.position(c.maxWidth,c.maxHeight,pl.width,pl.height,dens);pl.place(o.x,o.y) }
                                else { val fb=pl[FirstBaseline];val y=if(fb!=AlignmentLine.Unspecified) by+base-fb else by+(iconPx-pl.height)/2f
                                    avatarPlace(pl,bx+(iconPx-pl.width)/2f,y) } }
                        }
                    }
                }
            }
        }
    }
}

/** Layout id of the slot's fallback person icon. */
private object AvatarIconFallback

/** Ascent and descent per pixel of font size of the primary (first) font, as CSS uses for the line box. */
@Composable private fun avatarFontMetrics(family:FontFamily,weight:FontWeight):Pair<Float,Float> {
    val resolver=LocalFontFamilyResolver.current
    val tf=remember(resolver,family,weight) { resolver.resolve(family,weight) }.value as? android.graphics.Typeface
    return remember(tf) { val m=android.graphics.Paint().apply { typeface=tf;textSize=1000f }.fontMetrics;(-m.ascent/1000f) to (m.descent/1000f) }
}
/** Baseline offset inside a line box of height [line] px: half the leading above the ascent. */
private fun avatarLineBaseline(line:Double,m:Pair<Float,Float>)=((line-(m.first+m.second)*line)/2+m.first*line).toFloat()
/** One line of text whose first baseline is placed where CSS puts it for a line box of [line] px
 * (font-size = line, line-height 1): centred in the parent, or at its top-left. */
@Composable private fun AvatarBaselineBox(line:Double,metrics:Pair<Float,Float>,centered:Boolean,text:@Composable ()->Unit) {
    Layout(content=text,modifier=Modifier.fillMaxSize()) { ms,c->
        val pl=ms.first().measure(Constraints());val fb=pl[FirstBaseline]
        val top=if(centered) (c.maxHeight-line)/2 else 0.0
        val y=if(fb!=AlignmentLine.Unspecified) top+avatarLineBaseline(line,metrics)-fb else top+(line-pl.height)/2
        val x=if(centered) (c.maxWidth-pl.width)/2f else 0f
        layout(c.maxWidth,c.maxHeight) { avatarPlace(pl,x,y.toFloat()) }
    }
}
/** Places at the exact (fractional) position, as Chrome positions text at sub-pixel offsets. */
private fun Placeable.PlacementScope.avatarPlace(pl:Placeable,x:Float,y:Float) {
    val xi=floor(x).toInt();val yi=floor(y).toInt();pl.placeWithLayer(xi,yi) { translationX=x-xi;translationY=y-yi }
}
/**
 * The initials as Chrome lays them out: a centred line box (line-height 1) whose width is the
 * run's advances plus one letter-spacing per grapheme (CSS adds it after every character, the
 * last included), glyphs starting at the run's start edge, and the baseline at the primary font's
 * CSS half-leading position whatever fallback fonts the run uses. Android distributes letter
 * spacing around glyphs (and may trim it at line edges), so the glyph origin is derived from the
 * run measured with and without spacing. [onBox] receives that CSS run box in root dp.
 */
@Composable private fun AvatarInitialsRun(text:String,style:TextStyle,tracking:Double,line:Double,metrics:Pair<Float,Float>,rtl:Boolean,onBox:(Rect)->Unit) {
    val measurer=rememberTextMeasurer();val ld=LocalDensity.current;val dens=ld.density
    val plain=remember(text,style,ld,rtl) { measurer.measure(text,style.copy(letterSpacing=0.sp),softWrap=false,maxLines=1,
        layoutDirection=if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,density=ld) }
    val clusters=remember(text) { AWCAvatarIdentity.clusterCount(text) }
    val spaced=remember { arrayOfNulls<TextLayoutResult>(1) };val box=remember { FloatArray(4) }
    Layout(content={ BasicText(text,style=style,onTextLayout={ spaced[0]=it },maxLines=1,softWrap=false) },
        modifier=Modifier.fillMaxSize().onGloballyPositioned { val o=it.positionInRoot()
            onBox(Rect((o.x+box[0])/dens,(o.y+box[1])/dens,(o.x+box[0]+box[2])/dens,(o.y+box[1]+box[3])/dens)) }) { ms,c->
        val pl=ms.first().measure(Constraints());val r=spaced[0];val ls=(tracking*dens).toFloat()
        val w0=plain.getLineRight(0)-plain.getLineLeft(0)
        val left=r?.getLineLeft(0) ?: 0f;val right=r?.getLineRight(0) ?: pl.width.toFloat()
        val lead=((right-left-w0-(clusters-1)*ls)/2).coerceIn(min(0f,ls/2),max(0f,ls/2))
        val wc=w0+clusters*ls;val bx=(c.maxWidth-wc)/2f;val top=((c.maxHeight-line)/2).toFloat()
        val fb=pl[FirstBaseline]
        val x=if(rtl) bx+wc-(right-lead) else bx-(left+lead)
        val y=top+(if(fb!=AlignmentLine.Unspecified) avatarLineBaseline(line,metrics)-fb else ((line-pl.height)/2).toFloat())
        box[0]=bx;box[1]=top;box[2]=wc;box[3]=line.toFloat()
        layout(c.maxWidth,c.maxHeight) { avatarPlace(pl,x,y) }
    }
}

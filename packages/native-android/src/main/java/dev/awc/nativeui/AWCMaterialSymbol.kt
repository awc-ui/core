package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal val LocalAWCButtonSlotSize = staticCompositionLocalOf { 20.dp }
internal val LocalAWCButtonSlotPart = staticCompositionLocalOf<String?> { null }
private val MaterialSymbols = FontFamily(Font(R.font.awc_material_symbols))

/**
 * A bundled Material Symbols glyph. In a button slot, size and content color
 * inherit that slot's resolved appearance. Decorative by default; supply a
 * contentDescription when the symbol itself conveys accessible information.
 */
@Composable
fun AWCMaterialSymbol(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = LocalAWCButtonSlotSize.current,
    contentDescription: String? = null,
) {
    val slotText=LocalAWCSlotTextRegistry.current
    val slotIdentity=remember { Any() }
    SideEffect { slotText?.update(slotIdentity,name) }
    DisposableEffect(slotText,slotIdentity) { onDispose { slotText?.remove(slotIdentity) } }
    val inspection = rememberAWCInspectionText(
        "${LocalAWCButtonSlotPart.current ?: "symbol"}.text", "Icon glyph", "Material Symbols Outlined")
    val fontSize = with(LocalDensity.current) { size.toSp() }
    Box(modifier.size(size).clearAndSetSemantics {
        if (contentDescription == null) hideFromAccessibility()
        else this.contentDescription = contentDescription
    }, contentAlignment = Alignment.Center) {
        Text(name, modifier = Modifier.wrapContentSize(unbounded = true).then(inspection.modifier),
            onTextLayout = inspection.onTextLayout, fontFamily = MaterialSymbols, fontWeight = FontWeight.Normal,
            fontSize = fontSize, lineHeight = fontSize, letterSpacing = 0.sp, maxLines = 1, softWrap = false,
            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
    }
}

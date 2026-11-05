package dev.awc.nativeui

import androidx.compose.runtime.*
import java.math.BigDecimal

/** An affine CSS length. Points are dp; percentage and font units keep their
 * authored meaning until the actual containing block and font are measured. */
@Immutable data class AWCSkeletonLength(
    val points:Double=0.0,val fraction:Double=0.0,val em:Double=0.0,
    val rem:Double=0.0,val ch:Double=0.0,
) {
    init { require(listOf(points,fraction,em,rem,ch).all(Double::isFinite)) { "Skeleton length coefficients must be finite." } }
    internal val values get()=mapOf("points" to points,"fraction" to fraction,"em" to em,"rem" to rem,"ch" to ch)
    internal fun resolve(parent:Double?,font:Double,rootFont:Double,zero:Double):Double? {
        if(fraction!=0.0 && parent==null) return null
        val pairs=listOf(points to 1.0,fraction to (parent ?: 0.0),em to font,rem to rootFont,ch to zero)
        val raw=pairs.sumOf { (coefficient,context)->coefficient*context }
        if(raw.isFinite()) return raw.coerceAtLeast(0.0)
        // Extreme finite coefficients can overflow while cancelling each other.
        // Resolve that case exactly before capping the eventual native layout.
        val exact=pairs.fold(BigDecimal.ZERO) { sum,(a,b)->sum.add(BigDecimal.valueOf(a).multiply(BigDecimal.valueOf(b))) }
        return exact.max(BigDecimal.ZERO).min(BigDecimal.valueOf(Double.MAX_VALUE)).toDouble()
    }
    companion object {
        fun fromValues(value:Any?):AWCSkeletonLength? {
            val map=value as? Map<*,*> ?: return null
            val names=listOf("points","fraction","em","rem","ch")
            if(map.keys.any { it !in names }) return null
            val terms=names.map { key->if(!map.containsKey(key)) 0.0 else
                (map[key] as? Number)?.toDouble()?.takeIf(Double::isFinite) ?: return null }
            return AWCSkeletonLength(terms[0],terms[1],terms[2],terms[3],terms[4])
        }
        /** Parses px, %, em, rem and ch, or additive calc() using those units.
         * Unsupported CSS expressions fail explicitly instead of losing units. */
        fun parse(css:String):AWCSkeletonLength {
            val raw=css.trim()
            require(raw.isNotEmpty() && raw.length<=4096) { "Use a Skeleton CSS length of at most 4096 characters." }
            val calc=Regex("^calc\\(([^()]*)\\)$",RegexOption.IGNORE_CASE).matchEntire(raw)
            val body=calc?.groupValues?.get(1)?.trim() ?: raw
            val unsigned="(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?"
            val first=Regex("^([+-]?$unsigned)(px|%|em|rem|ch)?",RegexOption.IGNORE_CASE).find(body)
                ?: throw IllegalArgumentException("Use px, %, em, rem or ch, optionally in additive calc().")
            val values=DoubleArray(5)
            fun add(number:String,unit:String,sign:Double=1.0) {
                val numeric=number.toDoubleOrNull() ?: throw IllegalArgumentException("Invalid Skeleton length.")
                require(unit.isNotEmpty() || calc==null && numeric==0.0) { "Only standalone zero can omit its unit." }
                val index=when(unit.lowercase()) { "", "px"->0;"%"->1;"em"->2;"rem"->3;"ch"->4;else->error("Unknown unit") }
                val amount=if(index==1) BigDecimal(number).movePointLeft(2).toDouble() else numeric
                values[index]+=amount*sign
                require(values[index].isFinite()) { "Skeleton length coefficients must be finite." }
            }
            add(first.groupValues[1],first.groupValues[2])
            var rest=body.substring(first.value.length)
            require(calc!=null || rest.isBlank() && first.groupValues[1].toDouble()>=0) { "Signed Skeleton lengths require calc()." }
            val next=Regex("^\\s+([+-])\\s+($unsigned)(px|%|em|rem|ch)?",RegexOption.IGNORE_CASE)
            while(rest.isNotBlank()) {
                val term=next.find(rest)
                require(calc!=null && term!=null) { "Use additive calc(), with spaces around + or -." }
                add(term.groupValues[2],term.groupValues[3],if(term.groupValues[1]=="-") -1.0 else 1.0)
                rest=rest.substring(term.value.length)
            }
            return AWCSkeletonLength(values[0],values[1],values[2],values[3],values[4])
        }
    }
}

/** Explicit CSS containing-block facts. A null parentHeight is auto/indefinite,
 * not the native parent's loose maximum-height constraint. A null zero advance
 * measures the actual configured font's `0` glyph. Font sizes use sp. */
@Immutable data class AWCSkeletonSizingContext(
    val fontSize:Double=16.0,val rootFontSize:Double=16.0,
    val zeroGlyphAdvance:Double?=null,val parentHeight:Double?=null,
) {
    init {
        require(fontSize.isFinite() && fontSize>=0 && rootFontSize.isFinite() && rootFontSize>=0)
        require(zeroGlyphAdvance==null || zeroGlyphAdvance.isFinite() && zeroGlyphAdvance>=0)
        require(parentHeight==null || parentHeight.isFinite() && parentHeight>=0)
    }
}
internal val LocalAWCSkeletonSizingContext=staticCompositionLocalOf { AWCSkeletonSizingContext() }
@Composable fun AWCSkeletonSizingContextScope(context:AWCSkeletonSizingContext,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCSkeletonSizingContext provides context,content=content)
}

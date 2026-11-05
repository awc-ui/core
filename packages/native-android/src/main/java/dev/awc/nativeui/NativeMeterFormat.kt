package dev.awc.nativeui

import android.os.Build
import android.icu.number.*
import android.icu.text.*
import android.icu.util.*
import java.math.BigDecimal
import java.math.RoundingMode
import java.math.MathContext
import java.util.Locale
import kotlin.math.*

/** Intl-shaped options translated to native ICU; invalid options use source fallback. */
internal object MeterNumberFormat {
    fun raw(value:Double):String {
        if(value==0.0) return "0"
        if(!value.isFinite()) return value.toString()
        val exact=BigDecimal(value)
        // ECMAScript uses the shortest decimal that round-trips to this Double.
        // Android's older Double.toString differs for e.g. 1e23 and MIN_VALUE.
        val decimal=(1..17).asSequence().map { exact.round(MathContext(it,RoundingMode.HALF_EVEN)) }
            .first { it.toDouble()==value }.stripTrailingZeros()
        return if(abs(value)>=1e-6 && abs(value)<1e21) decimal.toPlainString()
            else decimal.toString().replace("E+","e+").replace("E-","e-").replace("E","e+")
    }
    fun format(value:Double,fraction:Double,override:String,locale:String,options:AWCValue,forceLegacy:Boolean=false,api:Int=Build.VERSION.SDK_INT):String {
        if(override.isNotEmpty()) return override
        return runCatching {
            val map=if(options==null) mapOf<String,AWCValue>("style" to "percent") else awcMap(options)
            val o=Options(map,locale)
            val number=if(options==null) fraction else value
            if(api>=30 && !forceLegacy) modern(number,o,api) else legacy(number,o,api)
        }.getOrElse { raw(value) }
    }
    private val units=setOf("acre","bit","byte","celsius","centimeter","day","degree","fahrenheit","fluid-ounce","foot","gallon","gigabit","gigabyte","gram","hectare","hour","inch","kilobit","kilobyte","kilogram","kilometer","liter","megabit","megabyte","meter","microsecond","mile","mile-scandinavian","milliliter","millimeter","millisecond","minute","month","nanosecond","ounce","percent","petabyte","pound","second","stone","terabit","terabyte","week","yard","year")
    private class Options(val values:Map<String,AWCValue>,locale:String) {
        fun option(key:String,default:String,valid:Set<String>):String {
            if(!values.containsKey(key)) return default
            val v=values[key]?.toString() ?: "null";require(v in valid) { "Invalid $key" };return v
        }
        fun number(key:String,min:Int,max:Int,default:Int):Int {
            if(!values.containsKey(key)) return default
            val value=values[key];val n=when(value) { null->0.0;is Number->value.toDouble();is Boolean->if(value) 1.0 else 0.0;else->value.toString().trim().ifEmpty { "0" }.toDouble() }
            require(n.isFinite() && n>=min && n<=max);return floor(n).toInt()
        }
        val style=option("style","decimal",setOf("decimal","percent","currency","unit"))
        val notation=option("notation","standard",setOf("standard","scientific","engineering","compact"))
        val compact=option("compactDisplay","short",setOf("short","long"))
        val currencyDisplay=option("currencyDisplay","symbol",setOf("symbol","narrowSymbol","code","name"))
        val currencySign=option("currencySign","standard",setOf("standard","accounting"))
        val unitDisplay=option("unitDisplay","short",setOf("short","narrow","long"))
        val sign=option("signDisplay","auto",setOf("auto","never","always","exceptZero","negative"))
        val priority=option("roundingPriority","auto",setOf("auto","morePrecision","lessPrecision"))
        val rounding=option("roundingMode","halfExpand",setOf("ceil","floor","expand","trunc","halfCeil","halfFloor","halfExpand","halfTrunc","halfEven"))
        val zero=option("trailingZeroDisplay","auto",setOf("auto","stripIfInteger"))
        val localeMatcher=option("localeMatcher","best fit",setOf("lookup","best fit"))
        val currency:Currency?=if(values.containsKey("currency")) (values["currency"]?.toString() ?: "null").let { require(it.matches(Regex("[A-Za-z]{3}")));Currency.getInstance(it.uppercase(Locale.ROOT)) } else null
        val unit:String?=if(values.containsKey("unit")) (values["unit"]?.toString() ?: "null").also { val parts=it.split("-per-");require(parts.size in 1..2 && parts.all { u->u in units }) } else null
        val locale:ULocale
        val integer=number("minimumIntegerDigits",1,21,1)
        val hasFraction=listOf("minimumFractionDigits","maximumFractionDigits").any(values::containsKey)
        val hasSignificant=listOf("minimumSignificantDigits","maximumSignificantDigits").any(values::containsKey)
        val minSignificant=number("minimumSignificantDigits",1,21,1)
        val maxSignificant=number("maximumSignificantDigits",1,21,21)
        val increment=number("roundingIncrement",1,5000,1)
        val minimum:Int
        val maximum:Int
        val grouping:String
        init {
            require(style!="currency" || currency!=null);require(style!="unit" || unit!=null)
            val javaLocale=if(locale.isEmpty()) Locale.getDefault() else Locale.Builder().setLanguageTag(locale).build()
            require(locale.isEmpty() || javaLocale.language.isNotEmpty())
            val numbering=if(values.containsKey("numberingSystem")) values["numberingSystem"]?.toString() ?: "null" else null
            if(numbering!=null) require(numbering.matches(Regex("[A-Za-z0-9]{3,8}(-[A-Za-z0-9]{3,8})*")))
            this.locale=ULocale.forLocale(javaLocale).let { base->
                if(numbering!=null && NumberingSystem.getInstanceByName(numbering)!=null) ULocale.Builder().setLocale(base).setUnicodeLocaleKeyword("nu",numbering).build() else base
            }
            val defaultMin=if(style=="currency") currency!!.defaultFractionDigits.coerceAtLeast(0) else 0
            val defaultMax=if(style=="currency") currency!!.defaultFractionDigits.coerceAtLeast(0) else if(style=="percent") 0 else 3
            val minimumGiven=values.containsKey("minimumFractionDigits");val maximumGiven=values.containsKey("maximumFractionDigits")
            val lo=number("minimumFractionDigits",0,100,defaultMin);val hi=number("maximumFractionDigits",0,100,defaultMax)
            minimum=if(!minimumGiven && maximumGiven) min(defaultMin,hi) else lo
            maximum=if(!maximumGiven) max(defaultMax,minimum) else hi
            require((significant() || minimum<=maximum) && minSignificant<=maxSignificant)
            require(increment in setOf(1,2,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000))
            require(increment==1 || (!hasSignificant && priority=="auto" && minimum==maximum))
            val defaultGroup=if(notation=="compact") "min2" else "auto"
            grouping=when(val g=values["useGrouping"]) { null->if(values.containsKey("useGrouping")) "off" else defaultGroup;false->"off";true->"always";"true","false"->defaultGroup;else->g.toString().also { require(it in setOf("auto","always","min2")) } }
        }
        fun roundingMode(value:Double)=when(rounding) {
            "ceil"->RoundingMode.CEILING;"floor"->RoundingMode.FLOOR;"expand"->RoundingMode.UP;"trunc"->RoundingMode.DOWN
            "halfEven"->RoundingMode.HALF_EVEN;"halfTrunc"->RoundingMode.HALF_DOWN
            "halfCeil"->if(value<0) RoundingMode.HALF_DOWN else RoundingMode.HALF_UP
            "halfFloor"->if(value<0) RoundingMode.HALF_UP else RoundingMode.HALF_DOWN
            else->RoundingMode.HALF_UP
        }
        fun significant()=hasSignificant && priority=="auto"
    }
    @android.annotation.TargetApi(30)
    private fun modern(input:Double,o:Options,api:Int):String {
        var formatter=NumberFormatter.withLocale(o.locale)
            .integerWidth(IntegerWidth.zeroFillTo(o.integer)).roundingMode(o.roundingMode(input))
            .grouping(when(o.grouping) { "off"->NumberFormatter.GroupingStrategy.OFF;"always"->NumberFormatter.GroupingStrategy.ON_ALIGNED;"min2"->NumberFormatter.GroupingStrategy.MIN2;else->NumberFormatter.GroupingStrategy.AUTO })
            .notation(when(o.notation) { "scientific"->Notation.scientific();"engineering"->Notation.engineering();"compact"->if(o.compact=="long") Notation.compactLong() else Notation.compactShort();else->Notation.simple() })
        val accounting=o.style=="currency" && o.currencySign=="accounting"
        val sign=when(o.sign) {
            "always"->if(accounting) NumberFormatter.SignDisplay.ACCOUNTING_ALWAYS else NumberFormatter.SignDisplay.ALWAYS
            "exceptZero"->if(accounting) NumberFormatter.SignDisplay.ACCOUNTING_EXCEPT_ZERO else NumberFormatter.SignDisplay.EXCEPT_ZERO
            "never"->NumberFormatter.SignDisplay.NEVER
            else->if(accounting) NumberFormatter.SignDisplay.ACCOUNTING else NumberFormatter.SignDisplay.AUTO
        }
        formatter=formatter.sign(sign)
        if(o.style=="percent") formatter=formatter.unit(MeasureUnit.PERCENT).scale(Scale.powerOfTen(2))
        if(o.style=="currency") formatter=formatter.unit(o.currency!!).unitWidth(when(o.currencyDisplay) {
            "name"->NumberFormatter.UnitWidth.FULL_NAME;"code"->NumberFormatter.UnitWidth.ISO_CODE;"narrowSymbol"->NumberFormatter.UnitWidth.NARROW;else->NumberFormatter.UnitWidth.SHORT })
        if(o.style=="unit") formatter=formatter.unit(MeasureUnit.forIdentifier(o.unit!!)).unitWidth(when(o.unitDisplay) {
            "long"->NumberFormatter.UnitWidth.FULL_NAME;"narrow"->NumberFormatter.UnitWidth.NARROW;else->NumberFormatter.UnitWidth.SHORT })
        val compactDefault=o.notation=="compact" && o.priority=="auto" && !o.hasFraction && !o.hasSignificant
        if(!compactDefault) {
            var precision:Precision=if(o.increment!=1) Precision.increment(BigDecimal.valueOf(o.increment.toLong()).movePointLeft(o.maximum))
                else if(o.significant()) Precision.minMaxSignificantDigits(o.minSignificant,o.maxSignificant)
                else Precision.minMaxFraction(o.minimum,o.maximum)
            if(o.priority!="auto") {
                // ICU's joint fraction/significant precision is public on API34.
                // Older runtimes choose the same candidate before formatting.
                precision=if(api>=34) Precision.minMaxFraction(o.minimum,o.maximum).withSignificantDigits(o.minSignificant,o.maxSignificant,
                    if(o.priority=="morePrecision") NumberFormatter.RoundingPriority.RELAXED else NumberFormatter.RoundingPriority.STRICT)
                    else choosePrecision(input,o)
            }
            if(api>=34 && o.zero=="stripIfInteger") precision=precision.trailingZeroDisplay(NumberFormatter.TrailingZeroDisplay.HIDE_IF_WHOLE)
            formatter=formatter.precision(precision)
        }
        var result=formatter.format(input)
        // NumberFormatter exposes the actual rounded quantity, including compact
        // scaling. Sign and integer-zero rules must use that result, not input.
        val rounded=result.toBigDecimal()
        if(o.sign=="negative" && rounded.signum()==0) {
            formatter=formatter.sign(NumberFormatter.SignDisplay.NEVER);result=formatter.format(input)
        }
        if(api<34 && o.zero=="stripIfInteger" && rounded.stripTrailingZeros().scale()<=0) {
            val precision=if(o.increment!=1) Precision.increment(BigDecimal.valueOf(o.increment.toLong()).movePointLeft(o.maximum))
                else if(o.significant() || o.priority!="auto" && useSignificant(input,o)) Precision.minMaxSignificantDigits(1,o.maxSignificant)
                else Precision.minMaxFraction(0,o.maximum)
            result=formatter.precision(precision).format(input)
        }
        return result.toString()
    }
    private fun useSignificant(value:Double,o:Options):Boolean {
        if(o.priority=="auto") return o.significant()
        val absolute=abs(value)
        val magnitude=(if(absolute==0.0) 0 else floor(log10(absolute)).toInt())+(if(o.style=="percent" && absolute!=0.0) 2 else 0)
        val sigMagnitude=magnitude-o.maxSignificant+1
        val fractionMagnitude=-o.maximum
        return if(o.priority=="morePrecision") sigMagnitude<=fractionMagnitude else sigMagnitude>fractionMagnitude
    }
    @android.annotation.TargetApi(30)
    private fun choosePrecision(value:Double,o:Options):Precision = if(useSignificant(value,o))
        Precision.minMaxSignificantDigits(o.minSignificant,o.maxSignificant) else Precision.minMaxFraction(o.minimum,o.maximum)

    /** API26–29 formatter retains native locale data and actual unit formatting. */
    private fun legacy(input:Double,o:Options,api:Int):String {
        val kind=when(o.style) { "currency"->when(o.currencyDisplay) { "name"->NumberFormat.PLURALCURRENCYSTYLE;"code"->NumberFormat.ISOCURRENCYSTYLE;else->if(o.currencySign=="accounting") NumberFormat.ACCOUNTINGCURRENCYSTYLE else NumberFormat.CURRENCYSTYLE };"percent"->NumberFormat.PERCENTSTYLE;else->NumberFormat.NUMBERSTYLE }
        val format=if(o.notation=="compact") CompactDecimalFormat.getInstance(o.locale,if(o.compact=="long") CompactDecimalFormat.CompactStyle.LONG else CompactDecimalFormat.CompactStyle.SHORT)
            else NumberFormat.getInstance(o.locale,kind) as DecimalFormat
        val compactAffixes=o.notation=="compact" && (o.style=="percent" || o.style=="currency" && o.currencyDisplay=="name")
        if(o.currency!=null && !compactAffixes) format.currency=o.currency
        format.minimumIntegerDigits=o.integer;format.minimumFractionDigits=o.minimum;format.maximumFractionDigits=o.maximum
        format.roundingMode=o.roundingMode(input).ordinal
        format.isGroupingUsed=o.grouping!="off"
        if(useSignificant(input,o)) { format.setSignificantDigitsUsed(true);format.minimumSignificantDigits=o.minSignificant;format.maximumSignificantDigits=o.maxSignificant }
        if(o.notation=="compact" && o.priority=="auto" && !o.hasFraction && !o.hasSignificant) { format.setSignificantDigitsUsed(true);format.minimumSignificantDigits=1;format.maximumSignificantDigits=2 }
        if(o.notation=="scientific" || o.notation=="engineering") {
            format.isScientificNotation=true;format.minimumExponentDigits=1;format.maximumIntegerDigits=if(o.notation=="engineering") 3 else 1
            if(!useSignificant(input,o)) {
                val magnitude=if(input==0.0) 0 else floor(log10(abs(input))).toInt()
                val mantissa=if(o.notation=="engineering") Math.floorMod(magnitude,3)+1 else 1
                format.setSignificantDigitsUsed(true)
                format.minimumSignificantDigits=mantissa+o.minimum;format.maximumSignificantDigits=mantissa+o.maximum
            }
        }
        if(o.increment!=1) format.roundingIncrement=BigDecimal.valueOf(o.increment.toLong()).movePointLeft(o.maximum)
        if(o.style=="currency" && o.currencyDisplay=="narrowSymbol") {
            val symbols=format.decimalFormatSymbols
            val symbol=if(api>=30) o.currency!!.getName(o.locale,Currency.NARROW_SYMBOL_NAME,booleanArrayOf(false)) else o.currency!!.getSymbol(o.locale)
            symbols.currencySymbol=symbol;format.decimalFormatSymbols=symbols
        }
        var number=if(o.sign=="never") abs(input) else input
        if(o.notation=="compact" && o.style=="percent") number*=100
        if(o.notation=="compact" && o.priority=="auto" && !o.hasFraction && !o.hasSignificant && roundedDigits(format,number).first.length>=2) {
            // Intl compact defaults choose the more precise of integer rounding
            // and two significant digits; hundreds stay 123K rather than 120K.
            format.setSignificantDigitsUsed(false);format.minimumFractionDigits=0;format.maximumFractionDigits=0
        }
        val digits=roundedDigits(format,number)
        val roundedZero=digits.first.all { it=='0' } && digits.second.all { it=='0' }
        if((o.sign=="negative" || o.sign=="exceptZero") && roundedZero) number=abs(number)
        if(o.zero=="stripIfInteger" && digits.second.all { it=='0' }) {
            format.minimumFractionDigits=0
            if(format.areSignificantDigitsUsed()) format.minimumSignificantDigits=1
        }
        if(o.grouping=="min2" && abs(number)<10000) format.isGroupingUsed=false
        if(o.sign=="always" || o.sign=="exceptZero" && !roundedZero) {
            if(api>=28) format.isSignAlwaysShown=true else if(number>=0) format.positivePrefix=format.decimalFormatSymbols.plusSignString+format.positivePrefix
        }
        if(o.style=="unit") {
            val parts=o.unit!!.split("-per-")
            fun unit(name:String)=MeasureUnit.getAvailable().first { it.subtype==name }
            val measure=MeasureFormat.getInstance(o.locale,when(o.unitDisplay) { "long"->MeasureFormat.FormatWidth.WIDE;"narrow"->MeasureFormat.FormatWidth.NARROW;else->MeasureFormat.FormatWidth.SHORT },format)
            return if(parts.size==1) measure.formatMeasures(Measure(number,unit(parts[0]))) else measure.formatMeasurePerUnit(Measure(number,unit(parts[0])),unit(parts[1]),StringBuilder(),java.text.FieldPosition(0)).toString()
        }
        if(compactAffixes) {
            val affix=NumberFormat.getInstance(o.locale,kind) as DecimalFormat
            if(o.currency!=null) affix.currency=o.currency
            if(o.sign=="always" || o.sign=="exceptZero" && !roundedZero) {
                if(api>=28) affix.isSignAlwaysShown=true
                else if(number>=0) affix.positivePrefix=affix.decimalFormatSymbols.plusSignString+affix.positivePrefix
            }
            return replaceNumericFields(affix.formatToCharacterIterator(if(o.style=="percent") number/100 else number),format.format(abs(number)))
        }
        return format.format(number)
    }
    private fun replaceNumericFields(iterator:java.text.AttributedCharacterIterator,number:String):String {
        val text=StringBuilder();var begin=-1;var end=-1
        var char=iterator.first()
        while(char!=java.text.CharacterIterator.DONE) {
            if(iterator.getAttribute(NumberFormat.Field.INTEGER)!=null || iterator.getAttribute(NumberFormat.Field.FRACTION)!=null) {
                if(begin<0) begin=text.length;end=text.length+1
            }
            text.append(char);char=iterator.next()
        }
        return if(begin>=0) text.substring(0,begin)+number+text.substring(end) else text.toString()
    }
    private fun roundedDigits(format:DecimalFormat,value:Double):Pair<String,String> {
        val iterator=format.formatToCharacterIterator(value)
        val integer=StringBuilder();val fraction=StringBuilder()
        var char=iterator.first()
        while(char!=java.text.CharacterIterator.DONE) {
            val digit=Character.digit(char,10)
            if(digit>=0) when {
                iterator.getAttribute(NumberFormat.Field.FRACTION)!=null->fraction.append(digit)
                iterator.getAttribute(NumberFormat.Field.INTEGER)!=null->integer.append(digit)
            }
            char=iterator.next()
        }
        return integer.toString() to fraction.toString()
    }
}

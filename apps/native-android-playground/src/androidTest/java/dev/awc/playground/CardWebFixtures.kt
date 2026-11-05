package dev.awc.playground

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Shared harness for the Chrome md-card oracles (web-oracle/paint.html, states.html). */
internal object CardWeb {
    fun document(name:String)=InstrumentationRegistry.getInstrumentation().context.assets.open(name).bufferedReader().use { JSONObject(it.readText()) }
    fun JSONArray.objects()=(0 until length()).map { getJSONObject(it) }
    fun numbers(s:String)=Regex("-?[0-9.]+(?:e-?[0-9]+)?").findAll(s).map { it.value.toDouble() }.toList()
    fun color(s:String):List<Double> { val n=numbers(s.substringAfter("("))
        return when { s.startsWith("rgba")->listOf(n[0]/255,n[1]/255,n[2]/255,n[3]);s.startsWith("rgb")->listOf(n[0]/255,n[1]/255,n[2]/255,1.0)
            s.startsWith("color(srgb")->listOf(n[0],n[1],n[2],n.getOrElse(3) { 1.0 });else->listOf(0.0,0.0,0.0,0.0) } }
    fun pre(c:List<Double>)=listOf(c[0]*c[3],c[1]*c[3],c[2]*c[3],c[3])
    /** Computed box-shadow → per layer [x,y,blur,spread,r,g,b,a] (premultiplied), padded to two layers. */
    fun shadow(css:String,pad:Int=0):List<Double> {
        val layers=if(css=="none") mutableListOf() else css.split(Regex(",(?![^(]*\\))")).map { l-> val c=Regex("(rgba?|color)\\([^)]*\\)").find(l)!!.value;val n=numbers(l.replace(c,""))
            listOf(n[0],n[1],n.getOrElse(2) { 0.0 },n.getOrElse(3) { 0.0 })+pre(color(c)) }.toMutableList()
        while(layers.size<pad) layers+=List(8) { 0.0 }
        return layers.flatten()
    }
    fun nativeShadow(list:List<List<Double>>,pad:Int=0):List<Double> { val l=list.map { it.take(4)+pre(it.drop(4)) }.toMutableList();while(l.size<pad) l+=List(8) { 0.0 };return l.flatten() }
    fun corners(css:String):AWCCornerShape {
        val halves=css.split("/").map { h-> h.trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDouble() } }
        fun four(v:List<Double>)=when(v.size) { 1->List(4) { v[0] };2->listOf(v[0],v[1],v[0],v[1]);3->listOf(v[0],v[1],v[2],v[1]);else->v }
        val h=four(halves[0]);val v=if(halves.size>1) four(halves[1]) else h
        fun r(i:Int)=AWCCornerRadius(AWCCornerLength(h[i]),AWCCornerLength(v[i]))
        return AWCCornerShape(r(0),r(1),r(2),r(3))
    }
    fun insets(css:String):AWCCardInsets { val v=css.trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDouble() }
        val f=when(v.size) { 1->List(4) { v[0] };2->listOf(v[0],v[1],v[0],v[1]);3->listOf(v[0],v[1],v[2],v[1]);else->v };return AWCCardInsets(f[0],f[1],f[2],f[3]) }
    fun hex(css:String):String { if(css.startsWith("#")) return css.uppercase()
        val c=color(css);return "#%02X%02X%02X%02X".format((c[0]*255).toInt(),(c[1]*255).toInt(),(c[2]*255).toInt(),Math.round(c[3]*255).toInt()) }
    fun boxShadow(css:String)=css.split(Regex(",(?![^(]*\\))")).map { l-> val c=Regex("(rgba?\\([^)]*\\)|#[0-9A-Fa-f]{6,8})").find(l)!!.value;val n=numbers(l.replace(c,""))
        AWCBoxShadow(n[0],n[1],n.getOrElse(2) { 0.0 },n.getOrElse(3) { 0.0 },hex(c)) }
    fun appearance(h:JSONObject?):AWCCardAppearance { if(h==null) return AWCCardAppearance()
        fun s(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCCardAppearance(s("container-color")?.let(::hex),s("container-shape")?.let(::corners),s("container-elevation")?.let(::boxShadow),s("outline-color")?.let(::hex),
            s("outline-width")?.removeSuffix("px")?.toDouble(),s("state-layer-color")?.let(::hex),s("width")?.let(AWCSkeletonLength::parse),s("min-width")?.let(AWCSkeletonLength::parse),
            s("max-width")?.let(AWCSkeletonLength::parse),s("height")?.let(AWCSkeletonLength::parse),s("min-height")?.let(AWCSkeletonLength::parse),s("max-height")?.let(AWCSkeletonLength::parse),
            s("padding")?.let(::insets),s("gap")?.removeSuffix("px")?.toDouble()) }
    class Grid(val x:Int,val y:Int,val w:Int,val h:Int,val v:DoubleArray) {
        fun at(px:Int,py:Int):List<Double> { val i=((py-y)*w+(px-x))*3;return listOf(v[i],v[i+1],v[i+2]) }
        fun flat(px:Int,py:Int,limit:Double):Boolean { if(px-1<x || py-1<y || px+1>=x+w || py+1>=y+h) return false
            for(c in 0..2) { var lo=999.0;var hi=-1.0;for(dy in -1..1) for(dx in -1..1) { val q=v[((py+dy-y)*w+(px+dx-x))*3+c];lo=min(lo,q);hi=max(hi,q) };if(hi-lo>limit) return false };return true }
    }
    fun nativeGrid(map:PixelMap,x:Int,y:Int,w:Int,h:Int):Grid { val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val s=DoubleArray(3);var n=0
            for(yy in 0..1) for(xx in 0..1) { val X=(x+px)*2+xx;val Y=(y+py)*2+yy
                if(X in 0 until map.width && Y in 0 until map.height) { val c=map[X,Y];s[0]+=c.red*255.0;s[1]+=c.green*255.0;s[2]+=c.blue*255.0;n++ } }
            for(c in 0..2) v[(py*w+px)*3+c]=if(n==0) -999.0 else s[c]/n }
        return Grid(x,y,w,h,v) }
    fun webGrid(path:String,clip:JSONObject):Grid {
        val bmp=InstrumentationRegistry.getInstrumentation().context.assets.open(path).use { BitmapFactory.decodeStream(it) }
        val x=clip.getInt("x");val y=clip.getInt("y");val w=clip.getInt("width");val h=clip.getInt("height");val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val p=if(px<bmp.width && py<bmp.height) bmp.getPixel(px,py) else 0
            v[(py*w+px)*3]=(p shr 16 and 255).toDouble();v[(py*w+px)*3+1]=(p shr 8 and 255).toDouble();v[(py*w+px)*3+2]=(p and 255).toDouble() }
        return Grid(x,y,w,h,v) }
    /** Every flat CSS pixel of the source clip vs native; [mask] rects (CSS px) are skipped in both. */
    fun compare(web:Grid,nat:Grid,mask:List<Rect> = emptyList()):JSONObject {
        var n=0;var bad=0;var sum=0.0;var worst=0.0;var at=""
        for(py in web.y+1 until web.y+web.h-1) for(px in web.x+1 until web.x+web.w-1) {
            if(!web.flat(px,py,6.0) || !nat.flat(px,py,6.0)) continue
            if(mask.any { it.inflate(2f).contains(androidx.compose.ui.geometry.Offset(px+.5f,py+.5f)) }) continue
            val a=web.at(px,py);val b=nat.at(px,py);val d=(0..2).maxOf { abs(a[it]-b[it]) };n++;sum+=d;if(d>6) bad++
            if(d>worst) { worst=d;at="($px,$py) web $a native $b" } }
        return JSONObject().put("compared",n).put("mean",sum/max(n,1)).put("over6",bad).put("worst",worst).put("worstAt",at)
    }
    fun ok(r:JSONObject)=r.getInt("compared")>1000 && r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0
}

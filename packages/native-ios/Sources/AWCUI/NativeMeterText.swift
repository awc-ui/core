import CoreText
import SwiftUI

/// A source line box around actual CoreText glyphs. Fixed CSS line heights,
/// wrapping captions and baseline alignment must not depend on system leading.
struct AWCNativeMeterText {
    let text:String,size:Double,lineHeight:Double,weight:Double,spacing:Double,tabular:Bool
    var usesDefaultKerning=false
    var wrapAnywhere=false
    var visible:String{text.replacingOccurrences(of:"[\\t\\n\\f\\r ]+",with:" ",options:.regularExpression).trimmingCharacters(in:CharacterSet(charactersIn:" "))}
    var font:CTFont{
        _ = AWCNativeFonts.labelFamily(regular:weight<500)
        let base=CTFontCreateWithName((weight>=600 ? "Roboto-Bold":weight<500 ? "Roboto-Regular":"Roboto-Medium") as CFString,CGFloat(size),nil)
        var attrs:[CFString:Any]=[:]
        if tabular{attrs[kCTFontFeatureSettingsAttribute]=[[kCTFontFeatureTypeIdentifierKey:kNumberSpacingType,kCTFontFeatureSelectorIdentifierKey:kMonospacedNumbersSelector]]}
        if weight>=600{attrs[kCTFontTraitsAttribute]=[kCTFontSymbolicTrait:CTFontSymbolicTraits.boldTrait.rawValue]}
        return attrs.isEmpty ? base:CTFontCreateCopyWithAttributes(base,CGFloat(size),nil,CTFontDescriptorCreateWithAttributes(attrs as CFDictionary))
    }
    var attributed:NSAttributedString{
        let value=NSMutableAttributedString(string:visible,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font,NSAttributedString.Key(kCTKernAttributeName as String):spacing,NSAttributedString.Key(kCTForegroundColorFromContextAttributeName as String):true])
        if usesDefaultKerning && spacing==0{value.removeAttribute(NSAttributedString.Key(kCTKernAttributeName as String),range:NSRange(location:0,length:value.length))}
        // CSS does not add tracking to cursive script runs. The bundled Roboto
        // Latin fonts fall back to the installed Arabic face, using its bold
        // face for the medium numeric label, as the browser font probe confirms.
        let arabic=try! NSRegularExpression(pattern:"[\u{0600}-\u{06FF}\u{0750}-\u{077F}\u{08A0}-\u{08FF}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}]+")
        let fallback=CTFontCreateWithName((weight>=500 ? "GeezaPro-Bold":"GeezaPro") as CFString,CGFloat(size),nil)
        for match in arabic.matches(in:visible,range:NSRange(location:0,length:value.length)){
            value.addAttributes([NSAttributedString.Key(kCTFontAttributeName as String):fallback,NSAttributedString.Key(kCTKernAttributeName as String):0],range:match.range)
        }
        return value
    }
    var naturalWidth:Double{CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attributed),nil,nil,nil)}
    var baseline:Double{(lineHeight-Double(CTFontGetAscent(font)+CTFontGetDescent(font)))/2+Double(CTFontGetAscent(font))}
    func lines(width:Double,wrap:Bool,direction:LayoutDirection = .leftToRight,ellipsize:Bool=true)->[CTLine]{
        let value=NSMutableAttributedString(attributedString:attributed)
        var writingDirection:CTWritingDirection = direction == .rightToLeft ? .rightToLeft:.leftToRight
        let paragraph=withUnsafePointer(to:&writingDirection){pointer in
            var setting=CTParagraphStyleSetting(spec:.baseWritingDirection,valueSize:MemoryLayout<CTWritingDirection>.size,value:pointer)
            return CTParagraphStyleCreate(&setting,1)
        }
        value.addAttribute(NSAttributedString.Key(kCTParagraphStyleAttributeName as String),value:paragraph,range:NSRange(location:0,length:value.length))
        guard value.length>0,size>0,lineHeight>0 else{return []}
        if !wrap{
            let line=CTLineCreateWithAttributedString(value)
            if ellipsize && naturalWidth>width+0.001 {
                let token=CTLineCreateWithAttributedString(NSAttributedString(string:"…",attributes:value.attributes(at:0,effectiveRange:nil)))
                return [CTLineCreateTruncatedLine(line,max(0,width),.end,token) ?? line]
            }
            return [line]
        }
        let typesetter=CTTypesetterCreateWithAttributedString(value),string=value.string as NSString
        var start=0,result:[CTLine]=[]
        while start<value.length {
            var length=CTTypesetterSuggestLineBreak(typesetter,start,max(0,width))
            length=max(1,length)
            // CSS normal whitespace does not force-break an unbroken Latin word.
            let end=min(value.length,start+length)
            let slice=string.substring(with:NSRange(location:start,length:end-start))
            if !wrapAnywhere,end<value.length,!slice.contains(" "),!slice.unicodeScalars.contains(where:{$0.value>=0x2E80}),string.character(at:end) != 32 {
                var next=end;while next<value.length && string.character(at:next) != 32{next += 1};length=next-start
            }
            var drawingLength=min(length,value.length-start)
            while drawingLength>0 && string.character(at:start+drawingLength-1)==32{drawingLength -= 1}
            result.append(CTTypesetterCreateLine(typesetter,CFRange(location:start,length:drawingLength)))
            start += min(length,value.length-start);while start<value.length && string.character(at:start)==32{start += 1}
        }
        return result
    }
    func sizeThatFits(_ width:Double?,wrap:Bool)->CGSize{
        let w=min(naturalWidth,width ?? naturalWidth)
        let count=lines(width:max(0,w),wrap:wrap).count
        return .init(width:max(0,w),height:Double(count)*lineHeight)
    }
    var inspection:AWCValue{["size":.number(size),"lineHeight":.number(lineHeight),"weight":.number(AWCNativeFonts.resolvedLabelWeight(weight)),"spacing":.number(spacing),"family":.string(AWCNativeFonts.labelFamily(regular:weight<500)),"unit":"pt"]}
}
private struct AWCMeterTextLayout:Layout {
    let model:AWCNativeMeterText,wrap:Bool
    func sizeThatFits(proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGSize{model.sizeThatFits(proposal.width.map(Double.init),wrap:wrap)}
    func placeSubviews(in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout()){subviews.first?.place(at:bounds.origin,proposal:.init(bounds.size))}
    func explicitAlignment(of guide:VerticalAlignment,in bounds:CGRect,proposal:ProposedViewSize,subviews:Subviews,cache:inout())->CGFloat?{guide == .firstTextBaseline ? CGFloat(model.baseline):nil}
}
struct AWCNativeMeterTextView:View {
    let model:AWCNativeMeterText,color:Color,wrap:Bool,center:Bool
    var centerOverflow=false
    var ellipsize=false
    @Environment(\.layoutDirection) private var direction
    @Environment(\.self) private var environment
    var body:some View{
        AWCMeterTextLayout(model:model,wrap:wrap){
            GeometryReader{geometry in
                let width=Double(geometry.size.width),height=Double(geometry.size.height)
                let lines=model.lines(width:width,wrap:wrap,direction:direction,ellipsize:ellipsize)
                let positions=lines.enumerated().map{index,line -> CGPoint in
                    let advance=CTLineGetTypographicBounds(line,nil,nil,nil)
                    let x=center && (centerOverflow || advance<=width) ? (width-advance)/2:direction == .rightToLeft ? width-advance:0
                    return .init(x:x,y:model.baseline+Double(index)*model.lineHeight)
                }
                let ink=lines.enumerated().map{index,line -> CGRect in
                    let bounds=CTLineGetBoundsWithOptions(line,.useGlyphPathBounds),position=positions[index]
                    return .init(x:position.x+bounds.minX,y:position.y-bounds.maxY,width:bounds.width,height:bounds.height)
                }.reduce(CGRect(x:0,y:0,width:width,height:height)){$0.union($1)}
                // Canvas owns a finite backing surface. Enlarge that surface for
                // real overflowing glyphs, while the parent retains its CSS line
                // box for layout and inspection.
                Canvas{context,size in
                    let resolved=color.resolve(in:environment)
                    context.withCGContext{cg in
                        cg.setFillColor(resolved.cgColor);cg.textMatrix = .identity
                        cg.translateBy(x:0,y:size.height);cg.scaleBy(x:1,y:-1)
                        for (index,line) in lines.enumerated(){
                            cg.textPosition = .init(x:positions[index].x-ink.minX,y:Double(size.height)-positions[index].y+ink.minY)
                            CTLineDraw(line,cg)
                        }
                    }
                }.frame(width:ink.width,height:ink.height).offset(x:ink.minX,y:ink.minY)
            }.environment(\.layoutDirection,.leftToRight).accessibilityHidden(true)
        // Only the single-line header label has CSS overflow:hidden. Captions
        // and center values keep normal overflow when an unbroken word exceeds
        // their available line box.
        }.modifier(AWCMeterTextClip(enabled:ellipsize))
    }
}
private struct AWCMeterTextClip:ViewModifier {
    let enabled:Bool
    @ViewBuilder func body(content:Content)->some View{if enabled{content.clipped()}else{content}}
}

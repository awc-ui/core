import SwiftUI
import CoreText

/// A source length retaining parent and font-relative coefficients.
public struct AWCSkeletonLength:Equatable,Sendable {
    public let points:Double,fraction:Double,em:Double,rem:Double,ch:Double
    public init(points:Double=0,fraction:Double=0,em:Double=0,rem:Double=0,ch:Double=0){
        self.points=points;self.fraction=fraction;self.em=em;self.rem=rem;self.ch=ch
    }
    public static func points(_ value:Double)->Self{.init(points:value)}
    public static func fraction(_ value:Double)->Self{.init(fraction:value)}
    var valid:Bool{[points,fraction,em,rem,ch].allSatisfy(\.isFinite)}
    public init?(values:[String:AWCValue]){
        guard Set(values.keys).isSubset(of:["points","fraction","em","rem","ch"]) else{return nil}
        func n(_ key:String)->Double?{guard let value=values[key] else{return 0};guard case .number(let number)=value,number.isFinite else{return nil};return number}
        guard let p=n("points"),let f=n("fraction"),let e=n("em"),let r=n("rem"),let c=n("ch") else{return nil}
        self.init(points:p,fraction:f,em:e,rem:r,ch:c)
    }
    /// Supports px, %, em, rem and ch, optionally added/subtracted in calc().
    /// Unsupported CSS expressions return nil rather than losing their units.
    public init?(css:String){
        let source=css.trimmingCharacters(in:.whitespacesAndNewlines).lowercased()
        guard !source.isEmpty,source.utf8.count<=4096 else{return nil}
        let calc=source.hasPrefix("calc(") && source.hasSuffix(")")
        let body=calc ? String(source.dropFirst(5).dropLast()).trimmingCharacters(in:.whitespacesAndNewlines):source
        let numeric="(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?"
        let first=try! NSRegularExpression(pattern:"^([+-]?"+numeric+")(px|%|em|rem|ch)?")
        let next=try! NSRegularExpression(pattern:"^\\s+([+-])\\s+("+numeric+")(px|%|em|rem|ch)?")
        func captures(_ regex:NSRegularExpression,_ text:String)->[String]?{
            guard let match=regex.firstMatch(in:text,range:NSRange(text.startIndex...,in:text)) else{return nil}
            return (0..<match.numberOfRanges).map{Range(match.range(at:$0),in:text).map{String(text[$0])} ?? ""}
        }
        func number(_ raw:String,_ unit:String)->Double? {
            // Normalize percent before Double conversion: 1e310% represents
            // the finite fraction1e308 even though its unscaled number overflows.
            var normalized=raw
            if unit=="%" {
                let pieces=raw.split(separator:"e",omittingEmptySubsequences:false)
                guard pieces.count<=2 else{return nil}
                let exponent=pieces.count==2 ? Int(pieces[1]):0
                guard let exponent,exponent>Int.min+2 else{return nil}
                normalized=String(pieces[0])+"e"+String(exponent-2)
            }
            guard let result=Double(normalized),result.isFinite else{return nil}
            return result
        }
        guard let match=captures(first,body),let firstNumber=number(match[1],match[2]),
              (!match[2].isEmpty || (!calc && firstNumber==0)),calc || firstNumber>=0 else{return nil}
        var fields=[String:Double]()
        func add(_ raw:String,_ unit:String,_ sign:Double)->Bool {
            guard let value=number(raw,unit) else{return false}
            let key=["px":"points","":"points","%":"fraction","em":"em","rem":"rem","ch":"ch"][unit]
            guard let key else{return false}
            let sum=(fields[key] ?? 0)+sign*value;guard sum.isFinite else{return false};fields[key]=sum;return true
        }
        guard add(match[1],match[2],1) else{return nil}
        var rest=String(body.dropFirst(match[0].count))
        while !rest.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty{
            guard calc,let term=captures(next,rest),!term[3].isEmpty,add(term[2],term[3],term[1]=="-" ? -1:1) else{return nil}
            rest=String(rest.dropFirst(term[0].count))
        }
        self.init(points:fields["points"] ?? 0,fraction:fields["fraction"] ?? 0,em:fields["em"] ?? 0,rem:fields["rem"] ?? 0,ch:fields["ch"] ?? 0)
    }
    static let maximumUsedLength=16_777_214.0
    func resolve(parent:Double?,context:AWCSkeletonSizingContext)->Double?{
        guard valid else{return nil}
        guard fraction==0 || parent != nil else{return nil}
        let products=[(points,1.0),(fraction,parent ?? 0),(em,context.fontSize),(rem,context.rootFontSize),(ch,context.resolvedZeroAdvance)]
        var exponent=Int.min
        for (a,b) in products where a != 0 && b != 0{exponent=max(exponent,a.exponent+b.exponent)}
        guard exponent != Int.min else{return 0}
        // A common exponent keeps finite signed affine terms safe even when
        // individual products overflow Double before cancellation.
        let sum=products.reduce(0.0){sum,term in
            let(a,b)=term
            guard a != 0,b != 0 else{return sum}
            return sum+Double(sign:a.sign==b.sign ? .plus:.minus,exponent:a.exponent+b.exponent-exponent,significand:abs(a.significand*b.significand))
        }
        guard sum>0 else{return 0}
        let value=Double(sign:.plus,exponent:exponent,significand:sum)
        return min(Self.maximumUsedLength,max(0,value))
    }
}

/// CSS font-relative lengths require actual font metrics; SwiftUI Font does
/// not expose them. The default measures bundled Roboto's real zero advance.
/// parentHeight is supplied only for a definite authored containing block.
public struct AWCSkeletonSizingContext:Equatable,Sendable {
    public let fontSize:Double,rootFontSize:Double,zeroGlyphAdvance:Double?,parentHeight:Double?
    public init(fontSize:Double=16,rootFontSize:Double=16,zeroGlyphAdvance:Double?=nil,parentHeight:Double?=nil){
        self.fontSize=fontSize.isFinite && fontSize>=0 ? min(fontSize,AWCSkeletonLength.maximumUsedLength):16
        self.rootFontSize=rootFontSize.isFinite && rootFontSize>=0 ? min(rootFontSize,AWCSkeletonLength.maximumUsedLength):16
        self.zeroGlyphAdvance=zeroGlyphAdvance.flatMap{$0.isFinite && $0>=0 ? min($0,AWCSkeletonLength.maximumUsedLength):nil}
        self.parentHeight=parentHeight.flatMap{$0.isFinite && $0>=0 ? min($0,AWCSkeletonLength.maximumUsedLength):nil}
    }
    var resolvedZeroAdvance:Double{
        if let zeroGlyphAdvance{return zeroGlyphAdvance}
        guard fontSize>0 else{return 0}
        _=AWCNativeFonts.labelFamily(regular:true)
        let font=CTFontCreateWithName("Roboto-Regular" as CFString,fontSize,nil)
        var character:UniChar=48,glyph:CGGlyph=0,advance=CGSize.zero
        CTFontGetGlyphsForCharacters(font,&character,&glyph,1)
        CTFontGetAdvancesForGlyphs(font,.horizontal,&glyph,&advance,1)
        return advance.width
    }
}
private struct AWCSkeletonSizingKey:EnvironmentKey{static let defaultValue=AWCSkeletonSizingContext()}
public extension EnvironmentValues{var awcSkeletonSizingContext:AWCSkeletonSizingContext{get{self[AWCSkeletonSizingKey.self]}set{self[AWCSkeletonSizingKey.self]=newValue}}}
public extension View{func awcSkeletonSizingContext(_ value:AWCSkeletonSizingContext)->some View{environment(\.awcSkeletonSizingContext,value)}}

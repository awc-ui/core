import SwiftUI

/// One physical CSS box-shadow layer, expressed in native points.
public struct AWCBoxShadow: Equatable, Sendable {
    public let x: Double, y: Double, blur: Double, spread: Double, color: String, inset: Bool
    public init(x: Double = 0, y: Double = 0, blur: Double = 0, spread: Double = 0, color: String = "#000000", inset: Bool = false) {
        self.x=x; self.y=y; self.blur=blur; self.spread=spread; self.color=color.uppercased(); self.inset=inset
    }
    var valid: Bool { [x,y,blur,spread].allSatisfy(\.isFinite) && blur>=0 && color.range(of:"^#[0-9A-F]{6}([0-9A-F]{2})?$",options:.regularExpression) != nil }
    public init?(values: [String: AWCValue]) {
        guard Set(values.keys).isSubset(of:["x","y","blur","spread","color","inset"]) else { return nil }
        func n(_ key: String) -> Double? { guard let v=values[key] else { return 0 }; guard case .number(let number)=v else { return nil }; return number }
        guard let x=n("x"),let y=n("y"),let blur=n("blur"),let spread=n("spread") else { return nil }
        let color: String; if let v=values["color"] { guard case .string(let s)=v else { return nil }; color=s } else { color="#000000" }
        let inset: Bool; if let v=values["inset"] { guard case .bool(let b)=v else { return nil }; inset=b } else { inset=false }
        self.init(x:x,y:y,blur:blur,spread:spread,color:color,inset:inset); if !valid { return nil }
    }
    /// Parses resolved source elevation tokens, including rgba() and hex layers.
    /// Public native consumers use the typed initializer rather than CSS text.
    static func source(_ source: String) -> [Self]? {
        if source.trimmingCharacters(in:.whitespacesAndNewlines)=="none" { return [] }
        var depth=0, current="", layers:[String]=[]
        for c in source { if c=="(" {depth+=1}; if c==")" {depth-=1;if depth<0{return nil}}; if c=="," && depth==0 {layers.append(current);current=""} else {current.append(c)} }
        guard depth==0 else {return nil}; layers.append(current)
        let colorRegex=try! NSRegularExpression(pattern:"#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|rgba?\\([^)]*\\)")
        var result:[Self]=[]
        for layer in layers {
            guard let match=colorRegex.firstMatch(in:layer,range:NSRange(layer.startIndex...,in:layer)),let range=Range(match.range,in:layer) else {return nil}
            let text=String(layer[range]), color:String
            if text.hasPrefix("#") { color=text }
            else {
                let numbers=text.drop(while:{$0 != "("}).dropFirst().dropLast().split(separator:",").compactMap{Double($0.trimmingCharacters(in:.whitespaces))}
                guard numbers.count==3 || numbers.count==4,numbers.allSatisfy(\.isFinite) else {return nil}
                let channels=numbers.prefix(3).map{Int(min(255,max(0,$0)).rounded())}, alpha=Int((min(1,max(0,numbers.count==4 ? numbers[3]:1))*255).rounded())
                color=String(format:"#%02X%02X%02X%02X",channels[0],channels[1],channels[2],alpha)
            }
            let tokens=layer.replacingCharacters(in:range,with:"").split(whereSeparator:{$0.isWhitespace})
            let inset=tokens.contains("inset"), lengthTokens=tokens.filter{$0 != "inset"}
            let lengths=lengthTokens.compactMap{Double($0.hasSuffix("px") ? $0.dropLast(2):$0[...])}
            guard tokens.filter({$0=="inset"}).count<=1, lengths.count==lengthTokens.count, (2...4).contains(lengths.count) else {return nil}
            let value=Self(x:lengths[0],y:lengths[1],blur:lengths.count>2 ? lengths[2]:0,spread:lengths.count>3 ? lengths[3]:0,color:color,inset:inset)
            guard value.valid else {return nil}; result.append(value)
        }
        return result
    }
}

extension AWCCornerShape {
    func interpolated(to target: Self, fraction: Double) -> Self {
        let t=min(1,max(0,fraction))
        func length(_ a:AWCCornerLength,_ b:AWCCornerLength)->AWCCornerLength { .init(points:a.points*(1-t)+b.points*t,fraction:a.fraction*(1-t)+b.fraction*t) }
        func corner(_ a:AWCCornerRadius,_ b:AWCCornerRadius)->AWCCornerRadius { .init(x:length(a.x,b.x),y:length(a.y,b.y)) }
        return .init(topLeft:corner(topLeft,target.topLeft),topRight:corner(topRight,target.topRight),bottomRight:corner(bottomRight,target.bottomRight),bottomLeft:corner(bottomLeft,target.bottomLeft))
    }
    func spread(_ amount: Double, in size: CGSize) -> Self {
        let radii=radii(in:size).map { value in AWCCornerRadius(x:.points(max(0,value.width+amount)),y:.points(max(0,value.height+amount))) }
        return .init(topLeft:radii[0],topRight:radii[1],bottomRight:radii[2],bottomLeft:radii[3])
    }
}

/// Premultiplied sRGB interpolation matches CSS colors with transparent ends.
func awcInterpolatedColor(_ start: Color, _ end: Color, _ fraction: Double) -> Color {
    let a=start.resolve(in:EnvironmentValues()),b=end.resolve(in:EnvironmentValues()),t=Float(min(1,max(0,fraction)))
    let alpha=a.opacity*(1-t)+b.opacity*t
    guard alpha>0 else {return .clear}
    return Color(.sRGB,red:Double((a.red*a.opacity*(1-t)+b.red*b.opacity*t)/alpha),green:Double((a.green*a.opacity*(1-t)+b.green*b.opacity*t)/alpha),blue:Double((a.blue*a.opacity*(1-t)+b.blue*b.opacity*t)/alpha),opacity:Double(alpha))
}

/// Paint shadows outside the surface without darkening translucent content.
/// The first CSS layer is topmost. Insets are painted inside the same shape.
struct AWCNativeBoxShadow: View {
    enum Placement { case all, outer, inner }
    let corners: AWCCornerShape, layers: [AWCBoxShadow]
    var toLayers: [AWCBoxShadow]? = nil
    var fraction = 0.0
    var placement: Placement = .all
    var paint: [(AWCBoxShadow,Color)] {
        guard let target = toLayers else { return layers.map { ($0,Color(awcHex:$0.color)) } }
        let t=min(1,max(0,fraction))
        // A mismatched inset pair makes the entire shadow list discrete.
        if zip(layers,target).contains(where:{$0.inset != $1.inset}) {
            return (t<0.5 ? layers:target).map { ($0,Color(awcHex:$0.color)) }
        }
        return (0..<max(layers.count,target.count)).map { index in
            let base = layers.indices.contains(index) ? layers[index] : target[index]
            let a = layers.indices.contains(index) ? layers[index] : AWCBoxShadow(color:"#00000000",inset:base.inset)
            let b = target.indices.contains(index) ? target[index] : AWCBoxShadow(color:"#00000000",inset:base.inset)
            func blend(_ x: Double,_ y:Double)->Double { x*(1-t)+y*t }
            return (AWCBoxShadow(x:blend(a.x,b.x),y:blend(a.y,b.y),blur:blend(a.blur,b.blur),spread:blend(a.spread,b.spread),inset:a.inset),awcInterpolatedColor(Color(awcHex:a.color),Color(awcHex:b.color),t))
        }
    }
    var body: some View {
        GeometryReader { geometry in
            let extent=paint.reduce(24.0) { max($0,abs($1.0.x)+abs($1.0.y)+abs($1.0.spread)+$1.0.blur*2+2) }
            Canvas { context,size in
                let box=CGRect(x:extent,y:extent,width:geometry.size.width,height:geometry.size.height)
                let shape=AWCNativeCornerShape(corners:corners), host=shape.path(in:box)
                for (shadow,ink) in paint.reversed() where placement == .all || (shadow.inset ? placement == .inner:placement == .outer) {
                    var layerContext=context
                    if shadow.inset { layerContext.clip(to:host) }
                    else { var outside=Path(CGRect(origin:.zero,size:size)); outside.addPath(host); layerContext.clip(to:outside,style:.init(eoFill:true)) }
                    layerContext.drawLayer { layer in
                        // CSS blur b is a Gaussian of standard deviation b/2. On macOS a GraphicsContext blur of
                        // radius r renders standard deviation r/√2 (measured against Chrome: b=6 → 2.1,
                        // b=24 → 8.4 with r=b/2), so r = b/√2. On UIKit the same filter renders 0.948 r on
                        // screen (NativeIOSBlurProbe2: 0.942–0.951 for r = 3…24 at 2× and 3×; macOS 0.70–0.71),
                        // so r = b/(2 · 0.948): with b/√2 iOS shadows were 1.34× wider than Chrome's.
                        #if canImport(AppKit)
                        layer.addFilter(.blur(radius:shadow.blur/2.squareRoot()))
                        #else
                        layer.addFilter(.blur(radius:shadow.blur/(2*0.948)))
                        #endif
                        let amount=shadow.inset ? -shadow.spread:shadow.spread
                        let rect=box.insetBy(dx:-amount,dy:-amount).offsetBy(dx:shadow.x,dy:shadow.y)
                        let expanded=AWCNativeCornerShape(corners:corners.spread(amount,in:box.size)).path(in:rect)
                        if shadow.inset { var outside=Path(CGRect(origin:.zero,size:size)); outside.addPath(expanded); layer.fill(outside,with:.color(ink),style:.init(eoFill:true)) }
                        else { layer.fill(expanded,with:.color(ink)) }
                    }
                }
            }.frame(width:geometry.size.width+extent*2,height:geometry.size.height+extent*2).offset(x:-extent,y:-extent)
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
}

/// The Material elevation shadow of a surface: the theme's `--md-sys-elevation-N` box-shadow token, painted outside the
/// border box like CSS (`AWCNativeBoxShadow`, `.outer`), so translucent containers never show it. Animatable: the level
/// interpolates layer by layer like a CSS box-shadow transition, and the corners follow the surface's own corner motion
/// (`radii` = physical top-left, top-right, bottom-right, bottom-left; `circle` morphs every corner toward 50% / 50%).
struct AWCElevationShadow: View, Animatable {
    var level: Double
    var radii: [Double]
    var circle: Double = 0
    let tokens: [String: String]
    var animatableData: AnimatablePair<AnimatablePair<Double, Double>, AnimatablePair<AnimatablePair<Double, Double>, AnimatablePair<Double, Double>>> {
        get { .init(.init(level, circle), .init(.init(radii[0], radii[1]), .init(radii[2], radii[3]))) }
        set { level = newValue.first.first; circle = newValue.first.second
            radii = [newValue.second.first.first, newValue.second.first.second, newValue.second.second.first, newValue.second.second.second] }
    }
    private func layers(_ n: Int) -> [AWCBoxShadow] { n <= 0 ? [] : AWCBoxShadow.source(tokens["--md-sys-elevation-\(n)"] ?? "none") ?? [] }
    private func corner(_ r: Double) -> AWCCornerRadius { .init(.init(points: max(0, r) * (1 - circle), fraction: 0.5 * circle)) }
    private var corners: AWCCornerShape { .init(topLeft: corner(radii[0]), topRight: corner(radii[1]), bottomRight: corner(radii[2]), bottomLeft: corner(radii[3])) }
    var body: some View {
        let lo = max(0, Int(level.rounded(.down))), hi = max(0, Int(level.rounded(.up)))
        AWCNativeBoxShadow(corners: corners, layers: layers(lo), toLayers: lo == hi ? nil : layers(hi), fraction: level - Double(lo), placement: .outer)
    }
}

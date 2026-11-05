import SwiftUI

/// A radius coefficient in native points plus a fraction of the corresponding
/// box dimension. Signed coefficients retain CSS calc(percent - points).
public struct AWCCornerLength:Equatable,Sendable {
    public let points:Double,fraction:Double
    public init(points:Double=0,fraction:Double=0){self.points=points;self.fraction=fraction}
    public static func points(_ value:Double)->Self{.init(points:value)}
    public static func fraction(_ value:Double)->Self{.init(fraction:value)}
    var valid:Bool{points.isFinite && fraction.isFinite}
}
/// The independent horizontal/vertical radii of one physical corner.
public struct AWCCornerRadius:Equatable,Sendable {
    public let x:AWCCornerLength,y:AWCCornerLength
    public init(x:AWCCornerLength = .init(),y:AWCCornerLength = .init()){self.x=x;self.y=y}
    public init(_ radius:AWCCornerLength){x=radius;y=radius}
    var valid:Bool{x.valid && y.valid}
}
/// Physical CSS border-radius corners. Percentage axes and all four corners
/// share the CSS overlap normalization factor; RTL does not reorder them.
public struct AWCCornerShape:Equatable,Sendable {
    public let topLeft:AWCCornerRadius,topRight:AWCCornerRadius,bottomRight:AWCCornerRadius,bottomLeft:AWCCornerRadius
    public init(topLeft:AWCCornerRadius = .init(),topRight:AWCCornerRadius = .init(),bottomRight:AWCCornerRadius = .init(),bottomLeft:AWCCornerRadius = .init()){
        self.topLeft=topLeft;self.topRight=topRight;self.bottomRight=bottomRight;self.bottomLeft=bottomLeft
    }
    public init(_ radius:AWCCornerRadius){topLeft=radius;topRight=radius;bottomRight=radius;bottomLeft=radius}
    public static func points(_ value:Double)->Self{.init(.init(.points(value)))}
    public static func fraction(_ value:Double)->Self{.init(.init(.fraction(value)))}
    var valid:Bool{[topLeft,topRight,bottomRight,bottomLeft].allSatisfy(\.valid)}
    public init?(values:[String:AWCValue]){
        guard Set(values.keys).isSubset(of:["topLeft","topRight","bottomRight","bottomLeft"]) else{return nil}
        func length(_ value:AWCValue?)->AWCCornerLength?{
            guard let value else{return .init()}
            guard case .object(let fields)=value,Set(fields.keys).isSubset(of:["points","fraction"]) else{return nil}
            func number(_ key:String)->Double?{guard let entry=fields[key] else{return 0};guard case .number(let number)=entry,number.isFinite else{return nil};return number}
            guard let points=number("points"),let fraction=number("fraction") else{return nil};return .init(points:points,fraction:fraction)
        }
        func corner(_ value:AWCValue?)->AWCCornerRadius?{
            guard let value else{return .init()}
            guard case .object(let fields)=value,Set(fields.keys).isSubset(of:["x","y"]),let x=length(fields["x"]),let y=length(fields["y"]) else{return nil};return .init(x:x,y:y)
        }
        guard let tl=corner(values["topLeft"]),let tr=corner(values["topRight"]),let br=corner(values["bottomRight"]),let bl=corner(values["bottomLeft"]) else{return nil}
        self.init(topLeft:tl,topRight:tr,bottomRight:br,bottomLeft:bl)
    }
    func radii(in size:CGSize)->[CGSize]{
        let corners=[topLeft,topRight,bottomRight,bottomLeft]
        let dimensions=[Double(max(0,size.width)),Double(max(0,size.height))]
        let lengths=corners.flatMap{[$0.x,$0.y]}
        // Work in a common binary exponent before multiplication/addition. All
        // accepted coefficients are finite, but their raw products need not be.
        var exponent=Int.min
        for (index,length) in lengths.enumerated(){
            if length.points != 0{exponent=max(exponent,length.points.exponent)}
            if length.fraction != 0 && dimensions[index%2] != 0{exponent=max(exponent,length.fraction.exponent+dimensions[index%2].exponent)}
        }
        guard exponent != Int.min else{return Array(repeating:.zero,count:4)}
        let scaled=lengths.enumerated().map{index,length -> Double in
            let d=dimensions[index%2]
            let points=length.points==0 ? 0:Double(sign:length.points.sign,exponent:length.points.exponent-exponent,significand:abs(length.points.significand))
            let fraction=length.fraction==0 || d==0 ? 0:Double(sign:length.fraction.sign,exponent:length.fraction.exponent+d.exponent-exponent,significand:abs(length.fraction.significand)*d.significand)
            return max(0,points+fraction)
        }
        guard let maximum=scaled.max(),maximum>0 else{return Array(repeating:.zero,count:4)}
        let r=scaled.map{$0/maximum}
        var scale=Double(sign:.plus,exponent:exponent,significand:maximum)
        for (dimension,sum) in [(dimensions[0],r[0]+r[2]),(dimensions[0],r[6]+r[4]),(dimensions[1],r[1]+r[7]),(dimensions[1],r[3]+r[5])]{
            if sum>0{scale=min(scale,dimension/sum)}
        }
        return (0..<4).map{CGSize(width:r[$0*2]*scale,height:r[$0*2+1]*scale)}
    }

}
struct AWCNativeCornerShape:InsettableShape {
    let corners:AWCCornerShape
    var insetAmount:CGFloat=0
    func inset(by amount:CGFloat)->Self{var copy=self;copy.insetAmount += amount;return copy}
    func path(in rect:CGRect)->Path{
        let r=corners.radii(in:rect.size).map{CGSize(width:max(0,$0.width-insetAmount),height:max(0,$0.height-insetAmount))}
        let box=rect.insetBy(dx:insetAmount,dy:insetAmount),k:CGFloat=0.5522847498307936,l=box.minX,t=box.minY,right=box.maxX,b=box.maxY
        var path=Path();path.move(to:.init(x:l+r[0].width,y:t));path.addLine(to:.init(x:right-r[1].width,y:t))
        path.addCurve(to:.init(x:right,y:t+r[1].height),control1:.init(x:right-r[1].width*(1-k),y:t),control2:.init(x:right,y:t+r[1].height*(1-k)))
        path.addLine(to:.init(x:right,y:b-r[2].height));path.addCurve(to:.init(x:right-r[2].width,y:b),control1:.init(x:right,y:b-r[2].height*(1-k)),control2:.init(x:right-r[2].width*(1-k),y:b))
        path.addLine(to:.init(x:l+r[3].width,y:b));path.addCurve(to:.init(x:l,y:b-r[3].height),control1:.init(x:l+r[3].width*(1-k),y:b),control2:.init(x:l,y:b-r[3].height*(1-k)))
        path.addLine(to:.init(x:l,y:t+r[0].height));path.addCurve(to:.init(x:l+r[0].width,y:t),control1:.init(x:l,y:t+r[0].height*(1-k)),control2:.init(x:l+r[0].width*(1-k),y:t));path.closeSubpath();return path
    }
}

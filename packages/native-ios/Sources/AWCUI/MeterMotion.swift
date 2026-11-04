import Foundation

struct AWCNativeMeterMotion {
    var from:Double,to:Double,fromOpacity:Double,toOpacity:Double,start:Date,duration:Double,opacityDuration:Double
    static func resting(_ value:Double)->Self{.init(from:value,to:value,fromOpacity:value>0 ? 1:0,toOpacity:value>0 ? 1:0,start:Date(),duration:0,opacityDuration:0)}
    func sample(_ date:Date)->(fraction:Double,opacity:Double){
        let elapsed=max(0,date.timeIntervalSince(start)),fraction=duration<=0 ? 1:min(1,elapsed/duration),alpha=opacityDuration<=0 ? 1:min(1,elapsed/opacityDuration)
        let eased=fraction<=0 ? 0:fraction>=1 ? 1:AWCNativeLoadingMotion.cubic(fraction,0.2,0,0,1)
        return (from+(to-from)*eased,fromOpacity+(toOpacity-fromOpacity)*alpha)
    }
}

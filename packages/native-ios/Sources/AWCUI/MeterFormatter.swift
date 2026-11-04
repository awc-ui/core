import Foundation
import JavaScriptCore

/// The same bounded reading is used by paint, visible text and accessibility.
public struct AWCMeterReading:Equatable,Sendable {
    public let minimum:Double,maximum:Double,value:Double,fraction:Double
    public init(value:Double,minimum:Double=0,maximum:Double=100){
        self.minimum=minimum.isFinite ? minimum:0
        self.maximum=max(self.minimum,maximum.isFinite ? maximum:100)
        self.value=min(self.maximum,max(self.minimum,value.isFinite ? value:self.minimum))
        // Scale an extreme finite interval before subtraction can overflow.
        let range=self.maximum-self.minimum
        if self.maximum==self.minimum{fraction=0}
        else if range.isFinite{fraction=(self.value-self.minimum)/range}
        else{fraction=(self.value/2-self.minimum/2)/(self.maximum/2-self.minimum/2)}
    }
}
/// Public native formatting uses the system JavaScriptCore Intl implementation.
/// It has no DOM, WebView or Laboratory dependency. Options remain data objects;
/// user strings are never evaluated as JavaScript source. Availability of newer
/// Intl options and locale/CLDR data follows the installed Apple OS runtime.
public enum AWCMeterFormatter {
    private static let engine=AWCMeterIntlEngine()
    public static func format(_ reading:AWCMeterReading,locale:String="",options:[String:AWCValue]?=nil,valueText:String="")->String{
        if !valueText.isEmpty{return valueText}
        return engine.format(reading,locale:locale,options:options)
    }
}
private final class AWCMeterIntlEngine {
    private let lock=NSRecursiveLock()
    private let context=JSContext()!
    private let function:JSValue
    // Intl distinguishes -0 from +0 for signDisplay/accounting. Swift Double
    // equality deliberately does not, so retain their IEEE representations.
    private struct Key:Hashable{let value:UInt64,fraction:UInt64,locale:String,options:[String:AWCValue]?}
    private var cache:[Key:String]=[:],order:[Key]=[]
    init(){
        function=context.evaluateScript("""
        (function(value, fraction, locale, hasOptions, options) {
          try {
            return hasOptions
              ? new Intl.NumberFormat(locale || undefined, options).format(value)
              : new Intl.NumberFormat(locale || undefined, {style:'percent'}).format(fraction);
          } catch (_) { return String(value); }
        })
        """)!
    }
    private func object(_ value:AWCValue)->Any{
        switch value{
        case .string(let v):return v
        case .number(let v):return NSNumber(value:v)
        case .bool(let v):return NSNumber(value:v)
        case .array(let v):return v.map(object)
        case .object(let v):return v.mapValues(object)
        case .null:return NSNull()
        }
    }
    func format(_ reading:AWCMeterReading,locale:String,options:[String:AWCValue]?)->String{
        lock.lock();defer{lock.unlock()}
        let key=Key(value:reading.value.bitPattern,fraction:reading.fraction.bitPattern,locale:locale,options:options)
        if let result=cache[key]{return result}
        context.exception=nil
        let result=function.call(withArguments:[reading.value,reading.fraction,locale,options != nil,object(.object(options ?? [:]))])?.toString() ?? AWCValue.number(reading.value).string
        if order.count>=128{cache[order.removeFirst()]=nil}
        order.append(key);cache[key]=result;return result
    }
}

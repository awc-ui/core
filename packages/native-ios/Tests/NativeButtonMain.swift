import Foundation

@main enum NativeButtonMain {
    static func main() {
        var checks = 0
        NativeButtonMetricCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native button metric contract failed: \(message)") }
        }
        print("Passed \(checks) native button typography, corners, outline and density checks.")
    }
}

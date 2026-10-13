import Foundation

@main enum NativeButtonMain {
    static func main() {
        var checks = 0
        NativeButtonMetricCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native button metric contract failed: \(message)") }
        }
        NativeButtonAppearanceCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native button appearance contract failed: \(message)") }
        }
        print("Passed \(checks) native button metric and appearance checks.")
    }
}

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
        NativeIconButtonCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native icon-button contract failed: \(message)") }
        }
        NativeButtonGroupCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native button-group contract failed: \(message)") }
        }
        NativeFabCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native FAB contract failed: \(message)") }
        }
        print("Passed \(checks) native button/icon-button/button-group/FAB metric, appearance, slot and action checks.")
    }
}

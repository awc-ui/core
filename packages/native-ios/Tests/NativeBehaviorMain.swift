import Foundation

@main enum NativeBehaviorMain {
    static func main() {
        var checks = 0
        NativeBehaviorContractCases.run { valid, message in
            checks += 1
            guard valid else { fatalError("Native behavior contract failed: \(message)") }
        }
        print("Passed \(checks) native cancellation, event order, form validation/reset, routing and slot checks.")
    }
}

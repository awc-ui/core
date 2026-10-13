@main enum NativePreviewSlotsMain {
    static func main() throws {
        var checks = 0
        try NativePreviewSlotCases.run { valid, message in
            checks += 1
            precondition(valid, message)
        }
        print("Passed \(checks) native preview slot contract checks.")
    }
}

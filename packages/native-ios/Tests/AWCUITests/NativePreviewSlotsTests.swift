import XCTest

final class NativePreviewSlotsTests: XCTestCase {
    func testPreviewSlotContracts() throws {
        try NativePreviewSlotCases.run { valid, message in XCTAssertTrue(valid, message) }
    }
}

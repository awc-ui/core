import XCTest
@testable import AWCUI
final class NativeBadgeTests: XCTestCase {
    func testSourceContracts() throws {
        try NativeBadgeCases.run { XCTAssertTrue($0, $1) }
    }
}

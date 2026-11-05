import XCTest
@testable import AWCUI

final class NativeStatusDotTests: XCTestCase {
    func testSourceContracts() throws {
        try NativeStatusDotCases.run { XCTAssertTrue($0, $1) }
    }
}

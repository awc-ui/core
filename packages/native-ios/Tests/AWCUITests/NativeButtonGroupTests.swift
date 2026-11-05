import XCTest
@testable import AWCUI
final class NativeButtonGroupTests: XCTestCase {
    func testSourceContracts() { NativeButtonGroupCases.run { XCTAssertTrue($0,$1) } }
}

import XCTest
@testable import AWCUI
final class NativeIconButtonTests: XCTestCase {
    func testSourceContracts() { NativeIconButtonCases.run { valid, message in XCTAssertTrue(valid, message) } }
}

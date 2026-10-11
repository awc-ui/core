import XCTest
@testable import AWCUI

final class NativeBehaviorTests: XCTestCase {
    func testNativeButtonBehaviorContracts() {
        NativeBehaviorContractCases.run { valid, message in XCTAssertTrue(valid, message) }
    }
}

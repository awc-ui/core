import XCTest
@testable import AWCUI
final class NativeFabTests:XCTestCase {
    func testSourceContracts(){NativeFabCases.run{XCTAssertTrue($0,$1)}}
}

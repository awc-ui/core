// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "AWCUI",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AWCUI", targets: ["AWCUI"])],
    targets: [.target(name: "AWCUI")]
)
